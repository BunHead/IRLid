// A halted offline-queue pass must retry on its own while the page stays
// online. Before this, it waited for an 'online' event, a tab switch or a
// reload, so the dashboard sat on SYNCING (3 Nov report). Ported from #147;
// the Delete-record half of #147 already shipped in #146.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

function memoryIndexedDB() {
  const rows = new Map();
  let seq = 0;
  const req = (fn) => { const r = {}; queueMicrotask(() => { r.result = fn(); r.onsuccess && r.onsuccess(); }); return r; };
  const store = {
    add(v) { return req(() => { const id = ++seq; rows.set(id, { ...v, id }); return id; }); },
    getAll() { return req(() => [...rows.values()].map(v => ({ ...v }))); },
    delete(id) { return req(() => { rows.delete(id); }); },
    count() { return req(() => rows.size); }
  };
  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore() {},
    transaction() { return { objectStore: () => store }; }
  };
  return { open() { const r = {}; queueMicrotask(() => { r.result = db; r.onsuccess && r.onsuccess(); }); return r; } };
}

test("a replay that halts while online schedules its own retry, which drains the queue", async () => {
  const timers = [];
  let serverUp = false;
  let calls = 0;
  const window = { addEventListener() {}, dispatchEvent() { return true; }, crypto: globalThis.crypto };
  const ctx = createContext({
    window,
    indexedDB: memoryIndexedDB(),
    navigator: { onLine: true },
    document: { addEventListener() {}, visibilityState: "visible" },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: async () => {
      calls += 1;
      if (!serverUp) return { ok: false, status: 503, clone() { return this; }, json: async () => ({}) };
      return { ok: true, status: 200, clone() { return this; }, json: async () => ({}) };
    },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    console,
    Date,
    // Capture timers instead of waiting on them.
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {}
  });
  runInContext(readFileSync(new URL("../../js/offline-queue.js", import.meta.url), "utf8"), ctx);
  const queue = window.IRLidOfflineQueue;
  timers.length = 0; // drop the on-load replay timer

  await queue.enqueue({ url: "https://worker.test/org/conflicts/x", method: "POST", headers: {}, body: "{}" });
  const first = await queue.replay();
  assert.equal(first.halted, true);
  assert.equal(await queue.count(), 1);
  assert.equal(timers.length, 1, "a retry is scheduled after a halted pass");
  assert.equal(timers[0].ms, 15000);

  serverUp = true;
  await timers[0].fn();
  // replay() is async inside the timer callback; let it settle.
  for (let i = 0; i < 20 && (await queue.count()) > 0; i += 1) await new Promise(r => setImmediate(r));
  assert.equal(await queue.count(), 0);
  assert.equal(calls, 2);
  assert.equal(timers.length, 1, "no further retry once drained");
});
