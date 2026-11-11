// First-scan hold (option C, docs/design-first-time-approval.md; Spencer,
// 9 Nov 2026, 10-minute hold). A phone the org has never seen signs a hold on
// the live code while it waits for staff; its check-in after approval is
// fresh if it is live, signed by the same key and within 10 minutes. Single
// use, one device key. Two phones on one code must not spoil each other.
// Late / queued / offline check-ins still land as offline (C2, C6, C14).
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import worker from "../src/index.js";
import { signedCheckinBody, newDevice, hashHello } from "./helpers/signed-checkin.mjs";

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
      CREATE TABLE org_checkins (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, mode TEXT NOT NULL, attendee_label TEXT, attendee_key_id TEXT, hello_hash TEXT, score INTEGER, bio_verified INTEGER DEFAULT 0, gps_hash TEXT, checkin_at INTEGER NOT NULL, checkout_at INTEGER, duration_s INTEGER, created_at INTEGER NOT NULL, name TEXT, attendee_pub_jwk TEXT, device_key_fp TEXT, status TEXT DEFAULT 'checked_in', expected_id INTEGER, conflict_id INTEGER, event_id TEXT, assurance TEXT, gps_band TEXT, gps_distance_km REAL, live_nonce TEXT);
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


const nowS = () => Math.floor(Date.now() / 1000);

async function holdBody(device, nonce, { ts, event_id = null, org = ORG_KEY, mode = "checkin_hold", tamper = false } = {}) {
  const helloPayload = { mode, org, pub: device.pub, ts: ts ?? nowS(), event_id, nonce, v: 2 };
  const helloHash = await hashHello(helloPayload);
  let helloSig = await device.sign(helloHash);
  if (tamper) helloPayload.nonce = nonce + "x";
  return { helloPayload, helloHash: tamper ? undefined : helloHash, helloSig, nonce: tamper ? nonce + "x" : nonce, event_id };
}

const hold = async (d1, device, nonce, opts) => call(d1, "POST", "/org/checkin/hold", await holdBody(device, nonce, opts));
const checkin = async (d1, device, nonce, extra = {}) =>
  call(d1, "POST", "/org/checkin", await signedCheckinBody({ org: ORG_KEY, device, nonce, ...extra }));
const holds = (d1) => d1.db.prepare("SELECT * FROM org_checkin_holds ORDER BY held_at").all();
const nonceRow = (d1, nonce) => d1.db.prepare("SELECT * FROM org_checkin_nonces WHERE nonce=?").get(nonce);
// The 90 s code has run out (staff took a while).
const expireCode = (d1, nonce) => d1.db.prepare("UPDATE org_checkin_nonces SET expires_at=? WHERE nonce=?").run(nowS() - 1, nonce);
// Move a phone's hold back in time by `ageS` seconds.
const ageHold = (d1, fp, ageS) => d1.db.prepare("UPDATE org_checkin_holds SET held_at=held_at-?, expires_at=expires_at-? WHERE device_key_fp=?").run(ageS, ageS, fp);
const checkOut = (d1, checkinId) => d1.db.prepare("UPDATE org_checkins SET checkout_at=? WHERE id=?").run(nowS(), checkinId);
const LIVE_ONLY = { anonymousMode: true, requireLiveCode: true };

test("hold, then staff approve 5 minutes later: the check-in is fresh and the hold is used up", async () => {
  const d1 = new D1();
  const phone = await newDevice();
  const nonce = await issueNonce(d1);
  const held = await hold(d1, phone, nonce);
  assert.equal(held.status, 200, JSON.stringify(held.body));
  assert.equal(held.body.held, true);
  assert.equal(held.body.expires_at - held.body.held_at, 600, "a hold lasts 10 minutes");
  assert.equal(nonceRow(d1, nonce).consumed_at, null, "a hold does not take the code's own check-in");
  expireCode(d1, nonce);
  ageHold(d1, phone.fp, 300);
  const res = await checkin(d1, phone, nonce);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.assurance, "fresh");
  assert.equal(res.body.held_code, true);
  const [h] = holds(d1);
  assert.ok(h.used_at, "the hold is used");
  assert.equal(h.checkin_id, res.body.checkin_id);
});

