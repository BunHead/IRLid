# HANDOVER — Batches 14, 15, 16

**To:** Mr. Data (Codex)
**From:** Number One (Claude)
**Date:** 2026-04-28 (drafted in advance — Number One may be at weekly cap)
**Repo scope:** `BunHead/IRLid-TestEnvironment` only — do NOT touch `BunHead/IRLid` (live)
**Pattern:** Imbue — one narrow PR per task, against `main`. Stop after each batch.
**Captain controls cadence.** Mr. Data executes one batch, reports, waits for Captain's go-ahead before next batch.

---

## Hard rules (unchanged)

1. TestEnvironment only. Live `BunHead/IRLid` is off-limits.
2. DB is immutable warts-and-all. No retroactive fixes to old rows.
3. All v4+ enhancements remain optional, off by default, Settings-gated.
4. Migrations idempotent — check before adding (Batch 8 wrapper pattern).
5. **If Number One is at weekly cap and unreachable:** if you hit a real blocker — protocol question, security question, behavioural ambiguity not covered by acceptance criteria — **stop, roll back the in-progress PR, leave system in last-known-good state, report to Captain.** Do NOT improvise on cryptographic or protocol-level decisions. Captain will surface to Number One Saturday or wait for Number One return.

---

## Verification required per task (apply to every PR)

- Inline scripts parse with Node (`node --check` for any modified JS)
- `git diff --check` clean aside from normal CRLF warnings
- Worker endpoints tested with smoke commands (when Worker changes)
- Browser smoke test for the actual UI path, including QR pixel checks where a QR is expected
- For visual/CSS fixes: hard-refresh GitHub Pages and confirm in browser before claiming done

---

# Batch 14 — Fix-pass (3 tasks, 4 bugs)

Demo-blocker visual debt surfaced during Batch 13 smoke testing. Captain has Wisdom (ASE Tech) and Donald (Imbue) on the watch-window for Wednesday — test environment must be visually clean before then.

## Task 1 — Venue fullscreen QR — restore Imbue logo at top

**Symptom:** Fullscreen Venue QR view shows the QR but no Imbue (organisation) logo at the top. Was working as of Batch 9 polish (`codex/batch9-task2-org-chrome-logo` and `codex/batch9-task1-responsive-fullscreen-qr`). Regression somewhere in Batch 12.

**Goal:** Logo renders above the fullscreen Venue QR using whatever `settings.logoUrl` / `currentOrg.logoUrl` is set on the org.

**Files:** `org.html`, `js/qr-fullscreen.js` (created in Batch 12), possibly CSS rules around the fullscreen overlay.

**Investigation route:**
1. Diff `js/qr-fullscreen.js` against the Batch 9 fullscreen Venue QR markup to find what got dropped.
2. Confirm the fullscreen overlay container has a header slot for the logo; if not, restore it.
3. Image source — pull from `currentOrg.logoUrl` or `settings.logoUrl`, with graceful fallback (no broken image icon).

**Acceptance:**
- Fullscreen Venue QR shows Imbue logo at top, properly sized
- Works in both Venue mode and (where applicable) Doorman fullscreen views
- No broken image icon if logo URL missing — show clean text fallback

**Branch:** `codex/batch14-task1-venue-fullscreen-logo`
**Commit prefix:** `fix(qr):`

## Task 2 — Doorman section vertical compression

**Symptom:** Adding the Staff Auth panel (Batch 13 Task 2) plus the existing Doorman Console pushed Expected Attendees and "When identity is unclear" panels off-screen with no page scroll available.

**Captain's stated fix preference:** **SHRINK the Staff Auth and Doorman Console sections vertically. Do NOT restore page scroll.** Less likely to use them often = less screen real estate.

**Goal:** Doorman mode page fits Staff Auth + Doorman Console + Expected Attendees + "When identity is unclear" + Add Expected Attendee on a typical desktop viewport (1080p) without scrolling away from useful content.

**Files:** `org.html` (Doorman section markup + CSS).

**Approach:**
- Reduce vertical padding on Staff Auth and Doorman Console panels
- Consider collapsing Staff Auth to a single-line input + button when not in use; expand only if needed
- Reduce font sizes on helper text
- Tighter line-heights
- Remove or condense help text below buttons where it adds nothing

