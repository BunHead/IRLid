# Changelog

Release history of the dashboard shell, newest first. It used to live in one very long comment on the `CACHE_VERSION` line in `sw.js`. Copied here unchanged on 10 Nov 2026 (review 5.3) so it can be read on a phone. Each entry starts with its service-worker cache version where the original had one.

## irlid-shell-v205

v6.8.14 TWO-ORG BLEED FIX: a person added from a staff scan could land in the wrong organisation. The dashboard added to whichever organisation that browser was in and ignored the organisation named in the scanned QR; after sign-out and a same-device sign-in it opened the first organisation in the list without asking (the oldest of every organisation, for a Developer); and the Worker let one sign-in write to any organisation the user could reach. Now: sign-out and switching organisation clear every saved setting, person, theme and Organisation-tab field of the last organisation; a reloaded page opens the organisation the server has on record for that sign-in, or asks, and never guesses; a scan whose QR names another organisation is refused with both names shown; the add-person dialog shows the organisation name; a theme that cannot load falls back to the plain look, not the last organisation's; each sign-in is tied to one organisation on the Worker (POST /user/session/org) and calls for any other are refused (403 session_org_mismatch), switching organisation gets a new session token so queued check-ins still reach the organisation they were made for; add / link at the door is refused if the scanned QR names a different organisation (409 scan_org_mismatch).

## irlid-shell-v203

v6.8.13 FIRST-SCAN HOLD (option C, Spencer 9 Nov 2026): a phone the org has never seen signs a hold on the live code as soon as it shows the orange 'Get a member of staff' screen; after staff approve it, its check-in is fresh if signed by the same key within 10 minutes (single use). The held code reads as used so the screen moves on; a phone scanning the same frame still gets its own fresh check-in. Late, queued or offline check-ins still land as offline / unverified.

## irlid-shell-v202

