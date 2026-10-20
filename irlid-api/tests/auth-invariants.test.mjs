// Security invariants — ported from IRLid-TestEnvironment 5e7ff79, plus the Google
// email_verified rule. Runs against BOTH Workers, because irlid-api-org carries a copy
// of the same /auth/* routes.
//
// THE RULE THESE TESTS EXIST TO ENFORCE, PERMANENTLY:
//   A PUBLIC value must never authenticate anyone.
//
// pubKeyId() is derived only from public JWK fields, and the full public JWK is
// readable by anyone from a public receipt (GET /receipts/<hash>). If any endpoint
// hands out a session in exchange for a public key, the chain becomes:
//   public receipt -> public JWK -> pub_key_id -> session -> ACCOUNT TAKEOVER.
// These tests must never be deleted or weakened.

import test from "node:test";
import assert from "node:assert/strict";
import consumerWorker from "../src/index.js";
import orgWorker from "../../irlid-api-org/src/index.js";

const WORKERS = [["irlid-api", consumerWorker], ["irlid-api-org", orgWorker]];

const GOOGLE_CLIENT_ID = "1027068182677-b69k36slkhjr0ltjbde7q6ktopjscmeq.apps.googleusercontent.com";
const KNOWN_KEY_ID_USER = "user-existing-1";
const KNOWN_KEY_ID_DEVICE = "device-existing-1";
const VICTIM_USER = "victim-user-1";
const VICTIM_EMAIL = "victim@example.com";

class FakeStatement {
  constructor(db, sql) { this.db = db; this.sql = sql.replace(/\s+/g, " ").trim(); this.args = []; }
  bind(...args) { this.args = args; return this; }
  async first() { return this.db.execute(this.sql, this.args); }
  async all() { return { results: (await this.db.execute(this.sql, this.args)) || [] }; }
  async run() { return (await this.db.execute(this.sql, this.args)) || { meta: { changes: 1 } }; }
}

class FakeDB {
  // knownKeyIds: pub_key_ids already present in `devices`
  // emailUsers: users.email -> user row (an account an attacker may want to land in)
  constructor(knownKeyIds = [], emailUsers = {}) {
    this.known = new Set(knownKeyIds);
    this.emailUsers = emailUsers;
    this.sql = [];
  }
  prepare(sql) { return new FakeStatement(this, sql); }
  async batch(stmts) { for (const s of stmts) await s.run(); return []; }
  async execute(sql, args) {
    this.sql.push(sql);
    if (sql.startsWith("SELECT d.id as device_id, d.user_id FROM devices d WHERE d.pub_key_id = ?")) {
      return this.known.has(args[0])
        ? { device_id: KNOWN_KEY_ID_DEVICE, user_id: KNOWN_KEY_ID_USER }
        : null;
    }
    // The query the old /auth/login ran — answer it, so a regression would really mint a session.
    if (sql.startsWith("SELECT id, user_id, revoked_at FROM devices WHERE pub_key_id = ?")) {
      return this.known.has(args[0])
        ? { id: KNOWN_KEY_ID_DEVICE, user_id: KNOWN_KEY_ID_USER, revoked_at: null }
        : null;
    }
    if (sql.startsWith("SELECT id, display_name FROM users WHERE google_sub = ?")) return null;
    if (sql.startsWith("SELECT id, display_name FROM users WHERE email = ?")) return this.emailUsers[args[0]] || null;
    return null;
  }
}

const ENV = { CORS_ORIGIN: "https://irlid.co.uk" };

async function freshPublicJwk() {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
  return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
}

// Mirrors the Worker's own pubKeyId() so tests can pre-seed a "known" key.
async function pubKeyIdOf(pubJwk) {
  const s = `${pubJwk.kty}.${pubJwk.crv}.${pubJwk.x}.${pubJwk.y}`;
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  const b = Buffer.from(new Uint8Array(h)).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return b.slice(0, 18);
}

