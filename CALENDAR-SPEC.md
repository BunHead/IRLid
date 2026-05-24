# CALENDAR-SPEC.md

**Status:** v2 — Saturday 23 May 2026 afternoon watch.
**Authoring crew:** Number One.
**Implementation target:** Mr. Data (via `HANDOVER-CalendarLivePort-*.md`, drafted next).
**Source of truth:** `OrgCheckinTest.html` Event & Calendar tab at build `v5.11 mockup T4.3.60` (sha after `bf8d5f9`).
**Prerequisite specs:** `SETTINGS-REVAMP-SPEC.md` (Staff & Rooms tab; multi-room model).
**Replaces:** the 19 May 2026 draft of this same file, which assumed a date-based events table with RRULE-lite recurrence. Captain's morning bath-watch ratified a flat weekly cycle as the canonical model — see §1 below.

The current live `OrgCheckin.html` has no calendar at all; events are absent and Expected is a flat org-level list. This spec defines the calendar that will be ported across, plus the four-table data model that supports it.

**Port target — `Org.html` (new file), not `OrgCheckin.html`.** Captain ratified this on 23 May 2026 afternoon (the existing filename has been a typo magnet "for a long time"). `Org.html` currently exists as a 1.9KB redirect shim that bounces visitors to `OrgCheckin.html`; the port replaces the shim with the real portal. **`OrgCheckin.html` stays exactly as-is** as the reference + rollback safety net for as long as we want it. Both files coexist at the same Cloudflare Pages root. Worker (`irlid-api-org`) and D1 (`irlid-db-org`) names stay unchanged — those were never the painful spelling.

---

## §0 — Architectural decisions ratified

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Weekly cycle, not date-based events** | Captain: "basing it round the weekly cycle is as far as we'd need to go as regards satisfying everything the system would need to consider date-wise." A single recurring weekly schedule covers every gym / studio / class-based business that's currently in IRLid's wheelhouse. One-off events get banked for v6+. |
| 2 | **Expected list = Option C** (stable IDs at org level, events reference by ID) | Stable identity. CSV round-trip is mechanical. Port becomes mapping work, not redesign. Same "broker, not store" shape as the Records & ID Phase G commitment. |
| 3 | **Rooms with vocabulary presets** | One PRESET_VOCABS array (Room / Studio / Classroom / Pitch / Court / Hall / Theatre) lets an org pick the language that suits their domain without us shipping per-domain branches. The default room labels rename in lockstep with vocabulary changes. |
| 4 | **Working hours + 0-3 breaks band** | Configured in Event defaults; rendered as brightness banding in the calendar so staff see "operating window" at a glance. |
| 5 | **Past-event Edit-lock via `isSelectedDayPast()`** | Past events are read-only by default. Lead admin+ can still drill into a View modal but can't mutate. Three button locations (bottom of tab, list header, swim-lane day-strip) all gate identically. |
| 6 | **Capacity bar with tier colour-grading** | `N/cap` text + thin coloured fill bar; tiers low (< 50%) / mid (50-79%) / high (80-99%) / over (≥ 100%). Replaces the 19 May draft's pulse-orange/pulse-red. |
| 7 | **CSV round-trip preserves day + roster** | Import and Export use `day_of_week` + `expected_names` (semicolon-separated) columns so a week exported can be re-imported identically, including unknown names that auto-seed org_expected. |
| 8 | **View-aware Jump to Now** | The Now line lives in both List and Swim-lane views; the button scrolls whichever is currently active. Does not force-switch view. |
| 9 | **Sticky tab navigation** | `.v511-tabs` is `position: sticky; top: 8px; z-index: 50; backdrop-filter: blur(8px)` so the user can scroll a long event list without losing the tab bar. |
| 10 | **Tab name: "Staff & Rooms"** | Captain's rename — staff and rooms are the people+place layer. The old "Roles & Staff" tab carried only half the truth. |

These decisions are load-bearing and should not be revisited inside the port. Any divergence needs Captain sign-off before merge.

