# HANDOVER — v5.11.0o Wire real check-in runtime to v5.11 sequence + add QR Glow effect

**Target pill bump:** `v5.11.0n` → `v5.11.0o`
**Service worker cache bump:** `v24` → `v25`
**Live repo:** `D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo`
**Branch:** `codex/v5.11.0o-checkin-runtime-qr-glow`
**Captain's framing:** v5.11.0n landed save + Settings preview correctly. The Settings preview fires Captain's configured sequence. But on a REAL check-in event (e.g., Kerry checking out and the dashboard's poll detecting the event), the OLD hardcoded celebration code fires — NOT the user's configured `theme._v511.celebration` sequence. So Captain's visual choices are invisible on the actual product surface. Primary goal of this PR: real check-in events fire the configured sequence. Secondary: replace the existing "Glow halo" library entry with a new "QR Glow" effect that emanates rays from the QR centre (Captain's preferred celebration aesthetic — reference video saved at `memory/references/celebration-diagonal-sweep-2026-05-25.mp4` if Captain pushed it).

---

## 1. Diagnose first

Find these two code paths in `Org.html`:

**Path A — Settings → Visual Theming PREVIEW celebration runner.** This is the code you built for v5.11.0m / v5.11.0n that takes the `theme._v511.celebration` sequence and fires each effect in order on the live preview pane. **It works correctly** (Captain confirmed via the Visual Theming tab preview showing Glow halo + Text + Stream effects firing).

**Path B — REAL Check-in tab celebration on actual check-in/out events.** Triggered by the 4-second poll on `/org/attendance` detecting a new IN or OUT row. **This currently fires old hardcoded celebration code** — likely diagonal-stripe CSS animations that pre-date the v5.11 sequence-builder rebuild (19 May). Search for the function or event handler that fires when a new attendance row is detected. Likely names: `fireCelebration`, `triggerCheckInAnimation`, `playCelebration`, or a snippet inside the poll's success handler.

**The fix:** unify Path A and Path B. The same runner that fires the preview should fire the real check-in event. Either factor out a shared `fireConfiguredSequence(mode, stage)` function that both paths call, OR replace Path B's hardcoded body with a call to Path A's existing runner.

---

## 2. Two fix areas

### 2.1 Wire real check-in runtime to fire configured `theme._v511.celebration`

After diagnosing Path B:

1. **Replace the hardcoded effect** with a call that:
   - Reads the current org's `theme._v511.celebration[mode]` array (where `mode` is `allow` / `review` / `deny` based on the check-in outcome — Allow for normal check-in/out, Deny for rejected, etc.)
   - Iterates the sequence array in order
   - For each item, fires the effect on the Check-in tab's render surface (NOT the Settings preview pane — the actual visible Check-in tab DOM)
   - Honours per-item duration + delay
2. **Fall back to canonical `theme.*` fields** if `_v511.celebration` is absent (backward compat with v5.10.x saves — those won't have a `_v511` block).
3. The mode resolution: an Allow check-in (normal IN/OUT) fires `celebration.allow`. A Review (escalated, awaiting bind) doesn't typically fire celebration. A Deny fires `celebration.deny`. Captain primarily cares about Allow for now.

### 2.2 Replace "Glow halo" library entry with "QR Glow"

The current "Glow halo" effect in the v5.11 library renders a soft circular halo (or whatever your v5.11.0m version of it does). Replace its CSS keyframes + implementation with a **QR Glow** effect:

- **Visual:** light rays emanating outward from the QR centre point. Multiple rays at varied angles forming a starburst-like pattern. Rays appear to ORIGINATE from behind/inside the QR and extend outward.
- **Animation:** slow rotation around the QR centre. The ray array rotates over the effect's duration (one full rotation per duration, or partial sweep — designer's choice for visual feel).
- **Colour:** palette-driven. Use `var(--celebration-palette-1)` (or whatever existing CSS custom property the celebration palette uses). If multiple rays, can cycle through palette colours.
- **Intensity setting:** chip group { subtle / medium / strong } maps to ray count (e.g., 4 / 8 / 16 rays) + opacity (0.3 / 0.5 / 0.8).
- **No text overlay needed** — Captain explicitly excluded text from this effect's scope.
- **Implementation approach** (suggestion, not mandate): CSS conic-gradient with hard colour stops creates a ray pattern; rotate via `transform: rotate(Xdeg)` keyframes. Position with `position: absolute; inset: 0; transform-origin: center` on an overlay div sized to encompass the QR + reasonable bleed area.

**Library entry naming:** keep the visible label as "Glow halo" if it makes the migration easier (existing user sequences continue to reference the same effect ID), OR rename to "QR Glow" if you prefer the more accurate name. Captain explicitly said either is fine. Whichever you pick, document the choice in the PR.

---

## 3. Out of scope (do NOT change)

- Other library effects (Sparkles, Stream, Text overlay, Confetti, Flame, Glitch, etc.) — only the Glow halo entry is being replaced this PR.
- The Settings preview pane behaviour — already working, leave alone.
- Backward compatibility with v5.10.x saves — runtime fallback to canonical `theme.*` fields is the answer there; no schema change needed.
- Worker side — likely no changes needed unless you discover a payload field that's getting stripped.
- Calendar / Staff & Rooms / other Settings tabs — still `design-in v5.12`, no save wire-up this PR.

---

## 4. Pill + cache bumps

After all code changes:
- `Org.html` build pill: `v5.11.0n` → `v5.11.0o`
- `sw.js` `CACHE_VERSION`: `irlid-shell-v24` → `irlid-shell-v25` with comment noting v5.11.0o real check-in runtime wire-up

---

## 5. Acceptance criteria

After Captain merges + pulls + hard-refreshes + closes/reopens phone tabs:

1. **Real check-in event fires the configured sequence.** Captain triggers an actual check-out via the dashboard → his `theme._v511.celebration.allow` sequence (whatever he's configured) fires on the Check-in tab. The OLD hardcoded diagonal-stripe code path no longer fires.
2. **QR Glow effect renders correctly:** dragging "Glow halo" (or "QR Glow" if renamed) from the library into the sequence and firing Sample produces visible rays emanating from the QR centre, rotating slowly, palette-coloured.
3. **Intensity setting works:** changing intensity chip from subtle → medium → strong visibly changes the ray count + opacity.
4. **Backward compat:** orgs with no `theme._v511` block (e.g., the magenta-dragon theme from old v5.10.x saves) continue to render correctly with the legacy effect or a sensible default — DO NOT show nothing on check-in just because `_v511` is absent.
5. **Build pill reads `v5.11.0o`.**

---

## 6. Codex prompt template (Captain pastes verbatim)

```
Read HANDOVER-CheckinRuntimeAndQRGlow-v5.11.0o.md at repo root and execute.

Branch: codex/v5.11.0o-checkin-runtime-qr-glow
Open PR against main when complete.
Reply with PR number + one-paragraph summary of (a) where the old hardcoded check-in celebration code path lived + how you replaced it; (b) the QR Glow effect's CSS approach + the library naming decision; (c) backward-compat behaviour for saves without _v511 metadata.
```

---

— Number One, drafted 25 May 2026 evening (closing-the-day push)
