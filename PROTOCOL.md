# IRLid Protocol Specification

**Status:** Live  
**Version:** 3  
**Author:** Spencer Austin  
**Last updated:** April 2026

---

## Version History

| Version | Changes |
|---------|---------|
| v1 | Initial protocol — basic ECDSA signing, JSON.stringify hashing |
| v2 | Added GPS, nonce, helloHash/offerHash binding; offer.hash transmitted |
| v3 | `canonical()` replaces `JSON.stringify()` for all hashing; `offer.hash`, `a.hash`, `b.hash` no longer transmitted in compact receipts — verifier recomputes all; compact JWK public keys |
| v4 | Trust history (depth, location diversity, device consistency); optional WebAuthn bio-metric gate (`bioVerified` cryptographically bound into signed payload); redacted-receipt mode (`gps_hash` replaces lat/lon/acc); hotspot novelty scoring. Shipped 17 April 2026. All optional, off by default. |
| v5 | Hardware-backed signing keys via WebAuthn / Passkeys — private key lives in Secure Enclave (Apple) / TEE (Android) / TPM (Windows Hello), never extractable. v5 receipts carry a `webauthn` envelope (`authData`, `clientData`) alongside the existing ECDSA `sig` field. Closes localStorage extraction (THREAT-MODEL.md §III.2). Score 70/100 when v5 verifies. Specification in §13. In-implementation, default OFF. |

---

## 1. Overview

IRLid is a browser-only proof-of-co-presence protocol that enables two parties to mutually attest physical co-location without any server infrastructure. All messages are exchanged directly (via QR codes); all cryptography and verification run client-side using the Web Crypto API.

The protocol produces three objects:
- `HELLO` — Party A's signed offer
- `RESPONSE` — Each party's signed acknowledgement  
- `COMBINED RECEIPT` — The merged proof, verifiable by either party or a third party

Receipts can also be verified by embedding the IRLid widget in any web page — see `WIDGET.md`.

---

## 2. Cryptographic Primitives

| Primitive | Usage |
|-----------|-------|
| ECDSA P-256 | Signing payloads and verifying signatures |
| SHA-256 | Hashing payloads and computing binding hashes |
| `canonical()` | Deterministic recursive JSON serialisation — sorts object keys at every level before hashing, making all hashes independent of property insertion order |
| deflate-raw | Compressing objects for QR encoding |
| base64url | Encoding binary data in URL-safe strings |
| Web Crypto API | Browser-native implementation (no external library) |

All keypairs are ephemeral — generated fresh each session, never reused.

---

## 3. Object Schemas

### 3.1 HELLO

