// v6.8.26 - two people with the same name in one organisation.
// The Worker no longer refuses a second active person with the same name (add,
// rename, restore). Wherever an admin sees the name, it carries name_label:
// "Name (…a3f9)", the last 4 characters of that person's device key, but only
// while another ACTIVE person shares the name. The stored name never changes.
// Made-up names only. Runs the Worker's real SQL (helpers/sqlite-d1.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import worker from "../src/index.js";
import { SqliteD1 } from "./helpers/sqlite-d1.mjs";
import { signedCheckinBody, newDevice } from "./helpers/signed-checkin.mjs";

const T = Math.floor(Date.now() / 1000);
const ORG_KEY = "org_same_name_key_1234567890abcd";
const TOK = "sess_same_name_lead_abcdefghijk";
const NAME = "Sam Example";
const FP1 = "fpSamFirst00a3f9";
const FP2 = "fpSamSecond07c21";
const ELL = "…";

const LIVE = `
  DROP TABLE org_expected;
  CREATE TABLE org_expected (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, display_name TEXT NOT NULL, initials TEXT,
    role_key TEXT DEFAULT 'attendee', device_pub_fp TEXT, email_hint TEXT, phone_hint TEXT, notes TEXT,
    created_at INTEGER NOT NULL, archived_at INTEGER);
  CREATE TABLE IF NOT EXISTS expected_device_keys (org_id TEXT, expected_id INTEGER, device_key_fp TEXT, revoked_at INTEGER);
  CREATE TABLE IF NOT EXISTS org_receipts (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, checkin_id TEXT, attendee_pub_fp TEXT,
    payload_json TEXT NOT NULL, signature TEXT NOT NULL, created_at INTEGER NOT NULL, privacy_mode INTEGER DEFAULT 1);
`;
// The old live index (migrations/apply_v5_11_0_*.ps1), for the "not yet
// updated" database.
const OLD_UNIQUE = "CREATE UNIQUE INDEX uq_org_expected_name ON org_expected (org_id, LOWER(display_name)) WHERE archived_at IS NULL;";

function makeEnv({ oldIndex = false } = {}) {
  const d1 = new SqliteD1(LIVE + (oldIndex ? OLD_UNIQUE : ""));
  d1.exec("INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES ('org-1','Sample Club','sample-club',?,'{}',0,0)", ORG_KEY);
  d1.exec("INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES ('u-lead','{}','fp_lead_000001','Lee Lead',0,0)");
  d1.exec("INSERT INTO org_memberships (org_id,user_id,role,granted_at) VALUES ('org-1','u-lead','lead_admin',1)");
  d1.exec("INSERT INTO login_sessions (token,user_id,issued_at,expires_at) VALUES (?,?,?,?)", TOK, "u-lead", T, T + 3600);
  return { env: { DB: d1, CORS_ORIGIN: "*", CHECKIN_SIGNING_CUTOFF: "1" }, d1 };
}
let seq = 0;
const person = (d1, name, fp, archivedAt = null) => {
  const id = "p_test_" + (++seq);
  d1.exec("INSERT INTO org_expected (id,org_id,display_name,device_pub_fp,created_at,archived_at) VALUES (?,'org-1',?,?,?,?)", id, name, fp, T, archivedAt);
  return id;
};

async function call(env, method, path, { body, auth = true, orgKey } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (orgKey) headers["X-Org-Key"] = orgKey;
  else if (auth) { headers.Authorization = "Bearer " + TOK; headers["X-Org-Id"] = "org-1"; }
  const res = await worker.fetch(new Request("https://worker.test" + path, {
    method, headers, body: method === "GET" ? undefined : JSON.stringify(body || {})
  }), env, { waitUntil() {} });
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch (_) {}
  return { status: res.status, data, text };
}

test("two active people can have the same name (add)", async () => {
  const { env, d1 } = makeEnv();
  const a = await call(env, "POST", "/org/expected", { body: { display_name: NAME } });
  const b = await call(env, "POST", "/org/expected", { body: { display_name: "sam example" } });
  assert.equal(a.status, 201, a.text);
  assert.equal(b.status, 201, b.text);
  assert.equal(d1.get("SELECT COUNT(*) AS n FROM org_expected WHERE LOWER(display_name)='sam example' AND archived_at IS NULL").n, 2);
});

test("renaming someone to a name another person has is no longer refused (edit needs a signed admin action, so checked in the source)", () => {
  const src = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("async function orgExpectedUpdate"), src.indexOf("async function orgExpectedUpdate") + 4000);
  assert.ok(!/LOWER\(display_name\)=LOWER\(\?\)/.test(fn), "no same-name lookup left in the edit");
  assert.match(fn, /isUniqueNameError\(e\)\) return duplicateNameReply\(\)/, "an old unique index still answers 409, not 500");
  for (const f of ["orgExpectedCreate", "orgExpectedCreateAndBind", "orgExpectedRestore"]) {
    const body = src.slice(src.indexOf("async function " + f + "("), src.indexOf("async function " + f + "(") + 5000);
    assert.ok(!/error: "duplicate", existing_id/.test(body), f + " no longer refuses a same name");
  }
});

