// Kiosk lock (org setting "Lock full screen", off by default).
// Leaving the full screen check-in QR needs a one-time unlock code signed by
// a staff-tier member's enrolled v5 phone (S5, S6). These tests cover the
// Worker side: the setting is off by default and needs a Lead Admin session
// to change, the unlock action is built by the Worker, only a staff-tier
// signer can claim it, and each code works once.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import worker from "../src/index.js";

const ORG_KEY = "org_kiosk_test_key_1234567890";
const SCHEMA = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");

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
  constructor(settings = {}) {
    this.db = new DatabaseSync(":memory:");
    this.db.exec(SCHEMA);
    this.db.prepare("INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES (?,?,?,?,?,0,0)")
      .run("org-1", "Kiosk Org", "kiosk-org", ORG_KEY, JSON.stringify(settings));
  }
  prepare(sql) { return new D1Statement(this.db, sql); }
  async batch(statements) { const out = []; for (const s of statements) out.push(await s.run()); return out; }
  settings() { return JSON.parse(this.db.prepare("SELECT settings_json FROM organisations WHERE id='org-1'").get().settings_json); }
}

// ---- v5 helpers (mirror js/sign.js + the Worker's verifier) ----
function b64u(bytes) { return Buffer.from(bytes).toString("base64url"); }
function canonical(val) {
  if (val === null || typeof val !== "object") return JSON.stringify(val);
  if (Array.isArray(val)) return "[" + val.map(canonical).join(",") + "]";
  return "{" + Object.keys(val).sort().map(k => JSON.stringify(k) + ":" + canonical(val[k])).join(",") + "}";
}
async function sha256(bytes) { return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)); }

async function makeDevice() {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
  const pub = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
  const fp = b64u(await sha256(new TextEncoder().encode(canonical(pub)))).slice(0, 16);
  return { kp, pub, fp };
}

async function signV5(device, payload) {
  const challenge = b64u(await sha256(new TextEncoder().encode(canonical(payload))));
  const clientData = new TextEncoder().encode(JSON.stringify({ type: "webauthn.get", challenge, origin: "https://irlid.co.uk" }));
  const authData = new Uint8Array(37);
  authData[32] = 0x05; // UP + UV
  const signed = new Uint8Array(37 + 32);
  signed.set(authData, 0);
  signed.set(await sha256(clientData), 37);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, device.kp.privateKey, signed));
  return { payload, pub: device.pub, sig: b64u(sig), webauthn: { authData: b64u(authData), clientData: b64u(clientData) } };
}

function addUser(d1, id, device, role) {
  d1.db.prepare("INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES (?,?,?,?,0,0)")
    .run(id, JSON.stringify(device.pub), device.fp, id);
  if (role) {
    d1.db.prepare("INSERT INTO org_memberships (org_id,user_id,role,granted_at) VALUES (?,?,?,0)").run("org-1", id, role);
  }
}

function addSession(d1, userId) {
  const token = "sess_" + userId + "_abcdefghijklmnop";
  d1.db.prepare("INSERT INTO login_sessions (token,user_id,issued_at,expires_at) VALUES (?,?,?,?)")
    .run(token, userId, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000) + 3600);
  return token;
}

async function call(d1, method, path, body, { orgKey, session, secret } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (orgKey) headers["X-Org-Key"] = orgKey;
  if (session) headers.Authorization = "Bearer " + session;
  if (secret) headers["X-Kiosk-Secret"] = secret;
  const res = await worker.fetch(new Request("https://worker.test" + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  }), Object.assign({ DB: d1, CORS_ORIGIN: "*" }, d1.env || {}));
  return { status: res.status, body: await res.json() };
}

async function setup(settings = { lockFullscreen: true }) {
  const d1 = new D1(settings);
  const kioskDevice = await makeDevice();
  const staffPhone = await makeDevice();
  const attendeePhone = await makeDevice();
  addUser(d1, "kiosk-admin", kioskDevice, "lead_admin");
  addUser(d1, "staff-1", staffPhone, "staff");
  addUser(d1, "attendee-1", attendeePhone, "attendee");
  const kioskSession = addSession(d1, "kiosk-admin");
  return { d1, kioskSession, kioskDevice, staffPhone, attendeePhone };
}

const initUnlock = (d1, session, extra = {}) => call(d1, "POST", "/org/action/init", {
  action_type: "irlid_kiosk_unlock_v5",
  action_payload: Object.assign({ org_id: "org-1" }, extra),
  action_summary: "anything the kiosk says"
}, { session });

async function claimWith(d1, device, nonce, mutate) {
  const polled = await call(d1, "GET", "/org/action/poll/" + nonce);
  assert.equal(polled.body.status, "pending");
  let payload = polled.body.action_payload;
  if (mutate) payload = mutate(structuredClone(payload));
  const env = await signV5(device, payload);
  return call(d1, "POST", "/org/action/claim", { nonce, signed_envelope: env });
}

test("Lock full screen is off by default and not in a new org's settings", async () => {
  const d1 = new D1({});
  const res = await call(d1, "GET", "/org/settings", null, { orgKey: ORG_KEY });
  assert.equal(res.status, 200);
  assert.notEqual(res.body.settings.lockFullscreen, true);
});

