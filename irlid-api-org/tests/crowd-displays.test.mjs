import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import worker from "../src/index.js";
import {
  claimCrowdCode,
  currentCrowdCode,
  ensureCrowdStorage,
  resetCrowdStorageFlagForTests,
  CROWD_CODE_GRACE_S,
  CROWD_CODE_MAX_AGE_S,
  CROWD_CODE_MAX_USES
} from "../src/crowd.js";

// Minimal D1 stand-in over a real in-memory SQLite, so the SQL under test is
// the SQL that runs (unlike the string-matching fake in checkin-nonce.test).
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
  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec(`
      CREATE TABLE organisations (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, api_key TEXT NOT NULL UNIQUE, venue_pub_jwk TEXT, venue_prv_jwk TEXT, settings_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE portal_users (id TEXT PRIMARY KEY, pub_jwk TEXT NOT NULL, pub_fp TEXT NOT NULL UNIQUE, display_name TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE login_sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, issued_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, ip_hash TEXT, user_agent TEXT);
      CREATE TABLE org_memberships (user_id TEXT NOT NULL, org_id TEXT NOT NULL, role TEXT NOT NULL, granted_by TEXT, granted_at INTEGER NOT NULL, created_via TEXT, PRIMARY KEY (user_id, org_id));
      CREATE TABLE org_checkins (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, mode TEXT NOT NULL, attendee_label TEXT, attendee_key_id TEXT, hello_hash TEXT, score INTEGER, bio_verified INTEGER DEFAULT 0, gps_hash TEXT, checkin_at INTEGER NOT NULL, checkout_at INTEGER, duration_s INTEGER, created_at INTEGER NOT NULL, name TEXT, attendee_pub_jwk TEXT, device_key_fp TEXT, status TEXT DEFAULT 'checked_in', expected_id INTEGER, conflict_id INTEGER, event_id TEXT, assurance TEXT);
      CREATE TABLE org_checkin_nonces (nonce TEXT PRIMARY KEY, org_api_key TEXT NOT NULL, event_id TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, consumed_at INTEGER);
      CREATE TABLE rooms (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, label TEXT);
      CREATE TABLE weekly_events (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, room_id TEXT, name TEXT NOT NULL, day_of_week INTEGER NOT NULL, start_time_local TEXT NOT NULL, duration_min INTEGER NOT NULL, capacity INTEGER, color_hex TEXT, notes TEXT, require_proof INTEGER DEFAULT 0, late_grace_min INTEGER DEFAULT 0, created_at INTEGER NOT NULL, archived_at INTEGER);
    `);
  }
  prepare(sql) { return new D1Statement(this.db, sql); }
  async batch(statements) {
    this.db.exec("BEGIN");
    try {
      const out = [];
      for (const s of statements) out.push(await s.run());
      this.db.exec("COMMIT");
      return out;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  exec(sql) { this.db.exec(sql); }
}

const ORG_KEY = "org_crowd_test_key_123456";
const T0 = Math.floor(Date.now() / 1000);

function setup() {
  resetCrowdStorageFlagForTests();
  const d1 = new D1();
  d1.exec(`
    INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES ('org-1','Test Org','test-org','${ORG_KEY}','{}',0,0);
    INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES ('org-2','Other Org','other-org','org_other_key_1234567890','{}',0,0);
    INSERT INTO weekly_events (id,org_id,name,day_of_week,start_time_local,duration_min,created_at) VALUES ('ev-crowd','org-1','Big Gathering',1,'10:00',60,0);
    INSERT INTO weekly_events (id,org_id,name,day_of_week,start_time_local,duration_min,created_at) VALUES ('ev-standard','org-1','Weekly Club',2,'10:00',60,0);
  `);
  for (const [user, role] of [["sam", "staff"], ["alex", "staff"], ["pat", "attendee"]]) {
    d1.exec(`
      INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES ('${user}','{}','fp_${user}','${user}',0,0);
      INSERT INTO login_sessions (token,user_id,issued_at,expires_at) VALUES ('session_${user}_0123456789','${user}',${T0},${T0 + 3600});
      INSERT INTO org_memberships (user_id,org_id,role,granted_at) VALUES ('${user}','org-1','${role}',0);
    `);
  }
  return d1;
}

async function enableCrowdMode(d1) {
  // Run the lazy migration, then flip the event as a signed calendar update would.
  await ensureCrowdStorage({ DB: d1 });
  d1.exec("UPDATE weekly_events SET checkin_mode='crowd' WHERE id='ev-crowd'");
}

async function call(d1, method, path, body, { user, orgKey, org = "test-org" } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (user) headers.Authorization = `Bearer session_${user}_0123456789`;
  if (orgKey) { headers.Authorization = `Bearer ${orgKey}`; headers["X-Org-Key"] = orgKey; }
  const url = new URL("https://worker.test" + path);
  if (org && !orgKey) url.searchParams.set("org", org);
  const response = await worker.fetch(
    new Request(url, { method, headers, body: body ? JSON.stringify(body) : undefined }),
    { DB: d1, CORS_ORIGIN: "*" }
  );
  return { status: response.status, body: await response.json() };
}

async function openDisplay(d1, user = "sam", label = "Wall screen 1") {
  const res = await call(d1, "POST", "/org/crowd/displays", { event_id: "ev-crowd", label }, { user });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

function displayRow(d1, id) {
  return d1.db.prepare("SELECT * FROM org_checkin_displays WHERE id=?").get(id);
}

test("the org master key alone cannot open a display", async () => {
  const d1 = setup();
  await enableCrowdMode(d1);
  const res = await call(d1, "POST", "/org/crowd/displays", { event_id: "ev-crowd" }, { orgKey: ORG_KEY });
  assert.equal(res.status, 401);
});

test("an attendee cannot open a display", async () => {
  const d1 = setup();
  await enableCrowdMode(d1);
  const res = await call(d1, "POST", "/org/crowd/displays", { event_id: "ev-crowd" }, { user: "pat" });
  assert.equal(res.status, 403);
});

test("a standard event cannot show crowd codes", async () => {
  const d1 = setup();
  await enableCrowdMode(d1);
  const res = await call(d1, "POST", "/org/crowd/displays", { event_id: "ev-standard" }, { user: "sam" });
  assert.equal(res.status, 409);
  assert.equal(res.body.error, "event_not_crowd_mode");
});

test("each display gets its own code stream", async () => {
  const d1 = setup();
  await enableCrowdMode(d1);
  const a = await openDisplay(d1, "sam", "Wall screen 1");
  const b = await openDisplay(d1, "alex", "Alex's phone");
  assert.match(a.code, /^crc_/);
  assert.notEqual(a.code, b.code);
  assert.equal(a.display.label, "Wall screen 1");

  const claim = await claimCrowdCode({ DB: d1 }, { orgId: "org-1", eventId: "ev-crowd", code: a.code }, T0);
  assert.equal(claim.ok, true);
  assert.equal(claim.display_id, a.display.id);

  const pollA = await call(d1, "GET", `/org/crowd/displays/${a.display.id}/code`, null, { user: "sam" });
  const pollB = await call(d1, "GET", `/org/crowd/displays/${b.display.id}/code`, null, { user: "alex" });
  assert.equal(pollA.body.rotated, true);
  assert.notEqual(pollA.body.code, a.code);
  assert.equal(pollB.body.rotated, false);
  assert.equal(pollB.body.code, b.code);
});

test("an unused code stays put, then rotates before it nears expiry", async () => {
  const d1 = setup();
  await enableCrowdMode(d1);
  const opened = await openDisplay(d1);
  const display = displayRow(d1, opened.display.id);
  const t = opened.issued_at;
  assert.equal((await currentCrowdCode({ DB: d1 }, display, t + 30)).code, opened.code);
  const later = await currentCrowdCode({ DB: d1 }, display, t + 61);
  assert.equal(later.rotated, true);
  assert.notEqual(later.code, opened.code);
});

test("a superseded code is accepted inside the grace period and refused after it", async () => {
  const d1 = setup();
  await enableCrowdMode(d1);
  const opened = await openDisplay(d1);
  const display = displayRow(d1, opened.display.id);
  const t = opened.issued_at;
  const claimAt = at => claimCrowdCode({ DB: d1 }, { orgId: "org-1", eventId: "ev-crowd", code: opened.code }, at);

  assert.equal((await claimAt(t)).ok, true);
  await currentCrowdCode({ DB: d1 }, display, t + 1); // display sees the use and rotates at t+1

  assert.equal((await claimAt(t + 1 + CROWD_CODE_GRACE_S - 1)).ok, true, "same frame, slow phone");
  const late = await claimAt(t + 1 + CROWD_CODE_GRACE_S + 1);
  assert.equal(late.ok, false, "forwarded photo");
  assert.equal(late.reason, "code_expired");
});

test("a code is never accepted past its maximum age or use count", async () => {
  const d1 = setup();
  await enableCrowdMode(d1);
  const opened = await openDisplay(d1);
  const t = opened.issued_at;
  const claim = at => claimCrowdCode({ DB: d1 }, { orgId: "org-1", eventId: "ev-crowd", code: opened.code }, at);

  assert.equal((await claim(t + CROWD_CODE_MAX_AGE_S)).ok, false);
  for (let i = 0; i < CROWD_CODE_MAX_USES; i++) assert.equal((await claim(t)).ok, true);
  assert.equal((await claim(t)).ok, false);
});

test("a code only works for the org and event it was issued for", async () => {
  const d1 = setup();
  await enableCrowdMode(d1);
  const opened = await openDisplay(d1);
  const t = opened.issued_at;
  const wrongEvent = await claimCrowdCode({ DB: d1 }, { orgId: "org-1", eventId: "ev-standard", code: opened.code }, t);
  const wrongOrg = await claimCrowdCode({ DB: d1 }, { orgId: "org-2", eventId: "ev-crowd", code: opened.code }, t);
  const madeUp = await claimCrowdCode({ DB: d1 }, { orgId: "org-1", eventId: "ev-crowd", code: "crc_made_up" }, t);
  assert.equal(wrongEvent.reason, "code_not_found");
  assert.equal(wrongOrg.reason, "code_not_found");
  assert.equal(madeUp.reason, "code_not_found");
});

test("only the member who opened a display can poll it", async () => {
  const d1 = setup();
  await enableCrowdMode(d1);
  const opened = await openDisplay(d1, "sam");
  const res = await call(d1, "GET", `/org/crowd/displays/${opened.display.id}/code`, null, { user: "alex" });
  assert.equal(res.status, 404);
});

test("signing out all devices stops that member's displays", async () => {
  const d1 = setup();
  await enableCrowdMode(d1);
  const opened = await openDisplay(d1, "sam");
  const out = await call(d1, "POST", "/user/sign-out-all-devices", null, { user: "sam", org: null });
  assert.equal(out.status, 200);
  const res = await call(d1, "GET", `/org/crowd/displays/${opened.display.id}/code`, null, { user: "sam" });
  assert.equal(res.status, 401);
});

test("closing a display retires its codes at once", async () => {
  const d1 = setup();
  await enableCrowdMode(d1);
  const opened = await openDisplay(d1, "sam");
  const closed = await call(d1, "POST", `/org/crowd/displays/${opened.display.id}/close`, null, { user: "sam" });
  assert.equal(closed.status, 200);
  const poll = await call(d1, "GET", `/org/crowd/displays/${opened.display.id}/code`, null, { user: "sam" });
  assert.equal(poll.status, 410);
  const claim = await claimCrowdCode({ DB: d1 }, { orgId: "org-1", eventId: "ev-crowd", code: opened.code }, opened.issued_at);
  assert.equal(claim.ok, false);
});

test("crowd events refuse the old 45-second nonce and the named check-in path", async () => {
  const d1 = setup();
  await enableCrowdMode(d1);
  const nonce = await call(d1, "POST", "/org/checkin-nonce", { event_id: "ev-crowd" }, { orgKey: ORG_KEY });
  assert.equal(nonce.status, 409);
  assert.equal(nonce.body.error, "event_uses_crowd_codes");

  const checkin = await call(d1, "POST", "/org/checkin", {
    mode: "attendee_scan", event_id: "ev-crowd", name: "Someone", score: 70
  }, { org: "test-org" });
  assert.equal(checkin.status, 409);
  assert.equal(checkin.body.error, "crowd_checkin_required");
});

test("standard events still get the old nonce", async () => {
  const d1 = setup();
  await enableCrowdMode(d1);
  const nonce = await call(d1, "POST", "/org/checkin-nonce", { event_id: "ev-standard" }, { orgKey: ORG_KEY });
  assert.equal(nonce.status, 200);
  assert.match(nonce.body.nonce, /^cin_/);
});
