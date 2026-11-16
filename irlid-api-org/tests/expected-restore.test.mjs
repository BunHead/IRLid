// v6.8.19: restore archived expected attendees (Lead Admin / Developer, own org only).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../src/index.js";
import { SqliteD1 } from "./helpers/sqlite-d1.mjs";

const ORG_KEY = "org_expected_restore_key_1234567890";
const OTHER_KEY = "org_expected_restore_other_key_1234567";
const DEV_FP = "fp-bootstrap-developer";
const T = Math.floor(Date.now() / 1000);
const tokenFor = (id) => ("session_token_for_" + id).replace(/[^A-Za-z0-9_-]/g, "_");

function setup() {
  const d1 = new SqliteD1();
  d1.exec("INSERT INTO organisations (id,name,slug,api_key,created_at,updated_at) VALUES ('org-1','Org One','one',?,0,0)", ORG_KEY);
  d1.exec("INSERT INTO organisations (id,name,slug,api_key,created_at,updated_at) VALUES ('org-2','Org Two','two',?,0,0)", OTHER_KEY);
  d1.exec("DROP TABLE org_expected");
  d1.exec(`CREATE TABLE org_expected (
    id INTEGER PRIMARY KEY AUTOINCREMENT, org_id TEXT NOT NULL, display_name TEXT, initials TEXT,
    role_key TEXT, device_pub_fp TEXT, email_hint TEXT, phone_hint TEXT, notes TEXT,
    created_at INTEGER, archived_at INTEGER)`);
  for (const [id, role, name, org] of [
    ["u-lead", "lead_admin", "Lena Lead", "org-1"],
    ["u-dev", "developer", "Dana Developer", "org-1"],
    ["u-staff", "staff", "Sam Staff", "org-1"],
    ["u-manager", "manager", "Mo Manager", "org-1"],
    ["u-attendee", "attendee", "Ada Attendee", "org-1"],
    ["u-lead2", "lead_admin", "Other Lead", "org-2"]
  ]) {
    d1.exec("INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES (?,'{}',?,?,0,0)", id, "fp-" + id, name);
    d1.exec("INSERT INTO login_sessions (token,user_id,issued_at,expires_at) VALUES (?,?,?,?)", tokenFor(id), id, T, T + 3600);
    d1.exec("INSERT INTO org_memberships (user_id,org_id,role,granted_at) VALUES (?,?,?,0)", id, org, role);
  }
  d1.exec("INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES ('u-boot','{}',?,'Spencer Developer',0,0)", DEV_FP);
  d1.exec("INSERT INTO login_sessions (token,user_id,issued_at,expires_at) VALUES (?,?,?,?)", tokenFor("u-boot"), "u-boot", T, T + 3600);
  return d1;
}
function add(d1, { orgId = "org-1", name = "Pat Person", archivedAt = null } = {}) {
  return Number(d1.exec("INSERT INTO org_expected (org_id,display_name,role_key,device_pub_fp,created_at,archived_at) VALUES (?,?,?,?,?,?)",
    orgId, name, "attendee", "fp-secret-" + name, T, archivedAt).lastInsertRowid);
}
async function call(d1, method, path, { bearer, orgId = "org-1", orgKey, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (orgKey) headers["X-Org-Key"] = orgKey; else if (orgId) headers["X-Org-Id"] = orgId;
  if (bearer) headers.Authorization = "Bearer " + bearer;
  const res = await worker.fetch(new Request("https://worker.test" + path, {
    method, headers, body: method === "GET" ? undefined : JSON.stringify(body || {})
  }), { DB: d1, CORS_ORIGIN: "*", BOOTSTRAP_DEVELOPER_FP: DEV_FP });
  let parsed; try { parsed = await res.json(); } catch { parsed = null; }
  return { status: res.status, body: parsed };
}
const restore = (d1, id, o) => call(d1, "POST", "/org/expected/" + id + "/restore", o);
const archivedList = (d1, o) => call(d1, "GET", "/org/expected?archived=1", o);
const auditRows = (d1) => d1.all("SELECT * FROM org_audit_log WHERE action='expected_restore'");

test("Lead Admin sees archived people of their org only, with no device keys", async () => {
  const d1 = setup();
  const a = add(d1, { name: "Archived One", archivedAt: T - 10 });
  add(d1, { name: "Active One" });
  add(d1, { orgId: "org-2", name: "Other Org Archived", archivedAt: T - 5 });
  const { status, body } = await archivedList(d1, { bearer: tokenFor("u-lead") });
  assert.equal(status, 200);
  assert.deepEqual(body.expected.map(r => r.display_name), ["Archived One"]);
  assert.equal(body.expected[0].id, a);
  assert.equal(JSON.stringify(body).includes("fp-secret"), false);
});

test("restore clears archived_at and writes one expected_restore row with the real name, org, target and time", async () => {
  const d1 = setup();
  const id = add(d1, { name: "Pat Person", archivedAt: T - 10 });
  const { status, body } = await restore(d1, id, { bearer: tokenFor("u-lead") });
  assert.equal(status, 200);
  assert.equal(body.restored, true);
  assert.equal(d1.get("SELECT archived_at FROM org_expected WHERE id=?", id).archived_at, null);
  const rows = auditRows(d1);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].actor_display_name, "Lena Lead");
  assert.equal(rows[0].actor_role, "lead_admin");
  assert.equal(rows[0].target, "Pat Person");
  assert.equal(rows[0].org_id, "org-1");
  assert.equal(String(rows[0].target_ref), String(id));
  assert.ok(rows[0].created_at);
  assert.equal(JSON.parse(rows[0].detail).org_name, "Org One");
  // shown in the Admin actions log
  const log = await call(d1, "GET", "/org/audit-log?limit=50", { bearer: tokenFor("u-lead") });
  const e = log.body.entries.find(x => x.action === "expected_restore");
  assert.equal(e.actor_name, "Lena Lead");
  assert.equal(e.target, "Pat Person");
  // and the person is back on the active list
  const active = await call(d1, "GET", "/org/expected", { bearer: tokenFor("u-lead") });
  assert.ok((active.body.expected || []).some(r => r.id === id));
});

