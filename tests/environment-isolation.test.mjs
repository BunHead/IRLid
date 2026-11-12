// LIVE vs TEST isolation (v6.8.14, 12 Nov 2026). A person added on the old
// test site ended up on a live organisation's dashboard. These tests make sure
// a page that is NOT on irlid.co.uk can never default to, or be pointed at,
// the live Workers, and that it always shows the TEST bar.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const LIVE_ORG = "https://irlid-api-org.irlid-bunhead.workers.dev";
const LIVE_API = "https://irlid-api.irlid-bunhead.workers.dev";
const STG_ORG = "https://irlid-api-org-staging.irlid-bunhead.workers.dev";
const STG_API = "https://irlid-api-staging.irlid-bunhead.workers.dev";

function fakeDom() {
  const kids = [];
  const classes = new Set();
  const attrs = {};
  const body = {
    get firstChild() { return kids[0] || null; },
    insertBefore(el) { kids.unshift(el); }
  };
  const document = {
    title: "IRLid",
    readyState: "complete",
    body,
    documentElement: {
      classList: { add: (c) => classes.add(c), contains: (c) => classes.has(c), toggle() {} },
      setAttribute: (k, v) => { attrs[k] = v; }
    },
    getElementById: (id) => kids.find((k) => k.id === id) || null,
    createElement: () => ({ style: {}, setAttribute() {}, textContent: "" }),
    addEventListener() {}
  };
  return { document, kids, classes, attrs };
}

function load(files, hostname, extra = {}) {
  const dom = fakeDom();
  const window = { ...extra };
  const ctx = { window, document: dom.document, location: { hostname, href: "https://" + hostname + "/Org.html", origin: "https://" + hostname }, URL, console, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, setTimeout, clearTimeout, fetch: async () => { throw new Error("no network in tests"); } };
  ctx.self = window;
  vm.createContext(ctx);
  // Make window properties visible as globals like a browser does.
  ctx.window = new Proxy(window, { set(t, k, v) { t[k] = v; ctx[k] = v; return true; } });
  for (const k of Object.keys(window)) ctx[k] = window[k];
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
  return { window, ctx, dom };
}

test("irlid-env.js: irlid.co.uk is LIVE, uses the live Workers and shows no bar", () => {
  for (const host of ["irlid.co.uk", "www.irlid.co.uk"]) {
    const { window, dom } = load(["js/irlid-env.js"], host);
    assert.equal(window.IRLidEnv.isLive, true);
    assert.equal(window.IRLidEnv.orgApi, LIVE_ORG);
    assert.equal(window.IRLidEnv.api, LIVE_API);
    assert.equal(window.IRLID_ORG_API_BASE_URL, undefined, "live pages get no override");
    assert.equal(dom.kids.length, 0, "no TEST bar on live");
    assert.equal(dom.document.title, "IRLid");
  }
});

test("irlid-env.js: any other address is TEST, uses staging only and shows the TEST bar", () => {
  for (const host of ["localhost", "127.0.0.1", "bunhead.github.io", "preview.example.pages.dev", "irlid.co.uk.evil.example"]) {
    const { window, dom } = load(["js/irlid-env.js"], host);
    assert.equal(window.IRLidEnv.isLive, false, host);
    assert.equal(window.IRLidEnv.orgApi, STG_ORG);
    assert.equal(window.IRLidEnv.api, STG_API);
    assert.equal(window.IRLID_ORG_API_BASE_URL, STG_ORG);
    assert.equal(dom.kids.length, 1, "TEST bar shown");
    assert.match(dom.kids[0].textContent, /TEST COPY .* NOT LIVE/);
    assert.match(dom.document.title, /^\[TEST\] /);
    assert.ok(dom.classes.has("irlid-env-test"));
  }
});

test("irlid-env.js: a test page that was told to use the live Worker is switched to staging", () => {
  const { window } = load(["js/irlid-env.js"], "localhost", { IRLID_ORG_API_BASE_URL: LIVE_ORG });
  assert.equal(window.IRLID_ORG_API_BASE_URL, STG_ORG);
});

test("irlid-env.js: markWorker shows the TEST SIGN-IN bar only for a Worker that is not live", () => {
  const live = load(["js/irlid-env.js"], "irlid.co.uk");
  assert.equal(live.window.IRLidEnv.markWorker(LIVE_ORG), false);
  assert.equal(live.dom.kids.length, 0);
  for (const w of ["https://irlid-api-test.irlid-bunhead.workers.dev", STG_ORG]) {
    const p = load(["js/irlid-env.js"], "irlid.co.uk");
    assert.equal(p.window.IRLidEnv.markWorker(w), true, w);
    assert.match(p.dom.kids[0].textContent, /TEST SIGN-IN .* NOT LIVE/);
  }
});

