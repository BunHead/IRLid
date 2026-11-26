// Closes two gaps from docs/rule-test-map.md (rule W3: every S, C, R and A
// rule gets a test).
//   R6  Auto check-out is marked "auto" and has no trust score.
//       (and R1: check-out fields are filled once and never changed)
//   A2  Role names in the database never change, only labels. Developer can't
//       be handed out.
// Runs the Worker's real SQL. Made-up names only.
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { T, setup, person } from "./helpers/csv-import.mjs";
import { eventScheduleAt } from "./helpers/signed-checkin.mjs";

// Local helpers (kept here so this file does not depend on other open PRs).
const b64u = (bytes) => Buffer.from(bytes).toString("base64url");
function canonical(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
}
const sha256 = async (b) => new Uint8Array(await crypto.subtle.digest("SHA-256", b));
// A signed v5 calendar action by the Lead Admin's phone (setup() made it).
async function calendarAction(ctx, extra = {}) {
  const payload = { type: "irlid_calendar_write_v5", org_id: "org-1", nonce: "nonce_" + crypto.randomUUID().replace(/-/g, ""), timestamp: Date.now(), ...extra };
  const challenge = b64u(await sha256(new TextEncoder().encode(canonical(payload))));
  const clientData = new TextEncoder().encode(JSON.stringify({ type: "webauthn.get", challenge, origin: "https://irlid.co.uk" }));
  const authData = new Uint8Array(37); authData[32] = 0x05;
  const signed = new Uint8Array(69); signed.set(authData, 0); signed.set(await sha256(clientData), 37);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, ctx.lead.kp.privateKey, signed));
  return { payload, pub: ctx.lead.pub, sig: b64u(sig), webauthn: { authData: b64u(authData), clientData: b64u(clientData) } };
}
async function callAs(ctx, method, path, body) {
  const res = await worker.fetch(new Request("https://worker.test" + path, {
    method,
    headers: { "Content-Type": "application/json", "X-Org-Id": "org-1", Authorization: "Bearer sess_csv_lead_abcdefghijklmnop" },
    body: method === "GET" ? undefined : JSON.stringify(body || {})
  }), ctx.env, { waitUntil() {} });
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch (_) {}
  return { status: res.status, data, text };
}

// An event that started 200 min ago and ran 30 min; grace 60 min, so auto
// check-out time is 110 min ago, well in the past.
async function autoCheckoutOrg({ autoCheckout = true } = {}) {
  const ctx = await setup();
  ctx.d1.exec("UPDATE organisations SET settings_json=? WHERE id='org-1'",
    JSON.stringify({ calendar_defaults: { auto_checkout: autoCheckout, checkout_grace: 60 } }));
  const at = eventScheduleAt(-200);
  ctx.d1.exec("INSERT INTO weekly_events (id,org_id,room_id,name,day_of_week,start_time_local,duration_min,created_at) VALUES ('ev-1','org-1','room-1','Yoga',?,?,30,0)", at.day_of_week, at.start_time_local);
  ctx.d1.exec("INSERT INTO org_checkins (id,org_id,mode,name,device_key_fp,checkin_at,created_at,status,event_id,score,assurance) VALUES ('ci-1','org-1','attendee_scan','Alex Sample','fpAlex000000beef',?,?,'checked_in','ev-1',70,'fresh')", T - 190 * 60, T - 190 * 60);
  const startedAt = Math.floor((Date.now() - 200 * 60000) / 60000) * 60;   // event start, to the minute
  return { ctx, expectedCheckoutAt: startedAt + 30 * 60 + 60 * 60 };
}
const row = (d1) => d1.get("SELECT * FROM org_checkins WHERE id='ci-1'");
// The Worker runs auto check-out at most once per few minutes per organisation
// (autoCheckoutLastRunByOrg). Every test here uses the same org id, so each
// run moves the clock on past that throttle; otherwise a later test would be
// skipped silently and pass without checking anything.
const realNow = Date.now;
let clockShiftMs = 0;
async function attendance(ctx) {
  clockShiftMs += 2 * 60 * 1000;   // past the 60 s throttle, well inside the 1 h test session
  Date.now = () => realNow() + clockShiftMs;
  try { return await callAs(ctx, "GET", "/org/attendance?range=7d", null); }
  finally { Date.now = realNow; }
}

