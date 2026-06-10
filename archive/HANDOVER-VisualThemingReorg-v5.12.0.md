# HANDOVER — Mr. Data — `v5.12.0` — Visual Theming Panel Reorganisation

**Design reference:** `visual-theming-v512-mockup.html` in repo root — **CURRENT VERSION IS REV 9**. Open locally in Chrome OR live at `https://irlid.co.uk/visual-theming-v512-mockup.html`.
**Target:** `v5.12.0`. SW cache bump: monotonic from current.
**Branch:** `codex/v5.12.0-visual-theming-reorg`

---

## Anchor system — status + ease assessment (Number One, 4 June 2026)

The **basic** background-image anchor (Outer/Centre/Inner depth + 9-cell position grid,
v5.7.1w) is **shipped and works in live `Org.html`**. The **advanced** anchor system (the Rev 9
design — drag-crosshairs → live offset sliders, Active Anchors list, per-anchor offset+direction,
magnet-snap, inverted-Y axis) is **PARKED and not in live** — it lived in the mockup, and its
working code was in a stash likely lost to an old `reset --hard` (per memory). So this is a
**re-build from the locked Rev 9 design**, not a port.

**Ease: medium, bounded.** No design work (Rev 9 locked). No architectural unknowns. Two genuinely
fiddly spots: (1) **Y-axis vertical-slider CSS** — `::-webkit-slider-runnable-track` won't take
the gradient on WebKit verticals; needs a workaround. (2) **True symmetry-mirror** — CSS can't
flip a `background-image` per-layer, so it needs **canvas pre-processing** (the hardest sub-piece).
The drag→offset + magnet-snap is standard fiddly UI. **Not demo-critical** (visual polish) — keep
parked until governance work (v6.2.0/v6.3.0) + easy wins are through, then un-park as a dedicated
session alongside Brand-Identity wiring (same neighbourhood).

---

## ⚠️ READ THIS REV 9 SUPPLEMENT FIRST ⚠️

The mockup has gone through Rev 2 → Rev 9 since this brief was first drafted. The original sections (Brand Identity / Colour & Background / QR Appearance / Check-in/out Experience / Post-Accept Flow) are still correct — keep them. BUT Section 4 (Check-in/out Experience) has substantial new architecture, and there are several locked design decisions that supersede earlier guidance. **Read this supplement first**, then read the original brief below for the section-level details.

### Rev 9 architectural change: Permanent Active mode bar

The **Active mode picker (Allow / Review / Deny) is no longer inside Section 4** — it's a PERMANENT row directly below the preview frame, outside the section accordion. The bar contains: `Active mode dropdown` + `Sample button` + `hint text` + `Undo/Redo pill (right-anchored)`. The bar never collapses; it stays at eye-level with the preview while the user edits any section below.

This is critical UX: when the user hits `Ctrl+Z`, their eye is on the preview (which updates live), not on a buried settings header. The bar's undo/redo + Sample button are always reachable without scrolling.

Section 4 starts directly with **Outcome Palette**, then **Effect Sequence**, then **Anchor System**, then **Text Template**, then **Outcome Sound**. The Active mode header at the top of Section 4 is GONE — it lives above the sections now.

### The Anchor System (NEW in Section 4)

This is the headline feature for Section 4. Sits between Effect Sequence and Text Template. Architecture:

- **Per-effect anchors.** Each effect in the sequence has its own anchor configuration. Click an effect card in the sequence to "select" it; the Anchor System block reconfigures to show that effect's anchors.
- **Four named anchor targets:** `⚓ Centre` · `⚓ Image` · `⚓ Logo` · `⚓ QR`. Chips in a row labelled "Target:". Tooltip on each (e.g., `Centre` → "The geometric centre of the stage").
- **Multi-select toggle (orange).** Default OFF — single anchor per effect. When ON: multiple anchor chips can be active simultaneously, each gets a letter tag (A1, A2, A3...). When Multi is ON, active anchor chips turn orange (matching the Multi toggle's orange context) instead of accent-blue.
- **🧲 Magnet snap-toggle** in the Anchor System header. ON = drag snaps to named anchor positions (Centre/Image/Logo/QR snap zones light up as crosshair approaches). OFF = freeform drag anywhere. Blender / Maya / Unreal convention.
- **⚓ Show crosshairs toggle** in the Anchor System header. Toggles whether crosshair markers are visible on the preview frame.
- **Active Anchors list** (visible only when Multi is ON). Shows each active anchor as a row: `[A1 letter tag] [target name] [offset readout]`. Click an A-tag row → that anchor becomes "selected" (its crosshair gets an orange halo on the preview; the sliders + direction grid + offset readout below now bind to that anchor's state).
- **Per-anchor offset.** Each anchor has its own `(X%, Y%)` offset stored as percentages relative to the anchor target's centre (NOT pixels — see "Inline-vs-fullscreen offset" below).
- **Per-anchor direction.** Each anchor has its own direction setting (9-cell grid: `↖ ↑ ↗ ← ● → ↙ ↓ ↘`). Different anchors on the same effect can emit in different directions. A1 might emit upward, A2 downward, same effect.
- **`+`-shape offset cross.** Two `<input type="range">` sliders intersecting visually as a `+`. Horizontal slider on the X axis, vertical slider on the Y axis. 220×220px footprint. Sits alongside the 9-cell direction grid.
- **Live drag → live settings.** Dragging a crosshair on the preview frame updates the offset values in the sliders + readout in real time. Sliders update the crosshair position in real time. They're bidirectional bindings on the same state.

### Locked design verdicts (NO ambiguity, ship these exactly)

1. **`+` cross size:** 180×180px (matches the 3×60px direction grid exactly)
2. **Multi-select visual:** Chip-style toggle (orange-tinted "⊞ Multi" chip with orange border). NOT a proper toggle. NOT a dropdown.
3. **Drag-to-anchor:** BOTH snap and freeform. Magnet toggle in the anchor system header switches modes.
4. **Inactive anchor chips:** Clean (no `A?` hint placeholder). Letter tags only appear on ACTIVE chips when Multi is on.
5. **Reset glyph:** Use the word **`Default`** instead of any rotation arrow glyph. The character `↻` is too easily confused with refresh; the character `↶` is also ambiguous. Plain text "Default" is unambiguous. Per-effect button reads `↩ Default — Reset {effect name}` or just `Default`.

### Axis colours (RED horizontal, GREEN vertical — Blender convention)

- Horizontal slider track: **solid red** (`#f85149` or similar). No gradient.
- Vertical slider track: **solid green** (`#22c55e` — NOT GitHub's `#7ee787` which is cyan-tinted; use the more saturated `#22c55e`). No gradient.
- X label sits at the **right end** of the horizontal slider (the +X extreme).
- Y label sits at the **top end** of the vertical slider (the +Y extreme).
- Both labels coloured to match their axis (red/green).

### ⚠️ Y-axis vertical slider styling gotcha ⚠️

Captain's hardware smoke of Rev 8 showed the Y-axis slider track NOT rendering as green even though CSS specified `background: var(--axis-green)` on the input element. The vertical slider with `writing-mode: vertical-rl` + `-webkit-appearance: slider-vertical` doesn't reliably apply the input's `background` colour to the runnable track. You MUST style the WebKit pseudo-element directly:

```css
.offset-cross .slider-v::-webkit-slider-runnable-track {
  background: var(--axis-green);
  width: 6px;
  border-radius: 3px;
}
.offset-cross .slider-v::-moz-range-track {
  background: var(--axis-green);
  width: 6px;
  border-radius: 3px;
}
```

Same applies if horizontal slider has track-paint issues. Test on Chrome + Firefox + Safari (if possible). The mockup file (Rev 9) does NOT have this fix — it's a known gotcha to address in implementation.

### Font picker — Word-style flat list

- Drop the category tabs (Sans / Serif / Display / Handwriting / Mono) — Captain explicitly said "Don't need filter, just have all fonts on screen, there aren't that many of them."
- Scrollable list, ~4 rows visible, max-height around 180px, the rest scrolls.
- Each row shows the font name **rendered in its own font** (left-aligned, ~18px), plus a small grey label of the font category on the right (e.g., `SANS`, `DISPLAY`, `SCRIPT`).
- Click a row → that font is applied to the LIVE preview banner at the top of the page in real time. **One preview surface only** — no separate "font preview" inside the font picker.
- ~25 fonts total. Mix of system + Google Fonts. See Rev 9 mockup `font-list` for the exact list.

### Per-mode sound (Section 4 bottom)

The Outcome Sound block swaps content based on Active mode:
- **Allow mode** → two rows: `Check-in sound` + `Check-out sound` (both fire the allow celebration per v5.11.15 architectural call — different sounds for the two directions)
- **Review mode** → one row: `Review sound` (no in/out distinction — flow paused for human judgment)
- **Deny mode** → one row: `Deny sound` (no in/out distinction — rejection, no flow past it)

The block visible at any time = the block matching the current Active mode (header bar above). Switching Active mode swaps the block.

### What this supersedes in the original brief

- Original §"Mode picker (Accept/Review/Deny) at top" of Section 4 — **superseded**. Active mode is now the permanent bar OUTSIDE Section 4.
- Original §"Check-in sound + Check-out sound — split into two separate rows" — **partially superseded**. The split applies only to Allow mode; Review and Deny have a single sound each.
- Original `theme.checkoutSound` persistence key — **superseded by per-mode sound keys**: `theme._v512.sound.allow.checkin`, `theme._v512.sound.allow.checkout`, `theme._v512.sound.review`, `theme._v512.sound.deny`.

### What stays unchanged from the original brief (read below for full detail)

- Section names and order (1. Brand Identity / 2. Colour & Background / 3. QR Appearance / 4. Check-in/out Experience / 5. Post-Accept Flow)
- Brand Identity contents (banner text template, ONE global font, logo position, description, sidebar logo source)
- Colour & Background folding (palette + pattern + image into one section)
- QR Appearance extraction (foreground colour + motion, separate from celebration palette)
- Post-Accept Flow contents (welcome message, redirects, dwell time, smart receptionist toggle)
- What moves from Org tab (logo + description)
- What NOT to touch (check-in tab clones, v5.11.23 invite flow, Worker, etc.)

### Updated smoke test additions (in addition to original §"Smoke Test")

After steps 1-11 of the original smoke:

12. **Permanent Active mode bar** sits directly under the preview, never collapses when Section 4 is closed.
13. **Click an effect card in the sequence** → Anchor System block reconfigures to that effect's anchors.
14. **Drag a crosshair on the preview** → offset (X%, Y%) updates in the readout + sliders in real time.
15. **Toggle Multi on** → active anchor chips turn orange; A1/A2/A3 letter tags appear on active chips; Active Anchors list slides in. Click an A-tag row → selected halo moves to that crosshair.
16. **Toggle magnet on** → drag crosshair near a named anchor (Logo / QR) → snap-zone ring lights up green; release → snaps to that anchor.
17. **Switch Active mode** (top bar) → Outcome Sound block at bottom of Section 4 swaps content. Allow shows in+out sounds, Review/Deny show one sound each.
18. **Vertical slider in the offset cross** renders as solid green (not blue). Horizontal as solid red. Confirm `::-webkit-slider-runnable-track` styling is present.
19. **Font picker** is a flat scrollable list (no category tabs). Click a font → preview banner above re-renders in that font.
20. **Undo/Redo (Ctrl+Z / Ctrl+Y)** at the right end of the permanent Active mode bar works globally — undoes the last change across any section.

If 12-20 pass alongside the original 1-11, ✅ ACCEPT ✅.

---

---

## Summary

Reorganise the Visual Theming tab from the current organic layout into five human-logical sections. This is UI reshuffling — moving existing HTML blocks + JS wiring. No new Worker endpoints, no D1 changes.

## The Five Sections (all Title Case)

### 1. Brand Identity
- **Banner text template** — NEW input with `{org}`, `{event}`, `{room}` placeholders. Default: `"{org}"`. Resolve from `currentOrg.name` / active event / room data. Persists as `theme.bannerText`.
- **ONE global font** — collapse existing separate banner font + celebration text font into ONE set of controls (font family / weight / italic / spacing / colour / shadow). Set here, all surfaces follow (banner, celebration text overlay, welcome message). Persists as `theme.globalFont`.
- **Logo** — MOVE upload from Org tab. Logo position setting (default: above-banner-centred; options: `above-banner` / `top-left` / `top-right` / `hidden`). Persists as `theme.logoPosition`. If no custom logo uploaded, default to **IRLid `logo.png` with drop-shadow contrast**. Logo renders on Settings preview + inline Check-in clone + fullscreen clone. Number One already shipped `renderLogoOnStage()` helper in v5.11.23a — extend it with position-awareness.
- **Description tagline** — MOVE from Org tab.
- **Sidebar logo** — should use the same source as the stage logo (uploaded or `logo.png` default). Currently at `Org.html:3256` (`#chromeLogo`).

### 2. Colour & Background
- Fold current Background + Pattern overlay + Image overlay expanders into ONE section with sub-headers.
- Light/dark mode dropdown at top.
- Background palette + cycle direction / bounce / duration.
- Pattern overlay toggle + style chips.
- Image overlay toggle + upload + position (9-cell grid) / tile / cover + symmetry + scale slider.

### 3. QR Appearance
- Extract QR foreground colour + motion from old "QR customization" expander (which confusingly bundled QR colour with celebration palette — separate them).
- Keep existing motion options for v5.12.0. Captain approved expanded motions (pixel dissolve, block dissolve, bounce, fade, flip X/Y, glitch, spiral + 9-position direction grid) as **v5.12.1** work — don't implement these in v5.12.0 unless time permits.

### 4. Check-in/out Experience
- **Mode picker** (Accept/Review/Deny) at top — Captain confirmed: "Accept/Review/Deny would be dependant on Active mode selection (think that was synergy?!?)". The mode picker handles which outcome you're editing; the section title covers the surface.
- **Outcome palette** — celebration-specific colours (separate from background palette).
- **Effect sequence builder** — relocate the whole block from the old "Accept behaviour" expander. Don't change internals.
- **Text template** + **9-position grid** for text position (upgrade from current 3-position top/centre/bottom — v5.12.1 if not enough time for v5.12.0).
- **Check-in sound** + **Check-out sound** — split into two separate rows. Each has `[Replace] [Reset] [▶ Play]`. Currently one sound per mode; Captain wants separate in/out sounds.

### 5. Post-Accept Flow
- Welcome message (with `{name}`, `{event}`, `{room}` placeholders).
- Redirect URLs (attendee + staff).
- Dwell time.
- Check-out grace period.
- **Smart Receptionist Mode** toggle — placeholder for v5.12+ (just the toggle + hint text, no Worker implementation). Captain loved this concept (:D :D :D).

## What Moves from Organisation Tab

| Item | From | To |
|---|---|---|
| Logo upload | Org tab | Brand Identity (Section 1) |
| Description tagline | Org tab | Brand Identity (Section 1) |

**What stays on Org tab:** Display name, Slug, Website URL, Contact email, Org terms/disclaimer, Brand polish & contact info expander.

## Persistence

Existing `theme._v511.*` keys stay. New keys:
- `theme.bannerText` (string, template with placeholders)
- `theme.globalFont` (object: `{ font, weight, italic, spacing, colour, shadow }`)
- `theme.logoPosition` (string: `'above-banner'` | `'top-left'` | `'top-right'` | `'hidden'`, default `'above-banner'`)
- `theme.checkoutSound` (data URL or null — separate from existing per-mode sound)

All round-trip via existing `POST /org/settings`.

## What NOT to Touch

- **Check-in tab clone rendering functions** (`renderInlineCheckinClone`, `renderRealVenueQrIntoInlineClone`, `renderLogoOnStage`, `testInlineCheckinAnimation`, `fullscreenQR()`) — these are Number One's territory. Add logo position awareness to `renderLogoOnStage` but don't restructure the clone pattern.
- **The v5.11.23 invite staff real flow** (just merged).
- **Worker endpoints or D1 schema.**
- **`showCheckinEventToast` suppression** (v5.11.19b).
- **The effect sequence builder internals** — just relocate the whole block.

## Captain's Design Feedback (verbatim, consolidated from today's session)

- *"Take out banner font and make it just font (set here once, all others follow this setting)"*
- *"Check-in/out Experience"* as Section 4 name (Captain's choice over "Celebrations", "Outcome Effects", "Arrival Effects")
- *"Post-Accept Flow"* stays as Section 5
- *"Like Colours and Background (capital B, replicate for all of Titles)"* — consistent Title Case
- *"all positions relevant stuff should be 9 button array"* — 9-cell position grid everywhere
- *"Outcome sound should have an option for different check out sound"* — separate Check-in / Check-out sound rows
- *"Smart receptionist mode :D :D :D"* — placeholder toggle in Post-Accept Flow
- *"if no logo is loaded, default to IRLid logo (with contrast)"* — drop-shadow on `logo.png` fallback
- *"Accept/Review/Deny would be dependant on Active mode selection (think that was synergy?!?)"* — mode picker in Section 4 handles this
- Logo position default: above banner text, centred. Configurable in Settings.

## Smoke Test

1. Open `https://irlid.co.uk/Org`, sign in, navigate Settings.
2. Visual Theming tab shows 5 sections (Brand Identity / Colour & Background / QR Appearance / Check-in/out Experience / Post-Accept Flow).
3. Brand Identity: banner text template input works with `{org}` resolving to org name. Global font picker applies to banner + celebration text. Logo renders above banner (default position).
4. Colour & Background: palette, pattern, image all in one section with sub-headers.
5. QR Appearance: QR colour + existing motion options.
6. Check-in/out Experience: mode picker, sequence builder, text template, check-in + check-out sound (two rows).
7. Post-Accept Flow: welcome message, redirects, dwell time.
8. Check-in tab: inline frame shows logo above banner + real org name.
9. Fullscreen: same logo + org name.
10. Org tab: slimmed — logo upload gone (moved to Brand Identity).
11. Save All Settings → hard refresh → all new settings persist.

Ship clean.

— Number One
