// Two-org bleed fix (v6.8.14), dashboard side (Org.html, js/orgapi.js,
// js/offline-queue.js).
//
// What went wrong (12 Nov 2026): a person added from a staff scan while
// working in Test Event landed in Imbue Ventures. On the page:
//   - a reloaded page with no saved organisation (after sign-out and a
//     same-device sign-in) opened the FIRST organisation in the list without
//     asking; for a Developer that is the oldest of every organisation;
//   - the staff scan added the person to whichever organisation that browser
//     was in and ignored the organisation named in the scanned QR;
//   - the add-person dialog did not say which organisation it wrote to;
//   - sign-out and switching left the last organisation's settings, theme,
//     venue location and Organisation-tab fields behind.
// These tests run the page's real functions (cut out of Org.html) and check
// the order of the steps that matter.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const ROOT = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const html = read("Org.html");
const orgapi = read("js/orgapi.js");
const queueJs = read("js/offline-queue.js");

function fnSource(name) {
  let start = html.indexOf(`async function ${name}(`);
  if (start < 0) start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name + " exists in Org.html");
  let depth = 0;
  for (let i = html.indexOf("{", html.indexOf(")", start)); i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}" && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error("unbalanced " + name);
}
const constLine = (name) => {
  const m = html.match(new RegExp("^const " + name + " = .*;$", "m"));
  assert.ok(m, name + " is declared");
  return m[0];
};

const IMBUE = { id: "org-imbue", name: "Imbue Ventures Ltd", slug: "imbue-ventures", role: "developer" };
const TESTEV = { id: "org-test", name: "Test Event", slug: "test-event", role: "developer" };

// ---------- which organisation a reloaded page opens ----------

function pick(orgs, savedOrgId, sessionOrgId, isDeveloper) {
  const ctx = createContext({});
  runInContext(fnSource("pickOrgForRestoredSession"), ctx);
  ctx.args = [orgs, savedOrgId, sessionOrgId, isDeveloper];
  return JSON.parse(runInContext("JSON.stringify(pickOrgForRestoredSession(...args))", ctx));
}

test("THE INCIDENT: a Developer with no saved organisation is asked, never dropped into the first one", () => {
  // Signed out of Imbue, signed in again on the same device: session present,
  // nothing saved, nothing chosen yet. /user/orgs lists Imbue first.
  const r = pick([IMBUE, TESTEV], null, null, true);
  assert.equal(r.org, undefined, "no organisation is opened by itself");
  assert.deepEqual(r.orgs.map(o => o.id), ["org-imbue", "org-test"], "the picker is shown instead");
});

test("the organisation the server has on record for the session is the one opened", () => {
  assert.equal(pick([IMBUE, TESTEV], "org-test", "org-test", true).org.id, "org-test");
  // Saved organisation lost from this browser: the server's record still decides.
  assert.equal(pick([IMBUE, TESTEV], null, "org-test", true).org.id, "org-test");
});

test("if this browser and the server disagree, the page asks instead of guessing", () => {
  const r = pick([IMBUE, TESTEV], "org-imbue", "org-test", true);
  assert.equal(r.org, undefined);
  assert.equal(r.orgs.length, 2);
});

test("a saved organisation is matched by id only, never by name or slug, and never falls back to the first", () => {
  // An old session with no server record yet.
  assert.equal(pick([IMBUE, TESTEV], "org-test", null, false).org.id, "org-test");
  const gone = pick([IMBUE, TESTEV], "org-deleted", null, false);
  assert.equal(gone.org, undefined, "an unknown saved organisation opens nothing");
  assert.doesNotMatch(fnSource("pickOrgForRestoredSession"), /\.name|\.slug/);
});

test("a member of exactly one organisation still goes straight in; a Developer always picks", () => {
  assert.equal(pick([IMBUE], null, null, false).org.id, "org-imbue");
  assert.equal(pick([IMBUE], null, null, true).org, undefined);
  assert.deepEqual(pick([], null, null, false), { orgs: [] });
});

