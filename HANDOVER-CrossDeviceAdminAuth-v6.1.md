# HANDOVER — Mr. Data — `v6.1` — Cross-Device Admin Authorization

**Design reference:** This brief + PROTOCOL.md §14.5 (existing QR-login pattern that this work extends).
**Target:** `v6.1` (after `v6.0` receipt bridge merges).
**Branch:** `codex/v6.1-cross-device-admin-auth`
**Priority:** Unblocks admin actions from devices without v5 credentials enrolled. Captain's directive yesterday: *"could this fire a v5 hardware back check to my phone?"*

---

## Context

As of v5.11.23, admin actions that require signing (e.g., +Invite Staff, future Lead Admin appointment, future high-trust operations) use `signActionPayload(...)` which calls WebAuthn on the CURRENT device. If that device doesn't have a v5 credential enrolled, the action fails with a "Hardware-backed signing required" toast.

This is a friction point for:
- Desktop admins managing their org (Captain managing IRLid from his tower)
- Studio owners on a tablet without per-device enrolment
- Any cross-device workflow where the authorization device differs from the action device

**The architectural ideal:** the action device shows a QR encoding the action payload. The admin's enrolled phone scans the QR, signs the action with their hardware credential, the Worker accepts. The action device polls and claims when the signature arrives. **Same QR-login pattern, applied to admin actions.**

Captain's framing yesterday: *"could this fire a v5 hardware back check to my phone, so that I can confirm the add"*. Yes — and we already have the infrastructure for it (v5.5 QR-login + v5.10.1 Path B per-action signing).

---

## What you're building

A **cross-device action authorization** flow that mirrors the existing QR-login flow at PROTOCOL.md §14.5 but for signed actions instead of session creation.

### Flow

```
1. Admin on Desktop clicks "+ Invite Staff" → fills form → clicks Add
2. Desktop checks: do I have a v5 credential? (window.IRLidV5 or equivalent)
3. IF YES: existing signActionPayload flow (no change from v5.11.23)
4. IF NO: trigger cross-device auth
   a. Desktop POSTs /org/action/init with the action payload
   b. Worker creates a pending_action_authorization row with a nonce + ts
   c. Worker returns a nonce that desktop encodes into a QR
   d. Desktop displays: "Scan with your enrolled phone to authorize"
5. Admin's phone scans the QR
   - QR contains: action_nonce + worker_base_url + action_summary (human-readable)
6. Phone loads org-action-auth.html?nonce=<n>&worker=<url>
7. Phone fetches /org/action/poll?nonce=<n> to get full action payload
8. Phone shows: "Authorize 'Invite Becky Wetherill as Manager'? [Approve]"
9. Admin taps Approve → WebAuthn prompt → signs canonical(action_payload)
10. Phone POSTs /org/action/claim with the signed envelope
11. Worker verifies signature, marks action_nonce as claimed, executes the action
12. Desktop polling picks up "claimed" → continues the post-action flow
```

### What stays the same

- The signed payload format (matches existing `signActionPayload` envelope shape)
- The Worker's `requireSignedAction` verifier (no changes)
- The action execution logic (invite creation, etc.) — runs server-side same as today, just gated on the cross-device signature instead of the inline one

### What's new

- D1 table `pending_action_authorizations` (nonce, action_payload_json, expires_at, claimed_at, signature)
- 3 Worker endpoints: `/org/action/init`, `/org/action/poll`, `/org/action/claim` (mirror the existing `/org/login/{init,poll,claim}` pattern)
- New page `org-action-auth.html` — mobile-first, single-purpose: "Authorize this action?" with Approve / Reject buttons
- Client-side fallback in `signActionPayload` — if no v5 credential available, automatically routes to the cross-device flow instead of throwing

---

## File touch list

| File | Change |
|---|---|
| `irlid-api-org/migrations/apply_v6_1_pending_actions.ps1` | NEW. Idempotent CREATE TABLE `pending_action_authorizations` + indexes (nonce, expires_at, org_id). |
| `irlid-api-org/src/index.js` | ADD 3 endpoints: `POST /org/action/init`, `GET /org/action/poll/:nonce`, `POST /org/action/claim`. ~150 lines, mirror the structure of existing `/org/login/{init,poll,claim}`. |
| `org-action-auth.html` | NEW. Mobile-first page. Reads nonce from URL, fetches action payload, shows human-readable summary, Approve button triggers WebAuthn signing, POSTs claim. ~200 lines, mirror `org-login.html` structure. |
| `js/sign.js` | EXTEND `signActionPayload` — if WebAuthn fails with "no credential available", fall back to cross-device flow (init → display QR → poll until claimed). |
| `Org.html` | The admin modal (e.g., +Invite Staff) gets a fallback path: if `signActionPayload` returns a "pending cross-device" status, show a QR modal with the polling state ("Scan with your phone to authorize..."). |
| `sw.js` | Cache bump + add `org-action-auth.html` to SHELL_ASSETS. |
| Build pill | `v6.0` → `v6.1` |

