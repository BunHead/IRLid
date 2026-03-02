// /js/backend.js — Deploy 2
// API client for IRLid backend (Cloudflare Workers + D1).
// All functions fail silently if backend is unreachable.
//
// Requires: js/sign.js (for getPublicJwk)
// Exposes: window.IRLBackend

(function () {
  "use strict";

  var BACKEND_URL = "https://irlid-api.irlid-bunhead.workers.dev";
  var LS_TOKEN = "irlid_session_token";
  var LS_USER_ID = "irlid_user_id";
  var LS_DISPLAY_NAME = "irlid_display_name";

  function getToken() {
    try { return localStorage.getItem(LS_TOKEN) || null; } catch { return null; }
  }

  function setToken(t) {
    try {
      if (t) localStorage.setItem(LS_TOKEN, t);
      else localStorage.removeItem(LS_TOKEN);
    } catch {}
  }

  function setUserInfo(userId, displayName) {
    try {
      if (userId) localStorage.setItem(LS_USER_ID, userId);
      else localStorage.removeItem(LS_USER_ID);
      if (displayName) localStorage.setItem(LS_DISPLAY_NAME, displayName);
      else localStorage.removeItem(LS_DISPLAY_NAME);
    } catch {}
  }

  async function api(method, path, body) {
    var headers = { "Content-Type": "application/json" };
    var token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;

    try {
      var opts = { method: method, headers: headers };
      if (body && method !== "GET") opts.body = JSON.stringify(body);

      var resp = await fetch(BACKEND_URL + path, opts);
      var data = await resp.json();

      if (!resp.ok) return { ok: false, status: resp.status, error: data.error || resp.statusText, data: data };
      return { ok: true, status: resp.status, data: data };
    } catch (e) {
      return { ok: false, error: "network", message: String(e), data: null };
    }
  }

  window.IRLBackend = {

    hasSession: function () { return !!getToken(); },

    getDisplayName: function () {
      try { return localStorage.getItem(LS_DISPLAY_NAME) || null; } catch { return null; }
    },

    // ===== Auth =====

    /** Register or log in with this device's ECDSA key. */
    register: async function (displayName) {
      if (typeof getPublicJwk !== "function") return { ok: false, error: "sign.js not loaded" };

      var pub = await getPublicJwk();
      var result = await api("POST", "/auth/register", {
        display_name: displayName || null,
        pub_jwk: pub
      });

      if (result.ok && result.data && result.data.session_token) {
        setToken(result.data.session_token);
        setUserInfo(result.data.user_id, displayName || null);
      }
      return result;
    },

    /** Check current session. */
    me: async function () {
      var result = await api("GET", "/auth/me");
      if (result.ok && result.data) {
        if (result.data.logged_in && result.data.user) {
          setUserInfo(result.data.user.id, result.data.user.display_name);
        }
        if (!result.data.logged_in) {
          setToken(null);
          setUserInfo(null, null);
        }
      }
      return result;
    },

    /** Log out (server + local). */
    logout: async function () {
      await api("POST", "/auth/logout");
      setToken(null);
      setUserInfo(null, null);
    },

    // ===== Device linking =====

    /** Generate a 6-digit link code (called from logged-in device). */
    createLinkCode: async function () {
      if (!getToken()) return { ok: false, error: "not_logged_in" };
      return await api("POST", "/auth/link/create");
    },

    /** Claim a link code from a new device. Registers this device's key under the existing account. */
    claimLinkCode: async function (code, pubJwk) {
      if (!pubJwk && typeof getPublicJwk === "function") pubJwk = await getPublicJwk();
      if (!pubJwk) return { ok: false, error: "No public key available" };

      var result = await api("POST", "/auth/link/claim", {
        code: code,
        pub_jwk: pubJwk
      });

      if (result.ok && result.data && result.data.session_token) {
        setToken(result.data.session_token);
        setUserInfo(result.data.user_id, result.data.display_name || null);
      }
      return result;
    },

    // ===== Device management =====

    /** Revoke a device (by device ID). */
    revokeDevice: async function (deviceId) {
      if (!getToken()) return { ok: false, error: "not_logged_in" };
      return await api("POST", "/auth/device/revoke", { device_id: deviceId });
    },

    // ===== Receipts =====

    /** Upload a combined receipt. */
    uploadReceipt: async function (combinedObj) {
      if (!getToken()) return { ok: false, error: "not_logged_in" };
      return await api("POST", "/receipts", { combined: combinedObj });
    },

    /** List the logged-in user's receipts. */
    listReceipts: async function (page) {
      if (!getToken()) return { ok: false, error: "not_logged_in" };
      return await api("GET", "/receipts?page=" + (page || 1));
    },

    /** Get a specific receipt by hash. */
    getReceipt: async function (hash) {
      return await api("GET", "/receipts/" + encodeURIComponent(hash));
    }
  };

})();