```json
{
  "type": "hello",
  "v": 3,
  "pub": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." },
  "ts": 1710000000000,
  "nonce": "base64url-16bytes",
  "offer": {
    "payload": { "ts": 1710000000000, "nonce": "...", "lat": 51.9, "lon": -1.4, "acc": 12 },
    "sig": "base64url-ECDSA-sig"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Fixed: `"hello"` |
| `v` | number | Protocol version (`3`) |
| `pub` | object | Ephemeral ECDSA P-256 public key (compact JWK: kty, crv, x, y) |
| `ts` | number | Unix timestamp in milliseconds |
| `nonce` | string | 16-byte random value, base64url encoded |
| `offer.payload` | object | `{ts, nonce, lat?, lon?, acc?}` — signed offer data including GPS |
| `offer.sig` | string | ECDSA signature over `SHA-256(canonical(offer.payload))` |
| ~~`offer.hash`~~ | ~~removed v3~~ | Previously stored the offer hash; verifier now recomputes from `offer.payload` |

### 3.2 RESPONSE

```json
{
  "type": "response",
  "v": 3,
  "payload": {
    "ts": 1710000000100,
    "nonce": "...",
    "lat": 51.9,
    "lon": -1.4,
    "acc": 15,
    "helloHash": "base64url-SHA256-of-HELLO",
    "offerHash": "base64url-SHA256-of-offer-payload"
  },
  "sig": "base64url-ECDSA-sig",
  "pub": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." },
  "hash": "base64url-SHA256-of-payload"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Fixed: `"response"` |
| `v` | number | Protocol version (`3`) |
| `payload.ts` | number | Timestamp (ms epoch) |
| `payload.nonce` | string | Random nonce |
| `payload.lat/lon/acc` | number? | GPS coordinates and accuracy (optional) |
| `payload.helloHash` | string | `SHA-256(canonical(helloObj))` — binds to the HELLO |
| `payload.offerHash` | string | `SHA-256(canonical(offer.payload))` — binds to the offer |
| `sig` | string | ECDSA signature over `SHA-256(canonical(payload))` |
| `pub` | object | Ephemeral public key (compact JWK) |
| `hash` | string | `SHA-256(canonical(payload))` as base64url |

### 3.3 COMBINED RECEIPT

```json
{
  "hello": { "...": "HELLO object" },
  "a":     { "...": "Response from Party A (initiator)" },
  "b":     { "...": "Response from Party B (acceptor)" }
}
```

---

## 4. Protocol Flow

### Step 1 — HELLO Generation (Party A)
1. Generate ephemeral ECDSA P-256 keypair
2. Construct `offer.payload = { ts, nonce, lat?, lon?, acc? }`
3. Compute `offerHash = SHA-256(canonical(offer.payload))` (used for signing only; **not transmitted** in v3)
4. Sign: `offer.sig = ECDSA.sign(privateKey, offerHash)`
5. Assemble HELLO object with `type`, `v: 3`, `pub`, `ts`, `nonce`, `offer`
6. Compress + encode: `accept.html#HZ=<base64url(deflate-raw(JSON.stringify(hello)))>`
7. Display as QR code

### Step 2 — ACCEPT (Party B)
1. Scan HELLO QR → decompress → parse HELLO object
2. Recompute: `offerHash = SHA-256(canonical(offer.payload))` (v3: not stored in HELLO)
3. Verify: `ECDSA.verify(hello.pub, offerHash, offer.sig)` ✓
4. Verify: `hello.ts` is not more than 5 seconds in the future ✓
5. Generate own ephemeral keypair
6. Compute `helloHash = SHA-256(canonical(helloObj))`
7. Construct `response.payload = { ts, nonce, lat?, lon?, acc?, helloHash, offerHash }`
8. Sign and hash payload using `canonical()`; assemble RESPONSE object
9. Display as QR code

### Step 3 — COMBINED RECEIPT (Party A)
1. Scan Party B's response QR
2. Verify B's response: structure, hash, signature, helloHash, offerHash
3. Construct own RESPONSE (same structure, own keypair)
4. Assemble: `{ hello, a: ownResponse, b: scannedResponse }`
5. Apply compact encoding (strip redundant fields)
6. Compress and encode as `receipt.html#COMB_Z=<value>`
7. Navigate to receipt — both parties can now share or verify this URL

---

## 5. Verification Checks

### Scoring Model

The score is displayed as **% Confirmed** and is designed to equal a percentage directly (max = 100).

**Current v3 base score: 20 / 100**

The full 100-point system grows as optional enhancements are enabled:

| Layer | What's added | Score |
|-------|-------------|-------|
| v3 base | Core cryptographic checks | 20 / 100 |
| v4 Trust (**LIVE**) | Receipt depth, location hotspot novelty, device consistency, optional WebAuthn bio-metric gate | 50 / 100 |
| v5 Enhanced security | Secure Enclave key migration, mutual face capture — all optional, off by default | 70 / 100 |
| v6 Network | Transitive trust graph, community vouching, Sybil resistance | 65 / 100 |
| v6 Blockchain | On-chain anchor, W3C Verifiable Credentials | 80 / 100 |
| v6 IoT/Drones | Hardware attestation, delivery confirmation | 90 / 100 |
| v7 ZK | Zero-knowledge proof of presence | 100 / 100 |

**v4 scope (shipped April 2026):** Trust history scoring (receipt depth, location hotspot novelty, device consistency) + optional WebAuthn bio-metric gate (Face ID / fingerprint committed into signed payload) + privacy mode (redacted GPS receipt). Secure Enclave key migration and face capture deferred to v5.

All enhancements above v3 base are **optional and off by default**. A standard receipt scoring 20/100 is cryptographically valid and suitable for all everyday use. Higher scores are for extraordinary verification contexts.

### Core Checks — v3 base (20 pts)

| # | Check | Points | Passes when | Fails when |
|---|-------|--------|-------------|------------|
| 1 | Self structure | 1 | `a` has `type`, `payload`, `sig`, `pub` | Any field missing |
| 2 | Self hash | 1 | `SHA-256(canonical(a.payload)) == a.hash` | Mismatch |
| 3 | Self signature | 4 | `ECDSA.verify(a.pub ∥ hello.pub, a.hash, a.sig)` | Invalid signature |
| 4 | Guest structure | 1 | `b` has required fields | Any field missing |
| 5 | Guest hash | 1 | `SHA-256(canonical(b.payload)) == b.hash` | Mismatch |
| 6 | Guest signature | 4 | `ECDSA.verify(b.pub, b.hash, b.sig)` | Invalid signature |
| 7 | HELLO offer | 4 | `ECDSA.verify(hello.pub, offerHash, offer.sig)` | Invalid |
| 8 | Self binds HELLO | 1 | `a.payload.helloHash == SHA-256(canonical(hello))` | Mismatch |
| 9 | Guest binds HELLO | 1 | `b.payload.helloHash == SHA-256(canonical(hello))` | Mismatch |
| 10 | Self binds offer | 1 | `a.payload.offerHash == recomputed offer hash` | Mismatch |
| 11 | Guest binds offer | 1 | `b.payload.offerHash == recomputed offer hash` | Mismatch |

### Bonus Checks (conditional, included in base 20)

| Check | Points | Passes when | Notes |
|-------|--------|-------------|-------|
| Time ≤ tolerance | 1 | `\|a.payload.ts − b.payload.ts\| ≤ 90,000 ms` | Missing timestamps = 0 |
| Distance ≤ tolerance | 1 | Haversine distance ≤ 12 m | Missing GPS = 0 |

---

## 6. Compact Encoding

Receipts are stripped of recomputable fields before QR encoding to reduce size (~1.75× compression):

**Fields stripped:**
- `hello.offer.hash` — recomputable from `hello.offer.payload`
- `a.hash` — recomputable from `a.payload`
- `a.pub` — recoverable from `hello.pub` (Party A reuses HELLO keypair)
- `b.hash` — recomputable from `b.payload`

**Primary format (compressed):**
```
receipt.html#COMB_Z=<base64url(deflate-raw(JSON.stringify(stripped)))>
```

**Fallback format (uncompressed):**
```
receipt.html#COMB=<base64url(JSON.stringify(stripped))>
```

**HELLO QR format:**
```
accept.html#HZ=<base64url(deflate-raw(JSON.stringify(hello)))>
```

Typical URL lengths: HELLO ~505 chars, Receipt ~764 chars (COMB_Z) vs ~1,285 chars (COMB).

---

## 7. Backward Compatibility

v2 receipts used `JSON.stringify()` for hashing. The verifier detects the protocol version from `a.v` / `b.v` / `hello.v` and selects the correct hashing path:

```
v >= 3  →  canonical(payload)
v < 3   →  JSON.stringify(payload)
```

Both paths are supported simultaneously. Old v2 receipts continue to verify correctly.

---

## 8. Security Notes

- **Ephemeral keys:** New ECDSA P-256 keypair generated each session. No long-term identity is asserted.
- **Key storage (current):** Device keys are stored in `localStorage`. This is accessible on a rooted device. Planned upgrade (v5): migrate to WebAuthn/Passkeys so keys are generated and held in the device Secure Enclave (Apple) or Trusted Execution Environment (Android) — hardware-backed, never extractable.
- **Bio-metric gate (v4, optional, off by default):** WebAuthn platform authenticator (Face ID / fingerprint) fires before signing. The result (`bioVerified: true`) is committed into the ECDSA-signed payload — cryptographically bound, not self-reported after the fact. Bio-metric data never leaves the device. Enabled once in Settings; does not require Secure Enclave key storage.
- **Privacy mode (v4):** `irlidMakeRedactedReceipt()` replaces GPS coordinates with `SHA-256(canonical({lat, lon, acc}))` before sharing. The receipt proves co-presence without exposing coordinates. A verifier with the original receipt can confirm the hash matches; a third party learns only that location was verified.
- **Face capture / mutual witness (v5, planned, optional):** At each scan step, the scanning camera optionally captures the other party's face alongside the QR code. The face image is hashed and the hash is included in the scanner's signed payload — meaning A's payload contains a hash of B's face (witnessed by A) and B's payload contains a hash of A's face (witnessed by B). Neither party photographs themselves. The photo stays on device; only the hash travels in the receipt. All face capture features are off by default and enabled individually in Settings — never prompted during a handshake, never required to complete a scan.
- **No server:** Fully peer-to-peer. No central authority can forge or revoke receipts.
- **Replay resistance:** Nonces and short QR expiry (seconds) prevent replaying captured QR codes.
- **GPS is optional and self-reported:** Location data is not independently verified. The distance check is a good-faith claim by both parties, not a cryptographic proof of physical proximity. A dishonest participant could supply false coordinates.
- **Cooperative trust model:** The protocol provides a tamper-evident record that both parties *chose to attest* to a meeting. It does not provide proof-of-presence to a sceptical third party who assumes one or both parties may be dishonest.
- **Stripped fields are recomputable:** Compact encoding does not weaken verification — all stripped values can be recalculated from remaining fields.
- **Hash binding:** Each response commits to both the HELLO hash and the offer hash, preventing cross-session substitution attacks.

---

## 9. Third-Party Integration

Receipts can be verified by any website using the embeddable IRLid widget. See `WIDGET.md` for the full integration guide and `postMessage` API reference.

Quick embed:

```html
<iframe src="https://irlid.co.uk/widget.html" width="100%" height="130" style="border:0"></iframe>
<script>
  window.addEventListener("message", function(event) {
    if (event.origin !== "https://irlid.co.uk") return;
    if (event.data?.type === "irlid-verified") {
      // Receipt verified — unlock your gate
    }
  });
</script>
```

---

## 10. Forward Considerations

The sections below are not implemented in the current protocol version. They document **design intent** so that future versions can be built incrementally without breaking changes. The principle: lay foundations now for the destination, rather than bolting things on later.

All fields described in §10 and §11 are **optional** and **additive**. Receipts that omit them remain fully valid. Verifiers default-resolve missing fields (e.g. absent `tframe` resolves to `"earth/utc"`).

### 10.1 Frame-Aware Time and Position

Today, `ts` is implicitly Earth UTC milliseconds and `lat`/`lon` are implicitly WGS84/GPS. As IRLid's deployment surface widens — humanitarian last-mile in GPS-denied territory, drone delivery, eventually off-Earth operation — these implicit assumptions need to become explicit.

**Schema additions (forward-defined, not yet emitted):**

```json
{
  "ts": 1710000000000,
  "tframe": "earth/utc",
  "lat": 51.9,
  "lon": -1.4,
  "pframe": "wgs84/gps"
}
```

| Field | Default (when absent) | Future values |
|-------|----------------------|---------------|
| `tframe` | `"earth/utc"` | `"earth/tai"`, `"luna/ltc"` (Coordinated Lunar Time, currently being defined by NASA), `"mars/mtc"` (Mars Coordinated Time), `"ssb/tcb"` (solar system barycentric) |
| `pframe` | `"wgs84/gps"` | `"luna/pcrf"` (Principal Axes Coordinate Reference Frame, lunar), `"mars2000"`, mission-local frames |

**Verifier behaviour:**
- If both parties' `tframe` agree, normal time-tolerance check applies
- If `tframe` differs, verification requires an explicit bridge — rejected as incompatible until inter-frame translation is defined
- Same for `pframe`

**Why now:** Adding the field today costs nothing; receipts ignore it. Adding the field after a million receipts have been signed without it is a coordinated migration. We pay zero to keep the door open.

### 10.2 Off-Earth Operation Roadmap

Phased path from the current Earth-bound protocol toward genuine cross-body operation:

| Phase | Anchor | Timekeeping | Position | Hardware required |
|-------|--------|-------------|----------|-------------------|
| Now (v3–v4) | Browser clock + GPS | Self-reported UTC | Self-reported WGS84 | Consumer phone |
| v5–v6 | Same, with `tframe`/`pframe` field present | Earth UTC explicit | WGS84 explicit | Consumer phone |
| v7 | Multi-witness TSA tokens (see §11) | Anchored to TAI via national time authorities | Cell/wifi triangulation fallback | Consumer phone |
| v8 | Hardware-attested time and position | Pulsar timing receiver (XNAV) — millisecond pulsars are stable everywhere in the solar system | Pulsar navigation — same source serves time AND position | Bespoke ground station / drone mothership / satellite payload |
| v9+ | VLBI quasar anchor for inter-frame bridging | Local body time (lunar/Mars/etc.) cross-validated against celestial reference | Body-local frame, translated via published ephemeris | Multi-body deployment |

**Note on pulsar/quasar feasibility:** NASA's NICER/SEXTANT mission demonstrated XNAV on the ISS in 2018. Millisecond pulsars (e.g., PSR B1937+21, PSR J0437-4715) provide timing stability comparable to atomic clocks. Quasars provide the most stable angular reference frame known (the ICRF). The hardware to receive and process these signals is research-grade today, plausibly consumer-grade by the 2030s. IRLid's protocol design must not assume this hardware is ever available *to phones* — it assumes it's available to the **mothership/drone tier** that browser-class clients defer to.

### 10.3 Six-Axis Spatial Coordinates (6DOF)

The current `lat`/`lon`/`acc` fields capture position only. They tell a verifier *where* two parties were, not *how they were oriented* relative to each other or the world. For some scenarios — drone delivery, AR co-presence, doorman flows, off-Earth operation — orientation is part of the proof.

**6DOF means:** position (`x`, `y`, `z` or `lat`, `lon`, `alt`) plus orientation (a quaternion `qx, qy, qz, qw`, equivalent to pitch/yaw/roll). Together they define a complete *pose* in space.

**Schema additions (forward-defined, not yet emitted):**

```json
{
  "pos": {
    "lat": 51.9, "lon": -1.4, "alt": 137.0,
    "frame": "wgs84/gps"
  },
  "orient": {
    "qx": 0.0, "qy": 0.0, "qz": 0.707, "qw": 0.707,
    "frame": "wgs84/gps"
  },
  "anchors": [
    { "type": "star-tracker", "hash": "sha256-of-observed-star-pattern", "catalog": "hipparcos-2007" },
    { "type": "pulsar-xnav",  "pulsar": "PSR-J0437-4715", "toa-offset-ns": 142 }
  ]
}
```

For off-Earth contexts, `pos` carries cartesian `x`/`y`/`z` instead of `lat`/`lon`/`alt`, with `frame` set to e.g. `luna/pcrf` or `mars2000`.

**The `anchors` array — celestial attestations.** This is where the design gets interesting:

| Anchor type | What it proves | Verifier method |
|-------------|----------------|-----------------|
| `star-tracker` | Device observed a specific star pattern at signing time | Look up Hipparcos/Tycho catalog; recompute expected pattern at claimed pose+time; compare hash |
| `pulsar-xnav` | Device received a pulsar signal with a specific timing-of-arrival offset | Cross-reference with IPTA published timing model for that pulsar |
| `vlbi-quasar` | Device's antenna observed a quasar with measured differential timing (multi-station) | Compare against ICRF reference frame data |
| `ephemeris-cross` | Device observed Sun/Moon/Earth positions consistent with claimed pose+time | Cross-reference NASA HORIZONS or JPL SPICE |

These anchors are **independently verifiable from public reference data** — no trust in the parties is required. If the receipt claims pose P at time T and includes a star-tracker hash, a verifier with the published star catalog can confirm: "Yes, that star pattern *was* visible from pose P at time T." This is qualitatively stronger than self-reported GPS, because there is nothing to spoof except the original observation, which requires the receiver hardware.

**Verifier behaviour:**

- `pos` and `orient` follow the same frame-compatibility rules as §10.1 — both parties must declare matching frames or provide an explicit bridge
- Position tolerance: 3D Euclidean distance for cartesian frames; Haversine + altitude for `wgs84/gps`
- Orientation tolerance: angle between quaternions, default 30° cone (parties facing each other within reason)
- Anchor verification: each anchor independently checked against public reference data; failure of any anchor does **not** invalidate the receipt — score reflects actual verification

**Phasing:**

| Phase | What | Score band | Hardware |
|-------|------|------------|----------|
| **v5.3** | `orient` field populated from `DeviceOrientationEvent`; orientation cone in verifier | richness, not security | Phone (already exposes API) |
| **v8.1** | `anchors` array with `star-tracker` type — hash of observed star pattern | 70→80/100 | Mothership / drone with optical sensor |
| **v8.2** | `anchors` with `pulsar-xnav` type — pulsar timing-offset signature | 80→90/100 | Hardware tier with radio / X-ray receiver |
| **v8.3** | Full hardware-attested 6DOF pose (combined star + pulsar + ephemeris) | 90+/100 | Mothership tier |
| **v9+** | Cross-body 6DOF — Mars2000, lunar PCRF, frame translation via published ephemeris | 95+/100 | Multi-body deployment |

**Honest limitation at the phone tier:** `DeviceOrientationEvent` is just as spoofable as `Date.now()`. Phone-tier 6DOF adds *use-case richness* (AR, doorman, drone-recipient pairing) but does **not** strengthen the threat model. Threat-model strengthening lives in the hardware tier.

---

## 11. Forward Considerations: Multi-Authority Time Anchoring

The current `ts` field is browser-self-reported — it is the weakest claim in the receipt structure. A motivated participant can trivially set their device clock to any value before signing. The 90-second tolerance window mitigates honest drift, not deliberate falsification.

This section defines the planned anchoring approach to elevate timestamps from "self-reported" to "third-party witnessed."

### 11.1 The TAI Hierarchy

```
Millisecond pulsar timing arrays  ──validation──▶  International Atomic Time (TAI)
                                                          │
                                                          │  weighted average of
                                                          │  ~400 atomic clocks at
                                                          │  ~80 institutions
                                                          ▼
                                                          UTC  =  TAI  −  leap seconds
                                                          │
                              ┌───────────────────────────┼───────────────────────────┐
                              ▼                           ▼                           ▼
                    NIST (USA)                  NPL (UK)                  USNO Master Clock
                    nist.gov TSA                npl.co.uk                  (USA)
                                                          │
                                                          ▼
                                          IRLid receipt (witnessed)
```

Anchoring against any one of these national time authorities is qualitatively stronger than self-reporting. Anchoring against multiple (multi-witness) is stronger still.

### 11.2 RFC 3161 Time Stamp Authority Tokens

RFC 3161 defines a standard for cryptographic timestamping. The flow:

1. Client computes `H = SHA-256(canonical(receipt))`
2. Client POSTs `H` to a TSA endpoint
3. TSA returns a signed token: `{ts, hash, sig, certChain}` proving "this hash existed at time `ts`, witnessed by this TSA"
4. Client embeds the token in the receipt

Free public TSAs include:
- FreeTSA (`freetsa.org`)
- DigiCert (commercial)
- NIST, NPL, USNO (national, free for non-commercial use)

Verification is offline once the TSA's certificate chain is cached.

### 11.3 Schema (forward-defined, not yet emitted)

```json
{
  "ts": 1710000000000,
  "tframe": "earth/utc",
  "tsTokens": [
    { "issuer": "nist", "token": "base64url-RFC3161-token" },
    { "issuer": "npl",  "token": "base64url-RFC3161-token" },
    { "issuer": "usno", "token": "base64url-RFC3161-token" }
  ]
}
```

The `tsTokens` array is order-independent. Each token must independently verify against its issuer's published certificate chain. The receipt's claimed `ts` must fall within the window vouched for by the witnesses (typically ±1 second).

### 11.4 Phased Rollout

| Phase | What | Score band | Notes |
|-------|------|------------|-------|
| **v6a** | Optional single TSA token (FreeTSA) | 50→55/100 | Proof of concept; one weekend of work |
| **v6b** | Multi-witness — N≥2 of {NIST, NPL, USNO} | 55→62/100 | State-level adversary now needed |
| **v7a** | "IRLid Time Authority" — Cloudflare-hosted aggregator that itself anchors to USNO + NIST + NPL and signs a unified token; reduces client-side TSA round-trips to one | 62→70/100 | Improves UX; requires our own signed pubkey infrastructure |
| **v7b** | Daily Merkle anchor of all receipts to Bitcoin via OpenTimestamps | 70→75/100 | Provides upper-bound timestamp proof for archival; complements TSA tokens |
| **v8** | Mothership/drone with onboard pulsar receiver — hardware-attested time, no Earth-network dependency | 90+/100 | See §10.2 |

### 11.5 Verifier Behaviour

For each token in `tsTokens`:

1. Look up the issuer's certificate chain (cached locally, refreshed periodically)
2. Verify the token's signature against the chain
3. Confirm the token's signed time is within ±1 second of the receipt's claimed `ts`
4. Confirm the token's signed hash matches `SHA-256(canonical(receipt-with-tsTokens-removed))`

If at least one token verifies, the timestamp is "witnessed." Score boost scales with the number of independent witnesses up to a defined cap.

If a token fails verification — issuer unreachable, certificate revoked, hash mismatch — the receipt is **not invalidated**. The score simply reflects the actual verification result. This preserves the design principle: enhancements never gate the base protocol.

### 11.6 Threat Model Improvement

| Attack | v3–v4 (today) | v6b multi-witness |
|--------|---------------|-------------------|
| Lone participant lies about time | Trivial — set device clock | Requires forging valid TSA tokens, infeasible without compromising authority private keys |
| Coordinated participant pair lies about time | Trivial — both set device clocks | Same as above |
| State-level adversary forges time | Possible via compromised CA | Requires compromising N national time authorities simultaneously |
| Replay attack within tolerance window | Possible (90s) | Possible but bounded; mitigated by nonces |

The protocol does not claim absolute time-correctness against a state actor with multi-jurisdiction reach. It does claim absolute time-correctness against any party not at that level.

---

## 12. Master Roadmap

This section is the **single source of truth** for IRLid's versioned development plan. Individual feature phasing in §10 and §11 is summarised here. When the per-feature tables and this master table disagree, **this table wins** and the others are updated.

### 12.1 The Layered Anchoring Model

Every IRLid receipt is a stack of optional, additive **attestations**. The base ECDSA signature is what matters cryptographically. Everything above is *external anchoring* — increasingly independent witnesses that "yes, this happened, here's how I can prove it without trusting the parties." Each version adds one more layer.

```
                   ┌─────────────────────────────────────────┐
v10+               │  Quantum-resistant + full ZK presence   │  100/100
                   ├─────────────────────────────────────────┤
v9                 │  Multi-body translation (Mars/Moon)     │   95/100
                   ├─────────────────────────────────────────┤
v8                 │  Hardware-attested 6DOF (star + pulsar) │   90/100
                   ├─────────────────────────────────────────┤
v7                 │  Authority infra + ZK + frame tooling   │   75/100
                   ├─────────────────────────────────────────┤
v6                 │  Multi-witness TSA + OpenTimestamps     │   62/100
                   ├─────────────────────────────────────────┤
v5                 │  Hardware-backed keys + names + frames  │   50/100
                   ├─────────────────────────────────────────┤
v4 (LIVE)          │  Trust history + biometric + privacy    │   50/100
                   ├─────────────────────────────────────────┤
v3 (BASE)          │  ECDSA + canonical hash + GPS + window  │   20/100
                   └─────────────────────────────────────────┘
```

Older receipts always remain valid; they sit at their original score. New layers add — they never invalidate.

### 12.2 Versioned Roadmap

Target dates from 26 April 2026, assuming sustained solo+AI development pace (~4–6 weeks per major version, ~1–2 weeks per minor). Hardware- and infrastructure-dependent versions (v8+) are gated on external partners and are best-estimates only.

#### v5 — Identity hardening (May–Jul 2026)

| Sub | Scope | Target | Effort | Section |
|-----|-------|--------|--------|---------|
| v5.0 | Secure Enclave / Passkeys via WebAuthn (closes localStorage criticism) | Late May 2026 | 2 weeks | §8 |
| v5.1 | Imbue pilot — name registration + persistent device-key recognition | Mid Jun 2026 | 2 weeks | (org portal) |
| v5.2 | Schema fields added: `tframe`, `pframe`, `orient`, `tsTokens` (forward-defined, default-resolved) | Late Jun 2026 | 3 days | §10, §11 |
| v5.3 | `DeviceOrientationEvent` populates `orient`; tolerance cone in verifier | Mid Jul 2026 | 1 week | §10.3 |

#### v6 — Time anchoring (Aug–Nov 2026)

| Sub | Scope | Target | Effort | Section |
|-----|-------|--------|--------|---------|
| v6.0 | Single RFC 3161 TSA token (FreeTSA) — proves the pattern | Aug 2026 | 1 week | §11 |
| v6.1 | Multi-witness TSA (NIST + NPL + USNO) — state-level threat model | Sept 2026 | 2 weeks | §11.4 |
| v6.2 | OpenTimestamps daily Bitcoin Merkle anchor | Oct 2026 | 1 week + automation | §11 |
| v6.3 | Hardening, formal threat model write-up, audit prep | Nov 2026 | 2 weeks | §8 |

#### v7 — Authority infrastructure (Dec 2026–Jul 2027)

| Sub | Scope | Target | Effort | Section |
|-----|-------|--------|--------|---------|
| v7.0 | IRLid Time Authority (Cloudflare aggregator with own TSA cert) | Jan 2027 | 4 weeks | §11.4 |
| v7.1 | ZK coordinate hiding (Pedersen commitments over GPS) | Mar 2027 | 6 weeks | §8 |
| v7.2 | Frame-translation verifier libraries (WGS84 ↔ lunar PCRF ↔ Mars2000) | Jun 2027 | 4 weeks | §10.1 |
| v7.3 | Independent security audit (paid external) | Jul 2027 | 4 weeks | — |

#### v8 — Hardware tier (2028)

*Gated on Wisdom (ASE Tech) drone hardware progress and partnership formalisation.*

| Sub | Scope | Target | Effort | Section |
|-----|-------|--------|--------|---------|
| v8.0 | Mothership/drone integration spec — schema for hardware-attested receipts | Q1 2028 | 6 weeks (joint) | §10.2, §10.3 |
| v8.1 | Star-tracker observation hash field + verifier (Hipparcos/Tycho catalog) | Q2 2028 | 8 weeks | §10.3 |
| v8.2 | Pulsar XNAV signature field + verifier (IPTA timing models) | Q3 2028 | 8 weeks | §10.3 |
| v8.3 | Full hardware-attested 6DOF pose attestation | Q4 2028 | 8.1 + 8.2 merge | §10.3 |

#### v9 — Multi-body operation (2029–2030)

*Gated on actual lunar/Mars surface infrastructure existing.*

| Sub | Scope | Target | Effort | Section |
|-----|-------|--------|--------|---------|
| v9.0 | Lunar receipts (LTC time, lunar PCRF) — first cross-body deployment | 2029 | 3+ months | §10.1, §10.2 |
| v9.1 | Cross-frame validation: Earth verifier checks Moon receipts via published ephemeris | 2029 | 6 weeks | §10.1 |
| v9.2 | Mars receipts (MTC time, Mars2000) — pending Mars surface presence | 2030+ | Major | §10.1 |
| v9.3 | VLBI quasar bridging for cross-body simultaneity claims | 2030+ | Research | §10.3 |

#### v10+ — Research frontier (2030+)

| Scope | Notes |
|-------|-------|
| Full zero-knowledge proofs of co-presence (Schnorr + bulletproofs over Haversine in non-native field) | ZK lib maturity dependent |
| Post-quantum signature migration (CRYSTALS-Dilithium or successor) | Triggered by quantum-cryptanalysis maturity |
| Direct VLBI quasar fingerprinting at consumer scale | Hardware miniaturisation dependent |

### 12.3 Gating and Honest Caveats

- **Pre-v7 dates** are realistic targets under sustained pace.
- **v7 dates** are achievable but assume continuous priority; real life intervenes.
- **v8 onward** is *contingent* on partnerships and hardware that we don't control.
- **v9 onward** is *contingent* on infrastructure that doesn't yet exist (lunar/Mars human presence at scale).
- The roadmap is a *target to plan against*, not a commitment. Halve all dates beyond v6 for use in pitches or applications.

### 12.4 Update Discipline

- This section is updated whenever a version ships, slips, or scope changes.
- Version-shipping updates the version history table at the top of this document and moves the relevant row from "future" to "shipped."
- Major scope changes require a corresponding update in `memory/MEMORY.md`.
- Minor scope changes are logged in `memory/sessions/` per-session.

---

## 13. Hardware-Backed Signing (v5)

**Status:** In implementation. Specification stable. Default OFF until live deploy. Reference implementation in `js/sign.js` v5 helpers (`irlidV5*`).

This section is the canonical specification for v5 signing. v3 and v4 receipts continue to be valid forever; v5 is an additive layer.

### 13.1 Motivation

The strongest honest criticism of v3/v4 IRLid is that signing keys live in `localStorage`, which is extractable by any code with brief access to an unlocked device (THREAT-MODEL.md §III.2). v5 closes this gap by migrating signing-key custody to the platform's hardware-backed authenticator: Apple Secure Enclave, Android Trusted Execution Environment, or Windows Hello TPM. Private keys are generated inside the secure element and never leave it. Signing requires a fresh user-verification gesture (Face ID, Touch ID, fingerprint, Windows Hello) every time.

After v5 lands, III.2 reduces from "attacker with brief physical access extracts the key" to "attacker has compromised the platform's secure element," a much higher bar.

### 13.2 The signing primitive

WebAuthn was originally designed for server-issued challenge-response authentication. v5 uses it as a **general-purpose signing primitive** by placing IRLid's payload hash into the `challenge` field of an assertion request. The platform authenticator signs the standard WebAuthn signed-data envelope, which transitively binds our payload because our hash is inside `clientDataJSON`.

The signed bytes are exactly:
```
authenticatorData || SHA-256(clientDataJSON)
```
where `||` is byte concatenation. This is the WebAuthn-standard signing input, unchanged for v5. The signature is ECDSA P-256 (COSE algorithm `-7`).

A relying party verifying a v5 receipt:
1. Parses `clientDataJSON` (bytes → UTF-8 → JSON).
2. Confirms `clientData.type === "webauthn.get"`.
3. Confirms `clientData.origin` matches an expected RP origin (production: `https://irlid.co.uk`; test: `https://bunhead.github.io`).
4. b64url-decodes `clientData.challenge` and confirms it byte-equals the recipient-recomputed `payloadHash = SHA-256(canonical(payload))`.
5. Reconstructs `signedBytes = authData || SHA-256(clientDataJSON)`.
6. Verifies the receipt's `sig` field against `signedBytes` using the receipt's `pub` (P-256 JWK), via `crypto.subtle.verify`.

Any single failure rejects the v5 envelope.

### 13.3 v5 receipt schema (additive over v3)

A v5 RESPONSE object adds a `webauthn` envelope alongside the existing fields:

```json
{
  "v": 5,
  "type": "response",
  "payload": {
    "v": 5,
    "lat": 52.9225, "lon": -1.4746, "acc": 5,
    "ts": 1714560000,
    "nonce": 4287654321,
    "helloHash": "<base64url SHA-256 of canonical(hello)>",
    "offerHash": "<base64url SHA-256 of canonical(offer.payload)>"
  },
  "hash": "<base64url SHA-256 of canonical(payload)>",
  "sig": "<base64url ECDSA P-256 signature, raw r||s, 64 bytes>",
  "pub": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." },
  "webauthn": {
    "authData": "<base64url authenticatorData bytes>",
    "clientData": "<base64url clientDataJSON bytes>"
  }
}
```

A v5 HELLO object structures its `offer.sig` identically and adds the same `webauthn` envelope inside `offer`:

```json
{
  "v": 5,
  "type": "hello",
  "pub": { ... },
  "offer": {
    "payload": { "v": 5, "lat": ..., "lon": ..., "acc": ..., "ts": ..., "nonce": ... },
    "sig": "<raw r||s>",
    "webauthn": { "authData": "...", "clientData": "..." }
  }
}
```

**Critical: signature wire-format is raw `r||s`.** WebAuthn natively returns DER-encoded ECDSA signatures (`SEQUENCE { INTEGER r, INTEGER s }`). v5 implementations MUST convert DER → raw 64-byte concatenation before serialisation, because:
1. Verifier uses `crypto.subtle.verify` with `{ name: "ECDSA" }`, which requires raw IEEE P1363 format.
2. v3/v4 receipts already use raw format. Keeping the wire format identical means a v3/v4 verifier extension only needs to add envelope-checking, not signature-format-handling.

### 13.4 Public-key extraction at enrolment

A v5 credential is created with `navigator.credentials.create()`. The returned attestation contains a COSE-encoded public key inside `attestationObject.authData.attestedCredentialData.credentialPublicKey`. v5 implementations MUST extract the COSE key, convert to JWK form, and store the JWK locally for later embedding in receipts as `pub`.

For ECDSA P-256 (COSE `-7`):
- COSE keys are CBOR-encoded with integer keys: `kty=2, alg=-7, crv=1, x=..., y=...`.
- Convert to JWK: `{ kty: "EC", crv: "P-256", x: <b64url(x)>, y: <b64url(y)> }`.

The `credId` returned by `create()` is also stored locally — it is required to call `get()` against this credential later. The `credId` is not sensitive (it's a public handle) but is uniquely tied to this device's hardware.

### 13.5 Enrolment parameters (canonical)

```js
navigator.credentials.create({
  publicKey: {
    challenge: <crypto.getRandomValues(32 bytes)>,
    rp: { name: "IRLid", id: <eTLD+1 of current origin> },
    user: { id: <16 random bytes>, name: "irlid-signer", displayName: "IRLid Signing Key" },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],   // ES256 only
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
      residentKey: "preferred"
    },
    timeout: 60000,
    attestation: "none"
  }
});
```

Notes:
- `alg: -7` only — no fallback to other algorithms. v5 is locked to P-256 to match v3/v4 verifier expectations.
- `userVerification: "required"` — no PIN-fallback bypass. Bio-metric or device unlock gesture mandatory at every signing.
- `attestation: "none"` — we don't trust attestation as an authenticity signal at consumer scale (most platforms strip or randomise it). The receipt's value comes from the protocol, not the attestation chain.
- `rp.id` must equal an eTLD+1 the current origin is registered under. For irlid.co.uk this is `irlid.co.uk`. For test deploys at `bunhead.github.io` this is `bunhead.github.io`. The RP ID is locked at creation time and cannot be changed without re-enrolment.

### 13.6 Signing parameters (canonical)

```js
const payloadHash = b64urlDecode(await hashPayloadToB64url(payload));  // 32 bytes

const assertion = await navigator.credentials.get({
  publicKey: {
    challenge: payloadHash,                                 // ← OUR data goes here
    allowCredentials: [{ id: storedCredId, type: "public-key" }],
    userVerification: "required",
    timeout: 60000
  }
});

const authData = new Uint8Array(assertion.response.authenticatorData);
const clientData = new Uint8Array(assertion.response.clientDataJSON);
const sigDer = new Uint8Array(assertion.response.signature);
const sigRaw = derToRawP256Signature(sigDer);   // 64-byte r||s
```

The receipt then carries `sig = b64url(sigRaw)`, `webauthn.authData = b64url(authData)`, `webauthn.clientData = b64url(clientData)`.

### 13.7 Verification rules (canonical)

A receipt-verifying party (peer device, third-party verifier, Worker):

```js
async function verifyV5Envelope(payload, pub, sigRawB64u, webauthn, expectedRpOrigin) {
  // 1. Compute payloadHash from payload (same as v3/v4)
  const payloadHashB64u = await hashPayloadToB64url(payload);

  // 2. Parse and validate clientDataJSON
  const clientDataBytes = b64urlDecode(webauthn.clientData);
  const clientData = JSON.parse(new TextDecoder().decode(clientDataBytes));
  if (clientData.type !== "webauthn.get") return false;
  if (clientData.origin !== expectedRpOrigin) return false;
  if (clientData.challenge !== payloadHashB64u) return false;  // string b64url comparison

  // 3. Reconstruct signedBytes = authData || SHA-256(clientDataJSON)
  const authDataBytes = b64urlDecode(webauthn.authData);
  const clientDataHash = new Uint8Array(await crypto.subtle.digest("SHA-256", clientDataBytes));
  const signedBytes = new Uint8Array(authDataBytes.length + clientDataHash.length);
  signedBytes.set(authDataBytes, 0);
  signedBytes.set(clientDataHash, authDataBytes.length);

  // 4. Verify ECDSA P-256 signature
  const pubKey = await crypto.subtle.importKey("jwk", pub,
    { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    pubKey,
    b64urlDecode(sigRawB64u),
    signedBytes
  );
}
```

The expected RP origin is per-deployment:
- Production: `https://irlid.co.uk`
- Test (GitHub Pages): `https://bunhead.github.io`
- Localhost dev: `http://localhost:8000`, `http://127.0.0.1:8000`

A verifier outside the issuing origin (e.g. a third-party widget verifying a receipt signed at irlid.co.uk) accepts the origin set the issuer publishes. v5 uses a publicly documented allowlist; future versions may register origins in PROTOCOL.md §14 (RP federation).

### 13.8 Verifier-side branching (backward compat)

A v5-aware verifier handles all three eras:

```
if (receipt.v === 5 && receipt.webauthn) {
  // v5 path: verify envelope, then verify sig over authData||SHA-256(clientDataJSON)
} else if (receipt.v === 5 && !receipt.webauthn) {
  // malformed v5 — reject
} else {
  // v3/v4 path: verify sig directly over payloadHash bytes
}
```

A v3/v4-only verifier (no v5 awareness) sees a v5 receipt with `v: 5` and either:
- Treats it as malformed and rejects (current `processScannedResponse` behaviour, since the `verifySig` call would compare a hash signed by raw payloadHash bytes against a receipt where `sig` is over `authData||SHA-256(clientDataJSON)`, which won't match);
- Or, if the verifier has a permissive `v: any` policy, mis-verifies. This is why **the v5 sig wire-format is raw r||s** — it's structurally compatible with v3/v4 verifier code, but the bytes won't validate. The mismatch is detected, not silently accepted.

### 13.9 Score band

A v5 receipt that verifies cleanly (all envelope checks pass + ECDSA verifies) raises the receipt's score by 20 points: from the v4 ceiling of 50 to the v5 ceiling of 70. The 20-point delta reflects:
- Closure of THREAT-MODEL.md §III.2 (key extraction).
- Strengthening of §III.1 (active-session-on-stolen-device): every signature now requires fresh user verification, not just an unlocked browser tab.
- Per-signature attestation that the legitimate user (whoever the platform binds to) was physically present at signing time.

Score does not raise to 100 — that requires v6+ external-witness anchoring.

### 13.10 Settings & migration

v5 is OFF by default. Enabling requires:
1. The device must support a platform authenticator (`PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable() === true`).
2. The user explicitly enrols a v5 credential via Settings → "Hardware-Backed Signing (v5, beta)".
3. The user explicitly toggles "Use v5 signing" ON.

If any of those is false, signing falls back to v3/v4 behaviour (localStorage ECDSA). The v3/v4 keypair is **not deleted** on v5 enrolment — old receipts that referenced that public key continue to verify, and the user can return to v3/v4 mode at any time.

A migration is not forced. v5 adoption is per-user, per-device, per-decision.

### 13.11 Sync vs device-bound posture

WebAuthn platform credentials may be synced (iCloud Keychain, Google Password Manager) or device-bound (security keys, some platform configurations). v5.0 is **neutral**: we set `authenticatorAttachment: "platform"` and let the OS/browser decide.

This is acceptable because:
- The protocol's primary moat is co-presence at signing time. A synced credential on a second device still requires the second device to physically attend a venue + pass user-verification on that device.
- Cloud-sync compromise (e.g., Apple ID account takeover) gives the attacker a valid signing key, but they still face the co-presence wall to use it for a fraudulent attendance claim.
- Cross-device recovery improves UX significantly. Phone-loss without sync is currently catastrophic for v3/v4 users (key gone, identity gone). v5 with sync makes recovery natural.

Orgs requiring stronger posture (high-security contexts) may choose `authenticatorAttachment: "cross-platform"` (security keys only, never synced) at credential creation. This is documented as a v5.x extension, not a v5.0 default. The default is sync-permissive.

### 13.12 Known footguns (handled in reference implementation)

- **DER → raw signature conversion.** WebAuthn returns DER; `crypto.subtle.verify` requires raw `r||s`. Reference implementation includes `derToRawP256Signature(der: Uint8Array): Uint8Array` with full ASN.1 parsing and zero-padding handling. Extensively unit-tested.
- **Signature counter unreliable.** iCloud Keychain returns counter `0` on every assertion; some Android implementations are non-monotonic. v5 does **not** rely on counters for replay protection — the protocol-level nonce + 90-second time window already handle this.
- **`clientDataJSON` field ordering.** The spec mandates a specific order, but historical implementations have varied. Reference implementation **parses** `clientDataJSON` and reads named fields; never reserialises and byte-compares.
- **RP ID lock.** Once a credential is created with `rpId: "irlid.co.uk"`, that credential cannot be used at `bunhead.github.io` and vice versa. v5 implementations document this loudly to avoid users enrolling on the test environment and finding their credential unavailable on production. Per-environment enrolment is acceptable; cross-environment portability is not.
- **`userVerification: "required"` enforcement.** Some authenticators silently downgrade to `"preferred"`. The verifier MUST inspect `authData[32] & 0x04` (UV flag) and reject the assertion if UV was not actually performed. Reference implementation enforces this.
- **Cross-origin receipt verification.** A receipt signed at `irlid.co.uk` and verified at `bunhead.github.io` is a legitimate cross-origin verification — the verifier checks the receipt's claimed origin against an allowlist, not against `location.origin`. Reference implementation parameterises `expectedRpOrigin`.

### 13.13 Score table update

The §5 scoring model is extended:

| Layer | What's added | Score |
|-------|-------------|-------|
| v3 base | Core cryptographic checks | 20 / 100 |
| v4 Trust (LIVE) | Receipt depth, location hotspot novelty, device consistency, optional WebAuthn bio-metric gate | 50 / 100 |
| **v5 (THIS SECTION)** | **Hardware-backed signing key (Secure Enclave / TEE / Hello TPM); per-signature user verification; closes localStorage extraction** | **70 / 100** |
| v6 Network | Transitive trust graph, community vouching, Sybil resistance | 65 / 100 |
| v6 Time anchor | Multi-witness TSA tokens, OpenTimestamps Bitcoin anchor | 75 / 100 |
| v7 ZK | Zero-knowledge proof of presence + coordinate hiding | 100 / 100 |

The "Bonus Checks" section under §5 gains:

| Check | Points | Passes when |
|-------|--------|-------------|
| v5 envelope present | 0 | Receipt has `v: 5` and `webauthn.{authData, clientData}` populated |
| v5 RP origin match | +5 | `clientData.origin` equals expected RP origin for issuer's deployment |
| v5 challenge binding | +5 | `clientData.challenge` (b64url-decoded) equals `SHA-256(canonical(payload))` |
| v5 UV flag asserted | +5 | `authData[32] & 0x04 === 0x04` (user verification was performed) |
| v5 ECDSA over envelope | +5 | `crypto.subtle.verify(pub, sig, authData \|\| SHA-256(clientDataJSON))` succeeds |

Total v5 boost: 20 points. Receipts missing any v5 check do not score the v5 bonus but remain valid at v4 score band.

### 13.14 Test coverage

Reference implementation in `tests/sign.test.js` adds:
- DER ↔ raw P-256 signature round-trip (with positive + negative + low-bit + high-bit r/s test vectors).
- v5 envelope verification: known-good vector signed offline, verified by `irlidV5VerifyEnvelope`.
- Negative tests: wrong origin, wrong type, wrong challenge, missing UV flag, sig over wrong bytes, malformed clientDataJSON.
- Backward compat: v3 receipt + v4 receipt both verify through v5-aware verifier without false positives or false negatives.

Target after v5 implementation: 95+ tests, all green, run via `node --test tests/sign.test.js`.

### 13.15 Worker-side verification

v5 envelope verification on the Cloudflare Worker (`irlid-api/src/index.js`) uses the same primitive (Web Crypto is available in Workers). Worker changes are scoped in `HANDOVER-Batch5-Worker.md` for Mr. Data — they are structurally Worker work, not Number One work. The pure cryptographic spec is identical to §13.7 above; only the runtime environment differs (Worker `caches` instead of localStorage, Worker `Origin` header instead of `location.origin`).

### 13.16 What v5 does NOT do

To set expectations clearly:
- v5 does **not** add face capture or mutual witness photography. Those are §8 v5-planned extensions reframed for v5.x once the core key-migration lands.
- v5 does **not** strengthen GPS spoofing resistance. That is v6+ multi-anchor positioning.
- v5 does **not** address the §V.3 Worker-side role enforcement gap. That is a separate Worker hardening track.
- v5 does **not** force migration of v3/v4 receipts. They remain valid forever at their original score.
- v5 does **not** retain envelope verifiability after privacy-mode redaction. The v5 envelope's `clientData.challenge` is `SHA-256(canonical(original-payload))`. After `irlidMakeRedactedReceipt()` strips GPS and replaces it with `gps_hash`, the original payload bytes are gone — a third-party verifier cannot recompute the challenge to compare. v5 receipts can still be verified at signing time and recorded, but **a v5 receipt that has been put through privacy-mode redaction cannot be re-verified through the v5 envelope path by a third party**. The receipt holder would need to present the unredacted form for full envelope verification. The v3/v4 raw-hash signature path is unaffected by redaction (it verifies the stored `hash` directly). Implementation surfaces this honestly: `check.html`'s privacy-mode path explicitly reports "v5 envelope cannot be verified after GPS redaction" rather than silently passing or silently failing. v6+ may revisit the redaction format to preserve v5 envelope verifiability (e.g. by including a redaction proof that bridges original-payload-hash to redacted-payload-hash); not in v5.0 scope.

### 13.17 Threat-model improvement (per-attack)

| Attack | v3/v4 (today) | v5 |
|--------|---------------|-----|
| III.2 localStorage extraction | **Trivial** with brief unlocked-device access | **Infeasible** without compromising the platform's secure element |
| III.1 Stolen unlocked device | Bio-metric optional; PIN-fallback bypassable | UV required at every signing; PIN bypass blocked by `userVerification: "required"` |
| III.3 Cloud passkey sync compromise | N/A | New attack surface (sync platform). Mitigation: orgs may require non-sync at v5.x |
| Replay (90s window) | 90s nonce window | Same — orthogonal to v5 |

The §III.2 row is the headline. cym13's r/netsec criticism, which is the strongest honest critique of the protocol on public record, is closed by v5.

---

*Sections 10, 11, 12, and 13 are forward-defined or in-implementation specifications. They commit IRLid to design coherence, not to implementation timeline. The principle is consistent throughout: build for the destination, not just the next milestone.*
