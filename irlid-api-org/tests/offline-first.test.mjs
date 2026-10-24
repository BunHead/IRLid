// Offline-first check-in (docs/requirements/offline-first.md).
//
// Runs the Worker against a real in-memory SQLite (node:sqlite) and drives
// the browser offline queue (js/offline-queue.js) in a VM with a small
// in-memory IndexedDB, so a check-in can be queued on the "phone" and
// replayed into the Worker later, exactly as org-entry.html does it.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import worker, { venueGpsBand } from "../src/index.js";

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
      CREATE TABLE org_checkins (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, mode TEXT NOT NULL, attendee_label TEXT, attendee_key_id TEXT, hello_hash TEXT, score INTEGER, bio_verified INTEGER DEFAULT 0, gps_hash TEXT, checkin_at INTEGER NOT NULL, checkout_at INTEGER, duration_s INTEGER, created_at INTEGER NOT NULL, name TEXT, attendee_pub_jwk TEXT, device_key_fp TEXT, status TEXT DEFAULT 'checked_in', expected_id INTEGER, conflict_id INTEGER, event_id TEXT, assurance TEXT, gps_band TEXT, gps_distance_km REAL);
      CREATE TABLE org_checkin_nonces (nonce TEXT PRIMARY KEY, org_api_key TEXT NOT NULL, event_id TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, consumed_at INTEGER);
      CREATE TABLE org_receipts (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, checkin_id TEXT, attendee_pub_fp TEXT, payload_json TEXT NOT NULL, signature TEXT NOT NULL, created_at INTEGER NOT NULL, privacy_mode INTEGER DEFAULT 1);
      CREATE TABLE org_expected (id INTEGER PRIMARY KEY AUTOINCREMENT, org_id TEXT NOT NULL, display_name TEXT, initials TEXT, role_key TEXT, device_pub_fp TEXT, email_hint TEXT, phone_hint TEXT, notes TEXT, created_at INTEGER, archived_at INTEGER);
      CREATE TABLE expected_device_keys (org_id TEXT, expected_id INTEGER, device_key_fp TEXT, revoked_at INTEGER);
      CREATE TABLE rooms (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, label TEXT);
      CREATE TABLE weekly_events (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, room_id TEXT, name TEXT NOT NULL, day_of_week INTEGER NOT NULL, start_time_local TEXT NOT NULL, duration_min INTEGER NOT NULL, capacity INTEGER, color_hex TEXT, notes TEXT, require_proof INTEGER DEFAULT 0, late_grace_min INTEGER DEFAULT 0, created_at INTEGER NOT NULL, archived_at INTEGER);
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

async function issueNonce(d1) {
  const res = await call(d1, "POST", "/org/checkin-nonce", { event_id: null });
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
    event_id: null,
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

// ---- (a) "has my QR been scanned?" endpoint --------------------------------

test("nonce status: unused, then used straight after a live-QR check-in", async () => {
  const d1 = new D1();
  const nonce = await issueNonce(d1);
  const before = await nonceStatus(d1, nonce);
  assert.equal(before.status, 200);
  assert.equal(before.body.used, false);
  assert.equal(before.body.expired, false);

  const res = await call(d1, "POST", "/org/checkin", await attendeeBody({ nonce }));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.assurance, "fresh");

  const after = await nonceStatus(d1, nonce);
  assert.equal(after.status, 200);
  assert.equal(after.body.used, true);
});

test("nonce status is read-only and scoped to the org", async () => {
  const d1 = new D1();
  const nonce = await issueNonce(d1);
  for (let i = 0; i < 3; i += 1) await nonceStatus(d1, nonce);
  assert.equal(d1.db.prepare("SELECT consumed_at FROM org_checkin_nonces WHERE nonce=?").get(nonce).consumed_at, null);
  assert.equal((await nonceStatus(d1, nonce, OTHER_KEY)).status, 404);
  assert.equal((await nonceStatus(d1, "cin_does_not_exist")).status, 404);
  assert.equal((await nonceStatus(d1, nonce, null)).status, 401);
  assert.equal((await call(d1, "GET", "/org/checkin-nonce/status")).status, 400);
});