---

## D1 schema

```sql
CREATE TABLE IF NOT EXISTS pending_action_authorizations (
  nonce TEXT PRIMARY KEY,                  -- random 32-byte base64url
  org_id TEXT NOT NULL REFERENCES organisations(id),
  requestor_user_id TEXT REFERENCES portal_users(id), -- the admin requesting authorization
  action_type TEXT NOT NULL,               -- e.g., 'irlid_invite_v5'
  action_payload_json TEXT NOT NULL,       -- the full action payload to be signed
  action_summary TEXT NOT NULL,            -- human-readable summary ("Invite Becky Wetherill as Manager")
  created_at INTEGER NOT NULL,             -- unix epoch ms
  expires_at INTEGER NOT NULL,             -- created_at + 180000 (3 min)
  claimed_at INTEGER,                      -- nullable, set when phone claims
  signed_envelope_json TEXT,               -- nullable, the signed payload from phone
  status TEXT NOT NULL DEFAULT 'pending'   -- 'pending' | 'claimed' | 'rejected' | 'expired'
);
CREATE INDEX IF NOT EXISTS idx_pending_actions_org ON pending_action_authorizations(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_actions_expires ON pending_action_authorizations(expires_at);
CREATE INDEX IF NOT EXISTS idx_pending_actions_status ON pending_action_authorizations(status);
```

---

## Endpoints

### `POST /org/action/init`

