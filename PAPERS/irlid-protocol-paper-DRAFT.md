<!-- STATUS: verified draft skeleton, 2 July 2026. Produced by Number One's multi-agent
     pass: 3 extractors (PROTOCOL.md / THREAT-MODEL.md / deployment history) -> 1 draft
     -> 2 adversarial verifiers (overclaim hunter + technical accuracy); all ~33 findings
     applied. Before arXiv submission: Captain resolves the [CAPTAIN DECIDE] markers,
     references get filled (placeholders marked [ref]), and format converts to LaTeX
     (arXiv accepts PDF from any source; pandoc from this markdown works).
     cs.CR first-submission may need endorsement - see PROMOTION.md Round 3 notes. -->

# IRLid: Browser-Based Evidence of Physical Co-Presence with Hardware-Backed Signatures

**Spencer Austin**
Independent Researcher, United Kingdom
support@irlid.co.uk · https://irlid.co.uk · https://github.com/BunHead/IRLid

**[CAPTAIN DECIDE: the original draft used spencer@irlid.co.uk, but only support@irlid.co.uk is verified as a working mailbox (Gmail + Resend SMTP, confirmed 26 April 2026). If the spencer@ mailbox exists and receives mail, swap it back before submission.]**

*Preprint. Submitted to arXiv (cs.CR).*

> **Alternative titles considered:**
> 1. *Co-Presence Receipts: A Browser-Only Protocol for Mutually Attested Physical Meetings*
> 2. *Evidence of Meeting: Hardware-Backed Co-Presence Attestation Without Apps, Biometric Capture, or Blockchains*

---

## Abstract

We present IRLid, a browser-only protocol for producing cryptographically signed, mutually attested evidence that two devices — and the parties operating them — completed a fresh, mutual, in-person handshake. Two people meet, scan each other's QR codes, and each receives a tamper-evident receipt containing ECDSA P-256 signatures from both parties — the initiator's signed offer plus each party's signed response — over canonically serialised payloads that bind fresh nonces, timestamps, and optional self-reported GPS coordinates, and that cross-commit to the same HELLO and offer via binding hashes, preventing cross-session substitution. The protocol requires no application install, no server-side trust for verification, no biometric data collection, and no blockchain; all cryptography runs client-side via the Web Crypto API, and receipts are verifiable offline by any third party from the receipt bytes plus published protocol constants. A v5 extension repurposes WebAuthn as a general-purpose signing oracle — placing the payload hash in the assertion challenge field — so signing keys are held by platform authenticators: in hardware secure elements (Secure Enclave, Android TEE, Windows Hello TPM) for device-bound credentials, while cloud-syncable passkeys weaken custody to the protection of the platform's sync fabric (§5). Every accepted signature must carry the authenticator's user-verification flag, which the verifier checks and rejects if absent; the flag attests that a device unlock (biometric or passcode) occurred for the signing ceremony, not its recency. We state the trust model plainly: IRLid produces *evidence, not certainty*. GPS is asserted, not measured; the protocol records what cooperating parties chose to attest and offers no distance bounding against relay attacks. We describe a layered scoring model in which optional attestations (trust history, hardware-backed keys, planned multi-authority timestamping) raise confidence without ever gating the base protocol, and report three months of production deployment (April–July 2026), including a live organisational check-in portal, on unmodified consumer devices. **[CAPTAIN DECIDE: the draft originally claimed "fourteen months of design" here — no dated artefact supports a design-start date (earliest documented event is April 2026), so the claim was dropped per the safe fallback. If you can date the design start from your own records, reinstate as e.g. "over a year of design plus three months of production deployment".]**

---

## 1. Introduction

By 2026, the question "did this interaction actually happen between real people in a real place?" has moved from philosophical curiosity to practical necessity. Deepfake-mediated fraud is mainstream: synthetic video calls have been used to authorise fraudulent transfers — most prominently the February 2024 Hong Kong video-conference fraud against Arup, at approximately US$25M [ref] — synthetic voices have defeated telephone verification in reported cases [ref], and generated imagery undermines photographic evidence generally. The systems we built for a world where *seeing was believing* are failing quietly, and the industry response has coalesced around **proof of personhood** — establishing that a digital identity corresponds to exactly one live human.

