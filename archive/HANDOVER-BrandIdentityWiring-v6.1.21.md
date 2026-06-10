# HANDOVER — Mr. Data — `v6.1.21` — Make Brand Identity usable (wire + apply)

**Branch:** `codex/v6.1.21-brand-identity-wiring`
**Why:** Captain reports the **Brand Identity** section (Visual Theming → 1. Brand Identity:
banner text, logo upload, tagline, font, weight, italic, spacing, colour, shadow) is "still
unusable." It's the v5.12 design-in layer.

## What's ALREADY working (don't re-do — confirmed by Number One)
- `theme._v512.bannerText` / `logoPosition` / tagline-style text fields ARE collected into the
  Save-all payload (Org.html ~L9495-9520) and persisted (nested under `theme`, which the Worker
  already saves) and hydrated on load (~L9625-9637). So the *text* fields round-trip.

## DIAGNOSE FIRST — find what's actually dead (don't guess)
Audit each Brand Identity control on the live page: edit it → Save all → hard refresh → does it
**persist**, and does it **apply** (render on the Check-in surface)? Bucket each into
persist-OK/apply-OK vs broken. The likely-dead ones (verify):
1. **Logo upload** — the "Upload logo" button. Does it actually set the org's `logoUrl` (an
   existing org setting) and display? This is the most probable "unusable" complaint — a usable
   logo is the headline. If the button is a placeholder (no upload → no persist → no render),
   that's the priority fix.
2. **Font / weight / italic / spacing / colour / shadow** — do these persist into `theme._v512`
   AND get *applied* to the banner-text rendering on the Check-in screen? They may save but never
   render (design-in), which reads as "unusable."

## Build (only the dead parts the audit finds)
- **Logo:** wire "Upload logo" → set the org `logoUrl` (reuse the existing logoUrl setting +
  Save-all path; if there's no image-host, accept a URL paste as the minimum viable, and flag
  that a real upload host is a follow-up). Render the logo on the Check-in surface + in Settings
  preview. Default to the IRLid mark if none.
- **Font/styling:** ensure the `theme._v512` font fields both persist (add to the Worker's
  validated settings allowlist if the nested `_v512` shape isn't validated) AND apply — i.e. the
  banner text on the Check-in screen actually renders in the chosen font/weight/italic/spacing/
  colour/shadow. CSS-variable-driven, same pattern as the existing theme palette application.
- Keep everything **optional, default-sensible, off/blank by default** (IRLid principle).

## Out of scope
- The anchor system (parked — see `HANDOVER-VisualThemingReorg-v5.12.0.md`).
- A full image-upload host if none exists — URL-paste is acceptable MVP; flag the host as a
  follow-up.
- Schema changes — `logoUrl` + `settings_json.theme` already exist.

## File touch list
| File | Change |
|---|---|
| `Org.html` | Wire the dead Brand-Identity controls (logo upload/paste + font/styling apply); render on Check-in surface |
| `irlid-api-org/src/index.js` | Validate the `theme._v512` font/brand fields if not already (no clobber) |
| `sw.js` | cache bump |
| Build pill | → `v6.1.21` |

## A/R/D expectations
- **✅ ACCEPT ✅** — Set a logo + banner font/colour → Save all → hard refresh persists → renders
  on the Check-in screen; second device shows the same; no other theme settings clobbered.
- **⚠️ REVIEW ⚠️** — Persists but doesn't apply (or vice-versa); logo only works in preview not on
  the live Check-in surface; clobbers existing theme.
- **⛔ DENY ⛔** — Schema change; breaks existing theme/palette save; touches the parked anchor.

## Smoke
1. Brand Identity → set/paste a logo + pick a banner font + colour → Save all → ✓
2. Hard refresh → persists; Check-in screen shows the logo + styled banner text
3. Second device (same org) → same branding
4. Existing theme palette / celebration still save fine

— Number One (4 June 2026)
