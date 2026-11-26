// v6.8.28 - the kiosk lock FAILS CLOSED (Imbue kiosk, 24 Nov 2026: the padlock
// was missing and the X gave full dashboard access).
// The real functions are lifted out of Org.html and run on stubs. The page
// sequence is the one in loadOrg: reset -> set currentOrg -> keep closed ->
// settings call (reply / failure / slow) -> offline copy.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../../Org.html", import.meta.url), "utf8");

function fn(name) {
  const start = html.indexOf("function " + name + "(");
  assert.ok(start > 0, "found " + name);
  let i = html.indexOf("{", start), depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}" && --depth === 0) break;
  }
  return html.slice(start, i + 1);
}

// A fresh phone/browser per call. `ls` is the device's localStorage.
function page({ ls = {}, org = { id: "org-imbue" } } = {}) {
  const store = new Map(Object.entries(ls));
  const boxes = { lockFullscreen: { checked: false, disabled: false }, kioskMode: { checked: false } };
  const ctx = {
    console, JSON, Date,
    window: {},
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    document: { getElementById: id => boxes[id] || null },
    currentOrg: org,
    settings: { minScore: 50 },                       // what resetOrgScopedState leaves: no lock keys
    STORAGE_KEY_SETTINGS: "s", saveJson() {}, applyRoleLabelsToViewingAs() {},
    renderStats() {}, renderExpectedAttendees() {}, updateAttendanceEventProgress() {}, renderTable() {},
    updateRelativeRefresh() {}, updateSnapshotFreshnessLabel() {}, lastRefreshAt: 0, expectedAttendees: [], attendanceData: [],
    receiptsHistoryRows: [], attendanceStats: null, activeTheme: null,
    // stands in for applyServerSettingsToLocalState: the lock part is the real code
    applySettings(src, opts) { ctx.irlidKioskLockApply(src || {}, !!(opts && opts.authoritative === true)); },
    applyServerSettingsToLocalState(src, opts) { ctx.applySettings(src, opts); }
  };
  vm.createContext(ctx);
  vm.runInContext("const KIOSK_LOCK_MEMORY_PREFIX = 'irlid_kiosk_lock_v1:';", ctx);
  for (const name of ["irlidKioskLockMemoryRead", "irlidKioskLockRemember", "irlidKioskLockRememberedOn", "irlidKioskLockKeepClosed",
    "irlidKioskLockApply", "irlidKioskLockShouldShow", "applySnapshotToDashboard"]) {
    vm.runInContext(fn(name).replace(/^function (\w+)/, "globalThis.$1 = function $1"), ctx);
  }
  return {
    ctx, store, boxes,
    // padlock (true) or X (false) on the check-in full screen
    padlock: () => vm.runInContext("irlidKioskLockShouldShow()", ctx),
    // resetOrgScopedState + the first lines of loadOrg after it
    selectOrg() { ctx.settings = { minScore: 50 }; vm.runInContext("irlidKioskLockKeepClosed(null)", ctx); },
    serverReply(settings) { ctx.applyServerSettingsToLocalState(settings, { authoritative: true }); },
    orgListRow(settings) { ctx.applyServerSettingsToLocalState(settings); },
    offlineCopy(snap) { return ctx.applySnapshotToDashboard(snap); },
    remembered: () => JSON.parse(store.get("irlid_kiosk_lock_v1:org-imbue") || "null")
  };
}

test("(a) settings fetch fails or is slow: the padlock is still shown, not the X", () => {
  // The kiosk was locked on its last good visit.
  const p = page({ ls: { "irlid_kiosk_lock_v1:org-imbue": JSON.stringify({ lf: 1, km: 0, at: 1 }) } });
  p.selectOrg();                           // reset switched everything off, then the org is chosen
  assert.equal(p.ctx.settings.lockFullscreen, true, "lock restored from this device's memory before any fetch");
  assert.equal(p.padlock(), true, "slow fetch: still the padlock");
  // the settings call throws (network error) and there is no offline copy: nothing else runs
  assert.equal(p.padlock(), true, "failed fetch: still the padlock");
  // an org-list row or an empty object is not the server's word either
  p.orgListRow({});
  p.orgListRow({ lockFullscreen: false, kioskMode: false });
  assert.equal(p.padlock(), true, "a cached row cannot switch it off");
  // and it never marks the setting as loaded, so a save cannot send a guess back
  assert.ok(!p.ctx.window.__irlidLockFullscreenHydrated);
  assert.ok(!p.ctx.window.__irlidKioskModeHydrated);
});

test("(a) even if settings were wiped in memory, the full screen rule reads the device's memory", () => {
  const p = page({ ls: { "irlid_kiosk_lock_v1:org-imbue": JSON.stringify({ lf: 0, km: 1, at: 1 }) } });
  p.ctx.settings = { minScore: 50 };       // nothing restored yet
  assert.equal(p.padlock(), true);
});

