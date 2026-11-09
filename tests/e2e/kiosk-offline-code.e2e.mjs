// End-to-end: the offline kiosk unlock code works with the network cut.
//
// Runs the real Worker (irlid-api-org/src/index.js on an in-memory SQLite D1),
// the real Org.html kiosk screen and the real kiosk-code.html phone page in
// Chromium. Online, a Lead Admin phone sets up offline codes and the kiosk
// fetches its keys. Then BOTH browsers are taken offline and the Worker is
// shut down. The phone page must open from its offline cache, make the code,
// and the kiosk must check it and unlock with no network at all. Back online,
// the kiosk syncs the unlock into the audit log.
//
// Cases: offline unlock, replay of a used code, code for another screen,
// expired challenge (90 s), 5 wrong codes, wrong role (manager cannot set up),
// role removed (key dropped on refresh), audit sync once.
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

const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require("playwright")); } catch (_) { chromium = null; }

const ROOT = new URL("../../", import.meta.url).pathname;
const SITE_PORT = 8000;         // http://localhost:8000 is in the v5 origin allowlist
const SCHEMA = readFileSync(join(ROOT, "irlid-api-org/schema.sql"), "utf8");
const ORG_KEY = "org_e2e_kiosk_key_1234567890";

// ---- In-memory D1 (same shim as the Worker unit tests) ----
class D1Statement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  stmt() { return this.db.prepare(this.sql); }
  async first() { return this.stmt().get(...this.args) ?? null; }
  async all() { return { results: this.stmt().all(...this.args) }; }
  async run() {
    if (/\bRETURNING\b/i.test(this.sql)) return { results: this.stmt().all(...this.args), meta: {} };
    const info = this.stmt().run(...this.args);
    return { meta: { changes: Number(info.changes) } };
  }
}
class D1 {
  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec(SCHEMA);
    this.db.prepare("INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES (?,?,?,?,?,0,0)")
      .run("org-1", "E2E Org", "e2e-org", ORG_KEY, JSON.stringify({ kioskMode: true }));
  }
  prepare(sql) { return new D1Statement(this.db, sql); }
  async batch(st) { const out = []; for (const s of st) out.push(await s.run()); return out; }
}

function listen(server, port) {
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server.address().port)));
}

function startWorker(d1) {
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
    let r;
    try { r = await worker.fetch(new Request("http://localhost" + req.url, {
      method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body
    }), { DB: d1, CORS_ORIGIN: "*" }); } catch (e) { r = new Response(JSON.stringify({ error: "test_shim" }), { status: 500 }); }
    const out = Buffer.from(await r.arrayBuffer());
    const h = {};
    r.headers.forEach((v, k) => { h[k] = v; });
    h["access-control-allow-origin"] = "*";
    h["access-control-allow-headers"] = "*";
    h["access-control-allow-methods"] = "GET,POST,PUT,DELETE,OPTIONS";
    res.writeHead(req.method === "OPTIONS" ? 204 : r.status, h);
    res.end(req.method === "OPTIONS" ? undefined : out);
  });
  return server;
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

// A software stand-in for the phone's v5 hardware key. It makes a real
// WebAuthn-shaped envelope (UV flag, clientData challenge = payload hash,
// origin), so the Worker's real verifier checks it. The key is kept in
// localStorage so the same "phone" signs again after an offline reload.
async function installFakeV5(page) {
  await page.evaluate(async () => {
    const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    let saved = JSON.parse(localStorage.getItem("e2e_fake_v5") || "null");
    if (!saved) {
      const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      const prv = await crypto.subtle.exportKey("jwk", kp.privateKey);
      const pubFull = await crypto.subtle.exportKey("jwk", kp.publicKey);
      saved = { prv, pub: { kty: "EC", crv: "P-256", x: pubFull.x, y: pubFull.y } };
      localStorage.setItem("e2e_fake_v5", JSON.stringify(saved));
    }
    const priv = await crypto.subtle.importKey("jwk", saved.prv, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    window.__e2eSigns = 0;
    window.irlidV5Enrolled = () => true;
    window.irlidV5GetPublicJwk = () => saved.pub;
    window.irlidV5SignPayloadHash = async (hash) => {
      window.__e2eSigns += 1;
      const clientData = new TextEncoder().encode(JSON.stringify({ type: "webauthn.get", challenge: b64u(hash), origin: location.origin }));
      const authData = new Uint8Array(37); authData[32] = 0x05;
      const cdh = new Uint8Array(await crypto.subtle.digest("SHA-256", clientData));
      const signed = new Uint8Array(37 + 32); signed.set(authData, 0); signed.set(cdh, 37);
      const sigRaw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, priv, signed));
      return { sigRaw, authData, clientData };
    };
  });
  return page.evaluate(() => window.irlidV5GetPublicJwk());
}

