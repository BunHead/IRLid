# HANDOVER — Mr. Data — `v5.11.21` — Settings UI for celebration text template + banner font style toggle

**Owner:** Mr. Data
**Type:** Settings UI + theme persistence. **No D1 schema changes, no new endpoints.** Reuses existing `POST /org/settings` round-trip.
**Live file:** `D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\Org.html`
**Target build pill:** `v5.11.21`
**SW cache bump:** current is `irlid-shell-v60` (after Number One's `v5.11.20a` hotfix). Bump to `v61`. If `v60` isn't on origin yet, use `v61` anyway — cache bumps are monotonic.
**Parallel work:** Number One is in a holding pattern. Pull `origin/main` immediately before starting AND immediately before pushing.

---

## Context for you

Captain merged your v5.11.20 PR #55 clean — Role Vocab persistence, +Add event suffix, save badge sweep all working in production. Thank you for clean work. Two follow-ups for v5.11.21 came out of his post-merge smoke:

**1.** The celebration text overlay should read **"Spencer Austin — checked out"** on a checkout, not "checked in". (Number One shipped the inline runtime fix as `v5.11.20a` already; that's done.) But Captain ALSO wants the text TEMPLATE to be **editable from Settings**, so an org can customise it ("Welcome, Kerry!" or "{name} arrived" or "Bienvenue, {name}" or whatever shape they want).

**2.** The branded banner above the QR — currently reads "Test Event — Theme Demo" in the Settings preview, and currently shows the same in the live Check-in tab. Captain wants **Settings UI for the banner font style** — with an **on/off toggle** so orgs can opt in to custom font styling and leave it at the default if they don't care.

Both items extend the existing `theme._v511.celebration` / `theme._v511.banner` shapes — same Worker, same D1 column, same `POST /org/settings` round-trip.

---

## Item 1 — Editable celebration text template

### Current behaviour (post-v5.11.20a)

The text overlay rendering at `Org.html:~7625-7637` reads template + runtime name + runtime action and produces a string. Three template chips currently exist in the celebration sequence editor:

- `welcome` — uses the message verbatim ("Welcome back!")
- `name` — appends the runtime name ("Welcome, Kerry!")
- `name + action` — uses action-aware suffix ("Kerry — checked in" / "Kerry — checked out")

The Custom welcome message input (`#v511PaWelcome` in Settings → Visual Theming → Post-accept behaviour) feeds `welcome` and `name` templates. The `name + action` template is wholly hardcoded inside the JS.

### What Captain wants

A **template string field** in Settings that lets orgs write their own template with placeholder substitution:

- `{name}` → runtime attendee name (or empty string if anonymous mode)
- `{action}` → 'in' / 'out' (lowercase)
- `{Action}` → 'In' / 'Out' (title-case)
- `{verb}` → 'checked in' / 'checked out' (action-aware phrase)
- `{Verb}` → 'Checked in' / 'Checked out' (title-case)

Example template strings the org might write:

- `{name} — {verb}` (current default behaviour)
- `Welcome, {name}!` (warm greeting)
- `{name} arrived` (terse)
- `Goodbye, {name}` (rendered only on checkout — orgs can use `{verb}` to differentiate)
- `Bienvenue, {name}` (i18n)

### UI placement

Inside the **Celebration sequence editor's Text-effect settings panel** (the chip-based settings that appear when a sequence row's "text" effect is selected), add:

- A new **Template** chip-group OR a free-text input. Recommendation: free-text input labelled "Text template" with the placeholder hint shown beneath: *"Use {name}, {verb}, {action} as placeholders. Default: {name} — {verb}"*
- A small "Reset to default" button next to the input.
- Below the input: a live preview swatch showing what the template would render with `{name} = "Kerry"` and `{action} = "in"`.

The existing template chips (welcome / name / name + action) can stay as quick-pick presets that populate the free-text input with their canonical strings. Don't remove them; augment.

### Wire-up

1. In the celebration-text effect settings panel (look for the existing `s.template` reads at `Org.html:~7629-7635` to find the surrounding panel), add the new template input. Persist as `s.textTemplate` (string) on the sequence step.
2. In the runtime renderer at `Org.html:~7635`, IF `s.textTemplate` is non-empty, run substitution: `s.textTemplate.replace(/\{name\}/g, runtimeName).replace(/\{action\}/g, runtimeAction).replace(/\{Action\}/g, titleCase(runtimeAction)).replace(/\{verb\}/g, 'checked ' + runtimeAction).replace(/\{Verb\}/g, 'Checked ' + runtimeAction)`. Use this as `finalText` and skip the legacy chip branches.
3. Fall through to the existing chip-based behaviour if `s.textTemplate` is empty/missing (backward compatibility).
4. The template field persists into `theme._v511.celebration[mode][index].settings.textTemplate` via the existing save flow — no Worker change needed.
5. Flash `.v511-saved-pulse` on save via the existing celebration save hook.

### Smoke

1. Open Settings → Visual Theming → Allow mode → Celebration sequence → click a "text" effect row → see new Template field.
2. Edit to `Welcome, {name}! ({Verb})` → Save → hard refresh → field persists.
3. ▶ Sample button on Settings → preview shows "Welcome, Kerry! (Checked in)".
4. ▶ Test anim on Check-in tab → inline frame shows "Welcome, Spencer! (Checked in)".
5. Repeat for Deny mode if Captain wants different template for out (he may want `Goodbye, {name}` on checkout).

---

## Item 2 — Settings UI for banner font style with on/off toggle

### Current behaviour

The banner element is `.v511-theme-preview-banner` inside the stage. In the Settings preview the text reads "Test Event — Theme Demo" (hardcoded HTML). In the fullscreen clone it gets the real org name. In the inline Check-in clone it shows whatever the Settings preview HTML has (today: "Test Event — Theme Demo"). No font styling Settings exist for the banner today — it inherits the stage's default font.

### What Captain wants

A new Settings panel section (recommend: under **Visual Theming → Banner styling** as a new `<details>` expander, sibling to the existing Background / Pattern / Image / QR customization / Post-Accept Behaviour expanders) with:

- **Toggle:** "Customise banner font" — default OFF. When off, banner uses the default font (current behaviour). When on, the below controls become active.
- **Font family chip-group:** mirror the existing celebration text font choices (sans / serif / mono / display / bebas / oswald / pacifico / caveat / marker / playfair / lobster / inter / montserrat). CSS rules at `Org.html:~4544-4558` already exist for cel-text-overlay; you'll add parallel rules for the banner.
- **Font weight chip-group:** light / regular / bold / black (mirror cel-text-weight at `~4561-4564`).
- **Italic toggle:** on / off (mirror cel-text-italic at `~4567`).
- **Letter-spacing chip-group:** tight / normal / loose / wide (mirror cel-text-spacing at `~4570-4573`).
- **Colour chip-group:** white / warm / palette-1 / palette-2 / palette-3 (mirror cel-text-colour at `~4576-4580`).
- **Text-shadow chip-group:** off / soft / strong (mirror cel-text-shadow at `~4583+`).

### CSS pattern

Add new CSS rules using `data-banner-font="<value>"`, `data-banner-weight="<value>"`, etc. as attributes on the stage element (same pattern as cel-text-*). Selectors target `.v511-theme-preview-banner`. Example:

```css
:is(.v511-theme-preview-stage, .v511-runtime-stage)[data-banner-customise="on"][data-banner-font="serif"] .v511-theme-preview-banner {
  font-family: Georgia, "Times New Roman", "Iowan Old Style", serif;
}
:is(.v511-theme-preview-stage, .v511-runtime-stage)[data-banner-customise="on"][data-banner-font="display"] .v511-theme-preview-banner {
  font-family: "Impact", "Arial Black", "Helvetica Neue", sans-serif; font-stretch: condensed;
}
```

The `[data-banner-customise="on"]` gate ensures the rules ONLY apply when the toggle is on. When off, the banner uses the default font from the stage's base CSS.

### Wire-up

1. New `<details>` expander in the Visual Theming tab with the controls above.
2. Persist as `theme._v511.banner` (object: `{ customise: 'on'|'off', font: 'serif'|..., weight: 'bold'|..., italic: 'on'|'off', spacing: 'normal'|..., colour: 'white'|..., shadow: 'soft'|... }`).
3. On save, write to the stage's `data-banner-*` attributes — extends the existing `v511ApplyThemeToHostStages` (or equivalent) function. Apply to all stages: Settings preview, inline Check-in clone, fullscreen clone.
4. Save badge: `.v511-saved-pulse` via the canonical pattern.
5. Default OFF — orgs see no font change unless they explicitly opt in.

### Smoke

1. Open Settings → Visual Theming → Banner styling → toggle ON.
2. Pick font-family: Bebas Neue → live preview banner changes to Bebas Neue immediately.
3. Pick weight: Black, italic: On, spacing: Wide → preview updates live.
4. Save All Settings → green Saved flash.
5. Hard refresh → all banner styling persists.
6. Settings preview banner shows custom font; Check-in tab inline clone banner shows the SAME custom font (because applyV511BackgroundToHostStages applies data-banner-* to all stages, and the inline clone is a re-clone-on-mutation of the source).
7. Toggle OFF → banner reverts to default font. Save → persists.
8. Fullscreen the QR (⛶ Fullscreen) → banner in fullscreen clone also shows the custom font.

---

## What NOT to touch

- **Check-in tab clone area** (`#v511InlineCheckinStage`, `#venueQRWrap`, `#v511ThemePreviewStage`, `fullscreenQR()`, `renderInlineCheckinClone`, `setupInlineCheckinCloneObserver`, `testInlineCheckinAnimation`, `renderRealVenueQrIntoInlineClone`, the `.qr-info` block). Captain settled the layout at v5.11.19b. The MutationObserver on sampleStage will pick up your new `data-banner-*` attributes automatically — that's the right path.
- **Your v5.11.20 work** (Role Vocab persistence, +Add event suffix, save badge sweep). It works; Captain merged it.
- **The legacy v5.10.x Invite Staff path** (`inviteStaffBtn`, `openInviteStaffDialog`, `createStaffInvite`, `staffInvite*` namespace). Wired but not proven; Captain wants it left alone.
- **`showCheckinEventToast` suppression** (just landed at v5.11.19b — leave it).
- **Worker** (`irlid-api-org/`), D1, `scan.html`, `org-entry.html`, `org-login.html`. Both items use existing `POST /org/settings` round-trip — no Worker change needed.
- **`v5.11.20a` action-aware text fix** at `Org.html:~7635` / `~8424` — Number One landed this; the new template work BUILDS ON it (your `s.textTemplate` substitution uses `runtimeAction` which already comes from `stage._v511Action`).

---

## File touch list

- `Org.html` — single file (HTML for new banner styling expander + JS for celebration text template input + CSS for `data-banner-*` rules)
- `sw.js` line 15 — cache bump `v60 → v61` (or `v61 → v62` if v60 isn't on origin yet)
- Build pill bump `v5.11.20a → v5.11.21`

**Do NOT** touch: `irlid-api-org/`, any D1 file, `scan.html`, `org-entry.html`, `org-login.html`.

---

## A/R/D verdict expectations

Number One will run `git diff origin/main..origin/codex/v5.11.21-text-and-banner -- Org.html sw.js` before merge.

- **✅ ACCEPT ✅** — Diff bounded to the two items. Celebration text template input added to the existing text-effect settings panel; substitution uses `{name}`, `{action}`, `{Action}`, `{verb}`, `{Verb}` placeholders; falls through to existing chip behaviour if empty. Banner styling expander added with on/off toggle defaulting OFF; CSS rules gated on `[data-banner-customise="on"]`. Theme persisted via existing `POST /org/settings`. No Check-in clone touches. No Worker. No D1. Save badge uses `.v511-saved-pulse`.
- **⚠️ REVIEW ⚠️** — Template substitution opens a security gap (e.g. `{name}` rendered as HTML instead of textContent — needs to be textContent only); banner styling forced ON by default; CSS rules NOT gated on the `[data-banner-customise="on"]` toggle (so they fire even when toggle is off); new placeholder shape doesn't backward-compat (existing chip-based templates regress).
- **⛔ DENY ⛔** — Check-in clone area modified; Worker endpoint signature changed; D1 schema migration; new endpoint added; `v5.11.20a` action-aware fix reverted.

---

## Smoke test Captain will run

1. Open `https://irlid.co.uk/Org`, sign in, Settings → Visual Theming.
2. Find a celebration sequence with a text effect; click the row to expand settings.
3. New "Text template" input is visible with placeholder hint. Default value shows current template behaviour.
4. Edit to `Welcome, {name}! ({Verb})`. Click Save All Settings. Green pulse flashes.
5. ▶ Sample button → preview text reads "Welcome, Kerry! (Checked in)".
6. Hard refresh. Template field persists.
7. Find the new Banner styling `<details>` expander. Click to open.
8. Toggle "Customise banner font" ON. Pick Bebas Neue, weight Bold, italic Off, spacing Wide.
9. Settings preview banner changes immediately. Save All. Green pulse.
10. Navigate to Check-in tab. Inline frame banner shows the custom font.
11. Toggle Banner Customise OFF. Save All. Banner reverts to default font.
12. Hard refresh → all changes persist.

If all 12 pass, ✅ ACCEPT.

---

**Captain's words verbatim:** *"Noticed text said checked in, when I check out and will settings changing text, also change the 'Test Event - Theme Demo' font style (I'd like it to, with the option of toggling it on/off)."*

The "checked in on checkout" part is Number One's v5.11.20a (already shipped). Items 1 + 2 above are the Settings UI side of those asks.

Ship clean.

— Number One
