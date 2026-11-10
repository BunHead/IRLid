# Kiosk mode and the full screen lock

Two org settings, both **off by default**, both Lead Admin or Developer only to change (the org key alone cannot switch them either way). Settings → 5. Sign-in & Auth → **Kiosk and door screen**:

- **Kiosk mode**: Check-in opens straight into the locked full screen QR (padlock, refresh-QR button, red/green online dot). The lock is always on in kiosk mode. A browser only enters true full screen after a tap, so until the first tap the locked QR covers the page and the first tap makes it full screen.
- **Lock full screen** (under Kiosk mode): without kiosk mode, lock the full screen QR only when someone opens it. With kiosk mode on it shows as on and greyed out.

## What it does

When it is on and the Check-in QR is opened full screen on the venue screen:

- The **X** becomes a **padlock**. To its left is a round **refresh QR** button, which asks for a new live code straight away.
- Leaving full screen (the padlock, **Esc** or **F11**) shows an **unlock QR**. A staff-tier member (staff, manager, Lead Admin or Developer of this org) scans it with their phone and approves with the phone's enrolled hardware key (v5). Only then does the screen leave full screen.
- Anything else keeps it locked: an attendee's or unknown phone, a rejected or expired code, a changed payload, a bad signature, or no internet.
- **Stay locked** closes the unlock panel and goes back into full screen. Esc always leaves browser full screen (a page cannot stop it), but the screen stays locked; tap it or press Stay locked to return.
- The padlock, refresh button and a small dot sit at the top right. The dot shows **green** when the screen is online and **red** when it is offline (no network, or the screen has fallen back to the static backup QR).

It only affects the screen. Check-in keeps working exactly as before, online or offline (C1, C13).

## Offline unlock code (no internet)

So a Lead Admin or Developer is never locked out, their phone can make a one-time 8-digit code with no internet.

Set-up, once per phone, online: Settings → 5. Sign-in & Auth → Kiosk and door screen → **Set up on my phone**, scan the QR with the phone, tap **Set up on this phone** and confirm with the hardware key. The phone makes a random 32-byte seed, signs it with its v5 key and sends it to the Worker (`POST /org/kiosk/code-key`). Only a Lead Admin or Developer signature is accepted; manager, staff and attendee phones are refused. Setting up again replaces that person's old seed. The page then says **Ready with no signal on this browser** once its offline copy is saved; if it says not ready, keep it open online for a few seconds and reload it once.

Then approve each door screen, once, on that screen, online (v6.8.12): Settings → 5. Sign-in & Auth → Kiosk and door screen → **Approve this screen**. The screen makes a random secret, keeps it, and shows a one-time QR (3 minutes, single use). A Lead Admin or Developer scans it and confirms with their hardware key; the phone shows "Let screen XXXX accept offline unlock codes for 30 days", so check the screen id matches the one on the screen. The Worker builds what the phone signs (org, screen id, the SHA-256 of the screen's secret, a one-time nonce, the approval's expiry), so a staff member cannot approve a screen and cannot change what is approved. A Developer approves without being a member of the org. Approving the same screen again replaces its old approval. **Approved screens → Show** lists them with **Revoke** (Lead Admin or Developer; audited).