test("R6: an auto check-out is marked 'auto', at the event end plus grace, and adds no trust score or signature", async () => {
  const { ctx, expectedCheckoutAt } = await autoCheckoutOrg();
  const r = await attendance(ctx);
  assert.equal(r.status, 200, r.text);
  const c = row(ctx.d1);
  assert.notEqual(c.checkout_at, null, "the auto check-out ran");
  assert.equal(c.checkout_method, "auto");
  assert.ok(Math.abs(c.checkout_at - expectedCheckoutAt) <= 60, "checked out at end + grace, not 'now': " + (c.checkout_at - expectedCheckoutAt));
  assert.ok(c.checkout_at < T - 100 * 60);
  assert.equal(c.checkout_signature, null, "nobody signed it");
  assert.equal(c.checkout_payload_hash, null);
  assert.equal(c.score, 70, "the check-in's own score is untouched; the auto check-out adds none");
  assert.equal(c.assurance, "fresh", "and it does not change how the check-in was proven");
  const shown = r.data.checkins.find(x => x.id === "ci-1");
  assert.equal(shown.checkout_method, "auto", "the dashboard is told it was automatic");
});

test("R6: with auto check-out off nothing is checked out", async () => {
  const { ctx } = await autoCheckoutOrg({ autoCheckout: false });
  const r = await attendance(ctx);
  assert.equal(r.status, 200, "the attendance call itself worked: " + r.text);
  assert.equal(row(ctx.d1).checkout_at, null);
});

test("R1: check-out fields are filled once and never changed afterwards", async () => {
  const { ctx } = await autoCheckoutOrg();
  assert.equal((await attendance(ctx)).status, 200);
  const first = row(ctx.d1);
  assert.equal(first.checkout_method, "auto", "the first run checked out");
  // a longer grace later must not move a check-out that already happened
  ctx.d1.exec("UPDATE organisations SET settings_json=? WHERE id='org-1'", JSON.stringify({ calendar_defaults: { auto_checkout: true, checkout_grace: 5 } }));
  for (let i = 0; i < 2; i++) assert.equal((await attendance(ctx)).status, 200, "later run " + (i + 1) + " really ran");
  const later = row(ctx.d1);
  assert.equal(later.checkout_at, first.checkout_at);
  assert.equal(later.duration_s, first.duration_s);
  assert.equal(later.checkout_method, "auto");
});

// ---- A2 ----
test("A2: an invite can never hand out the Developer role (or Lead Admin)", async () => {
  const ctx = await setup();
  for (const role of ["developer", "lead_admin"]) {
    const r = await callAs(ctx, "POST", "/org/invites/create", { org_id: "org-1", role });
    assert.equal(r.status, 400, role + ": " + r.text);
    assert.equal(r.data.error, "lead_admin_invite_deferred");
  }
  assert.equal(ctx.d1.get("SELECT COUNT(*) AS n FROM org_invites").n, 0, "no invite was stored");
});

test("A2: adding a person from the dashboard always makes an attendee, whatever role is sent", async () => {
  const ctx = await setup();
  for (const role of ["developer", "lead_admin", "staff"]) {
    const r = await callAs(ctx, "POST", "/org/expected", { display_name: "Alex " + role, role_key: role });
    assert.equal(r.status, 201, r.text);
    assert.equal(ctx.d1.get("SELECT role_key FROM org_expected WHERE id=?", r.data.expected_id).role_key, "attendee", role);
  }
});

test("A2: editing a person to Developer is refused, and nothing changes", async () => {
  const ctx = await setup();
  const id = person(ctx.d1, "Alex Sample", null);
  const r = await callAs(ctx, "PATCH", "/org/expected/" + id, { role_key: "developer", signed_action: await calendarAction(ctx, { expected_id: id }) });
  assert.equal(r.status, 403, r.text);
  assert.match(r.data.error, /developer role cannot be granted/);
  assert.equal(ctx.d1.get("SELECT COALESCE(role_key,'attendee') AS r FROM org_expected WHERE id=?", id).r, "attendee");
});

test("A2: role names are fixed; only their labels change", async () => {
  const ctx = await setup();
  ctx.d1.exec("INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES ('u-dev','{}','fp_dev_0000001','Dana Dev',0,0)");
  ctx.d1.exec("INSERT INTO org_memberships (org_id,user_id,role,granted_at) VALUES ('org-1','u-dev','developer',1)");
  // a label for Developer can be saved...
  const ok = await callAs(ctx, "POST", "/org/settings", { roleLabels: { developer: "Platform team", staff: "Volunteer" } });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ctx.d1.get("SELECT role FROM org_memberships WHERE user_id='u-dev'").role, "developer", "the stored role name never changes");
  // ...but a new role name cannot be invented
  const bad = await callAs(ctx, "POST", "/org/settings", { roleLabels: { super_admin: "Boss" } });
  assert.equal(bad.status, 400);
  assert.match(bad.data.error, /unknown key: super_admin/);
  // and the database itself only accepts the five role names
  assert.throws(() => ctx.d1.exec("INSERT INTO org_memberships (org_id,user_id,role,granted_at) VALUES ('org-1','u-dev2','super_admin',1)"), /CHECK constraint/);
});