The leading approaches make heavy commitments. World (formerly Worldcoin) anchors personhood in iris biometrics captured by dedicated Orb hardware, trading a global uniqueness claim for centralised biometric capture and bespoke devices. Encointer anchors it in synchronised physical *ceremonies* — pseudonym parties where participants attest each other simultaneously — trading hardware for scheduling and community coordination, with identities settled on a blockchain. Both target the question *"is this one unique human?"*

IRLid addresses a neighbouring, and we argue underserved, question: *"were these two parties together, here, at this time?"* — **proof of co-presence** rather than proof of personhood. We use "proof of co-presence" strictly as a category name, parallel to "proof of personhood"; what the protocol emits is evidence, not proof (§5). Many practical trust problems reduce to co-presence: proof of delivery for humanitarian logistics, attendance and safeguarding records, in-person onboarding, dispute resolution over whether a meeting occurred. For these, global uniqueness is unnecessary, and the costs of the personhood systems — biometric capture, dedicated hardware, blockchain settlement, mandatory apps — are disproportionate.

IRLid's design constraints are deliberately austere: **no app** (everything runs in a stock mobile browser), **no biometric collection** (the protocol never receives biometric data; at most it sees a signed user-verification flag, which attests device unlock via biometric or passcode without disclosing which), **no blockchain**, and **no server required for verification** (receipts verify entirely client-side from public data). The entire handshake travels over QR codes displayed and scanned between two phones.

We are equally deliberate about what IRLid does *not* claim. A receipt is **evidence, not certainty**. It is a tamper-evident, cryptographically signed record that two devices — and, under the hardware-backed v5 extension, a fresh user-verification gesture accompanying every signature — participated in a fresh mutual handshake, with location as an *asserted* claim rather than a measured one. It does not establish identity against a sceptical adversary, does not prevent coerced participation, and does not bound distance against real-time relay. We treat this honesty as a feature: the protocol's threat model is published, versioned, and maps every admitted gap to a roadmap item, on the view that a verifier who understands exactly what a receipt attests is better served than one comforted by overclaims.

**Contributions.** (1) A minimal browser-only co-presence handshake with order-independent canonical hashing and cross-commitment binding (§4). (2) A technique for repurposing WebAuthn as a general-purpose hardware-backed signing primitive, with the pitfalls we encountered documented (§4.4). (3) A layered, additive scoring model in which enhancements never invalidate the base protocol (§4.5). (4) A published adversarial threat model with admitted gaps (§5). (5) Deployment experience from a live production system verified on unmodified consumer hardware (§6).

---

## 2. Related Work

**Proof of personhood.** Borge et al. introduced proof-of-personhood parties, issuing anonymous credentials to physically present participants as a Sybil defence [ref]. World/World ID pursues uniqueness via iris biometrics and custom Orb hardware [ref]; Encointer via periodic synchronised pseudonym ceremonies settled on-chain [ref]; BrightID and Idena via social-graph and simultaneous-Turing-test mechanisms respectively [refs]. IRLid is complementary rather than competitive: it attests a *pairwise event* (a meeting) rather than a *global property* (uniqueness), and consequently avoids biometric capture, special hardware, and consensus infrastructure. A personhood credential could, in future, strengthen an IRLid trust graph; the protocols compose rather than compete.

**Co-presence detection and relay resistance.** A substantial literature uses ambient context — radio environment (Amigo, Varshavsky et al.), audio, luminosity, and multi-sensor fusion (Truong et al.; Halevi et al.) — to detect co-presence and resist relay in zero-interaction authentication [refs]. Distance bounding (Brands and Chaum, and successors) provides cryptographic proximity guarantees but requires timing precision unavailable to browser JavaScript [refs]. IRLid presently sits below this literature on relay resistance — it performs no ambient sensing or distance bounding, a gap we state explicitly in §5 — and differs on *artefact quality*: prior systems emit an ephemeral authentication decision, whereas IRLid emits a durable, independently verifiable, dual-signed receipt.

