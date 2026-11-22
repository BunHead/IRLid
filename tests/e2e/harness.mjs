// Shared set-up for the dashboard browser tests (not a test file: the runner
// only picks up *.e2e.mjs). Same pieces as two-org-bleed.e2e.mjs: the real
// org Worker on an in-memory SQLite D1, the real site from disk, and a
// software stand-in for a v5 hardware key. Nothing here touches production.
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import worker from "../../irlid-api-org/src/index.js";

const require = createRequire(import.meta.url);
export let chromium = null;
try { ({ chromium } = require("playwright")); } catch (_) { chromium = null; }
export const e2eSkip = !chromium && !process.env.IRLID_E2E_REQUIRED && "Playwright not installed";

export const ROOT = new URL("../../", import.meta.url).pathname;
export const SITE_PORT = 8000; // http://localhost:8000 is in the v5 origin allowlist
const SCHEMA = readFileSync(join(ROOT, "irlid-api-org/schema.sql"), "utf8");
// schema.sql still has the pre-v5.11 people table; live uses this shape.
const LIVE_EXPECTED = `
  DROP TABLE org_expected;
  CREATE TABLE org_expected (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, display_name TEXT NOT NULL, initials TEXT,
    role_key TEXT DEFAULT 'attendee', device_pub_fp TEXT, email_hint TEXT, phone_hint TEXT, notes TEXT,
    created_at INTEGER NOT NULL, archived_at INTEGER);
`;

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
export class D1 {
  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec(SCHEMA);
    this.db.exec(LIVE_EXPECTED);
  }
  prepare(sql) { return new D1Statement(this.db, sql); }
  async batch(st) { const out = []; for (const s of st) out.push(await s.run()); return out; }
  get(sql, ...a) { return this.db.prepare(sql).get(...a) ?? null; }
  all(sql, ...a) { return this.db.prepare(sql).all(...a); }
  run(sql, ...a) { return this.db.prepare(sql).run(...a); }
}

export function listen(server, port) {
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server.address().port)));
}

export function startWorker(env) {
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

const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon", ".css": "text/css", ".svg": "image/svg+xml" };
export function startSite() {
  return http.createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
    const file = join(ROOT, path === "/" ? "index.html" : path);
    if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
}

// A software stand-in for a staff phone's v5 hardware key: a real
// WebAuthn-shaped envelope the Worker's verifier checks.
export const FAKE_V5 = `(() => {
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
export const QR_STUB = `window.QRCode = function (el, o) { el.setAttribute('data-qr-text', (o && o.text) || ''); el.textContent = 'QR'; }; window.QRCode.CorrectLevel = { L: 1, M: 0, Q: 2, H: 3 };`;

export async function fpOf(pub) {
  const canonical = (v) => v === null || typeof v !== "object" ? JSON.stringify(v)
    : "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(pub))));
  return Buffer.from(h).toString("base64url").slice(0, 16);
}

export function addOrg(d1, { id, name, slug, apiKey, settings = {}, createdAt = 100 }) {
  d1.run("INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
    id, name, slug, apiKey, JSON.stringify(settings), createdAt, createdAt);
}

// Signs a staff member in on `page`: makes their fake v5 key, adds them to
// the org with `role`, and leaves the same session org-login.html would.
export async function signInStaff(page, d1, env, { userId, name, orgId, role, token }) {
  const pub = await page.evaluate(() => window.__e2eInstallV5());
  const fp = await fpOf(pub);
  if (role === "developer") env.BOOTSTRAP_DEVELOPER_FP = fp;
  d1.run("INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES (?,?,?,?,0,0)", userId, JSON.stringify(pub), fp, name);
  d1.run("INSERT INTO org_memberships (org_id,user_id,role,granted_at) VALUES (?,?,?,1)", orgId, userId, role);
  const nowS = Math.floor(Date.now() / 1000);
  d1.run("INSERT INTO login_sessions (token,user_id,issued_at,expires_at) VALUES (?,?,?,?)", token, userId, nowS, nowS + 3600);
  await page.evaluate(({ tok, uid, n, dev }) => {
    localStorage.setItem("irlid_login_session", JSON.stringify({ session_token: tok, user_id: uid, display_name: n, can_create_org: true, is_developer: dev }));
  }, { tok: token, uid: userId, n: name, dev: role === "developer" });
  return { pub, fp };
}

// Opens a browser context with only the local site and Worker reachable.
export async function newContext(browser, workerPort, opts = {}) {
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 900 }, acceptDownloads: true, ...opts });
  await ctx.addInitScript(QR_STUB + FAKE_V5 + `window.IRLID_ORG_API_BASE_URL = 'http://localhost:${workerPort}';`);
  await ctx.route((url) => !/^http:\/\/localhost:(8000|\d+)\//.test(url.href), (r) => r.abort());
  return ctx;
}
