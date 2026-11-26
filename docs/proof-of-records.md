# Proof of records: audit and plan

**Status:** phase 1 built (v6.8.32, PR on top of #220). Phases 2 to 4 are a plan, not built.
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
- **Staff (any staff-tier member):** **Export my actions (CSV)** under Last 7 days: only the rows
  for what they did (`GET /org/audit-log?mine=1`). They still cannot see the whole log.
- **Attendee:** their own signed receipts (My Receipts, and the optional account backup from
  v6.8.26). Each receipt is signed by the organisation, so it proves the visit on its own.

## 3. Not changed, needs Spencer

- **Delete record and Clear attendance still erase.** "Never hard-delete" would change rule R1,
  which allows deliberate erasure and says the log keeps that it happened, not the erased data.
  Erasure is also how an organisation meets a person's right to be forgotten (R3: GDPR is the
  org's job). Only Spencer changes a rule.
- **Removing someone from an event still deletes the link row.** It is now logged (who, when,
  which person), so it can be proven and put back. Keeping the row instead needs a new column
  (a D1 migration) and every calendar query changed: phase 2.

## 4. Later phases (plan, not built)

2. **Soft removal from events:** migration `000N_event_expected_removed_at.sql` (adds
   `removed_at`, `removed_by`; R4 add only); the Worker filters on it once present.
3. **Attendee "my records here":** a page on the phone that lists that person's check-ins and
   check-outs at an organisation, signed with their own device key (reuses the v6.8.30 device
   proof, so it waits for PR #219), and exports them.
4. **Staff view in the app** of "my actions" (not just the CSV), and an org-wide export of
   check-ins with their receipts.
