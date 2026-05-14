# HANDOVER — Per-action WebAuthn for manager commits + shift management (`v5.10` candidate)

**Repo:** IRLid-repo (LIVE — irlid.co.uk)
**Scope:** Architectural sweep. Replaces the ambient "Staff HELLO proof" / `requireFreshStaffProof` gate with **per-action WebAuthn signatures** for every manager commit. Adds shift start/end as first-class entities with their own hard-auth gate. Solves the doorman-bind silent-fail bug (Smoke 7 finding from 14 May watch) by removing the broken gate entirely rather than patching it.
**Replaces:** `requireFreshStaffProof` helper (introduced v5.7.0a). The "Staff HELLO" workflow becomes obsolete.
**Estimate:** 5 phased PRs. Phase 0 alone closes the immediate Smoke 7 bug; later phases extend the pattern across the platform.

---

## The architectural vision

Every action that mutates org state requires a fresh signed envelope from the actor's hardware key. The signature is:

1. **Per-action.** Not "this session has a fresh proof good for 60 seconds" — *this specific commit was authenticated right now*.
2. **Hardware-backed.** Uses the existing v5 WebAuthn credential on the actor's device (already deployed since `v5`). No new key material, no new enrolment.
3. **Cryptographically tied to the action.** The canonical payload includes the action type, target, and timestamp — replaying an envelope from one action against another action fails verification.
4. **Audit-quality.** Every committed action is non-repudiable. Brief A2 (admin audit log, already drafted) gets real signature evidence on every row.

**Why this is strictly better than the current `requireFreshStaffProof` model:**

- No stale-proof windows. Every commit is independently authenticated.
- No "developer Bearer vs Staff HELLO" two-class system. Everyone signs.
- Non-repudiation per action, not per session.
- Maps to a familiar UX (Apple Pay, banking apps): fingerprint to confirm this action.
- The Staff HELLO workflow becomes unnecessary and can eventually be retired.

**Captain's UX directive:** the hard auth should happen *as part of the scan/commit flow*, not as a separate dialog step. Tap action → camera → scan → biometric prompt → done. Single user gesture per commit, not a multi-step modal sequence.

## The unified envelope shape

All per-action envelopes share the same v5 envelope structure as `verifyV5Envelope` already accepts. The differentiator is the **canonical payload** that gets hashed and challenged:

```json
{
  "type": "irlid_<action>_v5",
  "org_id": "<uuid>",
  "timestamp": <unix ms>,
  "nonce": "<32 random bytes b64url>",
  "<action-specific fields>": "..."
}
```

`type` values per action:

| Action | type | action-specific fields |
|---|---|---|
| Save org settings | `irlid_settings_save_v5` | `settings_hash` (sha256 of the canonical settings JSON being saved) |
| Delete expected entry | `irlid_expected_delete_v5` | `expected_id` |
| Bind device (multi-key) | `irlid_bind_v5` | `expected_id`, `new_device_key_fp` |
| Create-and-bind | `irlid_create_bind_v5` | `first_name`, `surname`, `role`, `new_device_key_fp` |
| Issue invite | `irlid_invite_create_v5` | `role`, `expires_in_s`, `label` |
| Revoke invite | `irlid_invite_revoke_v5` | `invite_id` |
| Member role change | `irlid_role_change_v5` | `target_user_id`, `new_role` |
| Member removal | `irlid_member_remove_v5` | `target_user_id` |
| Shift start | `irlid_shift_start_v5` | `user_id`, `event_code` |
| Shift end | `irlid_shift_end_v5` | `user_id`, `event_code` |

