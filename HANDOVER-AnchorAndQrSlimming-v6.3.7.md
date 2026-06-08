# HANDOVER — Anchor fix + QR slimming (v6.3.7)

**Author:** Number One · **Date:** 8 Jun 2026 · **Target:** Mr. Data
**File:** `Org.html` only. Frontend-only. No Worker / D1 / migration.
**Verdict gate:** Number One bash-diffs against `origin/main` before merge (ancestor, monotonic pill, no spurious deletions). Captain hardware-smokes after deploy.
**Lead the PR description with the A/R/D verdict marker.**

Three small, independent fixes. Bump build pill `v6.3.6 → v6.3.7` and `sw.js CACHE_VERSION` `v125 → v126`.

---

## Fix 1 — Anchor offset never reaches Stream particles

**Symptom:** Setting a Stream celebration effect's anchor (Visual Theming) does not move where the particles emit. Crosshair + sliders move; the burst always fires from base position.

**Root cause (traced live + in code):** `v511GetStreamOffsets(stage, s)` early-returns `{x:0,y:0}` whenever `s.v512Anchors` is truthy:
```js
function v511GetStreamOffsets(stage, s) {
  if (s && s.v512Anchors) return { x: 0, y: 0 };   // ← THE BUG (≈ L8706)
  ...reads s.streamOffsetX_img / streamOffsetY_img...
}
```
But `persistAnchorBucket` (≈L20767) sets `item.settings.v512Anchors` (≈L20772) on **every** stream anchor change AND writes the correct `streamOffsetX_img/Y_img` from the active anchor (≈L20777-78). So the guard always fires → the offset is written then discarded. Half-finished `v512Anchors` migration; the emit (`v511GetStreamOffsets` → L8765/L9096 → emit position L8791-94 → `v511EmitStreamBurst`) was never wired to read `v512Anchors`.

**Fix:** delete the guard line. `v511GetStreamOffsets` then falls through to the already-correct `streamOffsetX_img/Y_img`.

**Safe because:** particles are positioned from the computed `pos` (L8667-68), NOT from `--v512-anchor-x/y` CSS vars (those only drive the crosshair overlay) — no double-application. Old themes lacking `streamOffsetX_img` read `NaN→0` = same as today.

**Acceptance:** set a Stream effect anchor to an extreme (e.g. x:-90, y:-90), press Sample → burst visibly emits from that corner, normal + fullscreen; slider/crosshair stay in sync; round-trips through save.

---

## Fix 2 — Outcome QR inlines the logo data-URL (console spam + unrenderable)

**Symptom:** `[renderQr] QR generation failed: Cannot read properties of undefined (reading '0')` on every dashboard load. Now caught/non-fatal (v6.2.9 try/catch) but spams the console, and the outcome QR never renders.

**Root cause (measured live):** `buildOutcomeUrl(mode)` (≈L17039) appends the org logo as a `data:` URL (≈L17063 `appendOptional(url, 'logo', portalState.logoUrl)`). With the current logo that param alone is **7,063 chars**, total URL **7,557** — well past qrcodejs level-L capacity (~2,953). Without the logo the URL is **494 chars** and renders fine.

**Fix:** apply the SAME guard the venue QR already uses (the v6.1.25c pattern at `buildVenuePayload` L13673). In `buildOutcomeUrl`, only append `logo` when it's a short http(s) URL:
```js
// only inline a short http(s) logo; a data: URI (base64 image) blows the QR past capacity
if (portalState.logoUrl && !/^data:/i.test(portalState.logoUrl) && portalState.logoUrl.length <= 300) {
  appendOptional(url, 'logo', portalState.logoUrl);
}
```
(i.e. replace the unconditional `appendOptional(url, 'logo', …)` with the guarded form.)

**Acceptance:** dashboard load no longer logs `[renderQr] … reading '0'`; the outcome QR box renders a scannable code; the outcome-URL copy line still works (it can keep the full URL if desired — only the QR needs the short one; simplest is to slim both).

---

## Fix 3 — Venue QR: drop brand params when they equal their defaults

**Goal (Captain):** make the scanned QR less dense / easier to read (esp. the USB webcam).

**Context:** `buildVenuePayload` (L13653) is already lean — it skips empty optionals and already guards the logo (L13673). EC level is already L (L15135). BUT the 7 brand params (L13678-13686) are written **unconditionally** whenever a banner exists, even at default values (~120 chars of avoidable density):
```
brandCustomise (default 'off'), brandFont ('sans'), brandWeight ('bold'),
brandItalic ('off'), brandSpacing ('normal'), brandColour ('white'), brandShadow ('soft')
```
`org-entry.html` reads each with an absent-param default (e.g. L661 `brandFont = params.get('brandFont') || 'sans'`).

**Fix:** only `qp.set('brandX', value)` when `value !== <org-entry.html's absent default>`.
- **MUST verify each default in `org-entry.html` first** and use that exact default as the omit threshold, so an omitted param produces identical behaviour. Confirm the fallback for: brandCustomise, brandFont, brandWeight, brandItalic, brandSpacing, brandColour, brandShadow. Only omit the ones whose `org-entry.html` fallback matches the value being dropped.
- Keep `brandBanner` always (it's the banner text, not a style default).
- Leave the theme params (themePrimary/Accent/QrFg/Mode/palette) as-is — they're already conditional.

**Acceptance:** with an all-default banner, the venue QR drops the 7 brand params and is visibly less dense; the attendee page (`org-entry.html`) renders **byte-identical branding** to before (themed correctly). With a customised banner (non-default values), those params still ride along and the page themes exactly as now. Decode the before/after QR to confirm only default params disappeared.

---

## Scope guards
- `Org.html` only. No Worker / D1.
- Do NOT touch: the doorman flow, the v5 envelope/sign paths, the font-save work from v6.3.6.
- The three fixes are independent — if Fix 3's default-matching is uncertain for any param, omit only the ones you can verify and leave the rest (partial is fine; never change behaviour).
- Bump pill v6.3.6→v6.3.7 + sw.js v125→v126.
