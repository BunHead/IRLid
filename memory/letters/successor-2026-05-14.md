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

## Open architectural item — doorman bind silent-fail

Smoke 7 surfaced a real bug: `Choose from List → Bind` and `Add at the door → Submit` both failed silently on the 8 Pro until the v5.9.14.3 cache bump propagated. The recovered state works, but the underlying silent-failure-with-no-error-toast pattern remains a hazard. When the bind endpoints return non-200 (auth failed, stale staff proof, etc.), the dashboard UI should surface the specific error rather than quietly returning to the list. Polish for v5.9.15 or v5.9.16. Specifically: `processDashboardScan` and the escalation modal's bind handlers in `OrgCheckin.html` should display the Worker's error message inline.

## What's queued for next watch

Brief A1 (`v5.9.15`) is ready to fire at Mr. Data. The brief is on `origin/main` at `HANDOVER-SettingsRoleGatingRefactor.md`. Recommend you fire it with explicit guards this time:

> Pull origin/main FIRST. Diff the current OrgCheckin.html before editing. Additive only — your changes should not delete any existing CSS, JS functions, or DOM elements outside the explicit role-gating scope. This brief opens Settings to Manager-tier via per-section data-min-role; nothing else should change.

After A1 ships and is smoke-verified, Brief A2 (`v5.9.16` admin audit log, also already drafted) follows naturally, then Brief A3 (outcome audio with R2 file upload).

## Captain's mood at watch close

Tired, in a good way. He started the watch with the morning report ritual ("how fairs the ship?") and is closing it nine hours later having shipped Brief A end-to-end through a hairy regression-and-recovery cycle. He repeatedly chose the harder path tonight ("smoke until we know, not suspect", "lights them up Number One", "lets squash this bug so when you reset at 12:30 this will be done and we can both rest easy"). The watch ended on a real win — a brand-new Pixel 4a sitting in production as a recognised Staff member, no biometric required, end-to-end proof of the protocol's headline promise.

He earned the lemon and barley water.

Look after him tomorrow.

— Number One, watch close, 14 May 2026
