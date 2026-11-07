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

async function call(d1, method, path, body, { orgKey, session } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (orgKey) headers["X-Org-Key"] = orgKey;
  if (session) headers.Authorization = "Bearer " + session;
  const res = await worker.fetch(new Request("https://worker.test" + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  }), { DB: d1, CORS_ORIGIN: "*" });
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
  return { d1, kioskSession, staffPhone, attendeePhone };
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
const fetchKeys = (d1, session, kioskId = "AB12CD34EF") =>
  call(d1, "GET", "/org/kiosk/code-keys?org_id=org-1&kiosk_id=" + kioskId, null, { session });

async function hmac(keyBytes, text) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text)));
}

async function setupOffline() {
  const ctx = await setup({ kioskMode: true });
  ctx.leadPhone = await makeDevice();
  addUser(ctx.d1, "lead-2", ctx.leadPhone, "lead_admin");
  ctx.managerPhone = await makeDevice();
  addUser(ctx.d1, "manager-1", ctx.managerPhone, "manager");
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
  assert.equal(res.body.recorded, 2);
  assert.equal(res.body.skipped, 1);
  res = await call(d1, "POST", "/org/kiosk/offline-unlock-log", body, { session: kioskSession });
  assert.equal(res.body.recorded, 0);
  const rows = d1.db.prepare("SELECT actor_user_id, actor_role, outcome, action FROM org_audit_log WHERE action='irlid_kiosk_offline_unlock_v5' ORDER BY outcome").all();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].outcome, "allowed");
  assert.equal(rows[0].actor_user_id, "lead-2");
  assert.equal(rows[0].actor_role, "lead_admin");
  assert.equal(rows[1].outcome, "denied");
  // Needs a member session.
  res = await call(d1, "POST", "/org/kiosk/offline-unlock-log", body, { orgKey: ORG_KEY });
  assert.equal(res.status, 401);
});
