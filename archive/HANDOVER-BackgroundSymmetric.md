# HANDOVER — Background image symmetric duplicate (`v5.9.0.13.27` candidate)

**Repo:** IRLid-repo (LIVE — irlid.co.uk)
**Files involved:** `OrgCheckin.html`, `irlid-api-org/src/index.js`
**Scope:** Single PR. Add a "Symmetric (mirror across centre)" toggle to the Background Animation Image mode position controls. When enabled, render the background image at the chosen 9-cell position AND a mirrored copy at the horizontally-opposite cell.

## Why this matters

Captain has been playing with decorative background images (Day-of-the-Dead sugar skull was the trigger). Asymmetric placement leaves visual weight on one side of the dashboard QR. He wants to render the same image on both sides — one normal, one mirror-flipped — so the QR sits between two matched bookends.

The 9-cell position grid stays primary. The new "Symmetric" toggle ADDS a mirrored copy at the horizontally-opposite cell. Centre-column positions (top-centre / centre / bottom-centre) render once because the position is already on the vertical centreline.

## Behaviour matrix

| Primary cell chosen | Mirror copy renders at | Mirror transform |
|---|---|---|
| top-left | top-right | `scaleX(-1)` |
| top-centre | — (single render) | — |
| top-right | top-left | `scaleX(-1)` |
| middle-left | middle-right | `scaleX(-1)` |
| centre | — (single render) | — |
| middle-right | middle-left | `scaleX(-1)` |
| bottom-left | bottom-right | `scaleX(-1)` |
| bottom-centre | — (single render) | — |
| bottom-right | bottom-left | `scaleX(-1)` |

Centre column renders once because the image is already symmetric around the vertical centreline; rendering twice would just stack identical copies.

When the user picks an off-centre cell and Symmetric is OFF, behaviour is unchanged from today (single render at the chosen cell). When the user picks an off-centre cell and Symmetric is ON, two copies render. Toggle is a simple boolean.

## Data shape

Add a new boolean field to the theme settings:
- `theme.bgImageSymmetric: boolean` — defaults to `false`. Persisted via the existing `POST /org/settings` endpoint.

Worker validator (`irlid-api-org/src/index.js`, around where the other `theme.*` fields are validated — look near `bgImagePosition`):
```js
if (typeof t.bgImageSymmetric !== "undefined" && typeof t.bgImageSymmetric !== "boolean") {
  throw new Error("theme.bgImageSymmetric must be boolean");
}
```

Add to the whitelist of `theme.*` fields written back to D1 so the round-trip readback parity check passes.

## UI

In `OrgCheckin.html`, the Background Animation panel's Image mode block already has:
- File upload input
- Position: 9-cell grid (radio buttons or chip-style toggles)
- Tile / Cover mode chips alongside Position

Below the 9-cell grid, add one new control:
```html
<label class="setting-row" style="margin-top: 8px;">
  <input type="checkbox" id="bgImageSymmetricCb">
  <span>Symmetric (mirror across centre)</span>
</label>
```

Wire it up in the same Save All Settings payload assembly the other Image-mode fields already use. Apply on load from the saved theme.

## Rendering

The existing Image-mode background paints via a CSS background-image on either `body` or a dedicated overlay div (look at how the current bgImagePosition cell is applied — likely via a class on `body` or a CSS variable). Whichever approach is already in place, the simplest extension is:

**Option A — dedicated second overlay div.** Create a `<div id="bgImageMirror" class="bg-image-mirror">` element next to the existing image rendering. Apply the same `background-image` URL. Position it at the mirrored cell. Apply `transform: scaleX(-1)`. Toggle its `display` based on `bgImageSymmetric` AND whether the primary cell is in the centre column.

**Option B — CSS-only via `::after` pseudo on the existing container.** Less flexible (only one pseudo per element, harder to chain transforms cleanly). Skip in favour of A.

Go with Option A.

## Edge cases

- **Tile / Cover modes:** these don't have a discrete position, so the Symmetric toggle is N/A. Hide or disable the checkbox when Tile or Cover is active. Show only when Position mode is selected.
- **No image uploaded:** Symmetric toggle is moot when there's nothing to render. Either hide it (cleaner) or leave it as a no-op (simpler — recommend this).
- **Image is wider than 50% of viewport:** in symmetric mode the two copies will overlap in the centre. This is the user's problem to solve with image sizing, not a bug. Don't try to be clever about it.

## Acceptance criteria

1. Settings panel: when Background Animation mode = Image and position mode is active, a "Symmetric (mirror across centre)" checkbox appears below the 9-cell grid.
2. Toggling the checkbox persists across Save All Settings → reload (`theme.bgImageSymmetric` round-trips through Worker).
3. With position = top-left and Symmetric ON, the uploaded image renders at top-left AND at top-right (with `scaleX(-1)`).
4. With position = centre and Symmetric ON, the image renders once at centre (no duplicate, no console warnings).
5. With Symmetric OFF, behaviour is identical to today regardless of position.
6. Worker validator rejects non-boolean values for `theme.bgImageSymmetric` with a clear error message.
7. Build pill bumped to `v5.9.0.13.27`.
8. Settings readback parity check (the existing one) covers the new field.

## Out of scope (do NOT add to this PR)

- Vertical mirroring (top↔bottom flip). Separate feature, deferred.
- Multi-image collage / N-up tiling. Separate feature, deferred.
- Animation of the symmetric pair (e.g. one fades in while other fades out). Separate feature, deferred.
- Per-mirror-copy independent positioning. Separate feature, deferred.

Keep the PR tight: one new boolean field, one new checkbox, one new overlay div, one new Worker validator clause. ~50 lines of diff across both files.

## Style / convention notes

- British spellings (`centre`, `colour`, etc.) per the existing codebase.
- Match the existing setting-row HTML style for the new checkbox (look at how other `<label class="setting-row">` blocks are structured in the Settings panel).
- New Worker validator block goes alongside the other `theme.*` validators in the order they currently appear.

Ship as a single PR labelled `v5.9.0.13.27`. Captain will verify on his desktop dashboard with a sugar-skull image at off-centre positions before merge.