test("the expected list labels both people with the last 4 of their key; others are left alone", async () => {
  const { env, d1 } = makeEnv();
  person(d1, NAME, FP1); person(d1, NAME, FP2); person(d1, "Alex Sample", "fpAlex000000beef");
  const r = await call(env, "GET", "/org/expected");
  assert.equal(r.status, 200);
  const labels = r.data.expected.map(e => e.name_label || "-").sort();
  assert.deepEqual(labels, ["-", `${NAME} (${ELL}7c21)`, `${NAME} (${ELL}a3f9)`].sort());
  for (const e of r.data.expected) assert.equal(e.display_name === NAME || e.display_name === "Alex Sample", true, "stored name is unchanged");
});

test("someone with no key yet is labelled 'no key yet' so the two still differ", async () => {
  const { env, d1 } = makeEnv();
  person(d1, NAME, FP1); person(d1, NAME, null);
  const r = await call(env, "GET", "/org/expected");
  assert.deepEqual(r.data.expected.map(e => e.name_label).sort(), [`${NAME} (${ELL}a3f9)`, `${NAME} (no key yet)`].sort());
});

test("the label goes away once nobody else ACTIVE shares the name", async () => {
  const { env, d1 } = makeEnv();
  person(d1, NAME, FP1); person(d1, NAME, FP2, T - 10); // second one archived
  const r = await call(env, "GET", "/org/expected");
  assert.equal(r.data.expected.length, 1);
  assert.equal(r.data.expected[0].name_label, undefined);
});

test("Restore list: an archived person whose name an active person has is labelled, and the raw key is never sent", async () => {
  const { env, d1 } = makeEnv();
  person(d1, NAME, FP1); person(d1, NAME, FP2, T - 10); person(d1, "Alex Sample", "fpAlex000000beef", T - 10);
  const r = await call(env, "GET", "/org/expected?archived=1");
  const byName = Object.fromEntries(r.data.expected.map(e => [e.display_name, e]));
  assert.equal(byName[NAME].name_label, `${NAME} (${ELL}7c21)`);
  assert.equal(byName["Alex Sample"].name_label, undefined);
  assert.ok(!r.text.includes(FP2) && !r.text.includes("device_pub_fp"), "only the 4-character tag leaves the Worker");
});

test("restore works with a same-name active person, and the admin log names which one", async () => {
  const { env, d1 } = makeEnv();
  person(d1, NAME, FP1);
  const arch = person(d1, NAME, FP2, T - 10);
  const r = await call(env, "POST", `/org/expected/${arch}/restore`);
  assert.equal(r.status, 200, r.text);
  const row = d1.get("SELECT target FROM org_audit_log WHERE action='expected_restore'");
  assert.equal(row.target, `${NAME} (${ELL}7c21)`);
});

test("Delete expected: the admin log names which of two same-name people was removed", async () => {
  const { env, d1 } = makeEnv();
  const one = person(d1, NAME, FP1); person(d1, NAME, FP2);
  const r = await call(env, "DELETE", "/org/expected/" + one);
  assert.equal(r.status, 200, r.text);
  assert.equal(d1.get("SELECT target FROM org_audit_log WHERE action='expected_delete'").target, `${NAME} (${ELL}a3f9)`);
  const log = await call(env, "GET", "/org/audit-log");
  assert.ok(log.text.includes(`${NAME} (${ELL}a3f9)`), "shown in the Admin actions log");
});

test("check-in list and Last 7 days: each check-in carries the label of its own device key", async () => {
  const { env, d1 } = makeEnv();
  const e1 = person(d1, NAME, FP1); const e2 = person(d1, NAME, FP2);
  const ins = (id, fp, eid, at) => d1.exec(
    "INSERT INTO org_checkins (id,org_id,mode,name,device_key_fp,expected_id,checkin_at,created_at,status) VALUES (?,?,?,?,?,?,?,?,?)",
    id, "org-1", "attendee_scan", NAME, fp, eid, at, at, "checked_in");
  ins("ci-1", FP1, e1, T - 60); ins("ci-2", FP2, e2, T - 30); ins("ci-3", FP2, e2, T - 2 * 86400);
  for (const range of ["today", "7d"]) {
    const r = await call(env, "GET", "/org/attendance?range=" + range);
    assert.equal(r.status, 200, r.text);
    for (const c of r.data.checkins.filter(c => !c.expected_only)) {
      assert.equal(c.name, NAME, "stored name unchanged");
      assert.equal(c.name_label, `${NAME} (${ELL}${c.device_key_fp === FP1 ? "a3f9" : "7c21"})`, range + " " + c.id);
    }
  }
  // CSV of the Last 7 days (js/attendance-week.js) uses the label.
  const week = await call(env, "GET", "/org/attendance?range=7d");
  const ctx = {}; vm.runInNewContext(readFileSync(new URL("../../js/attendance-week.js", import.meta.url), "utf8"), ctx);
  const csv = ctx.IRLidAttendanceWeek.buildCsv(week.data.checkins);
  assert.ok(csv.includes(`${NAME} (${ELL}a3f9)`) && csv.includes(`${NAME} (${ELL}7c21)`), csv);
});