An approved screen fetches its keys whenever it is online (`GET /org/kiosk/code-keys`: signed-in staff-tier session, lock on, and the screen's secret in the `X-Kiosk-Secret` header):

    kiosk_key = HMAC-SHA256(seed, "irlid-kiosk-code|" + org_id + "|" + screen_id)

The seed never reaches a screen, so a key read off one screen opens only that screen. Before v6.8.12 any staff session could fetch the keys for any screen id it typed in, and so make codes for any screen; now it needs that screen's approval and its secret.

**Whose session (review 1.3).** The approval also remembers who was signed in on the screen when it was approved. Only that member's session, or a Lead Admin / Developer session, can fetch the screen's keys. So another staff member who copies the secret off the screen can't fetch its keys with their own session (refused with reason `signed_in_as_someone_else`, and the screen drops its keys). If a different staff member signs in on the screen, a Lead Admin or Developer approves it again. Approvals made before this change still work until they are renewed (30 days at most).

**When a screen stops accepting codes.** Keys carry an expiry: **72 hours** after they were fetched, and never past the screen's approval (**30 days**). The screen refreshes them every 10 minutes and whenever it comes back online, so a screen that stays online never runs out; one that has been offline for more than 72 hours has no offline codes until it is online again. A screen drops its keys at once when the Worker says no: the screen was revoked, re-approved elsewhere or its approval ran out, the approver is no longer Lead Admin / Developer, the lock was turned off, or the session lost its role or was signed out (401, 403, 409). Signing out of the dashboard, or a session that expired, also clears them. A network error keeps them until their own expiry. A seed stops working at the next refresh once its owner is no longer Lead Admin / Developer.

To unlock with no internet: tap the padlock. With no internet it goes straight to the offline code (if the browser thinks it is online but the unlock code can't be fetched, it switches there by itself; **No internet? Lead Admin or Developer code** is the manual way, and **Staff phone scan** tries the staff scan again). The screen shows a fresh one-time challenge as a QR and as text. The admin scans it (the page opens from the phone's offline cache), confirms with fingerprint or face, and types the code shown:

    code = 8 digits of HMAC-SHA256(kiosk_key, "unlock|" + challenge)

The screen checks it offline. A challenge lasts 90 s, works once, and is retired after 5 wrong codes, so a photo of the screen or of a code is no use later (S6, S12). Every offline unlock, and every 5-wrong-codes lock-out, is queued on the screen and written to the audit log (`POST /org/kiosk/offline-unlock-log`, action `irlid_kiosk_offline_unlock_v5`) when the screen is back online and signed in. The same entry is never logged twice.

**What the audit row proves (I1).** It is what the screen reported. The screen holds the key that checks a code, so it could make a matching code itself: the row is never proof that the key's owner was there, and it names no actor (shown as "Kiosk XXXX (kiosk-reported)"). It says whether the report came from the approved screen (its secret), whether the code the screen sent matches the named person's key for that screen and challenge, the screen's own time, and who was signed in when it synced. The phone's fingerprint / face check unlocks the code on the phone only; that signature is not sent anywhere yet.

**Nothing is lost from the queue.** Real unlocks are kept until the Worker has recorded them. Lock-outs can be made by anyone at the screen, so only the first 100 are kept one by one; after that they are counted (with the first and last time) and the count is written as one audit row, so a burst of wrong codes can never push a real unlock out. The screen sends at most 50 entries at a time and removes only what the Worker accepted; the Worker refuses more than 200 in one request rather than cutting them. If the browser cannot save the queue (storage full), it is kept in memory and still synced.

Limits: the screen must have been approved and online (and signed in) after the admin set up their phone, and within the last 72 hours. If no admin has set one up, or the screen is not approved, the offline panel says so and the screen stays locked (recover with Ctrl+Alt+Del, see below). Anyone who can read the screen's browser storage can make codes for that screen only, until its keys expire; that needs the dashboard already open, which the lock is there to stop.

## How the staff QR unlock works

1. The kiosk (signed in) calls `POST /org/action/init` with `action_type: "irlid_kiosk_unlock_v5"`. The Worker refuses it if the org has the lock off (`409 kiosk_lock_off`).
2. The Worker builds the payload itself (`{type, org_id, purpose: "exit_fullscreen", nonce, timestamp}`) and a fixed summary. Nothing the kiosk sends goes into what the phone signs.
3. The kiosk shows the `org-action-auth.html?nonce=...` link as a QR. It lasts 3 minutes and works once (S6).
4. The phone signs with its v5 hardware key. `POST /org/action/claim` checks the signature, the payload hash, the action type, the org and that the signer is staff-tier or above. Three bad tries lock that code for 5 minutes.
5. The unlock is written to the audit log (who, when, allowed / denied).
6. The kiosk polls `GET /org/action/poll/<nonce>` and leaves full screen only on `status: "claimed"` with `action_result.unlocked === true`. A flaky network is retried with backoff (1.5 s up to 8 s); the screen stays locked meanwhile.

## Honest limits (I1)

A web page cannot fully lock a computer. Browsers do not let a page block:

- the **Windows key**, **Alt+Tab**, **Ctrl+Alt+Del**, **Alt+F4** or **Ctrl+W**;
- **Esc** dropping browser full screen (the page stays covered and the next tap goes back to full screen, but the browser bar shows meanwhile).

Reloading or closing the tab shows the browser's "Leave site?" prompt, which can be confirmed. So the lock stops casual tapping on the dashboard behind the QR. It is not a sealed kiosk.

If the kiosk is offline, the staff QR unlock can't work; a Lead Admin or Developer uses an offline code instead. If its sign-in has expired (or it was signed out), the dashboard signs out and the screen's offline keys are cleared, so neither works. If no code is set up, the screen is not approved, or its keys have run out, it stays locked and staff recover with Ctrl+Alt+Del or by closing the browser, then sign in again with a v5 scan.

## Testing the phone with no signal (physical test)

Use the phone and browser you will really use (each browser, and an app's built-in browser, keeps its own copy and its own set-up).

1. Online: on the dashboard, open Settings → 5. Sign-in & Auth → Kiosk and door screen → **Set up on my phone** and scan its QR with the phone. Tap **Set up on this phone** and confirm. Wait until it says **Ready with no signal on this browser** (reload once if it says not ready).
2. Online, on the door screen (Kiosk mode or Lock full screen on and saved): **Approve this screen**, scan its QR with the same phone, check the screen id matches, confirm. The screen says Approved.
3. Put the door screen in kiosk mode and open Check-in full screen.
4. Phone: turn on airplane mode (Wi-Fi off too). Screen: unplug its network or turn off its Wi-Fi.
5. Tap the padlock. Scan the challenge QR with the phone's camera. The code page must open with no signal, show the same screen id and challenge, and after fingerprint / face show an 8-digit code. Type it on the screen: it unlocks.
6. Scan the same challenge again: the phone shows the same code (it is tied to that challenge); the screen refuses it because the challenge is used.
7. Reconnect the screen, sign in if needed, and check the audit log shows one "kiosk-reported" offline unlock.
8. Revoke the screen in Settings → Approved screens; after its next refresh, a fresh offline code is refused.

If the code page shows "not set up" in step 5, the camera opened a different browser than step 1; open the link in the browser you set up, or set that browser up too.

## Windows 11 Home

Home has no Assigned Access, so the Windows key, Alt+Tab and the taskbar always work. Use auto-lock instead: press **Win+L** when you leave the screen, and set a short sleep time with sign-in required on wake (Settings → Accounts → Sign-in options → "If you've been away, when should Windows require you to sign in again?" → "When PC wakes up from sleep").

## Real kiosks: Windows Assigned Access (Pro, Enterprise, Education)

For a screen that members of the public can touch, also lock the computer itself:

1. Create a local standard account for the kiosk (Settings → Accounts → Other users → Add account → "I don't have this person's sign-in information" → "Add a user without a Microsoft account").
2. Settings → Accounts → Other users → **Set up a kiosk** (Assigned Access). Choose that account and **Microsoft Edge**, then "As a digital sign or interactive display", and enter the Org dashboard URL.
   - Needs Windows 10/11 Pro, Enterprise or Education. Windows Home does not have it.
3. Edge kiosk mode then runs full screen with no address bar, and the Windows key, Alt+Tab and the taskbar are not available to that account. Ctrl+Alt+Del still works and is how staff sign out.
4. Sign in to the Org dashboard once on that account with a v5 scan, open Check-in, and open the QR full screen. Keep "Lock full screen" on so the dashboard itself is still protected if someone reaches it.
5. Set Edge's idle reset to "Never" (or long enough for an event), because a reset clears the sign-in.

Microsoft's guide: "Set up a single-app kiosk on Windows" (learn.microsoft.com, search for "assigned access single-app kiosk").

Android tablets: use **Screen pinning** (Settings → Security → App pinning) or a kiosk/MDM app instead.
