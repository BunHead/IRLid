# HANDOVER — Mr. Data — `v6.2.1` — Gate privileged settings behind a Lead-Admin+ session

**Branch:** `codex/v6.2.1-settings-auth-hardening`
**Sequence:** ship **AFTER v6.1.30 merges** — both touch the `Org.html` settings-save call site;
running them in parallel risks a conflict. Cut this branch off the v6.1.30-merged main.

## Why (security) — CONFIRMED EXPLOITABLE, not theoretical
Number One verified the blast radius in the live Worker (5 June):

- `userListOrgs` (`/user/orgs`, **L1592-1609**) returns `o.api_key` to **every member regardless
  of role** — `SELECT m.role, o.id, o.name, o.slug, o.api_key ...` mapped to `api_key: m.api_key`
  with no role filter. The code comment admits it: *"api_key is returned to authorized members so
  the existing X-Org-Key dashboard code can keep working during the v5.5 transition."*
- `orgUpdateSettings` (`/org/settings`, **L2540**) authenticates via `orgAuth` (**L5010**) = **api_key
  only, NO role check**. `manager_perms` is in its allowlist (L2559) and validated (L2742) but never
  authorised.
- **Therefore:** a Manager signs in → `/user/orgs` hands them the org api_key → they POST
  `/org/settings` with `manager_perms.calendar = true` (X-Org-Key) → `orgAuth` accepts → **they grant
  themselves calendar-write**, defeating the v6.2.0 permission gate. Live today.

Broader note (NOT this ticket — flag for §14.9): because the api_key is handed to all members, ANY
member can currently write ANY setting (theme, branding, calendar_defaults). That's lower-severity
(cosmetic/operational, not privilege escalation). The real long-term fix is the §14.9 roadmap: move
dashboard writes onto Bearer-session auth and return api_key to service accounts only. v6.2.1 closes
the one field that is an actual **escalation** — `manager_perms` — and leaves the rest for that work.

## The fix — two surgical parts

### Part 1 — Worker: gate governance fields behind a lead_admin+ SESSION (`irlid-api-org/src/index.js`)
In `orgUpdateSettings`, right after `const org = await orgAuth(...)` and after `body` is parsed,
add the gate. Reuse the existing helpers (`requireSession`, `orgRoleForUser` — which already returns
`"developer"` for a bootstrap-fp user via `isBootstrapDeveloperFp`):

```js
// v6.2.1 — privilege-DEFINING fields require a lead_admin+ SESSION, not just the api_key.
// The org api_key is handed to every member via /user/orgs (L1592), so api_key-only auth
// would let a Manager self-escalate by POSTing manager_perms. Gate the RBAC-sensitive field(s).
const GOVERNANCE_FIELDS = ["manager_perms"]; // extend here if a field ever becomes authority-bearing
if (GOVERNANCE_FIELDS.some(f => body[f] !== undefined)) {
  const ctx = await requireSession(request, env);
  if (ctx.error) {
    return json({ error: "insufficient_role",
      message: "A Lead Admin or Developer session is required to change manager_perms." }, 403);
  }
  const callerRole = await orgRoleForUser(env, ctx.user, org.id);
  if (callerRole !== "lead_admin" && callerRole !== "developer") {
    return json({ error: "insufficient_role",
      message: "Only Lead Admins and Developers can change manager_perms." }, 403);
  }
}
```
- **Reject, don't silently drop** — a request that tries to set `manager_perms` without the session
  gets a 403, so the caller knows. Non-governance settings in the same body are unaffected only if
  `manager_perms` is absent; if present-and-unauthorised the whole request 403s (acceptable — the UI
  only sends `manager_perms` from the lead-admin+ surface).
- Do NOT touch `orgAuth`, the allowlist, theme/calendar validators, or the schema.

### Part 2 — Frontend: send the Bearer session on the settings save (`Org.html` + `js/orgapi.js`)
Today `updateOrgSettings(currentOrg.api_key, payload)` (Org.html **L9755**) sends **only** X-Org-Key,
so the Worker has no session to resolve → the new gate would 403 even a legit Lead-Admin save.
Fix: pass the session token through so the Worker can resolve the caller's role.
- `js/orgapi.js`: extend `updateOrgSettings(orgKey, payload, sessionToken)` to set
  `opts.sessionToken = sessionToken` (the `request()` helper already turns that into
  `Authorization: Bearer …`, L44). Keep `orgKey` → `X-Org-Key` as now (both travel together).
- `Org.html` save sites (the visual-theme save ~L9755 **and** any other `updateOrgSettings(...)`
  call): pass the live session token — `qrLoginSession?.session_token` (fall back to undefined; a
  service-account/api-key-only save simply can't set `manager_perms`, which is correct).
- This is why it sequences after v6.1.30 — that ticket reworks this same save path.

## Out of scope
- Removing api_key auth or stripping api_key from `userListOrgs` (breaks manager dashboard READS,
  which still go through X-Org-Key — that's the bigger §14.9 migration, not this).
- Gating non-governance settings (theme/branding/calendar_defaults) — separate decision.
- Schema changes; the manager-perms UI (shipped v6.2.0).

## File touch list
| File | Change |
|---|---|
| `irlid-api-org/src/index.js` | `orgUpdateSettings`: lead_admin+ **session** gate on `manager_perms` (reject 403, don't drop) |
| `js/orgapi.js` | `updateOrgSettings` accepts + forwards `sessionToken` |
| `Org.html` | settings-save call sites pass `qrLoginSession?.session_token` |
| Build pill | monotonic above whatever v6.1.30 ships |
| `sw.js` | cache bump |

## A/R/D expectations
- **✅ ACCEPT ✅** — Developer/Lead-Admin session still sets `manager_perms` and it persists; an
  api_key-only request (or a Manager session) that tries to set `manager_perms` gets `insufficient_role`
  (403); theme/branding/calendar_defaults still save normally for whoever could save them before.
- **⚠️ REVIEW ⚠️** — Gate applied but a Manager session still passes; or legit Lead-Admin saves now
  403 because the frontend isn't sending the session token (Part 2 incomplete).
- **⛔ DENY ⛔** — Removes api_key auth wholesale (breaks dashboard reads); strips api_key from
  `userListOrgs` (breaks manager reads); schema change; still lets a Manager set `manager_perms`.

## Smoke (with Captain — needs a Manager identity, e.g. Becky on the Nokia)
1. As Developer (Captain, 8 Pro): toggle managers-can-edit-calendar → Save → persists (unchanged).
2. As Manager (Becky): attempt to save `manager_perms` (UI if reachable, else a direct POST with her
   api_key) → **rejected `insufficient_role` 403**.
3. Theme / branding / calendar_defaults still save fine for the Developer/Lead-Admin.

— Number One (rewritten 5 June 2026 with confirmed live-Worker findings)