test("the screen moves on: a held code reads as used", async () => {
  const d1 = new D1();
  const nonce = await issueNonce(d1);
  assert.equal((await nonceStatus(d1, nonce)).body.used, false);
  assert.equal((await hold(d1, await newDevice(), nonce)).status, 200);
  assert.equal((await nonceStatus(d1, nonce)).body.used, true);
});

test("after the 10-minute hold the check-in lands as offline, as before", async () => {
  const d1 = new D1();
  const phone = await newDevice();
  const nonce = await issueNonce(d1);
  await hold(d1, phone, nonce);
  expireCode(d1, nonce);
  ageHold(d1, phone.fp, 601);
  const res = await checkin(d1, phone, nonce);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.assurance, "offline");
  assert.equal(res.body.held_code, undefined);
  assert.equal(holds(d1)[0].used_at, null);
});

test("a hold only works for the phone that made it", async () => {
  const d1 = new D1();
  const phone = await newDevice();
  const other = await newDevice();
  const nonce = await issueNonce(d1);
  await hold(d1, phone, nonce);
  expireCode(d1, nonce);
  const res = await checkin(d1, other, nonce);
  assert.equal(res.status, 200);
  assert.equal(res.body.assurance, "offline", "another key gets nothing from the hold");
  assert.equal(holds(d1)[0].used_at, null, "and the real phone's hold is untouched");
  const mine = await checkin(d1, phone, nonce);
  assert.equal(mine.body.assurance, "fresh");
});

test("a hold is single use", async () => {
  const d1 = new D1();
  const phone = await newDevice();
  const nonce = await issueNonce(d1);
  await hold(d1, phone, nonce);
  expireCode(d1, nonce);
  const first = await checkin(d1, phone, nonce);
  assert.equal(first.body.assurance, "fresh");
  checkOut(d1, first.body.checkin_id);
  const second = await checkin(d1, phone, nonce);
  assert.equal(second.status, 200, JSON.stringify(second.body));
  // The same door code on the same phone is a replay, not a new visit, so
  // the hold cannot mint a second fresh check-in after check-out.
  assert.equal(second.body.duplicate, true);
  assert.equal(second.body.checkin_id, first.body.checkin_id);
  assert.ok(second.body.checkout_at);
  assert.equal(d1.checkins().length, 1);
});

test("a retry of the same held check-in is not counted twice (C13)", async () => {
  const d1 = new D1();
  const phone = await newDevice();
  const nonce = await issueNonce(d1);
  await hold(d1, phone, nonce);
  expireCode(d1, nonce);
  const body = await signedCheckinBody({ org: ORG_KEY, device: phone, nonce });
  const first = await call(d1, "POST", "/org/checkin", body);
  assert.equal(first.body.assurance, "fresh");
  const again = await call(d1, "POST", "/org/checkin", { ...body, offline_queued: true });
  assert.equal(again.status, 200);
  assert.equal(again.body.duplicate, true);
  assert.equal(d1.checkins().length, 1);
});

test("a late (signed long ago) or queued check-in never uses a hold: it lands as offline", async () => {
  const d1 = new D1();
  const phone = await newDevice();
  const nonce = await issueNonce(d1);
  await hold(d1, phone, nonce);
  expireCode(d1, nonce);
  const late = await checkin(d1, phone, nonce, { ts: nowS() - 300 });
  assert.equal(late.status, 200, JSON.stringify(late.body));
  assert.equal(late.body.assurance, "offline");
  checkOut(d1, late.body.checkin_id);
  const queued = await checkin(d1, phone, nonce, { offline_queued: true });
  assert.equal(queued.status, 200, JSON.stringify(queued.body));
  assert.equal(queued.body.assurance, "offline", "the queue flag can only take a hold away");
  assert.equal(holds(d1)[0].used_at, null);
});

