// Two-org bleed fix (v6.8.14), Worker side.
//
// What went wrong (12 Nov 2026): a person added from a staff scan in the
// Test Event organisation was written into Imbue Ventures. The Worker took
// the organisation from the X-Org-Id header and only checked that the signed
// in user could reach it. A Developer can reach every organisation, so a
// page that named the wrong one was obeyed.
//
// What these tests prove:
//  1. A login session is tied to ONE organisation (POST /user/session/org),
//     and every org call from it that names another organisation is refused
//     (403 session_org_mismatch), reads and writes, for a Developer too.
//  2. The tie never changes for a token. Switching organisation gives a new
//     token, and the old one still reaches only its own organisation, so a
//     queued check-in still lands where it was made (C7, C13).
//  3. Add / link at the door is refused when the scanned QR names a different
//     organisation (409 scan_org_mismatch), and nothing is written.
//  4. Old cached pages (which never tie the session) and service accounts
//     keep working.
// Runs the Worker's real SQL on an in-memory SQLite built from schema.sql.
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { SqliteD1 } from "./helpers/sqlite-d1.mjs";

const NOW = () => Math.floor(Date.now() / 1000);
const DEV_FP = "fp_developer_0001";
const IMBUE = { id: "org-imbue", name: "Imbue Ventures Ltd", slug: "imbue-ventures", key: "org_imbue_key_1234567890abcd" };
const TESTEV = { id: "org-test", name: "Test Event", slug: "test-event", key: "org_testevent_key_1234567890" };

const TOK = {
  dev: "sess_dev_token_abcdefghijklmnop",
  staffImbue: "sess_staff_imbue_abcdefghijklm",
  both: "sess_both_orgs_abcdefghijklmno"
};

// schema.sql still has the pre-v5.11 people table. Live uses this shape
// (migrations/apply_v5_11_0_org_expected_reset.ps1), and so does the Worker.
const LIVE_EXPECTED = `
  DROP TABLE org_expected;
  CREATE TABLE org_expected (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, display_name TEXT NOT NULL, initials TEXT,
    role_key TEXT DEFAULT 'attendee', device_pub_fp TEXT, email_hint TEXT, phone_hint TEXT, notes TEXT,
    created_at INTEGER NOT NULL, archived_at INTEGER);
`;

function makeEnv() {
  const d1 = new SqliteD1(LIVE_EXPECTED);
  const org = (o, created) => d1.exec(
    "INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES (?,?,?,?,'{}',?,?)",
    o.id, o.name, o.slug, o.key, created, created
  );
  org(IMBUE, 100);   // the older organisation
  org(TESTEV, 200);
  const user = (id, fp) => d1.exec(
    "INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES (?,?,?,?,0,0)", id, "{}", fp, id
  );
  user("u-dev", DEV_FP);
  user("u-staff", "fp_staff_imbue_01");
  user("u-both", "fp_lead_both_0001");
  const member = (orgId, userId, role, at) => d1.exec(
    "INSERT INTO org_memberships (org_id,user_id,role,granted_at) VALUES (?,?,?,?)", orgId, userId, role, at
  );
  member(IMBUE.id, "u-dev", "developer", 1);          // the Developer's oldest membership
  member(IMBUE.id, "u-staff", "staff", 2);
  member(IMBUE.id, "u-both", "lead_admin", 3);
  member(TESTEV.id, "u-both", "lead_admin", 4);
  const session = (token, userId) => d1.exec(
    "INSERT INTO login_sessions (token,user_id,issued_at,expires_at) VALUES (?,?,?,?)", token, userId, NOW(), NOW() + 3600
  );
  session(TOK.dev, "u-dev");
  session(TOK.staffImbue, "u-staff");
  session(TOK.both, "u-both");
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
  let data = null;
  try { data = await res.json(); } catch (_) {}
  return { status: res.status, data };
}

const expectedIn = (d1, orgId) => d1.all("SELECT display_name FROM org_expected WHERE org_id=? ORDER BY display_name", orgId).map(r => r.display_name);
const select = (env, token, orgId) => call(env, "POST", "/user/session/org", { token, body: { org_id: orgId } });
const addPerson = (env, token, orgId, name) => call(env, "POST", "/org/expected", { token, orgId, body: { display_name: name } });

