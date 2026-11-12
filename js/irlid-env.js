// Copyright 2025 Spencer Austin. All rights reserved.
// Licensed under Apache 2.0 with Commons Clause. See LICENSE.
//
// js/irlid-env.js — which IRLid environment is this page in? (v6.8.14)
//
// One place that decides LIVE or TEST, so a test page can never quietly
// talk to the live database (12 Nov 2026: a person added on the old test
// site ended up on a live organisation's dashboard).
//
//   LIVE  = the page is open on https://irlid.co.uk (or www.). Uses the live
//           Workers exactly as before. Nothing on screen changes.
//   TEST  = anywhere else (localhost, a preview copy, a GitHub Pages copy).
//           Uses the STAGING Workers only, never the live ones, and shows a
//           striped "TEST COPY - NOT LIVE" bar on every page.
//
// A theme picture (for example the dragons) can be set on any org, live or
// test, so it never tells you which copy you are in. This bar does.
//
// Load it as the first script in <head>. orgapi.js and backend.js also check
// the page address themselves, so a page that forgets this file still never
// falls back to the live Workers when it is not on irlid.co.uk.
(function () {
  "use strict";

  var LIVE_SITE_HOSTS = ["irlid.co.uk", "www.irlid.co.uk"];
  var LIVE = {
    orgApi: "https://irlid-api-org.irlid-bunhead.workers.dev",
    api: "https://irlid-api.irlid-bunhead.workers.dev"
  };
  // Staging Workers (docs/test-environment.md). They only exist once Spencer
  // has done the one-time Cloudflare setup; until then test pages simply
  // fail to reach an API, which is the safe way to fail.
  var STAGING = {
    orgApi: "https://irlid-api-org-staging.irlid-bunhead.workers.dev",
    api: "https://irlid-api-staging.irlid-bunhead.workers.dev"
  };
  var LIVE_WORKER_HOSTS = [
    "irlid-api-org.irlid-bunhead.workers.dev",
    "irlid-api.irlid-bunhead.workers.dev"
  ];

  function hostOf(url) {
    try { return new URL(url).hostname; } catch (_) { return ""; }
  }

  var host = (typeof location !== "undefined" && location.hostname) || "";
  var isLive = LIVE_SITE_HOSTS.indexOf(host) !== -1;
  var cfg = isLive ? LIVE : STAGING;

  function isLiveWorker(url) {
    return LIVE_WORKER_HOSTS.indexOf(hostOf(url)) !== -1;
  }

  var BAR_ID = "irlid-env-bar";
  function showBar(text) {
    if (typeof document === "undefined") return;
    function put() {
      if (!document.body) return;
      var bar = document.getElementById(BAR_ID);
      if (!bar) {
        bar = document.createElement("div");
        bar.id = BAR_ID;
        bar.setAttribute("role", "alert");
        bar.style.cssText = [
          "position:fixed", "top:0", "left:0", "right:0", "z-index:2147483647", "box-sizing:border-box",
          "padding:10px 14px", "font:700 16px/1.35 system-ui,-apple-system,Segoe UI,Arial,sans-serif",
          "color:#111", "text-align:center", "letter-spacing:.02em",
          "background:repeating-linear-gradient(45deg,#ffd400 0 18px,#ffb000 18px 36px)",
          "border-bottom:4px solid #111"
        ].join(";");
        document.body.insertBefore(bar, document.body.firstChild);
      }
      bar.textContent = text;
      // Push the page down so the bar never hides the page's own top bar.
      try { document.body.style.paddingTop = (bar.offsetHeight || 44) + "px"; } catch (_) {}
    }
    if (document.body) put();
    else document.addEventListener("DOMContentLoaded", put);
  }

  function markTestPage() {
    if (typeof document === "undefined") return;
    document.documentElement.classList.add("irlid-env-test");
    document.documentElement.setAttribute("data-irlid-env", "test");
    function tag() { if (!/^\[TEST\]/.test(document.title || "")) document.title = "[TEST] " + (document.title || "IRLid"); }
    if (document.readyState && document.readyState !== "loading") tag();
    else document.addEventListener("DOMContentLoaded", tag);
    showBar("TEST COPY \u2014 NOT LIVE. Test data only. Nothing here reaches real organisations.");
  }

  // For pages that always open on irlid.co.uk but act for whichever Worker
  // a QR names (org-login.html, org-action-auth.html, kiosk-code.html).
  // If that Worker is not a live one, say so in big letters.
  function markWorker(workerUrl) {
    if (!workerUrl || isLiveWorker(workerUrl)) return false;
    if (typeof document !== "undefined") {
      document.documentElement.classList.add("irlid-env-test");
      document.documentElement.setAttribute("data-irlid-env", "test");
    }
    showBar("TEST SIGN-IN \u2014 NOT LIVE. This goes to " + hostOf(workerUrl) +
      ", a test copy. It does not sign you in to live organisations.");
    return true;
  }

  window.IRLidEnv = Object.freeze({
    name: isLive ? "live" : "test",
    isLive: isLive,
    orgApi: cfg.orgApi,
    api: cfg.api,
    liveSiteHosts: LIVE_SITE_HOSTS.slice(),
    stagingOrgApi: STAGING.orgApi,
    stagingApi: STAGING.api,
    isLiveWorker: isLiveWorker,
    markWorker: markWorker
  });

  if (!isLive) {
    // scan.html, check.html, receipt.html and others read this override.
    // Only ever set it to the staging Worker, never to a live one.
    var current = window.IRLID_ORG_API_BASE_URL;
    if (!current || isLiveWorker(current)) window.IRLID_ORG_API_BASE_URL = STAGING.orgApi;
    markTestPage();
  }
})();
