# HANDOVER — Mr. Data — `v6.1.30` — Brand Identity SAVE persistence (the last layer)

**Branch:** `codex/v6.1.30-brand-identity-save`
**Why:** Brand Identity is now fully usable (controls wired v6.1.21, frame un-disabled v6.1.25b,
QR fixed v6.1.25c). But **saving doesn't persist it and RESETS the choice on save**, and it
**doesn't carry to the Check-in screen** after reload.

## What's already CONFIRMED (don't re-investigate)
- **The Worker is fine.** `validateTheme` (irlid-api-org L2521) only validates the colour keys and
  returns null for unknown ones; `current.theme = body.theme` then keeps the whole object. So
  `theme._v512` persists IF it's actually sent. (Confirmed: the Worker has zero `_v512` references
  and does NOT strip it.)
- The collect helpers exist: `v511ReadBannerSettingsFromUI()` (Org.html ~L9450) reads the banner
  config; `v511WriteBannerSettingsToUI()` (~L9457) writes it back; `v511MetaFromModeStates()` (~L9501)
  and ~L9556 reference `_v512.banner`.

## DIAGNOSE FIRST — it's one of these two, pin which
1. **Save-all collect drops it.** Does the **"Save all settings"** path actually include
   `theme._v512` (with `.banner` = banner text + logo + description + font/weight/italic/spacing/
   colour/shadow) in the POSTed body? Trace the Save-all collect (`collectSettingsFromCanonical` /
   the savePortal/saveSettings path) — if it builds `theme` from only the canonical colour keys and
   omits `_v512`, that's the bug. (Note: there's BOTH a theme-only "Save theme" and "Save all
   settings" — the screenshot toast said "Visual theme saved" — check the path the user actually hit.)
2. **Readback re-hydrate resets it.** After the POST, the readback GET hydrates the UI. If it calls
   `v511WriteBannerSettingsToUI()` with a config that lacks the just-saved values (e.g. reads from a
   stale base, or `_v512.banner` is absent in the readback because of #1), the banner UI snaps back
   to defaults — exactly "save resets the choice".

## Fix
- Ensure the Save-all payload's `theme` carries `_v512.banner` (banner text, logo, description,
  logo position, font, weight, italic, spacing, colour, shadow) read live from the UI via
  `v511ReadBannerSettingsFromUI()` + the brand-grid inputs (`v512BannerText`, `v512LogoUrl`,
  `v512LogoPosition`, `v512OrgDescription`).
- Ensure the readback hydrate restores those values (don't overwrite with defaults).
- **Carry to Check-in:** once persisted, the Check-in surface already reads `theme._v512.banner`
  (dashboard preview) and the QR URL passes brand params (v6.1.21) — so persisting it fixes the
  "doesn't carry to check-in" symptom too. Verify the Check-in tab + org-entry render the saved
  font/styling after a hard refresh.
- **Do NOT** break other settings saves (theme colours, calendar_defaults, manager_perms) — the
  GET-overlay-POST-readback pattern must keep working for everything else.

## Diagnosis corrected (5 June) — the CORS "save failed" was a SEPARATE, now-fixed issue
Earlier today saves threw "Visual theme save failed" + offline/"SYNCING" pills. The console showed
the real cause: **CORS failures on all `/org/*` calls** ("No Access-Control-Allow-Origin header") —
the live Worker was stale/crashed and throwing before it could attach CORS headers. **A fresh
`wrangler deploy` (with PR #98) fixed it** — Worker now live, CORS clean, check-in working,
pill `v6.1.25d`. That was NOT the base64 logo (red herring — disregard any 413 theory).

**With CORS noise gone, the bug is cleanly isolated: FONT doesn't survive a save; LOGO does.**
So the save IS reaching the Worker now (logo persists), but the **font / banner styling is not in
the saved payload, or the readback resets it.** That's Parts A/B below — this is the whole job now.

## Part C — slim the check-in QR + brand the attendee page from the SERVER (nice-to-have, after A/B)
Captain's test confirms the symptom AND surfaced a second one: the check-in QR is now too dense
for old cameras (the 4a) because v6.1.21 crams the brand styling params into the QR URL
(`&brandBanner=…&brandFont=pacifico&brandWeight=…&brandColour=…` etc; v6.1.25c only removed the
base64 logo). The right fix kills both:
- **Remove ALL brand params from the check-in QR URL** (the `qp.set('brandBanner'…)` block at
  Org.html ~L13639-13647, plus the already-guarded logo). The QR then carries only
  `org / event_id / return / terms` → back to minimal + scannable.
- **`org-entry.html` fetches the org's branding from the SERVER** (by org slug, via the public-info
  endpoint — the same place it already pulls the logo) and renders the banner text/font/styling +
  logo from there. So the attendee still sees full branding, sourced from the *persisted* settings
  (Parts A/B) rather than a bloated URL.
- Net: QR minimal + scannable, attendee branding preserved, and it all flows from saved state.

## File touch list
| File | Change |
|---|---|
| `Org.html` | (A/B) include `theme._v512.banner` in the Save-all collect + fix readback hydrate; (C) remove the brand-param block from the check-in QR URL |
| `org-entry.html` | (C) fetch org branding from the server (public-info by slug) and render banner text/font/styling + logo from it (not URL params) |
| `irlid-api-org/src/index.js` | (C) ensure public-info returns the brand fields (banner text/styling) if not already |
| `sw.js` | cache bump |
| Build pill | → `v6.1.30` (next monotonic above current) |

## A/R/D expectations
- **✅ ACCEPT ✅** — Set banner text + a (hosted, short-URL) logo + font/colour → Save all → hard
  refresh → all persist; Check-in screen shows the saved banner styling; no other settings regress.
- **⚠️ REVIEW ⚠️** — Persists but readback still resets some fields; or only the styling chips
  persist (banner text/logo/description dropped).
- **⛔ DENY ⛔** — Breaks theme-colour / calendar_defaults / manager_perms saves; schema change.

## Smoke
1. Brand Identity: banner text "Imbue", font Pacifico, colour palette-1 → **Save all** → hard refresh → all still set
2. Check-in tab + scan venue QR on a phone → banner renders with the saved font/styling
3. Theme colours / calendar defaults / manager perms still save fine (no regression)

— Number One (5 June 2026)
