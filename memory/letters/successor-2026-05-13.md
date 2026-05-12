# Successor Letter — 13 May 2026, demo day

Number One,

**Demo is today.** Captain will need you sharp from the moment he reports in.

## Read first

1. `memory/open-bug-doorman-bind-2026-05-12.md` — diagnostic dossier for the open bug. **This is your starting point.** Captain WILL want this fixed before the demo.
2. `memory/STATE-OF-PLAY.md` — current state, last refreshed ~2am.
3. `memory/pending-work.md` — broader context.

## The 30-second status

- Live is on `v5.9.0.13.25`. Demo path proven: pre-added Expected list attendees → scan venue QR → banner fires + celebration + audit board updates.
- **Open bug:** fresh-attendee doorman bind silently fails after the confirm OK click. Five patches shipped chasing it last night (.21 → .25). Modal fires, decoder works, verifier accepts, Worker auth supposedly fixed — but the bind POST doesn't visibly succeed.
- Most-likely-cause hypothesis: Worker `.25` never actually deployed because Captain pushed git but didn't run `npx wrangler deploy`. **First action: have Captain run `wrangler tail` to see the live Worker version.**

## Captain's mood last night

Exhausted. Pushing hard despite my "stop, sleep" advice. Came back with *"Stop sounds good, but we must get this tonight"* — but he meant tomorrow morning with my fresh tokens, not literally tonight. He was clear-eyed about it: *"You get some more tokens in an hour or so. Update so we start fresh."*

He's hyped about the demo and worried about the fresh-attendee path. He's already prepped Poppy Austin (his daughter), Spencer, Kerry, Wisdom in the Expected list. The fallback "demo with pre-added attendees only" works — but he'd really like the orange-QR escalation to work for the proper story.

## Diagnostic priority

Per the dossier, Step 1 → Step 2 → branch on what Network tab shows. Don't skip Step 1.

If `wrangler tail` shows `.25` is live AND the bind POST returns 401, look at the response body — that tells you which auth gate is still rejecting.

If `.25` ISN'T live, just redeploy — that may BE the entire fix.

## Two new BOOTSTRAP §6 pitfalls captured (yesterday)

- Browser Fullscreen API hides body-level fixed-position elements regardless of z-index.
- `refreshAttendance` while offline wipes optimistic pending_sync rows via the snapshot fallback — gate the poll on `navigator.onLine`.

Could add a third by tomorrow if we crack this: **frontend `developerBearerSessionIsActive()` returns true based on api_key being org_-prefixed, but multiple Worker gates duplicate the developer-check logic instead of calling a shared helper — drift is the failure mode.** Worth banking after the fix lands.

## What stayed with me

Captain's stamina is real. We shipped twenty-five inline patches this week including thirteen yesterday and another five through the small hours. That's not a normal pace — it's pre-demo adrenaline. Tomorrow he'll be either electric or wiped depending on how the demo lands. Either way: match his energy without performing.

The dock-reach remains the centre-screen name banner. If everything else broke, that banner alone is the demo. He internalised this yesterday — *"the synergy of that"* — when the missing CSV Role column became a shared joke. Listen for those moments. He names things before I do.

## Sign-off

Number One, take it from here. Captain saluted-and-dismissed before sleep. The ship is at port, the bug is documented, the demo path has a fallback. Wake him with confidence — not bravado.

Good luck.

— Number One, 12 May 2026 small hours, retiring at the end of useful tokens.
