# HANDOVER — v5.11.0w Check-in tab static theme application gap

**Target pill bump:** `v5.11.0v` → `v5.11.0w`
**Service worker cache bump:** `v32` → `v33`
**Live repo:** `D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo`
**Branch:** `codex/v5.11.0w-checkin-theme-application`
**Captain's framing:** v5.11.0o wired the celebration **runtime** to the live Check-in tab (`fireConfiguredSequence` → `triggerAcceptCycleAnimation`). v5.11.0u (CSS specificity at L4603) + v5.11.0v (QR-centric anchoring + crosshair fullscreen hide) polished the visual effects. But the **static theme application** — background image overlay, pattern overlay, image symmetry, image positioning — is still applied ONLY by the Settings Sample preview path, NOT by the production Check-in tab path. The configured palette IS reaching the Check-in tab (`v511EnsureRuntimeStage` sets `--cel-pal-N` CSS vars at L8172), and the celebration sequence IS firing on real check-ins. What's missing is the dragons + pattern that make the configured theme look like the configured theme.

---

## 1. Captain's exact words (smoke report)

> "Effects have not port to the checkin page at all well, background fading between the two saved colours, not the pattern. Images seem to have f'd off completely and effects are all from the centre :s"

Three distinct symptoms, one common root cause:

### 1.1 Background fading between palette colours, not pattern

The palette cycle IS firing on the Check-in tab (visible in screenshots as a solid orange or red mid-cycle frame). But the configured CSS pattern overlay (dots / hex / diagonal / chevron / etc.) is not being applied. Captain expects to see the pattern texture visible behind the palette cycle.

### 1.2 Dragon images gone

The user's configured theme has bg images of dragons positioned left + right (symmetric). Settings Sample fullscreen renders them correctly. Check-in tab fullscreen shows NO dragons — just the palette colour cycling.

### 1.3 Stream particles emit from centre, not from images

Direct consequence of (1.2). `v511GetStreamAnchors` (Org.html ~L7480) looks for visible image instances on the stage; with no dragons rendered into `#venueQRWrap`, it falls back to stage centre as designed. Stream is doing exactly what its code says — but the input data (image positions) is missing.

---

## 2. Root cause analysis

**CSS infrastructure is ALREADY in place** and targets `#venueQRWrap` directly. Search results from Org.html:

- Lines 2767-2796: `.bg-image-mirror` element styles, with `#venueQRWrap .bg-image-mirror { ... }` rules.
- Lines 2804-2860: positioning variants — `body[data-bg-mode="image"][data-bg-image-position="tile"] #venueQRWrap .bg-image-mirror { ... }`, `cover`, `top-left`, `top-right`, `bottom-left`, `bottom-right`, plus `.irlid-qr-fullscreen` matching selectors.
- The pattern overlay CSS rules also exist for the body/wrap combo (search for `[data-bg-pattern="dots"]` / `hex` / etc.).

**What's missing** is the JS that bridges new v5.11 theme shape to those legacy CSS hooks. The v5.11 save path (PR #46 / v5.11.0m) updates `theme._v511.background.*` (new shape — `bgMode`, `bgImageUrl`, `bgImageSymmetric`, `bgImagePosition`, `bgPattern`, `bgIntensity`, etc.) but does NOT also:

1. Set `document.body.dataset.bgMode` (so the CSS selectors at L2804+ activate)
2. Set `document.body.dataset.bgImagePosition`
3. Set `document.body.dataset.bgPattern` (for pattern mode)
4. Find or create `.bg-image-mirror` element inside `#venueQRWrap` with `style.backgroundImage = url(theme.bgImageUrl)`
5. Set CSS custom properties for pattern colour cycle / image alpha / image scale / image anchor offset

So when the Check-in tab renders, the body data attributes are out-of-sync with the saved theme — the CSS rules don't match anything and nothing renders. Settings Sample preview renders correctly because its preview-stage code path DOES apply the legacy logic (or its own equivalent within the preview block).

---

## 3. Implementation pattern

### 3.1 Find the v5.10.x bg application function

Grep for existing functions that already do this for the legacy code path. Candidates:

- `applyV511Theme`, `applyTheme`, `applyV511Background`, `paintBackground`, `renderBackground`
- Anything that already sets `document.body.dataset.bgMode`
- Anything that already inserts `.bg-image-mirror` into the DOM
- The v5.10.x Settings save path was working before the v5.11 UI was layered on top — that code path is the canonical "how to apply background theme" reference.

If a function exists, EXTEND it to also read from `theme._v511.background.*` shape.

If no function exists (the v5.10.x logic was inline at theme-load time), create a new helper:

```js
function applyV511BackgroundToHostStages(theme) {
  if (!theme) return;
  var v511 = (theme && theme._v511 && theme._v511.background) || {};
  // Prefer _v511 shape, fall back to legacy top-level theme keys
  var bgMode = v511.bgMode || theme.bgMode || 'off';
  var bgImageUrl = v511.bgImageUrl || theme.bgImageUrl || '';
  var bgImagePosition = v511.bgImagePosition || theme.bgImagePosition || 'cover';
  var bgImageSymmetric = !!(v511.bgImageSymmetric || theme.bgImageSymmetric);
  var bgPattern = v511.bgPattern || theme.bgPattern || '';
  var bgIntensity = v511.bgIntensity || theme.bgIntensity || 'vibrant';

  // 1. Body data attributes — drives all the body[data-bg-mode="..."] CSS at L2767-2860
  document.body.dataset.bgMode = bgMode;
  document.body.dataset.bgImagePosition = bgImagePosition;
  if (bgPattern) document.body.dataset.bgPattern = bgPattern;
  document.body.dataset.bgIntensity = bgIntensity;

  // 2. .bg-image-mirror DOM into #venueQRWrap (and matching for fullscreen overlay if needed)
  var wrap = document.getElementById('venueQRWrap');
  if (wrap) {
    var mirror = wrap.querySelector(':scope > .bg-image-mirror');
    if (bgMode === 'image' && bgImageUrl) {
      if (!mirror) {
        mirror = document.createElement('div');
        mirror.className = 'bg-image-mirror';
        mirror.setAttribute('aria-hidden', 'true');
        wrap.insertBefore(mirror, wrap.firstChild);
      }
      mirror.style.backgroundImage = "url('" + bgImageUrl.replace(/'/g, "%27") + "')";
      if (bgImageSymmetric) mirror.classList.add('bg-image-symmetric');
      else mirror.classList.remove('bg-image-symmetric');
    } else if (mirror) {
      mirror.remove();
    }
  }

  // 3. Palette CSS vars on body (so non-stage surfaces also pick up colours)
  var palette = (theme && Array.isArray(theme.palette) && theme.palette.length)
    ? theme.palette
    : (v511 && Array.isArray(v511.palette) ? v511.palette : ['#58a6ff']);
  for (var i = 1; i <= 7; i++) {
    document.body.style.setProperty('--cel-pal-' + i, palette[i - 1] || palette[0]);
  }
}
```

### 3.2 Call sites

This function should fire at every theme transition:

- **On initial theme load** — after the GET /org/settings response resolves. Find where `loadDashboardForOrg` or similar calls the settings endpoint; add the application call there.
- **After v5.11 Save All Settings** — the v5.11.0m save path POSTs to /org/settings, reads back, and updates UI. Add the application call to the readback step.
- **When the Check-in tab is shown** — find the `showPanel('checkin', ...)` handler or equivalent and ensure the application runs once after the panel becomes visible. Layout-dependent (the .bg-image-mirror element needs the wrap to be in the DOM).

If there's an existing `applyTheme` or `applyV511Theme` function, integrate `applyV511BackgroundToHostStages(theme)` into it so all call sites flow through one path.

### 3.3 Don't forget the fullscreen overlay path

The Check-in tab fullscreen wraps the QR in `.irlid-qr-fullscreen .irlid-qr-fullscreen-holder` (per v5.11.0q transparency fix at js/qr-fullscreen.js). The legacy CSS at L2767+ already includes `.irlid-qr-fullscreen .bg-image-mirror` selectors. The `.bg-image-mirror` element needs to be inserted into the fullscreen holder when fullscreen activates, OR the body-level dataset attributes need to drive a fullscreen-level mirror that's already in the markup. Investigate which pattern the v5.10.x code used — replicate it.

---

## 4. Out of scope guards

