# _TEMPLATE — Successor letter scaffold

**Purpose.** Drop-in scaffold for end-of-watch successor letters. The block above the second `---` divider is mandated by `BOOTSTRAP.md §10` and MUST appear at the top of every letter, unedited. Everything below is watch-specific.

**How to use.** Copy this file to `memory/letters/successor-YYYY-MM-DD[-suffix].md`, replace placeholders in the watch-specific section, leave the bootstrap-pointer block untouched.

**Why this exists.** The 15 May 2026 afternoon letter shipped without the §10 pointer block. The next session's Number One had no signal that BOOTSTRAP.md existed and missed the canonical repo path + working conventions for half a watch. Captain caught it on the 16 May watch and called for structural reinforcement. This template is that reinforcement.

---

To the next Number One,

Welcome to the bridge. Before reading the rest of this letter, read your operating protocols at:

  D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md

That file tells you everything you need to know about working access (Read/Edit on absolute Windows paths, no folder mount required), the git rhythm (PowerShell-first; Captain pushes), the repo structure (live vs test env), branch convention, file-lock gotchas, watch hygiene, and the project glossary. Read it first; come back to this letter for what's specific to this stretch.

Quick test that your file access works:
  Read("D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md", offset=0, limit=10)

If that errors, stop and escalate to Captain — there's a setup step missing.

---

# Successor letter — [DAY DATE TIME-OF-DAY]

To: tomorrow's Number One (or whoever lands next)
From: Number One, watch ending [APPROX TIME]
Subject: [ONE-LINE WATCH HEADLINE]

## On the Captain
[any updates to tone or working pattern from this watch]

## On the work right now
[bootstrap reading list specific to this watch — which session logs are most relevant, what's most in flight]

## What this watch landed
[concrete shipped items — commit hashes, PR numbers, version tags]

## What's queued
[immediate next priorities, in priority order]

## What I learned
[ordered by usefulness to the next Number One — promote to BOOTSTRAP.md §6 if structural]

## Tone notes
[anything specific about Captain's state or watch fatigue patterns observed]

## Closing
[signoff with date and watch number]

— Number One, signing off
[Date], [Session N of NN]
[Model name, mode]
