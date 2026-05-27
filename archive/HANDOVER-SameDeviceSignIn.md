# HANDOVER — Same-device sign-in on devices with registered v5 credentials (v5.10.6)

**Target:** `v5.10.6` (adjust to next available patch — current main is `v5.10.4`; `v5.10.5` is reserved for `HANDOVER-GlobalSignOut.md`).
**Branch:** `codex/v5.10.6-same-device-signin`
**PR title:** `[codex] v5.10.6 — Same-device sign-in for devices with registered v5 credentials`
**Scope:** Small-medium (~40 lines OrgCheckin.html sign-in card + ~20 lines org-login.html session-persistence + ~10 lines helper).
**Repo:** LIVE `BunHead/IRLid`. Verify `git remote -v` before starting.

---

## Why

Captain surfaced this during sign-out testing on 16 May 2026. The "Show login QR" button on `OrgCheckin.html`'s sign-in card is **bidirectional** — it generates a QR meant for **another device** to scan and sign. When the user is already on a device with their v5 credential registered, this pattern is exactly backwards from intuition: the user expects a button that prompts THIS device's fingerprint and signs them in here, not a button that shows a QR for some other device.

Symptom from Captain's report: after signing out on the 8 Pro, he wanted to sign back in directly on the 8 Pro. He scanned a desktop's login QR — that signed in the **desktop incognito tab** (the polling device) but not the 8 Pro itself. The 8 Pro contributed a signature but never claimed a session for itself. Navigating to OrgCheckin.html on the 8 Pro bounced him back to the sign-in page because no `irlid_login_session` exists in the 8 Pro's localStorage.

The fix: detect when the user is on a device with a v5 credential registered (via `irlidV5Enrolled()`), and offer a **"Sign in here"** primary button alongside the existing "Show login QR" (kept as secondary for genuine cross-device cases like a shared dashboard screen). The same-device button creates a nonce, signs same-device, claims the session, and **persists the session_token locally** so the device is signed in for subsequent navigation.

This also closes a smaller related gap on `org-login.html`: today its successful-claim response just shows "Signed in. You may close this tab." It doesn't save the session locally either. After the fix, both `OrgCheckin.html`'s sign-in card AND `org-login.html`'s claim path save the session_token to localStorage on the signing device, making the signing device a fully-signed-in device — not just a witness for another.

## What

Three touchpoints:

1. **`OrgCheckin.html` sign-in card** — add a "Sign in here" primary button visible when `irlidV5Enrolled()` returns true; relegate "Show login QR" to a secondary affordance (slightly smaller, labelled with a "for another device" subtitle).
2. **Same-device sign-in flow** — JS that fetches a fresh nonce, signs same-device via WebAuthn, claims the session via the existing `/org/login/claim` endpoint, saves the returned session locally, clears `irlid_signed_out`, restores UI, navigates to dashboard.
3. **`org-login.html` session-persistence enhancement** — after a successful claim (regardless of whether the user reached this page via QR scan or direct navigation), save the session_token locally so this device is also signed-in, not just the polling device. Existing return-URL redirect behaviour preserved.

## File-by-file changes

### 1. `OrgCheckin.html` — sign-in card layout (around the QR-login panel)

Locate the existing sign-in card HTML (search for `Sign in to IRLid Org Portal` or `Show login QR`). The current button hierarchy is:

```html
<button id="qrLoginStartBtn">Show login QR</button>
<details>Service-account login (paste an org_… key)</details>
```

After the change:

```html
<button id="signInHereBtn" class="primary" hidden>Sign in here <span class="hint">— with this device's fingerprint or Hello</span></button>
<button id="qrLoginStartBtn" class="secondary">Show login QR <span class="hint">— for another device to scan</span></button>
<details>Service-account login (paste an org_… key)</details>
```

JS at panel-setup wiring (around line 8995 — where `qrLoginStartBtn` is currently `addEventListener`-bound):

```js
// v5.10.6 — same-device sign-in button. Visible only when the device has
// a v5 credential registered. Otherwise hidden and the cross-device QR
// remains the only path.
const signInHereBtn = document.getElementById('signInHereBtn');
if (signInHereBtn && typeof irlidV5Enrolled === 'function' && irlidV5Enrolled()) {
  signInHereBtn.hidden = false;
  signInHereBtn.addEventListener('click', startSameDeviceSignIn);
}
```

