// IRLid Test Environment Service Worker
// v5.7.1a — Tier 1 of PROTOCOL.md §16 Offline-Capable Operation
//
// Caches the OrgCheckin.html shell + its static dependencies so the staff
// dashboard loads from cold even with zero connectivity, provided the
// page has been visited at least once. This is Window A of §16.8 in the
// implementation phasing — Tier 1 only. Write-queue (Tier 2), cached org
// snapshot (Tier 3), and multi-device mesh (Tier 4) are forward work.

// v5.7.1e — Bumped to v2 so the new SW activates and purges the v1 cache
// that was serving stale v5.7.1b OrgCheckin.html. Going forward, bump
// this any time HTML/JS changes need to be guaranteed-fresh on phones.
// Also: switched HTML strategy to network-first below so this manual
// bump is the *backstop*, not the only path to a fresh shell.
// v5.11.20a — Captain's checkout-text smoke caught the cel-text-overlay
// hardcoding " — checked in" regardless of action. Fix at L7635 reads the
// runtime action (stored on stage._v511Action by v511EnsureRuntimeStage at
// L8424 from opts.action) and pluralises "checked in" / "checked out"
// correctly. Bumped from v59 to v60.
const CACHE_VERSION = 'irlid-shell-v181'; // v6.5.1 NONCE DDL HOT-PATH GATE. PRIOR v180: v6.5.0 ROTATING VENUE CHECK-IN NONCE. PRIOR v179: v6.4.26 DEMO-READINESS FIXES (manual hardware findings 6 Jul): (2) date locale — displayLocale() always en-GB + all no-locale toLocale* calls pinned to en-GB across receipt/check/account/widget/scan/Org (no more US MM/DD on en-US-default phones); (3) tablet fullscreen — removed vestigial @media(max-width:1180px) .qr-info{display:none} that hid the Fullscreen button on every tablet/phone + added touch two-tap handler + touch-action:manipulation + webkitRequestFullscreen fallback; (4) receipts — org check-ins now merge+date-sort with 1-to-1 P2P receipts instead of a pinned block above them. (#1 check-in replay flaw = separate, awaiting design decision.) PRIOR v178: v6.4.25 PRE-HN-LAUNCH SCRUB (cont.): meta CSP (object-src/base-uri) + referrer-policy (strict-origin-when-cross-origin) now swept to ALL 23 HTML pages (was 9/23) — uniform coverage so a curl|grep-CSP-across-pages sweep comes back clean. PRIOR v177 same release: meta CSP added to receipt.html + scan.html (the two attacker-influenced-data pages the v6.4.24 sweep missed); /.well-known/security.txt published; Org.html mockup roster names de-personalised (family names -> fictional); seed/first-org.sql example api_key replaced with an obvious placeholder. PRIOR v176: v6.4.24 PRE-HN-LAUNCH SECURITY HARDENING: scanner open-redirect guards (scan.html same-origin on ORG_ENTRY/ORG_LOGIN); org-entry redirect scheme-guard (blocks javascript:/data:); SRI + pinned versions on all CDN scripts (html5-qrcode/jsQR/qrcodejs/iro@5.5.2); nav.js escapes display_name; orgapi.js validates IRLID_ORG_API_BASE_URL against host allowlist; widget.html drops GPS from postMessage + rel=noopener; demo-login.html validates event.origin; consumer Worker generic 500 (no exception leak) + rejects silent device reassignment (409); org Worker rate-limits /org/register + removes isDebugOrg clear-attendance bypass + rejects script/data redirect schemes; safe CSP (object-src/base-uri) on main pages; overclaim copy pass. PRIOR v175: v6.4.23 receipt identity visuals: venue logo on org receipts (receipt.html + check.html, public /org/entry-info branding) + same-device attendee avatar (renders only when this device's key fp matches the receipt's attendee fp AND viewer is signed in — public artefact, no viewer-face-on-attendee-slot; cross-device = §14.18 linkage, v6.5). PRIOR v174: v6.4.22 Dashboard Receipts collapsible lists today's minted org receipts from the existing attendance payload, with verify links and CSV export (frontend-only). PRIOR v6.4.21b check.html mirrors the receipt.html venue block (org-attested address/contact on the verifier page, text-nodes-only, asserted-not-measured labelling). PRIOR v172: v6.4.21a Org-tab Save now ALSO fires the real saveSettings() POST — it was localStorage-mockup only (T4.3.47), so v6.4.21's venue-contact fields never reached D1 and receipts minted without them. v5.5.10 rule reasserted: every visible Save saves everything. PRIOR v171 (v6.4.21) org-attested venue details on receipts: Settings gains live Contact email / Contact phone / Venue address fields (three-layer landing: v511 inputs -> saveSettings domPayload -> Worker whitelist+validation -> settings_json); receipt mint embeds payload.venue {address,email,phone} into the SIGNED payload when set (old receipts untouched); receipt.html renders "Venue address (provided by organisation)" + maps-search link when GPS absent, and venue contact under the verify hint — asserted-not-measured labelling throughout. PRIOR v170 (v6.4.20) offline-queue silent-drop fix: signed-action endpoints (create-and-bind, bind-additional-key, rebind, PATCH expected) are no longer queue-eligible in orgapi.js — their WebAuthn nonce/freshness envelopes can never replay, so queueing guaranteed a terminal 400 + silent drop (22 Jun finding); they now fail loudly at click time. offline-queue.js quarantine() dispatches irlid:queue-dropped; Org.html toasts the user "could not sync ... please redo it" instead of the drop looking like a successful sync. PRIOR v169 (v6.4.19) audit-board ROLE column fix: `.role-mini.inverted.attendee` set the letter to var(--muted) — the same colour as the inverted fill — so the "A" was invisible on every checked-IN attendee (the whole audit board showed blank role circles). Letter is now dark var(--bg), matching the other inverted roles. (v6.4.18 was a Worker-only fix — Delete-expected gate — no pill/cache bump.) PRIOR v168 (v6.4.17) dead-button sweep: disabled the 3 design-in Records & ID placeholder buttons (Connect storage / Add custom field / Open RTBF helper) to match the IN-DESIGN disabled pattern; WIRED the Sign-in & Auth sign-out buttons (this device -> signOutOrg; all devices -> IRLidOrgApi.signOutAllDevices then signOutOrg) which were previously dead. Also unified Patreon URL to patreon.com/c/IRLid (login.html + contact.html). PRIOR v167 (v6.4.16) session-expiry bounce: a lapsed login session (24h TTL) now signs out cleanly + prompts re-login (orgapi.js + liveCalendarApi dispatch irlid:session-expired on 401 session_*; Org.html handleSessionExpired + 30s heartbeat) instead of throwing session_invalid on every action. PRIOR v166 (v6.4.15) audit log: the Tools & Diagnostics "Open log" button now opens a real append-only authorization log (who authorised what, when, allowed/denied). Worker: new immutable org_audit_log table + GET /org/audit-log (lead_admin+/developer) + best-effort recordAudit hooks on signed actions (allowed + insufficient_role denials), lead-admin appoint (batched), invite create/accept/redeem, member remove, settings save. Frontend: lazily-resolved dialog reusing X-Org-Key + Bearer auth. PRIOR: v165 (v6.4.14) re-hire/re-invite on an already-enrolled device; v163 (v6.4.13) QR-off-screen-after-celebration root cause (stage logo impersonating the QR via the :scope>img fallback).