test("turning the lock on or off needs a Lead Admin session, not just the org key", async () => {
  const { d1, kioskSession, staffPhone } = await setup({});
  let res = await call(d1, "POST", "/org/settings", { lockFullscreen: true }, { orgKey: ORG_KEY });
  assert.equal(res.status, 403, JSON.stringify(res.body));
  assert.notEqual(d1.settings().lockFullscreen, true);

  const staffSession = addSession(d1, "staff-1");
  res = await call(d1, "POST", "/org/settings", { lockFullscreen: true }, { orgKey: ORG_KEY, session: staffSession });
  assert.equal(res.status, 403, JSON.stringify(res.body));

  res = await call(d1, "POST", "/org/settings", { lockFullscreen: true }, { orgKey: ORG_KEY, session: kioskSession });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(d1.settings().lockFullscreen, true);

  // Off again with the key alone is refused too (otherwise the key defeats the lock).
  res = await call(d1, "POST", "/org/settings", { lockFullscreen: false }, { orgKey: ORG_KEY });
  assert.equal(res.status, 403);
  assert.equal(d1.settings().lockFullscreen, true);

  // A full-form save that sends the unchanged value needs nothing extra.
  res = await call(d1, "POST", "/org/settings", { lockFullscreen: true, minScore: 40 }, { orgKey: ORG_KEY });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  res = await call(d1, "POST", "/org/settings", { lockFullscreen: "yes" }, { orgKey: ORG_KEY, session: kioskSession });
  assert.equal(res.status, 400);
  void staffPhone;
});

test("unlock code: Worker builds the payload and summary, not the kiosk", async () => {
  const { d1, kioskSession } = await setup();
  const init = await initUnlock(d1, kioskSession, { purpose: "something_else", role: "lead_admin" });
  assert.equal(init.status, 200, JSON.stringify(init.body));
  assert.match(init.body.auth_url, /org-action-auth\.html\?nonce=/);
  const polled = await call(d1, "GET", "/org/action/poll/" + init.body.nonce);
  assert.equal(polled.body.action_type, "irlid_kiosk_unlock_v5");
  assert.equal(polled.body.action_summary, "Unlock the kiosk screen (leave full screen)");
  assert.deepEqual(Object.keys(polled.body.action_payload).sort(), ["nonce", "org_id", "purpose", "timestamp", "type"]);
  assert.equal(polled.body.action_payload.purpose, "exit_fullscreen");
  assert.equal(polled.body.action_payload.org_id, "org-1");
});

test("unlock code is refused when the org has the lock off", async () => {
  const { d1, kioskSession } = await setup({});
  const init = await initUnlock(d1, kioskSession);
  assert.equal(init.status, 409);
  assert.equal(init.body.error, "kiosk_lock_off");
});

test("unlock code needs a signed-in session on the kiosk", async () => {
  const { d1 } = await setup();
  const init = await call(d1, "POST", "/org/action/init", { action_type: "irlid_kiosk_unlock_v5", action_payload: { org_id: "org-1" } }, { orgKey: ORG_KEY });
  assert.equal(init.status, 401);
});

test("a staff phone's v5 signature unlocks, once; the audit log records it", async () => {
  const { d1, kioskSession, staffPhone } = await setup();
  const init = await initUnlock(d1, kioskSession);
  const claim = await claimWith(d1, staffPhone, init.body.nonce);
  assert.equal(claim.status, 200, JSON.stringify(claim.body));
  assert.deepEqual(claim.body.action_result, { unlocked: true });

  const polled = await call(d1, "GET", "/org/action/poll/" + init.body.nonce);
  assert.equal(polled.body.status, "claimed");
  assert.equal(polled.body.action_result.unlocked, true);

  // S6: single use. The same code cannot be claimed again.
  const env = await signV5(staffPhone, polled.body.action_payload || { type: "irlid_kiosk_unlock_v5" });
  const again = await call(d1, "POST", "/org/action/claim", { nonce: init.body.nonce, signed_envelope: env });
  assert.equal(again.status, 409);

  const audit = d1.db.prepare("SELECT action, outcome, actor_role FROM org_audit_log WHERE org_id='org-1'").all();
  assert.ok(audit.some(r => r.action === "irlid_kiosk_unlock_v5" && r.outcome === "allowed" && r.actor_role === "staff"), JSON.stringify(audit));
});

test("an attendee's or unknown phone cannot unlock; the kiosk stays locked", async () => {
  const { d1, kioskSession, attendeePhone } = await setup();
  const init = await initUnlock(d1, kioskSession);
  const claim = await claimWith(d1, attendeePhone, init.body.nonce);
  assert.equal(claim.status, 403, JSON.stringify(claim.body));
  let polled = await call(d1, "GET", "/org/action/poll/" + init.body.nonce);
  assert.equal(polled.body.status, "pending");

  const stranger = await makeDevice();
  const claim2 = await claimWith(d1, stranger, init.body.nonce);
  assert.equal(claim2.status, 403, JSON.stringify(claim2.body));
  polled = await call(d1, "GET", "/org/action/poll/" + init.body.nonce);
  assert.equal(polled.body.status, "pending");
});

