# Pre-Launch Audit — 3 May 2026

**Author:** Number One (Sunday morning watch)
**Purpose:** Ship-shape audit before the cym13 r/netsec follow-up post lands.
**Status:** Findings compiled; edits described, not applied. Captain to greenlight before any changes go in.

---

## Executive summary

Three categories of work surfaced.

**Critical — must edit before posting:**
- `PROMOTION.md` Format A: three lines stale (test count, Worker-side status, real-device status). One-line addition for browser-by-browser verification.

**Should-edit — public-page copy lagging the v5 deploy.** Best done AFTER the cym13 post lands so the page matches the post:
- `features.html`: three specific lines treat localStorage as current and v5/Secure Enclave as future. STALE.
- `about.html`: "Where IRLid Is Heading" section calls v3 "the foundation" and lists Secure Enclave as future. STALE.
- `vision-v4-plus.html`: structural — Layer 3 panel labelled "v5 — NEXT UP". v5 is LIVE in production.

**Clean — no edits needed:**
- `index.html`, `scan.html`, `accept.html`, `receipt.html`, `check.html`, `account.html`, `settings.html`, `v5-test.html`, `widget.html`, `demo-login.html`. All on `js/sign.js?v=5.0`. Settings panel correctly wires v5. Check page correctly verifies v5 envelopes.

**Side-finding flagged for later, NOT pre-launch:**
- Test environment `settings.html` is pinned at v3-era content (Debug + Data + Identity only; no v4 chip pickers, no bio-metric panel, no trust history, no v5 panel; cache buster `?v=3.1`; copyright 2025). Mr. Data Tuesday item.

---

## 1. PROMOTION.md Format A — three line edits before posting

The cym13 follow-up draft was written 1 May 2026 when v5 was client-side only. Worker side and three-browser verification have shipped since. The draft now over-claims about queued work and under-claims about deployed state.

### 1.1 Line 54 — test count

**Currently:**
> Test coverage: 110 tests across the v5 envelope verifier, including 100 random ECDSA P-256 sigs through DER↔raw round-trip, all 9 named negative paths (wrong origin, wrong type, mutated payload, missing UV flag, malformed clientData, etc.).

**Replace with:**
> Test coverage: 122 tests (110 client-side unit tests in `tests/sign.test.js` plus 12 Worker regression tests in `irlid-api/tests/verify-receipt.test.mjs`) across the v5 envelope verifier, including 100 random ECDSA P-256 sigs through DER↔raw round-trip, all 9 named negative paths (wrong origin, wrong type, mutated payload, missing UV flag, malformed clientData, etc.).

### 1.2 Lines 60-64 — Worker-side status

**Currently:**
> Worker-side envelope verification is queued (HANDOVER-Batch5-Worker.md). Until that lands, v5 receipts arriving at the test Worker fail signature check — which is fine because v5 is OFF by default in settings.html and nothing in the wild produces v5 receipts yet.

**Replace with:**
> Worker-side envelope verification is deployed and tested in parallel: both production (`irlid-api`) and test (`irlid-api-test`) Workers verify v5 envelopes via the same `verifyV5Envelope()` helper, with `fully_v5` scoring flag for receipts where both sides plus the HELLO offer all verify their v5 envelopes (PROTOCOL.md §13.9). v5 remains OFF by default in `settings.html` — users opt in via Settings.

### 1.3 Lines 65-67 — real-device status

**Currently:**
> No real-device deploy. v5 won't go live to irlid.co.uk until Worker side is in and a real-phone smoke confirms enrol → toggle → scan produces a verifying receipt.

**Replace with:**
> Verified clean on real consumer hardware on 2 May 2026 across three browser × OS combinations: Edge + Microsoft Password Manager + Windows Hello on Windows 11; Chrome + Google Password Manager + Windows Hello on Windows 11; Chrome + Google Password Manager + Android biometric on Pixel 8 Pro. The six-step diagnostic at `https://irlid.co.uk/v5-test.html` runs green on all three. Firefox-on-Windows is quarantined for a documented Firefox-side WebAuthn UX wrinkle (two-stage Windows Security dialog; the credential creates correctly but the page-side reporting fails on the secondary picker). Honest about it; not a v5 protocol issue.

### 1.4 Optional — date stamp

Drop `(3 May 2026)` near the top so the post grounds itself when found later. Without it, the "what landed today" phrasing reads as evergreen.

### 1.5 Format propagation

