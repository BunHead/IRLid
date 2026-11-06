// v6.8.5 (PR B): the desktop's QR-login poll loop (js/login-poll.js) and its
// wiring in Org.html / org-login.html / org-entry.html.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
await import("../../js/login-poll.js");
const { createLoginPoller, classify, FAIL_MESSAGES, BACKOFF_STEPS_MS } = globalThis.IRLidLoginPoll;

const httpErr = (status, error) => Object.assign(new Error(error || "http " + status), { status, data: error ? { error } : null });
const CLAIMED = { status: "claimed", session_token: "tok", user_id: "u1" };

function harness(responses, extra = {}) {
  let clock = 1_000_000;
  const timers = []; const states = []; const claimed = []; const calls = [];
  const p = createLoginPoller({
    nonce: "N", secret: "S", expiresAtMs: clock + 180000, recoveryWindowMs: 120000,
    now: () => clock, random: () => 0.5,
    setTimeout: (fn, ms) => { const t = { fn, ms }; timers.push(t); return t; },
    clearTimeout: t => { if (t) t.cleared = true; },
    AbortController: class { constructor() { this.signal = {}; } abort() {} },
    poll: async (nonce, secret) => {
      calls.push({ nonce, secret });
      const r = responses.shift();
      if (r instanceof Error) throw r;
      return r;
    },
    onState: (s, d) => states.push([s, d]),
    onClaimed: d => claimed.push(d),
    ...extra
  });
  // run the next live poll timer (the 8 s abort timers are skipped)
  const step = async () => {
    const t = timers.filter(x => !x.cleared && !x.ran && x.ms !== 8000).shift();
    if (!t) return null;
    t.ran = true; await t.fn(); return t.ms;
  };
  return { p, timers, states, claimed, calls, step, advance: ms => { clock += ms; } };
}

test("sends the nonce and the poll secret, waits, then reports signed on phone", async () => {
  const h = harness([{ status: "pending" }, CLAIMED]);
  h.p.start();
  assert.equal(h.states[0][0], "waiting");
  assert.equal(await h.step(), 1500);
  assert.equal(await h.step(), 1500);
  assert.deepEqual(h.calls[0], { nonce: "N", secret: "S" });
  assert.equal(h.states.at(-1)[0], "signed_on_phone");
  assert.equal(h.claimed.length, 1);
  assert.equal(h.p.isStopped(), true);
});

test("flaky network: retries with growing backoff, then still finishes login", async () => {
  const net = () => Object.assign(new TypeError("Failed to fetch"));
  const h = harness([net(), net(), httpErr(503), httpErr(429), net(), CLAIMED]);
  h.p.start();
  const delays = [];
  for (let i = 0; i < 6; i++) delays.push(await h.step());
  assert.deepEqual(delays, [1500, ...BACKOFF_STEPS_MS, 10000].slice(0, 6));
  assert.ok(h.states.some(([s]) => s === "retrying"));
  assert.equal(h.states.at(-1)[0], "signed_on_phone");
});

test("a recovered session (lost reply) finishes login like a normal one", async () => {
  const h = harness([httpErr(504), { ...CLAIMED, recovered: true }]);
  h.p.start(); await h.step(); await h.step();
  assert.equal(h.claimed.length, 1);
  assert.deepEqual(h.states.at(-1), ["signed_on_phone", { recovered: true }]);
});

test("410 challenge_consumed never says 'QR expired'", async () => {
  const h = harness([httpErr(410, "challenge_consumed")]);
  h.p.start(); await h.step();
  const [s, d] = h.states.at(-1);
  assert.equal(s, "failed");
  assert.equal(d.reason, "consumed");
  assert.doesNotMatch(d.message, /expired/i);
});

test("410 challenge_expired (nobody signed) says the QR ran out", async () => {
  const h = harness([httpErr(410, "challenge_expired")]);
  h.p.start(); await h.step();
  assert.equal(h.states.at(-1)[1].reason, "expired");
});

