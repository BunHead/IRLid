# HANDOVER — Mr. Data — `v5.11.25b` — Single-device invite acceptance, re-do

**Priority:** v5.11.25 went live + smoked + got reverted same day. Most of the implementation was correct, but the welcome-screen takeover didn't render — 4a landed on the org-login "Show login QR" surface instead. This brief fixes that specific failure mode while preserving the rest of v5.11.25's work.
**Branch:** `codex/v5.11.25b-single-device-invite-accept-fix`
**Target build pill:** `v5.11.25b`
**Predecessor brief:** `HANDOVER-SingleDeviceInviteAccept-v5.11.25.md` — read it first for the full architectural spec. This brief is the corrections layer on top, not a replacement.

---

## What v5.11.25 got right (preserve verbatim)

- New Worker endpoint `POST /org/invite/accept-on-this-device` (atomic D1 transaction, role restriction to staff/manager, all validation steps from §"Worker validation" of the predecessor brief)
- `irlidV5Enrol()` helper wrapper around `navigator.credentials.create()` in `js/sign.js`
- `js/orgapi.js` API wrapper
- SW cache bump pattern
- Welcome-screen UI shape (Welcome to {org} — {issuer} has invited you as {role} — Accept & enrol / Decline buttons)
- 6-file scope shape (Org.html, irlid-api-org/src/index.js, org-login.html, js/orgapi.js, js/sign.js, sw.js)

These are all confirmed working from Mr. Data's local validation (node --check ✓, npm test 110/110 ✓, inline script parse ✓, local browser smoke ✓). Keep all of this.

---

## What v5.11.25 got wrong (the failure mode)

**Captain's hardware smoke result on 4a:**

1. 8 Pro: Created Becky Wetherill / Manager invite → fingerprint → QR ✓
2. 8 Pro: Tapped QR to fullscreen ✓
3. 4a: Camera scanned QR → "Open URL" notification ✓
4. 4a: Tapped notification → browser navigated to `irlid.co.uk/Org#staff_invite=<token>` ✓
5. **4a: Saw the existing "Sign in to IRLid Org Portal — Show login QR" surface ❌**

Expected at step 5: the new v5.11.25 welcome screen ("Welcome to Test Event — Spencer Austin has invited you as Manager — Accept & enrol / Decline").

The welcome-screen handler block exists in Org.html but didn't fire. The default no-session sign-in UI rendered first and won the render race.

---

## Root-cause hypotheses (in order of likelihood)

### Hypothesis A — `org-login.html` redirect stripped the hash fragment

The v5.11.25 brief's §Files said:
> `org-login.html` | SMALL change: if `#staff_invite=<token>` present in URL, skip rendering the "Show login QR" path and redirect back to `/Org#staff_invite=<token>`.

Possible failure: the redirect happened but the hash fragment was lost in transit. Browser navigation behaviour varies — `window.location.href = '/Org' + hash` preserves the hash; `window.location.replace('/Org')` strips it; `<a href="/Org">` strips it; `<meta http-equiv="refresh" content="0; url=/Org">` strips it.

**Required fix:** ensure the redirect uses a method that PRESERVES the hash fragment. Recommended:

```javascript
// org-login.html — at the very top of inline script, before any other logic
(function detectStaffInviteRedirect() {
  var hash = window.location.hash || '';
  var m = hash.match(/^#staff_invite=([^&]+)/);
  if (m && m[1]) {
    // Hash present — redirect back to /Org with hash intact.
    // Use location.href assignment (NOT replace, NOT meta refresh) to preserve the fragment.
    window.location.href = '/Org' + hash;
    return; // do not continue org-login boot
  }
})();
```

This runs synchronously at script load, before any "Show login QR" rendering. If `#staff_invite=` is present, bounce immediately with hash intact.

### Hypothesis B — `Org.html` welcome-screen handler ran AFTER the default sign-in UI

