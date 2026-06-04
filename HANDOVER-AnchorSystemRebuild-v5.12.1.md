# HANDOVER — Mr. Data — `v5.12.1` — Rebuild the advanced anchor system (from locked Rev 9)

**Branch:** `codex/v5.12.1-anchor-rebuild`
**When:** part of the **v5.12 visual-theming session** — best done alongside / after
`HANDOVER-VisualThemingReorg-v5.12.0.md` and `HANDOVER-BrandIdentityWiring-v6.1.21.md`
(same neighbourhood). **NOT demo-critical** — pure visual polish.

## Status / why this is a re-build (not a port)
The **basic** anchor (Outer/Centre/Inner depth + 9-cell position grid, v5.7.1w) already ships
and works in live `Org.html`. The **advanced** anchor system is NOT in live — its working code
was in a stash lost to an old `reset --hard`. So rebuild it from the **locked Rev 9 design**,
which lives in **`visual-theming-v512-mockup.html`** (repo root) — that mockup is the canonical
reference for the UI, classes, and interactions. Open it live at
`https://irlid.co.uk/visual-theming-v512-mockup.html`.

## What the system is (from the mockup)
A per-effect anchor positioner for the celebration effects: the user **drags crosshairs** on the
preview to place an effect's origin, with a **magnet snap** to grid, a **multi-anchor** list
(Active Anchors), per-anchor **offset + direction**, and an **inverted-Y** axis option. Key
classes already defined in the mockup: `.anchor-crosshair` (draggable, `.selected` orange halo),
`.anchors-hidden` (`.crosshair-toggle`), `.snap-toggle` (magnet, Rev 7), `.anchor-chip`
(Active Anchors list with `.anchor-letter`), `.effect-anchor-badge` (per-effect association),
`.anchor-system` container, `.anchor-target-row`.

## What to build
1. **Port the Rev 9 anchor UI** from the mockup into the live Visual-Theming celebration panel in
   `Org.html` — crosshair-drag → live offset, the Active Anchors list, magnet snap-toggle,
   selected-state highlight, per-effect anchor badge.
2. **Wire it to the REAL celebration effects.** The live effects already exist (confetti,
   sparkles, stream, QR glow, etc.) and already support QR-centric anchoring via the
   `--qr-cx`/`--qr-cy` CSS variables (v5.11.0v). Extend that: an effect's configured anchor
   (position + offset, from the crosshair) feeds its render origin — so dragging the crosshair
   actually moves where that effect fires. Each effect in the sequence carries its own anchor in
   `item.settings` (or `theme._v512.anchors`), which already round-trips through save/load
   (`theme._v512.anchors`, Org.html ~L9453/9628).
3. **Persist** anchor config into `theme._v512.anchors` via the existing Save-all path (no Worker
   change — it's nested under `theme`, already saved). Hydrate on load.

## The two known fiddly bits (call these out — they're where it gets hard)
- **Y-axis vertical slider CSS** — `::-webkit-slider-runnable-track` won't take the gradient on
  WebKit verticals; the axis slider needs a workaround (the mockup's axis sliders show the
  intended look but the live wiring needs this fix).
- **True symmetry-mirror** — CSS can't flip a `background-image` per-layer, so a real mirror needs
  **canvas pre-processing** (draw the image flipped to a canvas, use that as the layer source).
  This is the hardest sub-piece; if it balloons, ship the rest and flag symmetry-mirror as a
  follow-up.

## Out of scope
- The basic Outer/Centre/Inner grid (already shipped — leave it).
- Worker/schema (anchors persist under `theme`, already saved).
- Brand Identity / Staff wiring (separate briefs).

## File touch list
| File | Change |
|---|---|
| `Org.html` | port the anchor UI; wire crosshair → effect render origin via `--qr-cx/--qr-cy`-style vars; persist/hydrate `theme._v512.anchors` |
| `sw.js` | cache bump |
| Build pill | → `v5.12.1` |

## A/R/D expectations
- **✅ ACCEPT ✅** — Drag a crosshair → the chosen effect fires from that position; magnet snaps to
  grid; multiple anchors selectable via the Active Anchors list; settings persist + hydrate;
  inverted-Y works; no regression to existing celebration effects.
- **⚠️ REVIEW ⚠️** — Crosshair moves but the effect doesn't follow; Y-slider still mis-renders;
  symmetry-mirror attempted but broken (better to defer it than ship broken).
- **⛔ DENY ⛔** — Breaks existing celebration effects; Worker/schema change; touches the basic
  position grid.

## Smoke
1. Visual Theming → drag an effect's crosshair → Sample → the effect originates from the new spot
2. Magnet snap on → crosshair snaps to grid points
3. Multiple anchors + inverted-Y behave per the mockup
4. Save all → hard refresh → anchors persist; existing effects unaffected

— Number One (4 June 2026)
