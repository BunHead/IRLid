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

    slot.innerHTML =
      '<details class="nav-dropdown" id="accountDropdown">' +
        '<summary class="nav-btn">' + displayName + ' ▼</summary>' +
        '<div class="dropdown-menu" role="menu" aria-label="Account menu">' +
          '<a href="account.html">Account</a>' +
          '<a href="receipt.html">Receipts</a>' +
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

  function initNav() {
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