---

## §1 — Data model

Four tables. All `org_id`-scoped (multi-tenant).

### §1.1 `rooms`

| Column         | Type     | Notes                                                            |
|----------------|----------|------------------------------------------------------------------|
| `id`           | TEXT PK  | `room_` prefix + slug (e.g. `room_studio1`)                      |
| `org_id`       | TEXT     | FK → organisations.id                                            |
| `label`        | TEXT     | "Studio 1" — vocabulary-dependent                                |
| `subname`      | TEXT     | Optional sub-label, e.g. "main hall" / "kids room"               |
| `capacity`     | INTEGER  | Per-room default capacity; 0 = no cap                            |
| `display_ix`   | INTEGER  | Sort order in UI                                                 |
| `venue_qr_payload_hash` | TEXT | Unique per-room — what attendees scan at the entrance        |
| `created_at`   | INTEGER  | Unix seconds                                                     |
| `archived_at`  | INTEGER  | NULL = active; soft-delete only                                  |

Index: `(org_id, archived_at)`, unique `(org_id, label)`.

Rooms live in the **Staff & Rooms tab** (see SETTINGS-REVAMP-SPEC §4). Calendar reads from this table; calendar UI never creates or deletes a room.

### §1.2 `org_expected`

The org-level stable identity table — **the Option C anchor**.

| Column           | Type     | Notes                                                         |
|------------------|----------|---------------------------------------------------------------|
| `id`             | TEXT PK  | `p_` prefix + slug (e.g. `p_kerry`, `p_spencer`) — STABLE     |
| `org_id`         | TEXT     | FK                                                            |
| `display_name`   | TEXT     | "Spencer Austin" — 1-80 chars                                 |
| `initials`       | TEXT     | Auto-computed `SRA`; editable                                 |
| `role_key`       | TEXT     | `attendee` / `staff` / `manager` / `lead_admin` / `developer` |
| `device_pub_fp`  | TEXT     | NULL until linked via doorman flow; multi-key handled via existing `rebind_history` |
| `email_hint`     | TEXT     | Optional, used for invite QR mail-merge                       |
| `phone_hint`     | TEXT     | Optional, ditto                                               |
| `notes`          | TEXT     | Optional org-facing                                           |
| `created_at`     | INTEGER  |                                                               |
| `archived_at`    | INTEGER  | NULL = active; soft-delete only                               |

Indexes: `(org_id, archived_at)`, `(device_pub_fp) WHERE device_pub_fp IS NOT NULL`, unique `(org_id, LOWER(display_name)) WHERE archived_at IS NULL`.

This is the table that survives port-day and stays alive thereafter. It is the org's authoritative roster.

### §1.3 `weekly_events`

The recurring weekly schedule. **No date columns.** Day is `day_of_week` 1-7 (Mon=1, Sun=7).

| Column            | Type     | Notes                                                    |
|-------------------|----------|----------------------------------------------------------|
| `id`              | TEXT PK  | `evt_` prefix + 22-char random                           |
| `org_id`          | TEXT     | FK                                                       |
| `room_id`         | TEXT     | FK → rooms.id (NULL = org-wide / unassigned)             |
| `name`            | TEXT     | "Beginners pilates" etc., 1-80 chars                     |
| `day_of_week`     | INTEGER  | 1-7 (Mon-Sun)                                            |
| `start_time_local`| TEXT     | `HH:MM` 24-hour                                          |
| `duration_min`    | INTEGER  | Minutes; must be ≥ 1                                     |
| `capacity`        | INTEGER  | NULL = inherit from room.capacity                        |
| `color_hex`       | TEXT     | Optional; defaults to room colour palette                |
| `notes`           | TEXT     | Optional                                                 |
| `require_proof`   | INTEGER  | 0/1 — whether bio-proof is required at check-in          |
| `late_grace_min`  | INTEGER  | Minutes after start_time during which late check-in is still "on time" |
| `created_at`      | INTEGER  |                                                          |
| `archived_at`     | INTEGER  | NULL = active                                            |