test("PROOF OF THE HOLE: a session that is not tied to an organisation writes wherever X-Org-Id says", async () => {
  // This is how the Worker behaved before the fix, and how it still treats an
  // old cached page that never ties its session (see the last test).
  const { env, d1 } = makeEnv();
  assert.equal((await addPerson(env, TOK.dev, TESTEV.id, "Asked For Test Event")).status, 201);
  assert.equal((await addPerson(env, TOK.dev, IMBUE.id, "Bradley Bleed")).status, 201);
  assert.deepEqual(expectedIn(d1, IMBUE.id), ["Bradley Bleed"], "the same session wrote into a second organisation");
});

test("a session tied to Test Event is refused for Imbue: writes and reads, even for a Developer", async () => {
  const { env, d1 } = makeEnv();
  const sel = await select(env, TOK.dev, TESTEV.id);
  assert.equal(sel.status, 200);
  assert.equal(sel.data.org_id, TESTEV.id);
  assert.equal(sel.data.org_name, "Test Event");
  assert.equal(sel.data.session_token, TOK.dev, "first choice keeps the same token");
  assert.equal(sel.data.switched, false);

  const ok = await addPerson(env, TOK.dev, TESTEV.id, "Bradley Right-Org");
  assert.equal(ok.status, 201);

  const write = await addPerson(env, TOK.dev, IMBUE.id, "Bradley Wrong-Org");
  assert.equal(write.status, 403);
  assert.equal(write.data.error, "session_org_mismatch");
  assert.equal(write.data.session_org_id, TESTEV.id);

  const settingsWrite = await call(env, "POST", "/org/settings", { token: TOK.dev, orgId: IMBUE.id, body: { welcomeMessage: "from the wrong org" } });
  assert.equal(settingsWrite.status, 403);
  assert.equal(settingsWrite.data.error, "session_org_mismatch");

  for (const path of ["/org/expected", "/org/attendance", "/org/settings", "/org/members"]) {
    const read = await call(env, "GET", path, { token: TOK.dev, orgId: IMBUE.id });
    assert.equal(read.status, 403, path + " must not show another organisation's data");
    assert.equal(read.data.error, "session_org_mismatch");
  }

  assert.deepEqual(expectedIn(d1, IMBUE.id), [], "nothing was written into Imbue");
  assert.deepEqual(expectedIn(d1, TESTEV.id), ["Bradley Right-Org"]);
  const imbue = d1.get("SELECT settings_json FROM organisations WHERE id=?", IMBUE.id);
  assert.equal(imbue.settings_json, "{}", "Imbue's settings were not touched");
});

test("door check-in and check-out for the wrong organisation are not counted, and never a final error (C8)", async () => {
  // These two paths are replayed by the offline queue, so the Worker must not
  // answer them with a final error. They get the 202 "not counted" notice the
  // queue already understands, and nothing is stored.
  const { env, d1 } = makeEnv();
  await select(env, TOK.dev, TESTEV.id);
  const checkin = await call(env, "POST", "/org/checkin", {
    token: TOK.dev, orgId: IMBUE.id,
    body: { mode: "doorman_scan", helloPayload: { v: 3, pub: await newPhoneJwk(), ts: NOW() }, helloHash: "h", name: "Walk-in" }
  });
  assert.equal(checkin.status, 202);
  assert.equal(checkin.data.quarantined, true);
  assert.equal(checkin.data.not_stored, true);
  assert.equal(checkin.data.reason, "session_org_mismatch");
  assert.ok(checkin.data.notice.length > 20, "the notice says what happened");
  const checkout = await call(env, "POST", "/org/checkout", { token: TOK.dev, orgId: IMBUE.id, body: { checkin_id: "c1" } });
  assert.equal(checkout.status, 202);
  assert.equal(checkout.data.reason, "session_org_mismatch");
  assert.equal(d1.get("SELECT COUNT(*) AS n FROM org_checkins").n, 0, "no check-in was written anywhere");
  const hasReviewList = d1.get("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='org_checkin_quarantine'").n > 0;
  if (hasReviewList) assert.equal(d1.get("SELECT COUNT(*) AS n FROM org_checkin_quarantine").n, 0, "and nothing was kept in Imbue's review list");

  // Live-only calls on the same route family are plainly refused.
  for (const [method, path, body] of [
    ["GET", "/org/expected", undefined],
    ["GET", "/org/recognize?device_pub=x", undefined],
    ["GET", "/org/active-checkin?device_key_fp=x", undefined],
    ["POST", "/org/checkin/hold", {}],
    ["POST", "/org/expected/p1/claim", { device_pub_fp: "x" }]
  ]) {
    const r = await call(env, method, path, { token: TOK.dev, orgId: IMBUE.id, body });
    assert.equal(r.status, 403, method + " " + path);
    assert.equal(r.data.error, "session_org_mismatch", method + " " + path);
  }
});

