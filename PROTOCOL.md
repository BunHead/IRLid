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

The receipt page runs up to 13 checks. Score = `round(passed / total × 100)` shown as **% Confirmed**.

### Core Checks (always run)

| # | Check | Passes when | Fails when |
|---|-------|-------------|------------|
| 1 | Self structure | `a` has `type`, `payload`, `sig`, `pub` | Any field missing |
| 2 | Self hash | `SHA-256(canonical(a.payload)) == a.hash` | Mismatch (recomputed if stripped) |
| 3 | Self signature | `ECDSA.verify(a.pub ∥ hello.pub, a.hash, a.sig)` | Invalid signature |
| 4 | Guest structure | `b` has required fields | Any field missing |
| 5 | Guest hash | `SHA-256(canonical(b.payload)) == b.hash` | Mismatch (recomputed if stripped) |
| 6 | Guest signature | `ECDSA.verify(b.pub, b.hash, b.sig)` | Invalid signature |
| 7 | HELLO offer | Recompute `offerHash = SHA-256(canonical(offer.payload))`; `ECDSA.verify(hello.pub, offerHash, offer.sig)` | Invalid |
| 8 | Self binds HELLO | `a.payload.helloHash == SHA-256(canonical(hello))` | Mismatch |
| 9 | Guest binds HELLO | `b.payload.helloHash == SHA-256(canonical(hello))` | Mismatch |

### Bonus Checks (conditional)

| Check | Passes when | Notes |
|-------|-------------|-------|
| Self binds offer | `a.payload.offerHash == recomputed offer hash` | If offer present |
| Guest binds offer | `b.payload.offerHash == recomputed offer hash` | If offer present |
| Time ≤ tolerance | `\|a.payload.ts − b.payload.ts\| ≤ 90,000 ms` | Fails with "Missing timestamps" if absent |
| Distance ≤ tolerance | Haversine distance ≤ 12 m | Fails with "Missing locations" if GPS absent |

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