The type discriminator is critical — it prevents an envelope captured from one action being replayed against another (e.g. a "save settings" envelope can't be used to delete a record).

## Worker — unified helper

Replace `requireFreshStaffProof` with a new helper `requireSignedAction`:

```js
// Verifies a v5 envelope attached to the request body and confirms the
// signing pub_fp corresponds to a portal_users row with sufficient role
// in the target org. Returns { user, org, role } on success, an Error
// Response on failure.
async function requireSignedAction(request, env, {
  expectedType,         // e.g. "irlid_bind_v5"
  orgId,                // org context
  minRole,              // "staff" | "manager" | "lead_admin"
  payloadSchema,        // function (payload) => bool, validates action-specific fields
}) {
  // 1. Parse envelope from body
  // 2. Verify v5 envelope via existing verifyV5Envelope
  // 3. Confirm payload.type === expectedType
  // 4. Confirm payload.org_id === orgId
  // 5. Confirm payload.timestamp is within ±60s of now (replay window)
  // 6. Confirm payload.nonce hasn't been seen (anti-replay via short-lived nonces table)
  // 7. Confirm payloadSchema(payload) passes
  // 8. Resolve pub_fp -> portal_users row
  // 9. Confirm orgRoleForUser >= minRole
  // 10. Insert nonce into used_nonces to prevent replay (or use a TTL'd table)
  // Return { user, org, role, payload }
}
```

This becomes the universal gate for every manager commit. The existing `requireDevOrStaffSession` stays for read-only endpoints; `requireSignedAction` replaces `requireFreshStaffProof` for write/commit endpoints.

## D1 schema additions

```sql
-- v5.10 Phase 0 — anti-replay nonces for per-action signatures
CREATE TABLE action_nonces (
  nonce      TEXT PRIMARY KEY,
  used_at    INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_action_nonces_expires ON action_nonces(expires_at);

-- v5.10 Phase 3 — shift management
CREATE TABLE org_shifts (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organisations(id),
  user_id         TEXT NOT NULL REFERENCES portal_users(id),
  event_code      TEXT,
  shift_start_at  INTEGER NOT NULL,
  shift_start_envelope TEXT NOT NULL,   -- the signed envelope JSON for audit
  shift_end_at    INTEGER,              -- NULL while shift active
  shift_end_envelope   TEXT,            -- NULL while shift active
  created_at      INTEGER NOT NULL
);
CREATE INDEX idx_org_shifts_active ON org_shifts(org_id, user_id) WHERE shift_end_at IS NULL;
CREATE INDEX idx_org_shifts_event ON org_shifts(org_id, event_code, shift_start_at);

-- v5.10 Phase 3 — settings toggle for whether shift start/end requires WebAuthn UV
ALTER TABLE orgs ADD COLUMN shift_hard_auth_required INTEGER NOT NULL DEFAULT 1;
```

Nonce cleanup: a separate cron task or per-request gc deletes nonces with `expires_at < now`. Replay protection is a 60-second window.

## Client — unified signing helper

Extend `js/sign.js` with a `signActionPayload(actionType, fields)` helper that:

1. Constructs the canonical payload `{type, org_id, timestamp, nonce, ...fields}`
2. Computes the hash
3. Calls `navigator.credentials.get` with that hash as the challenge, `userVerification: 'required'`
4. Bundles the envelope (pub_jwk, sig, clientDataJSON, authenticatorData, payload)
5. Returns the envelope, ready to POST

Wire this into every manager-commit button:

- `saveAllSettingsBtn` click handler → `signActionPayload('irlid_settings_save_v5', {settings_hash})` → POST to `/org/settings`
- `inviteStaffCreateBtn` → `signActionPayload('irlid_invite_create_v5', {role, expires_in_s, label})` → POST to `/org/invites/create`
- `expectedConfirmDeleteBtn` → `signActionPayload('irlid_expected_delete_v5', {expected_id})` → POST to `/org/expected/:id/delete`
- ...etc

Captain's UX note: when the button is clicked, fire WebAuthn IMMEDIATELY (no confirmation modal first). The biometric prompt IS the confirmation. If the user dismisses the prompt, the action is silently cancelled (no error toast — they chose not to confirm).

## Phasing

**Phase 0 — Doorman bind (v5.10.0).** Implement the unified helper + apply to the two bind endpoints (`/org/expected/:id/bind-additional-key` and `/org/expected/create-and-bind`). This closes the 14 May Smoke 7 finding and proves the pattern. **All other endpoints stay on existing auth for this phase** — strict scope to validate the pattern works end-to-end on real hardware before sweeping.

**Phase 1 — Settings save (v5.10.1).** Apply per-action auth to the save-all-settings flow. Highest-frequency manager commit.

**Phase 2 — Expected delete + invite create/revoke (v5.10.2).** Sweep the remaining v5.9.14 endpoints plus expected-list delete.

**Phase 3 — Shift management (v5.10.3).** New `org_shifts` table + `shift_start` / `shift_end` endpoints + UI on `org-entry.html` for staff to clock in/out. *This is genuinely new product capability, not a refactor.*

**Phase 3 design decisions (Captain's 14 May refinements):**

- **Shift-start eligibility:** any device whose owner is staff-tier or above at this org, resolved via EITHER (a) `org_expected.prototype_role >= staff` for their `device_key_fp`, OR (b) `org_memberships.role >= staff` for their `pub_fp`. Both paths converge — no duplicate "staff expected" list. The existing `org_expected` table is the single source of truth for who's expected at the venue; `prototype_role` distinguishes attendee from staff. Brief A staff-invite redemption gives the same authority via `org_memberships`. Scheduling (Kerry works Friday but not Sunday) is **deferred to v5.11+** as `org_event_shifts` pre-loading specific event×staff pairs; for v5.10 Phase 3, any staff-tier device can start a shift at any event.

- **Settings toggle — `shift_hard_auth_required`** (new boolean column on `orgs`, default `true`). When `true`, shift start/end require WebAuthn UV per this brief. When `false`, shift start can be triggered by a Staff-tier device's normal check-in without an additional biometric. Surfaced as a new switch tile in the "Core gates and policy" Settings section, alongside `Bio-metric Required` / `Privacy Mode` / `Anonymous Mode` / etc. Default is `true` because most orgs will want cryptographic evidence of staff presence; opt-out exists for low-friction casual venues.

- **Check-in flow with shift prompt:** when a staff-tier device check-ins via the venue QR AND `org_settings.shift_hard_auth_required` is true AND no active shift exists for this user at this event, the post-accept page shows: *"You're checked in. Are you working tonight?"* with two buttons — "**Start shift**" (triggers WebAuthn UV, creates `org_shifts` row) and "**Just attending**" (proceeds normally as an attendee). The user gets to choose per-event. Same pattern at end-of-shift: when a staff-tier device check-outs AND has an active shift, prompt for "End shift" before the standard check-out completes.

**Phase 4 — Audit log integration (v5.10.4).** Brief A2's `org_admin_audit` table gains a `signature_envelope` column. Every audit row stores the per-action envelope. Non-repudiation guaranteed.

**Phase 5 — Retire Staff HELLO (v5.10.5).** Once all manager commits use per-action WebAuthn, the legacy Staff HELLO workflow can be removed: `staffHelloDialog`, the `staffAuth` panel, the Worker `requireFreshStaffProof` helper, all associated CSS. Significant code reduction.

## Acceptance criteria — Phase 0 (the immediate fix)

1. **Doorman bind works for Developer on real hardware.** From Captain's 8 Pro: scan 4a's orange QR → escalation modal → Choose-from-List → Kerry Austin → Add device → biometric prompt → approve → bind succeeds → Kerry Austin row now has 4a's device_key_fp added → 4a's next check-in scan recognises as Kerry.
2. **Doorman bind works for Staff on real hardware** (regression check — should be unchanged but new path).
3. **Replay rejected.** Capturing a bind envelope and re-posting it within 60s returns `400 nonce_already_used` (or equivalent).
4. **Cross-action rejected.** Capturing a bind envelope and re-posting against the delete endpoint returns `400 invalid_action_type`.
5. **Timestamp drift rejected.** A bind envelope with `timestamp` >120s old returns `400 timestamp_drift`.
6. **No `Staff authentication required` red label appears anywhere on the bind path.** That gate is removed.
7. **UI shows clear feedback.** Failed bind surfaces as a toast, not a buried red label.
8. **Pill bump:** `v5.9.14.3` → `v5.10.0`.

## What to bank for Phase 3 (shift management)

The shift management capability is genuinely new product surface. Worth flagging to Captain as it ships:

- **Real-world use case:** a pub running trivia night. 3 staff working, 30 attendees. Staff arrive at 7pm, scan-in via venue QR, get prompted "Starting work shift?" → fingerprint → shift begins. Attendees arrive at 7:30pm, scan-in normally, no shift prompt (they're not on shift). Staff shift ends at 10pm → fingerprint → clocked out. Everyone leaves at 11pm via normal check-out.
- **Shift state UI:** the audit board could show a "WORKING" badge next to staff currently in a shift. Distinct from "IN" attendance.
- **Reporting surface:** "who worked tonight, for how long" reports drop out for free.
- **Pay/HR integration future:** export shifts as CSV for payroll. Not v5.10 scope but worth noting.

## Style notes

- British spellings.
- Reuse existing v5 envelope verification (`verifyV5Envelope`) — do not reimplement signature verification.
- Reuse existing client signing helpers in `js/sign.js` — `signActionPayload` is a thin wrapper.
- All new endpoints follow existing JSON error contract: `{ error: "<code>", message: "<human>" }`.
- All new tables follow existing naming convention (`org_*` for org-scoped, lowercase snake_case columns).
- Type discriminator strings use the `irlid_<action>_v5` pattern uniformly.

## Out of scope for v5.10

- **OAuth identity linkage** (PROTOCOL.md §14.18) — separate roadmap chapter.
- **Cross-org identity sync** — separate roadmap chapter.
- **Apple Watch / wearable signing** — interesting future, not now.
- **Multi-signature actions** (Lead Admin swap quorum, Brief B) — separate brief.
- **Background shift tracking** (auto-detect shift end if staff leave the venue) — out of scope.

## Open questions for Captain (decide as phases progress)

1. **Shift start UX in Phase 3** — should the venue check-in QR auto-detect "this person is staff" and route to shift-start, or do staff scan a *different* QR to start a shift? Recommend the former (one QR, smart routing) for simpler signage.
2. **Multi-shift per event** — can a staff member start, end, restart a shift at the same event? (e.g. break, comes back). Recommend yes — `org_shifts` rows are independent, can have multiple per (org_id, user_id, event_code).
3. **Shift authorisation** — can ANY staff-tier device start a shift, or only ones marked "scheduled" for this event? v5.10 scope: any staff-tier. Future: explicit scheduling table.

---

Brief size note: this is a ~5-PR architectural sweep. Treat Phase 0 as the immediate-priority single PR that closes the 14 May Smoke 7 bug. Phases 1-5 are scoped to be incremental, each independently shippable.
