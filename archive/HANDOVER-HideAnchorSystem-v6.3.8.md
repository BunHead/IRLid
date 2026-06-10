# HANDOVER — Hide Anchor System + Org-tab cleanup (v6.3.8)

**Author:** Number One · **Date:** 8 Jun 2026 · **Target:** Mr. Data
**File:** `Org.html` only. Frontend-only. No Worker / D1.
**Verdict gate:** Number One bash-diffs against `origin/main` before merge. Captain eyeballs after deploy.
**Lead the PR description with the A/R/D verdict marker.**

Bump build pill `v6.3.7 → v6.3.8` and `sw.js CACHE_VERSION` `v126 → v127`.

Four small, independent changes. Each is safe to do or skip on its own — never change save/check-in behaviour.

---

## Fix 1 — Hide the non-functional Anchor System panel

The Visual Theming "Anchor System #N" card (Target buttons Centre/Image/Logo/QR/Multi/Default + crosshair grid + "Magnet snap"/"Show crosshairs") is only half-wired — `persistAnchorBucket` collapses every target to `image-anchor` or `centre` (≈L20775), so Logo/QR/Multi don't retarget the Stream burst. Hide it until that's completed; the per-effect **EFFECT SETTINGS** controls (Intensity / centre↔image-anchor toggle / Offset X / Offset Y / Direction) DO work (v6.3.7) and stay.

**Do:** add one CSS rule (the class is `.v512-anchor-system`, CSS ≈L5401):
```css
/* v6.3.8 — hide half-wired Anchor System panel (target retargeting not yet built). Reversible. */
.v512-anchor-system { display: none !important; }
```
**Do NOT** touch the EFFECT SETTINGS pane (different container — Offset X/Y sliders, centre/image-anchor toggle, Direction grid must stay visible + functional).

**Acceptance:** Anchor System card gone; EFFECT SETTINGS pane unchanged; Offset X/Y still moves the burst on Sample; no JS errors.

---

## Fix 2 — Org masthead logo never shows the uploaded logo (bug)

On the Organisation tab, the masthead card's logo is hardcoded to `logo.png` (the default IRLid mark) and never swapped for the org's uploaded logo — even though the org logo IS stored (`portalState.logoUrl` / `settings.logoUrl`, a data-URL) and DOES render correctly in the sidebar (`#chromeLogo`).

The element (≈L6264):
```html
<div class="v511-masthead-logo"><img src="logo.png" alt="IRLid logo" data-irlid-fallback="true" /></div>
```

**Do:** wherever the sidebar logo is updated (find `updateChromeLogo()` / `chromeLogoUrl()` — the fn that sets `#chromeLogo.src`), ALSO update the masthead `img` (`.v511-masthead-logo img`): set its `src` to the org logo when one exists, else keep `logo.png`. **Mirror the sidebar's filter behaviour** — CSS at L4436 applies `filter: invert(1)` to the masthead logo; that's right for the default mark but an org-uploaded logo must render **as-is** (the sidebar already does this: "Org-uploaded logos render as-is — no filter", L104). So when a real org logo is set, remove/override the invert filter on the masthead img (e.g. set inline `style.filter='none'` or toggle a class), matching `#chromeLogo`.

**Acceptance:** with an uploaded org logo, the Organisation-tab masthead shows that logo (un-inverted, true colours); with no logo it falls back to the IRLid `logo.png` (inverted as today). Sidebar logo behaviour unchanged.

---

## Fix 3 — Declutter: drop the hardcoded masthead tagline

The masthead tagline (≈L6262) is a hardcoded generic line that overlaps the editable **Description** field:
```html
<div class="v511-masthead-tagline">Co-presence verification for events</div>
```
**Do:** remove this line (the `.v511-masthead-tagline` div). The masthead then shows org name + slug + logo — cleaner, no duplication with Description. (Leave the `.v511-masthead-tagline` CSS in place; harmless if unused.)

**Acceptance:** masthead no longer shows the generic tagline; name + slug + logo remain.

---

## Fix 4 — Declutter: tuck the read-only Slug into the expander

The Slug row (≈L6268) is read-only with a long 2-line hint, taking prominent space in the main view. Move the entire Slug `<div class="v511-row">…Slug…</div>` block into the existing **"Brand polish & contact info"** `<details>` expander on the same tab (set-once/reference info belongs there). Keep the field + hint intact, just relocated.

- If relocating the block cleanly is awkward, the acceptable fallback is to leave the field in place but shorten the verbose hint to one short line (e.g. "Read-only — auto-generated; changing it breaks existing receipt URLs.").

**Acceptance:** main Organisation view is leaner; Slug still visible (in the expander or with a trimmed hint), still read-only, unchanged value.

---

## Deferred (NOT this PR — banked)
- **Anchor target retargeting:** teach `v512AnchorsForStage` + `persistAnchorBucket` to resolve Logo/QR/Centre/Multi to real on-stage positions, then un-hide the panel.
- **Text Overlay font as a visual list** (like Brand Identity). Already has the same 13 fonts via `V511_BRAND_FONT_OPTIONS`; cosmetic UI swap. Low priority.
- **Display-name mismatch (flag only, do NOT fix here):** the Display-name field can read e.g. "Venue" while the masthead/`currentOrg.name` shows "Test Event" — a display-name → `currentOrg.name` propagation gap. Separate, deeper; note for a future watch.

## Scope guards
- `Org.html` only. No Worker / D1 / JS save-logic change.
- Don't touch v6.3.6 font-save or v6.3.7 anchor-offset/QR code.
- Bump pill v6.3.7→v6.3.8 + sw.js v126→v127.
