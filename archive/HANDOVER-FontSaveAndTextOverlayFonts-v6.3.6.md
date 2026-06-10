# HANDOVER — Brand-font save fix + Text Overlay font parity (v6.3.6)

**Author:** Number One · **Date:** 8 Jun 2026 · **Target:** Mr. Data
**Files:** `Org.html` only. No Worker, no D1, no schema. Frontend-only.
**Verdict gate:** Number One will bash-diff against `origin/main` before merge (ancestor check, monotonic pill, no risky deletions). Captain hardware-smokes after deploy.

---

## Why this brief exists

Captain picks a brand font in Settings → Visual Theming → Brand Identity ("Font" list), the live preview updates correctly, but on **Save** the font reverts and the inline Check-in preview snaps back to the previously-saved font. Diagnosed live on production (Build v6.3.5) by Number One. Two stacked defects, both in `Org.html`.

---

## Defect 1 — picked font not persisted on save

### Evidence (live console, v6.3.5)
- Font-chip click handler logs: `[v6.2.2 font click] chip aria-pressed / read font: true null` — the chip registers as pressed, but the banner-settings **read returns `null` for `.font`.**
- The **global** "Save all settings" path (`saveSettings()`) does **not** carry the theme in its POST and then re-applies the readback theme, visibly reverting the font.
- The **per-tab** Visual Theming save (`v511VisualSaveBtn` → `v511SaveVisualTheme`) DOES carry the theme and persisted correctly in isolated testing — so the regression is specific to the read-null path and the global save.

### Root cause (two parts)

**(1a) Duplicate / drifted banner-read logic across scopes.**
There are TWO copies of the v511 banner helpers:
- Closure copy inside the Visual-panel IIFE: `V511_BANNER_DEFAULTS` (~L9426), `normaliseV511BannerConfig` (~L9436), `v511ReadBannerSettingsFromUI` (~L9449), `v511PressedDataset` (~L9445).
- Global copy: `V511_BANNER_DEFAULTS` (~L19146), `normaliseV511BannerConfig` (~L19164), and the global helpers the **font-chip click handler at ~L20851** calls.

The font-chip click handler (~L20851) calls the **global** `v511ReadBannerSettingsFromUI()` and gets `cfg.font === null`. The closure copy reads the chip correctly. They have drifted — the global read does not resolve the pressed `[data-banner-setting="font"] .v511-chip[aria-pressed="true"]` `data-banner-value` the way the closure read does.

**(1b) Global "Save all settings" (`saveSettings()`, ~L13961) omits the theme.**
`domPayload` (L13967-13985) contains score/bio/logo/terms/roles/calendar — **no theme/font.** It then GET-overlays the *last-saved* settings (L14010-14012), so the POSTed font is always the DB's old value. After POST it re-applies the readback theme (L14097-L14100 `activeTheme = normalizeThemeForSave(r.theme); … applyThemeVars(activeTheme)`), which visibly reverts the live pick. `saveSettings()` cannot reach the closure-scoped `v511BuildThemePayload` (different closure).

### Fix (do all three)

1. **Single source of truth for the banner/font read.** Make the global font-chip click handler (~L20851) and any global banner read resolve the pressed chip identically to the working closure `v511ReadBannerSettingsFromUI` (read `data-banner-value` of `.v511-chips[data-banner-setting="font"] .v511-chip[aria-pressed="true"]`, fall back to `'sans'` — **never `null`**). Simplest: delete the drifted global copy and expose/point everything at one canonical implementation. **Acceptance: `[v6.2.2 font click]` logs the picked font value, never `null`.**

2. **Make the global `saveSettings()` carry the live theme.** Expose the closure theme builder to global scope (e.g. `window.v511BuildThemePayload = v511BuildThemePayload;` inside the Visual IIFE), then in `saveSettings()` before the POST add the current theme to `payload`:
   ```js
   // v6.3.6 — carry live Visual Theming theme so the global save persists font/theme edits
   if (typeof window.v511BuildThemePayload === 'function') {
     try { payload.theme = window.v511BuildThemePayload((currentSettings && currentSettings.theme) || activeTheme || {}); }
     catch (e) { console.warn('[settings save] theme build failed; preserving existing theme', e); }
   }
   ```
   Because the POST now includes the picked theme, the readback echo (L14097) is the *correct* theme, so the L14100 re-apply no longer reverts.

3. **Do not navigate away on save.** `saveSettings()` must leave the user on the current settings panel — do NOT switch to `panel-checkin`. Captain's "jumps to Check-in" symptom. (If a `loadDashboardForOrg`/`showPanel('checkin')` is being triggered by the save button's own listener, drop it; re-render in place.)

> Captain's lighter-touch alternative if (2) proves fiddly: **remove/hide the redundant global "Save all settings" button** and rely on the per-tab Visual save (which works). Number One's recommendation is the proper fix above, but flagging Captain's stated preference.

---

## Defect 2 / Feature — Text Overlay font picker parity with Brand Identity

Captain: *"can we have the same number of fonts on 'Text Overlay' as we do on 'Brand ID'."*

- The Text Overlay font **rendering already supports all 13 fonts** via `data-cel-text-font` CSS at Org.html **L4620-L4634** (sans, serif, mono, display, bebas, oswald, pacifico, caveat, marker, playfair, lobster, inter, montserrat).
- Only the Text Overlay **picker UI** is short. Add the missing font chips so the Text Overlay font picker offers the **same 13 options** as Brand Identity's `[data-banner-setting="font"]` chip list, wired to the existing `data-cel-text-font` attribute. No CSS changes needed — the styles already exist.

**Acceptance:** Text Overlay font picker shows all 13 fonts; selecting each visibly changes the overlay font in the Sample/preview; the selection round-trips through save (same theme payload the celebration text already uses).

---

## Scope guards
- `Org.html` only. No Worker / D1 / migration.
- Do not touch the doorman flow, attendance, or the v5 envelope paths.
- Bump build pill + `sw.js CACHE_VERSION` (v124 → next).
- Lead with the A/R/D verdict marker in the PR description.