Format B (alternative top-level post) and Format D (LinkedIn) carry the same staleness. Same three edits would apply if those formats are used. Format C (X/Twitter) and Format E (Patreon) are higher-level and don't have the specific stale lines, but read both before posting.

---

## 2. features.html — line-level v4-residue

### 2.1 Line 383 — "Device Key Pairs" card

**Currently:**
> Each browser generates a unique ECDSA P-256 key pair using the Web Crypto API. The private key never leaves the device — currently stored in localStorage. In a future update, keys will migrate to the device Secure Enclave (Apple) or Trusted Execution Environment (Android) via WebAuthn, making them hardware-backed and non-extractable even on rooted devices.

**Issue:** Says localStorage is current and Secure Enclave is future. Both wrong — v5 (live since 2 May 2026) puts keys in Secure Enclave / TEE / Hello TPM via WebAuthn, optionally enabled in Settings.

**Suggested rewrite:**
> Each browser generates a unique ECDSA P-256 key pair using the Web Crypto API. The private key never leaves the device. By default it lives in localStorage; with v5 hardware-backed signing enabled in Settings, the key lives in the device's Secure Enclave (Apple), Trusted Execution Environment (Android), or Windows Hello TPM, where it is non-extractable even on rooted devices and requires a fresh biometric gesture at every signature.

### 2.2 Lines 407-411 — "Passkey, Biometric & Face Capture Support" card

**Currently:**
> WebAuthn passkey authentication is available for device-local login. **Planned for v4**: three optional trust enhancements — all off by default, user-enabled in Settings, never prompted during a scan:
>
> **Secure Enclave signing** — moves handshake keys from localStorage into the device hardware enclave, making them non-extractable even on rooted devices.
>
> **Biometric unlock** — fingerprint or Face ID gates the enclave key, proving the device owner was physically present. Biometric data never leaves the device.
>
> **Mutual face capture** — at each scan step the camera optionally captures the other party's face alongside their QR. A witnesses B's face; B witnesses A's face. Only the photo hash travels in the receipt — the photo stays on device.

**Issue:** Calls these "Planned for v4". v4 shipped 17 April 2026. v5 shipped 2 May 2026. Mutual face capture is still future (v5.x), but the rest is live.

**Suggested rewrite direction:** Restructure the card title and body into three subsections. Card title becomes "Hardware-Backed Signing & Biometric Verification". Three subsections:
- **v4 — Bio-metric gate (LIVE).** WebAuthn requires Face ID / Touch ID / fingerprint at each handshake. The bio-verified flag is committed inside the ECDSA-signed payload.
- **v5 — Hardware-backed signing (LIVE).** Signing keys live in Secure Enclave / TEE / Hello TPM. Non-extractable. Score band 70/100. Closes the strongest honest criticism of v3/v4 (localStorage extraction).
- **v5.x — Mutual face capture (planned).** At each scan, the camera optionally captures the other party's face alongside their QR. A witnesses B; B witnesses A. Only photo hashes travel in the receipt; photos stay on device.

All three remain optional, off by default, Settings-gated. Never prompted during a scan.

### 2.3 Line 448 — "Roadmap" intro

**Currently:**
> ...The base receipt (20 points) is valid forever. Optional enhancements in future updates will push the score toward 100, maintaining symmetry with the % Confirmed display.

**Issue:** Frames v4 and v5 enhancements as future. Both have shipped. The 50/100 score band is live (v4) and the 70/100 band is live (v5).

**Suggested rewrite:**
> ...The base receipt scores 20/100 and remains valid forever. v4 enhancements — trust history, biometric gate, privacy mode — push the ceiling to 50/100 when enabled in Settings. v5 hardware-backed signing pushes it to 70/100 when active. Future versions (v6 multi-witness time anchoring, v7 zero-knowledge presence proofs) extend the ceiling further. Every layer is optional and off by default; the base receipt is sufficient for everyday use.

---

## 3. about.html — line-level v4-residue

### 3.1 Lines 261-271 — "Privacy & Data" section (paraphrased)

**Currently:** Frames biometrics as future. "biometrics and personal data are not off the table. In future, incorporating them could significantly strengthen the system..."

**Issue:** v4 bio-metric gate has been live since 17 April 2026. v5 hardware-backed signing has been live since 2 May 2026.

**Suggested rewrite direction:** Acknowledge that v4 added an optional bio-metric gate and v5 added optional hardware-backed signing, both off by default in Settings. Keep the "core handshake works without any of this" framing — it remains true. The bio-metric data still never leaves the device; that property is preserved.

