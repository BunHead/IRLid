// Rule A1: Developer is the super admin. Anywhere a Lead Admin can act, a
// Developer can too, and the action is still audited (R5).
//
// Two halves:
//  1. Worker: a Developer session (a listed BOOTSTRAP_DEVELOPER_FP device with
//     no membership row, or a "developer" membership row) can change every
//     org setting a Lead Admin can, including the governed ones
//     (requireLiveCode, lockFullscreen, kioskMode, manager_perms), with no
//     org key, and each save writes an audit row naming the Developer.
//  2. Org.html: every setting the dashboard saves to the server has its
//     control in a visible Settings tab, not in the hidden legacy shell
//     (display: none), where no role could reach it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import worker from "../src/index.js";

const SCHEMA = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
const ORG_KEY = "org_dev_every_setting_key_1234567890";

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
    this.db.exec(SCHEMA);
    this.db.prepare("INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES (?,?,?,?,?,0,0)")
      .run("org-1", "Imbue Test", "imbue-test", ORG_KEY, "{}");
  }
  prepare(sql) { return new D1Statement(this.db, sql); }
  async batch(statements) { const out = []; for (const s of statements) out.push(await s.run()); return out; }
  settings() { return JSON.parse(this.db.prepare("SELECT settings_json FROM organisations WHERE id='org-1'").get().settings_json); }
  audit() { return this.db.prepare("SELECT * FROM org_audit_log WHERE org_id='org-1' ORDER BY created_at").all(); }
}

function addUser(d1, id, fp, role) {
  d1.db.prepare("INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES (?,?,?,?,0,0)")
    .run(id, "{}", fp, id);
  if (role) d1.db.prepare("INSERT INTO org_memberships (org_id,user_id,role,granted_at) VALUES (?,?,?,0)").run("org-1", id, role);
  const token = "sess_" + id + "_abcdefghijklmnop";
  const t = Math.floor(Date.now() / 1000);
  d1.db.prepare("INSERT INTO login_sessions (token,user_id,issued_at,expires_at) VALUES (?,?,?,?)").run(token, id, t, t + 3600);
  return token;
}

const DEV_FP = "fp-bootstrap-developer";
async function call(d1, method, path, body, session) {
  const headers = { "Content-Type": "application/json", "X-Org-Id": "org-1" };
  if (session) headers.Authorization = "Bearer " + session;
  const res = await worker.fetch(new Request("https://worker.test" + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  }), { DB: d1, CORS_ORIGIN: "*", BOOTSTRAP_DEVELOPER_FP: DEV_FP });
  return { status: res.status, body: await res.json() };
}

function setup() {
  const d1 = new D1();
  return {
    d1,
    bootstrapDev: addUser(d1, "dev-bootstrap", DEV_FP, null),    // no membership row at all
    memberDev: addUser(d1, "dev-member", "fp-member-dev", "developer"),
    lead: addUser(d1, "lead-1", "fp-lead", "lead_admin"),
    manager: addUser(d1, "manager-1", "fp-manager", "manager"),
    staff: addUser(d1, "staff-1", "fp-staff", "staff")
  };
}

// Every setting a Lead Admin can change from the dashboard, flipped from its
// default so each one is a real change.
const EVERY_SETTING = {
  requireLiveCode: true,
  lockFullscreen: true,
  kioskMode: true,
  manager_perms: { calendar: true },
  minScore: 35,
  privacyMode: false,
  anonymousMode: true,
  returnAllowed: false,
  allowSelfSelection: false,
  requireDoormanConfirmation: true,
  bioRequired: true,
  checkoutEnabled: false,
  websiteUrl: "https://imbue.example",
  orgTerms: "House rules apply.",
  welcomeMessage: "Hello",
  redirectUrl: "https://imbue.example/welcome",
  staffRedirectUrl: "https://imbue.example/staff",
  contactEmail: "door@imbue.example",
  contactPhone: "0100 000000",
  venueAddress: "1 High Street"
};

for (const who of ["bootstrapDev", "memberDev", "lead"]) {
  test(`${who} can change every setting with a login session alone, and it is audited`, async () => {
    const ctx = setup();
    const res = await call(ctx.d1, "POST", "/org/settings", EVERY_SETTING, ctx[who]);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const saved = ctx.d1.settings();
    for (const [k, v] of Object.entries(EVERY_SETTING)) {
      assert.deepEqual(saved[k], v, k);
    }
    const rows = ctx.d1.audit().filter(r => r.action === "settings_save");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].outcome, "allowed");
    assert.equal(rows[0].actor_user_id, who === "bootstrapDev" ? "dev-bootstrap" : who === "memberDev" ? "dev-member" : "lead-1");
    assert.equal(rows[0].actor_role, who === "lead" ? "lead_admin" : "developer");
  });
}

