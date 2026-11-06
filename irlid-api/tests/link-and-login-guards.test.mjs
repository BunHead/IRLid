// Guards for two account-takeover holes from docs/code-review-2026-10.md:
//   H4: 6-digit link codes must not be guessable by brute force.
//   M2: the QR login poll must hand out the session token only once.
import test from "node:test";
import assert from "node:assert/strict";
import consumerWorker from "../src/index.js";
import orgWorker from "../../irlid-api-org/src/index.js";

const ENV_BASE = { CORS_ORIGIN: "https://irlid.co.uk" };

class Stmt {
  constructor(db, sql) { this.db = db; this.sql = sql.replace(/\s+/g, " ").trim(); this.args = []; }
  bind(...a) { this.args = a; return this; }
  async first() { return this.db.exec(this.sql, this.args, "first"); }
  async all() { return { results: (await this.db.exec(this.sql, this.args, "all")) || [] }; }
  async run() { return (await this.db.exec(this.sql, this.args, "run")) || { meta: { changes: 0 } }; }
}

class FakeDB {
  constructor() { this.limits = new Map(); this.challenges = new Map(); this.failLimiter = false; }
  prepare(sql) { return new Stmt(this, sql); }
  async batch(stmts) { for (const s of stmts) await s.run(); return []; }
  async exec(sql, args) {
    if (sql.includes("ip_rate_limits")) {
      if (this.failLimiter) throw new Error("D1 down");
      if (sql.startsWith("CREATE TABLE")) return { meta: { changes: 0 } };
      if (sql.startsWith("SELECT count FROM ip_rate_limits")) {
        return this.limits.has(args[0]) ? { count: this.limits.get(args[0]) } : null;
      }
      if (sql.startsWith("INSERT INTO ip_rate_limits")) {
        this.limits.set(args[0], (this.limits.get(args[0]) || 0) + 1);
        return { meta: { changes: 1 } };
      }
    }
    if (sql.startsWith("SELECT code, user_id, expires_at, claimed FROM link_codes")) return null; // every guess is wrong
    if (sql.startsWith("SELECT nonce, issued_at, expires_at, claimed_by, session_token, consumed") && sql.includes("FROM login_challenges")) {
      return this.challenges.get(args[0]) || null;
    }
    if (sql.startsWith("UPDATE login_challenges SET consumed = 1, consumed_at = ? WHERE nonce = ? AND consumed = 0")) {
      const c = this.challenges.get(args[1]);
      if (c && !c.consumed) { c.consumed = 1; c.consumed_at = args[0]; return { meta: { changes: 1 } }; }
      return { meta: { changes: 0 } };
    }
    if (sql.startsWith("UPDATE login_challenges SET session_token = ?, recover_count = recover_count + 1")) {
      const c = this.challenges.get(args[1]);
      if (c && c.session_token === args[2] && (c.recover_count || 0) < args[3]) { c.session_token = args[0]; c.recover_count = (c.recover_count || 0) + 1; return { meta: { changes: 1 } }; }
      return { meta: { changes: 0 } };
    }
    if (sql.startsWith("SELECT token, user_id, expires_at FROM login_sessions")) {
      return { token: args[0], user_id: "u1", expires_at: Math.floor(Date.now() / 1000) + 3600 };
    }
    if (sql.startsWith("SELECT id, display_name, pub_fp FROM portal_users")) return { id: "u1", display_name: "Staff", pub_fp: "fp1" };
    return null;
  }
}

function claim(worker, env, ip) {
  return worker.fetch(new Request("https://api.test/auth/link/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
    body: JSON.stringify({ code: String(Math.floor(Math.random() * 1e6)).padStart(6, "0"), pub_jwk: { kty: "EC", crv: "P-256", x: "x", y: "y" } })
  }), env);
}

for (const [name, worker] of [["irlid-api", consumerWorker], ["irlid-api-org", orgWorker]]) {
  test(`${name}: H4 one IP gets at most 10 link-code guesses per window`, async () => {
    const env = { ...ENV_BASE, DB: new FakeDB() };
    for (let i = 0; i < 10; i++) assert.equal((await claim(worker, env, "1.2.3.4")).status, 404);
    assert.equal((await claim(worker, env, "1.2.3.4")).status, 429);
    assert.equal((await claim(worker, env, "5.6.7.8")).status, 404, "another IP is not blocked by one IP's guesses");
  });

  test(`${name}: H4 many IPs together are capped by the platform-wide failure bucket`, async () => {
    const env = { ...ENV_BASE, DB: new FakeDB() };
    for (let i = 0; i < 300; i++) assert.equal((await claim(worker, env, `10.0.${i >> 8}.${i & 255}`)).status, 404);
    assert.equal((await claim(worker, env, "9.9.9.9")).status, 429);
  });

  test(`${name}: H4 the link-claim limiter fails closed`, async () => {
    const db = new FakeDB(); db.failLimiter = true;
    assert.equal((await claim(worker, { ...ENV_BASE, DB: db }, "1.2.3.4")).status, 503);
  });
}

test("irlid-api-org: M2 the QR login poll returns the session token only once", async () => {
  // v6.8.5: only the page holding the poll secret (never in the QR) may poll.
  // A later poll by that page is a lost-reply recovery and gets a NEW token,
  // so the original token is still handed out only once.
  const db = new FakeDB();
  const t = Math.floor(Date.now() / 1000);
  const secret = "desktop_poll_secret";
  const hash = Buffer.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)))).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  db.challenges.set("n1", { nonce: "n1", issued_at: t, expires_at: t + 120, claimed_by: "u1", session_token: "sess_secret", consumed: 0, poll_secret_hash: hash, consumed_at: null, recover_count: 0 });
  const env = { ...ENV_BASE, DB: db };
  const poll = (headers = {}) => orgWorker.fetch(new Request("https://api.test/org/login/poll?nonce=n1", { headers }), env);
  const snoop = await poll();
  assert.equal(snoop.status, 403, "someone with only the QR nonce is refused");
  assert.ok(!JSON.stringify(await snoop.json()).includes("sess_secret"));
  const first = await poll({ "X-Login-Poll-Secret": secret });
  assert.equal(first.status, 200);
  assert.equal((await first.json()).session_token, "sess_secret");
  const second = await poll({ "X-Login-Poll-Secret": secret });
  assert.ok(!JSON.stringify(await second.json()).includes("sess_secret"), "the original token is never handed out twice");
});
