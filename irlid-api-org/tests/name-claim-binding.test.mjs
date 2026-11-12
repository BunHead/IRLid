// Review 1.1: a typed name must never claim a guest-list place on its own.
// A phone is bound to an expected attendee only by a fresh (live, unused
// code), correctly signed attendee scan. An offline / unverified check-in with
// a matching name still counts, but leaves the binding to staff.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import worker from "../src/index.js";
import { signedCheckinBody, newDevice, eventScheduleAt } from "./helpers/signed-checkin.mjs";

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
      CREATE TABLE org_checkins (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, mode TEXT NOT NULL, attendee_label TEXT, attendee_key_id TEXT, hello_hash TEXT, score INTEGER, bio_verified INTEGER DEFAULT 0, gps_hash TEXT, checkin_at INTEGER NOT NULL, checkout_at INTEGER, duration_s INTEGER, created_at INTEGER NOT NULL, name TEXT, attendee_pub_jwk TEXT, device_key_fp TEXT, status TEXT DEFAULT 'checked_in', expected_id INTEGER, conflict_id INTEGER, event_id TEXT, assurance TEXT, gps_band TEXT, gps_distance_km REAL, out_of_hours INTEGER DEFAULT 0, clock_gap_s INTEGER, live_nonce TEXT);
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


function addExpected(d1, name, fp = null) {
  return Number(d1.db.prepare("INSERT INTO org_expected (org_id,display_name,role_key,device_pub_fp,created_at) VALUES (?,?,?,?,0)")
    .run("org-1", name, "attendee", fp).lastInsertRowid);
}
const boundFp = (d1, id) => d1.db.prepare("SELECT device_pub_fp FROM org_expected WHERE id=?").get(id).device_pub_fp;
const named = { anonymousMode: false };

test("an offline check-in with a typed name counts but never binds the phone", async () => {
  const d1 = new D1(named);
  const id = addExpected(d1, "Jane Smith");
  const attacker = await newDevice();
  const res = await checkin(d1, await offline({ device: attacker, name: "jane smith" }));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.assurance, "offline");
  assert.equal(res.body.linked, true);
  assert.equal(res.body.expected_id, id);
  assert.equal(res.body.device_bound, false);
  assert.equal(res.body.bind_skipped, "needs_fresh_signed_checkin");
  assert.equal(boundFp(d1, id), null, "the place stays unbound");
  assert.equal(d1.checkins()[0].expected_id, id);
});

test("a live scan with a stale or missing code is offline, so it doesn't bind either", async () => {
  const d1 = new D1(named);
  const id = addExpected(d1, "Jane Smith");
  const noCode = await checkin(d1, await live({ name: "Jane Smith" }));
  assert.equal(noCode.body.assurance, "offline");
  assert.equal(noCode.body.device_bound, false);
  const stale = await checkin(d1, await live({ name: "Jane Smith", nonce: "cin_never_issued" }));
  assert.equal(stale.body.assurance, "offline");
  assert.equal(boundFp(d1, id), null);
});

test("a fresh, signed, live-code check-in binds the phone as before", async () => {
  const d1 = new D1(named);
  const id = addExpected(d1, "Jane Smith");
  const jane = await newDevice();
  const nonce = await issueNonce(d1);
  const res = await checkin(d1, await live({ device: jane, name: "Jane Smith", nonce }));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.assurance, "fresh");
  assert.equal(res.body.device_bound, true);
  assert.equal(res.body.bind_skipped, undefined);
  assert.equal(boundFp(d1, id), jane.fp);
});

test("after an offline name claim, the real person's fresh scan still binds and is not a conflict", async () => {
  const d1 = new D1(named);
  const id = addExpected(d1, "Jane Smith");
  const attacker = await newDevice();
  await checkin(d1, await offline({ device: attacker, name: "Jane Smith" }));
  const jane = await newDevice();
  const nonce = await issueNonce(d1);
  const res = await checkin(d1, await live({ device: jane, name: "Jane Smith", nonce }));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.notEqual(res.body.conflict, true);
  assert.equal(res.body.device_bound, true);
  assert.equal(boundFp(d1, id), jane.fp);
});

test("an offline check-in from the already-bound phone is recognised as bound", async () => {
  const d1 = new D1(named);
  const jane = await newDevice();
  const id = addExpected(d1, "Jane Smith", jane.fp);
  const res = await checkin(d1, await offline({ device: jane, name: "Jane Smith" }));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.expected_id, id);
  assert.equal(res.body.device_bound, true);
});
