// /js/nav.js
// Shared navigation logic for IRLid (static GitHub Pages)
// - Shows Login when logged out
// - Shows Name... dropdown (Settings, Receipts, Logout) when logged in
// Deploy 1

(function () {
  "use strict";

  function closeAllDropdowns(exceptId) {
    document.querySelectorAll("details.nav-dropdown").forEach((d) => {
      if (d.id !== exceptId) d.removeAttribute("open");
    });
  }

  function wireDropdownCloseBehavior() {
    document.querySelectorAll("details.nav-dropdown").forEach((d) => {
      d.addEventListener("toggle", () => {
        if (d.open) closeAllDropdowns(d.id || "__anon__");
      });
    });

    document.addEventListener("click", (e) => {
      const t = e.target;
      const isInside = t && t.closest && t.closest("details.nav-dropdown");
      if (!isInside) closeAllDropdowns("__none__");
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAllDropdowns("__none__");
    });
  }

  function isLoggedIn() {
    try {
      return !!(window.IRLAuth && typeof window.IRLAuth.isLoggedIn === "function" && window.IRLAuth.isLoggedIn());
    } catch {
      return false;
    }
  }

  function renderAccountNav(loggedIn) {
    const slot = document.getElementById("accountSlot");
    if (!slot) return;

    if (!loggedIn) {
      slot.innerHTML = '<a class="nav-btn" href="login.html">Login</a>';
      return;
    }

    slot.innerHTML = `
      <details class="nav-dropdown" id="accountDropdown">
        <summary class="nav-btn">Name... ▼</summary>
        <div class="dropdown-menu" role="menu" aria-label="Account menu">
          <a href="#" id="acctSettingsLink">Settings</a>
          <a href="receipt.html">Receipts</a>
          <a href="login.html" id="acctLogoutLink">Logout</a>
        </div>
      </details>
    `;

    const settings = document.getElementById("acctSettingsLink");
    if (settings) {
      settings.addEventListener("click", (e) => {
        e.preventDefault();
        alert("Settings page not added yet.");
      });
    }

    const logout = document.getElementById("acctLogoutLink");
    if (logout) {
      logout.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          if (window.IRLAuth && typeof window.IRLAuth.logout === "function") {
            await window.IRLAuth.logout();
          }
        } finally {
          closeAllDropdowns("__none__");
          window.location.href = "login.html";
        }
      });
    }
  }

  function initNav() {
    renderAccountNav(isLoggedIn());
    wireDropdownCloseBehavior();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNav);
  } else {
    initNav();
  }
})();
