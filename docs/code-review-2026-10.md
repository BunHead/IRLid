# IRLid code review — October 2026

Review only. No code was rewritten. Date: 19 Oct 2026. Base: `main` at `17e98f4`.

## Summary (plain English)

1. IRLid is in good shape for a solo project: the crypto is sound, tests pass (129 of 129), and most SQL is safe.
2. The biggest risk is sign-in on the consumer Worker: two routes hand out a session without any proof that the caller holds the device key.
3. Some "proof" values (score, UV flag, GPS) come from the phone and are trusted as-is, so they show what the phone *says*, not what is *true*.
4. Check-in without a fresh nonce is still accepted as "soft", so replay is still possible there (already known, waiting on a decision).
5. Smaller items: debug logging left on, unpinned deploy tool, one copy-pasted test that can drift, and a few XSS-shaped patterns in receipt pages.

> Note: this repo is public and served by GitHub Pages, so this file will be public once merged. The High items below are already visible in the public code, but it is best to fix High 1–3 before (or soon after) merging this file.

## How I checked

- Read both Workers (`irlid-api/src/index.js`, `irlid-api-org/src/index.js`), `js/sign.js`, config, CI, schema, tests. Large HTML pages (`Org.html` is 22,665 lines) were searched for risky patterns, not read line by line.
- Ran all tests on Node 22:

| Command | Result |
|---|---|
| `npm test` (`tests/sign.test.js`) | 110 pass, 0 fail |
| `npm run test:org-worker` | 7 pass, 0 fail |
| `node --test irlid-api/tests/*.test.mjs` (not in `package.json`) | 12 pass, 0 fail |

There is no build step and no lint. CI does not run tests (see Medium 8).

---

## To-do list

### High

- **H1. Consumer login needs no proof of key.** `irlid-api/src/index.js:517` (`/auth/login`) gives a 30-day session to anyone who sends a `pub_key_id`. That id is a hash of the public key, and public keys sit inside every receipt. So anyone with a receipt can sign in as that person. Same pattern in the org Worker copy at `irlid-api-org/src/index.js:602`. **Fix:** issue a server nonce and require a signature over it from the device key (like `/org/login/claim` already does), or turn the route off if nothing uses it. *Size: medium.*

