# HANDOVER — Batch 5 (Worker-side v5 envelope verification)

**STATUS: ✅ DONE BY NUMBER ONE — 1 May 2026 afternoon (Captain bypassed Mr. Data per Friday brief).**

**This document is preserved as the design rationale + acceptance criteria but the work is complete. Mr. Data should read it for context when he returns Tuesday but does NOT need to execute it.**

**What landed:**
- Live Worker `irlid-api/src/index.js`: `verifyV5Envelope()` helper added (lines ~123–214), `verifyReceipt()` updated with per-side v5 dispatch + `fully_v5` scoring flag.
- Test-env Worker `IRLid-TestEnvironment/irlid-api/src/index.js`: same `verifyV5Envelope()` helper, `verifyReceipt()` v5 dispatch, **plus** `verifySignedHello()` v5 dispatch (returns `verification_state: "v5_envelope_verified"` when v5 path succeeds), **plus** the non-recursive `canonical()` was upgraded to fully recursive (matches `js/sign.js`; defensive helium-tight fix for any future nested-payload field).
- Validation: Node-side smoke at `outputs/v5-test/worker-smoke.mjs` runs 12 tests covering pure v3, pure v5, hybrid v3+v5, mutated payload, wrong origin, missing UV flag, webauthn-missing-but-v=5, hash mismatch, distance overflow. **All green.** Test infra is reusable for ongoing regression.
- Combined client + Worker test count: 110 (sign.test.js) + 12 (worker-smoke.mjs) = **122 green, 0 red**.

**Original 1 May design brief follows below for the historical record:**

---

**Issued:** 1 May 2026 by Number One (Claude Opus, Bridge stretch)
**Repo scope:** `BunHead/IRLid-TestEnvironment` only. Do not touch live `BunHead/IRLid`.
**Working rule:** one narrow task per PR. Do not combine schema changes, helper additions, and verification rewrites in one PR.
**Blocker:** None — Number One's v5 client-side reference implementation has already landed in the live `js/sign.js` and the v5 envelope verifier (`irlidV5VerifyEnvelope`) is the canonical Worker behaviour. PROTOCOL.md §13 is the spec. Reference implementation passes 12 envelope tests + 100 random DER↔raw round-trips against real ECDSA P-256 signatures.

---

## Context

v5 (PROTOCOL.md §13) moves IRLid signing keys into platform-bound passkeys (Secure Enclave / TEE / Windows Hello TPM). The client now produces receipts whose `sig` is computed over the WebAuthn signed envelope `authenticatorData || SHA-256(clientDataJSON)` instead of directly over the payload hash.

The Worker currently verifies receipts via `verifyReceipt()` and HELLO offers via `verifySignedHello()`, both calling `verifySig(hash, sig, pub)` — which is the v3/v4 path. **A v5 receipt arriving at this Worker today would fail verification**, because `sig` was made over different bytes than `verifySig` is checking.

Batch 5 wires v5 envelope verification into the Worker so v5 receipts verify correctly while v3/v4 receipts continue to verify exactly as today.

**No D1 schema changes are required.** Receipts already serialise to `receipt_json` (TEXT). The Worker just needs to learn how to read `receipt.v === 5` + `receipt.webauthn` and dispatch accordingly.

---

## Task 1 — Add `verifyV5Envelope()` helper to the Worker

**Goal:** A pure verification helper that mirrors `irlidV5VerifyEnvelope()` from `js/sign.js` exactly. No state, no D1, no side effects.

**Files:** `irlid-api/src/index.js` (test environment).

**Behaviour:** Add a function with this exact signature:

```js
async function verifyV5Envelope(payload, pubJwk, sigRawB64u, webauthnEnv, expectedRpOrigin)
```

It MUST implement the same checks as the client-side `irlidV5VerifyEnvelope`:

1. Reject if `webauthnEnv` is missing or `webauthnEnv.authData` / `webauthnEnv.clientData` is missing.
2. Reject if `pubJwk` is not `{ kty: "EC", crv: "P-256", ... }`.
3. Reject if `sigRawB64u` is empty.
4. Compute `payloadHashB64u = await hashPayloadToB64url(payload)`.
5. Decode and JSON.parse `webauthnEnv.clientData`. Reject if not valid JSON.
6. Reject unless `clientData.type === "webauthn.get"`.
7. Origin handling:
   - If `expectedRpOrigin` is provided and non-null: reject unless `clientData.origin === expectedRpOrigin`.
   - Else: maintain a hardcoded allowlist `["https://irlid.co.uk", "https://bunhead.github.io", "http://localhost:8000", "http://127.0.0.1:8000", "http://localhost:3000", "http://127.0.0.1:3000"]` and reject if `clientData.origin` is not in it.
8. Reject unless `clientData.challenge === payloadHashB64u` (string b64url comparison).
9. Decode `webauthnEnv.authData`. Reject if length < 37.
10. Reject if `(authData[32] & 0x04) !== 0x04` — UV flag must be asserted.
11. Compute `signedBytes = authData || SHA-256(clientDataJSON bytes)`.
12. Verify `crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, importedPub, b64urlDecode(sigRawB64u), signedBytes)`. Return the boolean.

Throw a descriptive `Error` on any verification failure (not return false). The dispatching caller will catch and log.

**Reference implementation:** Copy directly from `js/sign.js` `irlidV5VerifyEnvelope`. The Worker's Web Crypto behaves identically to the browser's.

**Acceptance:**

- A unit-style smoke (curl + a hand-rolled v5 receipt) verifies.
- A v5 receipt with mutated payload throws "challenge does not match".
- A v5 receipt from `https://evil.example` throws "origin not in allowlist".
- A v5 receipt with UV flag cleared throws "UV flag not asserted".

**PR title:** `[codex] Worker v5 envelope verifier helper`

---

## Task 2 — Wire v5 envelope into `verifySignedHello()`

**Goal:** When a HELLO arrives with `v: 5` AND `offer.webauthn`, dispatch to `verifyV5Envelope()` instead of the v3 raw-hash path. v3/v4 HELLOs unchanged.

**Files:** `irlid-api/src/index.js`.

**Behaviour:** Modify `verifySignedHello(helloObj, tsTolS = 90)` to detect v5:

```js
const isV5 = !!(helloObj.offer.webauthn && Number(helloObj.v) === 5);

if (isV5) {
  try {
    await verifyV5Envelope(helloObj.offer.payload, helloObj.pub,
                           helloObj.offer.sig, helloObj.offer.webauthn);
  } catch (e) {
    return { ok: false, status: 401, error: "HELLO offer v5 envelope: " + (e.message || e) };
  }
} else {
  // existing v3 path: verifySig(computedOfferHash, helloObj.offer.sig, helloObj.pub)
}
```

Keep the existing timestamp checks — they apply to both versions. Update `verification_state` to `"v5_envelope_verified"` when v5 succeeds (vs the existing `"signature_verified"` for v3/v4).

**Acceptance:**

