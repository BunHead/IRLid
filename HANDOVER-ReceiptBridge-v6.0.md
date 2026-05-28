# HANDOVER — Mr. Data — `v6.0` — Org check-in receipt bridge (two-line convergence)

**Design spec:** `PROTOCOL.md §17` — read in full before starting. This is the canonical specification; the HANDOVER below is the implementation checklist.
**Target:** `v6.0`. SW cache bump: monotonic from current.
**Branch:** `codex/v6.0-receipt-bridge`
**Priority:** This is the **trust gate before Patreon promotion**. Captain's directive: *"prioritise two-line convergence before Patreon"*.

---

## What you're building

Every Org check-in (Spencer scans the venue QR) currently writes ONE thing: a row in `org_checkins` (operational data, database-only). After v6.0, each check-in writes TWO things:
1. The operational row (unchanged — the dashboard still reads from it)
2. A new **consumer-format ECDSA receipt** in `org_receipts`, signed by the org's venue key, downloadable + shareable + verifiable by any third party via `check.html`

The architecture is in `PROTOCOL.md §17`. Read it carefully — the receipt format (§17.2), signing model (§17.3), mint flow (§17.4), D1 schema (§17.5), endpoints (§17.6), privacy model (§17.7), and threat model (§17.8) are all specified there. Acceptance criteria in §17.11.

---

## File touch list

| File | Change |
|---|---|
| `irlid-api-org/migrations/apply_v6_0_org_receipts.ps1` | NEW. Idempotent CREATE TABLE `org_receipts` + 3 indexes (exact SQL in §17.5). |
| `irlid-api-org/src/index.js` | EXTEND `createCheckin` handler: after `org_checkins` INSERT, mint receipt, INSERT into `org_receipts`, return `receipt_id` + `receipt_url`. ADD `GET /org/receipt/:receipt_id` (public, returns receipt envelope). ADD `GET /org/public-info/:slug` (public, returns `{ org_id, slug, name, venue_pub_jwk }`). |
| `Org.html` | Dashboard attendance row gains "↓ Receipt" link per row when `org_receipts.id` is present. Hook in `loadDashboardForOrg` / attendance render to read the receipt_id from the row data. |
| `org-entry.html` | After successful check-in, store the receipt in attendee's localStorage under key `irlid_org_receipts` (array, max 50 entries, FIFO). |
| `receipt.html` | Accept `?org_receipt=<id>` URL parameter. Fetch from `GET /org/receipt/:id`. Render with same visual treatment as P2P receipts. "Verify" button performs client-side ECDSA verification using `venue_pub_jwk` from `/org/public-info/:slug`. |
| `check.html` | Accept Org receipt format alongside existing P2P. Detect `kind: "org_checkin"`, render org-specific fields (event, room, org name with link to `/org/public-info/:slug`). |
| `sw.js` | Cache bump. Pre-cache `receipt.html` + `check.html` if not already in `SHELL_ASSETS`. |
| Build pill `Org.html:3275` | `v5.11.23a` → `v6.0`. |

---

## Key implementation details

### Org venue keypair

Each org has a `venue_pub_jwk` (public, JSON Web Key format) + `venue_priv_key` (private). These already exist in the `organisations` table (added in v5.9 schema for `org_` prefixed api_keys signing). Verify they're populated for all existing orgs — if not, generate per-org keypairs as part of the migration and back-fill.

### Signing

Use the existing `verifySig` / `signCanonical` helpers in the Worker (same primitives as `verifyV5Envelope`). The signature is ECDSA P-256 over `canonical(receipt-without-sig)` (the `sig` field is excluded from the canonical input — same pattern as P2P receipts in `js/sign.js`).

### Receipt payload (§17.2 — copy verbatim)

The receipt shape MUST match §17.2 exactly. `kind: "org_checkin"` is the discriminator. The `attendee.display_name` comes from the Expected list at time of check-in; for unrecognised devices it's `null` and `attendee.anonymous = true`.

### Privacy mode

If the org's settings have `privacy_mode = true`, the receipt's `gps` field is replaced by `gps_hash` (SHA-256 over `lat|lon|acc_m`). Same pattern as v4 redacted receipts in the consumer P2P flow.

### Idempotency

