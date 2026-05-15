# HANDOVER — `v5.10.1` Path B: Bearer-resolved authority in `requireSignedAction`

**Owner:** Mr. Data (preferred) or Number One inline
**Version tag:** `v5.10.1`
**Priority:** TOP — gates all of Phase 1-5 of `HANDOVER-PerActionAuth.md`
**Brief written:** Friday 15 May 2026 morning, before-work watch
**Prereq:** `v5.10.0.5` deployed (it is — see `memory/STATE-OF-PLAY.md`)

---

## TL;DR

`requireSignedAction` currently couples **signature** and **authority** — the signing fp must be bootstrap OR have an explicit `org_memberships` role. This breaks cross-device delegation: any device that wasn't pre-registered as bootstrap cannot sign manager actions, even when the user is signed in with developer authority via QR sign-in from a recognised device.

Path B separates the two:
- **Signature** stays bound to the signing device's v5 credential — proves *which device acted*, with what UV gesture, against what nonce (non-repudiation, anti-replay).
- **Authority** is now also resolvable via Bearer session token — proves *which user is acting* and what role they hold on the org (membership / bootstrap-developer recognition).

After Path B: any device the user is signed in on, with any enrolled v5 credential, can sign manager actions — provided the *session* belongs to a user with sufficient role on the org.

---

## Why this is the right architectural move

1. **Closes a real bug.** Captain's desktop (Firefox or Chrome) signs with a fresh v5 credential (fp ≠ bootstrap fp). Even when signed in as developer via 8 Pro QR-login, the desktop hits `insufficient_role` on every per-action commit. Hardware-verified end-to-end on 14 May evening.

2. **Matches the v5.10.0.4 lesson.** The Workers Request body single-use trap taught us *data-shape logic belongs at the source.* Authority is data — and it currently lives in the wrong place (per-signing-key, instead of per-session). Path B moves it to where the rest of the auth model already lives (session-resolved Bearer).

3. **Unblocks Phase 1-5.** Settings save, delete record, invite issuance, shift management, audit log — all eventually want per-action signing. None of them can ship while only Captain's 8 Pro can sign. Path B makes the architecture device-agnostic, so any signed-in developer/manager/lead_admin can sign from any device with any enrolled credential.

4. **Preserves non-repudiation.** The signed envelope still records the signing fp + nonce + clientData + authData. Audit trail shows exactly which device performed the action. The signature continues to be a non-replayable, device-bound, UV-gated commit. The change is purely in the *role gate*.

5. **Aligns with how all other org endpoints already work.** `requireDevOrStaffSession`, `userListOrgs`, `orgLoginPoll` already accept Bearer-resolved developer authority via `isBootstrapDeveloperFp(env, fp)` + `org_memberships` lookups against the *session user*, not the signing user. `requireSignedAction` is the outlier. Path B brings it in line.

---

## Files to touch

### `irlid-api-org/src/index.js`

**Function: `requireSignedAction(body, env, opts)`**

Currently resolves the signing user via `pub_fp` from the signed envelope, then checks role on the org via `orgRoleForUser` + `isBootstrapDeveloperFp(env, fp)` fallback (v5.10.0.5).

**New behaviour:** if the signing user's role is insufficient for `minRole`, ALSO check whether a Bearer session token is present and resolves to a user with sufficient role. If yes, treat that session user as the authority for this action, while keeping the signing envelope's fp as the actor for audit.

**Suggested signature change:**

