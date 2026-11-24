// Auth sweep (test plan 4.13, P1 "Auth"): every protected org route refuses a
// caller with no proof, and an IP address never decides access (S12).
//
// For each protected route, the call is made with:
//   - nothing at all
//   - a made-up session token, and a made-up org key
//   - an expired session
//   - a real session with one character changed
//   - a signed-in person who is not a member of the org, and an attendee-role
//     member (A5: attendees never reach the dashboard)
// and must be refused (401 or 403, never 5xx and never 2xx). A refused write
// must leave every table exactly as it was.
//
// S12: the same token from a different IP gets the same answer; a refused token
// is still refused when it arrives from the IP of a legitimate, signed-in user.
// Runs the Worker's real SQL on an in-memory SQLite (helpers/sqlite-d1.mjs).
// All names are made up.
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { SqliteD1 } from "./helpers/sqlite-d1.mjs";

const NOW = () => Math.floor(Date.now() / 1000);
const ORG = { id: "org-one", name: "Sweep Club", slug: "sweep-club", key: "org_sweep_key_1234567890abcdef" };

const TOK = {
  lead: "sess_lead_sweep_abcdefghijklmnop",
  attendee: "sess_attendee_sweep_abcdefghijkl",
  stranger: "sess_stranger_sweep_abcdefghijk",
  expired: "sess_expired_sweep_abcdefghijklm"
};
const TAMPERED = TOK.lead.slice(0, -1) + (TOK.lead.endsWith("p") ? "q" : "p");

const SCHEMA_EXTRA = `
  DROP TABLE org_expected;
  CREATE TABLE org_expected (id INTEGER PRIMARY KEY AUTOINCREMENT, org_id TEXT NOT NULL, display_name TEXT NOT NULL, initials TEXT,
    role_key TEXT DEFAULT 'attendee', device_pub_fp TEXT, email_hint TEXT, phone_hint TEXT, notes TEXT,
    created_at INTEGER NOT NULL, archived_at INTEGER);
  CREATE TABLE IF NOT EXISTS expected_device_keys (org_id TEXT, expected_id INTEGER, device_key_fp TEXT, revoked_at INTEGER);
  CREATE TABLE IF NOT EXISTS org_receipts (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, checkin_id TEXT, attendee_pub_fp TEXT,
    payload_json TEXT NOT NULL, signature TEXT NOT NULL, created_at INTEGER NOT NULL, privacy_mode INTEGER DEFAULT 1);
  CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, label TEXT, subname TEXT, capacity INTEGER,
    display_ix INTEGER DEFAULT 0, venue_qr_payload_hash TEXT, created_at INTEGER, archived_at INTEGER);
  CREATE TABLE IF NOT EXISTS event_expected (event_id TEXT NOT NULL, expected_id TEXT NOT NULL, added_at INTEGER NOT NULL, added_by TEXT, PRIMARY KEY (event_id, expected_id));
  CREATE TABLE IF NOT EXISTS weekly_events (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, room_id TEXT, name TEXT NOT NULL,
    day_of_week INTEGER NOT NULL, start_time_local TEXT NOT NULL, duration_min INTEGER NOT NULL, capacity INTEGER,
    color_hex TEXT, notes TEXT, require_proof INTEGER DEFAULT 0, late_grace_min INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL, archived_at INTEGER, checkin_mode TEXT DEFAULT 'standard');
`;

function makeEnv() {
  const d1 = new SqliteD1(SCHEMA_EXTRA);
  const t = NOW();
  d1.exec("INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES (?,?,?,?,'{}',?,?)",
    ORG.id, ORG.name, ORG.slug, ORG.key, 100, 100);
  const user = (id, fp) => d1.exec("INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES (?,?,?,?,0,0)", id, "{}", fp, id);
  user("u-lead", "fp_sweep_lead_0001"); user("u-attendee", "fp_sweep_attendee01"); user("u-stranger", "fp_sweep_stranger01"); user("u-expired", "fp_sweep_expired_01");
  d1.exec("INSERT INTO org_memberships (org_id,user_id,role,granted_at) VALUES (?,?,?,1)", ORG.id, "u-lead", "lead_admin");
  d1.exec("INSERT INTO org_memberships (org_id,user_id,role,granted_at) VALUES (?,?,?,1)", ORG.id, "u-attendee", "attendee");
  d1.exec("INSERT INTO org_memberships (org_id,user_id,role,granted_at) VALUES (?,?,?,1)", ORG.id, "u-expired", "lead_admin");
  const session = (token, userId, exp) => d1.exec("INSERT INTO login_sessions (token,user_id,issued_at,expires_at) VALUES (?,?,?,?)", token, userId, t - 100000, exp);
  session(TOK.lead, "u-lead", t + 3600);
  session(TOK.attendee, "u-attendee", t + 3600);
  session(TOK.stranger, "u-stranger", t + 3600);
  session(TOK.expired, "u-expired", t - 10);
  d1.exec("INSERT INTO org_expected (org_id,display_name,created_at) VALUES (?,?,?)", ORG.id, "Sam Sweep", t);
  d1.exec("INSERT INTO weekly_events (id,org_id,name,day_of_week,start_time_local,duration_min,created_at) VALUES (?,?,?,?,?,?,0)", "ev-one", ORG.id, "Sweep Class", 1, "10:00", 60);
  return { env: { DB: d1, CORS_ORIGIN: "*" }, d1 };
}