test("the start-up restore uses that rule and the old first-in-the-list fallback is gone", () => {
  assert.ok(!html.includes("freshOrgFromSession"), "the old matcher is removed");
  assert.doesNotMatch(html, /match \|\| orgs\[0\]/);
  const boot = html.slice(html.indexOf("const savedOrg = loadJson(STORAGE_KEY_ORG, null);"), html.indexOf("// v5.7.1c — Same-device staff_scan auto-auth"));
  assert.match(boot, /restore = await resolveOrgForRestoredSession\(savedOrg\)/);
  assert.match(boot, /showOrgPickerForRestoredSession\(restore\.orgs\)/);
  assert.doesNotMatch(boot, /myOrgs\[0\]|orgs\[0\]/, "start-up never opens 'the first organisation'");
  assert.match(fnSource("resolveOrgForRestoredSession"), /r\.session_org_id/);
});

// ---------- the scanned QR names its organisation ----------

function scanCtx(currentOrg, lookup) {
  const calls = [];
  const ctx = createContext({
    currentOrg,
    window: { IRLidOrgApi: { publicOrgInfo: async (code) => { calls.push(code); return lookup(code); } } }
  });
  runInContext([fnSource("scanOrgCodeOf"), fnSource("scanOrgCodeMatchesOrg"), fnSource("scanOrgMismatchMessage")].join("\n"), ctx);
  return { ctx, calls, message: (env) => { ctx.env = env; return runInContext("scanOrgMismatchMessage(env)", ctx); } };
}
const lookupAll = (code) => {
  const o = [IMBUE, TESTEV].find(x => x.id === code || x.slug === code);
  if (!o) { const e = new Error("org_not_found"); e.status = 404; throw e; }
  return { org_id: o.id, slug: o.slug, name: o.name };
};

test("THE INCIDENT: a QR scanned at Test Event is refused by a dashboard sitting in Imbue, naming both", async () => {
  const { message } = scanCtx(IMBUE, lookupAll);
  const msg = await message({ type: "device_key", org_code: "test-event" });
  assert.match(msg, /Test Event/);
  assert.match(msg, /Imbue Ventures Ltd/);
  assert.match(msg, /Nothing was added/);
  assert.match(msg, /Switch organisation/);
  assert.match(await message({ type: "device_key", org_code: "org-test" }), /Test Event/, "by id too");
});

test("a QR for the organisation the dashboard is in goes ahead, with no lookup", async () => {
  const { message, calls } = scanCtx(TESTEV, lookupAll);
  assert.equal(await message({ type: "device_key", org_code: "test-event" }), "");
  assert.equal(await message({ type: "device_key", org_code: "org-test" }), "");
  assert.equal(await message({ type: "device_key", org_code: "TEST-EVENT" }), "");
  assert.equal(await message({ type: "device_key" }), "", "an old QR with no organisation in it");
  assert.equal(calls.length, 0);
});

test("the check only ever refuses: unknown codes and no signal go ahead, old key-style codes never go in a URL", async () => {
  const offline = scanCtx(IMBUE, () => { throw new Error("Failed to fetch"); });
  assert.equal(await offline.message({ type: "device_key", org_code: "test-event" }), "", "offline: the door keeps working (C1, C6)");
  const unknown = scanCtx(IMBUE, lookupAll);
  assert.equal(await unknown.message({ type: "device_key", org_code: "old-printed-code" }), "");
  const keyStyle = scanCtx(IMBUE, lookupAll);
  assert.equal(await keyStyle.message({ type: "device_key", org_code: "org_secret_key_1234567890" }), "");
  assert.equal(keyStyle.calls.length, 0, "a key-style code is never sent in a URL");
});

test("both scan paths check the organisation before anything is recognised, opened or written", () => {
  for (const name of ["processDashboardScan", "tryProcessStaffScanIfPending"]) {
    const src = fnSource(name);
    const check = src.indexOf("scanOrgMismatchMessage(env)");
    assert.ok(check > 0, name + " checks the scanned organisation");
    assert.ok(check < src.indexOf("recogniseDeviceFp(env.pub_fp)"), name + ": before a known phone is checked in");
    assert.ok(check < src.indexOf("openEscalationModal(env)"), name + ": before the add-person dialog opens");
  }
});

