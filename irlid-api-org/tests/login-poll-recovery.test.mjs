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
import { SqliteD1 } from "./helpers/sqlite-d1.mjs";

const enc = new TextEncoder();

// Real SQLite with the real schema (helpers/sqlite-d1.mjs), so the Worker's
// own SQL runs and a D1 batch is a real transaction. `t` is a read view used
// by the assertions below.
function makeDb() {
  const db = new SqliteD1();
  db.t = {
    challenges: { get: (nonce) => db.get("SELECT * FROM login_challenges WHERE nonce = ?", nonce) },
    sessions: {
      has: (token) => !!db.get("SELECT token FROM login_sessions WHERE token = ?", token),
      get: (token) => db.get("SELECT * FROM login_sessions WHERE token = ?", token),
      delete: (token) => db.exec("DELETE FROM login_sessions WHERE token = ?", token),
      get size() { return db.get("SELECT COUNT(*) AS n FROM login_sessions").n; }
    }
  };
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
  e.DB.exec("UPDATE login_challenges SET poll_secret_hash = NULL WHERE nonce = ?", nonce);
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

// ---- Atomic recovery (copy session, move pointer, delete old: all or none) ----
// The three writes run in one D1 batch (one transaction). A failure at any
// step leaves the login exactly as it was, the poll gets a retryable 503, and
// the next poll still recovers inside the same 120 s / 3-recovery bound.
function loginState(e, nonce) {
  const c = e.DB.t.challenges.get(nonce);
  return { pointer: c.session_token, used: c.recover_count, sessions: e.DB.all("SELECT token FROM login_sessions").map(r => r.token).sort() };
}

for (const [step, re] of [
  ["copying the session", /^INSERT INTO login_sessions .* SELECT/],
  ["moving the pointer", /^UPDATE login_challenges SET session_token = \?, recover_count/],
  ["deleting the old token", /^DELETE FROM login_sessions WHERE token = \? AND EXISTS/]
]) {
  test("recovery that fails while " + step + " changes nothing, then the retry works", async () => {
    const e = env();
    const { nonce, poll_secret } = await init(e);
    await claim(e, nonce, await phone());
    const first = await (await poll(e, nonce, poll_secret)).json();
    const before = loginState(e, nonce);
    assert.deepEqual(before.sessions, [first.session_token]);
    e.DB.failOn(re);
    const failed = await poll(e, nonce, poll_secret);
    assert.equal(failed.status, 503, "retryable, so js/login-poll.js tries again");
    assert.deepEqual(loginState(e, nonce), before, "pointer, recovery count and sessions unchanged");
    assert.ok(e.DB.t.sessions.has(first.session_token), "the old token was not lost");
    const ok = await poll(e, nonce, poll_secret);
    assert.equal(ok.status, 200);
    const b = await ok.json();
    assert.equal(b.recovered, true);
    const after = loginState(e, nonce);
    assert.equal(after.pointer, b.session_token);
    assert.equal(after.used, 1, "the failed try did not use up a recovery");
    assert.deepEqual(after.sessions, [b.session_token], "exactly one live session");
  });
}

test("racing recoveries: one winner, one live session, the cap still holds", async () => {
  const e = env();
  const { nonce, poll_secret } = await init(e);
  await claim(e, nonce, await phone());
  await poll(e, nonce, poll_secret);
  const results = await Promise.all([0, 1, 2, 3, 4, 5].map(() => poll(e, nonce, poll_secret)));
  const ok = results.filter(r => r.status === 200).length;
  assert.ok(ok >= 1 && ok <= 3, "at most 3 recoveries, got " + ok);
  for (const r of results) assert.ok(r.status === 200 || r.status === 410);
  const st = loginState(e, nonce);
  assert.ok(st.used <= 3);
  assert.equal(st.sessions.length, 1, "never two live sessions for one login");
  assert.deepEqual(st.sessions, [st.pointer]);
});

test("a recovery after sign-out writes nothing (no orphan session, no spent slot)", async () => {
  const e = env();
  const { nonce, poll_secret } = await init(e);
  await claim(e, nonce, await phone());
  const first = await (await poll(e, nonce, poll_secret)).json();
  e.DB.t.sessions.delete(first.session_token);
  assert.equal((await poll(e, nonce, poll_secret)).status, 410);
  const st = loginState(e, nonce);
  assert.equal(st.used, 0);
  assert.equal(st.pointer, first.session_token);
  assert.deepEqual(st.sessions, []);
});

test("a recovered (lost) token replayed later is refused by every session endpoint", async () => {
  const e = env();
  const { nonce, poll_secret } = await init(e);
  await claim(e, nonce, await phone());
  const lost = await (await poll(e, nonce, poll_secret)).json();
  await poll(e, nonce, poll_secret);
  const r = await worker.fetch(new Request(W + "/user/orgs", { headers: { Authorization: "Bearer " + lost.session_token } }), e);
  assert.equal(r.status, 401);
});
