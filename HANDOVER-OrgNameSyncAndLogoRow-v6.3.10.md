# HANDOVER — Org tab: sync Display name to real org + remove duplicate Logo row (v6.3.10)

**Author:** Number One · **Date:** 8 Jun 2026 · **Target:** Mr. Data
**File:** `Org.html` only. Frontend-only. No Worker / D1.
**Verdict gate:** Number One bash-diffs against `origin/main` before merge. Captain eyeballs after deploy.
**Lead the PR description with the A/R/D verdict marker.**

Bump build pill `v6.3.9 → v6.3.10` and `sw.js CACHE_VERSION` `v128 → v129`.

Two small, independent changes. No save/check-in logic change.

---

## Fix 1 — Sync the Display name field (+ masthead) to the REAL org name

**Problem:** the Organisation tab's "Display name" field (`#v511OrgName`) shows a stale design-in mockup value (e.g. "Venue", restored from `localStorage` `v511_mockup_org_v1`), while the real org name (`currentOrg.name`, e.g. "Test Event") drives the sidebar, receipts, everything. Editing the field changes nothing real (it's design-in; `saveSettings` doesn't carry the org name). Result: a confusing "Venue" vs "Test Event" mismatch.

**Fix:** when an org is signed in, make the Display name field and masthead name reflect the **real** `currentOrg.name`. The sidebar already does this at **L13052**:
```js
document.getElementById('sidebarOrgName').textContent = currentOrg.name;
```
Right after that line (inside the same `if (isSignedIn && currentOrg) {` block), add:
```js
// v6.3.10 — keep the Org-tab Display name + masthead consistent with the real org name
// (the field is design-in / mockup-localStorage; the real name lives in currentOrg).
const mastheadName = document.querySelector('.v511-masthead-name');
if (mastheadName) mastheadName.textContent = currentOrg.name;
const orgNameInput = document.getElementById('v511OrgName');
if (orgNameInput) orgNameInput.value = currentOrg.name;
```
This overrides the hardcoded masthead HTML ("Test Event") and the stale mockup field value with the live org name.

**Acceptance:** on a signed-in org, the Display name field, masthead name, and sidebar name ALL show the same real `currentOrg.name`. No "Venue"/"Test Event" mismatch. (Renaming the org for real is still design-in v5.12 — out of scope here.)

---

## Fix 2 — Remove the duplicate "Logo" upload row from the Organisation tab

Logo upload now lives in **Brand Identity** (Visual Theming tab). The Organisation tab's logo row is a redundant design-in control (a `v511-btn` "Upload logo" with no real handler). Remove it.

Target row (≈L6273):
```html
<div class="v511-row"><label>Logo</label><div><button type="button" class="v511-btn">Upload logo</button> <span class="v511-hint">PNG / SVG / JPEG, &le; 200 KB</span></div></div>
```
**Do:** delete this entire `v511-row`. Leave the masthead logo (fixed in v6.3.9 — reads the real org logo) and the Brand-ID logo upload untouched.

**Acceptance:** the Organisation tab no longer shows a "Logo / Upload logo" row; the masthead logo still displays the uploaded org logo (v6.3.9); Brand-ID logo upload still works.

---

## Scope guards
- `Org.html` only. No Worker / D1.
- Don't touch v6.3.6 font-save, v6.3.7 anchor/QR, v6.3.8 anchor-hide, or v6.3.9 masthead-logo/declutter code.
- Bump pill v6.3.9→v6.3.10 + sw.js v128→v129.

## Deferred (banked, NOT this PR)
- Real org rename (Display name → `currentOrg.name` via a Worker endpoint) — design-in v5.12.
- Settings nav vanishing on refresh (next in Captain's queue).
- Text Overlay font picker as a named visual list (next in Captain's queue).