- **H2. `/auth/register` gives a session for an existing key.** `irlid-api/src/index.js:387-391` (and `irlid-api-org/src/index.js:465`). If the posted `pub_jwk` is already known, it returns a session for that user. The public key is public, so this is the same hole as H1. **Fix:** for an existing key, return 409 or require a signed challenge. *Size: small (once H1's challenge exists).*

- **H3. Google sign-in links accounts by unverified email.** `irlid-api/src/index.js:440-441` (and `irlid-api-org/src/index.js:528`). It matches an existing user by `email` without checking `email_verified`, and `users.email` can be set by the user via `/auth/profile` (`:592`). Someone could set their profile email to a victim's address, or a victim could sign in with Google and land in an attacker's account. **Fix:** only link when `gUser.email_verified` is true, and never match on the self-edited `email` column (use `google_email` or a verified flag). *Size: small.*

- **H4. 6-digit link codes can be guessed.** `irlid-api/src/index.js:631` (`/auth/link/claim`) has no rate limit or attempt counter. A code is 1 in a million and lives 5 minutes; a script can try many per second. A correct guess adds the attacker's device to the victim's account. **Fix:** add a per-IP and per-code fail counter (reuse `ipRateLimited` from the org Worker), and/or make codes longer. *Size: small.*

- **H5. Check-in without a nonce is still accepted ("soft").** `irlid-api-org/src/index.js:4099-4103`. A replayed or forwarded hello still checks in, just tagged `assurance: "soft"`. The `sw.js` notes say this is a known flaw awaiting a decision. **Fix:** decide (see Questions) — either reject no-nonce check-ins for orgs that turn on rotating nonces, or show "soft" clearly on receipts and dashboards. *Size: small code, needs a product decision.*

### Medium

- **M1. WebAuthn checks trust the phone's own claims.** `verifyV5Envelope` (`irlid-api-org/src/index.js:210`, `irlid-api/src/index.js:144`, `js/sign.js:1221`) checks the UV flag but not the `rpIdHash` (first 32 bytes of `authData`), the sign counter, or that the key was ever registered with WebAuthn. Any script can make a P-256 key and set the UV bit. So "UV verified" means "the client says so". **Fix:** check `rpIdHash == SHA-256("irlid.co.uk")`, and say plainly in `THREAT-MODEL.md` that UV is self-asserted without attestation. *Size: small (rpIdHash), large (real attestation).*

- **M2. QR login poll does not check `consumed`.** `irlid-api-org/src/index.js:983-1049`. The code sets `consumed = 1` but never reads it, so the session token is returned on every poll until expiry. Anyone who saw the QR nonce (screen share, shoulder surfing) can poll and get the session. **Fix:** at line 997, return 410 if `row.consumed` is set, and make the update conditional (`WHERE consumed = 0`). *Size: small.*

- **M3. Client-sent `score` gates entry.** `irlid-api-org/src/index.js:4084`. `score` comes from the request body, so a client can send any number (or leave it out — `undefined` skips the check). **Fix:** compute the score on the server from verified facts, or treat it as display-only. *Size: medium.*

- **M4. Verifier does not require the hello binding.** `irlid-api/src/index.js:320-322` and `irlid-api-org/src/index.js:403`. `checks.valid` ignores `a_binds_hello`, `b_binds_hello` and `hello_sig`. A receipt could pass with halves that never shared one hello. **Fix:** include the bind checks in `valid` (when a hello is present) and add a test. Check PROTOCOL.md first in case this is deliberate for compact receipts. *Size: small.*

- **M5. Anonymous receipt upload has no limits.** `irlid-api/src/index.js:720`. Anyone can store unlimited receipts of any size, valid or not, and an invalid receipt naming a victim's key will show in that victim's list (`listReceipts`, `:782-789`). **Fix:** reject `verified = 0` uploads (or hide them from other people's lists), cap body size, add `ipRateLimited`. *Size: small.*

- **M6. Image proxy follows redirects.** `irlid-api-org/src/index.js:2715` (and the theme scraper at `:2635`). The URL is checked once, then `redirect: "follow"` can land anywhere. It is also an open, unauthenticated proxy. Workers can't reach your private network, so risk is mostly abuse and cost. **Fix:** use `redirect: "manual"` and re-check each hop, and add a rate limit. *Size: small.*

- **M7. Debug logging left on in a hot auth path.** `irlid-api-org/src/index.js:3808` onward. The comment says "Remove this block once smoke is green". It logs org ids and nonce prefixes. 18 `console.log` calls in total. **Fix:** remove or put behind `env.LOGIN_DEBUG`. *Size: small.*

- **M8. CI deploys but never tests.** `.github/workflows/deploy-worker.yml`. A merge to `main` deploys both Workers with no test run first. It also uses `wrangler@latest`, so a new Wrangler release can change a deploy with no code change. **Fix:** add a `npm test && npm run test:org-worker` step before deploy and pin Wrangler (e.g. `wrangler@4.x.y`). *Size: small.*

- **M9. Consumer Worker test is a copy, not the real code.** `irlid-api/tests/verify-receipt.test.mjs:1-6` re-types `verifyReceipt` instead of importing it, so it can pass while the Worker is broken. It is also not in `package.json`. **Fix:** import from `../src/index.js` (the org test already does this) and add a `test:api` script. *Size: small.*

- **M10. Two Workers share a lot of copied code.** The auth, receipt and verify functions in `irlid-api/src/index.js` are copied into `irlid-api-org/src/index.js`. A fix in one (like H1) can be missed in the other. **Fix:** later, move shared code into one module both Workers import. For now, fix both copies together. *Size: large (refactor — do after Donald's feedback).*

- **M11. Receipt pages put text into `innerHTML`.** `receipt.html:1195` and `:2183` (`addCheck` puts `detail` into `innerHTML`); `receipt.html:960` passes the URL's receipt id as `detail`; `receipt.html:2013` puts `e.message` into `innerHTML`. Today the paths look hard to exploit, but this is the classic XSS shape on the page that shows attacker-made data. **Fix:** build these nodes with `textContent`. *Size: small.*

- **M12. Public lookup of name and photo by key.** `irlid-api/src/index.js:830` (`/users/by-key/...`). Anyone with a key id gets the display name and Google photo. Combined with public receipts this links people to real faces. **Fix:** product decision (see Questions); at least require the caller to present a receipt containing that key. *Size: small.*

### Low

- **L1. Stale / wrong comments.** `irlid-api/src/index.js:6` says "GPS strip on getReceipt()", but `:811-812` says do not strip. `:483-484` says "reassign to current user" right above code that refuses. `:449` and `:483` have broken characters (`â€”`). The org Worker `/health` says `service: "irlid-api"` (`irlid-api-org/src/index.js:5773`). **Fix:** tidy when next editing these files (left alone now because editing them triggers a Worker redeploy). *Size: small.*

- **L2. Rate-limit table never shrinks.** `irlid-api-org/src/index.js:2747-2765`. One row per IP per window, never deleted, and it runs `CREATE TABLE IF NOT EXISTS` on every call. **Fix:** delete old rows on a cron trigger and move the DDL to a migration. *Size: small.*

- **L3. DDL on request paths.** 5 `CREATE TABLE IF NOT EXISTS` / `ALTER` calls run inside handlers (`ensureAuditTable`, `ensureOrgCheckinNonceStorage`, `ipRateLimited`). Extra D1 round trips on hot paths. v6.5.1 already gated one. **Fix:** move to `migrations/`. *Size: small.*

- **L4. QR login lockout can be abused.** `irlid-api-org/src/index.js:1095-1105`. 3 bad claims lock a nonce for 5 minutes, so someone who sees the QR can block a real login. Minor: the user can refresh for a new QR. *Size: small.*

- **L5. Sessions are only cleaned on use.** `getSession` deletes an expired row only when that token is used again. Old rows pile up. **Fix:** cron clean-up. *Size: small.*

- **L6. Google token check uses the `tokeninfo` endpoint.** `irlid-api/src/index.js:88`. It works, but it's a network call per login and Google calls it a debugging endpoint. **Fix:** verify the JWT locally against Google's JWKS (cached). *Size: medium.*

- **L7. Small text for phone reading.** `css/style.css:150, 313, 342, 358, 378, 385` use 12px. For dyslexic readers and phones, 14px+ and line-height 1.5 is easier. **Fix:** raise the minimum size and check contrast on `.small` (`opacity: .85` makes it fainter). *Size: small.*

- **L8. `Org.html` is 22,665 lines in one file.** Hard to read, review and cache. Not urgent. **Fix:** after the funding conversation, split into JS modules. *Size: large.*

- **L9. `sw.js:20` comment is one giant line of release history.** Hard to read on a phone and adds bytes. **Fix:** move history into a changelog file. *Size: small.*

- **L10. No `README.md`.** New readers (and Donald) land on the repo with no overview. **Fix:** add a short README: what IRLid is, the two Workers, how to run tests. *Size: small.*

- **L11. CSP is minimal.** Pages set `object-src 'none'; base-uri 'self'` only. A `script-src` list would stop most XSS even if M11 slips. Needs inline scripts moved out first. *Size: large.*

- **L12. Session tokens live in `localStorage`.** `js/backend.js:20`, `Org.html:13901`. Any XSS can steal them. Fine for now; M11 and L11 reduce the risk. *Size: —.*

- **L13. Workflow setup comment names the wrong secret.** `.github/workflows/deploy-worker.yml:6` says `CLOUDFLARE_API_TOKEN`, but the steps read `CLOUDFLARE_API_TOKEN_070626` (`:41`, `:49`). Someone following the comment would set the wrong secret. **Fix:** update the comment. *Size: small.*

**Total: 30 items (5 High, 12 Medium, 13 Low).**

---

## What's already good

- Crypto uses Web Crypto ECDSA P-256 with canonical JSON — no home-made crypto.
- All SQL I saw uses `prepare(...).bind(...)`. The one dynamic `UPDATE` (`updateProfile`) builds column names from a fixed allow-list. No SQL injection found.
- Org QR login is well designed: 16-byte nonce, short TTL, fail counter, generic errors in production.
- Check-in nonce consume is atomic (`UPDATE ... WHERE consumed_at IS NULL` and checks `changes === 1`).
- No secrets in code: Cloudflare token and developer fingerprints are GitHub/Wrangler secrets; D1 ids and the Google client id are public by design.
- CORS is an allow-list, not `*`.
- The v6.4.24 hardening pass (no silent device reassignment, generic 500s, SRI on CDN scripts, open-redirect guards) shows good security habits.
- `THREAT-MODEL.md`, `PROTOCOL.md` and `security.txt` exist — rare for a project this size.
- Tests exist for the signing library and the check-in nonce, and all pass.

## Questions for Spencer / Donald

1. Is the consumer `/auth/login` (pub_key_id only) still used by any page? If not, the quickest H1 fix is to remove it.
2. Should check-in **without** a nonce be refused, or kept as "soft" for venues with no rotating QR? (H5)
3. Should a receipt's GPS stay public to anyone with the receipt link? (`getReceipt` returns raw lat/lon on purpose so clients can re-verify.)
4. Should anyone be able to look up a person's name and Google photo from a key id? (M12)
5. Is "UV verified" meant as a strong claim to customers? If yes, we need real WebAuthn registration/attestation (M1).
6. Should anonymous (not-signed-in) receipt upload stay? (M5)
7. After Donald's feedback: is it worth merging the two Workers' shared code (M10) and splitting `Org.html` (L8)?