The migration is idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`). Safe to re-run. Test by running it twice against the test DB before applying to live.

### Failure mode

If the receipt INSERT fails (D1 hiccup), the operational `org_checkins` row still succeeds. The Worker response includes `receipt_unavailable: true` and the receipt can be backfilled later via the Phase C endpoint (v6.1 work — don't implement in v6.0).

### Smoke tests

Use the §17.11 acceptance criteria as your smoke checklist:
1. Migration runs idempotently
2. Worker `createCheckin` returns `receipt_id` + `receipt_url`
3. `GET /org/receipt/:id` returns the canonical envelope
4. `GET /org/public-info/:slug` returns `{ org_id, slug, name, venue_pub_jwk }`
5. `check.html` accepts Org receipt URL and verifies
6. Dashboard "↓ Receipt" link appears on new rows
7. Attendee's localStorage gains receipt after real check-in
8. Multi-attendee smoke: 2-3 check-ins, all verifiable independently

---

## What NOT to touch

- **The existing P2P receipt flow** — `js/sign.js`, `scan.html`, the receipt encoding helpers. v6.0 ADDS Org receipts; it doesn't modify P2P.
- **The Visual Theming reorganisation** (`HANDOVER-VisualThemingReorg-v5.12.0.md`) — that's a SEPARATE PR. Captain explicitly wants v6.0 FIRST. Do v6.0, get it merged, then start v5.12.0.
- **The Check-in tab clone area** (`renderInlineCheckinClone`, `renderRealVenueQrIntoInlineClone`, etc.) — orthogonal to receipt minting.
- **Existing Worker endpoints** — extend `createCheckin`, add two NEW endpoints, but don't modify any other handler.
- **D1 schema beyond the new `org_receipts` table** — no changes to `org_checkins`, `organisations`, `org_expected`, `org_memberships`.

---

## Deploy order

1. **Worker first** — run the D1 migration, then `wrangler deploy` the Worker. New endpoints + extended `createCheckin` go live. Old clients (still doing the existing check-in POST without expecting `receipt_id` in response) ignore the new field; nothing breaks.
2. **Client second** — push `Org.html`, `org-entry.html`, `receipt.html`, `check.html` to Pages. New clients consume the `receipt_id` and surface the "↓ Receipt" link.

This order is forward-compatible — old clients continue working through the rollout window.

---

## A/R/D verdict expectations

Number One will bash-diff against `origin/main` per BOOTSTRAP §4.

- **✅ ACCEPT ✅** — Migration + Worker endpoints + minimal client changes per §17. P2P receipt flow untouched. No Visual Theming touches. No `org_checkins` schema changes. Idempotent migration. Acceptance criteria §17.11 all green.
- **⚠️ REVIEW ⚠️** — `org_checkins` schema modified; receipt format diverges from §17.2; `attendee.display_name` leaks for `anonymous_mode` orgs; `venue_priv_key` exposed in any response.
- **⛔ DENY ⛔** — P2P receipt flow modified; Visual Theming reorg started simultaneously (separate PR); new D1 tables beyond `org_receipts`; receipt signing uses a key not tied to the org.

---

## Captain's smoke

After deploy, Captain runs:
1. Hard-refresh `irlid.co.uk/Org`. Sidebar reads `Build v6.0`.
2. Real check-in on phone (8 Pro scans venue QR). Confirm: post-accept page shows "↓ Download receipt" link.
3. Tap the link → receipt downloads / opens in `receipt.html` → renders org name, event name, attendee name, timestamp, GPS map (or "GPS redacted" if privacy mode).
4. Open the receipt URL on a different browser (no IRLid session) → `check.html` loads it → click Verify → ECDSA verification passes → green "Verified" badge.
5. Dashboard: "Attendance Today" rows show "↓ Receipt" link. Click → same receipt opens.
6. Real check-OUT → second receipt minted with `action: "out"`.
7. Multi-attendee: Kerry checks in → her phone gets her own receipt; Captain's phone doesn't see hers (unless privacy_mode allows public list).

If 1-7 pass, the bridge is live and Patreon promo can proceed honestly.

---

## Captain's words verbatim (the why)

*"Before singing our praise on Patreon the two-line convergence ought to be soon after if not working. When (seems like if) people start using this, they'll want to access all their receipts."*

This is the gate. Ship clean.

— Number One (drafted 28 May 2026 Thursday morning watch)
