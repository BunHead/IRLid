# HANDOVER — Role visibility flip + GDPR initials + CSV sort/filter (`v5.9.0.13.33` candidate)

**Repo:** IRLid-repo (LIVE — irlid.co.uk)
**Files:** `OrgCheckin.html`
**Scope:** Single PR. Three tightly-related changes around "what does each viewer see":

1. Flip the "Viewing as" role-visibility logic (Attendee currently shows roles, Staff doesn't — wrong way round).
2. When Viewing as Attendee, render names as INITIALS only (GDPR — attendees shouldn't see each other's full names).
3. CSV export: alphabetical by surname + a role-filter dropdown (export all / attendees only / staff+manager+lead admin only).

## Change 1 — Viewing-as role visibility flip

Current behaviour: Viewing as **Attendee** → role pills/labels show in attendance table. Viewing as **Staff** → roles hidden. **Backwards.**

Correct behaviour: Staff need to know who's who at the door. Attendees don't need to know who's staff (privacy). Flip the logic.

In `OrgCheckin.html`, find the role-pill/role-column visibility check. Likely an `if (viewingAs === 'attendee')` or similar gate around the role column render. Invert: roles visible when `viewingAs in ['staff', 'manager', 'lead_admin', 'developer']`, hidden when `viewingAs === 'attendee'`.

## Change 2 — GDPR initials for Attendee view

When `viewingAs === 'attendee'`, render every name in the attendance table and any escalation/expected-list UI as INITIALS ONLY (e.g. "Spencer Austin" → "SA", "Kerry Austin" → "KA", "Poppy Austin" → "PA").

Single-name attendees: just the first letter ("Anonymous" → "A").

Implementation: a helper `nameForViewer(fullName, viewingAs)` that returns the full name for staff/manager/lead_admin/developer views, and initials only for attendee view. Use this wherever names render — attendance table, role pills (tooltip becomes initials too), escalation modal, expected list display, audit board mode.

Don't change the underlying stored data — this is a RENDER-time transform only. CSV export honours the actual viewer's role (see Change 3).

## Change 3 — CSV sort + filter

The CSV download currently exports all attendance rows in arrival order. Two enhancements:

**Sort by surname:** parse "First Last" → sort by `Last`, then `First` as tiebreaker. Single-name rows sort by that one name. Handle empty-name rows by putting them at the end. Don't try to be clever about middle names or particles ("van der Berg") — just `split(' ').slice(-1)[0]` for the sort key, fine for the demo.

**Role filter:** add a small dropdown next to the `↓ CSV` button (or as a modal that pops on click):
- **All** (default — current behaviour, all roles included)
- **Attendees only** (rows where role === 'attendee')
- **Staff+** (rows where role ∈ ['staff', 'manager', 'lead_admin', 'developer'])

Filter applies BEFORE the surname sort.

## Acceptance criteria

1. Viewing as Staff (or higher) on Dashboard → role pills and Role column visible.
2. Viewing as Attendee on Dashboard → role pills and Role column HIDDEN.
3. Viewing as Attendee → every name renders as initials only ("SA", "KA", "PA").
4. Viewing as Staff (or higher) → names render in full.
5. CSV download with All filter → all rows, sorted alphabetically by surname.
6. CSV download with Attendees-only filter → only attendee rows, sorted by surname.
7. CSV download with Staff+ filter → only staff/manager/lead_admin/developer rows, sorted by surname.
8. CSV ROLE column from `v5.9.0.13.31` still populated correctly (no regression).
9. Build pill bumped to `v5.9.0.13.33`.

## Out of scope

- Backend role-based access control (Attendee viewing the dashboard is a prototype-mode affordance via "Viewing as" dropdown — real attendees never see the dashboard at all). This PR is presentation-layer only.
- Configurable initial format ("SA" vs "S.A." vs "Spencer A."). Just initials, plain.
- Multi-column CSV sort. Surname only.
- CSV column reordering / hiding.
- Saving the filter choice across sessions.

## Style notes

- British spellings.
- Re-use existing dropdown/chip-style UI components.
- No Worker changes (presentation only).
- The CSV filter dropdown should match the style of the existing `↓ CSV` and `↑ CSV` buttons.

Ship as a single PR labelled `v5.9.0.13.33`. Captain verifies by toggling Viewing as Attendee/Staff and downloading CSV with each filter option before merge.
