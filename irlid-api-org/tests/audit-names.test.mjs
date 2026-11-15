// v6.8.15: the admin actions log names the real person on every row, never a
// bare role word like "staff" (Developer is fine, it is the super-admin).
// Rule R5 still holds: the log is append-only, and reading it never writes.
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { SqliteD1 } from "./helpers/sqlite-d1.mjs";

const T = Math.floor(Date.now() / 1000);
const ORG_KEY = "org_audit_names_key_1234567890";
const LEAD_TOKEN = "session_token_for_lead_admin_0001";

function setup() {
  const d1 = new SqliteD1();
  d1.exec("INSERT INTO organisations (id,name,slug,api_key,created_at,updated_at) VALUES ('org-1','Org One','one',?,0,0)", ORG_KEY);
  const user = (id, fp, name) => d1.exec("INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES (?,'{}',?,?,0,0)", id, fp, name);
  user("u-lead", "fp-lead-0001", "Lena Lead");
  user("u-staffy", "fp-staffy-01", "staff");          // a user whose name is a bare role word
  user("u-ann", "fp-ann-0001", "Ann Archer");
  d1.exec("INSERT INTO login_sessions (token,user_id,issued_at,expires_at) VALUES (?,?,?,?)", LEAD_TOKEN, "u-lead", T, T + 3600);
  d1.exec("INSERT INTO org_memberships (user_id,org_id,role,granted_at) VALUES ('u-lead','org-1','lead_admin',0)");
  // Roster with the exact table the live Worker uses.
  d1.exec("DROP TABLE org_expected");
  d1.exec("CREATE TABLE org_expected (id INTEGER PRIMARY KEY AUTOINCREMENT, org_id TEXT NOT NULL, display_name TEXT, device_pub_fp TEXT, archived_at INTEGER)");
  d1.exec("INSERT INTO org_expected (org_id,display_name,device_pub_fp) VALUES ('org-1','Rosa Roster','fp-rosa-0001')");
  return d1;
}

async function readLog(d1) {
  const res = await worker.fetch(new Request("https://worker.test/org/audit-log?limit=200", {
    headers: { "X-Org-Id": "org-1", Authorization: "Bearer " + LEAD_TOKEN }
  }), { DB: d1, CORS_ORIGIN: "*" });
  return { status: res.status, body: await res.json() };
}

let seq = 0;
function addRow(d1, f) {
  seq += 1;
  d1.exec(
    "INSERT INTO org_audit_log (id,org_id,actor_user_id,actor_pub_fp,actor_display_name,actor_role,action,target,outcome,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    "a" + seq, "org-1", f.user || null, f.fp || null, f.name ?? null, f.role || null, f.action || "settings_save", f.target || "x", "allowed", T - 1000 + seq
  );
}

test("a stored real name is shown as is", async () => {
  const d1 = setup();
  await readLog(d1); // creates the audit table the way the Worker does
  addRow(d1, { name: "Bob Builder", role: "staff", fp: "fp-bob" });
  const { status, body } = await readLog(d1);
  assert.equal(status, 200);
  assert.equal(body.entries[0].actor_name, "Bob Builder");
});

test("a row saved with no name, or just 'staff', still shows the person (account name)", async () => {
  const d1 = setup();
  await readLog(d1);
  addRow(d1, { user: "u-ann", name: null, role: "staff", fp: "fp-ann-0001" });
  addRow(d1, { user: "u-ann", name: "staff", role: "staff", fp: "fp-ann-0001" });
  addRow(d1, { name: "Manager", role: "manager", fp: "fp-ann-0001" }); // found by the key's account
  const { body } = await readLog(d1);
  assert.deepEqual(body.entries.map(e => e.actor_name), ["Ann Archer", "Ann Archer", "Ann Archer"]);
});

test("with no account, the roster name for that device key is used", async () => {
  const d1 = setup();
  await readLog(d1);
  addRow(d1, { name: "staff", role: "staff", fp: "fp-rosa-0001" });
  const { body } = await readLog(d1);
  assert.equal(body.entries[0].actor_name, "Rosa Roster");
});

test("a row nobody can be named for says 'Unnamed <role> (key ...)', never just 'staff'", async () => {
  const d1 = setup();
  await readLog(d1);
  addRow(d1, { name: "staff", role: "staff", fp: "fp-mystery-0001" });
  addRow(d1, { name: null, role: "manager", fp: null });
  const { body } = await readLog(d1);
  const names = body.entries.map(e => e.actor_name).sort();
  assert.ok(names.includes("Unnamed manager"));
  assert.ok(names.some(n => /^Unnamed staff \(key mystery-\)$/.test(n)), names.join("|"));
  for (const e of body.entries) {
    assert.ok(!/^(staff|manager|lead admin|admin|attendee)$/i.test(e.actor_name), "bare role word: " + e.actor_name);
  }
});

test("the Developer super-admin may show as Developer", async () => {
  const d1 = setup();
  await readLog(d1);
  addRow(d1, { name: "Developer (Super-Admin)", role: "developer" });
  addRow(d1, { name: "developer", role: "developer", fp: "fp-dev-0001" });
  const { body } = await readLog(d1);
  for (const e of body.entries) assert.equal(e.actor_name, "Developer (Super-Admin)");
});

test("the log stays append-only and reading it writes nothing (R5)", async () => {
  const d1 = setup();
  await readLog(d1);
  addRow(d1, { name: "Bob Builder", role: "staff" });
  const before = d1.get("SELECT COUNT(*) AS n FROM org_audit_log").n;
  await readLog(d1);
  assert.equal(d1.get("SELECT COUNT(*) AS n FROM org_audit_log").n, before);
  assert.throws(() => d1.exec("UPDATE org_audit_log SET actor_display_name='x'"), /immutable/);
  assert.throws(() => d1.exec("DELETE FROM org_audit_log"), /immutable/);
});

test("a settings save by the org key is recorded under a name, not blank", async () => {
  const d1 = setup();
  const res = await worker.fetch(new Request("https://worker.test/org/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Org-Key": ORG_KEY, Authorization: "Bearer " + ORG_KEY },
    body: JSON.stringify({ welcomeMessage: "Hello" })
  }), { DB: d1, CORS_ORIGIN: "*" });
  assert.equal(res.status, 200);
  const row = d1.get("SELECT actor_display_name, actor_role FROM org_audit_log WHERE action='settings_save'");
  assert.equal(row.actor_display_name, "Service account (api_key)");
  assert.notEqual(row.actor_role, "developer", "an org-key save is not claimed as a person");
});

test("Org.html never shows a bare role when the Worker sends no name", async () => {
  const { readFileSync } = await import("node:fs");
  const html = readFileSync(new URL("../../Org.html", import.meta.url), "utf8");
  assert.match(html, /esc\(e\.actor_name \|\| \('Unnamed '/);
  assert.doesNotMatch(html, /esc\(e\.actor_name \|\| '—'\)/);
});
