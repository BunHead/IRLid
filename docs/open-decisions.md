# Open decisions and unrecorded outcomes

Things that are waiting on Spencer, or were decided somewhere but never written into the project. Kept short; move each item to where it belongs (`docs/rules.md`, a design doc or a review note) once it's settled. Started 10 Nov 2026 (review 5.4).

| # | What | Where it came from | What's needed |
|---|---|---|---|
| 1 | **Break-glass outcome.** The Briefing Room debate is finished (Spencer, 7 Nov), but the outcome isn't written down. The follow-ups (Emergency Protocol Override drill, Lead Admin backup devices, a "rotate key" button) depend on it. | `reviews/break-glass-options.md` in the project files; 8 Nov handover | Spencer to record the outcome. |
| 2 | **`/org/register`**: remove it, limit it to Developer, put it behind a switch, or leave it. | Break-glass question 9; `docs/decision-org-register.md` | Spencer to pick an option. |
| 3 | **Rules open question 9** (a first-time phone vs the 90 s code). Option C was chosen on 9 Nov and built in #169, but `docs/rules.md` still lists it as open. | `docs/rules.md`, `docs/design-first-time-approval.md` | Spencer to update the rule (only Spencer changes rules). |
| 4 | **Phone test of the first-scan hold (#169).** Live since 9 Nov, not yet tried on real phones. | `docs/test-plan-first-scan-hold.md` | Spencer to run the checklist. |
| 5 | **Push updates real-phone check (#152, rule W4).** It may have been covered by the 7 Nov kiosk testing, but nobody wrote it down. | 4 and 8 Nov handovers | Spencer to confirm. |
| 6 | **Offline unlock proof upload.** Offline kiosk unlock audit rows are kiosk-reported, and the phone's signature isn't sent anywhere yet, so they can't be verified. | `docs/kiosk-lock.md` | Decide whether to build it. |
| 7 | **Org receipts and the exact GPS distance (R8).** Fixed going forward by the review 1.2 PR. Older rows still hold a distance; R4 says never backfill. | Rule check R8, 2 Nov | Confirm leaving old rows as they are is fine. |
