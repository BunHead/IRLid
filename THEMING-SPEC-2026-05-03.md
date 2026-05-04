# Batch 6.5 — Theming Panel + Settings Persistence

**Issued:** 3 May 2026 by Number One (Sunday evening watch).
**Repo scope:** `BunHead/IRLid-TestEnvironment` only. Captain ports to live after review.
**Target ship date:** Wednesday 6 May 2026.
**Predecessor:** `ORG-AUDIT-2026-05-03.md` (sister doc). Read first if context is missing.

---

## What this batch delivers

1. **Theming panel** beneath Branding in the Org Settings card:
   - Three colour pickers (Primary, Accent, QR foreground) using the **iro.js** HSV wheel.
   - **Customisable palette of up to 7 colours** for celebration animations, with `[+]` add and `[×]` remove controls.
   - **Accept-cycle animation:** on a successful check-in, the success element cycles through the configured palette as a celebration glow. Toggle-able per org.
   - **Light/dark mode toggle for the entire interface**, persisted in `settings_json` (with `'auto'` honouring `prefers-color-scheme`).
   - Server-side validation including QR-foreground contrast ≥ 4.5:1 against white (rejects unscannable QRs even if frontend warning is bypassed).

2. **Server-side settings persistence** via the existing `POST /org/settings` endpoint (allowlist extended to cover theme, branding, and policy keys).

3. **Org Portal cleanup:**
   - Remove orphan OLD-style `.toggle-row` block from `OrgCheckin.html` (lines 752-770).
   - **org.html retired to a redirect/shim** that points at `OrgCheckin.html` — formal separation per Mr. Data's design doc §"Tomorrow Wiring List".

4. **First-scan placeholder integration:** the three previously-orphan toggles (`allowSelfSelection`, `allowProofRecording`, `enableIdPhotoCapture`) are wired into the `renderIdentityPicker` flow in `org-entry.html`. They were *designed* for the first-time check-in path but never *consumed* — this batch closes that gap.

---

## What's already done in this commit (test-env edits applied 3 May evening)

### Edit 1 — Worker `orgUpdateSettings` allowlist extended

**File:** `irlid-api/src/index.js`, function `orgUpdateSettings()`.

The Worker's settings allowlist was previously seven keys (`minScore, distanceM, windowS, bioRequired, privacyMode, checkoutEnabled, anonymousMode`). Frontend writes to other keys (theme, logoUrl, returnAllowed, etc.) were being silently dropped. The allowlist is now extended to cover all current settings PLUS the new theme object, with full validation:

- **Hex format check** for `theme.primary`, `theme.accent`, `theme.qrFg` (`/^#[0-9A-Fa-f]{6}$/`).
- **WCAG-style relative-luminance contrast** for `theme.qrFg` against white background — rejects values below 4.5:1 with a clear error message. This is the server-side belt-and-braces against an admin bypassing the frontend warning.
- **Palette length cap at 7** entries.
- **Type checks** on `theme.darkMode` (`true | false | 'auto'`) and `theme.acceptCycleEnabled` (boolean).
- **Length cap** on `welcomeMessage` (2000 chars) to prevent admins pasting a 1MB welcome.

### Edit 2 — `js/orgapi.js` adds `getOrgSettings()` and `updateOrgSettings()`

The org API client now exposes:

```js
IRLidOrgApi.getOrgSettings(orgKey)
  // GET /org/settings
  // Returns: { id, name, slug, settings }

IRLidOrgApi.updateOrgSettings(orgKey, partial)
  // POST /org/settings
  // Body: a partial settings object — server merges with current.
  // Returns: { settings } with merged current state.
```

The OrgCheckin Theming panel will use these to load on open and save on change.

---

## Remaining implementation — file by file

### Edit 3 — `OrgCheckin.html` Theming panel

**Location:** insert as a new `.settings-group` directly after the existing "Branding and post-accept behaviour" group, inside the existing `.settings-card-body`. Find the closing `</div>` of the Branding group and append before it closes the parent.

**Add iro.js CDN** in the `<head>` after the existing `qrcodejs` script:

```html
<script src="https://cdn.jsdelivr.net/npm/@jaames/iro@5/dist/iro.min.js"></script>
```

**Remove orphan OLD-style toggle block** at lines 752-770 (the `<div class="toggle-row">` block referencing `togToggle('bio')` etc.). Keep the NEW `.switch-tile` block at lines 798-818.

