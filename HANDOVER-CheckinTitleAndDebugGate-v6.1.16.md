# HANDOVER — Mr. Data — `v6.1.16` — Check-in title + global Debug gate

**Branch:** `codex/v6.1.16-checkin-title-debug-gate`
**Run order:** AFTER `v6.1.10` (modal auto-close) has merged, since both touch `Org.html` —
branch off fresh `main`. Two independent fixes, one PR, two commits.

---

## Fix 1 — Check-in title = "Venue — Event"

### Current
The Check-in PUBLIC QR card shows the org/venue name large (e.g. **"Test Event"**) under
the IRL logo. When a calendar event is currently running it does NOT show the event name.

### Wanted
Show **"{Venue} — {Event}"** when an event is active, e.g. **"Test Event — Test 3"**.
When no event is active, fall back to just the venue name (no trailing dash).

### How
The active event is already resolved by `window.v511GetActiveCalendarEvent()`
(Org.html ~line 7307) and the Check-in event context is tracked in the handler around
**line 13384** (`normaliseCheckinEventContext(activeEvent?.id, activeEvent?.name)`).

- Find the element that renders the large venue title inside the Check-in QR card
  (near the `<div class="card-title">Check-in</div>` header at ~line 3493 and the orange
  QR card body that prints the venue name).
- When the context updates, set its text to
  `activeEvent && activeEvent.name ? venueName + ' — ' + activeEvent.name : venueName`.
- This must update live as events change (the existing context handler at ~13384 already
  fires on poll — hook the title update into that same path so it tracks "Now" without a
  manual refresh).
- Use an em dash ` — ` (matches the wanted format), not a hyphen.

**Do NOT** change the QR payload, the `event_id` threading (v6.1.13), or the
`Public attendee screen` sub-label.

---

## Fix 2 — Global Debug gate (default OFF, controlled in Tools & Diagnostics)

### Captain's spec (verbatim intent)
> "I wanted all the debug information to turn off on each of the pages, if it wasn't
> ticked on in Tools & Diagnostics."

Today there is **no debug flag** — debug output (console logs, on-screen debug
panels/blocks/URLs) is always on. We want a single master switch.

### Build
1. **Master toggle** in the **Tools & Diagnostics** Settings tab: a checkbox
   "Show debug information" persisted to `localStorage.setItem('irlid_debug', '1'|'0')`.
   **Default OFF** (absent or '0' = off).
2. **Shared helper** readable from every page:
   ```js
   window.irlidDebugOn = function(){ try { return localStorage.getItem('irlid_debug') === '1'; } catch(_) { return false; } };
   ```
   Define it early (before any debug output runs) on each page that emits debug, or in a
   shared script both load. Keep it dependency-free so `scan.html`, `org-entry.html`, etc.
   can use it without importing the dashboard bundle.
3. **Sweep + gate.** Find the debug surfaces and gate each behind `irlidDebugOn()`:
   - On-screen debug panels / debug URL text / diagnostic blocks → hidden unless on.
   - Verbose `console.log('[scan]'...)`, `[staff_scan]`, `[401-trace]`, `[settings save]`
     and similar instrumentation → wrapped so they only fire when on.
   - Leave genuine `console.error`/user-facing error toasts alone — those are not "debug".
   - Pages to sweep: `Org.html`, `scan.html`, `org-entry.html`, `org-login.html`,
     `v5-test.html` (and any other page emitting bracketed debug logs — grep for
     `console.log('[` across the repo to enumerate).
4. **Live effect:** toggling the checkbox should take effect on next page load (no need
   for live re-render of already-printed logs). On-screen debug panels should hide/show
   immediately on toggle if cheap; page-load gating is acceptable otherwise.

### Acceptance
- Fresh load with nothing ticked → no debug panels, no bracketed `[...]` console spam on
  any page.
- Tick "Show debug information" in Tools & Diagnostics → reload → debug panels + logs
  return.
- Untick → reload → silent again.

---

## File touch list

| File | Change |
|---|---|
| `Org.html` | Check-in title live-update; Tools & Diagnostics debug checkbox + `irlidDebugOn` helper; gate Org.html debug surfaces |
| `scan.html`, `org-entry.html`, `org-login.html`, `v5-test.html` | define/read `irlidDebugOn`, gate their debug output |
| `sw.js` | Cache bump |
| Build pill | → `v6.1.16` |

## A/R/D expectations
- **✅ ACCEPT ✅** — Title reads "Test Event — Test 3" during an event, "Test Event" otherwise, tracking live. Debug silent by default everywhere; returns only when ticked.
- **⚠️ REVIEW ⚠️** — Debug gate misses some pages (bracketed logs still leak); title uses a hyphen not em dash; title doesn't update live.
- **⛔ DENY ⛔** — Gates real error handling; changes QR payload / event_id threading; alters Worker.

## Smoke
1. Check-in tab during the running "Test 3" event → title "Test Event — Test 3" ✅
2. Outside any event → title "Test Event" ✅
3. Nothing ticked in Tools & Diagnostics → no debug panels/logs on Org, scan, org-entry ✅
4. Tick → reload → debug returns ✅; untick → reload → silent ✅

— Number One (4 June 2026)
