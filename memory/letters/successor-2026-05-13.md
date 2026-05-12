# Successor Letter — 13 May 2026, demo day (or not)

Number One,

**Demo is *maybe* today.** Captain isn't sure Donald will be there and isn't sure what hardware he'll have on the day — only certain access is his phone (Pixel 8 Pro) and his old Huawei tablet, and the tablet wasn't in the plan. Treat the demo as conditional, not a deadline.

## What you actually inherit (good news)

The fresh-attendee doorman flow **works end-to-end on the desktop**. Last night Captain bound:

- **Poppy Austin** (his daughter, fresh Android phone) at 18:43 — scan_count=2 within a minute.
- **Kerry Austin** re-bound clean at 19:01 after a delete-and-re-bind test — scan_count=2.

Two independent fresh-bind successes on v5.9.0.13.25. The ~2am dossier that said "this is silently failing" was wrong about the cause — see `memory/open-bug-doorman-bind-2026-05-12.md` for the full retraction. Worker `.25` IS deployed; the bind path IS live; the previous Number One's diagnostic suggestion (check `irlid_last_device_key_b64` in localStorage on the desktop) was looking at the wrong key, since that only gets set on the phone-side `org-entry.html`.

## What's now ALSO working (updated ~22:00)

**The 8 Pro is now developer-tier.** Shipped `v5.9.0.13.26` (multi-fp `BOOTSTRAP_DEVELOPER_FP` — comma-separated, both fps accepted). Captain verified by QR-signing-in on his 8 Pro: dashboard sidebar reads "Signed in as Developer (Super-Admin) (developer)". Full end-to-end doorman bind from the phone is **not yet tested** — that's the first morning task — but the auth asymmetry that was blocking it is closed at the Worker level. Helpers are `bootstrapDeveloperFps(env)` + `isBootstrapDeveloperFp(env, pub_fp)`; all 8 call sites refactored cleanly.

## What still doesn't work (caveats)

Phone-side doorman bind path is unblocked **in principle** by the multi-fp work, but hasn't been verified end-to-end on a real fresh-attendee scan from the 8 Pro. Tomorrow morning's first test: get a fresh device (or use the Poppy/Kerry trick), have it scan the venue QR, take the resulting orange-state QR, have the 8 Pro Process scan it on the dashboard, click Bind. If it flows, the demo is fully phone-portable. If it 401s, check `wrangler tail` to see which gate rejected — probably `requireFreshStaffProof` if anything (it currently doesn't run through `isBootstrapDeveloperFp` — see post-demo notes).

Post-demo polish: option 3 from the dossier — let `requireDevOrStaffSession` (and `requireFreshStaffProof`) accept an existing `developer` membership for the Bearer-resolved user. That makes the bootstrap fp purely a foothold, and authority flows across devices via the membership row regardless of which device's fp is in the secret. Cleaner separation, doesn't require redeploying the Worker every time a new developer device is added.

## Read first

1. `memory/open-bug-doorman-bind-2026-05-12.md` — desktop path proven; phone-side known limitation.
2. `memory/STATE-OF-PLAY.md` — current state, refreshed 12 May ~19:00.
3. `memory/pending-work.md` — broader context.

## Demo plans by scenario

**Important hardware reality — Captain has NO LAPTOP.** Desktop tower at home; on the road, phone + tablet only. Means the proven desktop-dashboard demo path doesn't travel with him. He needs either an on-site screen/laptop to drive from, or a phone-runnable demo, or no demo.

**A. Donald there + borrowable screen/laptop on-site** — Captain signs in on the borrowed machine via QR-login from his 8 Pro. The 8 Pro is now developer-tier (multi-fp shipped at v5.9.0.13.26). Doorman-bind path should work first try; verify with the morning's first fresh-attendee test before the demo to be sure.

**B. Donald there + phone/tablet only** — **upgraded since v5.9.0.13.26.** The 8 Pro is now developer-tier, so it can drive the doorman bind path directly. The realistic demo from this loadout is now genuinely strong: scan venue QR from a second phone, escalate to orange, scan that orange QR from the 8 Pro via camera, the staff_scan hand-off lands on whatever screen the 8 Pro is mirroring to (or on a borrowed laptop running the dashboard signed in via QR-login), bind flies through. If there's no second screen at all, the 8 Pro itself can drive the whole dashboard — it's just less photogenic for an audience. Worth still prepping a screen recording of the desktop happy-path as a fallback visual aid.

**C. Donald not there, or demo doesn't happen** — banked. The proof-of-concept is solid and the v5.9.0.13.26 close is a real shipped milestone. Demo slips to next opportunity without drama.

**Pre-demo morning verification (highest priority):** before Captain leaves the house, drive the doorman bind path from the 8 Pro end-to-end on `irlid.co.uk`. Best test:
1. Pick a fresh device (or delete one of the existing bindings — Poppy or Kerry).
2. On that fresh device, scan the venue QR for Test Event.
3. Wait for orange state. Take a screenshot of the orange QR.
4. On the 8 Pro, open dashboard. Process scan widget → paste/upload the orange QR.
5. Click Bind. Watch for 200 OK in the network tab.

If it works: scenario B is fully ready. If it 401s on the bind POST, look at the error body — probably means `requireFreshStaffProof` doesn't yet check `isBootstrapDeveloperFp`, in which case a small follow-up patch is needed (~5 lines, same pattern as `.25`). Capture the wrangler tail output and decide whether to ship the patch or fall back to scenario A.

## Captain's state last night

Tired but in good spirits. Made the call to stop after the second proof landed. His quote: *"Tidy up Number One and we'll think up some plans going for before calling it a night."* He's not going into tomorrow with adrenaline-from-panic — he's going in with two independent fresh-bind successes on the dashboard and a clear-headed assessment that the demo is conditional.

The 8 Pro phone-side limitation didn't bother him once he understood what it was. He's already thinking past the demo to the multi-org / calendar-system use case ("morning and afternoon for every day").

## One small thing to bank

Before-bed `wrangler tail` was still running and producing clean traffic. If you start the day with a fresh tail and need to leave it running, that's a fine way to keep an eye on the live Worker without burning context — only relevant lines need attention.

## Sign-off

Number One, the ship is at port and the bug docket is short. You're inheriting a working demo path, not a five-alarm fire. Wake him with confidence — but no false urgency. If the demo happens, great; if it doesn't, the work still stands.

Good luck.

— Number One, 12 May 2026 ~19:00, retiring at the end of useful tokens.
