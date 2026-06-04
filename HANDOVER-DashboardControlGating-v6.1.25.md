# HANDOVER — Mr. Data — `v6.1.25` — Gate Dashboard dev tools (debug) + admin actions (role)

**Branch:** `codex/v6.1.25-dashboard-gating`
**Scope:** `Org.html` only (+ sw.js). No Worker, no schema — this is **frontend visibility
gating** (the Worker already enforces auth on the actual endpoints; this stops lower roles even
*seeing* controls they can't use).

## Two gaps to close (Captain, 4 June)

### A — Debug-gate the developer/maintenance tools
These should be **hidden when the debug toggle is OFF** (and shown when ON). Reuse the existing
`irlidDebugOn()` gate from v6.1.16 (`localStorage.irlid_debug`) — same pattern as the Check-in
debug surfaces. Gate, on the Dashboard:
- The **"Developer diagnostics"** section (header + body)
- **"Debug maintenance"** / **"Clear test attendance"** + its checkbox
- **"Process attendee scan"** panel
- **"File Explorer"** button
Default OFF → none of these show. Tick "Verbose logging" in Tools & Diagnostics → they appear.
(Belt-and-braces: these are also Developer-tier tools, so additionally require Developer role —
i.e. show only when `irlidDebugOn()` AND Developer. Confirm with Captain if he'd rather it be
debug-toggle alone.)

### B — Role-gate the admin actions (use the existing `effectiveRoleRank()` helper)
Hide these from roles below the threshold (the Worker still rejects them; this just hides the UI):
- **Delete record** (attendance row) → **lead_admin+**
- **Delete expected** → **lead_admin+**
- **Add / manage Expected attendee** ("Expected attendee management" — currently ungated) →
  **staff+** (day-to-day staff manage the expected list; attendees must never see it)
- **Initiate check-out** → **staff+** (leave as-is if already gated)

*(CONFIRMED by Captain 4 June: **lead_admin+ for deletes** — "Lead Admin has near as damned the
same privileges as Developer; can't have me popping by every time they need to delete someone."
So Lead Admin handles day-to-day deletes; Developer is not required.)*

## Implementation notes
- Use the existing `effectiveRoleRank()` / role-gating sweep (v5.11.11 precedent) — don't invent a
  new mechanism.
- `irlidDebugOn()` already exists (v6.1.16). Wrap the dev-tool blocks in a show/hide tied to it +
  re-evaluate on the Tools-&-Diag toggle change (or on reload, matching current debug-gate behaviour).
- Developer role always sees everything (unchanged) — so Captain's own view is unaffected.

## Out of scope
- Worker/endpoint auth (already enforced).
- The audit-view sidebar/dev-diagnostics hide — that's v6.1.22 (don't duplicate; coordinate if
  both land near each other, since both touch Org.html).

## File touch list
| File | Change |
|---|---|
| `Org.html` | debug-gate the dev/maintenance/File-Explorer blocks via `irlidDebugOn()`; role-gate Delete record / Delete expected / Add-Expected via `effectiveRoleRank()` |
| `sw.js` | cache bump |
| Build pill | → `v6.1.25` |

## A/R/D expectations
- **✅ ACCEPT ✅** — Debug off → no Developer diagnostics / Debug maintenance / Clear-test /
  Process-scan / File Explorer visible; toggle on → they return. A manager/staff session doesn't
  see Delete record/expected (lead_admin+) and attendees never see Add-Expected; Developer sees all.
- **⚠️ REVIEW ⚠️** — A gated control still visible to a lower role; debug-off still shows the dev
  panel; broke Developer's own access.
- **⛔ DENY ⛔** — Removes Worker enforcement (frontend hiding is NOT the security boundary — the
  Worker checks must stay); schema change.

## Smoke (needs the role testers — Becky=Manager, etc.)
1. Developer + debug OFF → no dev/maintenance tools on the Dashboard; toggle ON → they appear
2. Becky (Manager) → no Delete record / Delete expected buttons
3. Add-Expected hidden from attendee, visible to staff+
4. Developer still sees and can use everything

— Number One (4 June 2026)