test("nonce status reports expiry so the panel replaces an old QR", async () => {
  const d1 = new D1();
  const nonce = await issueNonce(d1);
  d1.db.prepare("UPDATE org_checkin_nonces SET expires_at=1 WHERE nonce=?").run(nonce);
  const res = await nonceStatus(d1, nonce);
  assert.equal(res.body.used, false);
  assert.equal(res.body.expired, true);
});

// ---- (c) nonce-less check-ins: accepted, marked offline ---------------------

test("nonce-less check-in is accepted and marked offline everywhere", async () => {
  const d1 = new D1();
  const res = await call(d1, "POST", "/org/checkin", await attendeeBody());
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.assurance, "offline");
  assert.equal(res.body.receipt.assurance, "offline");
  assert.equal(d1.checkins()[0].assurance, "offline");

  const attendance = await call(d1, "GET", "/org/attendance?since=0");
  assert.equal(attendance.status, 200);
  assert.equal(attendance.body.checkins[0].assurance, "offline");

  const receipt = await call(d1, "GET", "/org/receipt/" + res.body.receipt_id, null, null);
  assert.equal(receipt.status, 200, JSON.stringify(receipt.body));
  const payload = receipt.body.receipt || receipt.body.payload;
  assert.equal(payload.assurance, "offline");
});

test("nonce-less check-in is never refused, even with requireFreshCheckin set", async () => {
  const d1 = new D1({ anonymousMode: true, requireFreshCheckin: true });
  const res = await call(d1, "POST", "/org/checkin", await attendeeBody());
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.assurance, "offline");
});

// ---- (b) + replay: queued on the phone, synced later ------------------------

test("a check-in queued offline and replayed 24 h later still lands", async () => {
  const d1 = new D1();
  let serverUp = false;
  const { queue, storage } = loadOfflineQueue((url, init) => {
    if (!serverUp) return Promise.reject(new TypeError("Failed to fetch"));
    return workerFetch(d1, url, init);
  });
  const scannedAt = Math.floor(Date.now() / 1000) - DAY;
  const body = await attendeeBody({ checkin_ts: scannedAt });
  body.helloPayload.ts = scannedAt;
  await queueCheckinLikeOrgEntry(queue, body);
  assert.equal(await queue.count(), 1);

  // Still offline: the replay halts and keeps the op.
  const offlinePass = await queue.replay();
  assert.equal(offlinePass.halted, true);
  assert.equal(await queue.count(), 1);

  // A day later the network is back.
  serverUp = true;
  const pass = await queue.replay();
  assert.deepEqual({ halted: pass.halted, drained: pass.drained, dropped: pass.dropped }, { halted: false, drained: 1, dropped: 0 });
  assert.equal(await queue.count(), 0);
  assert.equal(storage.has("irlid_offline_dropped"), false);

  const rows = d1.checkins();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, body.client_checkin_id);
  assert.equal(rows[0].checkin_at, scannedAt, "keeps the phone's scan time, not the sync time");
  assert.equal(rows[0].assurance, "offline");
});

test("a live-QR scan made during an outage queues and lands after the nonce is long stale", async () => {
  const d1 = new D1();
  const nonce = await issueNonce(d1);
  let serverUp = false;
  const { queue } = loadOfflineQueue((url, init) => (serverUp ? workerFetch(d1, url, init) : Promise.reject(new TypeError("Failed to fetch"))));
  const body = await attendeeBody({ nonce, checkin_ts: Math.floor(Date.now() / 1000) - DAY });
  await queueCheckinLikeOrgEntry(queue, body);

  const [op] = await queue.listAll();
  const sent = JSON.parse(op.body);
  assert.equal(sent.nonce, undefined, "stale nonce is not sent as a live nonce");
  assert.equal(sent.offline_seen_nonce, nonce, "kept as evidence only");

  // The nonce expires and the venue QR moves on while the phone is offline.
  d1.db.prepare("UPDATE org_checkin_nonces SET expires_at=1 WHERE nonce=?").run(nonce);
  serverUp = true;
  const pass = await queue.replay();
  assert.equal(pass.drained, 1);
  assert.equal(pass.dropped, 0);
  assert.equal(d1.checkins()[0].assurance, "offline");
});