```js
async function requireSignedAction(body, env, opts) {
  // ... existing logic up through signature verification ...

  // v5.10.1 Path B — split signature from authority.
  // Existing: signing user's role.
  const signingFp = await deviceKeyFp(pubJwk);
  const signingUser = await env.DB.prepare(
    "SELECT id, display_name FROM portal_users WHERE pub_fp = ?"
  ).bind(signingFp).first();
  // ... auto-create if missing, as today ...

  let role = org ? await orgRoleForUser(env, signingUser, org.id) : null;
  if (!role && isBootstrapDeveloperFp(env, signingFp)) role = "developer";

  // v5.10.1 Path B addition — if signing role insufficient, try Bearer.
  let sessionUser = null;
  let sessionRole = null;
  if (minRole) {
    const requiredRank = expectedRoleRank(minRole);
    const signingRank  = role ? expectedRoleRank(role) : -1;
    if (signingRank < requiredRank) {
      // Try resolving authority via Bearer.
      // opts.request must be passed for this path; if not present, fall through to insufficient_role.
      if (opts.request) {
        const ctx = await requireSession(opts.request, env);
        if (!ctx.error && ctx.user) {
          sessionUser = ctx.user;
          sessionRole = org ? await orgRoleForUser(env, sessionUser, org.id) : null;
          if (!sessionRole && isBootstrapDeveloperFp(env, sessionUser.pub_fp)) {
            sessionRole = "developer";
          }
        }
      }
      const sessionRank = sessionRole ? expectedRoleRank(sessionRole) : -1;
      if (sessionRank < requiredRank) {
        console.log("[requireSignedAction] FAIL insufficient_role signing=" + role + " session=" + sessionRole + " required=" + minRole);
        return { error: json({
          error: "insufficient_role",
          required: minRole,
          actual_signing: role || null,
          actual_session: sessionRole || null
        }, 403) };
      }
      // Authority delegated to session user. Audit captures both.
      console.log("[requireSignedAction] OK pass-through (Bearer-delegated authority) signing_fp=" + signingFp + " session_user_id=" + sessionUser.id + " session_role=" + sessionRole);
    } else {
      console.log("[requireSignedAction] OK pass-through (signing fp authoritative) fp=" + signingFp + " role=" + role);
    }
  }

  // ... existing nonce recording, return ...

  return {
    ok: true,
    user: signingUser,         // actor (for audit / non-repudiation)
    session_user: sessionUser, // delegated authority, if any (null if signing fp was sufficient)
    effective_role: sessionRole || role, // role used for the gate
    org,
    payload
  };
}
```

**Note on signature change:** `requireSignedAction(body, env, opts)` already takes `opts`. Add `opts.request` (the raw `Request` object) to both call sites. This lets the helper resolve Bearer via `requireSession()`.

### Call sites — pass `request`

Both bind endpoints currently call `requireSignedAction(body, env, { ... })`. Add `request` to opts:

```js
// bindAdditionalExpectedKey
const action = await requireSignedAction(body, env, {
  expectedType: "irlid_bind_v5",
  orgId: org.id,
  minRole: "staff",
  payloadSchema: (p) => ...,
  request   // <-- v5.10.1 Path B
});

// orgExpectedCreateAndBind
const action = await requireSignedAction(body, env, {
  expectedType: "irlid_create_bind_v5",
  orgId: org.id,
  minRole: "staff",
  payloadSchema: (p) => ...,
  request   // <-- v5.10.1 Path B
});
```

### `BOOTSTRAP_DEVELOPER_FP` rotation back to multi-fp (optional cleanup, post-Path-B-ship)

Once Path B is live and verified, Captain may add the desktop's v5 fp back into `BOOTSTRAP_DEVELOPER_FP` so the desktop has *both* signing-key-authority AND Bearer-delegated authority paths. But this is no longer required for functionality. Bootstrap fp returns to its original architectural purpose: founding-developer recognition for orgs the user has no membership row for yet.

### `PROTOCOL.md` — new subsection `§13.x` or addendum to existing §13

Add a brief subsection documenting the two-factor model:

```markdown
### §13.x — Signature ≠ Authority (v5.10.1 Path B)

Per-action signed envelopes carry two orthogonal proofs:

1. **Signature** — the WebAuthn-signed envelope proves a specific device, holding a specific v5 credential, performed a UV gesture at a specific time, against a non-replayable nonce. This is non-repudiation. The signing fp is recorded as the action's *actor*.

2. **Authority** — the request's Bearer session token resolves to a portal_user with a role on the org. The session user's role is what the action gate evaluates.

If the signing fp has sufficient role on the org (via membership or bootstrap), authority resolves directly from the signature. Otherwise, authority is delegated from the Bearer session — provided the session user has sufficient role. In all cases, the audit record captures both:
- `actor_pub_fp` (who signed)
- `authorized_by_user_id` (who the session was issued to)

This permits cross-device delegation while maintaining device-level non-repudiation. A user signed in as developer via QR on Phone X may sign manager actions from any other device Y, provided Y holds an enrolled v5 credential and the user's session is alive.

Action nonces remain global per the existing freshness window. Each signed envelope is single-use, regardless of which authority path validated it.
```

---

## Acceptance criteria

All five must pass on production before declaring v5.10.1 shipped.

