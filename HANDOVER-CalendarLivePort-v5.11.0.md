# HANDOVER — Calendar live port (v5.11.0)

**Author:** Number One.
**Drafted:** Saturday 23 May 2026 afternoon watch.
**Target:** Mr. Data (Codex).
**Architectural reference (source of truth):** `CALENDAR-SPEC.md` at repo root. Read it first. This brief is the implementation handover; the spec is the design.
**Scope:** four-PR stack. New file `Org.html` (replaces 1.9KB redirect shim); new Worker endpoints in `irlid-api-org/src/index.js`; new D1 schema for `irlid-db-org`. **`OrgCheckin.html` IS NOT MODIFIED by this port — it stays exactly as-is as reference + rollback.**
**Backend names:** `irlid-api-org` + `irlid-db-org` stay unchanged. Captain ratified this explicitly: the `-org` suffix disambiguates from the public-facing `irlid-api` Worker; nothing to gain by renaming.
**Estimated effort:** four PRs over 1-2 days of Codex time. Each PR is independently reviewable + revert-able.
**Branch convention:** `codex/v5.11.0-port-A-schema`, `codex/v5.11.0-port-B-worker`, `codex/v5.11.0-port-C-ui`, `codex/v5.11.0-port-D-cutover`.

---

## §1 — Why

`OrgCheckinTest.html` at build `T4.3.61` is the design-complete mockup of the v5.11 portal — Event & Calendar tab with the four-table data model Captain ratified on 23 May morning (Option C Expected list, weekly cycle, PRESET_VOCABS room model, working hours + breaks band, past-event Edit-lock, capacity tier bar, CSV round-trip, sticky tabs). The orphan-button sweep (`memory/orphan-button-sweep-2026-05-23.md`) confirmed every visible button is either wired or correctly disclosed as placeholder. The mockup is port-ready.

Captain also ratified the file rename: the port lands as `Org.html` (new file), not `OrgCheckin.html` (current live). The 1.9KB `Org.html` redirect shim that currently bounces visitors to `OrgCheckin.html` is replaced by the real portal. `OrgCheckin.html` stays untouched as the reference + rollback URL. No backend renames.

---

## §2 — Out of scope (do NOT touch)

- `OrgCheckin.html` — DO NOT MODIFY. This is the rollback safety net for the entire port.
- `OrgCheckinTest.html` — DO NOT MODIFY. This is the design sandbox; future iteration continues there.
- `irlid-api` (public Worker for receipts) — different Worker, different concern.
- `irlid-db` (public DB) — different database.
- Worker / D1 RENAMES — Captain explicitly ratified keeping `irlid-api-org` + `irlid-db-org`.
- `js/sign.js`, `js/qr.js`, `js/qr-fullscreen.js` — protocol files, no changes needed for this port.
- `org-entry.html`, `org-login.html` — phone-side flows, no changes for this port.
- `scan.html` — universal QR ingress, no changes.
- Records & ID tab on `Org.html` — ships as mockup-only this port; backend wiring deferred to `v5.13+`.
- `v5.7.x` doorman flow — unchanged. The new calendar feeds Expected list resolution into the existing doorman path, but the doorman flow itself isn't modified.
- D1 schema mutations on existing tables (`organisations`, `portal_users`, `org_memberships`, `login_sessions`, `login_challenges`, `org_checkins`) — the four new tables are additive only.

---

## §3 — Architecture summary

Per `CALENDAR-SPEC.md` (read it):

- **Four new D1 tables:** `rooms`, `org_expected`, `weekly_events`, `event_expected` (link table).
- **Weekly cycle, not date-based events.** Events have `day_of_week` (1-7) + `start_time_local` (HH:MM) + `duration_min`. No unix timestamps for event schedule.
- **Option C Expected list.** Stable IDs in `org_expected`; events reference by ID via `event_expected` link rows. The mockup's `event.expected_ids[]` array shape is the JSON-on-the-wire representation; server materialises into rows.
- **Room vocabulary** with PRESET_VOCABS array (`['Room', 'Studio', 'Classroom', 'Pitch', 'Court', 'Hall', 'Theatre']`). Vocabulary changes rename all PRESET_VOCAB+number default rooms in lockstep; user-renamed rooms untouched.
- **Working hours + 0-3 breaks** stored in `organisations.settings_json`. Calendar renders brightness banding accordingly.
- **`isSelectedDayPast()` helper** for past-event Edit-lock — three button sites gate identically.
- **CSV round-trip** with `day_of_week` + `expected_names` (semicolon-separated) columns. Vocabulary-flex room column header (accepts `room` / `studio` / `hall` / `theatre` / `classroom` / `pitch` / `court` / `treatment_room`).
- **Capacity tier breakpoints:** low `< 50%`, mid `50-79%`, high `80-99%`, over `≥ 100%`.
- **Sticky tab nav:** `position: sticky; top: 8px; z-index: 50; backdrop-filter: blur(8px)`.

