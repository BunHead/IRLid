# HANDOVER — v5.11.0m Wire Visual Theming Save + replace global banner with honest per-tab labelling

**Target pill bump:** `v5.11.0l` → `v5.11.0m`
**Service worker cache bump:** `v22` → `v23`
**Live repo:** `D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo`
**Branch:** `codex/v5.11.0m-visual-theming-save`
**Captain's framing:** "Fully demo ready." The current global banner "v5.11 calendar — visual prototype only. Form clicks don't save." is a credibility-undermining confession that any demo viewer will see. Visual Theming is the most visually impactful tab; wiring its save makes a clean demo moment ("change a colour → save → Check-in tab updates"). Other unwired tabs get per-tab "design-in — v5.12" honest labelling instead of the global disclaimer.

---

## 1. Three pieces

### 1.1 Wire `v511VisualSaveBtn` to actually save Visual Theming

**Reference:** `saveSettings()` at `Org.html` line ~11720 is the canonical OLD save logic — uses POST `/org/settings`, builds payload from DOM, returns success/error. Mr. Data should follow its pattern.

**The Visual Theming controls in the new v5.11 UI** (roughly lines 5891–6209) include:
- Mode picker (Allow / Review / Deny — `v511ModeBadge`, modeStates object)
- Background mode + palette + image controls (`v511BgImageEnable`, `v511BgPatternEnable`, swatches)
- Pattern controls (Tier-1 CSS patterns)
- Celebration palette + Library/Sequence builder + Effect settings (the 19 May architectural rebuild)
- QR foreground colour
- Outcome sound (Post-Accept Behaviour)
- Theme mode (light/dark/auto)

**The wire-up:**

1. On `v511VisualSaveBtn` click:
   a. Read all Visual Theming control state from the DOM + JS state objects (e.g., `modeStates`, sequence arrays, palette arrays)
   b. **GET `/org/settings` first** to fetch current full settings (Worker does full-replace, not merge — clobbering risk if we don't read first)
   c. Build a merged payload: start with current settings, overlay the new `theme.*` values
   d. POST `/org/settings` with the merged payload
   e. On success, trigger the `v511SavedPulse` element (it has CSS `.is-pulsing` class for the success flash)
   f. On error, show inline error in the same pulse region
2. Visual Theming should NOT need any Worker changes — the existing POST `/org/settings` accepts the `theme` field already (the magenta-dragon theme renders from D1 via this exact path).
3. Cross-check by inspecting the existing `theme` shape in the GET response from `/org/settings` (call from browser DevTools, or look at the Visual Theming tab's render code in Org.html for how it reads `theme.*`).

**Critical:** preserve all other settings (minScore, gpsAccuracy, etc.) in the merged payload. Do NOT send a partial payload that wipes other fields.

### 1.2 Remove the global banner

`Org.html` line 6335 — the `<div class="v511-banner">` element with "v5.11 calendar — visual prototype only. Form clicks don't save..." text. **Delete this element entirely.**

### 1.3 Per-tab honest labelling

Each tab heading currently has a "backed" green badge (lines 5399, 5443, 5832, 5891, 6214, 6241). Augment with a SECOND badge indicating SAVE WIRING STATUS:

- **Visual Theming** (wired in this PR): add badge `<span class="v511-badge v511-badge-live">live save</span>` (green, similar style to `v511-badge-backed`)
- **All other main tabs** (Organisation, Event & Calendar, Staff & Rooms, Sign-in & Auth, Tools & Diagnostics, Records & ID): add badge `<span class="v511-badge v511-badge-pending">design-in — v5.12</span>` (amber/orange — define the CSS class similar to `v511-badge-backed` but with amber colours)

The wording matters — "design-in — v5.12" communicates "this surface is real and being actively built, not abandoned." Captain's prior architectural framing for placeholder UI: "hide until backed" — this is the visible equivalent for surfaces that ARE backed (Worker side) but not yet UI-wired.

CSS for the new amber badge (add near the existing `.v511-badge-backed` rule at line 3633):

```css
.v511-badge-pending { background: rgba(204, 153, 51, 0.2); color: #e0c277; }
:root[data-theme="light"] .v511-badge-pending { background: rgba(204, 153, 51, 0.18); color: #6b4f10; }
```

---

## 2. Out of scope (do NOT change)

- Other tabs' Save button wiring — `v511OrgSaveBtn`, `v511AuthSaveBtn`, `v511ToolsSaveBtn`, etc. Those stay unwired this PR; their amber "design-in — v5.12" badge signals this honestly.
- The Event & Calendar tab's calendar interaction widgets — those have their own architectural complexity (event creation, room CRUD). Out of scope.
- Staff & Rooms tab's "Invite Staff" QR flow — separate forward work.
- The OLD `savePortalSettingsBtn` and `saveSettings()` function — leave them in place (hidden in UI but functional under the hood for any code path that calls them).
- Calendar Auto-save behaviour (Event Defaults, Room Vocabulary) — leave as-is.

---

## 3. Pill + cache bumps

After all code changes:
- `Org.html` build pill: `v5.11.0l` → `v5.11.0m`
- `sw.js` `CACHE_VERSION`: `irlid-shell-v22` → `irlid-shell-v23` with comment noting v5.11.0m Visual Theming save wire-up

---

## 4. Acceptance criteria

After Captain merges + `wrangler deploy` (note: no Worker changes expected; deploy not strictly needed unless something changed) + hard-refresh:

1. **Banner gone:** No more "v5.11 calendar — visual prototype only" text at the bottom of Settings.
2. **Per-tab badges visible:** Visual Theming shows "backed" + green "live save". Other tabs show "backed" + amber "design-in — v5.12".
3. **Visual Theming save round-trip works:** Change ONE palette colour (e.g., switch the primary swatch from current to bright red). Click **Save all settings** on Visual Theming tab. `v511SavedPulse` flashes "✓ Saved" green. Hard-refresh `/Org`. Navigate to Visual Theming. The red swatch is still there.
4. **Check-in tab reflects the change:** Navigate to Check-in tab. The magenta-dragon background colour should be updated to whatever palette change was saved. (May require closing/reopening tab to evict client-side cached theme JS.)
5. **No regression of other tabs:** Click Save on Organisation tab → nothing happens (no click handler) but no JS console errors either. Same for Auth / Tools tabs.
6. **Build pill reads `v5.11.0m`.**

---

## 5. Diagnostic notes

- The `theme` payload shape is in the existing `saveSettings()` function — examine what fields it sends under the `theme` key. Match that shape.
- The new v5.11 Visual Theming UI stores per-mode state in a JS object called `modeStates` (search for it). That's the source of truth for the new palette/celebration state.
- The Worker POST `/org/settings` handler is in `irlid-api-org/src/index.js` — find it to confirm the expected payload shape and the response format.

---

## 6. Codex prompt template (Captain pastes verbatim)

```
Read HANDOVER-VisualThemingSave-v5.11.0m.md at repo root and execute.

Branch: codex/v5.11.0m-visual-theming-save
Open PR against main when complete.
Reply with PR number + one-paragraph diagnosis of the v5.10.x→v5.11 theme payload mapping you discovered + a list of which tabs got which badge.
```

---

— Number One, drafted 25 May 2026 evening
