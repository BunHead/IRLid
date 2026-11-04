// Delete record / Clear attendance are admin erasure (rules R1, S10, C8):
// they must never sit in the offline queue. Go-live day (03/11/2026): a Delete
// record that hit a network failure was queued, the page said "Deleted
// record", and the stuck item replayed with a stale login token and never
// drained. These tests drive the real js/orgapi.js and js/offline-queue.js in
// a VM with a small in-memory IndexedDB.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const ROOT = new URL("../../", import.meta.url);

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


function loadClient({ fetchImpl, onLine = true }) {
  const listeners = {};
  const storage = new Map();
  const navigator = { onLine };
  const window = {
    crypto: globalThis.crypto,
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    dispatchEvent(ev) { (listeners[ev.type] || []).forEach(fn => fn(ev)); return true; }
  };
  const events = [];
  window.addEventListener("irlid:queue-dropped", (ev) => events.push(ev.detail));
  const ctx = createContext({
    window,
    indexedDB: fakeIndexedDB(),
    navigator: { get onLine() { return navigator.onLine; } },
    document: { addEventListener() {}, visibilityState: "hidden" },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k)
    },
    fetch: (...args) => fetchImpl(...args),
    URL,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    console,
    setTimeout,
    clearTimeout,
    Date
  });
  // navigator.onLine is false while loading so the queue does not auto-replay.
  navigator.onLine = false;
  runInContext(readFileSync(new URL("js/offline-queue.js", ROOT), "utf8"), ctx);
  runInContext(readFileSync(new URL("js/orgapi.js", ROOT), "utf8"), ctx);
  navigator.onLine = onLine;
  return { api: window.IRLidOrgApi, queue: window.IRLidOfflineQueue, navigator, events };
}

const networkDown = async () => { throw new TypeError("Failed to fetch"); };

test("Delete record is never queued when the network fails: it fails loudly", async () => {
  const { api, queue } = loadClient({ fetchImpl: networkDown });
  await assert.rejects(() => api.deleteExpectedFull("org_key", 5, "session_token_1234567890", true), /Failed to fetch/);
  assert.equal(await queue.count(), 0);
});

test("Delete record is never queued while the browser says it is offline", async () => {
  const { api, queue } = loadClient({ fetchImpl: networkDown, onLine: false });
  await assert.rejects(() => api.deleteExpectedFull("org_key", 5, "session_token_1234567890", false));
  assert.equal(await queue.count(), 0);
});

test("Clear attendance is never queued either", async () => {
  const { api, queue } = loadClient({ fetchImpl: networkDown });
  await assert.rejects(() => api.clearTestAttendance("org_key", false, "session_token_1234567890"));
  assert.equal(await queue.count(), 0);
});

test("Control: check-in and Delete expected can still be queued offline", async () => {
  const { api, queue } = loadClient({ fetchImpl: networkDown });
  const delExpected = await api.deleteExpected("org_key", 5, "session_token_1234567890");
  assert.equal(delExpected.queued, true);
  assert.equal(await queue.count(), 1);
});

test("A Delete record already stuck in the queue is removed unsent, the user is told, later check-ins still sync", async () => {
  const sent = [];
  const { queue, events } = loadClient({
    fetchImpl: async (url, init) => { sent.push([init.method, url]); return new Response("{}", { status: 200 }); }
  });
  await queue.enqueue({
    url: "https://irlid-api-org.irlid-bunhead.workers.dev/org/expected/5/full?force=true",
    method: "DELETE",
    headers: { "X-Org-Key": "org_key", Authorization: "Bearer stale_session_token_12345" }
  });
  await queue.enqueue({
    url: "https://irlid-api-org.irlid-bunhead.workers.dev/org/checkin",
    method: "POST",
    headers: { "X-Org-Key": "org_key" },
    body: "{}",
    kind: "org_checkin"
  });
  assert.equal(await queue.count(), 2);
  const result = await queue.replay();
  assert.equal(result.halted, false);
  assert.equal(result.dropped, 1);
  assert.equal(result.drained, 1);
  assert.equal(await queue.count(), 0);
  assert.deepEqual(sent.map(s => s[0]), ["POST"], "the erase was never sent");
  assert.equal(events.length, 1);
  assert.match(events[0].url, /\/full/);
});

test("A stuck erase does not block the queue behind a 5xx any more (it is never sent)", async () => {
  const { queue } = loadClient({ fetchImpl: async () => new Response("{}", { status: 503 }) });
  await queue.enqueue({ url: "https://irlid-api-org.irlid-bunhead.workers.dev/org/debug/clear-attendance", method: "POST", headers: {} });
  const result = await queue.replay();
  assert.equal(result.halted, false);
  assert.equal(await queue.count(), 0);
});

test("isNeverReplay matches only erasure paths", () => {
  const { queue } = loadClient({ fetchImpl: networkDown });
  assert.equal(queue.isNeverReplay({ method: "DELETE", url: "https://w.test/org/expected/9/full" }), true);
  assert.equal(queue.isNeverReplay({ method: "DELETE", url: "https://w.test/org/expected/9" }), false);
  assert.equal(queue.isNeverReplay({ method: "POST", url: "https://w.test/org/checkin" }), false);
});

test("Org.html only says 'Deleted record' when the Worker confirmed, and the build is bumped (W8)", () => {
  const html = readFileSync(new URL("Org.html", ROOT), "utf8");
  assert.match(html, /deleteResult\.queued \|\| deleteResult\.deleted !== true/);
  assert.match(html, /Build v6\.7\.2/);
  assert.match(readFileSync(new URL("sw.js", ROOT), "utf8"), /CACHE_VERSION = 'irlid-shell-v189'/);
});