**Add new Theming group HTML:**

```html
<div class="settings-group" id="settingsThemeGroup">
  <h4>Theme</h4>

  <!-- Light/dark mode toggle -->
  <div class="theme-mode-row">
    <span class="theme-mode-label">Interface mode</span>
    <div class="theme-mode-options">
      <label><input type="radio" name="themeMode" value="dark" checked /> Dark</label>
      <label><input type="radio" name="themeMode" value="light" /> Light</label>
      <label><input type="radio" name="themeMode" value="auto" /> Match device</label>
    </div>
  </div>

  <!-- Three core colours -->
  <div class="settings-grid-3 theme-pickers">
    <div class="settings-field">
      <span>Primary colour</span>
      <div class="iro-mount" id="themePrimaryWheel"></div>
      <input type="text" id="themePrimaryHex" class="theme-hex-input" pattern="#[0-9A-Fa-f]{6}" />
      <span class="theme-hint">Buttons, active states, key CTAs.</span>
    </div>
    <div class="settings-field">
      <span>Accent colour</span>
      <div class="iro-mount" id="themeAccentWheel"></div>
      <input type="text" id="themeAccentHex" class="theme-hex-input" pattern="#[0-9A-Fa-f]{6}" />
      <span class="theme-hint">Hover states, badges, secondary highlights.</span>
    </div>
    <div class="settings-field">
      <span>QR foreground</span>
      <div class="iro-mount" id="themeQrFgWheel"></div>
      <input type="text" id="themeQrFgHex" class="theme-hex-input" pattern="#[0-9A-Fa-f]{6}" />
      <span class="theme-hint" id="themeQrContrastHint">Contrast: ✓ readable.</span>
    </div>
  </div>

  <!-- Customisable palette of up to 7 colours -->
  <div class="theme-palette-block">
    <div class="theme-palette-head">
      <strong>Celebration palette</strong>
      <span class="theme-palette-sub">Up to 7 colours — used by the accept-cycle animation when a check-in succeeds.</span>
    </div>
    <div class="theme-palette-row" id="themePaletteRow">
      <!-- dynamically populated swatches: each .theme-palette-swatch is an iro mount + remove button -->
    </div>
    <div class="theme-palette-actions">
      <button type="button" class="btn btn-secondary btn-sm" id="themePaletteAdd">+ Add colour</button>
      <button type="button" class="btn btn-secondary btn-sm" id="themePaletteReset">Reset to defaults</button>
    </div>
  </div>

  <!-- Accept-cycle toggle -->
  <div class="theme-toggle-row">
    <label class="switch-tile theme-cycle-toggle">
      <div class="switch-top">
        <strong>Accept-cycle celebration animation</strong>
        <label class="switch-wrap">
          <input id="themeAcceptCycleEnabled" type="checkbox" checked />
          <span class="switch-slider"></span>
        </label>
      </div>
      <div class="switch-hint">Cycle through the palette colours as a celebration glow when a check-in succeeds. Some venues prefer minimal animation — disable to keep the simple flash.</div>
    </label>
    <button type="button" class="btn btn-secondary btn-sm" id="themePreviewAcceptCycle">Preview animation</button>
  </div>

  <!-- Live preview card -->
  <div class="theme-preview-card" id="themePreviewCard">
    <div class="theme-preview-block">
      <div class="theme-preview-button">Sample button</div>
      <div class="theme-preview-badge">Sample badge</div>
    </div>
    <div class="theme-preview-qr-block">
      <div class="theme-preview-qr" id="themePreviewQrBox"></div>
      <div class="theme-preview-qr-cycle" id="themePreviewQrCycle"></div>
    </div>
  </div>

  <div class="theme-actions">
    <button type="button" class="btn btn-primary btn-sm" id="themeSaveBtn">Save theme</button>
    <span class="theme-save-status" id="themeSaveStatus"></span>
  </div>
</div>
```

**Add CSS** in the existing `<style>` block:

```css
/* --- Light/dark mode (whole interface) --- */
:root {
  /* Existing dark mode is the default; values match :root in the file. */
}
:root[data-theme="light"] {
  --bg: #f6f8fa;
  --panel: #ffffff;
  --panel-2: #eef1f4;
  --line: #d0d7de;
  --line-soft: #e6eaef;
  --text: #1f2328;
  --muted: #57606a;
  --blue: #0969da;
  --green: #1a7f37;
  --orange: #bf8700;
  --red: #cf222e;
  --allow-pad: #d9f2e6;
  --review-pad: #fff8c5;
  --deny-pad: #ffd6d6;
  --scan-pad: #e6eef9;
}

/* --- Theme variables — set dynamically by JS, used everywhere --- */
:root {
  --theme-primary: #3FB950;
  --theme-accent: #58A6FF;
  --theme-qr-fg: #000000;
  --theme-cycle-1: #F44336;
  --theme-cycle-2: #FF9800;
  --theme-cycle-3: #FFEB3B;
  --theme-cycle-4: #4CAF50;
  --theme-cycle-5: #2196F3;
  --theme-cycle-6: #673AB7;
  --theme-cycle-7: #E91E63;
}

/* --- Light/dark toggle row --- */
.theme-mode-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line-soft);
  margin-bottom: 12px;
}
.theme-mode-label { font-size: 13px; font-weight: 500; color: #dbe6ff; }
.theme-mode-options { display: flex; gap: 12px; }
.theme-mode-options label {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; color: var(--muted); cursor: pointer;
}
.theme-mode-options input[type="radio"] { accent-color: var(--blue); }

/* --- iro.js mount points --- */
.theme-pickers { gap: 14px; align-items: start; }
.iro-mount {
  width: 100%;
  display: flex;
  justify-content: center;
  margin: 4px 0 8px;
  min-height: 130px;
}
.theme-hex-input {
  width: 100%;
  background: rgba(5,10,20,0.45);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  padding: 6px 10px;
  color: var(--text);
  font: 600 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-align: center;
  letter-spacing: 0.04em;
}
.theme-hex-input:focus {
  outline: none;
  border-color: rgba(105,168,255,0.6);
  box-shadow: 0 0 0 3px rgba(105,168,255,0.12);
}

/* --- Hint colours --- */
.theme-hint { font-size: 11px; color: var(--muted); line-height: 1.35; margin-top: 4px; }
.theme-hint.warn { color: var(--orange); }
.theme-hint.error { color: var(--red); }

/* --- Palette block --- */
.theme-palette-block {
  margin-top: 14px;
  padding: 12px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  background: rgba(255,255,255,0.02);
}
.theme-palette-head { margin-bottom: 10px; }
.theme-palette-head strong { display: block; font-size: 13px; color: #e6edf3; margin-bottom: 3px; }
.theme-palette-sub { font-size: 11px; color: var(--muted); line-height: 1.35; }
.theme-palette-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
  min-height: 56px;
  align-items: flex-start;
}
.theme-palette-swatch {
  position: relative;
  width: 56px; height: 56px;
  border-radius: 12px;
  cursor: pointer;
  border: 2px solid rgba(255,255,255,0.18);
  transition: transform 0.15s, border-color 0.15s;
}
.theme-palette-swatch:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.45); }
.theme-palette-swatch .swatch-remove {
  position: absolute; top: -6px; right: -6px;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: var(--red);
  color: #fff;
  font-size: 11px; font-weight: 700;
  display: grid; place-items: center;
  cursor: pointer;
  border: 1px solid #fff;
}
.theme-palette-actions { display: flex; gap: 8px; }

/* --- Accept-cycle toggle --- */
.theme-toggle-row {
  display: flex;
  gap: 12px;
  align-items: stretch;
  margin-top: 14px;
  flex-wrap: wrap;
}
.theme-cycle-toggle { flex: 1; min-width: 240px; }

/* --- Preview card --- */
.theme-preview-card {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-top: 14px;
  padding: 14px 16px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  flex-wrap: wrap;
}
.theme-preview-block { display: flex; gap: 12px; align-items: center; flex: 1; }
.theme-preview-button {
  padding: 9px 18px;
  border-radius: 8px;
  background: var(--theme-primary);
  color: #fff;
  font-size: 12px; font-weight: 600;
  transition: background 0.3s;
}
.theme-preview-badge {
  padding: 5px 12px;
  border-radius: 999px;
  background: var(--theme-accent);
  color: #fff;
  font-size: 11px; font-weight: 600;
  transition: background 0.3s;
}
.theme-preview-qr-block {
  position: relative;
  width: 88px; height: 88px;
}
.theme-preview-qr {
  width: 88px; height: 88px;
  background: #fff;
  border-radius: 6px;
  display: grid; place-items: center;
  padding: 4px;
  position: relative; z-index: 2;
}
.theme-preview-qr canvas, .theme-preview-qr img {
  max-width: 80px; max-height: 80px;
  image-rendering: pixelated;
}
.theme-preview-qr-cycle {
  position: absolute;
  inset: -4px;
  border-radius: 10px;
  z-index: 1;
  pointer-events: none;
  opacity: 0;
}
.theme-preview-qr-cycle.cycling {
  opacity: 1;
  animation: themeAcceptCycle 1.4s ease-out 1;
}
@keyframes themeAcceptCycle {
  0%   { box-shadow: 0 0 0 4px var(--theme-cycle-1), 0 0 24px var(--theme-cycle-1); }
  14%  { box-shadow: 0 0 0 4px var(--theme-cycle-2), 0 0 24px var(--theme-cycle-2); }
  28%  { box-shadow: 0 0 0 4px var(--theme-cycle-3), 0 0 24px var(--theme-cycle-3); }
  42%  { box-shadow: 0 0 0 4px var(--theme-cycle-4), 0 0 24px var(--theme-cycle-4); }
  57%  { box-shadow: 0 0 0 4px var(--theme-cycle-5), 0 0 24px var(--theme-cycle-5); }
  71%  { box-shadow: 0 0 0 4px var(--theme-cycle-6), 0 0 24px var(--theme-cycle-6); }
  85%  { box-shadow: 0 0 0 4px var(--theme-cycle-7), 0 0 24px var(--theme-cycle-7); }
  100% { box-shadow: 0 0 0 0   transparent,        0 0 0    transparent; }
}

/* --- Save status --- */
.theme-actions { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
.theme-save-status { font-size: 11px; color: var(--muted); }
.theme-save-status.ok { color: var(--green); }
.theme-save-status.err { color: var(--red); }
```

