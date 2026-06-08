# HANDOVER — Org masthead = full brand gradient (no dragons) + legible text (v6.3.12)

**Author:** Number One · **Date:** 8 Jun 2026 · **Target:** Mr. Data
**File:** `Org.html` only. Frontend-only (CSS). No Worker / D1.
**Verdict gate:** Number One bash-diffs against `origin/main` before merge. Captain eyeballs after deploy.
**Lead the PR description with the A/R/D verdict marker.**

Bump build pill `v6.3.11 → v6.3.12` and `sw.js CACHE_VERSION` `v130 → v131`.

## Why
v6.3.11 gave the Org masthead only a *faint 8% tint* of the brand colour. Captain wants it to MATCH the Visual Theming "Test Event" preview frame, which shows the **full vivid orange→yellow brand gradient**. Decision: **gradient only — do NOT add the dragon background image** (cleaner for a settings header). The masthead should read as the same brand colours as the preview.

## Fix

### 1. Masthead background = the full brand gradient
Replace the current `.v511-masthead` background (the v6.3.11 `color-mix(... 8% …)` faint tint, CSS ≈L4431) with the **same `--bg-pal` gradient the preview stage uses** (`.v511-theme-preview-stage`, ≈L4475-4480), at FULL opacity — but only the gradient, no `::before` image / pattern layers:
```css
.v511-masthead {
  /* …keep display/grid/padding/border-radius… */
  background: linear-gradient(135deg,
    var(--bg-pal-1, #69a8ff) 0%,
    var(--bg-pal-2, var(--bg-pal-1, #69a8ff)) 25%,
    var(--bg-pal-3, var(--bg-pal-2, var(--bg-pal-1, #69a8ff))) 50%,
    var(--bg-pal-4, var(--bg-pal-3, var(--bg-pal-2, var(--bg-pal-1, #69a8ff)))) 75%,
    var(--bg-pal-5, var(--bg-pal-4, var(--bg-pal-3, var(--bg-pal-2, var(--bg-pal-1, #69a8ff))))) 100%);
  border: 1px solid color-mix(in srgb, var(--bg-pal-1, #69a8ff) 40%, transparent);
}
```
(Use the same stop chain as the preview so the colours line up. `--bg-pal-1..7` are root-available since v6.3.11.)

### 2. Make masthead text legible on the vivid gradient
The bg is now bright in BOTH light and dark mode, so text must be **white with a shadow** in both (like the preview banner at L4427). Update:
- `.v511-masthead-name` → `color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,0.45);`
- the existing light-mode override `:root[data-theme="light"] .v511-masthead-name { color: var(--text); }` (≈L4286) → change to `color: #fff;` (white in light mode too, since the bg is vivid regardless).
- `.v511-masthead-slug` pill: ensure it stays readable on the gradient — e.g. `background: rgba(0,0,0,0.28); color: #fff;` (and the light-mode override likewise). Keep it a small contrasting pill.

### 3. Do NOT add the dragon background image
Gradient only. Leave `bg-mode-image` / `.bg-image-mirror` / pattern layers OUT of the masthead.

## Acceptance
- The Org masthead "Test Event" frame shows the **same vivid orange→yellow brand gradient** as the Visual Theming preview (colours match), **without** the dragons.
- Masthead name + slug are clearly legible (white text + shadow) on the bright gradient, in both light and dark mode.
- The masthead logo (Imbue) still shows correctly (v6.3.9 un-inverted).
- On a default/no-theme org, `--bg-pal` fallbacks give a sensible neutral gradient (not broken).
- No regression to the Visual Theming preview, check-in stage, or attendee page.

## Scope guards
- `Org.html` only, CSS only. No Worker / D1 / JS.
- Do NOT touch the `.v511-theme-preview-stage` / `.v511-runtime-stage` rules (those drive the preview + check-in — leave them).
- Bump pill v6.3.11→v6.3.12 + sw.js v130→v131.

## Queue renumber (housekeeping)
This visual fix takes v6.3.12. The settings-nav-refresh fix becomes **v6.3.13**, Text Overlay font list **v6.3.14**.
