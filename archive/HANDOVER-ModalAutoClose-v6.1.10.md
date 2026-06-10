# HANDOVER — Mr. Data — `v6.1.10` — Add Event Modal Auto-Close

**Branch:** `codex/v6.1.10-modal-auto-close`
**Size:** ~2 lines changed. Independent of all other open work.

---

## The Bug

When saving a calendar event on Windows (cross-device path):
1. Captain fills the Add event modal and clicks Save
2. `v61AuthorizeActionWithPhone` is called — shows the QR authorization modal
3. The **Add event modal stays open behind the QR modal** — both visible simultaneously
4. Captain has to manually close the Add event modal to see the QR modal clearly
5. After phone approves, `closeEventModal()` fires and the event saves correctly

The root cause: `closeEventModal()` is called AFTER `v61AuthorizeActionWithPhone` resolves
(Org.html line 7703), so during the entire authorization wait, both modals are open.

---

## The Fix

In `saveEventFromModal` (Org.html ~line 7699), add `closeEventModal()` BEFORE
the `v61AuthorizeActionWithPhone` call:

```js
// BEFORE (current):
var phoneSigned = await v61AuthorizeActionWithPhone('irlid_calendar_write_v5', currentOrg && currentOrg.id, signedFields);
result = phoneSigned.action_result || {};

// AFTER (fix):
closeEventModal();   // ← ADD THIS LINE
var phoneSigned = await v61AuthorizeActionWithPhone('irlid_calendar_write_v5', currentOrg && currentOrg.id, signedFields);
result = phoneSigned.action_result || {};
```

The existing `closeEventModal()` call at line 7703 stays — it becomes a no-op on the
cross-device path (modal already closed) and continues to work on the direct-sign path.

---

## File touch list

| File | Change |
|---|---|
| `Org.html` | +1 line before `v61AuthorizeActionWithPhone` call in `saveEventFromModal` |
| `sw.js` | Cache bump only |
| Build pill | `v6.1.9` → `v6.1.10` |

---

## A/R/D expectations

- **✅ ACCEPT ✅** — Add event modal closes as soon as Save is clicked (cross-device path). QR auth modal appears cleanly. After phone approves, calendar refreshes. No regression on direct-sign path.
- **⛔ DENY ⛔** — Any change beyond the one-line addition + cache bump.

## Smoke

1. Desktop → Settings → Event & Calendar → + Add event → fill form → Save
2. Add event modal closes immediately
3. QR auth modal appears: "Scan with your enrolled phone"
4. 8 Pro scans → Approve
5. Calendar updates with new event. ✅

Ship clean.
— Number One (2 June 2026)
