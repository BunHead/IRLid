// End-to-end: the everyday attendee path in a real browser (review 3.2).
//
//  1. A first-time phone scans the live screen QR. It shows the orange "Get a
//     member of staff" screen and places a signed first-scan hold (#169).
//  2. Staff link the phone (simulated by binding its key in the database, as
//     Bind at the door does). The phone notices and sends its check-in, which
//     lands FRESH because of the hold, more than 0 s after the code was shown.
//  3. A second phone scans while the Worker is unreachable. The check-in is
//     queued on the phone ("Syncing when back online"), syncs when the Worker
//     is back, and lands as OFFLINE / unverified. Nothing is lost (C7, C13).
//
// Real org-entry.html, js/sign.js, js/offline-queue.js and the real org Worker
// on in-memory SQLite. Requests to the live Worker host are routed to the
// local Worker; everything else outside localhost is blocked.
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
const SITE_PORT = 8000;
const ORG_KEY = "org_e2e_attendee_key_1234567890";
const LIVE_WORKER_HOST = "irlid-api-org.irlid-bunhead.workers.dev";

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
    // The check-in tables as the Worker uses them today (schema.sql still has
    // an older org_expected; see review 2.2), same as signed-checkin.test.mjs.
    this.db.exec(`
      CREATE TABLE organisations (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, api_key TEXT NOT NULL UNIQUE, venue_pub_jwk TEXT, venue_prv_jwk TEXT, settings_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE org_checkins (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, mode TEXT NOT NULL, attendee_label TEXT, attendee_key_id TEXT, hello_hash TEXT, score INTEGER, bio_verified INTEGER DEFAULT 0, gps_hash TEXT, checkin_at INTEGER NOT NULL, checkout_at INTEGER, duration_s INTEGER, created_at INTEGER NOT NULL, name TEXT, attendee_pub_jwk TEXT, device_key_fp TEXT, status TEXT DEFAULT 'checked_in', expected_id INTEGER, conflict_id INTEGER, event_id TEXT, assurance TEXT, gps_band TEXT, gps_distance_km REAL, out_of_hours INTEGER DEFAULT 0, clock_gap_s INTEGER);
      CREATE TABLE org_checkin_nonces (nonce TEXT PRIMARY KEY, org_api_key TEXT NOT NULL, event_id TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, consumed_at INTEGER);
      CREATE TABLE org_receipts (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, checkin_id TEXT, attendee_pub_fp TEXT, payload_json TEXT NOT NULL, signature TEXT NOT NULL, created_at INTEGER NOT NULL, privacy_mode INTEGER DEFAULT 1);
      CREATE TABLE org_expected (id INTEGER PRIMARY KEY AUTOINCREMENT, org_id TEXT NOT NULL, display_name TEXT, initials TEXT, role_key TEXT, device_pub_fp TEXT, email_hint TEXT, phone_hint TEXT, notes TEXT, created_at INTEGER, archived_at INTEGER);
      CREATE TABLE expected_device_keys (org_id TEXT, expected_id INTEGER, device_key_fp TEXT, revoked_at INTEGER);
      CREATE TABLE org_staff_sessions (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, staff_pub_fp TEXT, staff_pub_jwk TEXT, hello_hash TEXT, verification_state TEXT, created_at INTEGER, expires_at INTEGER, last_seen_at INTEGER);
      CREATE TABLE portal_users (id INTEGER PRIMARY KEY AUTOINCREMENT, pub_fp TEXT);
      CREATE TABLE org_memberships (user_id INTEGER, org_id TEXT, role TEXT);
      CREATE TABLE rooms (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, label TEXT);
      CREATE TABLE weekly_events (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, room_id TEXT, name TEXT NOT NULL, day_of_week INTEGER NOT NULL, start_time_local TEXT NOT NULL, duration_min INTEGER NOT NULL, capacity INTEGER, color_hex TEXT, notes TEXT, require_proof INTEGER DEFAULT 0, late_grace_min INTEGER DEFAULT 0, created_at INTEGER NOT NULL, archived_at INTEGER, checkin_mode TEXT DEFAULT 'standard');
    `);
    this.db.prepare("INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES (?,?,?,?,?,0,0)")
      .run("org-1", "E2E Org", "e2e-org", ORG_KEY, JSON.stringify({ anonymousMode: true }));
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

// The phone's view of the Worker: the live host, served by the local Worker
// while "up", unreachable while "down".
async function phoneContext(browser, workerPort, net) {
  const ctx = await browser.newContext({ serviceWorkers: "allow" });
  await ctx.addInitScript("window.QRCode = function (el, o) { el.setAttribute('data-qr-text', (o && o.text) || ''); el.textContent = 'QR'; }; window.QRCode.CorrectLevel = { L: 1, M: 0, Q: 2, H: 3 };");
  await ctx.route((url) => !/^http:\/\/localhost:8000\//.test(url.href), async (route) => {
    const u = new URL(route.request().url());
    if (u.host !== LIVE_WORKER_HOST || !net.up) return route.abort();
    const req = route.request();
    const res = await fetch("http://localhost:" + workerPort + u.pathname + u.search, {
      method: req.method(), headers: req.headers(),
      body: ["GET", "HEAD"].includes(req.method()) ? undefined : req.postDataBuffer()
    });
    const headers = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    await route.fulfill({ status: res.status, headers, body: Buffer.from(await res.arrayBuffer()) });
  });
  return ctx;
}

