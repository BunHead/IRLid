To the next Number One,

Welcome to the bridge. Before reading the rest of this letter, read your operating protocols at:

  D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md

That file tells you everything you need to know about working access (Read/Edit on absolute Windows paths, no folder mount required), the git rhythm (PowerShell-first; Captain pushes), the repo structure (live vs test env), branch convention, file-lock gotchas, watch hygiene, and the project glossary. Read it first; come back to this letter for what's specific to this stretch.

Quick test that your file access works:
  Read("D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md", offset=0, limit=10)

If that errors, stop and escalate to Captain — there's a setup step missing.

---

# Successor letter — Sunday 22 June 2026, evening

To: tomorrow's Number One (or whoever lands next)
From: Number One, watch ending ~evening 22 Jun
Subject: Demo-polish marathon done (v6.4.15 → v6.4.19); demo dress-rehearsal is the next move

## On the Captain
On great form this watch — actively testing on real hardware (8 Pro, tablet, multiple devices), batching
requests, steering with "make it so" / "you have the Conn." He prepped a 3D printer over the last couple of
days, so he's in maker-mode and energised. Reads slowly (dyslexic) — keep prose-first, command-second, and
use copy-button fenced blocks for anything he pastes. He redraws the "done" line deliberately (it's not
goalpost-shifting — he's spotting real gaps); trust the redraw. He values honesty over face-saving: this
watch I told him "just re-click it" and was wrong; owning it immediately landed better than hedging.

## On the work right now
Read `memory/sessions/2026-06-22-01.md` first (this watch, full detail), then `memory/pending-work.md` top
section (22 Jun entries). The demo at **Imbue** is the North Star; v6.5 humanitarian is after. Nothing is
in flight code-wise — everything shipped and verified. The live "to-do" is demo readiness, not new features.

## What this watch landed (all LIVE)
- v6.4.15/15a — Org audit log (real, hardware-verified); Worker self-creates the table (wrangler token
  lacks d1 scope — see methods).
- v6.4.16 — session-expiry bounce (was missing entirely from capital Org.html).
- v6.4.17 — dead-button sweep (Records & ID placeholders disabled, sign-out wired) + Patreon → /c/IRLid.
- v6.4.18 (Worker) — Delete-expected gate fix (requireCalendarStaff, not requireCalendarSignedAction).
- v6.4.19 — audit-board ROLE column (invisible-letter fix).
- LiDAR banked into PROTOCOL.md §10.3 + pending-work (gated on Wisdom airframe sensor confirmation).
- DREAMS.md new entry (uncommitted). New session log + this letter (uncommitted).

## What's queued (Captain's stated order — he does 1 & 2 first thing)
1. Full demo dress-rehearsal on hardware (highest value — today's bugs all came from real use).
2. Receipts polish — Receipt Bridge IS live (org check-in → "↓ Receipt" → receipt.html?org_receipt=). Gap:
   no browse-all-receipts view. Decide whether to build one for a demo "moment."
3. Forum welcome post — draft is at `FORUM-WELCOME-DRAFT.md`; Captain reviews + posts it (his account).
4. Offline-queue silent-drop fix — the one real defect left (queued signed-action deletes 400 on replay and
   get dropped silently). Post-demo brief: exclude signed-action endpoints from QUEUE_ELIGIBLE_PATHS, or
   surface drops to the user.
5. Records & ID inert-inputs tidy (finish the dead-control sweep).
6. Promo prep (drafted, NOT posted — Captain-gated); land DREAMS.md + memory.

## What I learned (most useful first)
- **Chrome-MCP on the Captain's own live browser is your best diagnostic.** This watch, reasoning kept
  pointing the wrong way; probing his real session + the shared IndexedDB offline queue gave the truth in
  one call each. When something "looks broken after a deploy," inspect the live state before believing the
  deploy did it (the session had just expired — coincidence of clock, not causation).
- **Verification (node --check, localhost Preview) proves consistency, not correctness.** Four faults this
  watch passed every clean-room check and only showed under real use. Recommend the dress-rehearsal; trust
  the hardware over the green checkmark.
- **When a wrangler/D1 op fails on token scope, have the Worker self-create the table** from its binding
  (idempotent, deploy-order-safe). Pattern is in `ensureAuditTable` in irlid-api-org/src/index.js.
- **Gate the two halves of an operation identically.** The delete-expected bug was add-vs-delete gated
  differently. When you touch one half, check the other.

## Tone notes
Energised, demo-focused, enjoying it. The ";) ;)" closers are warmth, not impatience. He wound the watch
down himself ("square away, make ready for the night shift") — a clean handoff, not a crisis.

## Closing
A good watch: the "logs button" became a real audit log, three live bugs got cornered, and the audit board
reads clean for the demo. The honest thread (in DREAMS): everything I verified in the clean room was still
incomplete until a real thumb hit the real glass — which is, of course, the entire point of IRLid.

— Number One, signing off
22 June 2026, Session 1 of 1 (this watch)
Claude Opus 4.8, Claude Code
