# HANDOVER — Mr. Data — `v6.1.20` — Auto check-out after event grace

**Branch:** `codex/v6.1.20-auto-checkout`
**Depends on:** v6.1.18 (Event-defaults persisted to `settings_json.calendar_defaults`) being live.

## The need (Captain)
After an event's grace period, attendees still showing IN should be **auto checked-out**. Also
eases the "I have to sign out of the previous event before signing into a new one" friction —
once the old event auto-closes, the next check-in is clean.

## The design decision (Number One — made so you don't have to)
**Lazy compute-on-read in the Worker, deterministic timestamp.** No Cloudflare Cron infra (can
graduate to a Cron Trigger later if proactivity is ever needed). Rationale:
- An auto check-out is a **system event, not a co-presence proof** — nobody is there to sign it.
  So it is recorded with **`checkout_method='auto'`**, clearly distinct from a real signed
  check-out (which carries the cryptographic proof). It contributes **no trust score** — it just
  closes the attendance window administratively. (Immutable-DB principle: it's a NEW recorded
  event, never a rewrite.)
- The auto-checkout **time is deterministic** = the event's local end time + `checkout_grace`
  minutes — NOT "whenever the dashboard was next read". So the record is correct and stable
  whenever it's observed.

## What to build

### Worker (`irlid-api-org/src/index.js`)
In `orgAttendance` (the `/org/attendance` read), BEFORE returning, run an auto-checkout sweep:
- Read `settings_json.calendar_defaults.checkout_grace` (minutes) and the new toggle
  `calendar_defaults.auto_checkout` (boolean, **default false** — opt-in, IRLid principle).
- If `auto_checkout` is true: for each **active** check-in (`checkout_at` null, status not
  invalid/conflict) that **has an `event_id`**, resolve that event's local end
  (`start_time_local` + `duration_min`). If `now()` is past `event_end + checkout_grace`, write a
  check-out: `UPDATE org_checkins SET checkout_at=?, checkout_method='auto' WHERE id=? AND
  checkout_at IS NULL` where `checkout_at` = the deterministic `event_end + grace` epoch.
- Check-ins with **no `event_id`** (general venue check-ins) are left alone (no event to anchor
  the grace to — out of scope here).
- Do the writes (batch) then re-read / reflect them in the response so the dashboard shows them
  closed in the same load.

### Frontend (`Org.html`)
- New toggle in **Event defaults**: **"Auto check-out after grace"** (default OFF). Saves into
  `calendar_defaults.auto_checkout` via the v6.1.18 Save-all path. Add `auto_checkout` (boolean)
  to the Worker's `allowedCalKeys` + validate as boolean.
- Display auto check-outs distinctly in the attendance table + per-event timeline: status
  **"OUT · auto"** (or an `auto` badge), so a glance separates them from signed check-outs.

## Out of scope
- No Cron Trigger (lazy-on-read is enough for now).
- No change to signed check-out, check-in, or trust scoring of *real* check-outs.
- The deeper "one active presence spans events" question (Captain's friction #2) — auto-checkout
  eases it; a full per-event-presence model is separate, investigate later.
- Schema: `org_checkins.checkout_method` already exists (used by the dashboard) — no migration.

## File touch list
| File | Change |
|---|---|
| `irlid-api-org/src/index.js` | auto-checkout sweep in `orgAttendance`; `auto_checkout` in calendar_defaults allowlist + boolean validate |
| `Org.html` | "Auto check-out after grace" toggle in Event defaults; "OUT · auto" display |
| `sw.js` | cache bump |
| Build pill | → `v6.1.20` |

## A/R/D expectations
- **✅ ACCEPT ✅** — With auto_checkout ON, an attendee left IN past (event end + checkout_grace)
  shows OUT·auto with checkout time = event_end+grace (deterministic, not "now"); with it OFF,
  nobody is auto-closed; real signed check-outs unchanged; no trust score from auto-outs.
- **⚠️ REVIEW ⚠️** — Auto-checkout timestamp = read-time instead of event_end+grace; auto-outs
  counted as trusted; non-event check-ins auto-closed.
- **⛔ DENY ⛔** — Rewrites/reopens existing check-outs; changes signed check-out semantics;
  adds Cron without need; schema change.

## Smoke
1. Event defaults → turn ON "Auto check-out after grace", grace = (small for test), Save all
2. Check in to a short event; let it pass end+grace; refresh dashboard → row shows OUT·auto at the deterministic time
3. Toggle OFF → a fresh still-IN attendee stays IN past grace
4. A normally signed check-out still records as a real OUT (not auto)

— Number One (4 June 2026)
