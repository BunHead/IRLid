# HANDOVER — Mr. Data — `v6.1.28` — Check-in survives a network hiccup (retry + queue, no red screen)

**Branch:** `codex/v6.1.28-checkin-resilience`
**Why:** On a transient network failure the attendee check-in (`org-entry.html`) throws a big red
**"failed to fetch"** screen. Seen on an 8-year-old Nokia 6.1 with a wheezy radio — intermittent,
network-level, NOT IRLid. But it quietly breaks IRLid's **"offline-safe"** promise (PROTOCOL §16):
a co-presence that happened *physically* shouldn't be lost to a dropped packet. Make the check-in
**retry, then queue + sync** instead of red-screening.

## DIAGNOSE FIRST
- Find the check-in POST in `org-entry.html` (the `/org/checkin` fetch + its catch → the red
  error render). Confirm it has **no** retry/queue today (just a hard error).
- Check what offline machinery already exists: the org dashboard has an IndexedDB write queue /
  `js/offline-snapshot.js` (§16 Tier 2). Reuse the pattern if it fits `org-entry.html`; if that's
  too heavy for the simple entry page, a small `localStorage` queue is fine.

## What to build (conservative — never lose a real check-in, never double-count)
1. **Retry the POST** on a *network* failure (`TypeError: Failed to fetch` / no response) — e.g.
   2–3 attempts with short backoff (0.5s, 1.5s). Most wheezy-radio failures clear on retry.
   - Do NOT retry on a real *server* rejection (4xx/5xx with a body) — those are genuine (e.g.
     `score_below_minimum`); show the real message.
2. **If retries still fail → queue, don't red-screen.** Store the check-in locally with its
   **original scan timestamp** (so the recorded time is when they actually checked in, not when it
   syncs). Show a gentle state: **"Checked in — syncing when back online"** (green/neutral, not a
   red error).
3. **Flush the queue** on `online` event + on next page load. On success, mark synced. The Worker
   must treat a queued (timestamped) check-in the same as a live one.
4. **Idempotency — critical:** a queued check-in that *did* actually reach the Worker before the
   client gave up must not create a duplicate. Key the queued item by a client-generated
   id/nonce so a re-send is deduped server-side (or check `org_checkins` for the same
   attendee+event+timestamp before inserting). Confirm the dedupe path.

## Out of scope
- The org dashboard's own offline mode (already exists).
- Changing the signing/scoring of a check-in (only the transport gets resilient).
- A full PWA for `org-entry.html`.

## File touch list
| File | Change |
|---|---|
| `org-entry.html` | retry-on-network-fail; queue + gentle "syncing" state instead of red error; flush on reconnect/load; carry original timestamp |
| `irlid-api-org/src/index.js` | ensure check-in is **idempotent** by client nonce/id (dedupe a re-sent queued check-in) — add if missing |
| `sw.js` | cache bump |
| Build pill | → `v6.1.28` |

## A/R/D expectations
- **✅ ACCEPT ✅** — A check-in on a flaky connection retries silently and succeeds; if it can't,
  it shows "syncing" (not red) and syncs on reconnect with the *original* time; a real server
  rejection still shows its real message; **no duplicate** attendance rows from a re-sent queued
  check-in.
- **⚠️ REVIEW ⚠️** — Retries a genuine 4xx/5xx (masks real errors); queued check-in records the
  sync time not the scan time; possible duplicate on re-send (idempotency unproven).
- **⛔ DENY ⛔** — Can lose a check-in silently; double-counts; changes signing/scoring; rewrites
  rows.

## Smoke
1. Check in normally → works as now
2. Throttle/kill the network mid-check-in (DevTools offline) → no red screen; "syncing" state; restore network → it syncs, attendance shows the *scan* time
3. Force a re-send of an already-delivered queued check-in → **no duplicate** row
4. A genuine rejection (e.g. score too low) → still shows the real error, no infinite retry

— Number One (5 June 2026)
