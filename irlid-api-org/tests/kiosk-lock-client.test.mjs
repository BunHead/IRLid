// Kiosk lock, browser side (js/kiosk-lock.js + its wiring in Org.html).
// The screen only unlocks on a Worker "claimed" result with unlocked: true.
// Offline, expired, rejected, cancelled or a flaky network all keep it locked.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");

function loadKioskLock() {
  const sandbox = { window: { crypto: globalThis.crypto }, setTimeout, clearTimeout, Promise, TextEncoder, atob, Uint8Array, crypto: globalThis.crypto };
  vm.createContext(sandbox);
  vm.runInContext(read("js/kiosk-lock.js"), sandbox, { filename: "kiosk-lock.js" });
  return sandbox.window.IRLidKioskLock;
}

const K = loadKioskLock();

function fakeUi() {
  const log = [];
  return { log, qr: null, showQr(t) { this.qr = t; }, setStatus(text, kind) { log.push([kind, text]); } };
}
const noSleep = () => Promise.resolve();

test("lock state: locked by setting, Esc/F11/X attempts stay locked", () => {
  const s = K.createLockState(true);
  assert.equal(s.isLocked(), true);
  assert.equal(s.exitAttempt(), "stay");
  assert.equal(K.createLockState(false).exitAttempt(), "exit");
  // Anything but a claimed unlock result is ignored.
  assert.equal(s.acceptUnlock({ status: "pending" }), false);
  assert.equal(s.acceptUnlock({ status: "claimed" }), false);
  assert.equal(s.acceptUnlock({ status: "claimed", action_result: { unlocked: "true" } }), false);
  assert.equal(s.isLocked(), true);
  assert.equal(s.acceptUnlock({ status: "claimed", action_result: { unlocked: true } }), true);
  assert.equal(s.isLocked(), false);
  assert.equal(s.exitAttempt(), "exit");
});

test("unlock flow: shows the QR, waits, unlocks on a claimed result", async () => {
  const state = K.createLockState(true);
  const ui = fakeUi();
  const polls = [{ status: "pending" }, { status: "pending" }, { status: "claimed", action_result: { unlocked: true } }];
  const r = await K.runUnlock({
    init: async () => ({ nonce: "n1234567890abcdef", auth_url: "https://irlid.co.uk/org-action-auth.html?nonce=n1", expires_at: Date.now() + 180000 }),
    poll: async () => polls.shift()
  }, ui, { state, sleep: noSleep });
  assert.equal(r.outcome, "unlocked");
  assert.equal(ui.qr, "https://irlid.co.uk/org-action-auth.html?nonce=n1");
  assert.equal(state.isLocked(), false);
});

test("unlock flow: offline kiosk stays locked and says why", async () => {
  const state = K.createLockState(true);
  const ui = fakeUi();
  const r = await K.runUnlock({ init: async () => { throw new TypeError("Failed to fetch"); }, poll: async () => ({}) }, ui, { state, sleep: noSleep });
  assert.equal(r.outcome, "offline");
  assert.equal(state.isLocked(), true);
  assert.match(ui.log.at(-1)[1], /needs the internet/);
});

test("unlock flow: expired sign-in on the kiosk stays locked", async () => {
  const state = K.createLockState(true);
  const ui = fakeUi();
  const e = new Error("session_expired"); e.data = { error: "session_expired" };
  const r = await K.runUnlock({ init: async () => { throw e; }, poll: async () => ({}) }, ui, { state, sleep: noSleep });
  assert.equal(r.outcome, "no_session");
  assert.equal(state.isLocked(), true);
});

test("unlock flow: rejected, expired and wrong results keep it locked", async () => {
  for (const [polled, outcome] of [
    [{ status: "rejected" }, "rejected"],
    [{ status: "expired" }, "expired"],
    [{ status: "claimed", action_result: { deleted: true } }, "failed"]
  ]) {
    const state = K.createLockState(true);
    const r = await K.runUnlock({
      init: async () => ({ nonce: "n", auth_url: "u", expires_at: Date.now() + 60000 }),
      poll: async () => polled
    }, fakeUi(), { state, sleep: noSleep });
    assert.equal(r.outcome, outcome);
    assert.equal(state.isLocked(), true, outcome);
  }
});

