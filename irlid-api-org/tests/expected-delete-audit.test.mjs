// v6.8.17: "Delete expected" (orgExpectedDelete) archives the row and writes
// an append-only org_audit_log row naming the real person, the org, the
// target and the time. It does not erase the record (that is Delete record).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../src/index.js";
import { SqliteD1 } from "./helpers/sqlite-d1.mjs";

const ORG_KEY = "org_expected_delete_audit_key_123456";
const OTHER_KEY = "org_expected_delete_other_key_123456";
const DEV_FP = "fp-bootstrap-developer";
const T = Math.floor(Date.now() / 1000);

function tokenFor(userId) {
  return ("session_token_for_" + userId).replace(/[^A-Za-z0-9_-]/g, "_");
}

function setup() {
  const d1 = new SqliteD1();
  d1.exec("INSERT INTO organisations (id,name,slug,api_key,created_at,updated_at) VALUES ('org-1','Org One','one',?,0,0)", ORG_KEY);
  d1.exec("INSERT INTO organisations (id,name,slug,api_key,created_at,updated_at) VALUES ('org-2','Org Two','two',?,0,0)", OTHER_KEY);
  d1.exec("DROP TABLE org_expected");
  d1.exec(`CREATE TABLE org_expected (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id TEXT NOT NULL,
    display_name TEXT,
    initials TEXT,
    role_key TEXT,
    device_pub_fp TEXT,
    created_at INTEGER,
    archived_at INTEGER
  )`);
  for (const [id, role, name] of [
    ["u-lead", "lead_admin", "Lena Lead"],
    ["u-dev", "developer", "Dana Developer"],
    ["u-staff", "staff", "Sam Staff"],
    ["u-manager", "manager", "Mo Manager"],
    ["u-attendee", "attendee", "Ada Attendee"]
  ]) {
    d1.exec("INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES (?,'{}',?,?,0,0)", id, "fp-" + id, name);
    d1.exec("INSERT INTO login_sessions (token,user_id,issued_at,expires_at) VALUES (?,?,?,?)", tokenFor(id), id, T, T + 3600);
    d1.exec("INSERT INTO org_memberships (user_id,org_id,role,granted_at) VALUES (?,?,?,0)", id, "org-1", role);
  }
  d1.exec("INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES ('u-boot','{}',?,'Spencer Developer',0,0)", DEV_FP);
  d1.exec("INSERT INTO login_sessions (token,user_id,issued_at,expires_at) VALUES (?,?,?,?)", tokenFor("u-boot"), "u-boot", T, T + 3600);
  return d1;
}

function addExpected(d1, { orgId = "org-1", name = "Pat Person", archivedAt = null, fp = null } = {}) {
  const info = d1.exec(
    "INSERT INTO org_expected (org_id,display_name,role_key,device_pub_fp,created_at,archived_at) VALUES (?,?,?,?,?,?)",
    orgId, name, "attendee", fp, T, archivedAt
  );
  return Number(info.lastInsertRowid);
}

async function call(d1, method, path, { bearer, orgKey = ORG_KEY, body, staffSession } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (orgKey) headers["X-Org-Key"] = orgKey;
  if (bearer) headers.Authorization = "Bearer " + bearer;
  if (staffSession) headers["X-Staff-Session"] = staffSession;
  const response = await worker.fetch(new Request("https://worker.test" + path, {
    method, headers, body: body ? JSON.stringify(body) : "{}"
  }), { DB: d1, CORS_ORIGIN: "*", BOOTSTRAP_DEVELOPER_FP: DEV_FP });
  let parsed;
  try { parsed = await response.json(); } catch { parsed = null; }
  return { status: response.status, body: parsed };
}

const delExpected = (d1, id, opts) => call(d1, "DELETE", "/org/expected/" + id, opts);

