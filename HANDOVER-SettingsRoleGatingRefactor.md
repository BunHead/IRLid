# HANDOVER — Settings panel role-gating refactor (`v5.9.0.15` candidate)

**Repo:** IRLid-repo (LIVE — irlid.co.uk)
**Files:** `OrgCheckin.html` (Settings panel structure, nav-item gating, per-section gating), `irlid-api-org/src/index.js` (Worker per-field save validation).
**Scope:** Open the Settings panel to Manager-tier with per-item role-gating inside, so Manager users can manage their own theming / role vocabulary without needing the Lead Admin to do every change. Sensitive items (invite issuance, Org Terms, QR test tools) stay Lead-Admin-only.

**Depends on:** `v5.9.0.14` (Staff-invite QR — Brief A) being merged into main. The invite section added in `v5.9.0.14` gets a `data-min-role="lead_admin"` gate in this PR.

---

## Background

Currently `#navSettings` carries `data-min-role="lead_admin"`, so Manager-tier users can't reach the Settings panel at all. That means a Manager can't even tweak the theme palette or the role vocabulary preset for their org without escalating to the Lead Admin — which is a real bottleneck once orgs grow past one or two admins.

Captain's design call (13 May evening): open Settings to Manager, but with **per-item role-gating** so Manager-sensitive items remain hidden. Uses the existing `data-min-role` attribute pattern that nav items already use — extends it inside Settings.

## Changes

### 1. Settings nav-item

Change the existing line in `OrgCheckin.html`:

```html
<div class="nav-item" id="navSettings" data-min-role="lead_admin" onclick="showPanel('settings', this)">⚙ <span>Settings</span></div>
```

to:

```html
<div class="nav-item" id="navSettings" data-min-role="manager" onclick="showPanel('settings', this)">⚙ <span>Settings</span></div>
```

Manager-tier and above now see the Settings nav item.

### 2. Per-section role-gating

Each Settings section (currently rendered as a `<details>` / `<div class="settings-card">` / similar) gets a `data-min-role` attribute. Recommended gating:

| Section | min_role | Rationale |
|---|---|---|
| Role vocabulary | `manager` | Manager configures org's role labels for their context. |
| Celebration animation | `manager` | Presentation; no security impact. |
| Background image | `manager` | Presentation; no security impact. |
| Website theme import (placeholder) | `manager` | Presentation; placeholder, harmless. |
| QR test tools | `lead_admin` | Debug surface; affects venue QR generation. |
| Org Terms display field | `lead_admin` | Legal text shown to attendees; high-stakes. |
| **Invite staff** (from Brief A) | `lead_admin` | The whole point of locking down invite issuance. |
| Save All Settings button | `manager` | Manager can save the subset of fields they're allowed to edit. |

Visibility logic: CSS gate at the top of the Settings panel:

```css
body[data-prototype-role="staff"] .settings-section[data-min-role="manager"],
body[data-prototype-role="staff"] .settings-section[data-min-role="lead_admin"],
body[data-prototype-role="manager"] .settings-section[data-min-role="lead_admin"] {
  display: none;
}
```

(Or equivalent rule using the existing role-prefix selectors. Match the pattern used by `prototype-note` and the role-toolbar gates.)

### 3. Worker per-field save validation

The existing settings-save endpoint (`POST /org/settings` or whatever the current name is — check the Worker) needs to validate each submitted field against the caller's role. Roughly:

```js
const fieldMinRoles = {
  roleVocab: 'manager',
  themePalette: 'manager',
  celebrationConfig: 'manager',
  backgroundImage: 'manager',
  qrTestConfig: 'lead_admin',
  orgTerms: 'lead_admin',
};

for (const [field, value] of Object.entries(req.body.settings)) {
  const required = fieldMinRoles[field] || 'lead_admin';  // default: lead_admin if unknown
  if (!roleAtLeast(callerRole, required)) {
    return error400(`field_role_denied:${field}`);
  }
}
```

`roleAtLeast(actual, required)` follows the existing role-order helper (or build one inline — order is `attendee < staff < manager < lead_admin < developer`).

### 4. Save-and-toast feedback

If a Manager submits a Save with no allowed fields changed (e.g., they tried to fiddle with a Lead-Admin-only field via DevTools), the existing "Saved" toast should not fire — instead a clearer "Nothing to save / one or more fields not permitted for your role" toast. UI honesty matters here.

## Acceptance criteria

1. **Manager sees Settings nav:** Signed-in Manager → `#navSettings` is visible.
2. **Manager sees the right subset:** Inside Settings, Manager sees Role Vocabulary, Celebration animation, Background image, Theme import placeholder. Manager does **not** see QR test tools, Org Terms field, or the Invite staff section.
3. **Lead Admin sees everything:** Lead Admin sees all sections including the Manager-accessible ones plus QR test tools, Org Terms, Invite staff section.
4. **Manager can save their fields:** Manager edits role vocabulary, clicks Save, toast confirms, hard-refresh shows persistence.
5. **Manager can't save Lead-Admin fields via DevTools:** crafted POST with `orgTerms` payload returns `400 field_role_denied:orgTerms`. No silent acceptance.
6. **Developer override still works:** Developer-tier session is treated as `>=lead_admin` for all gating.
7. **No regression to `.34`:** the `body:not(.developer-bearer-active) .prototype-role-toolbar` gate from `.34` still hides the Viewing-as toolbar for non-developers.
8. **Audit log readiness:** the per-field save validation should include a structured log line for each save (e.g., `[settings] actor=<fp> role=<role> field=<field> action=save`). This isn't the full audit log from Brief A2 — just structured logging that A2 can later parse / persist.
9. **Pill bump:** `Build v5.9.0.14` → `Build v5.9.0.15`.

## Out of scope (deferred)

- Per-field UI hint on the Manager's view explaining *why* certain sections are hidden. (Manager just doesn't see them — no explanation needed.)
- Audit log persistence. That's Brief A2.
- Granular Manager-can-do-X-but-not-Y within a section (e.g., Manager can edit role vocab labels but not the preset selector). All sections are pass/fail at the role level for now.
- New role tiers between Manager and Lead Admin.

## Style notes

- British spellings.
- Reuse the existing `data-min-role` attribute pattern that's already on nav items. Don't invent a new naming.
- CSS gating matches the pattern used by `body:not(.developer-bearer-active) .prototype-note { display: none }` from `v5.7.x` and the `.34` toolbar gate.
- Worker per-field validation should be table-driven (`fieldMinRoles` map) so adding fields later is one-line.
- The save endpoint response should clearly distinguish "saved N fields" vs "rejected M fields" — both shapes useful for future audit / debug.

Ship as single PR labelled `v5.9.0.15`. Expected ~150-300 lines: CSS gates + HTML attribute additions + Worker per-field validation + minor JS for save-feedback toast. Captain verifies by signing in as Manager (via the Viewing-as dropdown while still developer-tier) and confirming visibility matches the table above.