test("the add-person dialog names the organisation and cannot write into another one", () => {
  assert.match(html, /Organisation: <strong id="escalationOrgName">/);
  const open = fnSource("openEscalationModal");
  assert.match(open, /orgId: currentOrg && currentOrg\.id/);
  assert.match(open, /orgLine\.textContent = /, "text only (S11)");
  assert.doesNotMatch(open, /escalationOrgName[^;]*innerHTML/);
  const base = fnSource("escalationBodyBase");
  assert.match(base, /doormanEscalationState\.orgId[^\n]*!== String\(currentOrg\.id\)/, "a dialog opened in one organisation refuses to act in another");
  assert.match(base, /base\.scan_org_code = scanOrgCode/, "the Worker is told which organisation the QR named");
  for (const name of ["addEscalationAtDoor", "bindEscalationExpected", "bindAdditionalEscalationExpected"]) {
    const src = fnSource(name);
    assert.ok(src.indexOf("escalationBodyBase()") > src.indexOf("try {"), name + ": the guard's message reaches staff");
    assert.ok(src.indexOf("escalationBodyBase()") < src.indexOf("signActionPayload("), name + ": checked before the staff member is asked to approve");
  }
});

// ---------- sign-out and switching leave nothing behind ----------

function resetCtx() {
  const store = new Map(Object.entries({
    irlid_org_local: JSON.stringify(IMBUE),
    irlid_org_local_settings: JSON.stringify({ welcomeMessage: "Welcome to Imbue" }),
    irlid_org_local_expected_attendees: JSON.stringify([{ id: "p1", display_name: "Imbue Person" }]),
    irlid_portal_full_v1: JSON.stringify({ logoUrl: "https://imbue.example/logo.png" }),
    v511_mockup_org_v1: JSON.stringify({ v511OrgContactEmail: "hello@imbue.example" }),
    irlid_pending_staff_scan_payload: "H:pending",
    irlid_login_session: "{\"session_token\":\"t\"}",
    irlid_kiosk_secret: "keep-me"
  }));
  const inputs = {};
  for (const id of ["v511OrgName", "v511OrgDescription", "v511OrgContactEmail", "v511OrgContactPhone", "v511OrgVenueAddress"]) {
    inputs[id] = { value: "IMBUE " + id, defaultValue: id === "v511OrgDescription" ? "Co-presence verification for events" : "" };
  }
  const calls = [];
  const ctx = createContext({
    localStorage: { removeItem: (k) => store.delete(k), getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) },
    document: { getElementById: (id) => inputs[id] || null },
    window: {
      __irlidRequireLiveCodeHydrated: true, __irlidLockFullscreenHydrated: true, __irlidKioskModeHydrated: true,
      v511VenueGpsReset: () => calls.push("venue"),
      v511HydrateCalendarDefaultsFromServer: (d) => calls.push("calendar:" + JSON.stringify(d))
    },
    calls
  });
  runInContext(`
    var STORAGE_KEY_ORG = "irlid_org_local", STORAGE_KEY_SETTINGS = "irlid_org_local_settings",
        STORAGE_KEY_EXPECTED = "irlid_org_local_expected_attendees", STORAGE_KEY_PORTAL = "irlid_portal_full_v1";
    var PORTAL_DEFAULTS = { logoUrl: "", welcomeMessage: "" };
    var currentOrg = { id: "org-imbue", name: "Imbue Ventures Ltd" };
    var portalState = { logoUrl: "https://imbue.example/logo.png" };
    var settings = { welcomeMessage: "Welcome to Imbue", requireLiveCode: true };
    var attendanceData = [{ id: "c1" }], receiptsHistoryRows = [{ id: "r1" }], attendanceStats = { currently_in: 3 };
    var expectedAttendees = [{ id: "p1" }], venueQrPayload = "imbue-qr", venueQrLiveNonce = "n1";
    var currentCheckinEventContext = { eventId: "e1", eventName: "Imbue class", orgKey: "org-imbue" };
    var doormanEscalationState = { env: { pub_fp: "x" }, orgId: "org-imbue" };
    var __staffScanPending = "H:pending";
    function closeEscalationModal() { calls.push("dialog-closed"); doormanEscalationState = null; }
    function clearPendingStaffScan() { localStorage.removeItem("irlid_pending_staff_scan_payload"); }
    function resetThemeToDefaults() { calls.push("theme"); }
    var orgLoadGeneration = 0;
    ${constLine("ORG_SCOPED_STORAGE_KEYS")}
    ${constLine("ORG_SCOPED_INPUT_IDS")}
    ${fnSource("resetOrgScopedState")}
  `, ctx);
  const state = () => JSON.parse(runInContext(`JSON.stringify({ currentOrg, portalState, settings, attendanceData, receiptsHistoryRows,
    attendanceStats, expectedAttendees, venueQrPayload, venueQrLiveNonce, currentCheckinEventContext, doormanEscalationState,
    pending: __staffScanPending, gen: orgLoadGeneration,
    flags: [window.__irlidRequireLiveCodeHydrated, window.__irlidLockFullscreenHydrated, window.__irlidKioskModeHydrated] })`, ctx));
  return { ctx, store, inputs, calls, state, reset: (opts) => { ctx.opts = opts; runInContext("resetOrgScopedState(opts)", ctx); } };
}