Indexes: `(org_id, day_of_week, start_time_local)`, `(room_id)`.

**Why weekly, not dated:** the use cases that drove this (gyms, studios, classes, ongoing groups) all run on a fixed weekly schedule. The instance of "Monday Pilates this week vs next week" doesn't need to exist as a row — the schedule IS the row, attendance per-instance is recorded against the schedule's `id` + the day the attendance fired. Banked: one-off events (`v6.1+`), multi-week templates (`v6.2+`), full RRULE recurrence (`v7+`).

### §1.4 `event_expected`

The link table — **Option C reference, not duplication.**

| Column         | Type     | Notes                                                  |
|----------------|----------|--------------------------------------------------------|
| `event_id`     | TEXT     | FK → weekly_events.id                                  |
| `expected_id`  | TEXT     | FK → org_expected.id                                   |
| `added_at`     | INTEGER  |                                                        |
| `added_by`     | TEXT     | portal_user.id who added them                          |
| PRIMARY KEY    | composite| `(event_id, expected_id)`                              |

Indexes: `(event_id)`, `(expected_id)`.

**The mockup represents this as `event.expected_ids[]` array in JSON for in-browser convenience.** The Worker materialises it into `event_expected` rows on save and joins back into the array shape on read.

---

## §2 — Worker endpoints (new)

All under `irlid-api-org/src/index.js`. All require `requireDevOrStaffSession` minimum; manager+ writes use `requireSignedAction` per v5.10 Path B.

### §2.1 Rooms (see SETTINGS-REVAMP-SPEC for full set; calendar reads only)
| Method | Path                     | Purpose                          | Auth     |
|--------|--------------------------|----------------------------------|----------|
| GET    | `/org/rooms`             | List active rooms                | staff+   |

### §2.2 Org Expected
| Method | Path                                    | Purpose                                | Auth      |
|--------|-----------------------------------------|----------------------------------------|-----------|
| GET    | `/org/expected`                         | List active org_expected               | staff+    |
| POST   | `/org/expected`                         | Add a new entry                        | staff+    |
| PATCH  | `/org/expected/:id`                     | Edit (name / role / hints / notes)     | manager+  |
| DELETE | `/org/expected/:id`                     | Soft-delete (sets archived_at)         | manager+  |

(`POST /org/expected/:id/bind-additional-key` already exists from v5.7.0a doorman work — leave it.)

### §2.3 Weekly events
| Method | Path                                    | Purpose                          | Auth      |
|--------|-----------------------------------------|----------------------------------|-----------|
| GET    | `/org/weekly-events`                    | List active weekly events; optional `?room_id=` and `?day=` filters; expected_ids inflated | staff+    |
| POST   | `/org/weekly-events`                    | Create event + initial expected list     | manager+  |
| PATCH  | `/org/weekly-events/:id`                | Edit (name / day / time / duration / capacity / room / expected_ids) | manager+  |
| DELETE | `/org/weekly-events/:id`                | Soft-delete                      | manager+  |

PATCH body for `expected_ids`: server diffs against current `event_expected` rows and applies inserts + deletes atomically.

### §2.4 CSV round-trip
| Method | Path                              | Purpose                                                                | Auth     |
|--------|-----------------------------------|------------------------------------------------------------------------|----------|
| GET    | `/org/weekly-events/export-csv`   | Whole-week CSV. Columns per §4.2.                                      | staff+   |
| POST   | `/org/weekly-events/import-csv`   | Multipart file. Validates. Returns per-row report + batch_id.          | manager+ |

**Destructive replace is client-confirmed, not Worker-confirmed.** Worker accepts a `?replace=1` query param: if set, deletes existing weekly_events for the org and inserts the imported set in one transaction. If absent, merges (insert-only, conflict by `id` rejected).

