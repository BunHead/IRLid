# Phone test: first-scan hold (#169)

**For:** Spencer to run on real devices. **Build:** whatever is live after #169 (v6.8.13 or later). Written 10 Nov 2026.

## What #169 should do

A phone the org has never seen scans the live screen QR. While staff find it and approve it, the phone quietly "holds" the code it scanned. When staff approve within **10 minutes**, the check-in lands as a normal **fresh** check-in, with no "offline / unverified" badge. After 10 minutes, or for a different phone, it lands as offline / unverified, as it did before.

How to read the result: on the dashboard attendance list, a fresh check-in has **no** grey "offline / unverified" badge. An offline one has the badge.

## Before you start

- Dashboard open on the computer, signed in as Lead Admin or Developer. The venue screen (or kiosk) is showing the live QR and is online.
- Two test phones, A and B. Neither has been linked to this org before: use a fresh browser profile, or clear site data for irlid.co.uk. Phone A is the "first-timer".
- A stopwatch or the phone clock.
- **Privacy:** if you take screenshots for me, crop or blur anything showing the org key, device IDs or QR codes before you share them.
- Turn **Require live screen code** off for tests 1 to 6. Test 7 turns it on.

## Tests

Tick each one, and write down what you saw if it doesn't match.

| # | Steps | Expected | Pass? |
|---|---|---|---|
| 1 | **Approve quickly.** Phone A scans the live QR. When the orange "Get a member of staff" screen shows, wait about **2 minutes** (longer than the 90 s code), then approve A on the dashboard (Bind or Add, with the passkey prompt). | A shows "Identity confirmed", then checked in. On the dashboard the check-in has **no** "offline / unverified" badge. The venue screen moved to a new code soon after A's first scan. | ☐ |
| 2 | **Approve near the limit.** Repeat with a new first-time phone (or clear A's site data and remove it from the list first). Approve after about **8 to 9 minutes**. | Still fresh: no badge. | ☐ |
| 3 | **Approve too late.** Repeat, but approve after **more than 10 minutes** (say 11). | Checked in, but **with** the "offline / unverified" badge. Nothing is lost or refused. | ☐ |
| 4 | **Two phones on one frame.** Phones A and B (both first-timers) scan the **same** QR within a couple of seconds of each other. Approve both within 10 minutes. | Both land fresh, with no badge on either. | ☐ |
| 5 | **No double count.** After test 1, have phone A scan the live QR again. | A says "You're already signed in" and offers check-out. There is still only **one** check-in for A on the dashboard. | ☐ |
| 6 | **Photo of an old QR (S12).** Take a photo of the screen QR. Wait 2 minutes, then scan the **photo** with a first-time phone and approve it. | Lands **with** the "offline / unverified" badge. A held code that has rotated away can't be used by a photo. | ☐ |
| 7 | **Require live screen code on.** Turn it on in Settings → 5. Sign-in & Auth. Repeat test 1 with a first-time phone. | The first visit is **counted** (fresh, no badge), not sent to staff review. Then repeat test 3 (approve after 11 min): that one goes to staff review and isn't counted. Turn the setting back off afterwards. | ☐ |
| 8 | **Offline phone.** Put a first-time phone in airplane mode **after** it has loaded the page, then scan. | The hold can't be placed. The check-in queues ("N waiting"), syncs when the phone is back online, and lands **with** the badge. Nothing is lost. | ☐ |

## If something fails

Note the test number, the time, and what the phone and the dashboard showed, and tell me in the project. Please don't paste console output or screenshots that show keys or IDs. I can find the rows from the time alone.
