# HANDOVER — Text Overlay font picker as a named visual list (v6.3.13)

**Author:** Number One · **Date:** 8 Jun 2026 · **Target:** Mr. Data
**File:** `Org.html` only. Frontend-only. No Worker / D1.
**Verdict gate:** Number One bash-diffs against `origin/main` before merge. Captain eyeballs after deploy.
**Lead the PR description with the A/R/D verdict marker.**

Bump build pill `v6.3.13 → v6.3.14` and `sw.js CACHE_VERSION` `v132 → v133`. (Low priority / cosmetic — ship last. Renumbered up by the two masthead visual passes.)

---

## Goal
Make the **Text Overlay** celebration effect's "Font" picker render as the SAME named visual list as Brand Identity — each option shown as the font name *in that font* + a small category label (SERIF / SCRIPT / DISPLAY …) — instead of plain chips. The options are already identical (both use `V511_BRAND_FONT_OPTIONS`, the 13-font list); only the *rendering* differs.

## How Brand Identity does it (the component to mirror)
`enhanceFontPicker()` (≈L20885) takes the banner font chip group and:
- adds the `.v512-font-list` class (CSS ≈L5371: vertical scrollable named list),
- rewrites each `.v511-chip`'s innerHTML to:
  ```html
  <span class="v512-font-name" style="font-family:STACK">Display Name</span><span class="v512-font-meta">CATEGORY</span>
  ```
  using the `FONTS` map (key → [display name, category]) and `window.IRLID_BRAND_FONT_STACK(key)` for the live font stack.

It is hardcoded to `'.v511-chips[data-banner-setting="font"]'` AND it **re-wires the chip click handler** (banner-specific). For Text Overlay we want the **visual transform only** — NOT the click re-wire.

## Fix
The Text Overlay font control is the `'text'` celebration effect's `fontFamily` setting (schema ≈L10912: `{ key: 'fontFamily', label: 'Font', options: V511_BRAND_FONT_OPTIONS.slice(), default: 'sans' }`), rendered by the generic effect-settings renderer as a chip group.

Add a **visual-only** enhancer that runs after the effect settings for a `text` effect are rendered:
- Find the rendered `fontFamily` chip group (by its setting key / `data-*` attribute the effect-settings renderer assigns — locate where effect-setting `options` become `.v511-chip`s).
- Add `.v512-font-list` to that group and rewrite each chip's innerHTML to the `v512-font-name` + `v512-font-meta` spans, exactly like `enhanceFontPicker` (reuse the same `FONTS` map + `IRLID_BRAND_FONT_STACK`).
- **CRITICAL:** do NOT replace or remove the chips' existing click handlers / `data-*` values — the effect-settings renderer already wires selection to `item.settings.fontFamily`. Only change the inner markup + add the class. Selecting a font must still update the setting and the live Sample exactly as today.
- Idempotency guard like Brand ID's (`if (group.dataset.v512Fonts) return; … group.dataset.v512Fonts = '1';`) so re-renders don't double-apply.

Refactor suggestion (optional): extract the innerHTML-rewrite loop from `enhanceFontPicker` into a shared `paintFontListVisuals(group)` helper and call it from both places — keeps one source of truth for the font-card markup.

## Acceptance
- The Text Overlay "Font" picker shows the 13 fonts as a named list, each in its own typeface + category label — visually matching Brand Identity.
- Selecting a font still updates the Text Overlay font and the live Sample (no regression in the effect-settings wiring).
- Brand Identity's own font list is unchanged.
- No JS errors; idempotent across re-renders.

## Scope guards
- `Org.html` only. No Worker / D1.
- Visual-only for Text Overlay — do not alter the effect-settings selection logic.
- Bump pill v6.3.12→v6.3.13 + sw.js v131→v132.
