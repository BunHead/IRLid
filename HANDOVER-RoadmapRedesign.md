# HANDOVER — Roadmap page redesign (roadmap.html)

**Drafted by Number One, 11 June 2026 (planning watch, Opus).** For the fresh midday session
to build. Design agreed with Captain via two mockup rounds. Do NOT rush — this is a pitch/outreach
surface (Imbue demo + humanitarian funders), so polish matters.

## Why
Current `roadmap.html` (419 lines, near-black `#0c0d10`) tells a flat, linear v3→v7 story as six
equal stacked cards with cluttered per-layer score-weight bars. Problems: (1) buries the Org-portal
work, which is the bulk of recent shipping; (2) every layer looks equal so "how far we've come"
doesn't land; (3) near-black is oppressive for the humanitarian/funder audience we want to invite;
(4) text-heavy, no imagery; (5) 4-col timeline crushes on mobile.

## Structure — THREE branches from one core (Captain's call)
One v3 cryptographic core that visibly forks into three real-world domains:
- **Consumer** (person ↔ person) — accent purple. Nodes: v4 Trust score & device-unlock gate (Live);
  v5 Hardware-backed keys / stolen-phone proof (Live); v7 Zero-knowledge (Horizon).
- **Org portal** (venues & events) — accent teal/green. Nodes: v6.0 Receipt bridge (Live); v6.4
  Calendar · doorman · lead-admin co-presence · QR diet (Live); next-step node (Designed) — CONFIRM
  with Captain whether it's "multi-room / receptionist routing" or something else.
- **Humanitarian** (aid / proof-of-delivery) — accent cyan. **ALL nodes future** (honest — nothing
  shipped here yet): v6.5 Proof-of-delivery with ASE Tech/Wisdom (Designed); multi-party custody /
  aid hand-offs (Horizon); last-mile accountability for aid agencies (Horizon). The all-outline
  column is a FEATURE — it shows ambition + makes the WFP/Wisdom funding story visible at a glance.

## Imagery (all inline SVG — no external files, keep page fast & self-contained)
- **Top branching diagram:** v3 core node with three streams flowing down into the three columns.
  Live branches solid stroke; humanitarian stream DASHED (signals all-future).
- **Per-column domain icon:** Consumer = person-pair; Org = building/venue; **Humanitarian = open
  hand offering a parcel with a check/pin** (NOT a drone — Captain: not all aid uses drones; the
  icon must be vehicle-agnostic = "verified delivery"). Warmer alt if Captain prefers: cupped hands
  around a heart.
- **Status nodes** (coloured dots) instead of ad-hoc text badges.
- Defer fancy extras to a later pass: animated pulse down live branches, hero "trust delta"
  illustration, dragons flanking the core.

## Interaction — tap-to-expand nodes (accordion)
Default = clean one-line summary per node (scannable). Tap a node → expands to full feature list +
one plain-English "what this means" sentence. Accordion works identically on phone & desktop (no
hover dependency — Captain is phone-first). This replaces the old always-visible feature-pill wall.

## Palette — LIGHTEN for warmth (Captain: black is oppressive, page must invite)
This is an OUTREACH surface, not app chrome. **Recommended: light warm theme** — soft off-white /
parchment background, dark-slate text, the three branch colours as gentle tints (not glow-on-black).
Feels inviting/trustworthy for humanitarian orgs + funders. **Fallback if brand cohesion with the
dark app wins:** soft deep-navy (NOT near-black) with far more whitespace. Captain to make the final
light-vs-soft-dark call at build time.

## Status language (consistent, replaces ad-hoc badges)
Live (green solid) · Building (amber, gentle pulse) · Designed (blue outline) · Horizon (grey dashed).

## Also
- Drop the per-layer score-weight bars entirely; add a single "scoring detail → verify-visual.html" link.
- Mobile: 3 columns must stack to 1 cleanly (`grid-template-columns: repeat(auto-fit, minmax(...))`).
- Keep it a standalone page but align font/accents with the rest of the site.

## Open questions for Captain at build time
1. Light theme or soft-dark? (NumberOne recommends light for this audience.)
2. Org branch third node — "multi-room / receptionist routing" or another next-step?
3. Humanitarian icon — hand+parcel (honest) or hands+heart (warmer)?