The v5.11.25 brief's §Files said:
> `Org.html` | NEW handler block: detect invite-token-on-load when no session → render invite-acceptance UI inline (modal or full-page takeover) → wire Accept/Decline buttons.

Possible failure: the handler runs on `DOMContentLoaded` or later, AFTER the default no-session sign-in UI has already painted. User sees the sign-in surface for ~50-200ms, then welcome screen overlays — but if the handler errors or races with the sign-in render, only the sign-in shows.

**Required fix:** check for `#staff_invite=` SYNCHRONOUSLY at script load, BEFORE the default no-session UI render path runs. Use a feature-detection pattern:

```javascript
// Org.html — earliest inline script position, before any default UI rendering
(function detectInviteAcceptOnLoad() {
  var hash = window.location.hash || '';
  var m = hash.match(/^#staff_invite=([^&]+)/);
  if (!m || !m[1]) return; // no invite token, normal boot
  // Stash token for later use
  try { localStorage.setItem('irlid_pending_staff_invite', m[1]); } catch(e) {}
  // Flag that we need to suppress default sign-in UI and render acceptance UI instead
  window.__irlidPendingStaffInvite = m[1];
})();
```

Then the default no-session UI render path MUST check `window.__irlidPendingStaffInvite` and bail before rendering "Show login QR" if it's set. The acceptance UI render path then takes over.

### Hypothesis C — `captureStaffInviteFromHash` consumed the hash but didn't trigger the UI

If `captureStaffInviteFromHash` stashes the token and clears the hash from URL (common pattern to prevent re-processing on refresh), then `tryStaffInviteRedirectIfNeeded` runs and sees no hash, falls through to sign-in UI. The new welcome-screen handler never gets the signal.

