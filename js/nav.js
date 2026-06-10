// Copyright 2025 Spencer Austin. All rights reserved.
// Licensed under Apache 2.0 with Commons Clause. See LICENSE.
// /js/nav.js
// Shared navigation logic for IRLid
// Deploy 72

(function () {
  "use strict";

  function closeAllDropdowns(exceptEl) {
    document.querySelectorAll("details.nav-dropdown").forEach(function (d) {
      if (exceptEl && d === exceptEl) return;
      d.removeAttribute("open");
    });
  }

  function wireDropdownCloseBehavior() {
    document.querySelectorAll("details.nav-dropdown").forEach(function (d) {
      d.addEventListener("toggle", function () {
        if (d.open) closeAllDropdowns(d);
      });
    });

    document.addEventListener("click", function (e) {
      var t = e.target;
      var isInside = t && t.closest && t.closest("details.nav-dropdown");
      if (!isInside) closeAllDropdowns(null);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAllDropdowns(null);
    });
  }

  function isLoggedIn() {
    if (window.IRLBackend && window.IRLBackend.hasSession()) return true;
    try {
      return !!(window.IRLAuth && typeof window.IRLAuth.isLoggedIn === "function" && window.IRLAuth.isLoggedIn());
    } catch { return false; }
  }

  function getDisplayName() {
    if (window.IRLBackend && typeof window.IRLBackend.getDisplayName === "function") {
      var name = window.IRLBackend.getDisplayName();
      if (name) return name;
    }
    return null;
  }

  function renderAccountNav(loggedIn) {
    var slot = document.getElementById("accountSlot");
    if (!slot) return;

    if (!loggedIn) {
      slot.innerHTML = '<a class="nav-btn" href="login.html">Login</a>';
      return;
    }

    var displayName = getDisplayName() || "Account";

    // v5.9 — Organization link (3rd position) for users with org dashboard access.
    // Currently shown to all logged-in users; v6 will gate this on a Patreon /
    // membership-tier check (Captain's "raised eyebrow" placeholder design).
    // The "members" pill marks it visually as a gated feature so users without
    // a membership level know it's not the default account surface. Until the
    // membership system lands, the Org.html page itself gates entry via
    // Bearer token — non-org users will see "no orgs" rather than getting in.
    // v5.11.0 — link target updated from OrgCheckin.html (retired 25 May 2026)
    // to Org.html (canonical v5.11 dashboard).
    slot.innerHTML =
      '<details class="nav-dropdown" id="accountDropdown">' +
        '<summary class="nav-btn">' + displayName + ' ▼</summary>' +
        '<div class="dropdown-menu" role="menu" aria-label="Account menu">' +
          '<a href="receipt.html">Receipts</a>' +
          '<a href="account.html">Account</a>' +
          '<a href="Org.html" data-members-only="true">Organization <span style="font-size:10px;background:var(--accent,#58a6ff);color:#fff;padding:1px 5px;border-radius:3px;margin-left:4px;vertical-align:middle;">members</span></a>' +
          '<a href="settings.html">Settings</a>' +
          '<a href="#" id="acctLogoutLink">Logout</a>' +
        '</div>' +
      '</details>';

    var logout = document.getElementById("acctLogoutLink");
    if (logout) {
      logout.addEventListener("click", async function (e) {
        e.preventDefault();
        try {
          if (window.IRLBackend && typeof window.IRLBackend.logout === "function") {
            await window.IRLBackend.logout();
          }
          if (window.IRLAuth && typeof window.IRLAuth.logout === "function") {
            await window.IRLAuth.logout();
          }
        } finally {
          closeAllDropdowns(null);
          window.location.href = "login.html";
        }
      });
    }
  }

  // WCAG 2.2 AA — 2.4.1 Bypass Blocks. Inject a "Skip to main content" link as
  // the first focusable element, targeting the page's <main> landmark. Hidden
  // until focused (see .skip-link in css/style.css). Centralised here so every
  // page that loads nav.js gets it without per-page markup.
  function injectSkipLink() {
    if (document.querySelector(".skip-link")) return;
    var main = document.querySelector("main");
    if (!main) return;
    if (!main.id) main.id = "main-content";
    if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
    var link = document.createElement("a");
    link.className = "skip-link";
    link.href = "#" + main.id;
    link.textContent = "Skip to main content";
    document.body.insertBefore(link, document.body.firstChild);
  }

  function initNav() {
    injectSkipLink();
    renderAccountNav(isLoggedIn());
    wireDropdownCloseBehavior();
  }

  window.refreshNav = function () {
    renderAccountNav(isLoggedIn());
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNav);
  } else {
    initNav();
  }
})();
