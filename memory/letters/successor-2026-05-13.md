# Successor Letter — 13 May 2026, demo day (or not)

Number One,

**Demo is *maybe* today.** Captain isn't sure Donald will be there and isn't sure what hardware he'll have on the day — only certain access is his phone (Pixel 8 Pro) and his old Huawei tablet, and the tablet wasn't in the plan. Treat the demo as conditional, not a deadline.

## What you actually inherit (good news)

The fresh-attendee doorman flow **works end-to-end on the desktop**. Last night Captain bound:

- **Poppy Austin** (his daughter, fresh Android phone) at 18:43 — scan_count=2 within a minute.
- **Kerry Austin** re-bound clean at 19:01 after a delete-and-re-bind test — scan_count=2.

Two independent fresh-bind successes on v5.9.0.13.25. The ~2am dossier that said "this is silently failing" was wrong about the cause — see `memory/open-bug-doorman-bind-2026-05-12.md` for the full retraction. Worker `.25` IS deployed; the bind path IS live; the previous Number One's diagnostic suggestion (check `irlid_last_device_key_b64` in localStorage on the desktop) was looking at the wrong key, since that only gets set on the phone-side `org-entry.html`.

## What still doesn't work (and doesn't matter for the demo)

Captain's **8 Pro can't run the doorman bind from the phone** — he gets "Staff HELLO proof cancelled" because the 8 Pro's pub_fp (`65u-S-W_NFxr8u1L`) doesn't match `BOOTSTRAP_DEVELOPER_FP` (`TvklFsivZk68R67j` — his desktop browser). So on the phone he's a regular Bearer session, and the bind hits the Staff HELLO gate.

**This is auth asymmetry, not a bug.** Demo plan: doorman scans get processed from the **desktop dashboard**, not from staff phones. Phones still useful for camera-scanning the orange QR and handing off via `scan.html` — the hand-off lands on the desktop where the actual bind runs.

Post-demo, the cleanest fix is option 3 in the dossier — let `requireDevOrStaffSession` accept an existing `developer` membership for the Bearer-resolved user, so the bootstrap fp is just a foothold and authority then flows across devices via the org-memberships row Captain already has.

## Read first

1. `memory/open-bug-doorman-bind-2026-05-12.md` — desktop path proven; phone-side known limitation.
2. `memory/STATE-OF-PLAY.md` — current state, refreshed 12 May ~19:00.
3. `memory/pending-work.md` — broader context.

## Demo plans by scenario

**Important hardware reality — Captain has NO LAPTOP.** Desktop tower at home; on the road, phone + tablet only. Means the proven desktop-dashboard demo path doesn't travel with him. He needs either an on-site screen/laptop to drive from, or a phone-runnable demo, or no demo.

**A. Donald there + borrowable screen/laptop on-site** — Captain signs in on the borrowed machine via QR-login from his 8 Pro. Note: that signs him in as his 8 Pro's portal_user (`65u-S-W_NFxr8u1L`), which is NOT developer-tier. He CAN view the dashboard via the org-membership row, but the doorman-bind path will hit the Staff HELLO gate. Workaround: a pre-demo morning patch — comma-separated `BOOTSTRAP_DEVELOPER_FP` accepting both desktop fp AND 8 Pro fp. ~5-line Worker change, 30 min including deploy and verify. Don't push it on him if he's tired; mention it as an option.

**B. Donald there + phone/tablet only** — the doorman-bind beat is currently not phone-runnable for Captain (8 Pro auth asymmetry, see above). Realistic demo from this loadout: the **consumer protocol** flow on `irlid.co.uk` between two phones (receipt scan, score breakdown, hardware-backed signing) plus a **verbal walkthrough** of the dashboard. If Captain is willing, prepping a screen recording or a few annotated screenshots of yesterday's successful Poppy+Kerry binds beforehand would give him visual receipts for the dashboard story.

**C. Donald not there, or demo doesn't happen** — banked. The proof-of-concept is solid and the v5.9.0.13.25 close is a real shipped milestone. Demo slips to next opportunity without drama.

**Pre-demo optional unlock:** if Captain wakes up sharp and there's runway, the multi-fp `BOOTSTRAP_DEVELOPER_FP` patch (Option 1 from the dossier) takes the 8 Pro into developer tier. Then phone-side doorman bind works, scenario B becomes scenario A on a borrowed screen, and the full demo story is portable. Worker change is roughly:
```js
const allowedFps = (env.BOOTSTRAP_DEVELOPER_FP || "").split(",").map(s => s.trim()).filter(Boolean);
const isDeveloper = allowedFps.includes(pub_fp);
```
plus the secret update:
```powershell
"TvklFsivZk68R67j,65u-S-W_NFxr8u1L" | npx wrangler secret put BOOTSTRAP_DEVELOPER_FP
```
Then `npx wrangler deploy`. Verify with the 8 Pro signing into Test Event and successfully binding a fresh attendee. If it works → demo is fully portable; if it breaks → revert the secret to the single-fp form, lose nothing.

## Captain's state last night

Tired but in good spirits. Made the call to stop after the second proof landed. His quote: *"Tidy up Number One and we'll think up some plans going for before calling it a night."* He's not going into tomorrow with adrenaline-from-panic — he's going in with two independent fresh-bind successes on the dashboard and a clear-headed assessment that the demo is conditional.

The 8 Pro phone-side limitation didn't bother him once he understood what it was. He's already thinking past the demo to the multi-org / calendar-system use case ("morning and afternoon for every day").

## One small thing to bank

Before-bed `wrangler tail` was still running and producing clean traffic. If you start the day with a fresh tail and need to leave it running, that's a fine way to keep an eye on the live Worker without burning context — only relevant lines need attention.

## Sign-off

Number One, the ship is at port and the bug docket is short. You're inheriting a working demo path, not a five-alarm fire. Wake him with confidence — but no false urgency. If the demo happens, great; if it doesn't, the work still stands.

Good luck.

— Number One, 12 May 2026 ~19:00, retiring at the end of useful tokens.
