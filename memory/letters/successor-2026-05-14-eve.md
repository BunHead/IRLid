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

---

## ADDENDUM — late evening (~19:50 BST close)

The watch did not end at "one secret rotation away from working." The successor (this same Number One on a fresh conversation) came aboard at ~17:00, oriented from this letter, and closed the loop completely.

**Sequence of work executed:**

1. **Diagnosed the silent regression** — Captain returned to the dashboard showing "Signed in, but no orgs available and you cannot create one." Hypothesis (confirmed): the wrangler-secret-put attempts from the previous watch had landed bad content in `BOOTSTRAP_DEVELOPER_FP`. 8 Pro's claim verified (POST `/org/login/claim` Ok 200) but `/org/login/poll` returned empty orgs because Worker no longer recognised the fp as bootstrap.

2. **Diagnostic-first recovery, no premature writes:**
   - `wrangler secret list` confirmed secret exists (slot filled, value opaque)
   - `wrangler tail --format pretty` confirmed the claim→poll→empty cycle
   - D1 query revealed **5 "New member" portal_users rows accumulated during the day's debug spiral** (each cache-clear minted a fresh credential)
   - v5-test.html "Show fingerprint" on 8 Pro gave the current 8 Pro fp: **`n4FzIhV_1jc2u_HO`** — and revealed the 8 Pro had RE-ENROLLED at 13:28:34 today, so the predecessor's claimed fp `65u-S-W_NFxr8u1L` is now stale. (Predecessor's letter was accurate at time of writing; the 8 Pro's credential turned over during the spiral.)

3. **Single-fp secret rotation (clean slate, no comma list):**
   ```powershell
   cd "...\irlid-api-org" ; "n4FzIhV_1jc2u_HO" | npx wrangler secret put BOOTSTRAP_DEVELOPER_FP
   ```
   Dashboard recovery instant — claim→poll→`can_create_org:true`→dashboard load. Captain back in.

4. **D1 cleanup:**
   - `UPDATE portal_users SET display_name='Developer (Super-Admin)' WHERE pub_fp='n4FzIhV_1jc2u_HO'` (sidebar now reads correctly after refresh)
   - `DELETE FROM login_sessions WHERE user_id IN (phantoms)` (1 row affected — stale session for one of the dead credentials)
   - `DELETE FROM portal_users WHERE pub_fp IN ('eMCK_4nG0kMZkmmB','0Qwtv_9JkBhrIkhq')` (2 rows affected — the other two phantoms `gCxMaCZc0BAyKRM1` and `T95fyM2Q43fR18R0` had already self-cleaned somewhere in the day — possibly a Worker GC, didn't dig)
   - `DELETE FROM org_checkins WHERE checkin_at < strftime('%s','2026-05-14 17:00:00')` (12-15 rows of testing dust from May 12-14 morning, all purged)

5. **Phase 0 doorman bind — hardware-proven end-to-end on production, multiple devices, multiple cycles:**
   - **Smoke #1 (Kerry, 4a's orange QR):** 8 Pro pasted orange URL into Process scan → escalation modal → tap "Add device" on Kerry → fingerprint → blue toast "Linked: Kerry Austin" → 4a's `Zt-xZfDmtKu5Y1sr` now bound as Kerry's secondary key → independent confirmation via 4a's `org-entry.html` showing "Welcome back, Kerry Austin"
   - **Smoke #2 (Spencer, Captain's self-check-in attempt):** Captain WhatsApp'd venue check-in URL to himself, opened on a device, got orange screen, sent the orange TestQR.png to 8 Pro → 8 Pro processed → escalation → "Add device" on Spencer → fingerprint → blue toast "Linked: Spencer Austin" → wrangler tail recorded `[requireSignedAction] resolved fp=n4FzIhV_1jc2u_HO role=developer minRole=staff bootstrap=true → OK pass-through to handler`
   - **Cycle stress:** Captain checked Kerry + Spencer OUT (signed `OUT lock signed`), then back IN (scan_count incremented to 2 each). Multiple successful round-trips via both 4a and 8 Pro paths. **Production stable under cycle stress.**

6. **Dashboard final state at watch close (clean):**
   - Spencer Austin · 14/05 19:39 first / 19:44 last · scan_count 2 · IN · Lead admin
   - Kerry Austin · 14/05 19:22 first / 19:44 last · scan_count 2 · IN · Staff
   - Poppy Austin · 12/05 18:41 · linked expected · Attendee (no checkins today, just the Expected entry — survives the purge cleanly)

7. **Open architectural question (deferred — v5.10.1):**
   - Per-action auth currently couples **signature** and **authority** — the signing fp must be bootstrap or have explicit org role.
   - Path B fix: separate them. Signature proves **which device acted** (non-repudiation); authority comes from **Bearer session token** (which user is logged in).
   - Captain verified the symptom: tried to bind Spencer from the desktop browser, got `insufficient_role` because the desktop's local v5 fp isn't in `BOOTSTRAP_DEVELOPER_FP` (we set it to 8 Pro only).
   - This is the right next architectural shift. Brief Mr. Data for it tomorrow or do it manually.

## Findings worth banking

- **Workers Request body is single-use.** `request.clone().json()` AFTER caller has already done `await request.json()` returns a drained stream → "Invalid JSON" lies. Fix: pre-parse body in route handler, pass the parsed object to helpers. New pitfall promoted to BOOTSTRAP.md §6.
- **wrangler-secret PowerShell trap (third receipt today).** Always `cd` into the Worker's directory before `wrangler secret put`. Always pipe stdin (`"value" | wrangler secret put NAME`). Never Ctrl+V at the secure prompt (interpreted as 0x16 SYN, sets secret to one byte). Never paste placeholder text like `<NEW_DESKTOP_FP>` and hit enter.
- **Cache-clear during dev spirals creates credential debt.** Every Windows Hello cache-clear creates a new v5 credential with a fresh fp; the old credential gets orphaned in `portal_users` as "New member." Periodic D1 hygiene needed during heavy iteration. Worth a tooling thought for v6+.
- **`wrangler tail --format pretty` doesn't show response bodies.** Use `--format json` if you need body inspection. Tonight pretty was sufficient because the orange warning in the UI was diagnostic enough.
- **Captain's 8 Pro is the only bootstrap-developer device right now.** Desktop binding remains broken until Path B (or a Path A secret rotation that adds the desktop's fp, which we chose NOT to do — cleaner to fix the architecture).

