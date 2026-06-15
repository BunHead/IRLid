# HANDOVER — Movable "Offset & anchor" floating panel (v6.4.11 prototype)

**Status:** ✅ **SHIPPED to live as v6.4.11, 15 Jun** — localhost-tested, Captain-approved, merged + deployed + verified live. **Fullscreen-over-preview support: Captain's call 15 Jun — NOT needed** (anchor setup happens in the normal view, not fullscreen), so the feature is COMPLETE; this brief is retained as a historical record of what shipped.
Built 15 Jun (first
Claude Code watch) in a tight build-on-localhost → Captain-reacts loop. Captain delighted with
the feel ("Excellent", "Much better"); closed mid-iteration when his wife was due home.

## What it is
In **Settings → Visual Theming → Check-in/out Experience → (select a Stream step)**, the spatial
controls (Anchor chips + Direction grid + Offset cross) lift OUT of the buried effect-settings
pane into a **draggable floating panel** you park beside the preview, so dragging the offset
moves the preview crosshair live while you watch it. Replaces the parked Rev 9 `.v512-anchor-system`
panel idea (do NOT un-hide that — see "DO NOT" below).

## What's built (all in `Org.html`, ~232 insertions)
- **Float panel** = a `position:fixed` **child of `#v511CelSettingsBody`** (critical: keeps the
  delegated chip/dir handlers firing — a body-level float would kill them). Self-contained script
  block before `</body>` defines `window.v512MountAnchorFloat`; the panel is rebuilt each render
  via a hook at the end of `v511RenderSettingsForItem`. Reparents the REAL controls (no clone/dup).
- **Draggable** by header (pointer events, position saved to `localStorage v512_anchor_float_pos`);
  **Dock ⤓ / ⤢ Pop-out** toggle (`v512_anchor_float_docked`), via `window.v511RerenderCurrentEffectSettings`.
- **Translucent** bg + backdrop-blur (see effects behind it).
- **Fits with no scrollbars** — titles stacked ABOVE controls (column), centred; panel 340px, cross 300×170.
- **Live X/Y both directions** — preview-crosshair drag mirrors into the panel sliders+readout
  (added in `v511CrosshairDragMove`, ~L9296).
- **Orange Multi** (shared-offset v1) — toggle in the header; multi-selects anchor chips; stream
  emits from ALL selected at once (one shared offset/direction). Engine already loops multi-anchor
  arrays (that's how symmetry fires both dragons), so this is mostly UI + a top-branch in
  `v511GetStreamAnchors` (`if s.streamMulti && streamAnchorsMulti.length`). Multi-select chip clicks
  use a **capture-phase listener** to beat the delegated single-select handler. **Drag handler skips
  ALL header buttons** (else the header drag eats the Multi/Dock click — the bug Captain caught).
- **Offset range widened ±100 → ±300** (schema `streamOffsetX_img`/`Y_img` + `v511PointToStreamOffsetImg`
  clamp) so the crosshair travels ~edge-to-edge (image-relative offset only reaches ~image-width/100,
  image is ~15% of frame).
- **Colour-bug fix (real, keep):** `--axis-red`/`--axis-green` were only on the parked `.v512-anchor-system`;
  moved onto `.v512-offset-cross` so the reused widget's X/Y sliders show red/green wherever used.
- Exposed for the float: `window.v511GetSelectedItem`, `v511RefreshCrosshairs`, `v511SaveSettingsNow`,
  `v511RerenderCurrentEffectSettings`.

## Captain's design decisions (banked)
- **Keep offset image-relative** (NOT frame-relative) — fire tracks the dragon. Reach extended via range, not semantics.
- **Multi-DIRECTION = add more Stream steps**, each its own Direction, "Play with previous" to fire concurrently.
  **Multi (one step) = same direction, multiple anchor POINTS.** Both together cover point + direction.
- Per-anchor offsets (the A1/A2/A3 Rev 9 tier) = NOT built; later if wanted.

## DO NOT
- Do NOT un-hide `.v512-anchor-system` (parked by Captain — `pending-work.md` "Anchor system PARKED").
  The first thing this watch did was wrongly un-hide it (built v6.4.11-the-first); reverted. The 11 Jun
  "anchor selection missing" note was pointing at that parked panel — stale. The live anchor design is
  the main-frame "Emit from" + this float.

## Remaining before it can ship to live
1. **Fullscreen-preview support** — the float is `position:fixed` inside `#v511CelSettingsBody`, so the
   browser Fullscreen API HIDES it when the preview goes fullscreen (BOOTSTRAP §6 precedent). To float over
   fullscreen it must mount into the fullscreen element. (Captain valued this; held back for v1 feel.)
2. **Build-pill bump** (`Org.html` sidebar-footer `Build v6.4.10a` → next) + **SW cache bump** (`sw.js`
   `irlid-shell-v160` → next). NOT done (prototype).
3. **Captain hardware verify** + decide single-vs-multi default, whether per-anchor offsets are wanted.
4. Consider: does Multi belong only in the float, or also inline/docked? (Currently float-only.)

## How to test on localhost (no live impact)
```
cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo" ; npx --yes http-server . -p 8123 -c-1
```
Open **http://localhost:8123/Org.html** (must be `localhost`, not the IP — dev auto-login keys on it).
F12 → Console, paste to get into Settings (DEV login comes in as staff; this elevates locally only):
```js
localStorage.removeItem('irlid_signed_out');
currentOrg = ensureDevOrg();
setSignedInUI(true);
window.effectiveRoleRank = () => 999;
window.canUseSettings = () => true;
window.canManageCalendar = () => true;
applyRoleGatedVisibility();
showPanel('settings', document.getElementById('navSettings'));
```
Then Visual Theming → click a **Stream** step → the float appears.

## Dev convenience (optional, not built)
Local testing needs that console snippet every reload because the DEV auto-login is staff-tier and
Settings is `lead_admin`-gated. A `localhost`-only auto-elevate would remove the dance — Captain was
offered it, didn't take it up. Keep it `hostname === 'localhost'` airtight if ever added (security repo).