**WebAuthn and passkeys.** The W3C WebAuthn standard and the FIDO2/passkey ecosystem give web pages access to hardware-backed, non-extractable credentials designed for challenge–response *authentication* [refs]. IRLid repurposes the assertion ceremony as a *signing oracle* over arbitrary payload hashes (§4.4), an application-layer pattern related to proposals for WebAuthn-based transaction signing, deployed here in production since May 2026. We document the practical footguns (DER encoding, unreliable signature counters, `clientDataJSON` ordering, silent user-verification downgrades) that any implementer of this pattern will meet.

---

## 3. Design Goals

- **G1 — Zero install:** stock browser, static pages; the handshake must survive being handed to a stranger.
- **G2 — Verifier independence:** any third party can verify a receipt offline from the receipt bytes plus published protocol constants (e.g. the expected WebAuthn origin).
- **G3 — Data minimisation:** no biometric data is ever received; GPS is optional and redactable; identity documents are never stored server-side (a broker-not-store design, specified but not yet shipped — the server would retain only a hash and reference); the organisational surface stores operational metadata (names, roles, attendance) under conventional server trust.
- **G4 — Additive trust, never gated:** every enhancement above the base protocol is optional, off by default, and its failure reduces a *score*, never validity.
- **G5 — Honest labelling:** asserted values (GPS, timestamps) are labelled as asserted; the verifier UI reports "% Confirmed", not a binary verdict.

---

## 4. Protocol Design

### 4.1 Primitives

- **ECDSA P-256** (Web Crypto API) for all signatures; **SHA-256** for hashing and binding.
- **`canonical()`** — deterministic recursive JSON serialisation: object keys sorted at every nesting level before hashing, making digests independent of property insertion order and eliminating a class of cross-implementation mismatches (introduced in protocol v3, replacing `JSON.stringify`).
- **deflate-raw + base64url** for QR payload encoding.
- Consumer keypairs are **ephemeral** pre-v5: generated per session, never reused, asserting no long-term identity.

### 4.2 Handshake: HELLO → ACCEPT → COMBINED RECEIPT

Three objects, exchanged solely via QR:

1. **HELLO (Party A):** `{type:"hello", v, pub (P-256 JWK), ts, nonce (16 B), offer:{payload:{ts, nonce, lat?, lon?, acc?}, sig}}` where `sig` = ECDSA over `SHA-256(canonical(offer.payload))`. Encoded as `accept.html#HZ=<b64url(deflate-raw(JSON))>` and displayed as a QR (~505 characters).
2. **RESPONSE (Party B):** B scans A's QR, verifies the offer signature, rejects HELLOs timestamped more than 5 s in the future, generates its own keypair, and signs `payload = {ts, nonce, lat?, lon?, acc?, helloHash, offerHash}` — where `helloHash = SHA-256(canonical(hello))` and `offerHash = SHA-256(canonical(offer.payload))` **cross-commit the response to this specific HELLO and offer**, preventing cross-session substitution.
3. **COMBINED RECEIPT (Party A):** A scans B's response, verifies structure, hash, signature, and both binding hashes, constructs its own symmetric RESPONSE (signed with its HELLO keypair — the initiator reuses the HELLO keypair for its response), and assembles `{hello, a, b}`, shareable as `receipt.html#COMB_Z=<…>` (~764 characters).

**Compact encoding — recompute, don't transmit.** All recomputable fields (`offer.hash`, `a.hash`, `a.pub` — identical to `hello.pub`, since the initiator signs its response with the HELLO keypair — and `b.hash`) are stripped before encoding (~1.75× reduction); the verifier recomputes them, so verification strength is unchanged.

### 4.3 Verification and scoring

Verification runs eleven core checks — structural validity, hash recomputation, three signature verifications (both responses and the offer), and four binding-hash checks — plus two bonus checks: timestamps within **90 s** of each other and Haversine distance ≤ **12 m** (absent GPS scores zero, invalidates nothing). Output is a percentage score, not a verdict: the v3 base protocol yields 20/100; v4 — trust history (receipt depth, location diversity, device consistency) plus the optional device-unlock gate with `bioVerified` bound into the signed payload — reaches 50; v5 hardware-backed signing 70; planned time anchoring, hardware attestation, and zero-knowledge layers extend towards 100 (§7). Two properties are load-bearing: **old receipts remain valid at their original score forever**, and **no enhancement is ever prompted during a handshake or required to complete one** (G4).