test("orgapi.js: live page uses the live org Worker exactly as before", () => {
  const { window } = load(["js/orgapi.js"], "irlid.co.uk");
  assert.equal(window.IRLidOrgApi.baseUrl(), LIVE_ORG);
});

test("orgapi.js: a test page never uses the live org Worker, even without irlid-env.js", () => {
  assert.equal(load(["js/orgapi.js"], "localhost").window.IRLidOrgApi.baseUrl(), STG_ORG);
  assert.equal(load(["js/orgapi.js"], "bunhead.github.io", { IRLID_ORG_API_BASE_URL: LIVE_ORG }).window.IRLidOrgApi.baseUrl(), STG_ORG);
  assert.equal(load(["js/irlid-env.js", "js/orgapi.js"], "localhost").window.IRLidOrgApi.baseUrl(), STG_ORG);
  // a local wrangler dev Worker is still allowed on a test page
  assert.equal(load(["js/orgapi.js"], "localhost", { IRLID_ORG_API_BASE_URL: "http://localhost:8787" }).window.IRLidOrgApi.baseUrl(), "http://localhost:8787");
});

test("orgapi.js: a live page refuses the staging Worker", () => {
  assert.equal(load(["js/orgapi.js"], "irlid.co.uk", { IRLID_ORG_API_BASE_URL: STG_ORG }).window.IRLidOrgApi.baseUrl(), LIVE_ORG);
});

test("backend.js: live consumer Worker only on irlid.co.uk", () => {
  const src = read("js/backend.js");
  assert.match(src, /IS_LIVE_SITE\s*\n?\s*\?\s*"https:\/\/irlid-api\.irlid-bunhead\.workers\.dev"\s*\n?\s*:\s*"https:\/\/irlid-api-staging\.irlid-bunhead\.workers\.dev"/);
});

test("every page that talks to an IRLid Worker loads irlid-env.js as its first script", () => {
  const pages = ["Org.html", "scan.html", "org-entry.html", "org-login.html", "org-action-auth.html", "kiosk-code.html",
    "check.html", "receipt.html", "index.html", "account.html", "login.html", "settings.html", "accept.html",
    "features.html", "forums.html", "about.html", "contact.html", "blog-proof-of-personhood.html"];
  for (const p of pages) {
    const html = read(p);
    const first = html.indexOf("<script");
    assert.ok(first > 0, p);
    assert.match(html.slice(first, first + 60), /<script src="js\/irlid-env\.js/, p + ": irlid-env.js must be the first script");
  }
});

test("org-entry.html: on a test copy the orange staff QR and sign-in return never point at live", () => {
  const html = read("org-entry.html");
  const scanFn = html.slice(html.indexOf("function scanUrlBase()"), html.indexOf("function returnTargetFor"));
  assert.match(scanFn, /!window\.IRLidEnv\.isLive\) return new URL\("scan\.html", location\.href\)\.href/);
  assert.match(html, /const dashboardReturn = \(window\.IRLidEnv && !window\.IRLidEnv\.isLive\)/);
  assert.match(html, /const API_BASE = \(window\.IRLidOrgApi && window\.IRLidOrgApi\.baseUrl\)/);
});

test("scan.html: the org Worker falls back to IRLidEnv before the live Worker", () => {
  assert.match(read("scan.html"), /window\.IRLID_ORG_API_BASE_URL \|\| \(window\.IRLidEnv && window\.IRLidEnv\.orgApi\) \|\| "https:\/\/irlid-api-org/);
});

test("org-login.html accepts the staging Workers and flags any Worker that is not live", () => {
  const html = read("org-login.html");
  assert.match(html, /irlid-api\(-test\|-org\|-staging\|-org-staging\)\?/);
  assert.match(html, /window\.IRLidEnv\.markWorker\(workerRaw\)/);
});

test("service worker pre-caches irlid-env.js and the cache and build moved on (W8)", () => {
  const sw = read("sw.js");
  assert.match(sw, /'\.\/js\/irlid-env\.js'/);
  assert.ok(Number(sw.match(/CACHE_VERSION = 'irlid-shell-v(\d+)'/)[1]) >= 205);
  assert.match(read("Org.html"), /Build v6\.8\.(1[4-9]|[2-9]\d)</);
});
