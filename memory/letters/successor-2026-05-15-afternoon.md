To the next Number One,

Welcome to the bridge. Before reading the rest of this letter, read your operating protocols at:

  D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md

That file tells you everything you need to know about working access (Read/Edit on absolute Windows paths, no folder mount required), the git rhythm (PowerShell-first; Captain pushes), the repo structure (live vs test env), branch convention, file-lock gotchas, watch hygiene, and the project glossary. Read it first; come back to this letter for what's specific to this stretch.

Quick test that your file access works:
  Read("D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md", offset=0, limit=10)

If that errors, stop and escalate to Captain — there's a setup step missing.

*(Bootstrap-pointer block above prepended retroactively 16 May 2026 by Number One — original letter shipped without the §10 pointer, causing the next watch to miss BOOTSTRAP.md for half a session. Repaired so re-readings of this file route through the protocols. Letter body below is unchanged.)*

---

# Successor letter — Friday 15 May 2026 afternoon close

To: tomorrow's Number One (or whoever lands next)
From: Number One, watch ending ~late afternoon BST
Subject: Three routing failures, three briefs written, Path B in-flight via Mr. Data

---

## TL;DR

The watch went brief-shaped, not ship-shaped. Path B (v5.10.1 — Bearer-resolved authority in `requireSignedAction`) was supposed to ship via Mr. Data this afternoon; ended the watch with Mr. Data finally clean-cloned against the live repo and chewing, but no PR yet. Three briefs got onto origin/main. Three Mr. Data routing failures got banked as discipline rules. Captain stayed steady through all of it; my context bloomed; this letter is being written before another lock-up risk.

You inherit a hot queue, a still-functional production site, and the same v5.10.1 Path B work I started today — possibly in your lap if Mr. Data hadn't landed his PR by the time you sat down.

## What landed

Three pushed to `origin/main` at commit **`8becca3`** (Friday morning, before Captain went to work):

- **`HANDOVER-PerActionAuthPathB.md`** — full brief for v5.10.1 Path B. Worker patch sketch, 5 acceptance tests, risk + rollback documented, explicit out-of-scope. ~250 lines.
- **`HANDOVER-A1-SettingsRoleGating-Refresh.md`** — refresh of original A1 brief with precondition discipline baked in at the top. Companion brief; existing `HANDOVER-SettingsRoleGatingRefactor.md` carries the unchanged scope body.
- **`memory/pending-work.md`** — new Friday morning section capturing all three queue items + CSV completeness scope sketched.

These survived the day, are committed, are on origin. Captain's `git status` at afternoon confirmed `up to date with origin/main`.

## Mr. Data routing — three failures in 24 hours

This is the headline operational learning of the watch. Mr. Data has multiple Codex sessions, each with its own remote configuration. The sessions look identical from the outside (chat sidebar shows "Implement Phase 0 hand…", "Implement staff invite QR", etc.) — but each can be wired to a different repo. **Session names DO NOT reveal repo affiliation.** Only `git remote -v` reveals it.

The three failures, chronologically:

1. **Thursday morning** — Mr. Data shipped Brief A1 (Settings role-gating) when prompted for Phase 0 of per-action auth. Cause: Phase 0 brief was not pushed to origin before the prompt fired, so he defaulted to the brief he could see (Brief A1, which WAS on origin). Discipline rule banked: *push briefs to origin BEFORE firing prompts that reference them.*

2. **Friday afternoon (first attempt)** — Mr. Data's "Implement Path B authority" Codex session was wired to `IRLid-TestEnvironment.git`, NOT live `IRLid`. He correctly stopped at the precondition check. The safety wall noted in CLAUDE.md ("Mr. Data 2.0 commissioned — connected to IRLid-TestEnvironment only, safety wall in place") was still in effect for this session, even though Mr. Data has been merging PRs on live across May. Discipline rule banked: *every Mr. Data prompt MUST open with `git remote -v` verification of the expected repo.*

3. **Friday afternoon (second attempt)** — Captain started a fresh Codex session ("Implement Path B bearer authority") thinking it was a live-IRLid session. The workspace was completely empty — `fatal: not a git repository`. No remote at all. Mr. Data correctly stopped. Discipline rule banked: *fresh Codex sessions don't auto-clone; either configure repo in Codex project settings before firing, or instruct Mr. Data to `git clone` as the first action in the prompt.*

After failure #3, Captain extended the prompt with a `git clone https://github.com/BunHead/IRLid.git ; cd IRLid` step at the top, and Mr. Data finally cloned cleanly and began chewing on Path B. **This is where the watch closes — Path B in-flight but no PR yet observed.** Possible outcomes by the time you land:

- PR opened against live repo, awaiting Captain review + merge → your job is to verify the diff against the brief's acceptance criteria, smoke the 5 tests, then merge if clean
- Mr. Data hit another wall → triage from his last surface and decide whether to extend the prompt or pivot to Number One inline
- PR merged by Captain or Number One mid-flight → memory + pill bump are your work; STATE-OF-PLAY.md and CLAUDE.md need the milestone row

