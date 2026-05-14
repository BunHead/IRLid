# HANDOVER — Staff-invite QR flow (`v5.9.0.14` candidate)

**Repo:** IRLid-repo (LIVE — irlid.co.uk)
**Files:** `irlid-api-org/src/index.js` (Worker), `irlid-api-org/schema.sql` (D1), `OrgCheckin.html` (dashboard UI), `scan.html` (invite handler), `js/orgapi.js` (client helpers if needed).
**Scope:** First-class multi-device staff enrolment via one-shot signed invite QR. Closes the multi-device gap that `BOOTSTRAP_DEVELOPER_FP` multi-fp is currently papering over. **Lead Admin (and platform Developer) are the only roles that can issue invites in this PR. Manager-issued invites are explicitly deferred.**

---

## Background

Currently, the only way to get a second device into an org at staff-tier or above is to add the desktop fingerprint to `BOOTSTRAP_DEVELOPER_FP` (the platform-wide developer secret), which doesn't scale and isn't appropriate for non-developer staff. This brief introduces the proper primitive: a Lead Admin generates a short-lived signed invite QR; the new staff member scans it on their own device; their device enrols via WebAuthn; an `org_memberships` row is created at the encoded role. Single transaction, cryptographically authorised, one-shot.

## Authorisation model (the spec change to be aware of)

The Lead Admin invariant in PROTOCOL.md §14.9 is being tightened from "at least one, no upper bound" toward **"exactly one Lead Admin per org, except during a Developer-mediated swap window"** (Brief B, future). This PR enforces it forward by **rejecting any invite with `role=lead_admin` outright at the Worker**. Lead Admin promotion is no longer an org-level operation — it requires the platform Developer.

Role-tiered Add capability for invites in this PR is **deliberately tight**:

| Issuer | Can invite Staff | Can invite Manager | Can invite Lead Admin | Can invite Developer |
|---|---|---|---|---|
| Manager | ❌ (deferred to v5.9.0.15 + A1) | ❌ | ❌ | ❌ |
| Lead Admin | ✅ | ✅ | ❌ (deferred to Brief B) | ❌ |
| Developer | ✅ | ✅ | ❌ (deferred to Brief B) | ❌ |

Captain's rationale: "one person, one point of failure" — Lead Admin owns role assignments. Manager-issued invites can come later if the bottleneck becomes real. The Developer is self-authorising via `BOOTSTRAP_DEVELOPER_FP`; that path doesn't go through invites.

## Invite payload shape

A signed compact JSON envelope, base64url-encoded, prefixed `I:` (matching the existing `H:` / `HZ:` family):

```
I:<base64url(JSON({
  org_id: "<uuid>",
  role: "staff" | "manager",
  nonce: "<32 random bytes b64url>",
  expiry_ts: <unix ms, ~10 min from now>,
  issuer_pub_fp: "<16-char fp of issuing admin>",
  sig: "<ECDSA signature over the canonical payload, by issuing admin's hardware key>"
}))>
```

Canonical signing: sort keys, JSON-stringify, SHA-256, ECDSA P-256 — reuse `irlidCanonicalize` and `irlidSign` helpers in `js/sign.js`. No new crypto primitives.

## Worker — new endpoints

### `POST /org/invites/create`

- **Auth:** `requireDevOrStaffSession` + role check. **Issuer must be Lead Admin or Developer.** Reject Manager / Staff / Attendee with `403 insufficient_role`.
- **Body:** `{ role: "staff" | "manager", expiry_ms: <ms from now, default 600_000, max 3_600_000> }`. Reject `role: "lead_admin"` or `"developer"` with `400 lead_admin_invite_deferred`.
- **Behaviour:** Server constructs the canonical payload (org_id from session, nonce server-generated, expiry_ts = now + expiry_ms, issuer_pub_fp from session), client signs it (or server holds a session-bound signing context — see §16.3 cached snapshot pattern for reference; cleanest is client-signs and Worker-validates). Stores invite row in new `org_invites` table with status `pending`.
- **Response:** `{ invite_qr: "I:...", expiry_ts, nonce }`.

### `POST /org/invites/redeem`