test("a changed payload or bad signature does not unlock", async () => {
  const { d1, kioskSession, staffPhone } = await setup();
  const init = await initUnlock(d1, kioskSession);
  const tampered = await claimWith(d1, staffPhone, init.body.nonce, p => Object.assign(p, { purpose: "admin" }));
  assert.equal(tampered.status, 400);

  const polled = await call(d1, "GET", "/org/action/poll/" + init.body.nonce);
  const env = await signV5(staffPhone, polled.body.action_payload);
  env.sig = env.sig.slice(0, -4) + (env.sig.slice(-4) === "AAAA" ? "BBBB" : "AAAA");
  const bad = await call(d1, "POST", "/org/action/claim", { nonce: init.body.nonce, signed_envelope: env });
  assert.equal(bad.status, 401, JSON.stringify(bad.body));
  const after = await call(d1, "GET", "/org/action/poll/" + init.body.nonce);
  assert.equal(after.body.status, "pending");
});

test("an unlock code cannot be used for a different action, and vice versa", async () => {
  const { d1, kioskSession, staffPhone } = await setup();
  const init = await initUnlock(d1, kioskSession);
  // Sign the kiosk payload but relabel it as a calendar write: refused.
  const relabel = await claimWith(d1, staffPhone, init.body.nonce, p => Object.assign(p, { type: "irlid_calendar_write_v5" }));
  assert.equal(relabel.status, 400);
});

// ---- Kiosk mode setting ----

test("Kiosk mode is off by default and needs a Lead Admin session to change", async () => {
  const { d1, kioskSession } = await setup({});
  let res = await call(d1, "POST", "/org/settings", { kioskMode: true }, { orgKey: ORG_KEY });
  assert.equal(res.status, 403);
  assert.notEqual(d1.settings().kioskMode, true);
  const staffSession = addSession(d1, "staff-1");
  res = await call(d1, "POST", "/org/settings", { kioskMode: true }, { orgKey: ORG_KEY, session: staffSession });
  assert.equal(res.status, 403);
  res = await call(d1, "POST", "/org/settings", { kioskMode: true }, { orgKey: ORG_KEY, session: kioskSession });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(d1.settings().kioskMode, true);
  res = await call(d1, "POST", "/org/settings", { kioskMode: false }, { orgKey: ORG_KEY });
  assert.equal(res.status, 403);
  res = await call(d1, "POST", "/org/settings", { kioskMode: 1 }, { orgKey: ORG_KEY, session: kioskSession });
  assert.equal(res.status, 400);
});

test("Kiosk mode on its own allows the staff unlock QR (it always locks)", async () => {
  const { d1, kioskSession } = await setup({ kioskMode: true });
  const init = await initUnlock(d1, kioskSession);
  assert.equal(init.status, 200, JSON.stringify(init.body));
});

// ---- Offline unlock codes ----

function enrolPayload(seedBytes, keyId = "KEYAAAAAAAAAAAAAAAAA") {
  return {
    type: "irlid_kiosk_code_enrol_v5",
    org_id: "org-1",
    key_id: keyId,
    seed: Buffer.from(seedBytes).toString("base64url"),
    nonce: "nonce_" + Math.random().toString(36).slice(2) + "_padpadpad",
    timestamp: Date.now()
  };
}
const enrol = async (d1, device, payload) =>
  call(d1, "POST", "/org/kiosk/code-key", { signed_action: await signV5(device, payload) });
const fetchKeys = (d1, session, kioskId = "AB12CD34EF", secret) =>
  call(d1, "GET", "/org/kiosk/code-keys?org_id=org-1&kiosk_id=" + kioskId, null, { session, secret: secret === undefined ? (d1.secrets && d1.secrets[kioskId]) : secret });

// A Lead Admin / Developer approves a screen for offline codes: the screen
// (its own session) asks for an approval QR, the admin's phone signs it.
async function newScreenSecret() {
  const secret = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const hash = Buffer.from(await sha256(new TextEncoder().encode(secret))).toString("base64url");
  return { secret, hash };
}
async function requestScreenApproval(d1, session, kioskId, hash) {
  return call(d1, "POST", "/org/action/init", {
    action_type: "irlid_kiosk_screen_approve_v5",
    action_payload: { org_id: "org-1", kiosk_id: kioskId, secret_hash: hash },
    action_summary: "the screen's own words are ignored"
  }, { session });
}
async function approveScreen(d1, session, approverDevice, kioskId = "AB12CD34EF") {
  const { secret, hash } = await newScreenSecret();
  const init = await requestScreenApproval(d1, session, kioskId, hash);
  assert.equal(init.status, 200, JSON.stringify(init.body));
  const claim = await claimWith(d1, approverDevice, init.body.nonce);
  assert.equal(claim.status, 200, JSON.stringify(claim.body));
  d1.secrets = Object.assign(d1.secrets || {}, { [kioskId]: secret });
  return { secret, nonce: init.body.nonce, claim };
}

async function hmac(keyBytes, text) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text)));
}

