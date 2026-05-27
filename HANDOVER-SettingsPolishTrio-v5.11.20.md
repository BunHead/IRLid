# HANDOVER — Mr. Data — `v5.11.20` — Settings polish trio

**Owner:** Mr. Data
**Type:** UI + light Worker round-trip. **No D1 schema changes. No new endpoints.** Three independent Settings polish items Captain surfaced after the v5.11.19 Check-in tab smoke.
**Live file:** `D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\Org.html` (+ minimal touch to `js/orgapi.js` only if needed for Role Vocab; do not touch Worker source unless absolutely necessary)
**Target build pill:** `v5.11.20`
**SW cache bump:** `irlid-shell-v57 → v58` (current is `v57` after v5.11.19a; if v57 isn't on origin yet, use v58 anyway — cache bumps are monotonic and one accidental skip is harmless)
**Parallel work:** None — Number One is in a holding pattern for follow-up polish on the Check-in tab. Pull `origin/main` immediately before starting AND immediately before pushing.

---

## Three items, all independent — split into three commits on the same branch if it helps you, or one if cleaner

### Item 1 — Role Vocab persistence

The Role vocabulary inputs in the **Staff & Rooms** tab (`Org.html:~6172` — `<details class="v511-expander"><summary>Role vocabulary…</summary>`) currently edit local state but **don't survive a page refresh**. The four inputs are:

```html
<div class="v511-row"><label>Attendee</label><input type="text" value="Member" /></div>
<div class="v511-row"><label>Staff</label><input type="text" value="Instructor" /></div>
<div class="v511-row"><label>Manager</label><input type="text" value="Studio Manager" /></div>
<div class="v511-row"><label>Lead admin</label><input type="text" value="Owner" /></div>
```

These have **no `id` attributes** — first thing to do is add them: `id="v511RoleVocabAttendee"`, `id="v511RoleVocabStaff"`, `id="v511RoleVocabManager"`, `id="v511RoleVocabLeadAdmin"`.

The save target is the existing **`POST /org/settings`** endpoint (it already round-trips `theme.roleVocabulary` per the prior `v5.10.x` polish round). Inspect `theme.roleVocabulary` shape via the existing Worker GET `/org/settings` — it's likely an object like `{ attendee: "Member", staff: "Instructor", manager: "Studio Manager", lead_admin: "Owner" }`. Use that exact key shape so `window.roleLabel(key)` (which already exists at `Org.html:~15370` and is read by the Invite Staff demo modal you shipped in PR #54) keeps working.

**Wire-up steps:**

1. Add IDs to the four inputs as above.
2. On page load (after `loadThemeFromServer` completes), populate the four inputs from `activeTheme.roleVocabulary?.attendee` etc., with the existing default strings as fallback.
3. Hook the existing **Save all settings** button (in Staff & Rooms tab — there's already a `v511-save` button block convention) to include the four values in the `theme.roleVocabulary` POST payload.
4. After successful save, flash the existing `.v511-saved-pulse` `&check; Saved` badge inside the Role vocabulary `<details>` summary (see Item 3 — there's already a `v511RoomVocabSavedPulse` pattern at `Org.html:~6182` to copy).
5. Verify round-trip: edit → Save → hard-refresh → values persist.

**Note Captain wrote:** *"Role Vocab still not saving (different save badges popup all over the place, should be consistent across site)"* — the second clause is Item 3, but the consistency target IS the badge you flash here.

### Item 2 — "+ Add event" past/future label

The Event & Calendar tab's `+ Add event (past)` button at `Org.html:~5994` (and possibly other places where it's rendered per-day in the calendar) **always shows `(past)`** regardless of whether the visible day is actually in the past, present, or future.

Captain's directive: dynamic suffix based on the currently visible day's date relative to today.

**Behaviour:**
- Visible day is **before today (00:00 local)** → button text: `+ Add event (past)`
- Visible day is **today** → button text: `+ Add event` (no suffix)
- Visible day is **after today** → button text: `+ Add event (future)`

The calendar view tracks the current day via the date label at the top of the day card ("Wednesday 2026-05-26" etc.). There's likely an existing `selectedDay` / `currentDay` state variable in the calendar JS — find it (grep for `v511Cal` or `currentDay` or the date-label render site) and read it to compute the suffix.

If the calendar view is showing multiple days (week view), each day's "+ Add event" button needs its own suffix based on that day's date. Apply the same logic per-button.

**Important:** Don't change the button's `onclick` behaviour — the suffix is text-only, the click handler stays as-is (opens the existing Add Event modal).

### Item 3 — Save badge consistency

Captain: *"different save badges popup all over the place, should be consistent across site"*. The site has several save-flash patterns inherited from different waves of work:

- `.v511-saved-pulse` with `&check; Saved` (the green flash used in Room vocabulary at `Org.html:~6182` and Event defaults at `~6024`) — **this is the canonical one**
- Toasts via `showToast('Theme saved', false)` etc.
- Console-only logs (no visible feedback)
- Static "Saved" labels that don't animate
- (Possibly others — sweep the file)

**Sweep + unify:**

1. Grep the file for all "Saved", "save", "saved-pulse", "savedPulse" patterns and identify each distinct flash mechanism.
2. Pick `.v511-saved-pulse` as the canonical pattern.
3. For each save action that currently uses something different (and is visible to the user), replace its feedback with a `.v511-saved-pulse` flash anchored to the relevant `<summary>` or panel header.
4. Toast feedback for cross-cutting save actions (e.g. "Save all settings" at the bottom of a tab) is fine to keep IF it's the only feedback path — but if a per-section save badge already exists, the toast becomes redundant; pick one.
5. Light/dark theme parity — confirm the green flash colour reads on both themes.

This is judgement-call work — apply taste. If you're unsure on a specific site, leave it and note it in the PR description so Captain can call it.

---

## What NOT to touch

- The Check-in tab inline clone (`#v511InlineCheckinStage`), `#venueQRWrap`, `#v511ThemePreviewStage`, `fullscreenQR()`, the `v5.11 Tier 1 — Visual theming live wiring` IIFE, `renderInlineCheckinClone`, `setupInlineCheckinCloneObserver`, `testInlineCheckinAnimation`, the `.qr-info` block in the Check-in tab area at `Org.html:~3506`. Captain settled the Check-in tab layout at v5.11.19 — leave it alone.
- The Invite Staff demo modal from PR #54 (`v511InviteStaff*` namespace). It works and Captain's happy with it.
- The Worker (`irlid-api-org/`). The `POST /org/settings` endpoint already handles arbitrary `theme.*` shape; no Worker-side change needed for Role Vocab.
- D1 — no migrations.
- The legacy `v5.10.x` Invite Staff path (`inviteStaffBtn` at `Org.html:~10363`, `openInviteStaffDialog`, `createStaffInvite`).

---

## File touch list

- `Org.html` — single file (HTML id additions, JS wire-up, CSS only if a save badge needs styling)
- `js/orgapi.js` — only if you need a new helper method (probably not; `saveSettings()` already round-trips `theme.*`)
- `sw.js` line 15 — cache bump `v56 → v57`
- Build pill bump `v5.11.19 → v5.11.20`

**Do NOT** touch: `irlid-api-org/`, any D1 file, `scan.html`, `org-entry.html`, `org-login.html`.

---

## A/R/D verdict expectations for Number One's bash-diff

Number One will run `git diff origin/main..origin/codex/v5.11.20-settings-polish -- Org.html js/orgapi.js sw.js` before merge.

- **✅ ACCEPT ✅** — Diff is bounded to the three items. Role Vocab inputs gained IDs + round-trip through existing `theme.roleVocabulary`. "+ Add event" suffix is computed dynamically from the visible day's date. Save badges sweep replaces inconsistent feedback with `.v511-saved-pulse`. No touches to Check-in tab clone area, no Worker changes, no D1 changes, no `staffInvite*` legacy touches.
- **⚠️ REVIEW ⚠️** — Worker file modified (should be unnecessary); D1 migration added; new `staff_session` plumbing added; localStorage persistence added for Role Vocab (it should round-trip through Worker, not just stay client-side); save badge change accidentally regresses an existing flash.
- **⛔ DENY ⛔** — Check-in tab inline clone modified; Invite Staff demo from PR #54 modified; Worker endpoint signature changed; D1 schema migration; entirely new save-badge framework introduced (use the existing `.v511-saved-pulse`).

---

## Smoke test Captain will run

1. Open `https://irlid.co.uk/Org`, sign in, navigate **Settings → Staff & Rooms**.
2. Edit a Role vocabulary label (e.g. change "Member" → "Tester"). Click **Save all settings**. Green `&check; Saved` flashes.
3. Hard-refresh the page. Value persists. The Invite Staff demo modal's Role dropdown shows "Tester" not "Member" (because it reads via `window.roleLabel('attendee')`).
4. Navigate to **Event & Calendar**. Use Prev week / Next week to find a day in the past — its "+ Add event" reads `(past)`. Today's reads no suffix. Future day reads `(future)`.
5. Save badges flash consistently across every section that has a save action — same colour, same shape, same animation duration.

If all 5 pass, ✅ ACCEPT.

---

**Captain's words verbatim:** *"As for Settings, Role Vocab still not saving (different save badges popup all over the place, should be consistent across site) and +Add event, always shows (past), more work for Data maybe?"*

Ship clean.

— Number One
