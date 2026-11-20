// Every POST /org/settings needs a Lead Admin or Developer login session
// (Spencer, 20 Nov 2026). Before that only the governed fields
// (manager_perms, requireLiveCode, lockFullscreen, kioskMode) were role
// checked, so a staff session, or the org key alone, could change the theme,
// the redirect link after check-in, terms and welcome text. The dashboard
// already shows Settings to Lead Admins and Developers only.
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { SqliteD1 } from "./helpers/sqlite-d1.mjs";

const ORG_KEY = "org_settings_role_key_1234567890ab";
const DEV_FP = "fp-bootstrap-developer";

function setup() {
  const d1 = new SqliteD1();
  d1.db.prepare("INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES (?,?,?,?,?,0,0)")
    .run("org-1", "Role Hall", "role-hall", ORG_KEY, JSON.stringify({ redirectUrl: "https://role.example/welcome" }));
  d1.db.prepare("INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES (?,?,?,?,?,0,0)")
    .run("org-2", "Other Hall", "other-hall", "org_other_key_1234567890abcdef", "{}");
  const t = Math.floor(Date.now() / 1000);
  const tokens = {};
  for (const [id, role, org, fp] of [
    ["lead-1", "lead_admin", "org-1"], ["dev-1", "developer", "org-1"], ["dev-boot", null, null, DEV_FP],
    ["manager-1", "manager", "org-1"], ["staff-1", "staff", "org-1"], ["attendee-1", "attendee", "org-1"],
    ["lead-other", "lead_admin", "org-2"]
  ]) {
    d1.db.prepare("INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES (?,?,?,?,0,0)").run(id, "{}", fp || "fp-" + id, id);
    if (role) d1.db.prepare("INSERT INTO org_memberships (org_id,user_id,role,granted_at) VALUES (?,?,?,0)").run(org, id, role);
    const token = "sess_" + id + "_abcdefghijklmnop";
    d1.db.prepare("INSERT INTO login_sessions (token,user_id,issued_at,expires_at) VALUES (?,?,?,?)").run(token, id, t, t + 3600);
    tokens[id] = token;
  }
  return { d1, tokens, settings: () => JSON.parse(d1.db.prepare("SELECT settings_json FROM organisations WHERE id='org-1'").get().settings_json) };
}

async function save(d1, body, { session, orgKey } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (orgKey) headers["X-Org-Key"] = orgKey; else headers["X-Org-Id"] = "org-1";
  if (session) headers.Authorization = "Bearer " + session;
  const res = await worker.fetch(new Request("https://worker.test/org/settings", {
    method: "POST", headers, body: JSON.stringify(body)
  }), { DB: d1, CORS_ORIGIN: "*", BOOTSTRAP_DEVELOPER_FP: DEV_FP });
  return { status: res.status, body: await res.json() };
}

// The settings a staff member could change before, and the harm.
const UNGOVERNED = {
  redirectUrl: "https://phish.example/login",      // attendees sent to another site after check-in
  staffRedirectUrl: "https://phish.example/staff",
  theme: { primary: "#B91C1C" },
  welcomeMessage: "Changed",
  orgTerms: "Changed terms",
  logoUrl: "https://phish.example/logo.png",
  minScore: 10
};

for (const who of ["staff-1", "manager-1", "attendee-1"]) {
  for (const [field, value] of Object.entries(UNGOVERNED)) {
    test(`${who.split("-")[0]} cannot change ${field}`, async () => {
      const ctx = setup();
      const before = ctx.settings();
      const res = await save(ctx.d1, { [field]: value }, { session: ctx.tokens[who] });
      assert.equal(res.status, 403, JSON.stringify(res.body));
      assert.ok(["insufficient_role", "not_a_member"].includes(res.body.error), res.body.error);
      assert.deepEqual(ctx.settings(), before, "nothing saved");
    });
  }
}

test("the org key alone cannot change settings", async () => {
  const ctx = setup();
  const res = await save(ctx.d1, UNGOVERNED, { orgKey: ORG_KEY });
  assert.equal(res.status, 403, JSON.stringify(res.body));
  assert.equal(ctx.settings().redirectUrl, "https://role.example/welcome");
});

test("a Lead Admin of another organisation cannot change this one's settings", async () => {
  const ctx = setup();
  const res = await save(ctx.d1, { redirectUrl: "https://phish.example/" }, { session: ctx.tokens["lead-other"] });
  assert.ok(res.status === 403 || res.status === 401, String(res.status));
  assert.equal(ctx.settings().redirectUrl, "https://role.example/welcome");
});

for (const who of ["lead-1", "dev-1", "dev-boot"]) {
  test(`${who} can change every one of those settings, and it is audited`, async () => {
    const ctx = setup();
    const res = await save(ctx.d1, UNGOVERNED, { session: ctx.tokens[who] });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const saved = ctx.settings();
    for (const [k, v] of Object.entries(UNGOVERNED)) assert.deepEqual(saved[k], v, k);
    const row = ctx.d1.db.prepare("SELECT actor_user_id, outcome FROM org_audit_log WHERE action='settings_save'").get();
    assert.equal(row.actor_user_id, who);
    assert.equal(row.outcome, "allowed");
  });
}

test("the dashboard still keeps Settings for Lead Admins and up", async () => {
  const { readFileSync } = await import("node:fs");
  const html = readFileSync(new URL("../../Org.html", import.meta.url), "utf8");
  assert.match(html, /id="navSettings" data-min-role="lead_admin"/);
});