**Acceptance:**
- Desktop 1080p: no critical content (Expected Attendees) below the fold
- Mobile: graceful stacking, scroll permitted on mobile only
- Visual hierarchy intact — Staff Auth still recognisable, Doorman Console still primary action

**Branch:** `codex/batch14-task2-doorman-vertical-compression`
**Commit prefix:** `style(org):`

## Task 3 — Paired CSS sizing fixes

Two related layout bugs. Both deal with elements being too tall / in the wrong place. Single PR, two commits.

### 3a — `scan.html` mobile stray corner-bracket overlay

**Symptom:** On mobile `scan.html`, there's a stray corner-bracket pattern overlapping the "POINT AT ANY IRLID QR" text, mid-left of the camera viewport. Captain confirmed this on a Pixel 8 Pro screenshot. Likely `js/qr-fullscreen.js` (Batch 12 universal double-tap-to-fullscreen handler) attaching itself to the camera viewport reticle when it shouldn't.

**Goal:** `js/qr-fullscreen.js` only attaches to elements that are actually displaying a QR (output), never to the scan camera viewport (input).

**Files:** `js/qr-fullscreen.js`, possibly `scan.html`.

**Approach:**
- Audit the selector or class `js/qr-fullscreen.js` uses to attach
- Restrict to QR-display elements (`.checkout-qr-box`, `.venue-qr-box`, etc.) — not scan reticle elements
- Add an opt-out attribute `data-no-fullscreen` for elements that should never be considered

**Acceptance:**
- `scan.html` mobile shows the camera viewport cleanly, no stray overlay
- Existing double-tap-to-fullscreen on Venue/Doorman/Receipt QRs still works
- No regression on `scan.html` desktop view

### 3b — Settings page right-column QR test tools panel scrollable

**Symptom:** On the Settings page, the right-column "QR test tools" panel (with active outcome QR + Hosted scan page accordion + Live settings snapshot) is so tall the Live settings snapshot is hidden below the fold. Captain didn't realise more existed below.

**Captain's stated fix preference:** **Shrink the active outcome QR frame and make the right-column panel scrollable.** This is dev/debug-y, won't be used often, shouldn't dominate.

**Goal:** All Settings page right-column content reachable. Active outcome QR smaller. Panel scrollable.

**Files:** `org.html` (Settings page CSS for right column).

**Approach:**
- Reduce the active outcome QR `width` / `height` (e.g. from 240px to 180px)
- Set `max-height` and `overflow-y: auto` on the right-column container
- Ensure the "Save All Settings" buttons remain accessible

**Acceptance:**
- Settings page: all right-column content reachable via scroll
- Hosted scan page accordion still expands cleanly
- Live settings snapshot fully visible
- Buttons at bottom (Save All Settings, Copy active outcome URL, etc.) reachable

**Branch:** `codex/batch14-task3-paired-css-fixes`
**Commit prefix:** `fix(ui):` for 3a, `style(settings):` for 3b — two commits in the one PR.

## Order of work (Batch 14)

1. Task 1 first — focused, low risk, proves the fullscreen overlay system is healthy before T3 touches it.
2. Task 3 second — deals with universal `qr-fullscreen.js` handler used everywhere; isolating its bugs early helps T2's verification.
3. Task 2 last — biggest visual change, easiest to land cleanly after the other two.

---

# Batch 15 — Staff Auth Enforcement (1 task)

Locks down what Batch 13 built. Manual check-in in Doorman mode requires an active staff session.

## Task — Enforce Staff Auth For Manual Check-in

**Goal:** The Doorman Console cannot record manual check-ins until the current staff/doorman device has an active staff session via the Staff Auth panel.

**Files:** `org.html`, `js/orgapi.js`, `irlid-api/src/index.js`.

**Behaviour:**
- Manual check-in button is disabled until staff auth succeeds
- `manualCheckin()` includes the staff session token (header or body — whichever pattern matches existing endpoints)
- Worker rejects doorman/manual check-in requests without a valid staff session — return 401 with clear error
- Expired session disables the button again and shows a clear UI message ("Staff session expired — re-authenticate")
- Existing Venue QR and attendee self-check-in paths are unaffected — those don't require staff auth
- "Sign out staff" button (already shipped) clears the session and re-disables the button

**Acceptance:**
- Fresh Doorman mode: manual check-in disabled, clear "authenticate first" hint visible
- Valid staff auth: manual check-in enabled
- Missing/expired staff token: Worker rejects with 401 and UI explains the issue (not just "request failed")
- Venue QR mode: unchanged, no staff auth required
- Attendee self check-in via QR: unchanged, no staff auth required
- Sign out staff → manual check-in disabled again