**Add JavaScript** at the appropriate point in the existing script block (preferably near other settings logic):

```js
// =============================================================
//  THEME — settings-side (Batch 6.5, 3 May 2026)
// =============================================================
const THEME_DEFAULTS = {
  primary: '#3FB950',
  accent:  '#58A6FF',
  qrFg:    '#000000',
  palette: ['#F44336','#FF9800','#FFEB3B','#4CAF50','#2196F3','#673AB7','#E91E63'],
  darkMode: true,
  acceptCycleEnabled: true
};
let activeTheme = { ...THEME_DEFAULTS, palette: [...THEME_DEFAULTS.palette] };
let _iroPickers = { primary: null, accent: null, qrFg: null, palette: [] };

function relLuminance(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || ''); if (!m) return 0;
  const v = parseInt(m[1], 16);
  const ch = [(v>>16)&255, (v>>8)&255, v&255].map(c => {
    const s = c/255; return s <= 0.03928 ? s/12.92 : Math.pow((s+0.055)/1.055, 2.4);
  });
  return 0.2126*ch[0] + 0.7152*ch[1] + 0.0722*ch[2];
}
function contrastVsWhite(hex) { return (1 + 0.05) / (relLuminance(hex) + 0.05); }

function applyThemeVars(theme) {
  const root = document.documentElement;
  root.style.setProperty('--theme-primary', theme.primary);
  root.style.setProperty('--theme-accent',  theme.accent);
  root.style.setProperty('--theme-qr-fg',   theme.qrFg);
  for (let i = 0; i < 7; i++) {
    const c = theme.palette[i] || theme.primary;
    root.style.setProperty(`--theme-cycle-${i+1}`, c);
  }
  // Light/dark mode
  let mode = theme.darkMode;
  if (mode === 'auto') {
    mode = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? false : true;
  }
  root.setAttribute('data-theme', mode ? 'dark' : 'light');
}

function updateQrContrastHint(fgHex) {
  const ratio = contrastVsWhite(fgHex);
  const hint = document.getElementById('themeQrContrastHint');
  if (!hint) return;
  if (ratio >= 7) {
    hint.textContent = `Contrast ${ratio.toFixed(1)}:1 — excellent.`;
    hint.className = 'theme-hint';
  } else if (ratio >= 4.5) {
    hint.textContent = `Contrast ${ratio.toFixed(1)}:1 — readable, darker would scan more reliably.`;
    hint.className = 'theme-hint warn';
  } else {
    hint.textContent = `Contrast ${ratio.toFixed(1)}:1 — too low, may not scan. Pick darker.`;
    hint.className = 'theme-hint error';
  }
}

function renderThemePreviewQr(fgHex) {
  const box = document.getElementById('themePreviewQrBox');
  if (!box || typeof QRCode === 'undefined') return;
  box.innerHTML = '';
  new QRCode(box, {
    text: 'IRLid theme preview',
    width: 80, height: 80,
    colorDark: fgHex,
    colorLight: '#FFFFFF',
    correctLevel: QRCode.CorrectLevel.M
  });
}

function mountIroPicker(elementId, initialColor, onChange) {
  const el = document.getElementById(elementId);
  if (!el || typeof iro === 'undefined') return null;
  el.innerHTML = '';
  const picker = new iro.ColorPicker(el, {
    width: 130,
    color: initialColor,
    layout: [
      { component: iro.ui.Wheel },
      { component: iro.ui.Slider, options: { sliderType: 'value' } }
    ]
  });
  picker.on('color:change', (c) => onChange(c.hexString));
  return picker;
}

function buildPaletteSwatch(index, color) {
  const wrap = document.createElement('div');
  wrap.className = 'theme-palette-swatch';
  wrap.style.backgroundColor = color;
  wrap.dataset.index = String(index);
  wrap.title = `Palette colour ${index + 1} — click to edit`;
  const remove = document.createElement('div');
  remove.className = 'swatch-remove';
  remove.textContent = '×';
  remove.title = 'Remove this colour';
  remove.addEventListener('click', (e) => {
    e.stopPropagation();
    activeTheme.palette.splice(index, 1);
    rebuildPaletteUI();
    applyThemeVars(activeTheme);
  });
  wrap.appendChild(remove);
  wrap.addEventListener('click', () => openPaletteSwatchEditor(index));
  return wrap;
}

function rebuildPaletteUI() {
  const row = document.getElementById('themePaletteRow');
  if (!row) return;
  row.innerHTML = '';
  activeTheme.palette.forEach((c, i) => row.appendChild(buildPaletteSwatch(i, c)));
  const addBtn = document.getElementById('themePaletteAdd');
  if (addBtn) addBtn.disabled = activeTheme.palette.length >= 7;
}

function openPaletteSwatchEditor(index) {
  // Inline editor: replace the swatch temporarily with an iro picker.
  // Simplification for v1: prompt() for a hex value, validate, update.
  // Future polish: modal with iro wheel.
  const current = activeTheme.palette[index];
  const next = window.prompt('Enter hex colour for swatch ' + (index + 1) + ' (e.g. #FF6B35):', current);
  if (!next) return;
  if (!/^#[0-9A-Fa-f]{6}$/.test(next)) { alert('Invalid hex — must be #RRGGBB'); return; }
  activeTheme.palette[index] = next;
  rebuildPaletteUI();
  applyThemeVars(activeTheme);
}

function previewAcceptCycle() {
  const el = document.getElementById('themePreviewQrCycle');
  if (!el) return;
  el.classList.remove('cycling');
  // reflow to restart animation
  void el.offsetWidth;
  el.classList.add('cycling');
  setTimeout(() => el.classList.remove('cycling'), 1500);
}

async function loadThemeFromServer() {
  if (!currentOrg || !currentOrg.api_key) return;
  try {
    const res = await window.IRLidOrgApi.getOrgSettings(currentOrg.api_key);
    const t = (res && res.settings && res.settings.theme) || {};
    activeTheme = {
      primary: t.primary || THEME_DEFAULTS.primary,
      accent:  t.accent  || THEME_DEFAULTS.accent,
      qrFg:    t.qrFg    || THEME_DEFAULTS.qrFg,
      palette: Array.isArray(t.palette) && t.palette.length ? t.palette.slice(0, 7) : [...THEME_DEFAULTS.palette],
      darkMode: t.darkMode === undefined ? THEME_DEFAULTS.darkMode : t.darkMode,
      acceptCycleEnabled: t.acceptCycleEnabled === undefined ? THEME_DEFAULTS.acceptCycleEnabled : t.acceptCycleEnabled
    };
    writeThemeToUI();
    applyThemeVars(activeTheme);
  } catch (err) {
    console.warn('Theme load failed, using defaults', err);
  }
}

async function saveThemeToServer() {
  if (!currentOrg || !currentOrg.api_key) return;
  const status = document.getElementById('themeSaveStatus');
  if (status) { status.textContent = 'Saving…'; status.className = 'theme-save-status'; }
  try {
    await window.IRLidOrgApi.updateOrgSettings(currentOrg.api_key, { theme: activeTheme });
    if (status) { status.textContent = 'Saved.'; status.className = 'theme-save-status ok'; }
    setTimeout(() => { if (status) status.textContent = ''; }, 3000);
  } catch (err) {
    if (status) { status.textContent = 'Save failed: ' + (err.message || 'unknown'); status.className = 'theme-save-status err'; }
  }
}

function writeThemeToUI() {
  document.getElementById('themePrimaryHex').value = activeTheme.primary;
  document.getElementById('themeAccentHex').value  = activeTheme.accent;
  document.getElementById('themeQrFgHex').value    = activeTheme.qrFg;
  if (_iroPickers.primary) _iroPickers.primary.color.hexString = activeTheme.primary;
  if (_iroPickers.accent)  _iroPickers.accent.color.hexString  = activeTheme.accent;
  if (_iroPickers.qrFg)    _iroPickers.qrFg.color.hexString    = activeTheme.qrFg;
  rebuildPaletteUI();
  updateQrContrastHint(activeTheme.qrFg);
  renderThemePreviewQr(activeTheme.qrFg);
  document.getElementById('themeAcceptCycleEnabled').checked = !!activeTheme.acceptCycleEnabled;
  const modeRadios = document.querySelectorAll('input[name="themeMode"]');
  modeRadios.forEach(r => {
    const v = activeTheme.darkMode === 'auto' ? 'auto' : (activeTheme.darkMode ? 'dark' : 'light');
    r.checked = (r.value === v);
  });
}

function wireThemePanel() {
  // Mount iro pickers on the three core colours
  _iroPickers.primary = mountIroPicker('themePrimaryWheel', activeTheme.primary, (hex) => {
    activeTheme.primary = hex;
    document.getElementById('themePrimaryHex').value = hex;
    applyThemeVars(activeTheme);
  });
  _iroPickers.accent = mountIroPicker('themeAccentWheel', activeTheme.accent, (hex) => {
    activeTheme.accent = hex;
    document.getElementById('themeAccentHex').value = hex;
    applyThemeVars(activeTheme);
  });
  _iroPickers.qrFg = mountIroPicker('themeQrFgWheel', activeTheme.qrFg, (hex) => {
    activeTheme.qrFg = hex;
    document.getElementById('themeQrFgHex').value = hex;
    applyThemeVars(activeTheme);
    updateQrContrastHint(hex);
    renderThemePreviewQr(hex);
  });

  // Hex input synchronisation
  ['Primary','Accent','QrFg'].forEach(key => {
    const input = document.getElementById('theme' + key + 'Hex');
    const lcKey = key.charAt(0).toLowerCase() + key.slice(1);
    input.addEventListener('change', () => {
      const v = input.value.trim();
      if (!/^#[0-9A-Fa-f]{6}$/.test(v)) { input.value = activeTheme[lcKey]; return; }
      activeTheme[lcKey] = v;
      const picker = _iroPickers[lcKey];
      if (picker) picker.color.hexString = v;
      applyThemeVars(activeTheme);
      if (lcKey === 'qrFg') { updateQrContrastHint(v); renderThemePreviewQr(v); }
    });
  });

  // Light/dark radio
  document.querySelectorAll('input[name="themeMode"]').forEach(r => {
    r.addEventListener('change', () => {
      const v = r.value;
      activeTheme.darkMode = (v === 'auto' ? 'auto' : (v === 'dark'));
      applyThemeVars(activeTheme);
    });
  });

  // Accept-cycle toggle
  document.getElementById('themeAcceptCycleEnabled').addEventListener('change', (e) => {
    activeTheme.acceptCycleEnabled = !!e.target.checked;
  });

  // Palette add / reset
  document.getElementById('themePaletteAdd').addEventListener('click', () => {
    if (activeTheme.palette.length >= 7) return;
    const fresh = '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0').toUpperCase();
    activeTheme.palette.push(fresh);
    rebuildPaletteUI();
    applyThemeVars(activeTheme);
  });
  document.getElementById('themePaletteReset').addEventListener('click', () => {
    activeTheme.palette = [...THEME_DEFAULTS.palette];
    rebuildPaletteUI();
    applyThemeVars(activeTheme);
  });

  // Preview animation
  document.getElementById('themePreviewAcceptCycle').addEventListener('click', previewAcceptCycle);

  // Save
  document.getElementById('themeSaveBtn').addEventListener('click', saveThemeToServer);

  // System dark/light listener (if mode is 'auto')
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (activeTheme.darkMode === 'auto') applyThemeVars(activeTheme);
    });
  }

  rebuildPaletteUI();
  updateQrContrastHint(activeTheme.qrFg);
  renderThemePreviewQr(activeTheme.qrFg);
  applyThemeVars(activeTheme);
}

// Call wireThemePanel() once after DOM is ready and currentOrg is loaded,
// then loadThemeFromServer() to populate from saved state.
document.addEventListener('DOMContentLoaded', () => {
  wireThemePanel();
  if (typeof currentOrg !== 'undefined' && currentOrg && currentOrg.api_key) {
    loadThemeFromServer();
  }
});
```

