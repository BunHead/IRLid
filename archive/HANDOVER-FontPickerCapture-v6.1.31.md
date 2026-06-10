# HANDOVER — Mr. Data — `v6.1.31` — Font picker selection isn't captured (diagnose WITH console)

**Branch:** `codex/v6.1.31-font-picker-capture`
**Why:** Brand Identity FONT still doesn't survive a save after v6.1.30. v6.1.30 correctly carried
`globalFont` through the payload + readback — but the font **never gets into the captured UI state in
the first place**, so the payload carries the *default*. This is the real root, upstream of v6.1.30.

## Number One's trace (5 June) — two concrete suspects, confirm both
1. **The picker click doesn't press the chip the save reads.**
   - `v511ReadBannerSettingsFromUI()` (Org.html **L9448-9453**) reads font from the chip with
     `aria-pressed="true"` inside `.v511-chips[data-banner-setting="font"]` (L9451, via
     `v511PressedDataset`).
   - `enhanceFontPicker()` (**L20649-20665**) turns those chips into the scrollable font list, and its
     per-chip click handler (**L20658-20663**) **only** does `stage.setAttribute('data-banner-customise','on')`
     — it does **NOT** set `aria-pressed="true"` on the clicked chip (or clear the others).
   - **Check:** is there a *generic* `.v511-chip` click handler that toggles `aria-pressed` within a
     group, and does it actually fire for these enhanced font chips? If NOT, the font chip's
     `aria-pressed` stays on the default ('sans') no matter what you click → `v511ReadBannerSettingsFromUI`
     returns 'sans' → save persists 'sans'. (The live preview may show the picked font via a *different*
     path, masking this — so the preview lies about what the save sees.)
   - **Fix:** make the font-list click set `aria-pressed="true"` on the clicked chip and `"false"` on
     its siblings (mirror how the italic/shadow chip groups at L7031/L7034 behave), so the save reads
     the real selection.

2. **Two drifted copies of the banner helpers — save vs restore may diverge.**
   - `normaliseV511BannerConfig` / banner-read logic exists **twice**: ≈**L9424** (init-scope) and
     ≈**L18977** (top-level runtime). Confirm which copy the Save-all collect uses vs which the
     readback/hydrate (`v512WriteBrandIdentityToUI`) uses. If they differ, reconcile to one source of
     truth (load `js/sign.js`-style: one canonical helper, drop the duplicate) so capture and restore
     agree.

3. **Hydrate ordering.** `v512WriteBrandIdentityToUI` must run **after** `enhanceFontPicker` has
   rebuilt the chips, otherwise the restored `aria-pressed` gets clobbered when the picker is
   (re)enhanced on load. Confirm the order; if wrong, re-apply the font selection after enhancement.

## How to verify (DO open the console — the last 3 fixes failed for lack of this)
Add temporary `console.log`s: on font click, log the chip `aria-pressed` state + what
`v511ReadBannerSettingsFromUI().font` returns; on Save, log the `globalFont` actually in the payload;
on load, log `theme._v512.globalFont.font` from the GET. Pacifico must appear at **all three** points.
Strip the logs before the PR.

## File touch list
| File | Change |
|---|---|
| `Org.html` | font-list click sets chip `aria-pressed` (capture fix); reconcile duplicate banner helpers; fix hydrate ordering |
| Build pill | monotonic above v6.1.30 |
| `sw.js` | cache bump |

## A/R/D expectations
- **✅ ACCEPT ✅** — Pick Pacifico → Save all → hard refresh → font is still Pacifico in the picker,
  the preview, AND the live Check-in banner. Console shows Pacifico at click / save-payload / load.
- **⚠️ REVIEW ⚠️** — Persists in the picker but not on Check-in (apply path), or only some fonts work.
- **⛔ DENY ⛔** — Still reverts; or the fix breaks the italic/weight/colour/shadow chips.

## Smoke (Captain)
Visual Theming → font Pacifico → Save all → hard refresh → Pacifico survives + shows on Check-in.

---

## UPDATE 6 June — v6.1.31 shipped (PR #101, pill v6.2.2) but font STILL doesn't show. Refined diagnosis:
v6.1.31's aria-pressed fix landed and **persistence is now fixed** — the live console trace proved it:
`[font save] payload.theme.globalFont: {font:'pacifico'}` and `[font load] theme._v512.globalFont.font: pacifico`.
The DATA round-trips. BUT two traces show the problem only *moved*:
- `[font click] chip aria-pressed / read font: true **null**` — a fresh click sets aria-pressed but the
  read that the handler logs comes back **null** (capture path reads a different/empty source).
- On screen the banner renders **sans**, not pacifico — the loaded value is **not applied** to the display.
**Root (confirmed):** there is ONE font chip group (Org.html L7029) but the font is wired through
**drifted duplicate scopes** — init-scope helpers (`v511PressedDataset`/`v511ReadBannerSettingsFromUI`
~L9417-9448), a top-level set (~L18977+), and `enhanceFontPicker` (~L20664). The visible picker, the
click-capture read, the save read, and the hydrate-apply are not all the SAME function targeting the
SAME element. So saved≠shown.
**Surgical fix for next watch (do NOT guess — trace all FOUR points):** consolidate to ONE read + ONE
write + ONE apply for the banner font, all scoped to the single L7029 group; ensure the load-hydrate
(`v512WriteBrandIdentityToUI`→`v511WriteBannerSettingsToUI`) BOTH presses the saved font's chip AND
sets `data-banner-font` on the stage, AFTER `enhanceFontPicker` has run. Add a 4th trace line
"applied font to stage" on load; pacifico must appear at click / save / load / **applied**.
**Priority:** COSMETIC, not Imbue-blocking — the check-in/out core is unaffected. Parked 6 Jun (hard
day); pick up fresh. Persistence win from v6.1.31 stays.

— Number One (5 June 2026) — supersedes the font half of v6.1.30
