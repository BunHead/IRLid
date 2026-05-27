# HANDOVER — Mr. Data — `v5.11.17` — Staff & Rooms `+ Invite staff` demo flow

**Owner:** Mr. Data
**Type:** UI-only demo. **No Worker calls. No D1 changes. No saving.** Visual-only flow Captain wants for demo readiness.
**Live file:** `D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\Org.html`
**Target build pill:** `v5.11.17`
**Service-Worker cache bump:** `irlid-shell-v53` (current is `v52` after `v5.11.16`)
**Parallel work:** Number One is shipping `v5.11.16` (inline Check-in stage clone) on the same `Org.html`. **Pull `origin/main` immediately before starting, and immediately before pushing**, so the version pill bumps stack cleanly (`v5.11.16 → v5.11.17`) rather than colliding.

---

## Context for you

Captain wants a working-looking **+ Invite staff** demo on the Staff & Rooms tab for tomorrow's demo. The existing `v5.10.x` Invite Staff flow (the one wired to `inviteStaffBtn` in the legacy Settings card at `Org.html:10363`, calling `openInviteStaffDialog` at `L14949` → `createStaffInvite` at `L14967`) **is wired but not proven end-to-end**. The Worker at `irlid-api-org/src/index.js` requires a **signed invite payload** (`signed_invite_required` returned at `L1455`, signature verification at `L1415` `verifyInvitePayloadSignature`), but the client sends only `{ org_id, role, label }` with no WebAuthn-signed envelope. First click of "Create invite QR" almost certainly fails with `signed_invite_required` and shows red status text in the dialog. **Don't touch that flow.** Captain wants a **fresh demo path** that comes off the `v5.11` Staff & Rooms tab button.

The `+ Invite staff` button lives at **`Org.html:6056`**:

```html
<div style="margin-top: 14px;"><button type="button" class="v511-btn">+ Invite staff</button> <span class="v511-hint" style="margin-left: 10px;">Generates a single-use QR invite</span></div>
```

It has no id, no handler, and currently does nothing.

---

## Acceptance criteria

When Captain hits **Org → Staff & Rooms → + Invite staff**:

1. A modal opens (centred, dimmed backdrop, can be dismissed by Esc or the × close button or clicking the backdrop).
2. The modal carries three fields and one primary action:
   - **First name** — text input, required, max 60 chars
   - **Surname** — text input, required, max 60 chars
   - **Role** — `<select>` populated from the live role-vocab (so if the org renamed "Staff" to "Instructor" via the Role vocabulary expander, that's the label shown). The select must include **Staff** and **Manager** as options. Do NOT include Attendee, Lead admin, or Developer — Captain's directive is staff invites only.
3. While First name OR Surname is empty, the **Add** button is disabled and styled muted.
4. As soon as both name fields have at least one non-whitespace character, the **Add** button becomes enabled and styled **green** (use `var(--green, #7ee787)` or the existing `.v511-btn-primary` with a green tint — pick one and be consistent).
5. Clicking **Add** triggers the demo onboarding sequence:
   - The modal swaps content from "form" mode to "onboarding in progress" mode (do this in-place — same modal, just change the inner HTML or toggle a child div).
   - Onboarding shows a fake **invite QR placeholder** (a styled square with a "Single-use invite QR" label — a real-looking placeholder, NOT a real QRCode.js render — this is a demo).
   - Show a short status line: `"Invite created for {FirstName} {Surname} — role: {RoleLabel}. Waiting for them to scan…"`.
   - Show two buttons: **Done** (closes the modal) and **Revoke** (immediately swaps the panel to a "Revoked" state and disables the buttons until Done is pressed).
6. After **Done** is pressed, append a new row to the Staff list (the existing `v511-staff` divs above the button at `Org.html:6052-6054`) with the new name + selected role. This row is in-memory only — refreshing the page wipes it. The Remove button on the new row should just remove the row when clicked (no persistence).
7. The form must close cleanly and clear all state if the user dismisses without pressing Add or Done.

---

## Role vocab integration

Read role labels via `window.roleLabel(key)` (defined at `Org.html:~15368`, available globally). For example:

```javascript
function staffRoleOptions() {
  var staffLabel = (typeof window.roleLabel === 'function' && window.roleLabel('staff')) || 'Staff';
  var managerLabel = (typeof window.roleLabel === 'function' && window.roleLabel('manager')) || 'Manager';
  return [
    { value: 'staff', label: staffLabel },
    { value: 'manager', label: managerLabel }
  ];
}
```

**Important — Captain noted Role Vocab doesn't currently save.** The vocab inputs at `Org.html:6061-6064` are not yet wired to persist. That's a separate concern — DO NOT fix it as part of this brief. For this demo, `window.roleLabel()` may return the defaults (Staff / Manager) and that's fine. If a future watch wires the vocab to save, the dropdown will automatically pick up the configured labels.

---

## Modal styling

Reuse the existing `.staff-hello-backdrop` pattern from `inviteStaffDialog` at `Org.html:10917` for the backdrop + dialog shell (consistent look). Use `.v511-modal-card` if you'd rather match the v5.11 visual language — both are fine, just pick one and be consistent. Use existing `.v511-btn`, `.v511-btn-primary`, `.v511-btn-mini` classes for the buttons.

The fake invite QR placeholder can be:

```html
<div style="width: 200px; height: 200px; margin: 12px auto; display: grid; place-items: center; background: #fff; color: #333; font-size: 12px; border: 1px solid #d0d7de; border-radius: 8px;">
  <div style="text-align: center; line-height: 1.4;">
    <div style="font-weight: 600; margin-bottom: 4px;">📱</div>
    <div>Single-use invite QR</div>
    <div style="opacity: 0.6; margin-top: 4px;">demo placeholder</div>
  </div>
</div>
```

---

## What NOT to touch

- **Don't touch** the legacy `inviteStaffBtn` at `Org.html:10363` or `openInviteStaffDialog` at `L14949` or `createStaffInvite` at `L14967` or any `staffInvite*` flow. That's the v5.10.x path and Captain wants it left alone.
- **Don't touch** the Worker (`irlid-api-org/src/index.js`). No new endpoints. No D1 changes.
- **Don't touch** `js/orgapi.js`. No new API methods.
- **Don't touch** the inline Check-in stage rendering — Number One is working that path in parallel as `v5.11.16`. Specifically: **don't modify `#venueQRWrap`, `#v511ThemePreviewStage`, `#v511FullscreenStage`, `#v511InlineCheckinStage`, `fullscreenQR()`, or anything inside the `v5.11 Tier 1 — Visual theming live wiring` IIFE block.** Pull right before push.
- **Don't add Worker calls or fetch() calls** inside the demo onboarding sequence. The new row added to the staff list is in-memory only.
- **Don't fix Role Vocab persistence.** Captain mentioned it as a separate concern.

---

## File touch list

- `Org.html` — single file
  - HTML: new modal element near the bottom of the body (anywhere alongside other dialogs like `inviteStaffDialog` is fine)
  - HTML: add `id="v511InviteStaffBtn"` to the button at `L6056` (so the binding is unambiguous)
  - JS: new functions `openV511InviteStaffModal()`, `closeV511InviteStaffModal()`, `startV511InviteStaffOnboarding()`, `addV511StaffRow(firstName, surname, roleKey)` — namespace everything with `v511InviteStaff*` to keep the new path separate from the legacy `staffInvite*` namespace
  - JS: bind the click handler at boot alongside existing v5.11 wiring (look for the `v5.11 Tier 1 — Visual theming live wiring` IIFE or similar boot block — add a sibling block, don't nest inside it)
  - CSS: add new styles inline in the `<style>` block — namespace with `.v511-invite-modal*` or `.v511-invite-staff*`
- **Build pill bump:** find the line that reads `v5.11.16` (Number One's pill from the parallel work) and bump it to `v5.11.17`. If you can't find `v5.11.16` because Number One hasn't merged yet, bump from whatever the current pill is — Captain will reconcile on his side at push time.
- **Service Worker cache bump:** `sw.js` line 15 — current is `irlid-shell-v52` (after Number One's `v5.11.16`), bump to `irlid-shell-v53`. If `v52` isn't on origin yet, use `v53` anyway — cache bumps are monotonic and one accidental skip is harmless.

---

## A/R/D sanity-check verdict expectations

When Number One reviews your PR with the `git diff origin/main..origin/codex/<branch> -- Org.html sw.js` pattern from BOOTSTRAP §4, Number One will look for:

- **✅ ACCEPT ✅** — Diff is bounded: new modal HTML + new JS block + new CSS rules. No touches to `#venueQRWrap`, `#v511ThemePreviewStage`, `inviteStaffBtn`, `openInviteStaffDialog`, `createStaffInvite`, `verifyInvitePayloadSignature`, `irlid-api-org/`, `js/orgapi.js`. Build pill bumped. SW cache bumped. Demo onboarding has no fetch() / no Worker calls. Role labels read via `window.roleLabel()`.
- **⚠️ REVIEW ⚠️** — Demo onboarding stub does call Worker; Role select includes Lead admin or Developer; new code lives inside the visual-theming IIFE; new row persists across refresh (means localStorage was used — Captain explicitly didn't ask for that).
- **⛔ DENY ⛔** — `#venueQRWrap` or `#v511ThemePreviewStage` or `fullscreenQR()` modified; Worker file touched; D1 migration added; legacy `staffInvite*` code path altered.

---

## Smoke test Captain will run

1. Open `https://irlid.co.uk/Org.html` after deploy.
2. Sign in. Navigate **Settings → Staff & Rooms**.
3. Click **+ Invite staff**. Confirm: modal opens, three fields visible, Add button disabled.
4. Type **First name: Test**. Add stays disabled (Surname still empty).
5. Type **Surname: Demo**. Add turns green and enables.
6. Open Role dropdown — confirm two options (Staff / Manager labels, or whatever the vocab is set to).
7. Click **Add**. Confirm: panel swaps to onboarding view with fake QR placeholder + status line "Invite created for Test Demo — role: Staff. Waiting for them to scan…" + Done + Revoke buttons.
8. Click **Revoke**. Confirm: panel swaps to "Revoked" state.
9. Click **Done**. Confirm: modal closes, a new staff row "Test Demo" with Staff role appears in the staff list above the button.
10. Refresh the page. Confirm: new row is gone (in-memory only — that's correct).

If all 10 pass, ✅ ACCEPT.

---

**Captain's words verbatim:** *"make a demo version (have Data) that fires from the +Invite Staff button on Staff & Rooms. It should have first name surname and role (taken from vocab (when working)). Then once these fields are populated, click a green add to start the onboarding process (Demo so this doesn't need to actually work)."*

The phrase "(when working)" is Captain acknowledging Role Vocab doesn't save right now. That's fine — your dropdown will read defaults via `window.roleLabel()` and will automatically pick up the configured labels once vocab persistence is fixed in a separate watch.

Ship clean.

— Number One
