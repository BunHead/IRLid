# HANDOVER — Mr. Data — `v6.1.19` — Show org check-in receipts in the attendee's own history

**Branch:** `codex/v6.1.19-org-receipts-in-history`
**Surface:** `receipt.html` only (consumer side). **No Worker, no schema.** Independent of all
Org.html work — safe to run alongside anything.

---

## The gap (Task 16, the easy slice)

When an attendee **self-checks-in** on their own phone, the org receipt is already stored on
that device — `org-entry.html → storeOrgReceipt()` writes `localStorage["irlid_org_receipts"]`
(array). But the consumer receipts list in `receipt.html` only loads P2P receipts via
`window.IRLBackend.listReceipts()` (with a local fallback) — it **never reads the org
receipts**. So the attendee can't see their own check-ins in their history; they're only
reachable via the org dashboard's ↓ Receipt link. This closes that for the self-check-in case.

**Out of scope:** doorman/staff-scan check-ins, where the attendee's device was never in the
loop, so nothing is in their localStorage. Surfacing those needs server-side account linkage —
a later, bigger piece. Don't attempt it here.

## Stored shape (already on device — read, don't change)
```js
// localStorage["irlid_org_receipts"] = [ {
//   receipt_id, receipt_url,            // receipt_url = "receipt.html?org_receipt=<id>"
//   checkin_id, event_id, event_name,
//   org, org_name, created_at,          // created_at = ms epoch
//   receipt                              // the signed receipt payload
// }, ... ]
```

## What to build (in `receipt.html`)
1. Helper `getLocalOrgReceipts()` → parse `irlid_org_receipts`, tolerate missing/corrupt JSON
   (return `[]`), dedup by `receipt_id`, then **collapse to ONE entry per `event_id`**
   (Captain's refinement: an attendee needs *one* receipt per event — their attendance span,
   first check-in / last check-out — not one per scan). For each `event_id` group keep a single
   display entry: link to the **most recent** receipt for that event (`created_at` max), but
   label it with the event + the span (earliest `created_at` as first-in; if a check-out receipt
   exists in the group, its time as last-out). Entries with no `event_id` (general venue
   check-ins) stay as individual entries. Sort the resulting list newest-first.
2. In the receipts-list load path (around `loadReceipts` / the P2P list render ~L1350-1392),
   **also render the org receipts** as their own labelled group — a small header like
   **"Your check-ins"** above the list (keep provenance clear; don't silently merge with P2P).
   Render each item (reuse `renderReceiptItem` or a close variant) showing:
   - **org logo** (left of the title) — not in the stored receipt; fetch the org's public info
     by slug (`entry.org`) from the existing public endpoint, fetch-once-and-cache per org; if
     the org has no logo / it can't be resolved, **fall back to the IRLid logo** (the site's own
     mark), not just text.
   - title: `org_name || org || "Organisation check-in"`
   - subtitle: `event_name` (if present) + the attendance span: **first check-in** (earliest
     `created_at` in the event group) and **last check-out** (the group's check-out receipt time
     if one exists, i.e. an entry whose `receipt.action === 'out'`).
   - a small **"Org check-in"** badge so it's distinguishable from P2P receipts.
   - click → navigate to the entry's `receipt_url` (i.e. `receipt.html?org_receipt=<id>`).
3. Show the group on **both** paths: when `listReceipts()` succeeds AND on the local fallback
   (`loadLocalReceipts`). If there are zero org receipts, render nothing (no empty header).
4. Don't break pagination of the P2P list — the org group is a separate fixed block, not paged.

## File touch list
| File | Change |
|---|---|
| `receipt.html` | `getLocalOrgReceipts()` + render the "Your check-ins" group in the list |
| `sw.js` | cache bump |
| Build pill (if receipt.html carries one) / version note | → `v6.1.19` |

## A/R/D expectations
- **✅ ACCEPT ✅** — After a self-check-in, opening the Receipts list shows a "Your check-ins"
  group with that org/event + time; clicking opens the verifiable org receipt (100% Confirmed);
  P2P receipts + pagination still work; zero org receipts → no empty group.
- **⚠️ REVIEW ⚠️** — Org receipts silently merged into P2P list (provenance lost); breaks
  pagination; crashes on corrupt localStorage.
- **⛔ DENY ⛔** — Any Worker/schema change; alters how org receipts are stored or verified.

## Smoke
1. Self-check-in on a phone → open Receipts (SRAustin ▾ → Receipts) → "Your check-ins" group shows it
2. Tap it → org receipt renders, verifies 100%
3. P2P receipts list + pagination unchanged
4. Fresh device with no org receipts → no empty group, P2P list normal

— Number One (4 June 2026)