test("a queued check-in with a held code under Require live code gets a 202 notice, never a final error (C8)", async () => {
  const d1 = new D1(LIVE_ONLY);
  const phone = await newDevice();
  const nonce = await issueNonce(d1);
  await hold(d1, phone, nonce);
  expireCode(d1, nonce);
  const res = await checkin(d1, phone, nonce, { ts: nowS() - 900, offline_queued: true });
  assert.equal(res.status, 202, JSON.stringify(res.body));
  assert.equal(res.body.reason, "live_code_required");
});

test("Require live code: a held first visit is counted", async () => {
  const d1 = new D1(LIVE_ONLY);
  const phone = await newDevice();
  const nonce = await issueNonce(d1);
  await hold(d1, phone, nonce);
  expireCode(d1, nonce);
  ageHold(d1, phone.fp, 240);
  const res = await checkin(d1, phone, nonce);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.assurance, "fresh");
  assert.equal(d1.checkins().length, 1);
});

test("Require live code: without a hold the same late first visit is still held for staff", async () => {
  const d1 = new D1(LIVE_ONLY);
  const phone = await newDevice();
  const nonce = await issueNonce(d1);
  expireCode(d1, nonce);
  const res = await checkin(d1, phone, nonce);
  assert.equal(res.status, 202);
  assert.equal(res.body.reason, "live_code_required");
});

test("two phones, one code: a first-time phone's hold does not spoil a known phone's check-in", async () => {
  const d1 = new D1();
  const firstTime = await newDevice();
  const known = await newDevice();
  const nonce = await issueNonce(d1);
  assert.equal((await hold(d1, firstTime, nonce)).status, 200);
  // The known phone scanned the same frame before the screen changed.
  const b = await checkin(d1, known, nonce);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.equal(b.body.assurance, "fresh");
  expireCode(d1, nonce);
  const a = await checkin(d1, firstTime, nonce);
  assert.equal(a.body.assurance, "fresh", "and the hold still works after the other phone used the code");
  assert.equal(d1.checkins().length, 2);
});

test("two phones, one code: a known phone's check-in a moment earlier does not spoil the hold", async () => {
  const d1 = new D1();
  const firstTime = await newDevice();
  const known = await newDevice();
  const nonce = await issueNonce(d1);
  assert.equal((await checkin(d1, known, nonce)).body.assurance, "fresh");
  const held = await hold(d1, firstTime, nonce);
  assert.equal(held.status, 200, JSON.stringify(held.body));
  expireCode(d1, nonce);
  assert.equal((await checkin(d1, firstTime, nonce)).body.assurance, "fresh");
});

test("two first-time phones on one code: both holds work and neither spoils the other", async () => {
  const d1 = new D1();
  const a = await newDevice();
  const c = await newDevice();
  const nonce = await issueNonce(d1);
  assert.equal((await hold(d1, a, nonce)).status, 200);
  assert.equal((await hold(d1, c, nonce)).status, 200);
  expireCode(d1, nonce);
  assert.equal((await checkin(d1, c, nonce)).body.assurance, "fresh");
  assert.equal((await checkin(d1, a, nonce)).body.assurance, "fresh");
  assert.equal(d1.checkins().length, 2);
});

test("a second phone holding the code after the shared moment (5 s) is refused; its check-in still lands", async () => {
  const d1 = new D1();
  const a = await newDevice();
  const late = await newDevice();
  const nonce = await issueNonce(d1);
  await hold(d1, a, nonce);
  ageHold(d1, a.fp, 10);
  const res = await hold(d1, late, nonce);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  const ci = await checkin(d1, late, nonce);
  assert.equal(ci.status, 200);
  assert.equal(ci.body.assurance, "fresh", "the code's own one-time check-in is still there");
});

