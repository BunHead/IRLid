# HANDOVER — Mr. Data — `v6.2.0` — Manager permissions matrix (per-org, Lead-Admin-set)

**Branch:** `codex/v6.2.0-manager-permissions`
**Why:** Different orgs need different things. Some want Managers to run the calendar; others
don't. Today calendar writes are gated at lead_admin+ (a Manager device gets
`insufficient_role`). This adds a per-org, Lead-Admin-controlled switch that grants Managers
specific capabilities — starting with calendar editing — without opening whole Settings tabs.

**Design principle (IRLid):** optional, **default OFF**, settings-gated, never prompted.
Governance stays tight: only safe-to-delegate capabilities appear; Staff invite and the
permissions config itself are NEVER delegatable.

---

## What to build

### A. The matrix UI — in the **Sign-in & Auth tab** (tab 5)
- New **"Manager permissions"** section, visible to **lead_admin + developer only**
  (use the existing role-gating helper / `effectiveRoleRank()`; hide entirely for lower roles).
- A small matrix: rows = capabilities, one column = **Manager** (the only configurable role).
  Ship **one row** to start: **"Managers can create / edit / delete calendar events."**
  Checkbox, **default OFF**.
- Saved via "Save all settings" into `settings_json.manager_perms` (e.g.
  `{ "calendar": true }`). Hydrate the checkbox from the server on load.
- Leave room to add rows later (theming, CSV export, etc.) — build it as a list, not a
  one-off checkbox.

### B. Worker enforcement (`irlid-api-org/src/index.js`)
- The calendar-write action (`irlid_calendar_write_v5` create/update/delete) min-role check
  in `requireSignedAction` must consult the org's `settings_json.manager_perms.calendar`:
  - flag **true** → accept role `manager` (and above).
  - flag **false / absent** → require `lead_admin` (and above) as now.
- developer/lead_admin always pass regardless (unchanged). attendee/staff never pass.
- **Do NOT** make any OTHER action manager-gradable in this PR (invite, settings, lead-admin
  appointment stay lead_admin+/developer-only). Calendar is the only delegatable capability
  for now.

### C. Frontend tab/control gating
- When `manager_perms.calendar` is true AND the signed-in user's role is `manager`, reveal the
  **Event & Calendar** tab + the Add/Edit/Delete event controls for that user. Otherwise a
  manager does not see them (current behaviour).
- This is read-time gating off the role + the flag — no new endpoint.

---

## Validation / safety
- `settings_json.manager_perms` validated as an object of known boolean keys; ignore/strip
  unknown keys. Reject non-boolean values.
- The **Sign-in & Auth tab itself stays lead_admin+/developer only and is never delegatable** —
  it's the permission config; delegating it would be a privilege-escalation hole.
- Persisting the flag must NOT change anyone's stored role — authority is computed at
  request time from (role + flag), never by mutating `org_memberships`.

## Test dependency (call out in PR)
Proper end-to-end needs a **manager-role device**. Either seed a manager `org_memberships`
row for a test device, or use the prototype role switcher if it drives the real gating.
Smoke MUST be done with Captain (needs the developer device to set the flag + a manager
identity to test the grant). Do NOT claim end-to-end without that.

## File touch list
| File | Change |
|---|---|
| `Org.html` | Manager-permissions matrix in Sign-in & Auth (lead_admin+ only); Save-all into `manager_perms`; hydrate; manager-side tab/control reveal when flag on |
| `irlid-api-org/src/index.js` | calendar-write min-role consults `manager_perms.calendar` |
| `sw.js` | cache bump |
| Build pill | → `v6.2.0` |

## A/R/D expectations
- **✅ ACCEPT ✅** — Lead Admin ticks "Managers can edit calendar" → Save → a manager device
  can then create/edit/delete events (was `insufficient_role`); untick → manager blocked again;
  developer/lead_admin unaffected; staff/attendee never gain access; Sign-in & Auth tab still
  lead_admin+ only.
- **⚠️ REVIEW ⚠️** — Flag persists but Worker still hard-gates lead_admin (UI/Worker mismatch);
  matrix visible to managers; other actions accidentally manager-gradable.
- **⛔ DENY ⛔** — Delegates Staff invite / Sign-in & Auth / lead-admin appointment to managers;
  mutates `org_memberships` to grant authority; schema change.

## Smoke (with Captain — 2 identities)
1. Developer device: Sign-in & Auth → tick "Managers can edit calendar" → Save all → ✓
2. Manager device: now sees Event & Calendar tab; create an event → authorizes & saves
3. Developer unticks → Save → manager device blocked again (`insufficient_role`)
4. Staff/attendee device never sees the tab; Sign-in & Auth never visible to manager

— Number One (4 June 2026)
