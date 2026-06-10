# HANDOVER — Anchor System Rebuild (v6.4.0)

**Author:** Number One, 10 June 2026. **Status:** spec, ready to execute.
**Goal:** replace the buried offset-cross with a live, on-preview emission-point editor — drag
the anchor *on the actual example image* and watch the particle stream follow in real time.
When done, the offset cross is removed from Effect settings.

## Why a rebuild (not another patch)

There are **four competing representations of "where this effect sits,"** and the cross, the
crosshair, and the particle emit each read a different one:

| Field | Set by | Read by |
|-------|--------|---------|
| `item.settings.streamOffsetX_img/Y_img` | the offset cross | the particle emit (after the v6.3.7 guard delete) |
| `item.settings.v512Anchors` | `persistAnchorBucket` | the old L8706 guard (now deleted) — nothing now |
| `_v512AnchorState[mode][bucket].anchors` | the hidden anchor panel | the crosshair dot |
| `--v512-anchor-x/y` CSS vars | the crosshair | only the crosshair |

Every past fix was whack-a-mole because there is no single source of truth. **Step 1 fixes that;
everything else builds on it.**

## Stages (each independently shippable + smoke-able)

**Stage 1 — unify the model.** One canonical field on the sequence item:
`item.anchor = { target: 'image'|'logo'|'qr', x: <-100..100>, y: <-100..100> }` (% of target,
so it survives normal↔fullscreen). Write a `resolveAnchor(item, stage)` that returns the pixel
origin on a given stage. Migrate legacy on read (`streamOffsetX_img/Y_img` → `item.anchor`),
never rewrite old saved rows in place (immutable-DB rule). One writer, one reader. Prove with a
console probe at each layer: input → store → `resolveAnchor` → emit.

**Stage 2 — on-stage handle (static).** Render a draggable handle on `#v511ThemePreviewStage`
(and its inline Check-in clone) at `resolveAnchor`'s position. Pointer drag updates `item.anchor`
live; debounce-save on release. No emit changes yet — just prove the handle moves and persists.

**Stage 3 — live edit-pulse.** While the handle is held, run a faint low-rate emission from the
current point so the stream visibly follows the finger (today particles only fire on Sample /
real check-in). This is the "see it in real time" payoff.

**Stage 4 — snap targets.** Drag near the logo or QR → handle snaps to that target and flips
`item.anchor.target`. Replaces the Logo/QR/Multi idea with direct manipulation.

**Stage 5 — retire the cross.** Remove the offset-cross from `V511_EFFECT_SETTINGS` /
the render loop. One place to set position, and it's on the example.

## Key file touch-points (live repo, Org.html)

- Emit: `v511EmitStreamBurst` (L~8791-8794) and `v511GetStreamOffsets` (L8706 region) → route
  through `resolveAnchor`.
- Persist: `persistAnchorBucket` (L~20767) → write only `item.anchor`.
- Render loop: the `/offsetx/i` interception added in v6.3.19 (Effect-settings render) → removed
  at Stage 5.
- Stage CSS: `.v511-theme-preview-stage` (L4468), `.v511-theme-preview-qr` (L4437) — the handle
  overlays this stage.
- Hidden panel: `.v512-anchor-system` (hidden v6.3.8) — either repurpose its markup for the
  on-stage handle or delete it.

## Acceptance (per stage, hardware-smoke)

1. Drag handle on the preview → emission point on the live example moves with it, in real time.
2. Position persists across reload; matches between normal and fullscreen (same % of image).
3. A console probe asserts emitted particle origin == handle position (regression guard).
4. Cross removed; no orphaned `streamOffset*` writes remain.

## Risks

- Continuous edit-pulse perf (keep it low-rate, cancel on release).
- %-coordinate consistency across normal/fullscreen (the original `*_img` intent — get it right
  once in `resolveAnchor`).
- Don't ship Stages 2-5 until Stage 1's single-source-of-truth is green, or it drifts again.
