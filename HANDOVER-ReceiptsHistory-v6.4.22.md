# HANDOVER — v6.4.22 Receipts history panel (Mr. Data test run, £7-plan sized)

**One task, one PR, frontend-only. No Worker changes. No D1 changes. No new endpoints.**

## Goal
The dashboard shows receipts only as per-row "↓ Receipt" links. Add a **Receipts** collapsible
panel to the Dashboard tab (below "Expected attendee management") listing all receipts for
today's attendance, with verify links and a CSV export. This completes the grant-compliance
story: "attendance your funders can independently verify".

## Where the data already is
- `refreshAttendance()` in `Org.html` fetches `/org/attendance`; rows already carry
  `receipt_id` when the checkin minted one (the same field `buildReceiptLink` (~L15538) uses).
- Receipt URL shape: `https://irlid.co.uk/receipt.html?org_receipt=<receipt_id>`
- Verify URL shape: `https://irlid.co.uk/check.html?org_receipt=<receipt_id>`

## Build
1. New collapsible panel `<details>` in the Dashboard tab, id `receiptsHistoryPanel`,
   summary "Receipts". Match the existing "Process attendee scan" / "Expected attendee
   management" panel styling exactly.
2. Table columns: Name | Time (DD/MM/YYYY HH:MM, UK format) | Action (in/out) | Receipt
   (link "Open") | Verify (link "Verify"). Rows = attendance rows that have `receipt_id`.
   Empty state: "No receipts yet today — receipts are minted at check-in."
3. Re-render whenever the attendance table re-renders (hook the same code path — do NOT
   add a second fetch/poll).
4. "Export CSV" button in the panel header: columns name,time_iso,action,receipt_id,
   receipt_url,verify_url. Filename `irlid-receipts-YYYY-MM-DD.csv`. Reuse the existing
   CSV escaping helper if present; otherwise quote-and-double-quotes escaping.
5. Bump build pill v6.4.21 → v6.4.22 (sidebar-footer span) and sw.js CACHE_VERSION
   v171 → v172 (prepend one line to the comment, keep PRIOR history).

## Out of scope (do NOT touch)
- Worker (`irlid-api-org/**`), schema, migrations.
- Attendee-facing "my receipts" (separate future task).
- The per-row "↓ Receipt" links (leave as is).
- Anything in Settings, celebration, or check-in surfaces.

## Acceptance
- Panel renders with rows matching visible attendance receipts; links open correct URLs.
- CSV downloads and opens in a spreadsheet with correct escaping.
- No new console errors on load or refresh cycle.
- Diff touches Org.html + sw.js ONLY. State expected diff size in the PR description
  (~150-250 lines). Self-check list in PR description per usual format.
