// v6.8.5 (PR B): v5 QR login, lost-reply recovery on /org/login/poll.
// Security rules under test: S6 (codes are single use), S12 (sessions are
// random tokens), and the M2 fix (someone who only saw the QR nonce never gets
// the session). Recovery: the page that started the login (holder of the poll
// secret) may collect the session again within 120 s, at most 3 times, and
// each time gets a NEW token while the old one is deleted.
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { canonical, b64url, newDevice } from "./helpers/signed-checkin.mjs";

const enc = new TextEncoder();

function makeDb() {
  const t = { challenges: new Map(), sessions: new Map(), users: new Map() };
  const db = { t, unknown: [] };
  db.prepare = (sql) => {
    const q = sql.replace(/\s+/g, " ").trim();
    const st = { args: [] };
    st.bind = (...a) => { st.args = a; return st; };
    const exec = () => {
      const a = st.args;
      if (q.startsWith("PRAGMA table_info(login_challenges)")) {
        return { results: ["nonce", "issued_at", "expires_at", "claimed_by", "session_token", "consumed", "fail_count", "locked_until"].map(name => ({ name })) };
      }
      if (q.startsWith("ALTER TABLE login_challenges ADD COLUMN")) return { changes: 0 };
      if (q.startsWith("INSERT INTO login_challenges")) {
        t.challenges.set(a[0], { nonce: a[0], issued_at: a[1], expires_at: a[2], claimed_by: null, session_token: null, consumed: 0, fail_count: 0, locked_until: 0, poll_secret_hash: a[3], consumed_at: null, recover_count: 0 });
        return { changes: 1 };
      }
      if (q.startsWith("SELECT") && q.includes("FROM login_challenges WHERE nonce = ?")) {
        const r = t.challenges.get(a[0]); return r ? { ...r } : null;
      }
      if (q === "DELETE FROM login_challenges WHERE nonce = ?") { t.challenges.delete(a[0]); return { changes: 1 }; }
      if (q.startsWith("UPDATE login_challenges SET consumed = 1, consumed_at = ? WHERE nonce = ? AND consumed = 0")) {
        const r = t.challenges.get(a[1]); if (!r || r.consumed) return { changes: 0 };
        r.consumed = 1; r.consumed_at = a[0]; return { changes: 1 };
      }
      if (q.startsWith("UPDATE login_challenges SET session_token = ?, recover_count = recover_count + 1")) {
        const r = t.challenges.get(a[1]);
        if (!r || r.session_token !== a[2] || !(r.recover_count < a[3])) return { changes: 0 };
        r.session_token = a[0]; r.recover_count += 1; return { changes: 1 };
      }
      if (q.startsWith("UPDATE login_challenges SET claimed_by = ?, session_token = ? WHERE nonce = ? AND session_token IS NULL")) {
        const r = t.challenges.get(a[2]); if (!r || r.session_token) return { changes: 0 };
        r.claimed_by = a[0]; r.session_token = a[1]; return { changes: 1 };
      }
      if (q.startsWith("UPDATE login_challenges SET fail_count")) return { changes: 1 };
      if (q.startsWith("SELECT") && q.includes("FROM login_sessions WHERE token = ?")) {
        const r = t.sessions.get(a[0]); return r ? { ...r } : null;
      }
      if (q.startsWith("INSERT INTO login_sessions")) {
        t.sessions.set(a[0], { token: a[0], user_id: a[1], issued_at: a[2], expires_at: a[3], ip_hash: a[4], user_agent: a[5] });
        return { changes: 1 };
      }
      if (q === "DELETE FROM login_sessions WHERE token = ?") { t.sessions.delete(a[0]); return { changes: 1 }; }
      if (q.startsWith("SELECT id, display_name FROM portal_users WHERE pub_fp = ?")) {
        for (const u of t.users.values()) if (u.pub_fp === a[0]) return { id: u.id, display_name: u.display_name };
        return null;
      }
      if (q.startsWith("INSERT INTO portal_users")) {
        t.users.set(a[0], { id: a[0], pub_jwk: a[1], pub_fp: a[2], display_name: a[3] }); return { changes: 1 };
      }
      if (q.startsWith("SELECT id, display_name, pub_fp FROM portal_users WHERE id = ?")) {
        const u = t.users.get(a[0]); return u ? { id: u.id, display_name: u.display_name, pub_fp: u.pub_fp } : null;
      }
      if (q.includes("FROM org_memberships")) return { results: [] };
      db.unknown.push(q);
      return null;
    };
    st.first = async () => exec();
    st.all = async () => { const r = exec(); return r && r.results ? r : { results: [] }; };
    st.run = async () => { const r = exec(); return { meta: { changes: (r && r.changes) || 0 } }; };
    return st;
  };
  db.batch = async (stmts) => Promise.all(stmts.map(s => s.run()));
  return db;
}

