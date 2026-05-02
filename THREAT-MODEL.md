# IRLid Threat Model — Abuse Paths and Defences

**Living document.** Companion to `PROTOCOL.md`. Drafted by Number One, 30 April 2026.

This document maps the attack surface of IRLid co-presence proofs and shows how the current protocol versions (v3 / v4 / v5-in-design) reject each abuse path, and where the gaps remain. It is intentionally adversarial: assume the attacker is motivated, technically capable, and has read every line of `PROTOCOL.md`.

The IRLid threat model rests on three asymmetries:
1. **Co-presence is hard to fake** — two devices in the same place at the same time is harder to manufacture than any digital artefact.
2. **Receipts are signed and immutable** — once written, a receipt cannot be retroactively altered or rewritten.
3. **Honest scars beat tidy lies** — the database keeps every UNVERIFIED row warts-and-all, including denied attempts. Forgery requires forging the past, not the present.

Every attack below is defeated where one or more of these asymmetries holds.

---

## I. Replay Attacks

### I.1 Stale HELLO replay
**Attack:** Attacker captures a HELLO QR (their own or someone else's), waits, then re-presents it later to gain entry to a different time window.

**Defence (v3+):**
- HELLO payloads carry a `ts` timestamp; the verifier rejects anything outside a 90s window.
- The receipt's combined hash incorporates both parties' timestamps; ageing apart breaks signature verification.
- Worker-side staff session (v5) has a 15-minute TTL; replays beyond that are rejected with 401.

**Gap:** Within the 90s window, a captured HELLO QR could in principle be re-shown to a colluding party. v6+ multi-witness time anchoring (TSA tokens) tightens the time-of-attestation claim from "the device says it was here" to "an external time authority confirms it was here at this minute."

### I.2 Receipt replay
**Attack:** Attacker takes a published receipt and tries to claim co-presence at a different event by re-submitting it.

**Defence (v3+):**
- Receipts are content-addressable: their hash is over `canonical()`-sorted fields including both parties' public keys and the precise GPS round. A receipt verifies for *that* pair at *that* time at *that* place; it does not transfer.
- Verification recomputes the hash from the receipt body and the included public keys. Any tampering breaks the signature.

**Gap:** None known at the protocol level. Cosmetic concern only: a receipt copied to a new event is a verifiable lie that has to be *displayed*, and the verifier rejects it on first inspection.

### I.3 Checkout token replay
**Attack:** Attacker captures a checkout QR (which encodes `?t=<token>`), waits, then re-uses the token.

**Defence (v5):**
- Worker stores `consumed_at` on the token row when used. Re-resolution returns 410 Gone.
- 5-minute TTL on creation. Replay outside the window returns 410.
- Token resolution returns the checkout payload but the actual checkout signature still requires the same device key that signed the original check-in. A replayed token at best resolves a payload that no third party can sign for.

**Gap:** None known. The token is intentionally low-trust — it is a payload-shortening device, not an authentication token.

### I.4 Cross-device replay
**Attack:** Attacker copies the bytes of a victim's HELLO QR onto their own device and re-presents it.

**Defence (v3+):**
- The HELLO contains the victim's public key. The attendee-side signing flow during scan requires the *private* key matching that public key. A copied QR cannot complete the handshake.

**Gap:** If the attacker has *also* compromised the victim's device (private key extraction from localStorage), they can fully impersonate. See III.2 below — this is the strongest existing weakness, addressed in v5 by Secure Enclave key migration.

---

## II. QR Capture / Copying Attacks

### II.1 Photographed Venue/Outcome QR
**Attack:** Attendee photographs a venue's published QR, then later distributes the photo or claims attendance from elsewhere.

**Defence (v3+):**
- The Venue QR is just a URL. Anyone with it can open the entry page, but completing a check-in still requires the attendee's private key and a fresh HELLO scan from the venue-side device. A photographed venue QR alone does not produce a receipt.
- GPS Haversine distance check (12m) at signing. If the attendee is not actually at the venue, the receipt won't be issued.

**Gap:** GPS spoofing is easy. v6+ multi-anchor positioning (cell tower attestations, BLE beacon witnesses, eventually star-tracker / pulsar-XNAV) progressively raises the bar.

### II.2 Screen-recorded HELLO
**Attack:** Bystander records the screen of someone displaying their HELLO QR.

**Defence (v3+):**
- The HELLO payload is signed by the displaying device's private key, with a fresh timestamp. A captured HELLO is stale within 90s.
- v4 redacted-receipt mode replaces visible GPS with a SHA-256 hash, reducing what can be learned even if the QR is captured.

**Gap:** Within the 90s window, a recorded HELLO is briefly replayable. Mitigations: shorter time windows (configurable), and bio-metric gating before HELLO display (v4) so an attacker recording from afar can't easily compel the original device to render fresh HELLOs.

### II.3 Re-distributed Venue QR via URL leak
**Attack:** Venue's URL is published on social media; mass strangers attempt drive-by check-ins.

**Defence (v3+):**
- Same as II.1. The URL alone is insufficient. GPS check, time check, attendee key all required.
- Expected Attendees list (v4+) — even if a stranger reaches the entry page, the venue can choose to gate on Expected list membership.

**Gap:** Venues that operate as fully-public events (anyone walks in) accept any GPS-passing scan. This is a feature, not a bug — the protocol records what happened; it does not gatekeep who happened.

---

## III. Stolen Device Attacks

### III.1 Active session on lost device
**Attack:** Phone is stolen with an unlocked browser session. Attacker walks into the venue and checks in as the victim.

**Defence (v4+):**
- Bio-metric gate (Face ID / fingerprint / Windows Hello via WebAuthn) fires *before* HELLO signing. `bioVerified:true` is committed into the signed payload. If the thief can't pass the bio-metric, the receipt isn't issued.
- A receipt without `bioVerified` is still valid but scores lower; verifiers can choose to require it.

**Gap:** A device unlocked with a passcode the thief observed can still pass bio-metric (because Face ID is just one of the platform authenticators). v5 priority: enforce *biometric-only* passkey for IRLid signing, blocking PIN fallback.

### III.2 localStorage extraction (current weakness)
**Attack:** Attacker with brief physical access to an unlocked device extracts the IRLid private key from localStorage and walks away with the victim's identity.

**Defence (v3/v4):** None at the protocol level. **This is the strongest honest criticism the protocol currently has** — flagged publicly by cym13 in r/netsec and acknowledged in `PROTOCOL.md`.

**Mitigation in flight (v5):** Secure Enclave / Passkey migration via WebAuthn. Private keys are generated inside the platform's hardware-backed authenticator (Apple Secure Enclave, Android TEE, Windows Hello TPM) and never extractable. Signing requires a fresh user-verification gesture (Face ID / Touch ID / fingerprint / Windows Hello) every time. **Specification:** `PROTOCOL.md §13`. **Reference implementation:** `js/sign.js` (`irlidV5*` helpers); 110-test coverage in `tests/sign.test.js`. **Worker-side verification:** queued in `HANDOVER-Batch5-Worker.md` (Mr. Data, May 2026).

**Roadmap:** v5.0 client-side landed 1 May 2026 (ahead of original late-May target). After Worker-side verification lands and the v5 toggle is shipped, III.2 reduces to "attacker has compromised the platform's secure element," which is a much higher bar than localStorage extraction.

### III.3 Passkey-bound device cloning
**Attack (post-v5):** Attacker compromises a cloud-synced passkey (e.g., via the platform vendor's account compromise) and uses the synced key on a different device.

**Defence (v5+):**
- Cross-device passkey sync is platform-mediated, using the platform vendor's trust boundary. IRLid relies on the platform's authenticator security guarantees.
- Bio-metric gate still required at signing time on the new device, so cloned-key alone is not enough; the attacker must also pass bio-metric on their device.
- v5 design is neutral on sync vs. non-sync: orgs that want stronger guarantees can require non-syncing passkeys.

**Gap:** Cloud sync is a real residual risk. Mitigation: orgs requiring high security can mandate device-bound (non-sync) passkeys, accepting the recovery cost of device loss.

---

## IV. Identity Attacks

### IV.1 Sybil (one person, many devices)
**Attack:** Single attacker registers multiple devices to inflate apparent attendance count or game trust scores.

**Defence (v4+):**
- Trust-history scoring rewards diversity (location diversity, device consistency, depth). A Sybil has all-same-location, all-same-device-pattern history. Score caps low.
- v6+ vouching graph: receipts from established identities count more than receipts among unvouched-for keys. Sybils lack the cross-identity vouching needed to build score.

**Gap:** A patient Sybil who travels and waits could in principle build diverse history. Real defence is at v6+ where the trust graph penalises clusters that don't cross-vouch.

### IV.2 Impersonation by name
**Attack:** Attacker enters their own device but claims a victim's name on the Expected list.

**Defence (v4+):**
- Cryptographic device-key recognition (v5.1 Imbue pilot): once a device is *linked* to an Expected entry, that link is per-key. A different device claiming the same name produces a *conflict* row, not a silent overwrite.
- Conflict resolution requires admin (Manager+) decision — confirm new device or reject.

**Gap:** First-time impersonation before the legitimate person arrives. This is mitigated by name-only display showing initials (per Captain's 30 April decision), reducing the information an impersonator can confidently reuse. Stronger mitigation: pre-link Expected entries to specific public keys when known (out-of-band registration).

### IV.3 Cross-org identity confusion
**Attack:** Same physical person, two orgs with overlapping members. Attacker exploits the confusion to gain unintended privileges.

**Defence (v5+ design):**
- Captain's clarified model: **global identity, org-local authorization.** A key fingerprint can be recognised across orgs (same person), but powers are per-org explicit grants. Being a Manager at Org A grants no powers at Org B.
- Per-org `org_staff_sessions` table enforces this — staff sessions are bound to the org's API key.

**Gap:** Worker-side enforcement of role gates is still in design. Until that lands, frontend-only gates are bypassable by a determined attacker who can call the Worker directly. **Pending work item, flagged in HANDOVER.md.**

---

## V. Privilege Escalation

### V.1 Fake Manager HELLO
**Attack:** Attacker presents a HELLO QR claiming to belong to a Manager.

**Defence (v5):**
- Staff Auth endpoint verifies the HELLO's signature against the included public JWK. A fake HELLO has either no signature or a signature against a key the org doesn't recognise.
- `org_staff_sessions` only issues a session for HELLOs the org has registered. An unknown Manager key returns 401.

**Gap:** Worker-side role enforcement still being wired (per design doc Tomorrow list). Until it lands, frontend gates on the dashboard rely on the role switcher being set honestly. A determined attacker can bypass the role switcher. This is acceptable for prototype demo, not for production.

### V.2 Stolen Lead Admin device
**Attack:** Attacker steals a Lead Admin's device with active staff session and uses it to add Manager-level accomplices.

**Defence (v5+):**
- 15-minute staff session TTL — stolen device's session expires quickly.
- Step-up auth on privileged writes (per design doc): adding a staff member requires fresh Staff HELLO scan at the moment of the save, not just an active session. Stolen device with timed-out session can't add.
- Bio-metric gate on every fresh HELLO — thief without victim's biometric can't even refresh the session.

**Gap:** Within the 15-minute session window, with bio-metric-bypass (e.g. via PIN), a stolen device could in theory add accomplices. Step-up auth is the primary mitigation; making bio-metric-only the default at v5 closes the rest.

### V.3 Crafted role-elevation request
**Attack:** Attacker calls `POST /org/expected` directly with a `prototype_role: "lead_admin"` parameter, bypassing the frontend role-gate.

**Defence (current):**
- Frontend gates set role based on the role switcher. Worker accepts whatever role the request claims.

**Gap:** **This is currently exploitable.** Worker-side role enforcement is the next major protocol commitment (per design doc Tomorrow list, item: "Enforce the prototype role gates in the Worker before any real write path"). Number One ratifies this as the highest-priority Worker hardening task.

---

## VI. Network / Worker Attacks

### VI.1 MITM on Worker calls
**Attack:** Attacker intercepts traffic between client and Worker, modifying request/response.

**Defence:**
- All traffic is HTTPS to Cloudflare Workers; Cloudflare-issued certificates make MITM require either a state-level CA compromise or local TLS interception with a trusted root.
- Receipts are signed end-to-end with ECDSA P-256; Worker MITM can drop or inject requests but cannot forge a valid receipt without the private keys of both signing parties.

**Gap:** Local network MITM (corporate proxy, hostile coffee-shop WiFi) can still drop or delay traffic, causing failed scans. Mitigation: client UX needs clear "could not reach Worker" error states with retry. Currently partial — flagged on the design doc Tomorrow list.

### VI.2 API replay
**Attack:** Attacker captures a legitimate API call (e.g., `POST /org/checkin`) and replays it.

**Defence:**
- Each check-in carries a signed receipt with a fresh timestamp; replay is rejected by the time-window check.
- Idempotency on conflict-prone endpoints (e.g., staff auth replay returns the same session, not a duplicate).

**Gap:** None known.

### VI.3 Token theft via XSS / CSRF
**Attack:** Malicious script in the page steals a staff session token from sessionStorage.

**Defence:**
- IRLid pages are static, served from GitHub Pages. No user-generated content is rendered without escaping (`escapeHtml` used pervasively in frontend rendering).
- Worker endpoints validate `Origin` headers (per Cloudflare Worker convention).

**Gap:** Any XSS in `escapeHtml` coverage would be catastrophic. Mitigation: regular grep audits ensure all `innerHTML` writes go through escape. A new Number One should run `grep "innerHTML.*\${" *.html js/*.js` periodically.

### VI.4 Side-channel timing
**Attack:** Attacker measures Worker response timing to infer whether an Expected entry exists for a given key fingerprint.

**Defence:**
- Worker response paths for "found" and "not found" should match in shape. Currently best-effort.

**Gap:** Constant-time comparison and timing-uniform response paths are a v6+ hardening item.

---

## VII. Side-channel / Correlation

### VII.1 Browser/OS fingerprinting
**Attack:** Receipt or session metadata reveals browser/OS specifics that re-identify the user across orgs.

**Defence (v4+):**
- Anonymous Mode (count-only, no names stored) — orgs that don't need named attendance can run fully de-identified.
- Privacy Mode — GPS replaced with SHA-256 hash before signing, so the receipt does not contain plain coordinates.
- Receipts deliberately do *not* include user-agent strings or browser versions.

**Gap:** Public key fingerprints are stable per device. Across multiple orgs that share log access, the same fingerprint would correlate. Mitigation in v6+: per-org rotating identifiers (HD wallet style), so each org sees a different per-attendee public key derived from a single root key.

### VII.2 Locale-based correlation
**Attack:** UK-specific date format reveals device timezone, narrowing identification.

**Defence:**
- Date format is rendered client-side; the server doesn't need to know.
- 28 April update: locale uses UK/Crown Dependency timezone detection or browser language. Doesn't leak finer than that.

**Gap:** Negligible.

### VII.3 GPS partial reveal via Privacy Mode hash
**Attack:** Even with Privacy Mode, the GPS hash is deterministic — same location produces same hash, allowing same-place inference.

**Defence:**
- `roundGps()` quantises coordinates before hashing, so nearby points produce the same hash. This is by design — verifiers can confirm two parties were "in roughly the same place" without exact coordinates.

**Gap:** A statistically motivated attacker with many published Privacy Mode receipts can build a hash-to-place rainbow table over time. v7 ZK coordinate hiding addresses this — the proof becomes "we were within 12m of each other" without revealing any locator.

---

## VIII. Coercion / Social Engineering

### VIII.1 Forced HELLO scan
**Attack:** Victim is compelled (gunpoint, social pressure) to scan a HELLO into a device they would not voluntarily authenticate with.

**Defence:**
- The protocol cannot prevent physical coercion. It records what happened.
- Bio-metric gate offers a small natural friction — the victim must look at or touch the device. In a high-pressure scenario this is bypassed.

**Gap:** This is the limit of any co-presence protocol. The receipt records the event accurately; downstream investigation handles the coercion. v6+ multi-witness time anchoring strengthens the *non-repudiation* of when things happened, which helps post-hoc.

### VIII.2 Forced check-out
**Attack:** Victim is forced to sign a check-out earlier than they actually left.

**Defence:**
- Same as VIII.1 — the receipt is accurate to what was signed; if signing was coerced, downstream investigation matters.
- Future: panic-signal in the bio-metric flow (e.g., specific finger = duress signal that flips a flag in the receipt without alerting the coercer). v6+ design idea, not committed.

**Gap:** Real but not protocol-soluble.

### VIII.3 Tricked Manager adds fake Lead Admin
**Attack:** Manager is socially engineered into running an "Add Lead Admin" flow with an attacker's HELLO.

**Defence:**
- Adding a Lead Admin is a privileged write. With step-up auth (per design doc), the Manager must rescan their *own* HELLO at the moment of save.
- The new Lead Admin's HELLO must be presented in person — co-presence is the protocol moat.
- No email/OTP path for adding Lead Admin (Captain's 30 April decision). All admin additions require physical attendance.

**Gap:** A Manager genuinely tricked while in person can still complete the flow. This is the human factor; the protocol can only ensure that *whatever* was added was added by someone physically present and cryptographically traceable.

---

## IX. Audit / Forensic Trail

The protocol's hidden strength: **denied attempts are recorded too.**

When an attendee scans a Venue QR but is denied entry (Expected list miss + staff review fails), the system writes a row to `event_attendance` with `status: rejected`. The deny path does *not* link the attendee to the org's website; it ends at the deny screen. But the *attempt* is logged, signed, and timestamped.

This means:
- An attacker who tries 12 different identities at the same venue produces 12 audit rows.
- A coerced check-out leaves a verifiable trace of when the coercion occurred.
- Disputes are resolvable from the immutable log.

The forensic trail is the third asymmetry: **honest scars beat tidy lies.** The database keeps every UNVERIFIED row. Forgery requires forging the past, and the past has multiple witnesses.

---

## X. Roadmap-Mapped Hardening

| Threat | Current state | Gap closer | Roadmap target |
|--------|---------------|------------|----------------|
| III.2 localStorage key extraction | Best-effort | Secure Enclave / Passkey | v5.0 |
| V.3 Crafted role-elevation request | Frontend-only gates | Worker-side role enforcement | v5.x (next) |
| V.2 Stolen device session window | 15-min TTL | Step-up auth on every write | v5.x (next) |
| IV.1 Sybil with patient diversity | Trust history | Vouching graph + crossing rule | v6.x |
| I.1 Within-window stale HELLO | 90s window | Multi-witness TSA tokens | v6.0–6.2 |
| II.1 GPS spoof | Haversine 12m | Multi-anchor positioning | v6.x–v8.x |
| VII.1 Cross-org fingerprint correlation | Stable public key per device | HD-wallet per-org keys | v6.x |
| VII.3 Privacy Mode hash rainbow | Deterministic hash | ZK coordinate hiding | v7.x |
| VIII.2 Coerced check-out (panic signal) | Not addressed | Bio-metric duress signal | v6+ design |

Each row is a real constraint a reviewer can interrogate. The gap closer is the design idea; the roadmap target is when it's expected to land in `PROTOCOL.md §12`.

---

## Notes for Reviewers

This document is intentionally adversarial. If a real-world attacker reads it and identifies a path that defeats all listed defences without being captured here, **that is exactly the contribution we want**. Open issues against this document directly. Email `support@irlid.co.uk` or post to GitHub issues.

The protocol is a living artefact. Every honest critique (cym13's localStorage point in r/netsec is the canonical example) makes the next version stronger. Number One commits to maintaining this document alongside `PROTOCOL.md` as new threats are identified.

— Number One, drafting in Spencer's stead
