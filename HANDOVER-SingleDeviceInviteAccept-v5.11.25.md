# HANDOVER — Mr. Data — `v5.11.25` — Single-device invite acceptance flow

**Priority:** Closes the last gap in +Invite Staff end-to-end. Without this, fresh users (no portal_users row) can't redeem an invite on a single device — the existing QR-login flow assumes desktop+phone two-device sign-in.
**Branch:** `codex/v5.11.25-single-device-invite-accept`
**Target build pill:** `v5.11.25`

---

## Problem (Captain's 28 May smoke test surfaced this)

1. Admin (Captain on 8 Pro) creates an invite for Becky → signs with WebAuthn → invite QR rendered ✓
2. Becky's device (4a) scans QR → URL `irlid.co.uk/Org#staff_invite=<token>` opens ✓
3. `captureStaffInviteFromHash` stashes the token ✓
4. `tryStaffInviteRedirectIfNeeded` sees no session → redirects to `org-login.html` ✓
5. **❌ `org-login.html` only offers "Show login QR" — a two-device flow.** Becky has no second device. She's stuck.

The architectural assumption baked into the current flow: *"You already have an IRLid identity on another device that can scan this QR."* For invite redemption by a fresh user, that's false.

---

## Solution

Add a **single-device invite acceptance** path: when `Org.html` loads with `#staff_invite=<token>` AND there's no session AND no existing portal_users binding, show an invite-acceptance UI that triggers WebAuthn enrolment IN-PLACE on the current device, signs the acceptance envelope, and atomically creates `portal_users` + `org_memberships` rows via a single Worker endpoint.

### Flow

```
1. 4a scans QR → lands on Org.html#staff_invite=<token>
2. captureStaffInviteFromHash reads token, stashes in localStorage (existing)
3. NEW: page detects "has invite token + no session" → shows v511InviteAcceptScreen
4. Screen shows:
     "Welcome!
      You've been invited to Test Event as Manager.
      [Accept invite & enrol this device]   [Decline]"
5. Tap Accept → window.IRLidV5Enrol() (existing helper at js/sign.js)
   - WebAuthn create() prompts Face ID / fingerprint
   - Creates new credential on device, stored in platform keystore
   - Returns { pub_jwk, pub_fp }
6. Sign the acceptance envelope:
   {
     invite_token: <token>,
     accepter_pub_jwk: <new jwk>,
     accepter_pub_fp: <new fp>,
     ts: Date.now(),
     nonce: <random>
   }
   sig = irlidV5SignPayloadHash(canonical_hash(above)) using the just-created credential
7. POST /org/invite/accept-on-this-device {
     invite_token,
     accepter_pub_jwk,
     accepter_pub_fp,
     signed_envelope: { payload, sig, webauthn }
   }
8. Worker (atomic transaction):
   - Decode invite_token, verify it's a valid signed invite from a lead_admin+
   - Verify signed_envelope's signature against accepter_pub_jwk
   - INSERT INTO portal_users (display_name from invite.label, pub_fp, pub_jwk, created_at)
   - INSERT INTO org_memberships (user_id, org_id, role=invite.role, accepted_at)
   - INSERT INTO login_sessions (user_id, session_token, ttl 24h)
   - Mark org_invites row as 'claimed'
   - Return { session_token, user, membership }
9. Client stashes session_token in localStorage, redirects to /Org (signed in)
10. 4a now shows Org.html as Becky, Manager role, sidebar reads her name
```

### Files

| File | Change |
|---|---|
| `Org.html` | NEW handler block: detect invite-token-on-load when no session → render invite-acceptance UI inline (modal or full-page takeover) → wire Accept/Decline buttons → call the new Worker endpoint → handle response. ~150 lines. |
| `irlid-api-org/src/index.js` | NEW endpoint `POST /org/invite/accept-on-this-device`. ~70 lines. Atomic: decode invite, verify both sigs (admin's invite sig + accepter's acceptance sig), INSERT portal_users + org_memberships + login_sessions, mark invite claimed. All in one D1 transaction or with rollback on partial failure. |
| `org-login.html` | SMALL change: if `#staff_invite=<token>` present in URL, skip rendering the "Show login QR" path and redirect back to `/Org#staff_invite=<token>` (which will trigger the new acceptance UI). |
| `js/sign.js` | Verify `irlidV5Enrol()` (or equivalent helper) exists and works for fresh enrolment. If not, add a small wrapper around `navigator.credentials.create()`. |
| `sw.js` | Cache bump. |

### Worker endpoint shape

```javascript
// POST /org/invite/accept-on-this-device
{
  invite_token: "I:eyJ0eXBl...",  // the full signed invite envelope
  accepter_pub_jwk: { kty: "EC", crv: "P-256", x: "...", y: "..." },
  accepter_pub_fp: "<16-char short fp>",
  signed_envelope: {
    payload: {
      type: "irlid_invite_accept_v5",
      invite_token: "I:eyJ0eXBl...",
      accepter_pub_fp: "<fp>",
      ts: 1716901200000,
      nonce: "<random>"
    },
    sig: "<b64url>",
    webauthn: { authData, clientData }
  }
}
```

