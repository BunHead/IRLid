// Test plan 4.11 (P1) and section 7 step 6: every local script and stylesheet
// an offline shell page loads must be BOTH
//   (a) in sw.js SHELL_ASSETS (pre-cached at install), and
//   (b) matched by the fetch handler's DASHBOARD_PATHS (otherwise the service
//       worker passes the request straight to the network and the cached copy
//       is never used, so the page breaks offline: rule C1, offline-first #5).
// v6.8.15 had to add three new scripts by hand; this makes the next one fail
// the build instead.
//
// The pages and their files are read from the real repo files. There are no
// known gaps (v6.8.25 closed the ones this test first found).
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

// No gaps are allowed (v6.8.25 closed the ones this test first found). A new
// one fails the build: add the file to SHELL_ASSETS and DASHBOARD_PATHS in sw.js
// and bump CACHE_VERSION (W8).
const KNOWN_GAPS = new Set([]);

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

test("there are no gaps at all (the known-gap list stays empty)", () => {
  assert.equal(KNOWN_GAPS.size, 0);
  assert.deepEqual(findGaps(), []);
});

test("the cache version has a CHANGELOG entry (W8: bump it whenever a cached file changes)", () => {
  const v = sw.match(/const CACHE_VERSION = '([^']+)'/)[1];
  assert.ok(read("CHANGELOG.md").includes("## " + v + "\n"), `CHANGELOG.md has no "## ${v}" section`);
  assert.ok(Number(v.replace(/\D+/g, "")) >= 216, "the cache version must be at least v216 so phones drop the v215 copy");
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
