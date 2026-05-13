# HANDOVER — Role vocabulary carries to "Viewing as" + role pills (`v5.9.0.13.28` candidate)

**Repo:** IRLid-repo (LIVE — irlid.co.uk)
**Files involved:** `OrgCheckin.html` (only)
**Scope:** Single PR. Make the custom Role vocabulary labels (set in Settings → Role vocabulary) flow through to every UI surface that currently shows hard-coded role names.

## Why this matters

The Role vocabulary Settings panel already lets users rename Attendee / Staff / Manager / Lead admin / Developer (presets: Default / Education / Corporate / Healthcare / Hospitality / Conference / Custom). The labels save and persist correctly today, but they only affect static reference text — the live dashboard still shows hard-coded English role names in two places that the Captain interacts with constantly:

1. The **"Viewing as:" dropdown** in the Dashboard panel — options still say `Attendee / Staff / Manager / Lead admin / Developer`.
2. The **role-pill badges** on attendance rows (the small initial-or-letter chip in the Role column — currently shows `A` for Attendee, `S` for Staff, etc.) — the letter and tooltip should reflect the renamed role.

With this PR, picking "Education" preset (or a custom set like "Priest / Bishop / Cardinal / Pope / God") changes those surfaces to match.

## Helper already exists

A `window.roleLabel(roleKey)` function is already exposed and returns the user's chosen label for any of the five role keys (`attendee` / `staff` / `manager` / `lead_admin` / `developer`). It falls back to the Default preset's label if the user hasn't set a custom one for that key. Re-use this — don't re-implement the lookup.

## Surface 1 — "Viewing as" dropdown

In `OrgCheckin.html`, find the `<select>` element for the "Viewing as" picker. Its `<option>` elements have `value="attendee"`, `value="staff"`, etc.

Change strategy: instead of editing the static `<option>` text in HTML, write a small function `applyRoleLabelsToViewingAs()` that runs after Role vocabulary save and on initial page load:

```js
function applyRoleLabelsToViewingAs() {
  const sel = document.getElementById('viewingAsSelect'); // or whatever the existing id is
  if (!sel) return;
  Array.from(sel.options).forEach(opt => {
    const key = opt.value;
    if (key) opt.textContent = window.roleLabel(key);
  });
}
```

Call it:
- On initial page load, after the user's saved theme/settings have loaded.
- After the Role vocabulary panel's save succeeds (find the existing "Save All Settings" / role-vocab save handler and add the call there).
- After a settings reload from server (the existing readback parity check path).

## Surface 2 — Role-pill badges on attendance rows

Find where the role pill is rendered for attendance rows (look for the function that builds the `<td>` for the Role column, probably named something like `renderRolePill(role)` or inline in the row template). It currently produces something like:

```html
<span class="role-pill role-pill-staff" title="Staff">S</span>
```

Update it to use `roleLabel(role)` for the tooltip and derive the displayed character from the FIRST CHARACTER of `roleLabel(role)`:

```js
function renderRolePill(role) {
  const label = window.roleLabel(role) || role;
  const initial = (label || '?').trim().charAt(0).toUpperCase();
  return `<span class="role-pill role-pill-${role}" title="${escapeHtml(label)}">${escapeHtml(initial)}</span>`;
}
```

(The function probably already exists with a different name — use whatever's there. The point is: tooltip = full label, displayed char = first letter of label.)

After Role vocabulary save, **re-render the attendance table** so pills pick up the new labels. The existing attendance render path can be called directly (e.g. `renderAttendance()` or whatever the function name is). One call at the end of the save handler does it.

## Edge cases

- **Custom label is empty** (user wiped a field): fall back to the Default preset's label for that role key. `roleLabel()` already handles this — don't add extra fallback logic, just trust the helper.
- **Custom label is one character** (e.g. user types just "X"): pill shows "X", tooltip shows "X". Fine.
- **Custom label is very long** (e.g. "Honourable Reverend Lord"): pill still shows just the first character "H". Tooltip shows the full label. The role column width doesn't need to change.
- **Two roles share the same initial** (e.g. "Steward" and "Supervisor" both start with "S"): visually ambiguous but functionally fine — the tooltip disambiguates. Don't try to be clever about this; users picking colliding initials is their call.

## Acceptance criteria

1. With Role vocabulary set to **Education** preset, the Dashboard's "Viewing as" dropdown options read **Student / Teacher / Department head / Principal / Sysadmin** (or whatever the Education preset labels are — match what's already in the preset definitions).
2. With Role vocabulary set to **Custom** with `attendee = "Priest"`, `staff = "Bishop"`, `manager = "Cardinal"`, `lead_admin = "Pope"`, `developer = "God"`: the "Viewing as" dropdown reads exactly those five labels, and the role pills on attendance rows show `P / B / C / P / G` with the full label in the tooltip.
3. After clicking "Save All Settings" on the Role vocabulary panel, BOTH surfaces update without a page reload.
4. After a hard refresh, BOTH surfaces still show the saved labels (persistence is unchanged from the existing save-and-readback flow — this PR doesn't touch the storage layer).
5. Build pill bumped to `v5.9.0.13.28`.

## Out of scope (do NOT add to this PR)

- CSV Role column (separate stashed branch `codex/wip-role-vocab-csv-column` covers this).
- Role-gated UI visibility (separate concern — hiding "Viewing as" for non-developers is a different PR).
- Localised / RTL handling of the first-character extraction. ASCII is fine for now.
- New Role vocabulary presets. The existing six are sufficient.

Keep the PR tight: two function calls wired into existing handlers, ~30 lines of diff. No new CSS, no new endpoints, no schema changes.

## Style / convention notes

- British spellings throughout.
- Match existing escapeHtml / DOM helper conventions — don't introduce a new sanitisation pattern.
- The Worker side needs no changes (the labels already round-trip through `theme.roleVocabulary` in the existing settings save).

Ship as a single PR labelled `v5.9.0.13.28`. Captain will verify on his desktop dashboard with the Custom preset set to the Catholic-hierarchy joke labels.