const W = "https://worker.test";
const env = () => ({ DB: makeDb(), CORS_ORIGIN: "*" });
const init = async (e) => (await worker.fetch(new Request(W + "/org/login/init", { method: "POST" }), e)).json();
const poll = (e, nonce, secret) => worker.fetch(new Request(W + "/org/login/poll?nonce=" + encodeURIComponent(nonce), {
  headers: secret ? { "X-Login-Poll-Secret": secret } : {}
}), e);

// The phone's v5 claim, signed the way org-login.html signs it.
async function claim(e, nonce, device) {
  device = device || await newDevice();
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(canonical({ nonce, type: "irlid_login_v5" })))));
  const clientData = enc.encode(JSON.stringify({ type: "webauthn.get", challenge, origin: "https://irlid.co.uk" }));
  const authData = new Uint8Array(37); authData[32] = 0x05; // UP + UV
  const cdHash = new Uint8Array(await crypto.subtle.digest("SHA-256", clientData));
  const signed = new Uint8Array(authData.length + cdHash.length); signed.set(authData); signed.set(cdHash, authData.length);
  const keys = device.keys;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, signed));
  const res = await worker.fetch(new Request(W + "/org/login/claim", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nonce, pub_jwk: device.pub, sig: b64url(sig), webauthn: { authData: b64url(authData), clientData: b64url(clientData) } })
  }), e);
  return res;
}
async function phone() {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  return { keys, pub: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y } };
}
function withClock(offsetS, fn) {
  const real = Date.now;
  Date.now = () => real() + offsetS * 1000;
  return Promise.resolve().then(fn).finally(() => { Date.now = real; });
}

test("init returns a poll secret that is not the nonce, and stores only its hash", async () => {
  const e = env();
  const r = await init(e);
  assert.ok(r.nonce && r.poll_secret);
  assert.notEqual(r.poll_secret, r.nonce);
  assert.ok(r.poll_secret.length >= 40, "32 random bytes");
  assert.equal(r.recovery_window_s, 120);
  const row = e.DB.t.challenges.get(r.nonce);
  assert.ok(row.poll_secret_hash);
  assert.notEqual(row.poll_secret_hash, r.poll_secret, "the secret itself is never stored");
});

test("a poll with only the nonce (what the QR shows) is refused, before and after the phone signs", async () => {
  const e = env();
  const { nonce } = await init(e);
  assert.equal((await poll(e, nonce)).status, 403);
  assert.equal((await poll(e, nonce, "wrong-secret-wrong-secret-wrong-secret-xx")).status, 403);
  assert.equal((await claim(e, nonce, await phone())).status, 200);
  const r = await poll(e, nonce);
  assert.equal(r.status, 403);
  const body = await r.json();
  assert.equal(body.session_token, undefined, "no session to someone who only saw the QR");
});

test("the desktop with the secret waits, then collects the session once", async () => {
  const e = env();
  const { nonce, poll_secret } = await init(e);
  assert.deepEqual(await (await poll(e, nonce, poll_secret)).json(), { status: "pending" });
  assert.equal((await claim(e, nonce, await phone())).status, 200);
  const r = await poll(e, nonce, poll_secret);
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.status, "claimed");
  assert.ok(b.session_token);
  assert.equal(b.recovered, undefined);
  assert.ok(e.DB.t.sessions.has(b.session_token));
});

test("lost reply: the same desktop polls again and still finishes login, with a new token", async () => {
  const e = env();
  const { nonce, poll_secret } = await init(e);
  await claim(e, nonce, await phone());
  const first = await (await poll(e, nonce, poll_secret)).json(); // pretend this reply was lost
  const again = await poll(e, nonce, poll_secret);
  assert.equal(again.status, 200, "not 410 'QR expired'");
  const b = await again.json();
  assert.equal(b.status, "claimed");
  assert.equal(b.recovered, true);
  assert.notEqual(b.session_token, first.session_token, "token rotated");
  assert.equal(e.DB.t.sessions.has(first.session_token), false, "the lost token no longer works");
  assert.ok(e.DB.t.sessions.has(b.session_token));
  assert.equal(e.DB.t.sessions.size, 1, "only one live session for this login");
});