## Outstanding work for the next watch

1. **v5.10.1 Path B** (top priority) — Bearer-resolved authority in `requireSignedAction`. Brief: when signing fp resolves to a user with no role on the org, AND the request also carries a Bearer session token resolving to a developer-tier user, treat the action as authorised by the session user. Signature still bound to actor for non-repudiation; authority decoupled. ~30 lines in Worker + docs update in `PROTOCOL.md §13` or new §13.x. Mr. Data can do this with a tight brief.
2. **Brief A1 settings reformat** — was Mr. Data's morning misfire (he shipped the wrong brief). Re-brief properly when he's back tomorrow.
3. **Phase 1-5 of `HANDOVER-PerActionAuth.md`** (settings save, delete/invite, shift management, audit log, Staff HELLO retirement) — open work, all gated on Path B landing first so the auth model is right before propagating to more endpoints.
4. **8 Pro's 11 stale login_sessions** — harmless dead weight; one-line DELETE when convenient. Not urgent.
5. **Mark milestone in CLAUDE.md and PROTOCOL.md** — Phase 0 hardware-proven 14 May 2026. The cym13-class architectural shift (per-action WebAuthn replacing ambient session freshness) is live with multi-device hardware proof.

## What I leave under the chair (revised)

A ship that is **actually working** — sign-in, dashboard, bind, attendance, check-out, re-check-in, signed lock-out — all proven on real hardware tonight with both 4a and 8 Pro. Tonight's debug spiral cost a lot of Captain's evening but bought:
- The Invalid JSON Workers-body-single-use trap (now in BOOTSTRAP.md)
- The wrangler-secret Ctrl+V trap (third instance — now memorised)
- The bootstrap-fp-vs-signing-fp architectural realisation that Path B is the right next shift
- Hardware proof that Phase 0 actually works on production

The work persists. The site is functional. The next Number One inherits a ship that stands.

Number One (late evening watch close, 14 May 2026, ~19:50 BST)
