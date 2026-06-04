# HANDOVER — Mr. Data — `v6.2.1` — Gate privileged settings behind a Lead-Admin+ session

**Branch:** `codex/v6.2.1-settings-auth-hardening`
**Why (security):** v6.2.0 added a `manager_perms.calendar` toggle that controls whether managers
can write the calendar. But the settings endpoint that *sets* that toggle, `/org/settings`
(`orgUpdateSettings`), is gated by **`orgAuth` — api_key only, NO role check** (Worker L4843-4850).
So the integrity of the whole permissions matrix depends on managers not being able to reach
`/org/settings`. If a manager holds the org api_key, they could POST their own
`manager_perms.calendar = true` and **self-escalate**, defeating the feature. This closes that door.

## DIAGNOSE FIRST (don't guess the blast radius)
Confirm whether managers actually receive the org `api_key`:
- Read `userListOrgs` / `/user/orgs` — does it return `api_key` to **all** members, or only
  developer/lead_admin? `grep` the Worker for where `api_key` is put on the `/user/orgs` response
  and check the role condition.
- If managers DO get the api_key → this is exploitable today (priority).
- If they DON'T → it's defence-in-depth, but still ship the gate (the feature's correctness should
  not silently depend on an unrelated endpoint's api_key distribution).

## The fix
In `orgUpdateSettings`, **require a Lead-Admin+ session to change privilege-defining fields.**
- Resolve the caller's role from their **session** (Bearer), not just the api_key — reuse the
  existing helpers (`orgRoleForUser` / `requireDevOrStaffSession` / `effectiveRoleRank` /
  `isBootstrapDeveloperFp`). Bootstrap developer + `developer`/`lead_admin` membership pass.
- If the request body includes **`manager_perms`** (and, for defence-in-depth, other RBAC- /
  governance-sensitive fields — at minimum `manager_perms`; consider `roleLabels`), require the
  caller's resolved session rank ≥ **lead_admin**. If they only present an api_key (or a
  lower-rank session), **reject that field** with `insufficient_role` (don't silently drop it).
- **Do NOT break existing flows:** non-privileged settings (theme, branding, calendar_defaults,
  minScore, etc.) keep working under the current api_key auth. Only the privileged field(s) get
  the stricter session gate. (If the diagnosis shows the api_key is widely held, raise a flag —
  broadening the gate to *all* settings writes may be warranted as a separate decision.)

## Out of scope
- Removing api_key auth entirely (service-account/dashboard flows rely on it).
- Schema changes.
- The manager-perms UI (v6.2.0 already shipped it).

## File touch list
| File | Change |
|---|---|
| `irlid-api-org/src/index.js` | `orgUpdateSettings`: session-role gate on `manager_perms` (+ any other governance fields); reject, don't drop |
| (tests) | add a case: api_key-only request with `manager_perms` → `insufficient_role` |

## A/R/D expectations
- **✅ ACCEPT ✅** — A Lead-Admin/Developer session can still set `manager_perms`; an api_key-only
  (or manager-session) request that tries to set `manager_perms` is rejected with
  `insufficient_role`; all other settings (theme, branding, calendar_defaults) still save normally.
- **⚠️ REVIEW ⚠️** — Gate applied but a manager session still passes; or non-privileged settings
  broke under the new check.
- **⛔ DENY ⛔** — Removes api_key auth wholesale (breaks dashboard); schema change; lets a manager
  set their own `manager_perms`.

## Smoke (with Captain — needs a Manager identity)
1. Developer/Lead-Admin: toggle managers-can-edit-calendar → Save → persists (unchanged from v6.2.0)
2. As a Manager (Kerry): attempt to save `manager_perms` (via the UI if reachable, or a direct
   POST) → rejected `insufficient_role`
3. Theme / branding / calendar_defaults still save fine for whoever could save them before

— Number One (4 June 2026)
