// v6.8.30 - hardening GET /org/active-checkin and GET /org/recognize (16/11 check).
// They stay open without a login because the attendee's phone calls them before
// it checks in (org-entry.html renderVenue), and attendees never sign in (C1, E1).
// But a device key fingerprint is in every receipt, so on its own it must not
// return a person's name (S2). Full answers go only to the phone that proves it
// holds the key (fresh signature), or to a staff-tier session for the org; old
// cached pages keep the full answer until the cutoff; everyone else gets yes/no
// from recognize and nothing from active-checkin (v6.8.30 review: a page that
// cannot check out with that answer must just check in instead).
// Made-up names only. Runs the Worker's real SQL.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../src/index.js";
import { SqliteD1 } from "./helpers/sqlite-d1.mjs";
import { newDevice, hashHello, b64url } from "./helpers/signed-checkin.mjs";

const T = Math.floor(Date.now() / 1000);
const LIVE = `
  DROP TABLE org_expected;
  CREATE TABLE org_expected (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, display_name TEXT NOT NULL, initials TEXT,
    role_key TEXT DEFAULT 'attendee', device_pub_fp TEXT, email_hint TEXT, phone_hint TEXT, notes TEXT,
    created_at INTEGER NOT NULL, archived_at INTEGER);
  CREATE TABLE IF NOT EXISTS expected_device_keys (org_id TEXT, expected_id INTEGER, device_key_fp TEXT, revoked_at INTEGER);
`;
const PAST = "1";                       // cutoff passed: unsigned calls get yes/no
const FUTURE = String(T + 30 * 86400);  // still in the grace period

async function setup({ cutoff = PAST } = {}) {
  const d1 = new SqliteD1(LIVE);
  for (const [id, slug, key] of [["org-1", "sample-club", "org_sample_key_1234567890abcdef"], ["org-2", "other-club", "org_other_key_1234567890abcdefg"]]) {
    d1.exec("INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES (?,?,?,?,'{}',0,0)", id, id === "org-1" ? "Sample Club" : "Other Club", slug, key);
  }
  const phone = await newDevice();
  const stranger = await newDevice();
  d1.exec("INSERT INTO org_expected (id,org_id,display_name,device_pub_fp,created_at) VALUES ('p1','org-1','Sam Example',?,?)", phone.fp, T);
  d1.exec("INSERT INTO org_checkins (id,org_id,mode,name,device_key_fp,checkin_at,created_at,status) VALUES ('ci-1','org-1','attendee_scan','Sam Example',?,?,?,'checked_in')", phone.fp, T - 60, T - 60);
  const user = (id, fp) => d1.exec("INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES (?,'{}',?,?,0,0)", id, fp, id);
  user("u-staff", "fp_staff_000001"); user("u-other", "fp_other_000001");
  d1.exec("INSERT INTO org_memberships (org_id,user_id,role,granted_at) VALUES ('org-1','u-staff','staff',1)");
  d1.exec("INSERT INTO org_memberships (org_id,user_id,role,granted_at) VALUES ('org-2','u-other','lead_admin',1)");
  for (const [tok, uid] of [["sess_staff_one_abcdefghijklmno", "u-staff"], ["sess_other_lead_abcdefghijklmn", "u-other"]]) {
    d1.exec("INSERT INTO login_sessions (token,user_id,issued_at,expires_at) VALUES (?,?,?,?)", tok, uid, T, T + 3600);
  }
  return { d1, phone, stranger, env: { DB: d1, CORS_ORIGIN: "*", DEVICE_LOOKUP_SIGNING_CUTOFF: cutoff } };
}

// The header org-entry.html sends (deviceLookupHeaders).
async function proof(device, { kind, org = "sample-club", ts = Math.floor(Date.now() / 1000), pub = device.pub, tamper } = {}) {
  const payload = { mode: "device_lookup", kind, org, pub, ts, v: 1 };
  const sig = await device.sign(await hashHello(payload));
  if (tamper) tamper(payload);
  return b64url(new TextEncoder().encode(JSON.stringify({ payload, sig })));
}

