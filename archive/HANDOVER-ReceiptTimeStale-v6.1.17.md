# HANDOVER — Mr. Data — `v6.1.17` — Dashboard ↓ Receipt shows a stale check-in time

**Branch:** `codex/v6.1.17-receipt-time-stale`
**Approach:** DIAGNOSE FIRST with `wrangler tail` — do not guess. Likely Worker, possibly
a one-line back-fill. Independent of the Org.html frontend bundles.

---

## The Bug (observed on real hardware, 4 June, build v6.1.13)

Captain checked in on his own device this morning at **08:18** (Dashboard "Last seen
04/06/2026, 08:18", Spencer Austin, status IN, scan_count 5). But the Dashboard **↓ Receipt**
link opens an org receipt whose **Time reads 03/06/2026, 20:18** — a *previous* scan, not
today's check-in. The receipt should reflect the check-in the dashboard row represents.

## What the code already does (so you can target the diagnosis)

- `mintOrgReceipt` (Worker ~L2869) mints a receipt per check-in, INSERTs into `org_receipts`
  with `created_at: now()` and `checkin_id = checkinRow.id`, and `createCheckin` (~L3461)
  calls it and returns `receipt_id`.
- The dashboard groups attendance by attendee and picks the receipt with the **latest**
  `lastSeen` (Org.html `buildReceiptLink` ~L14484; the selection at ~L14091 updates
  `existing.receipt_id` only when `lastSeen >= existing.receipt_seen_at`).
- So the dashboard is *trying* to show the newest receipt. The stale time means **today's
  08:18 check-in row has no fresh `receipt_id`** attached — i.e. either (a) the 08:18
  check-in didn't mint a receipt, or (b) it minted but never wrote `receipt_id` back onto
  the `org_checkins` row, so the grouping fell back to the last row that *did* have one
  (20:18).

## Diagnose

1. **Confirm whether each check-in mints + back-fills.** `wrangler tail irlid-api-org`,
   then check Spencer in again on the device. Watch for the mint and for an UPDATE writing
   `receipt_id` onto the `org_checkins` row.
2. **Inspect the rows:**
   ```
   npx wrangler d1 execute irlid-db-org --remote --command "SELECT id, created_at, receipt_id, scan_count, status FROM org_checkins WHERE org_id='<org>' ORDER BY created_at DESC LIMIT 10;"
   npx wrangler d1 execute irlid-db-org --remote --command "SELECT id, checkin_id, created_at FROM org_receipts WHERE org_id='<org>' ORDER BY created_at DESC LIMIT 10;"
   ```
   This shows whether an 08:18 receipt exists and whether its `checkin_id` matches a row
   whose `receipt_id` is NULL (= the back-fill gap).

## Likely fix (pick after diagnosis)

- **If a check-in updates an existing active row (scan_count++) without re-minting** → mint
  on every recorded check-in event, OR (simpler, immutable-friendly) on each mint write the
  new `receipt_id` back onto that `org_checkins` row so the dashboard's latest-receipt
  selection resolves to it.
- **If the back-fill UPDATE is missing/failing** → add/repair the `UPDATE org_checkins SET
  receipt_id=? WHERE id=?` after the `org_receipts` INSERT.
- **Do NOT** rewrite or delete old `org_receipts` rows (immutable-DB rule). Append + correct
  the pointer only.

## File touch list
| File | Change |
|---|---|
| `irlid-api-org/src/index.js` | mint/back-fill correction on the check-in path |
| Build pill / sw.js | bump if any frontend change (likely none) |

## A/R/D expectations
- **✅ ACCEPT ✅** — `tail`/D1 show the root cause; after fix, a fresh check-in's ↓ Receipt
  reads the *current* check-in time; old receipts untouched.
- **⚠️ REVIEW ⚠️** — Fix guesses without the tail/D1 evidence; or rewrites historical rows.
- **⛔ DENY ⛔** — Mutates/deletes existing `org_receipts`; changes signature/verification.

## Smoke
1. Check in on a device now → open ↓ Receipt → Time matches *this* check-in (±1 min) ✅
2. Old receipts still verify at 100% in check.html (untouched) ✅

— Number One (4 June 2026)