- **Auth:** No session required (this is a first-touch enrolment endpoint). **The redeeming device need not be an existing IRLid subscriber** — see "Guest-account redeem flow" below.
- **Body:** `{ invite_payload: "I:...", new_device_pub_jwk: { kty, crv, x, y }, new_device_pub_fp: "<16-char>" }`.
- **Behaviour:**
  1. Decode `I:` payload. Verify signature against `issuer_pub_fp` looked up from `org_memberships` for that org.
  2. Confirm the issuer was Lead Admin or higher at the moment the invite was created (look up `org_memberships.role` for `issuer_pub_fp`). If not, reject with `403 issuer_role_revoked` (covers the case where an admin issued an invite then was demoted before redemption).
  3. Check `org_invites` row: must exist, `status === "pending"`, `expiry_ts > now`.
  4. Defence in depth — reject if somehow `role === "lead_admin"` with `400 lead_admin_invite_deferred`.
  5. INSERT `org_memberships` row: `org_id`, `pub_fp = new_device_pub_fp`, `pub_jwk = new_device_pub_jwk`, `role = invite.role`, `created_via = "invite:" + nonce`.
  6. UPDATE `org_invites` row: `status = "redeemed"`, `redeemed_by_fp = new_device_pub_fp`, `redeemed_ts = now`.
- **Response:** `{ ok: true, org_id, role, member_id }`.
- **Errors:** `404 invite_unknown`, `409 invite_already_redeemed`, `410 invite_expired`, `400 invite_bad_signature`, `400 lead_admin_invite_deferred`, `403 issuer_role_revoked`.

## Guest-account redeem flow (`scan.html` client side)

**The protocol binds to the device's hardware key, not to a personal IRLid identity.** A staff member who has never used IRLid before must still be able to redeem an invite — their device generates a fresh WebAuthn credential inline at scan time, that becomes their `pub_fp`, and the org membership is bound to it. They're a "guest member" of the org: recognised at the door, but with no consumer receipt history at `irlid.co.uk` until they sign up there separately. If they later do sign up on the same device, the WebAuthn credential is reused (same `pub_fp`) and the org membership automatically appears in their consumer receipts — identity is additive, no migration step.

`scan.html` flow when the `I:` prefix is matched:

