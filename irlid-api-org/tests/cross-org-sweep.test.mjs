// Cross-organisation sweep (test plan 4.6 and step 2): org A can never read or
// change org B's data, through any route.
//
// How it works. Two organisations are seeded with data in every table the
// Worker reads for the dashboard. Every value that belongs to org B contains
// the marker "ZZB". Then org A's credentials (a Lead Admin login session, and
// the org key) call every route, and:
//   1. READS: no response body from A may contain the marker, and A must still
//      see its own rows (so a route that returns nothing at all cannot pass).
//   2. B's NAMES: an id, slug, device key or token that belongs to B, sent with
//      A's credentials, is refused or not found, and B's rows are byte-for-byte
//      unchanged afterwards (reads and writes).
//   3. HEADERS: naming B in X-Org-Id with A's session is refused, and a key for
//      A wins over any X-Org-Id.
//   4. A Developer tied to A (v6.8.14) is refused for B on every read.
//   5. The route list below is checked against the Worker's router, so a new
//      /org or /user route that is not listed here fails the build.
//
// Included on purpose: archived expected attendees and org receipts.
// Runs the Worker's real SQL on an in-memory SQLite (helpers/sqlite-d1.mjs).
// No real names: every person below is made up.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../src/index.js";
import { SqliteD1 } from "./helpers/sqlite-d1.mjs";

const NOW = () => Math.floor(Date.now() / 1000);
const MARK = "ZZB";

const A = { id: "org-a", name: "Alpha AAA Club", slug: "alpha-aaa", key: "org_alpha_key_1234567890abcdef" };
const B = { id: "org-b", name: "Bravo ZZB Club", slug: "bravo-zzb", key: "org_bravo_ZZB_key_1234567890" };
const DEV_FP = "fp_developer_sweep01";

const TOK = {
  leadA: "sess_lead_a_abcdefghijklmnopqrs",
  leadB: "sess_lead_b_abcdefghijklmnopqrs",
  staffA: "sess_staff_a_abcdefghijklmnopqr",
  dev: "sess_dev_sweep_abcdefghijklmnopq"
};

// Tables the Worker creates on first use, plus the live-shaped people and
// calendar tables (schema.sql keeps the old shape; see two-org-bleed.test.mjs).
const LIVE_SHAPE = `
  DROP TABLE org_expected;
  CREATE TABLE org_expected (id INTEGER PRIMARY KEY AUTOINCREMENT, org_id TEXT NOT NULL, display_name TEXT NOT NULL, initials TEXT,
    role_key TEXT DEFAULT 'attendee', device_pub_fp TEXT, email_hint TEXT, phone_hint TEXT, notes TEXT,
    created_at INTEGER NOT NULL, archived_at INTEGER);
  CREATE TABLE IF NOT EXISTS expected_device_keys (org_id TEXT, expected_id INTEGER, device_key_fp TEXT, revoked_at INTEGER);
  CREATE TABLE IF NOT EXISTS org_receipts (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, checkin_id TEXT, attendee_pub_fp TEXT,
    payload_json TEXT NOT NULL, signature TEXT NOT NULL, created_at INTEGER NOT NULL, privacy_mode INTEGER DEFAULT 1);
  CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, label TEXT, subname TEXT, capacity INTEGER,
    display_ix INTEGER DEFAULT 0, venue_qr_payload_hash TEXT, created_at INTEGER, archived_at INTEGER);
  CREATE TABLE IF NOT EXISTS weekly_events (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, room_id TEXT, name TEXT NOT NULL,
    day_of_week INTEGER NOT NULL, start_time_local TEXT NOT NULL, duration_min INTEGER NOT NULL, capacity INTEGER,
    color_hex TEXT, notes TEXT, require_proof INTEGER DEFAULT 0, late_grace_min INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL, archived_at INTEGER, checkin_mode TEXT DEFAULT 'standard');
  CREATE TABLE IF NOT EXISTS event_expected (event_id TEXT NOT NULL, expected_id TEXT NOT NULL, added_at INTEGER NOT NULL, added_by TEXT,
    PRIMARY KEY (event_id, expected_id));
  CREATE TABLE IF NOT EXISTS org_audit_log (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, actor_user_id TEXT, actor_pub_fp TEXT,
    actor_display_name TEXT, actor_role TEXT, action TEXT NOT NULL, target TEXT, target_ref TEXT,
    outcome TEXT NOT NULL DEFAULT 'allowed', detail TEXT, nonce TEXT, created_at INTEGER NOT NULL);
`;