**Required fix:** preserve the hash OR have `captureStaffInviteFromHash` flag `window.__irlidPendingStaffInvite` directly (don't rely on subsequent hash detection). Pattern:

```javascript
function captureStaffInviteFromHash() {
  var hash = window.location.hash || '';
  var m = hash.match(/^#staff_invite=([^&]+)/);
  if (!m || !m[1]) return null;
  var token = decodeURIComponent(m[1]);
  try { localStorage.setItem('irlid_pending_staff_invite', token); } catch(e) {}
  window.__irlidPendingStaffInvite = token; // explicit flag for downstream handlers
  // OPTIONAL: clear hash from URL to prevent re-processing
  // history.replaceState(null, '', window.location.pathname + window.location.search);
  return token;
}
```

The explicit window-level flag is the load-bearing change. Subsequent code paths check `window.__irlidPendingStaffInvite` rather than re-reading the hash.

---

## Required acceptance UI render gate

After token detection, the acceptance UI render path MUST take precedence over default sign-in UI. Pattern:

```javascript
function renderOrgHtmlBootUI() {
  // CHECK ACCEPTANCE FIRST — before any other no-session UI rendering
  if (window.__irlidPendingStaffInvite && !hasActiveSession()) {
    return renderV511InviteAcceptScreen(window.__irlidPendingStaffInvite);
  }
  // Then session check
  if (hasActiveSession()) {
    return renderSignedInUI();
  }
  // Default: no session, no invite — show sign-in QR
  return renderSignInQrUI();
}
```

Order matters. Acceptance UI > session-restored UI > default sign-in. v5.11.25's bug was likely render path falling through to the default sign-in branch because the acceptance branch wasn't checked first.

---

## New diagnostic requirement

To catch this kind of bug pre-merge, add a console.log line in the acceptance UI render path:

```javascript
function renderV511InviteAcceptScreen(token) {
  console.log('[v5.11.25b] Rendering invite acceptance UI for token:', token.slice(0, 12) + '...');
  // ... rest of render
}
```

And a console.log in the default sign-in path:

```javascript
function renderSignInQrUI() {
  console.log('[v5.11.25b] Rendering default sign-in QR UI (no session, no invite)');
  // ... rest of render
}
```

Captain can open Chrome DevTools on the 4a (USB debugging) during smoke and see which path actually fired. This makes the failure mode immediately visible rather than indistinguishable from "looks normal".

---

## Updated smoke test (10 steps + explicit step 4 verification)

Captain will run this on real hardware after merge + deploy:

1. **8 Pro:** + Invite Staff → `Becky Wetherill` → Manager → Add → fingerprint → QR appears with `v5.11.25b` build pill confirmed in sidebar.
2. **8 Pro:** Tap QR to fullscreen (720px overlay).
3. **4a:** Native camera app → scan the QR → URL notification appears at bottom → tap it.
4. **4a:** ⚠️ **CRITICAL VERIFICATION ⚠️** — browser lands on `irlid.co.uk/Org#staff_invite=...`. Captain sees the **welcome screen**: "Welcome to Test Event — Spencer Austin has invited you as Manager — [Accept & enrol] [Decline]". **NOT** "Sign in to IRLid Org Portal — Show login QR". If Captain sees the sign-in surface at this step, the v5.11.25 bug has re-occurred and the PR is ⚠️ REVIEW ⚠️ pending diagnosis.
5. **4a:** Tap "Accept & enrol" → WebAuthn fingerprint prompt → confirm → credential created.
6. **4a:** Browser redirects to `/Org` signed in. Sidebar reads "Signed in as Becky Wetherill · Manager".
7. **4a:** Settings + Staff tabs visible (Manager privileges); Developer-only options hidden.
8. **8 Pro:** Hard-refresh Staff & Rooms → Becky appears as a real D1 member with Manager role.
9. **8 Pro:** Try same invite QR with a different fresh device → rejected with `invite_already_claimed`.
10. **8 Pro:** Wait 15 minutes or manually expire the invite → rejected with `invite_expired`.

If steps 1-10 pass: ✅ ACCEPT ✅ — merge to main, wrangler deploy Worker, +Invite Staff fully working end-to-end on any device combination.

If step 4 fails: don't merge. Report which surface the 4a saw + console.log output from DevTools + the URL bar contents at the moment of failure. We diagnose from that data.

---

## A/R/D verdict expectations

- **✅ ACCEPT ✅** — Hash preserved in org-login redirect; Org.html boot UI checks acceptance branch FIRST; window-level flag set before default sign-in path runs; diagnostic console.log lines present; smoke test passes step 4 with welcome screen visible on 4a.
- **⚠️ REVIEW ⚠️** — Hash preservation method ambiguous (could be window.location.replace which strips); render order not explicit; diagnostic logs missing.
- **⛔ DENY ⛔** — Any of v5.11.25's working bits regressed (Worker endpoint, atomic transaction, role restriction, `irlidV5Enrol`); existing two-device QR-login flow modified; lead_admin / developer invite roles accepted through this path.

---

## What NOT to touch (same as v5.11.25)

- Existing two-device QR-login flow (`org-login.html` Show login QR path remains for desktop sign-in with prior credentials — only modify the redirect-on-staff_invite logic, NOT the rest of org-login)
- `captureStaffInviteFromHash` / `tryRedeemStaffInviteIfPending` for existing-user redemption — keep that path; this brief ADDS a parallel path for fresh users via the welcome-screen takeover
- Invite CREATE side (v5.11.23, working)
- Receipt bridge work (v6.0, separate PR)
- Cross-device admin auth (v6.1, separate PR)
- Visual Theming reorg (v5.12.0, separate PR)

---

## Captain's words verbatim (the failure mode)

*"v5.11.25. Mockup looks great, well done :) [...] 4. onwards didn't work, after scanning with 4a, got image 2"* — where image 2 was the "Show login QR" sign-in surface on `irlid.co.uk/Org` after the 4a scanned the invite QR.

The diagnosis: routing got to the right page, the right URL was navigated to, but the welcome screen handler didn't take over the render. v5.11.25b fixes the handler-order + hash-preservation issues.

Ship clean.

— Number One (drafted 29 May 2026 evening, post-revert)
