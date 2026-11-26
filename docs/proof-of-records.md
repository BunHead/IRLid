# Proof of records: audit and plan

**Status:** phase 1 built (v6.8.32, PR #222). Phases 2 to 4 are a plan, not built.
Asked by Spencer, 26/11/2026: "every record must be kept and every party (attendee, staff,
org admin) must be able to prove each part later".

Read with `docs/rules.md`: R1 (never edit a record; Delete record and Clear attendance are
deliberate erasure), R4 (database changes only add), R5 (the log never blocks, except erasure).

## 1. What was audited (org Worker, every write)

| Area | Before | Now |
|---|---|---|
| Check-in | A new row each time, never edited; a signed org receipt for the person | unchanged |
| Check-out | Fills the check-out fields once (R1); auto check-out marked "auto" (R6) | unchanged |
| Admin actions log | Append-only (database triggers refuse edit and delete) | unchanged |
| Signed admin actions (calendar edits, binds, add at door, kiosk unlock, offline codes, screen approval) | Logged, but one generic line ("Calendar change") | plus the detail rows below |
| Kiosk unlock, offline unlock, screen revoke | Logged | unchanged |
| Settings (incl. kiosk lock on/off) | Logged, with which settings changed | unchanged |
| Delete expected / Restore expected | Logged since v6.8.17 / v6.8.19 | unchanged |
| Delete record, Clear attendance | Logged in the same transaction (fail-closed, R1/R5) | unchanged |
| **Add attendee (dashboard form)** | **not logged** | `expected_create` |
| **Edit attendee** | generic line only, no old/new | `expected_update` (old -> new) |
| **New phone (rebind)** | `rebind_history` only, not in the log | `expected_rebind` |
| **Attendee claims a name** | **not logged** | `expected_claim` (actor: their phone) |
| **Phone clash decision** | **not logged** | `conflict_resolve` |
| **Revoke invite** | **not logged** | `invite_revoke` |
| **Who was added to / removed from an event** | **not logged** (removal deletes the link row) | `event_attendees_change` |
| **Week CSV import** | generic line only | `calendar_import`, with every name not added |

**The 15/11 Bradley delete:** "Delete expected" only started writing to the log in v6.8.17
(built 15/11 15:34, merged 16/11). A delete made before that was never logged and cannot be
recovered into the log now.

## 2. Who can see or export what (phase 1)

- **Org admin (Lead Admin / Developer):** the whole Admin actions log, and **Export CSV**.
- **Staff:** no view of their own. Captain's decision (26/11/2026): staff ask their Lead Admin,
  who can export the log. A staff "my actions" view was built and then removed before merge.
- **Attendee:** their own signed receipts (My Receipts, and the optional account backup from
  v6.8.26). Each receipt is signed by the organisation, so it proves the visit on its own.

## 3. Not changed (Captain's decision, 26/11/2026)

- **Delete record and Clear attendance still erase, under rule R1.** R1 allows deliberate
  erasure and says the log keeps that it happened, never the erased data. Erasure is also how an
  organisation meets a person's right to be forgotten (R3). Unchanged for now.
- **Removing someone from an event still deletes the link row.** Since v6.8.32 it is logged
  (who, when, which person), so it can be proven and put back. Keeping the row is phase 2.

## 4. Phase 2 plan: soft removal from events (NOT built; the Captain runs the migration)

Goal: taking a person off an event keeps the link row, marked as removed, instead of deleting it.

1. **Migration (written in its own PR, applied by the Captain only, through the "D1 migrations
   (org database)" workflow):** a new file `irlid-api-org/d1-migrations/0004_event_expected_removed.sql`
   that only adds (R4):
   - `ALTER TABLE event_expected ADD COLUMN removed_at INTEGER;` (seconds, like the rest of the
     calendar tables; W10)
   - `ALTER TABLE event_expected ADD COLUMN removed_by TEXT;`
   - an index on `(event_id, removed_at)`.
   SQLite has no `ADD COLUMN IF NOT EXISTS`, so the columns go in this one file only.
2. **Worker, tolerant both ways** (it deploys on merge, the migration is applied later):
   - checks for the column with `tableColumnSet` (as elsewhere);
   - **removing** a person: `UPDATE event_expected SET removed_at=?, removed_by=?` when the column
     exists, the current `DELETE` (logged) when it does not;
   - **adding back** someone removed: clears `removed_at` / `removed_by` and logs it (one row per
     event and person, so the history lives in the log, not in many rows);
   - **every read** of `event_expected` adds `removed_at IS NULL` when the column exists:
     the calendar list and export, the attendance "expected not yet seen" rows, the event
     attendee picker, the CSV import's links, the cross-org sweep.
3. **Delete record (R1 erasure) keeps deleting** that person's links, as now.
4. **Tests:** before and after the migration (both table shapes); a removal keeps the row and
   hides it everywhere; adding back restores it; the log has both steps; erasure still erases.
5. **Order:** the Worker change can merge first (it works without the column); the Captain then
   applies the migration; nothing breaks in between.

## 5. Later phases (plan, not built)

3. **Attendee "my records here":** a page on the phone that lists that person's check-ins and
   check-outs at an organisation, signed with their own device key (reuses the v6.8.30 device
   proof from #219), and exports them.
4. **An org-wide export of check-ins with their receipts** for the Lead Admin.
