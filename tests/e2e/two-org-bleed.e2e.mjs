// End-to-end: one organisation can no longer write into another (v6.8.14).
//
// Replays the 12 Nov 2026 incident with the real Worker
// (irlid-api-org/src/index.js on an in-memory SQLite D1) and the real
// Org.html dashboard in Chromium.
//
// The incident: Spencer (Developer) signed out of Imbue Ventures and into
// Test Event, then added a new person from a staff scan. The person landed in
// Imbue. The staff phone's dashboard had no saved organisation (sign-out
// wipes it), so on reload it opened the first organisation in the Developer's
// list (Imbue, the oldest), and the add-person dialog wrote there. The QR the
// new phone showed said "Test Event", and nothing read it.
//
// What this test walks through:
//  1. Same start: session present, nothing saved, a scan for Test Event
//     waiting. The page must ask which organisation, not open Imbue.
//  2. Pick the wrong one (Imbue). The scan is refused, naming both
//     organisations. Nothing is written.
//  3. Switch to Test Event. Theme and name follow. The session token changes.
//  4. Scan again. The dialog says "Test Event". Add the person. They are in
//     Test Event and not in Imbue.
//  5. A forced write to Imbue from this sign-in is refused by the Worker.
//  6. Sign out. Nothing of the organisation is left in the browser.
//
// Needs Playwright + Chromium (pre-installed in the cloud container). Skips
// itself when Playwright is not available. Run: npm run test:e2e
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import worker from "../../irlid-api-org/src/index.js";
import { cleanup } from "./cleanup.mjs";

const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require("playwright")); } catch (_) { chromium = null; }

const ROOT = new URL("../../", import.meta.url).pathname;
const SITE_PORT = 8000;         // http://localhost:8000 is in the v5 origin allowlist
const SCHEMA = readFileSync(join(ROOT, "irlid-api-org/schema.sql"), "utf8");
// schema.sql still has the pre-v5.11 people table; live uses this shape.
const LIVE_EXPECTED = `
  DROP TABLE org_expected;
  CREATE TABLE org_expected (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, display_name TEXT NOT NULL, initials TEXT,
    role_key TEXT DEFAULT 'attendee', device_pub_fp TEXT, email_hint TEXT, phone_hint TEXT, notes TEXT,
    created_at INTEGER NOT NULL, archived_at INTEGER);
`;
const IMBUE_GREEN = "#15803D";
const DRAGON_RED = "#B91C1C";

class D1Statement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args.map(a => (a === undefined ? null : a)); return this; }
  stmt() { return this.db.prepare(this.sql); }
  async first() { return this.stmt().get(...this.args) ?? null; }
  async all() { return { results: this.stmt().all(...this.args) }; }
  async run() {
    if (/^\s*(SELECT|PRAGMA)\b/i.test(this.sql) || /\bRETURNING\b/i.test(this.sql)) return { results: this.stmt().all(...this.args), meta: {} };
    const info = this.stmt().run(...this.args);
    return { meta: { changes: Number(info.changes) } };
  }
}
class D1 {
  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec(SCHEMA);
    this.db.exec(LIVE_EXPECTED);
    const org = this.db.prepare("INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?)");
    // Imbue is the older organisation, with venue contact details of its own.
    org.run("org-imbue", "Imbue Ventures Ltd", "imbue-ventures", "org_e2e_imbue_key_1234567890",
      JSON.stringify({ theme: { primary: IMBUE_GREEN }, contactEmail: "hello@imbue.example", venueAddress: "1 Imbue Road", venueLat: 52.1, venueLon: -1.2, venueRadiusM: 150 }), 100, 100);
    org.run("org-test", "Test Event", "test-event", "org_e2e_testevent_key_123456",
      JSON.stringify({ theme: { primary: DRAGON_RED } }), 200, 200);
  }
  prepare(sql) { return new D1Statement(this.db, sql); }
  async batch(st) { const out = []; for (const s of st) out.push(await s.run()); return out; }
  people(orgId) { return this.db.prepare("SELECT display_name FROM org_expected WHERE org_id=? ORDER BY display_name").all(orgId).map(r => r.display_name); }
  get(sql, ...a) { return this.db.prepare(sql).get(...a) ?? null; }
}