test("leaving an organisation clears everything the page and the browser kept about it", () => {
  const t = resetCtx();
  t.reset();
  const s = t.state();
  assert.equal(s.currentOrg, null);
  assert.deepEqual(s.portalState, { logoUrl: "", welcomeMessage: "" });
  assert.equal(s.settings.welcomeMessage, "");
  assert.equal(s.settings.requireLiveCode, undefined);
  assert.deepEqual([s.attendanceData, s.receiptsHistoryRows, s.expectedAttendees], [[], [], []]);
  assert.equal(s.attendanceStats, null);
  assert.equal(s.venueQrPayload, null);
  assert.equal(s.venueQrLiveNonce, null);
  assert.deepEqual(s.currentCheckinEventContext, { eventId: null, eventName: null, orgKey: null });
  assert.equal(s.doormanEscalationState, null, "an open add-person dialog is closed");
  assert.deepEqual(s.flags, [false, false, false], "server-only switches are not sent until they load for the new organisation");
  assert.equal(s.gen, 1, "slow replies for the old organisation are now stale");
  for (const key of ["irlid_org_local", "irlid_org_local_settings", "irlid_org_local_expected_attendees", "irlid_portal_full_v1", "v511_mockup_org_v1"]) {
    assert.equal(t.store.has(key), false, key + " is removed from this browser");
  }
  // The Organisation tab goes back to a fresh page, not the last organisation's text.
  assert.equal(t.inputs.v511OrgContactEmail.value, "");
  assert.equal(t.inputs.v511OrgVenueAddress.value, "");
  assert.equal(t.inputs.v511OrgDescription.value, "Co-presence verification for events");
  assert.deepEqual(t.calls, ["dialog-closed", "theme", "venue", "calendar:{}"], "dialog, theme, venue location and calendar defaults are reset");
  // Not organisation data: left alone here.
  assert.equal(t.store.get("irlid_kiosk_secret"), "keep-me");
});

test("a scan waiting to be processed is dropped only when the user signs out by hand", () => {
  const switching = resetCtx();
  switching.reset();
  assert.equal(switching.state().pending, "H:pending");
  assert.equal(switching.store.has("irlid_pending_staff_scan_payload"), true);
  const signOut = resetCtx();
  signOut.reset({ clearPendingScan: true });
  assert.equal(signOut.state().pending, null);
  assert.equal(signOut.store.has("irlid_pending_staff_scan_payload"), false);
});