### 4.4 Hardware-backed signing (v5): WebAuthn as a signing oracle

The strongest early public criticism of the protocol (raised on r/netsec) was that pre-v5 signing keys lived in `localStorage` — extractable with brief access to an unlocked device. v5 moves key custody into platform authenticators — hardware secure elements for device-bound credentials; cloud-syncable passkeys weaken custody to the protection of the platform's sync fabric (§5):

- **Technique:** WebAuthn is designed for server challenge–response; v5 places `SHA-256(canonical(payload))` into the assertion **challenge** field. The authenticator signs the standard envelope `authenticatorData ∥ SHA-256(clientDataJSON)`; because the payload hash sits inside `clientDataJSON.challenge`, the payload is transitively bound to a hardware-held ES256 key.
- **Verification:** parse `clientDataJSON`; require `type === "webauthn.get"`; check the origin against an allowlist of expected RP origins; byte-compare the decoded challenge to the recomputed payload hash; reconstruct the signed bytes; verify with the enrolled P-256 JWK. Any single failure rejects the envelope.
- **User verification:** every accepted signature must carry the authenticator's user-verification flag, which the verifier checks (`authData[32] & 0x04`) and rejects if absent — a necessary check because some authenticators silently downgrade `userVerification:"required"`. UV attests that a device unlock (biometric or passcode) occurred for the ceremony, not its recency. We are careful in all user-facing copy: UV means *biometric or passcode* — the platform does not disclose which — so receipts are described as **hardware-backed and device-unlock-gated**, never "biometrically signed".
- **Wire compatibility:** signatures are converted DER → raw 64-byte `r∥s` so v3/v4 verifiers need only envelope handling, not a new signature format; a v5-unaware verifier *rejects* v5 receipts rather than silently accepting them.
- **Enrolment:** ES256 only (`alg:-7`, no fallback); `attestation:"none"` — attestation is commonly anonymised or omitted by consumer platform authenticators (Apple's anonymous attestation; browser-mediated "none" defaults) [ref], and the receipt's value comes from the protocol, not the attestation chain; RP-ID binds credentials to the deployment origin.
- **Documented footguns:** DER decoding with zero-padding; signature counters unusable for replay protection (iCloud returns 0; some Android counters are non-monotonic — nonces and the 90 s window carry replay defence instead); `clientDataJSON` must be parsed, never reserialised and byte-compared.
- **Redaction incompatibility (admitted):** the v4 privacy mode replaces GPS with a hash of the original coordinates; since the original payload bytes are then gone, a redacted receipt cannot be re-verified through the v5 envelope path. The verifier reports this explicitly rather than passing or failing silently.

### 4.5 Session and organisational layers (summary)

The consumer handshake is reused, unchanged, as the primitive for higher layers: QR-scan sign-in binds a hardware credential fingerprint to a portal identity, with **opaque 32-byte server-side session tokens** (deliberately not JWTs — every authorisation decision is a revocable database row); per-action WebAuthn envelopes carry **context-type discriminators** (`irlid_login_v5`, `irlid_invite_v5`, …) so a signature from one context cannot be replayed in any context whose verifier checks the discriminator (all current server paths do); and **signature is separated from authority** — the envelope proves *which enrolled credential* signed (for device-bound credentials, effectively which device; non-repudiation), the session resolves *whose role authorised*, and audit rows record both. An organisational check-in bridge mints a consumer-format receipt, signed by the venue's own P-256 key, for every check-in — attendee and venue each sign their half, mirroring the P2P dual-signature model — so an attendance row and an independently verifiable receipt are two views of one signed event.

---

## 5. Threat Model and Honest Limitations

IRLid maintains a public, versioned threat-model document written from an adversarial stance — "assume the attacker has read every line of the specification" — with each attack mapped to current defences, admitted gaps, and roadmap closers. We summarise it here, preserving the admissions.

**Trust model.** IRLid operates a **cooperative trust model**. A receipt is a tamper-evident record that both parties *chose to attest* a meeting; it is not proof of presence against a sceptical third party who assumes both parties are dishonest. Two colluding parties who genuinely share a location can mint a receipt for a meeting that was social fiction; the protocol attests device co-presence and mutual intent to sign, not the meaning of the meeting. In particular, a receipt does not establish that two distinct humans participated: a single operator holding two enrolled devices can complete the handshake alone. Co-presence is a property of devices and unlock gestures, not persons; personhood and Sybil resistance are explicitly out of scope (a personhood credential could compose with IRLid, §2). This is stated as a boundary, not discovered as a flaw.

**Location is asserted, not measured.** GPS coordinates are self-reported by the browser. The 12-metre Haversine check catches honest error and casual inconsistency; it does not resist mock-location tooling. In the threat model's own words: *"GPS spoofing is easy."* The roadmap answer is layered independent anchoring — multi-authority timestamps, and eventually hardware-measured geometry (§7) — each raising the bar rather than claiming to close it. Verifier copy labels location as asserted throughout, including on org-attested receipts where a venue address is embedded in the signed payload with explicit "asserted-not-measured" labelling.

**Time is asserted too.** Timestamps are likewise asserted — browser-reported wall-clock time, checked only for 90 s mutual consistency between the two parties — until external multi-authority anchoring (§7) provides independent witness.

**Relay and distance bounding (admitted omission).** The protocol performs no distance bounding and no ambient-context comparison. Nothing in the current design resists a deliberate real-time relay of QR frames between two distant devices — mafia-fraud style; a screen-shared QR relays trivially, and the 90 s freshness window and short QR display lifetimes merely raise attacker effort marginally. This is the protocol's largest admitted gap relative to the co-presence-detection literature, which addresses exactly this problem.

**Replay.** Nonces, timestamps, and cross-commitment hashes bound every object to one handshake; a published receipt is content-addressed to *that pair, that time, that place* and does not transfer. Within the 90 s window a captured HELLO could in principle be re-shown to a colluding responder — an admitted residual closed only by external time witnessing (§7). Cross-context replay at the session layer is closed by type discriminators. Login QR codes encode a single-use nonce and the worker endpoint URL (validated against a client-side allowlist) — no signing material — so photographing one yields no reusable secret; within its TTL an attacker who races the claim signs the waiting screen into their own account rather than the victim's — a session-confusion nuisance, not a credential theft, and rate-limited.

**Key custody.** Pre-v5, key extraction from `localStorage` was described in the threat model's own words as the protocol's *"strongest honest criticism"* — publicly raised by an external reviewer and credited as such. v5 reduces it to compromise of the platform authenticator or of the passkey sync fabric / platform account; the latter is *"a real residual risk"* — mitigated, not eliminated, by the fresh UV requirement on the new device, and closable by mandating device-bound credentials at the cost of loss recovery.

**Coercion.** *"The protocol cannot prevent physical coercion. It records what happened."* A forced scan produces an accurate record of an event that did occur under duress; this is the limit of any co-presence protocol, and IRLid's contribution is confined to non-repudiable timing evidence for post-hoc investigation. A duress-signal design (a specific unlock gesture flipping a covert flag) is noted as an uncommitted idea.

**Sybil and correlation.** Trust-history scoring penalises same-device, same-location patterns, but *"a patient Sybil who travels and waits could in principle build diverse history"* — the substantive defence is deferred to a vouching graph. Stable per-device key fingerprints permit cross-organisation correlation by colluding log-holders; the planned mitigation is per-organisation derived keys. Deterministic privacy-mode GPS hashes admit rainbow-table recovery by a motivated collector; the planned closer is zero-knowledge coordinate hiding.

**Audit trail as defence.** Denied attempts are recorded, not discarded: a rejected door entry writes a signed, timestamped `rejected` row. The database is append-only by policy: no migration retroactively rewrites verification outcomes, and rejected rows are retained — the design maxim is *"honest scars beat tidy lies"*. This is an operator commitment, not a cryptographic guarantee; its teeth come from receipts exported to participants (each an independent witness) and, on the roadmap, external time anchoring (§7). Until then a malicious operator can rewrite un-exported server-side history.

**Methodological note.** The threat model records its own then-current weaknesses candidly, including a frontend-only role gate described at drafting time, in the threat model's own words, as *"currently exploitable"* and *"acceptable for prototype demo, not for production"* (since closed by server-side enforcement and per-action signing). The document invites attack: a reader who defeats all listed defences via an uncaptured path *"is exactly the contribution we want."*

---

## 6. Deployment Experience

IRLid is not a proposal; it has run in production since April 2026 at `irlid.co.uk` (with minutes-scale deploy incidents, per the public commit history).

- **Architecture:** static HTML/vanilla-JS frontend on GitHub Pages; two Cloudflare Workers (consumer verification; organisational portal) each with a Cloudflare D1 (SQLite) database — per surface, one Worker, one database, static pages. No human-facing passwords anywhere in the system: humans authenticate via QR + WebAuthn hardware credentials; a long-lived bearer API key (a password-equivalent secret, org-scoped) survives for machine-to-machine use. A PWA service-worker shell, an IndexedDB write queue, and cached organisation snapshots make the core flows offline-capable — natural, since all receipt cryptography was client-side from the start.
- **Ship cadence:** v4 (trust history; an optional device-unlock gate whose `bioVerified` flag is committed *inside* the signed payload — `bioVerified` is a historical field name: semantically it records WebAuthn user verification, biometric or passcode (§4.4), and the name is slated for correction in a future protocol revision; GPS redaction) April 2026; v5 hardware-backed signing deployed 2 May 2026; organisational portal 10 May 2026; org receipt bridge live 1 June 2026; current build v6.4.x (July 2026).
- **Real-device verification:** the v5 path was verified via a six-step diagnostic (availability → enrol → sign → verify → round-trip → unenrol) on three browser × OS combinations — Edge and Chrome with Windows Hello on Windows 11, and Chrome with Android biometric unlock on a Pixel 8 Pro — with a real two-party in-person receipt verifying at full score the following day. Firefox on Windows was excluded over a browser-side WebAuthn UX issue, not a protocol failure. Subsequent portal testing spanned Pixel 8 Pro, Pixel 4a, Samsung A20e, a Nokia handset, a Huawei tablet, and a Windows 11 desktop — all unmodified consumer hardware, operated by a single developer without a laptop.
- **Field findings worth reporting:**
  - *QR physical-layer limits are a real constraint.* A ~1,560-character staff-invite QR defeated a mid-range phone camera; USB webcams failed on dense codes regardless of software. The redesign — QR carries a 43-character nonce; the server serves the exact signed envelope by reference while the invite is pending — preserved byte-for-byte signature binding, scanned first try, and *improved* security (the envelope is no longer permanently recoverable from a photograph). Separately, the org API key was identified in-house as wrongly present in venue QR codes, removed, and the production key rotated.
  - *Offline queues must respect signature freshness.* Queuing WebAuthn-signed actions while offline guarantees a replay failure later; an early implementation dropped these silently as "synced". The fix excludes non-replayable signed actions from queue eligibility and fails loudly at click time.
  - *Overclaim audits matter.* On confirming that WebAuthn's UV flag cannot distinguish biometric from passcode, all "biometrically signed" copy was reworded to "hardware-backed / device-unlock (biometric or passcode)", and "tamper-proof" to "tamper-evident", across the deployed site including receipt verification rows.
  - *Graceful fallbacks can hide faults:* an org with an unprovisioned venue keypair minted no receipts, silently, until a self-healing key-generation path was added. *Asymmetric trust accrual* (only the handshake initiator accumulates history) was discovered in field testing and queued as protocol work.
- **Development methodology:** the system is built and documented by a sole human author working with AI assistants for implementation, review, and documentation drafting; the threat-model document is explicitly AI-drafted under human direction and maintained as a living artefact. We surface this for transparency and as a data point on solo-developer security engineering in 2026.

---

## 7. Roadmap

Every planned layer is additive and optional, raising a receipt's score without gating validity (G4):

- **Multi-authority time anchoring.** The timestamp is the receipt's weakest claim — browser-self-reported. RFC 3161 TSA tokens over the canonical receipt hash upgrade "the device says" to "an external authority witnessed this hash at this time"; requiring N ≥ 2 independent national authorities (e.g. NIST, NPL, USNO) makes back-dating a receipt earlier than its anchors require multi-authority, multi-jurisdiction compromise — the asserted creation instant itself remains bounded rather than proven, within the [signing, anchoring] interval below — with a daily Merkle anchor via OpenTimestamps as a public backstop (scheduled as a later phase in the specification's detailed phasing). Token failure reduces score, never validity. This also bounds the offline-timestamp problem: a receipt signed offline at T₀ and anchored at reconnection T₁ carries a verifiable bound T₀ ≤ creation ≤ T₁.
- **Hardware-measured location (drone/mothership tier).** For humanitarian proof-of-delivery, the schema already defines optional `orient` (quaternion pose) and `anchors[]` attestations — LiDAR depth-geometry hashes (a point cloud is a time-of-flight *measurement*, not an asserted coordinate: a printed photograph of a landing marker is flat in a depth map — raising the bar from image spoofing to physical scene reconstruction, not eliminating spoofing), star-tracker pattern hashes, and pulsar-timing offsets — each independently checkable against public reference data. Exotic sensing is assumed only on attested vehicle hardware that browser clients defer to, never on phones; phone-tier orientation sensors are explicitly declared as spoofable as the clock. Frame fields (`tframe`, `pframe`) are defined and default-resolved today, at zero cost, so future coordinate frames never require a migration.
- **Zero-knowledge receipts.** Proving "we were within 12 m of each other" without revealing any locator closes the privacy-mode hash-correlation gap; Haversine inside ZK circuits and non-native-field ECDSA make this genuinely hard, and it is staged (coordinate hiding → Schnorr → full ZK) rather than promised. Post-quantum signature migration sits at the far end of the roadmap ladder — a research-frontier item, not a near-term commitment.