**Hooking the accept-cycle into real check-in events:**

In the existing check-in success handlers (search for `flash-success` class additions or `renderCheckinResult` success path), add after the existing flash:

```js
if (activeTheme.acceptCycleEnabled) {
  const cycleEl = document.querySelector('.scan-panel') || document.querySelector('.checkin-success-overlay');
  if (cycleEl) {
    cycleEl.classList.remove('cycling');
    void cycleEl.offsetWidth;
    cycleEl.classList.add('cycling');
    setTimeout(() => cycleEl.classList.remove('cycling'), 1500);
  }
}
```

Add `.scan-panel.cycling` and `.checkin-success-overlay.cycling` to the existing CSS animation `@keyframes themeAcceptCycle` selector list.

### Edit 4 — `org-entry.html` theme application

The public Check-in page consumes the theme via URL params (existing pattern) OR fetches from settings if available.

**Add to `org-entry.html` near top of script block:**

```js
// Theme application — Batch 6.5
function applyOrgEntryTheme() {
  const params = new URLSearchParams(location.search);
  const root = document.documentElement;
  const primary = params.get('themePrimary');
  const accent  = params.get('themeAccent');
  const qrFg    = params.get('themeQrFg');
  if (primary && /^#[0-9A-Fa-f]{6}$/.test(primary)) root.style.setProperty('--theme-primary', primary);
  if (accent  && /^#[0-9A-Fa-f]{6}$/.test(accent))  root.style.setProperty('--theme-accent',  accent);
  if (qrFg    && /^#[0-9A-Fa-f]{6}$/.test(qrFg))    root.style.setProperty('--theme-qr-fg',   qrFg);
  // Light/dark — default dark for entry page; override only if explicit.
  const mode = params.get('themeMode');
  if (mode === 'light') root.setAttribute('data-theme', 'light');
  else if (mode === 'dark') root.setAttribute('data-theme', 'dark');
}
applyOrgEntryTheme();
```

