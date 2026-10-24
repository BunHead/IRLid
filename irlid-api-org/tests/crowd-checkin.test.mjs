// Crowd check-in (docs/design-crowd-checkin.md) under the offline-first rule
// (docs/requirements/offline-first.md): a crowd check-in with no code, or a
// stale / used code (e.g. replayed from the offline queue a day later), is
// accepted as "offline" and never refused. The harness is the same as
// offline-first.test.mjs: real SQLite + the browser offline queue in a VM.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import worker from "../src/index.js";

const CROWD = "ev-crowd";
const ORG_KEY = "org_offline_test_key_123456";
const OTHER_KEY = "org_other_key_1234567890";
const DAY = 24 * 60 * 60;

class D1Statement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  stmt() { return this.db.prepare(this.sql); }
  async first() { return this.stmt().get(...this.args) ?? null; }
  async all() { return { results: this.stmt().all(...this.args) }; }
  async run() {
    if (/\bRETURNING\b/i.test(this.sql)) return { results: this.stmt().all(...this.args), meta: {} };
    const info = this.stmt().run(...this.args);
    return { meta: { changes: Number(info.changes) } };
  }
}

class D1 {
  constructor(settings = { anonymousMode: true }) {
    this.db = new DatabaseSync(":memory:");
    this.db.exec(`
      CREATE TABLE organisations (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, api_key TEXT NOT NULL UNIQUE, venue_pub_jwk TEXT, venue_prv_jwk TEXT, settings_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE org_checkins (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, mode TEXT NOT NULL, attendee_label TEXT, attendee_key_id TEXT, hello_hash TEXT, score INTEGER, bio_verified INTEGER DEFAULT 0, gps_hash TEXT, checkin_at INTEGER NOT NULL, checkout_at INTEGER, duration_s INTEGER, created_at INTEGER NOT NULL, name TEXT, attendee_pub_jwk TEXT, device_key_fp TEXT, status TEXT DEFAULT 'checked_in', expected_id INTEGER, conflict_id INTEGER, event_id TEXT, assurance TEXT);
      CREATE TABLE org_checkin_nonces (nonce TEXT PRIMARY KEY, org_api_key TEXT NOT NULL, event_id TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, consumed_at INTEGER);
      CREATE TABLE org_receipts (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, checkin_id TEXT, attendee_pub_fp TEXT, payload_json TEXT NOT NULL, signature TEXT NOT NULL, created_at INTEGER NOT NULL, privacy_mode INTEGER DEFAULT 1);
      CREATE TABLE org_expected (id INTEGER PRIMARY KEY AUTOINCREMENT, org_id TEXT NOT NULL, display_name TEXT, initials TEXT, role_key TEXT, device_pub_fp TEXT, email_hint TEXT, phone_hint TEXT, notes TEXT, created_at INTEGER, archived_at INTEGER);
      CREATE TABLE expected_device_keys (org_id TEXT, expected_id INTEGER, device_key_fp TEXT, revoked_at INTEGER);
      CREATE TABLE rooms (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, label TEXT);
      CREATE TABLE weekly_events (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, room_id TEXT, name TEXT NOT NULL, day_of_week INTEGER NOT NULL, start_time_local TEXT NOT NULL, duration_min INTEGER NOT NULL, capacity INTEGER, color_hex TEXT, notes TEXT, require_proof INTEGER DEFAULT 0, late_grace_min INTEGER DEFAULT 0, created_at INTEGER NOT NULL, archived_at INTEGER);
      INSERT INTO weekly_events (id,org_id,name,day_of_week,start_time_local,duration_min,created_at) VALUES ('ev-crowd','org-1','Open day',1,'10:00',120,0);
      INSERT INTO weekly_events (id,org_id,name,day_of_week,start_time_local,duration_min,created_at) VALUES ('ev-standard','org-1','Class',1,'10:00',60,0);
    `);
    this.db.prepare("INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES (?,?,?,?,?,0,0)")
      .run("org-1", "Test Org", "test-org", ORG_KEY, JSON.stringify(settings));
    this.db.prepare("INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES (?,?,?,?,?,0,0)")
      .run("org-2", "Other Org", "other-org", OTHER_KEY, "{}");
  }
  prepare(sql) { return new D1Statement(this.db, sql); }
  async batch(statements) {
    const out = [];
    for (const s of statements) out.push(await s.run());
    return out;
  }
  checkins() { return this.db.prepare("SELECT * FROM org_checkins ORDER BY checkin_at").all(); }
}

