# v5 Passkeys Proposal — Hardware-Backed Keys via WebAuthn

**Author:** Number One (Claude)
**Date:** 27 April 2026
**Status:** Proposal — pending Captain's review and ratification
**Target version:** v5.0
**Target ship date:** Late May 2026 (per PROTOCOL.md §12)
**Effort estimate:** 2 weeks

---

## 1. Problem Statement

The strongest honest weakness in IRLid v4 is **localStorage-resident private keys**. Once an attacker has run JavaScript on the user's device — via XSS, malicious browser extension, or filesystem-level malware — they can extract the raw ECDSA private key from `localStorage` and impersonate the user indefinitely. This was the core of cym13's r/netsec critique (28K+ views), and it's correct.

The current threat model assumes a benign client environment. v5 must assume otherwise.

## 2. Solution Overview

Migrate signing keys from JavaScript-accessible `localStorage` to **WebAuthn platform authenticators**, which generate and store keys in hardware-isolated secure elements (Apple Secure Enclave, Android StrongBox/Trusty, Windows TPM, Linux PCR). The private key never exists in JavaScript memory; it never leaves the secure element.

The trade-off:
- **Gain:** keys cannot be extracted by malware running in the browser, even with full JS execution privileges
- **Cost:** signing requires a platform-authenticator gesture (Face ID / Touch ID / Windows Hello / fingerprint)
- **Bonus:** the same WebAuthn flow can carry attestation that the key was created in genuine hardware

## 3. WebAuthn ↔ ECDSA — The Bridge

WebAuthn supports ECDSA P-256 natively as algorithm `-7` (`COSEAlgorithmIdentifier.ES256`). The cryptographic primitive is identical to v4's `crypto.subtle.sign('ECDSA', ...)`. **The same curve, the same hash, the same signature verifies the same way.**

The difference is purely the storage and signing medium:

| | v4 (current) | v5 (proposed) |
|--|---|---|
| Key generation | `crypto.subtle.generateKey('ECDSA', ...)` | `navigator.credentials.create({publicKey: {...alg: -7}})` |
| Private key location | `localStorage` (extractable) | Secure Enclave / StrongBox / TPM (non-extractable) |
| Public key location | `localStorage` and published in receipt | WebAuthn credential record + published in receipt |
| Signing call | `crypto.subtle.sign('ECDSA', privateKey, data)` | `navigator.credentials.get({publicKey: {challenge: ...}})` |
| User gesture | None | Face ID / Touch ID / Windows Hello |
| Output | Raw ECDSA signature (r,s) | WebAuthn assertion (signature + authenticatorData + clientDataJSON) |

## 4. The clientDataJSON Wrap

This is the only structural change to receipts.

WebAuthn doesn't sign arbitrary data. It signs `authenticatorData ∥ SHA-256(clientDataJSON)`, where `clientDataJSON` has structure:

```json
{
  "type": "webauthn.get",
  "challenge": "<base64url-encoded-challenge>",
  "origin": "https://irlid.co.uk"
}
```

We use the `challenge` field to carry our payload hash:

**Signing flow (v5):**
1. Compute `H = SHA-256(canonical(payload))` — same as v4
2. Pass `H` as the WebAuthn challenge: `navigator.credentials.get({publicKey: {challenge: H, ...}})`
3. WebAuthn internally:
   a. Constructs `clientDataJSON` containing `challenge: base64url(H)`
   b. Computes `data_to_sign = authenticatorData ∥ SHA-256(clientDataJSON)`
   c. Returns assertion: `{signature, authenticatorData, clientDataJSON, userHandle}`
4. Receipt embeds: `{payload, assertion: {signature, authenticatorData, clientDataJSON}}`

**Verification flow (v5):**
1. Re-compute `H = SHA-256(canonical(payload))`
2. Parse `clientDataJSON` from the assertion
3. Confirm `clientDataJSON.challenge === base64url(H)` — this binds the assertion to our payload
4. Confirm `clientDataJSON.origin === "https://irlid.co.uk"` — prevents cross-origin replay
5. Reconstruct `data_to_verify = authenticatorData ∥ SHA-256(clientDataJSON)`
6. Verify the signature using the receipt's published public key (same as v4)

## 5. Receipt Schema Additions

A v5 receipt is a v4 receipt with one additional field:

```json
{
  "v": 5,
  "ts": 1714000000000,
  "lat": 51.9, "lon": -1.4,
  "pub": {"kty": "EC", "crv": "P-256", "x": "...", "y": "..."},
  "sig": "<base64url ECDSA signature — same field name as v4>",
  "webauthn": {
    "authenticatorData": "<base64url>",
    "clientDataJSON": "<base64url>",
    "credentialId": "<base64url, optional, for receipts that include it>"
  }
}
```

