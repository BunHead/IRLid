# HANDOVER — Mr. Data — `v6.1.12` — Check-in Tab Shows Current Running Event QR

**Branch:** `codex/v6.1.12-current-event-qr`
**Size:** ~40 lines (Worker endpoint + frontend polling). Independent of all other open work.

---

## The Problem

The Check-in tab always shows the same venue QR regardless of which event is running now.
When an attendee scans it, the `org_checkins` row gets either no `event_id` or a stale one.
Per-event attendance (visible in Event & Calendar → Edit event → Attendance section) never
populates because no check-ins are linked to the correct event.

**Observed:** Check-in tab QR had `event_id=evt-tue-0715` (Early-bird HIIT) even when
"Test 3" at 21:00 was the currently running event. Test 3's attendance section showed
Kerry and Poppy as EXPECTED before AND after a real check-in — no change.

---

## What you're building

### Change 1 — Worker: `GET /org/current-event`

Returns the event currently running for this org, based on server time + day of week.

```js
async function orgCurrentEvent(request, env) {
  const org = await orgAuth(request, env); if (org.error) return org;
  const now = new Date();
  const dayOfWeek = now.getUTCDay() === 0 ? 7 : now.getUTCDay(); // 1=Mon..7=Sun
  const timeStr = now.toTimeString().slice(0, 5); // "HH:MM"
  const row = await env.DB.prepare(`
    SELECT id, name, room_id, start_time_local, duration_min
    FROM weekly_events
    WHERE org_id = ?
      AND day_of_week = ?
      AND start_time_local <= ?
      AND archived_at IS NULL
    ORDER BY start_time_local DESC
    LIMIT 1
  `).bind(org.id, dayOfWeek, timeStr).first();
  if (!row) return json({ ok: true, event: null });
  // Check we're within the duration window
  const [h, m] = row.start_time_local.split(':').map(Number);
  const startMin = h * 60 + m;
  const [ch, cm] = timeStr.split(':').map(Number);
  const nowMin = ch * 60 + cm;
  if (nowMin > startMin + (row.duration_min || 60)) return json({ ok: true, event: null });
  return json({ ok: true, event: row });
}
```

Wire to `GET /org/current-event` in the router. Auth: `orgAuth`.

### Change 2 — Frontend: Check-in tab polls current event + rebuilds QR

In the Check-in tab setup (where `generateVenueQR` is called), add a polling interval
that fetches `/org/current-event` every 60 seconds and regenerates the venue QR with the
returned `event_id` when it changes.

```js
async function refreshCurrentEventQr() {
  try {
    const res = await liveOrgApi('/org/current-event');
    const eventId = res.event?.id || null;
    const eventName = res.event?.name || null;
    if (eventId !== window._currentCheckinEventId) {
      window._currentCheckinEventId = eventId;
      generateVenueQR({ eventId, eventName }); // pass into existing QR builder
      updateCurrentEventBadge(eventName); // show "Now: Test 3" badge under QR
    }
  } catch (_) {}
}
refreshCurrentEventQr();
setInterval(refreshCurrentEventQr, 60000);
```

**`updateCurrentEventBadge(name)`**: update (or create) a small text element under the
Event Check-in QR showing "Now: {event name}" or "No event running" when null.

### Change 3 — `generateVenueQR` accepts optional event context

`generateVenueQR` (wherever it builds the `org-entry.html` URL) should accept an optional
`{ eventId, eventName }` argument and append `&event_id={eventId}&event={eventName}` to
the QR URL when provided. If no event is running, omit both params (org-level check-in,
no event assignment).

---

## File touch list

| File | Change |
|---|---|
| `irlid-api-org/src/index.js` | ADD `orgCurrentEvent` handler + route (~25 lines) |
| `Org.html` | ADD `refreshCurrentEventQr` + `updateCurrentEventBadge` + wire into Check-in tab init + extend `generateVenueQR` to accept event context (~30 lines) |
| `sw.js` | Cache bump only |
| Build pill | `v6.1.11` → `v6.1.12` |

---

## What NOT to touch

- The attendee-side `org-entry.html` — already handles `event_id` from URL params
- The Worker `orgCheckin` handler — already stores `event_id` when present
- Calendar, invite, receipt flows — unchanged

---

## A/R/D expectations

- **✅ ACCEPT ✅** — Check-in tab shows "Now: Test 3" badge when Test 3 is running. QR URL contains Test 3's event_id. After an attendee scans + checks in, Test 3's attendance section shows them as CHECKED IN. When no event is running, QR works as org-level check-in (no event_id in URL).
- **⚠️ REVIEW ⚠️** — Polling interval shorter than 60s (unnecessary Worker load); event badge missing when event IS running.
- **⛔ DENY ⛔** — Modifies `org-entry.html`; modifies `orgCheckin` handler; changes any existing QR URL params that are already working.

## Smoke

1. Test 3 is scheduled Tuesday 21:00–22:00. Run smoke at 21:xx Tuesday.
2. Check-in tab shows badge "Now: Test 3" ✅
3. Copy QR URL — confirm contains `event_id=<Test3_id>` ✅
4. Scan QR with a phone → check in
5. Settings → Event & Calendar → Test 3 → Edit → Attendance section shows the check-in ✅
6. Wait until 22:00 (or test with a short-duration event) → badge shows "No event running", QR has no event_id ✅

Ship clean.
— Number One (2 June 2026)
