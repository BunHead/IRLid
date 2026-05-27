# HANDOVER — Mockup polish (T4.3.56)

**Author:** Number One.
**Drafted:** Saturday 23 May 2026 morning watch.
**Target:** Mr. Data (Codex).
**Scope:** `OrgCheckinTest.html` mockup ONLY. No Worker, no D1, no live HTML, no `js/`.
**Estimated diff:** ~60-100 lines.
**Estimated time:** single PR, ~20-30 min.
**Branch suggestion:** `codex/v5.11-mockup-polish-t4-3-56`.
**Build pill bump:** T4.3.55 → T4.3.56.

**Predecessors:** T4.3.55 (calendar redesign — Swim-lane single-day rooms-as-rows + List default + light-mode pill fix). This brief is a polish pass on items Captain surfaced from his browser eyeball of T4.3.54/55.

---

## §1 — Why

Four small items from Captain's review of the live mockup:

1. **"+ Add room" button is a placeholder** — doesn't do anything. Needs wiring to inline-add a new room row.
2. **"Require proof" defaults to "Required"** — should default to "Off". Matches `CLAUDE.md` design principle: *"all enhancements above v3 are optional, off by default, user-enabled in Settings"*.
3. **Five tab labels are sentence case** — Captain wants Title Case ("Event & Calendar" not "Event & calendar" etc.).
4. **Room vocabulary preset chips** — drop "Treatment room" (too narrow — medical/spa only) and "Dungeon" (not professional). Add "Hall" (broader — school/sports/church/conference) and "Theatre" (performance/lecture/cinema).

All TIER 3 mockup work. Single file.

---

## §2 — Out of scope (do NOT touch)

- Any file other than `OrgCheckinTest.html`
- Worker (`irlid-api-org/`)
- Live dashboard (`OrgCheckin.html`)
- `js/`, `schema.sql`, `memory/`
- localStorage key changes — extend existing keys, don't rename them

---

## §3 — Tasks

### Task 1 — Wire "+ Add room" button (inline-add row pattern)

**Current state** (around line 5702 in `OrgCheckinTest.html`):
```html
<div style="margin-top: 10px;">
  <button type="button" class="v511-btn">+ Add room</button>
  <span class="v511-hint" style="margin-left: 8px;">Each room gets its own venue QR at the entrance; doorman flow scopes to the room you scanned into.</span>
</div>
```

**Target behaviour:** Click → appends a new editable row to the rooms list with three fields (Name, Sub-name, Capacity) + Save / Cancel buttons. Save persists to localStorage state. Cancel removes the draft row.

Suggested implementation:

1. Give the Add Room button an ID: `id="v511AddRoomBtn"`
2. Locate the rooms-list container (search for `v511-rooms-list` or the parent of the existing Studio 1/2/3 rows). Add an empty container at the end of the list for draft rows: `<div id="v511RoomDraftRows"></div>`
3. JS handler:

```js
document.getElementById('v511AddRoomBtn')?.addEventListener('click', function () {
  var draftContainer = document.getElementById('v511RoomDraftRows');
  if (!draftContainer) return;
  var draftId = 'draft-' + Date.now();
  var row = document.createElement('div');
  row.className = 'v511-room-row v511-room-row-draft';
  row.setAttribute('data-draft-id', draftId);
  row.innerHTML = '<div class="v511-room-draft-fields">' +
    '<input type="text" placeholder="Name (e.g. Studio 4)" data-draft-name>' +
    '<input type="text" placeholder="Sub-name (optional, e.g. — yoga)" data-draft-subname>' +
    '<input type="number" placeholder="Capacity" min="1" max="999" data-draft-capacity>' +
    '</div>' +
    '<div class="v511-room-actions">' +
    '<button type="button" class="v511-btn v511-btn-mini" data-draft-save="' + draftId + '">Save</button>' +
    '<button type="button" class="v511-btn v511-btn-mini" data-draft-cancel="' + draftId + '">Cancel</button>' +
    '</div>';
  draftContainer.appendChild(row);
  row.querySelector('[data-draft-name]')?.focus();
});
```

4. Save/Cancel handlers (event delegation on the draft container or document):

