# HANDOVER — v5.11.0r Settings Sample regressions: Stream missing + Text overlay position in fullscreen-preview

**Target pill bump:** `v5.11.0q` → `v5.11.0r`
**Service worker cache bump:** `v27` → `v28`
**Live repo:** `D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo`
**Branch:** `codex/v5.11.0r-settings-sample-regressions`
**Captain's framing:** v5.11.0p's unification of `fireConfiguredSequence` for both Settings Sample AND real check-ins shipped the architectural win — real check-ins fire configured sequences correctly (verified). But the Settings Sample preview surface has two regressions Captain spotted while smoke-testing the visual customisation panel (which IS the demo surface he'll show Wednesday — visuals are the "bling-bling" of the IRLid pitch):
1. **Stream effect missing from Settings Sample in BOTH fullscreen and non-fullscreen preview modes** — real check-ins still fire Stream particles correctly (verified by orange particles in production Check-in tab fullscreen smoke), but the Sample button output doesn't render Stream at all.
2. **Text overlay position differs between Settings-preview fullscreen vs non-fullscreen modes** — in non-fullscreen preview, text overlays the QR (correct, matches production behaviour). In fullscreen preview, text drops BELOW the QR pushing layout up.

Both affect Captain's design-preview workflow + the demo's "look how visuals can be customised" tour. NOT affecting the attendee-facing real check-in flow.

---

## 1. Diagnose first (read your own v5.11.0p work)

You factored `fireConfiguredSequence(sequence, mode, stage, opts)` in `Org.html` and routed both Settings Sample AND real check-ins through it. Find:

- **Sample call site** (around line 8166 of Org.html):
  ```js
  fireConfiguredSequence(seq, outcome, sampleStage, { theme: activeTheme, attendeeName: 'Kerry', action: outcome === 'deny' ? 'out' : 'in' });
  ```
- **Real check-in call site** (around line 16222 of Org.html):
  ```js
  window.fireConfiguredSequence(seq, mode || 'allow', v511ActiveCelebrationStage(), { theme: activeTheme, attendeeName: attendeeName, action: action || 'in' });
  ```

Both pass similar opts. Both use the same `v511PlaySequence` → `v511FireStreamParticles` path. So in theory both should fire Stream identically. Captain reports they don't. Investigation needed: why does `v511FireStreamParticles(playStage, item, durMs)` (around line 8049) fire correctly when `playStage` is the production runtime stage (`v511ActiveCelebrationStage()` result) but not when `playStage` is `sampleStage`?

**Likely root causes to check first:**
- `v511EnsureRuntimeStage` may behave differently for `sampleStage` vs the production runtime stage (different child elements, missing `.v511-cel-fx-layer` injection, etc.)
- The Sample stage may have CSS dimensions of 0×0 in some states (e.g., when its parent panel is collapsed)
- `v511FireStreamParticles` may have an early-return condition that fires on Sample-shaped stage elements
- Stream particle elements may be injected but z-index'd behind the Sample preview frame

For Issue 2 (Text overlay position), find:

- The Text overlay CSS rule positioning the overlay (something like `:is(.v511-theme-preview-stage, .v511-runtime-stage).cel-text .v511-cel-text-overlay` around line 4479+ of Org.html)
- The fullscreen-preview container class — the Settings preview pane can be double-clicked to fullscreen (per earlier T4-era patches). In fullscreen mode, the preview likely renders inside a different parent container that doesn't pick up the same positioning rule

---

## 2. Two fix areas

### 2.1 Stream effect fires in Settings Sample (both fullscreen + non-fullscreen)

Once you identify the root cause, the fix should:
- Make Sample stage behave identically to production runtime stage for Stream rendering
- Verify Sparkles, Confetti, Flame, Glitch (all particle effects from the same family) also fire in Sample — they may have the same regression
- Verify Stream still fires in production real check-in (don't regress what we just shipped)
- Sample button → fires Stream particles visible in inline preview AND in fullscreen-preview

### 2.2 Text overlay position consistent across preview modes

CSS scope fix: make the Text overlay's "over the QR" positioning rule apply to BOTH:
- The inline Settings preview container (currently works)
- The Settings preview's fullscreen mode container (currently fails — text drops below QR)

The production Check-in tab Text overlay positioning is OUT OF SCOPE — verified working on real check-ins, don't touch.

Acceptance: Sample button → text overlays the QR identically in inline preview AND when preview is fullscreened (double-click).

---

## 3. Out of scope (do NOT change)

- Production real check-in runtime — verified working (Stream fires, Text overlay correct position). DO NOT touch `v511ActiveCelebrationStage()` or the real-check-in code path.
- v5.11.0q fullscreen overlay backgrounds — already shipped, working.
- Other v5.11 library effects beyond Stream + Text overlay — unless the Stream root cause is shared with Sparkles/Confetti/Flame/Glitch (in which case fix them all together; one-line fix in shared particle dispatcher).
- Worker side — no changes.
- Other Settings tabs (Organisation, Staff & Rooms, etc.) — still `design-in v5.12`.

---

## 4. Pill + cache bumps

After all code changes:
- `Org.html` build pill: `v5.11.0q` → `v5.11.0r`
- `sw.js` `CACHE_VERSION`: `irlid-shell-v27` → `irlid-shell-v28` with comment noting v5.11.0r Settings Sample regressions fix

---

## 5. Acceptance criteria

After Captain merges + pulls + hard-refreshes + closes/reopens phone tabs:

1. **Stream fires in Settings Sample inline preview.** Settings → Visual Theming → drag QR Glow + Text + Stream into sequence → click Sample → Stream particles visible in the inline preview frame.
2. **Stream fires in Settings Sample fullscreen preview.** Double-click the preview pane to fullscreen it → click Sample → Stream particles visible in fullscreen preview.
3. **Other particle effects also fire in Settings Sample** (Sparkles, Confetti, Flame, Glitch) — if Stream's root cause was shared, verify they all work; if isolated, document which ones still don't and consider v5.11.0s.
4. **Text overlay position consistent across preview modes.** Sample fires → text overlays the QR in inline preview AND in fullscreen preview (no drop-below-QR layout shift).
5. **Production real check-in UNREGRESSED.** Trigger real Kerry check-out on dashboard → fullscreen Check-in tab still shows palette background + Glow halo + Stream particles + Text overlay correctly (verifies v5.11.0p + v5.11.0q work preserved).
6. **Build pill reads `v5.11.0r`.**

---

## 6. Codex prompt template (Captain pastes verbatim)

```
Read HANDOVER-SettingsSampleRegressions-v5.11.0r.md at repo root and execute.

Branch: codex/v5.11.0r-settings-sample-regressions
Open PR against main when complete.
Reply with PR number + one-paragraph summary of (a) the root cause of Stream missing from Settings Sample and your fix, (b) which other particle effects were affected by the same root cause if any, (c) the CSS selector / scope change you made for Text overlay positioning across preview modes.
```

---

— Number One, drafted 26 May 2026 morning (Tuesday), post-v5.11.0q merge
