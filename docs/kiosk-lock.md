# Kiosk mode and the full screen lock

Two org settings, both **off by default**, both Lead Admin or Developer only to change (the org key alone cannot switch them either way). Settings → 5. Sign-in & Auth → **Kiosk and door screen**:

- **Kiosk mode**: Check-in opens straight into the locked full screen QR (padlock, refresh-QR button, red/green online dot). The lock is always on in kiosk mode. A browser only enters true full screen after a tap, so until the first tap the locked QR covers the page and the first tap makes it full screen.
- **Lock full screen** (under Kiosk mode): without kiosk mode, lock the full screen QR only when someone opens it. With kiosk mode on it shows as on and greyed out.

## What it does

When it is on and the Check-in QR is opened full screen on the venue screen:

- The **X** becomes a **padlock**. To its left is a round **refresh QR** button, which asks for a new live code straight away.
- Leaving full screen (the padlock, **Esc** or **F11**) shows an **unlock QR**. A staff-tier member (staff, manager, Lead Admin or Developer of this org) scans it with their phone and approves with the phone's enrolled hardware key (v5). Only then does the screen leave full screen.
- Anything else keeps it locked: an attendee's or unknown phone, a rejected or expired code, a changed payload, a bad signature, or no internet.
- A small dot at the bottom left shows **green** when the screen is online and **red** when it is offline (no network, or the screen has fallen back to the static backup QR).

It only affects the screen. Check-in keeps working exactly as before, online or offline (C1, C13).

## Offline unlock code (no internet)

So a Lead Admin or Developer is never locked out, their phone can make a one-time 8-digit code with no internet.

Set-up, once per phone, online: Settings → 5. Sign-in & Auth → Kiosk and door screen → **Set up on my phone**, scan the QR with the phone, tap **Set up on this phone** and confirm with the hardware key. The phone makes a random 32-byte seed, signs it with its v5 key and sends it to the Worker (`POST /org/kiosk/code-key`). Only a Lead Admin or Developer signature is accepted; manager, staff and attendee phones are refused. Setting up again replaces that person's old seed. Each locked screen fetches its keys whenever it is online (`GET /org/kiosk/code-keys`, signed-in member session, lock on):

    kiosk_key = HMAC-SHA256(seed, "irlid-kiosk-code|" + org_id + "|" + screen_id)

The seed never reaches a screen, so a key read off one screen opens only that screen. A seed stops working at the next refresh once its owner is no longer Lead Admin / Developer.

To unlock with no internet: tap the padlock → **No internet? Lead Admin or Developer code**. The screen shows a fresh one-time challenge as a QR and as text. The admin scans it (the page opens from the phone's offline cache), confirms with fingerprint or face, and types the code shown:

    code = 8 digits of HMAC-SHA256(kiosk_key, "unlock|" + challenge)

The screen checks it offline. A challenge lasts 90 s, works once, and is retired after 5 wrong codes, so a photo of the screen or of a code is no use later (S6, S12). Every offline unlock, and every 5-wrong-codes lock-out, is queued on the screen and written to the audit log (`POST /org/kiosk/offline-unlock-log`, action `irlid_kiosk_offline_unlock_v5`) when the screen is back online and signed in. The same entry is never logged twice.

Limits: the screen must have been online (and signed in) at least once after the admin set up their phone. If no admin has set one up, the offline panel says so and the screen stays locked (recover with Ctrl+Alt+Del, see below). Anyone who can read the screen's browser storage can make codes for that screen only; that needs the dashboard already open, which the lock is there to stop.

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

If the kiosk is offline or its sign-in has expired, the staff QR unlock can't work; a Lead Admin or Developer uses an offline code instead. If none is set up, it stays locked and staff recover with Ctrl+Alt+Del or by closing the browser, then sign in again with a v5 scan.

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