// Static shell assets — pre-cached on first install. Same-origin only.
const SHELL_ASSETS = [
  './Org.html',
  './org-action-auth.html',
  './org-entry.html',
  './receipt.html',
  './check.html',
  './js/orgapi.js',
  './js/brand-fonts.js',
  './js/offline-queue.js',
  './js/offline-snapshot.js',
  './js/qr-fullscreen.js',
  './js/sign.js',
  './js/vendor/jsqr.min.js',
  './favicon.ico',
  './manifest.json',
];

// Vendor CDN scripts — cached on first hit (cache-first), not pre-cached
// because cross-origin pre-caching can fail under CORS restrictions.
const VENDOR_CDN_PATTERNS = [
  /^https:\/\/cdnjs\.cloudflare\.com\//,
  /^https:\/\/cdn\.jsdelivr\.net\//,
];

// Worker API origin — NEVER serve cached responses for this domain.
// Staff actions must always reach the live Worker (or fail clean for
// the Tier 2 write-queue to handle when it lands).
const WORKER_API_ORIGIN = 'https://irlid-api-org.irlid-bunhead.workers.dev';

self.addEventListener('install', (event) => {
  // Pre-cache the shell on first install. skipWaiting activates the new
  // SW immediately rather than waiting for all tabs to close.
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        // Pre-cache failure is non-fatal — the SW will still serve any
        // assets it can fetch on demand later.
        console.warn('[sw] pre-cache failed:', err);
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  // Purge any old cache versions so we don't accumulate stale shells.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('irlid-shell-') && k !== CACHE_VERSION)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // v5.9 - Live deployment shares origin with consumer pages (index.html,
  // scan.html, receipt.html, etc.). The SW must only intercept dashboard-
  // surface URLs; everything else passes through to the network normally.
  // This prevents the SW from catching consumer page navigations.
  const DASHBOARD_PATHS = /^\/(Org\.html|org-action-auth\.html|org-entry\.html|receipt\.html|check\.html|js\/(orgapi|offline-queue|offline-snapshot|qr-fullscreen|sign|brand-fonts|vendor\/jsqr\.min)\.js|manifest\.json|sw\.js)/;
  if (url.origin === self.location.origin && !DASHBOARD_PATHS.test(url.pathname)) {
    return; // pass through; no caching, no shell fallback
  }

  // Worker API: pass through, never cache. (Tier 2 will queue these
  // when offline and replay on reconnect.)
  if (url.origin === WORKER_API_ORIGIN) return;

  // Non-GETs: pass through. (POSTs for settings save etc. bypass cache.)
  if (req.method !== 'GET') return;

  // Same-origin requests:
  // v5.7.1e — HTML / navigation requests use NETWORK-FIRST so updates
  // propagate the moment the user reloads. Asset requests (.js, .css,
  // .png, .ico, .json) use cache-first for speed. Hard offline still
  // serves cached shell for navigation. This avoids the v5.7.1a-era
  // "stuck on stale shell" trap where Captain's phone was serving a
  // cached v5.7.1b OrgCheckin.html days after v5.7.1c+ deploys.
  if (url.origin === self.location.origin) {
    const isHtmlOrNav = req.mode === 'navigate' || /\.html(\?|$)/.test(url.pathname) || url.pathname.endsWith('/');
    if (isHtmlOrNav) {
      // Network-first
      event.respondWith(
        fetch(req)
          .then((response) => {
            if (response && response.ok && response.type === 'basic') {
              const responseClone = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(req, responseClone));
            }
            return response;
          })
          .catch(() => {
            // Network failed (offline). Serve cached shell.
            return caches.match(req).then((cached) => cached || caches.match('./Org.html'));
          })
      );
      return;
    }
    // Static assets: cache-first.
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((response) => {
            if (response && response.ok && response.type === 'basic') {
              const responseClone = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(req, responseClone));
            }
            return response;
          })
          .catch(() => { throw new Error('offline'); });
      })
    );
    return;
  }

  // Vendor CDN scripts (qrcodejs, html5-qrcode, iro.js): cache-first.
  if (VENDOR_CDN_PATTERNS.some((p) => p.test(req.url))) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((response) => {
          if (response && response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, responseClone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Anything else cross-origin: pass through normally.
});
