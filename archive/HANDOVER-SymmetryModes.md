# HANDOVER — Symmetry mode picker (`v5.9.0.13.32` candidate)

**Repo:** IRLid-repo (LIVE — irlid.co.uk)
**Files involved:** `OrgCheckin.html`, `irlid-api-org/src/index.js`
**Scope:** Single PR. Replace the existing boolean `bgImageSymmetric` toggle with a four-option mode picker (`off` / `horizontal` / `vertical` / `quad`) so Captain can choose how the symmetric background image is replicated.

## Why this matters

PR #13 shipped horizontal mirror (across vertical centreline) only. When Captain moves the original to bottom-left, the mirror lands at bottom-right — same row. He expected radial behaviour (bottom-left → top-right). The brief was silent on this; horizontal-only was the simplest interpretation but it's not the most useful.

This PR adds three real modes so Captain can pick the framing he wants for any given image:

- **Horizontal:** mirror across vertical centreline (current behaviour preserved). Bookends QR left+right.
- **Vertical:** mirror across horizontal centreline. Bookends QR top+bottom.
- **Quad:** image rendered at all 4 corners (only valid when chosen position IS a corner). Frames QR on all sides.

Plus the existing **Off** state (no mirror).

## Data shape changes

Replace the existing `theme.bgImageSymmetric: boolean` field with `theme.bgImageSymmetryMode: string` with allowed values: `"off"`, `"horizontal"`, `"vertical"`, `"quad"`.

**Migration rule (CRITICAL):** when loading a saved theme that has the OLD boolean field:
- `bgImageSymmetric: true` → set `bgImageSymmetryMode: "horizontal"` (preserves existing behaviour for current users)
- `bgImageSymmetric: false` or missing → set `bgImageSymmetryMode: "off"`

Migration happens client-side on theme load. The OLD field can be ignored when writing back; the Worker stores `bgImageSymmetryMode` going forward. Don't try to delete the old field from D1 — let it sit as dead data, harmless. (Future cleanup PR if needed.)

## Worker validator changes

In `irlid-api-org/src/index.js`, replace the existing `bgImageSymmetric` boolean validator with:
```js
if (typeof t.bgImageSymmetryMode !== "undefined") {
  const allowed = ["off", "horizontal", "vertical", "quad"];
  if (!allowed.includes(t.bgImageSymmetryMode)) {
    throw new Error("theme.bgImageSymmetryMode must be one of: " + allowed.join(", "));
  }
}
// Tolerate old boolean field for backward compat (don't error, just ignore on save)
```

Whitelist `bgImageSymmetryMode` in the round-trip readback parity check.

## UI

In `OrgCheckin.html`, replace the existing "Symmetric (mirror across centre)" checkbox with a 4-option picker. Match the existing chip-style UI patterns elsewhere in the Settings panel (look at how Mode / Position / Tile/Cover chips render — same shape, same active-state styling).

```
Symmetry: [ Off ] [ Horizontal ] [ Vertical ] [ Quad ]
```

Below the picker, a small helper text:
```
Horizontal: mirror across vertical centre (left+right bookends).
Vertical: mirror across horizontal centre (top+bottom bookends).
Quad: image appears at all 4 corners (only when position is a corner).
```

## Behaviour matrix per mode

**Horizontal** (unchanged from current):
| Position | Mirror at | Transform |
|---|---|---|
| top-left | top-right | scaleX(-1) |
| middle-left | middle-right | scaleX(-1) |
| bottom-left | bottom-right | scaleX(-1) |
| top-right | top-left | scaleX(-1) |
| middle-right | middle-left | scaleX(-1) |
| bottom-right | bottom-left | scaleX(-1) |
| top-centre / centre / bottom-centre | (single render) | — |

**Vertical** (new):
| Position | Mirror at | Transform |
|---|---|---|
| top-left | bottom-left | scaleY(-1) |
| top-centre | bottom-centre | scaleY(-1) |
| top-right | bottom-right | scaleY(-1) |
| bottom-left | top-left | scaleY(-1) |
| bottom-centre | top-centre | scaleY(-1) |
| bottom-right | top-right | scaleY(-1) |
| middle-left / centre / middle-right | (single render) | — |

**Quad** (new — only valid for corner positions):
| Position | Image renders at | Transforms |
|---|---|---|
| top-left | top-left, top-right, bottom-left, bottom-right | identity, scaleX(-1), scaleY(-1), scaleX(-1) scaleY(-1) |
| top-right | top-right, top-left, bottom-right, bottom-left | identity, scaleX(-1), scaleY(-1), scaleX(-1) scaleY(-1) |
| bottom-left | bottom-left, bottom-right, top-left, top-right | identity, scaleX(-1), scaleY(-1), scaleX(-1) scaleY(-1) |
| bottom-right | bottom-right, bottom-left, top-right, top-left | identity, scaleX(-1), scaleY(-1), scaleX(-1) scaleY(-1) |
| Any non-corner | (Quad ignored — falls back to single render with a console warning, no user-facing error) | — |

## Fullscreen handling

The existing `.irlid-qr-fullscreen.active::before` rule from PR #16 paints the horizontal mirror in fullscreen. This PR needs to extend the fullscreen surface to handle all four modes:

- For Vertical mode: use `::after` (or another pseudo) with `transform: scaleY(-1)`.
- For Quad mode: need 3 additional surfaces (existing + 3 mirrored). May require an actual DOM injection rather than pseudo-elements since CSS only has `::before` and `::after`. Use 3 injected divs inside `.irlid-qr-fullscreen.active` (similar to how the non-fullscreen `#venueBgWrap` would handle Quad — same DOM pattern, just inside the fullscreen element).

The non-fullscreen path (`#venueBgWrap .bg-image-mirror`) also needs Quad support — inject 3 mirror divs instead of 1 when in Quad mode.

## Acceptance criteria

1. Settings panel: a new 4-chip Symmetry picker replaces the existing checkbox.
2. Saving with mode = `horizontal` produces identical visual results to today's `bgImageSymmetric: true`. **No regression.**
3. With position = bottom-left, mode = vertical: image at bottom-left AND top-left (mirrored vertically).
4. With position = bottom-left, mode = quad: image at all 4 corners, each appropriately flipped to face the centre.
5. With position = middle-left, mode = quad: single render only (mode silently falls back; console warns).
6. Fullscreen mode renders correctly for all four modes (off, horizontal, vertical, quad).
7. Centre-column / centre-row guards still respected per mode.
8. Existing users with `bgImageSymmetric: true` see their bg image still mirrored horizontally after migration (no setup needed).
9. Worker validator rejects garbage values for `bgImageSymmetryMode` with a clear error.
10. Build pill bumped to `v5.9.0.13.32`.

## Out of scope

- 180°-rotation transform (some users might want this — separate PR if Captain asks).
- Per-quadrant independent image upload.
- Animation of the symmetric copies (rotating mirrors, etc.).
- Deleting the legacy `bgImageSymmetric` field from D1.

## Merge-conflict note

PR #17 (`codex/v5.9.0.13.31-csv-roles`) may be merged before or after this. Base on `origin/main`. Pill conflict resolves to `.32`.

## Style notes

- British spellings (`centre`, `colour`).
- Re-use existing chip-style Settings UI components.
- Match the existing CSS variable naming convention (`--bg-image-symmetry-mode` or similar).

Ship as a single PR labelled `v5.9.0.13.32`. Captain verifies all four modes with the dragon image at multiple positions, in both non-fullscreen and fullscreen, before merge.
