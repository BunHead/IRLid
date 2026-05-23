# HANDOVER — Event defaults rename + late-grace rows + week-start toggle + Room vocabulary (T4.3.54)

**Author:** Number One.
**Drafted:** Saturday 23 May 2026 morning watch.
**Target:** Mr. Data (Codex).
**Scope:** `OrgCheckinTest.html` mockup ONLY. No Worker, no D1, no live HTML, no `js/`.
**Estimated diff:** ~100-150 lines.
**Estimated time:** single PR, under 30 min.
**Branch suggestion:** `codex/v5.11-mockup-event-defaults`.
**Build pill bump:** T4.3.53 → T4.3.54.

---

## §1 — Why

Four small polish items left over from the T4.3.53 weekly calendar work. Captain spotted that the existing "Default event settings" expander was already the right home for the new late-grace settings — no need for a duplicate "Calendar settings" panel. The week-start day is a calendar VIEW preference and belongs in the navigator toolbar. The hardcoded `WEEK_STARTS_MONDAY` const becomes a real setting. Room vocabulary mirrors the existing role vocabulary pattern in the Roles & staff tab.

All TIER 3 mockup work. Single file. Single PR.

---

## §2 — Out of scope (do NOT touch)

- Any file other than `OrgCheckinTest.html`
- Worker (`irlid-api-org/`)
- Live dashboard (`OrgCheckin.html`)
- `js/`, `schema.sql`, `memory/`
- Per-event Expected list wiring (v6+)
- Per-room late-grace override (v6+)
- One-off event date overrides (v6+)

---

## §3 — Tasks

### Task 1 — Rename "Default event settings" → "Event defaults"

File: `OrgCheckinTest.html`, the existing `<details>` expander inside the Event & calendar tab body. Search for the exact string:

```
Default event settings
```

Current state:
```html
<details class="v511-expander">
  <summary>Default event settings <span class="v511-hint-inline">(applied to any new event unless the event overrides them)</span></summary>
```

Replace with:
```html
<details class="v511-expander">
  <summary>Event defaults <span class="v511-hint-inline">(applied to any new event unless overridden)</span></summary>
```

(Subtitle tightens — "unless overridden" is cleaner than "unless the event overrides them".)

---

### Task 2 — Add Late check-in grace before/after rows

Inside the Event defaults expander body. Currently the rows are: Default duration → Check-out grace → Minimum trust score → Privacy mode → Require proof.

Insert two new rows immediately after "Check-out grace":

```html
<div class="v511-row"><label>Late check-in grace before</label><input type="text" value="15 minutes" /></div>
<div class="v511-row"><label>Late check-in grace after</label><input type="text" value="30 minutes" /></div>
```

Final order: Default duration → Check-out grace → **Late check-in grace before** → **Late check-in grace after** → Minimum trust score → Privacy mode → Require proof.

(Display-only inputs at this stage — no JS wiring required; the other rows in this expander are also visual placeholders.)

---

### Task 3 — Week-start toggle in the week navigator + wire `WEEK_STARTS_MONDAY` to localStorage

#### 3a — UI

In the week navigator toolbar (currently contains `v511PrevWeekBtn`, `v511NextWeekBtn`, `v511ExportWeekBtn`, `v511JumpNowBtn`), add a new button:

```html
<button type="button" class="v511-btn v511-btn-mini" id="v511WeekStartToggle" title="Toggle week start day">Week starts: Mon</button>
```

Place it next to (or just before) the Jump-to-now button — anywhere within the toolbar group is fine, but keep it visually grouped with the other nav controls.

#### 3b — State

Add a new localStorage key:

```js
var V511_CAL_SETTINGS_KEY = 'v511_mockup_calendar_settings_v1';

function loadCalSettings() {
  try {
    var raw = localStorage.getItem(V511_CAL_SETTINGS_KEY);
    if (!raw) return { week_starts_on: 1, room_vocabulary_singular: 'Room', room_vocabulary_plural: 'Rooms' };
    var parsed = JSON.parse(raw);
    return Object.assign({ week_starts_on: 1, room_vocabulary_singular: 'Room', room_vocabulary_plural: 'Rooms' }, parsed);
  } catch (e) {
    return { week_starts_on: 1, room_vocabulary_singular: 'Room', room_vocabulary_plural: 'Rooms' };
  }
}

function saveCalSettings(patch) {
  var current = loadCalSettings();
  var next = Object.assign({}, current, patch);
  localStorage.setItem(V511_CAL_SETTINGS_KEY, JSON.stringify(next));
  return next;
}
```

Replace the hardcoded const around line 6212:

```js
// Was: var WEEK_STARTS_MONDAY = true;
function weekStartsMonday() { return loadCalSettings().week_starts_on === 1; }
```

Update `weekStartFor()` (around line 6229) to call `weekStartsMonday()` instead of reading the const:

```js
function weekStartFor(date) {
  var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  var day = d.getDay();
  d.setDate(d.getDate() + (weekStartsMonday() ? (day === 0 ? -6 : 1 - day) : -day));
  return d;
}
```

Same swap anywhere else `WEEK_STARTS_MONDAY` is referenced (search the file — there should be a small number of references).

#### 3c — Toggle behaviour

Wire the new button:

```js
var weekStartBtn = document.getElementById('v511WeekStartToggle');
if (weekStartBtn) {
  function updateWeekStartBtn() {
    weekStartBtn.textContent = 'Week starts: ' + (weekStartsMonday() ? 'Mon' : 'Sun');
  }
  updateWeekStartBtn();
  weekStartBtn.addEventListener('click', function () {
    saveCalSettings({ week_starts_on: weekStartsMonday() ? 7 : 1 });
    updateWeekStartBtn();
    renderAll();  // or whatever the top-level re-render function is called
  });
}
```

After clicking, the grid + day chips + ticks should re-render in the new starting order, and the change should survive a hard refresh.

---

### Task 4 — "Room vocabulary" expander in Roles & staff tab

Add a sibling `<details>` expander immediately after the existing "Role vocabulary" expander in the Roles & staff tab. Use the same `v511-expander` class and same structural pattern (preset chips + input rows + hint):

```html
<details class="v511-expander">
  <summary>Room vocabulary <span class="v511-hint-inline">(what YOUR org calls rooms)</span></summary>
  <div class="v511-expander-body">
    <div class="role-vocab-presets" role="group" aria-label="Room vocabulary presets">
      <button type="button" class="v511-btn v511-btn-mini" data-room-vocab-preset="Room|Rooms">Room</button>
      <button type="button" class="v511-btn v511-btn-mini" data-room-vocab-preset="Studio|Studios">Studio</button>
      <button type="button" class="v511-btn v511-btn-mini" data-room-vocab-preset="Classroom|Classrooms">Classroom</button>
      <button type="button" class="v511-btn v511-btn-mini" data-room-vocab-preset="Pitch|Pitches">Pitch</button>
      <button type="button" class="v511-btn v511-btn-mini" data-room-vocab-preset="Court|Courts">Court</button>
      <button type="button" class="v511-btn v511-btn-mini" data-room-vocab-preset="Treatment room|Treatment rooms">Treatment room</button>
      <button type="button" class="v511-btn v511-btn-mini" data-room-vocab-preset="Dungeon|Dungeons">Dungeon</button>
    </div>
    <div class="v511-row" style="margin-top: 10px;">
      <label>Singular</label><input type="text" id="v511RoomVocabSingular" placeholder="e.g. Studio" />
    </div>
    <div class="v511-row">
      <label>Plural</label><input type="text" id="v511RoomVocabPlural" placeholder="e.g. Studios" />
    </div>
    <div class="v511-hint" style="padding: 4px 0;">Replaces the literal text "Room" / "Rooms" throughout the calendar UI.</div>
  </div>
</details>
```

Wiring:
- Preset chip click → set both inputs (from `data-room-vocab-preset` attribute, format `"singular|plural"`) + persist to `v511_mockup_calendar_settings_v1.room_vocabulary_singular` + `.room_vocabulary_plural` + trigger calendar re-render.
- Manual input → same persistence on `input` or `change` event, debounce optional.
- On page load, prefill both inputs from saved settings (default "Room"/"Rooms").

Apply the vocabulary throughout the **Event & calendar tab** UI text — anywhere the literal strings `"Room"` or `"Rooms"` appear in display text (NOT in class names, IDs, or comments):
- Calendar grid column headers if rooms are columns
- Room filter dropdown label / placeholder
- "Room" column header in CSV exports (column header text, not filename)
- Any "Add room" / "Edit room" button labels in the calendar tab context

**Do NOT change:**
- The "Rooms / spaces" expander heading in Roles & staff tab itself (that's the structural panel where rooms are managed; leave its label alone)
- CSS class names containing `room` (e.g. `.v511-room-tag`, `.room-studio1`)
- Variable / function names in JS
- HTML IDs

Helper functions for the calendar render code:
```js
function roomVocabSingular() { return loadCalSettings().room_vocabulary_singular || 'Room'; }
function roomVocabPlural() { return loadCalSettings().room_vocabulary_plural || 'Rooms'; }
```

Substitute these at render time so the text refreshes when the user changes the vocabulary.

---

### Task 5 — Build pill bump

In the sidebar footer (line ~3290):

Search for: `mockup T4.3.53`
Replace with: `mockup T4.3.54`

---

## §4 — Acceptance criteria

- [ ] Expander heading reads **"Event defaults"** (not "Default event settings")
- [ ] Subtitle reads "(applied to any new event unless overridden)"
- [ ] Two new rows present in expander: Late check-in grace before, Late check-in grace after — placed between Check-out grace and Minimum trust score
- [ ] Week-start toggle button visible in week navigator toolbar; label updates Mon↔Sun on click
- [ ] Clicking toggle reorders the week grid + day chips immediately
- [ ] Week-start setting survives hard refresh (localStorage round-trip)
- [ ] `WEEK_STARTS_MONDAY` const removed/replaced; no hardcoded references remain
- [ ] Room vocabulary expander present in Roles & staff tab, after Role vocabulary
- [ ] Seven preset chips work (Room / Studio / Classroom / Pitch / Court / Treatment room / Dungeon)
- [ ] Manual input persists across hard refresh
- [ ] Vocabulary singular/plural replaces literal "Room"/"Rooms" in Event & calendar tab UI text (not class names / IDs / structural Roles-tab labels)
- [ ] Build pill in sidebar footer reads **T4.3.54**
- [ ] Diff scope: `OrgCheckinTest.html` ONLY — verify with `git diff --name-status origin/main..HEAD` before opening PR

---

## §5 — PR title

```
v5.11 mockup T4.3.54 — Event defaults rename + late-grace rows + week-start toggle + Room vocabulary (Roles tab)
```

---

— Number One.