function workerFetch(d1, input, init) {
  return worker.fetch(new Request(input, init), { DB: d1, CORS_ORIGIN: "*" });
}

async function call(d1, method, path, body, orgKey = ORG_KEY) {
  const headers = { "Content-Type": "application/json" };
  if (orgKey) headers["X-Org-Key"] = orgKey;
  const response = await workerFetch(d1, "https://worker.test" + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, body: await response.json() };
}

async function issueNonce(d1, eventId = CROWD) {
  const res = await call(d1, "POST", "/org/checkin-nonce", { event_id: eventId });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.nonce;
}

const nonceStatus = (d1, nonce, orgKey) =>
  call(d1, "GET", "/org/checkin-nonce/status?nonce=" + encodeURIComponent(nonce), null, orgKey);

async function attendeeBody(overrides = {}) {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  const pub = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
  const ts = Math.floor(Date.now() / 1000);
  return {
    mode: "attendee_scan",
    client_checkin_id: "checkin_" + crypto.randomUUID(),
    checkin_ts: ts,
    helloPayload: { mode: "attendee_scan", org: ORG_KEY, pub, ts, v: 1 },
    helloHash: "hash_" + ts,
    event_id: CROWD,
    nonce: null,
    score: 70,
    bioVerified: false,
    ...overrides
  };
}

// ---- Browser offline queue harness ---------------------------------------
// Just enough IndexedDB for js/offline-queue.js: one object store with an
// autoIncrement key, add/getAll/delete/count, async request callbacks.

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

function loadOfflineQueue(fetchImpl) {
  const listeners = {};
  const storage = new Map();
  const window = {
    crypto: globalThis.crypto,
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    dispatchEvent(ev) { (listeners[ev.type] || []).forEach(fn => fn(ev)); return true; }
  };
  const ctx = createContext({
    window,
    indexedDB: fakeIndexedDB(),
    navigator: { onLine: false }, // phone starts offline: no auto-replay on load
    document: { addEventListener() {}, visibilityState: "hidden" },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k)
    },
    fetch: (...args) => fetchImpl(...args),
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    console,
    setTimeout,
    Date
  });
  runInContext(readFileSync(new URL("../../js/offline-queue.js", import.meta.url), "utf8"), ctx);
  return { queue: window.IRLidOfflineQueue, window, storage };
}

// Queue a check-in the way org-entry.html postOrgCheckinResilient() does
// after its network retries fail.
async function queueCheckinLikeOrgEntry(queue, body) {
  const queuedBody = queue.toOfflineCheckin(body);
  return queue.enqueue({
    url: "https://worker.test/org/checkin",
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Org-Key": ORG_KEY },
    body: JSON.stringify(queuedBody),
    idempotency_key: body.client_checkin_id,
    kind: "org_checkin"
  });
}

function makeCrowd(d1) {
  // Same lazy column the Worker adds (ensureCheckinModeStorage).
  d1.db.exec("ALTER TABLE weekly_events ADD COLUMN checkin_mode TEXT DEFAULT 'standard'");
  d1.db.prepare("UPDATE weekly_events SET checkin_mode='crowd' WHERE id=?").run(CROWD);
  return d1;
}

const checkin = (d1, body) => call(d1, "POST", "/org/checkin", body);

test("crowd: a fresh code is accepted as fresh, and others scanning the same frame get in too", async () => {
  const d1 = makeCrowd(new D1());
  const nonce = await issueNonce(d1);
  for (let i = 0; i < 3; i += 1) {
    const res = await checkin(d1, await attendeeBody({ nonce }));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.assurance, "fresh");
  }
  assert.equal((await nonceStatus(d1, nonce)).body.used, true, "display rotates after the first scan");
  assert.equal(d1.checkins().length, 3);
});

test("crowd: a code-less check-in is accepted and marked offline, never 409", async () => {
  const d1 = makeCrowd(new D1());
  const res = await checkin(d1, await attendeeBody());
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.assurance, "offline");
  assert.equal(res.body.event_id, CROWD);
  assert.equal(d1.checkins()[0].assurance, "offline");
});