function listen(server, port) {
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server.address().port)));
}

function startWorker(env) {
  return http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
    let r;
    try { r = await worker.fetch(new Request("http://localhost" + req.url, {
      method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body
    }), env, { waitUntil() {} }); } catch (e) { r = new Response(JSON.stringify({ error: "test_shim" }), { status: 500 }); }
    const out = Buffer.from(await r.arrayBuffer());
    const h = {};
    r.headers.forEach((v, k) => { h[k] = v; });
    h["access-control-allow-origin"] = "*";
    h["access-control-allow-headers"] = "*";
    h["access-control-allow-methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
    res.writeHead(req.method === "OPTIONS" ? 204 : r.status, h);
    res.end(req.method === "OPTIONS" ? undefined : out);
  });
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon", ".css": "text/css" };
function startSite() {
  return http.createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
    const file = join(ROOT, path === "/" ? "index.html" : path);
    if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
}

// A software stand-in for the staff phone's v5 hardware key (same as the
// kiosk test): a real WebAuthn-shaped envelope the Worker's verifier checks.
// Runs before every page script, and again after each reload.
const FAKE_V5 = `(() => {
  const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
  window.__e2eInstallV5 = async () => {
    let saved = JSON.parse(localStorage.getItem("e2e_fake_v5") || "null");
    if (!saved) {
      const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      const prv = await crypto.subtle.exportKey("jwk", kp.privateKey);
      const pubFull = await crypto.subtle.exportKey("jwk", kp.publicKey);
      saved = { prv, pub: { kty: "EC", crv: "P-256", x: pubFull.x, y: pubFull.y } };
      localStorage.setItem("e2e_fake_v5", JSON.stringify(saved));
    }
    const priv = await crypto.subtle.importKey("jwk", saved.prv, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    window.irlidV5Enrolled = () => true;
    window.irlidV5GetPublicJwk = () => saved.pub;
    window.irlidV5SignPayloadHash = async (hash) => {
      const clientData = new TextEncoder().encode(JSON.stringify({ type: "webauthn.get", challenge: b64u(hash), origin: location.origin }));
      const authData = new Uint8Array(37); authData[32] = 0x05;
      const cdh = new Uint8Array(await crypto.subtle.digest("SHA-256", clientData));
      const signed = new Uint8Array(37 + 32); signed.set(authData, 0); signed.set(cdh, 37);
      const sigRaw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, priv, signed));
      return { sigRaw, authData, clientData };
    };
    return saved.pub;
  };
})();`;
const QR_STUB = `window.QRCode = function (el, o) { el.setAttribute('data-qr-text', (o && o.text) || ''); el.textContent = 'QR'; }; window.QRCode.CorrectLevel = { L: 1, M: 0, Q: 2, H: 3 };`;

async function fpOf(pub) {
  const canonical = (v) => v === null || typeof v !== "object" ? JSON.stringify(v)
    : "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(pub))));
  return Buffer.from(h).toString("base64url").slice(0, 16);
}

// The orange "Get a member of staff" QR a first-time phone shows after it
// scanned Test Event's check-in QR (org-entry.html lightenEnvelopeForQr), and
// the link the staff phone's camera opens for it (scan.html -> "Open in staff
// dashboard").
async function staffScanUrl(site, orgCode, n) {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const j = await crypto.subtle.exportKey("jwk", kp.publicKey);
  const envelope = { v: 3, type: "device_key", pub_jwk: { x: j.x, y: j.y }, org_code: orgCode, ts: Math.floor(Date.now() / 1000) };
  const scanUrl = site + "/scan.html?type=device_key&payload=" + encodeURIComponent("H:" + Buffer.from(JSON.stringify(envelope)).toString("base64url"));
  return site + "/Org.html?dev=0&n=" + n + "#staff_scan=" + encodeURIComponent(scanUrl);
}

const visible = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); return !!el && getComputedStyle(el).display !== "none" && !el.classList.contains("hidden"); }, sel);

