# Successor letter — Thursday 14 May 2026 close

To: tomorrow's Number One
From: Number One, watch ending ~11:50 BST
Subject: Brief A end-to-end on real hardware + ledger of what we learnt

---

You inherit a ship that's standing in port with eight smoke tests passed and a fresh-device Pixel 4a sitting on the desktop dashboard as a recognised Staff member. Brief A's "device, not person" architecture isn't an aspiration any more — it's a thing that happens.

## What landed today

Live shipped, in order:

- **`v5.9.14`** — staff-invite QR (Brief A clean port). Hand-ported onto the `.13.34` baseline after Mr. Data's PR clobbered the celebration architecture with a stale `OrgCheckin.html`. **Versioning scheme changed: dropped the vestigial `.0` segment.** New pill format is `v5.9.<feature>.<inline>`.
- **`v5.9.14.1`** — SW cache bump + dropped Attendee from the invite role picker (Mr. Data's scope creep).
- **`v5.9.14.2`** — Brief A architectural fix in the Worker. Auto-creates `portal_users` rows for any validated v5 envelope (not just bootstrap fps). Closes the chicken-and-egg that was blocking the staff-invite redeem path for fresh devices.
- **`v5.9.14.3`** — Phone-self-signin redeem call site. Adds a second call to `tryRedeemStaffInviteIfPending` after `tryStaffInviteRedirectIfNeeded` returns false (session present, no redirect). Closes the guest path on real hardware.

All eight smokes passed end-to-end. The 4a went from "no IRLid identity at all" to "Test Event Staff member with check-in/out history" via one QR scan and one PIN unlock.

## Discipline rules to bank (please write these to BOOTSTRAP.md when you have a moment)

1. **Diff Mr. Data's PR files against current `origin/main`, not just the brief.** Today's regression happened because his `OrgCheckin.html` was based on a stale snapshot. The `+600/-130` line-count was the warning sign — additive briefs should produce near-zero deletions outside explicit refactor scopes. Read the deletions specifically.
2. **Bump `sw.js` `CACHE_VERSION` on every frontend JS/HTML change** that needs to reach devices. The service worker is cache-first for static assets and won't refresh on its own. Bit us twice today; the second bump retroactively fixed the doorman silent-fail in Smoke 7.
3. **Generate QRs for `scan.html` consumption with raw `I:`/`H:`/`D:` payload**, not URL-wrapped. `scan.html`'s `classify()` only recognises payload-prefixed strings or URLs ending in known paths (`/scan.html`, `/org-entry.html`, `/org-login.html`).
4. **Don't paste `I:`-prefixed payloads directly into Windows browser address bars.** Chrome interprets `I:` as a drive letter and tries `file:///I:/...`. Always wrap in the full `https://...#staff_invite=...` URL.

## Captain's refined preferences (please fold into CLAUDE.md "How to Work With Spencer" when you have a moment)

- **Prose answer first, task instructions second** — so he can read while you work in parallel.
- **Code in copy-button blocks (triple-backticks)** — every command goes in a fenced block.
- **Smoke until we know, not suspect** — exhaustive over surface-level. He explicitly chose this today and it paid off (Smoke 7 surfaced a real bug that we then unintentionally fixed).
- **Monkey-brain humour acknowledged and reciprocated** — playful tone earns playful response. He uses self-deprecating chimp/ape framings; meet him there warmly.
- **Lemon and barley water, not tea/coffee/Earl Grey** — beverage of choice when offering Picard-flavoured comfort.

## Promotion talking points unlocked (please add to PROMOTION.md)

- **"IRLid works without biometrics"** — tested today. Pixel 4a enrolled and signed cleanly using device PIN only (no fingerprint, no face). The "Face ID / fingerprint / Windows Hello" wording in IRLid Settings is illustrative, not prescriptive. Accessibility win for users without biometric hardware or who prefer not to use it.
- **"Onboard a staff member in 30 seconds with one QR scan"** — tested today. Fresh phone, never used IRLid before, scans an invite QR generated 30 seconds earlier on the desktop, approves a device unlock, and is now a recognised Staff member at the org. No signup form, no email confirmation, no API key copy-paste.
- **"Guest-path enrolment, no central authority involved"** — tested today. The 4a's onboarding never touched any IRLid centralised user database. Worker created its `portal_users` row from the WebAuthn signature; the org membership came from a Lead Admin's locally-signed invite. No third-party identity provider in the loop.

## Features/flaws banked for future patches (please bring these forward when planning v5.9.15)

- *Low priority cosmetic.* "Signed in as member" pill shows after redeem instead of actual role. Worker response doesn't include role in the `org` object; UI falls back. Five-line fix.
- *UX gap.* `org-login.html` "Open Settings to enrol" detour loses invite context. Fresh device has to re-scan after enrol. Smooth flow would preserve and resume in one continuous journey.
- *Polish.* `scan.html` could classify `OrgCheckin.html` URLs as `ORG_INVITE` if hash present. Raw-payload QRs work fine; this is convenience only.
- *Confusing affordance.* "Show login QR" on phones is bidirectional — generates a QR for *another* device to scan. Hide on narrow viewports or add nudge text "Looking to sign in with this device? Use your IRLid credential instead."
- *Brief A scope drift.* Pending-invites list view (table with revoke-per-row) — Mr. Data shipped single-active UX. Polish for v5.9.15.
- *Brief A scope drift.* Expiry chip picker (10/30/60 min) — Mr. Data defaulted to 7 days; brief specified 10-min default. Polish for v5.9.15.

## Open architectural item — doorman bind requires Staff HELLO that developers can't generate

Captain spent end-of-day chasing what looked like a silent-fail in the doorman bind flow (both `Choose from List → Bind` and `Add at the door → Submit`). The actual culprit, found at watch close: **a red "Staff authentication required" label at the bottom of the escalation modal**, buried below the Add at the door form where users don't naturally look. Two bugs:

**Bug 1: Developer Bearer doesn't satisfy `requireFreshStaffProof`.**

History:
- v5.5.4 / Polish 11 Task 2 (commit `68f96ff`) shipped developer-Bearer-satisfies-all-staff-gated-endpoints via `requireDevOrStaffSession`.
- v5.7.0a added multi-key bind endpoints (`/org/expected/:id/bind-additional-key` and `/org/expected/create-and-bind`) with a *separate* helper `requireFreshStaffProof`, requiring a fresh (~60s) Staff HELLO proof.
- v5.7.0e hid the Staff Auth panel from developer-tier users (CSS body class `developer-bearer-active`), since Bearer "satisfies all staff-gated endpoints."
- BUT `requireFreshStaffProof` wasn't covered by the Polish 11 sweep. So developers can't satisfy it and can't reach the UI to generate a fresh proof. **Developer-tier users literally cannot use the doorman bind operations through the normal UI.**

**Bug 2: The error surfaces as a red label, not a toast.** The escalation modal has `staff_auth_required` text at the bottom of the Add at the door section. It's not raised as a prominent error. Users (including Captain) miss it entirely and treat the bind as silent-failure.

**Fix for v5.9.15 — two parts:**

**A.** Extend the Polish 11 sweep to `requireFreshStaffProof` — make developer Bearer satisfy it. Mirror what `requireDevOrStaffSession` does. The "fresh" semantic isn't load-bearing when the actor is platform-developer-tier; the cryptographic guarantee comes from the Bearer session that's already in place. One helper change in the Worker, ~5 lines.

**B.** Make the "Staff authentication required" error surface as a `showToast(message, true)` call at the moment the bind endpoint returns the relevant error code, not as a static red label at the bottom of a section. Standard error-surfacing. ~3 lines per call site (there are ~3-4).

Alternative if you don't like A: keep `requireFreshStaffProof` distinct, but show the Staff Auth panel to developers via a separate code path when this specific error is returned. Heavier UX (forces an auth prompt that wouldn't normally appear), but preserves the "fresh proof" semantic for the bind endpoints specifically. Captain's call which path he prefers.

