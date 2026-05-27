# HANDOVER — Mr. Data — `v5.12.0` — Visual Theming Panel Reorganisation

**Design reference:** `visual-theming-v512-mockup.html` in repo root — open locally in Chrome.
**Target:** `v5.12.0`. SW cache bump: monotonic from current.
**Branch:** `codex/v5.12.0-visual-theming-reorg`

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