```js
document.addEventListener('click', function (e) {
  var saveBtn = e.target.closest('[data-draft-save]');
  var cancelBtn = e.target.closest('[data-draft-cancel]');
  if (saveBtn) {
    var draftId = saveBtn.getAttribute('data-draft-save');
    var row = document.querySelector('[data-draft-id="' + draftId + '"]');
    if (!row) return;
    var name = row.querySelector('[data-draft-name]').value.trim();
    var subname = row.querySelector('[data-draft-subname]').value.trim();
    var capacity = parseInt(row.querySelector('[data-draft-capacity]').value, 10) || 0;
    if (!name) { row.querySelector('[data-draft-name]')?.focus(); return; }
    // Append to the persisted rooms list (extend whatever existing rooms-state key is in use)
    var newRoom = { id: 'studio' + (Math.random().toString(36).slice(2, 8)), label: name, subname: subname, capacity: capacity };
    // Save to state — see implementation note below
    saveRoomToState(newRoom);
    row.remove();
    renderRoomsList(); // re-render the full list including the new row
  } else if (cancelBtn) {
    var draftId = cancelBtn.getAttribute('data-draft-cancel');
    var row = document.querySelector('[data-draft-id="' + draftId + '"]');
    if (row) row.remove();
  }
});
```

5. **Implementation note on state:** The existing rooms (Studio 1/2/3) appear to be either hardcoded in HTML or seeded into `ROOM_META`. Choose the lighter approach:
   - If `ROOM_META` is a plain JS object and rooms are NOT in localStorage yet — add a `v511_mockup_rooms_v1` localStorage key that holds an array of room objects. On load, merge persisted rooms into `ROOM_META`. Initial state seeded with the existing Studio 1/2/3 entries on first load.
   - If rooms are already in some state object — extend that existing pattern.

6. CSS for draft row (add inside the existing `<style>` block near the existing `v511-room-row` rules):

```css
.v511-room-row-draft { background: rgba(105, 168, 255, 0.06); border-left: 2px solid var(--accent, #58a6ff); padding: 6px 8px; border-radius: 4px; }
.v511-room-draft-fields { display: grid; grid-template-columns: 1.4fr 1.4fr 0.6fr; gap: 6px; flex: 1; }
.v511-room-draft-fields input { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; padding: 4px 8px; color: var(--text); font-family: inherit; font-size: 12px; }
:root[data-theme="light"] .v511-room-row-draft { background: rgba(31, 111, 235, 0.06); border-left-color: #1f6feb; }
:root[data-theme="light"] .v511-room-draft-fields input { background: #f3f5f8; border-color: rgba(0,0,0,0.14); color: #0a0a0a; }
```

7. **Existing rooms (Studio 1/2/3) need an Edit/Remove path too** — they already have Edit + × buttons; verify those work to remove rows from state and re-render. If they don't yet, this brief covers wiring them.

---

### Task 2 — "Require proof" default Off

**Current state** (line 5642):
```html
<div class="v511-row"><label>Require proof</label><select><option>Required</option><option>Optional</option><option>Off</option></select></div>
```

**Replace with** (reorder options so the first — and therefore default — is "Off"):
```html
<div class="v511-row"><label>Require proof</label><select><option>Off</option><option>Optional</option><option>Required</option></select></div>
```

The order also reflects the privacy-first preference: Off (default) → Optional → Required.

---

### Task 3 — Title Case audit on five tab labels + matching panel headings

**Tab labels** (lines 5226-5230 in `OrgCheckinTest.html`):

Find and replace:
- `2. Event &amp; calendar` → `2. Event &amp; Calendar`
- `3. Roles &amp; staff` → `3. Roles &amp; Staff`
- `4. Visual theming` → `4. Visual Theming`
- `5. Sign-in &amp; auth` → `5. Sign-in &amp; Auth`
- `6. Tools &amp; diagnostics` → `6. Tools &amp; Diagnostics`

(Tabs 1 "Organisation" and 7 "Records & ID" are already correct.)

**Panel `<h3>` titles** (matching changes, lines 5280-6088):

- `<h3>Event &amp; calendar</h3>` → `<h3>Event &amp; Calendar</h3>` (line 5280)
- `<h3>Roles &amp; staff</h3>` → `<h3>Roles &amp; Staff</h3>` (line 5652)
- `<h3>Visual theming</h3>` → `<h3>Visual Theming</h3>` (line 5711)
- `<h3>Sign-in &amp; auth</h3>` → `<h3>Sign-in &amp; Auth</h3>` (line 6034)
- `<h3>Tools &amp; diagnostics</h3>` → `<h3>Tools &amp; Diagnostics</h3>` (line 6061)

(Panel 1 "Organisation" and 7 "Records & ID" are already correct.)

**Do NOT change:**
- Lowercase function/variable/class names containing these words (`v511CalSwimlane`, `theme-anim-panel`, etc.)
- Sub-section labels like "Staff list", "Past events", "Today's events" — those are sentence-case body labels, not navigation titles; leave them alone.
- Sidebar nav labels ("Organisation", "Check-in", "Dashboard", "Settings") — those are the live app's nav, not the mockup's tab nav; leave alone.