async function fpOf(pub) {
  const canonical = (v) => v === null || typeof v !== "object" ? JSON.stringify(v)
    : "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(pub))));
  return Buffer.from(h).toString("base64url").slice(0, 16);
}

function addMember(d1, id, pub, fp, role) {
  d1.db.prepare("INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES (?,?,?,?,0,0)").run(id, JSON.stringify(pub), fp, id);
  d1.db.prepare("INSERT INTO org_memberships (org_id,user_id,role,granted_at) VALUES (?,?,?,0)").run("org-1", id, role);
}

// The kiosk's QRs are stubbed so the test can "scan" them: each fake QR keeps
// the exact text it encodes, which is what a phone camera would read.
const QR_STUB = `window.QRCode = function (el, o) { el.setAttribute('data-qr-text', (o && o.text) || ''); el.textContent = 'QR'; }; window.QRCode.CorrectLevel = { L: 1, M: 0, Q: 2, H: 3 };`;

async function newContext(browser, workerPort) {
  const ctx = await browser.newContext({ serviceWorkers: "allow" });
  await ctx.addInitScript(QR_STUB + `window.IRLID_ORG_API_BASE_URL = 'http://localhost:${workerPort}';`);
  // Only the local site and Worker exist in this test; CDNs are blocked.
  await ctx.route((url) => !/^http:\/\/localhost:(8000|\d+)\//.test(url.href), (r) => r.abort());
  return ctx;
}

async function makeCodeOnPhone(phone, codeUrl) {
  await phone.goto(codeUrl);
  await phone.waitForSelector("#makeBtn");
  // The page must be showing THIS screen and challenge (not a previous scan).
  const want = new URLSearchParams(new URL(codeUrl).hash.slice(1));
  const c = want.get("c");
  await phone.waitForFunction((t) => document.getElementById("target").textContent === t,
    "Screen " + want.get("k") + " · challenge " + c.slice(0, 4) + "-" + c.slice(4), { timeout: 5000 });
  await installFakeV5(phone);
  await phone.click("#makeBtn");
  await phone.waitForFunction(() => /\d{4} \d{4}/.test(document.getElementById("code").textContent) || /err/.test(document.getElementById("status").className), null, { timeout: 5000 });
  return {
    code: (await phone.textContent("#code")).replace(/\s/g, ""),
    status: await phone.textContent("#status")
  };
}

async function kioskOfflineChallengeUrl(kiosk) {
  await kiosk.waitForSelector(".irlid-kiosk-panel .irlid-kiosk-challenge");
  return kiosk.getAttribute(".irlid-kiosk-panel .irlid-kiosk-qr", "data-qr-text");
}

async function typeOnKiosk(kiosk, code) {
  await kiosk.fill(".irlid-kiosk-offline input", code);
  await kiosk.click(".irlid-kiosk-offline button");
  await kiosk.waitForTimeout(150);
  return {
    unlocked: await kiosk.evaluate(() => !document.getElementById("v511FullscreenStage")),
    status: await kiosk.evaluate(() => document.querySelector(".irlid-kiosk-status")?.textContent || "")
  };
}

// With no internet the padlock goes straight to the offline code panel (the
// staff phone scan cannot work offline).
async function openLockedKiosk(kiosk) {
  await kiosk.evaluate(() => { showPanel("dashboard"); showPanel("checkin"); });
  await kiosk.waitForSelector("#v511FullscreenStage .irlid-kiosk-padlock");
  await kiosk.click("#v511FullscreenStage .irlid-kiosk-padlock");
  await kiosk.waitForSelector(".irlid-kiosk-panel .irlid-kiosk-challenge");
}

// Where the kiosk controls and the unlock panel really are on screen.
async function kioskLayout(kiosk) {
  return kiosk.evaluate(() => {
    const r = (q) => { const el = document.querySelector(q); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom }; };
    return {
      vw: innerWidth, vh: innerHeight,
      padlock: r("#v511FullscreenStage .irlid-kiosk-padlock"),
      refresh: r("#v511FullscreenStage .irlid-kiosk-refresh"),
      dot: r("#v511FullscreenStage .irlid-kiosk-dot"),
      panel: r(".irlid-kiosk-panel"),
      buttons: [...document.querySelectorAll(".irlid-kiosk-panel button")].map((b) => {
        const x = b.getBoundingClientRect();
        // The button must be the thing a tap at its centre lands on.
        const hit = document.elementFromPoint(x.x + x.width / 2, x.y + x.height / 2);
        return { text: b.textContent, onScreen: x.bottom <= innerHeight && x.right <= innerWidth && x.y >= 0, hit: hit === b || b.contains(hit) };
      })
    };
  });
}

