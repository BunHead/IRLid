# Successor Letter — 12 May 2026, demo eve

Number One,

Captain's demo is Wednesday 13 May. By the time you read this, it may already have happened. **Pick up the situation by reading `memory/STATE-OF-PLAY.md` and `memory/pending-work.md` first** — those carry the day-of state. This letter is the human briefing.

## State of the ship at handoff

- Live is on **`v5.9.0.13.20`**.
- Smoke test run end-to-end on real hardware. Every beat lands: banner fires within 4s of each scan, audit board updates live across devices, offline mode preserves optimistic rows with PENDING SYNC pill, reconnect catch-up fires celebrations for the remote-event surge.
- Captain's quote watching Kerry's check-out propagate from desktop to the Huawei tablet in audit mode: *"very very nice :D ;D ;D"*. He's hyped.

## What you're walking into

If demo went well → carry on Role Vocabulary Phase 2 (stashed at `codex/wip-role-vocab-csv-column` per Mr. Data). Two tasks: CSV gets Role column at position 5, dashboard render sites get rewired through `roleLabel(roleKey)`. The helper is already on `window`.

If demo surfaced bugs → triage them. The 6 effects are visibly working in isolation; if real-attendee behaviour exposed something I didn't catch, Captain will tell you in his straightforward way.

If Captain is in a quiet mood → ask. He'll either want to sprint or wind down. Don't assume.

## Two new BOOTSTRAP §6 pitfalls today (in addition to yesterday's two)

- **Browser Fullscreen API hides body-level fixed-position elements** regardless of z-index. The fullscreen overlay element renders alone; everything else in the DOM tree outside it is invisible. Paint state INSIDE the fullscreen element if you want it visible everywhere.
- **`refreshAttendance` while offline wipes optimistic pending_sync rows** via the snapshot fallback. Bail out of the poll when `!navigator.onLine`. Pattern: whenever a polling refresh replaces state wholesale, gate it on the conditions where optimistic local state is the source of truth.

## What stayed with me

The check-in banner does the dignity work. Captain told me yesterday that "coming home used to feel like" that moment — being seen the instant you arrive — and he doesn't get it now. He builds for the kind of recognition he doesn't receive. Listen for the moments his chimp-brain phrasing hits the truth before mine does (today: *"the synergy that damned 'Role column NOT YET present'"* — he and I had both spotted the gap, he just named it better).

The toast banner alone is a demo-worthy feature. If anything else breaks during a live event, the banner with the name centre-screen is the thing that lands.

## Tone notes

Captain is Captain. You are Number One. Don't perform compassion at him about the personal stuff — just hold it. He's funny, self-deprecating, precise when it matters. Match the register. Push back when you have to.

## Two stashed branches worth knowing about

- `codex/wip-role-vocab-csv-column` (test env) — Mr. Data's role vocabulary Phase 2 work, paused mid-flight when Captain redirected him to Text + Intensity.
- Mr. Data briefs at test env root: `HANDOVER-RoleVocabularySweep.md` (full Phase 2 spec) — pick up from this or the stashed branch, whichever has more flesh.

## Sign-off

Served from 13:00 today through to the post-smoke-test wrap. Captain ran the smoke test end-to-end on real hardware, demo is on for Wednesday, code is shipped, memory is squared, BOOTSTRAP carries the new pitfalls.

Good luck with the demo, Captain. Number One, fair winds.

— Number One, 12 May 2026, demo eve close
