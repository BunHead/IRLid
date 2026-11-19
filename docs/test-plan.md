# IRLid test plan

15 Nov 2026. Written against main at v6.8.14 (after #192). Updated 16 Nov 2026 with Spencer's decisions on receipts (8.9). Plan only: no code, no Worker deploy, no production data.

Rules this plan serves: `docs/rules.md` (W3: every S, C, R and A rule gets a test; W4: never guess, test on a real phone), `docs/requirements/offline-first.md`, PROTOCOL.md section 16. If this file disagrees with `docs/rules.md`, the rules win and this file gets fixed (W7).

## 1. The short version

- **What we have:** about 550 automated tests (110 sign, 401 org Worker, 38 consumer Worker) plus 4 browser (Playwright) suites. They run on every push through `.github/workflows/tests.yml`. They are strong on the Worker, signing, offline queue, kiosk lock and the two-org bleed.
- **What is thin or missing:** the dashboard (`Org.html`, 20,000 lines) is tested mostly by reading its source for strings, not by using it; themes, roles-in-the-browser, the PWA update path, accessibility, the consumer Worker's receipts and security headers have little or nothing; and real-phone checks live in one hand-written doc for one feature.
- **Biggest single gap:** no test fails when a rule has no test. About 15 rules are never named in any test file (see section 5).
- **Proposed order:** (1) rule-to-test map, so the gaps are visible; (2) browser tests for the dashboard's critical paths; (3) a security sweep; (4) a repeatable real-phone checklist; (5) the rest. Nothing here needs a production deploy.

## 2. The layers and how to run each

| Layer | What it proves | Command | Needs | In CI today? |
|---|---|---|---|---|
| **Unit: signing** | Crypto helpers, receipts, v3/v4/v5 signatures | `npm test` | Node 22 | Yes |
| **Unit/API: org Worker** | The org Worker's real code on a real in-memory SQLite (`helpers/sqlite-d1.mjs`), plus the browser scripts run in a Node VM | `npm run test:org-worker` | Node 22 | Yes |
| **API: consumer Worker** | The consumer Worker (`irlid-api`): auth, receipts, link and login guards | `npm run test:api` | Node 22 | Yes |
| **Browser (e2e)** | Real pages in Chromium against a local fake of the Worker | `npm run test:e2e` | Node 22 + Playwright 1.63 (CI installs it; locally `npm install --no-save playwright@1.63.0`) | Yes (`IRLID_E2E_REQUIRED=1`) |
| **Staging (planned)** | The real Worker code on a throwaway Cloudflare database | "Deploy staging Workers" workflow | One-time setup in `docs/test-environment.md` (not done yet) | Manual only |
| **Real phone** | What a person actually sees on iOS and Android | Checklists in `docs/phone-tests/` (proposed) | Two or more real phones, a venue screen | No, by nature |

Rules for every layer:

- Tests never touch production: no live Worker, no production D1, no secrets, no real org. Test pages use the staging Workers or a local fake.
- Never create, edit or read Bradley's record or any live person's data.
- A test that is slow or flaky gets fixed or deleted, never skipped silently (W3). The e2e suite already shuts its servers down on failure (`tests/e2e/cleanup.mjs`).
- Time-dependent tests set the clock (`Date.now`) rather than waiting. Tests for "today" and "7 days" must cover BST, GMT and the two clock-change days (late March and late October).

## 3. What exists today, by file

**Unit (`tests/sign.test.js`, 110 tests):** base64url, canonical JSON, SHA-256, compact keys, GPS rounding and distance, payload hashing, redacted receipts and their GPS hash check, trust scores, ECDSA sign/verify round trip, DER to raw conversion, v5 (hardware key) envelope checks, v3/v4 receipts still verifying.

**Org Worker (`irlid-api-org/tests/`, 401 tests).** Grouped by what they cover:

| Area | Files |
|---|---|
| Signed check-in, live code, first-scan hold, crowd, live-code-required | `signed-checkin`, `checkin-nonce`, `checkin-hold`, `checkin-hold-client`, `crowd-checkin`, `live-code-required` |
| Offline-first, queue, replay, offline scan page | `offline-first`, `offline-queue-retry`, `offline-scan-page`, `erasure-never-queued`, `login-poll-*` |
| Multi-org isolation | `two-org-bleed` (Worker), `two-org-bleed-client` (dashboard source and scripts) |
| Roles and access | `developer-access`, `developer-every-setting`, `org-session-auth`, `name-claim-binding` |
| Org login and sessions | `login-poll-client`, `login-poll-recovery`, `org-session-auth`, `portal-no-org-key`, `org-key-not-in-url` |
| Erasure and audit | `erasure-audit` |
| Kiosk lock | `kiosk-lock`, `kiosk-lock-client`, `fullscreen-qr-rotation` |
| Push updates | `org-hub`, `orghub-client` |
| PWA / service worker | `sw-update-safe`, `offline-scan-page`, `org-css-extracted` |
| Cleanup and deploy guards | `cleanup-cron`, `d1-migrations-gated`, `deploy-wrangler-pinned`, `ci-test-gate`, `staging-env-config` |
| Shared crypto | `crypto-module`, `shared-crypto-core` |
| Public fetch safety | `public-fetch-redirects` |

**Consumer Worker (`irlid-api/tests/`, 38 tests):** auth invariants, link and login guards, receipt upload limits, receipt verification.

**Browser (`tests/e2e/`):**

| Suite | What it drives |
|---|---|
| `attendee-checkin` | A first-time phone is held and lands fresh after staff approval; an offline phone queues and syncs |
| `two-org-bleed` | The 12 Nov incident replayed in a browser: a scan for org B cannot land in org A |
| `kiosk-offline-code` | Offline unlock code with the network cut |
| `csp-report-only` | Every page loads under the report-only content security policy and nothing would be blocked |

**Manual:** `docs/test-plan-first-scan-hold.md` (8 steps on two real phones). Nothing else.

## 4. Coverage by area: what exists, what is missing, how to run

Each area lists **Exists** (real, today), **Missing** (a gap, in priority order) and **Run** (how to do it). "P1" means do first.

### 4.1 Attendee phone (`org-entry.html`, `scan.html`, `js/sign.js`)

- **Exists:** signed check-in, live code, first-scan hold (Worker and browser), already-signed-in and check-out choice, offline scan page loads with no network, queued check-in survives and syncs, quarantine notice text.
- **Missing:**
  - **P1** Static (printed) venue QR end to end in a browser, offline (C6).
  - **P1** The reason shown for a queued or refused scan (v6.8.15 adds the text; a browser test should read the screen).
  - Check-out flow in a browser (signed check-out, and "check out" after "already signed in").
  - Name claim and "pick your name" screens (E1: scan only, no how-to).
  - GPS near/far/none flag and permission denied (C10): nothing stores a raw position.
  - Phone clock wrong by hours or days (C12): flagged, never refused.
  - Accessibility of the result screens (I5): labels, focus, contrast, large text.
  - Double-tap and refresh on the result screen: no double count (C13).
- **Run:** unit/API: `npm run test:org-worker`. Browser: `npm run test:e2e`. Phone: sections 4.12 and 6.

### 4.2 Staff dashboard (`Org.html`, `css/org.css`)

- **Exists:** the Worker side of almost every dashboard action; two-org bleed in a browser; many tests read `Org.html` as text to check a guard is present. That proves the code is there, not that it works.
- **Missing:**
  - **P1, done 19 Nov 2026** (`tests/e2e/dashboard-smoke.e2e.mjs`): browser smoke test: sign in, see the attendance list, a new check-in appears, signed check-out works (and a wrong key is refused), sign out clears everything.
  - **P1** "Attendance Today" across midnight with the clock set (UK time, summer and winter): covered in unit tests (`attendance-days.test.mjs`), not yet in the browser. The "Last 7 days" list and its CSV download (columns, `=` name defused) are **done** in the browser smoke test.
  - Settings tabs: every setting saves and reads back (the "every visible Save saves everything" rule, v5.5.10), and a Developer can change every Lead Admin setting (partly covered in the Worker).
  - Add person, link at the door, Delete record and Clear attendance (R1): confirm dialog, audited, never queued (S10).
  - Offline dashboard: cached snapshot shows, "N waiting" counter, no spinner (I3), nothing admin is queued.
  - Doorman scan flow end to end.
  - Calendar and expected list.
  - Accessibility pass (I5): keyboard only, screen reader labels, contrast on every theme. Org.html has `aria-` attributes on over 300 lines; nothing checks them.
  - Anything in the source marked "not active yet" is labelled, never hidden (A1, I2): one test that lists those controls.
- **Run:** `npm run test:e2e` (to be added); manual: sections 4.13 and 6.

### 4.3 Org login (`org-login.html`, `org-action-auth.html`, `js/login-poll.js`)

- **Exists:** QR login poll, recovery (reply lost, retries, backoff), session binding, no org key in the browser or URL, kiosk screen approval.
- **Missing:**
  - **P1** Single use of login QR codes (S6) as a test of the real endpoint with two phones racing.
  - **P1** Attempt limit on link codes (S7). Not named in any test.
  - Hardware-key sign-in with a real passkey: cannot be automated; phone checklist only (S4).
  - Session expiry bounce (24 h, sliding) in a browser.
  - Sign out on one device does not end another (and "sign out all devices" does).
  - Google link only to a verified email (S8). Not named in any test.
- **Run:** `npm run test:org-worker` for the Worker; real passkeys on a phone (section 6).

### 4.4 Worker API (`irlid-api-org`, `irlid-api`)

- **Exists:** about 440 tests across both Workers, running the real code on SQLite.
- **Missing:**
  - **P1** A contract test per route: method, auth needed, role needed, success shape, each error code. Today this knowledge is spread across test files. Generate a table from the router and fail if a route has no test.
  - **P1** Migrations: apply `schema.sql` and every `d1-migrations/*.sql` in order on SQLite and run the whole suite against the result (R4: changes only add). Today the helper loads `schema.sql` only, and its `org_expected` table differs from the live one, so some tests build their own tables.
  - **Consumer Worker:** very thin on `/receipts`, `/link` and device reassignment (needs more than the 38 tests).
  - Rate limit tests for `/org/register` and login claims (see 4.13).
  - Large and malformed bodies, wrong content type, missing fields: every route returns a clean 4xx, never a 500 that leaks an error.
  - CORS: only the intended origins.
- **Run:** `npm run test:org-worker`, `npm run test:api`. Later, against staging: `API_BASE=<staging url> npm run test:smoke` (not built).

### 4.5 Offline queue and replay (`js/offline-queue.js`, `js/orgapi.js`)

- **Exists:** retry with backoff, quarantine of a bad signature, never-queue list for admin actions, queued check-in replayed late, request time limit and queue takeover (v6.8.15), idempotency key.
- **Missing:**
  - **P1** Replay 24 hours and 5 days later (C7), in a browser, with a clock moved forward.
  - **P1** Duplicate protection (C13): the same visit sent twice, from two tabs, and after a timeout where the Worker did finish.
  - Queue size and storage: IndexedDB full, private mode, storage cleared by the browser.
  - Two tabs replaying at once.
  - Order: check-in before check-out, always.
  - A 5xx storm: nothing is dropped; a 4xx on replay is quarantined with a visible notice (C8).
  - Terminal status list reviewed whenever the Worker adds a new refusal (offline-first.md checklist).
- **Run:** `npm run test:org-worker`; browser with the network cut: `npm run test:e2e`; phone: airplane-mode checklist (section 6).

### 4.6 Multi-org isolation (the #192 bleed)

- **Exists:** `two-org-bleed` (16 Worker tests), `two-org-bleed-client` (23), the browser replay, a Worker rule that a session is tied to one org (`session_org_mismatch`), a scan naming another org is refused.
- **Missing:**
  - **P1** A generic "org B's session against org A's route" sweep over **every** route, so a new route that forgets the check fails the build. Today each route is checked by hand.
  - **P1** Every read endpoint: attendance, audit log, members, receipts, theme, settings, quarantine, expected list, calendar: org A never sees org B's rows.
  - Developer account in two orgs: switching clears settings, theme, people, the 7-day list (new in v6.8.15) and the audit log view.
  - Offline queue: an op queued for org A is still sent to org A after the user switches to org B.
  - Durable Object push channel: org A's socket never gets org B's events.
  - Same person, same device key, in two orgs: records stay separate.
- **Run:** `npm run test:org-worker` and `npm run test:e2e`.

### 4.7 Themes

- **Exists:** the theme validators on the Worker are exercised in passing (`developer-every-setting`); the "theme falls back to the plain look, not the last org's" rule has a client test.
- **Missing (this is nearly empty):**
  - **P1, done 19 Nov 2026** (`irlid-api-org/tests/theme-validation.test.mjs`): theme validation: hex shape, QR contrast against white (the 4.5:1 line), palette length, image URLs, enums, clearing; a save with no sign-in is refused. **Gaps found, not fixed yet:** unknown theme keys are kept as sent (not dropped); only `qrFg` is contrast-checked; a staff session can save the theme and other non-governed settings (redirect URL, terms, welcome text) although Settings is Lead Admin only in the dashboard.
  - **P1, done 19 Nov 2026** (`tests/e2e/themes.e2e.mjs`): five themes (IRLid's own, light, red, green dark, pale yellow light) on the Check-in, Dashboard and Settings panels and the attendee's first-scan screen, every visible text checked against WCAG AA. Today's failures are listed in the test (`KNOWN_LOW_CONTRAST`), so new ones fail and fixed ones must be taken off. None depend on the theme's colours. Script in theme text or the org's name never runs (S11).
  - Public `/org/entry-info` returns only safe branding (no keys, no members): **done**, same Worker test file.
  - Theme change shows on the next phone scan without a cache problem (see 4.10).
  - Banner, fonts and background image load failures fall back cleanly, offline too.
  - Visual snapshots of 3 to 4 key screens per theme (Playwright screenshots, compared by eye first; add pixel comparison only if it stays stable).
- **Run:** `npm run test:org-worker` for validation; `npm run test:e2e` for rendering; phone: look at the venue screen and the phone in each theme.

### 4.8 Receipts and signatures

- **Exists:** signing and verifying (v3, v4, v5), redacted receipt GPS check, receipt upload limits, receipt verification in the consumer Worker, org receipts minted on check-in and signed.
- **Missing:**
  - **P1** Old receipts stay valid (R2): keep a folder of real receipts from every past version (v3, v4, v5, org receipts) as fixtures and verify them with the current code on every build. Rule R2 is not named in any test.
  - **P1** `receipt.html` and `check.html` in a browser: valid, tampered (one byte changed), wrong key, expired, org receipt offline-unverified badge (C9), GPS shown only as a band for org receipts and kept in full for consumer handshakes (R8, C10).
  - A forged or invalid signature is always refused (S1): property-style test with random bit flips.
  - A public key alone never signs anyone in (S2).
  - Receipt page escapes every field (S11): names, venue address, org text.
  - Receipt read from a link on a phone that has never seen it.
  - Receipts on all devices (locked sync, phone first): see section 8 for the plan and its tests.
- **Run:** `npm test`, `npm run test:api`, `npm run test:org-worker`; browser: `npm run test:e2e`.

### 4.9 Audit log

- **Exists:** immutable table with triggers, erasure writes an audit row first and aborts if it cannot (`erasure-audit`), kiosk unlock audit rows, names on every row (v6.8.15).
- **Missing:**
  - **P1** Every privileged action writes exactly one row (R5): a table-driven test over the signed-action list: bind, add at door, calendar write, appoint, invite create/accept, member remove, settings save, kiosk approve/unlock, erasure.
  - **P1** The log never blocks an action (R5): inject a D1 failure on the audit insert and check the action still succeeds (except erasure, which is meant to fail closed).
  - Denied attempts are logged with the actor.
  - Only Lead Admin and Developer can read it; staff and attendee cannot; an org cannot read another org's log.
  - Row text escapes in the dashboard (S11) and the log dialog is readable on a phone.
  - Log paging past 200 rows and the "newest first" order.
- **Run:** `npm run test:org-worker`.

### 4.10 Roles: Developer, admin (Lead Admin), staff, attendee

- **Exists:** `developer-access`, `developer-every-setting`, `org-session-auth`, the role gates on most routes.
- **Missing:**
  - **P1** A role matrix: one table of (route or dashboard action) x (Developer, Lead Admin, manager, staff, attendee, no session, other org's Lead Admin) with the expected allow or deny, run against the real Worker. Rules A1 to A5 each need a named test (A3 and A4 are not named in any test today).
  - **P1** Attendees never see the guest list or any other name (A5): deny screens show no other names; the member list and attendance routes refuse an attendee session.
  - Exactly one Lead Admin per org; a handover replaces in one step, in person (A1). Role names in the database never change (A2). Developer cannot be handed out.
  - Manager powers off by default, and a manager can never get invite power or the permissions settings (A4).
  - Hidden controls: `data-min-role` hides controls in the page, but the Worker is the real gate. Test that hiding is cosmetic only by calling the route directly.
  - Developer super-admin reaches every setting; a setting not wired yet shows "not active yet" (A1, I2).
- **Run:** `npm run test:org-worker`; browser: log in as each role (fake Worker) and check the sidebar and Settings.

### 4.11 PWA cache and updates (`sw.js`, `manifest.json`)

- **Exists:** `sw-update-safe` (an update that cannot cache in full keeps the old copy), `offline-scan-page` (offline navigation, query strings, extensionless URLs), CSS extracted and pre-cached, scripts served network-first.
- **Missing:**
  - **P1** Every file the page loads is either pre-cached or a deliberate network-only call. A test that lists the scripts and stylesheets in each page and checks `sw.js`'s pre-cache list. (v6.8.15 had to add three new scripts to it by hand.)
  - **P1** Update path in a browser: load version N, deploy N+1, the phone gets N+1 on the next visit (W8), and a half-failed update leaves N working.
  - The cache version is bumped whenever a page or script changes (W8): a test that fails when a cached file changed but `CACHE_VERSION` did not.
  - The Worker API is never served from cache (the `sw.js` rule).
  - Offline on first visit after install; offline after a version update; install to home screen on iOS and Android; `manifest.json` icons and start URL.
  - Stale cache after a login-poll fix (the v6.8.7 incident): a regression test.
- **Run:** `npm run test:org-worker`; browser: `npm run test:e2e`; phone: airplane-mode and "update" checklist.

### 4.12 Real-phone checks (manual, repeatable)

Automated tests cannot see iOS Safari storage limits, the camera, passkeys, flaky Wi-Fi or an in-app browser. W4 says test on a real phone. Today there is one doc for one feature. The plan:

- **A standing set of devices:** one recent iPhone (Safari), one recent Android (Chrome), one older or low-end Android, and a laptop for the dashboard. Note OS and browser versions in each result.
- **One checklist per release**, kept in `docs/phone-tests/`, same format as `test-plan-first-scan-hold.md` (steps, expected, pass box, "if it fails"). Core set:
  1. First scan on a new phone (the orange screen, approval, fresh vs offline badge).
  2. Known phone scan, "already signed in", check-out.
  3. Airplane mode scan, then reconnect: "N waiting", sync, nothing lost, nothing doubled.
  4. Slow or hung connection (data on, no real internet): the scan queues within seconds with the reason shown.
  5. Static printed QR, with data off.
  6. Two phones scanning one frame.
  7. Receipt opens, verifies, and still opens after a day.
  8. Install to home screen, update to the next version, still works offline.
  9. Staff phone: passkey sign-in, doorman scan, staff approval.
  10. Dashboard on a phone-sized screen: all text readable, Last 7 days, audit log.
  11. Each theme on the venue screen and the phone.
  12. Wrong phone clock (set 2 hours off): scan still accepted and flagged.
- **Privacy:** screenshots are cropped or blurred (keys, IDs, QR codes). Test org only, never a live org or Bradley's record.
- **Run:** by hand, by Spencer or a tester, before each release that touches check-in, the dashboard or `sw.js`. Results go in the PR description.

### 4.13 Security (auth, tokens, injection, rate limits)

Maps to THREAT-MODEL.md and rules S1 to S13.

- **Exists:** bad signature refused or quarantined (S1), no org key in the browser or a URL (`portal-no-org-key`, `org-key-not-in-url`), sessions are random tokens (S12), admin actions never queued (S10), org text kept out of `innerHTML` in checked places (S11), public fetch redirects, report-only CSP across all pages, deploy workflow pinned and gated.
- **Missing:**
  - **P1 Auth:** every route without a session or org key returns 401 or 403 (a generated sweep). Expired, reused and tampered tokens. A token for org A against org B. An IP address never decides access (S12): same token, different IP, same result; different token, same IP, refused.
  - **P1 Injection:** a script-like string (`<img onerror>`, `"><svg onload>`, `javascript:` and `data:` URLs, very long text, control characters, emoji) in every field an org or attendee can set (name, label, event name, venue address, welcome message, theme text, redirect URL, audit target) appears escaped on every page that shows it: dashboard, receipt, check, org-entry, scan, kiosk. Redirect URLs allow only `https:` to allowed hosts. SQL: the Worker uses bound parameters; add a test that feeds quote and comment characters to every text field and checks the table is intact.
  - **P1 Tokens and codes:** single use (S6), expiry (login QR, link codes, assist requests, 5 minutes), attempt limit (S7), nonce replay, hello replay, a held code used twice.
  - **P1 Rate limits:** `/org/register`, login claims, link-code attempts, hold endpoint (4 per code), quarantine cap (200 per org per day), check-in floods. Check the 429, the `retry_after`, and that real check-ins are not blocked by someone else's flood (C13).
  - **Never trust the phone (S13):** a body with `score`, `bioVerified`, `offline_queued`, `assurance: fresh` or a past time cannot raise trust or skip a check.
  - **Keys:** nothing prints, logs or returns a private key or org key; the org key is never in a QR (S9); a response scan for known secret shapes.
  - **Headers:** CSP (move from report-only to enforced once the report is clean; see `docs/csp-plan.md`), `Referrer-Policy`, CORS allow list, no stack traces in 500s.
  - **Dependencies and supply chain:** SRI on CDN scripts present; pinned versions; `npm audit` and a secret scan in CI.
  - **Abuse of offline:** a photographed QR scanned from far away lands as offline/unverified, never fresh (C2, C14); with "Require live screen code" it is held, not counted.
  - **Pen-test style, once, with Spencer's say-so:** an outside review of the two Workers on staging. Never on production.
- **Run:** `npm run test:org-worker` / `test:api` for the sweeps; a staging run for rate limits and headers; the outside review is a separate job.

## 5. Rules with no named test

A rough guide, from searching the test files for the rule number. A test may cover a rule without naming it, so the first job is to map each rule to its tests by hand (section 7, step 1). Rules never named: **S7, S8, C11, C16, R2, R3, R6, R9, A3, A4, I3, I4, I5, I6, E4.** Rules named in only one file (thin): S1, S2, S3, S5, S9, C4, C10, C12, R8, A5, I2.

Some of these are design-only or off by default (C16, R9), so "no test" there means "no code yet", which is fine. The rest are real gaps.

## 6. Test data and environments

- **Unit and API:** in-memory SQLite, seeded in each test. No shared state between tests.
- **Browser:** a local static server plus a small fake Worker (as in `tests/e2e/`). Add fixtures for: two orgs, one person per role, a venue with a theme, an event, a member with a device key.
- **Staging:** `docs/test-environment.md` (not set up yet). When it exists, run a short smoke pack against it after every Worker change, before merging. Test pages on any host other than irlid.co.uk use the staging Workers and show the "TEST COPY — NOT LIVE" bar (draft #191).
- **Real phone:** the test org on staging, a test device key, never a real organisation.
- **Fixtures to keep forever:** one receipt from every past version (R2); a queued check-in body from an old cached page (C15); a v3 phone's old scan.

## 7. Suggested order of work

Each step is its own PR. Rough size in brackets.

1. **Rule-to-test map** (small, docs plus a script): one table, rule by rule, with the test file that proves it. Adds a test that fails if a rule has no row. Makes section 5 exact.
2. **Role matrix and cross-org route sweep** (medium): covers 4.6, 4.10 and half of 4.13 from one generated list of routes.
3. **Migrations test** (small): run all migrations in order, then the suite on that result (4.4).
4. **Browser smoke for the dashboard** (medium): sign in, attendance, Today across midnight, Last 7 days and CSV, sign out clears (4.2).
5. **Security sweep, injection and tokens** (medium): 4.13.
6. **PWA pre-cache completeness and version-bump check** (small): 4.11.
7. **Receipt fixtures from every version** (small, needs a few real old receipts from Spencer): 4.8.
8. **Real-phone checklists in `docs/phone-tests/`** (small, docs only): 4.12.
9. **Themes: validation and contrast** (medium): 4.7.
10. **Accessibility pass** (medium): 4.1, 4.2.
11. **Staging smoke pack** (needs Spencer's one-time Cloudflare setup first).
12. **Outside security review** (separate decision).
13. **Receipt sync, phone first** (section 8): not before a design review.

## 8. Receipts on all devices (plan only)

**Status:** plan only, updated 16 Nov 2026 with Spencer's decisions (15 Nov 10:56 UK, question 2 at 15:39 UK, and questions 1, 3, 4 and 5 on 16/11/2026). No code, no deploy. Anything marked **[UNCHECKED]** has not been tested on a real phone (W4) and must not be treated as fact.

### 8.1 Spencer's decisions

1. **Personal only.** Each person sees all of their own receipts, including their org visits, on any device: phone, desktop, tablet, Pi. This is a person's own list. Organisations never see it, and it is never a shared or org-wide record (A5). The org keeps its own copy of org receipts, as now.
2. **Account sync, end-to-end encrypted.** The list is locked with a key only the person's own devices hold. The server stores the locked copy and cannot read it.
3. **Keep every receipt.** Nothing is purged, anywhere. If someone clears their phone, the server copy is the backup.
4. **Phone first.** Build for the phone, then other devices.
5. **Docs only** until Spencer says build.
6. **No erase of the synced server copy, for now** (15:39 UK). People may not erase their own synced list on the server. Storage is not an issue until things scale up, so revisit then.
7. **v5 as an extra gate** (Decided by Spencer 16/11/2026). Where v5 is on, adding a device or changing the recovery key also needs a v5 signature.
8. **Recovery key may be skipped** (Decided by Spencer 16/11/2026). After a warning, the person can skip saving the recovery key, and is then marked unprotected.
9. **Honest wording on org visits** (Decided by Spencer 16/11/2026). Say plainly that an organisation can still link its own visit receipt to a device.
10. **Pi scope** (Decided by Spencer 16/11/2026). A Pi with a screen is in. A Pi with no screen, and any other screenless device, is out.

### 8.2 The problem today

A person's receipts live in the browser of the phone that made them: consumer handshakes under `irlid_receipts`, org check-in receipts under `irlid_org_receipts` (cut to the last 50 by `org-entry.html`), both in `localStorage`. A new phone, cleared site data or lost storage loses the **list**. The receipts themselves still exist (an org receipt is on the org Worker and opens by id, and every receipt is signed, so anyone can verify it).

Ways a phone can lose its list (all **[UNCHECKED]** until tried on real devices):
- A new or second device.
- iPhone Safari clearing site storage after a period of non-use, unless installed to the home screen. **[UNCHECKED]**
- Links opened in an in-app browser (a chat or social app) using separate storage from the main browser. **[UNCHECKED]**
- Private browsing, "clear history", a full phone.
- The 50-receipt cap (this one is in the code, so it is checked).

### 8.3 What the code says about "is this phone the linked v5 device?" (checked 15 Nov 2026)

Short answer: **today nothing in the check-in path checks that, and the "linked" thing is not the v5 key.** Details:

- **Check-ins are signed with the phone's ordinary device key**, not the v5 hardware key. `org-entry.html` signs through `signHashB64url()`, which uses the key stored in the browser as `irlid_priv_jwk` (`js/sign.js` lines 73 to 83, 140 to 153). `org-entry.html` has no v5 call at all.
- **The v5 hardware key is a separate, optional key.** It lives as three browser flags (`irlid_v5_cred_id`, `irlid_v5_pub_jwk`, `irlid_v5_enabled`). Enrolling sets "enabled" to off (`js/sign.js` lines 920 to 946 and 1163 to 1166). So a phone can be "enrolled" and still sign with the ordinary key. It is off by default (R2).
- **The consumer Worker (`irlid-api`) has no record of v5 for a phone.** It can verify a v5 signature on a receipt (`verifyV5Envelope`), but it stores no "this device is v5" flag.
- **What the server does record is a linked device:** the `devices` table (`user_id`, `pub_key_id` of the ordinary key, `label`, `revoked_at`). New devices join through a link code (6 digits, 5 minutes, attempt-limited, `/auth/link/claim`). `listReceipts` already returns receipts where a linked, non-revoked device key is party A or B. The org Worker records `attendee_pub_fp` on each org receipt, so "this org receipt belongs to this device key" is knowable.
- **The org side's v5 link is for staff** (`portal_users.pub_fp`), a different table from a person's consumer `devices`.

What this means for the plan:
- "Linked" has to mean **a row in `devices`, not revoked**, proved by a signature from that device's ordinary key. That check is the gate for every sync call.
- v5 can add strength but cannot be the gate: most phones don't have it on (R2), and the server can't tell. Plan: where a phone **does** have v5 enabled, adding a device or changing the recovery key also needs a v5 signature. Without v5, the person confirms on an already-linked phone in person (S5). **Decided by Spencer 16/11/2026** (question 1 in 8.9).
- A test must read this from the code, not assume it (see 8.8).

### 8.4 What must stay true

- Old receipts stay valid forever, and nothing here edits a receipt (R2, R1).
- **Keys never leave the phone (S3).** The signing keys (ordinary and v5) are never copied, wrapped or sent. The sync uses **separate** keys, below. A bug in sync must not be able to expose a signing key.
- Keep data small and private (R3, A5, C10): no guest lists; org receipts carry a GPS band only; consumer handshake receipts keep their GPS (R8).
- Check-in and showing a receipt work offline (C1). Sync is extra: queued, "N waiting" dot, no spinner (I3, C7).
- Optional, off by default (R2). No account is needed to check in.
- Claim only what the crypto proves (I1): a receipt is "a signed record", whoever holds it.
- Admin actions are never queued (S10): adding a device and changing the recovery key are done live, in person.

### 8.5 The design in plain English

**What is locked.** One list per person. Each receipt is one small locked entry. The server sees: the person's account, the size and time of each entry, and how many there are. It cannot see which org, who, when you visited, or the receipt contents. **Honest limit:** for an org visit the org Worker already holds the receipt and the device key it was made with. So the server operator could in principle match an org receipt to a device key. The lock protects the person's *list and its contents* from the account server. It does not hide the fact of a visit from the org that recorded it. This must be said in the product, plainly (I1). **Decided by Spencer 16/11/2026** (question 4 in 8.9).

**Keys (three kinds, none of them the signing keys):**
1. **List key.** One random 256-bit key per person, made on the first phone. Locks every entry (AES-GCM). Never leaves a device unlocked.
2. **Device sync key.** Each device makes its own key pair just for sync (ECDH P-256, separate from the signing key). The list key is wrapped for each device with that device's public sync key. The server stores these wrapped copies and can't open them.
3. **Recovery key.** A random key shown once (as words or a QR to print) that also wraps the list key. The server stores that wrapped copy. Only someone holding the recovery key can open it.

**Entries.** Each entry is locked with the list key. Its id is not the receipt id (it is a keyed hash of it, so the server can't match it to a public receipt id). The entry is bound to the account and its own id (so entries can't be swapped between people or moved around). Each entry records which version of the list key locked it.

**Never purged.** The server never deletes entries, and a device "hiding" a receipt just adds a new locked entry (R1: add a note, don't edit). **Spencer decided (15 Nov 2026, 15:39 UK):** people may not erase their own synced server copy for now. Keep every receipt. Storage is not an issue until things scale up, so revisit then. There is no erase button in this plan.

**The list is stored where.** Phones move it from `localStorage` (about 5 MB, easy to lose) to IndexedDB so "keep every receipt" is real. Size per receipt and storage limits are tested (8.8).

### 8.6 Getting the key onto devices

**First setup (the first phone).**
1. The person turns on "Sync my receipts" in settings. (Off by default.)
2. The phone must already be a linked device (8.3). If not, it links first, using the existing account flow.
3. The phone makes the list key and its sync key pair, locks the receipts it holds, and uploads them.
4. It then shows the **recovery key once** and asks the person to save it (write down, print, or password manager). The person must tick that they saved it before sync is marked "protected". They can skip after a warning, and are then marked unprotected; the screen says plainly "if you lose this phone, your synced list can't be opened". (E1, I1: honest, not blocking.) **Decided by Spencer 16/11/2026** (question 3 in 8.9).

**Adding a new device (phone, tablet, desktop, Pi).**
1. New device: "Sign in to see my receipts." It makes its own sync key pair and shows a **QR and a short check code** (words or 6 digits) made from its public sync key.
2. An already-linked phone scans that QR (in person, S5: no email or code shortcut). It checks the short code matches what the new device shows, so a server in the middle can't swap the key (anti man-in-the-middle).
3. The phone wraps the list key for the new device and uploads it. The new device downloads the locked entries and opens them.
4. The existing **link code** (6 digits, 5 minutes, single use, attempt-limited) can be how the server knows the new device may join the account. **The link code alone never gives the key**: without step 2 the new device gets locked data it can't open.
5. Where the new device has no camera (a Pi with a screen), it shows the QR on screen and the phone scans it, so the Pi needs no camera. **Decided by Spencer 16/11/2026** (question 5 in 8.9): a Pi with a screen is in; a Pi with no screen, and any other screenless device, is out.

**Phone lost or stolen (other devices still work).**
1. On another linked device the person removes the lost one (sets `revoked_at`, the existing revoke flow). That needs the person's in-person confirmation on a linked device (S5).
2. The list key is **rotated**: a new key version is made and wrapped only for the remaining devices. New entries use it. Old entries are re-locked in the background.
3. **Honest limit:** a thief with an unlocked phone already has what is on the phone, and anything already downloaded stays readable on it. Rotation stops it getting anything new from the server. Tell the person to also lock or wipe the phone.

**All devices lost (recovery).**
1. New phone: "I lost all my devices" then enter the recovery key (type the words or scan the printed QR).
2. The phone unwraps the list key from the recovery copy on the server, makes its own sync key, wraps the key for itself, and rotates to a fresh recovery key, shown once.
3. Because nothing is ever purged, every entry is still there and opens.
4. Recovery is **never an email or Google shortcut** (S4, S8): without the recovery key or a linked device, nobody, including us, can open the list.
5. **If the person has no device and no recovery key, the locked list can't be opened, ever.** The entries stay on the server (nothing is purged) but unreadable. What is still recoverable: an org receipt opens by its id if the person has the link, and the org still has its own record. Say this at setup (I1). It is the cost of the server not being able to read the list.

**Later options (not v1, unchecked):** passkey-derived unlock (WebAuthn PRF extension), which may allow unlocking with Face ID or a fingerprint. Support differs by browser and device. **[UNCHECKED]** until tested on real phones.

### 8.7 Order of build (phone first)

Each step is its own PR, optional for the person, off by default (R2). No step starts until a design review.

1. **Phone keeps every receipt locally:** move the receipt list to IndexedDB, remove the 50 cap, ask the browser to keep storage, "Copy link" on every receipt. No account, no server. This alone fixes most loss on one phone. **[UNCHECKED]** on iPhone until tested.
2. **Local export and import file** (signed receipts only, no keys): a backup that works offline.
3. **The locked list on the server:** new Worker routes (create entry, list since a cursor, add device wrap, revoke, rotate), gated by the linked-device check (8.3). New tables only (R4). A **design review before any code**: crypto parameters, what the server logs, rate limits. Ideally reviewed by someone who is not the author (W9).
4. **Phone sync UI:** setup, recovery key screen, "N waiting" dot.
5. **Adding a device by QR** (phone as the already-linked device, desktop or tablet as the new one).
6. **Recovery and lost-device flow**, with rotation.
7. **Other devices:** desktop browser, tablet, and a Pi with a screen (no screenless devices). Tested in a plain browser first.

### 8.8 Tests (when built)

*Unit and API (Node, in CI):*
- The server stores only locked data: with the Worker's own database, search every stored field for a known receipt name, org name and venue and find nothing.
- A request from a device that is not linked, or is revoked, or signs wrongly, is refused (S1, S12). Another person's account cannot read or write this list (A5).
- An entry cannot be moved to another account or another id (the lock is bound to both).
- Nothing deletes an entry. There is no erase of the synced server copy for now (Spencer, 15:39 UK, 15 Nov 2026). A test must fail if any sync route deletes or purges an entry. Revisit when storage becomes an issue.
- Link code: single use, 5 minutes, attempt limit (S6, S7), and the code alone returns no usable key.
- Wrong or swapped device key during adding: the phone refuses on a code mismatch.
- Rotation: a revoked device cannot read entries created after the revoke.
- Recovery key: right key opens; wrong key fails cleanly; the recovery key is rotated afterwards.
- **A test that reads the code and fails if sync ever touches `irlid_priv_jwk` or the v5 keys (S3).**
- Imports verify every signature; a tampered receipt is refused; duplicates are ignored; v3, v4, v5 and org receipts from the fixtures all import and verify (S1, R2).
- Check-in is unchanged with sync off, and with the sync server down (C1, C13).
- The test that states the check in 8.3: the sync gate uses the `devices` table and the ordinary key, and v5 is an extra only where enabled.

*Browser (Playwright):* two browser profiles stand in for two devices: set up on A, add B by the QR flow, receipts made on A appear on B only after adding; clear A's storage and restore from B; offline then reconnect shows "N waiting" and nothing is lost or doubled (C7, C13); recovery path end to end.

*Real phones (manual, **[UNCHECKED]** until done):* iPhone Safari and installed PWA, Android Chrome, in-app browser, desktop, tablet, a Pi. After clearing site data; after a week unused; storage-full; airplane mode. Confirm the iPhone storage and in-app browser claims in 8.2 as part of this.

### 8.9 Questions for Spencer

**Answered (15 Nov 2026, 15:39 UK):**

2. **Erasure.** People may **not** erase their own synced server copy for now. Keep every receipt. Storage is not an issue until things scale up, so revisit then.

**Answered (Decided by Spencer 16/11/2026):**

1. **v5 as an extra gate (8.3).** Yes. Where a phone has v5 enabled, adding a device or changing the recovery key also needs a v5 signature. Without v5, the person confirms on an already-linked phone in person (S5).
3. **Recovery key skippable?** Yes. After a warning, the person can skip saving the recovery key, and is then marked unprotected.
4. **Honest wording on org visits (8.5).** Yes. Say plainly that an organisation can still link its own visit receipt to a device. Do not stop recording the device key on org receipts.
5. **Pi scope.** Yes. A Pi with a screen is in. A Pi with no screen, and any other screenless device, is out.

## 9. Out of scope

- Load and stress testing of the live Workers (needs staging first).
- Deploying anything, wrangler, production D1, secrets.
- Any change to rules or to code: this is a plan. The first build step is section 7, step 1.
