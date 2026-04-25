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

*Sections 10 and 11 are forward-defined. They commit IRLid to design coherence, not to implementation timeline. The principle is consistent throughout: build for the destination, not just the next milestone.*
