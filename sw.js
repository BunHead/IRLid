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
const CACHE_VERSION = 'irlid-shell-v204'; // v6.8.13 CSS EXTRACT (review 4.1, PR #178): Org.html's main stylesheet moved unchanged into css/org.css, which is pre-cached and served network-first like the scripts. No app version change. PRIOR v203: v6.8.13 FIRST-SCAN HOLD (option C, Spencer 9 Nov 2026): a phone the org has never seen signs a hold on the live code as soon as it shows the orange 'Get a member of staff' screen; after staff approve it, its check-in is fresh if signed by the same key within 10 minutes (single use). The held code reads as used so the screen moves on; a phone scanning the same frame still gets its own fresh check-in. Late, queued or offline check-ins still land as offline / unverified. PRIOR v202: v6.8.12 KIOSK OFFLINE CODES HARDENED: a screen gets offline unlock keys only after a Lead Admin or Developer approves that screen in person (v5 signature bound to org, screen id, the screen's secret, a single-use nonce and a 30-day expiry); keys stop working after 72 h offline and are dropped on revoke, sign-out, role loss or lock off; Settings lists approved screens with Revoke; offline unlock audit rows are honestly kiosk-reported (no actor) and say whether the code matched; the unlock log never drops a real unlock (lock-outs past 100 are counted) and syncs in batches; the service worker keeps the old offline copy if an update can't be cached in full; kiosk-code.html shows whether the phone is ready offline. PRIOR v201: v6.8.11 KIOSK AUDIT ONCE: an offline unlock showed twice in the audit log. The kiosk now syncs its offline-unlock log one sync at a time, the Worker writes each entry with one atomic insert-if-new, and the kiosk checks one code at a time per challenge (a double submit could check the same challenge twice). PRIOR v200: v6.8.10 KIOSK CONTROLS ON SCREEN: the full screen stage CSS made every child position:relative, so the padlock, refresh button and online dot sat under the QR and the unlock panel was laid out inside the stage with its offline-code button cut off the bottom (a tap did nothing). They now sit at the top right (dot, refresh, padlock) and the unlock panel covers the screen. With no internet the padlock goes straight to the offline code (a Staff phone scan button tries the scan); Stay locked re-enters full screen. Org.html loads kiosk-lock.js?v=6.8.10. PRIOR v199: v6.8.9 DEVELOPER REACHES EVERY SETTING (rule A1): settings that sat in Org.html's hidden legacy settings shell (display:none), unreachable for every role, now live in visible Settings tabs: Kiosk mode, Lock full screen, Require live screen code and a new Check-in rules block (minimum trust score, privacy mode, anonymous mode, return allowed, let attendees pick their name, say staff will confirm) in 5. Sign-in & Auth; Website and Org terms in 1. Organisation are now the real server fields (were a localStorage-only copy). Settings that do nothing yet (Device unlock required, Check-out required, Website theme import) are shown in 6. Tools & Diagnostics labelled 'not active yet', with the outcome-page test tools, Org code and Event code under Test tools. Kiosk texts say Lead Admin or Developer. Tests prove a Developer session can change every Lead Admin setting and is audited. PRIOR v198: v6.8.8 OFFLINE SCAN PAGE: org-entry.html now registers this service worker (it never did, so a phone that had only ever scanned had nothing cached and showed a blank page with data off); offline navigation and assets match the cached copy whatever the query string (?type=checkin&org=..&n=.., sign.js?v=3.1) and extensionless URLs (/Org, /org-entry); the QR library is pre-cached for the doorman QR. PRIOR v197: v6.8.7 LOGIN STALE-CACHE FIX: the QR login said 'This page did not start this login' within seconds because the service worker served an old cached js/orgapi.js (cache-first) that dropped the poll secret. Org.html now polls through js/login-poll.js; the SW pre-caches with cache:'reload' (never copies a stale HTTP-cached file into a new cache) and serves same-origin JS network-first, falling back to the cache offline. PRIOR v196: v6.8.6 KIOSK MODE + LOCK + OFFLINE UNLOCK CODE (PR D, opt-in): org setting "Kiosk mode" opens Check-in straight into the locked full screen; "Lock full screen" shows a padlock + refresh-QR button and needs a staff v5 scan to leave full screen, with an online dot; with no internet a Lead Admin/Developer phone makes a one-time 8-digit code; kiosk-code.html and kiosk-lock.js served from the offline shell; kiosk-code.html reloads when a second kiosk QR is scanned in the same tab. PRIOR v195: v6.8.5 QR LOGIN RECOVERY (PR B): the computer showing the login QR now finishes the login even if a reply is lost (the Worker hands the session back to that page's poll secret for 2 min, max 3 times, each time with a new token); the poll secret is never in the QR, so the phone or a photo of the QR can no longer collect the session (the phone used to, which made the computer say 'QR expired'); polls back off on a flaky network; clear states waiting / signed on phone / logging in / failed (new js/login-poll.js). PRIOR v194: v6.8.4 NO ORG KEY IN THE BROWSER (PR A): the Org portal signs in only by a v5 QR scan; the service-account key login, 'Continue with this organisation', DEV auto-login and ?orgKey= URL sign-in are removed; /user/orgs and create-org no longer return the api_key, dashboard calls use the login session (Bearer + X-Org-Id, staff-tier role); Sign out ends the session on the server (/user/logout) and wipes the saved session and org. PRIOR v193: v6.8.3 FULL SCREEN QR FOLLOWS ROTATION: Org.html redraws the full screen kiosk QR on every new live code (it was drawn once on open, so after the first scan or 90 s every scan landed as offline / unverified while online); backup-QR badge shows in full screen. PRIOR v192: v6.8.2 REQUIRE LIVE SCREEN CODE (S12, opt-in): Org Settings toggle; when on, a photographed / stale / code-less check-in is held for staff review and not counted; org-entry says 'Scan the live screen'. PRIOR v191: v6.8.1 SETUP CLARITY (PR #154): settings.html merges the two hardware panels into one Hardware-Backed Signing panel; sign.js shows the real passkey error on Bind/Add instead of 'Hardware-backed signing required'; offline queue retries by itself (15 s up to 5 min) when a sync halts while online (from #147). PRIOR v189: v6.8.0 PUSH UPDATES: the Org dashboard gets check-in / QR-rotation / expected / calendar changes pushed over a WebSocket from a per-org Cloudflare Durable Object (new js/orghub-client.js), instead of polling every 2 s / 4 s; if the socket is down it falls back to a 15 s visible-tab poll and reconnects with backoff; offline check-in and the backup QR are unchanged; push has a kill switch (PUSH_UPDATES_ENABLED / localStorage irlid_push_updates=off) and the Worker no longer accepts the org key in a URL (?key=). PRIOR v188: v6.7.2 DELETE-RECORD NEVER QUEUED: Delete record / Clear attendance are no longer offline-queueable (S10); a queued one from an older page is removed unsent with a 'redo it' notice; page only says Deleted when the Worker confirms; cached-snapshot fallback logs the real reason. PRIOR v187: v6.7.1 CHECK-IN HARDENING: org-entry shows "checked in" only when the server returns a check-in id or the check-in is really queued offline (anything else gets the normal failed message); Worker never lets an unsigned check-in's unsigned time route it to quarantine, so an old page with a slow clock is refused, not shown a false success; quarantine capped per org per day; offline replays of one visit not double-counted; phone/server clock gaps flagged; signing cutoff 2 Nov 2026 (no grace). PRIOR v186: v6.7.0 SIGNED CHECK-IN (rules v3.1): the phone signs its check-in hello with its device key and the Worker always verifies it (bad signature = refused live, quarantined with a notice when queued); only a live unused code makes a check-in fresh, and a missing / stale / used code (static QR, crowd mode too) is accepted as offline / unverified, never refused; a live code outside event times is refused unless staff-tier with a signed staff session (flagged); unsigned check-ins from old cached pages land as offline until a server cutoff; no GPS hash kept; second scan offers check-out. PRIOR v185: v6.7.0 first cut. PRIOR v184: v6.6.1 SIMPLIFY (merged after venue GPS): removed placeholder settings (additional proof, proof recording, ID photo capture), requireFreshCheckin and unused Org.html helpers. PRIOR v183: v6.6.0 VENUE GPS: Org Settings 'Find on map' (Nominatim + Leaflet, draggable pin, manual lat/lon, radius); receipts carry payload.venue.lat/lon; org-entry sends best-effort phone GPS (4 s, optional); server flags near / far / no phone GPS (band only, never refuses); shown on dashboard, receipt.html and check.html. PRIOR v182: v6.5.2 OFFLINE-FIRST CHECK-IN: venue QR rotates right after each scan (2 s used-nonce poll, 45 s refresh kept); laptop offline falls back to the static backup QR; live-QR scans during an outage queue as offline check-ins; nonce-less check-ins always accepted and labelled offline / unverified on receipts, dashboard and check.html. PRIOR v181: v6.5.1 NONCE DDL HOT-PATH GATE. PRIOR v180: v6.5.0 ROTATING VENUE CHECK-IN NONCE. PRIOR v179: v6.4.26 DEMO-READINESS FIXES (manual hardware findings 6 Jul): (2) date locale — displayLocale() always en-GB + all no-locale toLocale* calls pinned to en-GB across receipt/check/account/widget/scan/Org (no more US MM/DD on en-US-default phones); (3) tablet fullscreen — removed vestigial @media(max-width:1180px) .qr-info{display:none} that hid the Fullscreen button on every tablet/phone + added touch two-tap handler + touch-action:manipulation + webkitRequestFullscreen fallback; (4) receipts — org check-ins now merge+date-sort with 1-to-1 P2P receipts instead of a pinned block above them. (#1 check-in replay flaw = separate, awaiting design decision.) PRIOR v178: v6.4.25 PRE-HN-LAUNCH SCRUB (cont.): meta CSP (object-src/base-uri) + referrer-policy (strict-origin-when-cross-origin) now swept to ALL 23 HTML pages (was 9/23) — uniform coverage so a curl|grep-CSP-across-pages sweep comes back clean. PRIOR v177 same release: meta CSP added to receipt.html + scan.html (the two attacker-influenced-data pages the v6.4.24 sweep missed); /.well-known/security.txt published; Org.html mockup roster names de-personalised (family names -> fictional); seed/first-org.sql example api_key replaced with an obvious placeholder. PRIOR v176: v6.4.24 PRE-HN-LAUNCH SECURITY HARDENING: scanner open-redirect guards (scan.html same-origin on ORG_ENTRY/ORG_LOGIN); org-entry redirect scheme-guard (blocks javascript:/data:); SRI + pinned versions on all CDN scripts (html5-qrcode/jsQR/qrcodejs/iro@5.5.2); nav.js escapes display_name; orgapi.js validates IRLID_ORG_API_BASE_URL against host allowlist; widget.html drops GPS from postMessage + rel=noopener; demo-login.html validates event.origin; consumer Worker generic 500 (no exception leak) + rejects silent device reassignment (409); org Worker rate-limits /org/register + removes isDebugOrg clear-attendance bypass + rejects script/data redirect schemes; safe CSP (object-src/base-uri) on main pages; overclaim copy pass. PRIOR v175: v6.4.23 receipt identity visuals: venue logo on org receipts (receipt.html + check.html, public /org/entry-info branding) + same-device attendee avatar (renders only when this device's key fp matches the receipt's attendee fp AND viewer is signed in — public artefact, no viewer-face-on-attendee-slot; cross-device = §14.18 linkage, v6.5). PRIOR v174: v6.4.22 Dashboard Receipts collapsible lists today's minted org receipts from the existing attendance payload, with verify links and CSV export (frontend-only). PRIOR v6.4.21b check.html mirrors the receipt.html venue block (org-attested address/contact on the verifier page, text-nodes-only, asserted-not-measured labelling). PRIOR v172: v6.4.21a Org-tab Save now ALSO fires the real saveSettings() POST — it was localStorage-mockup only (T4.3.47), so v6.4.21's venue-contact fields never reached D1 and receipts minted without them. v5.5.10 rule reasserted: every visible Save saves everything. PRIOR v171 (v6.4.21) org-attested venue details on receipts: Settings gains live Contact email / Contact phone / Venue address fields (three-layer landing: v511 inputs -> saveSettings domPayload -> Worker whitelist+validation -> settings_json); receipt mint embeds payload.venue {address,email,phone} into the SIGNED payload when set (old receipts untouched); receipt.html renders "Venue address (provided by organisation)" + maps-search link when GPS absent, and venue contact under the verify hint — asserted-not-measured labelling throughout. PRIOR v170 (v6.4.20) offline-queue silent-drop fix: signed-action endpoints (create-and-bind, bind-additional-key, rebind, PATCH expected) are no longer queue-eligible in orgapi.js — their WebAuthn nonce/freshness envelopes can never replay, so queueing guaranteed a terminal 400 + silent drop (22 Jun finding); they now fail loudly at click time. offline-queue.js quarantine() dispatches irlid:queue-dropped; Org.html toasts the user "could not sync ... please redo it" instead of the drop looking like a successful sync. PRIOR v169 (v6.4.19) audit-board ROLE column fix: `.role-mini.inverted.attendee` set the letter to var(--muted) — the same colour as the inverted fill — so the "A" was invisible on every checked-IN attendee (the whole audit board showed blank role circles). Letter is now dark var(--bg), matching the other inverted roles. (v6.4.18 was a Worker-only fix — Delete-expected gate — no pill/cache bump.) PRIOR v168 (v6.4.17) dead-button sweep: disabled the 3 design-in Records & ID placeholder buttons (Connect storage / Add custom field / Open RTBF helper) to match the IN-DESIGN disabled pattern; WIRED the Sign-in & Auth sign-out buttons (this device -> signOutOrg; all devices -> IRLidOrgApi.signOutAllDevices then signOutOrg) which were previously dead. Also unified Patreon URL to patreon.com/c/IRLid (login.html + contact.html). PRIOR v167 (v6.4.16) session-expiry bounce: a lapsed login session (24h TTL) now signs out cleanly + prompts re-login (orgapi.js + liveCalendarApi dispatch irlid:session-expired on 401 session_*; Org.html handleSessionExpired + 30s heartbeat) instead of throwing session_invalid on every action. PRIOR v166 (v6.4.15) audit log: the Tools & Diagnostics "Open log" button now opens a real append-only authorization log (who authorised what, when, allowed/denied). Worker: new immutable org_audit_log table + GET /org/audit-log (lead_admin+/developer) + best-effort recordAudit hooks on signed actions (allowed + insufficient_role denials), lead-admin appoint (batched), invite create/accept/redeem, member remove, settings save. Frontend: lazily-resolved dialog reusing X-Org-Key + Bearer auth. PRIOR: v165 (v6.4.14) re-hire/re-invite on an already-enrolled device; v163 (v6.4.13) QR-off-screen-after-celebration root cause (stage logo impersonating the QR via the :scope>img fallback).