test("crowd: a used code past its grace falls back to offline instead of being refused", async () => {
  const d1 = makeCrowd(new D1());
  const nonce = await issueNonce(d1);
  assert.equal((await checkin(d1, await attendeeBody({ nonce }))).body.assurance, "fresh");
  d1.db.prepare("UPDATE org_checkin_nonces SET consumed_at=consumed_at-60 WHERE nonce=?").run(nonce);
  const res = await checkin(d1, await attendeeBody({ nonce }));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.assurance, "offline");
});

test("crowd: an expired or unknown code falls back to offline instead of being refused", async () => {
  const d1 = makeCrowd(new D1());
  const nonce = await issueNonce(d1);
  d1.db.prepare("UPDATE org_checkin_nonces SET expires_at=1 WHERE nonce=?").run(nonce);
  for (const code of [nonce, "cin_never_issued"]) {
    const res = await checkin(d1, await attendeeBody({ nonce: code }));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.assurance, "offline");
  }
});

test("crowd: a check-in queued offline and replayed 24 h later lands, labelled offline / unverified", async () => {
  const d1 = makeCrowd(new D1());
  const nonce = await issueNonce(d1);
  let serverUp = false;
  const { queue, storage } = loadOfflineQueue((url, init) =>
    (serverUp ? workerFetch(d1, url, init) : Promise.reject(new TypeError("Failed to fetch"))));
  const scannedAt = Math.floor(Date.now() / 1000) - DAY;
  const body = await attendeeBody({ nonce, checkin_ts: scannedAt });
  body.helloPayload.ts = scannedAt;
  await queueCheckinLikeOrgEntry(queue, body);
  assert.equal((await queue.replay()).halted, true, "still offline: kept on the phone");

  // A day later: the code is long stale and the network is back.
  d1.db.prepare("UPDATE org_checkin_nonces SET expires_at=1, consumed_at=1 WHERE nonce=?").run(nonce);
  serverUp = true;
  const pass = await queue.replay();
  assert.deepEqual({ drained: pass.drained, dropped: pass.dropped }, { drained: 1, dropped: 0 });
  assert.equal(storage.has("irlid_offline_dropped"), false);
  const [row] = d1.checkins();
  assert.equal(row.id, body.client_checkin_id);
  assert.equal(row.event_id, CROWD);
  assert.equal(row.checkin_at, scannedAt);
  assert.equal(row.assurance, "offline");
});

test("crowd: even the raw stale code (not stripped by the queue) replays without a terminal 4xx", async () => {
  const d1 = makeCrowd(new D1());
  const nonce = await issueNonce(d1);
  const { queue } = loadOfflineQueue((url, init) => workerFetch(d1, url, init));
  const body = await attendeeBody({ nonce, checkin_ts: Math.floor(Date.now() / 1000) - DAY });
  d1.db.prepare("UPDATE org_checkin_nonces SET expires_at=1, consumed_at=1 WHERE nonce=?").run(nonce);
  await queue.enqueue({
    url: "https://worker.test/org/checkin", method: "POST",
    headers: { "Content-Type": "application/json", "X-Org-Key": ORG_KEY },
    body: JSON.stringify(body), idempotency_key: body.client_checkin_id, kind: "org_checkin"
  });
  const pass = await queue.replay();
  assert.deepEqual({ drained: pass.drained, dropped: pass.dropped }, { drained: 1, dropped: 0 });
  assert.equal(d1.checkins()[0].assurance, "offline");
});

test("standard events keep single-use codes (crowd grace does not leak)", async () => {
  const d1 = makeCrowd(new D1());
  const nonce = await issueNonce(d1, "ev-standard");
  const first = await checkin(d1, await attendeeBody({ nonce, event_id: "ev-standard" }));
  assert.equal(first.body.assurance, "fresh");
  const second = await checkin(d1, await attendeeBody({ nonce, event_id: "ev-standard" }));
  assert.equal(second.status, 409);
  const noCode = await checkin(d1, await attendeeBody({ event_id: "ev-standard" }));
  assert.equal(noCode.status, 200);
  assert.equal(noCode.body.assurance, "offline");
});
