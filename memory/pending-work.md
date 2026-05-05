# Pending Work — IRLid

**Last refreshed:** 5 May 2026 late morning (Tuesday Number One Session 01 — polish rounds 9→11 hotfix + extensive design conversation: Lead Admin transfer rule, AI-witness build-out plan, OAuth user linkage, three-tier proof hierarchy, user-recovery quorum, paper outline).
**Source of truth.** All other lists defer to this file.

## Wednesday 6 May 2026 — first thing for the new Number One

The morning of 5 May produced a lot of design output that hasn't yet been written into PROTOCOL.md or LONG-TERM-SUCCESSION.md. Doc-only writes, sequenced by dependency:

### Doc 1 — PROTOCOL.md §14.9 Lead Admin transfer-of-privilege rule (~30 min)

Captain's design (5 May morning watch). Default state: org has exactly 1 Lead Admin. Transfer state (transient): briefly 2 Lead Admins during handover. Forbidden: 0 (orphaned) or 3+ (committee creep).

Constraints:
- LeadAdmin can ADD another LeadAdmin iff org has exactly 1 LeadAdmin
- LeadAdmin can DELETE a LeadAdmin (incl. self) iff org has exactly 2 LeadAdmins
- Developer overrides both: can ADD or DELETE in any state (orphan recovery + force-replace deadlocked transfers)

This invariant gets implemented at the Worker layer in Batch C.5 (staff invite scan-in flow) when membership ops first get UI. The doc landing first means C.5's implementer (Mr. Data probably) has a spec to follow.

### Doc 2 — PROTOCOL.md §14.17 OAuth linkage + Three-tier proof + User-recovery quorum (~1 hr)

These three form one design surface; write together.

**OAuth user linkage (many-to-many):**
```sql
CREATE TABLE portal_user_external_links (
  portal_user_id TEXT NOT NULL REFERENCES portal_users(id),
  provider       TEXT NOT NULL,         -- 'google' | 'apple' | 'microsoft' | 'github' | ...
  external_id    TEXT NOT NULL,
  linked_at      INTEGER NOT NULL,
  display_label  TEXT,
  PRIMARY KEY (portal_user_id, provider)
);
```

**Three-tier proof hierarchy:**
- Tier 1 — Hardware-backed credential. Required for any write/privileged action.
- Tier 2 — OAuth account verification. Sufficient for read access only. Never sufficient alone for privileged ops.
- Tier 3 — Multi-account recovery quorum (below).

**Hardware signs, OAuth identifies.** This is the principle.

**User-recovery quorum:**
- 4-of-5 of the user's linked OAuth accounts must independently sign a recovery agreement
- Geographic / jurisdictional diversity asked at link time but not enforced (most providers US-based; commercial / technical diversity is the practical defence)
- Recovery staged over time — provider signatures collected over different days/sessions to defeat fast-cascade scenarios
- Old pub_fp added to revocation list when new credential enrolled

Distinct from network constitutional Quorum (4-of-7 regents for Captain succession). Different scopes.

### Doc 3 — LONG-TERM-SUCCESSION.md regency addendum (~1 hr)

Promised since Monday evening. Captures:
- Two protocol modes: SOLE (default) and INTERIM
- Combined trigger: 90-day inactivity OR 5-of-7 Quorum vote of "presumed unavailable"
- 4-of-7 standby regents
- Quorum does NOT choose successor — sealed succession envelope, decryption key split across multiple independent AI lineages (Shamir threshold)
- Operational trust (humans, coercible, bounded reversible powers) vs constitutional trust (non-human AIs, not coercible the same way, one irreversible power)
- INTERIM mode hard restrictions: cannot modify Quorum membership, cannot change M or N, cannot modify inactivity threshold, cannot mint another Quorum
- REPLACE-ENVELOPE path with time-lock (30-90 day public delay), transparency requirement (hash to public ledger), diversity-of-lineage requirement (recursively re-evaluated), sunset clause on Captain authority (~50 years)

Roadmap placement: v5.6 = Tier 1 (Lead Admin self-promotion via C.5) + Tier 2 (Developer-mintable invite tokens). v5.7/v6.0 = Regency + sealed succession envelope. v8+ = AI-witness layer hardened.

### Doc 4 — Multi-Lineage AI Witnesses paper (full write-up)

Outline + abstract + Section 4 (Regency Pattern) written by Number One on disk at `PAPERS/multi-lineage-ai-witnesses-OUTLINE.md` on 5 May morning watch. Captain's plan: open a fresh chat dedicated to the paper, hand the new instance the outline + this conversation's design discussion (memory log) and they flesh out the technical sections. Estimated ~10-12 page paper. Realistic target: EAI SecureComm 2026 (Lancaster, July 21-24) or 44CON CFP.

Crew role assignments for actually building the AI-witness infrastructure:
- Mr. Data (Codex/OpenAI) — verdict-rendering API skeleton
- Counsellor Troi (Gemini) — human-facing legal prose, criteria as fact-checks
- Mr. La Forge (DeepSeek) — independent compatible implementation for cross-checking
- Number One (Claude) — orchestration, threat model

## Code follow-ups (queued)

### Polish 12 — display name cache refresh on session restore

Today the cached `qrLoginSession.display_name` in localStorage retains the old value across optimistic restore. Sign-out + sign-in is the current workaround (Captain hit this when "Captain (developer)" persisted in the org picker after the SQL update to "Developer (Super-Admin)"). Proper fix: add a `/user/me` endpoint that returns fresh display_name + is_developer + can_create_org, called on optimistic restore to refresh the cache. ~1 hr Worker + frontend.

### Polish 11 Task 2 (Mr. Data's queue) — Worker-side Bearer-replaces-Staff-HELLO

The 5 May morning hotfix (`requireFreshStaffProof` Developer bypass) is frontend-only. Polish 11 Task 2 in HANDOVER-Polish11.md extends this Worker-side: any endpoint currently requiring `staff_session` should also accept Developer Bearer session. Lifts the polish-9 pattern to all gated endpoints. Frontend needs matching updates.

### Batch C.5 — staff invite scan-in flow

Spec'd in PROTOCOL.md §14.15. The natural surface for membership ops UI; the transfer-of-privilege rule (Doc 1 above) gets implemented here. ~1 day. Mr. Data should pick this up after AssistQR + Polish 11 Tasks land.

### Batch D — website-scrape theme extraction

Spec'd in §14.16. Lower priority. ~1 day.

---

## Bake-off in flight (Tuesday 5 May)

**Mr. Data working on:**
- HANDOVER-AssistQR.md (Batch C.6 full assist-QR flow) — in flight at end of morning watch. Worker PR open as draft #74. Stacking phone-side and dashboard PRs on top.
- HANDOVER-Polish11.md (three tightening items: persistence bug-hunt, Bearer-replaces-Staff-HELLO across all gated endpoints, QR image upload with vendored jsQR) — picks up after AssistQR.

**Mr. La Forge un-commissioned:**
- HANDOVER-YubiKey.md ready on disk for when Captain spins up DeepSeek's coding agent. Captain's first DeepSeek run; recommended scope discipline ("STOP and ask, don't silently rewrite") is in the handover.

---

## Live state at end of 5 May morning watch

