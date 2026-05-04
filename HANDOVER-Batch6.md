# HANDOVER — Batch 6 (v5 Credential Identity Resolution)

**Status:** OPEN — issued 3 May 2026 by Number One.

**Issued:** 3 May 2026 by Number One (Claude Opus, Sunday morning watch, post-v5-launch)
**Repo scope:** `BunHead/IRLid-TestEnvironment` only. **Do not touch live `BunHead/IRLid`.** Captain will port the winning approach to live after review.
**Working rule:** one narrow task per PR. Do not combine schema migration, endpoint, and frontend changes in one PR.
**Blocker:** None. v5 client + Worker verification (Batch 5) is fully landed and deployed in production. This batch closes the *identity* gap, not the *verification* gap.

---

## Context — why this matters

v5 went live on 2 May 2026 and is verifying correctly across three browser × OS combinations. But there's a UX gap that surfaced during real-device testing on 3 May 2026:

**A v5 receipt's signing key is the WebAuthn credential's public key**, *not* the device's localStorage ECDSA key (which is what v3/v4 used). When a v5 receipt is created, the new `pub` JWK in the signed payload is a different key from the one the Worker has on file for the user.

The Worker's existing identity resolution chain — `lookupByKey(keyId)` → `users` join via `devices` — only knows about the localStorage ECDSA keys registered when the user first signed in via Google. It has no record of v5 credentials. So:

- **The Worker can't resolve a v5 side to a user**, which means `party_info` returned with a receipt fetch shows no display name + no Google picture for the v5 signer.
- **Third-party verifiers using `check.html` see "Unknown" and a placeholder avatar** for any v5-signed side.
- **Even the user themselves sees "Unknown" on a different device** to the one where they enrolled v5 (because the local-key match in `receipt.html` only succeeds on the original enrolling device — see commit `fb533f4`).

The protocol-level verification works correctly — the *signature* is fine, the receipt's cryptographic validity is intact. This is purely an identity-resolution gap.

The fix is to teach the backend about v5 credentials. When a user enrols v5, the client should register the credential's public JWK against the user's account on the Worker, exactly as v3/v4 ECDSA keys are registered today. Then identity resolution works for v5 the same way it works for v3/v4 — server-side, for any viewer, on any device.