function post(path, body) {
  return new Request("https://irlid-api.example/" + path.replace(/^\//, ""), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
}

// Stub Google's tokeninfo endpoint for one call to /auth/google.
async function withGoogleToken(tokenInfo, fn) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.ok(String(url).startsWith("https://oauth2.googleapis.com/tokeninfo"), "unexpected fetch " + url);
    return new Response(JSON.stringify(tokenInfo), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try { return await fn(); } finally { globalThis.fetch = realFetch; }
}

function googleTokenInfo(emailVerified) {
  return {
    aud: GOOGLE_CLIENT_ID,
    iss: "https://accounts.google.com",
    exp: String(Math.floor(Date.now() / 1000) + 600),
    sub: "google-sub-attacker",
    email: VICTIM_EMAIL,
    email_verified: emailVerified ? "true" : "false",
    name: "Someone"
  };
}

for (const [name, worker] of WORKERS) {
  // ---- (2) /auth/register ----

  test(`${name}: INVARIANT — a public key belonging to an EXISTING device must NOT yield a session`, async () => {
    const pub = await freshPublicJwk();
    const env = { ...ENV, DB: new FakeDB([await pubKeyIdOf(pub)]) };
    const res = await worker.fetch(post("/auth/register", { pub_jwk: pub }), env);
    const data = await res.json();

    assert.equal(res.status, 409, "an already-registered key must be rejected, not logged in");
    assert.equal(data.session_token, undefined, "NO session token may ever be issued here");
    assert.equal(data.code, "already_registered");
    assert.ok(!env.DB.sql.some(s => s.startsWith("INSERT INTO sessions")), "no session row may be written");
  });

  test(`${name}: a public key lifted from a public receipt cannot be exchanged for a session`, async () => {
    // Simulates an attacker reading combined.a.pub from GET /receipts/<hash>
    const stolen = await freshPublicJwk();
    const env = { ...ENV, DB: new FakeDB([await pubKeyIdOf(stolen)]) };
    const res = await worker.fetch(post("/auth/register", { pub_jwk: stolen }), env);
    const data = await res.json();
    assert.equal(res.status, 409);
    assert.ok(!data.session_token, "receipt-derived key must never produce a session");
  });

  test(`${name}: registering a genuinely NEW key still works (no regression)`, async () => {
    const pub = await freshPublicJwk();
    const env = { ...ENV, DB: new FakeDB([]) };
    const res = await worker.fetch(post("/auth/register", { display_name: "New User", pub_jwk: pub }), env);
    const data = await res.json();
    assert.equal(res.status, 201, "new-device registration must still succeed");
    assert.ok(data.session_token, "a brand-new registration may issue a session");
    assert.equal(data.existing, false);
  });

  test(`${name}: register still validates its input`, async () => {
    const env = { ...ENV, DB: new FakeDB([]) };
    const res = await worker.fetch(post("/auth/register", {}), env);
    assert.equal(res.status, 400);
  });

  // ---- (1) /auth/login ----

  test(`${name}: /auth/login no longer exists (bare pub_key_id never yields a session)`, async () => {
    const pub = await freshPublicJwk();
    const env = { ...ENV, DB: new FakeDB([await pubKeyIdOf(pub)]) };
    const res = await worker.fetch(post("/auth/login", { pub_key_id: await pubKeyIdOf(pub) }), env);
    const data = await res.json();
    assert.equal(res.status, 404, "the bare-pub_key_id login endpoint must stay deleted");
    assert.equal(data.session_token, undefined);
    assert.ok(!env.DB.sql.some(s => s.startsWith("INSERT INTO sessions")), "no session row may be written");
  });

  // ---- (3) /auth/google ----

  test(`${name}: Google sign-in with an UNVERIFIED email must not land in the account that owns that email`, async () => {
    const env = { ...ENV, DB: new FakeDB([], { [VICTIM_EMAIL]: { id: VICTIM_USER, display_name: "Victim" } }) };
    const res = await withGoogleToken(googleTokenInfo(false),
      () => worker.fetch(post("/auth/google", { id_token: "tok" }), env));
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.notEqual(data.user_id, VICTIM_USER, "unverified email must never link to an existing account");
    assert.equal(data.existing, false);
    assert.ok(!env.DB.sql.some(s => s.startsWith("SELECT id, display_name FROM users WHERE email = ?")),
      "the email lookup must not even run for an unverified email");
  });

  test(`${name}: Google sign-in with a VERIFIED email still links to the existing account (no regression)`, async () => {
    const env = { ...ENV, DB: new FakeDB([], { [VICTIM_EMAIL]: { id: VICTIM_USER, display_name: "Owner" } }) };
    const res = await withGoogleToken(googleTokenInfo(true),
      () => worker.fetch(post("/auth/google", { id_token: "tok" }), env));
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.user_id, VICTIM_USER, "a Google-verified email links to its account as before");
  });
}