The mockup at `OrgCheckinTest.html` build `T4.3.61` is the visual + behavioural source-of-truth. When in doubt about a UI detail, mirror the mockup.

---

## §4 — PR stack

### PR-A — D1 schema (~30-45 min)

**Branch:** `codex/v5.11.0-port-A-schema`
**Files touched:** new file `irlid-api-org/migrations/apply_v5_11_0_calendar.ps1` (or `.sh` if you prefer — Captain runs both).
**Worker code:** NONE.
**Frontend:** NONE.

#### Tasks

A.1 — Create `apply_v5_11_0_calendar.ps1` as an idempotent migration script following the pattern of existing migrations (e.g. `apply_batch_a_identity_sessions.ps1`). Each `CREATE TABLE` uses `IF NOT EXISTS`; each `CREATE INDEX` uses `IF NOT EXISTS`. Safe to re-run.

A.2 — Tables to create (per `CALENDAR-SPEC §1`):

```sql
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  label TEXT NOT NULL,
  subname TEXT DEFAULT '',
  capacity INTEGER DEFAULT 0,
  display_ix INTEGER DEFAULT 0,
  venue_qr_payload_hash TEXT,
  created_at INTEGER NOT NULL,
  archived_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_rooms_org ON rooms (org_id, archived_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rooms_org_label ON rooms (org_id, label) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS org_expected (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  initials TEXT,
  role_key TEXT DEFAULT 'attendee',
  device_pub_fp TEXT,
  email_hint TEXT,
  phone_hint TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  archived_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_org_expected_org ON org_expected (org_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_org_expected_fp ON org_expected (device_pub_fp) WHERE device_pub_fp IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_expected_name ON org_expected (org_id, LOWER(display_name)) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS weekly_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  room_id TEXT,
  name TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,
  start_time_local TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  capacity INTEGER,
  color_hex TEXT,
  notes TEXT,
  require_proof INTEGER DEFAULT 0,
  late_grace_min INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  archived_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_weekly_events_org_dow ON weekly_events (org_id, day_of_week, start_time_local);
CREATE INDEX IF NOT EXISTS idx_weekly_events_room ON weekly_events (room_id);

CREATE TABLE IF NOT EXISTS event_expected (
  event_id TEXT NOT NULL,
  expected_id TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  added_by TEXT,
  PRIMARY KEY (event_id, expected_id)
);
CREATE INDEX IF NOT EXISTS idx_event_expected_event ON event_expected (event_id);
CREATE INDEX IF NOT EXISTS idx_event_expected_person ON event_expected (expected_id);
```

A.3 — Backfill: any existing rows that already use `org_expected` table (if it exists from prior work) are left alone. If `org_expected` does NOT exist, no rows are inserted — orgs configure on first calendar visit.

A.4 — Acceptance: running the migration twice in a row produces no errors and no schema drift. Captain runs it via `npx wrangler d1 execute irlid-db-org --remote --file=migrations/apply_v5_11_0_calendar.sql` (or whatever the migration tooling expects — match the existing migration style).

A.5 — Self-verify before marking PR ready:
- [ ] Migration file syntactically valid SQLite (you can lint locally with `sqlite3 :memory: ".read migrations/apply_v5_11_0_calendar.sql"`).
- [ ] Idempotent (re-run yields no error).
- [ ] No mutations of existing tables.
- [ ] No `DROP` statements anywhere.

### PR-B — Worker endpoints (~60-90 min)

**Branch:** `codex/v5.11.0-port-B-worker`
**Files touched:** `irlid-api-org/src/index.js`. NO other files.
**Frontend:** NONE.

#### Tasks

B.1 — Add all endpoints per `CALENDAR-SPEC §2`. Read-only endpoints use `requireDevOrStaffSession`; manager+ writes use `requireSignedAction` (the v5.10 Path B helper Captain landed on 17 May).

