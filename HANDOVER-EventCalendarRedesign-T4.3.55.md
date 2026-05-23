# HANDOVER — Event & calendar redesign (T4.3.55)

**Author:** Number One.
**Drafted:** Saturday 23 May 2026 morning watch.
**Target:** Mr. Data (Codex).
**Scope:** `OrgCheckinTest.html` mockup ONLY. No Worker, no D1, no live HTML, no `js/`.
**Estimated diff:** ~120-180 lines (significant render rewrite, but contained to the calendar tab).
**Estimated time:** single PR, ~30-45 min.
**Branch suggestion:** `codex/v5.11-mockup-calendar-redesign`.
**Build pill bump:** T4.3.54 → T4.3.55.

**Predecessor:** T4.3.53 shipped the weekly calendar; T4.3.54 added Event defaults rename + late-grace + week-start toggle + Room vocabulary. This brief reshapes the swim-lane view based on Captain's UX feedback after seeing it live.

---

## §1 — Why

Captain reviewed the merged T4.3.53/T4.3.54 calendar in the browser and identified three corrections to the swim-lane model:

1. **Swim-lane should show ONE day at a time, not 7 stacked vertically.** The day chips above are the day selector — clicking a chip switches the visible day rather than scrolling to a strip. This matches how a venue actually operates ("show me today across all rooms"), and the "Now" line becomes meaningful again because there's only one day on screen.

2. **In Swim-lane view, ROWS = ROOMS, not days.** Each room (Studio 1 / Studio 2 / Studio 3) gets its own horizontal lane. Time is the x-axis (00:00 → 23:59). At a glance you see "Studio 1 has Beginners 09:00–10:00, Studio 2 has Early Bird 07:15–08:15, Studio 3 has Lunch Stretch 12:30–13:15" for the selected day. This matches how Google Calendar / Outlook handle multi-resource (meeting room) views.

3. **List view should be the DEFAULT view mode**, not Swim-lane. List is a lighter render and a better "browse the whole week" mode; Swim-lane is the daily focus mode you switch into when needed.

Plus: **light-mode contrast on event pills is still failing WCAG 4.5:1**. The T4.3.53 light-mode override collapsed all pills to white background (`background: #fff`), losing both the room-colour distinction and the small-text contrast. Each room class needs its own deeper-saturation light-mode variant.

All TIER 3 mockup work. Single file.

---

## §2 — Out of scope (do NOT touch)

- Any file other than `OrgCheckinTest.html`
- Worker (`irlid-api-org/`)
- Live dashboard (`OrgCheckin.html`)
- `js/`, `schema.sql`, `memory/`
- Per-event Expected list wiring (v6+)
- Per-room late-grace override (v6+)
- Vertical lane stacking for overlapping events in same room same time (v6+ — for now overlap is acceptable; it surfaces a real scheduling conflict)
- Removing existing List view functionality (it stays — just becomes the default)
- Removing the Room filter dropdown (it stays — narrows which room lanes appear)

---

## §3 — Tasks

### Task 1 — Add `state.selectedDay` (transient day-of-week selector)

Around the existing `state` initialisation block in the calendar JS (search for `state.weekStartIso`), add a new field:

```js
state.selectedDay = state.selectedDay || dayOfWeekForDate(new Date());
```

This is the day-of-week (1=Mon..7=Sun) currently shown in Swim-lane view. Default to today's day-of-week.

When the user navigates to a different week (Prev/Next/This week buttons), KEEP the same `selectedDay`. Example: if user is viewing Tuesday in this week and clicks "Next week", they're still viewing Tuesday — just the Tuesday in the new week. This is the most intuitive carry-over.

`selectedDay` does NOT need to persist in localStorage — it's session-transient. Fresh-load = today.

---

### Task 2 — Rewrite `renderWeekStrips()` → `renderDayLanes()` (single day, rooms as rows)

The current `renderWeekStrips()` function (around line 6310 area, search for `function renderWeekStrips`) maps `orderedDays()` to 7 strips. **Replace it with a function that renders ONE day with N room lanes.**

Suggested name: `renderDayLanes()` (rename the function + update the caller in `renderAll`).