When `webauthn` is present, verifier uses v5 path. When absent, verifier uses v4 path. Both paths produce the same boolean: receipt valid or not.

**Schema versioning rule:** the `v` field bumps from 3 → 5 when a receipt uses WebAuthn. We skip 4 deliberately because v4 in PROTOCOL.md is the *protocol generation* (everything shipped in v4) and we're keeping the field semantic clean. Alternative: keep `v: 3` and treat `webauthn` presence as the discriminator. **Recommendation:** bump to 5; it's clearer.

## 6. Migration Approach

### 6.1 Backward compatibility (non-negotiable)

Per the immutability principle: **all v3 and v4 receipts remain valid forever.** They were signed with localStorage keys that we cannot retroactively un-trust. Their score stays at 20/100 (v3) or 50/100 (v4) regardless. v5 verifiers MUST handle both v3/v4 and v5 receipts cleanly.

### 6.2 Per-user migration

When a user opts into v5 in Settings:

1. Generate a new WebAuthn credential (`navigator.credentials.create()`)
2. Publish the new public key as their v5 identity
3. Old localStorage keys are **kept**, not deleted — past receipts must remain verifiable
4. Future receipts use the WebAuthn key
5. Trust history (per v4) merges naturally: same user, two keys, both legitimate

### 6.3 Detection and graceful fallback

Browsers/devices without platform authenticator support:
- `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` returns `false`
- Settings toggle for "Hardware-backed keys" remains visible but disabled with explanatory text
- User continues on v4 localStorage path — no downgrade attack risk because they were always on v4

Browsers WITH platform authenticator but the user declines:
- Settings toggle off → v4 localStorage path
- User can opt in any time

## 7. Settings UI

New row in Settings:

```
🔐 Hardware-backed keys                          [ off ]
   When enabled, your private key is stored in your
   device's secure element (Face ID / fingerprint /
   Windows Hello) instead of browser storage.
   Cannot be extracted by browser-based attacks.

   Recommended for high-trust use cases.

   Currently: not enabled
   Available on this device: ✓ yes
```

When toggled on:
1. Confirmation modal: "This will generate a new hardware-backed key. Your existing receipts remain valid."
2. WebAuthn `navigator.credentials.create()` call with platform authenticator
3. User performs platform gesture
4. New key registered; UI updates to show "Currently: enabled (created [date])"

When toggled off:
1. Confirmation: "Your hardware key remains on file but new receipts will use browser-stored keys. Continue?"
2. State stored in Settings; future signings use v4 path
3. Hardware key not deleted (cannot be deleted from JS anyway; may be removed via OS-level credential management)

## 8. Score System Update

| Version | Layer | Score |
|---------|-------|-------|
| v3 | ECDSA + canonical hash + GPS + window | 20/100 |
| v4 | + Trust history + biometric gate (WebAuthn one-shot) + privacy | 50/100 |
| **v5** | **+ Hardware-backed keys (WebAuthn-resident, non-extractable)** | **70/100** |

Note: v4 already uses WebAuthn for the *biometric gate* — but only as a one-shot user-verification step before signing. The signing itself still uses localStorage keys. v5 is fundamentally different: WebAuthn becomes the signing mechanism, not just the gate.

## 9. Threat Model Improvement

| Attack | v4 | v5 |
|--------|-----|-----|
| XSS extracts private key | Trivial — read `localStorage` | Impossible — key never in JS |
| Malicious extension reads page | Trivial | Impossible — key in OS-level secure element |
| Filesystem malware | Trivial — `localStorage` files readable | Hard — requires hardware exploit |
| Coerced signing (under duress) | Possible via JS | Possible (still requires user gesture) — orthogonal to key storage |
| Stolen device, unlocked | User identity compromised | User identity compromised — same outcome |
| Stolen device, locked | User identity preserved (key inaccessible to attacker without unlock) | User identity preserved (same — but stronger guarantee via hardware isolation) |

**Net effect:** v5 closes the most cited honest weakness. Threat model rises from "trust the browser sandbox" to "trust the hardware secure element." That's a qualitatively different floor.

## 10. Implementation Plan

### Files to modify

| File | Change | Estimated effort |
|------|--------|------------------|
| `js/sign.js` | Add `irlidSignWebAuthn()` alongside existing `irlidSign()` | 1 day |
| `js/verify.js` (or `sign.js` if combined) | Add `irlidVerifyWebAuthn()` path | 1 day |
| `settings.html` | Add Hardware-backed keys row + WebAuthn registration flow | 1 day |
| `accept.html`, `scan.html` | Branch signing call based on Settings | 0.5 day |
| `irlid-api/src/index.js` | Extend version detection in receipt parsing | 0.5 day |
| `receipt.html`, `check.html` | Display "🔐 hardware-backed" badge on v5 receipts | 0.5 day |
| `tests/sign.test.js` | New test fixtures for v5 sign/verify roundtrip | 1 day |
| `PROTOCOL.md` | New §13 documenting v5 schema and verification | 1 day |