v6.8.12 KIOSK OFFLINE CODES HARDENED: a screen gets offline unlock keys only after a Lead Admin or Developer approves that screen in person (v5 signature bound to org, screen id, the screen's secret, a single-use nonce and a 30-day expiry); keys stop working after 72 h offline and are dropped on revoke, sign-out, role loss or lock off; Settings lists approved screens with Revoke; offline unlock audit rows are honestly kiosk-reported (no actor) and say whether the code matched; the unlock log never drops a real unlock (lock-outs past 100 are counted) and syncs in batches; the service worker keeps the old offline copy if an update can't be cached in full; kiosk-code.html shows whether the phone is ready offline.

## irlid-shell-v201

v6.8.11 KIOSK AUDIT ONCE: an offline unlock showed twice in the audit log. The kiosk now syncs its offline-unlock log one sync at a time, the Worker writes each entry with one atomic insert-if-new, and the kiosk checks one code at a time per challenge (a double submit could check the same challenge twice).

## irlid-shell-v200

v6.8.10 KIOSK CONTROLS ON SCREEN: the full screen stage CSS made every child position:relative, so the padlock, refresh button and online dot sat under the QR and the unlock panel was laid out inside the stage with its offline-code button cut off the bottom (a tap did nothing). They now sit at the top right (dot, refresh, padlock) and the unlock panel covers the screen. With no internet the padlock goes straight to the offline code (a Staff phone scan button tries the scan); Stay locked re-enters full screen. Org.html loads kiosk-lock.js?v=6.8.10.

## irlid-shell-v199

v6.8.9 DEVELOPER REACHES EVERY SETTING (rule A1): settings that sat in Org.html's hidden legacy settings shell (display:none), unreachable for every role, now live in visible Settings tabs: Kiosk mode, Lock full screen, Require live screen code and a new Check-in rules block (minimum trust score, privacy mode, anonymous mode, return allowed, let attendees pick their name, say staff will confirm) in 5. Sign-in & Auth; Website and Org terms in 1. Organisation are now the real server fields (were a localStorage-only copy). Settings that do nothing yet (Device unlock required, Check-out required, Website theme import) are shown in 6. Tools & Diagnostics labelled 'not active yet', with the outcome-page test tools, Org code and Event code under Test tools. Kiosk texts say Lead Admin or Developer. Tests prove a Developer session can change every Lead Admin setting and is audited.

## irlid-shell-v198

v6.8.8 OFFLINE SCAN PAGE: org-entry.html now registers this service worker (it never did, so a phone that had only ever scanned had nothing cached and showed a blank page with data off); offline navigation and assets match the cached copy whatever the query string (?type=checkin&org=..&n=.., sign.js?v=3.1) and extensionless URLs (/Org, /org-entry); the QR library is pre-cached for the doorman QR.

## irlid-shell-v197

v6.8.7 LOGIN STALE-CACHE FIX: the QR login said 'This page did not start this login' within seconds because the service worker served an old cached js/orgapi.js (cache-first) that dropped the poll secret. Org.html now polls through js/login-poll.js; the SW pre-caches with cache:'reload' (never copies a stale HTTP-cached file into a new cache) and serves same-origin JS network-first, falling back to the cache offline.

## irlid-shell-v196

v6.8.6 KIOSK MODE + LOCK + OFFLINE UNLOCK CODE (PR D, opt-in): org setting "Kiosk mode" opens Check-in straight into the locked full screen; "Lock full screen" shows a padlock + refresh-QR button and needs a staff v5 scan to leave full screen, with an online dot; with no internet a Lead Admin/Developer phone makes a one-time 8-digit code; kiosk-code.html and kiosk-lock.js served from the offline shell; kiosk-code.html reloads when a second kiosk QR is scanned in the same tab.

## irlid-shell-v195

v6.8.5 QR LOGIN RECOVERY (PR B): the computer showing the login QR now finishes the login even if a reply is lost (the Worker hands the session back to that page's poll secret for 2 min, max 3 times, each time with a new token); the poll secret is never in the QR, so the phone or a photo of the QR can no longer collect the session (the phone used to, which made the computer say 'QR expired'); polls back off on a flaky network; clear states waiting / signed on phone / logging in / failed (new js/login-poll.js).

## irlid-shell-v194

v6.8.4 NO ORG KEY IN THE BROWSER (PR A): the Org portal signs in only by a v5 QR scan; the service-account key login, 'Continue with this organisation', DEV auto-login and ?orgKey= URL sign-in are removed; /user/orgs and create-org no longer return the api_key, dashboard calls use the login session (Bearer + X-Org-Id, staff-tier role); Sign out ends the session on the server (/user/logout) and wipes the saved session and org.

## irlid-shell-v193

v6.8.3 FULL SCREEN QR FOLLOWS ROTATION: Org.html redraws the full screen kiosk QR on every new live code (it was drawn once on open, so after the first scan or 90 s every scan landed as offline / unverified while online); backup-QR badge shows in full screen.

## irlid-shell-v192

v6.8.2 REQUIRE LIVE SCREEN CODE (S12, opt-in): Org Settings toggle; when on, a photographed / stale / code-less check-in is held for staff review and not counted; org-entry says 'Scan the live screen'.

## irlid-shell-v191

v6.8.1 SETUP CLARITY (PR #154): settings.html merges the two hardware panels into one Hardware-Backed Signing panel; sign.js shows the real passkey error on Bind/Add instead of 'Hardware-backed signing required'; offline queue retries by itself (15 s up to 5 min) when a sync halts while online (from #147).

## irlid-shell-v189

v6.8.0 PUSH UPDATES: the Org dashboard gets check-in / QR-rotation / expected / calendar changes pushed over a WebSocket from a per-org Cloudflare Durable Object (new js/orghub-client.js), instead of polling every 2 s / 4 s; if the socket is down it falls back to a 15 s visible-tab poll and reconnects with backoff; offline check-in and the backup QR are unchanged; push has a kill switch (PUSH_UPDATES_ENABLED / localStorage irlid_push_updates=off) and the Worker no longer accepts the org key in a URL (?key=).

## irlid-shell-v188

v6.7.2 DELETE-RECORD NEVER QUEUED: Delete record / Clear attendance are no longer offline-queueable (S10); a queued one from an older page is removed unsent with a 'redo it' notice; page only says Deleted when the Worker confirms; cached-snapshot fallback logs the real reason.

## irlid-shell-v187

v6.7.1 CHECK-IN HARDENING: org-entry shows "checked in" only when the server returns a check-in id or the check-in is really queued offline (anything else gets the normal failed message); Worker never lets an unsigned check-in's unsigned time route it to quarantine, so an old page with a slow clock is refused, not shown a false success; quarantine capped per org per day; offline replays of one visit not double-counted; phone/server clock gaps flagged; signing cutoff 2 Nov 2026 (no grace).

## irlid-shell-v186

v6.7.0 SIGNED CHECK-IN (rules v3.1): the phone signs its check-in hello with its device key and the Worker always verifies it (bad signature = refused live, quarantined with a notice when queued); only a live unused code makes a check-in fresh, and a missing / stale / used code (static QR, crowd mode too) is accepted as offline / unverified, never refused; a live code outside event times is refused unless staff-tier with a signed staff session (flagged); unsigned check-ins from old cached pages land as offline until a server cutoff; no GPS hash kept; second scan offers check-out.

## irlid-shell-v185

v6.7.0 first cut.

## irlid-shell-v184

v6.6.1 SIMPLIFY (merged after venue GPS): removed placeholder settings (additional proof, proof recording, ID photo capture), requireFreshCheckin and unused Org.html helpers.

## irlid-shell-v183

v6.6.0 VENUE GPS: Org Settings 'Find on map' (Nominatim + Leaflet, draggable pin, manual lat/lon, radius); receipts carry payload.venue.lat/lon; org-entry sends best-effort phone GPS (4 s, optional); server flags near / far / no phone GPS (band only, never refuses); shown on dashboard, receipt.html and check.html.

## irlid-shell-v182

v6.5.2 OFFLINE-FIRST CHECK-IN: venue QR rotates right after each scan (2 s used-nonce poll, 45 s refresh kept); laptop offline falls back to the static backup QR; live-QR scans during an outage queue as offline check-ins; nonce-less check-ins always accepted and labelled offline / unverified on receipts, dashboard and check.html.

## irlid-shell-v181

v6.5.1 NONCE DDL HOT-PATH GATE.

## irlid-shell-v180

v6.5.0 ROTATING VENUE CHECK-IN NONCE.

## irlid-shell-v179

v6.4.26 DEMO-READINESS FIXES (manual hardware findings 6 Jul): (2) date locale — displayLocale() always en-GB + all no-locale toLocale* calls pinned to en-GB across receipt/check/account/widget/scan/Org (no more US MM/DD on en-US-default phones); (3) tablet fullscreen — removed vestigial @media(max-width:1180px) .qr-info{display:none} that hid the Fullscreen button on every tablet/phone + added touch two-tap handler + touch-action:manipulation + webkitRequestFullscreen fallback; (4) receipts — org check-ins now merge+date-sort with 1-to-1 P2P receipts instead of a pinned block above them. (#1 check-in replay flaw = separate, awaiting design decision.)

## irlid-shell-v178

v6.4.25 PRE-HN-LAUNCH SCRUB (cont.): meta CSP (object-src/base-uri) + referrer-policy (strict-origin-when-cross-origin) now swept to ALL 23 HTML pages (was 9/23) — uniform coverage so a curl|grep-CSP-across-pages sweep comes back clean.

## (entry without its own cache number)

v177 same release: meta CSP added to receipt.html + scan.html (the two attacker-influenced-data pages the v6.4.24 sweep missed); /.well-known/security.txt published; Org.html mockup roster names de-personalised (family names -> fictional); seed/first-org.sql example api_key replaced with an obvious placeholder.

## irlid-shell-v176

v6.4.24 PRE-HN-LAUNCH SECURITY HARDENING: scanner open-redirect guards (scan.html same-origin on ORG_ENTRY/ORG_LOGIN); org-entry redirect scheme-guard (blocks javascript:/data:); SRI + pinned versions on all CDN scripts (html5-qrcode/jsQR/qrcodejs/iro@5.5.2); nav.js escapes display_name; orgapi.js validates IRLID_ORG_API_BASE_URL against host allowlist; widget.html drops GPS from postMessage + rel=noopener; demo-login.html validates event.origin; consumer Worker generic 500 (no exception leak) + rejects silent device reassignment (409); org Worker rate-limits /org/register + removes isDebugOrg clear-attendance bypass + rejects script/data redirect schemes; safe CSP (object-src/base-uri) on main pages; overclaim copy pass.

## irlid-shell-v175

v6.4.23 receipt identity visuals: venue logo on org receipts (receipt.html + check.html, public /org/entry-info branding) + same-device attendee avatar (renders only when this device's key fp matches the receipt's attendee fp AND viewer is signed in — public artefact, no viewer-face-on-attendee-slot; cross-device = §14.18 linkage, v6.5).

## irlid-shell-v174

v6.4.22 Dashboard Receipts collapsible lists today's minted org receipts from the existing attendance payload, with verify links and CSV export (frontend-only).

## (entry without its own cache number)

v6.4.21b check.html mirrors the receipt.html venue block (org-attested address/contact on the verifier page, text-nodes-only, asserted-not-measured labelling).

## irlid-shell-v172

v6.4.21a Org-tab Save now ALSO fires the real saveSettings() POST — it was localStorage-mockup only (T4.3.47), so v6.4.21's venue-contact fields never reached D1 and receipts minted without them. v5.5.10 rule reasserted: every visible Save saves everything.

## (entry without its own cache number)

v171 (v6.4.21) org-attested venue details on receipts: Settings gains live Contact email / Contact phone / Venue address fields (three-layer landing: v511 inputs -> saveSettings domPayload -> Worker whitelist+validation -> settings_json); receipt mint embeds payload.venue {address,email,phone} into the SIGNED payload when set (old receipts untouched); receipt.html renders "Venue address (provided by organisation)" + maps-search link when GPS absent, and venue contact under the verify hint — asserted-not-measured labelling throughout.

## (entry without its own cache number)

v170 (v6.4.20) offline-queue silent-drop fix: signed-action endpoints (create-and-bind, bind-additional-key, rebind, PATCH expected) are no longer queue-eligible in orgapi.js — their WebAuthn nonce/freshness envelopes can never replay, so queueing guaranteed a terminal 400 + silent drop (22 Jun finding); they now fail loudly at click time. offline-queue.js quarantine() dispatches irlid:queue-dropped; Org.html toasts the user "could not sync ... please redo it" instead of the drop looking like a successful sync.

## (entry without its own cache number)

v169 (v6.4.19) audit-board ROLE column fix: `.role-mini.inverted.attendee` set the letter to var(--muted) — the same colour as the inverted fill — so the "A" was invisible on every checked-IN attendee (the whole audit board showed blank role circles). Letter is now dark var(--bg), matching the other inverted roles. (v6.4.18 was a Worker-only fix — Delete-expected gate — no pill/cache bump.)

## (entry without its own cache number)

v168 (v6.4.17) dead-button sweep: disabled the 3 design-in Records & ID placeholder buttons (Connect storage / Add custom field / Open RTBF helper) to match the IN-DESIGN disabled pattern; WIRED the Sign-in & Auth sign-out buttons (this device -> signOutOrg; all devices -> IRLidOrgApi.signOutAllDevices then signOutOrg) which were previously dead. Also unified Patreon URL to patreon.com/c/IRLid (login.html + contact.html).

## (entry without its own cache number)

v167 (v6.4.16) session-expiry bounce: a lapsed login session (24h TTL) now signs out cleanly + prompts re-login (orgapi.js + liveCalendarApi dispatch irlid:session-expired on 401 session_*; Org.html handleSessionExpired + 30s heartbeat) instead of throwing session_invalid on every action.

## (entry without its own cache number)

v166 (v6.4.15) audit log: the Tools & Diagnostics "Open log" button now opens a real append-only authorization log (who authorised what, when, allowed/denied). Worker: new immutable org_audit_log table + GET /org/audit-log (lead_admin+/developer) + best-effort recordAudit hooks on signed actions (allowed + insufficient_role denials), lead-admin appoint (batched), invite create/accept/redeem, member remove, settings save. Frontend: lazily-resolved dialog reusing X-Org-Key + Bearer auth.

## (entry without its own cache number)

v165 (v6.4.14) re-hire/re-invite on an already-enrolled device; v163 (v6.4.13) QR-off-screen-after-celebration root cause (stage logo impersonating the QR via the :scope>img fallback).