test("unlock flow: the code running out on the kiosk's side stops waiting", async () => {
  const state = K.createLockState(true);
  let t = 1000;
  const r = await K.runUnlock({
    init: async () => ({ nonce: "n", auth_url: "u", expires_at: 5000 }),
    poll: async () => { t += 3000; return { status: "pending" }; }
  }, fakeUi(), { state, sleep: noSleep, now: () => t });
  assert.equal(r.outcome, "expired");
  assert.equal(state.isLocked(), true);
});

test("unlock flow: a flaky network is retried with backoff, still locked meanwhile", async () => {
  const state = K.createLockState(true);
  const delays = [];
  let n = 0;
  const r = await K.runUnlock({
    init: async () => ({ nonce: "n", auth_url: "u", expires_at: Date.now() + 180000 }),
    poll: async () => {
      n += 1;
      assert.equal(state.isLocked(), true);
      if (n <= 4) throw new TypeError("network");
      return { status: "claimed", action_result: { unlocked: true } };
    }
  }, fakeUi(), { state, sleep: (ms) => { delays.push(ms); return Promise.resolve(); } });
  assert.equal(r.outcome, "unlocked");
  assert.deepEqual(delays, [1500, 3000, 6000, 8000, 8000]);
});

test("unlock flow: Stay locked cancels the wait", async () => {
  const state = K.createLockState(true);
  let cancelled = false;
  const r = await K.runUnlock({
    init: async () => ({ nonce: "n", auth_url: "u", expires_at: Date.now() + 180000 }),
    poll: async () => { cancelled = true; return { status: "pending" }; }
  }, fakeUi(), { state, sleep: noSleep, isCancelled: () => cancelled });
  assert.equal(r.outcome, "cancelled");
  assert.equal(state.isLocked(), true);
});