test("Developer restore is named (Developer label fine); a bootstrap developer works", async () => {
  const d1 = setup();
  const i1 = add(d1, { name: "A One", archivedAt: T - 1 });
  const i2 = add(d1, { name: "B Two", archivedAt: T - 1 });
  assert.equal((await restore(d1, i1, { bearer: tokenFor("u-dev") })).status, 200);
  assert.equal((await restore(d1, i2, { bearer: tokenFor("u-boot") })).status, 200);
  const names = auditRows(d1).map(r => r.actor_display_name).sort();
  assert.ok(names.every(n => n && n.toLowerCase() !== "staff"));
  assert.ok(names.includes("Dana Developer"));
});

test("restoring an already-active record is a no-op success with no extra row; double restore logs once", async () => {
  const d1 = setup();
  const active = add(d1, { name: "Active Person" });
  const r = await restore(d1, active, { bearer: tokenFor("u-lead") });
  assert.equal(r.status, 200);
  assert.equal(r.body.restored, false);
  assert.equal(r.body.already_active, true);
  assert.equal(auditRows(d1).length, 0);
  const arch = add(d1, { name: "Gone Person", archivedAt: T - 5 });
  await restore(d1, arch, { bearer: tokenFor("u-lead") });
  const again = await restore(d1, arch, { bearer: tokenFor("u-dev") });
  assert.equal(again.status, 200);
  assert.equal(auditRows(d1).length, 1);
});

