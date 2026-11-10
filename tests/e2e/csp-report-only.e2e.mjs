// Review 4.4: Content-Security-Policy, report-only stage.
//
// Loads every HTML page with security/csp-report-only.txt sent as a
// Content-Security-Policy-Report-Only header and records every
// securitypolicyviolation event. Report-only never blocks anything, so the
// pages behave exactly as live; the test fails if the policy WOULD have
// blocked something. Requests to other hosts are aborted after the CSP check
// (the check happens before the request), so the test needs no internet.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createRequire } from "node:module";
import { cleanup } from "./cleanup.mjs";

const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require("playwright")); } catch (_) { chromium = null; }

const ROOT = new URL("../../", import.meta.url).pathname;

export function loadPolicy() {
  return readFileSync(join(ROOT, "security/csp-report-only.txt"), "utf8")
    .split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#")).join("; ");
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon", ".css": "text/css", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };

function startSite(policy) {
  return http.createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
    const file = join(ROOT, path === "/" ? "index.html" : path);
    if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    const headers = { "Content-Type": MIME[extname(file)] || "application/octet-stream" };
    if (extname(file) === ".html") headers["Content-Security-Policy-Report-Only"] = policy;
    res.writeHead(200, headers);
    res.end(readFileSync(file));
  });
}

const PAGES = readdirSync(ROOT).filter(f => f.endsWith(".html")).sort();

test("CSP policy file parses into the directives we rely on", () => {
  const p = loadPolicy();
  for (const d of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) assert.ok(p.includes(d), d);
  assert.ok(!/frame-ancestors/.test(p), "widget.html must stay embeddable");
});

test("every page loads with the report-only CSP and nothing would be blocked",
  { skip: !chromium && !process.env.IRLID_E2E_REQUIRED && "playwright not installed", timeout: 180000 }, async (t) => {
  assert.ok(chromium, "playwright is required in CI (IRLID_E2E_REQUIRED=1)");
  const res = cleanup(t);
  const policy = loadPolicy();
  const site = res.server(startSite(policy));
  // Any free port: this test needs no origin allowlist, and a fixed port
  // would clash with the other e2e files when they run in parallel.
  await new Promise(r => site.listen(0, "127.0.0.1", r));
  const origin = "http://127.0.0.1:" + site.address().port + "/";
  const failures = [];
  try {
    const browser = res.browser(await chromium.launch());
    for (const name of PAGES) {
      const ctx = await browser.newContext({ serviceWorkers: "block" });
      await ctx.route(url => !url.href.startsWith(origin), route => route.abort());
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        window.__cspViolations = [];
        document.addEventListener("securitypolicyviolation", e => {
          window.__cspViolations.push(e.violatedDirective + " " + (e.blockedURI || "") + " " + (e.sourceFile || "") + ":" + (e.lineNumber || 0));
        });
      });
      try {
        await page.goto(origin + name, { waitUntil: "load", timeout: 20000 });
        await page.waitForTimeout(400);
        const v = await page.evaluate(() => window.__cspViolations);
        for (const x of v) failures.push(name + ": " + x);
      } catch (e) {
        failures.push(name + ": page did not load (" + e.message.split("\n")[0] + ")");
      }
      await ctx.close();
    }
  } finally {
    await res.closeAll();
  }
  assert.deepEqual(failures, [], "the report-only CSP would block:\n" + failures.join("\n"));
});
