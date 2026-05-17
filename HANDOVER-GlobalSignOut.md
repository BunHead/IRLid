# HANDOVER — Global sign-out across all devices (v5.10.5)

**Target:** `v5.10.5` (adjust to next available patch — current main is `v5.10.4` at the CSV completeness merge commit).
**Branch:** `codex/v5.10.5-global-signout`
**PR title:** `[codex] v5.10.5 — Global sign-out revokes all user sessions across devices`
**Scope:** Small (~30 lines Worker + ~15 lines client + 1 helper in `js/orgapi.js`).
**Repo:** LIVE `BunHead/IRLid`. Verify `git remote -v` before starting.

---

## Why

Captain reported during sign-out smoke testing on 16 May 2026: current sign-out is local-only. It clears the device's `session_token` from localStorage and sets the `irlid_signed_out` flag, but the corresponding row in D1's `login_sessions` table remains valid until its 24-hour TTL expires. Any other device with a different `session_token` for the same `portal_user_id` stays signed in. Any compromised or unrevoked token works until natural expiry.

Captain's intuition (which is correct): sign-out should be **global by default**. When a user leaves a device — taps Sign out — they expect every active session for their account to be invalidated, not just the one on the device they happened to tap from. The current behaviour creates a quiet security gap that grows with the number of devices a user has signed in on.

The fix is a single new Worker endpoint that deletes all `login_sessions` rows for the authenticated user, plus a client change to call it during sign-out before the local cleanup.

## What

Add `POST /user/sign-out-all-devices` (Bearer-authenticated). Frontend `signOutOrg()` POSTs to this endpoint at the start of the sign-out flow, then proceeds with the existing local cleanup. If the call fails (network, etc.), local cleanup still runs — the current device signs out even if the server-side revocation didn't reach.

## File-by-file changes

### 1. `irlid-api-org/src/index.js`

Add new handler:

```js
async function userSignOutAllDevices(request, env) {
  // Bearer-authenticated. Read session token, resolve to portal_user_id,
  // delete ALL login_sessions rows for that user (current device + every other).
  const auth = request.headers.get('Authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return jsonResponse({ error: 'missing_bearer' }, 401);
  const token = m[1].trim();

  const session = await env.DB.prepare(
    'SELECT portal_user_id FROM login_sessions WHERE token = ?1'
  ).bind(token).first();

  if (!session) return jsonResponse({ error: 'auth_failed' }, 401);

  const result = await env.DB.prepare(
    'DELETE FROM login_sessions WHERE portal_user_id = ?1'
  ).bind(session.portal_user_id).run();

  return jsonResponse({
    ok: true,
    sessions_revoked: result.meta.changes || 0
  });
}
```

Register in the main `fetch` dispatcher alongside the existing `/user/orgs`, `/user/create-org`, etc. routes:

```js
if (url.pathname === '/user/sign-out-all-devices' && request.method === 'POST') {
  return userSignOutAllDevices(request, env);
}
```

### 2. `js/orgapi.js`

Add a wrapper alongside the existing helpers:

```js
async function signOutAllDevices(sessionToken, opts = {}) {
  const base = workerBaseUrl();
  const resp = await fetch(`${base}/user/sign-out-all-devices`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sessionToken}` }
  });
  let data = null;
  try { data = await resp.json(); } catch (_) {}
  return { ok: resp.ok, status: resp.status, data };
}
window.IRLidOrgApi.signOutAllDevices = signOutAllDevices;
```

### 3. `OrgCheckin.html` — extend `signOutOrg()` (around line 5053)

Insert the server-side revocation call BEFORE the existing local cleanup. Keep it best-effort: if the call fails, log a warning and proceed with local cleanup so the current device still signs out.

```js
async function signOutOrg() {
  // v5.10.5 — global sign-out: revoke all server-side sessions first
  // for the current user, then clear local state. Best-effort - if the
  // network call fails, local sign-out still completes so the user on
  // THIS device is signed out even if other devices can't be reached.
  if (qrLoginSession?.session_token) {
    try {
      const res = await window.IRLidOrgApi.signOutAllDevices(qrLoginSession.session_token);
      if (res.ok) {
        console.log(`[signout] Revoked ${res.data?.sessions_revoked ?? '?'} sessions across all devices`);
      } else {
        console.warn(`[signout] Global revocation failed (${res.status}); proceeding with local cleanup`);
      }
    } catch (e) {
      console.warn('[signout] Global revocation network error; proceeding with local cleanup', e);
    }
  }
  // existing local cleanup follows (unchanged) ...
  clearStaffAuthSession();
  currentOrg = null;
  qrLoginSession = null;
  // ...
}
```

Note: the function becomes `async` (currently synchronous). Any callers using it as a sync handler need verifying — check the two button bindings:
- `<button id="signOutBtn" onclick="signOutOrg()">` (line ~3307) — inline onclick handles async fine, no change.
- `addEventListener('click', signOutOrg)` (line ~9002) — also handles async fine.

### 4. Build pill and SW cache

- `OrgCheckin.html` build pill: `Build v5.10.4` → `Build v5.10.5` (line ~3284).
- `sw.js` `CACHE_VERSION`: `'irlid-shell-v13'` → `'irlid-shell-v14'` with comment referencing v5.10.5.

## Acceptance criteria (numbered, testable)

1. **Single-device case:** sign out on a phone — Worker logs `DELETE FROM login_sessions WHERE portal_user_id=...` with `changes` = 1. Phone signs out as before. No regression.
2. **Multi-device case:** sign in on Device A AND Device B for the same user. Sign out on Device A. Then refresh Device B — Device B's existing session is invalid (Worker returns 401 on any session-bearing call), Device B bounces to sign-in page. This is the headline behaviour.
3. **Network-failure case:** simulate offline before tapping sign out (or stop the Worker). Sign-out completes locally, console logs `[signout] Global revocation network error; proceeding with local cleanup`. Other devices stay signed in (sessions weren't revoked), which is acceptable graceful degradation — user knows the network was offline at sign-out time.
4. **Endpoint auth:** call `POST /user/sign-out-all-devices` with no Bearer → 401 `missing_bearer`. With invalid Bearer → 401 `auth_failed`. With valid Bearer → 200 OK with `sessions_revoked` count.
5. **Build pill** bumped, **SW cache** bumped. `git diff origin/main` net: ~50 lines added across Worker + frontend + helper. Well under 100 lines total.

## Out of scope (do not touch)

- "Sign out current device only" option / checkbox — Captain explicitly wants global by default. Per-device sign-out can be a future variant (`v5.11+`) if a use case emerges.
- Changing the `login_sessions` TTL (currently 24h sliding). That's a separate concern.
- Notifying other devices of the revocation in real-time (push, WebSocket, etc.). Other devices learn via their next API call returning 401, which is the right behaviour.
- New UI surface for sign-out (it's the same button, behaviour just becomes correctly global).
- The same-device sign-in UX (`HANDOVER-SameDeviceSignIn.md` covers that — separate brief).

## Risk + rollback

- **Risk:** If `signOutAllDevices` is called by a malicious actor who's stolen a valid session token, they could grief the user by revoking all their sessions. Mitigation: the token holder is already authenticated as that user; revoking their own sessions is acceptable behaviour. (If the user is concerned about a stolen token, global revocation is exactly what they want.)
- **Risk:** D1 `DELETE` is fast on small datasets (`login_sessions` table is small per-user, typically 1-5 rows). At scale (1000s of sessions per user), the query is still indexed on `portal_user_id` and fast. No risk in current operational scale.
- **Rollback:** single commit revert. Schema unchanged. Endpoint addition is additive.

## Verification before opening PR

```powershell
cd "<repo>"
git remote -v   # confirm: https://github.com/BunHead/IRLid.git
git switch main
git pull
git log --oneline -5   # confirm current main tip
```

After implementation:
- `node --check irlid-api-org/src/index.js` passes
- `node --check js/orgapi.js` passes
- `node --check sw.js` passes

Captain smokes the multi-device case on real hardware (8 Pro + desktop) after merge.

## Discipline reminders (BOOTSTRAP §6)

- Pull `origin/main` right before starting.
- Diff every touched file against `origin/main` before opening PR.
- One PR. Scope expansion → stop and raise.
- Bump `sw.js` `CACHE_VERSION` so the frontend change reaches devices.

---

Brief drafted 16 May 2026 by Number One. Surfaced during sign-out smoke testing on 16 May; Captain's security intuition mapped directly to this design.
