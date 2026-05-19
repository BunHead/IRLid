# CALENDAR-SPEC.md

**Status:** Draft — Tuesday 19 May 2026 morning watch.
**Authoring crew:** Number One.
**Implementation target:** Mr. Data (Phase 2 after `SETTINGS-REVAMP-SPEC.md` Phase 1 lands).
**Source of truth:** Calendar surface inside `OrgCheckinTest.html` Event & calendar tab (build `v5.11 mockup T4.1.10`).
**Prerequisite specs:** `SETTINGS-REVAMP-SPEC.md` (multi-room model in tab 3).

The current live `OrgCheckin.html` has no calendar — events live in a flat list. The mockup builds a real 24-hour calendar with per-event drill-down and multi-room awareness. This spec captures the design for Mr. Data to port.

---

## §1 — Data model

### §1.1 Events
A new D1 table `events`:

| Column         | Type     | Notes                                                       |
|----------------|----------|-------------------------------------------------------------|
| `id`           | TEXT PK  | `evt_` prefix + 22-char random                              |
| `org_id`       | TEXT     | FK → organisations.id                                       |
| `room_id`      | TEXT     | FK → rooms.id (NULL = org-wide / no room)                   |
| `name`         | TEXT     | Display name, 1–80 chars                                    |
| `start_ts`     | INTEGER  | Unix seconds                                                |
| `end_ts`       | INTEGER  | Unix seconds; must be > start_ts                            |
| `capacity`     | INTEGER  | NULL = inherit from room.capacity                           |
| `recurrence`   | TEXT     | NULL = one-off; else RRULE-lite (`WEEKLY:MON,WED;BYTIME=18:00`) |
| `notes`        | TEXT     | Optional org-facing notes                                   |
| `cancelled_at` | INTEGER  | NULL = active; soft-delete only                             |
| `created_at`   | INTEGER  | Unix seconds                                                |

Indexes: `(org_id, start_ts)`, `(org_id, room_id, start_ts)`.

### §1.2 Per-event Expected list
New table `event_expected`:

| Column         | Type     | Notes                                                       |
|----------------|----------|-------------------------------------------------------------|
| `id`           | TEXT PK  |                                                             |
| `event_id`     | TEXT     | FK → events.id                                              |
| `display_name` | TEXT     | "Spencer Austin" etc.                                       |
| `initials`     | TEXT     | Auto-computed `SRA` from display_name; editable             |
| `role_key`     | TEXT     | `attendee` / `staff` / `manager` / `lead_admin` / `developer` |
| `device_pub_fp`| TEXT     | Set when an existing IRLid identity is linked                |
| `email_hint`   | TEXT     | Optional, used for invite QR mail-merge                     |
| `csv_import_batch_id` | TEXT | NULL if added manually; else groups bulk imports        |
| `created_at`   | INTEGER  |                                                             |

Indexes: `(event_id)`, `(device_pub_fp) WHERE device_pub_fp IS NOT NULL`.

When an attendee scans in at the venue QR, the Worker resolves their `device_pub_fp` against `event_expected.device_pub_fp` for any active event in the room. Match = welcome flow. No match = doorman escalation (existing v5.7.0 path).

---

## §2 — Worker endpoints (new)

| Method | Path                                   | Purpose                                          | Auth                    |
|--------|----------------------------------------|--------------------------------------------------|-------------------------|
| GET    | `/org/events`                          | List events for date range + optional room       | X-Org-Key or Bearer     |
| POST   | `/org/events`                          | Create event                                     | manager+                |
| PATCH  | `/org/events/:id`                      | Edit event                                       | manager+                |
| DELETE | `/org/events/:id`                      | Soft-cancel (sets `cancelled_at`)                | manager+                |
| GET    | `/org/events/:id/expected`             | List expected rows                               | staff+                  |
| POST   | `/org/events/:id/expected`             | Add a single expected row                        | staff+                  |
| POST   | `/org/events/:id/expected/import-csv`  | Bulk import; returns batch_id + per-row report   | manager+                |
| GET    | `/org/events/:id/expected/export-csv`  | Download as CSV                                  | staff+                  |
| GET    | `/org/day/:yyyy-mm-dd/export-csv`      | Full day's attendance across all events / rooms  | manager+                |

All endpoints add to `requireDevOrStaffSession` enforcement; manager+ tier uses `requireSignedAction` per v5.10 Phase 0 / Path B.

---

## §3 — UI: Event & calendar tab

### §3.1 Toolbar (top of tab)
- **View toggle** — chip group: List / Swim-lane.
- **Room filter** — dropdown: "All rooms" + each room.
- **Jump to now** — button; scrolls to current time row.
- **Date picker** — left/right arrows + date display; default today.
- **+ Add event** — button (manager+).

### §3.2 List view (default)
- 24-hour 30-minute slot grid.
- Working hours band (`09:00`–`17:59`) lighter; off-hours dimmer.
- Now-line: red horizontal bar repositioned every minute via `requestAnimationFrame` setInterval.
- Each filled row: time range, event name, room badge, expected/capacity counter, Edit / View attendance buttons.
- Past events (`end_ts < now`): opacity 0.55, Edit button disabled.

### §3.3 Swim-lane view
- One vertical column per room (filtered or all).
- Same 24-hour time axis on the left.
- Events render as coloured blocks spanning their start→end rows.
- Concurrent events in the same room show as side-by-side blocks within the column (rare; capacity warning if it happens).
- Click any block: drill-down accordion (same as List view).