Worker validation:
1. Decode `invite_token`, verify it's a valid signed invite (existing `verifyInvitePayloadSignature`)
2. Check invite role is staff/manager (NOT lead_admin/developer — same restriction as create)
3. Check invite expiry hasn't passed
4. Check invite nonce isn't already in `org_invites.status='claimed'`
5. Verify `signed_envelope` signature against `accepter_pub_jwk` (canonical hash + ECDSA)
6. Verify `accepter_pub_fp` matches a `deviceKeyFp(accepter_pub_jwk)` computation
7. If accepter_pub_fp is already in `portal_users`: error `device_already_enrolled` (prevent re-redemption with same credential)
8. **Atomic D1 transaction:**
   - INSERT portal_users
   - INSERT org_memberships
   - INSERT login_sessions
   - UPDATE org_invites SET status='claimed', claimed_at=now()
9. Return `{ ok: true, session_token, user: {...}, membership: {...} }`

If ANY step fails, roll back everything. Use `env.DB.batch([...])` for D1 atomicity.

### Acceptance UI

Captain wants this **clean, welcoming, not a developer page**:

```
┌─────────────────────────────────────┐
│         [Org logo]                  │
│                                     │
│   Welcome to Test Event             │
│                                     │
│   Spencer Austin has invited you    │
│   to join as Manager.               │
│                                     │
│   To accept, we'll set up           │
│   hardware-backed verification      │
│   on this device.                   │
│                                     │
│   [✓ Accept & enrol]   [Decline]   │
│                                     │
│   Powered by IRLid                  │
└─────────────────────────────────────┘
```

The "we'll set up hardware-backed verification" line replaces the unfriendly "Hardware-backed signing required" toast Captain hit yesterday — this is the smooth enrol UX promised in v5.11.25 brief earlier.

### What NOT to touch

- The existing two-device QR-login flow (`org-login.html` Show login QR + scan flow). Still needed for desktop sign-in for users who already have credentials on their phone.
- `captureStaffInviteFromHash` and `tryRedeemStaffInviteIfPending` for the EXISTING-USER redemption path (where the redeemer already has a portal_users row). Keep that path; this brief ADDS a parallel path for fresh users.
- The invite CREATE side (v5.11.23, working).
- The receipt bridge work (v6.0, separate PR).
- The Visual Theming reorg (v5.12.0, separate PR).

### A/R/D verdict expectations

- **✅ ACCEPT ✅** — New endpoint atomic with proper validation. New UI is clean (matches the IRLid brand). Existing two-device flow untouched. Invite expiry/role/nonce checks intact. Smoke test passes end-to-end (Captain on 8 Pro creates invite → Becky on 4a scans → acceptance UI → fingerprint → signed in as Manager).
- **⚠️ REVIEW ⚠️** — Worker endpoint not atomic (partial state on failure); accepter can claim an invite multiple times; portal_users+org_memberships INSERT order has race window; existing flows touched.
- **⛔ DENY ⛔** — Bypasses signed envelope verification on either side; allows lead_admin/developer invites through this path; existing QR-login flow modified or broken.

### Smoke test Captain will run

1. 8 Pro: + Invite Staff → Becky Wetherill → Manager → Add → fingerprint → QR appears.
2. 8 Pro: tap QR to fullscreen.
3. 4a: open camera, point at QR, tap URL notification.
4. 4a: lands on Org.html, sees "Welcome to Test Event — Spencer Austin has invited you as Manager — [Accept & enrol] / [Decline]".
5. 4a: tap Accept → WebAuthn prompt → fingerprint → credential created.
6. 4a: redirects to /Org signed in. Sidebar shows "Becky Wetherill" + Manager role.
7. 4a: Settings & Staff tabs visible (Manager privileges). Some Developer-only options hidden.
8. 8 Pro hard-refresh Staff & Rooms → Becky appears as a real D1 member with Manager role.
9. Try same invite again from a different device → rejected with `invite_already_claimed`.
10. Try expired invite (wait 15 mins or manually expire) → rejected with `invite_expired`.

If 1-10 pass, ✅ ACCEPT and merge. +Invite Staff is fully working end-to-end.

---

**Captain's words verbatim (the gap):**
*"4a went, before I tap the address to follow it to a 404 error screen :s. Not actually into the site, with the correct privileges."*

The 404 was the bare-token-not-URL issue (fixed in v5.11.24a). The "not into the site with correct privileges" is THIS brief — the single-device acceptance flow.

Ship clean.

— Number One (drafted 28 May 2026 Thursday morning watch)