test("sign-out runs that clear-out, and stops an organisation that is still loading", () => {
  const src = fnSource("signOutOrg");
  assert.match(src, /wipeSavedOrgSession\(\);/);
  assert.match(src, /orgLoadRequestSeq \+= 1;/);
  assert.match(src, /resetOrgScopedState\(\{ clearPendingScan: !!\(opts && opts\.userInitiated\) \}\);/);
  assert.match(fnSource("confirmAndSignOutOrg"), /signOutOrg\(\{ userInitiated: true \}\)/);
  // The Organisation-tab venue location is forgotten too (it used to be saved into the next organisation).
  assert.match(html, /window\.v511VenueGpsReset = function \(\) \{\s*hydrated = false;\s*touched = false;/);
});

test("opening an organisation: tell the server, clear the last one, then show the new one; slow replies are dropped", () => {
  const src = fnSource("loadDashboardForOrg");
  const bind = src.indexOf("await bindSessionToOrg(dashboardOrg)");
  const seq = src.indexOf("if (loadRequest !== orgLoadRequestSeq) return;");
  const reset = src.indexOf("resetOrgScopedState();");
  const set = src.indexOf("currentOrg = {");
  assert.ok(bind > 0 && bind < seq && seq < reset && reset < set, "order: server, last-pick-wins, clear, show");
  assert.ok((src.match(/if \(stale\(\)\) return;/g) || []).length >= 5, "every wait is followed by a stale check");
  assert.ok(src.indexOf("if (stale()) return;") < src.indexOf("applyServerSettingsToLocalState(s)"), "old settings are never applied to the new organisation");
});

test("a slow people or attendance reply for the organisation just left is dropped, not shown or cached under the next", () => {
  const people = fnSource("refreshExpectedAttendees");
  assert.match(people, /const expectedGeneration = orgLoadGeneration;/);
  assert.ok(people.indexOf("if (expectedGeneration !== orgLoadGeneration) return;") < people.indexOf("expectedAttendees = payload.expected"), "checked before the list is replaced");
  assert.ok(people.indexOf("expectedAttendees = payload.expected") < people.indexOf("saveCurrentOrgSnapshot('expected-refresh')"), "and so before the offline copy is saved");
  const attendance = fnSource("refreshAttendance");
  assert.match(attendance, /const attendanceGeneration = orgLoadGeneration;/);
  assert.ok(attendance.indexOf("if (attendanceGeneration !== orgLoadGeneration) return;") < attendance.indexOf("const checkins = payload.checkins"));
  assert.ok((attendance.match(/if \(attendanceGeneration !== orgLoadGeneration\) return;/g) || []).length >= 3, "the cached fallback is guarded too");
  // The next organisation's existing rows are not announced as new arrivals.
  assert.match(fnSource("resetOrgScopedState"), /__seenRowSnapshot = new Map\(\);\s*__seenSnapshotInitialised = false;/);
});

// ---------- the session is tied to the organisation ----------

function bindCtx(selectImpl) {
  const saved = [];
  const toasts = [];
  const ctx = createContext({
    qrLoginSession: { session_token: "tok-old", display_name: "Spencer", is_developer: true },
    window: { IRLidOrgApi: { selectSessionOrg: selectImpl } },
    localStorage: { setItem: (k, v) => saved.push([k, JSON.parse(v)]) },
    showToast: (m) => toasts.push(m)
  });
  runInContext(fnSource("bindSessionToOrg"), ctx);
  return { ctx, saved, toasts, bind: (org) => { ctx.org = org; return runInContext("bindSessionToOrg(org)", ctx); } };
}
const httpError = (status, message, data) => Object.assign(new Error(message), { status, data });

test("switching organisation adopts the new session token and saves it", async () => {
  const t = bindCtx(async (token, orgId) => { assert.equal(token, "tok-old"); assert.equal(orgId, "org-test"); return { session_token: "tok-new", switched: true }; });
  assert.equal(await t.bind(TESTEV), true);
  assert.equal(t.ctx.qrLoginSession.session_token, "tok-new");
  assert.deepEqual(t.saved[0][0], "irlid_login_session");
  assert.equal(t.saved[0][1].session_token, "tok-new");
});

test("a refusal stops the organisation opening; no signal or an older Worker does not (C1)", async () => {
  const refused = bindCtx(async () => { throw httpError(403, "not_a_member", { message: "Your sign-in does not have staff access to this organisation." }); });
  assert.equal(await refused.bind(TESTEV), false);
  assert.match(refused.toasts[0], /Could not open Test Event/);
  assert.equal(await bindCtx(async () => { throw httpError(404, "org_not_found"); }).bind(TESTEV), false);
  assert.equal(await bindCtx(async () => { throw new Error("Failed to fetch"); }).bind(TESTEV), true, "offline");
  assert.equal(await bindCtx(async () => { throw httpError(404, "Not found"); }).bind(TESTEV), true, "Worker not updated yet");
  assert.equal(await bindCtx(async () => { throw httpError(500, "Internal error"); }).bind(TESTEV), true);
});

test("orgapi: the session is tied with POST /user/session/org, and a refusal for the wrong organisation is announced", () => {
  assert.match(orgapi, /selectSessionOrg\(sessionToken, orgId\) \{\s*return request\("\/user\/session\/org", \{\s*method: "POST",\s*sessionToken,\s*body: \{ org_id: orgId \}/);
  assert.match(orgapi, /response\.status === 403 && data && data\.error === "session_org_mismatch"/);
  assert.match(orgapi, /new CustomEvent\("irlid:session-org-mismatch"/);
  // A door check-in "not counted" for the wrong organisation is a failure for a live call, never a success.
  assert.match(orgapi, /response\.status === 202 && data && data\.quarantined && data\.reason === "session_org_mismatch"/);
  // It is not queue-eligible: tying the session never waits in the offline queue (S10).
  assert.doesNotMatch(orgapi, /QUEUE_ELIGIBLE_PATHS = \[[^\]]*session\/org/);
});

test("the page stops and asks when the Worker says the sign-in is in another organisation", () => {
  const at = html.indexOf("window.addEventListener('irlid:session-org-mismatch'");
  assert.ok(at > 0);
  const handler = html.slice(at, html.indexOf("setTimeout(function () { __sessionOrgMismatchHandling = false; }", at));
  assert.match(handler, /resetOrgScopedState\(\);/);
  assert.match(handler, /signedInSwitchOrg\(\);/);
  assert.match(handler, /Nothing was saved/);
});

test("a queued change the Worker did not count is shown to staff, whatever kind it is", () => {
  assert.match(queueJs, /if \(response\.status === 202\) \{\s*let result = null;/);
  assert.doesNotMatch(queueJs, /response\.status === 202 && op\.kind === "org_checkin"/);
  assert.match(html, /window\.addEventListener\('irlid:queue-quarantined'/);
});

// ---------- the theme always belongs to the organisation shown ----------

test("a theme that cannot load falls back to the plain look, and a late theme is never applied to another organisation", () => {
  const src = fnSource("loadThemeFromServer");
  assert.match(src, /const themeOrgId = currentOrg\.id;/);
  assert.match(src, /getOrgSettings\(themeOrgId\);\s*if \(themeOrgLeft\(\)\) return;/);
  const failure = src.slice(src.indexOf("} catch (err) {"));
  assert.match(failure, /if \(themeOrgLeft\(\)\) return;/);
  assert.match(failure, /resetThemeToDefaults\(\);/, "it used to leave the last organisation's theme on screen");
  assert.match(fnSource("resetThemeToDefaults"), /activeTheme = normalizeThemeForSave\(\{\}\);/);
  assert.match(fnSource("resetOrgScopedState"), /resetThemeToDefaults\(\)/);
});

test("build and cache version are bumped so phones and screens get the fix (W8)", () => {
  assert.match(html, /Build v6\.8\.(1[4-9]|[2-9]\d)</);
  const swVer = Number((read("sw.js").match(/CACHE_VERSION = 'irlid-shell-v(\d+)'/) || [])[1]);
  assert.ok(swVer >= 205, "sw.js CACHE_VERSION should be at least v205, got v" + swVer);
  assert.match(read("CHANGELOG.md"), /## irlid-shell-v205\n\nv6\.8\.14 TWO-ORG BLEED FIX/);
});