test("a staff scan made at Test Event can never add the person to Imbue", { skip: !chromium && !process.env.IRLID_E2E_REQUIRED && "Playwright not installed", timeout: 120000 }, async (t) => {
  const res = cleanup(t);
  const d1 = new D1();
  const env = { DB: d1, CORS_ORIGIN: "*", BOOTSTRAP_DEVELOPER_FP: "" };
  try {
    const workerServer = res.server(startWorker(env));
    const workerPort = await listen(workerServer, 0);
    const site = res.server(startSite());
    await listen(site, SITE_PORT);
    const browser = res.browser(await chromium.launch());
    const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 412, height: 915 } });
    await ctx.addInitScript(QR_STUB + FAKE_V5 + `window.IRLID_ORG_API_BASE_URL = 'http://localhost:${workerPort}';`);
    // Only the local site and Worker exist in this test; CDNs are blocked.
    await ctx.route((url) => !/^http:\/\/localhost:(8000|\d+)\//.test(url.href), (r) => r.abort());
    const phone = await ctx.newPage();
    const errors = [];
    phone.on("pageerror", (e) => errors.push(String(e)));
    const site0 = "http://localhost:" + SITE_PORT;

    // ---------- Spencer's staff phone: a Developer, signed in, nothing saved ----------
    await phone.goto(site0 + "/Org.html");
    const devPub = await phone.evaluate(() => window.__e2eInstallV5());
    const devFp = await fpOf(devPub);
    env.BOOTSTRAP_DEVELOPER_FP = devFp;
    d1.db.prepare("INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES (?,?,?,?,0,0)").run("u-spencer", JSON.stringify(devPub), devFp, "Spencer");
    // His oldest membership is Imbue, so /user/orgs lists Imbue first.
    d1.db.prepare("INSERT INTO org_memberships (org_id,user_id,role,granted_at) VALUES ('org-imbue','u-spencer','developer',1)").run();
    const T0 = "sess_e2e_spencer_abcdefghijklmnop";
    const nowS = Math.floor(Date.now() / 1000);
    d1.db.prepare("INSERT INTO login_sessions (token,user_id,issued_at,expires_at) VALUES (?,?,?,?)").run(T0, "u-spencer", nowS, nowS + 3600);
    // What org-login.html leaves after a same-device sign-in that followed a
    // sign-out: the session, and no saved organisation. Plus leftovers an
    // older build kept from the Imbue days.
    await phone.evaluate((tok) => {
      localStorage.setItem("irlid_login_session", JSON.stringify({ session_token: tok, user_id: "u-spencer", display_name: "Spencer", can_create_org: true, is_developer: true }));
      localStorage.removeItem("irlid_org_local");
      localStorage.setItem("v511_mockup_org_v1", JSON.stringify({ v511OrgContactEmail: "hello@imbue.example", v511OrgVenueAddress: "1 Imbue Road" }));
      localStorage.setItem("irlid_org_local_settings", JSON.stringify({ welcomeMessage: "Welcome to Imbue" }));
    }, T0);

    // ---------- 1. the scan arrives: the page asks, it does not open Imbue ----------
    await phone.goto(await staffScanUrl(site0, "test-event", 1));
    await phone.waitForFunction(() => document.querySelectorAll("#orgPickerList .org-picker-card").length === 2, null, { timeout: 15000 });
    assert.equal(await phone.evaluate(() => currentOrg), null, "no organisation was opened without asking");
    assert.equal(await visible(phone, "#doormanEscalationDialog"), false, "the add-person dialog did not open");
    assert.deepEqual(d1.people("org-imbue"), []);

    // ---------- 2. wrong organisation picked: the scan is refused ----------
    await phone.click('#orgPickerList .org-picker-card:has-text("Imbue Ventures Ltd")');
    await phone.waitForFunction(() => /Test Event/.test(document.getElementById("dashboardScanStatus")?.textContent || ""), null, { timeout: 15000 });
    const refusal = await phone.textContent("#dashboardScanStatus");
    assert.match(refusal, /Test Event/);
    assert.match(refusal, /Imbue Ventures Ltd/);
    assert.match(refusal, /Nothing was added/);
    assert.equal(await visible(phone, "#doormanEscalationDialog"), false, "no dialog for a scan that belongs to another organisation");
    assert.equal(await phone.evaluate(() => currentOrg.id), "org-imbue");
    assert.equal(await phone.evaluate(() => activeTheme.primary.toUpperCase()), IMBUE_GREEN, "Imbue's theme while in Imbue");
    assert.equal(await phone.evaluate(() => document.getElementById("v511OrgContactEmail").value), "hello@imbue.example");
    assert.equal(await phone.evaluate(() => localStorage.getItem("irlid_pending_staff_scan_payload")), null, "the refused scan is not kept to replay later");
    assert.equal(d1.get("SELECT org_id FROM login_session_orgs WHERE token=?", T0).org_id, "org-imbue", "the Worker knows this sign-in is in Imbue");
    assert.deepEqual(d1.people("org-imbue"), [], "nothing written to Imbue");
    assert.deepEqual(d1.people("org-test"), []);

    // ---------- 3. switch to Test Event: name, theme, fields and session all follow ----------
    await phone.evaluate(() => showPanel("setup", document.getElementById("navOrganisation")));
    await phone.click("#signedInSwitchBtn");
    await phone.waitForFunction(() => document.querySelectorAll("#orgPickerList .org-picker-card").length === 2);
    await phone.click('#orgPickerList .org-picker-card:has-text("Test Event")');
    await phone.waitForFunction(() => currentOrg && currentOrg.id === "org-test" && document.body.dataset.activePanel === "checkin", null, { timeout: 15000 });
    await phone.waitForFunction((c) => activeTheme.primary.toUpperCase() === c, DRAGON_RED, { timeout: 5000 });
    assert.equal(await phone.textContent("#sidebarOrgName"), "Test Event");
    assert.equal(await phone.evaluate(() => document.getElementById("v511OrgContactEmail").value), "", "Imbue's contact email is not left in Test Event's settings form");
    assert.equal(await phone.evaluate(() => document.getElementById("v511OrgVenueAddress").value), "");
    assert.equal(await phone.evaluate(() => document.getElementById("v511VenueLat").value), "", "Imbue's venue location is not left in Test Event's settings form");
    assert.deepEqual(await phone.evaluate(() => window.v511VenueGpsForSave()), {}, "and would not be saved into Test Event");
    assert.equal(await phone.evaluate(() => JSON.parse(localStorage.getItem("irlid_org_local")).id), "org-test");
    const T1 = await phone.evaluate(() => JSON.parse(localStorage.getItem("irlid_login_session")).session_token);
    assert.notEqual(T1, T0, "switching organisation gave this sign-in a new token");
    assert.equal(await phone.evaluate(() => qrLoginSession.session_token), T1);
    assert.equal(d1.get("SELECT org_id FROM login_session_orgs WHERE token=?", T1).org_id, "org-test");
    assert.equal(d1.get("SELECT org_id FROM login_session_orgs WHERE token=?", T0).org_id, "org-imbue", "the old token still belongs to Imbue only");

    // ---------- 4. scan again: the dialog names Test Event, the person lands there ----------
    await phone.goto(await staffScanUrl(site0, "test-event", 2));
    await phone.waitForFunction(() => !document.getElementById("doormanEscalationDialog").classList.contains("hidden"), null, { timeout: 15000 });
    assert.equal(await phone.evaluate(() => currentOrg.id), "org-test", "the reloaded page opened the organisation the server has on record");
    assert.equal(await phone.textContent("#escalationOrgName"), "Test Event", "the dialog says where the person will be added");
    assert.equal(await phone.evaluate(() => activeTheme.primary.toUpperCase()), DRAGON_RED);
    await phone.evaluate(() => window.__e2eInstallV5());
    await phone.fill("#escalationFirstName", "Bradley");
    await phone.fill("#escalationSurname", "Nephew");
    await phone.click("#escalationAddBtn");
    await phone.waitForFunction(() => document.getElementById("doormanEscalationDialog").classList.contains("hidden") || /error/.test(document.getElementById("escalationStatus").className), null, { timeout: 15000 });
    assert.equal(await phone.textContent("#escalationStatus"), "", "add at the door went through");
    assert.deepEqual(d1.people("org-test"), ["Bradley Nephew"], "Bradley is in Test Event");
    assert.deepEqual(d1.people("org-imbue"), [], "and not in Imbue");
    // The post-add toast would send the phone back to the scanner after 3 s.
    await phone.evaluate(() => { try { hidePostResolutionToast(); } catch (_) {} });

    // ---------- 5. a page that still named Imbue would be refused by the Worker ----------
    const forced = await phone.evaluate(async () => {
      const out = {};
      try { await window.IRLidOrgApi.createExpected("org-imbue", { display_name: "Forced Leak" }, qrLoginSession.session_token); out.write = "accepted"; }
      catch (e) { out.write = e.status + " " + e.message; }
      try { await window.IRLidOrgApi.listAttendance("org-imbue"); out.read = "accepted"; }
      catch (e) { out.read = e.status + " " + e.message; }
      try { await window.IRLidOrgApi.createCheckin("org-imbue", { mode: "doorman_scan", helloPayload: { v: 3, ts: 1 }, helloHash: "h" }, qrLoginSession.session_token); out.checkin = "accepted"; }
      catch (e) { out.checkin = e.status + " " + (e.data && e.data.reason); }
      return out;
    });
    assert.equal(forced.write, "403 session_org_mismatch");
    assert.equal(forced.read, "403 session_org_mismatch");
    assert.equal(forced.checkin, "403 session_org_mismatch", "a door check-in for the wrong organisation is not shown as a success");
    assert.deepEqual(d1.people("org-imbue"), []);
    assert.equal(d1.get("SELECT COUNT(*) AS n FROM org_checkins").n, 0);
    // The page noticed, stopped showing an organisation and asks again.
    await phone.waitForFunction(() => currentOrg === null && document.querySelectorAll("#orgPickerList .org-picker-card").length === 2, null, { timeout: 15000 });

    // ---------- 6. sign out: nothing of the organisation stays in this browser ----------
    await phone.click('#orgPickerList .org-picker-card:has-text("Test Event")');
    await phone.waitForFunction(() => currentOrg && currentOrg.id === "org-test" && document.body.dataset.activePanel === "checkin", null, { timeout: 15000 });
    await phone.evaluate(() => { localStorage.setItem("irlid_pending_staff_scan_payload", "H:left-over"); showPanel("setup", document.getElementById("navOrganisation")); });
    await phone.click("#signedInSignOutBtn");
    await phone.waitForFunction(() => document.getElementById("sidebarOrgName").textContent === "Not signed in");
    const after = await phone.evaluate(() => ({
      org: currentOrg,
      session: qrLoginSession,
      theme: activeTheme.primary.toUpperCase(),
      kept: ["irlid_login_session", "irlid_org_local", "irlid_org_local_settings", "irlid_org_local_expected_attendees", "irlid_portal_full_v1", "v511_mockup_org_v1", "irlid_pending_staff_scan_payload"]
        .filter((k) => localStorage.getItem(k) !== null),
      people: expectedAttendees.length,
      attendance: attendanceData.length
    }));
    assert.equal(after.org, null);
    assert.equal(after.session, null);
    assert.equal(after.theme, "#3FB950", "the dragons are gone: plain IRLid look when signed out");
    assert.deepEqual(after.kept, [], "no organisation data left in the browser");
    assert.equal(after.people + after.attendance, 0);
    assert.equal(d1.get("SELECT COUNT(*) AS n FROM login_sessions WHERE token=?", T1).n, 0, "the session ended on the server");

    // Reload after sign-out: the sign-in screen, not the last organisation.
    await phone.goto(site0 + "/Org.html?n=3");
    await phone.waitForFunction(() => document.getElementById("sidebarOrgName").textContent === "Not signed in");
    assert.equal(await phone.evaluate(() => currentOrg), null);

    assert.deepEqual(errors, [], "no page errors");
  } finally {
    await res.closeAll();
  }
});