---

## 8. Conclusion

IRLid demonstrates that useful, verifiable evidence of physical co-presence can be produced by nothing more than two stock browsers, commodity secure elements, and QR codes — no app, no biometric capture, no blockchain, no verification server. Its central design commitments are a graded and honest epistemology (a score, with asserted values labelled as asserted), strict additivity (enhancements raise confidence and never invalidate the base), and a published adversarial threat model whose admitted gaps — asserted GPS, absent distance bounding, cooperative-trust scope, coercion — are treated as reviewable engineering constraints rather than marketing hazards. Three months of production deployment on consumer hardware suggest the approach is practical today at the trust level it honestly claims: tamper-evident evidence that a mutual, signed handshake occurred at an asserted time and place — and a protocol structure ready to make that evidence progressively harder to fake. We invite adversarial review; a working attack that defeats the listed defences is exactly the contribution we want.

---

## References *(to be completed for submission)*

- M. Borge et al., "Proof-of-Personhood: Redemocratizing Permissionless Cryptocurrencies," IEEE EuroS&PW, 2017.
- Worldcoin Foundation, "World ID: Proof of Human" (whitepaper), 2023–2025.
- A. Brenzikofer et al., "Encointer: Local Community Cryptocurrencies with Universal Basic Income" / pseudonym ceremony documentation.
- S. Brands and D. Chaum, "Distance-Bounding Protocols," EUROCRYPT, 1993.
- A. Varshavsky et al., "Amigo: Proximity-Based Authentication of Mobile Devices," UbiComp, 2007.
- H. T. T. Truong et al., "Comparing and Fusing Different Sensor Modalities for Relay Attack Resistance in Zero-Interaction Authentication," IEEE PerCom, 2014.
- T. Halevi et al., "Secure Proximity Detection for NFC Devices Based on Ambient Sensor Data," ESORICS, 2012.
- W3C, "Web Authentication: An API for Accessing Public Key Credentials," Level 2/3.
- FIDO Alliance, passkey specifications and platform authenticator documentation.
- IETF RFC 3161, "Time-Stamp Protocol (TSP)."
- [ref to select] Press/regulatory reporting on the February 2024 Hong Kong deepfake video-conference fraud against Arup (~US$25M) — supports §1 motivating claim.
- [ref to select] Europol Innovation Lab / NIST reporting on voice-cloning and synthetic-voice fraud against telephone verification — supports §1 motivating claim.
- [ref to select] Apple anonymous attestation documentation and WebAuthn attestation-conveyance ("none") platform defaults — supports §4.4 enrolment claim.
- IRLid protocol specification (`PROTOCOL.md`), threat model (`THREAT-MODEL.md`), and reference implementation, https://github.com/BunHead/IRLid, 2026.
