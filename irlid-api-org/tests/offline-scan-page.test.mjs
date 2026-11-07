// Live test 7 Nov 2026 (v6.8.6, Pixel 8 Pro): with mobile data off, scanning
// the venue check-in QR opened a blank page instead of saving an offline
// check-in (rules C1, C7). Causes: org-entry.html never registered the service
// worker, so a phone that had only ever scanned had nothing cached; and even
// with the worker, the cache lookup used the exact URL, so
// org-entry.html?type=checkin&org=..&n=.. and js/sign.js?v=3.1 never matched
// the cached copies. These tests run the real sw.js against a fake cache and a
// dead network.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const ROOT = new URL("../../", import.meta.url);
const swSource = readFileSync(new URL("sw.js", ROOT), "utf8");
const entryHtml = readFileSync(new URL("org-entry.html", ROOT), "utf8");
const orgHtml = readFileSync(new URL("Org.html", ROOT), "utf8");
const ORIGIN = "https://irlid.co.uk";

// A minimal Cache Storage: one cache, keyed by full URL, honouring ignoreSearch.
function fakeCaches() {
  const store = new Map();
  // Requests may be relative (sw.js pre-caches new Request("./Org.html", { cache: "reload" })).
  const keyOf = (req) => new URL(typeof req === "string" ? req : req.url, ORIGIN + "/").toString();
  const find = (req, opts = {}) => {
    const key = keyOf(req);
    if (store.has(key)) return store.get(key);
    if (opts.ignoreSearch) {
      const bare = key.split("?")[0];
      for (const [k, v] of store) if (k.split("?")[0] === bare) return v;
    }
    return undefined;
  };
  const cache = {
    put: async (req, res) => { store.set(keyOf(req), res); },
    addAll: async (list) => { for (const u of list) store.set(keyOf(u), { body: "cached " + new URL(keyOf(u)).pathname, ok: true }); },
    add: async (req) => { store.set(keyOf(req), { body: "cached " + keyOf(req), ok: true }); }
  };
  return {
    store,
    open: async () => cache,
    keys: async () => [],
    delete: async () => true,
    match: async (req, opts) => find(req, opts)
  };
}

function loadWorker() {
  const listeners = {};
  const caches = fakeCaches();
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: async () => {},
    clients: { claim: async () => {} }
  };
  const ctx = createContext({
    self, caches, URL, console, Promise,
    Request: class { constructor(url, init = {}) { this.url = url; this.mode = init.mode || "no-cors"; this.method = "GET"; } },
    fetch: async () => { throw new TypeError("Failed to fetch"); } // data off
  });
  runInContext(swSource, ctx);
  return {
    caches,
    async install() {
      let p; listeners.install({ waitUntil: (x) => { p = x; } }); await p;
    },
    // Returns the response the worker gives, or "passthrough" if it does not answer.
    async request(path, mode = "no-cors") {
      const url = new URL(path, ORIGIN + "/").toString();
      let responded = null;
      listeners.fetch({ request: { url, mode, method: "GET" }, respondWith: (p) => { responded = p; } });
      if (!responded) return "passthrough";
      try { return await responded; } catch (e) { return "error: " + e.message; }
    }
  };
}

test("org-entry.html registers the service worker (a scan-only phone gets the offline page)", () => {
  assert.match(entryHtml, /navigator\.serviceWorker\.register\('sw\.js'\)/);
});

test("offline: a scanned venue QR opens the cached check-in page, not a blank or the dashboard", async () => {
  const sw = loadWorker();
  await sw.install();
  const res = await sw.request("/org-entry.html?type=checkin&org=imbue&event_id=ev1&n=cin_abc", "navigate");
  assert.equal(res && res.body, "cached /org-entry.html");
});

test("offline: the check-in page's scripts load, including sign.js?v=3.1", async () => {
  const sw = loadWorker();
  await sw.install();
  for (const path of ["/js/sign.js?v=3.1", "/js/offline-queue.js", "/js/orgapi.js", "/js/qr-fullscreen.js", "/js/brand-fonts.js"]) {
    const res = await sw.request(path);
    assert.equal(res && res.body, "cached " + path.split("?")[0], path);
  }
});

test("offline: the QR library is pre-cached for the phone's doorman QR", async () => {
  const sw = loadWorker();
  await sw.install();
  const src = entryHtml.match(/<script src="(https:\/\/cdnjs[^"]+qrcode\.min\.js)"/)[1];
  const res = await sw.request(src);
  assert.ok(res && res.ok, "qrcode.min.js served from cache");
});

test("offline: extensionless /Org and /org-entry load their cached pages", async () => {
  const sw = loadWorker();
  await sw.install();
  assert.equal((await sw.request("/Org", "navigate")).body, "cached /Org.html");
  assert.equal((await sw.request("/org-entry?type=checkin&org=imbue", "navigate")).body, "cached /org-entry.html");
});

test("offline: Org.html's push and login scripts are served (were passed through)", async () => {
  const sw = loadWorker();
  await sw.install();
  for (const path of ["/js/orghub-client.js", "/js/login-poll.js"]) {
    const res = await sw.request(path);
    assert.equal(res && res.body, "cached " + path, path);
  }
});

test("consumer pages and the Worker API are still not intercepted", async () => {
  const sw = loadWorker();
  await sw.install();
  assert.equal(await sw.request("/index.html", "navigate"), "passthrough");
  assert.equal(await sw.request("/scan.html", "navigate"), "passthrough");
  assert.equal(await sw.request("https://irlid-api-org.irlid-bunhead.workers.dev/org/checkin"), "passthrough");
});

test("cache and build moved on (W8)", () => {
  assert.ok(Number(swSource.match(/CACHE_VERSION = 'irlid-shell-v(\d+)'/)[1]) >= 197);
  assert.match(orgHtml, /Build v6\.(8\.([7-9]|\d\d)|(9|\d\d)\.\d+)</, "build is v6.8.7 or later");
});