Pseudocode:
```js
function renderDayLanes() {
  var wrap = document.getElementById('v511CalSwimlane');
  if (!wrap) return;
  
  var dow = state.selectedDay;
  var date = dateForDow(dow);
  var dayName = DAY_NAMES[dow - 1];
  var now = new Date();
  var isToday = isoDate(date) === isoDate(now);
  var nowPercent = isToday ? (((now.getHours() * 60 + now.getMinutes()) / 1440) * 100).toFixed(2) : null;
  
  // Active rooms in display order (respect room filter dropdown)
  var activeRooms = roomsForFilter(); // returns array of room_id strings in order
  
  // Header for the selected day
  var header = '<div class="v511-day-lane-head"><div><strong>' + htmlEscape(dayName) + '</strong> <span>' + htmlEscape(isoDate(date)) + '</span></div><button type="button" class="v511-btn v511-btn-mini" data-add-event-day="' + dow + '">+ Add event</button></div>';
  
  // Time ticks above the lanes (shared axis)
  var ticks = '<div class="v511-day-ticks"><span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span><span>23:59</span></div>';
  
  // One lane per active room
  var lanes = activeRooms.map(function (roomId) {
    var room = ROOM_META[roomId];
    if (!room) return '';
    var roomEvents = filteredEvents().filter(function (ev) {
      return ev.day_of_week === dow && ev.room_id === roomId;
    });
    var pills = roomEvents.length 
      ? roomEvents.map(function (ev) { return renderEventPill(ev); }).join('')
      : '';
    var emptyLabel = roomEvents.length ? '' : '<div class="v511-lane-empty">No events</div>';
    return '<div class="v511-day-lane ' + room.className + '" data-room-id="' + htmlEscape(roomId) + '"><div class="v511-day-lane-label">' + htmlEscape(room.label) + '</div><div class="v511-day-lane-timeline">' + pills + emptyLabel + '</div></div>';
  }).join('');
  
  // "Now" line — only render if viewing today
  var nowLine = (nowPercent !== null) 
    ? '<div class="v511-day-now-line" style="left:' + nowPercent + '%"><span class="v511-day-now-label">Now</span></div>'
    : '';
  
  // Footer: event count + day-export button
  var footer = '<div class="v511-day-lane-actions"><span class="v511-hint">' + activeRooms.reduce(function (sum, rid) { return sum + filteredEvents().filter(function (ev) { return ev.day_of_week === dow && ev.room_id === rid; }).length; }, 0) + ' events</span><button type="button" class="v511-btn v511-btn-mini" data-export-day="' + dow + '">Export ' + htmlEscape(dayName) + '</button></div>';
  
  wrap.innerHTML = header + ticks + '<div class="v511-day-lanes-grid">' + nowLine + lanes + '</div>' + footer;
}
```

(Pseudocode is illustrative — Mr. Data, adapt to the actual existing render patterns and CSS conventions in the file.)

#### CSS needed (add inside the existing `<style>` block near the existing v511-week-* rules):

```css
.v511-day-lane-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; }
.v511-day-ticks { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0; padding: 6px 12px 8px; color: var(--muted); font-size: 10px; }
.v511-day-lanes-grid { position: relative; padding: 0 12px; }
.v511-day-lane { display: grid; grid-template-columns: 100px 1fr; gap: 8px; align-items: stretch; padding: 6px 0; border-top: 1px solid rgba(255,255,255,0.05); }
.v511-day-lane:last-child { border-bottom: 1px solid rgba(255,255,255,0.05); }
.v511-day-lane-label { font-weight: 700; color: var(--text); font-size: 13px; display: flex; align-items: center; padding-left: 8px; border-left: 3px solid currentColor; }
.v511-day-lane.room-studio1 .v511-day-lane-label { color: #c8e0ff; }
.v511-day-lane.room-studio2 .v511-day-lane-label { color: #c0dd97; }
.v511-day-lane.room-studio3 .v511-day-lane-label { color: #fac775; }
.v511-day-lane-timeline { position: relative; min-height: 56px; background: rgba(255,255,255,0.02); border-radius: 6px; }
.v511-lane-empty { color: var(--muted); font-size: 11px; padding: 18px 0 0 12px; }
.v511-day-now-line { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--accent, #58a6ff); z-index: 5; pointer-events: none; }
.v511-day-now-line .v511-day-now-label { position: absolute; top: -16px; left: 4px; font-size: 9px; background: var(--accent, #58a6ff); color: #000; padding: 1px 5px; border-radius: 3px; font-weight: 700; }
.v511-day-lane-actions { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; }
```

#### Helper function for room filter:

```js
function roomsForFilter() {
  var filter = state.roomFilter || 'all';
  if (filter === 'all') return Object.keys(ROOM_META);
  return [filter];
}
```