test("a hold on a code another phone used more than 5 s ago is refused", async () => {
  const d1 = new D1();
  const nonce = await issueNonce(d1);
  await checkin(d1, await newDevice(), nonce);
  d1.db.prepare("UPDATE org_checkin_nonces SET consumed_at=? WHERE nonce=?").run(nowS() - 10, nonce);
  assert.equal((await hold(d1, await newDevice(), nonce)).status, 409);
});

test("at most 4 holds on one code", async () => {
  const d1 = new D1();
  const nonce = await issueNonce(d1);
  for (let i = 0; i < 4; i++) assert.equal((await hold(d1, await newDevice(), nonce)).status, 200);
  assert.equal((await hold(d1, await newDevice(), nonce)).status, 409);
  assert.equal(holds(d1).length, 4);
});

test("the same phone holding twice keeps one hold", async () => {
  const d1 = new D1();
  const phone = await newDevice();
  const nonce = await issueNonce(d1);
  const first = await hold(d1, phone, nonce);
  ageHold(d1, phone.fp, 30);
  const again = await hold(d1, phone, nonce);
  assert.equal(again.status, 200);
  assert.equal(again.body.duplicate, true);
  assert.equal(again.body.hold_id, first.body.hold_id);
  assert.equal(holds(d1).length, 1);
});

test("a hold is refused for a bad signature, a stale signed time, an expired, unknown or other org's code", async () => {
  const d1 = new D1();
  const phone = await newDevice();
  const nonce = await issueNonce(d1);
  assert.equal((await call(d1, "POST", "/org/checkin/hold", await holdBody(phone, nonce, { tamper: true }))).status, 401);
  assert.equal((await hold(d1, phone, nonce, { mode: "attendee_scan" })).status, 401, "a check-in hello is not a hold");
  assert.equal((await hold(d1, phone, nonce, { org: OTHER_KEY })).status, 401);
  assert.equal((await hold(d1, phone, nonce, { ts: nowS() - 600 })).status, 409, "a photo held later from an old signed hello");
  assert.equal((await hold(d1, phone, nonce, { ts: nowS() + 600 })).status, 409);
  assert.equal((await hold(d1, phone, "cin_unknown")).status, 404);
  assert.equal((await hold(d1, phone, nonce, { event_id: "other-event" })).status, 404);
  const otherNonce = (await call(d1, "POST", "/org/checkin-nonce", { event_id: null }, OTHER_KEY)).body.nonce;
  assert.equal((await hold(d1, phone, otherNonce)).status, 404);
  expireCode(d1, nonce);
  assert.equal((await hold(d1, phone, nonce)).status, 410);
  assert.equal(holds(d1).length, 0);
  // None of this stops the check-in: it lands as offline (C2).
  assert.equal((await checkin(d1, phone, nonce)).body.assurance, "offline");
});

test("a hold placed on a code that was already used long ago (a photo) is refused", async () => {
  const d1 = new D1();
  const nonce = await issueNonce(d1);
  await checkin(d1, await newDevice(), nonce);
  d1.db.prepare("UPDATE org_checkin_nonces SET consumed_at=? WHERE nonce=?").run(nowS() - 60, nonce);
  const photo = await newDevice();
  assert.equal((await hold(d1, photo, nonce)).status, 409);
  assert.equal((await checkin(d1, photo, nonce)).body.assurance, "offline");
});

test("a static QR (no code) is unchanged, and a hold needs a code", async () => {
  const d1 = new D1();
  const res = await checkin(d1, await newDevice(), null);
  assert.equal(res.status, 200);
  assert.equal(res.body.assurance, "offline");
  assert.equal((await call(d1, "POST", "/org/checkin/hold", await holdBody(await newDevice(), ""))).status, 400, "a hold needs a code");
});

test("a fresh check-in with no hold is exactly as before", async () => {
  const d1 = new D1();
  const nonce = await issueNonce(d1);
  const res = await checkin(d1, await newDevice(), nonce);
  assert.equal(res.body.assurance, "fresh");
  assert.equal(res.body.held_code, undefined);
  assert.ok(nonceRow(d1, nonce).consumed_at);
});