### §2.5 Capacity / attendance read (existing endpoint, augmented)
- `GET /org/attendance` already exists. Add optional `?event_id=` to scope check-ins to one weekly_event for the active day.
- Live counter `expected_count / capacity` per event is computed client-side from the event's `expected_ids.length` (which we already have) — no extra Worker call needed for the calendar's CAP column.

---

## §3 — Calendar settings (org-level)

Stored in `organisations.settings_json` (already exists). Calendar reads from the same `loadCalSettings()` shape the mockup uses:

```json
{
  "week_starts_on": 1,
  "room_vocabulary_singular": "Room",
  "room_vocabulary_plural": "Rooms",
  "working_hours_start": "09:00",
  "working_hours_end": "17:59",
  "breaks_count": 0,
  "break_1_start": "12:00", "break_1_end": "13:00",
  "break_2_start": "15:00", "break_2_end": "15:15",
  "break_3_start": "18:00", "break_3_end": "18:30"
}
```

| Key                       | Type     | Notes                                                |
|---------------------------|----------|------------------------------------------------------|
| `week_starts_on`          | INTEGER  | 1 = Monday, 0 = Sunday                               |
| `room_vocabulary_singular`| TEXT     | One of PRESET_VOCABS (see §6)                        |
| `room_vocabulary_plural`  | TEXT     | Matching plural                                      |
| `working_hours_start/end` | TEXT     | `HH:MM` — render brightness banding in calendar      |
| `breaks_count`            | INTEGER  | 0, 1, 2, or 3                                        |
| `break_N_start/end`       | TEXT     | `HH:MM` — render amber dim band                      |

Worker validators:
- `week_starts_on` ∈ {0, 1}
- vocab strings ≤ 32 chars, no HTML
- `HH:MM` regex on all times
- breaks_count ∈ {0,1,2,3}
- break ranges must satisfy `start < end`

---

## §4 — CSV format spec

### §4.1 Import CSV (weekly events)

Header row required. **Columns (any order, case-insensitive):**

| Header                          | Required | Notes                                                              |
|---------------------------------|----------|--------------------------------------------------------------------|
| `event_name`                    | yes      | 1-80 chars                                                         |
| `room` / `studio` / `hall` / `theatre` / `classroom` / `pitch` / `court` / `treatment_room` | one of | Vocabulary-flex: importer accepts whichever room-vocab term the export used |
| `day_of_week`                   | yes      | Either number (1-7) or text (`Monday`/`Mon`/`monday`...)           |
| `start_time`                    | yes      | `HH:MM`                                                            |
| `duration_min`                  | yes      | Integer                                                            |
| `capacity`                      | no       | Integer; blank = inherit from room                                 |
| `expected_names`                | no       | Semicolon-separated. Unknown names auto-create org_expected entries with role `attendee` |
| `require_proof`                 | no       | `1` / `0` / `yes` / `no`                                           |
| `late_grace_min`                | no       | Integer                                                            |

Server response:
```json
{
  "batch_id": "imp_...",
  "events_created": 9,
  "events_replaced": 0,
  "org_expected_created": 2,
  "rows": [
    { "row": 2, "status": "ok", "event_id": "evt_..." },
    { "row": 5, "status": "error", "error": "day_of_week required" }
  ]
}
```

### §4.2 Export CSV (weekly events)

Identical column set to §4.1 import — so a week exported can be re-imported losslessly.

`expected_names` is the joined display-name list from each event's `expected_ids` resolved against `org_expected`.

---

## §5 — UI: Event & Calendar tab

### §5.1 Tab structure (top to bottom)

1. **Sticky tab nav** (global, all tabs) — `position: sticky; top: 8px; z-index: 50; backdrop-filter: blur(8px)`.
2. **Toolbar** — View toggle (List / Swim-lane), Day chips (Mon-Sun honouring `week_starts_on`), Room filter dropdown, Jump to Now button, Date arrows + display, **+ Add event** button.
3. **Calendar surface** — depends on view (see §5.2 + §5.3).
4. **Export week / Import week** — paired buttons below calendar, "same-shape symmetry."
5. **Event defaults expander** (closed by default) — Working hours, Breaks, Require proof default, Late grace default, Week-start day.