async function call(env, method, path, { token, orgId, orgKey, body, ip } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  if (orgId) headers["X-Org-Id"] = orgId;
  if (orgKey) headers["X-Org-Key"] = orgKey;
  if (ip) { headers["CF-Connecting-IP"] = ip; headers["X-Forwarded-For"] = ip; headers["X-Real-IP"] = ip; }
  const res = await worker.fetch(new Request("https://worker.test" + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  }), env, { waitUntil() {} });
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch (_) {}
  return { status: res.status, data, text };
}

// Everything that could be changed by a write, as one string.
const TABLES = ["organisations", "org_memberships", "org_expected", "weekly_events", "org_checkins", "org_receipts", "org_invites",
  "org_checkout_tokens", "org_checkin_nonces", "kiosk_code_keys", "kiosk_screens"];
const snapshot = (d1) => JSON.stringify(TABLES.map(t => [t, d1.all(`SELECT * FROM ${t} ORDER BY rowid`)]));

// Protected routes: a login session for a staff-tier member of the org, or the
// org key, is required. (Public, one-time-code and slug-level routes are listed
// as exempt in cross-org-sweep.test.mjs, with the reason for each.)
const PROTECTED = [
  ["GET", "/org/settings"], ["POST", "/org/settings", { welcomeMessage: "hi" }],
  ["GET", "/org/qr"], ["GET", "/org/members"], ["DELETE", "/org/members/u-lead"],
  ["GET", "/org/audit-log"], ["GET", "/org/attendance?range=7d"], ["GET", "/org/expected?archived=1"],
  ["POST", "/org/expected", { display_name: "Mallory Made-Up" }],
  ["POST", "/org/expected/create-and-bind", { display_name: "Mallory Made-Up", device_pub_fp: "fp_mallory_0000001" }],
  ["PATCH", "/org/expected/1", { display_name: "Renamed" }], ["DELETE", "/org/expected/1"], ["DELETE", "/org/expected/1/full"],
  ["POST", "/org/expected/1/restore"], ["POST", "/org/expected/1/rebind", { device_pub_fp: "fp_mallory_0000002" }],
  ["POST", "/org/expected/1/bind-additional-key", { device_pub_fp: "fp_mallory_0000003", device_pub_jwk: {} }],
  ["GET", "/org/rooms"], ["GET", "/org/weekly-events"], ["GET", "/org/weekly-events/export-csv"],
  ["POST", "/org/weekly-events", { name: "Made Up", day_of_week: 2, start_time_local: "09:00", duration_min: 30 }],
  ["PATCH", "/org/weekly-events/ev-one", { name: "Renamed" }], ["DELETE", "/org/weekly-events/ev-one"],
  ["POST", "/org/weekly-events/import-csv", { csv: "name,day\nx,1" }],
  ["GET", "/org/checkin-quarantine"], ["GET", "/org/invites/pending"],
  ["POST", "/org/invites/create", { org_id: "org-one", role: "staff" }], ["POST", "/org/invites/revoke", { org_id: "org-one", nonce: "n" }],
  ["POST", "/org/checkin-nonce", {}], ["POST", "/org/checkout-token", { checkin_id: "ci" }],
  ["POST", "/org/debug/clear-attendance", { confirm: true }],
  ["POST", "/org/ws-ticket", {}], ["GET", "/org/current-event"],
  ["POST", "/org/conflicts/1/resolve", { resolution: "rejected" }]
];

const refused = (res) => res.status === 401 || res.status === 403;
const label = (c) => `${c[0]} ${c[1]}`;