for (const field of ["requireLiveCode", "lockFullscreen", "kioskMode", "manager_perms"]) {
  test(`governed setting ${field}: Developer and Lead Admin yes, manager and staff no`, async () => {
    const ctx = setup();
    const value = EVERY_SETTING[field];
    for (const who of ["manager", "staff"]) {
      const res = await call(ctx.d1, "POST", "/org/settings", { [field]: value }, ctx[who]);
      assert.equal(res.status, 403, who + " " + JSON.stringify(res.body));
      assert.equal(ctx.d1.settings()[field], undefined);
    }
    for (const who of ["bootstrapDev", "memberDev"]) {
      const fresh = setup();
      const res = await call(fresh.d1, "POST", "/org/settings", { [field]: value }, fresh[who]);
      assert.equal(res.status, 200, who + " " + JSON.stringify(res.body));
      assert.deepEqual(fresh.d1.settings()[field], value);
    }
  });
}

test("Developer reaches the Lead Admin pages: staff list and audit log", async () => {
  const ctx = setup();
  for (const who of ["bootstrapDev", "memberDev", "lead"]) {
    assert.equal((await call(ctx.d1, "GET", "/org/members?org_id=org-1", null, ctx[who])).status, 200, "members " + who);
    assert.equal((await call(ctx.d1, "GET", "/org/audit-log?org_id=org-1", null, ctx[who])).status, 200, "audit " + who);
  }
});

// ---- Org.html: every saved setting is reachable ----

const html = readFileSync(new URL("../../Org.html", import.meta.url), "utf8");

function hiddenShell() {
  const start = html.indexOf('<div class="settings-shell" style="display: none;">');
  assert.ok(start > 0, "legacy shell marker moved; update this test");
  let depth = 0;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = start;
  let m;
  while ((m = re.exec(html))) {
    depth += m[0] === "</div>" ? -1 : 1;
    if (depth === 0) return [start, re.lastIndex];
  }
  throw new Error("unclosed shell");
}

function visibleSettings() {
  const start = html.indexOf('<div class="panel" id="panel-settings">');
  const [shellStart] = hiddenShell();
  return html.slice(start, shellStart);
}

// Controls left in the hidden shell on purpose. Each one is either not a real
// setting, has a visible replacement that owns the saved value, or does
// nothing yet (rule I2: hide placeholders). Adding to this list needs a reason.
const STILL_HIDDEN_ON_PURPOSE = new Set([
  "logoUrl",            // Visual Theming's logo field owns it (copied in on save).
  "redirectUrl", "staffRedirectUrl", "welcomeMessage" // Visual Theming per-mode fields own these.
]);

test("Org.html: every setting saveSettings() sends lives in a visible Settings tab", () => {
  const fnStart = html.indexOf("async function saveSettings()");
  assert.ok(fnStart > 0);
  const fnBody = html.slice(fnStart, html.indexOf("\n}\n", fnStart));
  const ids = [...new Set([...fnBody.matchAll(/getElementById\('([A-Za-z0-9_]+)'\)/g)].map(m => m[1]))];
  assert.ok(ids.length >= 10, "expected saveSettings to read many fields, got " + ids.length);
  const [a, b] = hiddenShell();
  const shell = html.slice(a, b);
  const visible = visibleSettings();
  for (const id of ids) {
    if (STILL_HIDDEN_ON_PURPOSE.has(id)) continue;
    const tag = new RegExp(`<(input|select|textarea)[^>]*\\bid="${id}"`);
    assert.doesNotMatch(shell, tag, id + " is only in the hidden legacy settings shell");
    assert.match(visible, tag, id + " is not in a visible Settings tab");
  }
});

test("Org.html: the check-in rules sit in the visible Sign-in & Auth tab, ids unique", () => {
  const visible = visibleSettings();
  for (const id of ["minimumTrustScore", "privacyMode", "anonymousMode", "returnAllowed", "allowSelfSelection",
                    "requireDoormanConfirmation", "kioskMode", "lockFullscreen", "requireLiveCode", "websiteUrl", "orgTerms"]) {
    assert.equal(html.split(`id="${id}"`).length - 1, 1, id + " must appear exactly once");
    assert.ok(visible.includes(`id="${id}"`), id);
  }
  const group = visible.slice(visible.indexOf('id="checkinRulesGroup"'), visible.indexOf('id="v511AuthSaveBtn"'));
  assert.ok(group.includes('id="privacyMode"') && group.includes('id="kioskMode"'));
  // Website and terms are the server fields now, not a localStorage-only copy.
  assert.doesNotMatch(html, /v511OrgWebsite|v511OrgTerms/);
});

