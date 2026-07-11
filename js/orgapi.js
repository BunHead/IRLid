// IRLid organisation portal API client for the live Org Worker.
(function () {
  const DEFAULT_BASE_URL = "https://irlid-api-org.irlid-bunhead.workers.dev";
  // v6.4.24 — only these hosts may serve the org API. An injected override to a
  // hostile host would otherwise exfiltrate the Bearer token + X-Org-Key on every
  // request. Reject any override that isn't https + an allowlisted host.
  const ALLOWED_API_HOSTS = ["irlid-api-org.irlid-bunhead.workers.dev", "localhost"];

  function getBaseUrl() {
    const override = window.IRLID_ORG_API_BASE_URL;
    if (override) {
      try {
        const u = new URL(override);
        const okScheme = u.protocol === "https:" || u.hostname === "localhost";
        if (okScheme && ALLOWED_API_HOSTS.includes(u.hostname)) {
          return String(override).replace(/\/+$/, "");
        }
      } catch (_) { /* invalid URL — fall through to default */ }
    }
    return DEFAULT_BASE_URL.replace(/\/+$/, "");
  }

  const QUEUE_ELIGIBLE_PATHS = [
    "/org/checkin",
    "/org/checkout",
    "/org/checkout-token",
    "/org/expected",
    "/org/conflicts",
    "/org/settings"
  ];

  // v6.4.20 — signed-action endpoints must NEVER be offline-queued. Their
  // WebAuthn envelopes bind a nonce + freshness window, so a replayed copy
  // can only fail (HTTP 400) and the replay pass then drops it after the
  // user has walked away believing it synced (the 22 Jun silent-drop
  // finding). Excluded, the call fails loudly at click time and the user
  // re-signs when back online. PATCH /org/expected/:id is signed-gated
  // server-side (requireCalendarSignedAction), so PATCH is excluded too.
  const QUEUE_EXCLUDED_PATTERNS = [
    /^\/org\/expected\/create-and-bind([/?]|$)/,             // requireFreshStaffProof + requireSignedAction
    /^\/org\/expected\/[^/?]+\/bind-additional-key([/?]|$)/, // requireSignedAction
    /^\/org\/expected\/[^/?]+\/rebind([/?]|$)/               // admin_signature verification
  ];

  function isQueueEligible(path, method) {
    const m = String(method || "GET").toUpperCase();
    if (m === "GET" || m === "PATCH") return false;
    if (QUEUE_EXCLUDED_PATTERNS.some(p => p.test(path))) return false;
    return QUEUE_ELIGIBLE_PATHS.some(p => path === p || path.startsWith(p + "/") || path.startsWith(p + "?"));
  }

  async function enqueueOfflineRequest(url, method, headers, body) {
    if (!window.IRLidOfflineQueue) return null;
    const queued = await window.IRLidOfflineQueue.enqueue({ url, method, headers, body });
    window.dispatchEvent(new CustomEvent("irlid:queue-changed"));
    return {
      queued: true,
      queued_id: queued && queued.id,
      idempotency_key: queued && queued.idempotency_key,
      queued_at: queued && queued.queued_at
    };
  }

  async function request(path, options) {
    const opts = options || {};
    const method = (opts.method || "GET").toUpperCase();
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (opts.orgKey) headers["X-Org-Key"] = opts.orgKey;
    // Batch C — Bearer session token for user-level endpoints (/user/*). The api_key
    // and the session token coexist during v5.5: api_key for org-scoped service ops,
    // Bearer for user-identity ops. Send whichever the caller has supplied.
    if (opts.sessionToken) headers["Authorization"] = "Bearer " + opts.sessionToken;

    const url = getBaseUrl() + path;
    const body = opts.body ? JSON.stringify(opts.body) : undefined;
    const eligible = isQueueEligible(path, method);

    // v5.5.12 - offline queue interception. If we know we are offline, skip
    // the network attempt entirely; otherwise let fetch fail and fall back to
    // the queue for whitelisted mutating Worker calls.
    if (eligible && navigator.onLine === false && window.IRLidOfflineQueue) {
      return enqueueOfflineRequest(url, method, headers, body);
    }

    let response;
    try {
      response = await fetch(url, { method, headers, body });
    } catch (err) {
      if (eligible && window.IRLidOfflineQueue) {
        return enqueueOfflineRequest(url, method, headers, body);
      }
      throw err;
    }

    let data = null;
    try { data = await response.json(); } catch {}

    if (!response.ok) {
      const message = data && data.error ? data.error : `Request failed with status ${response.status}`;
      // v6.4.16 — surface login-session expiry centrally so the dashboard can
      // bounce to a fresh sign-in instead of scattering session_invalid errors
      // across every action. The dashboard listens for irlid:session-expired.
      if (response.status === 401 && data && /^session_(invalid|expired|required|user_missing)$/.test(String(data.error || ""))) {
        try { window.dispatchEvent(new CustomEvent("irlid:session-expired", { detail: { error: data.error } })); } catch (_) {}
      }
      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  // Public helper — exposes the resolved Worker base URL so callers can encode it
  // into the login QR (the phone POSTs back to it) and rendering paths can
  // distinguish prod vs test endpoints without hardcoding.
  function publicBaseUrl() { return getBaseUrl(); }

  window.IRLidOrgApi = {
    // PROTOCOL.md §14 — Identity-bound sessions (Batch B).
    loginInit() {
      return request("/org/login/init", { method: "POST" });
    },
    loginPoll(nonce) {
      return request("/org/login/poll?nonce=" + encodeURIComponent(nonce));
    },
    loginClaim(payload) {
      return request("/org/login/claim", {
        method: "POST",
        body: payload
      });
    },
    actionInit(sessionToken, payload) {
      return request("/org/action/init", {
        method: "POST",
        sessionToken,
        body: payload
      });
    },
    async actionPoll(nonce) {
      const encoded = encodeURIComponent(nonce);
      try {
        return await request("/org/action/poll/" + encoded);
      } catch (err) {
        const message = String((err && err.message) || "").toLowerCase();
        if (err && err.status === 404 && /not found|action_not_found/.test(message)) {
          return request("/org/action/poll?nonce=" + encoded);
        }
        throw err;
      }
    },
    actionClaim(payload) {
      return request("/org/action/claim", {
        method: "POST",
        body: payload
      });
    },
    workerBaseUrl() { return publicBaseUrl(); },
    createCheckinNonce(orgKey, eventId) {
      return request("/org/checkin-nonce", {
        method: "POST",
        orgKey,
        body: { event_id: eventId || null }
      });
    },
    // v6.4.20 — exposed for diagnostics only (localhost smoke + Chrome-MCP
    // probes can verify queue-eligibility rules without faking an outage).
    isQueueEligible,

    // PROTOCOL.md §14 — Batch C user-level endpoints, Bearer session token auth.
    listMyOrgs(sessionToken) {
      return request("/user/orgs", { sessionToken });
    },
    createOrg(sessionToken, payload) {
      return request("/user/create-org", {
        method: "POST",
        sessionToken,
        body: payload
      });
    },
    async signOutAllDevices(sessionToken) {
      const resp = await fetch(getBaseUrl() + "/user/sign-out-all-devices", {
        method: "POST",
        headers: { "Authorization": "Bearer " + sessionToken }
      });
      let data = null;
      try { data = await resp.json(); } catch (_) {}
      return { ok: resp.ok, status: resp.status, data };
    },
    createInvite(sessionToken, payload) {
      return request("/org/invites/create", {
        method: "POST",
        sessionToken,
        body: payload
      });
    },
    redeemInvite(payload) {
      return request("/org/invites/redeem", {
        method: "POST",
        body: payload
      });
    },
    acceptInviteOnThisDevice(payload) {
      return request("/org/invite/accept-on-this-device", {
        method: "POST",
        body: payload
      });
    },
    // v6.4.10 (PR-4 QR diet) — resolve a slim nonce-reference invite QR back
    // to the full signed "I:" envelope string the issuer minted.
    inviteEnvelope(nonce) {
      return request("/org/invites/" + encodeURIComponent(nonce) + "/envelope");
    },
    appointLeadAdmin(sessionToken, payload) {
      return request("/org/lead-admin/appoint", {
        method: "POST",
        sessionToken,
        body: payload
      });
    },
    publicOrgMeta(orgId) {
      return request("/org/public-meta?org_id=" + encodeURIComponent(orgId));
    },
    publicOrgInfo(slug) {
      return request("/org/public-info/" + encodeURIComponent(slug));
    },
    getOrgReceipt(receiptId) {
      return request("/org/receipt/" + encodeURIComponent(receiptId));
    },
    revokeInvite(sessionToken, payload) {
      return request("/org/invites/revoke", {
        method: "POST",
        sessionToken,
        body: payload
      });
    },
    scrapeTheme(sessionToken, orgId) {
      return request(`/user/orgs/${encodeURIComponent(orgId)}/scrape-theme`, {
        method: "POST",
        sessionToken,
        body: {}
      });
    },
    imageProxyUrl(imageUrl) {
      return publicBaseUrl() + "/util/image-proxy?url=" + encodeURIComponent(imageUrl);
    },

    registerOrganisation(name) {
      return request("/org/register", {
        method: "POST",
        body: { name }
      });
    },

    listAttendance(orgKey, options) {
      const includeExpected = !!(options && options.includeExpected);
      const params = new URLSearchParams();
      if (includeExpected) params.set("include_expected", "1");
      if (options && options.eventId) params.set("event_id", options.eventId);
      if (options && options.since) params.set("since", options.since);
      const suffix = params.toString() ? "?" + params.toString() : "";
      return request("/org/attendance" + suffix, {
        orgKey
      });
    },

    // Batch C polish 9 — accepts an optional sessionToken so the Worker can
    // identify Developer / Lead Admin users authorised to clear non-DEV orgs.
    // Existing DEV-key callers keep working without the token (worker's
    // isDebugOrg path).
    clearTestAttendance(orgKey, includeExpected, sessionToken) {
      return request("/org/debug/clear-attendance", {
        method: "POST",
        orgKey,
        sessionToken,
        body: { include_expected: !!includeExpected }
      });
    },

    createCheckin(orgKey, body, sessionToken) {
      return request("/org/checkin", {
        method: "POST",
        orgKey,
        body,
        sessionToken
      });
    },

    authenticateStaff(orgKey, hello) {
      return request("/org/staff/auth", {
        method: "POST",
        orgKey,
        body: { hello }
      });
    },

    checkout(orgKey, body) {
      return request("/org/checkout", {
        method: "POST",
        orgKey,
        body
      });
    },

    checkoutLegacy(orgKey, body) {
      return request("/org/checkout?checkout_method=legacy", {
        method: "POST",
        orgKey,
        body
      });
    },

    createCheckoutToken(orgKey, checkinId) {
      return request("/org/checkout-token", {
        method: "POST",
        orgKey,
        body: { checkin_id: checkinId }
      });
    },

    resolveCheckoutToken(token) {
      return request(`/org/checkout-token/${encodeURIComponent(token)}`);
    },

    recognize(orgKey, devicePub) {
      return request(`/org/recognize?org=${encodeURIComponent(orgKey)}&device_pub=${encodeURIComponent(devicePub)}`);
    },

    listExpected(orgKey) {
      return request("/org/expected", {
        orgKey
      });
    },

    createExpected(orgKey, body, sessionToken) {
      return request("/org/expected", {
        method: "POST",
        orgKey,
        body,
        sessionToken
      });
    },

    deleteExpected(orgKey, id, sessionToken) {
      return request(`/org/expected/${encodeURIComponent(id)}`, {
        method: "DELETE",
        orgKey,
        sessionToken
      });
    },

    // v5.7.0g — cascading delete for an attendee record. Removes the
    // org_checkins history rows, rebind_history, attendee_conflicts, AND
    // the org_expected row itself. Lead_admin+ only (Worker enforces).
    // Use only when the attendee row has moved past the "expected" state
    // (e.g. checked in/out, conflict, invalid) and the regular
    // deleteExpected button is no longer visible.
    // v5.7.0j — `force=true` bypasses the Worker's "active checkin must
    // check out first" guard. Caller passes this when deleting an IN row.
    deleteExpectedFull(orgKey, id, sessionToken, force) {
      const path = `/org/expected/${encodeURIComponent(id)}/full${force ? '?force=true' : ''}`;
      return request(path, {
        method: "DELETE",
        orgKey,
        sessionToken
      });
    },

    updateExpected(orgKey, id, body) {
      return request(`/org/expected/${encodeURIComponent(id)}`, {
        method: "PATCH",
        orgKey,
        body
      });
    },

    rebindExpected(orgKey, id, body) {
      return request(`/org/expected/${encodeURIComponent(id)}/rebind`, {
        method: "POST",
        orgKey,
        body
      });
    },

    bindAdditionalKey(orgKey, id, body, sessionToken) {
      return request(`/org/expected/${encodeURIComponent(id)}/bind-additional-key`, {
        method: "POST",
        orgKey,
        body,
        sessionToken
      });
    },

    createAndBindExpected(orgKey, body, sessionToken) {
      return request("/org/expected/create-and-bind", {
        method: "POST",
        orgKey,
        body,
        sessionToken
      });
    },

    claimExpected(orgKey, id, devicePubFp) {
      return request(`/org/expected/${encodeURIComponent(id)}/claim`, {
        method: "POST",
        orgKey,
        body: { device_pub_fp: devicePubFp }
      });
    },

    resolveConflict(orgKey, id, resolution) {
      return request(`/org/conflicts/${encodeURIComponent(id)}/resolve`, {
        method: "POST",
        orgKey,
        body: { resolution }
      });
    },

    // --- Settings persistence (Batch 6.5, 3 May 2026) ---
    // Read the org-level settings_json from the Worker. Used by the OrgCheckin
    // Settings panel on open to load the saved state (theme, palette, branding,
    // policy toggles). Returns { id, name, slug, settings }.
    // v6 placeholder: recognition_mode will gate the recognition flow:
    //   'prebind'       - current behaviour, attendee must be Expected first
    //   'postattribute' - attendee scans first, gets attributed to an Expected row after
    //   'both'          - either path allowed
    // Stub field exists in schema; UI surfaces in v6.
    getOrgSettings(orgKey) {
      return request("/org/settings", {
        orgKey
      });
    },

    // Persist a partial settings update server-side. Body keys outside the
    // Worker's allowlist are silently dropped; theme is validated server-side
    // (hex shape, contrast against white, palette length cap). Returns
    // { settings } with the merged current state on success.
    updateOrgSettings(orgKey, partial, sessionToken) {
      return request("/org/settings", {
        method: "POST",
        orgKey,
        sessionToken,
        body: partial
      });
    }
  };
})();
