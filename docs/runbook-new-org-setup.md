# Runbook: setting up a new organisation for a trial

This is written from the first Imbue Ventures Ltd setup on 4 Nov 2026. Follow it in order, and the "Get a member of staff" orange screen won't leave you stuck.

## What you need before you start

- **The admin computer** (the laptop or desktop that runs the Org portal), signed in to irlid.co.uk/Org as Developer or Lead Admin.
- **A webcam on that computer**, or a way to get a photo of a phone screen onto it (WhatsApp to yourself works).
- **Each person's own phone.** No shared devices: everyone checks in on their own phone.

## Step 1: enrol v5 hardware signing on the admin computer

This is the step that caught us out.

1. On the admin computer, open **irlid.co.uk/settings.html** (the main IRLid settings page, **not** Settings inside the Org portal).
2. Scroll to **🔒 Hardware-Backed Signing — v5 (beta)** and click **Enrol hardware-backed key**. Approve the Windows Hello / Touch ID prompt.
3. The panel should now say it is enrolled.

Watch out: the page also has a panel called **👆 Hardware-Backed Verification**. That one is an older feature and does **not** count. If the v5 panel says "Available — not enrolled", you haven't done this step yet.

To check from the Org tab, press F12, open Console and run `localStorage.getItem('irlid_v5_cred_id')`. Anything other than `null` means it worked. You don't need to share or screenshot the value. It's only a credential ID, but there's no reason to send it around.

Repeat this on **every** computer or browser that will be used for admin tasks. Enrolment belongs to one browser on one machine.

The v5 test page (v5-test.html) does **not** enrol you. It creates a passkey, tests it, then removes it from the browser at the end.

## Step 2: create the organisation

In the Org portal, use **Create organisation**, then fill in Settings > 1. Organisation (name, logo, contact details) and 4. Visual Theming.

## Step 3: load the people you expect (optional but faster)

Dashboard > **Expected attendee management**: add people or import a CSV. Anyone already on the list only needs a **Bind** at the door (step 4), and you won't have to type their name.

## Step 4: first check-in for each person (the orange screen)

The first time a phone scans the venue QR, the org doesn't know its key yet, so it shows the orange **"?" Get a member of staff** screen with a QR code. This is deliberate. A phone can never approve itself.

1. The person leaves their phone on the orange screen. The QR refreshes every 5 minutes, so use a fresh one, not an old screenshot.
2. On the admin computer: **Dashboard > Process attendee scan > Scan with camera** and point the webcam at the phone. If there's no webcam, use a photo with **Decode image**, then **Process scan**.
3. In "Escalation: unrecognised attendee":
   - **Bind** if they're on the Expected List, or
   - **Add at the door** (first name + surname) if they aren't.
4. Approve the passkey prompt on the computer. The phone shows "Identity confirmed" and goes green within a few seconds.

After this, that phone goes straight to green every time, unless the person clears their browser data or switches phone or browser.

**Add at the door creates an attendee, not staff.** To give someone staff access, also send them a staff invite (Settings > 3. Staff & Rooms > **Invite staff**, Lead Admin or above). Invites are currently the only admin action you can approve from your enrolled phone instead of the computer.

## Troubleshooting

| What you see | Cause | Fix |
|---|---|---|
| Orange "Get a member of staff" on the phone | Phone's key isn't known to this org yet | Step 4 |
| "No event running" on the Check-in screen | No event scheduled now | Doesn't block check-in; the lookup is org-wide |
| "Hardware-backed signing required on this device for this action" when pressing Bind/Add | The admin computer isn't enrolled in **v5** signing | Step 1 (check the v5 panel, not the 👆 one) |
| Windows Hello says it's *creating* a passkey when you expected it to sign | You're on an enrolment page, or enrolment was removed | Re-do step 1 on settings.html, then reload the Org tab |
| "far from venue" next to a check-in | Phone GPS isn't near the venue location | Expected when testing from home |

## Open follow-ups

- The two "Hardware-Backed …" panels on settings.html are easy to confuse. Consider merging them or renaming the older one.
- Bind / Add at the door can't be approved from a phone, only from an enrolled computer. That's on purpose for now: a solo admin's phone would otherwise be approving its own key.