### 3.2 Line 343 — "Where IRLid Is Heading" section

**Currently:**
> IRLid v3 is the foundation — a cryptographic receipt proving two people physically met. But the protocol is designed to grow. Future layers will add hardware-backed keys via the device Secure Enclave, optional biometric signing, mutual face capture as a witness system, a trust network built from real-world relationships, blockchain anchoring for permanent tamper-evident records, IoT and drone delivery verification, and eventually zero-knowledge proofs so presence can be proven without revealing identity.

**Suggested rewrite:**
> IRLid v3 was the foundation — a cryptographic receipt proving two people physically met. v4 (April 2026) added optional trust history, bio-metric gating, and privacy mode. v5 (May 2026) moved signing keys into the device's Secure Enclave / TEE / Hello TPM via WebAuthn, closing the strongest honest criticism of the earlier versions. The protocol continues to grow in layers — future work includes multi-witness time anchoring (v6), trust-network analysis (v6), drone-delivery and IoT integration (v6+), and zero-knowledge presence proofs (v7). Every layer is optional and off by default; v3-era receipts remain fully valid forever.

---

## 4. vision-v4-plus.html — structural edit

The whole "Layer 3 — v5 NEXT UP" panel and the timeline at the bottom need updating. Layer 3 should be marked LIVE not NEXT.

### 4.1 Layer 3 header (line ~142)

**Currently:**
> Layer 3 — v5 — Secure Enclave & Face Capture (all optional, next up)

**Suggested:**
> Layer 3 — v5 — Hardware-Backed Signing — LIVE (May 2026)

### 4.2 Layer 3 body restructure

Split the contents into "Hardware-Backed Keys (v5.0, LIVE)" and "Mutual Face Capture (v5.x, planned)". The Hardware-Backed Keys subsection is shipped; the Face Capture subsection is queued for v5.x.

### 4.3 Layer 3 scoring table (lines ~167-173)

Currently the table caps at 50/100. v5.0 actually adds +20 to a 70/100 ceiling. The table needs:
- All Layer 2 checks: 30 pts
- Hardware-backed key (v5.0): +10 pts (was +5)
- Biometric unlock (v4, already live): 5 pts (move into Layer 2 if not already there)
- Mutual face capture (v5.x, planned): +10 pts (5 for A witnessing B, 5 for B witnessing A)

This deserves a careful pass — the existing scoring weights are publicly visible and changing them mid-flight needs to match what `verifyReceipt()` actually returns. PROTOCOL.md §13.9 has the canonical 70/100 figure for fully-v5 receipts. Sync vision-v4-plus.html scoring against that, not against a stale draft.

### 4.4 Timeline at line ~272

Phase 3 currently labelled "v5 — Enhanced — Bio-metrics & Enclave (next up)". Replace with "v5 — LIVE — Hardware-Backed Keys".

### 4.5 Recommendation

The vision-v4-plus.html edit is the largest of the four files. It can be done in the same session as features.html and about.html, OR pushed to a follow-up day if Captain wants to ship the smaller edits first. Doesn't gate the cym13 post — that post stands on PROTOCOL.md §13 and the live `irlid.co.uk/v5-test.html` diagnostic, neither of which involves vision-v4-plus.html.

---

## 5. settings.html — CLEAN, no edits needed

The v5 hardware-backed-signing panel (lines 206-260 in the live file) is properly wired:

- Status row with three states (unavailable / not enrolled / enrolled-but-disabled / enrolled-and-enabled)
- ARIA-complete: `role="status"`, `aria-live="polite"`, `aria-describedby` on toggles and buttons
- Default OFF
- Enrol / Toggle / Remove buttons with confirmation dialogs
- Cross-linked to `THREAT-MODEL.md §III.2` in the descriptive copy
- Cache buster `?v=5.0` on `js/sign.js`
- "Clear local data" button extended to clear v5 keys (lines 600-603): `irlid_v5_cred_id`, `irlid_v5_pub_jwk`, `irlid_v5_enabled`

**Cog button:** NOT present. Captain's 30 April directive (REMOVED for good) confirmed applied.

---

## 6. Settings options & buttons audit

All panels and controls in `settings.html` are still in use. None obsolete.