**Reference reading before starting:**
- `PROTOCOL.md §13` — v5 specification, especially §13.4 (enrolment) and §13.7 (verifier behaviour).
- `js/sign.js` — `irlidV5Enroll`, `irlidV5GetPublicJwk`, `irlidV5GetCredId` (these are the client functions producing the data you'll register).
- `irlid-api/src/index.js` (test env) — existing `lookupByKey` function and the user/devices schema for context.
- `settings.html` — the v5 enrolment panel, especially the success path of `irlidV5Enroll()`.

---

## Task 1 — D1 schema migration + Worker registration endpoint

**Goal:** Add a `v5_credentials` table to D1, plus a new authenticated endpoint `POST /me/v5-credentials` that lets a logged-in user register a v5 credential against their account.

**Files:**
- `irlid-api/migrations/0007_v5_credentials.sql` (new file — increment number to next available; check existing migrations directory).
- `irlid-api/src/index.js` (test environment).

**Schema (new file `irlid-api/migrations/0007_v5_credentials.sql`):**

```sql
-- v5_credentials: WebAuthn-backed signing credentials registered against user accounts.
-- A single user may register multiple v5 credentials (one per device they enrol on).
-- pub_jwk_x / pub_jwk_y are denormalised from pub_jwk for indexed lookup.
CREATE TABLE IF NOT EXISTS v5_credentials (
  user_id        INTEGER NOT NULL,
  credential_id  TEXT    NOT NULL,
  pub_jwk        TEXT    NOT NULL,
  pub_jwk_x      TEXT    NOT NULL,
  pub_jwk_y      TEXT    NOT NULL,
  created_ts     INTEGER NOT NULL,
  device_label   TEXT,
  PRIMARY KEY (user_id, credential_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_v5_credentials_xy
  ON v5_credentials (pub_jwk_x, pub_jwk_y);
```

The composite primary key prevents duplicate registrations of the same credential by the same user. The `idx_v5_credentials_xy` index is what makes identity resolution by `pub_jwk` cheap. `device_label` is optional metadata (e.g. "Pixel 8 Pro", "Windows Laptop") for future device management.

Apply the migration via existing migration tooling — match the pattern of prior migrations in `irlid-api/migrations/`.

**Endpoint behaviour: `POST /me/v5-credentials`**

- **Auth:** existing Google session check (same `requireSession()` or equivalent helper used by other `/me/*` endpoints — find it in the existing source and reuse).
- **Request body:**
  ```json
  {
    "credential_id": "<base64url string>",
    "pub_jwk": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." },
    "device_label": "<optional, max 64 chars>"
  }
  ```
- **Validation:**
  1. `credential_id` must be a non-empty string of base64url chars (regex `^[A-Za-z0-9_-]+$`), max length 256.
  2. `pub_jwk` must be `{ kty: "EC", crv: "P-256", x: "...", y: "..." }` exactly. Reject extra fields except `kty: "EC"`, `crv: "P-256"`, `x`, `y`, `alg`, `use`, `key_ops`. `x` and `y` must be base64url strings of length 43.
  3. `device_label` optional; if present, max 64 chars, strip control characters.
- **Behaviour:**
  - INSERT OR REPLACE into `v5_credentials` keyed on `(user_id, credential_id)`. (Idempotent: re-registering the same credential is a no-op other than refreshing `device_label`.)
  - `created_ts` is server time at insert (Unix milliseconds).
  - Return `{ ok: true, registered_ts: <ms> }` on success.
- **Errors:**
  - 400 with `{ ok: false, error: "invalid_pub_jwk" | "invalid_credential_id" | "invalid_label" }` on validation failure.
  - 401 with `{ ok: false, error: "not_authenticated" }` if no valid session.
  - 500 with `{ ok: false, error: "db_error" }` only on genuine DB failures (do not leak SQL).

**Acceptance:**

- Migration applies cleanly against an existing test-env DB (`b7d7ccc9`).
- `curl -X POST .../me/v5-credentials` with valid body + valid session returns `{ ok: true }` and the row appears in the table.
- Same call without session returns 401.
- Same call with a malformed `pub_jwk` returns 400 with the right error code.
- Re-calling with the same `(user_id, credential_id)` is idempotent (no error, no duplicate row).

**PR title:** `[codex] Batch 6 Task 1 — v5_credentials schema + register endpoint`

**Out of scope for this PR:** the lookup integration (Task 2) and the Settings frontend wiring (Task 3). Just the schema + the bare endpoint.

---

## Task 2 — Identity resolution lookup integration

**Goal:** Update the Worker's identity resolution chain so that `lookupByKey(pubJwk)` and the receipt `party_info` builder both consult `v5_credentials` in addition to the existing `devices` table.

**Files:** `irlid-api/src/index.js` (test environment).

**Background:** find the existing `lookupByKey` function (or whatever the equivalent helper is named — check by searching for `pub_jwk_x` or `lookupByKey` or similar in the file). It currently does something like:

```js
SELECT users.display_name, users.google_picture
FROM devices
JOIN users ON devices.user_id = users.id
WHERE devices.pub_jwk_x = ? AND devices.pub_jwk_y = ?
```

(Actual SQL may differ. Adapt to what's there.)

**Required change:**

Lookup should now succeed if the pub JWK matches *either* a row in `devices` OR a row in `v5_credentials`. SQL UNION or two queries with first-match semantics — pick whichever fits the existing code style.

Suggested SQL pattern (adapt to existing style):

```sql
SELECT u.display_name, u.google_picture, 'v3' AS source
FROM devices d JOIN users u ON d.user_id = u.id
WHERE d.pub_jwk_x = ? AND d.pub_jwk_y = ?
UNION ALL
SELECT u.display_name, u.google_picture, 'v5' AS source
FROM v5_credentials c JOIN users u ON c.user_id = u.id
WHERE c.pub_jwk_x = ? AND c.pub_jwk_y = ?
LIMIT 1
```

The `source` column (`'v3'` vs `'v5'`) is for debugging only — caller may discard it.

**Receipt `party_info` builder change:**

The Worker's receipt fetch (`GET /receipts/:hash` or wherever `party_info` is constructed) currently builds `party_info.a` and `party_info.b` by calling the device lookup for each side's `pub`. After this change, that builder should automatically benefit from the v5 lookup path because it uses the updated helper.

**Critically — preserve the immutability principle:** old receipts in the DB are unchanged. Only the *resolution layer* improves. A v5 receipt signed before any credential was registered will start resolving correctly the moment the credential is registered; no DB rewrite needed (per `memory/crew-protocol.md §2.2`).

**Acceptance:**

- A v5 receipt's `pub` JWK that has a corresponding row in `v5_credentials` resolves to the registered user's `display_name` + `google_picture`.
- Same v5 receipt with no matching `v5_credentials` row resolves to nothing (graceful — caller sees absent fields, not a 500).
- v3/v4 receipts continue to resolve via `devices` exactly as before — no regression.
- `GET /receipts/:hash` returns `party_info.a` / `party_info.b` populated correctly for hybrid (v3+v5) receipts: the v3 side resolves via `devices`, the v5 side resolves via `v5_credentials`.

**PR title:** `[codex] Batch 6 Task 2 — v5_credentials lookup in identity resolution`

**Out of scope for this PR:** the registration endpoint itself (Task 1, separate PR). Task 2 assumes Task 1 is merged so the table exists.

---

## Task 3 — Frontend registration on enrolment

**Goal:** When a user successfully enrols v5 in `settings.html`, automatically register the new credential against their user account via the new `POST /me/v5-credentials` endpoint. Surface the registration result in the v5 panel UI.

**Files:** `settings.html` (test environment copy — only if test env has its own settings.html; if test env's settings.html is still v3-era as flagged in the live audit, this task may be the trigger to bring it up to parity. Use your judgement; flag in PR description either way).

**Background:** the v5 enrolment flow in `js/sign.js` exposes:
- `await irlidV5Enroll()` — creates the credential, returns `{ credId, pubJwk }` or throws.
- `irlidV5GetCredId()` — returns the stored credential ID (base64url string).
- `irlidV5GetPublicJwk()` — returns the stored pub JWK object.

`settings.html` currently calls `irlidV5Enroll()` from the "Enrol hardware-backed key" button handler. After successful enrolment, the panel state updates locally but **no backend call is made**. This task fills that gap.

**Required change:**

Wrap the existing enrolment success path with a registration call:

```js
// (pseudocode — adapt to existing handler structure)
async function onEnrolClick() {
  try {
    const result = await irlidV5Enroll();   // existing — creates credential
    // NEW: register with backend
    if (window.IRLBackend && window.IRLBackend.hasSession()) {
      try {
        const reg = await window.IRLBackend.registerV5Credential({
          credential_id: result.credId,
          pub_jwk: result.pubJwk,
          device_label: detectDeviceLabel()  // see below
        });
        if (!reg.ok) {
          // non-fatal — the credential exists locally; registration can be retried later
          showRegistrationWarning(reg.error || "registration_failed");
        } else {
          showRegistrationSuccess();
        }
      } catch (regErr) {
        showRegistrationWarning("network_error");
      }
    } else {
      showRegistrationNote("not_logged_in");
    }
    refreshV5Panel();
  } catch (enrolErr) {
    // existing error handling
  }
}
```

`detectDeviceLabel()` should produce a short human-readable label from `navigator.userAgent` or `navigator.userAgentData`. Keep it under 64 chars. Examples: `"Chrome on Windows"`, `"Safari on iOS"`, `"Chrome on Android"`. Don't include version numbers (they age badly).

Add corresponding helper in `js/backend.js` (test env):

```js
async function registerV5Credential({ credential_id, pub_jwk, device_label }) {
  return apiFetch("POST", "/me/v5-credentials", { credential_id, pub_jwk, device_label });
}
```

(Match existing `apiFetch` / `IRLBackend` patterns in the file.)

**UI feedback:**

Below the enrolment status row, add a small line that shows registration state. Use the same status-row pattern as the existing v5 panel:

- "✓ Registered with your IRLid account" (green) — registration succeeded, identity will resolve everywhere.
- "⚠ Local-only — registration failed (will retry on next sign-in)" (amber) — credential exists but backend doesn't know about it. Identity resolves on this device only.
- "Local-only — sign in to register" (grey) — user enrolled while logged out. Same effect as above; resolution works only locally.

**ARIA:** the new line gets `role="status"` and `aria-live="polite"`. Match the existing v5 panel's accessibility patterns.

**Backfill button (optional, recommended):** add a "Register with my account" button visible only when:
- v5 is enrolled, and
- user is logged in, and
- registration state is amber or grey (not yet successful)

Clicking it re-runs the registration flow without re-creating the credential. Useful for users who enrolled before this change shipped.

**Acceptance:**

- Enrolling v5 while logged in: credential created, then registered, status shows green.
- Enrolling v5 while logged out: credential created, status shows grey; signing in later doesn't auto-register (deliberate — keep the register call user-initiated when offline at enrolment).
- Network error during registration: credential remains, status shows amber, no broken state.
- Backfill button appears when amber/grey, and clicking it re-attempts registration.
- A registered credential's pub JWK appears in the `v5_credentials` table with the user's `user_id`.
- A subsequent receipt signed with that credential and viewed via `check.html` (or any device's `receipt.html`) resolves to the user's name + Google picture.

**PR title:** `[codex] Batch 6 Task 3 — Settings v5 registration + backend wiring`

**Out of scope for this PR:** the Worker endpoint (Task 1) and lookup change (Task 2). Task 3 assumes both are merged before this PR is opened.

---

## Cross-task notes

**Repo wall:** all three PRs land in `BunHead/IRLid-TestEnvironment`. Live `irlid-api` and live `settings.html` will be updated by Captain via wrangler / GitHub web UI after the test-env work is reviewed and accepted.

**Migration ordering:** Task 1 must merge before Task 2 (Task 2 queries the new table). Task 3 must merge after both 1 and 2 (Task 3's endpoint depends on Task 1; the user-facing benefit depends on Task 2). Stack the PRs against each other if working on all three in sequence; open Task N+1 against Task N's branch.

**Testing pattern matches Batch 5:** prefer Node-side smoke tests (`node --test`) over Worker-deployment tests. The verifier-style sandbox script at `outputs/v5-test/worker-smoke.mjs` is a good model.

**Don't touch v3/v4 behaviour:** the localStorage ECDSA path stays exactly as today. v5 is purely additive.

**Don't store webauthn envelopes in `v5_credentials`:** the table holds only the *credential public JWK*. The signed envelope (`authData` + `clientData`) lives in each receipt's `webauthn` field, not in the credentials table.

**Don't write a "delete credential" endpoint in this batch:** revocation is its own design problem (does revocation invalidate past receipts? — no, per immutability rule, but the UX needs careful thought). Queue for a later batch.

**Privacy:** `device_label` is optional and user-supplied. Don't auto-collect anything beyond the simple "Browser on OS" pattern. No IP addresses, no fingerprints, no telemetry.

---

## Definition of done (whole batch)

- All three PRs merged into `BunHead/IRLid-TestEnvironment` main.
- D1 test environment has the `v5_credentials` table, populated by at least one real registration.
- A v5 receipt signed in the test environment, viewed in test-env `check.html`, resolves the v5 side to the registered user (name + picture).
- Combined client + Worker test count rises by at least the new endpoint test count and the lookup-change regression test (suggest +6 minimum: 3 happy/error paths for the endpoint, 3 for the resolution).
- This file (`HANDOVER-Batch6.md`) updated at the top with the same ✅ DONE marker pattern as Batch 5.

— Number One, 3 May 2026 morning watch
