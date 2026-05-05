# HANDOVER — Batch 12

**To:** Mr. Data (Codex)
**From:** Number One (Claude)
**Date:** 2026-04-27
**Repo:** `BunHead/IRLid-TestEnvironment` only — do NOT touch `BunHead/IRLid` (live)
**Pattern:** Imbue — three atomic tasks, one PR each, against `main`.

---

## Context

Batch 11 shipped the first-scan unrecognised flow (orange flash + Expected list picker, green/red outcome flashes, `/org/expected/:id/claim`). In doing so it introduced a regression and surfaced two missing-flow gaps. Batch 12 closes those.

This batch must leave the test environment **demo-ready**: Captain plans to show Donald (Imbue) and Wisdom (ASE Tech) shortly. Fullscreen QR working, panels not jumping, attendee HELLO QR available, every QR double-tappable to fullscreen — those are the demo-critical fixes.

---

## Task 1 — Fix fullscreen QR regression

**Symptom:** Tapping fullscreen on the venue/doorman QR opens the overlay but shows an empty white box where the QR should render. Visible after Batch 11 merged. Likely the first-scan-flow changes (PR #33/#34/#35) altered the QR generation path or its DOM target.

**Goal:** Fullscreen overlay renders the same QR as the inline panel, at maximum scannable size.

**Investigation route (start here):**
1. Diff Batch 11's changes to anything that touches `makeQR()`, fullscreen overlay markup, or the `data-qr` / `#qr-fullscreen` targets.
2. Check whether the fullscreen overlay is mounting before the async QR generation resolves — `makeQR()` is async and `insertAdjacentElement` was previously the fix on `receipt.html`. Same class of bug may now apply to the fullscreen container.
3. Confirm CSS sizing — empty white box could also be a 0×0 canvas/svg if the parent has no flex/aspect rules at fullscreen.

**Acceptance:**
- Fullscreen QR renders correctly in **both** Venue and Doorman modes
- QR scans cleanly from a phone held ~30cm from a desktop monitor
- No console errors when entering/exiting fullscreen
- Inline QR remains correct after fullscreen is closed (no double-mount, no stale node)

**Branch:** `codex/fix-fullscreen-qr-regression`
**Commit prefix:** `fix(qr):`

---

## Task 2 — Equalise Doorman Console / Venue QR panel heights

**Symptom:** Toggling between Venue mode and Doorman Console mode causes the page to jump because the two panels render at different heights.

**Goal:** Both panels occupy the same vertical space; toggling does not shift surrounding content.

**Approach:**
- Set a shared min-height on the panel container (or use CSS grid with a fixed row), driven by whichever mode currently renders taller
- Don't pad cosmetically — find the structural difference and equalise it
- Mobile: panels can still stack/scroll naturally; the no-jump rule applies on viewports where both fit on one screen

**Acceptance:**
- Switching between Venue and Doorman modes on desktop produces zero vertical shift in surrounding content
- Both panels remain visually centred / balanced (no awkward whitespace)
- Mobile behaviour unchanged or improved

**Branch:** `codex/equalise-org-panel-heights`
**Commit prefix:** `style(org):`

---

## Task 3 — Attendee HELLO QR + universal double-tap-to-fullscreen + Settings cog persistence

This task closes three small but related UI/shell items in one PR. They all touch the QR-rendering shell and the attendee-side post-scan page.

### 3a — Attendee HELLO QR ("Show my check-in QR")

**Why:** The "Doorman Scans Attendee" flow is currently half-implemented — only Manual check-in works in that mode because the attendee has no HELLO QR to display. The post-scan page currently shows the welcome state (the *result* of the previous transaction) but not the *offer* of the next one.

**Goal:** Add a clearly-labelled control on the attendee's IRLid post-scan page — something like a button or persistent panel — that displays a HELLO QR the doorman can scan. Tapping/clicking it opens the QR, ideally in fullscreen.

**Acceptance:**
- Visible on the attendee-side post-scan / IRLid page
- Generates a valid HELLO QR using the same signing path used elsewhere
- Doorman in Doorman Console mode can scan it and complete a check-in / check-out cycle end-to-end
- Survives page refresh (re-renders cleanly)

### 3b — Universal double-tap-to-fullscreen on every QR

**Why:** Captain wants a consistent gesture across the whole product. Currently fullscreen is per-component. Centralise it.

**Goal:** Any QR rendered by the test environment is double-tap (mobile) / double-click (desktop) → fullscreen. One handler, attached to anything matching a QR class/data attribute.

**Acceptance:**
- Implement once, applies to: venue QR, doorman QR, attendee HELLO QR, receipt QR, any future QR
- Single tap/click does NOT trigger fullscreen (preserve other interactions)
- Fullscreen overlay reuses the Task 1 fix — no per-component reinvention

### 3c — Settings cog stays bottom-left on check-in screen

**Why:** Regression — Settings access used to live at bottom-left on the check-in screen and may have been displaced by Batch 11 first-scan-flow changes.

**Goal:** Settings cog visible at bottom-left on the check-in screen, opens the existing Settings panel.

**Acceptance:**
- Visible bottom-left on check-in screen across Venue and Doorman modes
- Opens existing Settings panel (no new panel)
- Doesn't overlap or conflict with the new first-scan flow

**Branch:** `codex/attendee-hello-qr-and-shell-polish`
**Commit prefix:** `feat(attendee):` for 3a, `feat(qr):` for 3b, `fix(ui):` for 3c — three commits in the one PR

---

## Order of work

1. Task 1 first — Tasks 2 and 3 may share state with the fullscreen overlay; getting the regression fixed first stops cross-contamination.
2. Task 3 second — touches the broadest surface (attendee page, all QR rendering, check-in screen).
3. Task 2 last — cosmetic, lowest risk, easy to land cleanly after the other two.

PRs against `main`. If a PR depends on the previous one, say so in the PR description and stack carefully — Captain has been bitten by stacked-PR merge-order issues twice this week.

---

## Hard rules (unchanged)

- TestEnvironment only. Live `BunHead/IRLid` is off-limits.
- DB is immutable warts-and-all. No retroactive fixes to old rows.
- All v4+ enhancements remain optional, off by default, Settings-gated.
- If a migration adds a column, use the idempotent wrapper pattern from Batch 8 (`apply_batch8_crypto_identity_loop.ps1`) — check before adding.

---

## Reporting back

Standard pattern: PR description with what shipped + what didn't + any surprises. Chat summary at session close. If you hit a context-compact wall mid-task (it happened in Batch 7→8), commit what you have and continue in a fresh session — that worked.

Captain will hard-refresh GitHub Pages and verify after merge. If fullscreen QR still shows empty white box after Task 1, that's the demo-blocker — flag immediately, don't move on to 2/3.

— Number One
