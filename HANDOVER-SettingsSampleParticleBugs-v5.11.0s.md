# HANDOVER — v5.11.0s Settings Sample particle effect bugs (three distinct symptoms)

**Target pill bump:** `v5.11.0r` → `v5.11.0s`
**Service worker cache bump:** `v28` → `v29`
**Live repo:** `D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo`
**Branch:** `codex/v5.11.0s-settings-sample-particle-bugs`
**Captain's framing:** v5.11.0r unified the dispatch path through `fireConfiguredSequence` correctly (your own work). But real-hardware smoke surfaced three DISTINCT symptoms when each particle effect fires in Settings Sample preview — each with what looks like a different root cause. This brief lists the specific observed behaviour for each so you can investigate the effect-specific paths (not the now-unified dispatcher).

**Important context — production real check-ins UNAFFECTED.** Yesterday's smoke confirmed Stream particles fire correctly on real Kerry check-out in production Check-in tab fullscreen view. The bugs are confined to Settings Sample preview surface. Don't regress production.

---

## 1. The three observed symptoms (Captain's exact words)

> "Confetti plays bottom right only, then believe sparkles changes the background and nothing from stream."

Three particle effects, three different broken behaviours, all in Settings Sample:

### 1.1 Confetti — plays bottom-right only

Confetti DOES fire (visible in screenshots — orange/red/yellow specks bottom-right of QR area), but it's confined to one corner instead of spreading across the stage. Default `s.confettiSpread = 'fill'` should distribute across the X axis. Either:
- The spread mode isn't being applied in Sample context
- The Sample stage's `getBoundingClientRect()` returns something that defaults the X distribution to one corner
- A CSS rule clips/constrains the particle container to bottom-right

`v511FireConfettiParticles` is at Org.html line 7809. Investigate why `confettiSpread` defaults aren't producing the expected distribution.

### 1.2 Sparkles — changes the background instead of rendering sparkles

This is the strangest symptom and likely the easiest to fix once located. Captain reports: "sparkles changes the background." Sparkles should render small bright DOM particles with twinkle animations — it should NOT modify the stage's background colour.

**Strongly suspect a CSS class collision.** The dispatcher adds `cel-sparkles` to the stage (`var cls = 'cel-' + effectKey;` at Org.html line 8037). If there's a CSS rule `:is(.v511-theme-preview-stage, .v511-runtime-stage).cel-sparkles { background: ... }` OR if `cel-sparkles` is somehow matching `.cel-bg-*` patterns (e.g., via attribute selector overlap), the background gets cycled instead of sparkles rendering.

Also check `v511FireSparkleParticles` (line 7688) — does it inject sparkle DOM nodes that are getting hidden or absorbed by the wrong layer? If the function fires correctly but no DOM appears, the CSS layer scoping may be wrong.

### 1.3 Stream — nothing fires

`v511FireStreamParticles` (line 7620) uses `v511GetStreamAnchors(stage, item)` to find spawn positions. Per the function comments: anchors come from "visible image instances" (dragons!) or stage centre as fallback. In production Check-in tab fullscreen, the dragons are in the stage; in Sample preview, the stage may not have dragons OR they may be positioned/sized such that `getBoundingClientRect()` returns zero-area rects → anchors collapse → particles spawn at coordinates that are off-stage or zero-sized.

Investigate `v511GetStreamAnchors`'s behaviour when no valid anchors are found. The fallback to stage centre should still produce visible particles, but if the stream emission angle (`s.direction9 || 'l'` defaults to LEFT, baseAngle from `V511_STREAM_DIR_ANGLES`) blows particles off-stage when spawning at centre, they're rendered then immediately invisible.

---

## 2. Diagnostic approach (suggested)

For each effect, do an inline test in browser DevTools while Sample is firing:

1. **Confetti:** while Sample is mid-animation, inspect the spawned `.v511-confetti-piece` (or similar) elements — what are their `style.left` / `style.transform` values? Is `s.confettiSpread` being read?

2. **Sparkles:** while Sample is firing, inspect the stage element — what classes are added? Is `cel-sparkles` there? Is there a CSS rule modifying `background` that's being triggered by that class? Open `getComputedStyle(stage)` and check `background-color` / `background-image` properties — do they change when `cel-sparkles` is added?

3. **Stream:** add console.log to `v511GetStreamAnchors(stage, item)` to dump anchor positions. If anchors are empty/zero-sized, the fallback path is the bug. If anchors exist but particles still don't fire, check `v511FireStreamParticles` for early-return conditions or layer hiding.

---

## 3. Out of scope (do NOT change)

- Production real check-in runtime — verified Stream + particles firing correctly on real check-ins yesterday (and v5.11.0o/p/q work preserves this). DO NOT touch `triggerAcceptCycleAnimation` or production paths.
- The unified `fireConfiguredSequence` dispatcher — your v5.11.0r work. The bugs are in effect-specific paths, not the dispatcher.
- Flame + Glitch effects — not affected (different code family, verified Captain's smoke).
- Worker side — no changes.
- Other Settings tabs — still `design-in v5.12`.

---

## 4. Pill + cache bumps

- `Org.html` build pill: `v5.11.0r` → `v5.11.0s`
- `sw.js` `CACHE_VERSION`: `irlid-shell-v28` → `irlid-shell-v29` with comment noting v5.11.0s Sample particle effect fixes

---

## 5. Acceptance criteria

After Captain merges + pulls + hard-refreshes + closes/reopens phone tabs:

1. **Confetti spreads across the stage, not corner-clustered:** Settings → Visual Theming → drag Confetti drop into sequence → Sample → confetti pieces visible across the QR area's full width, not stuck bottom-right. Both inline AND fullscreen preview modes.
2. **Sparkles render sparkle particles (NOT background change):** drag Sparkles → Sample → small bright twinkle particles visible across the stage, stage background colour is UNCHANGED by the Sparkles effect. Both modes.
3. **Stream particles fire visibly in Sample:** drag Stream → Sample → stream particles spawn from a sensible origin (stage centre if no dragons) and visibly travel before fading. Both modes.
4. **Production real check-in UNREGRESSED:** trigger real Kerry check-out → all configured particle effects fire correctly on production Check-in tab fullscreen (verifies the production path is still happy after the Sample-specific fixes).
5. **Other Sample effects unaffected:** Flame, Glitch, Pulse, Glow halo / QR Glow Rays, Text overlay — all still work as they did in v5.11.0r.
6. **Build pill reads `v5.11.0s`.**

---

## 6. Codex prompt template (Captain pastes verbatim)

```
Read HANDOVER-SettingsSampleParticleBugs-v5.11.0s.md at repo root and execute.

Branch: codex/v5.11.0s-settings-sample-particle-bugs
Open PR against main when complete.
Reply with PR number + one-paragraph summary of (a) root cause + fix for Confetti corner-clustering, (b) root cause + fix for Sparkles changing background instead of rendering sparkles, (c) root cause + fix for Stream not firing in Sample. Mention if any of the three share a root cause OR if they're three distinct bugs.
```

---

— Number One, drafted 26 May 2026 evening (Tuesday)
