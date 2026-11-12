// Rule R1 (docs/rules.md): "Delete record" and "Clear attendance" are
// deliberate erasure. Only a Lead Admin / Developer login session may do
// them (the org api_key alone is not enough), and each one writes an
// immutable org_audit_log row: who, when, what, how many rows, never the
// erased data. If the audit row cannot be written, nothing is erased.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import worker from "../src/index.js";

const ORG_KEY = "org_erasure_test_key_123456";
const OTHER_KEY = "org_erasure_other_key_123456";
const DEV_FP = "fp-bootstrap-developer";
const T = Math.floor(Date.now() / 1000);

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

// Like Cloudflare D1, batch() is one transaction: any failure rolls it all back.
class D1 {
  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE organisations (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, api_key TEXT NOT NULL UNIQUE, venue_pub_jwk TEXT, venue_prv_jwk TEXT, settings_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE org_checkins (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, mode TEXT NOT NULL, attendee_label TEXT, checkin_at INTEGER NOT NULL, checkout_at INTEGER, created_at INTEGER NOT NULL, name TEXT, device_key_fp TEXT, status TEXT DEFAULT 'checked_in', expected_id INTEGER, event_id TEXT, assurance TEXT, gps_band TEXT, gps_distance_km REAL, out_of_hours INTEGER, clock_gap_s INTEGER, live_nonce TEXT);
      CREATE TABLE org_receipts (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, checkin_id TEXT REFERENCES org_checkins(id), payload_json TEXT NOT NULL, signature TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE org_expected (id INTEGER PRIMARY KEY AUTOINCREMENT, org_id TEXT NOT NULL, display_name TEXT, initials TEXT, role_key TEXT, device_pub_fp TEXT, created_at INTEGER, archived_at INTEGER);
      CREATE TABLE event_expected (event_id TEXT, expected_id INTEGER);
      CREATE TABLE rebind_history (id INTEGER PRIMARY KEY AUTOINCREMENT, org_code TEXT NOT NULL, expected_id INTEGER NOT NULL, old_device_fp TEXT, new_device_fp TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE attendee_conflicts (id INTEGER PRIMARY KEY AUTOINCREMENT, org_code TEXT NOT NULL, expected_id INTEGER NOT NULL, claiming_device_fp TEXT NOT NULL, claimed_name TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE org_checkout_tokens (token TEXT PRIMARY KEY, checkin_id TEXT NOT NULL, org_api_key TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, consumed_at INTEGER);
      CREATE TABLE org_checkin_nonces (nonce TEXT PRIMARY KEY, org_api_key TEXT NOT NULL, event_id TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, consumed_at INTEGER);
      CREATE TABLE login_sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, issued_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE portal_users (id TEXT PRIMARY KEY, pub_jwk TEXT NOT NULL, pub_fp TEXT NOT NULL UNIQUE, display_name TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE org_memberships (user_id TEXT NOT NULL, org_id TEXT NOT NULL, role TEXT NOT NULL, granted_at INTEGER NOT NULL, PRIMARY KEY (user_id, org_id));
      CREATE TABLE org_audit_log (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, actor_user_id TEXT, actor_pub_fp TEXT, actor_display_name TEXT, actor_role TEXT, action TEXT NOT NULL, target TEXT, target_ref TEXT, outcome TEXT NOT NULL DEFAULT 'allowed', detail TEXT, nonce TEXT, created_at INTEGER NOT NULL);
      CREATE TRIGGER org_audit_log_no_update BEFORE UPDATE ON org_audit_log BEGIN SELECT RAISE(ABORT, 'org_audit_log is immutable'); END;
      CREATE TRIGGER org_audit_log_no_delete BEFORE DELETE ON org_audit_log BEGIN SELECT RAISE(ABORT, 'org_audit_log is immutable'); END;
    `);
    const org = this.db.prepare("INSERT INTO organisations (id,name,slug,api_key,created_at,updated_at) VALUES (?,?,?,?,0,0)");
    org.run("org-1", "Test Org", "test-org", ORG_KEY);
    org.run("org-2", "Other Org", "other-org", OTHER_KEY);

    // People: one per role, each with a live login session token.
    for (const [id, role] of [["u-lead", "lead_admin"], ["u-dev", "developer"], ["u-manager", "manager"], ["u-staff", "staff"], ["u-boot", null]]) {
      const fp = id === "u-boot" ? DEV_FP : "fp-" + id;
      this.db.prepare("INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES (?,'{}',?,?,0,0)").run(id, fp, "Name " + id);
      this.db.prepare("INSERT INTO login_sessions (token,user_id,issued_at,expires_at) VALUES (?,?,?,?)").run(tokenFor(id), id, T, T + 3600);
      if (role) this.db.prepare("INSERT INTO org_memberships (user_id,org_id,role,granted_at) VALUES (?,?,?,0)").run(id, "org-1", role);
    }
    // Lead Admin of the OTHER org only.
    this.db.prepare("INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES ('u-other','{}','fp-u-other','Other lead',0,0)").run();
    this.db.prepare("INSERT INTO login_sessions (token,user_id,issued_at,expires_at) VALUES (?,?,?,?)").run(tokenFor("u-other"), "u-other", T, T + 3600);
    this.db.prepare("INSERT INTO org_memberships (user_id,org_id,role,granted_at) VALUES ('u-other','org-2','lead_admin',0)").run();

    this.seedAttendee("org-1", "Becky Example", "c-becky-1", true);
    this.seedAttendee("org-1", "Ann Example", "c-ann-1", true);
    this.seedAttendee("org-2", "Other Person", "c-other-1", true);
    this.db.prepare("INSERT INTO org_checkout_tokens VALUES ('tok-1','c-ann-1',?,0,9999999999,NULL)").run(ORG_KEY);
    this.db.prepare("INSERT INTO org_checkin_nonces VALUES ('n-1',?,NULL,0,9999999999,NULL)").run(ORG_KEY);
    this.db.prepare("INSERT INTO org_checkin_nonces VALUES ('n-2',?,NULL,0,9999999999,NULL)").run(OTHER_KEY);
  }
  // One expected attendee with a checked-out visit, a receipt, an event
  // roster row, a rebind and a conflict.
  seedAttendee(orgId, name, checkinId, checkedOut) {
    const { lastInsertRowid } = this.db.prepare("INSERT INTO org_expected (org_id,display_name,role_key,created_at) VALUES (?,?, 'attendee', 0)").run(orgId, name);
    const id = Number(lastInsertRowid);
    this.db.prepare("INSERT INTO org_checkins (id,org_id,mode,checkin_at,checkout_at,created_at,name,expected_id) VALUES (?,?,'expected',?,?,?,?,?)")
      .run(checkinId, orgId, T - 600, checkedOut ? T - 60 : null, T - 600, name, id);
    this.db.prepare("INSERT INTO org_receipts (id,org_id,checkin_id,payload_json,signature,created_at) VALUES (?,?,?,'{}','sig',0)").run("r-" + checkinId, orgId, checkinId);
    this.db.prepare("INSERT INTO event_expected VALUES ('ev-1', ?)").run(id);
    this.db.prepare("INSERT INTO rebind_history (org_code,expected_id,new_device_fp,created_at) VALUES (?,?,'fp-new',0)").run(orgId, id);
    this.db.prepare("INSERT INTO attendee_conflicts (org_code,expected_id,claiming_device_fp,claimed_name,created_at) VALUES (?,?,'fp-x',?,0)").run(orgId, id, name);
    return id;
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
  count(sql, ...args) { return Number(this.db.prepare("SELECT COUNT(*) AS n " + sql).get(...args).n); }
  audit() { return this.db.prepare("SELECT * FROM org_audit_log ORDER BY created_at, rowid").all(); }
  expectedId(name) { return this.db.prepare("SELECT id FROM org_expected WHERE display_name=?").get(name).id; }
}

// R1 checks that an audit row never holds the erased data (names). The row's
// id is random base64url text, so a plain regex over the whole row failed
// about 1 run in 12,000 when the id happened to contain "Ann" (review 3.3,
// the "Clear attendance with include_expected" flake). Check every field
// except the random id.
function auditTextWithoutRandomId(row) {
  const { id, ...rest } = row;
  return JSON.stringify(rest);
}

// Makes crypto.getRandomValues return bytes whose base64url text spells
// `word` over and over, so the next random audit id contains it.
async function withRandomIdSpelling(word, fn) {
  const bytes = Buffer.from(word.repeat(16).slice(0, 64), "base64");
  const original = crypto.getRandomValues;
  crypto.getRandomValues = (arr) => { arr.set(bytes.subarray(0, arr.length)); return arr; };
  try { return await fn(); } finally { crypto.getRandomValues = original; }
}

function tokenFor(userId) { return ("session_token_for_" + userId).replace(/[^A-Za-z0-9_-]/g, "_"); }

async function call(d1, method, path, { bearer, orgKey = ORG_KEY, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (orgKey) headers["X-Org-Key"] = orgKey;
  if (bearer) headers.Authorization = "Bearer " + bearer;
  const response = await worker.fetch(new Request("https://worker.test" + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  }), { DB: d1, CORS_ORIGIN: "*", BOOTSTRAP_DEVELOPER_FP: DEV_FP });
  return { status: response.status, body: await response.json() };
}

const deleteRecord = (d1, id, opts) => call(d1, "DELETE", `/org/expected/${id}/full`, opts);
const clearAttendance = (d1, opts) => call(d1, "POST", "/org/debug/clear-attendance", opts);

// ---- Delete record: server-side role check --------------------------------

test("Delete record: the org api_key alone is refused, nothing erased, nothing logged as allowed", async () => {
  const d1 = new D1();
  const id = d1.expectedId("Becky Example");
  for (const bearer of [undefined, ORG_KEY]) {
    const res = await deleteRecord(d1, id, { bearer });
    assert.equal(res.status, 403, JSON.stringify(res.body));
    assert.equal(res.body.error, "login_session_required");
  }
  assert.equal(d1.count("FROM org_expected WHERE id=?", id), 1);
  assert.equal(d1.count("FROM org_checkins WHERE expected_id=?", id), 1);
  assert.equal(d1.audit().length, 0);
});

test("Delete record: staff, manager and another org's Lead Admin are refused and the denial is logged", async () => {
  const d1 = new D1();
  const id = d1.expectedId("Becky Example");
  for (const user of ["u-staff", "u-manager", "u-other"]) {
    const res = await deleteRecord(d1, id, { bearer: tokenFor(user) });
    assert.equal(res.status, 403, user + " " + JSON.stringify(res.body));
    assert.equal(res.body.error, "insufficient_role");
  }
  assert.equal(d1.count("FROM org_expected WHERE id=?", id), 1);
  assert.equal(d1.count("FROM org_receipts WHERE checkin_id='c-becky-1'"), 1);
  const rows = d1.audit();
  assert.deepEqual(rows.map(r => [r.actor_user_id, r.action, r.outcome, r.org_id]), [
    ["u-staff", "record_delete", "denied", "org-1"],
    ["u-manager", "record_delete", "denied", "org-1"],
    ["u-other", "record_delete", "denied", "org-1"]
  ]);
});

test("Delete record: an invalid session token gets 401 and erases nothing", async () => {
  const d1 = new D1();
  const id = d1.expectedId("Becky Example");
  const res = await deleteRecord(d1, id, { bearer: "not_a_real_session_token_1234" });
  assert.equal(res.status, 401);
  assert.equal(d1.count("FROM org_expected WHERE id=?", id), 1);
});

// ---- Delete record: logged erasure -----------------------------------------

test("Delete record by a Lead Admin erases the cascade and writes one audit row with actor, time, target and row counts", async () => {
  const d1 = new D1();
  const id = d1.expectedId("Becky Example");
  const before = Math.floor(Date.now() / 1000);
  const res = await deleteRecord(d1, id, { bearer: tokenFor("u-lead") });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.cascade, { checkins: 1, expected: 1 });

  assert.equal(d1.count("FROM org_expected WHERE id=?", id), 0);
  assert.equal(d1.count("FROM org_checkins WHERE expected_id=?", id), 0);
  assert.equal(d1.count("FROM org_receipts WHERE checkin_id='c-becky-1'"), 0);
  assert.equal(d1.count("FROM event_expected WHERE expected_id=?", id), 0);
  assert.equal(d1.count("FROM rebind_history WHERE expected_id=?", id), 0);
  assert.equal(d1.count("FROM attendee_conflicts WHERE expected_id=?", id), 0);
  // Ann (same org) and the other org are untouched.
  assert.equal(d1.count("FROM org_expected"), 2);
  assert.equal(d1.count("FROM org_receipts"), 2);

  const rows = d1.audit();
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.org_id, "org-1");
  assert.equal(row.actor_user_id, "u-lead");
  assert.equal(row.actor_pub_fp, "fp-u-lead");
  assert.equal(row.actor_role, "lead_admin");
  assert.equal(row.action, "record_delete");
  assert.equal(row.outcome, "allowed");
  assert.equal(row.target_ref, String(id));
  assert.ok(row.created_at >= before && row.created_at <= Math.floor(Date.now() / 1000) + 1);
  assert.deepEqual(JSON.parse(row.detail), {
    rows: { receipts: 1, checkins: 1, event_expected: 1, rebind_history: 1, conflicts: 1, expected: 1 },
    options: { force: false }
  });
  // R1: never the erased data.
  assert.doesNotMatch(auditTextWithoutRandomId(row), /Becky/);
});

test("Delete record: org-scoped developer and bootstrap Developer are allowed; force on a live check-in is recorded", async () => {
  const d1 = new D1();
  const live = d1.seedAttendee("org-1", "Live Person", "c-live-1", false);
  const blocked = await deleteRecord(d1, live, { bearer: tokenFor("u-dev") });
  assert.equal(blocked.status, 409);
  assert.equal(d1.audit().length, 0);

  const forced = await call(d1, "DELETE", `/org/expected/${live}/full?force=true`, { bearer: tokenFor("u-dev") });
  assert.equal(forced.status, 200, JSON.stringify(forced.body));
  const boot = await deleteRecord(d1, d1.expectedId("Ann Example"), { bearer: tokenFor("u-boot") });
  assert.equal(boot.status, 200, JSON.stringify(boot.body));

  const rows = d1.audit();
  assert.deepEqual(rows.map(r => [r.actor_user_id, r.actor_role, JSON.parse(r.detail).options.force]), [
    ["u-dev", "developer", true],
    ["u-boot", "developer", false]
  ]);
});

test("Delete record: if the audit row cannot be written, nothing is erased", async () => {
  const d1 = new D1();
  d1.db.exec("CREATE TRIGGER audit_down BEFORE INSERT ON org_audit_log BEGIN SELECT RAISE(ABORT, 'disk full'); END");
  const id = d1.expectedId("Becky Example");
  const res = await deleteRecord(d1, id, { bearer: tokenFor("u-lead") });
  assert.equal(res.status, 503, JSON.stringify(res.body));
  assert.equal(res.body.error, "audit_log_unavailable");
  assert.equal(d1.count("FROM org_expected WHERE id=?", id), 1);
  assert.equal(d1.count("FROM org_checkins WHERE expected_id=?", id), 1);
  assert.equal(d1.count("FROM org_receipts WHERE checkin_id='c-becky-1'"), 1);
  assert.equal(d1.count("FROM rebind_history WHERE expected_id=?", id), 1);
});

test("Delete record: a 404 target writes no allowed audit row", async () => {
  const d1 = new D1();
  const res = await deleteRecord(d1, 999, { bearer: tokenFor("u-lead") });
  assert.equal(res.status, 404);
  assert.equal(d1.audit().length, 0);
});

// ---- Clear attendance -------------------------------------------------------

test("Clear attendance: staff and the api_key alone are refused; staff denial is logged", async () => {
  const d1 = new D1();
  assert.equal((await clearAttendance(d1, { bearer: ORG_KEY })).status, 403);
  const staff = await clearAttendance(d1, { bearer: tokenFor("u-staff") });
  assert.equal(staff.status, 403);
  assert.equal(staff.body.error, "insufficient_role");
  assert.equal(d1.count("FROM org_checkins WHERE org_id='org-1'"), 2);
  assert.deepEqual(d1.audit().map(r => [r.actor_user_id, r.action, r.outcome]), [["u-staff", "attendance_clear", "denied"]]);
});

test("Clear attendance by a Lead Admin is logged with exact row counts and leaves other orgs alone", async () => {
  const d1 = new D1();
  const res = await clearAttendance(d1, { bearer: tokenFor("u-lead") });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.cleared, { checkins: 2, conflicts: 2, checkout_tokens: 1, expected_attendees: 0 });
  assert.equal(res.body.checkin_nonces_cleared, 1);
  assert.equal(d1.count("FROM org_checkins WHERE org_id='org-1'"), 0);
  assert.equal(d1.count("FROM org_expected WHERE org_id='org-1'"), 2);
  assert.equal(d1.count("FROM org_checkins WHERE org_id='org-2'"), 1);
  assert.equal(d1.count("FROM org_checkin_nonces WHERE org_api_key=?", OTHER_KEY), 1);

  const [row] = d1.audit();
  assert.equal(row.action, "attendance_clear");
  assert.equal(row.actor_user_id, "u-lead");
  assert.equal(row.actor_role, "lead_admin");
  assert.equal(row.target_ref, "org-1");
  assert.equal(row.outcome, "allowed");
  assert.deepEqual(JSON.parse(row.detail), {
    rows: { receipts: 2, checkins: 2, conflicts: 2, checkout_tokens: 1, checkin_nonces: 1 },
    options: { include_expected: false }
  });
});

test("Clear attendance with include_expected also clears the expected list and logs it", async () => {
  const d1 = new D1();
  const res = await clearAttendance(d1, { bearer: tokenFor("u-boot"), body: { include_expected: true } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.cleared.expected_attendees, 2);
  assert.equal(d1.count("FROM org_expected WHERE org_id='org-1'"), 0);
  assert.equal(d1.count("FROM rebind_history WHERE org_code='org-1'"), 0);
  assert.equal(d1.count("FROM org_expected WHERE org_id='org-2'"), 1);
  const [row] = d1.audit();
  const detail = JSON.parse(row.detail);
  assert.equal(detail.rows.expected_attendees, 2);
  assert.equal(detail.rows.rebind_history, 2);
  assert.deepEqual(detail.options, { include_expected: true });
  assert.doesNotMatch(auditTextWithoutRandomId(row), /Becky|Ann/);
});

test("R1 name check ignores the random audit id (regression for the 3.3 flake)", async () => {
  const d1 = new D1();
  const res = await withRandomIdSpelling("AnnA", () =>
    clearAttendance(d1, { bearer: tokenFor("u-boot"), body: { include_expected: true } }));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const [row] = d1.audit();
  assert.match(row.id, /Ann/, "the stub put the name into the random id");
  assert.doesNotMatch(auditTextWithoutRandomId(row), /Becky|Ann/);
});

test("Clear attendance: if the audit row cannot be written, nothing is erased", async () => {
  const d1 = new D1();
  d1.db.exec("CREATE TRIGGER audit_down BEFORE INSERT ON org_audit_log BEGIN SELECT RAISE(ABORT, 'disk full'); END");
  const res = await clearAttendance(d1, { bearer: tokenFor("u-lead"), body: { include_expected: true } });
  assert.equal(res.status, 503);
  assert.equal(d1.count("FROM org_checkins WHERE org_id='org-1'"), 2);
  assert.equal(d1.count("FROM org_receipts WHERE org_id='org-1'"), 2);
  assert.equal(d1.count("FROM org_expected WHERE org_id='org-1'"), 2);
  assert.equal(d1.count("FROM org_checkin_nonces WHERE org_api_key=?", ORG_KEY), 1);
});

// ---- Immutability -----------------------------------------------------------

test("Erasure audit rows cannot be changed or deleted, and a later Clear does not touch them", async () => {
  const d1 = new D1();
  await deleteRecord(d1, d1.expectedId("Becky Example"), { bearer: tokenFor("u-lead") });
  await clearAttendance(d1, { bearer: tokenFor("u-lead"), body: { include_expected: true } });
  assert.equal(d1.audit().length, 2);
  assert.throws(() => d1.db.exec("UPDATE org_audit_log SET outcome='denied'"), /immutable/);
  assert.throws(() => d1.db.exec("DELETE FROM org_audit_log"), /immutable/);
  assert.equal(d1.audit().length, 2);

  // The Lead Admin can read both entries through the log endpoint.
  const log = await call(d1, "GET", "/org/audit-log", { bearer: tokenFor("u-lead") });
  assert.equal(log.status, 200, JSON.stringify(log.body));
  assert.deepEqual(log.body.entries.map(e => e.action).sort(), ["attendance_clear", "record_delete"]);
});