test("Org.html: role gates rank Developer at or above Lead Admin everywhere", () => {
  assert.match(html, /const PROTOTYPE_ROLE_RANK = \{ attendee: 0, staff: 1, manager: 2, lead_admin: 3, developer: 4 \};/);
  assert.match(html, /function canUseSettings\(\) \{\s*return effectiveRoleRank\(\) >= PROTOTYPE_ROLE_RANK\.lead_admin;/);
  assert.match(html, /el\.hidden = rank < roleRankFor\(el\.dataset\.minRole\);/);
  // No page check lets lead_admin in but leaves developer out.
  for (const m of html.matchAll(/[^\n]*role === 'lead_admin'[^\n]*/g)) {
    assert.match(m[0], /developer/, "lead_admin-only check: " + m[0].trim().slice(0, 120));
  }
});

test("Worker: every lead_admin role check also lets developer in", () => {
  const src = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  for (const m of src.matchAll(/[^\n]*role !== "lead_admin"[^\n]*/g)) {
    assert.match(m[0], /developer/, "lead_admin-only gate: " + m[0].trim());
  }
  for (const m of src.matchAll(/[^\n]*role === "lead_admin" \|\|[^\n]*/g)) {
    assert.match(m[0], /developer/, "lead_admin-only gate: " + m[0].trim());
  }
  assert.match(src, /const KIOSK_CODE_ROLES = new Set\(\["lead_admin", "developer"\]\);/);
  assert.match(src, /const EXPECTED_ROLE_RANK = \{ attendee: 0, staff: 1, manager: 2, lead_admin: 3, developer: 4 \};/);
});

// Spencer, 7 Nov: un-hide anything connected to something and put it in
// Tools & Diagnostics. Settings that do nothing yet are shown there, labelled
// "not active yet" so nobody thinks they work (I1, I2).
function toolsTab() {
  const a = html.indexOf('<section class="v511-panel" data-v511-panel="tools">');
  return html.slice(a, html.indexOf("</section>", a));
}

test("Org.html: placeholders are in Tools & Diagnostics, labelled not active yet", () => {
  const tools = toolsTab();
  const group = tools.slice(tools.indexOf('id="notActiveYetGroup"'), tools.indexOf('id="testToolsGroup"'));
  for (const id of ["biometricRequired", "checkoutRequired", "themeScrapeBtn"]) {
    assert.equal(html.split(`id="${id}"`).length - 1, 1, id + " must appear exactly once");
    const at = group.indexOf(`id="${id}"`);
    assert.ok(at > 0, id + " not in the Not active yet group");
  }
  assert.equal((group.match(/not active yet<\/span>/g) || []).length, 3);
  assert.doesNotMatch(html.slice(...hiddenShell()), /id="(biometricRequired|checkoutRequired|themeScrapeBtn)"/);
});

test("Org.html: test tools (outcome previews, org and event code, copy links) are in Tools & Diagnostics", () => {
  const tools = toolsTab();
  const group = tools.slice(tools.indexOf('id="testToolsGroup"'));
  for (const id of ["orgCode", "eventCode", "outcomeQr", "copyOutcomeMiniBtn", "testFireOutcomeBtn",
                    "copyOutcomeUrlBtn", "copySettingsBtn", "copyScanUrlBtn", "scanQr"]) {
    assert.ok(group.includes(`id="${id}"`), id);
  }
});

test("Org.html: the hidden legacy shell holds only controls a visible tab already owns", () => {
  const shell = html.slice(...hiddenShell());
  const owned = /^(theme|celeb|roleLabel)|^(logoUrl|redirectUrl|staffRedirectUrl|welcomeMessage|inviteStaffBtn|leadAdminAppointBtn|savePortalSettingsBtn|resetPortalSettingsBtn)$/;
  const ids = [...shell.matchAll(/<(?:input|select|textarea|button)\b[^>]*\bid="([^"]+)"/g)].map(m => m[1]);
  for (const id of ids) assert.match(id, owned, id + " is stuck in the hidden shell");
});