// Rows of each organisation, by the org that owns them. "AAA" / "ZZB" is the
// marker in every name, so a leaked row is easy to see in a response.
function seed(d1) {
  const t = NOW();
  const org = (o, at) => d1.exec(
    "INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
    o.id, o.name, o.slug, o.key,
    JSON.stringify({ welcomeMessage: "Welcome to " + o.name, redirectUrl: "https://example.org/" + o.slug,
      theme: { primary: o === A ? "#112233" : "#445566" } }), at, at);
  org(A, 100); org(B, 200);

  const user = (id, fp) => d1.exec(
    "INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES (?,?,?,?,0,0)", id, "{}", fp, id);
  user("u-lead-a", "fp_lead_a_000000001");
  user("u-lead-b", "fp_lead_b_ZZB_0000001");
  user("u-staff-a", "fp_staff_a_00000001");
  user("u-dev", DEV_FP);
  const member = (orgId, userId, role) => d1.exec(
    "INSERT INTO org_memberships (org_id,user_id,role,granted_at) VALUES (?,?,?,?)", orgId, userId, role, 1);
  member(A.id, "u-lead-a", "lead_admin"); member(A.id, "u-staff-a", "staff");
  member(B.id, "u-lead-b", "lead_admin"); member(A.id, "u-dev", "developer"); member(B.id, "u-dev", "developer");
  const session = (token, userId) => d1.exec(
    "INSERT INTO login_sessions (token,user_id,issued_at,expires_at) VALUES (?,?,?,?)", token, userId, t, t + 3600);
  session(TOK.leadA, "u-lead-a"); session(TOK.leadB, "u-lead-b"); session(TOK.staffA, "u-staff-a"); session(TOK.dev, "u-dev");

  // People: active, archived (the "Show archived" list), and one with a device key.
  const person = (org, name, fp, archivedAt) => d1.exec(
    "INSERT INTO org_expected (org_id,display_name,device_pub_fp,notes,created_at,archived_at) VALUES (?,?,?,?,?,?)",
    org.id, name, fp, "note for " + name, t - 500, archivedAt);
  person(A, "Ada AAA Active", "fp_ada_aaa_00000001", null);
  person(A, "Archie AAA Archived", "fp_archie_aaa_0000001", t - 100);
  person(B, "Bea ZZB Active", "fp_bea_ZZB_0000001", null);
  person(B, "Barry ZZB Archived", "fp_barry_ZZB_00000001", t - 100);
  d1.exec("INSERT INTO expected_device_keys (org_id,expected_id,device_key_fp) VALUES (?,?,?)", B.id, 3, "fp_bea_ZZB_second_key");

  // Check-ins (one open today, one finished a while ago), each with a receipt.
  const checkin = (org, id, name, fp, at) => {
    d1.exec(
      "INSERT INTO org_checkins (id,org_id,mode,attendee_label,name,device_key_fp,checkin_at,created_at,status,assurance,event_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      id, org.id, "attendee_scan", name, name, fp, at, at, "checked_in", "offline", "ev-" + org.slug);
    d1.exec(
      "INSERT INTO org_receipts (id,org_id,checkin_id,attendee_pub_fp,payload_json,signature,created_at) VALUES (?,?,?,?,?,?,?)",
      "rcpt-" + id, org.id, id, fp, JSON.stringify({ org: org.name, who: name }), "sig-" + id, at);
  };
  checkin(A, "ci-a-1", "Ada AAA Active", "fp_ada_aaa_00000001", t - 60);
  checkin(A, "ci-a-2", "Archie AAA Archived", "fp_archie_aaa_0000001", t - 3 * 86400);
  checkin(B, "ci-b-1", "Bea ZZB Active", "fp_bea_ZZB_0000001", t - 60);
  checkin(B, "ci-b-2", "Barry ZZB Archived", "fp_barry_ZZB_00000001", t - 3 * 86400);

  // Calendar.
  for (const o of [A, B]) {
    const tag = o === A ? "AAA" : MARK;
    d1.exec("INSERT INTO rooms (id,org_id,label,display_ix,created_at) VALUES (?,?,?,0,0)", "room-" + o.slug, o.id, "Room " + tag);
    d1.exec(
      "INSERT INTO weekly_events (id,org_id,room_id,name,day_of_week,start_time_local,duration_min,created_at) VALUES (?,?,?,?,?,?,?,0)",
      "ev-" + o.slug, o.id, "room-" + o.slug, "Class " + tag, 1, "10:00", 60);
  }
  d1.exec("INSERT INTO event_expected (event_id,expected_id,added_at) VALUES (?,?,0)", "ev-" + B.slug, "3");

  // Audit log, quarantine, invites, conflicts, staff sessions, tokens, kiosk.
  for (const o of [A, B]) {
    const tag = o === A ? "AAA" : MARK;
    d1.exec(
      "INSERT INTO org_audit_log (id,org_id,actor_user_id,actor_display_name,actor_role,action,target,outcome,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
      "aud-" + o.slug, o.id, "u-x", "Actor " + tag, "lead_admin", "settings_update", "Target " + tag, "allowed", t);
    d1.exec(
      "INSERT INTO org_checkin_quarantine (id,org_id,client_checkin_id,reason,signed_ts,received_at,body_json) VALUES (?,?,?,?,?,?,?)",
      "q-" + o.slug, o.id, "cid-" + tag, "bad_signature", t, t, JSON.stringify({ name: "Quarantined " + tag }));
    d1.exec(
      "INSERT INTO org_invites (nonce,org_id,role,issuer_pub_fp,expiry_ts,status,created_ts,envelope) VALUES (?,?,?,?,?,?,?,?)",
      "inv-" + o.slug, o.id, "staff", "fp_issuer_" + tag, (t + 3600) * 1000, "pending", t * 1000, "I:envelope-" + tag);
    d1.exec(
      "INSERT INTO org_staff_sessions (id,org_id,staff_pub_fp,staff_pub_jwk,hello_hash,verification_state,created_at,expires_at,last_seen_at) VALUES (?,?,?,?,?,?,?,?,?)",
      "ss-" + o.slug, o.id, "fp_staffphone_" + tag, "{}", "h", "verified", t, t + 3600, t);
    d1.exec(
      "INSERT INTO org_checkout_tokens (token,checkin_id,org_api_key,created_at,expires_at) VALUES (?,?,?,?,?)",
      "cot-" + o.slug, o === A ? "ci-a-1" : "ci-b-1", o.key, t, t + 3600);
    d1.exec(
      "INSERT INTO org_checkin_nonces (nonce,org_api_key,event_id,created_at,expires_at) VALUES (?,?,?,?,?)",
      "nonce-" + o.slug, o.key, "ev-" + o.slug, t, t + 3600);
    d1.exec(
      "INSERT INTO kiosk_code_keys (key_id,org_id,user_id,pub_fp,seed,created_at) VALUES (?,?,?,?,?,?)",
      "kk-" + o.slug, o.id, "u-x", "fp_kiosk_" + tag, "seed-" + tag, t);
    d1.exec(
      "INSERT INTO kiosk_screens (approval_id,org_id,kiosk_id,secret_hash,approved_by_user_id,approved_at,expires_at) VALUES (?,?,?,?,?,?,?)",
      "ks-" + o.slug, o.id, "kiosk-" + tag, "hash-" + tag, "u-x", t * 1000, (t + 3600) * 1000);
  }
  d1.exec(
    "INSERT INTO attendee_conflicts (org_code,expected_id,checkin_id,bound_device_fp,claiming_device_fp,claimed_name,created_at) VALUES (?,?,?,?,?,?,?)",
    B.id, 3, "ci-b-1", "fp_bea_ZZB_0000001", "fp_intruder_ZZB_001", "Conflict ZZB", t);
}

function makeEnv() {
  const d1 = new SqliteD1(LIVE_SHAPE);
  seed(d1);
  return { env: { DB: d1, CORS_ORIGIN: "*", BOOTSTRAP_DEVELOPER_FP: DEV_FP }, d1 };
}

async function call(env, method, path, { token, orgId, orgKey, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  if (orgId) headers["X-Org-Id"] = orgId;
  if (orgKey) headers["X-Org-Key"] = orgKey;
  const res = await worker.fetch(new Request("https://worker.test" + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  }), env, { waitUntil() {} });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch (_) {}
  return { status: res.status, data, text };
}

// Everything org B owns, as one string. Used to prove a call changed nothing.
const B_TABLES = [
  ["organisations", "id='org-b'"], ["org_memberships", "org_id='org-b'"], ["org_expected", "org_id='org-b'"],
  ["expected_device_keys", "org_id='org-b'"], ["org_checkins", "org_id='org-b'"], ["org_receipts", "org_id='org-b'"],
  ["rooms", "org_id='org-b'"], ["weekly_events", "org_id='org-b'"], ["event_expected", "1=1"],
  ["org_audit_log", "org_id='org-b'"], ["org_checkin_quarantine", "org_id='org-b'"], ["org_invites", "org_id='org-b'"],
  ["org_staff_sessions", "org_id='org-b'"], ["org_checkout_tokens", "checkin_id LIKE 'ci-b-%'"],
  ["org_checkin_nonces", "nonce='nonce-bravo-zzb'"], ["kiosk_code_keys", "org_id='org-b'"], ["kiosk_screens", "org_id='org-b'"],
  ["attendee_conflicts", "org_code='org-b'"]
];
function snapshotB(d1) {
  return JSON.stringify(B_TABLES.map(([table, where]) => [table, d1.all(`SELECT * FROM ${table} WHERE ${where} ORDER BY rowid`)]));
}

// ---------------------------------------------------------------------------
// The route list. Every /org and /user route in the Worker's router is in
// exactly one of these three lists (the last test checks it).
// ---------------------------------------------------------------------------

// 1. Reads that take no id. A's session or key, nothing else. `own` is a
//    marker A must still see, so "returns nothing" cannot pass.
const READS = [
  { path: "/org/settings", own: "AAA" },
  { path: "/org/qr" },
  { path: "/org/members", own: "u-lead-a" },
  { path: "/org/audit-log", own: "AAA" },
  { path: "/org/attendance?range=7d", own: "Ada AAA" },
  { path: "/org/attendance?range=today&include_expected=1", own: "Ada AAA" },
  { path: "/org/expected", own: "Ada AAA", slugTier: true },
  { path: "/org/expected?archived=1", own: "Archie AAA" },
  { path: "/org/rooms", own: "Room AAA" },
  { path: "/org/weekly-events", own: "Class AAA" },
  { path: "/org/weekly-events/export-csv", own: "Class AAA" },
  { path: "/org/checkin-quarantine", own: "cid-AAA" },
  { path: "/org/invites/pending", own: "inv-alpha-aaa" },
  { path: "/org/kiosk/code-keys?org_id=org-a&kiosk_id=KABC0001" },
  { path: "/org/kiosk/screens?org_id=org-a", own: "kiosk-AAA" },
  { path: "/org/current-event" },
  { path: "/org/active-checkin?device_pub=fp_ada_aaa_00000001", own: "Ada AAA", slugTier: true },
  { path: "/org/recognize?device_pub=fp_ada_aaa_00000001", own: "Ada AAA", slugTier: true },
  { path: "/org/checkin-nonce/status" },
  { path: "/org/public-meta" },
  { path: "/user/orgs", own: "Alpha AAA Club" }
];

// 2. Calls that name something by id, key, slug or token. Each one is sent with
//    A's credentials and B's value. `method`/`body` make a plausible call.
const BY_NAME = [
  { method: "GET", path: "/org/expected/lookup-by-fp/fp_bea_ZZB_0000001" },
  { method: "GET", path: "/org/expected/lookup-by-fp/fp_barry_ZZB_00000001" },
  { method: "PATCH", path: "/org/expected/3", body: { display_name: "Hijacked" } },
  { method: "PATCH", path: "/org/expected/4", body: { display_name: "Hijacked" } },
  { method: "DELETE", path: "/org/expected/3" },
  { method: "DELETE", path: "/org/expected/4/full" },
  { method: "POST", path: "/org/expected/4/restore" },
  { method: "POST", path: "/org/expected/3/rebind", body: { device_pub_fp: "fp_attacker_0000001" } },
  { method: "POST", path: "/org/expected/3/bind-additional-key", body: { device_pub_fp: "fp_attacker_0000002", device_pub_jwk: {} } },
  { method: "POST", path: "/org/expected/3/claim", body: { device_pub_fp: "fp_attacker_0000003" } },
  { method: "PATCH", path: "/org/weekly-events/ev-bravo-zzb", body: { name: "Hijacked" } },
  { method: "DELETE", path: "/org/weekly-events/ev-bravo-zzb" },
  { method: "POST", path: "/org/conflicts/1/resolve", body: { resolution: "confirmed_new_device" } },
  { method: "POST", path: "/org/conflicts/1/resolve", body: { resolution: "rejected" } },
  { method: "DELETE", path: "/org/members/u-lead-b" },
  { method: "POST", path: "/org/invites/revoke", body: { nonce: "inv-bravo-zzb" } },
  { method: "POST", path: "/org/invites/inv-bravo-zzb/revoke" },
  { method: "GET", path: "/org/invites/inv-bravo-zzb/envelope" },
  { method: "POST", path: "/org/kiosk/screen/revoke", body: { approval_id: "ks-bravo-zzb" } }
];

// 2b. Kiosk routes take the organisation from the query string. A's session
//     naming B there must be refused (kioskSessionForOrg checks membership).
const QUERY_ORG = [
  "/org/kiosk/screens?org_id=org-b",
  "/org/kiosk/code-keys?org_id=org-b&kiosk_id=KABC0001"
];

// 3. Routes that are not org-scoped reads or writes, with the reason. Public
//    ones return only what the org chose to publish; the rest act on the
//    caller's own account or on a one-time code.
const EXEMPT = {
  "/org/login/init": "sign-in challenge, no org data",
  "/org/login/poll": "sign-in, one-time secret",
  "/org/login/claim": "sign-in, signed by the device key",
  "/org/action/init": "signed admin action, org taken from the signed body",
  "/org/action/poll": "signed admin action, one-time secret",
  "/org/action/claim": "signed admin action, one-time secret",
  "/org/kiosk/code-key": "enrol: org id comes from the signed admin action",
  "/org/kiosk/offline-unlock-log": "kiosk code log, org from the signed request",
  "/org/invites/create": "write: org from orgAuth, covered by two-org-bleed",
  "/org/invites/redeem": "redeem by one-time nonce",
  "/org/invite/accept-on-this-device": "redeem by one-time nonce",
  "/org/lead-admin/appoint": "signed admin action",
  "/org/register": "creates an org",
  "/org/staff/auth": "staff phone sign-in, signed",
  "/org/checkin": "attendee check-in, org named in the signed hello",
  "/org/checkin/hold": "attendee hold, org named in the signed hello",
  "/org/checkout": "attendee check-out, signed",
  "/org/checkin-nonce": "write: org from orgAuth",
  "/org/ws-ticket": "ticket is for the caller's own org",
  "/org/ws": "WebSocket, ticket is bound to one org",
  "/org/checkout-token": "write: org from orgAuth",
  "/org/debug/clear-attendance": "erasure, own org only (erasure-audit tests)",
  "/org/expected": "list is in READS; create is org from orgAuth",
  "/org/expected/create-and-bind": "write: org from orgAuth",
  "/org/weekly-events": "list is in READS; create is org from orgAuth",
  "/org/weekly-events/import-csv": "write: org from orgAuth",
  "/org/conflicts/:id/resolve": "in BY_NAME",
  "/org/expected/:id": "in BY_NAME",
  "/org/expected/:id/full": "in BY_NAME",
  "/org/expected/:id/restore": "in BY_NAME",
  "/org/expected/:id/rebind": "in BY_NAME",
  "/org/expected/:id/bind-additional-key": "in BY_NAME",
  "/org/expected/:id/claim": "in BY_NAME",
  "/org/expected/lookup-by-fp/:id": "in BY_NAME",
  "/org/weekly-events/:id": "in BY_NAME",
  "/org/checkout-token/:id": "in BY_NAME",
  "/org/members/:id": "in BY_NAME",
  "/org/invites/revoke": "in BY_NAME",
  "/org/invites/:id/revoke": "in BY_NAME",
  "/org/invites/:id/envelope": "in BY_NAME",
  "/org/kiosk/screen/revoke": "in BY_NAME",
  "/org/receipt/:id": "PUBLIC by receipt id (a capability link, like a 1-on-1 receipt); see the receipts test",
  "/org/public-info/:id": "PUBLIC: only what the org publishes",
  "/org/entry-info/:id": "PUBLIC: safe branding only (theme-validation tests)",
  "/org/action/poll/:id": "signed admin action, one-time secret",
  "/org/settings": "in READS (GET) and settings-lead-admin-only (POST)",
  "/org/qr": "in READS",
  "/org/members": "in READS",
  "/org/audit-log": "in READS",
  "/org/attendance": "in READS",
  "/org/rooms": "in READS",
  "/org/weekly-events/export-csv": "in READS",
  "/org/checkin-quarantine": "in READS",
  "/org/invites/pending": "in READS",
  "/org/kiosk/code-keys": "in READS",
  "/org/kiosk/screens": "in READS",
  "/org/current-event": "in READS",
  "/org/active-checkin": "in READS",
  "/org/recognize": "in READS",
  "/org/checkin-nonce/status": "in READS",
  "/org/public-meta": "in READS",
  "/user/orgs": "in READS",
  "/user/create-org": "creates an org for the caller",
  "/user/sign-out-all-devices": "caller's own sessions",
  "/user/logout": "caller's own session",
  "/user/session/org": "ties the caller's session (two-org-bleed)",
  "/user/orgs/:id/scrape-theme": "writes the theme of an org the caller administers; org checked, see the scrape-theme test"
};

const leaks = (res) => res.text.includes(MARK);

// ---------------------------------------------------------------------------
// 1. Reads
// ---------------------------------------------------------------------------
for (const r of READS) {
  test(`read ${r.path}: Lead Admin of A (session) never sees B`, async () => {
    const { env } = makeEnv();
    const res = await call(env, "GET", r.path, { token: TOK.leadA, orgId: A.id });
    assert.ok(res.status < 500, `${r.path} answered ${res.status}: ${res.text.slice(0, 200)}`);
    assert.ok(!leaks(res), `${r.path} leaked org B data: ${res.text.slice(0, 400)}`);
    if (r.own) assert.ok(res.text.includes(r.own), `${r.path} did not show A's own "${r.own}" (answered ${res.status}): ${res.text.slice(0, 300)}`);
  });
  test(`read ${r.path}: A's org key never sees B`, async () => {
    const { env } = makeEnv();
    const res = await call(env, "GET", r.path, { orgKey: A.key });
    assert.ok(res.status < 500, `${r.path} answered ${res.status}: ${res.text.slice(0, 200)}`);
    assert.ok(!leaks(res), `${r.path} leaked org B data: ${res.text.slice(0, 400)}`);
  });
}

test("reads: A's key with B named in X-Org-Id still answers as A", async () => {
  const { env } = makeEnv();
  for (const r of READS) {
    const res = await call(env, "GET", r.path, { orgKey: A.key, orgId: B.id });
    assert.ok(!leaks(res), `${r.path} followed X-Org-Id over the key: ${res.text.slice(0, 300)}`);
  }
});

test("reads: A's session naming B in X-Org-Id is refused on every read (member of A only)", async () => {
  const { env } = makeEnv();
  for (const r of READS.filter(x => x.path.startsWith("/org/") && x.path !== "/org/public-meta" && !x.slugTier)) {
    for (const token of [TOK.leadA, TOK.staffA]) {
      const res = await call(env, "GET", r.path.replace("org_id=org-a", "org_id=org-b"), { token, orgId: B.id });
      assert.ok(res.status === 403 || res.status === 401 || res.status === 404, `${r.path} answered ${res.status} for another org`);
      assert.ok(!leaks(res), `${r.path} leaked org B data to a non-member`);
    }
  }
});

test("reads: a Developer tied to A is refused for B on every read, and still sees A", async () => {
  const { env } = makeEnv();
  const tie = await call(env, "POST", "/user/session/org", { token: TOK.dev, body: { org_id: A.id } });
  assert.equal(tie.status, 200);
  for (const r of READS.filter(x => x.path.startsWith("/org/") && x.path !== "/org/public-meta" && !x.slugTier)) {
    const res = await call(env, "GET", r.path.replace("org_id=org-a", "org_id=org-b"), { token: TOK.dev, orgId: B.id });
    assert.equal(res.status, 403, `${r.path} must refuse a session tied to another org`);
    assert.ok(!leaks(res));
  }
  const own = await call(env, "GET", "/org/expected", { token: TOK.dev, orgId: A.id });
  assert.equal(own.status, 200);
  assert.ok(own.text.includes("Ada AAA"));
});

// ---------------------------------------------------------------------------
// 2. Archived expected attendees (Show archived / Restore)
// ---------------------------------------------------------------------------
test("archived expected attendees: A lists only its own; B's archived person cannot be restored or erased by A", async () => {
  const { env, d1 } = makeEnv();
  const list = await call(env, "GET", "/org/expected?archived=1", { token: TOK.leadA, orgId: A.id });
  assert.equal(list.status, 200);
  assert.ok(list.text.includes("Archie AAA"));
  assert.ok(!list.text.includes("Barry"), "B's archived person is in A's archived list");
  const before = snapshotB(d1);
  const barry = d1.get("SELECT id FROM org_expected WHERE display_name=?", "Barry ZZB Archived").id;
  for (const token of [TOK.leadA]) {
    const restore = await call(env, "POST", `/org/expected/${barry}/restore`, { token, orgId: A.id });
    assert.ok([403, 404].includes(restore.status), "restore of another org's person answered " + restore.status);
    const erase = await call(env, "DELETE", `/org/expected/${barry}/full`, { token, orgId: A.id });
    assert.ok([403, 404].includes(erase.status), "erase of another org's person answered " + erase.status);
  }
  const keyRestore = await call(env, "POST", `/org/expected/${barry}/restore`, { orgKey: A.key });
  assert.ok([403, 404].includes(keyRestore.status));
  assert.equal(snapshotB(d1), before, "B's rows changed");
  assert.notEqual(d1.get("SELECT archived_at FROM org_expected WHERE id=?", barry).archived_at, null, "B's person is still archived");
});

// ---------------------------------------------------------------------------
// 3. Receipts
// ---------------------------------------------------------------------------
test("receipts: A's attendance rows carry no B receipt, and B's receipts are not listed or changed by A", async () => {
  const { env, d1 } = makeEnv();
  for (const range of ["today", "7d", "all"]) {
    const res = await call(env, "GET", `/org/attendance?range=${range}`, { token: TOK.leadA, orgId: A.id });
    assert.ok(!res.text.includes("rcpt-ci-b"), `attendance (${range}) listed a B receipt`);
    assert.ok(!res.text.includes(MARK));
  }
  const before = snapshotB(d1);
  const clear = await call(env, "POST", "/org/debug/clear-attendance", { token: TOK.leadA, orgId: A.id, body: { confirm: true } });
  assert.ok(clear.status < 500);
  assert.equal(snapshotB(d1), before, "A's Clear attendance touched B's check-ins or receipts");
  assert.equal(d1.get("SELECT COUNT(*) AS n FROM org_receipts WHERE org_id='org-b'").n, 2);
});

test("receipts: the public receipt link needs the exact receipt id and names only its own org", async () => {
  const { env } = makeEnv();
  const ok = await call(env, "GET", "/org/receipt/rcpt-ci-a-1");
  assert.equal(ok.status, 200);
  assert.ok(!leaks(ok));
  const miss = await call(env, "GET", "/org/receipt/rcpt-ci-a");
  assert.equal(miss.status, 404, "a partial id must not match (no prefix or wildcard lookup)");
  const wild = await call(env, "GET", "/org/receipt/" + encodeURIComponent("%"));
  assert.equal(wild.status, 404, "% must not act as a wildcard");
});

// ---------------------------------------------------------------------------
// 4. Things named by id, key, slug or token
// ---------------------------------------------------------------------------
for (const c of BY_NAME) {
  test(`${c.method} ${c.path}: A's session cannot reach B's row, and B is unchanged`, async () => {
    const { env, d1 } = makeEnv();
    const before = snapshotB(d1);
    const res = await call(env, c.method, c.path, { token: TOK.leadA, orgId: A.id, body: c.body });
    assert.ok(res.status < 500, `${c.method} ${c.path} answered ${res.status}: ${res.text.slice(0, 200)}`);
    assert.ok(!(res.status >= 200 && res.status < 300 && c.method === "GET" && leaks(res)),
      `${c.path} returned B's data: ${res.text.slice(0, 300)}`);
    assert.equal(snapshotB(d1), before, `${c.method} ${c.path} changed org B's rows`);
  });
  test(`${c.method} ${c.path}: A's org key cannot reach B's row, and B is unchanged`, async () => {
    const { env, d1 } = makeEnv();
    const before = snapshotB(d1);
    const res = await call(env, c.method, c.path, { orgKey: A.key, body: c.body });
    assert.ok(res.status < 500, `${c.method} ${c.path} answered ${res.status}: ${res.text.slice(0, 200)}`);
    assert.ok(!(res.status >= 200 && res.status < 300 && c.method === "GET" && leaks(res)),
      `${c.path} returned B's data: ${res.text.slice(0, 300)}`);
    assert.equal(snapshotB(d1), before, `${c.method} ${c.path} changed org B's rows`);
  });
}

test("slugs: public pages for B show B only; A's credentials add nothing", async () => {
  const { env } = makeEnv();
  const info = await call(env, "GET", "/org/public-info/" + B.slug, { token: TOK.leadA, orgId: A.id });
  const entry = await call(env, "GET", "/org/entry-info/" + B.slug, { orgKey: A.key });
  for (const res of [info, entry]) {
    assert.ok(!/api_key|org_bravo|venue_prv|seed|u-lead-b|fp_/.test(res.text), "public page exposes a key or id: " + res.text.slice(0, 300));
  }
});

test("kiosk routes that take the organisation from the query refuse A's session for B", async () => {
  const { env } = makeEnv();
  await call(env, "POST", "/user/session/org", { token: TOK.dev, body: { org_id: A.id } });
  for (const path of QUERY_ORG) {
    for (const token of [TOK.leadA, TOK.staffA, TOK.dev]) {
      const res = await call(env, "GET", path, { token, orgId: A.id });
      assert.ok([401, 403, 404].includes(res.status), `${path} answered ${res.status} for another org`);
      assert.ok(!leaks(res), `${path} leaked org B data`);
    }
  }
});

test("slug-level picker (GET /org/expected): redacted, active people only, and closed by allowSelfSelection=false", async () => {
  // Design, not a bug: the attendee's "I'm not on the list" picker is open to
  // anyone who holds the venue slug. These tests pin what it may show (names
  // only, never hints, notes or device keys, never an archived person) and
  // that turning the setting off closes it for everyone, A's members included.
  const { env, d1 } = makeEnv();
  const open = await call(env, "GET", "/org/expected", { orgId: B.id });
  assert.equal(open.status, 200);
  assert.equal(open.data.redacted, true);
  assert.ok(open.text.includes("Bea ZZB Active"));
  assert.ok(!open.text.includes("Barry"), "an archived person must never appear in the picker");
  assert.ok(!/note for|email|phone|fp_bea|fp_barry|device_pub_fp/.test(open.text), "picker leaked a hint, note or device key: " + open.text);
  const asA = await call(env, "GET", "/org/expected", { token: TOK.leadA, orgId: B.id });
  assert.ok(!/note for|fp_bea|fp_barry|Barry/.test(asA.text), "A's session got more than the picker: " + asA.text);
  d1.exec("UPDATE organisations SET settings_json=? WHERE id=?", JSON.stringify({ allowSelfSelection: false }), B.id);
  for (const o of [{ orgId: B.id }, { token: TOK.leadA, orgId: B.id }, { token: TOK.staffA, orgId: B.id }]) {
    const closed = await call(env, "GET", "/org/expected", o);
    assert.ok([401, 403].includes(closed.status), "picker still open after allowSelfSelection=false: " + closed.status);
    assert.ok(!leaks(closed));
  }
});

test("slug-level lookup by device key (GET /org/active-checkin): an org only ever matches its own check-ins", async () => {
  // Design: the phone asks "am I already signed in?" with its own device key
  // and the venue slug, no login. A device key from A, sent for B, matches
  // nothing in B, and the reverse. (A key that is known can still be looked up
  // in the org that holds it: reported to Spencer, not changed here.)
  const { env } = makeEnv();
  const aKeyAtB = await call(env, "GET", "/org/active-checkin?device_pub=fp_ada_aaa_00000001", { orgId: B.id });
  assert.deepEqual(aKeyAtB.data, { active: false });
  const bKeyAtA = await call(env, "GET", "/org/active-checkin?device_pub=fp_bea_ZZB_0000001", { orgKey: A.key });
  assert.deepEqual(bKeyAtA.data, { active: false });
  assert.ok(!leaks(bKeyAtA));
  // Same for "who is this device" (recognize, lookup-by-fp): own org only.
  for (const [path, orgOpt] of [
    ["/org/recognize?device_pub=fp_ada_aaa_00000001", { orgId: B.id }],
    ["/org/recognize?device_pub=fp_bea_ZZB_0000001", { orgKey: A.key }],
    ["/org/expected/lookup-by-fp/fp_ada_aaa_00000001", { orgId: B.id }],
    ["/org/expected/lookup-by-fp/fp_bea_ZZB_0000001", { orgKey: A.key }]
  ]) {
    const res = await call(env, "GET", path, orgOpt);
    assert.ok(!leaks(res) && !res.text.includes("Ada AAA"), `${path} matched a person in the other org: ${res.text}`);
    assert.ok(!/"recognized":true|"status":"linked"/.test(res.text), `${path} recognised a device in the other org`);
  }
});

test("an ARCHIVED expected person is not recognised by their device key, in their own org or another", async () => {
  const { env } = makeEnv();
  for (const [path, orgOpt] of [
    ["/org/recognize?device_pub=fp_barry_ZZB_00000001", { orgId: B.id }],
    ["/org/recognize?device_pub=fp_archie_aaa_0000001", { orgId: A.id }],
    ["/org/expected/lookup-by-fp/fp_barry_ZZB_00000001", { orgId: B.id }],
    ["/org/expected/lookup-by-fp/fp_archie_aaa_0000001", { orgKey: A.key }]
  ]) {
    const res = await call(env, "GET", path, orgOpt);
    assert.ok(!/"recognized":true|"status":"linked"|Barry|Archie/.test(res.text), `${path} recognised an archived person: ${res.text}`);
  }
});

test("check-out token (GET /org/checkout-token/:token): one exact token, no wildcard, no listing", async () => {
  const { env } = makeEnv();
  const ok = await call(env, "GET", "/org/checkout-token/cot-bravo-zzb");
  assert.equal(ok.status, 200);
  assert.ok(!/org_bravo|api_key|venue_prv/.test(ok.text) || !ok.text.includes(B.key), "the org key must not be in the response");
  assert.ok(!ok.text.includes(B.key));
  for (const miss of ["cot-bravo", "cot-", "%25", "cot-bravo-zzb%25"]) {
    const res = await call(env, "GET", "/org/checkout-token/" + miss);
    assert.ok([400, 404, 410].includes(res.status), `partial token "${miss}" answered ${res.status}`);
    assert.ok(!leaks(res));
  }
});

// ---------------------------------------------------------------------------
// 5. Every route is accounted for
// ---------------------------------------------------------------------------
test("every /org and /user route in the Worker is in this sweep or has a written reason", () => {
  const src = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  const router = src.slice(src.indexOf("export default {"));
  const found = new Set();
  // Literal paths: path === "/org/x"
  for (const m of router.matchAll(/path === "((?:\/org|\/user)[^"]*)"/g)) found.add(m[1]);
  // Regex paths: path.match(/^\/org\/expected\/([^/]+)\/full$/)
  for (const m of router.matchAll(/path\.match\(\/\^((?:\\\/(?:org|user))(?:\\\/[^$]*)?)\$\//g)) {
    found.add(m[1].replace(/\\\//g, "/").replace(/\((?:\[\^\/\]\+|\\d\+)\)/g, ":id"));
  }
  assert.ok(found.size > 40, "router parse found too few routes (" + found.size + "); fix this test's pattern");
  const known = new Set([...READS.map(r => r.path.split("?")[0]), ...Object.keys(EXEMPT)]);
  for (const r of QUERY_ORG) known.add(r.split("?")[0]);
  const missing = [...found].filter(p => !known.has(p) && !known.has(p.replace(/:id$/, ":id")));
  assert.deepEqual(missing, [], "New route(s) not in the cross-org sweep. Add each to READS, BY_NAME or EXEMPT (with a reason): " + missing.join(", "));
});
