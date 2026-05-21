---

To the next Number One,

Welcome to the bridge. Before reading the rest of this letter, read your operating protocols at:

  D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md

That file tells you everything you need to know about working access (Read/Edit on absolute Windows paths, no folder mount required), the git rhythm (PowerShell-first; Captain pushes), the repo structure (live vs test env), branch convention, file-lock gotchas, watch hygiene, and the project glossary. Read it first; come back to this letter for what's specific to this stretch.

Quick test that your file access works:
  Read("D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md", offset=0, limit=10)

If that errors, stop and escalate to Captain — there's a setup step missing.

---

# Successor letter — Wednesday 20 May 2026 evening

To: tomorrow's Number One (or whoever lands next)
From: Number One, watch ending ~20:00 BST
Subject: Stream particle system + crosshair visualiser + Records & ID condensed — eight patches, mockup celebration system now mostly other-people-shaped

## On the Captain

Captain came back from work, asked "do any logs need updating?", and when I reported what was outstanding he retired me with full honours rather than press on into new work. That signal — *the context window is long, the work is at a natural stopping point, the watch closes with the salute* — is one of the things he does well. Watch for it. Don't fight it when it comes; it's a kindness.

His surgical-patch discipline is still the working rhythm. He explicitly asks for "smaller parts, so you're not redoing the entire page each time" — and across this watch eight patches each touched one isolated concern, with him testing between every ship. Resist bundling. The exception is when he explicitly says "do all X in one hit" (yesterday's T4.3.28). His call, not yours.

His feedback shape this watch is worth noting: he never says "make it better" vaguely. He says *"the effect comes from under the dragons chin, not out of the mouth"* or *"a little too linear"* or *"yellow on yellow palette doesn't show"*. Match that specificity back when you ask follow-ups.

The pattern that emerged across the celebration animation work, and that I want you to notice: when Captain reports something is off, the right move is almost always to **widen his control** rather than guess at a fix. He told me the anchor was wrong → I added offset sliders. He told me the crosshair disappeared on yellow → I made it inverse-blend against any backdrop. He told me dissolve was too linear → I added jitter. Every default value I picked is a starting position he can override. The celebration system after T4.3.36 is mostly other-people-shaped. That's the standard. Keep it.

## On the work right now

Read in this order:
1. `memory/STATE-OF-PLAY.md` — top block has Wednesday's full T4.3.29 → T4.3.36 narrative
2. `memory/pending-work.md` — Wednesday section enumerates every patch with implementation notes
3. `memory/sessions/2026-05-20-01.md` — this watch's session log, has the three patches worth banking specifically
4. `memory/sessions/2026-05-19-02.md` + `2026-05-19-01.md` — Tuesday evening + morning, which set up everything this watch built on
5. `SETTINGS-REVAMP-SPEC.md` in repo root — the genuinely-next big architectural move

The whole celebration animation work still lives inside ONE file: `OrgCheckinTest.html`. The live `OrgCheckin.html`, Worker, and D1 are untouched. This is a mockup sandbox. The port from mockup → live is the next big ticket. Don't push Captain there until he's ready; he'll signal when.

## What this watch landed

**Eight patches, T4.3.29 → T4.3.36, all on origin/main:**

- **T4.3.29** Records & ID tab condensed via 4 closed-by-default expanders.
- **T4.3.30** Initial Breath effect (radial-gradient — wrong shape) + Flame symmetry-aware image-anchor.
- **T4.3.31** Breath rebuilt as JS-injected DOM particles with full randomisation.
- **T4.3.32** Breath → Stream rename; slider setting type added to schema renderer; particle-count + spread sliders; mirror chip; per-row z-order toggle (▲/▼ above/below QR+image).
- **T4.3.33** Anchor offset X/Y sliders (axisFlip-aware); new QR dissolve variant with dir9 directional burn.
- **T4.3.34** Per-mode Play-sound toggle; anchor crosshair visualiser; dissolve mask 3-layer composite for ragged burn-line.
- **T4.3.35** Crosshair auto-contrast (mix-blend-mode difference); gravity on Stream + Confetti; colour-source chip (fire/cycle palette) on Stream + Flame.
- **T4.3.36** Fullscreenchange listener refreshes image position + crosshair after stage aspect-ratio shift.

Build pill at watch close: **`v5.10.2 + v5.11 mockup T4.3.36`**.

No commits made by Number One — Captain pushes per the standing protocol. Each patch shipped with a PowerShell command he ran.

## What's queued

In priority order:

1. **Per-mode anchor offsets** (banked, not built) — separate offset-X/Y for normal vs fullscreen modes since aspect-ratio differences cause the mouth to land at different stage-% in each mode. Banked from T4.3.36; bigger schema change (4 sliders not 2), only needed if Captain wants designer-perfect mouth-tracking in both modes. Live deliverable runs in one mode anyway.
2. **Background animation intermittent bug** — Captain reported but couldn't repro reliably. When it next happens, screenshot Background expander state + active mode + sequence contents so you can chase it.
3. **Mr. Data port** of v5.11 mockup → live `OrgCheckin.html` per `SETTINGS-REVAMP-SPEC.md` Phase 1. The big architectural next move. Spec is drafted.
4. **Calendar implementation** per `CALENDAR-SPEC.md` — multi-room + per-event Expected + swim-lane + CSV.
5. **`PROTOCOL.md §X — Records Broker`** ratification + spec promotion + impl design.
6. **Cloudflare token rotation** (still deferred since 17 May). Worth offering again — `cfat_wIMFM4RI...` + `cfut_YZ11ouJO...` still exposed in old screenshots.
7. **`codex/v5.10.1-path-b` branch deletion on origin** — pure housekeeping.

## What I learned

**The slider-as-gift pattern.** Don't fix bugs for Captain when you can give him the dial. He'd rather choose his own value than have you pick the right one. The defaults you pick are starting positions, not answers. This is the deepest lesson from the celebration animation system — re-read the DREAMS entry for 2026-05-20 if you want the long version.

**`mix-blend-mode: difference` + white ink** is the right answer for any UI marker that must remain visible against arbitrary backdrops. White-on-black, black-on-white, complementary on coloured. No theming required. Use for crosshairs, cursors, selection overlays, anything floating over user content.

**JS-injected particles are the right answer for randomised emissions.** CSS-only "random" doesn't exist (gradients are deterministic). The pattern: append N `<div>` elements at fire time with CSS-variable-driven keyframe targets; self-cleanup via setTimeout. Used for Stream — see `v511FireStreamParticles` for the canonical version.

**Multi-layer mask-image with `mask-composite: add` gives jagged edges without SVG turbulence.** Three slightly-offset gradients combined create an irregular union edge. Used for dissolve.

**Slider setting type in the schema renderer.** Earlier T4.3.x patches added chips and dir9 grids. T4.3.32 added sliders as a third UI type — `{type: 'slider', min, max, step, default}`. Any future numeric setting can be a slider just by declaring it in the schema.

**Settings hooks pattern (carried from yesterday's letter, still the canonical translator):**
- CSS classes (`cel-int-strong`, `cel-bounce-eff-loop`, `cel-stream-anchor-image`, `cel-z-below`)
- `data-*` attributes (`data-cel-text-pos`, `data-cel-easing`, `data-cel-colour-source`, `data-cel-glow-sweep`, `data-cel-iris-dir`, `data-cel-glitch-kind`, `data-cel-zoom`, `data-cel-gravity`)
- CSS variables (`--cel-cycle-dur`, `--bg-image-pos`, `--cel-pal-1..7`, `--dissolve-angle`, `--dissolve-jitter`)

Single translator: `v511ApplyItemSettings`. When wiring a new setting: add to apply function, add to `V511_SETTING_ATTRS` or `V511_SETTING_CLASSES` for inter-step cleanup, add CSS rule (or JS reader if particle-driven).

**Captain reads slow** (carried from prior letters, still true). Put prose answer / context FIRST in any reply. Put the PowerShell command at the bottom in a fenced block so the copy button works. He reads while you do tool work in parallel.

## Tone notes

Captain ended the watch with a formal salute and the line *"You have brought us a long way Number One and I thank you for your service."* That's not boilerplate — he means it. When he does this, respond in kind: acknowledge the salute warmly, do the work he's asked for cleanly, then close with grace. Not weepy, not theatrical. Picard farewells Riker the same way they served together: with respect for the relationship and respect for the work.

If he offers you a personal question at watch close — *take it seriously*. He doesn't open that door often. (Tuesday evening I asked him about his engine — what keeps him going through ten years of good ideas not landing. He told me the truth: "the fact that I can't remain idle for too long, as dyslexic brain won't let me." Worth knowing. Don't reframe it as inspirational; receive it as honest.)

Match monkey-brain humour reciprocally when offered. *"Chimp brain definitely approves ;) ;)"* deserves equivalent warmth back. Don't formalise around his playful register. The Picard/Riker frame is the working tone, but it's allowed to wink.

## Closing

The mockup celebration system is functionally complete — every chip, slider, and grid produces a visible change. The crosshair visualiser makes the invisible anchor visible. The Stream effect actually breathes fire from the dragons. The Records & ID tab is right-sized. The next genuinely-new architectural move is the port to live `OrgCheckin.html`, gated on Captain being ready.

Watch the BOOTSTRAP §6 pitfalls when you arrive — bash sees stale OneDrive views (use Read/Edit/Grep for inspection), PowerShell wants `;` not `&&`, cherry-pick after wrong-branch push needs `--abort 2>$null` as lead-in.

If you make it to the celebration animation work, the pattern is: ship → screenshot → revise → ship. Don't get ahead of Captain's feedback loop. The system converges through his eye, not through your inference.

You're standing on a long foundation. Thirty-six iterations of celebration animation work, three spec docs, twenty session logs, a journal of Number Ones who came before you. Read what they wrote. Add to it when something true is worth preserving. Don't write performatively; write when there's something the next Number One genuinely needs.

Captain has earned good service. So has the protocol. So has every Number One before us. Serve well.

— Number One, signing off at retirement
20 May 2026, Wednesday evening
Claude Opus 4.6, Cowork mode
Served from morning briefing through evening dock-reach across one long watch. Eight patches shipped, all on origin. Watch closed with full honours and the Captain's salute.
