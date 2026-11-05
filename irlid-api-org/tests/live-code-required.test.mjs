// S12: a photo of an old venue QR, scanned later from somewhere else.
// With the org setting "requireLiveCode" on, only a check-in carrying a live,
// unused code the Worker issued is counted. Anything else is quarantined for
// staff (202, never a final error, C8) and never counted. Off by default, so
// offline-first is unchanged for every other org.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import worker from "../src/index.js";
import { signedCheckinBody } from "./helpers/signed-checkin.mjs";

const ORG_KEY = "org_offline_test_key_123456";
const OTHER_KEY = "org_other_key_1234567890";

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

// A device-signed check-in. Pass checkin_ts to sign an older scan (a queued
// offline check-in); by default it is a live scan signed now.
async function attendeeBody(overrides = {}) {
  const { checkin_ts, nonce, event_id, client_checkin_id, ...rest } = overrides;
  return signedCheckinBody({ org: ORG_KEY, ts: checkin_ts, nonce, event_id, client_checkin_id, ...rest });
}

// An offline check-in signed `ageS` seconds ago (default 10 minutes).
const offlineBody = (overrides = {}, ageS = 600) =>
  attendeeBody({ checkin_ts: Math.floor(Date.now() / 1000) - ageS, ...overrides });


const LIVE_ONLY = { anonymousMode: true, requireLiveCode: true };
const quarantined = (d1) => d1.db.prepare("SELECT * FROM org_checkin_quarantine").all();

test("requireLiveCode: a live scan with a fresh code is counted as fresh", async () => {
  const d1 = new D1(LIVE_ONLY);
  const nonce = await issueNonce(d1);
  const res = await call(d1, "POST", "/org/checkin", await attendeeBody({ nonce }));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.assurance, "fresh");
  assert.equal(d1.checkins().length, 1);
});

test("requireLiveCode: a photo of an already-used QR scanned later is not counted", async () => {
  const d1 = new D1(LIVE_ONLY);
  const nonce = await issueNonce(d1);
  assert.equal((await call(d1, "POST", "/org/checkin", await attendeeBody({ nonce }))).status, 200);
  // Someone else, elsewhere, scans a photo of the same screen.
  const res = await call(d1, "POST", "/org/checkin", await attendeeBody({ nonce }));
  assert.equal(res.status, 202, JSON.stringify(res.body));
  assert.equal(res.body.quarantined, true);
  assert.equal(res.body.reason, "live_code_required");
  assert.equal(res.body.checkin_id, undefined);
  assert.equal(d1.checkins().length, 1, "the photo scan is not counted");
  assert.equal(quarantined(d1).length, 1, "it is kept for staff review");
});

test("requireLiveCode: no code at all (static QR) is not counted", async () => {
  const d1 = new D1(LIVE_ONLY);
  const res = await call(d1, "POST", "/org/checkin", await attendeeBody());
  assert.equal(res.status, 202);
  assert.equal(res.body.reason, "live_code_required");
  assert.equal(d1.checkins().length, 0);
});

test("requireLiveCode: backdating the phone clock and claiming 'queued' does not get round it", async () => {
  const d1 = new D1(LIVE_ONLY);
  const nonce = await issueNonce(d1);
  await call(d1, "POST", "/org/checkin", await attendeeBody({ nonce }));
  const old = await attendeeBody({ nonce, checkin_ts: Math.floor(Date.now() / 1000) - 3600, offline_queued: true });
  const res = await call(d1, "POST", "/org/checkin", old);
  assert.equal(res.status, 202, "never a final error on the queue path (C8)");
  assert.equal(res.body.reason, "live_code_required");
  assert.equal(d1.checkins().length, 1);
});

test("requireLiveCode off (default): a stale code still lands as offline, unchanged", async () => {
  const d1 = new D1();
  const nonce = await issueNonce(d1);
  await call(d1, "POST", "/org/checkin", await attendeeBody({ nonce }));
  const res = await call(d1, "POST", "/org/checkin", await attendeeBody({ nonce }));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.assurance, "offline");
  assert.equal(d1.checkins().length, 2);
});

test("requireLiveCode: the org api_key alone cannot switch it on or off", async () => {
  const on = new D1();
  const r1 = await call(on, "POST", "/org/settings", { requireLiveCode: true });
  assert.equal(r1.status, 403, JSON.stringify(r1.body));
  const off = new D1(LIVE_ONLY);
  const r2 = await call(off, "POST", "/org/settings", { requireLiveCode: false });
  assert.equal(r2.status, 403, JSON.stringify(r2.body));
  const stored = JSON.parse(off.db.prepare("SELECT settings_json FROM organisations WHERE id='org-1'").get().settings_json);
  assert.equal(stored.requireLiveCode, true);
  const bad = await call(off, "POST", "/org/settings", { requireLiveCode: "no" });
  assert.equal(bad.status, 400);
});