test("403 (no or wrong secret) fails without retrying", async () => {
  const h = harness([httpErr(403, "poll_not_allowed")]);
  h.p.start(); await h.step();
  assert.equal(h.states.at(-1)[1].reason, "not_allowed");
  assert.equal(await h.step(), null);
});

test("gives up after the QR expiry plus the recovery window if the network never comes back", async () => {
  const errs = Array.from({ length: 100 }, () => new TypeError("offline"));
  const h = harness(errs);
  h.p.start();
  await h.step();
  h.advance(180000 + 120000 + 1);
  await h.step();
  const [s, d] = h.states.at(-1);
  assert.equal(s, "failed");
  assert.equal(d.reason, "gave_up");
});

test("stop() ends the loop; no poll after stop", async () => {
  const h = harness([{ status: "pending" }]);
  h.p.start(); h.p.stop();
  assert.equal(await h.step(), null);
  assert.equal(h.calls.length, 0);
});

test("classify: transient vs final", () => {
  assert.equal(classify(new TypeError("x")), "retry");
  assert.equal(classify(httpErr(500)), "retry");
  assert.equal(classify(httpErr(429)), "retry");
  assert.equal(classify(httpErr(410, "challenge_consumed")), "consumed");
  assert.equal(classify(httpErr(400)), "error");
  for (const m of Object.values(FAIL_MESSAGES)) assert.ok(m.length > 10);
});

const ROOT = new URL("../../", import.meta.url);
const read = f => readFileSync(new URL(f, ROOT), "utf8");

test("Org.html: QR carries the nonce only, never the poll secret", () => {
  const html = read("Org.html");
  const fn = html.slice(html.indexOf("function buildQrLoginUrl()"), html.indexOf("let qrLoginPollSecret"));
  assert.match(fn, /nonce=/);
  assert.doesNotMatch(fn, /secret/i);
  assert.match(html, /<script src="js\/login-poll\.js"><\/script>/);
  assert.match(html, /loginPoll\(nonce, secret, o\)/);
  assert.match(html, /Build v6\.(8\.([5-9]|\d\d)|(9|\d\d)\.\d+)</, "build is v6.8.5 or later");
});

test("Org.html: the countdown reaching zero asks the server instead of declaring 'QR expired'", () => {
  const html = read("Org.html");
  const fn = html.slice(html.indexOf("function updateQrLoginCountdown()"), html.indexOf("async function pollQrLogin()"));
  assert.doesNotMatch(fn, /cancelQrLogin/);
  assert.match(fn, /pollNow\(\)/);
});

test("org-login.html: a phone that scanned a computer's QR does not collect the session", () => {
  const html = read("org-login.html");
  assert.match(html, /function pendingPollSecret\(\)/);
  assert.match(html, /irlid_pending_login_nonce"\) !== nonce/);
  const fn = html.slice(html.indexOf("async function persistClaimedSessionLocally()"), html.indexOf("// ── Initial validation"));
  assert.match(fn, /if \(!secret\)[^\n]*return null/);
  assert.match(fn, /X-Login-Poll-Secret/);
  assert.match(html, /Your computer will finish logging in/);
});

test("same-device flows stash the poll secret beside the nonce (never in a URL)", () => {
  const entry = read("org-entry.html");
  assert.match(entry, /irlid_pending_login_secret/);
  const org = read("Org.html");
  assert.equal((org.match(/setItem\(STAFF_SCAN_PENDING_SECRET_KEY/g) || []).length, 2);
  assert.doesNotMatch(org + entry, /[?&]poll_secret=/);
});

test("orgapi.js sends the poll secret as a header", () => {
  const js = read("js/orgapi.js");
  assert.match(js, /"X-Login-Poll-Secret": pollSecret/);
});

test("sw.js caches the new script and is bumped to v195 or later", () => {
  const sw = read("sw.js");
  assert.ok(Number(sw.match(/CACHE_VERSION = 'irlid-shell-v(\d+)'/)[1]) >= 195);
  assert.match(sw, /'\.\/js\/login-poll\.js'/);
});