test("Org.html: Lock full screen toggle exists, unchecked by default, hydrated from the server only", () => {
  const html = read("Org.html");
  const toggle = html.match(/<input[^>]*id="lockFullscreen"[^>]*>/);
  assert.ok(toggle, "toggle missing");
  assert.doesNotMatch(toggle[0], /checked/);
  assert.match(html, /settings\.lockFullscreen = src\.lockFullscreen === true;/);
  assert.match(html, /window\.__irlidLockFullscreenHydrated \? \{ lockFullscreen: irlidKioskLockFullscreenForSave\(\) \}/);
  assert.match(html, /<script src="js\/kiosk-lock\.js(\?v=[0-9.]+)?"><\/script>/);
  // Only the real Check-in full screen locks, never the theme preview.
  assert.match(html, /const kioskLockOn = !!\(settings && \(settings\.lockFullscreen === true \|\| settings\.kioskMode === true\)\) && !emitInSetup &&\s*document\.body\.dataset\.activePanel === 'checkin';/);
  // When locked there is no plain X.
  assert.match(html, /if \(!kioskLockOn\) clone\.appendChild\(closeBtn\);/);
  // Unlock asks the Worker for the kiosk action, never builds a payload with extra fields.
  assert.match(html, /action_type: 'irlid_kiosk_unlock_v5',\s*action_payload: \{ org_id: /);
});

test("sw.js keeps the lock script in the offline shell", () => {
  const sw = read("sw.js");
  assert.match(sw, /'\.\/js\/kiosk-lock\.js',/);
});

test("org-action-auth.html labels the kiosk unlock for the phone", () => {
  assert.match(read("org-action-auth.html"), /irlid_kiosk_unlock_v5'\) return 'Kiosk Unlock'/);
});

// ---- Offline unlock code (Lead Admin / Developer phone, no internet) ----

async function kioskKeyB64(seedBytes, orgId, kioskId) {
  return Buffer.from(await K.deriveKioskKey(seedBytes, orgId, kioskId)).toString("base64url");
}
const seedA = new Uint8Array(32).fill(7);
const seedB = new Uint8Array(32).fill(9);

test("offline code: the phone's code for this screen and challenge unlocks, once", async () => {
  const keys = [{ key_id: "lead-a", k: await kioskKeyB64(seedA, "org-1", "KIOSK0001") }];
  const v = K.createOfflineVerifier({ keys });
  const { challenge } = v.challenge();
  assert.match(challenge, /^[0-9A-HJKMNP-TV-Z]{8}$/);
  // The phone derives the same key from its seed and makes the code.
  const code = await K.offlineCode(await K.deriveKioskKey(seedA, "org-1", "KIOSK0001"), challenge);
  assert.match(code, /^\d{8}$/);
  const ok = await v.check(code.slice(0, 4) + " " + code.slice(4));
  assert.equal(ok.ok, true);
  assert.equal(ok.key_id, "lead-a");
  const state = K.createLockState(true);
  assert.equal(state.acceptOfflineUnlock(ok), true);
  assert.equal(state.isLocked(), false);
  // Single use: the same code is useless against the next challenge (photo replay, S12).
  const next = v.challenge();
  assert.notEqual(next.challenge, challenge);
  const replay = await v.check(code);
  assert.equal(replay.ok, false);
});

test("offline code: two checks at once (double submit) accept the code only once", async () => {
  const keys = [
    { key_id: "lead-a", k: await kioskKeyB64(seedB, "org-1", "KIOSK0001") },
    { key_id: "lead-b", k: await kioskKeyB64(seedA, "org-1", "KIOSK0001") }
  ];
  const v = K.createOfflineVerifier({ keys });
  const { challenge } = v.challenge();
  const code = await K.offlineCode(await K.deriveKioskKey(seedA, "org-1", "KIOSK0001"), challenge);
  const results = await Promise.all([v.check(code), v.check(code), v.check(code)]);
  assert.equal(results.filter((r) => r.ok).length, 1, JSON.stringify(results));
  // And afterwards the code is spent.
  assert.equal((await v.check(code)).ok, false);
});

test("offline code: a code made for another screen or another challenge fails", async () => {
  const keys = [{ key_id: "lead-a", k: await kioskKeyB64(seedA, "org-1", "KIOSK0001") }];
  const v = K.createOfflineVerifier({ keys });
  const { challenge } = v.challenge();
  const otherScreen = await K.offlineCode(await K.deriveKioskKey(seedA, "org-1", "KIOSK0002"), challenge);
  const otherOrg = await K.offlineCode(await K.deriveKioskKey(seedA, "org-2", "KIOSK0001"), challenge);
  const otherSeed = await K.offlineCode(await K.deriveKioskKey(seedB, "org-1", "KIOSK0001"), challenge);
  const otherChallenge = await K.offlineCode(await K.deriveKioskKey(seedA, "org-1", "KIOSK0001"), "ZZZZZZZZ");
  for (const c of [otherScreen, otherOrg, otherSeed, otherChallenge]) {
    const r = await v.check(c);
    assert.equal(r.ok, false);
  }
});

test("offline code: 5 wrong codes retire the challenge", async () => {
  const keys = [{ key_id: "lead-a", k: await kioskKeyB64(seedA, "org-1", "KIOSK0001") }];
  const v = K.createOfflineVerifier({ keys });
  const first = v.challenge().challenge;
  const good = await K.offlineCode(await K.deriveKioskKey(seedA, "org-1", "KIOSK0001"), first);
  const wrong = good === "00000000" ? "11111111" : "00000000";
  let r;
  for (let i = 0; i < 4; i += 1) { r = await v.check(wrong); assert.equal(r.reason, "wrong"); }
  r = await v.check(wrong);
  assert.equal(r.reason, "locked_out");
  assert.equal(r.challenge, first);
  // The right code for the retired challenge no longer works.
  assert.notEqual(v.challenge().challenge, first);
  assert.equal((await v.check(good)).ok, false);
});

test("offline code: a challenge older than 90 s is refused", async () => {
  let t = 0;
  const keys = [{ key_id: "lead-a", k: await kioskKeyB64(seedA, "org-1", "KIOSK0001") }];
  const v = K.createOfflineVerifier({ keys, now: () => t });
  const { challenge, expires_at } = v.challenge();
  assert.equal(expires_at, 90000);
  const code = await K.offlineCode(await K.deriveKioskKey(seedA, "org-1", "KIOSK0001"), challenge);
  t = 90001;
  const r = await v.check(code);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "expired");
});

test("offline code: no cached keys means it stays locked; bad input is rejected", async () => {
  const v = K.createOfflineVerifier({ keys: [] });
  v.challenge();
  assert.equal((await v.check("12345678")).reason, "no_keys");
  const v2 = K.createOfflineVerifier({ keys: [{ key_id: "x", k: await kioskKeyB64(seedA, "o", "KIOSK0001") }] });
  v2.challenge();
  assert.equal((await v2.check("1234")).reason, "format");
  const s = K.createLockState(true);
  assert.equal(s.acceptOfflineUnlock({ ok: false }), false);
  assert.equal(s.acceptOfflineUnlock({ ok: true }), false);
  assert.equal(s.isLocked(), true);
});

test("Org.html: Kiosk mode toggle, off by default, Lock full screen under it, auto opens Check-in", () => {
  const html = read("Org.html");
  const km = html.match(/<input[^>]*id="kioskMode"[^>]*>/);
  assert.ok(km);
  assert.doesNotMatch(km[0], /checked/);
  // Lock full screen sits inside the Kiosk group, after Kiosk mode.
  const group = html.slice(html.indexOf('id="kioskSettingsGroup"'), html.indexOf('id="v511AuthSaveBtn"'));
  assert.ok(group.indexOf('id="kioskMode"') > 0 && group.indexOf('id="kioskMode"') < group.indexOf('id="lockFullscreen"'));
  assert.match(html, /settings\.kioskMode = src\.kioskMode === true;/);
  assert.match(html, /window\.__irlidKioskModeHydrated \? \{ kioskMode:/);
  assert.match(html, /if \(!\(settings && settings\.kioskMode === true\)\) return;/);
  assert.match(html, /if \(name === 'checkin'\) \{[\s\S]{0,200}irlidKioskAutoOpen/);
  // Offline codes are wired into the lock.
  assert.match(html, /offline: kioskLockOn \? \{/);
});

test("sw.js serves the lock script and the phone code page from the offline shell", () => {
  const sw = read("sw.js");
  assert.match(sw, /'\.\/kiosk-code\.html',/);
  const m = sw.match(/const DASHBOARD_PATHS = (\/.*\/);/);
  assert.ok(m);
  const re = eval(m[1]);
  for (const path of ["/kiosk-code.html", "/js/kiosk-lock.js", "/Org.html", "/js/sign.js"]) assert.ok(re.test(path), path);
});

// v6.8.7: the Kiosk and live-code toggles were inside the legacy settings
// shell (display: none), so no one could reach them. They must live in a
// visible tab: Settings > 5. Sign-in & Auth.
test("Org.html: Kiosk mode, Lock full screen and Require live screen code are in a visible Settings tab", () => {
  const html = read("Org.html");
  const authStart = html.indexOf('data-v511-panel="auth"');
  const authEnd = html.indexOf('data-v511-panel="tools"');
  assert.ok(authStart > 0 && authEnd > authStart);
  const shellStart = html.indexOf('<div class="settings-shell" style="display: none;">');
  for (const id of ["kioskMode", "lockFullscreen", "requireLiveCode", "kioskCodeSetupBtn"]) {
    const at = html.search(new RegExp('id="' + id + '"'));
    assert.ok(at > authStart && at < authEnd, id + " is not in Settings > Sign-in & Auth");
    assert.ok(shellStart < 0 || at < shellStart, id + " is inside the hidden legacy shell");
    assert.equal(html.split('id="' + id + '"').length - 1, 1, id + " must appear once");
  }
});
