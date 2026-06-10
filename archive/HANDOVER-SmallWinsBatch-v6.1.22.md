# HANDOVER — Mr. Data — `v6.1.22` — Small-wins batch (3 quick UI fixes)

**Branch:** `codex/v6.1.22-small-wins`
**Scope:** `Org.html` only (+ sw.js cache). No Worker, no schema. Three independent display
fixes, one PR.

---

## Fix 1 — Expected attendee list scrollable (the dropped v6.1.14 Fix 4)
In the Add/Edit-event modal, wrap the **Expected** attendee selected-chips area + suggestion
list in a **fixed-height (~200px), vertically scrollable** container, with the "Search names or
type a new one" input pinned/visible above it so adding more is always reachable. Stops the
modal blowing out as the expected list grows.

## Fix 2 — Audit view is leaking the sidebar + Developer diagnostics
Audit mode (the airport-board fullscreen, "Exit audit" button) is meant to be **table-only**.
Right now the **left nav sidebar** AND the **Developer diagnostics** panel are still visible in
audit mode. Hide both while audit mode is active (there's an existing audit-mode body class /
flag — reuse it; add the sidebar + `#...developer-diagnostics` panel to what audit mode hides,
alongside topbar/stats which it already hides). Restore them on Exit audit.

## Fix 3 — Per-event Attendance position (Captain's layout note)
Captain expected the per-event Attendance timeline (the v6.1.14 name·IN/OUT·time scroll panel
in the Edit-event modal) on the **right** as a column, not stacked below the Expected list.
Where the modal width allows, lay Expected (left) and Attendance (right) **side by side** as two
columns; on narrow/mobile widths, stack them (Attendance below) as now. Keep both scroll panels.

---

## File touch list
| File | Change |
|---|---|
| `Org.html` | (1) Expected list scroll container; (2) hide sidebar + dev-diagnostics in audit mode; (3) Expected/Attendance side-by-side on wide modal |
| `sw.js` | cache bump |
| Build pill | → `v6.1.22` |

## A/R/D expectations
- **✅ ACCEPT ✅** — Expected list scrolls within a fixed height; audit mode shows table only (no
  sidebar, no dev-diagnostics) and restores on exit; Edit-event modal shows Expected | Attendance
  side-by-side on desktop, stacked on mobile. No functional/data changes.
- **⚠️ REVIEW ⚠️** — Audit mode hides something it shouldn't (or misses one); side-by-side breaks
  on mobile; scroll container clips the search input.
- **⛔ DENY ⛔** — Any Worker/schema/check-in-flow change.

## Smoke
1. Add many to an event's Expected list → it scrolls, search stays reachable
2. Enter audit mode → only the attendance table shows (no sidebar, no Developer diagnostics) → Exit audit restores them
3. Open Edit-event on desktop → Expected left, Attendance right; shrink window → stacks

— Number One (4 June 2026)