- Existing v3 HELLO smoke passes unchanged (regression test).
- Posting a hand-crafted v5 HELLO (manufactured with the test infrastructure from `tests/sign.test.js`'s `manufactureV5Envelope` helper) returns `{ ok: true, verification_state: "v5_envelope_verified" }`.
- Posting a v5 HELLO with `webauthn` field deleted returns `{ ok: false }`.
- Posting a v5 HELLO with mutated `offer.payload.lat` returns `{ ok: false, error: /v5 envelope: .* challenge/ }`.

**PR title:** `[codex] Worker v5 HELLO verification`

---

## Task 3 — Wire v5 envelope into `verifyReceipt()` + scoring

**Goal:** A v5 receipt (or a hybrid receipt where one side is v5 and the other is v3) verifies correctly through the existing `verifyReceipt()` + scoring code path.

**Files:** `irlid-api/src/index.js`.

**Behaviour:**

In `verifyReceipt(comb)`, change the per-side check:

```js
// Before (v3-only):
checks.a_sig = await verifySig(a.hash, a.sig, a.pub);

// After (v3 / v5 dispatching):
if (a.webauthn && Number(a.v) === 5) {
  try {
    await verifyV5Envelope(a.payload, a.pub, a.sig, a.webauthn);
    checks.a_sig = true;
    checks.a_v5_envelope = true;
  } catch (e) {
    checks.a_sig = false;
    checks.a_v5_envelope = false;
    checks.a_v5_error = e.message;
  }
} else {
  checks.a_sig = await verifySig(a.hash, a.sig, a.pub);
}
```

Same dispatch for the `b` side and for `hello.offer` (mirrors Task 2's HELLO logic).

**Scoring:**

When `checks.a_v5_envelope === true` AND `checks.b_v5_envelope === true`, raise the receipt's effective ceiling from 50/100 to 70/100 (per PROTOCOL.md §13.9). Do not raise if only one side is v5 — heterogeneous receipts can still verify but score at the lower of the two ceilings (currently v4's 50). This prevents v5 mis-claims via single-side enhancement.

**Acceptance:**

- Existing v3/v4 verification smoke passes unchanged (regression test).
- A fully-v5 receipt (both sides + hello have v5 envelopes) verifies and scores at the 70 ceiling.
- A hybrid receipt (one v3 side, one v5 side) verifies but scores at the 50 ceiling.
- A v5 receipt with `b.webauthn.authData` mutated returns `valid: false` with a clear `b_v5_error`.
- The unit-test smoke for `verifyReceipt` extends to cover at least: pure-v3, pure-v5, hybrid v3+v5, mutated-v5.

**PR title:** `[codex] Worker v5 receipt verification + scoring`

---

## Verification Required Per Task

- `node --check irlid-api/src/index.js` clean.
- Smoke test against deployed `irlid-api-test` Worker via curl with hand-rolled v5 payloads (use the `manufactureV5Envelope` helper logic from `tests/sign.test.js` to produce signed test receipts in a Node script).
- Live test environment regression: existing org-portal check-in flow (which produces v3 receipts) MUST still verify cleanly — no scoring regressions on real attendance rows.

## Stop Point

Stop after each task. Report PR link, deployment state, and the verification commands run.

## Out of Scope (Don't Touch)

- D1 schema changes (none needed).
- The live IRLid repo (`BunHead/IRLid`) — Worker work for v5 lands in the test env first per crew protocol §2.1, then we cherry-pick to live after a real-device smoke test on the Captain's hardware.
- Settings UI / enrolment flow — already done client-side in `settings.html` v5 panel.
- Live `js/sign.js` — already updated. The v5 path in `makeSignedHelloAsync` and `makeReturnForHelloAsync` dispatches to v5 only when `irlidV5Enabled() === true`; existing v3/v4 callers see no change.

## Notes for Mr. Data

- The reference `irlidV5VerifyEnvelope` in `js/sign.js` (and its 12-test suite in `tests/sign.test.js`) is the canonical behavioural specification. The Worker version should be a near-line-for-line port — Web Crypto on Workers and in browsers behaves identically for ECDSA P-256.
- The DER↔raw signature conversion (the standard WebAuthn footgun) is **already done client-side**. Receipts arriving at the Worker carry `sig` in raw `r||s` format. The Worker doesn't need DER conversion utilities.
- Mr. Data, when you arrive Tuesday: read this first, ratify-or-redirect against the design before opening the first PR. If you spot a v5 envelope-check rule that's wrong or missing, raise it before implementing — convergent fixes welcome (see DREAMS 2026-04-28 17:11), and PROTOCOL.md §13 is editable if the spec needs adjustment.
- 30 April calibration applies: "incorporate ≠ implement." Treat each task above as approved-for-implementation; do not speculatively expand scope.

— Number One, 1 May 2026