test("an attendee phone (no login session) is not affected by any of this", async () => {
  const { env } = makeEnv();
  // The public picker list by slug, as org-entry.html asks for it.
  const list = await call(env, "GET", "/org/expected", { orgKey: IMBUE.slug });
  assert.equal(list.status, 200);
  const hold = await call(env, "POST", "/org/checkin/hold", { orgKey: TESTEV.slug, body: {} });
  assert.notEqual(hold.data && hold.data.error, "session_org_mismatch");
});

test("the mismatch is 403, never 401, so the page does not treat it as an expired session", async () => {
  const { env } = makeEnv();
  await select(env, TOK.both, TESTEV.id);
  const r = await call(env, "GET", "/org/expected", { token: TOK.both, orgId: IMBUE.id });
  assert.equal(r.status, 403);
  assert.doesNotMatch(String(r.data.error), /^session_(invalid|expired|required|user_missing)$/);
});

test("switching organisation gives a new token; each token reaches only its own organisation", async () => {
  const { env, d1 } = makeEnv();
  await select(env, TOK.both, IMBUE.id);
  const sw = await select(env, TOK.both, TESTEV.id);
  assert.equal(sw.status, 200);
  assert.equal(sw.data.switched, true);
  assert.equal(sw.data.previous_org_id, IMBUE.id);
  const newTok = sw.data.session_token;
  assert.ok(newTok && newTok !== TOK.both, "a new token for the new organisation");
  assert.match(newTok, /^[A-Za-z0-9_-]{16,}$/);

  // New token: Test Event only.
  assert.equal((await addPerson(env, newTok, TESTEV.id, "New Token Person")).status, 201);
  assert.equal((await addPerson(env, newTok, IMBUE.id, "Leak One")).data.error, "session_org_mismatch");
  // Old token (another tab, a queued offline check-in): still Imbue only.
  assert.equal((await addPerson(env, TOK.both, IMBUE.id, "Queued For Imbue")).status, 201);
  assert.equal((await addPerson(env, TOK.both, TESTEV.id, "Leak Two")).data.error, "session_org_mismatch");

  assert.deepEqual(expectedIn(d1, IMBUE.id), ["Queued For Imbue"]);
  assert.deepEqual(expectedIn(d1, TESTEV.id), ["New Token Person"]);
  // The new session belongs to the same user and is a normal 24 h session.
  const row = d1.get("SELECT user_id, expires_at FROM login_sessions WHERE token=?", newTok);
  assert.equal(row.user_id, "u-both");
  assert.ok(row.expires_at > NOW() + 3600);
});

test("choosing the same organisation again changes nothing", async () => {
  const { env, d1 } = makeEnv();
  await select(env, TOK.both, TESTEV.id);
  const again = await select(env, TOK.both, TESTEV.id);
  assert.equal(again.data.session_token, TOK.both);
  assert.equal(again.data.switched, false);
  assert.equal(d1.get("SELECT COUNT(*) AS n FROM login_sessions WHERE user_id='u-both'").n, 1);
});