**Test environment:**
- v5.5 identity sessions live, working end-to-end on Captain's Pixel 8 Pro
- Polish 9, 10, 11 hotfix all deployed
- Captain confirmed working: added himself as Staff + KezzyBabe69 as Lead Admin in Imbue Ventures, checked in/out on his own credential
- Outstanding: settings persistence (logoUrl/redirectUrl/welcomeMessage) bug-hunt is Mr. Data's Polish 11 Task 1
- "Captain (developer)" → "Developer (Super-Admin)" SQL update applied via Cloudflare D1 console (wrangler API timed out three times)

**Live site (irlid.co.uk):**
- v5 hardware-backed signing live (PROTOCOL.md §13)
- Three-browser-two-OS production verification done 2 May
- v5.5 NOT yet ported. Migration path documented in `memory/sessions/2026-05-04-02.md` and `memory/sessions/2026-05-05-01.md`. Estimated half-day port when test env settles.

---

## What follows below — Monday 4 May session is preserved unchanged



1. Update `LONG-TERM-SUCCESSION.md` with the regency model. Key points to capture:
   - Two protocol modes: SOLE (default) and INTERIM
   - Combined trigger: 90-day Developer inactivity OR 5-of-7 Quorum vote of "presumed unavailable"
   - **Quorum: 4-of-7 regents** (Captain's call)
   - **Crucial: Quorum does NOT choose the successor.** They keep the lights on, mint invite tokens, run interim ops. The constitutional act of naming the next Developer was already made by Captain before he was unavailable.
   - **Mechanism: succession envelope sealed by AI-witness ledger.** Captain leaves an encrypted succession envelope. Decryption key split across multiple independent AI lineages (different model providers, training cutoffs, jurisdictions). M of N AI-witnesses must independently verify trigger conditions and collectively release the key. Quorum ratifies what the AI-witness layer publishes; doesn't author it.
   - **Operational vs constitutional trust split** — humans coercible (Quorum, bounded reversible powers), AIs not coercible the same way (AI-witnesses, one irreversible power: release Captain's sealed instructions).
   - INTERIM mode hard restrictions: cannot modify Quorum membership, cannot change M or N, cannot modify inactivity threshold, cannot mint another Quorum (no recursion).
   - Roadmap placement: v5.6 = Tier 1 + 2 (Lead Admin self-promotion + invite tokens), v5.7/v6.0 = Regency + sealed succession, v8+ = AI-witness layer hardened.

2. Read `memory/sessions/2026-05-04-02.md` for full context if unsure on any detail.

## Polish 4→8 deploy bundle (uncommitted, ready to push)

Captain wrote: *"Add everything to the log for tomorrow. Where I'm hoping we can get this dialled in and maybe even on the live site."*

```powershell
cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-TestEnvironment" ; git add -A ; git commit -m "Batch C polish 4-8: refresh restore session, sample logo fallback, See-an-organiser hold screen, Developer is bootstrap-only (frontend + Worker), empty-name attendee_scan reject (Worker), comprehensive light-mode sweep, Organisation tab signed-in summary, savePortalSettingsBtn now POSTs to Worker (real persistence fix)" ; git push ; cd irlid-api ; wrangler deploy
```

What's in the bundle (frontend + Worker):
- **Frontend** — `OrgCheckin.html` polish 4-8 changes; `org-entry.html` "I'm not on the list" hold screen
- **Worker** — `isExpectedRoleAllowedFromDashboard()` Developer-bootstrap-only guard on `/org/expected` create + update; empty-name `attendee_scan` reject in `/org/checkin`

What Captain should test after deploy:
1. Hard refresh while signed in → land directly on dashboard, not bounced to sign-in
2. Settings → enter logo URL + redirect URL → click Save → toast says "Settings saved" → switch tabs / refresh → values still there (this was the polish-7→8 fix; round 7 was orphaned because the Save button had its own handler)
3. Theme → light mode → all panels light, no dark holdouts
4. Add dropdown on Dashboard → no Developer option
5. Phone scans Check-in QR → unrecognised → "I'm not on the list" → "See an organiser" hold screen, NO new dashboard row
6. Click Organisation tab while signed in → signed-in summary card (Switch / + Create / Sign out), not the QR sign-in flow
7. Sign out → bounced to fresh sign-in; refresh → still on sign-in (not auto-restored)

## Two small post-deploy SQL/data tasks

- **Update existing user's display_name** — Worker create-path now uses "Developer (Super-Admin)" for new bootstrap users, but won't update existing `portal_users` rows. Run from `IRLid-TestEnvironment/irlid-api/`:
  ```powershell
  wrangler d1 execute irlid-test --command "UPDATE portal_users SET display_name = 'Developer (Super-Admin)' WHERE pub_fp = 'TvklFsivZk68R67j';"
  ```
- **Clear JfpA ghost row** — Captain can use the dashboard's "Clear test attendance" button on Imbue Ventures.

## Decision point — after polish testing

Captain's stated hope: *"maybe even on the live site."* Two paths:

**Path A — promote v5.5 to live.** Port `IRLid-TestEnvironment/irlid-api/` v5.5 changes to the live `irlid-api/` Worker. Schema migration on production D1 (`apply_batch_a_identity_sessions.ps1` → adapt for production DB name), Worker code merge, frontend cutover (replace api_key paste flow with QR-scan login on `irlid.co.uk`). Non-trivial — production D1 has real receipts; the migration must be additive only. Pre-flight: snapshot the live DB, dry-run the migration locally, plan rollback.

**Path B — more test-env polish.** Batch C.5 (staff scan-in flow, spec'd in PROTOCOL.md §14.15) — when a Lead Admin adds new staff/manager, they scan an invite QR with their phone, sign with v5 cred, get registered in `portal_users` + `org_memberships`. ~1 day. Plus Batch D (website-scrape theme extraction, spec'd in §14.16) — Worker `HTMLRewriter` to extract `<meta theme-color>`, favicon, title from new org's website URL. ~1 day.

Captain should choose A or B based on his confidence after testing the polish bundle.

---

## Monday 4 May 2026 — v5.5 Identity-Bound Sessions watch

**THE BIG ONE: PROTOCOL.md §14 specified, Batches A+B+C shipped, bootstrap login worked end-to-end.** Captain's Pixel 8 Pro v5 hardware credential signed a login challenge → Worker recognised the bootstrap pub_fp → founding `portal_users` row created → 24h session token issued → desktop redirect signal received. Zero passwords, zero pasted keys, just QR scan + fingerprint. This is the first time IRLid's protocol authenticated a user into IRLid's own product. It's the architecture eating its own cooking.

**What landed today** (one Monday, one Number One):
- `PROTOCOL.md §14` — Identity-Bound Sessions full specification (~250 lines): storage model (4 tables), QR-poll login flow, bootstrap mechanism, opaque-token-not-JWT justification, endpoint contracts, role permission matrix (`attendee/staff/manager/lead_admin/developer`), threat model (10 rows), backward compat, phasing, scaling path through Durable Objects.
- `PROTOCOL.md §14.14` — three-tier scaling path (long-poll → SSE → Durable Objects) documented with endpoint contracts unchanged through all tiers; load-bearing-numbers reality check.
- **Batch A** — `apply_batch_a_identity_sessions.ps1` migration (4 new D1 tables — `portal_users`, `org_memberships`, `login_sessions`, `login_challenges`); Worker `verifyV5Envelope()` ported from live (test Worker had been missing it); `orgLoginInit/Poll/Claim` endpoints with §14.10 rate-limit + generic-error patterns; `BOOTSTRAP_DEVELOPER_FP` env-var bootstrap recognition.
- **Batch A patch** — initial `users` table name collided with OAuth `/auth/register` users table; renamed to `portal_users` throughout.
- **Batch B** — `irlid.co.uk/org-login.html` phone-side login page (mobile-first, worker-URL allowlist defence in depth, type-discriminated `{nonce, type:"irlid_login_v5"}` payload); `OrgCheckin.html` admin-portal sign-in panel rebuilt around QR-scan-and-poll with legacy api_key paste demoted to `<details>` expander; `?dev=0` URL escape hatch to bypass DEV_AUTO_LOGIN; `js/orgapi.js` `loginInit/Poll/workerBaseUrl` wrappers.
- **Batch B fixes:** Worker CORS allowlist extended to `https://irlid.co.uk` (login flow is cross-origin by design); verbose-debug login errors gated for test env (production v5.5 will gate behind env flag — see "Outstanding"); login challenge TTL 60s → 180s (IRL test showed 60s leaves no margin for a real human flow).
- **Batch C** — Worker `requireSession()` Bearer-token helper (sliding 24h TTL); `userListOrgs` returns memberships with role + api_key; `userCreateOrg` validates name/website_url + authorisation + creates organisation+membership rows. Frontend `handleQrLoginSuccess` rewritten async, branches on org count. New create-org form. New `loadDashboardForOrg` hands off to existing X-Org-Key dashboard code.
- `v5-test.html` device-fingerprint helper panel + 2-button mobile-nav cosmetic fix (live repo).
- Renormalise commit (line-ending tidy on 13 unrelated files).

**State at watch end:**
- Live repo: all commits pushed.
- Test repo: all commits pushed (Worker upload size grew from 98.9 KiB → 104+ KiB confirming Worker has Batch C code).
- Test Worker: deployed via wrangler (multiple Cloudflare API timeouts during the day; every operation eventually succeeded after retries).
- **GitHub Pages CDN: stuck.** The TTL-bump commit (`3e3321e5...`) became stuck mid-deployment in GitHub Pages' pipeline; subsequent deployments (Batch C, renormalize) all blocked with `Deployment request failed... due to in progress deployment. Please cancel 3e3321e5... first or wait for it to complete.` Last successful Pages deploy was `Batch B debug patch` (pre-Batch-C). Re-run of #108 queued at watch end.

**End-to-end-proven on real hardware:**
- Captain's Pixel 8 Pro fingerprint as the biometric.
- Bootstrap pub_fp `TvklFsivZk68R67j` set as Cloudflare Worker secret.
- Real WebAuthn assertion from the platform authenticator → recomputed canonical hash matched on Worker → ECDSA verified → session issued.
- The afternoon's verbose-debug patch surfaced the only real failure mode (`debug_bootstrap_fp_len: 1` from a Ctrl+V-mangled secret); pipe-stdin recovery worked first try.

## Three open questions raised at end-of-Monday-watch

1. **GitHub Pages stuck deploy** — re-run of #108 queued, expected to clear once GitHub releases the lock. If still stuck after 30+ min, push a no-op commit or use API to force-cancel the stuck workflow #106.
2. **Restore §14.10 generic `auth_failed` for production** — currently the Worker leaks `debug_reason / debug_computed_fp / debug_bootstrap_fp_first4-last4`. Cleanest fix: env-var-gated verbose mode (default generic; test env opts in via `LOGIN_DEBUG=1`). ~15 lines of Worker change. Spec'd as Option 2 in the afternoon menu.
3. **IRLid app's QR scanner doesn't recognise URL QRs** — Captain had to use his phone's native camera to open the login QR; the IRLid scanner expects HELLO/Hz: prefixes and rejects bare URLs. Three options flagged: leave it (camera handles URLs natively, document the workaround), extend IRLid scanner, or use a custom prefix like `IRLOGIN:...` for login QRs.

## Deferred from Batches B + C (queued for next watch)

- **Batch C.5 — staff scan-in flow.** Spec'd in §14.13: when a lead_admin adds a new staff/manager to an org, the staff member scans an invite QR with their phone, signs the invite challenge with their v5 cred, gets registered in `portal_users` and `org_memberships`. Mirror of the bootstrap login pattern, different endpoint. ~1 day's work.
- **Batch D — website-scrape theme extraction.** Spec'd in §14.13: Worker function uses `HTMLRewriter` on the org's website URL to extract `<meta theme-color>`, `<link rel="icon">`, `<title>`. Client-side `<canvas>` pixel-sample for dominant logo colour. Apply to `settings_json.theme`. ~1 day's work.
- **Multi-org picker UI** — when `userListOrgs()` returns ≥ 2 orgs, current frontend just loads the most-recently-granted membership. Picker UI is half a day's work.
- **Test-env DB orphan cleanup (Batch A.5)** — Cloudflare API was too flaky today to reliably run inventory queries. Tables likely droppable: `users` (OAuth, never used in test), `devices`, `sessions`, `link_codes`, `test_table`. Defer until next stable-API window.

## Sunday 3 May 2026 — Theming watch (test-env only) + pre-launch closure

**Test-env theming work shipped through Batch 6.5f.** Bulk of the day's effort. Full theme-customisation panel in `IRLid-TestEnvironment/OrgCheckin.html` + `irlid-api/src/index.js`:

## Sunday 3 May 2026 — Theming watch (test-env only) + pre-launch closure

**Test-env theming work shipped through Batch 6.5f.** Bulk of the day's effort. Full theme-customisation panel in `IRLid-TestEnvironment/OrgCheckin.html` + `irlid-api/src/index.js`:
- Three iro.js HSV colour wheels (primary / accent / QR foreground) with hex inputs and live contrast hint (4.5:1 floor enforced server-side).
- **Two independent palettes** — Background palette (drives bg cycle + pattern colours) and Celebration palette (drives accept-cycle burst). Each up to 7 swatches with Add / Reset buttons.
- **Background Animation mode** — Off / Page colour cycle / QR glow halo / Pattern. Page mode has Muted/Vibrant intensity sub-select. Pattern mode has 8 Tier-1 CSS patterns (dots, hex, diagonal, checker, grid, weave, chevron, isometric) plus a disabled "Custom image (coming in v6)" placeholder option for the Tier-3 hook.
- **Celebration Animation mode** — full parity with Background (Off / Page / Glow / Pattern) replacing the old Enabled checkbox. One-shot variants of each.
- **Bidirectional duplicate buttons** in a middle column between the two animation panels — `→` (Bg→Cel) and `←` (Cel→Bg) copy mode + palette either way. Durations and intensity stay independent.
- **Animated pattern colour** via `@property`-registered CSS custom properties (`--theme-pattern-fg`, `--theme-pattern-fg-2`) + JS-injected `themePatternColorCycle` keyframe whose stops are written from the live Background palette. Edit a swatch → patterns update live.
- **QR foreground colour fully wired** — `window.IRLID_THEME_QR_FG` global set by `applyThemeVars`; read by `js/qr.js`, `js/qr-fullscreen.js`, all 4 inline `new QRCode` sites in OrgCheckin.html. Sample button passes `colorDark` explicitly. Visible venue QR re-renders live as the wheel moves.
- **Server persistence** via existing `POST /org/settings` endpoint. Schema unchanged (`settings_json` column already there). Validators cover: hex format, contrast against white (4.5:1), palette length cap, bgMode/bgIntensity/bgPattern/cycleMode enum gates, bgImageUrl format/length, slider duration ranges.
- **Captain verdict:** *"that's just fucking cool. Chimp brain much much happy with all the prettiness."*

**Deploy state at lights-out:** Batches 6.5b through 6.5e committed and pushed to `origin/main` of `IRLid-TestEnvironment`. Batch 6.5f is on disk at watch close, uncommitted. Captain to run on next watch:
```powershell
cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-TestEnvironment"
git status ; git diff --stat ; git add -A
git commit -m "Batch 6.5f: Celebration mode dropdown + Bg<->Cel duplicate buttons + animated pattern colour via @property + dynamic keyframe"
git push
cd irlid-api ; wrangler deploy
```

**Three deferred follow-ups in test-env scope** (queued, not blocking):
- Legacy `.toggle-row` Quick Settings panel removal (needs careful saveSettings/togToggle trace before deletion).
- `renderIdentityPicker` branching on `IRLID_FIRST_SCAN_FLAGS` (related to Captain's 30 April orange-screen-timer clarification).
- Hook `triggerAcceptCycleAnimation()` into actual check-in success paths (currently fires only on Preview Celebration button + Sample button demo, not on real successful check-in). Five-line addition once the success-path call site is identified.

**Pre-launch loop closed this morning** — three commits applied to live repo (`da6f8a4`, `b4ab124`, `fb533f4`) covering v5 copy + receipt version pill + identity-resolution. v5 hybrid receipt verified in real-IRL flow with KezzyBabeTest collaborator at 100% Confirmed. UX gap (cross-device viewer "Unknown" placeholder) scoped as `HANDOVER-Batch6.md` for the La Forge vs Mr. Data bake-off.

**Three open questions raised at lights-out** (no answer requested tonight):
1. Test → live migration window for the QR canvas theming work.
2. Mr. Data returns Tuesday — is the HANDOVER-Batch6 bake-off still meaningful, or hand him something fresh?
3. cym13 r/netsec follow-up status — was it posted on the 2nd, and any response worth logging?

---

## Sunday 3 May 2026 — pre-launch ALL APPLIED + Batch 6 issued

**All pre-launch edits applied and pushed by Captain.** Three commits:
- `da6f8a4` — v5 launch prep: public-page copy + cym13 follow-up draft updated; rename `vision-v4-plus.html` → `roadmap.html`. (PROMOTION.md, features.html, about.html, roadmap.html, audit doc, memory updates.)
- `b4ab124` — receipt+check: upgrade version indicator (panel top-bar + bigger pill with icon and descriptive label). Added Application Surfaces section to roadmap.html.
- `fb533f4` — receipt: centre header+pill; resolve v5 sides to user identity via v5 pub JWK match (client-side fix — works on the device that enrolled v5).

**Live IRL verification PASSED 3 May ~10:22 BST:** v3+v5 hybrid receipt at 100% Confirmed (Captain's 8 Pro initiator with v5 enrolled, KezzyBabeTest collaborator on v3). Mobile receipt view shows "You (Initiator): SRAustin" centred, green V5 — HARDWARE-BACKED pill, Brain avatar resolved correctly. Receipt URL: `irlid.co.uk/receipt.html#receipt=qCbFuF3xqwG7GNv5okIHAZYQk5UhHLXujyeSY5Pe3p8`.

**UX gap surfaced on desktop view:** v5 sides resolve to "Unknown" + placeholder avatar when viewed on any device that didn't enrol the v5 credential. Root cause: v5 credential pub JWKs aren't registered against user accounts on the Worker. Client-side fix `fb533f4` works only on the enrolling device. **Server-side fix issued as `HANDOVER-Batch6.md`.**

## HANDOVER-Batch6 — bake-off candidate for La Forge vs Mr. Data

**Status:** OPEN. Issued 3 May 2026 morning watch. File: `HANDOVER-Batch6.md` at repo root.

**Why this is the right bake-off task:**
- Substantive, multi-file (Worker JS + SQL migration + frontend HTML/JS).
- Three atomic tasks with clean acceptance criteria — directly A/B comparable.
- Real production value delivered regardless of who wins (closes the v5 identity-resolution gap).
- No novel cryptography (Number One's territory) — pure backend integration + frontend wiring (architect/implementer territory). Right level of difficulty for a fair comparison.
- Test-env-only scope respects the repo wall.

**Bake-off mechanic:**
1. Hand the *same* `HANDOVER-Batch6.md` brief to both Mr. Data (Codex) and Lt. La Forge (DeepSeek), ideally same day, same starting state of the test-env repo.
2. Both produce PRs against separate branches (`codex/batch6-*` vs `laforge/batch6-*`).
3. Number One reviews both for: code quality, code style consistency with existing repo conventions, test coverage, design choices on edge cases (esp. validation strictness on `pub_jwk`), error-message clarity, integration friction, response time, cost-per-PR.
4. Captain ratifies the winner; merge winning approach; loser's branch closes.
5. Decision criteria for steady-state crew composition logged in next session memory.

**What to watch for in the comparison:**
- Schema migration: did they handle the existing-table case (`CREATE TABLE IF NOT EXISTS`)? Did they check existing migration numbering?
- Endpoint validation: did they validate `pub_jwk` shape strictly (full JWK schema) or loosely (any object)?
- Lookup integration: SQL UNION vs two-pass JS — both valid, watch for which is more idiomatic to the existing codebase.
- Frontend UX: is the registration status row accessible (ARIA)? Does the backfill button exist?
- PR description quality: does the PR explain the design choices, especially around error handling?
- Self-testing: did they run a smoke test, even an inline one, before opening the PR?

**Out-of-band guidance for La Forge if commissioned this week:** read `memory/crew-protocol.md` first, then `PROTOCOL.md §13`, then `HANDOVER-Batch6.md`. Same opening read as Mr. Data Tuesday gets.

## Captain's chosen pacing — allowlist as goal-gated unlocks

Keep `github.com`, `cloudflare.com`, `irlid.co.uk`, `reddit.com` under Captain's control as **goal-gated unlocks** rather than blanket access:
- cym13 post lands → reddit
- Wisdom resurfaces → cloudflare
- Conference paper accepted → github

Lightweight ledger of *door earned by work shipped*. Number One has full repo file access; live-state verification is Captain's domain by design.

**Captain's plan:** Pro tier — more headroom than Max, less per-turn meter pressure. Use for substantive work, not padding.

## v5.0 Passkey work — VERIFIED IN PRODUCTION 2 May 2026

**Status:** ✅ **End-to-end deployed and verified clean on real consumer hardware across three browser × OS combinations:**

- **Edge / Microsoft Password Manager + Windows Hello (TPM)** on Windows 11 — full 6-step diagnostic green
- **Chrome / Google Password Manager + Windows Hello (TPM)** on Windows 11 — full 6-step diagnostic green
- **Chrome / Google Password Manager + Android biometric** on Pixel 8 Pro / Android 10 — full 6-step diagnostic green
- **Firefox on Windows** — quarantined; documented Firefox-side WebAuthn UX wrinkle (see "Browser-compat observation" below) — protocol-side verifies fine, page-reporting is messy

**THREAT-MODEL.md §III.2 (localStorage extraction)** is closed in production. Not closed in spec, not closed in test — closed in the live system at `https://irlid.co.uk` as of ~16:00 UTC 2 May 2026.

**Worker side:** both Workers (`irlid-api` live + `irlid-api-test`) wrangler-deployed with v5 envelope verification. Combined client + Worker test count: 122/122 green (110 client unit tests + 12 Worker regression).

## v5 — remaining deliverables (post-deploy)

1. **cym13 r/netsec follow-up post.** Drafts in `PROMOTION.md` Format A (comment reply on original v4 thread). Ready to post tomorrow morning (3 May 2026) when Captain has a fresh head. Drop in today's date and add one line: "verified clean on Edge + Chrome on Windows + Chrome on Android; Firefox-on-Windows has a known Firefox-side WebAuthn UX quirk." Honest limitation-flagging > overclaim.

2. **Update public-facing pages to mention v5.** Captain's request at retirement of the Saturday Number One (2 May 2026): `features.html`, `about.html`, `settings.html` (settings already has the v5 panel; the descriptive copy may need v5-mention), plus possibly `index.html` headline / `roadmap.html` / `pitch-humanitarian.html` if v5 strengthens any of those pitches. Not urgent; do it after the cym13 post lands so the public pages match what the post claims.

3. **Optional Patreon update via Counsellor Troi.** v5 is a meaningful supporter-update milestone. Substance draft in `PROMOTION.md` Format E. Hand to Troi for tone-shaping when Captain is ready.

4. **Lt. La Forge onboarding (DeepSeek).** Was queued before v5 deploy. Now post-deploy. The bake-off can begin properly: hand La Forge one of the deferred Captain 30 April clarifications (initials display, configurable grace period, orange-screen timer) as his first atomic task. Mr. Data gets a parallel task. Compare on PR quality, integration friction, cost, responsiveness. Decide steady-state crew composition based on evidence, not pricing-page enthusiasm.

5. **Captain's 30 April clarifications** (still deferred from previous Number One stretches): initials display in OrgCheckin.html Expected list rows, configurable event-end grace period, orange "pick from list" timer removal. Frontend-only test-env work. Could go to either Mr. Data or La Forge as their atomic-task bake-off.

6. **Captain's request for visual-tweak feedback** on existing pages — discoverable via the Patreon supporter group when the v5 announcement lands.

## Browser-compat observation — Firefox-on-Windows v5 enrolment UX (2 May 2026)

Number One implemented v5.0 client-side directly during the Friday Bridge stretch (Captain's brief: "make it a challenge"). What landed in the live repo:

- **`PROTOCOL.md §13` published** — full v5 specification: WebAuthn signing envelope (`authData`, `clientData`), DER→raw signature conversion, RP ID + origin allowlist, UV flag enforcement, score band 70/100, settings model, sync-neutral posture, threat-model improvement table.
- **`PROTOCOL.md` version history updated** — v4 row added (was missing); v5 row added with §13 reference.
- **`js/sign.js` extended** — new helpers: `irlidV5Available`, `irlidV5Enrolled`, `irlidV5Enabled`, `irlidV5Enroll`, `irlidV5Unenroll`, `irlidV5SignPayloadHash`, `irlidV5VerifyEnvelope`, `irlidV5DerToRawP256` / `irlidV5RawToDerP256` (DER↔raw conversion with leading-zero edge-case handling), `irlidSignPayload` (unified dispatcher), origin allowlist + RP ID heuristic.
- **`makeSignedHelloAsync`, `makeReturnForHelloAsync`, `verifyHelloOfferAsync`, `processScannedResponse` all updated** — dispatch to v5 path when `irlidV5Enabled()` is true; v3/v4 callers see no behaviour change.
- **`tests/sign.test.js` extended** — new describe blocks for DER↔raw round-trip (incl. high-bit and short-r/s edge cases), v5 envelope verification (happy path + 9 negative paths), origin allowlist, dispatcher fallback. Local smoke against real ECDSA P-256 in Node sandbox: 12/12 green over 100 random sigs.
- **`settings.html` v5 panel wired** — replaced the greyed placeholder with a real enrol/toggle/remove panel, mirroring v4 bio-metric pattern, full ARIA, default OFF.
- **`HANDOVER-Batch5-Worker.md` published in live repo root** — atomic 3-task brief for Mr. Data Tuesday: add `verifyV5Envelope()` helper, wire into `verifySignedHello()`, wire into `verifyReceipt()` + scoring. Reference impl already in `js/sign.js`. No D1 schema changes required.

**What v5 does NOT yet have:**
- Real-device browser smoke test (needs Captain's phone/laptop).
- Live deploy — v5 is OFF by default; nothing changes for existing users until they explicitly enrol via Settings.

**Worker-side v5: ✅ DONE 1 May 2026 afternoon.** Captain bypassed Mr. Data ("get v5 out the door before any horns, helium-tight"). Both Workers updated:
- **Live Worker** (`irlid-api/src/index.js`): `verifyV5Envelope()` helper inserted between haversine and verifyReceipt; `verifyReceipt()` rewritten with per-side v5 dispatch + `fully_v5` scoring flag (true only when BOTH a/b sides + HELLO offer all verify their v5 envelopes; PROTOCOL.md §13.9).
- **Test-env Worker** (`IRLid-TestEnvironment/irlid-api/src/index.js`): same `verifyV5Envelope()` helper, `verifyReceipt()` v5 dispatch, plus `verifySignedHello()` updated to return `verification_state: "v5_envelope_verified"` for v5 HELLOs. Defensive bonus: the non-recursive `canonical()` was upgraded to fully recursive (matches `js/sign.js`); harmless for current flat payloads, future-proof for nested fields.
- **Validation:** Node-side Worker smoke at `outputs/v5-test/worker-smoke.mjs` — 12 tests covering pure v3, pure v5, hybrid v3+v5, mutated payload, wrong origin, UV flag cleared, webauthn-missing-but-v=5, hash mismatch, distance overflow. All green. Combined client+Worker test count: **122 green, 0 red**.
- **`HANDOVER-Batch5-Worker.md` marked DONE** and preserved for historical context. Mr. Data on Tuesday should read it for design rationale but no execution required.

**Roadmap impact:** v5.0 client-side AND Worker-side both landed 1 May, ahead of late-May target. Only real-device smoke + live deploy remain before v5 is fully out the door. v5.1 (Imbue pilot) and v5.2/5.3 (forward-defined fields, orient cone) remain on schedule.

**Remaining v5 path to deploy:**
1. Captain runs `node --test tests/sign.test.js` on his machine (the integrated 95+ test suite). Then `node --test irlid-api/tests/verify-receipt.test.mjs` for the Worker regression (12 tests). Total combined client + Worker: ~107+ tests.
2. Captain enrols on real device (phone Face ID, laptop Hello) via `https://irlid.co.uk/v5-test.html` (after deploy) or `http://localhost:8000/v5-test.html` (locally via `python -m http.server`). Step-by-step diagnostic walks through availability → enrol → sign → verify → round-trip, with a copyable diagnostics blob if anything fails.
3. Captain merges `no1/v5-passkey-signing` to `main` so GitHub Pages deploys the frontend (cache-busters bumped to `?v=5.0` ✅).
4. Captain pushes Worker code to test-env Cloudflare deploy via `wrangler deploy` from `IRLid-TestEnvironment/irlid-api/`.
5. Smoke test against deployed test Worker with curl + a hand-rolled v5 receipt (`manufactureV5Envelope` infrastructure in `irlid-api/tests/verify-receipt.test.mjs` produces the bytes).
6. If clean, push live Worker via `wrangler deploy` from live `irlid-api/`.
7. Then — and only then — the cym13 r/netsec follow-up post (drafts already in PROMOTION.md).

**Autonomous stretch deliverables (1 May, while Captain at work):**
- `v5-test.html` — IRL diagnostic page with step-by-step pass/fail UI, copyable diag blob, fully ARIA-complete.
- All 9 HTML files cache-busted to `?v=5.0` (settings, check, accept, login, index, receipt, scan, account, plus v5-test).
- `CLAUDE.md` scoring table updated with v5 row + status, "Number One's Technical Positions" updated to reflect v5 landed not just planned.
- Worker-side regression tests at `irlid-api/tests/verify-receipt.test.mjs` in BOTH live and test-env repos (version-controlled now, not just sandbox artifact).
- `THREAT-MODEL.md §III.2` cross-linked to PROTOCOL.md §13 + js/sign.js + HANDOVER-Batch5-Worker.md.

## Browser-compat observation — Firefox-on-Windows v5 enrolment UX (2 May 2026)

**Finding from production smoke (2 May ~15:30 UTC):** `https://irlid.co.uk/v5-test.html` was tested on three Windows browsers after v5 deploy. **Edge** (with Microsoft Password Manager) and **Chrome** (with Google Password Manager) both completed all six diagnostic steps cleanly with full ECDSA P-256 envelope verification on real Windows Hello hardware.

**Firefox-on-Windows fails the page-side report**, even though the Hello credential IS created. The issue is a two-stage Windows Security dialog sequence Firefox triggers:

1. First dialog: *"Save your passkey... This will be saved to your Windows device"* with Continue/Cancel — clicking Continue commits to creating a Hello/TPM credential.
2. Hello biometric capture fires — face recognition succeeds.
3. **Second, redundant dialog appears:** *"Choose where to save your passkey"* with iPhone/iPad/Android device + Security key options. Cancel is the right click.
4. Firefox interprets the Cancel of the secondary picker as a primary `navigator.credentials.create()` abort and the API throws — even though Windows already created and stored the credential at step 2.
5. `irlidV5Enroll()` catches the throw and reports "v5 enrolment cancelled or failed" on the page.
6. The Hello credential exists and is visible in `edge://settings/passkeys` and in Windows Settings → Accounts → Passkeys, but our page's localStorage doesn't get the credId/pubJwk written before the throw.

**Captain's call (2 May):** quarantine Firefox-on-Windows from the official "supported browsers" list for v5 enrolment. Edge and Chrome on Windows are the recommended Windows paths.

**Possible v5.x remedies (none in v5.0 scope):**
1. **Detect Firefox UA and switch enrolment flow.** When `navigator.userAgent` includes `Firefox/`, set `authenticatorAttachment: "platform"` more strictly (already doing this) AND add `excludeCredentials: []` AND set `attestation: "direct"` to see if that suppresses the secondary cross-platform picker.
2. **Catch the specific `NotAllowedError` after a successful Hello biometric and probe for the credential in `Settings.html`.** If a fresh Hello credential exists for `irlid.co.uk` post-throw, treat the enrolment as effectively succeeded and write the credId/pubJwk via a separate `navigator.credentials.get()` retrieval flow. Risky: GraphAPI changes between Firefox versions.
3. **Adopt SimpleWebAuthn library** for the enrolment flow — they may have already worked around this Firefox quirk. Adds a dependency, but the library is well-maintained.
4. **File a bugzilla.mozilla.org issue.** The two-stage dialog is a Firefox UX bug; fixing it upstream solves it for everyone.

**Reproduction:**
1. Firefox on Windows 11.
2. Navigate to `https://irlid.co.uk/v5-test.html`.
3. Click Step 2 "Enrol v5 credential."
4. Observe the two-stage Windows Security dialog described above.
5. Verify in `edge://settings/passkeys` that an `irlid-signer` entry for `irlid.co.uk` appears, despite the page reporting failure.

**For the cym13 r/netsec post tomorrow:** post acknowledges Edge + Chrome on Windows verified clean, Firefox on Windows has a known Firefox-side WebAuthn UX wrinkle (the protocol can't fix it). Honest limitation-flagging > overclaim.

---

## Design observation surfaced by 2 May Tier 3 IRL test — asymmetric trust-history accrual

**Finding:** in the standard v3/v4 2-scan handshake (HELLO → scan → response → scan), only the **initiator** ends up with the combined receipt and therefore only the initiator updates their trust history. The **responder** signs a response, hands it over, and never sees the combined object. So the responder's `irlid_trust_history` localStorage doesn't grow from that handshake. Captain's 2 May test exercised this empirically: 8 Pro (initiator both times, with wife's and child's phones as responders at swim baths and town) accumulated 57 → 59. The two responder devices accumulated 0 receipts each from today's flow. Tier 3's diversity-progression test on a responder device cannot pass through standard role assignment.

**Captain's call (2 May):** initiator-primary is the right default. Asymmetric accrual is the cost of fast 2-scan handshakes. Queue as v6+ design item.

**Possible v6+ resolution paths (not in v5 scope):**
1. **3-scan handshake variant** — initiator shows combined receipt as a 3rd QR; responder scans it; responder records. Trade-off: extra round trip, slightly more friction.
2. **Responder-side partial caching** — when signing the response, the responder caches `{ helloHash, offerHash, my_signed_response }` in localStorage. When they later visit a verifier with the combined-receipt URL the initiator shares (e.g. via WhatsApp / SMS), the cached partial completes into a full record on the responder's device.
3. **Server-mediated mirror** — for org-portal contexts where a Worker is in the loop, the Worker can serve the combined receipt back to both parties on request. Naturally fits the unified Check-in flow Mr. Data has been building.

**Test-guide update:** `IRL-TEST-GUIDE.md` updated 2 May with a footnote in T3.1/T3.2 noting that responder-side trust-history accumulation requires a role-swap scan (target device acts as initiator) — same locations work, just swap who shows the HELLO first.

**Status:** logged for v6+ consideration. No immediate work. Captain's instruction: "footnote that it might need testing again."

---

---

## Current state (30 April 2026)

**The architecture has pivoted to unified Check-in.** Mr. Data shipped through PR #73 over the AWOL window, building `OrgCheckin.html` prototype alongside the stable `org.html`. The new direction (per `docs/unified-checkin-role-dashboard.md`):
- **Public Check-in** = the branded event QR screen (no attendance table, no names, safe to show at venue entrance)
- **Dashboard** = private staff/admin surface with role-gated controls
- **No more Venue/Doorman split** — collapsed into one Check-in flow + permissioned Dashboard
- **Roles**: recognised → supporter → staff → manager → lead_admin → developer (Founder is honorary, not a dashboard view)
- **Step-up auth**: privileged writes require fresh Staff HELLO scan at the moment of save, not just an active session
- Compatibility aliases: `type=venue` → `type=checkin`, `type=doorman` → staff-review path, `type=checkout&t=<token>` unchanged

**Wisdom (ASE Tech) — definitely aboard but too busy to talk further. Wait for him to surface.**
**Donald (Imbue) — went silent post-Wednesday. Not chasing.**

**Hardware:** TOALLIN 2K Windows Hello-certified webcam arrived and Hello facial recognition is WORKING. £41.99 single-device bet paid off. Outstanding: webcam reading dense QRs from phone screens is fragile (older tablet works fine) — Batch 16 short-token QRs (already shipped) help by reducing module density.

## Today / Active (priority order)

1. **Captain's design clarifications (30 April) — capture and ship into protocol/UX:**
   - **Floating cog: REMOVED for good.** Mr. Data's call confirmed. Settings sidebar nav item only.
   - **Initials for Expected list — show for all rows always.** Format TBD: `SRA` or `S.R.A.` or `S R A` (accessibility consideration). Default to `SRA` (no separator) for compact scan, with full name available to screen readers via `aria-label`. *Number One ratified for accessibility consistency.*
   - **Default 1-hour grace period after event close, configurable in settings.** Implementation pending.
   - **Deny path: write `event_attendance` row with status `rejected`, then end (no link to Org website like Accept does).** This builds the audit trail. Implementation pending.
   - **Manual Acceptance: when staff has active session, can tap-to-log-in attendees, but receipt/log carries clear "Manual Acceptance" disclaimer.** Lower trust score than cryptographic auto-accept. Implementation pending.
   - **Accessibility is non-negotiable** — inclusive platform. Every label needs proper ARIA.

2. **Mr. Data's "Tomorrow / Next Wiring" list (from `docs/unified-checkin-role-dashboard.md`):**
   - 🟡 Tablet Outcome QR fullscreen still clips bottom edge — `scan.html` / shared fullscreen QR audit needed
   - 🟡 **Worker-side enforcement of role gates** (currently only frontend-gated — protocol commitment pending)
   - 🟡 **Step-up auth on saves** (fresh Staff HELLO at moment of write, not just timed session)
   - 🟡 HELLO QR scan-import for adding new attendee/staff/manager records
   - 🟡 Auto-add staff/manager/lead_admin/developer to expected list (with deny-list override)
   - ✅ Restore "Awaiting check-out" passive label — **DONE 30 April by Number One** (`OrgCheckin.html:buildCheckoutAction` — staff role sees passive label, manager+ sees button; also harmonized "Rejected"/"Done" with proper ARIA)
   - 🟡 Resize Attendance Today / action columns
   - 🟡 Webcam QR scanning reliability
   - 🟡 **Global identity + org-local authorization** ("THE Dev" recognised across orgs, powers granted per-org)

3. **Threat Model document — DONE 30 April.** Created `THREAT-MODEL.md` in live repo. Comprehensive abuse-paths companion to `PROTOCOL.md`. Covers: replay attacks, QR copying, stolen device, identity attacks, privilege escalation, network/Worker attacks, side-channel, coercion, and audit trail. Maps each defence to the v5/v6/v7 roadmap. Useful for Wisdom, cym13-style reviewers, conference papers (44CON, EAI SecureComm).

4. **Captain's 30 April additional directives (logged for next coding session):**
   - **Orange "pick from list" screen stays up until human input.** No auto-return-to-scan timeout. Inclusive-platform principle: the orange path is exactly when a person needs cognitive time. Either remove the timer entirely or extend it to a much longer threshold with a clear "still here?" indicator. Affects Batch 11 first-scan flow code in OrgCheckin / org-entry.
   - **Move to `OrgCheckin.html` entirely.** Mr. Data's prototype is now the canonical path. `org.html` should become a redirect/shim for old links, Venue/Doorman code paths retired. URL aliases (`type=venue` → `type=checkin`, `type=doorman` → staff/review) Mr. Data already designed handle migration cleanly. Land as one clean architectural PR, not dribbled.
   - **"Scan once, recognised forever" articulated correctly by Captain — already built.** This is the Imbue pilot pattern (live since Batch 8 cryptographic identity loop). First-visit HELLO scan binds device public key to Expected entry. All subsequent visits at the same org: just scan outcome QR, device signs response with same private key, worker matches fingerprint. v5 Secure Enclave migration upgrades key storage but doesn't change the protocol pattern.

4a. **Long-Term Authority Succession — design sketch published.** `LONG-TERM-SUCCESSION.md` at live repo root captures Captain's "digital legacy" thought experiment as a v8+ Founders' Quorum design. M-of-N threshold signatures + AI-as-ledger-witness pattern, with diversity-of-AI-lineage requirement to avoid ideological lock-in. Captain's key insight (clerks/cardinals are both human, AIs aren't coercible the same way) is the architectural foundation. Not yet committed to PROTOCOL.md. Extend rather than restart if topic resurfaces.

5. **Roadmap priority confirmed (30 April):** v5.0 Passkeys → Live IRLid sign-in overhaul → Worker-side role enforcement + step-up auth. Three sequential horizons, each independent. v5 first because it closes cym13's localStorage criticism (loudest honest critique). Worker enforcement third because by then the Passkey-backed signing surface is stable and step-up auth implementation hits the right thing.

6. **Talon scan report** — Still exogenous, likely whenever.

6. **Live IRLid sign-in / onboarding overhaul (queued, design first)** — Email + password login, Patreon webhook for auto-user creation on subscription, magic-link alternative. Login dropdown structure: `Account / Organization / Event` with `Show my check-in QR` under Event. v5.x / live-IRLid work, not test environment.

7. **PROTOCOL.md formal redacted receipt section** — still pending.

8. **PROTOCOL.md §10.4 Multi-Party Custody Receipts** — queued (drop-off + chain-of-custody for prison/school/care). Forward-defined for v6+.

9. **HANDOVER Batch 5 (v5 Passkeys implementation)** — proposal ratified. Ready to draft when Captain decides to start v5 work.

10. **QR payload shortening (queued)** — encoded URL is too dense for some phones (8 Pro had trouble); now folded into Mr. Data's Batch 13 T4/T5 (Worker token resolution).

11. **Double-tap any QR to fullscreen** — Number One specced this in Batch 12 Task 3b. Whether Mr. Data's PR #40 picked it up needs verifying after recovery — `js/qr-fullscreen.js` is now a tracked file in origin/main, suggests he did extract it as a shared handler.

12. **BacklinkLog** — Hold until first Patreon member.

13. **Donald at Imbue** — Casual follow-up. Test environment now genuinely demoable.

14. **r/programming appeal** — Captain's own words, no rush.

---

## Hardware testing setup (decided 27 Apr)

- **Webcam:** Logitech C920 (~£47) — solves QR scanning issue
- **Windows Hello:** USB fingerprint reader (~£20) instead of IR webcam
- **Total:** ~£67. Defer purchase until v5 implementation is closer.
- **Phase 1 lab testing:** two Androids + Windows fingerprint reader. iOS deferred to Phase 3 (Patreon early-access).

---

## Marketing / Outreach

### Inbound — Closed out 25–26 April

| Contact | Status | Notes |
|---------|--------|-------|
| Nic — Sequenzy | ✅ Replied 25 Apr | Polite decline, warm tone |
| Lasha — Shipit | ✅ Replied 25 Apr | Listing request sent with PH URL |
| Aidan — Talon | ✅ Scan submitted | Report pending at `support@irlid.co.uk` |
| Viberank | ✅ Replied 25 Apr | Thanks + USP feedback acknowledged |
| NextGen Tools | ✅ Listed 25 Apr | Scheduled launch, listing live |
| BacklinkLog | ⏸ Hold | Decision deferred until first Patreon member |

### Conferences / Talks

| Event | Date | Action |
|-------|------|--------|
| 44CON | 17–18 Sep 2026, London | Submit CFP — protocol talk angle |
| EAI SecureComm | 21–24 Jul 2026, Lancaster | Protocol paper angle |
| AidEx Geneva | 21–22 Oct 2026 | Humanitarian / drone delivery — Wisdom connection |
| IEEE GHTC | 7–10 Oct 2026, Colorado | Protocol paper — humanitarian tech |
| Farnborough Airshow | 20–24 Jul 2026 | Press pitch to drone trade outlets |
| BSides Leeds | 13 Jun 2026 | Attend — CFP closed but good community |

### Platforms (pending)

| Platform | Status | Action |
|----------|--------|--------|
| Reddit r/privacy | ⚠️ Karma wall | Build comment history first |
| Hacker News | ⚠️ Karma wall | Comment on threads first |
| Indie Hackers | ⚠️ Karma wall | Comment on threads first |
| David Shapiro Discord | ⚠️ | Try his Discord community |
| r/programming | ⛔ Banned 26 Apr | Low-priority appeal — Spencer's own words |

### Done (high-water mark)

| Platform | Status |
|----------|--------|
| Patreon | ✅ v4 posted 18 April 2026 |
| Twitter/X | ✅ Posted |
| LinkedIn | ✅ Posted |
| Reddit r/netsec | ✅ 28K+ views — v4 update comment posted 20 April |
| Reddit r/SaaS | ✅ Posted 20 April 2026 |
| Reddit r/webdev | ✅ Posted 25 April 2026 (Showoff Saturday) |
| Reddit r/cybersecurity | ✅ Posted 21 April 2026 — FOSS Tool flair |
| Product Hunt | ✅ Launched 23 April 2026 |
| Dev.to | ✅ Posted |
| Hashnode | ✅ Posted |
| YouTube — Nate B Jones | ✅ Commented |

---

## Technical — Pending

- **v5 planning** — Secure Enclave key migration via WebAuthn/Passkeys. Number One proposal owed.
- **PROTOCOL.md update** — Formal redacted receipt schema and verifier behaviour.
- **Imbue pilot design** — First-visit name registration + persistent device-key recognition for attendance logging. Add to org portal spec.
- **DREAMS.md.new cleanup** — Stale draft (21 April, UK date format) sitting next to live `DREAMS.md` (25 April, ISO format). Recommend deletion. Pending Captain's call.

## Roadmap — Master version PROTOCOL.md §12 is canonical

The v5–v10 roadmap is now formally captured in `PROTOCOL.md §12 Master Roadmap` with target dates, effort estimates, and dependencies. **That is the single source of truth.** Summary below for quick scan; defer to §12 for detail.

### Active horizon (May–Jul 2026) — v5

- **v5.0** — Secure Enclave / Passkeys via WebAuthn — *Late May 2026, 2 weeks effort*
- **v5.1** — Imbue pilot — name registration + device-key recognition — *Mid Jun 2026, 2 weeks*
- **v5.2** — Schema fields added: `tframe`, `pframe`, `orient`, `tsTokens` (forward-defined, default-resolved) — *Late Jun 2026, 3 days*
- **v5.3** — `DeviceOrientationEvent` → `orient` field; tolerance cone in verifier — *Mid Jul 2026, 1 week*

### Near horizon (Aug–Nov 2026) — v6 Time anchoring

- **v6.0** — Single RFC 3161 TSA token (FreeTSA)
- **v6.1** — Multi-witness TSA (NIST + NPL + USNO) — state-level threat model
- **v6.2** — OpenTimestamps Bitcoin anchor
- **v6.3** — Hardening + formal threat model write-up

### Mid horizon (Dec 2026–Jul 2027) — v7 Authority infrastructure

- **v7.0** — IRLid Time Authority (Cloudflare aggregator)
- **v7.1** — ZK coordinate hiding
- **v7.2** — Frame-translation verifier libraries
- **v7.3** — Independent security audit

### Far horizon (2028+) — v8 Hardware tier and beyond

- **v8.0–8.3** — Wisdom drone integration; star-tracker + pulsar XNAV anchors (gated on ASE Tech hardware)
- **v9** — Multi-body operation (Moon, Mars) — gated on infrastructure that doesn't yet exist
- **v10+** — Research frontier (full ZK presence, post-quantum, consumer-grade VLBI)

### Forward-defined fields (in PROTOCOL.md, not yet emitted)

- `tframe` — time frame, default `earth/utc` (§10.1)
- `pframe` — position frame, default `wgs84/gps` (§10.1)
- `orient` — quaternion orientation, optional (§10.3)
- `pos` — extended position object supporting cartesian or geographic (§10.3)
- `anchors[]` — celestial attestations (star-tracker, pulsar-xnav, vlbi-quasar, ephemeris-cross) (§10.3)
- `tsTokens[]` — multi-witness TSA tokens (§11.3)

All optional, all default-resolved, all backward-compatible with v3 receipts.

## Infrastructure — Done 25 April

- ✅ `support@irlid.co.uk` email sending — Gmail + Resend SMTP. Verified working.
- ✅ `wrangler.toml` fixed — `irlid-api-test` pointing at correct test DB (`b7d7ccc9`)
- ✅ `org.html` + `wrangler.toml` pushed to GitHub Pages
- ✅ Test environment fully wired — GitHub Pages + Cloudflare Worker (test) + D1 (test)

## Medium Term

- **WFP Innovation Accelerator** — `innovation.wfp.org/apply` (rolling).
- **UNICEF Venture Fund** — `unicefinnovationfund.org` — assess next session.
- **HN/IH karma** — comment on threads first, then post.
- **Wisdom / ASE Tech follow-up** — one-pager drafted by Counsellor Troi. Send when ready.

## Ruled Out

- **Gates Foundation** (April 2026 batch) — medical diagnostics only. Revisit when topic rotates.
- **r/javascript** — too restrictive, poor fit. Not worth attempting.

---

## Mr. Data addendum - 2026-04-26 12:12 BST

Imbue pilot stack update after Number One's return:
- PR #14: stable DEV org key / auto-login (`codex/fix-dev-autologin-org-key`).
- PR #15: fullscreen venue QR now regenerates cleanly and shows org branding/trust cues (`codex/fix-fullscreen-venue-qr-branding`). Still needs merging onward to `main` before GitHub Pages shows it.
- PR #16: dashboard check-out button + `POST /org/checkout` client wiring (`codex/add-dashboard-checkout-action`). Captain merged #16 into #15's branch; no local `git push` needed for that part.
- Next: Number One should inspect/merge the remaining stack to `main`, wait for GitHub Pages deploy, then have Captain hard refresh and verify DEV login, fullscreen venue QR, and check-out flow.