**Auth:** Bearer session (the admin's logged-in session — required to prove they have authority to request the action even before signing it)
**Body:**
```json
{
  "action_type": "irlid_invite_v5",
  "action_payload": { "org_id": "...", "role": "manager", "label": "Becky Wetherill" },
  "action_summary": "Invite Becky Wetherill as Manager"
}
```
**Response:**
```json
{
  "ok": true,
  "nonce": "<32 bytes base64url>",
  "expires_at": 1716901200000,
  "auth_url": "https://irlid.co.uk/org-action-auth.html?nonce=...&worker=..."
}
```

The Worker also stores the action_payload in the new table so the phone can fetch it via `/org/action/poll`.

### `GET /org/action/poll/:nonce`

**Auth:** None (the nonce is the credential).
**Response (while pending):**
```json
{
  "ok": true,
  "status": "pending",
  "action_summary": "Invite Becky Wetherill as Manager",
  "action_type": "irlid_invite_v5",
  "expires_at": 1716901200000
}
```

The phone uses this to display the action summary BEFORE prompting WebAuthn. Critical UX: the admin needs to see what they're authorizing.

**Response (when claimed):**
```json
{
  "ok": true,
  "status": "claimed",
  "claimed_at": 1716901100000
}
```

Desktop polls this every 1-2s after displaying the QR. When it sees "claimed", it proceeds with the post-action flow.

### `POST /org/action/claim`

**Auth:** None (the signed envelope IS the credential).
**Body:**
```json
{
  "nonce": "<the action nonce>",
  "signed_envelope": { /* output of signActionPayload */ }
}
```
**Behaviour:**
1. Look up the pending_action_authorizations row by nonce
2. Verify the row's status is 'pending' (not already claimed, not expired)
3. Verify the signed envelope's action payload matches the stored action_payload (canonical hash compare)
4. Verify the signature against the signing pub_fp
5. Check the signing pub_fp has authority for the requested action (e.g., for `irlid_invite_v5` the signer must be a lead_admin+ in the org)
6. Execute the action (call into the existing invite-create handler with the verified payload)
7. Mark the row as 'claimed'
8. Return the action result

**Response:**
```json
{
  "ok": true,
  "action_result": { /* whatever the action produces — e.g., the invite token */ }
}
```

---

## Mobile page: `org-action-auth.html`

Single-purpose, mobile-first. Loads with `?nonce=<n>&worker=<url>`. Flow:

1. **Fetch:** `GET /org/action/poll/:nonce` to get action_summary + action_type
2. **Display:**
   - Org branding (small logo + name)
   - "Authorize this action?"
   - Action summary in large text: *"Invite Becky Wetherill as Manager to Yoga Studio Derby"*
   - Action type chip: ✋ Staff Invite
   - Two buttons: **[✓ Approve]** (primary green) | **[✕ Reject]** (secondary)
3. **On Approve:** WebAuthn prompt → sign canonical(action_payload) → POST `/org/action/claim` → success page: *"Authorized. You can close this tab."*
4. **On Reject:** POST `/org/action/claim` with status=rejected → "Rejected. The desktop will show the cancellation."
5. **If expired:** show "This authorization has expired. The admin can request a new one."

Page should be ~200 lines total, dark theme, simple, fast-loading.

---

## Desktop side: QR modal in `Org.html`

When `signActionPayload` detects no local v5 credential, it calls `initCrossDeviceAction()` which:

1. POST `/org/action/init` with the action payload + summary
2. Receives `auth_url` from Worker
3. Renders a modal: "Scan with your enrolled phone to authorize this action"
4. QR code shows the `auth_url`
5. Polls `/org/action/poll/:nonce` every 1.5s
6. On `status: 'claimed'`: dismiss modal, continue with post-action flow (return the action_result to the original caller)
7. On `status: 'expired'`: show "Authorization timed out. Try again." with retry button
8. On `status: 'rejected'`: show "Authorization rejected." dismiss modal

The modal should look similar to the existing org-login QR modal — same visual language, same dark theme, same QR styling.

---

## Replay / nonce safety

- Each nonce is single-use. Once `claimed_at` is set, the row's status becomes 'claimed' and further claim attempts return `nonce_already_used`.
- Nonces expire after 3 minutes. The Worker can run a cleanup pass on `expired_at < now` rows (or just leave them; the unique nonce constraint prevents reuse).
- The signed envelope binds to the specific nonce (the nonce is part of the canonical payload). A signed envelope captured from one auth attempt cannot be replayed against a different nonce.

---

## What NOT to touch

- The existing `signActionPayload` happy path — only EXTEND it with a fallback when no credential is available.
- The existing QR-login flow at `/org/login/{init,poll,claim}` — mirror its structure, don't modify it.
- The receipt bridge work (v6.0 — separate PR).
- The Visual Theming reorganisation (v5.12.0 — separate PR).
- Existing endpoint signatures or response shapes — additive only.

---

## A/R/D verdict expectations

Number One will bash-diff per BOOTSTRAP §4.

- **✅ ACCEPT ✅** — 3 new endpoints, 1 new page, 1 new D1 table, fallback in `signActionPayload`, modal in Org.html. No existing flows broken. Cross-device flow works for at least one action type (+Invite Staff). Smoke test passes.
- **⚠️ REVIEW ⚠️** — existing QR-login flow modified; receipt bridge work touched; v5.12.0 work touched; nonce reuse not prevented; signed envelope not bound to nonce; rate limiting absent.
- **⛔ DENY ⛔** — bypasses the existing role authority checks; allows actions without any signature; modifies the receipt bridge or visual theming work; D1 schema changes beyond `pending_action_authorizations`.

---

## Captain's smoke

1. Open Org.html on desktop (which has NO v5 credential).
2. Settings → Staff & Rooms → + Invite Staff → fill Becky Wetherill / Manager → Add.
3. Desktop shows QR modal: "Scan with your enrolled phone to authorize."
4. 8 Pro scans QR (camera app or in-app scanner).
5. Phone loads `org-action-auth.html`, shows "Authorize: Invite Becky Wetherill as Manager?"
6. Tap Approve → fingerprint → "Authorized. You can close this tab."
7. Desktop modal updates: "Authorized ✓" → invite QR appears with token.
8. Cycle: Reject path works (Captain rejects on phone, desktop shows rejection).
9. Cycle: Expired path works (Captain ignores phone for 3+ minutes, desktop shows timeout).
10. Verify: existing happy path still works on devices WITH credentials (no regression).

---

## Captain's words verbatim (the why)

*"how is this all meant to tie into the receipts page... could you make it so it was event = Room/Class/.... Then at the entrance to the building a single checkin point, which the attendee scans (recognize staff). Then check the expected list. Know which event/room that attendee would be in, post appropriate reply"*

*"Both sides confirm, seems like the way with the least holes in it"*

This brief is the desktop→phone authorization piece. Both sides (admin authorizing, invitee redeeming) signing with hardware credentials = the architecture with the fewest holes.

Ship clean.

— Number One (drafted 28 May 2026 Thursday morning watch)