---

### Task 4 — Room vocabulary preset chips: drop Treatment room + Dungeon, add Hall + Theatre

**Current state** (the seven preset chips in the Room vocabulary expander, Roles & Staff tab):

```html
<button type="button" class="v511-btn v511-btn-mini" data-room-vocab-preset="Room|Rooms">Room</button>
<button type="button" class="v511-btn v511-btn-mini" data-room-vocab-preset="Studio|Studios">Studio</button>
<button type="button" class="v511-btn v511-btn-mini" data-room-vocab-preset="Classroom|Classrooms">Classroom</button>
<button type="button" class="v511-btn v511-btn-mini" data-room-vocab-preset="Pitch|Pitches">Pitch</button>
<button type="button" class="v511-btn v511-btn-mini" data-room-vocab-preset="Court|Courts">Court</button>
<button type="button" class="v511-btn v511-btn-mini" data-room-vocab-preset="Treatment room|Treatment rooms">Treatment room</button>
<button type="button" class="v511-btn v511-btn-mini" data-room-vocab-preset="Dungeon|Dungeons">Dungeon</button>
```

**Replace with:**

```html
<button type="button" class="v511-btn v511-btn-mini" data-room-vocab-preset="Room|Rooms">Room</button>
<button type="button" class="v511-btn v511-btn-mini" data-room-vocab-preset="Studio|Studios">Studio</button>
<button type="button" class="v511-btn v511-btn-mini" data-room-vocab-preset="Classroom|Classrooms">Classroom</button>
<button type="button" class="v511-btn v511-btn-mini" data-room-vocab-preset="Pitch|Pitches">Pitch</button>
<button type="button" class="v511-btn v511-btn-mini" data-room-vocab-preset="Court|Courts">Court</button>
<button type="button" class="v511-btn v511-btn-mini" data-room-vocab-preset="Hall|Halls">Hall</button>
<button type="button" class="v511-btn v511-btn-mini" data-room-vocab-preset="Theatre|Theatres">Theatre</button>
```

(Anyone wanting custom vocabulary like "Dungeon" can still type it into the singular/plural input fields below the chips — the chips are just suggested presets.)

---

### Task 5 — Build pill bump

In sidebar footer (line ~3290):

Search for: `mockup T4.3.55`
Replace with: `mockup T4.3.56`

---

## §4 — Acceptance criteria

- [ ] `+ Add room` button opens an inline-edit row with Name / Sub-name / Capacity fields + Save / Cancel
- [ ] Save persists the new room to localStorage; survives hard refresh
- [ ] Save renders the new room in the rooms list with Edit + × actions matching existing rows
- [ ] Cancel removes the draft row without persisting
- [ ] Existing Studio 1/2/3 rooms' Edit + × buttons functional (remove from state, re-render)
- [ ] `Require proof` first option in the `<select>` is "Off" (and is the default on fresh load)
- [ ] Five sentence-case tab labels updated to Title Case (lines 5226-5230)
- [ ] Five panel `<h3>` headings updated to match (lines 5280, 5652, 5711, 6034, 6061)
- [ ] Sub-section labels (Staff list, Past events, etc.) left alone
- [ ] Room vocabulary preset chips: Treatment room + Dungeon removed; Hall + Theatre added in their positions
- [ ] Build pill in sidebar footer reads **T4.3.56**
- [ ] Diff scope: `OrgCheckinTest.html` ONLY — verify with `git diff --name-status origin/main..HEAD`

---

## §5 — Smoke test checklist (Mr. Data, run before opening PR)

1. Hard-refresh test page → tabs read Title Case (Event & Calendar / Roles & Staff / Visual Theming / Sign-in & Auth / Tools & Diagnostics)
2. Open Event & Calendar tab → `Require proof` shows "Off" by default
3. Open Roles & Staff tab → click `Studio` preset chip → singular/plural inputs flip to "Studio"/"Studios" + calendar UI updates
4. Open Roles & Staff → expand `Rooms / spaces` → click `+ Add room` → inline row appears with three input fields
5. Type a name + capacity → click Save → new room appears in the list permanently
6. Hard-refresh → new room persists
7. Click × on the new room → row removed
8. Console: no JS errors during any of the above

---

## §6 — PR title

```
v5.11 mockup T4.3.56 — Wire +Add room (inline-add) + Require proof default Off + Title Case tab labels (×5) + Room vocab preset swap (Hall/Theatre in, Treatment room/Dungeon out)
```

---

— Number One.
