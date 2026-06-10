# WCAG 2.2 AA Accessibility Audit — IRLid

**Target:** WCAG 2.2 Level AA, whole site.
**Author:** Number One. **Started:** 10 June 2026.
**Status:** Phase 1 in progress. This is a phased programme, not a one-shot — see honesty note at the end.

## Method

Static structural audit across all 24 live HTML pages (`Glob *.html`, excluding `archive/` and
`*-mockup.html`) plus a runtime DOM probe on the live `Org` portal. Machine-detectable failures only.
Contrast, focus order, keyboard traps, reflow, and screen-reader behaviour need manual/assistive-tech
testing and are listed separately — they cannot be self-certified by code inspection.

## Baseline (what's already good)

Every page has `<html lang>` and a non-empty `<title>`. Consumer pages use a real `<nav class="site-nav">`
with anchor links and a `<main>` landmark. No positive `tabindex`, no empty buttons/links. Good foundation.

## Findings — mapped to WCAG 2.2 AA success criteria

| # | Issue | Pages | SC | Severity | Phase |
|---|-------|-------|----|----------|-------|
| 1 | Viewport blocks zoom (`maximum-scale=1, user-scalable=no`) | org-entry.html | 1.4.4 Resize Text (AA), 1.4.10 Reflow (AA) | High | 1 |
| 2 | No "skip to main content" link | all | 2.4.1 Bypass Blocks (A) | High | 1 |
| 3 | No global visible focus indicator; `outline:none` used (13× in Org) | most; Org | 2.4.7 Focus Visible (AA) | High | 1 |
| 4 | Missing `<h1>` / page heading | ~13 pages (index, scan, receipt, contact, account, forums, login, org-login, settings, v5-test, widget, demo-login, accept) | 2.4.6 Headings (AA), 1.3.1 (A) | Medium | 2 |
| 5 | Org portal has no `<main>` landmark | Org.html | 1.3.1 Info & Relationships (A) | Medium | 1 (Org) |
| 6 | Sidebar nav uses `<div onclick>` — not keyboard-operable | Org.html | 2.1.1 Keyboard (A), 4.1.2 Name/Role/Value (A) | High | 1 (Org) |
| 7 | Form controls without programmatic labels (~69 runtime) | Org.html; few on login/check/settings | 1.3.1 (A), 3.3.2 Labels (A), 4.1.2 (A) | Medium | 2 |
| 8 | Dynamically-created `<img>` without `alt` (~6 runtime) | Org.html | 1.1.1 Non-text Content (A) | Medium | 2 |
| 9 | Colour contrast of text/UI on themed/gradient backgrounds | site-wide | 1.4.3 Contrast (AA), 1.4.11 Non-text Contrast (AA) | Unknown — needs measurement | 3 |
| 10 | Target size of small controls (swatch ✕, chip buttons) | Org.html | 2.5.8 Target Size Minimum (AA, **new in 2.2**) | Unknown — needs measurement | 3 |

## Phase plan

**Phase 1 — central, low-risk, high-leverage (this watch).**
Unblock zoom on org-entry; add `.skip-link`, a global `:focus-visible` ring, and `.sr-only` to the shared
`css/style.css` (covers all 13 consumer pages at once); inject the skip link via shared `js/nav.js`; add a
`<main>` landmark + keyboard-operable nav to the Org portal.

**Phase 2 — per-page content (next watch).**
Add an `<h1>` to every page that lacks one (visible where it fits the design, `.sr-only` where it would
disturb layout). Sweep the Org portal's unlabelled controls (`aria-label` on sliders/colour swatches/chip
groups). Add `alt` to the dynamically-created images.

**Phase 3 — measurement + manual/AT testing (cannot be skipped).**
Colour-contrast audit of every text/background pair (especially the themed gradient banners and celebration
palettes — these are user-configurable, so we likely need a contrast *guard* that warns the admin, not just
a one-time fix). Target-size check. Keyboard-only walkthrough of every flow (focus order, no traps, visible
focus throughout). Screen-reader pass (NVDA/VoiceOver) on the core journeys: scan → receipt, and the Org
check-in/door flow. Reflow at 320px / 400% zoom.

## Honesty note

"WCAG compliant" cannot be truthfully claimed from code edits alone. Phases 1–2 close the
machine-detectable failures; Phase 3's contrast + keyboard + screen-reader testing is what actually earns
the AA claim. A user-configurable theming system (IRLid's) is the hardest part — an admin can pick a
low-contrast palette, so true conformance needs a **runtime contrast guard**, not just fixed colours. That
design decision is flagged for the Captain.
