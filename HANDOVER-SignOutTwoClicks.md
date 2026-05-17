# HANDOVER — Sign-out single-tap mobile fix (v5.10.4)

**Target:** `v5.10.4` (adjust to next available patch — current main is `v5.10.2` at commit `9f7c220`; CSV completeness brief is targeting `v5.10.3`).
**Branch:** `codex/v5.10.4-signout-two-clicks`
**PR title:** `[codex] v5.10.4 — Sign-out single-tap mobile fix`
**Scope:** Small (~10–15 lines CSS).
**Repo:** LIVE `BunHead/IRLid`. Verify `git remote -v` before starting.

---

## Why

Captain reported on 10 May 2026: "sign-out required two clicks on both phones to register the first time; subsequent sign-outs were instant." Logged as paper-cut polish since then. Workaround: tap twice.

The "first-tap-eaten" pattern across two different Android phones (Pixel 8 Pro, Pixel 4a) on both Chrome and Edge is the classic mobile-tap-delay or hover-reveal-first behaviour. Shotgun fix: apply standard mobile-tap defenses to both sign-out buttons.

## What

Two sign-out buttons in `OrgCheckin.html`:

1. **`#signOutBtn`** — topbar button, around line 3307. Uses inline `onclick="signOutOrg()"`. Visible on every panel.
2. **`#signedInSignOutBtn`** — inside `#signedInSummary` card, around line 3323. Wired via `addEventListener('click', signOutOrg)` at line ~9002. Visible only when on the Organisation tab while signed in.

Both should single-tap reliably on first attempt across iOS Safari, Android Chrome, Android Edge, and desktop.

## File-by-file changes

### 1. `OrgCheckin.html`

In the `<style>` block, add or extend rules for both sign-out buttons. Place near the existing button styles (search for `.btn-secondary` or similar):

```css
#signOutBtn, #signedInSignOutBtn {
  touch-action: manipulation;
  cursor: pointer;
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);
}
```

**Why each rule:**
- `touch-action: manipulation` — eliminates the 300ms double-tap-zoom delay that Android Chrome applies to non-explicitly-tap-marked elements. This alone resolves most "first-tap eaten" cases.
- `cursor: pointer` — forces iOS Safari to treat the element as actively clickable rather than requiring a hover-reveal tap first.
- `-webkit-tap-highlight-color: rgba(0, 0, 0, 0.1)` — keeps a subtle tap flash so the user gets visual confirmation when their tap registers (preserves the feedback some users rely on; don't set to `transparent`).

If the existing `<style>` block already has rules for `.btn-secondary` or buttons in general, prefer extending those instead of adding sign-out-specific selectors. Inspect existing button styles first.

### 2. Build pill

Bump `Build v5.10.2` → `Build v5.10.4` (assuming CSV completeness lands first as `v5.10.3` — check current main tip before bumping; if `v5.10.3` not yet merged, bump to next available which may be `v5.10.3` instead).

### 3. `sw.js`

Bump `CACHE_VERSION` (currently `irlid-shell-v11`, expected to become `v12` after CSV completeness). Set to next-available. Comment line should reference this patch.

## Acceptance criteria (numbered, testable)

1. **Topbar Sign out** — tap from a phone (Android Chrome + iOS Safari + Android Edge if available). First tap fires the handler. Confirmed by:
   - "Signed out" toast appearing
   - Page returning to setup panel
   - Dashboard surfaces (Attendance, Settings) hidden

2. **Organisation tab → Signed-in summary → Sign out** — tap. First tap fires the handler. Same observable confirmation as (1).

3. **No regression** on desktop click behaviour. Mouse click still works as before.

4. Build pill bumped to the right version. SW cache bumped to the next-available version.

5. `git diff origin/main` net: ~10–15 lines of CSS added or extended. No JS changes. No HTML structural changes.

## Out of scope (do not touch)

- Touch event listeners (touchstart, touchend) — CSS-only fix should suffice. If CSS doesn't resolve, the cause is deeper than the 300ms delay; open a follow-up brief rather than escalating in this PR.
- Refactoring the sign-out flow logic (`signOutOrg` function in `OrgCheckin.html` at line ~5053). Only the tap responsiveness.
- The third sign-out path (`staffAuthClearBtn` at line ~3546, "Sign out staff") — that's a different concern (staff auth session, not org session). Don't touch.
- Site-wide button styling refactor. Just the two sign-out buttons.

## Risk + rollback

- **Risk:** if the existing `.btn-secondary` or similar global button rules already apply `touch-action: auto` or set the cursor differently, the more-specific rule wins by selector priority — fine. But if a different rule overrides at higher specificity (e.g., inline style), the fix won't apply. **Mitigation:** verify computed style on a phone before opening PR.
- **Risk:** `-webkit-tap-highlight-color` rendering may differ between iOS Safari and Chrome. **Mitigation:** the `rgba(0,0,0,0.1)` is intentionally subtle — works on both.
- **Rollback:** single commit revert; no schema, no logic changes.

## Verification before opening PR

```powershell
cd "<repo>"
git remote -v   # confirm: https://github.com/BunHead/IRLid.git
git switch main
git pull
git log --oneline -5   # confirm latest tip
```

After implementation: Captain smokes on hardware (8 Pro + 4a). If CSS-only fix doesn't resolve first-tap on both phones, open a follow-up brief.

## Discipline reminders (BOOTSTRAP §6)

- Pull `origin/main` right before starting.
- Diff every touched file against `origin/main` before opening PR.
- One PR per task. Scope expansion → stop and raise.
- Bump `sw.js` `CACHE_VERSION` (CSS changes propagate via stylesheet refresh on the cached HTML — bumping the cache forces eviction so phones pick up the new CSS).

---

Brief drafted 16 May 2026 by Number One. Captain reviewed and approved before push.
