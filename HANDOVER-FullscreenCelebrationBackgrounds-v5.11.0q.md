# HANDOVER — v5.11.0q Fullscreen overlay celebration backgrounds (transparency for theme colours + Glow halo visibility)

**Target pill bump:** `v5.11.0p` → `v5.11.0q`
**Service worker cache bump:** `v26` → `v27`
**Live repo:** `D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo`
**Branch:** `codex/v5.11.0q-fullscreen-celebration-backgrounds`
**Captain's framing:** v5.11.0p's `fireConfiguredSequence` + fullscreen-overlay scoping landed correctly — Stream + Text overlay both visibly render in the fullscreen view. But the fullscreen overlay's two HARDCODED backgrounds (dark overlay + white holder) mask the celebration's palette-driven colours AND smother the Glow halo effect. This brief makes the fullscreen overlay celebration-aware so the configured theme colours + Glow halo render visibly in fullscreen exactly as they do in non-fullscreen Check-in tab.

---

## 1. The two hardcoded backgrounds to make celebration-aware

Both are in `js/qr-fullscreen.js`'s `injectStyles()` function (around lines 49-63):

### 1.1 `.irlid-qr-fullscreen` overlay background

Currently:
```css
.irlid-qr-fullscreen{background:#05070c;...}
```

When the overlay holder has a celebration class active (e.g., `.cel-glow`, `.cel-bg`, or any `.cel-*` celebration class), the overlay background should become TRANSPARENT so the holder's celebration backgrounds (driven by the palette via CSS custom properties) show through. Outside celebration windows, keep the current `#05070c` dark for clean QR display.

**Suggested fix:** add a CSS rule that overrides the overlay background when the holder has any active celebration class:

```css
.irlid-qr-fullscreen:has(.irlid-qr-fullscreen-holder[class*="cel-"]){background:transparent;}
```

Or alternatively, propagate a class to the overlay element when celebration fires. Either approach acceptable; `:has()` is cleaner if browser support is OK (it is for the relevant Chrome/Edge versions on Captain's stack).

### 1.2 `.irlid-qr-fullscreen-holder` holder background

Currently:
```css
.irlid-qr-fullscreen-holder{...background:#fff;...border-radius:clamp(12px,2vmin,22px);box-shadow:0 28px 90px rgba(0,0,0,0.54);}
```

The white background masks Glow halo's drop-shadow + scale animation. When a celebration class is active, the holder background should also become transparent (or use the celebration's palette-driven background colour) so glow effects render visibly.

**Suggested fix:**

```css
.irlid-qr-fullscreen-holder[class*="cel-"]{background:transparent;box-shadow:none;}
```

This removes both the white mask AND the heavy `box-shadow` (which competes visually with the Glow halo's own shadow effects). Outside celebration windows, keep the current white-on-shadow look for clean QR display.

The QR itself (canvas/img inside the holder) already has its own visible rendering — the `<canvas>` or `<img>` element will continue to render the QR as before; only the surrounding container chrome becomes transparent.

---

## 2. Verify Glow halo prominence after 1.1 + 1.2

With both backgrounds transparent, the Glow halo's keyframe animation (`v511CelGlowHalo` defined around Org.html line 4417-4420) should become visible against the celebration's palette-driven background colour.

Real-hardware test: trigger a check-in/out with a sequence that includes Glow halo. In fullscreen view, you should see a soft circular glow / drop-shadow ring around the QR for the duration of the Glow halo step. If still invisible, the Glow halo's animation may need an additional `--glow-color` or similar CSS custom property propagation through the fullscreen-scoped path. Investigate but don't deep-rabbit-hole — if it requires more than a small CSS addition, log it as v5.11.0r.

---

## 3. Out of scope (do NOT change)

- The `fireConfiguredSequence` runtime targeting (already correct from v5.11.0p)
- Any Org.html JS changes (unless you discover the holder isn't getting `v511-runtime-stage` class, which would invalidate the assumption — but I verified it does)
- The fullscreen overlay's `.irlid-qr-fullscreen-close` button, refresh chrome, logo/title/subtitle layout
- Stream particles + Text overlay rendering (both visibly working in fullscreen per Captain's smoke)
- Other celebration effects beyond Glow halo unless the same CSS scope issue applies (in which case fix them together)
- v5.11 library — no new effects, no changes to existing effect classes beyond CSS scope adjustments

---

## 4. Pill + cache bumps

After all code changes:
- `Org.html` build pill: `v5.11.0p` → `v5.11.0q`
- `sw.js` `CACHE_VERSION`: `irlid-shell-v26` → `irlid-shell-v27` with comment noting v5.11.0q fullscreen overlay celebration backgrounds
- `js/qr-fullscreen.js` is a Service Worker pre-cached asset, so the SW cache bump is critical to evict stale CSS

---

## 5. Acceptance criteria

After Captain merges + pulls + hard-refreshes + closes/reopens phone tabs:

1. **Fullscreen view shows celebration palette background.** Trigger Kerry check-out → fullscreen view's background colour matches the celebration's palette (e.g., red/magenta for the configured mode), NOT the hardcoded dark `#05070c`.
2. **Glow halo visibly renders around the QR in fullscreen.** A configured sequence including Glow halo step → fullscreen view shows the soft circular halo around the QR (drop-shadow + scale animation visible against the palette background).
3. **Non-fullscreen Check-in tab unaffected.** Visual behaviour in normal Check-in tab is unchanged from v5.11.0p — Glow halo, Text, Stream all continue to render as before.
4. **Closing fullscreen restores clean QR display.** When fullscreen is dismissed (Escape or X), no leftover transparent-background styling persists.
5. **Build pill reads `v5.11.0q`.**

---

## 6. Codex prompt template (Captain pastes verbatim)

```
Read HANDOVER-FullscreenCelebrationBackgrounds-v5.11.0q.md at repo root and execute.

Branch: codex/v5.11.0q-fullscreen-celebration-backgrounds
Open PR against main when complete.
Reply with PR number + one-paragraph summary of (a) which CSS selectors you used to scope the celebration-aware backgrounds (`:has()` vs class propagation), (b) whether Glow halo became visible after the background fix or required additional CSS work, (c) verification that non-fullscreen Check-in tab visual behaviour is unchanged.
```

---

— Number One, drafted 26 May 2026 morning (Tuesday)
