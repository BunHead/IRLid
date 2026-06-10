# HANDOVER — Org-tab cleanup: masthead logo + declutter (v6.3.9)

**Author:** Number One · **Date:** 8 Jun 2026 · **Target:** Mr. Data
**File:** `Org.html` only. Frontend-only. No Worker / D1 / save-logic change.
**Verdict gate:** Number One bash-diffs against `origin/main` before merge. Captain eyeballs after deploy.
**Lead the PR description with the A/R/D verdict marker.**

(Note: the Anchor System hide already shipped as v6.3.8. This is the remaining Org-tab work.)

Bump build pill `v6.3.8 → v6.3.9` and `sw.js CACHE_VERSION` `v127 → v128`.

Three small, independent changes. Never alter save/check-in behaviour.

---

## Fix 1 — Org masthead logo never shows the uploaded logo (bug Captain reported)

On the Organisation tab, the masthead card's logo is hardcoded to `logo.png` (default IRLid mark) and never swapped for the org's uploaded logo — even though the org logo IS stored (`portalState.logoUrl` / `settings.logoUrl`, a data-URL) and DOES render correctly in the sidebar (`#chromeLogo`).

Element (≈L6264):
```html
<div class="v511-masthead-logo"><img src="logo.png" alt="IRLid logo" data-irlid-fallback="true" /></div>
```

**Do:** find where the sidebar logo is set (`updateChromeLogo()` / `chromeLogoUrl()` — sets `#chromeLogo.src`). ALSO update the masthead `img` (`.v511-masthead-logo img`): `src` = org logo when one exists, else `logo.png`. **Mirror the sidebar's filter behaviour** — CSS L4436 applies `filter: invert(1)` to the masthead logo (right for the white default mark, wrong for a real logo). When a real org logo is set, render it as-is (override the invert — e.g. inline `style.filter='none'` or a class toggle), exactly as `#chromeLogo` already does ("Org-uploaded logos render as-is — no filter", L104).

**Acceptance:** with an uploaded org logo, the masthead shows it in true colours; with no logo it falls back to the inverted IRLid `logo.png`. Sidebar logo unchanged.

---

## Fix 2 — Declutter: drop the hardcoded masthead tagline

Tagline (≈L6262) is a hardcoded generic line overlapping the editable **Description** field:
```html
<div class="v511-masthead-tagline">Co-presence verification for events</div>
```
**Do:** remove this div. Masthead then shows org name + slug + logo. (Leave the `.v511-masthead-tagline` CSS; harmless.)

**Acceptance:** generic tagline gone; name + slug + logo remain.

---

## Fix 3 — Declutter: tuck the read-only Slug into the expander

Slug row (≈L6268) is read-only with a long 2-line hint, prominent in the main view. Move the whole Slug `<div class="v511-row">…Slug…</div>` into the existing **"Brand polish & contact info"** `<details>` expander on the same tab. Keep field + hint intact, just relocated.
- Acceptable fallback if the block move is awkward: leave it in place but shorten the hint to one line ("Read-only — auto-generated; changing it breaks existing receipt URLs.").

**Acceptance:** leaner main Organisation view; Slug still visible (in expander or trimmed), still read-only, value unchanged.

---

## Deferred (NOT this PR — banked)
- **Anchor target retargeting:** wire `v512AnchorsForStage` + `persistAnchorBucket` to resolve Logo/QR/Centre/Multi to real on-stage positions, then un-hide the `.v512-anchor-system` panel (hidden in v6.3.8).
- **Text Overlay font as a visual list** (like Brand Identity). Has the 13 fonts already; cosmetic UI swap. Low priority.
- **Display-name mismatch (flag only):** Display-name field can read "Venue" while masthead/`currentOrg.name` shows "Test Event" — a propagation gap. Separate, deeper.

## Scope guards
- `Org.html` only. No Worker / D1.
- Don't touch v6.3.6 font-save, v6.3.7 anchor/QR, or v6.3.8 anchor-hide code.
- Bump pill v6.3.8→v6.3.9 + sw.js v127→v128.
