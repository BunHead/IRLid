// Test plan 4.11 (P1) and section 7 step 6: every local script and stylesheet
// an offline shell page loads must be BOTH
//   (a) in sw.js SHELL_ASSETS (pre-cached at install), and
//   (b) matched by the fetch handler's DASHBOARD_PATHS (otherwise the service
//       worker passes the request straight to the network and the cached copy
//       is never used, so the page breaks offline: rule C1, offline-first #5).
// v6.8.15 had to add three new scripts by hand; this makes the next one fail
// the build instead.
//
// The pages and their files are read from the real repo files. Anything that is
// a gap today is named in KNOWN_GAPS, not skipped: a NEW gap fails, and so does
// fixing one without taking it off the list (so the list only ever shrinks).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const read = (f) => readFileSync(new URL(f, root), "utf8");
const sw = read("sw.js");

// The pages the service worker serves offline (SHELL_PAGE_NO_EXT).
const SHELL_PAGES = ["Org.html", "org-action-auth.html", "org-entry.html", "receipt.html", "check.html", "kiosk-code.html"];

function shellAssets() {
  const m = sw.match(/const SHELL_ASSETS = \[([\s\S]*?)\];/);
  assert.ok(m, "found SHELL_ASSETS in sw.js");
  return new Set([...m[1].matchAll(/'\.\/([^']+)'/g)].map(x => x[1]));
}
function dashboardPaths() {
  const m = sw.match(/const DASHBOARD_PATHS = (\/.*\/);/);
  assert.ok(m, "found DASHBOARD_PATHS in sw.js");
  return new Function("return " + m[1])();
}

// Local (same-origin) scripts and stylesheets a page loads, query string removed.
function localFilesOf(html) {
  const out = new Set();
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) out.add(m[1]);
  for (const m of html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/g)) out.add(m[1]);
  for (const m of html.matchAll(/<link\b[^>]*\bhref="([^"]+)"[^>]*\brel="stylesheet"/g)) out.add(m[1]);
  return [...out].filter(u => !/^(https?:)?\/\//.test(u) && !u.startsWith("data:")).map(u => u.split(/[?#]/)[0].replace(/^\.?\//, ""));
}

// Gaps that exist on main today. Each is "<page> <file>: what is missing".
// Fixing one needs a sw.js change and a cache-version bump (W8), so it is a
// separate decision from this test.
const KNOWN_GAPS = new Set([
  // Pre-cached but not matched by DASHBOARD_PATHS: the worker lets the request
  // through to the network, so offline the cached copy is never served.
  "Org.html js/irlid-env.js: not in DASHBOARD_PATHS",
  "Org.html js/fetch-timeout.js: not in DASHBOARD_PATHS",
  "Org.html js/attendance-week.js: not in DASHBOARD_PATHS",
  "org-entry.html js/irlid-env.js: not in DASHBOARD_PATHS",
  "org-entry.html js/fetch-timeout.js: not in DASHBOARD_PATHS",
  "org-entry.html js/checkin-reasons.js: not in DASHBOARD_PATHS",
  "org-action-auth.html js/irlid-env.js: not in DASHBOARD_PATHS",
  "kiosk-code.html js/irlid-env.js: not in DASHBOARD_PATHS",
  "receipt.html js/irlid-env.js: not in DASHBOARD_PATHS",
  "check.html js/irlid-env.js: not in DASHBOARD_PATHS",
  // Loaded by the consumer-style pages (receipt, check) but neither pre-cached
  // nor matched, so a first offline visit has no stylesheet or helper scripts.
  "receipt.html css/style.css: not pre-cached",
  "receipt.html css/style.css: not in DASHBOARD_PATHS",
  "receipt.html js/auth.js: not pre-cached",
  "receipt.html js/auth.js: not in DASHBOARD_PATHS",
  "receipt.html js/backend.js: not pre-cached",
  "receipt.html js/backend.js: not in DASHBOARD_PATHS",
  "receipt.html js/nav.js: not pre-cached",
  "receipt.html js/nav.js: not in DASHBOARD_PATHS",
  "receipt.html js/qr.js: not pre-cached",
  "receipt.html js/qr.js: not in DASHBOARD_PATHS",
  "check.html css/style.css: not pre-cached",
  "check.html css/style.css: not in DASHBOARD_PATHS",
  "check.html js/auth.js: not pre-cached",
  "check.html js/auth.js: not in DASHBOARD_PATHS",
  "check.html js/backend.js: not pre-cached",
  "check.html js/backend.js: not in DASHBOARD_PATHS",
  "check.html js/nav.js: not pre-cached",
  "check.html js/nav.js: not in DASHBOARD_PATHS"
]);

function findGaps() {
  const assets = shellAssets();
  const dash = dashboardPaths();
  const gaps = [];
  for (const page of SHELL_PAGES) {
    for (const file of localFilesOf(read(page))) {
      if (file.endsWith(".html") || file === "favicon.ico" || file === "manifest.json") continue;
      if (!assets.has(file)) gaps.push(`${page} ${file}: not pre-cached`);
      if (!dash.test("/" + file)) gaps.push(`${page} ${file}: not in DASHBOARD_PATHS`);
    }
  }
  return gaps;
}

test("every local script and stylesheet an offline shell page loads is pre-cached and served by the worker (or is a named known gap)", () => {
  const gaps = findGaps();
  const fresh = gaps.filter(g => !KNOWN_GAPS.has(g));
  assert.deepEqual(fresh, [],
    "New offline gap(s). Add the file to SHELL_ASSETS and DASHBOARD_PATHS in sw.js and bump CACHE_VERSION (W8):\n  " + fresh.join("\n  "));
});

test("the known-gap list only shrinks: a gap that is fixed must be taken off KNOWN_GAPS", () => {
  const gaps = new Set(findGaps());
  const stale = [...KNOWN_GAPS].filter(g => !gaps.has(g));
  assert.deepEqual(stale, [], "These gaps are fixed. Remove them from KNOWN_GAPS:\n  " + stale.join("\n  "));
});

test("every pre-cached file really exists in the repo", () => {
  for (const f of shellAssets()) {
    assert.doesNotThrow(() => readFileSync(new URL(f, root)), `${f} is in SHELL_ASSETS but missing: install would fail (the whole pre-cache is all-or-nothing)`);
  }
});

test("the Worker API is never served from the cache", () => {
  const origin = sw.match(/const WORKER_API_ORIGIN = '([^']+)'/);
  assert.ok(origin, "found WORKER_API_ORIGIN");
  assert.match(sw, /if \(url\.origin === WORKER_API_ORIGIN\) return;/, "the fetch handler lets Worker calls straight through");
  // ...and that check comes before any cache read in the handler.
  const handler = sw.slice(sw.indexOf("addEventListener('fetch'"));
  assert.ok(handler.indexOf("WORKER_API_ORIGIN) return") < handler.indexOf("caches.match"), "Worker origin check must come before any cache lookup");
  for (const f of shellAssets()) assert.ok(!f.includes("workers.dev"), "no Worker URL is pre-cached");
});

test("non-GET requests are never cached", () => {
  assert.match(sw, /if \(req\.method !== 'GET'\) return;/);
});