async function setupOffline({ approve = true } = {}) {
  const ctx = await setup({ kioskMode: true });
  ctx.leadPhone = await makeDevice();
  addUser(ctx.d1, "lead-2", ctx.leadPhone, "lead_admin");
  ctx.managerPhone = await makeDevice();
  addUser(ctx.d1, "manager-1", ctx.managerPhone, "manager");
  if (approve) for (const id of ["AB12CD34EF", "AB12CD34EG", "RACE1234AB"]) await approveScreen(ctx.d1, ctx.kioskSession, ctx.kioskDevice, id);
  return ctx;
}

test("only a Lead Admin's or Developer's hardware key can set up offline codes", async () => {
  const { d1, leadPhone, managerPhone, staffPhone, attendeePhone } = await setupOffline();
  for (const phone of [managerPhone, staffPhone, attendeePhone]) {
    const res = await enrol(d1, phone, enrolPayload(new Uint8Array(32).fill(1)));
    assert.equal(res.status, 403, JSON.stringify(res.body));
  }
  const ok = await enrol(d1, leadPhone, enrolPayload(new Uint8Array(32).fill(2)));
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  // A bad signature or an extra field is refused.
  const env = await signV5(leadPhone, enrolPayload(new Uint8Array(32).fill(3), "KEYBBBBBBBBBBBBBBBBB"));
  env.payload = Object.assign({}, env.payload, { role: "developer" });
  const bad = await call(d1, "POST", "/org/kiosk/code-key", { signed_action: env });
  assert.equal(bad.status >= 400 && bad.status < 500, true);
  // A seed that isn't 32 bytes is refused.
  const short = enrolPayload(new Uint8Array(8), "KEYCCCCCCCCCCCCCCCCC");
  const res = await enrol(d1, leadPhone, short);
  assert.equal(res.status, 400);
});

test("each screen gets its own key, never the seed; codes match what the phone makes", async () => {
  const { d1, kioskSession, leadPhone } = await setupOffline();
  const seed = new Uint8Array(32).fill(5);
  await enrol(d1, leadPhone, enrolPayload(seed));
  const a = await fetchKeys(d1, kioskSession, "AB12CD34EF");
  const b = await fetchKeys(d1, kioskSession, "AB12CD34EG");
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(a.body.keys.length, 1);
  assert.notEqual(a.body.keys[0].k, b.body.keys[0].k);
  assert.equal(JSON.stringify(a.body).includes(Buffer.from(seed).toString("base64url")), false);
  const phoneKey = await hmac(seed, "irlid-kiosk-code|org-1|AB12CD34EF");
  assert.equal(a.body.keys[0].k, Buffer.from(phoneKey).toString("base64url"));
});

test("setting up again replaces the old seed; losing the role drops the key", async () => {
  const { d1, kioskSession, leadPhone } = await setupOffline();
  await enrol(d1, leadPhone, enrolPayload(new Uint8Array(32).fill(5), "KEYOLDOLDOLDOLDOLDOL"));
  await enrol(d1, leadPhone, enrolPayload(new Uint8Array(32).fill(6), "KEYNEWNEWNEWNEWNEWNE"));
  let keys = (await fetchKeys(d1, kioskSession)).body.keys;
  assert.deepEqual(keys.map(k => k.key_id), ["KEYNEWNEWNEWNEWNEWNE"]);
  d1.db.prepare("UPDATE org_memberships SET role='staff' WHERE user_id='lead-2'").run();
  keys = (await fetchKeys(d1, kioskSession)).body.keys;
  assert.equal(keys.length, 0);
});

test("screen keys need a signed-in member session and the lock on", async () => {
  const { d1, leadPhone, kioskSession } = await setupOffline();
  await enrol(d1, leadPhone, enrolPayload(new Uint8Array(32).fill(5)));
  assert.equal((await call(d1, "GET", "/org/kiosk/code-keys?org_id=org-1&kiosk_id=AB12CD34EF", null, { orgKey: ORG_KEY })).status, 401);
  const attendeeSession = addSession(d1, "attendee-1");
  assert.equal((await fetchKeys(d1, attendeeSession)).status, 403);
  assert.equal((await fetchKeys(d1, kioskSession, "bad id!")).status, 400);
  d1.db.prepare("UPDATE organisations SET settings_json='{}' WHERE id='org-1'").run();
  assert.equal((await fetchKeys(d1, kioskSession)).status, 409);
});

