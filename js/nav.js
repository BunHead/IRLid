// /js/nav.js
// Shared navigation logic for IRLid (static GitHub Pages)
// - Shows Login when logged out
// - Shows Name... dropdown (Settings, Receipts, Logout) when logged in
// Deploy 70

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
    // Check backend session first (preferred)
    if (window.IRLBackend && window.IRLBackend.hasSession()) return true;
    // Fall back to local passkey login
    try {
      return !!(
        window.IRLAuth &&
        typeof window.IRLAuth.isLoggedIn === "function" &&
        window.IRLAuth.isLoggedIn()
      );
    } catch {
      return false;
    }
  }

  function getDisplayName() {
    // Try backend display name first
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
          '<a href="settings.html" id="acctSettingsLink">Settings</a>' +
          '<a href="receipt.html">Receipts</a>' +
          '<a href="login.html" id="acctLogoutLink">Logout</a>' +
        '</div>' +
      '</details>';

    var logout = document.getElementById("acctLogoutLink");
    if (logout) {
      logout.addEventListener("click", async function (e) {
        e.preventDefault();
        try {
          // Log out of backend
          if (window.IRLBackend && typeof window.IRLBackend.logout === "function") {
            await window.IRLBackend.logout();
          }
          // Log out of local passkey
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

  // Expose refreshNav globally so login.html can call it after registration
  window.refreshNav = function () {
    renderAccountNav(isLoggedIn());
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNav);
  } else {
    initNav();
  }
})();