test("the raw stale nonce would have been dropped as terminal (why it is stripped)", async () => {
  const d1 = new D1();
  const nonce = await issueNonce(d1);
  d1.db.prepare("UPDATE org_checkin_nonces SET expires_at=1 WHERE nonce=?").run(nonce);
  const res = await call(d1, "POST", "/org/checkin", await attendeeBody({ nonce }));
  assert.equal(res.status, 410);
  const { queue } = loadOfflineQueue(() => Promise.reject(new TypeError("offline")));
  assert.equal(queue.isTerminalHttpStatus(410), true);
});

test("replaying the same queued check-in twice records it once", async () => {
  const d1 = new D1();
  const { queue } = loadOfflineQueue((url, init) => workerFetch(d1, url, init));
  const body = await attendeeBody({ checkin_ts: Math.floor(Date.now() / 1000) - DAY });
  await queueCheckinLikeOrgEntry(queue, body);
  await queueCheckinLikeOrgEntry(queue, body); // e.g. a retry raced the first enqueue
  const pass = await queue.replay();
  assert.equal(pass.drained, 2);
  assert.equal(d1.checkins().length, 1);
});

test("a terminally refused check-in is kept on the phone, not lost", async () => {
  const dropped = [];
  const { queue, window, storage } = loadOfflineQueue(async () =>
    new Response(JSON.stringify({ error: "crowd_checkin_required" }), { status: 409 }));
  window.addEventListener("irlid:queue-dropped", (ev) => dropped.push(ev.detail));
  const body = await attendeeBody();
  await queueCheckinLikeOrgEntry(queue, body);
  const pass = await queue.replay();
  assert.equal(pass.dropped, 1);
  assert.equal(dropped.length, 1);
  const kept = JSON.parse(storage.get("irlid_offline_dropped"));
  assert.equal(kept.length, 1);
  assert.equal(kept[0].idempotency_key, body.client_checkin_id);
  assert.equal(kept[0].reason, "HTTP 409");
});

// ---- Venue GPS band: flag only, never a refusal -----------------------------

// Imbue-ish venue; ~111 m per 0.001 deg of latitude.
const VENUE = { anonymousMode: true, venueLat: 51.5, venueLon: -0.12, venueRadiusM: 200 };

test("venue GPS band: near / far / none, default radius and poor accuracy", () => {
  assert.equal(venueGpsBand({}, { lat: 51.5, lon: -0.12 }), null, "no venue location: no band");
  assert.equal(venueGpsBand(VENUE, { lat: 51.5005, lon: -0.12, acc_m: 20 }).band, "near");
  assert.equal(venueGpsBand(VENUE, { lat: 51.5, lon: -0.12 }).band, "near", "missing accuracy is fine");
  const far = venueGpsBand(VENUE, { lat: 51.53, lon: -0.12, acc_m: 15 });
  assert.equal(far.band, "far");
  assert.equal(far.distance_km, 3.3);
  assert.equal(venueGpsBand(VENUE, { lat: 52.5, lon: -0.12, acc_m: 15 }).distance_km, 111);
  assert.equal(venueGpsBand(VENUE, null).band, "none");
  assert.equal(venueGpsBand(VENUE, { lat: "x", lon: 1 }).band, "none");
  assert.equal(venueGpsBand(VENUE, { lat: 51.5, lon: -0.12, acc_m: 1500 }).band, "none", "poor accuracy counts as none");
  // Default radius is 200 m: 300 m away is far, 150 m is near.
  const noRadius = { venueLat: 51.5, venueLon: -0.12 };
  assert.equal(venueGpsBand(noRadius, { lat: 51.50135, lon: -0.12 }).band, "near");
  assert.equal(venueGpsBand(noRadius, { lat: 51.5027, lon: -0.12 }).band, "far");
  assert.equal(venueGpsBand(noRadius, { lat: 51.5027, lon: -0.12 }).radius_m, 200);
});