async function readLog(d1, bearer = tokenFor("u-lead")) {
  const res = await worker.fetch(new Request("https://worker.test/org/audit-log?limit=200", {
    headers: { "X-Org-Id": "org-1", Authorization: "Bearer " + bearer }
  }), { DB: d1, CORS_ORIGIN: "*", BOOTSTRAP_DEVELOPER_FP: DEV_FP });
  return { status: res.status, body: await res.json() };
}

test("Delete expected by a named staff member archives the row and writes one audit row with their real name, the org, the target and the time", async () => {
  const d1 = setup();
  const id = addExpected(d1, { name: "Pat Person" });
  const before = d1.get("SELECT archived_at FROM org_expected WHERE id=?", id);
  assert.equal(before.archived_at, null);
  const { status, body } = await delExpected(d1, id, { bearer: tokenFor("u-staff") });
  assert.equal(status, 200);
  assert.equal(body.deleted, true);
  assert.equal(body.archived, true);
  const row = d1.get("SELECT * FROM org_expected WHERE id=?", id);
  assert.ok(row.archived_at, "row is archived, not erased");
  assert.equal(row.display_name, "Pat Person");
  const { body: log } = await readLog(d1);
  const entries = (log.entries || []).filter(e => e.action === "expected_delete");
  assert.equal(entries.length, 1);
  const e = entries[0];
  assert.equal(e.actor_name, "Sam Staff");
  assert.equal(e.actor_role, "staff");
  assert.equal(e.target, "Pat Person");
  assert.equal(e.outcome, "allowed");
  assert.ok(e.created_at, "time is stored");
  const stored = d1.get("SELECT * FROM org_audit_log WHERE action='expected_delete'");
  assert.equal(String(stored.target_ref), String(id));
  const detail = JSON.parse(e.detail || stored.detail);
  assert.equal(detail.archived, true);
  assert.equal(detail.org_id, "org-1");
  assert.equal(detail.org_name, "Org One");
});

test("Delete expected by a Lead Admin or Developer is named with their real name (Developer label is fine)", async () => {
  const d1 = setup();
  const id1 = addExpected(d1, { name: "First Person" });
  const id2 = addExpected(d1, { name: "Second Person" });
  const lead = await delExpected(d1, id1, { bearer: tokenFor("u-lead") });
  const dev = await delExpected(d1, id2, { bearer: tokenFor("u-dev") });
  assert.equal(lead.status, 200);
  assert.equal(dev.status, 200);
  const { body: log } = await readLog(d1);
  const names = log.entries.filter(e => e.action === "expected_delete").map(e => e.actor_name).sort();
  assert.deepEqual(names, ["Dana Developer", "Lena Lead"]);
});

test("a bootstrap Developer session is allowed and can show as Developer", async () => {
  const d1 = setup();
  const id = addExpected(d1, { name: "Dev Target" });
  const { status } = await delExpected(d1, id, { bearer: tokenFor("u-boot") });
  assert.equal(status, 200);
  const { body: log } = await readLog(d1);
  const e = log.entries.find(x => x.action === "expected_delete");
  assert.ok(e);
  // Stored name is the account name; the reader may also accept Developer.
  assert.ok(e.actor_name === "Spencer Developer" || /Developer/.test(e.actor_name), e.actor_name);
});

test("an attendee session cannot archive anyone and writes no allowed audit row", async () => {
  const d1 = setup();
  const id = addExpected(d1, { name: "Stay Put" });
  const { status } = await delExpected(d1, id, { bearer: tokenFor("u-attendee") });
  assert.ok(status >= 400);
  const row = d1.get("SELECT archived_at FROM org_expected WHERE id=?", id);
  assert.equal(row.archived_at, null);
  const allowed = d1.all("SELECT * FROM org_audit_log WHERE action='expected_delete' AND outcome='allowed'");
  assert.equal(allowed.length, 0);
});

test("a missing row is 404 and writes no audit row", async () => {
  const d1 = setup();
  const { status } = await delExpected(d1, 9999, { bearer: tokenFor("u-staff") });
  assert.equal(status, 404);
  assert.equal(d1.all("SELECT * FROM org_audit_log WHERE action='expected_delete'").length, 0);
});