The OrgCheckin Settings panel, when generating Check-in QR URLs, should include these params so the entry page picks up the theme without a server fetch. (The Worker already returns the theme via `GET /org/settings` if a server fetch is preferred for reliability.)

### Edit 5 — First-scan placeholder integration

In `org-entry.html` `renderIdentityPicker(pub, fp)` function (around line 637), honour the three placeholder toggles by reading the URL params:

- `allowSelfSelection=true` → show the identity picker as currently designed
- `allowSelfSelection=false` → skip directly to doorman-only review
- `requireDoormanConfirmation=true` → always show "ask staff for help" fallback even if recognised
- `requireAdditionalProof=true` → after picker selection, require a second proof step before allow
- `allowProofRecording=true` → on accept, capture and store metadata (UI hook ready, server storage future work — record a `proof_recorded: true` flag in the checkin payload)
- `enableIdPhotoCapture=true` → fire a `getUserMedia({ video: true })` capture step before allow

These are scaffolding hooks. The Worker doesn't need to know about them yet (no schema change); they purely affect the entry-side flow.

**Stub in `renderIdentityPicker`:**

```js
async function renderIdentityPicker(pub, fp) {
  const params = new URLSearchParams(location.search);
  const allowSelfSelect = params.get('allowSelfSelection') !== 'false';
  const requireDoorman  = params.get('requireDoormanConfirmation') === 'true';
  const requireProof    = params.get('requireAdditionalProof') === 'true';
  const photoCapture    = params.get('enableIdPhotoCapture') === 'true';

  if (!allowSelfSelect) {
    return renderDoormanReviewOnly(pub, fp);
  }
  // existing self-selection picker logic continues here…
  if (requireProof) {
    // after picker, gate accept on additional proof step
  }
  if (photoCapture) {
    // fire getUserMedia for photo capture (UI hook only for v1)
  }
  if (requireDoorman) {
    // always show doorman fallback path
  }
}
```

