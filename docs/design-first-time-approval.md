# Design options: a first-time phone vs the 90 s code (PR C)

**Status:** options for Spencer's decision. Nothing here is built. Open question 9 in `docs/rules.md`. Written 8 Nov 2026 against main `c0e1d75` (v6.8.11).

## The problem, as the code works today

1. A phone that the org has never seen scans the live screen QR (`org-entry.html?...&n=<code>`). The code lasts 90 s and works once (`org_checkin_nonces`).
2. The org doesn't know the phone's key, so `org-entry.html` shows the orange "Get a member of staff" screen. Staff scan its QR on the dashboard and Bind or Add at the door, with a passkey prompt (S5, a phone never approves itself).
3. `pollOrangeResolution()` sees the device linked, holds "Identity confirmed" for 7 s, then `continueVenueWalkin()` sends the check-in with the code from step 1.
4. By then the code is normally older than 90 s (finding staff, opening the dashboard and the passkey prompt take longer), so `orgCheckin` finds it unusable and records the check-in as **offline / unverified** (C2, C14), even though the screen and phone were online and staff saw the person.
5. If the org has **Require live screen code** on, step 4 instead **quarantines** the first check-in for staff review and does not count it (S12 exception to C2). So with that setting on, every first-time phone's first visit goes uncounted until staff review it.

Nothing is lost (C13) and nothing is refused, but the first visit is under-labelled, and with Require live code it is not counted.

## What must not change

- S13 / C9: the server decides "fresh", never the phone. A phone's clock or flag never makes anything fresh.
- S12: a photo of an old QR must not become fresh.
- S6: codes stay single use.
- C1, C2, C13: no refusal and no loss, online or offline.
- A phone still can't approve itself (S5).

## Options

### A. Keep it as it is (offline / unverified)

- How: no change. Document it.
- Good: nothing new to get wrong; honest (the server never saw a live code in time).
- Bad: every first visit is unverified; with Require live screen code on, every first visit goes to staff review and is not counted until reviewed.
- Freshness meaning: unchanged.

### B. Make the code last longer for unknown phones (for example 5 minutes)

- How: the Worker accepts an unknown device's code up to N minutes old.
- Good: tiny change.
- Bad: **weakens freshness** for exactly the phones we know least about. A photo of the screen works for N minutes from anywhere (S12). It also needs the Worker to treat "unknown device" specially before it knows who it is.
- Not recommended.

### C. Hold the code when the phone first scans it (recommended)

- How: at step 2, while the code is still live, the phone sends a **signed hold**: its device-key signed hello with the code (the same signature the check-in already uses, S1). The Worker checks the signature and that the code is live and unused, then marks the code **used** and records a hold: {code, device key fingerprint, org, event, server time}. The screen rotates as it does for a check-in. When staff approve and the phone sends the check-in, the Worker finds the hold for that device key and records the check-in as fresh, with the hold's server time as the scan time.
- Limits: a hold works once, only for that device key (the check-in must be signed by the same key), and only for a set time (suggest 10 minutes, the same order as the orange QR's refresh). After that the check-in lands as offline, as now.
- Good: "fresh" keeps its exact meaning: the server saw this phone's signed hello with a live code inside the 90 s. The approval delay no longer matters. Works with Require live screen code (the first visit is counted).
- Bad: a new table and a new endpoint; the phone must be online at the moment of the first scan (if it isn't, it is offline anyway and lands as offline, unchanged). A held code is used up, so a second person can't use the same code (they get the next one, as with any scan).
- Tests needed: hold then approve after 5 min is fresh; hold then approve after the hold window is offline; a hold used by a different device key is not fresh; a hold is single use; a photographed code that was already held is used; hold refused for a bad signature; Require live code counts a held first visit; queued replay of a held check-in is not double counted (C13).

### D. Staff approval hands the phone a new code

- How: when staff Bind / Add at the door (signed v5 staff action), the Worker issues a fresh one-time code bound to that device key, and the phone's lookup poll returns it. The phone checks in with it inside 90 s.
- Good: reuses the existing code table; the time proof is the staff's in-person signed approval.
- Bad: "fresh" then means "staff confirmed this phone just now", not "this phone scanned the live screen". That is a different claim (I1), so it should have its own label (for example "fresh, staff confirmed"). The lookup poll is keyed by the device fingerprint, which is public (S2), so the code must only work in a check-in signed by that device key.
- Tests needed: as C, plus the label is shown on receipts, dashboard and check.html.

### E. Count the staff approval as the freshness, with no code

- How: a check-in signed by a device key that a staff member bound within the last few minutes is marked fresh.
- Bad: same change of meaning as D, but with no single-use code at all, and harder to reason about (any check-in from that key in the window). Not recommended.

## Recommendation

**C (hold the code at first scan)**, because it is the only option that keeps "fresh" meaning exactly what it means today and still fixes the first visit, including with Require live screen code. D is the fallback if a new endpoint is not wanted, with its own honest label. B and E weaken or blur freshness.

## Decisions needed from Spencer

1. Which option (A, C or D)?
2. For C: how long a hold lasts (suggest 10 minutes).
3. For D: the label text for a staff-confirmed check-in.
4. Whether the change counts as a new signing requirement under C15 (it shouldn't: a phone without the new code simply lands as offline, as now).
