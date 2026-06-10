# HANDOVER — Org masthead brand background + Save button to corner (v6.3.11)

**Author:** Number One · **Date:** 8 Jun 2026 · **Target:** Mr. Data
**File:** `Org.html` only. Frontend-only (CSS, maybe one `applyThemeVars` line). No Worker / D1.
**Verdict gate:** Number One bash-diffs against `origin/main` before merge. Captain eyeballs after deploy.
**Lead the PR description with the A/R/D verdict marker.**

Bump build pill `v6.3.10 → v6.3.11` and `sw.js CACHE_VERSION` `v129 → v130`.

Two small visual changes. No logic/save change.

---

## Fix 1 — Org masthead frame uses the BRAND background colours (not the hardcoded blue)

The Organisation-tab masthead card (`.v511-masthead`, CSS ≈L4431) has a hardcoded blue-tint gradient:
```css
background: linear-gradient(135deg, rgba(105,168,255,0.08) 0%, rgba(105,168,255,0.02) 100%);
```
Captain wants it to pick up the org's **Brand ID background palette** (the orange/yellow theme), so the masthead feels branded.

**Context:** the brand background palette comes from `theme.bgPalette` and is applied in `applyThemeVars()` (~L19650). The theme-preview gradients use `--bg-pal-1..7`. **First confirm whether `--bg-pal-1..7` are set at a root/document scope the masthead can inherit** (the preview stage may set them locally). Root-available alternatives already set in `applyThemeVars`: `--theme-page-bg-1..7` (`root.style.setProperty('--theme-page-bg-'+(i+1), …)`, ~L19654) — these are bgPalette mixed toward the page base, ideal for a subtle frame tint.

**Do:** change `.v511-masthead` background to a gradient built from the brand bg palette, with a graceful fallback to the current subtle tint. Preferred (uses already-root-scoped vars):
```css
background: linear-gradient(135deg,
  var(--theme-page-bg-1, rgba(105,168,255,0.08)) 0%,
  var(--theme-page-bg-3, rgba(105,168,255,0.02)) 100%);
```
If you instead expose the raw palette: add `root.style.setProperty('--bg-pal-'+(i+1), bgPal[i])` for i in 0..6 inside `applyThemeVars` (so `--bg-pal-1..7` are root-available), then use `var(--bg-pal-1)`/`var(--bg-pal-2)` in the masthead. Either is fine — pick the one that renders the brand colours cleanly without hurting text contrast (the masthead name/slug must stay legible — keep the existing light/dark `--text` rules at L4286-4288).

**Acceptance:** with the current orange/yellow brand theme, the masthead frame shows a warm brand-tinted gradient (not blue); masthead name + slug stay legible in both light and dark mode; on a default/no-theme org it falls back to a sensible neutral.

---

## Fix 2 — Move the Org-tab "Save all settings" button to the bottom-right CORNER of its panel frame

`.v511-save` (CSS L3764) is already `justify-content: flex-end` but it's a **shared class used by every tab's save row** — so DO NOT change `.v511-save` globally. Scope this to the Organisation panel only.

**Do:** pin the Org tab's save block to the bottom-right corner of the Organisation panel frame. Suggested:
```css
.v511-panel[data-v511-panel="org"] { position: relative; padding-bottom: 64px; }
.v511-panel[data-v511-panel="org"] .v511-save {
  position: absolute; right: 18px; bottom: 18px; margin-top: 0; padding-top: 0; border-top: 0;
}
```
(The `padding-bottom` reserves space so the absolutely-positioned button never overlaps the Contact-email row / expander.) Adjust the inset to taste so it sits neatly in the corner.

**Acceptance:** on the Organisation tab the "Save all settings" button sits in the bottom-right corner of the panel frame; it doesn't overlap the form fields or the Brand-polish expander; **other tabs' save buttons are unchanged** (still the in-flow right-aligned row).

---

## Scope guards
- `Org.html` only. No Worker / D1.
- Fix 2 must be Org-panel-scoped — do NOT alter the shared `.v511-save` for other tabs.
- Keep masthead text legible (light + dark).
- Bump pill v6.3.10→v6.3.11 + sw.js v129→v130.

## Queue note
This slots in as v6.3.11 (Captain wants it now). The previously-written settings-nav-refresh brief becomes **v6.3.12**, Text Overlay font list **v6.3.13**.
