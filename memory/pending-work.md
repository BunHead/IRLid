# Pending Work — IRLid

**Last refreshed:** 26 April 2026 (Number One — current Claude session)
**Source of truth.** All other lists defer to this file.

---

## Today / Active (priority order)

1. **Talon scan report** — Scan submitted 25 April, report coming to `support@irlid.co.uk`. Not yet received. Reply to Aidan once it arrives.

2. **Mr. Data 2.0 (Codex) — next mission** — First PR (settings panel score binding + summary panel) merged and verified. **Next task:** replace mocked attendee logic in TestEnvironment with real Worker calls against `irlid-api-test`. Number One to write the brief: scope, endpoints, success criteria, hard boundary at the test DB.

3. **v5 architecture proposal — Secure Enclave / Passkeys migration** — Number One owes Captain a concrete proposal: key generation path via WebAuthn, backward compat with existing v4 receipts, rollout gating, fallback for browsers without platform authenticator.

4. **PROTOCOL.md formal write-up of redacted receipt format** — Privacy mode is live in code (`irlidMakeRedactedReceipt()`) but PROTOCOL.md only mentions it briefly in §8. Formal schema + verifier behaviour section needed.

5. **BacklinkLog** — $20/year decision pending. Permanent dofollow backlink. **Hold until first Patreon member joins.**

6. **Donald at Imbue** — Casual follow-up next time he's around. Mention Imbue attendance pilot idea (first-visit name + persistent device key recognition).

7. **r/programming appeal** — Permanent ban for LLM-written content rule (26 April). Low priority. Spencer's own words, 2–3 sentences. No rush.

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

## Roadmap — captured in PROTOCOL.md §10–§11 (26 Apr 2026)

- **v6a** — Optional single RFC 3161 TSA token (FreeTSA) — score 50→55
- **v6b** — Multi-witness TSA: NIST + NPL + USNO — score 55→62; raises threat-model floor to state-level
- **v7a** — IRLid Time Authority (Cloudflare-hosted aggregator) — score 62→70
- **v7b** — Daily OpenTimestamps Bitcoin anchor — score 70→75
- **v8** — Mothership/drone pulsar receiver (XNAV) — score 90+; off-Earth-capable, hardware tier
- **Forward-defined fields:** `tframe`, `pframe`, `tsTokens` documented in PROTOCOL.md §10–§11. Not yet emitted; receipts that include them remain v3-valid.

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