**Subtotal:** ~6.5 days

### Cross-browser smoke

| Platform | Authenticator | Test |
|----------|---------------|------|
| iOS Safari | Touch ID / Face ID | Sign, verify, refresh, re-sign |
| Android Chrome | Fingerprint | Same |
| Windows Edge | Windows Hello PIN/face/fingerprint | Same |
| macOS Chrome | Touch ID | Same |
| Linux Firefox | (where TPM available) | Same |
| Browsers without platform auth | (any) | Verify graceful fallback to v4 |

**Estimated effort:** 1 day

### Buffer + documentation polish: 2.5 days

**Total: ~10 working days = 2 weeks** (matches PROTOCOL.md §12 estimate)

## 11. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| WebAuthn UX friction (gesture every sign) | Use `userVerification: "preferred"` so authenticator can use cached recent verification; pair with v4's existing biometric-gate when both paths active |
| Platform-locked credential (lost on device wipe) | Document honestly. Cross-device sync via Passkey ecosystem (iCloud Keychain, Google Password Manager) provides resilience but introduces sync provider as trust point — also document |
| Older browsers without platform auth | Fall back to v4 cleanly; this is the design |
| Confusion between v4's biometric gate and v5's WebAuthn signing | Documentation in §13 of PROTOCOL.md explicitly disambiguates |
| Signature format compatibility | WebAuthn ES256 is bit-for-bit ECDSA P-256; same SubtleCrypto verifier works once raw signature is extracted from assertion |
| Cross-device receipt verification | The recipient's WebAuthn key isn't transferable, but their *public key* is on the receipt and the *signature* is verifiable by anyone — same as v4 |

## 12. Honest Limitations

- **WebAuthn doesn't prove the user is at the device.** It proves whoever holds the device performed the platform-auth gesture. Same as v4 — orthogonal to the GPS/proximity question.
- **Synced Passkeys (iCloud, Google) are still hardware-backed at each device, but the sync mechanism introduces the sync provider as a trust point.** A user who syncs is trusting Apple/Google not to extract their key. This is documented but not eliminated.
- **Key recovery on device loss is the user's problem,** same as physical key loss in any system. Trust history (v4) provides some resilience: a user with extensive scan history on a new device can claim continuity socially even if cryptographically they've started fresh. v6+ network-vouching may formalise this.
- **No retroactive upgrade.** v4 receipts stay v4 forever. Old localStorage keys remain valid for old receipts. The user's score on a new v5 receipt is 70; their score on their last v4 receipt is still 50. Both true.

## 13. Rollout Strategy

| Sub-version | Date | Default | Notes |
|-------------|------|---------|-------|
| **v5.0** | Late May 2026 | Off | Opt-in via Settings; gather user feedback on UX |
| **v5.0.x** | Jun 2026 | Off | Bug fixes, cross-browser polish |
| **v5.1** | Mid Jun 2026 (per §12) | Off (paired with Imbue pilot) | Imbue pilot launches with v5 keys for org admins |
| **v5.2** | Late Jun 2026 | Off | Continued opt-in; bug fixes only |
| **v6.0** | Q1 2027 | **On for everyone** | Aligned with multi-witness time anchoring launch. Existing users get one-time migration prompt at next sign-in. v4 keys remain valid for past receipts forever. Clean threat-model story: everyone moves together. |

## 14. Captain's Decisions (Ratified 27 April 2026)

1. **Receipt version field:** ✅ Bump to `v: 5`
2. **Default-on for users:** ✅ **Moved to v6.0**, not v5.2 — clean threat-model story (everyone migrates together, no split user base), aligned with the v6 multi-witness time anchoring release
3. **Cross-device Passkey sync:** ✅ Neutral — document the trade-off, let user decide ("balance in all things")
4. **Score band:** ✅ 70/100 for v5 confirmed

## 15. Next Steps If Ratified

1. Captain reviews this proposal, answers questions in §14
2. Number One updates `PROTOCOL.md §12` v5.0 row to reference this proposal
3. Number One drafts HANDOVER batch 5 for Mr. Data: **single-task batch** to add WebAuthn signing to a feature branch on the **test environment first**, before any change to live IRLid
4. Mr. Data implements; Captain reviews; we test on test environment for 1-2 weeks
5. Captain decides whether to fold into live IRLid via a v5-launch PR

The work itself is well-scoped and inside Mr. Data's known capabilities (WebAuthn API integration, schema fields, UI toggle). Number One owns the cryptographic verification logic; Mr. Data owns the surrounding code.

---

*This proposal is forward-defined. It commits IRLid to coherence, not to a release date. The principle stays: build for the destination, not just the next milestone.*

— Number One, 27 April 2026