test("offline unlocks are written to the audit log when the screen is back online, once", async () => {
  const { d1, kioskSession, leadPhone } = await setupOffline();
  await enrol(d1, leadPhone, enrolPayload(new Uint8Array(32).fill(5), "KEYLOGLOGLOGLOGLOGLO"));
  const entries = [
    { key_id: "KEYLOGLOGLOGLOGLOGLO", challenge: "ABCD2345", at: Date.now() - 60000, outcome: "allowed" },
    { challenge: "WXYZ6789", at: Date.now() - 30000, outcome: "denied" },
    { key_id: "unknown-key", challenge: "QRST2345", at: Date.now(), outcome: "allowed" }
  ];
  const body = { org_id: "org-1", kiosk_id: "AB12CD34EF", entries };
  let res = await call(d1, "POST", "/org/kiosk/offline-unlock-log", body, { session: kioskSession });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  // Every well-formed entry is recorded, an unknown key too (no silent loss).
  assert.equal(res.body.recorded, 3);
  assert.equal(res.body.skipped, 0);
  res = await call(d1, "POST", "/org/kiosk/offline-unlock-log", body, { session: kioskSession });
  assert.equal(res.body.recorded, 0);
  assert.equal(res.body.skipped, 3);
  const rows = d1.db.prepare("SELECT actor_user_id, actor_role, actor_display_name, outcome, action, detail FROM org_audit_log WHERE action='irlid_kiosk_offline_unlock_v5' ORDER BY outcome, detail").all();
  assert.equal(rows.length, 3);
  // Honest attribution: no actor. The screen reported it.
  for (const r of rows) {
    assert.equal(r.actor_user_id, null);
    assert.equal(r.actor_role, null);
    assert.match(r.actor_display_name, /kiosk-reported/);
  }
  assert.equal(rows.filter(r => r.outcome === "denied").length, 1);
  // Needs a member session.
  res = await call(d1, "POST", "/org/kiosk/offline-unlock-log", body, { orgKey: ORG_KEY });
  assert.equal(res.status, 401);
});

// 7 Nov real-device test: the audit log showed one offline unlock twice. Two
// syncs from the same screen overlapped and both passed the duplicate check.
test("offline unlock log: overlapping syncs write each unlock once", async () => {
  const { d1, kioskSession, leadPhone } = await setupOffline();
  await enrol(d1, leadPhone, enrolPayload(new Uint8Array(32).fill(9), "KEYRACERACERACERACE1"));
  const body = { org_id: "org-1", kiosk_id: "RACE1234AB", entries: [
    { key_id: "KEYRACERACERACERACE1", challenge: "RACE2345", at: Date.now() - 1000, outcome: "allowed" },
    { key_id: "KEYRACERACERACERACE1", challenge: "RACE6789", at: Date.now(), outcome: "allowed" }
  ] };
  const results = await Promise.all([1, 2, 3].map(() => call(d1, "POST", "/org/kiosk/offline-unlock-log", body, { session: kioskSession })));
  for (const r of results) assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(results.reduce((n, r) => n + r.body.recorded, 0), 2, JSON.stringify(results.map((r) => r.body)));
  const n = d1.db.prepare("SELECT COUNT(*) n FROM org_audit_log WHERE action='irlid_kiosk_offline_unlock_v5' AND target LIKE '%RACE1234AB%'").get().n;
  assert.equal(n, 2);
});

// ---- Approved screens (findings a, b, c; Nov 2026) ----
// A staff session used to get any screen's keys by typing a screen id.

async function offlineCode(seed, kioskId, challenge) {
  const key = await hmac(seed, "irlid-kiosk-code|org-1|" + kioskId);
  const mac = await hmac(key, "unlock|" + challenge);
  const n = ((mac[0] & 0x7f) << 24 | mac[1] << 16 | mac[2] << 8 | mac[3]) >>> 0;
  return String(n % 100000000).padStart(8, "0");
}

test("a staff session can no longer fetch keys for a screen id it typed in", async () => {
  const { d1, kioskSession, kioskDevice, leadPhone } = await setupOffline({ approve: false });
  await enrol(d1, leadPhone, enrolPayload(new Uint8Array(32).fill(5)));
  const staffSession = addSession(d1, "staff-1");
  let r = await fetchKeys(d1, staffSession, "ZZZZ1234AB");
  assert.equal(r.status, 403);
  assert.equal(r.body.error, "kiosk_screen_not_approved");
  assert.equal(r.body.keys, undefined);
  // Even for a screen that IS approved: without that screen's secret, no keys.
  await approveScreen(d1, kioskSession, kioskDevice, "ZZZZ1234AB");
  for (const secret of [Buffer.alloc(32, 7).toString("base64url"), ""]) {
    r = await fetchKeys(d1, staffSession, "ZZZZ1234AB", secret);
    assert.equal(r.status, 403);
    assert.equal(r.body.keys, undefined);
  }
  // The secret alone is not enough (review 1.3): another staff member's
  // session with the right secret is refused.
  r = await fetchKeys(d1, staffSession, "ZZZZ1234AB");
  assert.equal(r.status, 403);
  assert.equal(r.body.reason, "signed_in_as_someone_else");
  assert.equal(r.body.keys, undefined);
  // The approved screen itself (its secret and its own session) gets them.
  r = await fetchKeys(d1, kioskSession, "ZZZZ1234AB");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.keys.length, 1);
});