| Endpoint | Method | Auth | Body / response shape |
|----------|--------|------|------------------------|
| `/org/rooms` | GET | staff+ | Returns `{ rooms: [{ id, label, subname, capacity, display_ix }] }` |
| `/org/expected` | GET | staff+ | Returns `{ expected: [{ id, display_name, initials, role_key, device_pub_fp, ... }] }` |
| `/org/expected` | POST | staff+ | Body `{ display_name, role_key?, email_hint?, phone_hint?, notes? }`; returns `{ expected_id }` |
| `/org/expected/:id` | PATCH | manager+ | Body any subset; signed action |
| `/org/expected/:id` | DELETE | manager+ | Soft-delete (sets `archived_at`); signed action |
| `/org/weekly-events` | GET | staff+ | Query `?room_id=` and `?day=` optional; returns `{ events: [{ id, name, room_id, day_of_week, start_time_local, duration_min, capacity, color_hex, expected_ids: [...] }] }` — `expected_ids` joined from `event_expected` |
| `/org/weekly-events` | POST | manager+ | Body includes optional `expected_ids: [...]`; server materialises into `event_expected` rows in same transaction; signed action |
| `/org/weekly-events/:id` | PATCH | manager+ | Body any subset; if `expected_ids` present, server diffs vs current `event_expected` rows and applies inserts + deletes atomically; signed action |
| `/org/weekly-events/:id` | DELETE | manager+ | Soft-delete; signed action |
| `/org/weekly-events/export-csv` | GET | staff+ | Returns CSV per `CALENDAR-SPEC §4.2`; `Content-Type: text/csv` with `Content-Disposition: attachment; filename="week-export-YYYY-MM-DD.csv"` |
| `/org/weekly-events/import-csv` | POST | manager+ | Multipart `file=` field; optional `?replace=1`; signed action; returns per-row report per `CALENDAR-SPEC §4.1` |