test("a check-in by name alone never guesses between two people with that name", async () => {
  const { env, d1 } = makeEnv();
  person(d1, NAME, FP1); person(d1, NAME, FP2);
  const body = await signedCheckinBody({ org: ORG_KEY, device: await newDevice(), name: NAME });
  const r = await call(env, "POST", "/org/checkin", { orgKey: ORG_KEY, body });
  assert.ok(r.status === 200 || r.status === 201, r.text);
  const row = d1.get("SELECT expected_id, status FROM org_checkins ORDER BY created_at DESC LIMIT 1");
  assert.equal(row.expected_id, null, "not linked to either Sam");
  assert.notEqual(row.status, "conflict", "and not flagged as a key clash with one of them");
});

test("with only one person of that name, a check-in by name still links as before", async () => {
  const { env, d1 } = makeEnv();
  const only = person(d1, "Alex Sample", null);
  const body = await signedCheckinBody({ org: ORG_KEY, device: await newDevice(), name: "Alex Sample" });
  const r = await call(env, "POST", "/org/checkin", { orgKey: ORG_KEY, body });
  assert.ok(r.status === 200 || r.status === 201, r.text);
  assert.equal(d1.get("SELECT expected_id FROM org_checkins LIMIT 1").expected_id, only);
});

test("a database that still has the old unique-name index refuses cleanly (409 duplicate), never a 500", async () => {
  const { env, d1 } = makeEnv({ oldIndex: true });
  assert.equal((await call(env, "POST", "/org/expected", { body: { display_name: NAME } })).status, 201);
  const second = await call(env, "POST", "/org/expected", { body: { display_name: NAME } });
  assert.equal(second.status, 409, second.text);
  assert.equal(second.data.error, "duplicate", "the dashboard's existing 'already on the list' message still shows");
  person(d1, NAME, FP2, T - 10);
  const arch = d1.get("SELECT id FROM org_expected WHERE archived_at IS NOT NULL").id;
  const restore = await call(env, "POST", `/org/expected/${arch}/restore`);
  assert.equal(restore.status, 409);
  assert.equal(d1.get("SELECT COUNT(*) AS n FROM org_audit_log WHERE action='expected_restore'").n, 0);
});

test("the attendee picker (no sign-in) is unchanged: no labels, no key tags", async () => {
  const { env, d1 } = makeEnv();
  person(d1, NAME, FP1); person(d1, NAME, FP2);
  const r = await call(env, "GET", "/org/expected", { auth: false, orgKey: undefined });
  // slug-level call: only X-Org-Id, no session
  const res = await worker.fetch(new Request("https://worker.test/org/expected", { headers: { "X-Org-Id": "org-1" } }), env, { waitUntil() {} });
  const text = await res.text();
  assert.equal(res.status, 200);
  assert.ok(!/name_label|a3f9|7c21/.test(text), text);
  assert.ok(r.status >= 400 || !/name_label/.test(r.text));
});

test("dashboard shows name_label for staff wherever names appear, but an attendee view never does", () => {
  const html = readFileSync(new URL("../../Org.html", import.meta.url), "utf8");
  // expected list, check-in list, Last 7 days / receipts history, Restore list, event picker
  assert.match(html, /if \(viewingAs !== 'attendee' && row && row\.name_label\) return row\.name_label;/);
  assert.match(html, /viewingAs !== 'attendee' && r\.name_label \? r\.name_label : nameForViewer\(rawLabel, viewingAs\)/);
  assert.match(html, /const n = \(row\.name_label \|\| row\.name \|\| row\.attendee_label/);
  assert.match(html, /escapeHtml\(r\.name_label \|\| r\.display_name \|\| ''\)/);
  assert.match(html, /htmlEscape\(p\.label \|\| p\.name\)/);
  // a checked-in person hides only their own expected row (by id), not a namesake
  assert.match(html, /attendanceExpectedIds\.has\(String\(row\.id\)\)/);
  // the label is display only: nothing posts it back as a name
  assert.ok(!/display_name:\s*[^,}]*name_label/.test(html));
});