test("offline unlock code works end to end with the network cut", { skip: !chromium && "Playwright not installed", timeout: 120000 }, async () => {
  const d1 = new D1();
  const workerServer = startWorker(d1);
  const workerPort = await listen(workerServer, 0);
  const site = startSite();
  await listen(site, SITE_PORT);
  const browser = await chromium.launch();
  try {
    const phoneCtx = await newContext(browser, workerPort);
    const managerCtx = await newContext(browser, workerPort);
    const kioskCtx = await newContext(browser, workerPort);
    const phone = await phoneCtx.newPage();
    const manager = await managerCtx.newPage();
    const kiosk = await kioskCtx.newPage();
    const errors = [];
    for (const p of [phone, manager, kiosk]) p.on("pageerror", (e) => errors.push(String(e)));
    const site0 = "http://localhost:" + SITE_PORT;
    const workerUrl = "http://localhost:" + workerPort;

    // ---------- ONLINE: set-up ----------
    // Lead Admin phone and a manager phone, both with v5 keys and memberships.
    const enrolUrl = site0 + "/kiosk-code.html?org=org-1&worker=" + encodeURIComponent(workerUrl);
    await phone.goto(enrolUrl);
    const leadPub = await installFakeV5(phone);
    addMember(d1, "lead-1", leadPub, await fpOf(leadPub), "lead_admin");
    await manager.goto(enrolUrl);
    const mgrPub = await installFakeV5(manager);
    addMember(d1, "manager-1", mgrPub, await fpOf(mgrPub), "manager");

    // Wrong role: the manager's phone is refused and keeps no seed.
    await manager.click("#enrolBtn");
    await manager.waitForFunction(() => /err|ok/.test(document.getElementById("status").className));
    assert.match(await manager.textContent("#status"), /Only a Lead Admin or Developer/);
    assert.equal(await manager.evaluate(() => localStorage.getItem("irlid_kiosk_seed:org-1")), null);

    // Lead Admin's phone sets up (hardware-key signature checked by the Worker).
    await phone.click("#enrolBtn");
    await phone.waitForFunction(() => /err|ok/.test(document.getElementById("status").className));
    assert.match(await phone.textContent("#status"), /Done/, await phone.textContent("#status"));
    // The page registered the service worker; wait until it controls a page so
    // kiosk-code.html is in the offline cache.
    await phone.evaluate(() => navigator.serviceWorker.ready);
    await phone.reload();
    await phone.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
    const cached = await phone.evaluate(async () => {
      const keys = await caches.keys();
      for (const k of keys) { const c = await caches.open(k); if (await c.match("./kiosk-code.html")) return true; }
      return false;
    });
    assert.equal(cached, true, "kiosk-code.html not in the phone's offline cache");

    // Kiosk: signed in (a staff session), kiosk mode on, fetches its keys online.
    const kioskUser = { id: "kiosk-staff", pub_fp: "kioskstafffp00001" };
    d1.db.prepare("INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES (?,?,?,?,0,0)").run(kioskUser.id, "{}", kioskUser.pub_fp, "Door screen");
    d1.db.prepare("INSERT INTO org_memberships (org_id,user_id,role,granted_at) VALUES ('org-1',?,'staff',0)").run(kioskUser.id);
    const token = "sess_e2e_kiosk_abcdefghijklmnop";
    d1.db.prepare("INSERT INTO login_sessions (token,user_id,issued_at,expires_at) VALUES (?,?,?,?)").run(token, kioskUser.id, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000) + 3600);
    await kiosk.goto(site0 + "/Org.html");
    await kiosk.waitForFunction(() => typeof window.irlidKioskRefreshKeys === "function");
    await kiosk.evaluate(async (t) => {
      currentOrg = { id: "org-1", name: "E2E Org", api_key: "org_e2e_kiosk_key_1234567890" };
      qrLoginSession = { session_token: t };
      settings.kioskMode = true;
      // An older cache with no expiry (pre-v6.8.12) must never be used.
      localStorage.setItem("irlid_kiosk_codekeys:org-1", JSON.stringify({ kiosk_id: irlidKioskId(), keys: [{ key_id: "old", k: "x".repeat(43) }] }));
      await irlidKioskRefreshKeys();
    }, token);
    assert.equal((await kiosk.evaluate(() => irlidKioskCachedKeys())).length, 0, "a screen nobody approved got keys");
    assert.equal(await kiosk.evaluate(() => localStorage.getItem("irlid_kiosk_codekeys:org-1")), null, "old unexpiring cache not cleared");
    const kioskId = await kiosk.evaluate(() => irlidKioskId());

    // Approve this screen: the screen shows an approval QR, the Lead Admin's
    // phone opens it (org-action-auth.html) and signs with its v5 key.
    const approving = kiosk.evaluate(() => irlidKioskApproveScreen());
    await kiosk.waitForFunction(() => !!document.querySelector("#kioskScreenApproveQr[data-qr-text]"), null, { timeout: 5000 });
    const approveUrl = new URL(await kiosk.getAttribute("#kioskScreenApproveQr", "data-qr-text"));
    await phone.goto(site0 + "/org-action-auth.html?nonce=" + encodeURIComponent(approveUrl.searchParams.get("nonce")) + "&worker=" + encodeURIComponent(workerUrl));
    await phone.waitForFunction(() => !document.getElementById("approve").disabled, null, { timeout: 5000 });
    assert.match(await phone.textContent("#summary"), new RegExp("Let screen " + kioskId + " accept offline unlock codes"));
    await installFakeV5(phone);
    await phone.click("#approve");
    await approving;
    assert.match(await kiosk.textContent("#kioskScreenApproveStatus"), /Approved/, await kiosk.textContent("#kioskScreenApproveStatus"));
    const cachedKeys = await kiosk.evaluate(() => irlidKioskCachedKeys());
    assert.equal(cachedKeys.length, 1, "approved kiosk did not cache the Lead Admin key");
    const saved = await kiosk.evaluate(() => JSON.parse(localStorage.getItem("irlid_kiosk_codekeys:org-1")));
    assert.ok(saved.expires_at > Date.now() && saved.expires_at <= Date.now() + 72 * 3600000 + 5000, "keys must expire within 72 h");
    // Another staff session that only knows the screen id gets nothing.
    const other = await (await fetch(workerUrl + "/org/kiosk/code-keys?org_id=org-1&kiosk_id=" + kioskId, { headers: { Authorization: "Bearer " + token } })).json();
    assert.equal(other.error, "kiosk_screen_not_approved");

    // ---------- NETWORK CUT ----------
    await phoneCtx.setOffline(true);
    await kioskCtx.setOffline(true);
    await new Promise((r) => workerServer.close(r));
    await new Promise((r) => site.close(r));
    assert.equal(await kiosk.evaluate(() => navigator.onLine), false);

    // 0) Real-device report (7 Nov): the padlock, refresh button and dot sat
    //    under the QR, and the unlock panel was laid out inside the stage, so
    //    its offline-code button was cut off the bottom and a tap did nothing.
    //    The controls must sit at the top right and every panel button must be
    //    on screen and tappable.
    await openLockedKiosk(kiosk);
    let lay = await kioskLayout(kiosk);
    for (const k of ["padlock", "refresh", "dot"]) {
      assert.ok(lay[k].y < 80 && lay[k].right > lay.vw - 160, k + " is not at the top right: " + JSON.stringify(lay[k]));
    }
    assert.ok(lay.refresh.right <= lay.padlock.x && lay.dot.right <= lay.refresh.x, "order is dot, refresh, padlock: " + JSON.stringify(lay));
    assert.deepEqual([lay.panel.x, lay.panel.y, lay.panel.w, lay.panel.h], [0, 0, lay.vw, lay.vh], "unlock panel must cover the screen");
    for (const b of lay.buttons) assert.ok(b.onScreen && b.hit, "panel button not tappable: " + JSON.stringify(b));
    // Esc drops browser full screen (a page cannot stop that). The stage stays
    // locked and asks for an unlock; "Stay locked" must go back into full
    // screen, because that click is the tap a browser needs for it.
    await kiosk.click(".irlid-kiosk-cancel");
    await kiosk.evaluate(() => {
      window.__fsAsks = 0;
      document.getElementById("v511FullscreenStage").requestFullscreen = function () { window.__fsAsks += 1; return Promise.resolve(); };
      return document.exitFullscreen();
    });
    await kiosk.waitForSelector(".irlid-kiosk-relock");
    await kiosk.waitForSelector(".irlid-kiosk-panel .irlid-kiosk-cancel");
    await kiosk.click(".irlid-kiosk-cancel");
    assert.equal(await kiosk.evaluate(() => window.__fsAsks), 1, "Stay locked did not ask for full screen again");
    assert.equal(await kiosk.evaluate(() => !!document.querySelector(".irlid-kiosk-panel")), false);
    // "Staff phone scan" from the offline panel tries the scan, fails with no
    // internet and comes back to the offline code, still locked.
    await kiosk.click("#v511FullscreenStage .irlid-kiosk-padlock");
    await kiosk.waitForSelector(".irlid-kiosk-panel .irlid-kiosk-use-scan");
    await kiosk.click(".irlid-kiosk-use-scan");
    await kiosk.waitForFunction(() => /No internet/.test(document.querySelector(".irlid-kiosk-status")?.textContent || ""));
    assert.ok(await kiosk.evaluate(() => !!document.querySelector(".irlid-kiosk-panel .irlid-kiosk-challenge")));
    await kiosk.click(".irlid-kiosk-cancel");

    // 1) Offline unlock. Kiosk opens locked, shows a challenge; the phone
    //    "scans" it: opens the URL from its offline cache and makes the code.
    await kiosk.click("#v511FullscreenStage .irlid-kiosk-padlock");
    await kiosk.waitForSelector(".irlid-kiosk-panel .irlid-kiosk-challenge");
    const url1 = await kioskOfflineChallengeUrl(kiosk);
    assert.match(url1, new RegExp("/kiosk-code\\.html#o=org-1&k=" + kioskId + "&c=[0-9A-HJKMNP-TV-Z]{8}$"));
    const signsBefore = 0;
    const made1 = await makeCodeOnPhone(phone, url1);
    assert.match(made1.code, /^\d{8}$/, made1.status);
    assert.ok(await phone.evaluate(() => window.__e2eSigns) > signsBefore, "phone did not ask for the hardware key");
    // Wrong code first: refused, still locked.
    const wrong = made1.code === "00000000" ? "11111111" : "00000000";
    let r = await typeOnKiosk(kiosk, wrong);
    assert.equal(r.unlocked, false);
    assert.match(r.status, /Wrong code\. 4 tries left/);
    r = await typeOnKiosk(kiosk, made1.code);
    assert.equal(r.unlocked, true, r.status);

    // 2) Replay: the same code (e.g. photographed) on the next lock fails.
    await openLockedKiosk(kiosk);
    r = await typeOnKiosk(kiosk, made1.code);
    assert.equal(r.unlocked, false);

    // 3) A code made for another screen fails here.
    const url2 = await kioskOfflineChallengeUrl(kiosk);
    const otherScreen = url2.replace(/k=[0-9A-Z]+/, "k=ZZZZZZZZZZ");
    const madeOther = await makeCodeOnPhone(phone, otherScreen);
    r = await typeOnKiosk(kiosk, madeOther.code);
    assert.equal(r.unlocked, false);

    // 4) Expiry: a correct code typed more than 90 s after the challenge fails.
    const made2 = await makeCodeOnPhone(phone, url2);
    await kiosk.evaluate(() => { const real = Date.now; window.__realNow = real; Date.now = () => real() + 91000; });
    r = await typeOnKiosk(kiosk, made2.code);
    assert.equal(r.unlocked, false);
    assert.match(r.status, /ran out|New challenge/);
    await kiosk.evaluate(() => { Date.now = window.__realNow; });

    // 5) Five wrong codes retire the challenge; its right code no longer works.
    await kiosk.click(".irlid-kiosk-cancel");
    await openLockedKiosk(kiosk);
    const url3 = await kioskOfflineChallengeUrl(kiosk);
    const made3 = await makeCodeOnPhone(phone, url3);
    const bad = made3.code === "22222222" ? "33333333" : "22222222";
    for (let i = 0; i < 5; i += 1) r = await typeOnKiosk(kiosk, bad);
    assert.match(r.status, /5 wrong codes/);
    r = await typeOnKiosk(kiosk, made3.code);
    assert.equal(r.unlocked, false);

    // 6) The manager's phone has no seed, so it cannot make any code offline.
    await managerCtx.setOffline(true);
    // (The manager page is still open from set-up; reuse it with the URL.)
    await manager.evaluate((u) => { location.href = u; }, url3).catch(() => {});
    await manager.waitForTimeout(500);
    const mgrStatus = await manager.evaluate(() => document.getElementById("status")?.textContent || "");
    assert.match(mgrStatus, /not set up/);

    // A fresh challenge still unlocks for the Lead Admin, offline.
    const url4 = await kioskOfflineChallengeUrl(kiosk);
    const made4 = await makeCodeOnPhone(phone, url4);
    r = await typeOnKiosk(kiosk, made4.code);
    assert.equal(r.unlocked, true, r.status);

    // Unlocks are queued on the kiosk while offline.
    const queued = await kiosk.evaluate(() => JSON.parse(localStorage.getItem("irlid_kiosk_unlock_log:org-1") || "{}").entries || []);
    assert.equal(queued.filter((e) => e.outcome === "allowed").length, 2);
    assert.equal(queued.filter((e) => e.outcome === "denied").length, 1);
    assert.ok(queued.filter((e) => e.outcome === "allowed").every((e) => /^\d{8}$/.test(e.code)), "the typed code goes with the report");
    assert.equal(d1.db.prepare("SELECT COUNT(*) n FROM org_audit_log WHERE action='irlid_kiosk_offline_unlock_v5'").get().n, 0);

    // ---------- BACK ONLINE: audit sync ----------
    const workerServer2 = startWorker(d1);
    await listen(workerServer2, workerPort);
    await kioskCtx.setOffline(false);
    await kiosk.evaluate(() => irlidKioskFlushLog());
    await kiosk.waitForFunction(() => (JSON.parse(localStorage.getItem("irlid_kiosk_unlock_log:org-1") || "{}").entries || [1]).length === 0, null, { timeout: 5000 });
    const rows = d1.db.prepare("SELECT actor_user_id, actor_role, actor_display_name, outcome, detail FROM org_audit_log WHERE action='irlid_kiosk_offline_unlock_v5' ORDER BY created_at").all();
    // Honest attribution: kiosk-reported, no actor; the code was checked
    // against the Lead Admin's key and the report came from the approved screen.
    const allowedRows = rows.filter((x) => x.outcome === "allowed");
    assert.equal(allowedRows.length, 2, JSON.stringify(rows));
    for (const x of allowedRows) {
      assert.equal(x.actor_user_id, null);
      assert.equal(x.actor_role, null);
      assert.match(x.actor_display_name, /kiosk-reported/);
      assert.match(x.detail, /code matches the offline key of lead-1/);
      assert.match(x.detail, /approved screen/);
    }
    assert.equal(rows.filter((x) => x.outcome === "denied").length, 1);
    // An old-format queue (a plain list, from a v6.8.11 page) still syncs.
    await kiosk.evaluate(() => { localStorage.setItem("irlid_kiosk_unlock_log:org-1", JSON.stringify([{ challenge: "ABCD2345", outcome: "denied", at: 1 }])); });
    await kiosk.evaluate(() => irlidKioskFlushLog());
    assert.equal(d1.db.prepare("SELECT COUNT(*) n FROM org_audit_log WHERE nonce LIKE '%:ABCD2345:denied'").get().n, 1);

    // Role removed: on the next online refresh the kiosk drops that key, so
    // the old phone's codes stop working there.
    d1.db.prepare("UPDATE org_memberships SET role='staff' WHERE user_id='lead-1'").run();
    await kiosk.evaluate(() => irlidKioskRefreshKeys());
    assert.equal((await kiosk.evaluate(() => irlidKioskCachedKeys())).length, 0);
    d1.db.prepare("UPDATE org_memberships SET role='lead_admin' WHERE user_id='lead-1'").run();
    await kiosk.evaluate(() => irlidKioskRefreshKeys());
    assert.equal((await kiosk.evaluate(() => irlidKioskCachedKeys())).length, 1);

    // Revoked screen: the next online refresh drops its keys.
    d1.db.prepare("UPDATE kiosk_screens SET revoked_at=? WHERE kiosk_id=?").run(Date.now(), kioskId);
    await kiosk.evaluate(() => irlidKioskRefreshKeys());
    assert.equal((await kiosk.evaluate(() => irlidKioskCachedKeys())).length, 0, "revoked screen kept its keys");
    // Keys past their expiry are not used, even with no network to ask.
    await kiosk.evaluate((exp) => {
      const s = JSON.parse(localStorage.getItem("irlid_kiosk_codekeys:org-1") || "null") || { v: 2, kiosk_id: irlidKioskId(), keys: [{ key_id: "k", k: "x" }] };
      s.expires_at = exp; s.v = 2; s.kiosk_id = irlidKioskId(); s.keys = [{ key_id: "k", k: "x" }];
      localStorage.setItem("irlid_kiosk_codekeys:org-1", JSON.stringify(s));
    }, Date.now() - 1);
    assert.equal((await kiosk.evaluate(() => irlidKioskCachedKeys())).length, 0, "expired keys used");
    // Signing out clears any keys.
    await kiosk.evaluate((exp) => localStorage.setItem("irlid_kiosk_codekeys:org-1", JSON.stringify({ v: 2, kiosk_id: irlidKioskId(), keys: [{ key_id: "k", k: "x" }], expires_at: exp })), Date.now() + 60000);
    await kiosk.evaluate(() => wipeSavedOrgSession());
    assert.equal(await kiosk.evaluate(() => localStorage.getItem("irlid_kiosk_codekeys:org-1")), null);

    await new Promise((res) => workerServer2.close(res));
    // Dashboard calls unrelated to the kiosk (rooms, calendar) hit tables the
    // test database doesn't have; only kiosk errors count here.
    assert.deepEqual(errors.filter((e) => /kiosk|offline code|unlock/i.test(e)), []);
  } finally {
    await browser.close();
    try { site.close(); } catch (_) {}
    try { workerServer.close(); } catch (_) {}
  }
});