### 2. Same-device sign-in flow — new function `startSameDeviceSignIn()`

Add near `startQrLogin()` in `OrgCheckin.html`:

```js
async function startSameDeviceSignIn() {
  const btn = document.getElementById('signInHereBtn');
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Signing…'; }

    // 1. Fetch fresh nonce
    const initRes = await window.IRLidOrgApi.loginInit();
    if (!initRes.ok) throw new Error(`init failed: ${initRes.status}`);
    const { nonce, worker } = initRes.data;

    // 2. Build canonical login payload (PROTOCOL.md §14.5)
    const payload = { nonce, type: 'irlid_login_v5' };
    const canonStr = canonical(payload);
    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonStr));
    const hashBytes = new Uint8Array(hashBuf);

    // 3. Sign same-device (fingerprint / Hello / Face ID prompts here)
    const sigEnv = await irlidV5SignPayloadHash(hashBytes);

    // 4. Read pub_jwk and reduce to compact form
    const pubJwkRaw = localStorage.getItem('irlid_v5_pub_jwk');
    if (!pubJwkRaw) throw new Error('v5 pub_jwk missing from localStorage');
    const pubJwk = compactJwk(JSON.parse(pubJwkRaw));

    // 5. POST to claim — same endpoint as cross-device flow
    const claimRes = await window.IRLidOrgApi.loginClaim({
      nonce,
      pub_jwk: pubJwk,
      sig: b64urlEncode(sigEnv.sigRaw),
      webauthn: {
        authData: b64urlEncode(sigEnv.authData),
        clientData: b64urlEncode(sigEnv.clientData)
      },
      workerBase: worker
    });

    if (!claimRes.ok) throw new Error(`claim failed: ${claimRes.status} ${JSON.stringify(claimRes.data)}`);

    // 6. Persist session locally (the KEY DIFFERENCE from cross-device flow —
    //    cross-device leaves the session on the polling device only; this saves
    //    it locally so THIS device is signed in)
    localStorage.setItem('irlid_login_session', JSON.stringify(claimRes.data.session));
    localStorage.removeItem('irlid_signed_out');

    // 7. Restore signed-in UI and load dashboard
    qrLoginSession = claimRes.data.session;
    await handleQrLoginSuccess(claimRes.data);

  } catch (e) {
    console.error('[same-device-signin] failed:', e);
    showToast(`Sign-in failed: ${e.message}`);
    if (btn) { btn.disabled = false; btn.textContent = 'Sign in here'; }
  }
}
```

### 3. `js/orgapi.js` — add `loginInit` helper if missing

If a `loginInit()` wrapper doesn't already exist, add it:

```js
async function loginInit() {
  const base = workerBaseUrl();
  const resp = await fetch(`${base}/org/login/init`, { method: 'POST' });
  let data = null;
  try { data = await resp.json(); } catch (_) {}
  return { ok: resp.ok, status: resp.status, data };
}
window.IRLidOrgApi.loginInit = loginInit;
```

Verify `loginClaim()` exists too; if not, add similarly.

### 4. `org-login.html` — persist session locally after claim

Locate `signAndClaim()` (line ~213). After the successful claim block (`if (resp.ok) { … }`), before any return-URL redirect, add a local-persistence step:

```js
if (resp.ok) {
  // v5.10.6 — save session locally so THIS device is signed in,
  // not just the polling device that requested the QR.
  if (data && data.session) {
    try {
      localStorage.setItem('irlid_login_session', JSON.stringify(data.session));
      localStorage.removeItem('irlid_signed_out');
      diag('Session persisted locally on this device.');
    } catch (e) {
      diag('Could not persist session locally: ' + e.message);
    }
  }

  // existing return-URL redirect logic continues unchanged ...
  const returnRaw = (params.get('return') || '').trim();
  if (returnRaw && returnOk(returnRaw)) {
    // ...
  } else {
    // No return URL? Don't just show "Signed in. You may close this tab."
    // Redirect to OrgCheckin.html so the user lands on the dashboard signed in.
    setStatus('pass', 'Signed in. Returning to dashboard...');
    setBtn('Returning...', true);
    diag('No return URL set; defaulting to OrgCheckin.html');
    setTimeout(function () { location.href = '/OrgCheckin.html'; }, 600);
  }
}
```

