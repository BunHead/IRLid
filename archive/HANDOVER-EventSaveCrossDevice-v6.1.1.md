# HANDOVER — Mr. Data — `v6.1.1` — Calendar Event-Save via Cross-Device Auth

**Prerequisite:** `v6.1` (PR #73) must be merged and deployed before starting this brief.
**Branch:** `codex/v6.1.1-calendar-cross-device`
**Priority:** Fixes the Calendar event-save `signature_verify_failed` 401 that blocks demo.

---

## The Bug

`POST /org/weekly-events` calls `requireCalendarSignedAction` → `requireSignedAction`, which
expects a `signed_action` field containing a WebAuthn-signed v5 envelope. On desktop, no v5
credential is enrolled → `signed_action_required` 401 → toast "Save failed: signature_verify_failed".

The v6.1 infrastructure (the `pending_action_authorizations` table + `/org/action/{init,poll,claim}`
endpoints + `org-action-auth.html`) already exists after PR #73. This brief wires the Calendar
write actions into that existing flow.

---

## Root cause detail

`requireCalendarSignedAction` (Worker L3515) wraps `requireSignedAction` with:
```js
expectedType: "irlid_calendar_write_v5"
```

The v6.1 `/org/action/claim` handler already dispatches on `action_type` for `irlid_invite_v5`.
It does NOT yet have a branch for `irlid_calendar_write_v5`. So even if the phone signs
correctly, the claim handler doesn't know how to execute the calendar write after verification.

On the frontend, the calendar event-create handler in Org.html calls `signActionPayload(...)` inline
and POSTs directly to `/org/weekly-events`. There is no fallback to cross-device when the inline
signing fails.

---

## What you're building (three changes only)

### Change 1 — Worker: add `irlid_calendar_write_v5` dispatch in `orgActionClaim`

In `irlid-api-org/src/index.js`, find `orgActionClaim` (the handler for `POST /org/action/claim`).
It currently has a dispatch block like:

```js
if (row.action_type === "irlid_invite_v5") {
  // ... execute invite creation ...
}
```

**Add a sibling branch:**

```js
} else if (row.action_type === "irlid_calendar_write_v5") {
  // Execute the calendar write using the verified payload
  const calBody = JSON.parse(row.action_payload_json);
  // calBody shape: { op, org_id, event_id?, ...event fields }
  if (calBody.op === "create") {
    result = await orgWeeklyEventCreateFromPayload(env, calBody);
  } else if (calBody.op === "update") {
    result = await orgWeeklyEventUpdateFromPayload(env, calBody);
  } else if (calBody.op === "archive") {
    result = await orgWeeklyEventArchiveFromPayload(env, calBody);
  } else {
    return err("unknown_calendar_op", 400);
  }
}
```

You will need to **factor out** the D1-write logic from `orgWeeklyEventCreate`, `orgWeeklyEventUpdate`,
and `orgWeeklyEventArchive` into standalone helpers `orgWeeklyEventCreateFromPayload(env, payload)` etc.
that take the pre-verified payload object (no request, no `requireCalendarSignedAction` call — those are
already done by the claim handler). The existing route handlers become thin wrappers that:
1. Parse body + call `requireCalendarSignedAction` (existing, unchanged)
2. Call the new helper with the verified payload

This is the **only Worker change needed.** Do NOT modify `requireCalendarSignedAction` or
`requireSignedAction`. Do NOT modify any existing endpoint signatures.

### Change 2 — Frontend: cross-device fallback in Org.html event-create modal

Find the "Add event" / "Save event" submit handler in Org.html (look for the handler that calls
`signActionPayload` with `expectedType: "irlid_calendar_write_v5"` and then POSTs to
`/org/weekly-events`).

**Add this fallback pattern** (mirror the existing +Invite Staff cross-device path):

```js
async function saveEventWithAuth(eventPayload) {
  // Try inline signing first (works on enrolled phones)
  let signedAction;
  try {
    signedAction = await signActionPayload({
      type: "irlid_calendar_write_v5",
      ...eventPayload
    });
  } catch (e) {
    if (e.name === "NotAllowedError" || !window.IRLidV5) {
      // No v5 credential on this device — route through cross-device
      return initCrossDeviceAction({
        action_type: "irlid_calendar_write_v5",
        action_payload: eventPayload,
        action_summary: eventPayload.op === "create"
          ? `Create event: ${eventPayload.name}`
          : `Update event: ${eventPayload.name}`
      });
    }
    throw e;
  }
  // Inline path: POST directly with signed_action
  return fetch(`${workerBaseUrl()}/org/weekly-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Org-Key": currentOrg.api_key },
    body: JSON.stringify({ ...eventPayload, signed_action: signedAction })
  }).then(r => r.json());
}
```

`initCrossDeviceAction` is the helper added by v6.1 — call it the same way +Invite Staff does.

### Change 3 — Canonical payload shape

The `action_payload_json` stored in `pending_action_authorizations` (via `/org/action/init`) must
be the exact same object the Worker's `orgWeeklyEventCreateFromPayload` will receive. Define this
shape explicitly in the brief and use it in BOTH the frontend payload construction AND the Worker
helper parameter.

**Canonical payload for `irlid_calendar_write_v5` create op:**

```json
{
  "op": "create",
  "org_id": "<org uuid>",
  "name": "Monday Morning Yoga",
  "room_id": "<room id or null>",
  "day_of_week": 1,
  "start_time_local": "09:00",
  "duration_min": 60,
  "capacity": 20,
  "color_hex": "#7ee787",
  "notes": "",
  "require_proof": false,
  "late_grace_min": 10
}
```

For `update` add `"event_id": "<id>"`. For `archive` only `"op": "archive", "org_id": "...", "event_id": "..."`.

---

## File touch list

| File | Change |
|---|---|
| `irlid-api-org/src/index.js` | Add `irlid_calendar_write_v5` dispatch in `orgActionClaim` (~40 lines). Factor out `orgWeeklyEventCreateFromPayload`, `orgWeeklyEventUpdateFromPayload`, `orgWeeklyEventArchiveFromPayload` helpers (~60 lines refactor). Existing route handlers become thin wrappers (+0 net behaviour). |
| `Org.html` | Replace direct `signActionPayload` + POST in event-create/update/archive submit handlers with `saveEventWithAuth()` wrapper (~50 lines). |
| `sw.js` | Cache bump only. |
| Build pill | `v6.1` → `v6.1.1` |

**Total diff estimate: +150/−40. No new D1 tables. No new pages. No new endpoints.**

---

## What NOT to touch

- `requireCalendarSignedAction` / `requireSignedAction` — do not modify
- `/org/action/{init,poll,claim}` endpoint signatures — additive dispatch only
- `org-action-auth.html` — already handles `irlid_calendar_write_v5` generically
- Receipt bridge, visual theming, invite flow — leave alone
- The existing `irlid_invite_v5` dispatch branch — do not modify

---

## A/R/D expectations

- **✅ ACCEPT ✅** — Calendar event-create from desktop shows cross-device QR modal; phone scans; event appears in calendar after authorization. No regression on existing invite or receipt flows. Build pill is `v6.1.1`.
- **⚠️ REVIEW ⚠️** — `requireCalendarSignedAction` modified; new D1 table added; existing endpoint signatures changed; `orgWeeklyEventCreate` duplicated rather than refactored.
- **⛔ DENY ⛔** — Removes the signature requirement from calendar writes; modifies receipt bridge; changes invite flow.

---

## Captain's smoke (5 steps)

1. Open `irlid.co.uk/Org` on desktop. Sign in via 8 Pro QR scan.
2. Settings → Event & Calendar → `+ Add event`. Fill in name/day/time. Click Save.
3. Desktop shows cross-device QR modal: "Scan with your enrolled phone to authorize."
4. 8 Pro scans QR → `org-action-auth.html` shows "Create event: Monday Morning Yoga?" → Approve → fingerprint.
5. Desktop modal closes, new event appears in the calendar. ✅

Bonus: repeat on the 8 Pro directly (enrolled device) — should use inline signing path, no QR modal.

---

## Deploy sequence

1. `git pull` on local repo after PR merges.
2. `wrangler deploy` from `irlid-api-org/` directory — no migration needed (no new D1 tables).
3. Hard refresh `irlid.co.uk/Org` on desktop.
4. Run smoke above.

---

Ship clean.

— Number One (drafted 2 June 2026)
