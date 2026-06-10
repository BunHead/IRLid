# HANDOVER — Settings nav vanishing on refresh (v6.3.11)

**Author:** Number One · **Date:** 8 Jun 2026 · **Target:** Mr. Data
**File:** `Org.html` only. Frontend-only. No Worker / D1.
**Verdict gate:** Number One bash-diffs against `origin/main` before merge. Captain hardware-smokes after deploy (this one needs a real refresh on his signed-in session).
**Lead the PR description with the A/R/D verdict marker.**

Bump build pill `v6.3.12 → v6.3.13` and `sw.js CACHE_VERSION` `v131 → v132`. (Renumbered: v6.3.11 = masthead-bg/save-button; v6.3.12 = masthead full-gradient.)

---

## Problem
After a page refresh, the **Settings** nav item (`#navSettings`) sometimes disappears. A full sign-out/in brings it back. Intermittent — looks like a race.

## Root cause (traced in code)
`#navSettings` is role-gated `data-min-role="lead_admin"`. Visibility is applied by `applyRoleGatedVisibility()` (≈L15011), which uses `effectiveRoleRank()` (≈L14981). `effectiveRoleRank` → `realSessionRoleRank()`:
```js
function realSessionRoleRank() {
  if (qrLoginSession?.is_developer) return PROTOTYPE_ROLE_RANK.developer;
  return roleRankFor(currentOrg?.role);
}
function effectiveRoleRank() {
  const rank = realSessionRoleRank();
  return Number.isFinite(rank) ? rank : PROTOTYPE_ROLE_RANK.staff;   // ← fallback to STAFF
}
```
On a refresh, if `applyRoleGatedVisibility()` runs **before** `qrLoginSession`/`currentOrg.role` have restored, the rank falls back to **staff** — which is below `lead_admin`, so `#navSettings` is hidden. And `applyRoleGatedVisibility()` is only called from the debug toggle (L13751) and the prototype-role setter (L17360) — **neither guaranteed to re-run after the session restores** on a plain refresh. So Settings stays hidden until a sign-out/in (which re-runs the gate).

## Fix
Re-apply the role gate once the session + org are known. The signed-in-UI updater function (the one that sets `#sidebarOrgName`/`#sidebarOrgPlan` and calls `updateChromeLogo()`, **ending at ≈L13079**) has both `currentOrg` and `qrLoginSession` in hand — add a gate re-apply just before its closing brace (L13079):
```js
// v6.3.11 — re-apply role gating now the session + org are resolved, so role-gated nav
// (#navSettings = lead_admin) isn't left hidden after a refresh where the gate ran before
// the developer session restored (effectiveRoleRank had fallen back to staff).
if (typeof applyRoleGatedVisibility === 'function') applyRoleGatedVisibility();
```
**Belt-and-braces (optional but recommended):** also call `applyRoleGatedVisibility()` at the end of `loadDashboardForOrg()` (after `currentOrg` is set), so any cached-snapshot/restore path that doesn't route through the signed-in-UI updater is still covered.

## Acceptance
- Sign in as developer, navigate to Settings, then **hard-refresh** several times: the Settings nav item stays visible every time (no vanish).
- Non-privileged roles (attendee/staff) still correctly DON'T see Settings — the gate still gates; it just runs at the right time now.
- No JS errors; no change to any other role-gated element's behaviour.

## Scope guards
- `Org.html` only. No Worker / D1.
- Don't touch the role-rank logic itself (`effectiveRoleRank`/`realSessionRoleRank`) — the staff fallback is fine as a default; the fix is purely WHEN the gate runs.
- Bump pill v6.3.10→v6.3.11 + sw.js v129→v130.