for (const c of PROTECTED) {
  const [method, path, body] = c;
  test(`${label(c)}: refused with no proof, a made-up token or key, an expired, tampered, stranger or attendee session, and nothing changes`, async () => {
    const { env, d1 } = makeEnv();
    const before = snapshot(d1);
    const attempts = {
      "no credentials": {},
      "no credentials, org named": { orgId: ORG.id },
      "made-up session": { token: "sess_made_up_abcdefghijklmnopqrstu", orgId: ORG.id },
      "made-up org key": { orgKey: "org_made_up_key_1234567890abcdefgh" },
      "made-up org key as Bearer": { token: "org_made_up_key_1234567890abcdefgh" },
      "expired session": { token: TOK.expired, orgId: ORG.id },
      "tampered session": { token: TAMPERED, orgId: ORG.id },
      "signed in, not a member": { token: TOK.stranger, orgId: ORG.id },
      "attendee-role member": { token: TOK.attendee, orgId: ORG.id },
      "session with no org named": { token: TOK.lead },
      "session, unknown org": { token: TOK.lead, orgId: "org-does-not-exist" }
    };
    // Invite routes take the organisation from the request body, not from
    // X-Org-Id, so a real session with no org (or a wrong one) in the header is a normal call there.
    if (path.startsWith("/org/invites/")) { delete attempts["session with no org named"]; delete attempts["session, unknown org"]; }
    for (const [name, creds] of Object.entries(attempts)) {
      const res = await call(env, method, path, { ...creds, body });
      // An organisation id that does not exist is a plain "not found".
      const ok = refused(res) || (name === "session, unknown org" && res.status === 404);
      assert.ok(ok, `${label(c)} with ${name} answered ${res.status}, expected 401 or 403: ${res.text.slice(0, 160)}`);
    }
    assert.equal(snapshot(d1), before, `${label(c)} changed data while refusing`);
  });
}

test("the same routes DO answer for a real staff-tier session (so the sweep above is not refusing everything)", async () => {
  const { env } = makeEnv();
  for (const [path, own] of [["/org/settings", ""], ["/org/members", "u-lead"], ["/org/expected", "Sam Sweep"], ["/org/weekly-events", "Sweep Class"]]) {
    const res = await call(env, "GET", path, { token: TOK.lead, orgId: ORG.id });
    assert.equal(res.status, 200, `${path} should answer a Lead Admin: ${res.text.slice(0, 160)}`);
    if (own) assert.ok(res.text.includes(own));
  }
  const key = await call(env, "GET", "/org/settings", { orgKey: ORG.key });
  assert.equal(key.status, 200, "the service-account key still works for a read it is allowed: " + key.text.slice(0, 120));
});

test("an expired session is deleted and cannot be used again, even with a sliding window", async () => {
  const { env, d1 } = makeEnv();
  const first = await call(env, "GET", "/org/members", { token: TOK.expired, orgId: ORG.id });
  assert.equal(first.status, 401);
  assert.equal(d1.get("SELECT COUNT(*) AS n FROM login_sessions WHERE token=?", TOK.expired).n, 0, "expired row removed");
  const again = await call(env, "GET", "/org/members", { token: TOK.expired, orgId: ORG.id });
  assert.equal(again.status, 401);
});

// ---- S12: an IP address never decides access --------------------------------
test("S12: the same valid token from any IP gets the same answer", async () => {
  const { env } = makeEnv();
  const answers = [];
  for (const ip of [undefined, "203.0.113.5", "198.51.100.77", "2001:db8::1", "10.0.0.1"]) {
    const res = await call(env, "GET", "/org/members", { token: TOK.lead, orgId: ORG.id, ip });
    answers.push(res.status);
  }
  assert.deepEqual([...new Set(answers)], [200]);
});

test("S12: a refused token stays refused from the IP of a legitimate, signed-in user", async () => {
  const { env } = makeEnv();
  const trustedIp = "203.0.113.9";
  const ok = await call(env, "GET", "/org/members", { token: TOK.lead, orgId: ORG.id, ip: trustedIp });
  assert.equal(ok.status, 200);
  for (const creds of [{}, { token: TAMPERED, orgId: ORG.id }, { token: TOK.stranger, orgId: ORG.id }, { token: TOK.attendee, orgId: ORG.id }, { orgKey: "org_made_up_key_1234567890abcdefgh" }]) {
    const res = await call(env, "GET", "/org/members", { ...creds, ip: trustedIp });
    assert.ok(refused(res), `answered ${res.status} for a caller on a trusted IP without proof`);
  }
});

test("S12: sending an IP header cannot be used to skip a check (the header is not a credential)", async () => {
  const { env } = makeEnv();
  for (const hdr of ["CF-Connecting-IP", "X-Forwarded-For", "X-Real-IP", "True-Client-IP", "X-Client-IP"]) {
    const res = await worker.fetch(new Request("https://worker.test/org/members", { headers: { [hdr]: "127.0.0.1" } }), env, { waitUntil() {} });
    assert.ok(res.status === 401 || res.status === 403, `${hdr}: 127.0.0.1 answered ${res.status}`);
  }
});

test("no refusal is a 5xx or leaks a stack trace", async () => {
  const { env } = makeEnv();
  for (const [method, path, body] of PROTECTED) {
    const res = await call(env, method, path, { token: "not a token", orgId: ORG.id, body });
    assert.ok(res.status < 500, `${method} ${path} answered ${res.status}`);
    assert.ok(!/\bat \S+ \(|\.js:\d+|Error:/.test(res.text), `${method} ${path} shows a stack trace: ${res.text.slice(0, 200)}`);
  }
});
