# HANDOVER — v5.11.0p Complete check-in celebration features (Stream + dedupe + fullscreen)

**Target pill bump:** `v5.11.0o` → `v5.11.0p`
**Service worker cache bump:** `v25` → `v26`
**Live repo:** `D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo`
**Branch:** `codex/v5.11.0p-checkin-feature-completion`
**Captain's framing:** v5.11.0o landed the architectural win — real check-in events now read `theme._v511.celebration` and fire configured effects (NOT the old hardcoded code path). But three polish gaps surfaced on real-hardware smoke that block "all check-in features working":
1. **Only Glow halo + Text overlay fire on real check-ins.** Stream/Sparkles/Confetti/Flame/Glitch don't render despite being in the sequence library and working in the Settings preview.
2. **Text overlay duplicates** — fires twice on a single check-in event (one overlay text remains visible after the celebration, second one overlays on top).
3. **Fullscreen view shows no animations** — the qr-fullscreen.js overlay (`overlay.requestFullscreen()` on line 217 of `js/qr-fullscreen.js`) hides body-level celebrations via BOOTSTRAP §6 line 228 (Browser Fullscreen API only renders the fullscreen element + descendants).

These three together complete the Reading C architectural win Captain has been driving toward. After this PR, what the user configures in Settings is what fires on real check-ins, in EVERY view including the entrance-fullscreen.

---

## 1. Diagnose first (read your own v5.11.0o work)

You shipped v5.11.0o in PR #48. The runtime entry point you introduced:

- `triggerAcceptCycleAnimation()` first looks for the saved v5.11 allow sequence and plays it on `#venueQRWrap`
- Falls back to `theme.celebration` / `cycleMode` dispatcher only when no v5.11 metadata exists