1. **8 Pro alone (bootstrap signing fp):** Bind from 8 Pro → succeeds (regression check; should match v5.10.0.5 behaviour).
2. **Desktop with QR-login from 8 Pro (Bearer-delegated):** Bind from desktop's local v5 credential (fresh fp NOT in `BOOTSTRAP_DEVELOPER_FP`) → succeeds because Bearer resolves to bootstrap-developer user.
3. **Desktop with no session (negative case):** Bind from desktop's local v5 credential without a Bearer header → fails `insufficient_role` with `actual_signing: null, actual_session: null`.
4. **Random fp + non-dev Bearer (negative case):** Bind from a fresh fp with a Bearer from a session belonging to a `role=attendee` user → fails `insufficient_role` with `actual_session: "attendee"`.
5. **Audit trail completeness:** Wrangler tail and any future audit log shows both `actor_pub_fp` (signing fp) AND `authorized_by_user_id` (session user) for every Bearer-delegated action.

---

## Test plan (Mr. Data smoke checklist)

| # | Test | Expected |
|---|---|---|
| 1 | 8 Pro signs bind → `n4FzIhV_1jc2u_HO` in BOOTSTRAP_DEVELOPER_FP | 200 OK, `[requireSignedAction] OK pass-through (signing fp authoritative)` |
| 2 | Desktop signs bind, session from 8 Pro QR-login | 200 OK, `[requireSignedAction] OK pass-through (Bearer-delegated authority)` |
| 3 | Desktop signs bind, no Bearer header | 403, `insufficient_role`, `actual_session: null` |
| 4 | Fresh fp signs bind, Bearer from attendee-role user | 403, `insufficient_role`, `actual_session: "attendee"` |
| 5 | Signed envelope nonce replay (any device) | 400, `nonce_already_used` (regression check; no change to nonce logic) |

Captain has both 8 Pro and desktop available for hardware testing. Recommend Mr. Data runs the local wrangler dev env first to validate the code path, then Captain runs the production smoke after deploy.

---

## Risk + rollback

**Risk:** Low. The change is additive — the existing signing-fp-authoritative path is preserved as the fast path. Bearer-delegated authority is a fallback that only fires when the signing fp lacks sufficient role. No existing successful path is removed.

**Rollback:** `git revert` the commit + `npx wrangler deploy` from `irlid-api-org/`. Prior version `86f8b430-69d5-406f-8d46-48e39ecf0179` (v5.10.0.5) is well-known and tested.

**Feature flag (optional):** if Captain prefers caution, gate Bearer fallback behind `env.PATH_B_ENABLED === "1"`. Default off; flip on for production after Mr. Data validates locally. Easy to remove after a watch of clean run.

---

## Out of scope (explicit)

- **Phase 1-5 endpoints** (settings save, delete, invite, shifts, audit log) — those are downstream of Path B landing. Do NOT touch them in this PR.
- **`BOOTSTRAP_DEVELOPER_FP` secret rotation** — multi-fp can return post-ship, but it's a config change Captain runs separately. Not part of this brief.
- **Frontend changes** — `OrgCheckin.html` already sends Bearer in `sessionToken` for the bind endpoints (verified line 7562, 7599, etc.). No client-side changes needed.
- **`PROTOCOL.md` §13 rewrite** — only the addendum subsection §13.x. Keep the existing §13 narrative intact.

---

## Deliverables

1. **PR title:** `v5.10.1 - Path B Bearer-resolved authority in requireSignedAction`
2. **Files:** `irlid-api-org/src/index.js` (helper + 2 call sites), `PROTOCOL.md` (new §13.x subsection)
3. **Acceptance:** 5 tests above passing on production
4. **Memory:** STATE-OF-PLAY.md "Last refreshed" bump + milestone row in CLAUDE.md + brief addendum to pending-work.md

---

## Preconditions before firing

**MUST hold (or fix before starting):**
- `git switch main` and `git pull` to confirm clean main state
- Confirm `BOOTSTRAP_DEVELOPER_FP` still contains 8 Pro fp `n4FzIhV_1jc2u_HO` (for acceptance test 1 regression check)
- Verify `requireSession()` helper exists and works (it does — used by `userListOrgs`, etc.)
- This brief is pushed to origin BEFORE firing Mr. Data with the prompt (BOOTSTRAP §4 discipline)

If any precondition fails, stop and surface to Captain before code touch.