### §5.2 List view (default)

Single-column hourly table, **24 rows (00:00-23:00, one per hour)**.

- Each row = one hour. Events overlap rendering: the event's row contains a coloured pill spanning the start-time vertical offset proportional to the minute within the hour. Inner offset is `start_minute/60 * row_height`.
- **Working-hours band**: hours within `working_hours_start..working_hours_end` get a brighter background; off-hours dim.
- **Break bands**: each configured break renders an amber-tinted overlay across that hour range.
- **Now line**: faint red horizontal line, positioned via `top: (nowMinSinceMidnight/1440)*100%` percentage (no row-pixel math — auto-adapts to row height). White text label `13:17` (or current time) anchored on the right end of the line.
- **CAP column**: per-event row shows `N/cap` text + thin fill bar. Tier colour-graded:
  - **low** (`< 50%`): muted text, no bar.
  - **mid** (`50-79%`): blue (`#58a6ff` dark / blue light).
  - **high** (`80-99%`): amber (`#f59f00` dark / `#a06700` light).
  - **over** (`≥ 100%`): red (`#cf222e` dark / `#b62324` light).
- **Past events**: opacity 0.55, Edit replaced with View, both lock to read-only modal (§5.4).
- **Day chips** at top filter to selected day. `state.selectedDay` (1-7) drives which day's events render.

### §5.3 Swim-lane view

