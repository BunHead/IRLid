// v6.8.15: a hung API request fails cleanly after a time limit, so the offline
// queue takes over (rules C1, C7) instead of the page waiting for ever. These
// drive the real js/fetch-timeout.js, js/orgapi.js and js/offline-queue.js in a
// VM. Long limits are shrunk to a few ms by a test setTimeout so the suite is fast.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const ROOT = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");

function fakeIndexedDB() {
  const stores = new Map();
  const request = (fn) => {
    const req = {};
    setTimeout(() => {
      try { req.result = fn(); req.onsuccess && req.onsuccess({ target: req }); }
      catch (e) { req.error = e; req.onerror && req.onerror({ target: req }); }
    }, 0);
    return req;
  };
  const objectStore = (name) => {
    const s = stores.get(name);
    return {
      add(value) { return request(() => { const id = ++s.seq; s.rows.set(id, { ...value, [s.keyPath]: id }); return id; }); },
      getAll() { return request(() => [...s.rows.values()].map(v => ({ ...v }))); },
      delete(id) { return request(() => { s.rows.delete(id); }); },
      count() { return request(() => s.rows.size); }
    };
  };
  const db = {
    objectStoreNames: { contains: (name) => stores.has(name) },
    createObjectStore(name, opts) { stores.set(name, { keyPath: opts.keyPath, seq: 0, rows: new Map() }); },
    transaction(name) { return { objectStore: () => objectStore(name) }; }
  };
  return {
    open() {
      const req = {};
      setTimeout(() => {
        req.result = db;
        req.onupgradeneeded && req.onupgradeneeded({ target: req });
        req.onsuccess && req.onsuccess({ target: req });
      }, 0);
      return req;
    }
  };
}



// A fetch that never answers, but stops when it is aborted (like the real one).
function hangingFetch(calls) {
  return (url, init = {}) => new Promise((_, reject) => {
    calls.push({ url, init });
    if (init.signal) init.signal.addEventListener("abort", () => reject(Object.assign(new Error("The operation was aborted"), { name: "AbortError" })));
  });
}

function load({ fetchImpl, onLine = true, shrink = true, withTimeoutScript = true }) {
  const listeners = {};
  const navigator = { onLine };
  const window = {
    crypto: globalThis.crypto,
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    dispatchEvent(ev) { (listeners[ev.type] || []).forEach(fn => fn(ev)); return true; }
  };
  const ctx = createContext({
    window,
    indexedDB: fakeIndexedDB(),
    navigator: { get onLine() { return navigator.onLine; } },
    document: { addEventListener() {}, visibilityState: "hidden" },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: (...a) => fetchImpl(...a),
    URL,
    AbortController,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    console,
    setTimeout: (fn, ms) => setTimeout(fn, shrink && ms >= 1000 ? 20 : ms),
    clearTimeout,
    Date
  });
  navigator.onLine = false;
  if (withTimeoutScript) runInContext(read("js/fetch-timeout.js"), ctx);
  runInContext(read("js/offline-queue.js"), ctx);
  runInContext(read("js/orgapi.js"), ctx);
  navigator.onLine = onLine;
  return { api: window.IRLidOrgApi, queue: window.IRLidOfflineQueue, fetchTimeout: window.IRLidFetch, navigator };
}

test("a hung request fails with a network-type error after the limit", async () => {
  const calls = [];
  const { fetchTimeout } = load({ fetchImpl: hangingFetch(calls) });
  const started = Date.now();
  await assert.rejects(() => fetchTimeout.fetch("https://worker.test/x", {}, 40), (e) => {
    assert.ok(e instanceof TypeError || e.name === "TypeError", "looks like a network failure to callers");
    assert.equal(e.timedOut, true);
    assert.match(e.message, /timed out/i);
    return true;
  });
  assert.ok(Date.now() - started < 1000, "did not wait for ever");
  assert.equal(calls[0].init.signal.aborted, true, "the hung request is cancelled");
});

test("a fast request is untouched, and the timer does not fire afterwards", async () => {
  const { fetchTimeout } = load({ fetchImpl: async () => ({ ok: true, status: 200 }) });
  const r = await fetchTimeout.fetch("https://worker.test/x", {}, 30);
  assert.equal(r.status, 200);
  await new Promise(r => setTimeout(r, 60)); // would be an unhandled rejection if the timer leaked
});

test("a caller's own abort stays an abort, not a timeout", async () => {
  const { fetchTimeout } = load({ fetchImpl: hangingFetch([]) });
  const ctl = new AbortController();
  const p = fetchTimeout.fetch("https://worker.test/x", { signal: ctl.signal }, 5000);
  ctl.abort();
  await assert.rejects(() => p, (e) => e.name === "AbortError" && !e.timedOut);
});

test("a check-in whose request hangs is queued by the dashboard client (offline queue takes over)", async () => {
  const calls = [];
  const { api, queue } = load({ fetchImpl: hangingFetch(calls) });
  const result = await api.createCheckin("org_key", { mode: "doorman_scan", client_checkin_id: "c-1" }, "session_token_1234567890");
  assert.equal(result.queued, true);
  assert.equal(await queue.count(), 1);
  assert.equal(calls.length, 1);
});

test("an admin action whose request hangs fails loudly and is never queued (S10)", async () => {
  const { api, queue } = load({ fetchImpl: hangingFetch([]) });
  await assert.rejects(() => api.deleteExpectedFull("org_key", 5, "session_token_1234567890", true), /timed out/i);
  assert.equal(await queue.count(), 0);
});

test("a queued op that hangs on replay stays queued and the pass halts for a retry", async () => {
  const { api, queue } = load({ fetchImpl: async () => { throw new TypeError("Failed to fetch"); } });
  await api.createCheckin("org_key", { mode: "doorman_scan", client_checkin_id: "c-2" }, "session_token_1234567890");
  assert.equal(await queue.count(), 1);
  // Now the network "works" but the Worker hangs.
  const calls = [];
  const second = load({ fetchImpl: hangingFetch(calls) });
  await second.queue.enqueue({ url: "https://worker.test/org/checkin", method: "POST", headers: {}, body: "{}", idempotency_key: "k-1" });
  const pass = await second.queue.replay();
  assert.equal(pass.halted, true);
  assert.equal(await second.queue.count(), 1, "nothing is dropped (C7)");
  assert.ok(calls.length >= 1);
});

test("without the timeout script the clients still work as before (plain fetch)", async () => {
  const { api } = load({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }), withTimeoutScript: false });
  const r = await api.getOrgSettings("org_key");
  assert.equal(r.ok, true);
});

test("pages that call the Worker load the timeout script, and the offline shell caches it", () => {
  for (const page of ["Org.html", "org-entry.html"]) {
    const html = read(page);
    const at = html.indexOf("js/fetch-timeout.js");
    assert.ok(at > 0, page + " loads fetch-timeout.js");
    assert.ok(at < html.indexOf("js/orgapi.js"), page + " loads it before orgapi.js");
  }
  assert.match(read("sw.js"), /'\.\/js\/fetch-timeout\.js'/);
  assert.match(read("js/backend.js"), /ctl\.abort\(\)/, "consumer API client has its own limit");
});

test("the door check-in is queued at once after a timeout or with no connection, not retried for seconds", () => {
  const html = read("org-entry.html");
  assert.match(html, /if \(err && err\.timedOut\) break;/);
  assert.match(html, /if \(navigator\.onLine === false\) break;/);
  assert.match(html, /POST_TIMEOUT_MS = 8000/);
});
