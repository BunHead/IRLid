// Signed check-in (docs/requirements/offline-first.md, "Check-in signature
// rules"). The phone signs its check-in hello with its device key and the
// Worker verifies it against hello.pub and recomputes the hash.
//
// Rules v3.1: a bad signature is always refused (S1), live, or quarantined
// with a notice when it syncs later (C8). A missing, stale, used or unknown
// code (static QR and crowd mode included) is accepted as "offline /
// unverified", never refused (C2, C6, C14). Only a live unused code makes a
// check-in fresh, and only that is refused outside the event's times (C5)
// unless a staff-tier member signs in with a signed staff session. Old pages
// that send no signature land as offline until the server cutoff (C15). GPS
// only flags a band; no GPS hash is kept (C10).
//
// Same harness as offline-first.test.mjs: real SQLite + the browser offline
// queue (js/offline-queue.js) in a VM.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import worker from "../src/index.js";
import { signedCheckinBody, newDevice, hashHello, eventScheduleAt } from "./helpers/signed-checkin.mjs";

const ORG_KEY = "org_signed_test_key_123456";
const OTHER_KEY = "org_other_key_1234567890";
const DAY = 24 * 60 * 60;
const nowS = () => Math.floor(Date.now() / 1000);

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
      CREATE TABLE org_checkins (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, mode TEXT NOT NULL, attendee_label TEXT, attendee_key_id TEXT, hello_hash TEXT, score INTEGER, bio_verified INTEGER DEFAULT 0, gps_hash TEXT, checkin_at INTEGER NOT NULL, checkout_at INTEGER, duration_s INTEGER, created_at INTEGER NOT NULL, name TEXT, attendee_pub_jwk TEXT, device_key_fp TEXT, status TEXT DEFAULT 'checked_in', expected_id INTEGER, conflict_id INTEGER, event_id TEXT, assurance TEXT, gps_band TEXT, gps_distance_km REAL, out_of_hours INTEGER DEFAULT 0, clock_gap_s INTEGER);
      CREATE TABLE org_checkin_nonces (nonce TEXT PRIMARY KEY, org_api_key TEXT NOT NULL, event_id TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, consumed_at INTEGER);
      CREATE TABLE org_receipts (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, checkin_id TEXT, attendee_pub_fp TEXT, payload_json TEXT NOT NULL, signature TEXT NOT NULL, created_at INTEGER NOT NULL, privacy_mode INTEGER DEFAULT 1);
      CREATE TABLE org_expected (id INTEGER PRIMARY KEY AUTOINCREMENT, org_id TEXT NOT NULL, display_name TEXT, initials TEXT, role_key TEXT, device_pub_fp TEXT, email_hint TEXT, phone_hint TEXT, notes TEXT, created_at INTEGER, archived_at INTEGER);
      CREATE TABLE expected_device_keys (org_id TEXT, expected_id INTEGER, device_key_fp TEXT, revoked_at INTEGER);
      CREATE TABLE org_staff_sessions (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, staff_pub_fp TEXT, staff_pub_jwk TEXT, hello_hash TEXT, verification_state TEXT, created_at INTEGER, expires_at INTEGER, last_seen_at INTEGER);
      CREATE TABLE portal_users (id INTEGER PRIMARY KEY AUTOINCREMENT, pub_fp TEXT);
      CREATE TABLE org_memberships (user_id INTEGER, org_id TEXT, role TEXT);
      CREATE TABLE rooms (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, label TEXT);
      CREATE TABLE weekly_events (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, room_id TEXT, name TEXT NOT NULL, day_of_week INTEGER NOT NULL, start_time_local TEXT NOT NULL, duration_min INTEGER NOT NULL, capacity INTEGER, color_hex TEXT, notes TEXT, require_proof INTEGER DEFAULT 0, late_grace_min INTEGER DEFAULT 0, created_at INTEGER NOT NULL, archived_at INTEGER, checkin_mode TEXT DEFAULT 'standard');
    `);
    this.db.prepare("INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES (?,?,?,?,?,0,0)")
      .run("org-1", "Test Org", "test-org", ORG_KEY, JSON.stringify(settings));
    this.db.prepare("INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES (?,?,?,?,?,0,0)")
      .run("org-2", "Other Org", "other-org", OTHER_KEY, "{}");
    // "ev-open" is on now; "ev-closed" started 6 h ago and ran 60 min.
    const open = eventScheduleAt(-10);
    const closed = eventScheduleAt(-360);
    const ev = this.db.prepare("INSERT INTO weekly_events (id,org_id,name,day_of_week,start_time_local,duration_min,created_at,checkin_mode) VALUES (?,?,?,?,?,?,0,?)");
    ev.run("ev-open", "org-1", "Open class", open.day_of_week, open.start_time_local, 120, "standard");
    ev.run("ev-closed", "org-1", "Morning class", closed.day_of_week, closed.start_time_local, 60, "standard");
    ev.run("ev-crowd", "org-1", "Open day", open.day_of_week, open.start_time_local, 120, "crowd");
  }
  prepare(sql) { return new D1Statement(this.db, sql); }
  async batch(statements) { const out = []; for (const s of statements) out.push(await s.run()); return out; }
  checkins() { return this.db.prepare("SELECT * FROM org_checkins ORDER BY checkin_at").all(); }
  quarantined() {
    try { return this.db.prepare("SELECT * FROM org_checkin_quarantine ORDER BY received_at").all(); }
    catch { return []; }
  }
}

// The C15 cutoff. Tests default to "already passed" so a missing signature is
// refused; the grace tests move it into the future.
let signingCutoff = 1;
async function withCutoff(value, fn) {
  const before = signingCutoff;
  signingCutoff = value;
  try { return await fn(); } finally { signingCutoff = before; }
}

function workerFetch(d1, input, init) {
  return worker.fetch(new Request(input, init), { DB: d1, CORS_ORIGIN: "*", CHECKIN_SIGNING_CUTOFF: signingCutoff });
}

async function call(d1, method, path, body, orgKey = ORG_KEY) {
  const headers = { "Content-Type": "application/json" };
  if (orgKey) headers["X-Org-Key"] = orgKey;
  const response = await workerFetch(d1, "https://worker.test" + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, body: await response.json() };
}

const checkin = (d1, body) => call(d1, "POST", "/org/checkin", body);

async function issueNonce(d1, eventId = null) {
  const res = await call(d1, "POST", "/org/checkin-nonce", { event_id: eventId });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.nonce;
}

const live = (opts = {}) => signedCheckinBody({ org: ORG_KEY, ...opts });
const offline = (opts = {}, ageS = 600) => signedCheckinBody({ org: ORG_KEY, ts: nowS() - ageS, ...opts });

// ---- Browser offline queue harness (as in offline-first.test.mjs) ---------

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
  const timers = [];
  const window = {
    crypto: globalThis.crypto,
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    dispatchEvent(ev) { (listeners[ev.type] || []).forEach(fn => fn(ev)); return true; }
  };
  const ctx = createContext({
    window,
    indexedDB: fakeIndexedDB(),
    navigator: { onLine: false },
    document: { addEventListener() {}, visibilityState: "hidden" },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k)
    },
    fetch: (...args) => fetchImpl(...args),
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    console,
    // Short timers (IndexedDB callbacks) run; the long deferred-replay timer
    // is recorded instead so the test does not wait two minutes.
    setTimeout: (fn, ms) => (ms > 1000 ? (timers.push(ms), 0) : setTimeout(fn, ms)),
    clearTimeout() {},
    Date
  });
  runInContext(readFileSync(new URL("../../js/offline-queue.js", import.meta.url), "utf8"), ctx);
  return { queue: window.IRLidOfflineQueue, window, storage, timers };
}

// As org-entry.html postOrgCheckinResilient() queues after its retries fail.
async function queueLikeOrgEntry(queue, body) {
  return queue.enqueue({
    url: "https://worker.test/org/checkin",
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Org-Key": ORG_KEY },
    body: JSON.stringify(queue.toOfflineCheckin(body)),
    idempotency_key: body.client_checkin_id,
    kind: "org_checkin",
    not_before: (Number(body.checkin_ts) + 125) * 1000
  });
}

// ---- 1. Forged check-ins are refused --------------------------------------

test("forged check-in: signed by a different key than the one it claims is refused", async () => {
  const d1 = new D1();
  const nonce = await issueNonce(d1);
  const victim = await newDevice();
  const attacker = await newDevice();
  const body = await live({ nonce, device: victim });
  body.helloSig = await attacker.sign(body.helloHash);
  const res = await checkin(d1, body);
  assert.equal(res.status, 401, JSON.stringify(res.body));
  assert.equal(res.body.reason, "bad_signature");
  assert.equal(d1.checkins().length, 0);
  assert.equal(d1.db.prepare("SELECT consumed_at FROM org_checkin_nonces WHERE nonce=?").get(nonce).consumed_at, null, "code not burnt");
});

test("forged check-in: missing signature, tampered hello or a hash that does not match are refused", async () => {
  const d1 = new D1();
  const cases = [];
  { const b = await live({ nonce: await issueNonce(d1) }); delete b.helloSig; cases.push([b, "missing_signature"]); }
  { const b = await live({ nonce: await issueNonce(d1) }); b.helloPayload.pub = (await newDevice()).pub; b.helloHash = await hashHello(b.helloPayload); cases.push([b, "bad_signature"]); }
  { const b = await live({ nonce: await issueNonce(d1) }); b.helloHash = "AAAA"; cases.push([b, "hash_mismatch"]); }
  { const b = await live({ nonce: await issueNonce(d1) }); b.helloPayload.ts += 1; delete b.helloHash; cases.push([b, "bad_signature"]); }
  { const b = await live({ nonce: await issueNonce(d1) }); delete b.helloPayload; cases.push([b, "missing_signed_hello"]); }
  for (const [body, reason] of cases) {
    const res = await checkin(d1, body);
    assert.equal(res.status, 401, JSON.stringify(res.body));
    assert.equal(res.body.reason, reason);
  }
  assert.equal(d1.checkins().length, 0);
});

test("forged check-in: a genuine signature reused for another org, check-in id, event or code is refused", async () => {
  const d1 = new D1();
  const nonceA = await issueNonce(d1);
  const nonceB = await issueNonce(d1);
  const otherOrg = await signedCheckinBody({ org: OTHER_KEY, nonce: nonceA });
  const swappedCid = await live({ nonce: nonceA }); swappedCid.client_checkin_id = "checkin_other";
  const swappedEvent = await live({ nonce: nonceA }); swappedEvent.event_id = "ev-open";
  const swappedCode = await live({ nonce: nonceA }); swappedCode.nonce = nonceB;
  for (const [body, reason] of [[otherOrg, "signed_for_other_org"], [swappedCid, "checkin_id_not_signed"], [swappedEvent, "event_not_signed"], [swappedCode, "code_not_signed"]]) {
    const res = await checkin(d1, body);
    assert.equal(res.status, 401, JSON.stringify(res.body));
    assert.equal(res.body.reason, reason);
  }
  assert.equal(d1.checkins().length, 0);
});

test("phone-reported offline flag and score never make a check-in fresh", async () => {
  const d1 = new D1();
  const body = await live({ offline_queued: true, score: 100, bioVerified: true });
  const res = await checkin(d1, body);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.assurance, "offline", "no live code, so never fresh whatever the phone says");
  assert.equal(d1.checkins().length, 1);
  d1.db.exec("DELETE FROM org_checkins");
  // A forged signature claiming to be an offline replay, but signed now, is refused too.
  const forged = await live({ offline_queued: true });
  forged.helloSig = await (await newDevice()).sign(forged.helloHash);
  assert.equal((await checkin(d1, forged)).status, 401);
  assert.equal(d1.checkins().length, 0);
  assert.equal(d1.quarantined().length, 0);
});

// ---- 2. Valid check-ins are accepted --------------------------------------

test("valid signed check-in with a live code is accepted as fresh and stores the recomputed hash", async () => {
  const d1 = new D1();
  const nonce = await issueNonce(d1, "ev-open");
  const body = await live({ nonce, event_id: "ev-open" });
  const res = await checkin(d1, body);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.assurance, "fresh");
  assert.equal(res.body.event_id, "ev-open");
  assert.equal(res.body.out_of_hours, undefined);
  const [row] = d1.checkins();
  assert.equal(row.id, body.client_checkin_id);
  assert.equal(row.hello_hash, await hashHello(body.helloPayload));
  assert.equal(row.assurance, "fresh");
  assert.ok(Math.abs(row.checkin_at - nowS()) <= 2, "live check-ins use the Worker's clock");
  // Slug in the signed hello is fine too (slim venue QRs).
  const slug = await signedCheckinBody({ org: "test-org", nonce: await issueNonce(d1) });
  assert.equal((await checkin(d1, slug)).status, 200);
});

test("a retry of a recorded check-in returns it as a duplicate instead of a refusal", async () => {
  const d1 = new D1();
  const body = await live({ nonce: await issueNonce(d1) });
  assert.equal((await checkin(d1, body)).status, 200);
  const again = await checkin(d1, body);
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.equal(again.body.duplicate, true);
  assert.equal(again.body.assurance, "fresh");
  assert.equal(d1.checkins().length, 1);
});

// ---- 3. Stale / used / missing codes land as offline (C6, C14) ------------

test("a stale, used, unknown or missing code (static QR included) is accepted as offline, never refused", async () => {
  const d1 = new D1();
  const expired = await issueNonce(d1);
  d1.db.prepare("UPDATE org_checkin_nonces SET expires_at=1 WHERE nonce=?").run(expired);
  const used = await issueNonce(d1);
  assert.equal((await checkin(d1, await live({ nonce: used }))).body.assurance, "fresh");
  const cases = [
    await live({ nonce: expired }),
    await live({ nonce: used }),
    await live({ nonce: "cin_never_issued" }),
    await live() // static QR: no code
  ];
  for (const body of cases) {
    const res = await checkin(d1, body);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.assurance, "offline");
  }
  assert.equal(d1.checkins().length, 5);
  assert.deepEqual(d1.checkins().map(r => r.assurance).sort(), ["fresh", "offline", "offline", "offline", "offline"]);
  assert.equal(d1.db.prepare("SELECT consumed_at FROM org_checkin_nonces WHERE nonce=?").get(expired).consumed_at, null);
});

test("a stale or missing code does not skip the signature check (S1)", async () => {
  const d1 = new D1();
  const expired = await issueNonce(d1);
  d1.db.prepare("UPDATE org_checkin_nonces SET expires_at=1 WHERE nonce=?").run(expired);
  for (const nonce of [expired, "cin_never_issued", null]) {
    const forged = await live({ nonce });
    forged.helloSig = await (await newDevice()).sign(forged.helloHash);
    const res = await checkin(d1, forged);
    assert.equal(res.status, 401, JSON.stringify(res.body));
    assert.equal(res.body.reason, "bad_signature");
  }
  assert.equal(d1.checkins().length, 0);
});

test("crowd mode: a used code past its grace and a missing code are accepted as offline", async () => {
  const d1 = new D1();
  const nonce = await issueNonce(d1, "ev-crowd");
  assert.equal((await checkin(d1, await live({ nonce, event_id: "ev-crowd" }))).body.assurance, "fresh");
  const inGrace = await checkin(d1, await live({ nonce, event_id: "ev-crowd" }));
  assert.equal(inGrace.body.assurance, "fresh", "inside crowd grace");
  d1.db.prepare("UPDATE org_checkin_nonces SET consumed_at=consumed_at-60 WHERE nonce=?").run(nonce);
  const late = await checkin(d1, await live({ nonce, event_id: "ev-crowd" }));
  assert.equal(late.status, 200);
  assert.equal(late.body.assurance, "offline");
  const none = await checkin(d1, await live({ event_id: "ev-crowd" }));
  assert.equal(none.status, 200);
  assert.equal(none.body.assurance, "offline");
  assert.equal(d1.checkins().length, 4);
});

test("the org score threshold never refuses an offline / unverified check-in (S13, C2)", async () => {
  const d1 = new D1({ anonymousMode: true, minScore: 80 });
  const offlineLow = await checkin(d1, await live({ score: 10 }));
  assert.equal(offlineLow.status, 200, JSON.stringify(offlineLow.body));
  assert.equal(offlineLow.body.assurance, "offline");
  const queuedLow = await checkin(d1, await offline({ score: 10 }));
  assert.equal(queuedLow.status, 200);
});

// ---- 3b. Old pages: unsigned check-ins until the cutoff (C15) --------------

const FUTURE = () => nowS() + 7 * DAY;

test("C15: before the cutoff, a check-in with no signature (old cached page) lands as offline / unverified", async () => {
  await withCutoff(FUTURE(), async () => {
    const d1 = new D1();
    const noSig = await live(); delete noSig.helloSig; delete noSig.helloHash;
    const res = await checkin(d1, noSig);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.assurance, "offline");
    const noHello = await live(); delete noHello.helloPayload; delete noHello.helloSig; delete noHello.helloHash;
    noHello.client_checkin_id = "old_page_2";
    const res2 = await checkin(d1, noHello);
    assert.equal(res2.status, 200, JSON.stringify(res2.body));
    assert.equal(res2.body.assurance, "offline");
    // Queued earlier on the phone, replayed later: same.
    const queued = await offline(); delete queued.helloSig; delete queued.helloHash;
    assert.equal((await checkin(d1, queued)).body.assurance, "offline");
    assert.deepEqual(d1.checkins().map(r => r.assurance), ["offline", "offline", "offline"]);
    assert.equal(d1.quarantined().length, 0);
  });
});

test("C15: an unsigned check-in is never fresh and never burns a live code", async () => {
  await withCutoff(FUTURE(), async () => {
    const d1 = new D1();
    const nonce = await issueNonce(d1);
    const body = await live({ nonce }); delete body.helloSig;
    const res = await checkin(d1, body);
    assert.equal(res.status, 200);
    assert.equal(res.body.assurance, "offline");
    assert.equal(d1.db.prepare("SELECT consumed_at FROM org_checkin_nonces WHERE nonce=?").get(nonce).consumed_at, null);
  });
});

test("C15: the grace only covers a MISSING signature; a wrong one is still refused or quarantined (S1)", async () => {
  await withCutoff(FUTURE(), async () => {
    const d1 = new D1();
    const forged = await live(); forged.helloSig = await (await newDevice()).sign(forged.helloHash);
    assert.equal((await checkin(d1, forged)).status, 401);
    const forgedQueued = await offline(); forgedQueued.helloSig = await (await newDevice()).sign(forgedQueued.helloHash);
    assert.equal((await checkin(d1, forgedQueued)).status, 202);
    assert.equal(d1.checkins().length, 0);
    assert.equal(d1.quarantined().length, 1);
  });
});

test("C15: after the cutoff the signature is required again (live refused, queued quarantined)", async () => {
  await withCutoff(nowS() - 10, async () => {
    const d1 = new D1();
    const liveNoSig = await live(); delete liveNoSig.helloSig;
    const res = await checkin(d1, liveNoSig);
    assert.equal(res.status, 401);
    assert.equal(res.body.reason, "missing_signature");
    const queuedNoSig = await offline(); delete queuedNoSig.helloSig;
    assert.equal((await checkin(d1, queuedNoSig)).status, 202);
    assert.equal(d1.checkins().length, 0);
  });
});

test("C15: the cutoff is a server setting, given as unix seconds or an ISO date", async () => {
  const d1 = new D1();
  const noSig = async () => { const b = await live(); delete b.helloSig; return b; };
  await withCutoff("2999-01-01T00:00:00Z", async () => assert.equal((await checkin(d1, await noSig())).status, 200));
  await withCutoff("2000-01-01T00:00:00Z", async () => assert.equal((await checkin(d1, await noSig())).status, 401));
  // Unset: the built-in default (2 Nov 2026, server time) applies.
  const res = await worker.fetch(new Request("https://worker.test/org/checkin", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Org-Key": ORG_KEY }, body: JSON.stringify(await noSig())
  }), { DB: d1, CORS_ORIGIN: "*" });
  assert.equal(res.status, nowS() < Date.UTC(2026, 10, 2) / 1000 ? 200 : 401);
});

// ---- 3c. GPS: flag only, nothing kept (C10) --------------------------------

test("C10: GPS only flags a band; no raw position and no GPS hash is stored or put in the receipt", async () => {
  const d1 = new D1({ anonymousMode: true, venueLat: 51.5, venueLon: -0.12 });
  const gps = { lat: 48.8566, lon: 2.3522, acc_m: 8 };
  const fresh = await checkin(d1, await live({ nonce: await issueNonce(d1), gps }));
  const noCode = await checkin(d1, await live({ gps }));
  const queued = await checkin(d1, await offline({ gps }));
  for (const res of [fresh, noCode, queued]) {
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.gps_band, "far", "far from the venue is flagged, never refused");
    assert.equal(res.body.receipt.gps_hash, undefined);
    assert.equal(res.body.receipt.gps, undefined);
  }
  for (const row of d1.checkins()) {
    assert.equal(row.gps_hash, null);
    assert.equal(JSON.stringify(row).includes("48.85"), false);
  }
  assert.equal(JSON.stringify(d1.db.prepare("SELECT payload_json FROM org_receipts").all()).includes("gps_hash"), false);
});

// ---- 4. Event times ---------------------------------------------------------

test("online: a check-in outside the event's times is refused and the code is not burnt", async () => {
  const d1 = new D1();
  const nonce = await issueNonce(d1, "ev-closed");
  const res = await checkin(d1, await live({ nonce, event_id: "ev-closed" }));
  assert.equal(res.status, 403, JSON.stringify(res.body));
  assert.equal(res.body.reason, "outside_event_times");
  assert.equal(d1.db.prepare("SELECT consumed_at FROM org_checkin_nonces WHERE nonce=?").get(nonce).consumed_at, null);
  assert.equal(d1.checkins().length, 0);
});

test("outside the event's times, a stale or missing code is accepted as offline and flagged, not refused (C5, C14)", async () => {
  const d1 = new D1();
  const noCode = await checkin(d1, await live({ event_id: "ev-closed" }));
  assert.equal(noCode.status, 200, JSON.stringify(noCode.body));
  assert.equal(noCode.body.assurance, "offline");
  assert.equal(noCode.body.out_of_hours, true);
  const stale = await checkin(d1, await live({ event_id: "ev-closed", nonce: "cin_never_issued" }));
  assert.equal(stale.status, 200);
  assert.equal(stale.body.out_of_hours, true);
});

async function staffSession(d1, device, role = "staff") {
  d1.db.prepare("INSERT INTO org_expected (org_id,display_name,role_key,device_pub_fp,created_at) VALUES (?,?,?,?,0)")
    .run("org-1", "Sam Staff", role, device.fp);
  const token = "staff_" + crypto.randomUUID().replace(/-/g, "");
  d1.db.prepare("INSERT INTO org_staff_sessions (id,org_id,staff_pub_fp,created_at,expires_at,last_seen_at) VALUES (?,?,?,?,?,?)")
    .run(token, "org-1", device.fp, nowS(), nowS() + 900, nowS());
  return token;
}

test("staff-tier with a signed staff session can check in any time, flagged with the time recorded", async () => {
  const d1 = new D1();
  const device = await newDevice();
  const token = await staffSession(d1, device, "manager");
  const nonce = await issueNonce(d1, "ev-closed");
  const res = await checkin(d1, await live({ device, nonce, event_id: "ev-closed", staff_session: token }));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.out_of_hours, true);
  assert.equal(res.body.assurance, "fresh");
  assert.equal(res.body.receipt.out_of_hours, true);
  const [row] = d1.checkins();
  assert.equal(row.out_of_hours, 1);
  assert.ok(Math.abs(row.checkin_at - nowS()) <= 2, "time recorded by the Worker");
});

test("the staff exemption needs a staff-tier role and a session owned by the signing device", async () => {
  const d1 = new D1();
  const staff = await newDevice();
  const token = await staffSession(d1, staff);
  // Someone else's phone presenting the staff member's session token.
  const other = await checkin(d1, await live({ nonce: await issueNonce(d1, "ev-closed"), event_id: "ev-closed", staff_session: token }));
  assert.equal(other.status, 403);
  // An attendee-role member with their own session.
  const attendee = await newDevice();
  const attendeeToken = await staffSession(d1, attendee, "attendee");
  const notStaff = await checkin(d1, await live({ device: attendee, nonce: await issueNonce(d1, "ev-closed"), event_id: "ev-closed", staff_session: attendeeToken }));
  assert.equal(notStaff.status, 403);
  // An expired staff session.
  d1.db.prepare("UPDATE org_staff_sessions SET expires_at=1 WHERE id=?").run(token);
  const expired = await checkin(d1, await live({ device: staff, nonce: await issueNonce(d1, "ev-closed"), event_id: "ev-closed", staff_session: token }));
  assert.equal(expired.status, 403);
  assert.equal(d1.checkins().length, 0);
});

// ---- 5. Second scan while checked in ---------------------------------------

test("a second scan while checked in says already signed in and offers check-out", async () => {
  const d1 = new D1();
  const device = await newDevice();
  const first = await checkin(d1, await live({ device, nonce: await issueNonce(d1, "ev-open"), event_id: "ev-open" }));
  assert.equal(first.status, 200);
  const nonce = await issueNonce(d1, "ev-open");
  const second = await checkin(d1, await live({ device, nonce, event_id: "ev-open" }));
  assert.equal(second.status, 409, JSON.stringify(second.body));
  assert.equal(second.body.reason, "already_checked_in");
  assert.equal(second.body.checkin_id, first.body.checkin_id);
  assert.ok(second.body.nonce, "carries what org-entry needs to sign a check-out");
  assert.equal(d1.db.prepare("SELECT consumed_at FROM org_checkin_nonces WHERE nonce=?").get(nonce).consumed_at, null);
  assert.equal(d1.checkins().length, 1);
  // After check-out the same phone can check in again.
  d1.db.prepare("UPDATE org_checkins SET checkout_at=? WHERE id=?").run(nowS(), first.body.checkin_id);
  assert.equal((await checkin(d1, await live({ device, nonce, event_id: "ev-open" }))).status, 200);
});

// ---- 6. Offline queue: never dropped ---------------------------------------

test("offline queue: a valid queued check-in is kept, then lands as offline / unverified", async () => {
  const d1 = new D1();
  let serverUp = false;
  const { queue, storage } = loadOfflineQueue((url, init) =>
    (serverUp ? workerFetch(d1, url, init) : Promise.reject(new TypeError("Failed to fetch"))));
  const nonce = await issueNonce(d1, "ev-closed");
  const scannedAt = nowS() - DAY;
  // Scanned the live QR during an outage, a day ago, at an event now closed.
  const body = await signedCheckinBody({ org: ORG_KEY, ts: scannedAt, nonce, event_id: "ev-closed" });
  await queueLikeOrgEntry(queue, body);
  assert.equal((await queue.replay()).halted, true);
  assert.equal(await queue.count(), 1, "kept on the phone while offline");

  serverUp = true;
  const pass = await queue.replay();
  assert.deepEqual({ drained: pass.drained, dropped: pass.dropped, quarantined: pass.quarantined }, { drained: 1, dropped: 0, quarantined: 0 });
  assert.equal(storage.has("irlid_offline_dropped"), false);
  const [row] = d1.checkins();
  assert.equal(row.id, body.client_checkin_id);
  assert.equal(row.assurance, "offline");
  assert.equal(row.checkin_at, scannedAt, "keeps the signed scan time");
  assert.ok(row.created_at >= nowS() - 2, "and the Worker's received time");
});

test("offline queue: a check-in still inside the live window is held, not sent to be refused", async () => {
  const d1 = new D1();
  const { queue, timers } = loadOfflineQueue((url, init) => workerFetch(d1, url, init));
  await queueLikeOrgEntry(queue, await live()); // static QR, network just came back
  const pass = await queue.replay();
  assert.deepEqual({ drained: pass.drained, dropped: pass.dropped, deferred: pass.deferred }, { drained: 0, dropped: 0, deferred: 1 });
  assert.equal(await queue.count(), 1);
  assert.ok(timers.some(ms => ms > 100000 && ms < 130000), "retries once it is due");
  assert.equal(d1.checkins().length, 0);
});

test("offline queue: a bad-signature replay is quarantined with a visible notice, never dropped or counted", async () => {
  const d1 = new D1();
  const notices = [];
  const { queue, window, storage } = loadOfflineQueue((url, init) => workerFetch(d1, url, init));
  window.addEventListener("irlid:queue-quarantined", (ev) => notices.push(ev.detail));
  const forged = await signedCheckinBody({ org: ORG_KEY, ts: nowS() - 3600 });
  forged.helloSig = await (await newDevice()).sign(forged.helloHash);
  const unsigned = await signedCheckinBody({ org: ORG_KEY, ts: nowS() - 3600 });
  delete unsigned.helloSig; // e.g. queued by an old cached client
  await queueLikeOrgEntry(queue, forged);
  await queueLikeOrgEntry(queue, unsigned);
  const pass = await queue.replay();
  assert.deepEqual({ drained: pass.drained, dropped: pass.dropped, quarantined: pass.quarantined }, { drained: 2, dropped: 0, quarantined: 2 });
  assert.equal(notices.length, 2);
  assert.match(notices[0].notice, /could not be verified/);
  assert.equal(JSON.parse(storage.get("irlid_offline_quarantined")).length, 2);
  assert.equal(d1.checkins().length, 0, "not counted as check-ins");
  assert.deepEqual(d1.quarantined().map(q => [q.client_checkin_id, q.reason]), [
    [forged.client_checkin_id, "bad_signature"],
    [unsigned.client_checkin_id, "missing_signature"]
  ]);
  // Replaying it again does not duplicate the quarantine row.
  assert.equal((await checkin(d1, queue.toOfflineCheckin(forged))).status, 202);
  assert.equal(d1.quarantined().length, 2);
  // Staff can list them.
  const list = await call(d1, "GET", "/org/checkin-quarantine");
  assert.equal(list.status, 200);
  assert.equal(list.body.quarantined.length, 2);
  assert.equal((await call(d1, "GET", "/org/checkin-quarantine", null, OTHER_KEY)).body.quarantined.length, 0);
});

test("offline replay signed outside event times is accepted but flagged", async () => {
  const d1 = new D1();
  const res = await checkin(d1, await offline({ event_id: "ev-closed" }));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.assurance, "offline");
  assert.equal(res.body.out_of_hours, true);
});

test("doorman mode stays on the staff session (no attendee signature needed)", async () => {
  const d1 = new D1();
  const staff = await newDevice();
  const token = await staffSession(d1, staff);
  const res = await checkin(d1, { mode: "doorman_scan", client_checkin_id: "door_1", staff_session: token, score: 70 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.assurance, undefined);
  const noSession = await checkin(d1, { mode: "doorman_scan", client_checkin_id: "door_2", score: 70 });
  assert.equal(noSession.status, 401);
});

// ---- 7. More v3.1 rules ------------------------------------------------------

test("C4: a second scan while checked in says already signed in, even with no code (static QR)", async () => {
  const d1 = new D1();
  const device = await newDevice();
  assert.equal((await checkin(d1, await live({ device, nonce: await issueNonce(d1) }))).body.assurance, "fresh");
  for (const nonce of [null, "cin_never_issued"]) {
    const res = await checkin(d1, await live({ device, nonce }));
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.equal(res.body.reason, "already_checked_in");
  }
  assert.equal(d1.checkins().length, 1);
});

test("S3: only the public key is ever sent or stored (keys stay on the phone)", async () => {
  const d1 = new D1();
  const body = await live({ nonce: await issueNonce(d1) });
  assert.equal(Object.keys(body.helloPayload.pub).includes("d"), false, "hello carries no private key part");
  assert.equal((await checkin(d1, body)).status, 200);
  const [row] = d1.checkins();
  assert.equal(JSON.parse(row.attendee_pub_jwk).d, undefined);
  // Even if a phone were to send the private part, it is not stored.
  const leaky = await live();
  const signedWithD = { ...leaky.helloPayload, pub: { ...leaky.helloPayload.pub, d: "SECRET" } };
  const device = await newDevice();
  const body2 = await signedCheckinBody({ org: ORG_KEY, device: { ...device, pub: signedWithD.pub, sign: device.sign } });
  await checkin(d1, body2);
  assert.equal(JSON.stringify(d1.db.prepare("SELECT attendee_pub_jwk FROM org_checkins").all()).includes("SECRET"), false);
});

test("R1: a quarantine row is never edited, and a fresh check-in leaves earlier rows untouched", async () => {
  const d1 = new D1();
  const first = await offline({ client_checkin_id: "q_same" });
  first.helloSig = await (await newDevice()).sign(first.helloHash);
  assert.equal((await checkin(d1, first)).status, 202);
  const before = JSON.stringify(d1.quarantined());
  const second = await offline({ client_checkin_id: "q_same" });
  delete second.helloSig; // same id, different reason
  assert.equal((await checkin(d1, second)).status, 202);
  assert.equal(JSON.stringify(d1.quarantined()), before, "kept as first written");
  const a = await checkin(d1, await live({ nonce: await issueNonce(d1) }));
  const rowA = JSON.stringify(d1.checkins()[0]);
  await checkin(d1, await live({ nonce: await issueNonce(d1) }));
  assert.equal(JSON.stringify(d1.checkins().find(r => r.id === a.body.checkin_id)), rowA);
});

test("R4: the v6.7.0 migration only adds, keeps old rows as they were, and matches schema.sql", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE org_checkins (id TEXT PRIMARY KEY, org_id TEXT, checkin_at INTEGER, assurance TEXT, gps_band TEXT, gps_distance_km REAL)");
  db.prepare("INSERT INTO org_checkins (id,org_id,checkin_at,assurance) VALUES ('old','org-1',100,'fresh')").run();
  const before = JSON.stringify(db.prepare("SELECT id,org_id,checkin_at,assurance FROM org_checkins").all());
  db.exec(readFileSync(new URL("../migrations/2026-10-25-v6.7.0-signed-checkin.sql", import.meta.url), "utf8"));
  assert.equal(JSON.stringify(db.prepare("SELECT id,org_id,checkin_at,assurance FROM org_checkins").all()), before);
  assert.equal(db.prepare("SELECT out_of_hours FROM org_checkins WHERE id='old'").get().out_of_hours, 0, "old rows just read the default (no UPDATE, no backfill)");
  const cols = db.prepare("PRAGMA table_info(org_checkin_quarantine)").all().map(c => c.name);
  assert.deepEqual(cols, ["id", "org_id", "client_checkin_id", "reason", "signed_ts", "received_at", "body_json"]);
  const schema = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
  assert.match(schema, /CREATE TABLE IF NOT EXISTS org_checkin_quarantine \(id TEXT PRIMARY KEY, org_id TEXT NOT NULL, client_checkin_id TEXT, reason TEXT NOT NULL, signed_ts INTEGER, received_at INTEGER NOT NULL, body_json TEXT\)/);
});

test("the Worker makes its own quarantine table and out_of_hours column if the migration has not run yet", async () => {
  const d1 = new D1();
  d1.db.exec("DROP TABLE IF EXISTS org_checkin_quarantine");
  const forged = await offline();
  forged.helloSig = await (await newDevice()).sign(forged.helloHash);
  assert.equal((await checkin(d1, forged)).status, 202);
  assert.equal(d1.quarantined().length, 1);
});

test("C10: a quarantined check-in keeps no raw GPS position", async () => {
  const d1 = new D1();
  const gps = { lat: 48.8566, lon: 2.3522, acc_m: 8 };
  const forged = await offline({ gps });
  forged.helloSig = await (await newDevice()).sign(forged.helloHash);
  assert.equal((await checkin(d1, forged)).status, 202);
  const [q] = d1.quarantined();
  assert.equal(q.body_json.includes("48.85"), false);
  assert.equal(q.body_json.includes("2.352"), false);
  assert.equal(JSON.parse(q.body_json).gps, undefined);
  assert.equal(JSON.stringify(d1.db.prepare("SELECT payload_json FROM org_receipts").all()).includes("48.85"), false);
});

test("C8: a replay the phone marks as queued never gets a final 401; it is quarantined with a notice", async () => {
  await withCutoff(nowS() - 10, async () => {
    const d1 = new D1();
    const unsigned = await live({ offline_queued: true }); delete unsigned.helloSig; delete unsigned.helloPayload; delete unsigned.helloHash;
    const res = await checkin(d1, unsigned);
    assert.equal(res.status, 202, JSON.stringify(res.body));
    assert.equal(res.body.quarantined, true);
    assert.equal(d1.checkins().length, 0, "the flag never gets anything accepted");
    // Without the flag, an unsigned live check-in is still refused outright,
    // and so is a live forgery even if it claims to be queued.
    const noFlag = await live(); delete noFlag.helloSig; noFlag.client_checkin_id = "plain_unsigned";
    assert.equal((await checkin(d1, noFlag)).status, 401);
    const forged = await live({ offline_queued: true });
    forged.helloSig = await (await newDevice()).sign(forged.helloHash);
    assert.equal((await checkin(d1, forged)).status, 401);
  });
});

// ---- v6.7.1 hardening -------------------------------------------------------

test("quarantine flood: past the daily cap the phone still gets the 202 notice, but rows stop growing and the overflow is counted", async () => {
  const d1 = new D1();
  const forger = await newDevice();
  const send = async (i) => {
    const body = await offline({ client_checkin_id: "flood_" + i });
    body.helloSig = await forger.sign(body.helloHash); // wrong key for hello.pub
    return checkin(d1, body);
  };
  // Pre-fill to just under the cap directly, to keep the test quick.
  d1.db.exec("CREATE TABLE IF NOT EXISTS org_checkin_quarantine (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, client_checkin_id TEXT, reason TEXT NOT NULL, signed_ts INTEGER, received_at INTEGER NOT NULL, body_json TEXT)");
  const ins = d1.db.prepare("INSERT INTO org_checkin_quarantine (id,org_id,client_checkin_id,reason,signed_ts,received_at,body_json) VALUES (?,?,?,?,?,?,?)");
  for (let i = 0; i < 199; i += 1) ins.run("q_pre_" + i, "org-1", "pre_" + i, "bad_signature", nowS() - 600, nowS(), "{}");
  const atCap = await send(1);
  assert.equal(atCap.status, 202);
  assert.equal(d1.quarantined().length, 200, "the 200th row is stored");
  for (const i of [2, 3, 4]) {
    const res = await send(i);
    assert.equal(res.status, 202, "never a final error (C8)");
    assert.equal(res.body.quarantined, true);
    assert.match(res.body.notice, /could not be verified/);
  }
  assert.equal(d1.quarantined().length, 200, "no more rows stored past the cap");
  assert.equal(d1.checkins().length, 0, "fakes never counted (S1)");
  const list = await call(d1, "GET", "/org/checkin-quarantine");
  assert.equal(list.body.daily_cap, 200);
  assert.equal(list.body.not_stored.length, 1);
  assert.equal(list.body.not_stored[0].count, 3);
  // Another org's cap is its own.
  const other = await signedCheckinBody({ org: OTHER_KEY, ts: nowS() - 600 });
  other.helloSig = await forger.sign(other.helloHash);
  assert.equal((await call(d1, "POST", "/org/checkin", other, OTHER_KEY)).status, 202);
  assert.equal(d1.quarantined().filter(q => q.org_id === "org-2").length, 1);
});

test("C13: the same visit replayed offline under a new check-in id is not double-counted, even hours late", async () => {
  const d1 = new D1();
  const device = await newDevice();
  const first = await offline({ device, event_id: "ev-open", client_checkin_id: "visit_a" }, 3 * 3600);
  const firstRes = await checkin(d1, first);
  assert.equal(firstRes.status, 200, JSON.stringify(firstRes.body));
  // Same phone, same event, scanned 5 minutes later, synced later still.
  const again = await offline({ device, event_id: "ev-open", client_checkin_id: "visit_b" }, 3 * 3600 - 300);
  const againRes = await checkin(d1, again);
  assert.equal(againRes.status, 200);
  assert.equal(againRes.body.duplicate, true);
  assert.equal(againRes.body.checkin_id, "visit_a");
  assert.equal(d1.checkins().length, 1, "one visit, one row");
});

test("C13: a real later visit (after a check-out, or on another day) is still recorded, never lost", async () => {
  const d1 = new D1();
  const device = await newDevice();
  const first = await offline({ device, event_id: "ev-open", client_checkin_id: "day_1" }, 2 * DAY);
  assert.equal((await checkin(d1, first)).status, 200);
  // Another day, no check-out recorded: outside the window, so a new visit.
  const nextDay = await offline({ device, event_id: "ev-open", client_checkin_id: "day_2" }, 2 * DAY - DAY);
  const nextRes = await checkin(d1, nextDay);
  assert.equal(nextRes.body.duplicate, undefined);
  assert.equal(d1.checkins().length, 2);
  // Same day, but after a check-out: a new visit too.
  d1.db.prepare("UPDATE org_checkins SET checkout_at=checkin_at+600 WHERE id='day_2'").run();
  const back = await offline({ device, event_id: "ev-open", client_checkin_id: "day_2_back" }, DAY - 3600);
  const backRes = await checkin(d1, back);
  assert.equal(backRes.body.duplicate, undefined);
  assert.equal(d1.checkins().length, 3);
});

test("C12: phone time is recorded with its gap from arrival; big gaps are flagged, never refused", async () => {
  const d1 = new D1();
  // Synced 3 hours after the phone says it scanned: flagged.
  const late = await offline({}, 3 * 3600);
  const lateRes = await checkin(d1, late);
  assert.equal(lateRes.status, 200);
  assert.equal(lateRes.body.assurance, "offline");
  assert.equal(lateRes.body.clock_gap, true);
  assert.ok(lateRes.body.clock_gap_s >= 3 * 3600 - 5);
  assert.equal(lateRes.body.receipt?.clock_gap, true, "the signed receipt carries the flag");
  // Phone clock well ahead of the Worker: flagged, recorded at the Worker's time at most.
  const ahead = await live({ ts: nowS() + 900 });
  const aheadRes = await checkin(d1, ahead);
  assert.equal(aheadRes.status, 200, JSON.stringify(aheadRes.body));
  assert.equal(aheadRes.body.clock_gap, true);
  assert.ok(aheadRes.body.clock_gap_s < 0);
  assert.ok(aheadRes.body.checkin_at <= nowS());
  // A normal live scan: gap stored, not flagged.
  const nonce = await issueNonce(d1);
  const fresh = await live({ nonce });
  const freshRes = await checkin(d1, fresh);
  assert.equal(freshRes.body.assurance, "fresh");
  assert.equal(freshRes.body.clock_gap, undefined);
  const rows = d1.checkins();
  assert.equal(rows.length, 3);
  assert.ok(rows.every(r => Number.isInteger(r.clock_gap_s)), "gap kept on every signed check-in");
});

test("R4: the v6.7.1 migration only adds, keeps old rows as they were, and matches schema.sql", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE org_checkins (id TEXT PRIMARY KEY, org_id TEXT, checkin_at INTEGER, assurance TEXT)");
  db.prepare("INSERT INTO org_checkins (id,org_id,checkin_at,assurance) VALUES ('old','org-1',100,'fresh')").run();
  const before = JSON.stringify(db.prepare("SELECT id,org_id,checkin_at,assurance FROM org_checkins").all());
  db.exec(readFileSync(new URL("../migrations/2026-11-02-v6.7.1-checkin-hardening.sql", import.meta.url), "utf8"));
  assert.equal(JSON.stringify(db.prepare("SELECT id,org_id,checkin_at,assurance FROM org_checkins").all()), before);
  assert.equal(db.prepare("SELECT clock_gap_s FROM org_checkins WHERE id='old'").get().clock_gap_s, null, "no backfill");
  const cols = db.prepare("PRAGMA table_info(org_checkin_quarantine_overflow)").all().map(c => c.name);
  assert.deepEqual(cols, ["org_id", "day", "count"]);
  const schema = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
  assert.match(schema, /out_of_hours INTEGER DEFAULT 0, clock_gap_s INTEGER\);/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS org_checkin_quarantine_overflow \(org_id TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY \(org_id, day\)\);/);
});