Single-day swim-lane with **rooms-as-rows** stacked vertically (Captain's T4.3.55 call — rejected the original 7-day-as-rows design).

- 24-hour time axis along top.
- One row per room (filter dropdown narrows).
- Events render as coloured blocks spanning their start→end time range within their room row.
- Same Now line + working-hours band + break bands as List.
- Click any block → opens drill-down modal (§5.4).

### §5.4 Edit / View modal (per-event)

Modal opens centred. **Day is a read-only label at top** ("Monday — 09:00") sourced from caller context — no Day chip row inside the modal.

Body:
- Name input
- Room dropdown
- Start time + Duration → Friendly duration label ("1h", "1h 30m", "45 min" via `friendlyDuration()`)
- Capacity input (placeholder = room's capacity)
- Color picker (optional override)
- Require proof checkbox
- Late grace minutes
- Notes textarea
- **Expected list section** (§5.5)

Footer: Save / Cancel / (Delete event, manager+).

**Past-event variant** (`isSelectedDayPast() === true` at modal open): all inputs disabled, footer shows only Close. Title prepends "(Past)".

### §5.5 Modal Expected section

Mirror of mockup T4.3.59:

1. **Search input** — filters org_expected by case-insensitive `display_name.includes(query)`.
2. **Suggestion checkbox list** — every matching org_expected row gets a checkbox. Checked = present in this event's `expected_ids`. Toggling updates the in-memory event before save.
3. **Inline "+ Add new attendee"** — name input + role dropdown + Add button. Calls `addOrgExpectedEntry(name, role)` which dedupes by case-insensitive name match against org_expected, returns existing or new ID, ticks it on this event.
4. **Selected chips** — coloured by role. Each chip has a × to remove from event (does NOT delete from org_expected).
5. **Live count** — "12 expected" updates as chips add/remove.

### §5.6 Past-day Add event semantics

`isSelectedDayPast()` returns:
- `true` when viewing a past week (`state.weekStartIso < todayWeek`)
- `false` when viewing a future week
- Current week: compares `state.selectedDay` against today's day-of-week honouring `weekStartsMonday()`.

When `true`:
- **All three** `+ Add event` button locations disable + relabel `+ Add event (past)`:
  1. Bottom of Event & Calendar tab (top-level button)
  2. List view's day-header per-day inline button
  3. Swim-lane view's day-strip header button

(The mockup uses single-quoted strings for these labels to dodge the PowerShell-parens-in-double-quotes trap; the live port can use whatever JS is most natural since the label only appears in HTML.)

### §5.7 Jump to Now button

Reads `currentView` (`'list' | 'swim'`) and scrolls the Now line element belonging to whichever view is active. Does **not** force-switch view.

---

## §6 — Room vocabulary

```js
var PRESET_VOCABS = ['Room', 'Studio', 'Classroom', 'Pitch', 'Court', 'Hall', 'Theatre'];
```

Stored as **singular + plural pair** in calendar settings (e.g. `Room/Rooms`, `Studio/Studios`, `Pitch/Pitches`).

**Rename detection** — when the org changes vocabulary mid-flight, any room currently labelled with **any** PRESET_VOCAB + number (e.g. `Studio 1`, `Theatre 3`) renames to the new vocab. Regex: `^(Room|Studio|Classroom|Pitch|Court|Hall|Theatre) (\d+)$` matched per room; the numeric suffix is preserved.

This regex MUST cover all PRESET_VOCABS — Captain's bug T4.3.58.3 surfaced because the original regex only matched the *previous* vocab, so a `Room → Hall → Theatre` chain broke at step 2.

User-renamed rooms (e.g. "Main hall", "Kids studio") are untouched by vocab changes.

---

## §7 — Saved toast pattern

Mockup uses `showGlobalSavedToast(message)` — fixed-position bottom-centre toast that survives even when the debug indicator obscures local pulses. Live port should adopt this pattern for ALL save confirmations on the calendar surface.

Implementation shape:
- `position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 9999`
- 2.5s fade
- 4.5:1 contrast palette (WCAG 2.2 AA — see ACCESSIBILITY-SPEC §6)
- Stacks vertically if multiple fire close together

---

## §8 — Acceptance criteria (for the port HANDOVER)

Mr. Data, please verify before marking the port PR ready-for-review:

1. **Schema** — four new D1 tables exist (`rooms`, `org_expected`, `weekly_events`, `event_expected`) with indexes per §1. Worker migration script in `irlid-api-org/migrations/`.
2. **Endpoints** — all §2 endpoints respond per spec. CORS allowlist still `https://irlid.co.uk` only.
3. **Calendar surface** — new `Org.html` Event & Calendar tab matches mockup T4.3.60 surface-by-surface (List view, Swim-lane, day chips, Sticky tabs, working-hours band, breaks, Now line, CAP column, capacity tier colours). `OrgCheckin.html` is NOT modified by this port.
4. **Modal** — Edit and View modal both work; Day is read-only label; Expected section has search + suggestion checkboxes + chips + inline +Add new attendee + live count.
5. **Past-day semantics** — `isSelectedDayPast()` lives in the live JS; all three `+ Add event` button sites gate identically; past events open in View-only modal.
6. **CSV round-trip** — Export week → Import week reproduces the same week of events identically, INCLUDING expected rosters per event AND auto-created org_expected for unknown names.
7. **Vocabulary** — picking a new room vocab in Staff & Rooms renames all PRESET_VOCAB+number rooms in lockstep; user-renamed rooms untouched.
8. **Sticky tabs** — scroll the page, tabs stay pinned with blur backdrop.
9. **No regression** — existing v5.10.7 doorman flow, attendance dashboard, sign-in / sign-out still work as today.
10. **Build pill** — bumps from current `v5.10.7` to `v5.11.0` on first calendar port PR.

---

## §9 — Out of scope (banked)

- **One-off events** — booked for `v6.1+` as `events` table with `start_ts`/`end_ts` joining the weekly schedule.
- **Multi-week templates** — `v6.2+`.
- **Full RRULE recurrence** — `v7+`.
- **iCal export / cross-org sharing** — separate spec when needed.
- **Records & ID wiring** — explicitly NOT for this port. Separate workstream (Phase G of ACCESSIBILITY-SPEC, broker-not-store, v5.13 / v6.0).
- **Orphan-button sweep** — separate carry-forward in `memory/pending-work.md`. Some calendar buttons (e.g. Invite QR) may still be orphaned at port time; brief should flag them.

---

## §10 — Migration path

### §10.1 Starting state (23 May 2026 close)

- `irlid.co.uk/OrgCheckin.html` — current live portal at `v5.10.7`. No calendar; flat Expected list in Dashboard; per-day attendance with no event grouping. **Stays exactly as-is throughout the port.**
- `irlid.co.uk/Org.html` — 1.9KB redirect shim that bounces visitors to `OrgCheckin.html`. **Replaced by the new portal at port-time.**
- `irlid.co.uk/OrgCheckinTest.html` — mockup at `v5.11 mockup T4.3.61`. **Stays exactly as-is as the design sandbox.**
- Worker `irlid-api-org` at `v5.10.7+v5.11.2` (B2 deployed 23 May afternoon).
- D1 `irlid-db-org` — no calendar tables yet.

### §10.2 Target state (port-complete)

- `irlid.co.uk/Org.html` — new portal at `v5.11.0`. Calendar surface + four-table data model live. **The new canonical URL.**
- `irlid.co.uk/OrgCheckin.html` — unchanged from §10.1. Reference + rollback URL.
- `irlid.co.uk/OrgCheckinTest.html` — unchanged from §10.1.
- Worker `irlid-api-org` at `v5.11.0` with the §2 endpoints added.
- D1 `irlid-db-org` with four new tables (`rooms`, `org_expected`, `weekly_events`, `event_expected`).

### §10.3 Sequence

The port HANDOVER (`HANDOVER-CalendarLivePort-v5.11.0.md`) ships as a four-PR stack:

1. **PR-A — D1 schema.** Migration script `apply_v5_11_0_calendar.ps1` under `irlid-api-org/migrations/`. Creates three new tables (`rooms`, `weekly_events`, `event_expected`) with their indexes. **Defensive on legacy `org_expected`:** detects legacy column shape via `PRAGMA table_info`, leaves the table untouched and prints a yellow warning marking PR-B as the resolver. Idempotent. **Merged + run clean against `irlid-db-org` 24 May 2026** (PR #37, merge commit `f3dd95f`; migration verified end-to-end on remote D1 with the expected legacy-org_expected warning fired).
2. **PR-B — Worker endpoints + legacy `org_expected` reset.** Two files: (a) NEW migration `apply_v5_11_0_org_expected_reset.ps1` that drops the legacy `org_expected` and recreates with v5.11 shape + indexes — per Captain's 24 May ratification, **data loss on legacy `org_expected` rows is accepted** (no production users on them; new Org from scratch); (b) all §2 endpoints added to `irlid-api-org/src/index.js`. `requireDevOrStaffSession` minimum, `requireSignedAction` on manager+ writes. CORS allowlist still `https://irlid.co.uk` only. Deploy sequence: merge → `git pull` → run reset migration → `npx wrangler deploy`.
3. **PR-C — `Org.html` UI.** New file at repo root. Built from `OrgCheckinTest.html` with mockup-only tooling stripped (prototype-role simulator, in-memory localStorage state replaced with Worker calls, mockup seed data removed). Replaces the 1.9KB redirect shim. **`OrgCheckin.html` NOT modified.**
4. **PR-D — Cutover.** Build pill bumps `v5.10.7 → v5.11.0` (on Org.html only; OrgCheckin.html keeps its v5.10.7 pill). Service Worker cache version bump. README pointer to the new URL. Optional retirement of `websiteScrapeBtn` placeholder.

### §10.4 Rollback

If anything goes wrong post-cutover:
- `irlid.co.uk/OrgCheckin.html` is the immediate fallback URL. No code change needed.
- Worker rollback via Cloudflare dashboard → previous deployment ID. Endpoints from PR-B are additive; rolling back the Worker just removes them, doesn't break `OrgCheckin.html`.
- D1 rollback is unnecessary: the new tables are additive; the old code doesn't reference them.

The mockup was deliberately built so this port is mechanical, not redesign. Every architectural call has been made already.

---

— Number One, with calendar architecture squared away ready for the port brief.
