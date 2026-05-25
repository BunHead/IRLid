# v5.11.0k smoke test — Add at the door + lifecycle clean

**When:** After Mr. Data ships v5.11.0k AND Captain has merged the PR AND `wrangler deploy`'d the Worker AND Captain has hard-refreshed `irlid.co.uk/Org` to verify build pill reads `v5.11.0k`.

**Hardware needed:**
- Desktop browser (Captain's main developer device) on `irlid.co.uk/Org`
- Pixel 8 Pro (staff device, developer-credentialled)
- Pixel 4a (attendee device — the one we want to bind to Kerry)

**Pre-flight tab/cache discipline (you'll need this):** v5.11.0k bumps `sw.js` CACHE_VERSION to v21. The Service Worker will update on next page load, but the in-memory JS on any open tab stays at the version it was loaded with. **Close and reopen each tab** on the desktop, 8 Pro, and 4a before starting. Pull-to-refresh on Android does it; on the 8 Pro, close the tab from the tab switcher and reopen via bookmark.

---

## Step 0 — Pre-flight (do once)

1. Confirm Worker is deployed:
   ```powershell
   cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\irlid-api-org" ; npx wrangler deployments list --limit 1
   ```
   Latest deployment timestamp should be within the last few minutes of the merge.

2. Confirm dashboard pill reads `v5.11.0k` on the sidebar of `irlid.co.uk/Org`. If it still reads `v5.11.0j`, DevTools → Application → Clear site data → close tab → reopen.

3. (Optional but recommended) Open a separate PowerShell window and start wrangler tail so any Worker error during the smoke is captured live:
   ```powershell
   cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\irlid-api-org" ; npx wrangler tail
   ```
   Leave this running in the background; glance at it after each Add Attendee click.

---

## Test 1 — Lifecycle clean (Delete record → cold-add → Bind via Choose-from-List)

**Goal:** Confirm Delete record fully cleans up Kerry's state AND the Bind path still works post-deletion. Regression check for v5.11.0j.

1. **Desktop:** On `/Org` dashboard, find Kerry Austin's row in the Expected list panel.
2. **Desktop:** Tap **Delete record** on Kerry's row → confirm the prompt.
3. **VERIFY:** Kerry disappears from Expected list AND from Attendance Today.
4. **Desktop:** Add Kerry back via the Expected list cold-add path (top of Expected panel, "Add attendee" or equivalent — NOT the escalation modal). First name "Kerry", Surname "Austin".
5. **VERIFY:** Kerry reappears in Expected list with `display_name = "Kerry Austin"` and status = unlinked (no green pill).
6. **4a:** Open `irlid.co.uk` (or whatever the venue check-in URL is) — if the tab was open from prior testing, close it and reopen.
7. **VERIFY (4a):** 4a shows the **orange state** with the device-key QR + "Get a member of staff" text. (If 4a goes green instead, the device_pub_fp wasn't fully unbound — escalate to Number One.)
8. **8 Pro:** Open the camera app or whatever scans QRs, scan the orange QR on 4a's screen.
9. **VERIFY (8 Pro):** 8 Pro Chrome opens with a "Open in staff dashboard" prompt, tap it.
10. **VERIFY (8 Pro):** Lands on `irlid.co.uk/Org` → escalation modal opens automatically.
11. **VERIFY (8 Pro):** Modal shows "Choose from list" section with Kerry Austin + Spencer Austin rows, each with a blue **Bind** link.
12. **8 Pro:** Tap **Bind** on Kerry Austin's row.
13. **VERIFY (8 Pro):** Fingerprint prompt fires.
14. **8 Pro:** Authenticate with fingerprint.
15. **VERIFY (8 Pro):** Blue toast "Linked: Kerry Austin" + return to scan in 1s.
16. **VERIFY (4a):** Orange screen flips GREEN with "Welcome back, Kerry Austin" within 2-4 seconds.
17. **VERIFY (Desktop):** Kerry appears in Attendance Today as IN with `scan_count = 1`, `display_name = "Kerry Austin"`.

**Pass criteria:** All 17 verify checkpoints green. If any fail, capture the wrangler tail output and stop the smoke.

---

## Test 2 — Add at the door (fresh attendee, NOT on Expected list)

**Goal:** The Mr. Data v5.11.0k fix path. Confirm `display_name` persists, role chips are gone, no `invalid_action_payload`.

1. **Desktop:** Delete record on Kerry Austin again (post-Test-1 state).
2. **VERIFY:** Kerry removed from Expected list AND Attendance Today.
3. **DO NOT pre-add Kerry this time.** Leave her off the Expected list.
4. **4a:** Close + reopen the tab. (Or hard refresh. The point is to clear the previously-bound device_key state from in-memory JS.)
5. **VERIFY (4a):** 4a shows the orange state.
6. **8 Pro:** Scan orange QR with camera app → "Open in staff dashboard" → land on `/Org` with escalation modal.
7. **VERIFY (8 Pro):** Choose-from-list section is EMPTY or shows only Spencer (no Kerry, because she's not on Expected list).
8. **VERIFY (8 Pro):** "Add at the door" panel shows: heading "Add at the door" → subtitle "Create a new entry with this device already bound." → First name input → Surname input → green **Add Attendee** button. **NO role chips (Attendee/Staff/Manager/Lead admin) anywhere.** ← critical Mr. Data check
9. **8 Pro:** Type "Kerry" in First name, "Austin" in Surname.
10. **8 Pro:** Tap **Add Attendee**.
11. **VERIFY (8 Pro):** Fingerprint prompt fires (per-action WebAuthn).
12. **8 Pro:** Authenticate with fingerprint.
13. **VERIFY (8 Pro):** **NO red `invalid_action_payload` error.** ← second critical Mr. Data check
14. **VERIFY (8 Pro):** Blue toast "Linked: Kerry Austin" (or similar success indicator).
15. **VERIFY (4a):** Orange flips GREEN with "Welcome back, Kerry Austin" within 2-4 seconds.
16. **VERIFY (Desktop):** Kerry appears in Attendance Today AND Expected list with `display_name = "Kerry Austin"` (NOT "Unnamed attendee") and `role = attendee`.

**Pass criteria:** All 16 verify checkpoints green. The two critical Mr. Data checks (no role chips, no `invalid_action_payload`) are non-negotiable.

---

## Test 3 — Empty name guard

**Goal:** Confirm the "Enter a name" guard works so doorman can't accidentally create another Unnamed row.

1. **Desktop:** Delete record on Kerry again.
2. **4a:** Close + reopen tab → orange state.
3. **8 Pro:** Scan orange QR → escalation modal opens.
4. **8 Pro:** Leave BOTH First name + Surname empty.
5. **8 Pro:** Tap Add Attendee.
6. **VERIFY (8 Pro):** Visible "Enter a name" (or similar) message appears. NO fingerprint prompt. NO Worker call fired (check wrangler tail — should show nothing for this attempt).
7. **VERIFY (Desktop):** No new Unnamed row appears in Expected list.

**Pass criteria:** Guard fires, no Unnamed row created.

---

## Test 4 — Cycle stress (signed check-out → check-in again)

**Goal:** Confirm the post-Add-at-the-door attendee can cycle IN/OUT/IN normally.

1. (Picking up from Test 2 — Kerry should be IN.)
2. **Desktop:** Tap the check-out QR on Kerry's row → scan QR with 4a.
3. **VERIFY (4a):** Signed check-out completes; 4a shows OUT state.
4. **VERIFY (Desktop):** Kerry's row shows OUT.
5. **4a:** Scan venue check-in QR again.
6. **VERIFY (4a):** 4a goes GREEN immediately (recognised — fp already bound).
7. **VERIFY (Desktop):** Kerry IN with `scan_count = 2`.

**Pass criteria:** Cycle stress works without re-prompting for binding.

---

## Test 5 — Spencer too (sanity)

Repeat Test 2 with Spencer Austin (Captain's name) to confirm the path is repeatable and not Kerry-specific.

**Pass criteria:** Same as Test 2.

---

## If anything fails

1. **Capture wrangler tail output** from the moment of failure. The Worker's `requireSignedAction` failures and `genericAuthFailed` paths emit verbose logs — they tell you the exact rejection reason.
2. **Take a screenshot** of the 8 Pro modal showing the error.
3. **Note which step + which checkpoint** failed.
4. Log to Number One with these three artifacts. Number One drafts a `v5.11.0k-followup` brief for Mr. Data; do NOT loop back into the same PR.

---

## After all 5 tests green

1. Note in chat that smoke is green.
2. Number One updates `memory/pending-work.md` removing the v5.11.0k entry from carry-forwards.
3. Promotion-round-2 brief unblocks for next watch.
4. Lemon and barley water. The dock is the right shape, Captain.

— Number One, drafted 25 May 2026 evening
