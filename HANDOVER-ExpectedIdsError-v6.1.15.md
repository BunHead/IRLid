# HANDOVER — Mr. Data — `v6.1.15` — `expected_ids_not_found` on phone calendar approval

**Branch:** `codex/v6.1.15-expected-ids-error`
**Size:** Diagnose-first (~10–40 lines). Worker-only (`irlid-api-org/src/index.js`). Independent of all Org.html work — safe to run in parallel with the frontend bundle.

---

## The Bug (symptom)

When a calendar event is created/updated and approved on the **phone** (cross-device
auth path), the phone shows an ugly **`expected_ids_not_found`** error. The event
nonetheless **saves correctly** — so this is a cosmetic/UX wart, not data loss. Low
priority, but Captain wants it gone before the Patreon push.

---

## Where it's thrown

`expected_ids_not_found` is returned in three places, all via the same helper:

- Line **1386–1387** — `createWeeklyEvent` path
- Line **1414–1415** — `updateWeeklyEvent` path
- Line **4154–4155** — (the phone-approval / action-claim execution path — **this is the one firing**)

All three call:

```js
// Line 3890
async function ensureExpectedIdsForOrg(env, orgId, ids) {
  const unique = Array.from(new Set((ids || []).map(id => String(id||"").trim()).filter(Boolean)));
  if (!unique.length) return { ok: true, ids: [] };
  const placeholders = unique.map(() => "?").join(",");
  const rows = await env.DB.prepare(
    `SELECT id FROM org_expected WHERE org_id=? AND archived_at IS NULL AND id IN (${placeholders})`
  ).bind(orgId, ...unique).all();
  const found = new Set((rows.results || []).map(r => r.id));
  const missing = unique.filter(id => !found.has(id));
  if (missing.length) return { ok: false, missing };
  return { ok: true, ids: unique };
}
```

So the check fails when one or more `expected_ids` in the signed payload do **not**
resolve to a live `org_expected` row for this org.

---

## Diagnose FIRST — do not guess the fix

The leading hypothesis: the phone signs the event payload (including `expected_ids`)
and the **desktop has already saved the event via the direct path**, so by the time the
phone-approval claim re-executes the create at line 4154, either (a) it's passing a
different/stale `expected_ids` set, or (b) the IDs are client-side temp IDs that never
matched `org_expected.id`, or (c) the event was saved without those rows existing yet.

**Step 1 — instrument.** Add a temporary `console.log` at line 4154 logging
`org.id`, the incoming `body.expected_ids`, and `expectedCheck.missing`. Deploy, then
on real hardware create an event with an Expected list and approve on the 8 Pro.
`wrangler tail irlid-api-org` to capture exactly which IDs are reported missing and what
shape they are (UUID `p_kerry-austin_xxxx`? raw UUID? empty?).

**Step 2 — confirm the source.** Compare the logged IDs against `org_expected.id` in D1:

```
npx wrangler d1 execute irlid-db-org --remote --command "SELECT id, display_name FROM org_expected WHERE org_id='<org_id from log>' AND archived_at IS NULL;"
```

**Step 3 — fix at the right layer:**
- If the **phone is sending temp/duplicate/empty IDs** → fix the client payload so the
  phone-approval path sends the same canonical `expected_ids` the direct path validates
  cleanly (frontend — flag back to Number One, may move out of Worker scope).
- If the **IDs are correct but the desktop already saved** so the phone re-execute is a
  redundant second write → make the phone-approval execution **idempotent / tolerant**:
  on the action-claim path only (line 4154), treat unknown `expected_ids` as a soft
  warning — drop the missing ones, save with the resolved subset, return `ok:true` with a
  `warning: "some_expected_ids_skipped"` field instead of a 400. Do **NOT** loosen the
  direct create/update paths (1386, 1414) — those should stay strict.

Pick the fix only AFTER the tail log tells you which case it is.

---

## File touch list

| File | Change |
|---|---|
| `irlid-api-org/src/index.js` | Temp diagnostic log (removed before final), then the targeted fix at the line-4154 path only |
| `sw.js` | Cache bump only (if any frontend change) |
| Build pill | bump to `v6.1.15` |

## What NOT to touch

- The strict validation on direct create (1386) and update (1414) — leave strict
- The signed-payload verification / `requireSignedAction` — unchanged
- Receipt bridge, invite flows, calendar UI — unchanged

## A/R/D expectations

- **✅ ACCEPT ✅** — `wrangler tail` shows the root cause; fix is scoped to the
  phone-approval path; creating an event + approving on phone no longer shows the error;
  event + its expected list still save correctly; direct desktop save still strict.
- **⚠️ REVIEW ⚠️** — Fix loosens validation on the direct paths too, or swallows the
  error without identifying the real source.
- **⛔ DENY ⛔** — Changes signed-payload verification; touches schema; makes the strict
  paths silently drop expected_ids.

## Smoke

1. Desktop → create calendar event with 1–2 people on the Expected list → Save
2. Approve on 8 Pro
3. No `expected_ids_not_found` error on the phone ✅
4. Event appears with its expected list intact ✅
5. Direct-sign path (if applicable) still rejects genuinely bad IDs ✅

— Number One (4 June 2026)