(If `state.roomFilter` doesn't already exist, add it — default 'all', wired to the existing Room filter dropdown change event.)

#### Update `renderEventPill()` for the new context:

The pill now sits inside a `.v511-day-lane-timeline` (rather than `.v511-week-timeline`). Width/left calculation stays the same (percentage of 1440 minutes). Drop the per-lane `top` offset since each room has its own row now — pills can sit centred vertically within their lane.

Suggested pill positioning:
```js
function renderEventPill(ev) {
  var room = ROOM_META[ev.room_id] || ROOM_META.studio1;
  var start = minutesFromTime(ev.start_time_local);
  var width = Math.max(5, ((Number(ev.duration_min || 60)) / 1440) * 100);
  var left = Math.max(0, Math.min(100 - width, (start / 1440) * 100));
  var end = start + Number(ev.duration_min || 60);
  return '<button type="button" class="v511-day-event-pill ' + room.className + '" data-edit-event="' + htmlEscape(ev.id) + '" style="left:' + left.toFixed(2) + '%; width:' + width.toFixed(2) + '%;"><b>' + htmlEscape(ev.name) + '</b><small>' + htmlEscape(ev.start_time_local) + '-' + htmlEscape(timeFromMinutes(end)) + '</small></button>';
}
```

New CSS class `.v511-day-event-pill` for the daily-view pill (slightly different shape than the weekly-strip pill — taller, fills the lane height):

```css
.v511-day-event-pill { position: absolute; top: 6px; bottom: 6px; padding: 6px 10px; border-radius: 6px; border-left: 3px solid; cursor: pointer; text-align: left; font-family: inherit; display: flex; flex-direction: column; justify-content: center; gap: 2px; overflow: hidden; }
.v511-day-event-pill b { font-size: 12px; font-weight: 700; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.v511-day-event-pill small { font-size: 10px; opacity: 0.85; }
.v511-day-event-pill.room-studio1 { background: rgba(105, 168, 255, 0.22); color: #c8e0ff; border-left-color: #58a6ff; }
.v511-day-event-pill.room-studio2 { background: rgba(99,153,34,0.22); color: #c0dd97; border-left-color: #639922; }
.v511-day-event-pill.room-studio3 { background: rgba(186,117,23,0.25); color: #fac775; border-left-color: #BA7517; }
```

---

### Task 3 — Day chips become day SELECTOR (not scroll-to)

Find the day chip click handler in the existing code (search for `data-week-day` event listener, or `renderDayChips`). Change behaviour:

Before (T4.3.53):
```js
// Click scrolls to that day's strip
document.querySelectorAll('[data-week-day]').forEach(function (chip) {
  chip.addEventListener('click', function () {
    var dow = parseInt(chip.getAttribute('data-week-day'), 10);
    scrollToDay(dow);
  });
});
```

After (T4.3.55):
```js
// Click switches the displayed day in swim-lane view
document.addEventListener('click', function (e) {
  var chip = e.target.closest('[data-week-day]');
  if (!chip) return;
  var dow = parseInt(chip.getAttribute('data-week-day'), 10);
  state.selectedDay = dow;
  renderAll();  // re-render the day chips (highlight new selected), day lanes, etc.
});
```

(Use event delegation since the chips re-render on every `renderAll` and individual listeners would be lost.)

In `renderDayChips()`, update the "current" highlight logic: a chip is `is-current` when `dow === state.selectedDay` (instead of "is today's day-of-week").

Optionally add a separate `is-today` class for a subtle dot or marker on actual-today's chip — useful when the user has selected a different day. But this is polish; not required.

---

### Task 4 — `jumpToNow()` sets selectedDay to today + switches to Swim-lane

The existing `jumpToNow()` function (search for `function jumpToNow`) currently scrolls to today's strip. Update it:

```js
function jumpToNow() {
  var today = dayOfWeekForDate(new Date());
  var thisWeek = isoDate(weekStartFor(new Date()));
  if (state.weekStartIso !== thisWeek) {
    state.weekStartIso = thisWeek;
    saveWeeklyState();
  }
  state.selectedDay = today;
  setView('swimlane');  // existing function to switch view mode
  renderAll();
}
```

---

### Task 5 — Make List view the DEFAULT view mode

Search for the existing initial view-mode setting. There should be either a default `setView('swimlane')` call on init, OR a default state property like `state.view = 'swimlane'`.

Change the default to `'list'`. Suggested location: state initialisation block:

```js
state.view = state.view || 'list';  // default = list
```

If there's an existing call like `setView('swimlane')` in the init path, change it to `setView('list')`.

The view toggle buttons remain unchanged — user can flip to Swim-lane at any time.

---

### Task 6 — Light-mode contrast fix (room-themed event pills)

In the existing `<style>` block, find the section with `:root[data-theme="light"]` overrides for the calendar event pills. The current state (added in T4.3.53) collapses all pills to white background:

```css
:root[data-theme="light"] .v511-week-event-pill,
:root[data-theme="light"] .v511-week-event-pill.room-studio2,
:root[data-theme="light"] .v511-week-event-pill.room-studio3,
:root[data-theme="light"] .v511-event-modal { background: #fff; border-color: rgba(0,0,0,0.14); }
```

**Replace with per-room light-mode variants** that preserve the room colour distinction AND meet WCAG 4.5:1 contrast for the small text. Apply the same overrides to both `.v511-week-event-pill` (existing) and `.v511-day-event-pill` (new in this brief):

```css
/* Light-mode: per-room deeper-saturation overrides for event pills.
   Each room keeps its colour identity but gains contrast against white surface.
   Background tint is light, text is the deep brand version of the room hue,
   border-left stays the saturated room accent. */
:root[data-theme="light"] .v511-week-event-pill.room-studio1,
:root[data-theme="light"] .v511-day-event-pill.room-studio1 {
  background: #d6e8ff;
  color: #0a3d80;
  border-left-color: #1f6feb;
}
:root[data-theme="light"] .v511-week-event-pill.room-studio2,
:root[data-theme="light"] .v511-day-event-pill.room-studio2 {
  background: #d8ecbb;
  color: #2c5b08;
  border-left-color: #1a7f37;
}
:root[data-theme="light"] .v511-week-event-pill.room-studio3,
:root[data-theme="light"] .v511-day-event-pill.room-studio3 {
  background: #fae4b8;
  color: #6b3e00;
  border-left-color: #9a6b00;
}

/* Day-lane label colours in light mode (deeper for readability on white surface) */
:root[data-theme="light"] .v511-day-lane.room-studio1 .v511-day-lane-label { color: #0a3d80; }
:root[data-theme="light"] .v511-day-lane.room-studio2 .v511-day-lane-label { color: #2c5b08; }
:root[data-theme="light"] .v511-day-lane.room-studio3 .v511-day-lane-label { color: #6b3e00; }

/* Day-lane timeline background in light mode */
:root[data-theme="light"] .v511-day-lane-timeline { background: rgba(0,0,0,0.025); }
:root[data-theme="light"] .v511-day-lane { border-top-color: rgba(0,0,0,0.06); }
:root[data-theme="light"] .v511-day-lane:last-child { border-bottom-color: rgba(0,0,0,0.06); }

/* Room tag colours in list view (also need light-mode WCAG pass) */
:root[data-theme="light"] .v511-room-tag.room-studio1 { background: #d6e8ff; color: #0a3d80; }
:root[data-theme="light"] .v511-room-tag.room-studio2 { background: #d8ecbb; color: #2c5b08; }
:root[data-theme="light"] .v511-room-tag.room-studio3 { background: #fae4b8; color: #6b3e00; }
```

Verification of contrast (all WCAG 4.5:1 or better on white):
- `#0a3d80` on `#d6e8ff` — deep navy on pale blue, ~11:1 ✅
- `#2c5b08` on `#d8ecbb` — deep green on pale green, ~8:1 ✅
- `#6b3e00` on `#fae4b8` — deep amber on pale amber, ~7:1 ✅

These match the deeper-saturation palette pattern from v5.11.1 cosmetic cleanup.

---

### Task 7 — Build pill bump

In sidebar footer (line ~3290):

Search for: `mockup T4.3.54`
Replace with: `mockup T4.3.55`

---

## §4 — Acceptance criteria

- [ ] Swim-lane view shows ONE day at a time (not 7 stacked)
- [ ] Each visible room renders as its own horizontal lane (rows = rooms)
- [ ] Time axis 00:00 → 23:59 horizontal, shared across all room lanes
- [ ] Event pills positioned by start_time within their room's lane
- [ ] "Now" line appears only when viewing today
- [ ] Day chips switch the displayed day on click (not scroll)
- [ ] Selected day's chip highlighted via `is-current` class
- [ ] `Jump to now` returns to today + switches to Swim-lane
- [ ] List view is the DEFAULT on fresh page load
- [ ] User can still toggle to Swim-lane via existing view toggle
- [ ] Room filter dropdown still subsets which lanes appear in Swim-lane
- [ ] Light-mode event pills meet WCAG 4.5:1 contrast against white
- [ ] Each room colour identity preserved in light mode (not all collapsed to white)
- [ ] List view's room tags also fixed for light-mode contrast
- [ ] Day-lane labels readable in light mode
- [ ] Build pill reads **T4.3.55**
- [ ] Diff scope: `OrgCheckinTest.html` ONLY — verify with `git diff --name-status origin/main..HEAD`

---

## §5 — Smoke test checklist (Mr. Data, run before opening PR)

1. Hard-refresh test page → view loads in List view by default
2. Click Swim-lane toggle → single day appears with 3 room lanes
3. Click Tue chip → display switches to Tuesday's events
4. Click "+ Add event" in lane → modal opens (existing behaviour)
5. Toggle light mode → all event pills readable, room colours preserved
6. Click Prev week → still on same day-of-week, but in previous week
7. Click Jump to now → returns to today + Swim-lane view
8. Console: no JS errors during view transitions

---

## §6 — PR title

```
v5.11 mockup T4.3.55 — Event & calendar redesign (Swim-lane: single day, rooms-as-rows; List default; light-mode pill contrast fix)
```

---

— Number One.
