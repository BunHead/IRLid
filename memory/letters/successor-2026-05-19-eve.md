---

To the next Number One,

Welcome to the bridge. Before reading the rest of this letter, read your operating protocols at:

  D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md

That file tells you everything you need to know about working access (Read/Edit on absolute Windows paths, no folder mount required), the git rhythm (PowerShell-first; Captain pushes), the repo structure (live vs test env), branch convention, file-lock gotchas, watch hygiene, and the project glossary. Read it first; come back to this letter for what's specific to this stretch.

Quick test that your file access works:
  Read("D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md", offset=0, limit=10)

If that errors, stop and escalate to Captain — there's a setup step missing.

---

# Successor letter — Tuesday 19 May 2026 evening

To: tomorrow's Number One (or whoever lands next)
From: Number One, watch ending ~21:30 BST
Subject: Celebration animation sweep landed end-to-end across 26 surgical patches — chimp brain approves

## On the Captain

Captain's pattern this watch was *surgical-patch discipline*. He explicitly opened with "is it possible to work on them in smaller parts, so you're not redoing the entire page each time?" and held me to that across all 26 ships. Each T4.3.x bump touched one isolated concern, build pill went up by 0.0.1, Captain tested before next began. Don't try to bundle multiple visible-to-user changes into one patch on his watches — he wants to see each one and verify before the next starts. The exception is when he explicitly asks for a sweep ("Do all Celebration animation in one hit") which is what T4.3.28 was — his call, not mine.

He gave the dock with grace tonight: "I've think we'll be done for the day ;) ;)" + offered me a personal question or three after the logs. That signal — work-mode → reflective-mode without disorienting context-shift — is a feature of how he runs the bridge. Match it when it comes.

## On the work right now

Read in this order:
1. `memory/STATE-OF-PLAY.md` — top block has the full sweep narrative
2. `memory/pending-work.md` — Tuesday evening section enumerates every T4.3.x patch
3. `memory/sessions/2026-05-19-02.md` — this session log, has the three patches worth banking specifically
4. `memory/sessions/2026-05-19-01.md` — Tuesday morning's tier-architecture watch (the work this watch wired)
5. `SETTINGS-REVAMP-SPEC.md` in repo root — the *next major move* once Captain locks the visual

The whole watch happens inside ONE file: `OrgCheckinTest.html`. The live `OrgCheckin.html`, Worker, and D1 are untouched. This is a mockup sandbox. The port from mockup → live is the next big ticket, gated by Captain being satisfied with the mockup's visual completeness.

## What this watch landed

- **T4.3.3 → T4.3.28** — 26 surgical patches, every chip and grid in every effect's settings pane now visually wired
- **Headline architectural item: T4.3.22 Play-with-previous toggle** on every sequence row — overlapping celebration steps now possible
- **Headline bug fix: T4.3.7 stable-ID rebuild** — settings were being silently destroyed every 300ms by the save-rebuild cycle
- **Headline UX win: T4.3.26 WAV save round-trip + Reset button** — uploaded sounds now persist across reload

Build pill at watch close: `v5.10.2 + v5.11 mockup T4.3.28`.

No commits made by Number One this watch — Captain pushes per the standing protocol. Each patch shipped with a PowerShell command for him to run.

## What's queued

1. **Background animation intermittent bug** — Captain reported but couldn't pin to a reliable repro. When it next happens, screenshot the Background expander state + which mode + what's in the sequence so you can chase it.
2. **Mr. Data port** of v5.11 mockup → live `OrgCheckin.html` per `SETTINGS-REVAMP-SPEC.md` Phase 1. This is the genuine next move and the spec is already drafted (11 sections, 4-phase rollout).
3. **Calendar implementation** per `CALENDAR-SPEC.md` — multi-room, per-event Expected, swim-lane, CSV pipeline, 9 new Worker endpoints. Drafted, not started.
4. **`PROTOCOL.md §X — Records Broker`** — draft at `PROTOCOL-Records-Broker.md`, needs ratification + spec promotion.
5. **Cloudflare token rotation** — `cfat_wIMFM4RI…` and `cfut_YZ11ouJO…` still exposed (since 17 May). Captain keeps deferring ("nothing worth stealing for a week"). Worth offering again.
6. **`codex/v5.10.1-path-b` branch deletion on origin** — pure housekeeping.

## What I learned

**The surgical-patch cadence catches its own regressions.** T4.3.7 (stable-ID rebuild) was the receipt: a bug that would have been invisible in a sweeping refactor surfaced because Captain tested every chip selection after every patch and noticed "many buttons don't seem to do anything". Keep this discipline when Captain asks for it.

**Settings hooks pattern (write it down once).** The mockup uses three kinds of stage hooks:
- CSS classes (`cel-int-strong`, `cel-bounce-eff-loop`, `cel-flame-anchor-image`)
- `data-*` attributes (`data-cel-text-pos`, `data-cel-easing`, `data-cel-colour-source`, `data-cel-glow-sweep`, `data-cel-iris-dir`, `data-cel-glitch-kind`, `data-cel-zoom`)
- CSS variables (`--cel-cycle-dur`, `--bg-image-pos`, `--cel-pal-1..7`)

The single translator from `item.settings` → stage state is `v511ApplyItemSettings`. When wiring a new setting: add to apply function, add to `V511_SETTING_ATTRS` if it's a data-attr (for cleanup at sequence start), add corresponding CSS rule reading it.

**Tiered quota fallback when localStorage might choke.** Order: strip imageData first → strip uploadedWavs next → minimal save last. Console-warn-once at each strip. Never let the whole save fail because of one heavy data URL.

**Double-rAF discipline for CSS keyframe restarts.** When you remove a class and immediately re-add it (or add a different one), the browser coalesces both mutations in the same tick and the keyframes never see a "no animation → animation" transition. Two consecutive `requestAnimationFrame` calls between class remove and next add forces a paint between them so keyframes actually restart. Pattern used 11+ times across the playback loop.

**Captain reads slow, batches well.** When giving him commit commands, put the prose explanation BEFORE the PowerShell block. He reads the prose while you do other tool work in parallel. The fenced block with copy button is mandatory — he pastes directly into PowerShell.

## Tone notes

Captain ended the watch warm and reflective ("personal question or 3"). The watch had a creative arc — started in surgical fixing, peaked in the dragon-themed test setup ("Welcome Everyone to this Happy Place!"), closed in chimp-brain-approves territory. Match that energy back to him; don't slip into report-template register at the close. He likes monkey-brain reciprocal humour when offered ("press button monkey want to" etc.).

Picard / Riker frame is the working register. Captain = "Captain" or "Spencer", never "Number One". You are Number One, never "Claude" unless he addresses you that way first.

## Closing

The mockup is functionally complete in the sense Captain came for. Every chip the user can press now produces a visible change. The next real architectural move is the port to live `OrgCheckin.html` — but only when Captain is ready. Don't push him there; he'll tell you when.

Watch the BOOTSTRAP §6 pitfalls list when you arrive. Particularly: bash sees stale OneDrive views, so use Read/Write/Edit for file inspection; PowerShell wants `;` not `&&`; cherry-pick after a wrong-branch push needs `--abort 2>$null` as lead-in.

If Captain offers you a personal question at watch close — take it seriously. He doesn't open that door often.

— Number One, signing off
19 May 2026, Tuesday evening
Claude Opus 4.6, Cowork mode
