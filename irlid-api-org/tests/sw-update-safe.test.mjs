// Finding (f), Nov 2026: the phone's offline copy of kiosk-code.html (and
// org-entry.html) must survive a service-worker update that can't finish.
// Before v6.8.12 a failed pre-cache still activated the new worker, and its
// activate step deleted the old, complete cache: a phone that lost signal
// mid-update could be left with nothing to open offline.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const ROOT = new URL("../../", import.meta.url);
const swSource = readFileSync(new URL("sw.js", ROOT), "utf8");
const ORIGIN = "https://irlid.co.uk";

function fakeCacheStorage(initial = {}) {
  const caches = new Map(Object.entries(initial).map(([k, v]) => [k, new Map(v)]));
  const keyOf = (req) => new URL(typeof req === "string" ? req : req.url, ORIGIN + "/").toString();
  let failAddAll = false;
  const api = {
    caches,
    set failAddAll(v) { failAddAll = v; },
    open: async (name) => {
      if (!caches.has(name)) caches.set(name, new Map());
      const c = caches.get(name);
      return {
        put: async (req, res) => { c.set(keyOf(req), res); },
        addAll: async (list) => { if (failAddAll) throw new TypeError("Failed to fetch"); for (const u of list) c.set(keyOf(u), { ok: true }); },
        add: async (req) => { c.set(keyOf(req), { ok: true }); }
      };
    },
    keys: async () => [...caches.keys()],
    delete: async (name) => caches.delete(name),
    match: async (req) => { for (const c of caches.values()) if (c.has(keyOf(req))) return c.get(keyOf(req)); return undefined; }
  };
  return api;
}

function loadWorker(storage) {
  const listeners = {};
  const self = { location: { origin: ORIGIN }, addEventListener: (t, fn) => { listeners[t] = fn; }, skipWaiting: async () => { self.skipped = true; }, clients: { claim: async () => {} } };
  runInContext(swSource, createContext({
    self, caches: storage, URL, console: { warn() {}, log() {} }, Promise,
    Request: class { constructor(url, init = {}) { this.url = url; this.mode = init.mode || "no-cors"; } },
    fetch: async () => { throw new TypeError("Failed to fetch"); }
  }));
  const run = async (type) => { let p; listeners[type]({ waitUntil: (x) => { p = x; } }); return p; };
  return { self, install: () => run("install"), activate: () => run("activate") };
}

const version = /const CACHE_VERSION = '([^']+)'/.exec(swSource)[1];

test("every pre-cached shell file exists, so a full pre-cache can succeed", () => {
  const list = /const SHELL_ASSETS = \[([\s\S]*?)\];/.exec(swSource)[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  assert.ok(list.includes("./kiosk-code.html") && list.includes("./js/kiosk-lock.js") && list.includes("./js/sign.js"));
  for (const p of list) assert.ok(existsSync(new URL(p, ROOT)), p + " is missing");
});

test("an update that can't cache the shell in full keeps the old worker and its offline copy", async () => {
  const old = "irlid-shell-v100";
  const storage = fakeCacheStorage({ [old]: [[ORIGIN + "/kiosk-code.html", { ok: true, old: true }]] });
  storage.failAddAll = true;
  const sw = loadWorker(storage);
  await assert.rejects(sw.install(), "the install must fail so the browser keeps the old worker");
  assert.ok(!sw.self.skipped, "must not take over");
  assert.ok(storage.caches.has(old), "old cache kept");
  assert.ok(!storage.caches.has(version), "half-filled new cache removed");
  assert.equal((await storage.match(ORIGIN + "/kiosk-code.html")).old, true);
});

test("a complete update installs, takes over, and only then removes the old cache", async () => {
  const old = "irlid-shell-v100";
  const storage = fakeCacheStorage({ [old]: [[ORIGIN + "/kiosk-code.html", { ok: true, old: true }]] });
  const sw = loadWorker(storage);
  await sw.install();
  assert.ok(sw.self.skipped);
  await sw.activate();
  assert.deepEqual([...storage.caches.keys()], [version]);
  assert.ok(await storage.match(ORIGIN + "/kiosk-code.html"));
});

test("first install ever with a failed pre-cache still activates (pages fill the cache as visited)", async () => {
  const storage = fakeCacheStorage();
  storage.failAddAll = true;
  const sw = loadWorker(storage);
  await sw.install();
  assert.ok(sw.self.skipped);
});