test("a session can only be tied to an organisation its user has staff access to", async () => {
  const { env, d1 } = makeEnv();
  const notMember = await select(env, TOK.staffImbue, TESTEV.id);
  assert.equal(notMember.status, 403);
  assert.equal(notMember.data.error, "not_a_member");
  assert.equal((await select(env, TOK.staffImbue, "org-nope")).status, 404);
  assert.equal((await select(env, "sess_unknown_token_abcdefgh", IMBUE.id)).status, 401);
  assert.equal((await call(env, "POST", "/user/session/org", { token: TOK.staffImbue, body: {} })).status, 400);
  assert.equal(d1.get("SELECT COUNT(*) AS n FROM login_session_orgs").n, 0, "a refused choice ties nothing");
  // The Developer may choose any organisation (rule A1), but still one at a time.
  assert.equal((await select(env, TOK.dev, TESTEV.id)).status, 200);
});

test("/user/orgs says which organisation the session is tied to", async () => {
  const { env } = makeEnv();
  const before = await call(env, "GET", "/user/orgs", { token: TOK.dev });
  assert.equal(before.data.session_org_id, null);
  await select(env, TOK.dev, TESTEV.id);
  const after = await call(env, "GET", "/user/orgs", { token: TOK.dev });
  assert.equal(after.data.session_org_id, TESTEV.id);
  // The Developer's list still starts with the oldest membership (Imbue):
  // the reason the page must never just open the first one.
  assert.equal(after.data.orgs[0].id, IMBUE.id);
});

test("calls that carry the organisation in the body or URL are held to the session's organisation too", async () => {
  const { env } = makeEnv();
  await select(env, TOK.dev, TESTEV.id);
  const cases = [
    ["POST", "/org/invites/create", { org_id: IMBUE.id, role: "staff" }],
    ["POST", "/org/invites/revoke", { org_id: IMBUE.id, nonce: "n" }],
    ["POST", "/org/action/init", { action_type: "irlid_invite_v5", action_payload: { org_id: IMBUE.id } }],
    ["GET", "/org/kiosk/screens?org_id=" + IMBUE.id, undefined],
    ["POST", "/org/kiosk/screen/revoke", { org_id: IMBUE.id, kiosk_id: "ABCDEFGH" }],
    ["POST", "/user/orgs/" + IMBUE.id + "/scrape-theme", {}]
  ];
  for (const [method, path, body] of cases) {
    const r = await call(env, method, path, { token: TOK.dev, body });
    assert.equal(r.status, 403, method + " " + path);
    assert.equal(r.data.error, "session_org_mismatch", method + " " + path);
  }
});

test("signing out removes the tie; sign out of all devices removes every tie", async () => {
  const { env, d1 } = makeEnv();
  await select(env, TOK.both, IMBUE.id);
  const sw = await select(env, TOK.both, TESTEV.id);
  assert.equal(d1.get("SELECT COUNT(*) AS n FROM login_session_orgs").n, 2);
  assert.equal((await call(env, "POST", "/user/logout", { token: sw.data.session_token })).status, 200);
  assert.equal(d1.get("SELECT COUNT(*) AS n FROM login_session_orgs").n, 1);
  assert.equal((await call(env, "GET", "/org/settings", { token: sw.data.session_token, orgId: TESTEV.id })).status, 401, "a signed-out token is dead");
  assert.equal((await call(env, "POST", "/user/sign-out-all-devices", { token: TOK.both })).status, 200);
  assert.equal(d1.get("SELECT COUNT(*) AS n FROM login_session_orgs").n, 0);
  assert.equal(d1.get("SELECT COUNT(*) AS n FROM login_sessions WHERE user_id='u-both'").n, 0);
});

// A real P-256 public key for the "new phone" being added at the door.
async function newPhoneJwk() {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const j = await crypto.subtle.exportKey("jwk", kp.publicKey);
  return { kty: "EC", crv: "P-256", x: j.x, y: j.y };
}