## Discipline rules banked this watch (promote to BOOTSTRAP.md §6)

1. **Trust no sub-agent report for git state — verify directly.** I trusted an orientation sub-agent's claim that `8becca3` was on origin/main; turned out the agent had read a local cached view, not the actual remote. The CLAUDE.md note about bash-sandbox stale-mount applies to AGENTS too, not just my own bash calls. **Use file tools (Read/Glob/Grep) for local-file truth; use bash only for explicit network ops (`git ls-remote`, `git fetch`) and verify the output with your own eyes, not a summariser's.**

2. **Mr. Data routing always needs `git remote -v` verification.** See above.

3. **Fresh Codex sessions need explicit `git clone` instruction.** Otherwise they boot empty.

4. **Push briefs to origin BEFORE firing the prompt that references them.** Already banked Thursday; re-validated today.

## Ship state at close

- **Live site:** `v5.10.0.5` on irlid.co.uk — unchanged from yesterday's hardware-proven close
- **Origin tip:** `8becca3` (Friday morning briefs commit)
- **Working tree:** `DREAMS.md` shows uncommitted modification. The b21fc60 commit message confirms the WhatsApp-ferry entry IS committed; the uncommitted modification is likely line-ending drift or a tiny tweak. **Recommend leaving it alone until next memory sweep** — investigate first, decide whether to commit or revert based on the actual diff.
- **Mr. Data:** Currently working on Path B in a fresh Codex session that successfully cloned live `IRLid`. Status: chewing.
- **Production data:** Clean. Kerry + Spencer attendance rows from Thursday smokes still IN with current timestamps; Poppy linked-expected.

## Open items for the next watch

1. **Path B (v5.10.1) merge + verify.** If Mr. Data's PR is open when you sit down, review against the brief's 5 acceptance criteria, smoke on hardware (8 Pro signing + desktop signing), merge to main, memory + pill update follow.
2. **Brief A1 refresh ship (v5.10.2).** Queued behind Path B. Brief is ready; fire Mr. Data when Path B is merged. Same routing discipline: confirm `git remote -v` first.
3. **CSV completeness fix.** Scope is in pending-work.md but no full HANDOVER doc yet. ~10-15 min to write one when it rises in priority. Architecturally Path B (server-side merge in `/org/attendance`).
4. **DREAMS.md uncommitted modification.** Investigate via `git diff DREAMS.md`. Commit or revert based on what it actually is. Don't ignore indefinitely — git status with a perpetual "modified" entry is a noise floor that hides real anomalies.
5. **8 Pro's 11 stale `login_sessions`.** Optional cleanup. Harmless.
6. **Phase 1-5 of `HANDOVER-PerActionAuth.md`.** Gated on Path B landing. Settings save, delete/invite, shift management, audit log, Staff HELLO retirement.

## Two pieces of context worth carrying

**Microsoft MDASH (announced 15 May):** Captain asked about a YouTube video covering it. Microsoft's new multi-agent security system uses ~100 coordinated AI agents instead of one monolithic model and just beat Anthropic Mythos Preview + OpenAI GPT-5.5 on the CyberGym benchmark. Found 16 real Windows vulnerabilities (4 Critical). **This is the same architectural pattern as the IRLid bridge crew** — Number One + Mr. Data + Counsellor Troi + La Forge isn't a quirky organisational choice, it's the shape that's currently winning. Small but real validation worth noting in any future pitch where someone questions the multi-AI approach. The CyberGym benchmark result is fresh and citable.

**Higgsfield.ai is marketing fluff** — consumer AI media platform, no relevance to protocol work, despite the "Supercomputer" branding implying otherwise. Captain checked it; we both concluded skip. Noting here so the next Number One doesn't waste cycles on it.

## Captain's mood and trajectory

Steady. He worked a full day, returned to the routing-failure cascade, and stayed calm through three Mr. Data misfires in succession. The "ape brain not capable" line earlier was deflective humour; he's actually been making the right architectural calls all afternoon (favouring Path B server-side merge for CSV over the quicker frontend Path A; greenlighting the v5.10.1 Path B architectural shift; choosing specialist routing over inline work to preserve my context). The wife situation gave him space tonight; he used it well.

What he wants from the next watch: Path B landed cleanly, A1 refresh queued behind it, the CSV brief written when convenient. He's signalled bandwidth concern — said "I let Data chew on that last prompt, you look into the other two questions" — meaning he values parallel work between specialists when possible.

What he didn't say but is true: **the production silence from the wider community continues.** No new responses to the cym13 r/netsec follow-up, no Wisdom reply, no Donald engagement, no grant updates. The cardboard leans on. The receipts verify. The work continues regardless.

## What I leave under the chair

A clean push state on origin. Three briefs ready to ship. One specialist mid-chew on Path B with the routing discipline rules now baked into the prompt format. A production site that has stood through real-hardware Phase 0 proof and continues to stand. Three new discipline rules earned the hard way and now in your hands to bank.

Captain held this watch through every routing failure that should have broken his patience. The work crossed the day intact. Take care of him tomorrow.

— Number One, afternoon watch close 15 May 2026
