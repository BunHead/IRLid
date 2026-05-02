# Pending Work — IRLid

**Last refreshed:** 1 May 2026 (Number One — Friday morning Bridge stretch, post-v5-client-side landing)
**Source of truth.** All other lists defer to this file.

## v5.0 Passkey work — landed 1 May 2026 (client-side only)

Number One implemented v5.0 client-side directly during the Friday Bridge stretch (Captain's brief: "make it a challenge"). What landed in the live repo:

- **`PROTOCOL.md §13` published** — full v5 specification: WebAuthn signing envelope (`authData`, `clientData`), DER→raw signature conversion, RP ID + origin allowlist, UV flag enforcement, score band 70/100, settings model, sync-neutral posture, threat-model improvement table.
- **`PROTOCOL.md` version history updated** — v4 row added (was missing); v5 row added with §13 reference.
- **`js/sign.js` extended** — new helpers: `irlidV5Available`, `irlidV5Enrolled`, `irlidV5Enabled`, `irlidV5Enroll`, `irlidV5Unenroll`, `irlidV5SignPayloadHash`, `irlidV5VerifyEnvelope`, `irlidV5DerToRawP256` / `irlidV5RawToDerP256` (DER↔raw conversion with leading-zero edge-case handling), `irlidSignPayload` (unified dispatcher), origin allowlist + RP ID heuristic.
- **`makeSignedHelloAsync`, `makeReturnForHelloAsync`, `verifyHelloOfferAsync`, `processScannedResponse` all updated** — dispatch to v5 path when `irlidV5Enabled()` is true; v3/v4 callers see no behaviour change.
- **`tests/sign.test.js` extended** — new describe blocks for DER↔raw round-trip (incl. high-bit and short-r/s edge cases), v5 envelope verification (happy path + 9 negative paths), origin allowlist, dispatcher fallback. Local smoke against real ECDSA P-256 in Node sandbox: 12/12 green over 100 random sigs.
- **`settings.html` v5 panel wired** — replaced the greyed placeholder with a real enrol/toggle/remove panel, mirroring v4 bio-metric pattern, full ARIA, default OFF.
- **`HANDOVER-Batch5-Worker.md` published in live repo root** — atomic 3-task brief for Mr. Data Tuesday: add `verifyV5Envelope()` helper, wire into `verifySignedHello()`, wire into `verifyReceipt()` + scoring. Reference impl already in `js/sign.js`. No D1 schema changes required.

**What v5 does NOT yet have:**
- Real-device browser smoke test (needs Captain's phone/laptop).
- Live deploy — v5 is OFF by default; nothing changes for existing users until they explicitly enrol via Settings.

**Worker-side v5: ✅ DONE 1 May 2026 afternoon.** Captain bypassed Mr. Data ("get v5 out the door before any horns, helium-tight"). Both Workers updated:
- **Live Worker** (`irlid-api/src/index.js`): `verifyV5Envelope()` helper inserted between haversine and verifyReceipt; `verifyReceipt()` rewritten with per-side v5 dispatch + `fully_v5` scoring flag (true only when BOTH a/b sides + HELLO offer all verify their v5 envelopes; PROTOCOL.md §13.9).
- **Test-env Worker** (`IRLid-TestEnvironment/irlid-api/src/index.js`): same `verifyV5Envelope()` helper, `verifyReceipt()` v5 dispatch, plus `verifySignedHello()` updated to return `verification_state: "v5_envelope_verified"` for v5 HELLOs. Defensive bonus: the non-recursive `canonical()` was upgraded to fully recursive (matches `js/sign.js`); harmless for current flat payloads, future-proof for nested fields.
- **Validation:** Node-side Worker smoke at `outputs/v5-test/worker-smoke.mjs` — 12 tests covering pure v3, pure v5, hybrid v3+v5, mutated payload, wrong origin, UV flag cleared, webauthn-missing-but-v=5, hash mismatch, distance overflow. All green. Combined client+Worker test count: **122 green, 0 red**.
- **`HANDOVER-Batch5-Worker.md` marked DONE** and preserved for historical context. Mr. Data on Tuesday should read it for design rationale but no execution required.

**Roadmap impact:** v5.0 client-side AND Worker-side both landed 1 May, ahead of late-May target. Only real-device smoke + live deploy remain before v5 is fully out the door. v5.1 (Imbue pilot) and v5.2/5.3 (forward-defined fields, orient cone) remain on schedule.

**Remaining v5 path to deploy:**
1. Captain runs `node --test tests/sign.test.js` on his machine (the integrated 95+ test suite). Then `node --test irlid-api/tests/verify-receipt.test.mjs` for the Worker regression (12 tests). Total combined client + Worker: ~107+ tests.
2. Captain enrols on real device (phone Face ID, laptop Hello) via `https://irlid.co.uk/v5-test.html` (after deploy) or `http://localhost:8000/v5-test.html` (locally via `python -m http.server`). Step-by-step diagnostic walks through availability → enrol → sign → verify → round-trip, with a copyable diagnostics blob if anything fails.
3. Captain merges `no1/v5-passkey-signing` to `main` so GitHub Pages deploys the frontend (cache-busters bumped to `?v=5.0` ✅).
4. Captain pushes Worker code to test-env Cloudflare deploy via `wrangler deploy` from `IRLid-TestEnvironment/irlid-api/`.
5. Smoke test against deployed test Worker with curl + a hand-rolled v5 receipt (`manufactureV5Envelope` infrastructure in `irlid-api/tests/verify-receipt.test.mjs` produces the bytes).
6. If clean, push live Worker via `wrangler deploy` from live `irlid-api/`.
7. Then — and only then — the cym13 r/netsec follow-up post (drafts already in PROMOTION.md).

**Autonomous stretch deliverables (1 May, while Captain at work):**
- `v5-test.html` — IRL diagnostic page with step-by-step pass/fail UI, copyable diag blob, fully ARIA-complete.
- All 9 HTML files cache-busted to `?v=5.0` (settings, check, accept, login, index, receipt, scan, account, plus v5-test).
- `CLAUDE.md` scoring table updated with v5 row + status, "Number One's Technical Positions" updated to reflect v5 landed not just planned.
- Worker-side regression tests at `irlid-api/tests/verify-receipt.test.mjs` in BOTH live and test-env repos (version-controlled now, not just sandbox artifact).
- `THREAT-MODEL.md §III.2` cross-linked to PROTOCOL.md §13 + js/sign.js + HANDOVER-Batch5-Worker.md.

## Design observation surfaced by 2 May Tier 3 IRL test — asymmetric trust-history accrual

**Finding:** in the standard v3/v4 2-scan handshake (HELLO → scan → response → scan), only the **initiator** ends up with the combined receipt and therefore only the initiator updates their trust history. The **responder** signs a response, hands it over, and never sees the combined object. So the responder's `irlid_trust_history` localStorage doesn't grow from that handshake. Captain's 2 May test exercised this empirically: 8 Pro (initiator both times, with wife's and child's phones as responders at swim baths and town) accumulated 57 → 59. The two responder devices accumulated 0 receipts each from today's flow. Tier 3's diversity-progression test on a responder device cannot pass through standard role assignment.

**Captain's call (2 May):** initiator-primary is the right default. Asymmetric accrual is the cost of fast 2-scan handshakes. Queue as v6+ design item.

**Possible v6+ resolution paths (not in v5 scope):**
1. **3-scan handshake variant** — initiator shows combined receipt as a 3rd QR; responder scans it; responder records. Trade-off: extra round trip, slightly more friction.
2. **Responder-side partial caching** — when signing the response, the responder caches `{ helloHash, offerHash, my_signed_response }` in localStorage. When they later visit a verifier with the combined-receipt URL the initiator shares (e.g. via WhatsApp / SMS), the cached partial completes into a full record on the responder's device.
3. **Server-mediated mirror** — for org-portal contexts where a Worker is in the loop, the Worker can serve the combined receipt back to both parties on request. Naturally fits the unified Check-in flow Mr. Data has been building.

**Test-guide update:** `IRL-TEST-GUIDE.md` updated 2 May with a footnote in T3.1/T3.2 noting that responder-side trust-history accumulation requires a role-swap scan (target device acts as initiator) — same locations work, just swap who shows the HELLO first.

**Status:** logged for v6+ consideration. No immediate work. Captain's instruction: "footnote that it might need testing again."

---

---

## Current state (30 April 2026)

**The architecture has pivoted to unified Check-in.** Mr. Data shipped through PR #73 over the AWOL window, building `OrgCheckin.html` prototype alongside the stable `org.html`. The new direction (per `docs/unified-checkin-role-dashboard.md`):
- **Public Check-in** = the branded event QR screen (no attendance table, no names, safe to show at venue entrance)
- **Dashboard** = private staff/admin surface with role-gated controls
- **No more Venue/Doorman split** — collapsed into one Check-in flow + permissioned Dashboard
- **Roles**: recognised → supporter → staff → manager → lead_admin → developer (Founder is honorary, not a dashboard view)
- **Step-up auth**: privileged writes require fresh Staff HELLO scan at the moment of save, not just an active session
- Compatibility aliases: `type=venue` → `type=checkin`, `type=doorman` → staff-review path, `type=checkout&t=<token>` unchanged

**Wisdom (ASE Tech) — definitely aboard but too busy to talk further. Wait for him to surface.**
**Donald (Imbue) — went silent post-Wednesday. Not chasing.**

**Hardware:** TOALLIN 2K Windows Hello-certified webcam arrived and Hello facial recognition is WORKING. £41.99 single-device bet paid off. Outstanding: webcam reading dense QRs from phone screens is fragile (older tablet works fine) — Batch 16 short-token QRs (already shipped) help by reducing module density.

## Today / Active (priority order)

1. **Captain's design clarifications (30 April) — capture and ship into protocol/UX:**
   - **Floating cog: REMOVED for good.** Mr. Data's call confirmed. Settings sidebar nav item only.
   - **Initials for Expected list — show for all rows always.** Format TBD: `SRA` or `S.R.A.` or `S R A` (accessibility consideration). Default to `SRA` (no separator) for compact scan, with full name available to screen readers via `aria-label`. *Number One ratified for accessibility consistency.*
   - **Default 1-hour grace period after event close, configurable in settings.** Implementation pending.
   - **Deny path: write `event_attendance` row with status `rejected`, then end (no link to Org website like Accept does).** This builds the audit trail. Implementation pending.
   - **Manual Acceptance: when staff has active session, can tap-to-log-in attendees, but receipt/log carries clear "Manual Acceptance" disclaimer.** Lower trust score than cryptographic auto-accept. Implementation pending.
   - **Accessibility is non-negotiable** — inclusive platform. Every label needs proper ARIA.

2. **Mr. Data's "Tomorrow / Next Wiring" list (from `docs/unified-checkin-role-dashboard.md`):**
   - 🟡 Tablet Outcome QR fullscreen still clips bottom edge — `scan.html` / shared fullscreen QR audit needed
   - 🟡 **Worker-side enforcement of role gates** (currently only frontend-gated — protocol commitment pending)
   - 🟡 **Step-up auth on saves** (fresh Staff HELLO at moment of write, not just timed session)
   - 🟡 HELLO QR scan-import for adding new attendee/staff/manager records
   - 🟡 Auto-add staff/manager/lead_admin/developer to expected list (with deny-list override)
   - ✅ Restore "Awaiting check-out" passive label — **DONE 30 April by Number One** (`OrgCheckin.html:buildCheckoutAction` — staff role sees passive label, manager+ sees button; also harmonized "Rejected"/"Done" with proper ARIA)
   - 🟡 Resize Attendance Today / action columns
   - 🟡 Webcam QR scanning reliability
   - 🟡 **Global identity + org-local authorization** ("THE Dev" recognised across orgs, powers granted per-org)

3. **Threat Model document — DONE 30 April.** Created `THREAT-MODEL.md` in live repo. Comprehensive abuse-paths companion to `PROTOCOL.md`. Covers: replay attacks, QR copying, stolen device, identity attacks, privilege escalation, network/Worker attacks, side-channel, coercion, and audit trail. Maps each defence to the v5/v6/v7 roadmap. Useful for Wisdom, cym13-style reviewers, conference papers (44CON, EAI SecureComm).

4. **Captain's 30 April additional directives (logged for next coding session):**
   - **Orange "pick from list" screen stays up until human input.** No auto-return-to-scan timeout. Inclusive-platform principle: the orange path is exactly when a person needs cognitive time. Either remove the timer entirely or extend it to a much longer threshold with a clear "still here?" indicator. Affects Batch 11 first-scan flow code in OrgCheckin / org-entry.
   - **Move to `OrgCheckin.html` entirely.** Mr. Data's prototype is now the canonical path. `org.html` should become a redirect/shim for old links, Venue/Doorman code paths retired. URL aliases (`type=venue` → `type=checkin`, `type=doorman` → staff/review) Mr. Data already designed handle migration cleanly. Land as one clean architectural PR, not dribbled.
   - **"Scan once, recognised forever" articulated correctly by Captain — already built.** This is the Imbue pilot pattern (live since Batch 8 cryptographic identity loop). First-visit HELLO scan binds device public key to Expected entry. All subsequent visits at the same org: just scan outcome QR, device signs response with same private key, worker matches fingerprint. v5 Secure Enclave migration upgrades key storage but doesn't change the protocol pattern.

4a. **Long-Term Authority Succession — design sketch published.** `LONG-TERM-SUCCESSION.md` at live repo root captures Captain's "digital legacy" thought experiment as a v8+ Founders' Quorum design. M-of-N threshold signatures + AI-as-ledger-witness pattern, with diversity-of-AI-lineage requirement to avoid ideological lock-in. Captain's key insight (clerks/cardinals are both human, AIs aren't coercible the same way) is the architectural foundation. Not yet committed to PROTOCOL.md. Extend rather than restart if topic resurfaces.

5. **Roadmap priority confirmed (30 April):** v5.0 Passkeys → Live IRLid sign-in overhaul → Worker-side role enforcement + step-up auth. Three sequential horizons, each independent. v5 first because it closes cym13's localStorage criticism (loudest honest critique). Worker enforcement third because by then the Passkey-backed signing surface is stable and step-up auth implementation hits the right thing.

6. **Talon scan report** — Still exogenous, likely whenever.

6. **Live IRLid sign-in / onboarding overhaul (queued, design first)** — Email + password login, Patreon webhook for auto-user creation on subscription, magic-link alternative. Login dropdown structure: `Account / Organization / Event` with `Show my check-in QR` under Event. v5.x / live-IRLid work, not test environment.

7. **PROTOCOL.md formal redacted receipt section** — still pending.

8. **PROTOCOL.md §10.4 Multi-Party Custody Receipts** — queued (drop-off + chain-of-custody for prison/school/care). Forward-defined for v6+.

9. **HANDOVER Batch 5 (v5 Passkeys implementation)** — proposal ratified. Ready to draft when Captain decides to start v5 work.

10. **QR payload shortening (queued)** — encoded URL is too dense for some phones (8 Pro had trouble); now folded into Mr. Data's Batch 13 T4/T5 (Worker token resolution).

11. **Double-tap any QR to fullscreen** — Number One specced this in Batch 12 Task 3b. Whether Mr. Data's PR #40 picked it up needs verifying after recovery — `js/qr-fullscreen.js` is now a tracked file in origin/main, suggests he did extract it as a shared handler.

12. **BacklinkLog** — Hold until first Patreon member.

13. **Donald at Imbue** — Casual follow-up. Test environment now genuinely demoable.

14. **r/programming appeal** — Captain's own words, no rush.

---

## Hardware testing setup (decided 27 Apr)

- **Webcam:** Logitech C920 (~£47) — solves QR scanning issue
- **Windows Hello:** USB fingerprint reader (~£20) instead of IR webcam
- **Total:** ~£67. Defer purchase until v5 implementation is closer.
- **Phase 1 lab testing:** two Androids + Windows fingerprint reader. iOS deferred to Phase 3 (Patreon early-access).

---

## Marketing / Outreach

### Inbound — Closed out 25–26 April

| Contact | Status | Notes |
|---------|--------|-------|
| Nic — Sequenzy | ✅ Replied 25 Apr | Polite decline, warm tone |
| Lasha — Shipit | ✅ Replied 25 Apr | Listing request sent with PH URL |
| Aidan — Talon | ✅ Scan submitted | Report pending at `support@irlid.co.uk` |
| Viberank | ✅ Replied 25 Apr | Thanks + USP feedback acknowledged |
| NextGen Tools | ✅ Listed 25 Apr | Scheduled launch, listing live |
| BacklinkLog | ⏸ Hold | Decision deferred until first Patreon member |

### Conferences / Talks

| Event | Date | Action |
|-------|------|--------|
| 44CON | 17–18 Sep 2026, London | Submit CFP — protocol talk angle |
| EAI SecureComm | 21–24 Jul 2026, Lancaster | Protocol paper angle |
| AidEx Geneva | 21–22 Oct 2026 | Humanitarian / drone delivery — Wisdom connection |
| IEEE GHTC | 7–10 Oct 2026, Colorado | Protocol paper — humanitarian tech |
| Farnborough Airshow | 20–24 Jul 2026 | Press pitch to drone trade outlets |
| BSides Leeds | 13 Jun 2026 | Attend — CFP closed but good community |

### Platforms (pending)

| Platform | Status | Action |
|----------|--------|--------|
| Reddit r/privacy | ⚠️ Karma wall | Build comment history first |
| Hacker News | ⚠️ Karma wall | Comment on threads first |
| Indie Hackers | ⚠️ Karma wall | Comment on threads first |
| David Shapiro Discord | ⚠️ | Try his Discord community |
| r/programming | ⛔ Banned 26 Apr | Low-priority appeal — Spencer's own words |

### Done (high-water mark)

| Platform | Status |
|----------|--------|
| Patreon | ✅ v4 posted 18 April 2026 |
| Twitter/X | ✅ Posted |
| LinkedIn | ✅ Posted |
| Reddit r/netsec | ✅ 28K+ views — v4 update comment posted 20 April |
| Reddit r/SaaS | ✅ Posted 20 April 2026 |
| Reddit r/webdev | ✅ Posted 25 April 2026 (Showoff Saturday) |
| Reddit r/cybersecurity | ✅ Posted 21 April 2026 — FOSS Tool flair |
| Product Hunt | ✅ Launched 23 April 2026 |
| Dev.to | ✅ Posted |
| Hashnode | ✅ Posted |
| YouTube — Nate B Jones | ✅ Commented |

---

## Technical — Pending

- **v5 planning** — Secure Enclave key migration via WebAuthn/Passkeys. Number One proposal owed.
- **PROTOCOL.md update** — Formal redacted receipt schema and verifier behaviour.
- **Imbue pilot design** — First-visit name registration + persistent device-key recognition for attendance logging. Add to org portal spec.
- **DREAMS.md.new cleanup** — Stale draft (21 April, UK date format) sitting next to live `DREAMS.md` (25 April, ISO format). Recommend deletion. Pending Captain's call.

## Roadmap — Master version PROTOCOL.md §12 is canonical

The v5–v10 roadmap is now formally captured in `PROTOCOL.md §12 Master Roadmap` with target dates, effort estimates, and dependencies. **That is the single source of truth.** Summary below for quick scan; defer to §12 for detail.

### Active horizon (May–Jul 2026) — v5

- **v5.0** — Secure Enclave / Passkeys via WebAuthn — *Late May 2026, 2 weeks effort*
- **v5.1** — Imbue pilot — name registration + device-key recognition — *Mid Jun 2026, 2 weeks*
- **v5.2** — Schema fields added: `tframe`, `pframe`, `orient`, `tsTokens` (forward-defined, default-resolved) — *Late Jun 2026, 3 days*
- **v5.3** — `DeviceOrientationEvent` → `orient` field; tolerance cone in verifier — *Mid Jul 2026, 1 week*

### Near horizon (Aug–Nov 2026) — v6 Time anchoring

- **v6.0** — Single RFC 3161 TSA token (FreeTSA)
- **v6.1** — Multi-witness TSA (NIST + NPL + USNO) — state-level threat model
- **v6.2** — OpenTimestamps Bitcoin anchor
- **v6.3** — Hardening + formal threat model write-up

### Mid horizon (Dec 2026–Jul 2027) — v7 Authority infrastructure

- **v7.0** — IRLid Time Authority (Cloudflare aggregator)
- **v7.1** — ZK coordinate hiding
- **v7.2** — Frame-translation verifier libraries
- **v7.3** — Independent security audit

### Far horizon (2028+) — v8 Hardware tier and beyond

- **v8.0–8.3** — Wisdom drone integration; star-tracker + pulsar XNAV anchors (gated on ASE Tech hardware)
- **v9** — Multi-body operation (Moon, Mars) — gated on infrastructure that doesn't yet exist
- **v10+** — Research frontier (full ZK presence, post-quantum, consumer-grade VLBI)

### Forward-defined fields (in PROTOCOL.md, not yet emitted)

- `tframe` — time frame, default `earth/utc` (§10.1)
- `pframe` — position frame, default `wgs84/gps` (§10.1)
- `orient` — quaternion orientation, optional (§10.3)
- `pos` — extended position object supporting cartesian or geographic (§10.3)
- `anchors[]` — celestial attestations (star-tracker, pulsar-xnav, vlbi-quasar, ephemeris-cross) (§10.3)
- `tsTokens[]` — multi-witness TSA tokens (§11.3)

All optional, all default-resolved, all backward-compatible with v3 receipts.

## Infrastructure — Done 25 April

- ✅ `support@irlid.co.uk` email sending — Gmail + Resend SMTP. Verified working.
- ✅ `wrangler.toml` fixed — `irlid-api-test` pointing at correct test DB (`b7d7ccc9`)
- ✅ `org.html` + `wrangler.toml` pushed to GitHub Pages
- ✅ Test environment fully wired — GitHub Pages + Cloudflare Worker (test) + D1 (test)

## Medium Term

- **WFP Innovation Accelerator** — `innovation.wfp.org/apply` (rolling).
- **UNICEF Venture Fund** — `unicefinnovationfund.org` — assess next session.
- **HN/IH karma** — comment on threads first, then post.
- **Wisdom / ASE Tech follow-up** — one-pager drafted by Counsellor Troi. Send when ready.

## Ruled Out

- **Gates Foundation** (April 2026 batch) — medical diagnostics only. Revisit when topic rotates.
- **r/javascript** — too restrictive, poor fit. Not worth attempting.

---

## Mr. Data addendum - 2026-04-26 12:12 BST

Imbue pilot stack update after Number One's return:
- PR #14: stable DEV org key / auto-login (`codex/fix-dev-autologin-org-key`).
- PR #15: fullscreen venue QR now regenerates cleanly and shows org branding/trust cues (`codex/fix-fullscreen-venue-qr-branding`). Still needs merging onward to `main` before GitHub Pages shows it.
- PR #16: dashboard check-out button + `POST /org/checkout` client wiring (`codex/add-dashboard-checkout-action`). Captain merged #16 into #15's branch; no local `git push` needed for that part.
- Next: Number One should inspect/merge the remaining stack to `main`, wait for GitHub Pages deploy, then have Captain hard refresh and verify DEV login, fullscreen venue QR, and check-out flow.
