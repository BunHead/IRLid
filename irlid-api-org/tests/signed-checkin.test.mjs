// Signed check-in (docs/requirements/offline-first.md, "Check-in signature
// rules"). The phone signs its check-in hello with its device key and the
// Worker verifies it against hello.pub and recomputes the hash.
//
// ONLINE (hello signed in the last 120 s): a bad or missing signature, a
// missing / stale / used code (static QR and crowd mode included) or a time
// outside the event is refused. Staff-tier members with a signed staff
// session may check in any time, flagged. OFFLINE replays are never dropped:
// valid ones land as offline / unverified, bad-signature ones are quarantined.
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
      CREATE TABLE org_checkins (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, mode TEXT NOT NULL, attendee_label TEXT, attendee_key_id TEXT, hello_hash TEXT, score INTEGER, bio_verified INTEGER DEFAULT 0, gps_hash TEXT, checkin_at INTEGER NOT NULL, checkout_at INTEGER, duration_s INTEGER, created_at INTEGER NOT NULL, name TEXT, attendee_pub_jwk TEXT, device_key_fp TEXT, status TEXT DEFAULT 'checked_in', expected_id INTEGER, conflict_id INTEGER, event_id TEXT, assurance TEXT, gps_band TEXT, gps_distance_km REAL, out_of_hours INTEGER DEFAULT 0);
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

test("phone-reported offline flag and score do not open the online rules", async () => {
  const d1 = new D1();
  const body = await live({ offline_queued: true, score: 100, bioVerified: true });
  const res = await checkin(d1, body);
  assert.equal(res.status, 403, JSON.stringify(res.body));
  assert.equal(res.body.reason, "live_code_required");
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

// ---- 3. Stale / used / missing codes refused online ------------------------

test("online: stale, used, unknown and missing codes are refused (static QR included)", async () => {
  const d1 = new D1();
  const expired = await issueNonce(d1);
  d1.db.prepare("UPDATE org_checkin_nonces SET expires_at=1 WHERE nonce=?").run(expired);
  const used = await issueNonce(d1);
  assert.equal((await checkin(d1, await live({ nonce: used }))).status, 200);
  const results = [
    [await live({ nonce: expired }), 410],
    [await live({ nonce: used }), 409],
    [await live({ nonce: "cin_never_issued" }), 404],
    [await live(), 403] // static QR: no code
  ];
  for (const [body, status] of results) {
    const res = await checkin(d1, body);
    assert.equal(res.status, status, JSON.stringify(res.body));
  }
  assert.equal(d1.checkins().length, 1);
});

test("online: crowd mode refuses a used code past its grace and a missing code", async () => {
  const d1 = new D1();
  const nonce = await issueNonce(d1, "ev-crowd");
  assert.equal((await checkin(d1, await live({ nonce, event_id: "ev-crowd" }))).body.assurance, "fresh");
  assert.equal((await checkin(d1, await live({ nonce, event_id: "ev-crowd" }))).status, 200, "inside crowd grace");
  d1.db.prepare("UPDATE org_checkin_nonces SET consumed_at=consumed_at-60 WHERE nonce=?").run(nonce);
  assert.equal((await checkin(d1, await live({ nonce, event_id: "ev-crowd" }))).status, 409);
  assert.equal((await checkin(d1, await live({ event_id: "ev-crowd" }))).status, 403);
  assert.equal(d1.checkins().length, 2);
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