test("strict org scoping: another org's admin cannot list or restore, and the row is untouched", async () => {
  const d1 = setup();
  const id = add(d1, { name: "Pat Person", archivedAt: T - 10 });
  // org-2 lead addressing org-2 with org-1's id: not found, no change
  const r = await restore(d1, id, { bearer: tokenFor("u-lead2"), orgId: "org-2" });
  assert.equal(r.status, 404);
  // org-2 lead pointing at org-1: not a member
  const r2 = await restore(d1, id, { bearer: tokenFor("u-lead2"), orgId: "org-1" });
  assert.ok(r2.status === 403 || r2.status === 401);
  const l = await archivedList(d1, { bearer: tokenFor("u-lead2"), orgId: "org-1" });
  assert.ok(l.status === 403 || l.status === 401);
  const l2 = await archivedList(d1, { bearer: tokenFor("u-lead2"), orgId: "org-2" });
  assert.deepEqual(l2.body.expected, []);
  assert.ok(d1.get("SELECT archived_at FROM org_expected WHERE id=?", id).archived_at);
  assert.equal(auditRows(d1).length, 0);
});

test("staff, manager, attendee and the venue api key cannot list or restore", async () => {
  const d1 = setup();
  const id = add(d1, { name: "Pat Person", archivedAt: T - 10 });
  for (const who of ["u-staff", "u-manager", "u-attendee"]) {
    assert.ok((await restore(d1, id, { bearer: tokenFor(who) })).status >= 400, who);
    assert.ok((await archivedList(d1, { bearer: tokenFor(who) })).status >= 400, who);
  }
  assert.ok((await restore(d1, id, { orgKey: ORG_KEY })).status >= 400);
  assert.ok((await archivedList(d1, { orgKey: ORG_KEY })).status >= 400);
  assert.ok(d1.get("SELECT archived_at FROM org_expected WHERE id=?", id).archived_at);
  assert.equal(auditRows(d1).length, 0);
});

test("fully deleted records are not restorable (404) and never listed", async () => {
  const d1 = setup();
  const id = add(d1, { name: "Erased Person", archivedAt: T - 10 });
  d1.exec("DELETE FROM org_expected WHERE id=?", id);
  assert.equal((await restore(d1, id, { bearer: tokenFor("u-lead") })).status, 404);
  assert.deepEqual((await archivedList(d1, { bearer: tokenFor("u-lead") })).body.expected, []);
  assert.equal(auditRows(d1).length, 0);
});

test("restore refuses to create a duplicate of an active person with the same name", async () => {
  const d1 = setup();
  const arch = add(d1, { name: "Pat Person", archivedAt: T - 10 });
  add(d1, { name: "pat person" });
  const r = await restore(d1, arch, { bearer: tokenFor("u-lead") });
  assert.equal(r.status, 409);
  assert.ok(d1.get("SELECT archived_at FROM org_expected WHERE id=?", arch).archived_at);
  assert.equal(auditRows(d1).length, 0);
});

test("if the audit write fails the restore still stands (R5)", async () => {
  const d1 = setup();
  const id = add(d1, { name: "Pat Person", archivedAt: T - 10 });
  await call(d1, "GET", "/org/audit-log?limit=1", { bearer: tokenFor("u-lead") });
  d1.failOn(/INSERT INTO org_audit_log/, 1);
  const r = await restore(d1, id, { bearer: tokenFor("u-lead") });
  assert.equal(r.status, 200);
  assert.equal(d1.get("SELECT archived_at FROM org_expected WHERE id=?", id).archived_at, null);
});

test("check-in is untouched: restore is never queued offline, and the dashboard has the toggle and Restore button", () => {
  const api = readFileSync(new URL("../../js/orgapi.js", import.meta.url), "utf8");
  assert.match(api, /restore\(\[\/\?\]\|\$\)/);
  const dash = readFileSync(new URL("../../Org.html", import.meta.url), "utf8");
  assert.match(dash, /Show archived/);
  assert.match(dash, /restoreExpectedFromArchive/);
  assert.match(dash, /'expected_restore': 'Restore expected'/);
});
