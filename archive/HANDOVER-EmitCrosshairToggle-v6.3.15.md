# HANDOVER — Emit-crosshair on/off toggle for Visual Theming (v6.3.15)

**Author:** Number One · **Date:** 9 Jun 2026 · **Target:** Mr. Data
**File:** `Org.html` only. Frontend. No Worker / D1.
**Verdict gate:** Number One bash-diffs against `origin/main` before merge. Captain eyeballs after deploy.
**Lead the PR description with an A/R/D verdict marker.** Bump build pill `v6.3.14 → v6.3.15` and `sw.js CACHE_VERSION` `v133 → v134`.

## Feature
An **on/off toggle in the Visual Theming tab** (a SETUP AID — must NEVER appear on the customer check-in / `org-entry` attendee display) that shows an **anchor crosshair on the preview** marking where the **Stream** celebration effect will emit from. It must show on **BOTH the inline preview stage AND the fullscreen preview**. Default **OFF**.

## Reuse the existing machinery (do NOT rebuild)
- `#v511AnchorCrosshairs` (`.v511-anchor-crosshairs`, inside `#v511ThemePreviewStage`) + **`v511UpdateAnchorCrosshairs()` (~L9077)** — populates `.v511-anchor-crosshair-marker` dots at the Stream emit point (`a.pos + v511GetStreamOffsets`). It currently shows ONLY when a Stream sequence row is **selected** (`v511SelectedSeqIdx` valid AND `item.effect==='stream'`).
- Crosshairs are **hidden in fullscreen** by CSS at **~L5774-5775**: `:fullscreen .v511-anchor-crosshairs { display:none !important }`.
- **`fullscreenQR()` (~L16386)** STRIPS the crosshair from the fullscreen clone: `clone.querySelector('.v511-anchor-crosshairs')?.remove();`.

## Do
1. **Toggle UI:** add a small on/off toggle in the Visual Theming **preview controls strip** (near the Sample button). Label e.g. "Emit crosshair". Default **OFF**. Persist the boolean in `localStorage` (key `irlid_show_emit_crosshair`) so it survives reloads while setting up. Expose state on `window` (e.g. `window.v511EmitCrosshairOn`).
2. **Inline preview when ON:** show the crosshair even if no Stream row is selected — in `v511UpdateAnchorCrosshairs()`, when the toggle is ON and no Stream row is selected, fall back to the **FIRST `'stream'` effect** in the active mode's sequence and render its emit crosshair. When OFF, keep the existing "only when a Stream row is selected" behaviour exactly.
3. **Fullscreen when ON:**
   - In `fullscreenQR()`, do **NOT** strip `.v511-anchor-crosshairs` when the toggle is ON — keep it in the clone and **recompute the marker positions for the clone's dimensions** (re-run the populate against the clone, since `v511GetStreamOffsets` depends on stage size).
   - Override the `:fullscreen` hide: add a class (e.g. `.emit-crosshair-on`) to the stage/clone when the toggle is ON, plus CSS: `:fullscreen .emit-crosshair-on .v511-anchor-crosshairs, .v511-runtime-stage.emit-crosshair-on .v511-anchor-crosshairs { display:block !important }`.
4. **Strictly Visual-Theming-only** — never render on the live customer check-in / `org-entry` attendee page.

## Acceptance
- A toggle in Visual Theming; **OFF** = current behaviour (crosshair only while editing a Stream row, hidden in fullscreen).
- **ON** = the emit crosshair is visible on the **inline preview AND the fullscreen preview**, marking where the Stream particles fire from.
- Persists across reload; **never** appears on the customer check-in display; no JS errors; selecting/sampling effects still works.

## Scope guards
- `Org.html` only. No Worker / D1. Bump pill v6.3.14→v6.3.15 + sw.js v133→v134.
- Reuse the existing crosshair element + populate function — don't reimplement the anchor maths.