test("screen keys go to the member signed in on the screen at approval, or a Lead Admin / Developer", async () => {
  const { d1, kioskDevice, leadPhone } = await setupOffline({ approve: false });
  await enrol(d1, leadPhone, enrolPayload(new Uint8Array(32).fill(6)));
  const screenStaff = addSession(d1, "staff-1");           // signed in on the door screen
  addUser(d1, "staff-2", await makeDevice(), "staff");
  const otherStaff = addSession(d1, "staff-2");            // someone else, same org
  const otherLead = addSession(d1, "lead-2");
  await approveScreen(d1, screenStaff, kioskDevice, "DR001234AB");
  assert.equal(d1.db.prepare("SELECT screen_user_id FROM kiosk_screens WHERE kiosk_id='DR001234AB'").get().screen_user_id, "staff-1");
  let r = await fetchKeys(d1, screenStaff, "DR001234AB");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await fetchKeys(d1, otherStaff, "DR001234AB");
  assert.equal(r.status, 403);
  assert.equal(r.body.reason, "signed_in_as_someone_else");
  r = await fetchKeys(d1, otherLead, "DR001234AB");
  assert.equal(r.status, 200, "a Lead Admin can make codes anyway");
  // An approval from before this change (no screen user) keeps working until renewed.
  d1.db.prepare("UPDATE kiosk_screens SET screen_user_id=NULL WHERE kiosk_id='DR001234AB'").run();
  r = await fetchKeys(d1, otherStaff, "DR001234AB");
  assert.equal(r.status, 200);
});

test("only a Lead Admin's or Developer's phone can approve a screen; staff and managers cannot", async () => {
  const { d1, kioskSession, staffPhone, managerPhone } = await setupOffline({ approve: false });
  const { hash } = await newScreenSecret();
  for (const phone of [staffPhone, managerPhone]) {
    const init = await requestScreenApproval(d1, kioskSession, "AB12CD34EF", hash);
    const claim = await claimWith(d1, phone, init.body.nonce);
    assert.equal(claim.status, 403, JSON.stringify(claim.body));
  }
  assert.equal(d1.db.prepare("SELECT COUNT(*) n FROM kiosk_screens").get().n, 0);
  // A staff-tier screen session may ASK; an attendee session may not.
  const staffAsk = await requestScreenApproval(d1, addSession(d1, "staff-1"), "AB12CD34EF", hash);
  assert.equal(staffAsk.status, 200);
  const attendeeAsk = await requestScreenApproval(d1, addSession(d1, "attendee-1"), "AB12CD34EF", hash);
  assert.equal(attendeeAsk.status, 403);
});

test("the approval is built by the Worker and bound to org, screen, secret, nonce and expiry", async () => {
  const { d1, kioskSession, kioskDevice } = await setupOffline({ approve: false });
  const { hash } = await newScreenSecret();
  const init = await requestScreenApproval(d1, kioskSession, "AB12CD34EF", hash);
  const polled = await call(d1, "GET", "/org/action/poll/" + init.body.nonce);
  const p = polled.body.action_payload;
  assert.deepEqual(Object.keys(p).sort(), ["approval_expires_at", "kiosk_id", "nonce", "org_id", "purpose", "secret_hash", "timestamp", "type"]);
  assert.equal(p.org_id, "org-1");
  assert.equal(p.kiosk_id, "AB12CD34EF");
  assert.equal(p.secret_hash, hash);
  assert.ok(p.approval_expires_at - Date.now() <= 30 * 86400000 + 5000);
  assert.match(polled.body.action_summary, /^Let screen AB12CD34EF accept offline unlock codes/);
  // Signing a different screen id or secret is refused (payload hash check).
  for (const mutate of [(x) => Object.assign(x, { kiosk_id: "ZZZZ1234AB" }), (x) => Object.assign(x, { secret_hash: "A".repeat(43) })]) {
    const r = await claimWith(d1, kioskDevice, init.body.nonce, mutate);
    assert.equal(r.status, 400, JSON.stringify(r.body));
  }
  // Single use.
  assert.equal((await claimWith(d1, kioskDevice, init.body.nonce)).status, 200);
  const again = await call(d1, "POST", "/org/action/claim", { nonce: init.body.nonce, signed_envelope: await signV5(kioskDevice, p) });
  assert.equal(again.status, 409);
  // Bad inputs never make an approval QR.
  assert.equal((await requestScreenApproval(d1, kioskSession, "bad id", hash)).status, 400);
  assert.equal((await requestScreenApproval(d1, kioskSession, "AB12CD34EF", "short")).status, 400);
  // An approval QR left too long (3 min) can't be signed.
  const late = await requestScreenApproval(d1, kioskSession, "AB12CD34EG", hash);
  d1.db.prepare("UPDATE pending_action_authorizations SET expires_at=? WHERE nonce=?").run(Date.now() - 1, late.body.nonce);
  const lateClaim = await call(d1, "POST", "/org/action/claim", { nonce: late.body.nonce, signed_envelope: await signV5(kioskDevice, p) });
  assert.equal(lateClaim.status, 410);
  // The approval is audited with the real signer.
  const row = d1.db.prepare("SELECT actor_user_id, actor_role FROM org_audit_log WHERE action='irlid_kiosk_screen_approve_v5' AND outcome='allowed'").get();
  assert.equal(row.actor_user_id, "kiosk-admin");
  assert.equal(row.actor_role, "lead_admin");
});

