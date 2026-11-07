// IRLid v5 QR login: the desktop's poll loop (v6.8.5, PR B).
//
// The desktop shows a login QR and polls the Worker until the phone has signed.
// This loop:
//   - sends the poll secret from /org/login/init on every poll (never in the QR);
//   - retries with backoff when the network is flaky (timeouts, offline, 5xx, 429);
//   - never says "QR expired" for a lost reply: the Worker hands the session
//     back to the same secret holder for a short window after it was collected,
//     so a retry after a lost reply simply finishes the login;
//   - reports clear states: waiting, retrying, signed_on_phone, failed.
//
// Pure logic with injected timers and poll function, so it is unit-tested in
// irlid-api-org/tests/login-poll-client.test.mjs.
(function (root) {
  "use strict";

  const BASE_POLL_MS = 1500;
  const BACKOFF_STEPS_MS = [1500, 3000, 6000, 10000];
  const REQUEST_TIMEOUT_MS = 8000;
  const DEFAULT_RECOVERY_WINDOW_MS = 120000;

  // Plain-English reasons for the failed state. None says "QR expired" unless
  // the QR really ran out before anyone signed it.
  const FAIL_MESSAGES = {
    expired: "The login QR ran out before a phone signed it. Get a fresh one.",
    consumed: "This login was already finished, or took too long to collect. Get a fresh QR.",
    not_allowed: "This page did not start this login. Get a fresh QR.",
    gave_up: "Could not reach IRLid to finish logging in. Check the connection and get a fresh QR.",
    error: "Login failed. Get a fresh QR."
  };

  function classify(err) {
    const status = err && err.status;
    const code = err && err.data && err.data.error;
    if (status === 410 && code === "challenge_consumed") return "consumed";
    if (status === 410) return "expired";
    if (status === 403) return "not_allowed";
    if (!status || status === 408 || status === 429 || status >= 500) return "retry";
    return "error";
  }

  function createLoginPoller(opts) {
    const o = opts || {};
    const poll = o.poll;                       // (nonce, secret, { signal }) => Promise<data>, throws {status, data}
    const nonce = o.nonce;
    const secret = o.secret;
    const now = o.now || (() => Date.now());
    const setT = o.setTimeout || ((fn, ms) => setTimeout(fn, ms));
    const clearT = o.clearTimeout || (t => clearTimeout(t));
    const random = o.random || Math.random;
    const onState = o.onState || function () {};
    const onClaimed = o.onClaimed || function () {};
    const timeoutMs = o.requestTimeoutMs || REQUEST_TIMEOUT_MS;
    const recoveryMs = o.recoveryWindowMs || DEFAULT_RECOVERY_WINDOW_MS;
    // Keep polling a little past the QR's own expiry: the phone may have signed
    // in the last seconds and the reply be in flight. The Worker answers 410
    // challenge_expired for an unsigned QR, which ends the loop.
    const hardDeadline = (o.expiresAtMs || (now() + 180000)) + recoveryMs;
    const AbortCtl = o.AbortController || (typeof AbortController !== "undefined" ? AbortController : null);

    let timer = null;
    let stopped = false;
    let failures = 0;
    let state = null;

    function setState(s, extra) {
      state = s;
      try { onState(s, extra || {}); } catch (_) {}
    }
    function finish(reason) {
      if (stopped) return;
      stopped = true;
      if (timer) clearT(timer);
      timer = null;
      setState("failed", { reason, message: FAIL_MESSAGES[reason] || FAIL_MESSAGES.error });
    }
    function schedule(ms) {
      if (stopped) return;
      timer = setT(tick, ms);
    }
    function backoffMs() {
      const step = BACKOFF_STEPS_MS[Math.min(failures - 1, BACKOFF_STEPS_MS.length - 1)];
      const jitter = 0.8 + random() * 0.4;     // ±20 %
      return Math.round(step * jitter);
    }

    async function tick() {
      timer = null;
      if (stopped) return;
      if (now() > hardDeadline) return finish(failures ? "gave_up" : "expired");
      let ctl = null; let killer = null;
      if (AbortCtl) { ctl = new AbortCtl(); killer = setT(() => { try { ctl.abort(); } catch (_) {} }, timeoutMs); }
      let data;
      try {
        data = await poll(nonce, secret, { signal: ctl ? ctl.signal : undefined });
      } catch (err) {
        if (killer) clearT(killer);
        if (stopped) return;
        const kind = classify(err);
        if (kind === "retry") {
          failures += 1;
          setState("retrying", { attempt: failures });
          return schedule(backoffMs());
        }
        return finish(kind);
      }
      if (killer) clearT(killer);
      if (stopped) return;
      if (data && data.status === "claimed" && data.session_token) {
        stopped = true;
        setState("signed_on_phone", { recovered: !!data.recovered });
        try { onClaimed(data); } catch (_) {}
        return;
      }
      if (failures) { failures = 0; }
      if (state !== "waiting") setState("waiting");
      schedule(BASE_POLL_MS);
    }

    return {
      start() { if (!stopped && !timer) { setState("waiting"); schedule(BASE_POLL_MS); } },
      stop() { stopped = true; if (timer) clearT(timer); timer = null; },
      pollNow() { if (stopped) return; if (timer) clearT(timer); timer = null; tick(); },
      state() { return state; },
      isStopped() { return stopped; }
    };
  }

  root.IRLidLoginPoll = { createLoginPoller, classify, FAIL_MESSAGES, BASE_POLL_MS, BACKOFF_STEPS_MS, REQUEST_TIMEOUT_MS };
})(typeof window !== "undefined" ? window : globalThis);