test("recovery keeps the original session expiry (never extends it)", async () => {
  const e = env();
  const { nonce, poll_secret } = await init(e);
  await claim(e, nonce, await phone());
  const first = await (await poll(e, nonce, poll_secret)).json();
  const exp = e.DB.t.sessions.get(first.session_token).expires_at;
  const b = await withClock(30, async () => (await poll(e, nonce, poll_secret)).json());
  assert.equal(e.DB.t.sessions.get(b.session_token).expires_at, exp);
});

test("recovery is capped at 3, then 410 challenge_consumed", async () => {
  const e = env();
  const { nonce, poll_secret } = await init(e);
  await claim(e, nonce, await phone());
  assert.equal((await poll(e, nonce, poll_secret)).status, 200);
  for (let i = 0; i < 3; i++) assert.equal((await poll(e, nonce, poll_secret)).status, 200, "recovery " + (i + 1));
  const r = await poll(e, nonce, poll_secret);
  assert.equal(r.status, 410);
  assert.equal((await r.json()).error, "challenge_consumed");
});

test("recovery window closes 120 s after the session was first collected", async () => {
  const e = env();
  const { nonce, poll_secret } = await init(e);
  await claim(e, nonce, await phone());
  assert.equal((await poll(e, nonce, poll_secret)).status, 200);
  assert.equal(await withClock(119, async () => (await poll(e, nonce, poll_secret)).status), 200);
  const late = await withClock(125, async () => poll(e, nonce, poll_secret));
  assert.equal(late.status, 410);
  assert.equal((await late.json()).error, "challenge_consumed");
});

test("no recovery after the session was signed out (token deleted)", async () => {
  const e = env();
  const { nonce, poll_secret } = await init(e);
  await claim(e, nonce, await phone());
  const first = await (await poll(e, nonce, poll_secret)).json();
  e.DB.t.sessions.delete(first.session_token); // sign out
  const r = await poll(e, nonce, poll_secret);
  assert.equal(r.status, 410);
});

test("a QR nobody signed still says expired after its 3 minutes", async () => {
  const e = env();
  const { nonce, poll_secret } = await init(e);
  const r = await withClock(181, async () => poll(e, nonce, poll_secret));
  assert.equal(r.status, 410);
  assert.equal((await r.json()).error, "challenge_expired");
});

test("signed in the last seconds: the desktop can still collect just after the QR's expiry", async () => {
  const e = env();
  const { nonce, poll_secret } = await init(e);
  await withClock(178, async () => assert.equal((await claim(e, nonce, await phone())).status, 200));
  const r = await withClock(185, async () => poll(e, nonce, poll_secret));
  assert.equal(r.status, 200);
  // but not forever: a signed but never-collected login lapses
  const e2 = env();
  const c2 = await init(e2);
  await claim(e2, c2.nonce, await phone());
  const r2 = await withClock(180 + 121, async () => poll(e2, c2.nonce, c2.poll_secret));
  assert.equal(r2.status, 410);
});

test("a challenge row from before this change (no secret hash) is never handed out", async () => {
  const e = env();
  const { nonce, poll_secret } = await init(e);
  e.DB.t.challenges.get(nonce).poll_secret_hash = null;
  await claim(e, nonce, await phone());
  assert.equal((await poll(e, nonce, poll_secret)).status, 403);
  assert.equal((await poll(e, nonce)).status, 403);
});

test("a second claim on a used nonce is refused and leaves no extra session", async () => {
  const e = env();
  const { nonce } = await init(e);
  assert.equal((await claim(e, nonce, await phone())).status, 200);
  assert.equal((await claim(e, nonce, await phone())).status, 410);
  assert.equal(e.DB.t.sessions.size, 1);
});

test("CORS allows the poll-secret header; the secret is never read from the URL", async () => {
  const e = env();
  const pre = await worker.fetch(new Request(W + "/org/login/poll", { method: "OPTIONS" }), e);
  assert.match(pre.headers.get("Access-Control-Allow-Headers") || "", /X-Login-Poll-Secret/);
  const { nonce, poll_secret } = await init(e);
  const r = await worker.fetch(new Request(W + "/org/login/poll?nonce=" + nonce + "&poll_secret=" + poll_secret), e);
  assert.equal(r.status, 403);
});