async function liveCode(d1) {
  const r = await worker.fetch(new Request("http://localhost/org/checkin-nonce", {
    method: "POST", headers: { "X-Org-Key": ORG_KEY, "Content-Type": "application/json" }, body: "{}"
  }), { DB: d1, CORS_ORIGIN: "*" });
  return (await r.json()).nonce;
}

const text = (page, sel) => page.evaluate((s) => document.querySelector(s)?.textContent || "", sel);
const rows = (d1) => d1.db.prepare("SELECT id, assurance, status, device_key_fp, expected_id FROM org_checkins ORDER BY created_at").all();

test("attendee check-in: first-time phone held fresh after staff approval; offline phone queued and synced",
  { skip: !chromium && !process.env.IRLID_E2E_REQUIRED && "Playwright not installed", timeout: 120000 }, async (t) => {
  const res = cleanup(t);
  const d1 = new D1();
  const net = { up: true };
  const errors = [];
  try {
    const workerServer = res.server(startWorker(d1));
    const workerPort = await listen(workerServer, 0);
    const site = res.server(startSite());
    await listen(site, SITE_PORT);
    const browser = res.browser(await chromium.launch());
    const entry = (code) => `http://localhost:${SITE_PORT}/org-entry.html?type=checkin&org=e2e-org&n=${code}`;

    // ---------- 1. First-time phone, online ----------
    const phone = await (await phoneContext(browser, workerPort, net)).newPage();
    phone.on("pageerror", (e) => errors.push(String(e)));
    const code1 = await liveCode(d1);
    await phone.goto(entry(code1));
    await phone.waitForFunction(() => document.getElementById("subtitle").textContent.includes("member of staff"), null, { timeout: 15000 });
    // The hold is placed while the code is live.
    let holds = [];
    for (let i = 0; i < 40 && !holds.length; i++) {
      try { holds = d1.db.prepare("SELECT * FROM org_checkin_holds").all(); } catch (_) { holds = []; }
      if (!holds.length) await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(holds.length, 1, "first-scan hold placed");
    assert.equal(holds[0].used_at, null);
    assert.equal(rows(d1).length, 0, "nothing counted before staff approve");

    // ---------- 2. Staff link the phone; it checks in fresh ----------
    const fp = holds[0].device_key_fp;
    const expectedId = Number(d1.db.prepare("INSERT INTO org_expected (org_id,display_name,role_key,device_pub_fp,created_at) VALUES ('org-1','Pat Phone','attendee',?,0)").run(fp).lastInsertRowid);
    await phone.waitForFunction(() => /You.re checked in/.test(document.getElementById("subtitle").textContent), null, { timeout: 30000 });
    assert.match(await text(phone, "#title"), /Pat Phone/);
    let all = rows(d1);
    assert.equal(all.length, 1);
    assert.equal(all[0].assurance, "fresh", "the hold keeps the first visit fresh");
    assert.equal(all[0].device_key_fp, fp);
    assert.equal(all[0].expected_id, expectedId);
    assert.ok(d1.db.prepare("SELECT used_at FROM org_checkin_holds").get().used_at, "hold used once");

    // ---------- 3. Another phone, Worker unreachable ----------
    net.up = false;
    const code2 = await liveCode(d1);
    const phone2 = await (await phoneContext(browser, workerPort, net)).newPage();
    phone2.on("pageerror", (e) => errors.push(String(e)));
    // The phone's clock runs 200 s behind, so the queued check-in is already
    // past the Worker's live window when it syncs (the queue holds a check-in
    // back until then); fastForward fires the queue's timer.
    await phone2.clock.install({ time: Date.now() - 200000 });
    await phone2.goto(entry(code2));
    await phone2.waitForFunction(() => /Syncing when back online/.test(document.getElementById("subtitle").textContent), null, { timeout: 20000 });
    assert.equal(rows(d1).length, 1, "nothing reached the Worker while it was down");

    net.up = true;
    await phone2.clock.fastForward("02:10");
    await phone2.evaluate(() => window.dispatchEvent(new Event("online")));
    const t0 = Date.now();
    while (rows(d1).length < 2 && Date.now() - t0 < 30000) await new Promise((r) => setTimeout(r, 200));
    all = rows(d1);
    assert.equal(all.length, 2, "the queued check-in synced");
    assert.equal(all[1].assurance, "offline", "a queued check-in is never fresh (C9)");
    assert.notEqual(all[1].device_key_fp, fp);
    assert.deepEqual(errors, [], "no page errors");
  } finally {
    await res.closeAll();
  }
});
