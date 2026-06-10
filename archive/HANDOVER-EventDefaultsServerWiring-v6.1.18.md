# HANDOVER — Mr. Data — `v6.1.18` — Wire Event Defaults to the server (stop localStorage-only)

**Branch:** `codex/v6.1.18-event-defaults-server`
**Why:** The Event-defaults expander (Default duration, Check-out grace, Late grace
before/after, Working hours, Breaks, Min trust score, Privacy mode, Require proof) currently
saves to **localStorage only** — key `v511_mockup_calendar_settings_v1` (`loadCalSettings` /
`saveCalSettings` ~Org.html L7388-7398). So the "✓ Saved" pulse fires and the working-hours
band re-renders on *this* device, but nothing reaches the org's D1 `settings_json`. The
values don't follow the user to another device and the Worker never sees them.

This brief = **persistence**: make Event defaults round-trip through the server like theming
does, included in "Save all settings". (Per-setting *enforcement* — e.g. require_proof
actually requiring proof — is a SEPARATE follow-up, see "Out of scope".)

---

## What to build

### Frontend (`Org.html`)
1. **Include the calendar-defaults fields in the Save-all payload.** "Save all settings"
   already POSTs theme/branding to `/org/settings`. Add a `calendar_defaults` object to that
   payload carrying the `loadCalSettings()` fields that are org-level config:
   `default_duration, checkout_grace, late_grace_before, late_grace_after,
   working_hours_start, working_hours_end, breaks_count, break_1_start, break_1_end,
   break_2_start, break_2_end, min_trust_score, privacy_mode, require_proof,
   week_starts_on, room_vocabulary_singular, room_vocabulary_plural`.
2. **Hydrate from the server on load.** When the dashboard loads org settings, if
   `settings.calendar_defaults` exists, seed `V511_CAL_SETTINGS_KEY` localStorage from it
   BEFORE the calendar first renders (localStorage stays as a fast cache; **server is the
   source of truth**). Fall back to existing `CAL_DEFAULTS` when the server has none.
3. **Keep the per-input localStorage save** (instant UX) BUT make the "✓ Saved" pulse honest:
   the pulse currently implies persistence. Either (a) leave per-input localStorage for live
   preview and rely on "Save all settings" for the real persist, or (b) debounce a
   `/org/settings` PATCH on change. Prefer (a) — simplest, matches theming's "edit live,
   Save-all persists" model. Don't fire the green "Saved" pulse until the server round-trip
   in Save-all confirms.

### Worker (`irlid-api-org/src/index.js`)
4. **`POST /org/settings`** — accept + validate + persist a `calendar_defaults` object inside
   `settings_json`. Validation: durations/grace = non-negative ints with sane caps
   (e.g. ≤ 1440 min); times = `HH:MM`; `breaks_count` 0–3; `min_trust_score` 0–100;
   `privacy_mode` ∈ existing enum; `require_proof` ∈ {off, …existing}. Reject out-of-range
   with a clear error; never silently drop.
5. **`GET /org/settings`** (and wherever the dashboard reads settings) — return
   `calendar_defaults` so the frontend can hydrate.
6. Preserve the existing GET-overlay-POST-readback pattern so other settings (theme, etc.)
   are not clobbered.

---

## Out of scope (explicit — do NOT do here)
- **Enforcement.** Making each value drive Worker behaviour (require_proof actually gating a
  check-in, min_trust_score rejecting low scores, check-out/late grace affecting status) is a
  **follow-up brief**. This brief only makes them persist + round-trip. If you notice the
  Worker ALREADY honours a setting from its own default, you may point it at
  `settings.calendar_defaults` for that one — but flag it in the PR description, don't expand
  scope silently.
- Schema migration — `settings_json` already exists; no new columns.
- The mockup key rename — keep `v511_mockup_calendar_settings_v1` as the local cache key to
  avoid churn (or rename to `v511_calendar_settings_v1` if trivial; flag if you do).

## File touch list
| File | Change |
|---|---|
| `Org.html` | calendar-defaults into Save-all payload; hydrate from server on load; honest Saved pulse |
| `irlid-api-org/src/index.js` | validate + persist + return `calendar_defaults` in `settings_json` |
| `sw.js` | cache bump |
| Build pill | → `v6.1.18` |

## A/R/D expectations
- **✅ ACCEPT ✅** — Edit Working hours / grace / privacy → Save all settings → hard refresh →
  values persist; open on a DIFFERENT device (same org) → same values; Worker stores them in
  `settings_json` (verify via D1). No other settings clobbered.
- **⚠️ REVIEW ⚠️** — Persists but "Saved" pulse still fires before the server confirms; some
  fields silently dropped; localStorage still authoritative over server on load.
- **⛔ DENY ⛔** — Schema change; clobbers theme settings; adds enforcement that changes
  check-in behaviour (that's the follow-up, not this).

## Smoke
1. Change Working hours end + Check-out grace → Save all settings → ✓ → hard refresh → persists
2. Sign in on a second device (same org) → same values appear
3. D1: `SELECT settings_json FROM organisations WHERE id='<org>';` contains `calendar_defaults`
4. Theme/branding still save fine (no regression)

— Number One (4 June 2026)
