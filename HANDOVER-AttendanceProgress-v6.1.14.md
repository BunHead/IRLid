# HANDOVER — Mr. Data — `v6.1.14` — Attendance progress bar + actual-late markers

**Branch:** `codex/v6.1.14-attendance-progress`
**Run order:** AFTER the v6.1.16 frontend bundle, OR off fresh main if it lands first —
it touches the Dashboard attendance render in `Org.html`, so don't run it in parallel with
other `Org.html` branches. Worker untouched.

---

## Goal

The Dashboard attendance view should show, for the **currently-running event**:
1. A **progress bar** — checked-in count vs the event's capacity (e.g. "12 / 30").
2. A **per-row late marker** showing the **actual minutes late**, computed from the
   attendee's check-in time vs the event's scheduled start — NOT fixed 5/10/15 buckets.

All the data needed is already present (v6.1.13 threaded `event_id` into `org_checkins`;
`weekly_events` carries `capacity` and `start_time_local`).

---

## Fix 1 — Attendance progress bar

- Resolve the current event via the existing `window.v511GetActiveCalendarEvent()`
  (Org.html ~line 7307) — it returns the running event with `id`, `name`, `capacity`,
  `start_time_local`.
- Count attendance rows whose `event_id` matches that event AND status is checked-in
  (IN, not yet OUT).
- Render a bar near the top of the Dashboard attendance card: `{checkedIn} / {capacity}`
  with a filled proportion `checkedIn / capacity` (clamp at 100%; if capacity is null/0,
  show just the count with no bar).
- Update it on the existing attendance poll/refresh cycle so it tracks live.

## Fix 2 — Actual-late marker per row

For each attendance row that belongs to the current (or its matched) event:
- Compute `lateMinutes = round((checkinLocalTime − eventStartLocalTime) / 60000)` using
  **browser local time** for both (mirror the v6.1.13 local-time fix — do NOT use UTC, or
  BST events read an hour off).
  - `eventStartLocalTime` = today's date at the event's `start_time_local` (HH:MM local).
  - `checkinLocalTime` = the row's check-in timestamp.
- If `lateMinutes <= 0` → show nothing (on time / early).
- If `lateMinutes > 0` → show a small amber marker on the row, e.g. **"12 min late"**
  (`{lateMinutes} min late`). Keep it compact; it sits beside the existing time/role cells.
- Use the row's own check-in time, not "now", so the marker is stable after the fact.

## Discovery pointers
- `grep` for the Dashboard attendance render in `Org.html` (the function that builds the
  attendance rows / "Attendance Today" table) — that's where both the bar (header) and the
  per-row marker attach.
- `v511GetActiveCalendarEvent` already does the day-of-week + time-window matching; reuse
  it, don't re-implement the matching.

---

## File touch list

| File | Change |
|---|---|
| `Org.html` | Progress bar in attendance card header; per-row actual-late marker; CSS for both |
| `sw.js` | Cache bump |
| Build pill | → `v6.1.14` (or next free number if v6.1.16 already shipped) |

## What NOT to touch
- Worker / `org_checkins` schema — unchanged (all data already present)
- The check-in/out flow itself — display-only feature
- Receipt bridge, calendar write paths — unchanged

## A/R/D expectations
- **✅ ACCEPT ✅** — Bar shows "{n}/{capacity}" tracking live; rows checked in after the
  event start show "{actual} min late" in amber; on-time/early rows show nothing; local
  time correct (no UTC/BST hour drift).
- **⚠️ REVIEW ⚠️** — Late shown in fixed buckets; uses "now" instead of the row's check-in
  time; bar doesn't clamp / breaks when capacity null.
- **⛔ DENY ⛔** — Touches Worker/schema or the check-in flow.

## Smoke
1. Dashboard during a running event → bar reads e.g. "2 / 30" and fills proportionally
2. Check someone in after the event's start time → row shows "{actual} min late" in amber
3. Check someone in before/at start → no late marker
4. Event with null capacity → count shows, no broken bar
5. BST event → late minutes correct (not an hour off)

— Number One (4 June 2026)