async function lookup(env, kind, fp, { proofHeader, token, orgId, orgKey = "sample-club", ip } = {}) {
  const headers = {};
  if (orgKey) headers["X-Org-Key"] = orgKey;
  if (orgId) headers["X-Org-Id"] = orgId;
  if (token) headers.Authorization = "Bearer " + token;
  if (proofHeader) headers["X-Device-Proof"] = proofHeader;
  if (ip) headers["CF-Connecting-IP"] = ip;
  const res = await worker.fetch(new Request(`https://worker.test/org/${kind}?device_pub=${encodeURIComponent(fp)}`, { headers }), env, { waitUntil() {} });
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch (_) {}
  return { status: res.status, data, text };
}
// (a) The phone's decision in org-entry.html renderVenue, run on each answer.
const showsCheckOut = (active) => !!(active?.active && active.checkin_id);
const noDetail = (r) => !/Sam Example|ci-1|checkin_at|checkin_id|expected_id|rescan_|"name"/.test(r.text);

// ---- allowed: the phone that holds the key ----
test("ALLOWED: the phone that signs with its own key gets its check-in, to offer check-out (C4)", async () => {
  const { env, phone } = await setup();
  const r = await lookup(env, "active-checkin", phone.fp, { proofHeader: await proof(phone, { kind: "active-checkin" }) });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.data.active, true);
  assert.equal(r.data.checkin_id, "ci-1");
  assert.equal(r.data.name, "Sam Example");
  assert.match(r.data.nonce, /^rescan_/);
  assert.equal(r.data.limited, undefined);
});

test("ALLOWED: the phone that signs gets its own name from recognize, and nothing more (no record id)", async () => {
  const { env, phone } = await setup();
  const r = await lookup(env, "recognize", phone.fp, { proofHeader: await proof(phone, { kind: "recognize" }) });
  assert.deepEqual(r.data, { recognized: true, name: "Sam Example" });
});

test("ALLOWED: a staff-tier session for the org gets the full answer (dashboard)", async () => {
  const { env, phone } = await setup();
  const r = await lookup(env, "recognize", phone.fp, { token: "sess_staff_one_abcdefghijklmno", orgId: "org-1", orgKey: null });
  assert.deepEqual(r.data, { recognized: true, name: "Sam Example", expected_id: "p1" });
});

test("ALLOWED (grace): an old cached page with no signature still gets the full answer until the cutoff", async () => {
  const { env, phone } = await setup({ cutoff: FUTURE });
  const a = await lookup(env, "active-checkin", phone.fp);
  assert.equal(a.data.checkin_id, "ci-1");
  const r = await lookup(env, "recognize", phone.fp);
  assert.equal(r.data.name, "Sam Example");
});

test("unknown phone: plain no when it proves its key; an unproven active-checkin says nothing", async () => {
  const { env, stranger } = await setup();
  assert.deepEqual((await lookup(env, "active-checkin", stranger.fp, { proofHeader: await proof(stranger, { kind: "active-checkin" }) })).data, { active: false });
  assert.deepEqual((await lookup(env, "recognize", stranger.fp, { proofHeader: await proof(stranger, { kind: "recognize" }) })).data, { recognized: false });
  assert.deepEqual((await lookup(env, "active-checkin", stranger.fp)).data, { limited: true });
});

// ---- refused: a fingerprint alone (as in a receipt) ----
test("REFUSED: a fingerprint alone, after the cutoff: active-checkin says nothing, recognize yes/no only", async () => {
  const { env, phone } = await setup();
  const a = await lookup(env, "active-checkin", phone.fp);
  assert.equal(a.status, 200);
  assert.deepEqual(a.data, { limited: true }, "not even whether this phone is checked in");
  const r = await lookup(env, "recognize", phone.fp);
  assert.deepEqual(r.data, { recognized: true, limited: true });
  assert.ok(noDetail(a) && noDetail(r));
});

test("(a) a limited answer never shows Check out: the phone goes on to check in (old page after 9 Dec, or clock more than 2 min out)", async () => {
  const { env, phone } = await setup();
  // old cached page after the cutoff: no proof
  const oldPage = await lookup(env, "active-checkin", phone.fp);
  // new page whose phone clock is 5 minutes slow: proof refused
  const slowClock = await lookup(env, "active-checkin", phone.fp, { proofHeader: await proof(phone, { kind: "active-checkin", ts: Math.floor(Date.now() / 1000) - 300 }) });
  for (const r of [oldPage, slowClock]) {
    assert.equal(showsCheckOut(r.data), false, JSON.stringify(r.data));
    assert.equal(r.data.active, undefined, "an old page reads active?.active, so it must be falsy too");
  }
  // the right phone with a good clock still gets check-out
  const good = await lookup(env, "active-checkin", phone.fp, { proofHeader: await proof(phone, { kind: "active-checkin" }) });
  assert.equal(showsCheckOut(good.data), true);
});

