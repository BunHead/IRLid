# Pending Work — IRLid

**Last refreshed:** 27 April 2026 (Number One — late afternoon session, post-Batch-12)
**Source of truth.** All other lists defer to this file.

---

## Today / Active (priority order)

1. **🔥 LIVE BUG — Inline checkout QR renders as empty white box on org dashboard.**
   Root cause: `org.html:renderCheckoutQr()` calls `getElementById('checkoutQr_' + CSS.escape(checkinId))`. UUIDs starting with a digit (`9e179aa2-…`) get their leading "9" escaped to `\39 ` by CSS.escape, but `getElementById` takes a literal id, not a CSS selector — so target is always null, function early-returns at the `if (!target)` guard, no QR ever rendered. Mr. Data's PR #44 added an `<img>` API fallback but kept the broken CSS.escape, so the fallback never fires.
   **Fix:** drop `CSS.escape()` — one line. Number One applied it locally; merge conflict with PR #44 needs clean resolution after Captain's `git merge --abort` + clean pull. The right merged version: drop CSS.escape (mine) **and** keep PR #44's image fallback path (his). Both correct.

2. **Test env merge state currently broken — needs recovery.**
   Local main was 1 ahead, 25 behind. Pull conflicted on `org.html`. Staged merge also includes alarming `renamed: scan.html -> s` and `deleted: settings.html` — these files still exist as untracked in the working tree. Captain to `git merge --abort`, share status, then clean pull + reapply CSS.escape fix.

3. **Batch 12 — MERGED to origin/main as PR #40.** Mr. Data delivered (separately from Number One's HANDOVER-Batch12.md draft). Captain's local clone hadn't pulled, which caused tonight's confusion. Once recovery in step 2 is done, Batch 12 is effectively shipped.

4. **Batch 13 — DRAFTED by Mr. Data in `HANDOVER.md` (test env)** as a 5-task plan:
   - T1: Staff auth schema + `POST /org/staff/auth` session endpoint (Worker + D1, no UI)
   - T2: Staff Auth UI smoke panel in Doorman mode (non-blocking)
   - T3: Enforce staff auth for manual check-in (Worker rejects without session token)
   - T4: Checkout token API foundation (`org_checkout_tokens`, short tokens, 5-min TTL)
   - T5: Short checkout QR UI (replaces dense URL with `?t=<token>`)
   - Optional: Debug "Clear test attendance" maintenance action (DEV-org only)
   Mr. Data correctly split this — won't touch Worker schema + UI gate + checkout tokens in one PR.

5. **Talon scan report** — Still exogenous, likely Monday onwards.

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