Find this function. Also find the Settings preview sequence runner you built for v5.11.0m/n (it's the code that fires the live preview when Captain hits "Sample" in Visual Theming). The preview runner correctly renders ALL library effects (Stream, Sparkles, etc.) because the v5.11.0n smoke verified this. **Unify the two paths** — the real check-in runtime should reuse the preview runner's effect-firing code, not duplicate a partial subset.

Then find:
- The qr-fullscreen.js overlay element creation (`document.createElement("div")` at line 16, appended to `document.body` at line 31)
- The fullscreen activation (`overlay.requestFullscreen()` at line 217)
- The existing BOOTSTRAP §6 line 228 fix precedent you used for the offline indicator in v5.9.0.13.19 — scoped CSS rules like `body.is-offline .irlid-qr-fullscreen.active::after`. Same pattern applies here.

---

## 2. Three fix areas

### 2.1 Expand real-check-in runtime to cover ALL v5.11 library effect types

`triggerAcceptCycleAnimation()` currently fires Glow halo + Text overlay correctly but doesn't reach Stream, Sparkles, Confetti, Flame, Glitch, or any other v5.11 library effect. Root cause is likely that the real-event code path duplicates a subset of the preview runner's effect-firing logic.

**Fix:** factor out a shared `fireConfiguredSequence(sequence, mode, stage)` function that takes the configured sequence array, the mode (`allow`/`review`/`deny`), and the target stage DOM element (`#venueQRWrap` for non-fullscreen, fullscreen overlay for fullscreen — see 2.3). Both the Settings preview runner AND the real-check-in runtime call this shared function. The function iterates every item in the sequence, looks up its effect class, applies CSS classes + custom properties (Intensity, Direction, Offset, etc. from item.settings), waits for the item's duration, removes the class, then proceeds to the next item.

If the preview runner is already structured this way, the real-check-in runtime just needs to call it (passing the correct target stage). If not, factor it out cleanly.

### 2.2 Fix Text overlay duplication

Real check-in shows two text overlays on a single check-in event (per Captain's smoke screenshot — one in the centre pill, one as italic script below). Possible causes:

- **Double-bound handler:** `refreshAttendance()` poll detects the new attendance row AND the local doorman/manual success path also fires; both call `triggerAcceptCycleAnimation()` independently. Check whether the function is idempotent or guards against re-entry within a short window.
- **Per-mode race:** the sequence is fired for both `allow` mode AND a fallback `default` mode in the same trigger. Audit the mode-resolution logic.
- **CSS class re-add restart:** if the Text overlay class is added, removed, then added again (e.g., once at sequence start, once at item-iteration time), the CSS animation might restart, creating a perceived "second" overlay.

Add a guard: `triggerAcceptCycleAnimation` should set a flag (e.g., `window.__irlidAcceptCycleActive = true`) for the duration of the sequence, and refuse re-entry if already true. Clear the flag when the sequence completes.

### 2.3 Fullscreen overlay celebration rendering

The qr-fullscreen.js overlay element (`#irlid-qr-fullscreen` or whatever its actual ID/class is — verify) is a SEPARATE div from `#venueQRWrap`, appended to `document.body` at line 31. When `overlay.requestFullscreen()` fires at line 217, the Fullscreen API hides everything that isn't a descendant of `overlay`. Celebrations painted on `#venueQRWrap` are invisible while fullscreen is active.

**Fix architecture (matches BOOTSTRAP §6 line 228 precedent from v5.9.0.13.19):**

1. In `triggerAcceptCycleAnimation()` (or the shared `fireConfiguredSequence()` from 2.1), check `document.fullscreenElement`:
   - If null OR not the qr-fullscreen overlay → target stage is `#venueQRWrap` (current behaviour)
   - If it IS the qr-fullscreen overlay → target stage is the QR container INSIDE the overlay (likely `overlay.querySelector('.irlid-qr-fullscreen-holder')` per line 32 of qr-fullscreen.js)
2. Apply ALL celebration classes (`celebration-glow`, `celebration-pulse`, effect-specific classes from the library, Text overlay element) to the chosen target stage.
3. **CSS rules must cover BOTH targets.** Currently rules are scoped `body #venueQRWrap.celebration-X`. Add equivalent rules scoped `.irlid-qr-fullscreen .irlid-qr-fullscreen-holder.celebration-X` (or whatever the holder selector is). For the QR Glow effect specifically, the radial halo and conic-gradient rays CSS need to render correctly in both contexts.
4. **For Text overlay specifically** — if it's a separate DOM element (not a `::before` pseudo), inject it INSIDE the fullscreen overlay when fullscreen is active, and remove it when celebration completes OR fullscreen closes. Mirror the offline-indicator pattern from v5.9.0.13.19.

---

## 3. Out of scope (do NOT change)

- The Settings preview runner (already correctly fires all library effects per v5.11.0n smoke). Only TOUCH it if factoring out the shared sequence-firing function.
- Worker side — no changes needed.
- Other v5.11 Settings tabs (Organisation, Staff & Rooms, etc.) — still `design-in v5.12`.
- The QR Glow effect's CSS keyframes (already working in non-fullscreen and Settings preview). Only ADD scoped fullscreen-overlay rules, don't change existing.
- Library effect catalog — no new effects this PR.
- Backward compat with v5.10.x saves — already handled by v5.11.0o's `theme._v511`-or-canonical-fallback logic.

---

## 4. Pill + cache bumps

After all code changes:
- `Org.html` build pill: `v5.11.0o` → `v5.11.0p`
- `sw.js` `CACHE_VERSION`: `irlid-shell-v25` → `irlid-shell-v26` with comment noting v5.11.0p check-in feature completion

---

## 5. Acceptance criteria

After Captain merges + pulls + hard-refreshes + closes/reopens phone tabs:

1. **All v5.11 library effects fire on real check-ins:** trigger a Kerry check-out → configured sequence (e.g., Glow halo + Text overlay + Stream) fires every effect on the Check-in tab, NOT just Glow halo + Text overlay. Verify Stream, Sparkles, Confetti, Flame, Glitch each render correctly when added to a sequence.
2. **Text overlay fires exactly once per check-in event:** trigger a check-out → only one text overlay appears (no duplication). Check via real attendance poll path AND local manual-success path; both should respect the re-entry guard.
3. **Fullscreen view fires animations:** click Fullscreen on the Check-in tab → trigger a Kerry check-out → all configured effects render INSIDE the fullscreen overlay (rotating rays from QR, text overlay, particle effects). Escape fullscreen → animations continue rendering correctly in non-fullscreen mode.
4. **Backward compat preserved:** orgs with no `theme._v511` block (e.g., a hypothetical org using only legacy v5.10.x save) — celebration still fires via fallback path, no console errors.
5. **Build pill reads `v5.11.0p`.**

---

## 6. Codex prompt template (Captain pastes verbatim)

```
Read HANDOVER-CheckinFeatureCompletion-v5.11.0p.md at repo root and execute.

Branch: codex/v5.11.0p-checkin-feature-completion
Open PR against main when complete.
Reply with PR number + one-paragraph summary of (a) how you factored the shared sequence-firing function and where it now lives; (b) the root cause of the Text overlay duplication and your guard mechanism; (c) the fullscreen-overlay celebration scoping approach including the selector + the CSS rules you added (reference v5.9.0.13.19 if you reused that precedent).
```

---

— Number One, drafted 26 May 2026 morning (Tuesday)