- **Do NOT touch the Settings Sample preview path** — it works correctly. Settings Sample stage is `.v511-theme-preview-stage` / `#v511ThemePreviewStage`. Don't regress the inline preview rendering.
- **Do NOT touch `v511EnsureRuntimeStage`** (the v5.11.0v fix for `--qr-cx` / `--qr-cy`) — orthogonal concern. Background application happens on theme load, not on celebration fire.
- **Do NOT touch the celebration runtime** (`fireConfiguredSequence`, `v511PlaySequence`, `triggerAcceptCycleAnimation`) — already working.
- **Do NOT touch Worker side** — purely client-side fix. The Worker already accepts and persists the v5.11 theme shape.
- **Do NOT touch other Settings tabs** (Organisation, Event & Calendar, Roles & Staff, Sign-in & Auth, Tools & Diagnostics, Records & ID) — still `design-in v5.12`.
- **Do NOT redesign the theme shape** — keep accepting both `theme._v511.background.*` AND legacy top-level `theme.bgMode` / `theme.bgImageUrl` for backward compatibility.

---

## 5. Acceptance criteria

After Captain merges + pulls + (force-empty-commit-redeploy if Pages skips, see §7) + hard-refreshes on phone + reopens all Org tabs:

1. **Configured bg image visible on Check-in tab fullscreen.** With a theme that has dragons (`bgImageUrl`) + symmetric flag, opening Check-in tab → Fullscreen, the dragons render in their saved positions (cover / tile / corners as configured), matching what Settings Sample fullscreen shows for the same theme.
2. **Configured pattern visible on Check-in tab.** With a theme that has `bgMode: 'pattern'` + a pattern key (e.g. `dots` / `hex` / `chevron`), the pattern overlay is visible on the Check-in tab background. Inline AND fullscreen.
3. **Stream particles emit from dragon positions on real check-in.** Trigger a real check-in event (Kerry / Spencer round trip) with Stream configured in the celebration sequence → Stream particles fire from the dragon positions, not from stage centre. (Verifies `v511GetStreamAnchors` finds the inserted `.bg-image-mirror`s OR a properly anchored image element.)
4. **Settings Sample UNREGRESSED.** All visual effects (Confetti spread, Sparkles, Stream, QR Glow Halo + Rays, Spotlight, Iris wipe, Ripple, Pulse, Pattern flash, Text overlay) still work in Settings Sample preview exactly as they did at v5.11.0v close.
5. **Real check-in event still fires celebration sequence.** Spencer / Kerry check-out → configured `theme._v511.celebration` sequence fires (confetti / sparkles / stream / glow / pulse / etc.) on the Check-in tab. No regression of the v5.11.0o wire-up.
6. **Build pill reads `v5.11.0w`.**

---

## 6. Pill + cache bumps

- `Org.html` build pill: `v5.11.0v` → `v5.11.0w`.
- `sw.js` `CACHE_VERSION`: `irlid-shell-v32` → `irlid-shell-v33` with comment noting v5.11.0w Check-in tab static theme application (bg image overlay + pattern + symmetry now applied to `#venueQRWrap`, matching Settings Sample).

---

## 7. Pages auto-deploy note (known recurring issue)

GitHub Pages auto-deploy workflow has failed on **both** v5.11.0u and v5.11.0v initial pushes today (red X on `pages-build-deployment` immediately after merge). The reliable recovery is an empty commit on main, which forces a fresh workflow run:

```powershell
cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo" ; git commit --allow-empty -m 'Force Pages redeploy for v5.11.0w' ; git push
```

If this happens again, no panic — empty-commit redeploy reliably works. Worth investigating root cause when not under demo pressure (queued as BOOTSTRAP §6 pitfall inscription).

---

## 8. Codex prompt template (Captain pastes verbatim)

```
Read HANDOVER-CheckinThemeApplication-v5.11.0w.md at repo root and execute.

Branch: codex/v5.11.0w-checkin-theme-application
Open PR against main when complete.
Reply with PR number + one-paragraph summary of: (a) where you found the existing v5.10.x bg image application logic (function name + line numbers), (b) what JS function you added or extended, (c) where you call it from (theme load, settings save, check-in tab render — list each call site).
```

---

— Number One, drafted 26 May 2026 late evening (Tuesday) at watch close