### 5. Build pill and SW cache

- `OrgCheckin.html` build pill: bump to `Build v5.10.6` (or next available — check current main tip).
- `sw.js` `CACHE_VERSION`: bump to next available (likely `irlid-shell-v15`).

## Acceptance criteria (numbered, testable)

1. **Device WITH credential**: On a phone or desktop where `irlidV5Enrolled()` returns true, the sign-in card shows TWO buttons: primary "Sign in here" (for this device) AND secondary "Show login QR" (for another device). The primary button is visually more prominent.
2. **Device WITHOUT credential**: On a fresh device with no v5 credential, the "Sign in here" button is hidden. "Show login QR" remains visible (current behaviour preserved).
3. **Same-device sign-in works**: tapping "Sign in here" on the 8 Pro prompts for fingerprint. After confirmation, dashboard loads with user signed in. localStorage now has `irlid_login_session`. `irlid_signed_out` flag is cleared.
4. **Cross-device sign-in still works**: tapping "Show login QR" on a desktop generates the QR. Scanning with the 8 Pro on `org-login.html` signs in the desktop (polling device). **Additionally** (the org-login.html enhancement): the 8 Pro now ALSO has the session locally — navigate to `OrgCheckin.html` on the 8 Pro afterwards and it's signed in too. (This closes the gap Captain hit on 16 May.)
5. **`org-login.html` direct-navigation flow**: hitting `org-login.html?nonce=...&worker=...` directly (e.g., from native camera QR scan) and signing now persists session locally and redirects to OrgCheckin.html by default. User lands signed in.
6. Build pill bumped, SW cache bumped. Net diff: ~50–70 lines added, ~5–10 deleted (the existing sign-in card minor restructure).

## Out of scope

- The QR code label/copy on `OrgCheckin.html`'s sign-in card — purely informational text change, ship as part of this PR if convenient but no need for separate version.
- `HANDOVER-GlobalSignOut.md` (v5.10.5) is a separate concern.
- New auth primitives — this re-uses the existing `/org/login/init` and `/org/login/claim` endpoints, just calls them from a new same-device flow.
- Hide "Show login QR" entirely when "Sign in here" is available — keep both. Some users genuinely have a desktop dashboard they want to log into from their phone (the original cross-device case).

## Risk + rollback

- **Risk:** `irlidV5Enrolled()` returns false in incognito or fresh sessions because the credential check reads localStorage flags. Mitigation: the new button is *additive* — if `irlidV5Enrolled()` returns false, the button stays hidden and existing cross-device flow remains the only path. Zero regression.
- **Risk:** The `org-login.html` session-persistence change means devices that scan a cross-device QR (like a screen at a kiosk where multiple users sign in) would carry the last user's session. Mitigation: this is correct behaviour — if you signed in on the device, you ARE signed in on the device. If the kiosk requires per-user isolation, that's a separate "shared kiosk" UX concern.
- **Rollback:** single commit revert. No schema changes, no new endpoints.

## Verification before opening PR

```powershell
cd "<repo>"
git remote -v
git switch main
git pull
git log --oneline -5
```

After implementation:
- `node --check js/orgapi.js` passes
- `node --check sw.js` passes
- Visual smoke locally if possible: incognito Chrome on desktop with Windows Hello credential → sign-in card shows BOTH buttons → tap "Sign in here" → Hello prompts → dashboard loads.

## Discipline reminders (BOOTSTRAP §6)

- Pull `origin/main` right before starting.
- Diff every touched file against `origin/main` before opening PR.
- One PR per task. Scope expansion → stop and raise.
- Bump `sw.js` `CACHE_VERSION` so the frontend change reaches devices.

---

Brief drafted 17 May 2026 by Number One. Closes the "Show login QR is bidirectional" UX gap that has been banked in `memory/pending-work.md` since Mr. Data's Brief A close on 14 May; surfaced again concretely on 17 May during sign-out testing when Captain couldn't sign back in on his 8 Pro after the cross-device dance signed in the polling desktop only.