test("a Developer with no org membership can approve a screen and use it", async () => {
  const { d1, leadPhone } = await setupOffline({ approve: false });
  const dev = await makeDevice();
  addUser(d1, "dev-1", dev, null); // no org_memberships row
  d1.env = { BOOTSTRAP_DEVELOPER_FP: dev.fp };
  const devSession = addSession(d1, "dev-1");
  await enrol(d1, dev, enrolPayload(new Uint8Array(32).fill(4), "KEYDEVDEVDEVDEVDEVDE"));
  await enrol(d1, leadPhone, enrolPayload(new Uint8Array(32).fill(5), "KEYLEADLEADLEADLEADL"));
  await approveScreen(d1, devSession, dev, "DEVS1234AB");
  const r = await fetchKeys(d1, devSession, "DEVS1234AB");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.keys.map(k => k.key_id).sort(), ["KEYDEVDEVDEVDEVDEVDE", "KEYLEADLEADLEADLEADL"]);
  // And can list and revoke screens.
  const list = await call(d1, "GET", "/org/kiosk/screens?org_id=org-1", null, { session: devSession });
  assert.equal(list.status, 200);
  assert.equal(list.body.screens[0].kiosk_id, "DEVS1234AB");
  assert.equal(JSON.stringify(list.body).includes("secret"), false);
  const rev = await call(d1, "POST", "/org/kiosk/screen/revoke", { org_id: "org-1", kiosk_id: "DEVS1234AB" }, { session: devSession });
  assert.equal(rev.body.revoked, 1);
});

test("keys carry an expiry no later than 72 h or the approval's end", async () => {
  const { d1, kioskSession } = await setupOffline();
  const r = await fetchKeys(d1, kioskSession);
  assert.equal(r.status, 200);
  const t = Date.now();
  assert.ok(r.body.expires_at > t && r.body.expires_at <= t + 72 * 3600000 + 5000, String(r.body.expires_at - t));
  assert.ok(r.body.expires_at <= r.body.screen_expires_at);
  d1.db.prepare("UPDATE kiosk_screens SET expires_at=? WHERE kiosk_id='AB12CD34EF'").run(t + 60000);
  const soon = await fetchKeys(d1, kioskSession);
  assert.ok(soon.body.expires_at <= t + 60000);
});

test("revoked, expired, re-approved or approver-demoted screens get no keys", async () => {
  const { d1, kioskSession, kioskDevice } = await setupOffline();
  const leadSession = kioskSession;
  // Revoked: 403 revoked, also when the screen's own sign-in has lapsed.
  const rev = await call(d1, "POST", "/org/kiosk/screen/revoke", { org_id: "org-1", kiosk_id: "AB12CD34EF" }, { session: leadSession });
  assert.equal(rev.status, 200);
  let r = await fetchKeys(d1, kioskSession, "AB12CD34EF");
  assert.equal(r.status, 403);
  assert.equal(r.body.reason, "revoked");
  r = await fetchKeys(d1, "sess_gone_abcdefghijklmnopqr", "AB12CD34EF");
  assert.equal(r.status, 403, "a lapsed session still learns the screen is revoked");
  assert.equal(r.body.reason, "revoked");
  // Expired.
  d1.db.prepare("UPDATE kiosk_screens SET expires_at=? WHERE kiosk_id='AB12CD34EG'").run(Date.now() - 1);
  r = await fetchKeys(d1, kioskSession, "AB12CD34EG");
  assert.equal(r.body.reason, "expired");
  // Re-approved: the old secret stops working.
  const old = d1.secrets.RACE1234AB;
  await approveScreen(d1, kioskSession, kioskDevice, "RACE1234AB");
  r = await fetchKeys(d1, kioskSession, "RACE1234AB", old);
  assert.equal(r.status, 403);
  assert.equal((await fetchKeys(d1, kioskSession, "RACE1234AB")).status, 200);
  // Approver no longer Lead Admin: the approval no longer counts.
  d1.db.prepare("UPDATE org_memberships SET role='staff' WHERE user_id='kiosk-admin'").run();
  r = await fetchKeys(d1, addSession(d1, "staff-1"), "RACE1234AB");
  assert.equal(r.status, 403);
  assert.equal(r.body.reason, "approver_role");
});

test("only a Lead Admin or Developer can list or revoke screens; revocation is audited", async () => {
  const { d1 } = await setupOffline();
  const staff = addSession(d1, "staff-1");
  const mgr = addSession(d1, "manager-1");
  for (const s of [staff, mgr]) {
    assert.equal((await call(d1, "GET", "/org/kiosk/screens?org_id=org-1", null, { session: s })).status, 403);
    assert.equal((await call(d1, "POST", "/org/kiosk/screen/revoke", { org_id: "org-1", kiosk_id: "AB12CD34EF" }, { session: s })).status, 403);
  }
  assert.equal((await call(d1, "POST", "/org/kiosk/screen/revoke", { org_id: "org-1", kiosk_id: "AB12CD34EF" }, { orgKey: ORG_KEY })).status, 401);
  const denied = d1.db.prepare("SELECT COUNT(*) n FROM org_audit_log WHERE action='irlid_kiosk_screen_revoke' AND outcome='denied'").get().n;
  assert.equal(denied, 2);
  assert.equal(d1.db.prepare("SELECT COUNT(*) n FROM kiosk_screens WHERE revoked_at IS NOT NULL").get().n, 0);
});

