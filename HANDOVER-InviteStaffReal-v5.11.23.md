# HANDOVER — Mr. Data — `v5.11.23` — Wire +Invite Staff end-to-end (real Worker calls, WebAuthn-signed)

**Owner:** Mr. Data
**Type:** Worker adjustment + Client wiring. Real invite creation with hardware-signed payloads. **No D1 schema changes** — the invite tables already exist.
**Live files:** `Org.html` (client) + `irlid-api-org/src/index.js` (Worker) + `sw.js` (cache bump)
**Target build pill:** `v5.11.23`
**SW cache bump:** read current `sw.js` line 20 and bump monotonically
**Parallel work:** None active. Pull `origin/main` immediately before starting AND before pushing.

---

## Context

The v5.11.17 demo modal (your PR #54) created a UI-only fake invite flow on the Staff & Rooms tab — first name, surname, role dropdown, fake QR placeholder, Done/Revoke buttons, in-memory staff row. Captain wants it to become REAL: admin creates an invite → Worker issues a signed invite token → real QR appears → new staff member scans on their phone → they redeem the invite → they're added to `org_memberships`.

The Worker already has invite scaffolding at `irlid-api-org/src/index.js` (~L1387-1461): `verifyInvitePayloadSignature`, route handlers for create/redeem/revoke. The client already has a redeem flow at `Org.html` (~L15065 `tryRedeemStaffInviteIfPending` + hash capture at ~L15017 `captureStaffInviteFromHash`). The gap is: the demo modal sends `{ org_id, role, label }` without signing, so the Worker rejects with `signed_invite_required`.

**Architecture choice: Option B — Full WebAuthn signing.** The admin signs the invite payload with their hardware credential using the existing `signActionPayload` infrastructure (proven in bind-escalation, delete-record, per-action-auth flows). Non-repudiation from day one — the invite creation is cryptographically attributable to the admin who issued it. No retrofit needed later.

---

## What to implement

### 1. Client: Wire the demo modal to sign + POST real invites

In `Org.html`, find the v5.11.17 demo modal's "Add" / "Create" handler (look for your `v511InviteStaff*` namespace functions). Replace the fake demo flow with:

```javascript
// Pseudocode — adapt to your actual function names
async function createRealStaffInvite(firstName, surname, roleKey) {
  if (!currentOrg?.id || !qrLoginSession?.session_token) {
    showToast('Sign in first', true);
    return;
  }
  const label = (firstName + ' ' + surname).trim();
  const role = roleKey; // 'staff' or 'manager' — never 'lead_admin' or 'developer'
  
  // Sign the invite payload with admin's hardware credential
  const signedPayload = await signActionPayload('irlid_invite_v5', currentOrg.id, {
    org_id: currentOrg.id,
    role: role,
    label: label
  });
  
  // POST to Worker
  const res = await window.IRLidOrgApi.createInvite(qrLoginSession.session_token, signedPayload);
  
  // res.invite should contain { id, token, qr_payload, role, label, expires_at }
  return res.invite;
}
```

After the invite is created:
- Render a REAL QR using `QRCode.js` with `invite.qr_payload` as the text (replaces the fake placeholder)
- Show status: "Invite created for {label} — role: {roleLabel}. Waiting for them to scan…"
- The Revoke button calls the existing `window.IRLidOrgApi.revokeInvite()`
- The Done button closes the modal

**Important:** the `signActionPayload` function (search for it in Org.html — it's the same helper used by `requireSignedAction` callers) triggers the WebAuthn prompt on the admin's device. The admin touches their fingerprint / Face ID to authorize the invite. This IS the security gate.

### 2. Worker: Verify the existing invite-create handler accepts the signed envelope

The Worker's invite-create handler at `irlid-api-org/src/index.js` (~L1436-1461) already:
1. Reads `body.invite_payload || body.invite_qr || body.payload` 
2. Calls `decodeInvitePayload()`
3. Calls `verifyInvitePayloadSignature(env, invite)`
4. Checks role is staff or manager (L1440-1445)
5. Checks inviter has sufficient role (L1448-1450)

**You may need to adjust** how the signed payload is structured to match what `verifyInvitePayloadSignature` expects. The existing function at L1415 reads:
- `invite.sig` — the ECDSA signature
- `invite.issuer_pub_fp` — the inviter's public key fingerprint
- `invite.pub` — the inviter's public JWK (optional — falls back to DB lookup)
- `invite.webauthn` — if present, uses `verifyV5Envelope` for WebAuthn verification

Compare this with what `signActionPayload` returns (grep for `signActionPayload` in Org.html to see the return shape). You may need to bridge the two shapes — either by adjusting `signActionPayload`'s output to match the Worker's expectations, or by adding a small adapter in the create handler.

**If the shapes don't align cleanly:** add a `Bearer + signed_action_payload` alternative path in the Worker that uses the existing `requireSignedAction` pattern (which is already proven for bind/delete). This would be: Worker authenticates the admin via Bearer token, THEN verifies the signed action payload matches the request, THEN creates the invite. The key insight: `requireSignedAction` already does exactly this for other admin operations.

### 3. Role restrictions — CRITICAL

**Lead_admin and Developer invites STAY BLOCKED.** The Worker's check at L1440-1442 must remain:

```javascript
if (role === 'lead_admin' || role === 'developer') {
  return inviteJsonError("lead_admin_invite_deferred", "Lead Admin and Developer invites are deferred.", 400);
}
```

Only Developer (Captain, platform-level) can add lead_admins — and that's via D1 direct INSERT, not the invite flow. This is a governance constraint from `LONG-TERM-SUCCESSION.md`: one lead_admin per org, briefly two during crossover, never more. **Do not touch this restriction.**

The invite dropdown in the demo modal should offer only **Staff** and **Manager** roles — which it already does from your v5.11.17 work via `window.roleLabel('staff')` / `window.roleLabel('manager')`.

### 4. Redemption flow — verify existing code works

The client-side redemption flow already exists:
- `captureStaffInviteFromHash()` at ~L15017 — reads `#staff_invite=<token>` from URL hash
- `tryStaffInviteRedirectIfNeeded()` at ~L15031 — redirects to `org-login.html` if no session
- `tryRedeemStaffInviteIfPending()` at ~L15065 — POSTs token to Worker, Worker creates membership

This flow should work IF the Worker's redeem endpoint is functional. Test it:
1. Create a real invite via the modal (Step 1 above)
2. Copy the QR payload URL
3. Open it on a second browser/device
4. Confirm: the page lands on `Org.html` with `#staff_invite=<token>`, prompts WebAuthn login, then redeems

If the redeem endpoint has issues, debug + fix in the Worker. The endpoint handler should be near the create handler in `irlid-api-org/src/index.js`.

### 5. After successful invite creation: update the staff list

After Done is pressed (or after the redeemer successfully claims), the staff list on the Staff & Rooms tab should refresh from the Worker. Currently the v5.11.17 demo adds an in-memory row. Replace that with a real fetch of the org's memberships:

If a `GET /user/orgs` or similar endpoint returns the membership list, call it and re-render the staff rows. If no such endpoint exists for the Staff & Rooms tab, the in-memory row is acceptable for v5.11.23 — Captain can refresh to see the persisted state.

---

## What NOT to touch

- **Check-in tab clone area** (`#v511InlineCheckinStage`, `#venueQRWrap`, `#v511ThemePreviewStage`, `fullscreenQR()`, `renderInlineCheckinClone`, etc.)
- **The lead_admin/developer invite restriction** at Worker L1440-1442. CRITICAL — do not remove or weaken.
- **D1 schema** — no migrations. The invite tables (`staff_invites` or equivalent) already exist.
- **`showCheckinEventToast` suppression** (v5.11.19b)
- **The save-eventually fix** (your v5.11.22 Worker echo)
- **The celebration text template + banner font** (your v5.11.21)
- **`scan.html`, `org-entry.html`** (the redeem flow uses `org-login.html` which is separate)

---

## A/R/D verdict expectations

- **✅ ACCEPT ✅** — Demo modal wired to real `signActionPayload` + Worker `verifyInvitePayloadSignature`. Real QR from invite token. Lead_admin restriction intact. Redeem flow tested. No D1 migration. No Check-in clone touches.
- **⚠️ REVIEW ⚠️** — Bearer-auth fallback without signing (Option A instead of B); lead_admin role allowed in dropdown; D1 schema change; new Worker endpoint that duplicates existing invite handler.
- **⛔ DENY ⛔** — Lead_admin/developer invite restriction removed or weakened; Check-in clone area touched; signing bypassed entirely; `signActionPayload` not used.

---

## Smoke test Captain will run

1. Open `https://irlid.co.uk/Org`, sign in as Developer.
2. Navigate Settings → Staff & Rooms → click **+ Invite staff**.
3. Fill: First name "Test", Surname "Staff", Role: Staff.
4. Click **Add**. WebAuthn prompt fires on admin's device (fingerprint/Face ID). Confirm.
5. Real QR appears (not fake placeholder). Status: "Invite created for Test Staff — role: Staff. Waiting for them to scan…"
6. Copy the QR payload URL. Open on a second device/browser.
7. Second device: `org-login.html` loads → WebAuthn prompt for the NEW staff member → claim fires.
8. Second device: redirected to Org.html, signed in as "Test Staff" with Staff role.
9. Back on admin device: click **Done**. Staff list shows "Test Staff" (either via real refresh or in-memory row that persists on refresh).
10. Click **Revoke** on a different invite → status changes to "Revoked".
11. Attempt to redeem the revoked invite on another device → rejection message.

If 1-11 pass, ✅ ACCEPT.

---

**Captain's governance note verbatim:** *"Lead admin invites stays!!!!! I'm the only person, as Developer/Super Admin that can add new lead admins and there can only ever be one of each. Lead Admins for an Org (briefly 2 never more, as I do the cross over)."*

This is architectural. Do not touch.

Ship clean.

— Number One