test("(b) an empty or lock-less offline copy cannot wipe the lock", () => {
  for (const snap of [{ settings: {} }, { settings: { welcomeMessage: "hi" } }, { settings: { lockFullscreen: false, kioskMode: false } }, { settings: null }, {}]) {
    const p = page({ ls: { "irlid_kiosk_lock_v1:org-imbue": JSON.stringify({ lf: 1, km: 1, at: 1 }) } });
    p.selectOrg();
    assert.equal(p.offlineCopy(Object.assign({ expected: [], attendance: [] }, snap)), true);
    assert.equal(p.padlock(), true, "snapshot " + JSON.stringify(snap));
    assert.equal(p.ctx.settings.lockFullscreen, true);
    assert.equal(p.ctx.settings.kioskMode, true);
    assert.equal(p.remembered().lf, 1, "memory itself is untouched by an offline copy");
  }
});

test("(c) the server saying off turns the lock off: the X is shown, and that is remembered", () => {
  const p = page({ ls: { "irlid_kiosk_lock_v1:org-imbue": JSON.stringify({ lf: 1, km: 1, at: 1 }) } });
  p.selectOrg();
  assert.equal(p.padlock(), true, "locked until the server speaks");
  p.serverReply({ welcomeMessage: "hi", lockFullscreen: false, kioskMode: false });
  assert.equal(p.padlock(), false, "X shown");
  assert.deepEqual({ lf: p.remembered().lf, km: p.remembered().km }, { lf: 0, km: 0 });
  assert.equal(p.ctx.window.__irlidLockFullscreenHydrated, true);
  // next visit with the server unreachable stays off (it was really off)
  const next = page({ ls: Object.fromEntries(p.store) });
  next.selectOrg();
  assert.equal(next.padlock(), false);
});

test("a server reply that has no lock keys at all means off (defaults), and is remembered", () => {
  const p = page({ ls: { "irlid_kiosk_lock_v1:org-imbue": JSON.stringify({ lf: 1, km: 0, at: 1 }) } });
  p.selectOrg();
  p.serverReply({ welcomeMessage: "hi" });
  assert.equal(p.padlock(), false);
});

test("the server saying on turns it on and remembers it for the next visit", () => {
  const p = page();
  p.selectOrg();
  assert.equal(p.padlock(), false, "first ever visit, nothing remembered: behaves as before");
  p.serverReply({ lockFullscreen: true });
  assert.equal(p.padlock(), true);
  const next = page({ ls: Object.fromEntries(p.store) });
  next.selectOrg();
  assert.equal(next.padlock(), true, "restored with no network");
});

test("the memory is per organisation: another org's lock never applies (no two-org bleed)", () => {
  const p = page({ org: { id: "org-test" }, ls: { "irlid_kiosk_lock_v1:org-imbue": JSON.stringify({ lf: 1, km: 1, at: 1 }) } });
  p.selectOrg();
  assert.equal(p.padlock(), false, "Test Event is not locked because Imbue is");
});

test("storage trouble never throws and never unlocks a locked page", () => {
  const p = page({ ls: { "irlid_kiosk_lock_v1:org-imbue": "not json" } });
  p.selectOrg();
  assert.equal(p.padlock(), false, "unreadable memory = nothing remembered");
  p.ctx.settings.lockFullscreen = true;
  p.ctx.localStorage.setItem = () => { throw new Error("full"); };
  p.serverReply({ lockFullscreen: true });
  assert.equal(p.padlock(), true);
});

test("source: the loader restores the lock before the settings call; only real replies are authoritative", () => {
  const load = html.slice(html.indexOf("irlidDebugLog(\"[v5.5.5] currentOrg now:\""), html.indexOf("// Persist the freshly-cleaned-up state."));
  assert.ok(load.indexOf("irlidKioskLockKeepClosed(null)") > 0 && load.indexOf("irlidKioskLockKeepClosed(null)") < load.indexOf("getOrgSettings"), "restored before any fetch");
  assert.match(load, /authoritative: !!\(res && res\.settings && typeof res\.settings === 'object'\)/);
  assert.match(html, /applyServerSettingsToLocalState\(r, \{ authoritative: !!\(readback && readback\.settings && typeof readback\.settings === 'object'\) \}\)/);
  // the snapshot path re-asserts the lock after merging the offline copy
  const snap = html.slice(html.indexOf("function applySnapshotToDashboard"), html.indexOf("function showPanel"));
  assert.ok(snap.indexOf("Object.assign({}, settings, snap.settings)") < snap.indexOf("irlidKioskLockKeepClosed(snap.settings)"));
  // the check-in full screen uses the one rule; a locked screen has no X
  assert.match(html, /const kioskLockOn = irlidKioskLockShouldShow\(\) && !emitInSetup/);
  assert.match(html, /if \(!kioskLockOn\) clone\.appendChild\(closeBtn\);/);
  // the memory is not one of the keys wiped on org select or sign-out
  const reset = html.slice(html.indexOf("const ORG_SCOPED_STORAGE_KEYS"), html.indexOf("function resetOrgScopedState"));
  assert.ok(!/kiosk_lock/.test(reset));
});

test("the memory holds two yes/no flags and a time only: no names, keys or settings", () => {
  const p = page();
  p.selectOrg();
  p.serverReply({ lockFullscreen: true, welcomeMessage: "Welcome", orgTerms: "secret terms" });
  const raw = p.store.get("irlid_kiosk_lock_v1:org-imbue");
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ["at", "km", "lf"]);
  assert.ok(!/Welcome|secret/.test(raw));
});