| Panel / Control | Status | Notes |
|---|---|---|
| Debug toggle | Keep | Surfaces recovery controls; useful for support |
| Clear local data button | Keep | Updated to also clear v5 keys |
| Clear receipts only | Keep | Distinct from full clear; useful |
| Identity / Public key ID | Keep | Debug aid |
| Distance tolerance chips (5/12/25/50m) | Keep | v4 protocol-config; read by scan.html |
| Time window chips (30/90/180/300s) | Keep | v4 protocol-config; read by scan.html |
| GPS accuracy floor chips (any/20/10/5m) | Keep | v4 protocol-config; read by scan.html |
| Minimum score chips (off/50/70/90%) | Keep | v4 protocol-config; read by scan.html |
| Bio-metric verification panel | Keep | v4 feature, still works alongside v5 |
| Trust history panel | Keep | v4 trust scoring |
| v5 hardware-backed signing panel | Keep | v5 LIVE |
| Floating cog button | Confirmed REMOVED | Captain's 30 April directive applied |

`scan.html` reads the v4 chip-picker settings into runtime tolerances (lines 233-236 of scan.html). Confirmed wired.

---

## 7. Test environment parity — flagged for later, NOT pre-launch

`D:\SkyDrive\Pen Drive\WEBSITES\IRLid-TestEnvironment\settings.html` is significantly behind the live one:

- No v4 chip pickers (distance / time / GPS / score)
- No bio-metric verification panel
- No trust history panel
- No v5 hardware-backed signing panel
- Copyright 2025 (live is 2026)
- Cache buster `?v=3.1` on `js/sign.js` (live is `?v=5.0`)

Grep across the test-env file confirms no `v5`, `Secure Enclave`, `hardware-backed`, or `Passkey` anywhere in it.

This is not a pre-launch blocker — the test environment is for testing the org-portal / `OrgCheckin.html` / Doorman flow, not user-facing settings. But if anyone uses the test env to test v4/v5 user features, they won't find them.

**Recommendation:** Mr. Data Tuesday consideration. Either (a) one-shot copy the live `settings.html` into the test env, or (b) deliberately keep test-env settings minimal because the org-portal flow doesn't exercise user features. Captain's call.

---

## 8. Recommended posting / edit order

1. **Apply Format A edits to PROMOTION.md** (sections 1.1, 1.2, 1.3 above; optional 1.4 date stamp). Number One can apply directly when greenlit.
2. **Captain rewrites Format A in his voice** — substance from the draft, tone from him.
3. **Captain posts to r/netsec** as a comment reply on the original v4 thread, tagging u/cym13.
4. **Watch first hour of comments** — any sharp follow-up critique gets logged in `THREAT-MODEL.md` before more outreach. Per crew §5.1: that cycle is more valuable than any volume of posts.
5. **Apply features.html edits** (sections 2.1, 2.2, 2.3) — Number One drafts the rewrites, Captain rewrites in his voice, Captain pushes.
6. **Apply about.html edits** (sections 3.1, 3.2) — same flow.
7. **Apply vision-v4-plus.html structural edit** (section 4) — same flow.
8. **Optional same day or next:** Format C (X), Format D (LinkedIn), Format E (Patreon). Each carries similar staleness; same edits propagate.

Steps 5-7 don't have a strict deadline. They should land same day or next so the public pages match the post, but they don't gate the post itself.

---

## 9. Files NOT read in full this watch

The audit prioritised the four public-facing pages plus the operational ones. Some files were read partially; the rest were not opened.

- `contact.html` — likely just a contact form; low likelihood of v4-residue but unverified.
- `login.html` — auth surface; low likelihood of v4-residue but unverified.
- `receipt.html` — only first 300 lines (CSS + structure) read; the receipt-rendering and verification code below not audited. The cache buster is `?v=5.0` so the JS is up to date; the markup may still have v4-residue copy.
- `accept.html` — first 200 lines read; remainder not read.
- `widget.html` — first 200 lines read; remainder not read.
- `v5-test.html` — first 100 lines read; remainder not read. This is the v5 diagnostic page and is internally produced; very unlikely to have residue.
- `account.html` — first 150 lines read; remainder not read.
- `blog-proof-of-personhood.html` — first 200 lines read; remainder not read. Note: this is dated "Published April 2026" and is properly a snapshot of the v3/v4 era; updating it would be a new blog post rather than an edit.
- Test env files beyond `settings.html` spot check.

If any of these warrant deeper audit before the public-page edits, flag and Number One will do another pass.

---

— Number One, Sunday morning watch, 3 May 2026