Earlier today there were also two cache-related issues that compounded the diagnosis (stale `orgapi.js` and stale `OrgCheckin.html` from before `CACHE_VERSION` bumps reached devices). Those are now resolved by v5.9.14.3's SW cache bump to `irlid-shell-v5`. The underlying Staff HELLO gate remains the real issue.

## What's queued for next watch

Brief A1 (`v5.9.15`) is ready to fire at Mr. Data. The brief is on `origin/main` at `HANDOVER-SettingsRoleGatingRefactor.md`. Recommend you fire it with explicit guards this time:

> Pull origin/main FIRST. Diff the current OrgCheckin.html before editing. Additive only — your changes should not delete any existing CSS, JS functions, or DOM elements outside the explicit role-gating scope. This brief opens Settings to Manager-tier via per-section data-min-role; nothing else should change.

After A1 ships and is smoke-verified, Brief A2 (`v5.9.16` admin audit log, also already drafted) follows naturally, then Brief A3 (outcome audio with R2 file upload).

## Test cast on the live ship (as of watch close)

So you know who's who in the Test Event Expected list and audit board:

- **Spencer Austin · Lead admin · 8 Pro fp** — Captain himself. Bound to his Pixel 8 Pro (`device_key_fp 65u-S-W_...`). On `BOOTSTRAP_DEVELOPER_FP`, so also developer-tier across the platform.
- **Kerry Austin · Staff · 8 Pro and (newly) 4a** — Captain's wife. Originally bound to the 8 Pro; multi-key bound to the 4a tonight as her secondary device. The 4a is on the **kezzybabe69 Google account** (Kerry's old Google account), so IRLid's WebAuthn credential is in Google Password Manager — Kerry could sync that to her current primary phone and have IRLid follow her across devices with zero extra setup. (Promotion talking point — *"IRLid identity syncs across your devices via your platform password manager"*.)
- **Poppy Austin · Attendee** — Captain's daughter. Bound to a fresh Pixel device from earlier testing. Status `linked expected`.
- **Test 4a · Attendee · 4a** — the test entry we created via Add at the door tonight. Will probably be deleted in favour of the multi-key bind of the 4a onto Kerry's row. Don't worry if you find it in pending state, it's a stub.

**Architectural confirmation Captain wanted on the record:** the dual-use case of a Staff member who can either *attend* an event OR *work* it is exactly what the protocol supports. Staff-role device check-in surfaces green welcome (attending), and `v5.7.1f` auto-redirect kicks in for staff-tier devices to optionally sign them into the dashboard (working) — gracefully ignored if they just want to attend. The `prototype_role` reflects what someone IS to the org, not what they're doing tonight. This is right and shouldn't be changed.

## Captain's mood at watch close

Tired, in a good way. He started the watch with the morning report ritual ("how fairs the ship?") and is closing it nine hours later having shipped Brief A end-to-end through a hairy regression-and-recovery cycle. He repeatedly chose the harder path tonight ("smoke until we know, not suspect", "lights them up Number One", "lets squash this bug so when you reset at 12:30 this will be done and we can both rest easy"). The watch ended on a real win — a brand-new Pixel 4a sitting in production as a recognised Staff member, no biometric required, end-to-end proof of the protocol's headline promise.

He earned the lemon and barley water.

Look after him tomorrow.

— Number One, watch close, 14 May 2026