test("REFUSED: the org key alone is not enough (old printed QRs carried it)", async () => {
  const { env, phone } = await setup();
  const r = await lookup(env, "recognize", phone.fp, { orgKey: "org_sample_key_1234567890abcdef" });
  assert.deepEqual(r.data, { recognized: true, limited: true });
});

test("REFUSED: a bad proof never gets details, even during the grace period", async () => {
  const { env, phone, stranger } = await setup({ cutoff: FUTURE });
  const cases = {
    "signed by another key": await proof(stranger, { kind: "recognize", pub: stranger.pub }),
    "another key's pub claimed": await proof(stranger, { kind: "recognize", pub: phone.pub }),
    "signed for another org": await proof(phone, { kind: "recognize", org: "other-club" }),
    "signed for the other lookup": await proof(phone, { kind: "active-checkin" }),
    "older than 120 s": await proof(phone, { kind: "recognize", ts: Math.floor(Date.now() / 1000) - 200 }),
    "too far in the future": await proof(phone, { kind: "recognize", ts: Math.floor(Date.now() / 1000) + 200 }),
    "payload changed after signing": await proof(phone, { kind: "recognize", tamper: p => { p.v = 2; } }),
    "not JSON": "bm90IGpzb24",
    "empty object": b64url(new TextEncoder().encode("{}"))
  };
  for (const [name, header] of Object.entries(cases)) {
    const r = await lookup(env, "recognize", phone.fp, { proofHeader: header });
    assert.equal(r.status, 200, name);
    assert.deepEqual(r.data, { recognized: true, limited: true }, name);
  }
});

test("REFUSED: staff of another organisation get yes/no only", async () => {
  const { env, phone } = await setup();
  const r = await lookup(env, "active-checkin", phone.fp, { token: "sess_other_lead_abcdefghijklmn" });
  assert.deepEqual(r.data, { limited: true });
});

test("REFUSED: a signed proof from org A's page never answers for org B", async () => {
  const { env, phone } = await setup();
  const r = await lookup(env, "active-checkin", phone.fp, { orgKey: "other-club", proofHeader: await proof(phone, { kind: "active-checkin" }) });
  assert.deepEqual(r.data, { limited: true }, "the proof is for org A, so org B treats it as unproven");
});

// ---- rate limits ----
test("RATE LIMIT: one device key is limited to 20 lookups a minute per org; other phones are unaffected", async () => {
  const { env, phone, stranger } = await setup();
  for (let i = 0; i < 20; i++) assert.equal((await lookup(env, "recognize", phone.fp, { ip: "203.0.113.1" })).status, 200, "call " + (i + 1));
  const over = await lookup(env, "recognize", phone.fp, { ip: "203.0.113.2" });
  assert.equal(over.status, 429);
  assert.equal(over.data.error, "rate_limited");
  assert.equal(over.data.retry_after, 60);
  assert.ok(noDetail(over));
  assert.equal((await lookup(env, "recognize", stranger.fp, { ip: "203.0.113.1" })).status, 200);
});

test("RATE LIMIT: unproven lookups from one network: 600 a minute per org; another network or org is not blocked", async () => {
  const { env } = await setup();
  let lastOk = 0;
  for (let i = 0; i < 600; i++) {
    const r = await lookup(env, "recognize", "fp_guess_" + String(i).padStart(7, "0"), { ip: "198.51.100.7" });
    if (r.status === 200) lastOk = i + 1;
  }
  assert.equal(lastOk, 600);
  assert.equal((await lookup(env, "recognize", "fp_guess_extra001", { ip: "198.51.100.7" })).status, 429);
  assert.equal((await lookup(env, "recognize", "fp_guess_extra001", { ip: "198.51.100.8" })).status, 200, "another network is not blocked");
  assert.equal((await lookup(env, "recognize", "fp_guess_extra001", { orgKey: "other-club", ip: "198.51.100.7" })).status, 200, "another org is not blocked");
});