test("far / no-GPS / poor-accuracy check-ins are never refused, only flagged", async () => {
  const d1 = new D1(VENUE);
  const cases = [
    [{ lat: 40.7, lon: -74.0, acc_m: 10 }, "far"],
    [undefined, "none"],
    [{ lat: 51.5, lon: -0.12, acc_m: 5000 }, "none"],
    [{ lat: "nonsense" }, "none"],
    [{ lat: 51.5001, lon: -0.12, acc_m: 12 }, "near"]
  ];
  for (const [gps, band] of cases) {
    const res = await call(d1, "POST", "/org/checkin", await attendeeBody(gps === undefined ? {} : { gps }));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.assurance, "offline");
    assert.equal(res.body.gps_band, band);
    assert.equal(res.body.receipt.gps_band, band);
    assert.equal(res.body.receipt.gps, undefined, "raw phone position never in the receipt");
  }
  // Also with a live nonce (fresh) and far away.
  const nonce = await issueNonce(d1);
  const fresh = await call(d1, "POST", "/org/checkin", await attendeeBody({ nonce, gps: { lat: 48.85, lon: 2.35, acc_m: 8 } }));
  assert.equal(fresh.status, 200, JSON.stringify(fresh.body));
  assert.equal(fresh.body.assurance, "fresh");
  assert.equal(fresh.body.gps_band, "far");
  assert.ok(fresh.body.gps_distance_km > 300);

  const rows = d1.checkins();
  assert.equal(rows.length, 6);
  for (const row of rows) {
    assert.ok(["near", "far", "none"].includes(row.gps_band));
    assert.equal(JSON.stringify(row).includes("40.7"), false, "raw latitude never stored");
  }
  const attendance = await call(d1, "GET", "/org/attendance?since=0");
  assert.equal(attendance.status, 200);
  assert.ok(attendance.body.checkins.every(c => ["near", "far", "none"].includes(c.gps_band)));
});

test("check-in without phone GPS still carries the org-provided venue location", async () => {
  const d1 = new D1({ ...VENUE, venueAddress: "1 High St" });
  const res = await call(d1, "POST", "/org/checkin", await attendeeBody());
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.receipt.venue, { address: "1 High St", lat: 51.5, lon: -0.12 });
  assert.equal(res.body.receipt.gps_band, "none");
  assert.equal(res.body.receipt.gps_hash, undefined);
});

test("an offline check-in queued with phone GPS and replayed 24 h later lands with its band", async () => {
  const d1 = new D1(VENUE);
  let serverUp = false;
  const { queue } = loadOfflineQueue((url, init) => {
    if (!serverUp) return Promise.reject(new TypeError("Failed to fetch"));
    return workerFetch(d1, url, init);
  });
  const scannedAt = Math.floor(Date.now() / 1000) - DAY;
  const nearBody = await attendeeBody({ checkin_ts: scannedAt, gps: { lat: 51.5004, lon: -0.1201, acc_m: 25 } });
  const farBody = await attendeeBody({ checkin_ts: scannedAt + 5, gps: { lat: 53.48, lon: -2.24, acc_m: 30 } });
  await queueCheckinLikeOrgEntry(queue, nearBody);
  await queueCheckinLikeOrgEntry(queue, farBody);
  assert.equal((await queue.replay()).halted, true);

  serverUp = true;
  const pass = await queue.replay();
  assert.deepEqual({ drained: pass.drained, dropped: pass.dropped }, { drained: 2, dropped: 0 });
  const rows = d1.checkins();
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(r => [r.id, r.assurance, r.gps_band]), [
    [nearBody.client_checkin_id, "offline", "near"],
    [farBody.client_checkin_id, "offline", "far"]
  ]);
  assert.ok(rows[1].gps_distance_km > 200);

  // Replaying the same op again returns the stored band.
  const again = await call(d1, "POST", "/org/checkin", queue.toOfflineCheckin(farBody));
  assert.equal(again.status, 200);
  assert.equal(again.body.duplicate, true);
  assert.equal(again.body.gps_band, "far");
});