B.2 — CORS allowlist must remain `https://irlid.co.uk` only (do NOT add the new file's URL — same origin).

B.3 — Use existing helper functions where possible: `now()`, `genId()`, `requireDevOrStaffSession`, `requireSignedAction`, `bootstrapDeveloperFromBearer`, `orgAuth`. Don't reimplement what already exists.

B.4 — `expected_ids` array materialisation: when POST or PATCH body includes `expected_ids: [...]`, validate every ID exists in `org_expected` for the same `org_id` (anti-cross-org-injection guard). On success, write `event_expected` rows in the same D1 transaction as the `weekly_events` write.

B.5 — CSV import vocabulary-flex per `CALENDAR-SPEC §4.1`: the room column header may be any of `room`, `studio`, `hall`, `theatre`, `classroom`, `pitch`, `court`, `treatment_room`. Whichever is present, map to `room_id` by case-insensitive matching against `rooms.label`. Unknown room names default to `room_id = NULL`.

B.6 — CSV import auto-creates `org_expected` rows: when an `expected_names` cell contains a name not present in `org_expected` for that org, create a new `org_expected` row with `role_key='attendee'` and link it to the event. Report these in the response as `org_expected_created` count.

B.7 — `?replace=1` query param on import: if set, soft-archive ALL existing `weekly_events` for the org first, then insert the imported set. Single D1 transaction. If absent, insert-only with conflict-by-id rejection.

B.8 — Self-verify:
- [ ] All 11 endpoints respond.
- [ ] CORS allowlist unchanged.
- [ ] Cross-org Expected ID injection blocked.
- [ ] Signed action enforcement on all manager+ writes.
- [ ] CSV round-trip lossless on a 9-event sample.

### PR-C — `Org.html` UI (~90-120 min)

**Branch:** `codex/v5.11.0-port-C-ui`
**Files touched:**
- `Org.html` — DELETE the existing 1.9KB redirect shim, WRITE the new portal HTML.
- Any new CSS or JS that lands inside `Org.html` (single-file is fine; this mockup convention has worked).

**DO NOT TOUCH:** `OrgCheckin.html`, `OrgCheckinTest.html`, anything in `js/`, anything in `irlid-api-org/`.

#### Tasks

C.1 — Build `Org.html` by starting from `OrgCheckinTest.html` and stripping:
- Prototype-role toolbar (`#prototypeRoleSelectorRow`, `#prototypeRoleHelpRow`, the simulated-role chip system). Real role comes from the Worker session.
- Mockup seed data (`seedOrgExpected`, `seedEvents`, `seedRooms` functions and their callers). Replace with Worker fetches.
- LocalStorage state functions for calendar data (`V511_CAL_SETTINGS_KEY` is OK to keep — those are user preferences. `V511_ORG_EXPECTED_KEY`, `V511_EVENTS_KEY`, `V511_ROOMS_KEY` must go — those are server-canonical.)
- Mockup-only debug indicator simulator (the Debug pill in topbar that the mockup uses to test diagnostic surfaces).
- `IN-DESIGN` badges on tabs that are now actually backed (Event & Calendar, Staff & Rooms). Keep `IN-DESIGN` on Records & ID — that one IS still mockup-only this port.

C.2 — Wire the previously-mockup-only buttons through to the Worker endpoints per `memory/orphan-button-sweep-2026-05-23.md §2.2`. The orphan sweep already mapped every button to its Worker endpoint target — follow that table.

C.3 — Port back `signInHereBtn` (live-only orphan from the sweep) — the same-device WebAuthn quick-sign-in button that lives in `OrgCheckin.html`. Copy the HTML element + handler. Users on their own browser shouldn't have to QR-scan themselves.

C.4 — Build pill set to `v5.11.0` on this file only. `OrgCheckin.html` keeps its v5.10.7 pill.

C.5 — Service Worker (`sw.js`): bump `CACHE_VERSION` to next integer (currently `v16` after v5.10.7). Add `Org.html` to the precache list. Don't remove `OrgCheckin.html` from precache — it's still a live URL.

C.6 — Records & ID tab ships as mockup-only — visual only. All buttons in that tab read/write localStorage. Add a hint banner at the top of the tab: "Records & ID is design-in only this release. Backend storage broker arrives in v5.13+ — see PROTOCOL.md."

C.7 — Self-verify per `CALENDAR-SPEC §8` acceptance criteria (10 items). All ten must pass on the local file (open `Org.html` in a browser, walk the criteria).

### PR-D — Cutover + housekeeping (~20-30 min)

**Branch:** `codex/v5.11.0-port-D-cutover`
**Files touched:**
- `README.md` if it links to the portal — point to new URL.
- `roadmap.html` if it references the portal URL.
- Any milestone reference in `CLAUDE.md` if Number One wants to bank one (optional — Number One usually handles this in the watch-close memory commit).
- Optionally: `Org.html` — retire the disabled `websiteScrapeBtn` placeholder if Captain agreed to consolidation in his review of the orphan sweep.

**DO NOT TOUCH:** `OrgCheckin.html`, `OrgCheckinTest.html`, Worker, D1.

#### Tasks

D.1 — Update `README.md` portal URL reference (search for `OrgCheckin.html`; if any line points users at it AS THE PORTAL, update to `Org.html`; if it references it as the legacy/reference page, keep that reference).

D.2 — Search `roadmap.html` for portal URL references and update similarly.

D.3 — Optionally retire `websiteScrapeBtn` per Captain's call.

D.4 — Final smoke checklist (Captain runs, not Mr. Data): hard-refresh `irlid.co.uk/Org.html`; walk the 10 acceptance criteria from `CALENDAR-SPEC §8` on real hardware.

---

## §5 — Acceptance criteria (summary)

Per `CALENDAR-SPEC §8`. Verify on real hardware after all four PRs merge + Worker deploy + D1 migration:

1. Four new D1 tables exist with correct schema.
2. All §2 endpoints respond per spec.
3. `Org.html` Event & Calendar tab matches mockup surface-by-surface.
4. Modal Edit + View work; Day is read-only label; Expected section has search + suggestion checkboxes + chips + live count.
5. `isSelectedDayPast()` semantics work; all three `+ Add event` button sites gate identically.
6. CSV Export → Import round-trips losslessly including expected rosters.
7. Room vocab change renames PRESET_VOCAB+number rooms in lockstep.
8. Sticky tabs work on scroll.
9. No regression on v5.10.7 doorman / dashboard / sign-in.
10. Build pill reads `v5.11.0` on `Org.html`; still reads `v5.10.7` on `OrgCheckin.html` (which is untouched).

---

## §6 — Notes for Captain

- **`OrgCheckin.html` stays exactly as-is** through all four PRs. If anything breaks in the new `Org.html`, the old URL is the immediate fallback. Number One will catch any baseline drift via bash-diff before merge.
- **Worker deploy** uses your usual `cd irlid-api-org ; npx wrangler deploy` after PR-B merges. If wrangler API timeouts hit (now four receipts in BOOTSTRAP §6), fall back to Cloudflare dashboard Quick Edit.
- **D1 migration** runs via `npx wrangler d1 execute irlid-db-org --remote --file=migrations/apply_v5_11_0_calendar.sql` after PR-A merges. Idempotent — re-run safely if interrupted.
- **PR order is mandatory:** A (schema) → B (Worker — depends on schema) → C (UI — depends on Worker endpoints) → D (cutover). Don't merge out of order.
- **Pages auto-deploy** picks up `Org.html` the moment PR-C merges. The new URL is live (but unannounced) until you do the cutover smoke.
- **No promotion of the new URL yet** — wait until full v5.11.0 smoke is green. Once green, the cleaner URL goes into all promotional materials.

— Number One, handing the port plan over.