**Branch:** `codex/batch15-enforce-staff-auth`
**PR title:** `[codex] Enforce staff auth for doorman check-in`
**Commit prefix:** `feat(staff-auth):`

**Verification:**
- Worker smoke: POST manual check-in without staff token → 401
- Worker smoke: POST manual check-in with expired staff token → 401
- Worker smoke: POST manual check-in with valid staff token → 200
- Browser smoke: full Doorman mode round-trip (auth → enable → check-in → disable on signout)

---

# Batch 16 — Checkout Token API + Short Checkout QR (2 tasks, 2 PRs)

Closes the long-payload checkout QR issue. Tasks are sequential — Task 2 depends on Task 1.

## Task 1 — Checkout Token Schema + API

**Goal:** Add Worker/D1 support for short checkout tokens. No UI changes.

**Files:** `irlid-api/src/index.js`, `irlid-api/schema.sql`, `js/orgapi.js`.

**Behaviour:**
- Add idempotent D1 migration: `org_checkout_tokens` table (token PK, checkin_id, org_api_key, created_at, expires_at, consumed_at NULL).
- Add `POST /org/checkout-token` — body `{checkin_id}`, returns `{token, expires_at}`. Rate-limit per org per checkin (one active token at a time — replace previous).
- Add `GET /org/checkout-token/:token` — returns the data needed by `org-entry.html` to continue checkout (org_api_key, checkin_id, nonce, event, logo). Reject if expired or consumed.
- TTL: 5 minutes.
- Mark `consumed_at` when token used by `org-entry.html`.
- Do not backfill or rewrite old check-ins.

**Acceptance:**
- Token can be created for an active check-in (200 + token)
- Valid token resolves and returns the original checkout payload (200 + payload)
- Expired token returns 410 Gone with clear body
- Unknown/consumed token returns 404 Not Found
- Idempotent migration: re-running the apply script doesn't error on existing schema

**Branch:** `codex/batch16-task1-checkout-token-api`
**PR title:** `[codex] Checkout token API foundation`
**Commit prefix:** `feat(api):`

## Task 2 — Short Checkout QR UI

**Goal:** Replace long checkout URLs with short Worker-backed tokens so checkout QR codes render at scannable density on large screens and mobile devices.

**Files:** `org.html`, `org-entry.html`, `js/orgapi.js`.

**Behaviour:**
- When org dashboard renders a checkout QR, first call `POST /org/checkout-token` with the active checkin_id. Receive the token.
- QR encodes a short URL: `org-entry.html?type=checkout&t=<token>` instead of the full payload.
- `org-entry.html` checks for `?t=<token>`, calls `GET /org/checkout-token/:token` to resolve, then continues the existing signed checkout path with the resolved payload.
- If token creation fails (Worker error, 5xx): show a clear inline error in the checkout QR box ("Could not create checkout token — try again"), do NOT show a blank QR box.
- If token resolution fails on `org-entry.html`: show a clear error (expired/unknown), do not crash.

**Acceptance:**
- Checkout QR encodes the short token URL, NOT the full payload
- Token URL substantially shorter (visible inspection: <80 characters vs current ~200+)
- Checkout QR pixel-density visibly lower (fewer modules) — passes scannability check on a 27" desktop monitor at arm's length
- Valid token resolves end-to-end: scan QR on phone → org-entry.html → signed checkout → receipt issued
- Expired/unknown token shows clear error message
- Token creation failure shows inline error, not blank QR

**Branch:** `codex/batch16-task2-short-checkout-qr`
**PR title:** `[codex] Short checkout QR tokens`
**Commit prefix:** `feat(qr):`

---

# Stop points

- After **each batch's last PR** is merged + deployed: stop. Report to Captain. Wait for go-ahead before next batch.
- After **each task within a batch**: report PR link, deployment state, any D1 migration applied. Continue to next task in same batch unless Captain says otherwise.

# Reporting back

Standard pattern per task: PR description with what shipped + what didn't + any surprises. Chat summary at session close. Browser smoke test results. If you hit a context-compact wall mid-task, commit what you have and continue in a fresh session — that worked in Batch 7→8.

— Number One, drafted ahead in case I'm at weekly cap when you need this