test("RATE LIMIT: signed lookups never count towards the network limit (a busy door of new phones is never slowed)", async () => {
  const { env, phone, stranger } = await setup();
  // the network is used up by unproven lookups...
  for (let i = 0; i < 600; i++) await lookup(env, "recognize", "fp_fill_" + String(i).padStart(7, "0"), { ip: "198.51.100.9" });
  assert.equal((await lookup(env, "recognize", "fp_fill_extra0001", { ip: "198.51.100.9" })).status, 429);
  // ...and real phones on the same Wi-Fi still get their own answers
  for (const dev of [phone, stranger]) {
    for (const kind of ["active-checkin", "recognize"]) {
      const r = await lookup(env, kind, dev.fp, { ip: "198.51.100.9", proofHeader: await proof(dev, { kind }) });
      assert.equal(r.status, 200, kind);
    }
  }
});

test("RATE LIMIT (b): someone with a receipt fingerprint cannot block that person's phone", async () => {
  const { env, phone } = await setup();
  // 25 unproven lookups for the victim's fingerprint, from anywhere
  for (let i = 0; i < 25; i++) await lookup(env, "active-checkin", phone.fp, { ip: "203.0.113." + (i % 5) });
  assert.equal((await lookup(env, "active-checkin", phone.fp, { ip: "203.0.113.50" })).status, 429, "unproven lookups for that key are capped");
  // the real phone signs, so it is not affected
  const mine = await lookup(env, "active-checkin", phone.fp, { proofHeader: await proof(phone, { kind: "active-checkin" }) });
  assert.equal(mine.status, 200);
  assert.equal(mine.data.checkin_id, "ci-1");
  const rec = await lookup(env, "recognize", phone.fp, { proofHeader: await proof(phone, { kind: "recognize" }) });
  assert.equal(rec.data.name, "Sam Example");
});

test("RATE LIMIT: a phone's own signed lookups are capped at 60 a minute (its own bucket)", async () => {
  const { env, phone } = await setup();
  const header = await proof(phone, { kind: "recognize" });
  for (let i = 0; i < 60; i++) assert.equal((await lookup(env, "recognize", phone.fp, { proofHeader: header })).status, 200, "call " + (i + 1));
  assert.equal((await lookup(env, "recognize", phone.fp, { proofHeader: header })).status, 429);
});

test("answers are never cached by the browser", async () => {
  const { env, phone } = await setup();
  const res = await worker.fetch(new Request(`https://worker.test/org/recognize?device_pub=${phone.fp}`, { headers: { "X-Org-Key": "sample-club" } }), env, { waitUntil() {} });
  assert.match(res.headers.get("Cache-Control") || "", /no-store/);
});

test("CORS lets the phone send the proof header", async () => {
  const { env } = await setup();
  const res = await worker.fetch(new Request("https://worker.test/org/recognize", { method: "OPTIONS", headers: { Origin: "https://irlid.co.uk", "Access-Control-Request-Headers": "x-device-proof" } }), env, { waitUntil() {} });
  assert.match(res.headers.get("Access-Control-Allow-Headers") || "", /X-Device-Proof/);
});

test("org-entry.html signs both lookups with the device key, and check-in still goes ahead if they fail", () => {
  const html = readFileSync(new URL("../../org-entry.html", import.meta.url), "utf8");
  assert.match(html, /const payload = \{ mode: "device_lookup", kind, org: orgParam, pub, ts: Math\.floor\(Date\.now\(\) \/ 1000\), v: 1 \};/);
  assert.match(html, /"X-Device-Proof": b64urlEncode/);
  assert.match(html, /await activeCheckinForDevice\(fp, pub\)/);
  // (a) check-out is offered only with a real check-in id; a limited answer
  // goes on to the normal check-in (which says "already signed in", C4)
  assert.match(html, /if \(active\?\.active && active\.checkin_id\) \{\s*renderCheckoutChoice\(active\);/);
  assert.match(html, /await recognizeDevice\(fp, pub\)/);
  assert.doesNotMatch(html, /getOrgAuthed\(`\/org\/recognize\?device_pub=\$\{encodeURIComponent\(fp\)\}`\)/, "no unsigned recognize left");
  // a failed lookup (429, network) carries on to the normal check-in (C13)
  const venue = html.slice(html.indexOf("async function renderVenue"), html.indexOf("async function continueVenueWalkin"));
  assert.match(venue, /catch \(err\) \{[\s\S]*continueVenueWalkin\(\);/);
});