// Static shell assets — pre-cached on first install. Same-origin only.
const SHELL_ASSETS = [
  './Org.html',
  './css/org.css',
  './org-action-auth.html',
  './org-entry.html',
  './receipt.html',
  './check.html',
  './js/orgapi.js',
  './js/orghub-client.js',
  './js/login-poll.js',
  './js/brand-fonts.js',
  './js/offline-queue.js',
  './js/offline-snapshot.js',
  './js/qr-fullscreen.js',
  './js/kiosk-lock.js',
  './kiosk-code.html',
  './js/sign.js',
  './js/vendor/jsqr.min.js',
  './favicon.ico',
  './manifest.json',
];

// Vendor CDN scripts — cached on first hit (cache-first), not pre-cached
// because cross-origin pre-caching can fail under CORS restrictions.
// v6.8.7 - pre-cached best-effort (a failure never stops install) so the
// phone's doorman QR draws offline on the first offline visit too.
const VENDOR_PRECACHE = [
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
];
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
  // v6.8.12 - if the shell can't be cached in full and an older version is
  // installed, the install FAILS, so the old service worker and its complete
  // cache stay in charge (the browser tries the update again on a later
  // visit). Before, a failed pre-cache
  // still activated the new worker, whose activate step then deleted the old
  // cache: a phone that lost signal mid-update could be left with no offline
  // copy of kiosk-code.html or org-entry.html at all.
  event.waitUntil(
    caches.open(CACHE_VERSION)
      // v6.8.7 — cache:'reload' so a new cache never stores a stale copy
      // from the browser's HTTP cache (that is how an old orgapi.js survived
      // a cache-version bump and broke QR login on 7 Nov).
      .then((cache) => cache.addAll(SHELL_ASSETS.map((u) => new Request(u, { cache: 'reload' }))).then(() => Promise.all(
        VENDOR_PRECACHE.map((u) => cache.add(new Request(u, { mode: 'cors' })).catch(() => {}))
      )))
      .then(() => self.skipWaiting())
      .catch((err) => caches.keys().then((keys) => {
        const older = keys.some((k) => k.startsWith('irlid-shell-') && k !== CACHE_VERSION);
        if (older) {
          // Keep the old worker and its complete offline copy.
          console.warn('[sw] pre-cache failed, keeping the current version:', err);
          return caches.delete(CACHE_VERSION).then(() => { throw err; });
        }
        // First install ever: nothing to protect, so activate and fill the
        // cache from the pages as they are visited (as before).
        console.warn('[sw] pre-cache failed on first install:', err);
        return self.skipWaiting();
      }))
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
  // v6.8.7 - pages also match without .html (/Org, /org-entry: the host
  // serves both), and every pre-cached script is listed (login-poll and
  // orghub-client were missing, so they never loaded offline).
  const DASHBOARD_PATHS = /^\/((Org|org-action-auth|org-entry|receipt|check|kiosk-code)(\.html)?$|js\/(orgapi|orghub-client|login-poll|offline-queue|offline-snapshot|qr-fullscreen|kiosk-lock|sign|brand-fonts|vendor\/jsqr\.min)\.js$|css\/org\.css$|manifest\.json$|sw\.js$)/;
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
    const isHtmlOrNav = req.mode === 'navigate' || /\.html(\?|$)/.test(url.pathname) || url.pathname.endsWith('/') || SHELL_PAGE_NO_EXT.test(url.pathname);
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
          .catch(() => cachedShellPage(url))
      );
      return;
    }
    // v6.8.7 — scripts: network-first (cache fallback offline), so a page
    // never runs fresh HTML against a stale script after a deploy. The same
    // for the dashboard stylesheet (css/org.css, review 4.1).
    if (/\.(js|css)(\?|$)/.test(url.pathname)) {
      event.respondWith(
        fetch(req, { cache: 'no-cache' })
          .then((response) => {
            if (response && response.ok && response.type === 'basic') {
              const responseClone = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(req, responseClone));
            }
            return response;
          })
          .catch(() => caches.match(req)
            // v6.8.8 - offline, sign.js?v=3.1 and friends use the cached copy
            // whatever the cache-busting query (the cache is purged on every bump).
            .then((cached) => cached || caches.match(req, { ignoreSearch: true }))
            .then((cached) => {
              if (cached) return cached;
              throw new Error('offline');
            }))
      );
      return;
    }
    // Other static assets: cache-first.
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
          .catch(() => caches.match(req, { ignoreSearch: true }).then((cached) => {
            // v6.8.7 - sign.js?v=3.1 and friends: the cached copy whatever
            // the cache-busting query (the cache is purged on every bump).
            if (cached) return cached;
            throw new Error('offline');
          }));
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

// v6.8.7 - offline navigation. A scanned venue QR opens
// org-entry.html?type=checkin&org=..&n=..; the cache holds org-entry.html with
// no query, so an exact match always missed and the phone got Org.html (or,
// with no worker, a blank page). Match the page whatever its query string, and
// map /Org and /org-entry to their .html copies. Only a page missing from the
// cache falls back to Org.html.
const SHELL_PAGE_NO_EXT = /^\/(Org|org-action-auth|org-entry|receipt|check|kiosk-code)$/;
function cachedShellPage(url) {
  const path = SHELL_PAGE_NO_EXT.test(url.pathname) ? url.pathname + '.html' : url.pathname;
  return caches.match(new URL(path, url.origin).toString(), { ignoreSearch: true })
    .then((cached) => cached || caches.match('./Org.html'));
}