### §3.4 Per-event drill-down accordion
Inline panel beneath the clicked row. Contents:

**Header row** — event name (inline-edit), Cancel button (soft-delete), × Close.

**Time row** — start + end pickers, duration display.

**Capacity row** — capacity input (or "inherit from room: 30"). Counter: `12 expected / 30 capacity`.

**Expected list** — table:
| Initials | Display name        | Role         | Linked | Actions    |
|----------|---------------------|--------------|--------|------------|
| SRA      | Spencer Austin      | Staff        | ✓ 8 Pro| Edit / Remove |
| KMA      | Kerry Austin        | Attendee     | ✓ 4a   | Edit / Remove |
| —        | (new from CSV)      | Attendee     | —      | Edit / Remove |

Bottom buttons (4-button symmetry):
- **+ Add** — inline-add a single row.
- **Invite QR** — generate + display a venue QR pre-scoped to this event, downloadable as PNG.
- **Import CSV** — file picker; parses CSV with columns `display_name, role, email_hint` (case-insensitive headers); reports per-row success/failure.
- **Export CSV** — download current expected list as CSV (same columns + linked status + initials).

### §3.5 Day CSV export
- Bottom of tab, separate button "Export this day's attendance".
- Returns CSV: `event_name, room, start, end, attendee_display_name, role, scan_in_ts, scan_out_ts, scan_count, score`.
- Includes all check-ins across all events for the date.

---

## §4 — CSV format spec

### §4.1 Import CSV (Expected list)
- Header row required.
- Columns (any order, case-insensitive): `display_name` (required), `role` (optional, default `attendee`), `email_hint` (optional), `initials` (optional, auto-computed if missing).
- Unknown columns silently ignored.
- Blank rows skipped.
- Quoted strings supported.
- UTF-8 encoding.
- ≤ 1000 rows per import.

Per-row response (JSON):
```json
{ "row": 4, "status": "ok", "expected_id": "exp_..." }
{ "row": 5, "status": "error", "error": "display_name required" }
{ "row": 6, "status": "duplicate", "matched": "exp_existing_..." }
```

### §4.2 Export CSV
- Same columns plus `linked_device_fp` (or empty), `created_at` (ISO 8601).

### §4.3 Day attendance CSV
Columns: `event_id, event_name, room_name, event_start_iso, event_end_iso, expected_id, display_name, role, scan_in_iso, scan_out_iso, scan_count, score, status`.

---

## §5 — Recurrence (v6+ banked)

Initial implementation: one-off events only. Recurrence stored as `NULL`.

Future RRULE-lite syntax: `WEEKLY:MON,WED,FRI;BYTIME=18:00;UNTIL=2026-12-31`. Expansion happens server-side on `GET /org/events` — returns expanded occurrences for the requested date range, each with a synthesized `id` (`evt_orig.id + "@" + iso_date`).

---

## §6 — Multi-room model

Rooms defined in Roles & staff tab (see `SETTINGS-REVAMP-SPEC.md` §4). Each room has:
- `id`, `name`, `capacity`, `hint_note`.
- A unique `venue_qr_payload_hash` — what attendees scan at the entrance.

When a venue QR is scanned, the Worker resolves the room and looks for any active event in that room (`start_ts <= now < end_ts`, `cancelled_at IS NULL`). Match = welcome flow scoped to that event's Expected list. No active event = generic check-in (org-level Expected list).

---

## §7 — Capacity + over-cap behaviour

- Soft cap: warn manager but allow.
- Hard cap: block check-in, show "Event full" message.
- Per-event override: capacity column on `events` table; NULL = inherit from room.
- Capacity 0 = no cap.

UI shows `12/30` counter live (refreshes every 4s via existing attendance poll). Pulse-orange when at 80%; pulse-red when at 100%.

---

## §8 — Edge cases

- **Event spans midnight** — `end_ts > start_ts` always, even across day boundary. Calendar UI renders the event in BOTH days.
- **Event overlap in same room** — allowed, manager sees both in Swim-lane. Hard-cap check applies per-event independently.
- **Removed expected** — soft-delete only (set `removed_at`); historic receipts still resolve correctly.
- **CSV import with existing device_pub_fp** — link to existing IRLid identity if pub_fp matches; otherwise create unbound expected row.
- **Past event editing** — Lead admin+ only; standard staff can view but not edit historic events.

---

## §9 — Implementation phasing

**Phase 1** (Mr. Data, post Settings revamp Phase 1):
- `events` + `event_expected` D1 schema.
- `GET/POST/PATCH/DELETE /org/events` + Expected CRUD endpoints.
- List view of calendar with per-event drill-down accordion.
- Per-event Expected list with Add / Remove / Edit.

**Phase 2** (Mr. Data + Number One coordination):
- CSV import/export pipeline.
- Day attendance export.
- Multi-room awareness (depends on `rooms` table from Settings spec).

**Phase 3** (v6+):
- Swim-lane view.
- Recurrence (RRULE-lite).
- Capacity over-cap behaviour.
- Past event historical editing controls.

---

## §10 — Out of scope

- Event-level pricing / paid tickets.
- Calendar sync (iCal export of org's events) — deferred to v6+ as "iCal feed" feature.
- Cross-org event sharing.
- Public-facing event listing (`irlid.co.uk/{org-slug}/events` style URL) — separate spec when needed.

— Number One, drafting from the bath-watch, Tuesday 19 May 2026.
