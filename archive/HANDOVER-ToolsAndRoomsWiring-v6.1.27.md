# HANDOVER — Mr. Data — `v6.1.27` — Wire the last design-in bits (Tools & Diag remainder + Rooms)

**Branch:** `codex/v6.1.27-tools-rooms-wiring`
**Why:** Two design-in remnants flagged in the 4 June design-in audit. **DIAGNOSE FIRST** —
confirm what's already real vs mockup before wiring, then wire only the dead parts. Some of this
may already be backed (the calendar uses real rooms; an admin audit log exists from v5.10.4).

## Part A — Tools & Diagnostics remainder
The **debug toggle is already wired** (v6.1.16) — leave it. Audit the rest of the tab:
- **"Audit log → Open log"** — there's an admin-actions audit log feature (v5.10.4,
  `POST /user/sign-out-all` era / the per-action audit rows). Confirm whether "Open log" actually
  fetches + displays real audit entries (invites, settings saves, role changes, deletes) or is a
  placeholder. If placeholder, wire it: a Worker read endpoint (e.g. `GET /org/audit-log`,
  **lead_admin+ session**) returning recent admin-action rows, and a frontend list. If a suitable
  read already exists, just wire the button to it.
- **"Developer" section** (developer-only) — audit what it claims to do; wire or clearly mark any
  dead controls. Keep it `data-min-role="developer"` + `data-debug-gated` (consistent with v6.1.25).

## Part B — Rooms / spaces section
The **`rooms` D1 table already backs the calendar** (events reference `room_id`; the Room
dropdown lists Studio 1/2/3). Confirm whether the **Rooms / spaces section** in Staff & Rooms can
actually **list / add / edit / remove** rooms against that table, or is display-only mockup.
- If mockup → wire it: list real rooms (`GET /org/rooms` likely exists — it feeds the calendar),
  add/rename/remove via Worker endpoints (add if missing; **lead_admin+** for create/remove —
  rooms are org structure). Each room has a name + capacity + (per the section hint) its own venue
  QR. Don't break the calendar's room references.
- If already wired → just confirm and note it; no change.

## Governance / safety
- Audit-log read + Rooms create/remove → **lead_admin+ session** (reuse the v6.2.1 / `effectiveRoleRank`
  pattern; not api_key-only).
- Immutable-DB: the audit log is **read-only** display — never offer edit/delete of audit rows.
- Removing a room must not orphan events silently — block or warn if events reference it (mirror
  the `org_expected` active-checkin delete guard pattern).

## File touch list
| File | Change |
|---|---|
| `Org.html` | wire "Open log" to real audit entries; wire Rooms list/add/edit/remove (if mockup) |
| `irlid-api-org/src/index.js` | `GET /org/audit-log` (if missing); room add/rename/remove endpoints (if missing), lead_admin+ |
| `sw.js` | cache bump |
| Build pill | → `v6.1.27` |

## A/R/D expectations
- **✅ ACCEPT ✅** — "Open log" shows real admin-action history (lead_admin+); Rooms section
  lists/edits real rooms without breaking calendar references; create/remove gated lead_admin+;
  room-removal guarded against orphaning events.
- **⚠️ REVIEW ⚠️** — Audit log editable; room removal orphans events; api_key-only auth on the
  privileged endpoints.
- **⛔ DENY ⛔** — Mutates/deletes audit rows; breaks calendar room references; schema beyond what
  the endpoints need.

## Smoke (with Captain)
1. Tools & Diag → Open log → real recent admin actions appear (lead_admin+); a manager can't open it
2. Rooms section → add a room → it appears in the calendar Room dropdown; rename/remove works
3. Try to remove a room an event uses → blocked/warned

— Number One (4 June 2026)
