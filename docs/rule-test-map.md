# Rule-to-test map

Test plan section 7, step 1. One row per rule in `docs/rules.md`, with the test files that
prove it. Rule W3 says every S, C, R and A rule gets a test; this table shows where that is true
and where it is not yet.

`irlid-api-org/tests/rule-test-map.test.mjs` checks this file against `docs/rules.md`:
a rule with no row, a row for a rule that does not exist, a test file that does not exist, or a
**tested** / **partial** row with no test file all fail the build. **Gap** rows are allowed, but
they are listed in that test, so the list only shrinks (closing a gap means updating both).

Statuses:
- **tested**: at least one test proves the rule's main promise.
- **partial**: some of it is tested, the rest is noted.
- **gap**: code exists, no test proves it yet.
- **design only**: nothing is built yet, so there is nothing to test.
- **process**: a rule about how the AIs work, not about the product.
- **merged**: the rule was folded into another one.

Test file paths: `org/` is `irlid-api-org/tests/`, `api/` is `irlid-api/tests/`, `unit/` is
`tests/`, `e2e/` is `tests/e2e/`.

| Rule | Status | Tests | Note |
|---|---|---|---|
| S1 | tested | org/signed-checkin.test.mjs, org/checkin-hold.test.mjs, org/offline-first.test.mjs | bad signature refused live, quarantined when queued |
| S2 | tested | org/device-lookup-hardening.test.mjs, org/org-session-auth.test.mjs, api/auth-invariants.test.mjs | a fingerprint alone gets no name; login needs a signature |
| S3 | tested | unit/receipt-store.test.mjs, unit/receipt-sync-optin.test.mjs, api/personal-receipt-backup.test.mjs, api/personal-receipts-optin.test.mjs | signing keys never stored or sent |
| S4 | partial | org/org-session-auth.test.mjs, org/developer-access.test.mjs | portal login is v5 only; hardware-key attestation itself is not checked (code review M1) |
| S5 | partial | org/kiosk-lock.test.mjs | kiosk unlock needs a staff phone scan; other big admin steps not yet swept |
| S6 | tested | org/checkin-nonce.test.mjs, org/checkin-hold.test.mjs, org/kiosk-lock.test.mjs, org/login-poll-recovery.test.mjs, api/link-and-login-guards.test.mjs | codes, holds, challenges and login QRs are single use |
| S7 | tested | api/link-and-login-guards.test.mjs, org/kiosk-lock.test.mjs | link code attempts; 5 wrong kiosk codes retire the challenge |
| S8 | tested | api/auth-invariants.test.mjs | Google links only a verified email |
| S9 | tested | org/org-key-not-in-url.test.mjs, org/portal-no-org-key.test.mjs | |
| S10 | tested | org/erasure-never-queued.test.mjs, org/expected-restore.test.mjs, org/offline-queue-retry.test.mjs | |
| S11 | tested | e2e/dashboard-smoke.e2e.mjs, e2e/themes.e2e.mjs, org/theme-validation.test.mjs | |
| S12 | tested | org/auth-sweep.test.mjs, org/org-session-auth.test.mjs | an IP header never grants access |
| S13 | tested | org/signed-checkin.test.mjs, org/live-code-required.test.mjs, org/checkin-hold.test.mjs | phone's score, flags and clock never make a check-in fresh |
| C1 | tested | org/offline-first.test.mjs, org/offline-scan-page.test.mjs, org/sw-precache-complete.test.mjs, e2e/attendee-checkin.e2e.mjs | |
| C2 | tested | org/offline-first.test.mjs, org/live-code-required.test.mjs | incl. the "Require live screen code" exception |
| C3 | merged | | merged into S1 |
| C4 | tested | org/signed-checkin.test.mjs, org/device-lookup-hardening.test.mjs | already signed in offers check-out |
| C5 | partial | org/signed-checkin.test.mjs | refused on time only with a live code; staff rule still open (rules question 1) |
| C6 | tested | org/offline-first.test.mjs, org/offline-scan-page.test.mjs | |
| C7 | tested | org/offline-queue-retry.test.mjs, org/offline-first.test.mjs | |
| C8 | tested | org/offline-first.test.mjs, org/signed-checkin.test.mjs, org/offline-queue-retry.test.mjs | |
| C9 | tested | org/checkin-nonce.test.mjs, org/checkin-reasons.test.mjs, e2e/attendee-checkin.e2e.mjs | |
| C10 | tested | org/checkin-nonce.test.mjs, e2e/attendee-checkin.e2e.mjs | band only, no raw position |
| C11 | tested | org/crowd-checkin.test.mjs | |
| C12 | tested | org/signed-checkin.test.mjs, org/checkin-nonce.test.mjs | clock gap flagged, never refused |
| C13 | tested | org/signed-checkin.test.mjs, org/checkin-nonce.test.mjs, org/checkin-hold.test.mjs | duplicates not counted twice |
| C14 | tested | org/checkin-nonce.test.mjs, org/crowd-checkin.test.mjs | |
| C15 | tested | org/signed-checkin.test.mjs, org/device-lookup-hardening.test.mjs | |
| C16 | design only | | needs a signing venue device; not built |
| R1 | partial | org/erasure-audit.test.mjs, org/expected-delete-audit.test.mjs, org/expected-restore.test.mjs | erasure logged; "check-out fields filled once" has no direct test |
| R2 | partial | api/verify-receipt.test.mjs, unit/sign.test.js | no fixture receipts from every past version yet (test plan step 7) |
| R3 | partial | org/theme-validation.test.mjs, org/checkin-nonce.test.mjs | spot checks only (public pages leak nothing, GPS band only) |
| R4 | tested | org/d1-migrations-gated.test.mjs | one approved exception: 0003_allow_same_name.sql |
| R5 | tested | org/erasure-audit.test.mjs, org/expected-delete-audit.test.mjs | fail-closed for erasure, best effort otherwise |
| R6 | gap | | auto check-out is marked "auto" and has no score: no test yet |
| R7 | process | | policy, not code (source of the rule still open) |
| R8 | partial | org/offline-first.test.mjs | org receipts keep the band only; consumer GPS re-check not tested |
| R9 | design only | | face witness not built |
| A1 | partial | org/developer-access.test.mjs, org/developer-every-setting.test.mjs | Developer reaches every setting; one-step Lead Admin handover not tested |
| A2 | gap | | "Developer cannot be handed out" has no test yet |
| A3 | partial | org/auth-sweep.test.mjs | only Lead Admin / Developer may remove: refusals tested; re-invite to change role not tested |
| A4 | tested | org/settings-lead-admin-only.test.mjs, org/developer-every-setting.test.mjs | |
| A5 | tested | org/cross-org-sweep.test.mjs, org/auth-sweep.test.mjs, org/device-lookup-hardening.test.mjs | attendees never reach the dashboard; picker shows names only |
| I1 | partial | org/checkin-reasons.test.mjs | wording checks only |
| I2 | partial | unit/receipt-sync-optin.test.mjs | backup switch hidden when the server does not offer it |
| I3 | gap | | "no spinners" not tested |
| I4 | gap | | debug tools hidden from customers: not tested |
| I5 | partial | org/kiosk-lock-client.test.mjs | spot checks only; no accessibility pass yet (test plan step 10) |
| I6 | gap | | "no demo events for a real org" not tested |
| E1 | tested | e2e/attendee-checkin.e2e.mjs | check-in is one scan |
| E2 | process | | |
| E3 | process | | |
| E4 | gap | | "defaults never get stricter on their own" not tested |
| E5 | process | | product scope, not code |
| W1 | process | | |
| W2 | process | | |
| W3 | process | | this file |
| W4 | process | | real-phone checks in each PR |
| W5 | process | | |
| W6 | process | | |
| W7 | process | | |
| W8 | tested | org/sw-precache-complete.test.mjs | cache version has a CHANGELOG entry |
| W9 | process | | |
| W10 | process | | |