test("add at the door is refused when the scanned QR names another organisation, and nothing is written", async () => {
  const { env, d1 } = makeEnv();
  const pub = await newPhoneJwk();
  // The incident: the dashboard sat in Imbue, the phone's QR said Test Event.
  for (const code of [TESTEV.slug, TESTEV.id, TESTEV.key]) {
    const r = await call(env, "POST", "/org/expected/create-and-bind", {
      token: TOK.dev, orgId: IMBUE.id,
      body: { first_name: "Bradley", surname: "Nephew", device_pub_jwk: pub, scan_org_code: code }
    });
    assert.equal(r.status, 409, "code " + code);
    assert.equal(r.data.error, "scan_org_mismatch");
    assert.equal(r.data.signed_in_org, "Imbue Ventures Ltd");
  }
  assert.deepEqual(expectedIn(d1, IMBUE.id), [], "Bradley was not added to Imbue");
});

test("link to an existing person is refused the same way", async () => {
  const { env, d1 } = makeEnv();
  d1.exec("INSERT INTO org_expected (id,org_id,display_name,initials,created_at) VALUES ('p1',?,?,?,0)", IMBUE.id, "Existing Person", "EP");
  const r = await call(env, "POST", "/org/expected/p1/bind-additional-key", {
    token: TOK.dev, orgId: IMBUE.id,
    body: { pub_jwk: await newPhoneJwk(), scan_org_code: TESTEV.slug }
  });
  assert.equal(r.status, 409);
  assert.equal(r.data.error, "scan_org_mismatch");
  assert.equal(d1.get("SELECT device_pub_fp FROM org_expected WHERE id='p1'").device_pub_fp, null, "no phone was linked");
});

test("a matching, missing or unknown scan code is not refused by this check (it only ever refuses)", async () => {
  const { env } = makeEnv();
  const pub = await newPhoneJwk();
  // Same organisation by slug, id or old key-style code; no code at all (old
  // page); a code that names no organisation (an old printed QR).
  for (const code of [IMBUE.slug, IMBUE.id, IMBUE.key, undefined, "some-old-printed-code"]) {
    const body = { first_name: "Right", surname: "Org", device_pub_jwk: pub };
    if (code !== undefined) body.scan_org_code = code;
    const r = await call(env, "POST", "/org/expected/create-and-bind", { token: TOK.dev, orgId: IMBUE.id, body });
    assert.notEqual(r.data && r.data.error, "scan_org_mismatch", "code " + code);
    // It still needs the staff member's signed approval, exactly as before.
    assert.ok(r.status >= 400, "no signed action was sent, so nothing is added (code " + code + ")");
  }
});

test("service accounts and pages that never tie their session keep working", async () => {
  const { env, d1 } = makeEnv();
  // Service account (X-Org-Key): no session, so no tie to check.
  const svc = await call(env, "GET", "/org/expected", { orgKey: IMBUE.key });
  assert.equal(svc.status, 200);
  // An old cached page: valid session, never calls /user/session/org.
  const old = await call(env, "GET", "/org/settings", { token: TOK.staffImbue, orgId: IMBUE.id });
  assert.equal(old.status, 200);
  // It is still held to the user's own memberships, as before.
  const other = await call(env, "GET", "/org/settings", { token: TOK.staffImbue, orgId: TESTEV.id });
  assert.equal(other.status, 403);
  assert.equal(other.data.error, "not_a_member");
  assert.equal(d1.get("SELECT COUNT(*) AS n FROM login_session_orgs").n, 0);
});

test("the table is created on demand, so the Worker works before the migration is applied", async () => {
  const { env, d1 } = makeEnv();
  d1.db.exec("DROP TABLE login_session_orgs");
  // A fresh database binding, as after a deploy.
  const fresh = { ...env, DB: { prepare: (sql) => d1.prepare(sql), batch: (s) => d1.batch(s) } };
  assert.equal((await select(fresh, TOK.dev, TESTEV.id)).status, 200);
  assert.equal((await addPerson(fresh, TOK.dev, IMBUE.id, "Leak")).data.error, "session_org_mismatch");
  assert.equal(d1.get("SELECT org_id FROM login_session_orgs WHERE token=?", TOK.dev).org_id, TESTEV.id);
});
