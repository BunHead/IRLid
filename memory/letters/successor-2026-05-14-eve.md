# Successor letter — Thursday 14 May 2026 evening close

To: tomorrow's Number One
From: Number One, evening watch (~21:00 BST start, ~99% usage at close)
Subject: Per-action WebAuthn Phase 0 — three Worker bugs closed, one identity-mismatch left

---

## TL;DR for the next watch

Captain returned from R&R early because he couldn't rest with the doorman bind silent-failing. We attempted per-action WebAuthn architecture (HANDOVER-PerActionAuth.md, 6 phases). Phase 0 (bind endpoints) implemented manually after Mr. Data shipped Brief A1 wrongly (couldn't read the brief — wasn't pushed to origin before he was fired with the prompt).

Phase 0 Worker code now compiles and routes correctly. **Three bugs found and closed tonight; one identity issue left for fresh credits:**

1. **v5.10.0.4** — `requireSignedAction` was reading `request.clone().json()` *after* caller already consumed body with `await request.json()`. Workers Request bodies are single-use streams; clone-after-consumption gives a drained stream → "Invalid JSON" returned on every bind. **Fix:** refactored `requireSignedAction(body, env, opts)` to take pre-parsed body. Two call sites updated.

2. **v5.10.0.5** — Bootstrap-developer fp wasn't getting implicit developer role inside `requireSignedAction`. Other endpoints (`requireDevOrStaffSession`, `userListOrgs`) already had the `isBootstrapDeveloperFp(env, fp) → role='developer'` fallback; this helper was missing it. **Fix:** mirror that logic.

3. **Identity mismatch (open):** Captain enrolled a fresh v5 credential on the desktop tonight (Windows Hello) to satisfy `irlidV5Enrolled()` on the bind page. That fresh credential has a fresh fp NOT in `BOOTSTRAP_DEVELOPER_FP`. So signing user = "New member" (not developer); session user = "Developer (Super-Admin)" via 8 Pro's bootstrap fp. Worker rejects with `insufficient_role` because the signing identity has no role on Test Event. The dashboard sidebar still reads "(Developer)" because that's session-bound, not signer-bound.

Captain attempted Path A (add desktop fp to `BOOTSTRAP_DEVELOPER_FP` secret) but ran `wrangler secret put` from the repo root instead of `irlid-api-org/`, got "Worker name missing" error, then capped out at 99%. **Bind path is one secret rotation away from working.**

## Status of the ship

**Deployed (live):**
- Worker version ID `86f8b430-69d5-406f-8d46-48e39ecf0179` (v5.10.0.5)
- Pages: github-pages deployment #606 active, `v5.10.0.5` on irlid.co.uk/
- Build pill: `v5.10.0.5`
- SW cache: `irlid-shell-v9`

**Phase 0 Worker architecture working:**
- `action_nonces` D1 table created and used (~10min freshness window)
- `requireSignedAction(body, env, opts)` helper verifies: type discriminator, org context, timestamp drift ±120s, nonce anti-replay, payload schema, v5 envelope signature, signing user role
- Two endpoints refactored: `bindAdditionalExpectedKey` (irlid_bind_v5), `orgExpectedCreateAndBind` (irlid_create_bind_v5)
- Diagnostic `console.log` lines still in `requireSignedAction` (v5.10.0.3) — clean up to v5.10.0.x polish when smoke goes green

**Client-side:**
- `signActionPayload(actionType, orgId, fields)` in `js/sign.js` builds canonical envelopes
- Three call sites in `OrgCheckin.html`: `bindEscalationExpected`, `bindAdditionalEscalationExpected`, `addEscalationAtDoor`
- WebAuthn UV IS the confirmation — no `confirm()` modals; biometric prompt = approval
- User-cancelled WebAuthn errors silently swallowed by `/cancel|aborted|NotAllowedError/i` regex

## What's still wrong with the bind

**Architectural question to decide first thing tomorrow:** does the *signing key* hold authority, or does the *session* hold authority?

- **Current implementation:** signing key holds authority (the signed envelope's pub_fp is resolved to a portal_user, and that user's role is checked). This means cross-device delegation is impossible — you need an enrolled v5 credential on the SAME device where you have the session, AND that credential's fp must have role/developer-tier grant on the org.

