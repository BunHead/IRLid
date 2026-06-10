# HANDOVER — Mr. Data — `v6.1.26` — Make Event-defaults actually ENFORCE

**Branch:** `codex/v6.1.26-event-defaults-enforcement`
**Why:** v6.1.18 made the Event-defaults *persist* to `settings_json.calendar_defaults`. But
several of them are still **decorative — they save but don't change behaviour**. This wires them
into the Worker check-in/out logic so the knobs do what they say.

## DIAGNOSE FIRST — what's already honoured vs ignored
Audit the Worker (`irlid-api-org/src/index.js`) for each `calendar_defaults` field:
- `min_trust_score` — `createCheckin` already enforces a floor via `settings.minScore` (the
  OLD/separate key). **Confirm whether it reads `calendar_defaults.min_trust_score`** — likely
  NOT, so the UI value is ignored. Point the check at `calendar_defaults.min_trust_score` (fall
  back to `settings.minScore`, then default).
- `checkout_grace` — already used by auto-checkout (v6.1.20). ✓ leave it.
- `require_proof` — almost certainly **not enforced**. This is the headline of this brief.
- `late_grace_before` / `late_grace_after` — currently inform the dashboard late-marker (display).
  Decide with Captain whether they should also *gate* check-in timing, or stay display-only
  (recommend **display-only for now** — gating arrival windows is a bigger behavioural change).
- `default_duration`, `working_hours_*`, `breaks_*`, `privacy_mode`, vocab — display/scheduling,
  not enforcement targets. Leave.

## What to build (conservative — default lenient)
1. **`require_proof`** (`off` / `optional` / `required`) on `createCheckin`:
   - `off` (default) → no change, current behaviour.
   - `required` → reject a check-in that lacks a verified proof (the hardware-backed/UV-asserted
     attendee signature — reuse whatever the receipt/score path already treats as "proof"). Return
     a clear error (e.g. `proof_required`).
   - `optional` → accept either, but record whether proof was present (no rejection).
   - **Read from `calendar_defaults.require_proof`.** Default `off` if absent — never tighten an
     org that hasn't opted in.
2. **`min_trust_score`** → enforce the check-in score floor from
   `calendar_defaults.min_trust_score` (fallback to existing `settings.minScore`, then 50). Don't
   double-reject; keep one clear `score_below_minimum` error.

## Out of scope
- Late-grace as a hard gate (display-only stays).
- New UI — the toggles already exist (v6.1.18).
- Schema — `calendar_defaults` already persisted.
- Auto-checkout (v6.1.20 owns `checkout_grace`).

## File touch list
| File | Change |
|---|---|
| `irlid-api-org/src/index.js` | `createCheckin`: enforce `require_proof` + read `min_trust_score` from `calendar_defaults` |

## A/R/D expectations
- **✅ ACCEPT ✅** — With `require_proof=required`, a no-proof check-in is rejected; with `off`
  (default) nothing changes; `min_trust_score` from the UI actually gates the floor; orgs that
  never set these are unaffected (lenient default). Needs `wrangler deploy`.
- **⚠️ REVIEW ⚠️** — Enforces even when `off`/absent (tightens un-opted orgs); double-rejects;
  reads the wrong key.
- **⛔ DENY ⛔** — Rewrites existing rows; breaks the standard check-in for orgs with no
  `calendar_defaults`; schema change.

## Smoke (with Captain)
1. Event defaults → Require proof = **Required**, Save all, `wrangler deploy` → a plain check-in is rejected with a clear message; a proof-backed one succeeds
2. Set it back to **Off** → check-in works as before
3. Raise Minimum trust score → a low-score check-in is rejected; lower it → accepted

— Number One (4 June 2026)