The full bodies of `renderDoormanReviewOnly`, the proof gate, and the photo capture flow are scaffolds — wire to existing UI paths or stub with `console.warn('placeholder: not yet implemented')` for v1. **The point of this batch is to honour the toggle state, not to implement every feature behind it.**

### Edit 6 — Retire `org.html` to a redirect shim

**Replace the contents of `org.html` with:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>IRLid — Org Portal (moved)</title>
  <meta http-equiv="refresh" content="0; url=OrgCheckin.html" />
  <script>
    // Preserve any query string when redirecting.
    const dest = 'OrgCheckin.html' + location.search + location.hash;
    location.replace(dest);
  </script>
</head>
<body>
  <p>The Org Portal has moved to <a href="OrgCheckin.html">OrgCheckin.html</a>. Redirecting…</p>
</body>
</html>
```

That preserves any deep links bookmarked against `org.html` and removes the duplicate-toggle source of truth in one move. Per Mr. Data's design doc this is the correct deprecation pattern.

---

## Deploy instructions (Captain runs)

**Step 1 — pull and review:**

```powershell
cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-TestEnvironment"
git pull
git status
git diff irlid-api/src/index.js js/orgapi.js
```

The two changes already in place: Worker allowlist extension + theme validators, and `getOrgSettings`/`updateOrgSettings` API client wrappers.

**Step 2 — apply the remaining edits** (OrgCheckin Theming panel, org-entry theme application, first-scan integration, org.html shim) per the code blocks above.

**Step 3 — deploy:**

```powershell
cd irlid-api
wrangler deploy
```

(No D1 migration needed — `settings_json` column already exists. The Worker change is purely code-side.)

```powershell
cd ..
git add -A
git commit -m "Batch 6.5: theming panel + settings persistence; org.html→OrgCheckin shim; first-scan placeholder hooks"
git push
```

GitHub Pages auto-deploys the frontend within ~3 minutes.

**Step 4 — smoke test:**

1. Open `bunhead.github.io/IRLid-TestEnvironment/OrgCheckin.html`.
2. Sign in as DEV.
3. Settings panel → scroll to Theme group.
4. Pick a primary colour via the iro wheel. Watch the page interface update live.
5. Pick a QR foreground; observe the contrast hint and live preview QR.
6. Click "+ Add colour" twice in the palette; click "Preview animation"; see the cycle.
7. Toggle "Interface mode" between Dark / Light / Match device; watch the whole interface flip.
8. Click Save theme. Reload the page. Theme persists.

If any step fails, surface logs from `wrangler tail` (live Worker logs) — most likely cause of any save failure is the validation error messages bubbling up from the Worker's `validateTheme()`.

---

## Acceptance criteria

- [ ] OrgCheckin Settings panel shows the new Theme group below Branding.
- [ ] Three iro.js colour wheels render and interact correctly.
- [ ] QR foreground contrast hint updates in real time; below-4.5 ratio shows red error message.
- [ ] Palette accepts up to 7 colours; "+ Add" disables at 7; remove (×) works.
- [ ] Accept-cycle preview animates through the palette.
- [ ] Light/dark radio buttons flip the entire interface theme.
- [ ] "Auto" mode honours `prefers-color-scheme` and updates live when system changes.
- [ ] Save theme persists to `settings_json` server-side and survives a page reload.
- [ ] Server validation rejects below-4.5-contrast QR foreground with a clear error.
- [ ] `org.html` redirects to `OrgCheckin.html` preserving query string.
- [ ] First-scan placeholder toggles (`allowSelfSelection`, `requireDoormanConfirmation`, `requireAdditionalProof`, `allowProofRecording`, `enableIdPhotoCapture`) gate the corresponding UI paths in `org-entry.html` (even if behaviours behind some are stubs for v1).
- [ ] No regression on existing v3/v4/v5 receipt flow, scan flow, or attendance dashboard.

---

— Number One, Sunday evening watch, 3 May 2026