1. Detect `I:` prefix → enter invite-redeem flow (don't fall through to attendee/doorman handling).
2. Decode and display invite summary: `[Org Name]` (looked up from `/org/public-meta?org_id=...` — new tiny public endpoint, returns just `{ name, logo_url }`, no auth, used here and for any future invite-style flows) is inviting you to join as `[Role]`. Tap **Accept** to enrol this device, or **Cancel**.
3. On Accept — check `navigator.credentials` for an existing IRLid Passkey on this device:
   - **If present** — reuse the existing `pub_fp` + `pub_jwk`. POST `/org/invites/redeem`. Show success: "You're now [Role] at [Org Name]. Show this device at the door. Your IRLid account already covers this device, so this org will appear in your receipts at `irlid.co.uk`."
   - **If absent (guest path)** — trigger WebAuthn `navigator.credentials.create` with the existing IRLid relying-party (so a later consumer sign-up reuses the same credential). Compute `pub_fp` from the new public key via the same helper used in consumer sign-up. POST `/org/invites/redeem` with the freshly-minted `pub_fp` + `pub_jwk`. Show success: "You're now [Role] at [Org Name]. Show this device at the door. To see your check-in history across orgs, sign up at irlid.co.uk — your enrolment will carry over automatically."
4. On any failure (signature bad / expired / already redeemed) — show the specific error from the Worker response. No silent retries.

**Why this works without compromise:**

- The Worker is identical in both branches — it doesn't know or care whether the `pub_fp` it just received was minted ten seconds ago or three years ago. It only cares that the signature verifies and the membership row inserts cleanly.
- The "consumer IRLid account" is itself just `(pub_fp + WebAuthn credential)` plus optional metadata. A guest member has the same primitives; they simply haven't visited `irlid.co.uk` to layer the consumer profile on top yet.
- A staff member who later wants receipts only needs to sign up at `irlid.co.uk` from the same device — the consumer flow detects the existing credential and ties the consumer profile to the same `pub_fp`. No data migration; the org membership rows are already keyed on `pub_fp` and remain valid.

**Edge case — guest member loses their device:** they have no consumer recovery path because they have no consumer account. The Lead Admin must `revoke` their `org_memberships` row and issue a fresh invite for the replacement device. Document this in the acceptance criteria.

### `POST /org/invites/revoke`

- **Auth:** Lead Admin or Developer only.
- **Body:** `{ nonce: "<...>" }`.
- **Behaviour:** Sets `org_invites.status = "revoked"`. Idempotent.

## D1 schema — new table

```sql
CREATE TABLE IF NOT EXISTS org_invites (
  nonce TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  role TEXT NOT NULL,
  issuer_pub_fp TEXT NOT NULL,
  expiry_ts INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | redeemed | revoked | expired
  created_ts INTEGER NOT NULL,
  redeemed_by_fp TEXT,
  redeemed_ts INTEGER,
  FOREIGN KEY (org_id) REFERENCES orgs(id)
);
CREATE INDEX idx_invites_org ON org_invites(org_id, status);
CREATE INDEX idx_invites_expiry ON org_invites(expiry_ts) WHERE status = 'pending';
```

## Dashboard UI — `OrgCheckin.html`, Settings panel

The "Invite staff" affordance lives **inside the Settings panel**, not in the dashboard topbar. Settings is currently Lead-Admin-only via the `#navSettings` nav-item's `data-min-role="lead_admin"`, which matches the issuer role-tier exactly. The invite section is naturally hidden from non-Lead-Admins for free.

- Add a new **"Invite staff"** section in the Settings panel, between the existing Role Vocabulary panel and the Website Theme Import placeholder (or wherever feels natural in section order — Mr. Data's judgement). The section header is `### Invite staff`.
- Section body:
  - Role picker (chips): `Staff`, `Manager`. No `Lead Admin` chip (deferred to Brief B). No `Developer` chip.
  - Expiry picker (chips): `10 min` (default), `30 min`, `1 hour`. No longer expiries in this PR.
  - "Generate invite" button → calls Worker `/org/invites/create`, displays returned QR full-size with a live countdown.
  - "Revoke" button beside the displayed QR → calls `/org/invites/revoke` and closes the QR display.
  - Below the displayed QR, brief help text: *"Have the new staff member scan this QR on their own device within the expiry window. They'll bind their device automatically."*
- The invite QR uses the same `qrcode-svg.js` rendering as the venue QR. Level H, generous quiet zone.
- No new topbar buttons. No changes to dashboard panel chrome.

## `scan.html` — new payload type

- In `classify()`, recognise the `I:` prefix and route to a new invite-handling branch.
- Invite branch:
  1. Display "Joining as <role> at <org name>" confirmation prompt.
  2. On confirm, fire WebAuthn enrolment (`navigator.credentials.create()`) with platform authenticator preferred — same pattern as `org-login.html` enrolment.
  3. Extract the new device's `pub_jwk` and compute `pub_fp` (canonical → SHA-256 → first 16 chars b64url, per `irlidPubFp` in `js/sign.js`).
  4. POST `/org/invites/redeem` with the payload, new device's `pub_jwk`, and `pub_fp`.
  5. On success: show "You're in!" toast with "Open dashboard" CTA → bounces to `org-login.html` for normal sign-in (their newly-enrolled device handles WebAuthn).
  6. On any redeem error: render the specific error message clearly (no generic "something went wrong").

## Acceptance criteria

1. **Happy path — existing IRLid subscriber:** Lead-Admin-signed-in desktop opens Settings, generates an invite (role=Staff), QR appears. Device with an existing IRLid Passkey scans, the existing credential is reused (no new WebAuthn prompt), `org_memberships` row inserted at `role=staff`, returning device signs in via normal flow, sidebar reads "Signed in as Staff." Worker `tail` shows clean traffic.
1a. **Guest happy path — no existing IRLid identity:** Same invite, but the scanning device is a fresh browser profile that has never used IRLid. `scan.html` triggers `navigator.credentials.create`, the user approves the biometric, a fresh `pub_fp` is minted, `org_memberships` row inserts cleanly. Device is now recognised at the door at `role=staff`. Visiting `irlid.co.uk` from the same device shows no consumer account yet (correct — they're a guest member). Subsequently signing up at `irlid.co.uk` from the same device reuses the same credential and the org membership appears in the new consumer receipts automatically.
1b. **Guest device loss:** Document the recovery path — Lead Admin revokes the guest's `org_memberships` row via Settings and issues a fresh invite. There is no consumer-side recovery because there is no consumer account. (Acceptance for this row is documentation, not code; the revoke endpoint already covers the mechanism.)
2. **One-shot:** Same QR scanned a second time (different fresh device) returns `409 invite_already_redeemed`.
3. **Expiry:** Generated invite with 10-min expiry, scanned 11 min later returns `410 invite_expired`.
4. **Tampered signature:** Modifying any byte of the `I:` payload before scanning returns `400 invite_bad_signature`.
5. **Lead Admin invite rejected:** A constructed payload with `role: "lead_admin"` returns `400 lead_admin_invite_deferred` at both create and redeem.
6. **Manager-issued invite rejected:** Manager-signed-in attempt at `/org/invites/create` returns `403 insufficient_role`. (Manager doesn't see the Settings panel in this PR anyway, since `#navSettings` is Lead-Admin-only — Manager-can-issue-invites is deferred to v5.9.0.15.)
7. **Privileges actually correct:** A device that redeemed at `role=staff` tries to delete an attendee → blocked by existing role-gating. Tries to add an attendee → allowed.
8. **Existing invariants intact:** "Cannot remove last Lead Admin" still fires (`409 would_orphan_org`).
9. **Revoke works:** Lead Admin revokes a pending invite via Settings; subsequent redeem attempts return `409 invite_already_redeemed` (or a more specific `410 invite_revoked` if you prefer — naming convention is yours).
10. **Pill bump:** `Build v5.9.0.13.34` → `Build v5.9.0.14` (this is a minor version, not a patch, because it adds a new protocol primitive).

## Out of scope (deferred)

- **Manager-issued invites.** Coming in `v5.9.0.15` (Brief A1) once Settings opens to Manager-tier with per-item role-gating. For now, Worker rejects with `403 insufficient_role`.
- Lead Admin invitation. Belongs in Brief B with the swap-window UX.
- Developer invitation. Stays as `BOOTSTRAP_DEVELOPER_FP`-only.
- Email/SMS delivery of the invite QR. In this PR the QR is on-screen, scanned in person — for remote onboarding, the Lead Admin can screenshot and send via any secure channel (WhatsApp / Signal / etc.).
- Bulk invitation / spreadsheet import.
- Invite analytics dashboard (created vs redeemed vs expired).
- Per-invite custom name pre-fill on the Expected list.
- Admin action audit log. Coming in `v5.9.0.16` (Brief A2) — invite issuance and redemption will be retrofitted into the audit log there.

## Style notes

- British spellings.
- Reuse existing crypto helpers in `js/sign.js` — no new ECDSA / SHA-256 primitives.
- Reuse existing role-tier patterns (`requireDevOrStaffSession`, `body[data-prototype-role]`, `developer-bearer-active`, `data-min-role`).
- Worker errors return structured JSON `{ error: "<code>", message: "<human>" }` matching existing convention.
- The new QR type prefix `I:` is the canonical home for "invite" — don't conflate with `H:` (HELLO) or `HZ:` (HELLO compressed) families.
- The Settings panel section uses the existing `.settings-card` (or equivalent) styling of neighbouring sections — match the visual weight of Role Vocabulary / Theme Import placeholder.

## Open questions for Captain (decide before merge if not already)

1. **Expiry default:** 10 min, 30 min, or 1 hour for the dropdown default? Brief assumes 10 min.
2. **Notification to other admins** when a new Manager/Staff joins? Out of scope for this PR, will fall out naturally from Brief A2 (audit log).

Ship as single PR labelled `v5.9.0.14`. Substantive change — expect ~300-500 lines across Worker + Dashboard + scan.html + schema. Captain verifies via the test plan above; recommend running through all ten acceptance criteria before merge.
