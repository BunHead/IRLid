# HANDOVER — v5.11.0n Close Visual Theming save gaps + fix slider track tracking

**Target pill bump:** `v5.11.0m` → `v5.11.0n`
**Service worker cache bump:** `v23` → `v24`
**Live repo:** `D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo`
**Branch:** `codex/v5.11.0n-visual-theming-save-gaps`
**Captain's framing:** v5.11.0m landed the save plumbing successfully — toast fires, palette + QR foreground round-trip cleanly. But during smoke he found gaps: "Background cycle direction didn't save after save all confirmed. QR seems to save. Slider bar backings don't track. Some settings carry over and some don't when I ran a check out on Kerry." The pattern is clear: settings that exist in the v5.10.x canonical theme shape save and render correctly; settings that exist ONLY in the new v5.11 UI controls (per-mode background direction, new effect types like Stream, etc.) may save into `theme._v511` metadata but the runtime renderer ignores them. This brief closes those gaps + fixes the slider CSS.

---

## 1. Diagnose first (read your own v5.11.0m work, then identify the gaps)

You shipped v5.11.0m. The diagnostic posture from your PR #46 was excellent: "mapped the active v5.11 mode into the old canonical fields for live check-in rendering, while preserving the fuller v5.11 state under `theme._v511` metadata."

That mapping is the source of the gaps. To find them:

1. **In `Org.html`**, find the v5.11 save handler you added (the one wired to `v511VisualSaveBtn`). Read how it builds the canonical theme payload + the `theme._v511` metadata.
2. **Compare against the runtime render code paths** that read `theme.*` to apply visuals on the Check-in tab. List every `theme.<field>` read site.
3. **Identify v5.11 UI controls that exist in the save → `_v511` path but have NO corresponding `theme.<field>` read site.** Those are the gaps causing Captain's "didn't save / didn't carry over" complaints.

Captain specifically called out:
- **Background cycle direction** — the control likely lives in the v5.11 Background panel but the runtime renderer's background animation reads only `theme.bgMode` / `theme.bgPattern` / `theme.cycleDuration`, with no direction concept.
- **New particle effects (Stream, etc.)** — runtime celebration renderer probably has hooks for Glow halo + Text overlay but not for Stream / Confetti / Sparkles / Flame / Glitch that the v5.11 sequence-builder exposes.
- **Effect-specific settings** (Intensity / Anchor / Direction grid / Particle count / Stream width / Offset X+Y / Mirror on symmetry / Colour source / Gravity for each effect) — almost certainly saved into `_v511.celebration[].settings` but not consumed by the runtime renderer.

---

## 2. Three fix areas

### 2.1 Teach runtime renderer to read `theme._v511` metadata

**Architectural choice** (Captain's preference, explained in chat): hybrid approach. Runtime renderer reads `theme._v511` FIRST if present (richer per-mode state). Falls back to canonical `theme.*` fields if `_v511` is absent (preserves backward compat with v5.10.x saves still in D1).

Concretely:

1. Wherever the runtime currently reads `theme.bgMode`, `theme.bgPattern`, etc. for the Check-in tab background animation → check if `theme._v511` exists for the active mode (Allow / Review / Deny based on the check-in outcome) and use that richer state. Specifically the background cycle direction needs a render hook.
2. Wherever the celebration sequence runs (probably triggered by the 4-second poll on remote check-ins) → if `theme._v511.celebration` is present, iterate the sequence array and fire each effect type with its settings. Currently the runtime probably has a hardcoded set of effects; expand it to cover all 20+ effects in the v5.11 sequence library.
3. Effect-specific settings (Intensity / Direction9 / etc.) need translation into CSS classes / custom properties on the relevant rendering element BEFORE the effect class fires. The mockup-stage version of this already exists at `v511ApplyItemSettings` (or similar — search) from the 19 May architectural rebuild — port that logic to the runtime renderer.

### 2.2 Fix slider visual track tracking

The v5.11 sliders (Particle count, Stream width, Offset X, Offset Y, etc.) have a thumb that moves correctly but the FILLED portion of the track behind the thumb doesn't update on input. This is almost certainly a missing `oninput` handler that updates a CSS custom property like `--range-progress` or `--slider-fill-percent` that the slider's `::before` pseudo-element uses for `width:`.

Find the slider CSS rule (search for `input[type="range"]` and `::before` together) — note the custom property it uses. Find the slider element rendering in Org.html — add an `oninput` (or `addEventListener('input', ...)`) handler that computes `(value - min) / (max - min) * 100` and `setProperty` it as the relevant CSS custom property on the slider element.

If the CSS uses `linear-gradient` directly in the `background` instead of a `::before` pseudo, the JS handler still updates the same custom property which is referenced inside the gradient — same pattern.

### 2.3 Save round-trip verification

After fixes, the round-trip MUST be: change ANY v5.11 control → Save → hard refresh → control state is restored → Check-in tab visually reflects the change.

For every control in the Visual Theming tab, verify this round-trip. Document the verification in the PR description.

---

## 3. Out of scope (do NOT change)

- The save plumbing itself (your v5.11.0m work — the GET-overlay-POST-readback pattern stays as-is).
- The per-tab badges (Visual Theming = `live save`, others = `design-in v5.12`) — those land correctly.
- The banner removal — done in v5.11.0m, stays gone.
- Other tabs (Organisation / Staff & Rooms / etc.) — still `design-in v5.12`, no save wire-up this PR.
- The Invite Staff button — separate v5.11.0o brief (not this one).

---

## 4. Pill + cache bumps

After all code changes:
- `Org.html` build pill: `v5.11.0m` → `v5.11.0n`
- `sw.js` `CACHE_VERSION`: `irlid-shell-v23` → `irlid-shell-v24` with comment noting Visual Theming save gap closure

---

## 5. Acceptance criteria

After Captain merges + pulls + hard-refreshes + closes/reopens phone tabs:

1. **Every Visual Theming control round-trips:** change → Save → hard refresh → state restored. Test specifically: Background cycle direction, Celebration sequence (add a Stream effect, save, reload — Stream is still in the sequence), effect-specific settings (Intensity / Direction / Offset).
2. **Check-in tab reflects all changes:** after a save, navigate to Check-in tab → the public-facing QR background renders with the new direction / palette / pattern. After a real check-in triggers the celebration animation, the new effects (Stream / Sparkles / etc.) fire.
3. **Slider track tracking works:** dragging any slider in the Effect Settings panel shows the filled track behind the thumb update in real-time. Releasing the thumb leaves the fill matching the new value.
4. **Backward compat preserved:** Captain's existing magenta-dragon theme (saved months ago via the OLD v5.10.x Settings UI, present in D1 with `_v511` likely absent) continues to render correctly — the fallback to canonical `theme.*` fields still works for old saves.
5. **Build pill reads `v5.11.0n`.**

---

## 6. Codex prompt template (Captain pastes verbatim)

```
Read HANDOVER-VisualThemingSaveGaps-v5.11.0n.md at repo root and execute.

Branch: codex/v5.11.0n-visual-theming-save-gaps
Open PR against main when complete.
Reply with PR number + one-paragraph summary of which v5.11 controls had no runtime hook before this PR + how you wired them + a list of the slider elements whose CSS tracking you fixed.
```

---

— Number One, drafted 25 May 2026 evening (Captain's L&B break)