test("CORS allows the screen secret header", async () => {
  const d1 = new D1({});
  const pre = await worker.fetch(new Request("https://worker.test/org/kiosk/code-keys", { method: "OPTIONS" }), { DB: d1, CORS_ORIGIN: "*" });
  assert.match(pre.headers.get("Access-Control-Allow-Headers") || "", /X-Kiosk-Secret/);
});

// ---- Audit attribution (finding b) and no silent loss (finding d) ----

test("offline unlock audit is kiosk-reported: never attributed to the key owner as if proven", async () => {
  const { d1, kioskSession, leadPhone } = await setupOffline();
  const seed = new Uint8Array(32).fill(8);
  await enrol(d1, leadPhone, enrolPayload(seed, "KEYATTRATTRATTRATTRA"));
  const good = await offlineCode(seed, "AB12CD34EF", "GQQD2345");
  const staffSession = addSession(d1, "staff-1");
  const entries = [
    { key_id: "KEYATTRATTRATTRATTRA", challenge: "GQQD2345", code: good, at: Date.now(), outcome: "allowed" },
    { key_id: "KEYATTRATTRATTRATTRA", challenge: "FAKE2345", code: "12345678", at: Date.now(), outcome: "allowed" },
    { key_id: "KEYATTRATTRATTRATTRA", challenge: "PRVW2345", at: Date.now(), outcome: "allowed" }
  ];
  // A staff member's own session (not the screen) reports an unlock naming the Lead Admin.
  let res = await call(d1, "POST", "/org/kiosk/offline-unlock-log", { org_id: "org-1", kiosk_id: "AB12CD34EF", entries: entries.slice(1, 2) }, { session: staffSession, secret: "" });
  assert.equal(res.body.recorded, 1);
  res = await call(d1, "POST", "/org/kiosk/offline-unlock-log", { org_id: "org-1", kiosk_id: "AB12CD34EF", entries: [entries[0], entries[2]] }, { session: kioskSession, secret: d1.secrets.AB12CD34EF });
  assert.equal(res.body.recorded, 2);
  const rows = Object.fromEntries(d1.db.prepare("SELECT nonce, actor_user_id, actor_pub_fp, actor_role, actor_display_name, detail FROM org_audit_log WHERE action='irlid_kiosk_offline_unlock_v5'").all().map(r => [r.nonce.split(":")[2], r]));
  for (const r of Object.values(rows)) {
    assert.equal(r.actor_user_id, null, "never the Lead Admin");
    assert.equal(r.actor_pub_fp, null);
    assert.equal(r.actor_role, null);
    assert.match(r.actor_display_name, /^Kiosk AB12CD34EF \(kiosk-reported\)$/);
    assert.match(r.detail, /not signed by the key owner/);
  }
  assert.match(rows.GQQD2345.detail, /code matches the offline key of lead-2/);
  assert.match(rows.GQQD2345.detail, /approved screen/);
  assert.match(rows.FAKE2345.detail, /code does NOT match/);
  assert.match(rows.FAKE2345.detail, /screen NOT verified/);
  assert.match(rows.FAKE2345.detail, /synced by staff-1/);
  assert.match(rows.PRVW2345.detail, /no code sent/);
});

test("offline unlock log: nothing is cut silently; too many entries is refused whole; overflow is recorded", async () => {
  const { d1, kioskSession } = await setupOffline();
  const mk = (i) => ({ challenge: ("D" + String(i).padStart(7, "0")).replace(/[ILOU]/g, "0"), at: Date.now(), outcome: "denied" });
  const big = Array.from({ length: 201 }, (_, i) => mk(i));
  let res = await call(d1, "POST", "/org/kiosk/offline-unlock-log", { org_id: "org-1", kiosk_id: "AB12CD34EF", entries: big }, { session: kioskSession });
  assert.equal(res.status, 413);
  assert.equal(d1.db.prepare("SELECT COUNT(*) n FROM org_audit_log WHERE action='irlid_kiosk_offline_unlock_v5'").get().n, 0, "nothing half-written");
  res = await call(d1, "POST", "/org/kiosk/offline-unlock-log", { org_id: "org-1", kiosk_id: "AB12CD34EF", entries: big.slice(0, 200),
    overflow: { count: 37, first_at: Date.now() - 5000, last_at: Date.now() } }, { session: kioskSession, secret: d1.secrets.AB12CD34EF });
  assert.equal(res.status, 200);
  assert.equal(res.body.recorded, 200);
  assert.equal(res.body.overflow_recorded, true);
  const ov = d1.db.prepare("SELECT detail FROM org_audit_log WHERE nonce LIKE 'kiosk:AB12CD34EF:overflow:%'").all();
  assert.equal(ov.length, 1);
  assert.match(ov[0].detail, /^37 more lock-outs/);
  // A malformed entry is reported back as rejected, not quietly counted.
  res = await call(d1, "POST", "/org/kiosk/offline-unlock-log", { org_id: "org-1", kiosk_id: "AB12CD34EF", entries: [{ challenge: "bad", outcome: "allowed" }] }, { session: kioskSession });
  assert.equal(res.body.rejected, 1);
});