test("a second Delete expected on an already-archived row succeeds but does not write another audit row", async () => {
  const d1 = setup();
  const id = addExpected(d1, { name: "Pat Person" });
  assert.equal((await delExpected(d1, id, { bearer: tokenFor("u-staff") })).status, 200);
  const firstAt = d1.get("SELECT archived_at FROM org_expected WHERE id=?", id).archived_at;
  const again = await delExpected(d1, id, { bearer: tokenFor("u-lead") });
  assert.equal(again.status, 200);
  assert.equal(again.body.archived, true);
  assert.equal(d1.get("SELECT archived_at FROM org_expected WHERE id=?", id).archived_at, firstAt);
  assert.equal(d1.all("SELECT * FROM org_audit_log WHERE action='expected_delete'").length, 1);
});

test("Delete expected still only archives: the expected row and any visits stay in the database", async () => {
  const d1 = setup();
  const id = addExpected(d1, { name: "Pat Person" });
  d1.exec(
    "INSERT INTO org_checkins (id,org_id,mode,checkin_at,checkout_at,created_at,name,expected_id) VALUES ('c-1','org-1','expected',?,?,?,'Pat Person',?)",
    T - 600, T - 60, T - 600, id
  );
  const { status } = await delExpected(d1, id, { bearer: tokenFor("u-manager") });
  assert.equal(status, 200);
  assert.equal(d1.get("SELECT COUNT(*) AS n FROM org_expected WHERE id=?", id).n, 1);
  assert.equal(d1.get("SELECT COUNT(*) AS n FROM org_checkins WHERE id='c-1'").n, 1);
  const { body: log } = await readLog(d1);
  assert.equal(log.entries[0].actor_name, "Mo Manager");
});

test("if the audit write fails, the row is still archived (no new visible error)", async () => {
  const d1 = setup();
  const id = addExpected(d1, { name: "Pat Person" });
  // Let the Worker create the audit table first, then fail only the INSERT.
  await readLog(d1);
  d1.failOn(/INSERT INTO org_audit_log/, 1);
  const { status, body } = await delExpected(d1, id, { bearer: tokenFor("u-staff") });
  assert.equal(status, 200);
  assert.equal(body.archived, true);
  assert.ok(d1.get("SELECT archived_at FROM org_expected WHERE id=?", id).archived_at);
});

test("the stale comment that archive-delete is unreachable from the UI is gone, and the dashboard still has Delete expected", () => {
  const src = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /orgExpectedDelete is no longer reachable from the UI/);
  assert.match(src, /Delete expected[\s\S]{0,80}orgExpectedDelete/);
  const dash = readFileSync(new URL("../../Org.html", import.meta.url), "utf8");
  assert.match(dash, /Delete expected/);
  assert.match(dash, /deleteExpectedFromAttendance/);
});

test("a staff-session delete is named from the roster for that phone key, never a bare 'staff'", async () => {
  const d1 = setup();
  const id = addExpected(d1, { name: "Pat Person" });
  // Staff phone is on the roster as "Rita Doorman", not as a portal user.
  d1.exec(
    "INSERT INTO org_expected (org_id,display_name,role_key,device_pub_fp,created_at,archived_at) VALUES ('org-1','Rita Doorman','staff','fp-rita-door',?,NULL)",
    T
  );
  d1.exec(
    "INSERT INTO org_staff_sessions (id,org_id,staff_pub_fp,staff_pub_jwk,hello_hash,verification_state,created_at,expires_at,last_seen_at) VALUES ('staff_sess_rita','org-1','fp-rita-door','{}','h1','ok',?,?,?)",
    T, T + 900, T
  );
  const { status } = await delExpected(d1, id, { orgKey: ORG_KEY, staffSession: "staff_sess_rita" });
  assert.equal(status, 200);
  const { body: log } = await readLog(d1);
  const e = log.entries.find(x => x.action === "expected_delete");
  assert.equal(e.actor_name, "Rita Doorman");
  assert.notEqual(String(e.actor_name).toLowerCase(), "staff");
});