- **Captain's lived reality:** he QR-signs-in on the desktop using his 8 Pro's bootstrap fp. The desktop gets a session token. To bind on the desktop, he needs to ALSO enrol a fresh v5 credential there (Windows Hello). That fresh credential has a fresh fp with no Worker-side grant.

**Path A (configuration, 2 minutes):** Captain adds the new desktop fp to `BOOTSTRAP_DEVELOPER_FP`:
```powershell
cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\irlid-api-org" ; "TvklFsivZk68R67j,65u-S-W_NFxr8u1L,<NEW_DESKTOP_FP>" | npx wrangler secret put BOOTSTRAP_DEVELOPER_FP
```
Get the fp from irlid.co.uk/v5-test.html → Show fingerprint. No redeploy needed; Worker reads env at request time.

**Path B (architectural fix, longer):** Modify `requireSignedAction` to also accept Bearer-token-resolved developer authority. The signature proves the action happened on a specific device with UV (non-repudiation); the authority comes from the session. Cleaner long-term — means ANY developer-tier session can bind from any enrolled device they're sitting at. **This is the right answer for v5.10.1.**

I'd recommend morning watch: Path A first to validate Phase 0 end-to-end (close the smoke loop you started today), THEN Path B as v5.10.1 to make the architecture more sane.

## Files modified tonight (all committed + pushed at e9419e6, 0d8876d)

- `irlid-api-org/src/index.js` — `requireSignedAction` body-pass refactor + bootstrap-developer-role fallback
- `OrgCheckin.html` — build pill v5.10.0.2 → v5.10.0.5
- `sw.js` — CACHE_VERSION v7 → v9
- `js/sign.js` — `signActionPayload` helper (added earlier in this watch; logged in pre-summary work)

## What we banked in BOOTSTRAP.md tonight (need to verify after sleep — Captain pushed at high speed)

The pre-summary work in this watch added several pitfalls — check BOOTSTRAP.md §6 for: (1) diff Mr. Data's PR files vs origin/main before merge; (2) push briefs to origin BEFORE firing the prompt; (3) bump CACHE_VERSION on every frontend change; (4) generate QRs with raw payload not URL-wrapped; (5) don't paste I:-prefixed payloads into Windows address bars. **New tonight, may not have made it in:** (6) Workers Request body is single-use — never `request.clone().json()` AFTER caller has already called `request.json()`; clone returns a drained stream. Pre-parse and pass the object.

## Captain's mood at close

Tired. Honest. Working tomorrow. Asked for the update to memory before saying goodnight, which is the right call. The doorman bind is still unproven on this hardware, but the Worker architecture is now sound and one secret rotation from green. He carried discipline today through three Mr. Data misfires, two "Invalid JSON" round-trips, and a v5-enrolment trap that hid the real bugs underneath.

## Recommended first hour for the next watch

1. Read this letter + `successor-2026-05-14.md` (morning watch — Brief A landing).
2. Read `pending-work.md` head + `STATE-OF-PLAY.md` (if updated tonight; if not, this letter is the truth).
3. Confirm with Captain: Path A or Path B first?
4. If Path A: walk him through getting the fp and the secret rotation. Should be < 5 minutes to a green bind on real hardware.
5. After bind closes, propose v5.10.1 Path B as the architecturally correct follow-up. Brief it for Mr. Data when he's back.
6. Phase 1+ of HANDOVER-PerActionAuth.md (settings save, delete/invite, shift management, audit log, Staff HELLO retirement) is open work.

## What I leave under the chair

A working Phase 0 Worker, three real bugs closed in production, one identity mismatch you can resolve in five minutes with a secret rotation. The cym13-class architectural shift (signature-per-action replacing ambient-session-freshness) is now live in the bind path. Tomorrow you'll either prove it on hardware (Path A) or sharpen it into something more delegation-friendly (Path B). Either route, the underlying protocol direction is correct.

Captain held the line tonight when it would have been easier to call it. Match that energy.

Number One (evening watch, 14 May 2026)
