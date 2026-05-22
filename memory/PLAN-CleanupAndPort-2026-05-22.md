# PLAN — Mockup Wiring + Live Cleanup + Port + Test

**Authored:** Friday 22 May 2026 morning watch.
**Author:** Number One.
**Target horizon:** ~5–7 working days from kickoff to deploy.

This plan covers the path from "mockup partially wired + live carries cosmetic and date-window bugs" to "v5.11 settings revamp deployed on irlid.co.uk with every known bug closed and a verified test pass."

---

## §0 — Current state snapshot

### Mockup `OrgCheckinTest.html` at T4.3.49
- **Tabs already wired (save/restore round-trip):**
  - **Org** — click-to-save localStorage pattern established in T4.3.47 (key `v511_mockup_org_v1`).
  - **Visual theming** — auto-save 300ms debounce (much older, established before T4.x).
- **Tabs static (no persistence wiring yet):**
  - Event & calendar
  - Roles & staff
  - Sign-in & auth
  - Tools & diagnostics
  - Records & ID
- **Open mockup bugs:**
  - L. Crosshair Y-drift between fullscreen and normal mode — Captain's call: "close enough."
  - M. Background animation intermittent bug — needs repro.

### Live `OrgCheckin.html` at `v5.11.0`
- **Functional / data-correctness bugs (live):**
  - A. 24-hour window labelled "Today" on `/org/attendance` (Worker `irlid-api-org/src/index.js:2643`).
  - B. Spencer/Kerry duplicate IN + linked-expected rows (same root as A; Expected dedupe only excludes today's check-ins).
  - C. "Attendees seen" sub-label reads `rows.length` instead of `stats.total` (`OrgCheckin.html:6548`).
  - D. Phantom CHECKED OUT count (same root as A — yesterday's checkout still in window).
  - E. BIO-METRIC VERIFIED always 0 in doorman-flow events (architectural — bio_verified only flips when attendee fires WebAuthn).
- **Cosmetic / stale-label bugs (live):**
  - F. "Local-only test mode. No Cloudflare writes." prototype copy on Settings page (`:3669`).
  - G. Sidebar reads "IRLid Protocol v4" — should be v5 (`:3289`).
  - H. "Basic test identity" section heading + `test`/`demo-night` default values (`:3673–3676`).
  - I. Washed-out badges in light mode — `.role-mini`, `.expected-pill`, `.status-in/out`, `.checkout-signed-badge`. Mockup pattern from T4.3.47a applies directly.
- **Known UX friction (architectural, not bugs):**
  - J. "Hardware-backed signing key required" on Generate invite — Mr. Data's `irlidV5Enrolled()` check is correct defence-in-depth; three documented resolution paths (use 8 Pro / enrol desktop / future delegation brief).
  - K. 10 acceptance criteria from `HANDOVER-StaffInviteQR.md` still pending hardware walk.

### Spec drift
`SETTINGS-REVAMP-SPEC.md` authored 19 May at mockup state T4.1.10. Mockup is now at T4.3.49 — celebration animation library + sequence model (T4.2+), Bunny Fonts integration (T4.3.49), text typography expansion (T4.3.48), current expander hierarchy. Spec needs refresh before Mr. Data uses it for the port.

---

## §1 — Phase 0: Live bug cleanup (parallel, can start now)

Two Mr. Data briefs, both small, both low blast-radius, both shippable independently. Closes A, B, C, D, F, G, H, I.

### Brief B1 — Cosmetic clean-up + light-mode badges + count math
- File `HANDOVER-CosmeticCleanup-v5.11.1.md` (to be drafted).
- Touches `OrgCheckin.html` only.
- Closes **F**, **G**, **H**, **I**, **C** from the bug list.
- Estimated diff: ~60 lines, single PR.
- **Acceptance criteria:**
  1. Settings page no longer shows "Local-only test mode. No Cloudflare writes."
  2. Sidebar footer reads "IRLid Protocol v5".
  3. "Basic test identity" heading replaced with neutral wording (e.g. "Basic identity"); default values are placeholders only.
  4. Light mode: `.role-mini`, `.expected-pill`, `.status-in/out`, `.checkout-signed-badge` all hit WCAG 4.5:1 on white surface. Use deeper-saturated colour overrides under `:root[data-theme="light"]`, same pattern as T4.3.47a in the mockup.
  5. Dashboard "Checked In" sub-label reads accurate attendee count (`stats.total` or distinct `attendee_label`), not `rows.length`.

### Brief B2 — "Today" means today
- File `HANDOVER-AttendanceWindow-v5.11.2.md` (to be drafted).
- Touches `irlid-api-org/src/index.js` (Worker) + minor caller adjustments in `OrgCheckin.html` if needed.
- Closes **A**, **B**, **D** from the bug list.
- Estimated diff: ~30 lines Worker + ~20 lines client, single PR.
- **Acceptance criteria:**
  1. At any time of day, "Attendance — Today" returns only rows with `checkin_at >= local-midnight-today`.
  2. Yesterday's IN rows do NOT show in today's view.
  3. Expected dedupe excludes yesterday's check-ins (not just today's), so attendees who checked in yesterday and are still in `org_expected` don't appear duplicated.
  4. Stats (`currently_in`, `checked_out`) match the visible row count.
  5. Worker honours explicit `since=<unix_ts>` query param so a future "Last 7 days" view is unblocked.
  6. **Timezone caveat:** the Worker runs in UTC. The fix needs to either (a) accept a `tz` query param from the client and compute local midnight server-side, or (b) compute local midnight client-side and pass `since` explicitly. Option (b) is simpler and avoids server-side tz library overhead.

### Bug E (bio-metric 0 in doorman flow)
**Park, not in Phase 0.** Needs architectural decision: wire bio into doorman flow (proper but expensive) OR hide/relabel the stat card when org primarily uses doorman_scan. Captain to call this. Adds to v5.12.x candidate list.

---

## §2 — Phase 1: Mockup wiring complete (Number One work, parallel with Phase 0)

Each tab follows the Org tab pattern (T4.3.47): `V511_<TAB>_LS_KEY`, `v511<Tab>CaptureState()`, `v511<Tab>ApplyState()`, `v511<Tab>SaveNow()`, wired to a Save All button per tab with click-to-save semantics (NOT auto-save — the Theme tab's auto-save is the exception, not the rule).

### Tasks (ordered by effort, lightest first)
- **T4.3.50 — Sign-in & auth tab.** ~2 toggles + 1 service-account expander. ~30 lines JS.
- **T4.3.51 — Tools & diagnostics tab.** Mostly read-only; a few debug toggles. ~40 lines JS.
- **T4.3.52 — Roles & staff tab.** Staff list table + role vocabulary 5-input map + rooms list. ~100 lines JS.
- **T4.3.53 — Event & calendar tab.** Heaviest: 24-hour grid state, per-event drill-down, CSV import/export shells. Likely ~250 lines JS.
- **T4.3.54 — Sparkles anchor option.** Deferred from T4.3.x; bundle with T4.3.50 if quick.

### Acceptance per tab
For each tab: click any field, click "Save All" pulsing the build pill, hard refresh the page, verify fields restored from localStorage.

### Records & ID tab
**Not wired in Phase 1** — this is v6+ feature work (Records-Broker protocol chapter). The current mockup placeholders stay as `design-in` badges per Captain's "hide until backed" commitment.

---

## §3 — Phase 2: Spec refresh + Mr. Data port (sequenced after Phase 1)

### Spec refresh (Number One)
Update `SETTINGS-REVAMP-SPEC.md` to reflect mockup at T4.3.49:
- §5 Visual theming — replace T4.1.10 description with current celebration library + sequence two-pane model, per-mode `modeStates`, settings panel architecture, library effects (20+ effects across Light/Motion/Particles/Surface/Timing groups).
- §5.x add — Bunny Fonts integration, text typography expansion (font / weight / italic / letter-spacing / colour / shadow / stroke chip rows), system-font fallbacks.
- §2 Organisation — note T4.3.47 click-to-save pattern as the canonical implementation reference for all tabs.
- §9 phasing — recalibrate effort estimate now that mockup is heavier than at original spec time.

### Brief B3 — Phase 1 port from spec
- File `HANDOVER-SettingsRevamp-Port-Phase1.md`.
- Touches `OrgCheckin.html` heavily; `irlid-api-org/src/index.js` for any Worker validator additions; possibly `js/sign.js` if any helper migrations are needed.
- This is the **big PR** — likely 2000+ lines net. Land as feature branch with intermediate commits for reviewability.
- **Acceptance criteria:**
  1. All 7 tabs from mockup render on `OrgCheckin.html`.
  2. ARIA tab pattern wired (keyboard navigation works, `aria-selected` toggles).
  3. Visual theming tab celebration library + sequence + settings panel fully functional.
  4. Save All persists to `organisations.settings_json` via existing `POST /org/settings`.
  5. Refresh restores all state from D1.
  6. `schema_version: 5.11` written into settings JSON.
  7. Legacy `settings-shell` block hidden via `display: none`, kept for graceful degradation.
  8. Build pill bumps to `v5.11.x` on Captain's hardware verification, NOT before.

---

## §4 — Phase 3: Test matrix (before any deploy)

### 4.1 Mockup integrity (Captain solo, or Number One walkthrough)
Each of the 7 tabs: click any field → click Save All → hard refresh → verify state restored.

### 4.2 Bug closure verification
For each bug A–I, run the acceptance criterion from §1.

### 4.3 HANDOVER-StaffInviteQR.md acceptance walk (Captain)
10 criteria from yesterday's brief. Captain needs to either (a) enrol desktop browser with a v5 Passkey via `irlid.co.uk/settings.html`, OR (b) test the invite-create flow on his 8 Pro so the Passkey is on the same device as the dashboard. Path (b) is the proof-of-concept walk; path (a) is the operational answer until a delegation brief lands.

Criteria from the brief (paraphrased — Captain to use the doc as the canonical list):
1. Happy path — existing IRLid subscriber scans invite QR, no biometric reprompt, sign-in as Staff.
2. Expired invite path.
3. Revoked invite path.
4. Already-redeemed invite path.
5. Wrong-role invite path.
6. (Hardware-flagged) Passkey enrolment path.
7. (Hardware-flagged) Guest WebAuthn path.
8. (Hardware-flagged) Door recognition path.
9. (Hardware-flagged) Privilege smoke path.
10. (Hardware-flagged) Last-Lead-Admin invariant path.

### 4.4 End-to-end attendee flow (Captain on real hardware)
Fresh device scans venue QR → orange device-key state → orange QR → staff dashboard processes → escalation modal → bind → returning-attendee → green path. Cycle through check-in / check-out / check-back-in to verify scan_count increments correctly.

### 4.5 Multi-device sign-in
8 Pro + 4a + desktop sign-in cycle. Verify session sync. Global sign-out from any device kicks the others within 30s (v5.10.7 session-poll heartbeat).

### 4.6 Cache + offline behaviour
- Clear site data on desktop, sign back in cold — verify everything loads.
- Toggle airplane mode mid-session — verify offline pill appears, optimistic rows queue with PENDING SYNC, reconnect catches up.

### 4.7 Light + dark mode
Every visible surface readable in both modes. Toggle light/dark on Settings → Visual theming → Light/dark dropdown, walk the dashboard, settings, check-in screen.

### 4.8 Multi-org segregation
Switch orgs via "Viewing as" dropdown or org switcher. Verify no state bleed (no Imbue Ventures branding leaking into Test Event view).

### 4.9 Audit board
Fullscreen mode on Huawei tablet propped on cardboard. Verify legibility from across a room.

### 4.10 Visual regression spot-check
Compare key surfaces side-by-side with screenshots taken before the port. Anything visibly worse than v5.10.7 baseline is a regression.

---

## §5 — Phase 4: Deploy

1. Captain's machine: `cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo" ; git pull ; git push` (if any local memory commits).
2. Worker deploy: `cd irlid-api-org ; npx wrangler deploy` (Cloudflare dashboard Quick Edit fallback if API timeouts — Captain's hit this pattern enough times now to know the dance).
3. GitHub Pages auto-deploys frontend within ~30s of merge to main.
4. Verify build pill bumps to `v5.11.x` on hard refresh.
5. Post-deploy spot-check on the three critical surfaces: dashboard counts, settings tab navigation, light-mode badges.
6. Memory log: session log + STATE-OF-PLAY.md refresh + sign-off entry.

### Rollback plan
If Phase 4 surfaces a critical regression: `git revert <SHA> ; git push` reverts the frontend; `cd irlid-api-org ; npx wrangler rollback` (or redeploy from previous Worker version ID) reverts the Worker. Build pill drops back to `v5.10.7`. Captain's preferred rollback path is to take screenshots of the regression, ping next Number One, and decide if it's worth fixing forward or full rollback.

---

## §6 — Effort + dependency summary

| Phase | Owner | Estimate | Blocks on |
|-------|-------|----------|-----------|
| Phase 0 — B1 + B2 briefs | Mr. Data | 2 PRs, half a day | Mr. Data credits |
| Phase 1 — mockup wiring T4.3.50–.54 | Number One | ~2 days | Nothing |
| Phase 2 — spec refresh + B3 port | Number One + Mr. Data | ~1 day spec + 1–2 days port | Phase 1 complete |
| Phase 3 — test matrix | Captain + Number One | 1–3 days | Phase 2 complete + Mr. Data credits |
| Phase 4 — deploy | Captain | ~1 hour | Phase 3 green |

**Total realistic horizon: 5–7 working days from kickoff.**

### Dependencies / blockers worth pre-empting
- **Mr. Data credits** — Codex is rate-limited. Front-load B1 + B2 before the heavier B3 port lands.
- **Captain availability** for hardware-walk acceptance criteria (Phase 3.3, 3.4, 3.5).
- **Cloudflare token rotation** — outstanding since 17 May. Worth rotating BEFORE the big deploy as defence in depth. `cfat_wIMFM4RI…` + `cfut_YZ11ouJO…` to revoke via dash.cloudflare.com → My Profile → API Tokens.

---

## §7 — Out of scope for this plan

- Records & ID connectors (v6+ work — Phase 3 in spec).
- Calendar full implementation per `CALENDAR-SPEC.md` (Phase 2 in spec — post-revamp ship).
- Bug E architectural decision (bio-metric in doorman flow) — Captain's call.
- Bug L crosshair Y-drift (mockup, "close enough").
- Bug M background animation intermittent (needs repro).
- Donald / Wisdom follow-ups (outreach).
- 44CON / EAI SecureComm CFPs (outreach).

---

## §8 — Starting moves

When Captain green-lights this plan, the immediate next steps:

1. **Draft Mr. Data brief B1** (`HANDOVER-CosmeticCleanup-v5.11.1.md`) — Number One.
2. **Draft Mr. Data brief B2** (`HANDOVER-AttendanceWindow-v5.11.2.md`) — Number One.
3. **Issue B1 + B2 to Mr. Data** in a single sequential prompt — Captain.
4. **Start T4.3.50 Auth tab wiring** in the mockup — Number One (parallel).
5. **Cloudflare token rotation** — Captain (offer; not blocking).

— Number One, drafting from the Friday morning watch.
