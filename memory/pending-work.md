# Pending Work — IRLid

**Last refreshed:** Sunday 10 May 2026 morning watch — Captain set Wednesday 13 May target for Org dashboard live port. Two briefs drafted today: `HANDOVER-PositionGrid.md` (v5.7.1w 9-button position picker + Outer/Centre/Inner anchor, retiring the dangling `0bdcd0b` float toggle by reborning the concept properly inside the grid), and `HANDOVER-V5_9_LivePort.md` (3-phase Path A live port: provision `irlid-api-org` Worker + `irlid-db-org` D1, copy dashboard files into `IRLid` repo, first-org seed + smoke). Path A is deliberately scoped — drone delivery / GPS-nearest-staff / recognition-mode / event-receipts integration deferred to v6 brief, with forward-design placeholders left in code comments at the v6 hook points. Drone work confirmed deferred until Org is fully live (Captain's call). Friday evening's claim that float toggle was cherry-picked to main was wrong — `0bdcd0b` survives only as a dangling object and is being deliberately retired in v5.7.1w. PR #101 codex branch did clean correctly (tip = `f9a3f61`, just Mr. Data's mobile sweep).
**Source of truth.** All other lists defer to this file.
**Version-naming authority:** `memory/STATE-OF-PLAY.md`.

## Sunday 10 May 2026 morning watch — Wednesday-deadline live port plan

**The headline:** Captain returned Sunday morning with a Wednesday 13 May target for porting the Org dashboard from test env to live (irlid.co.uk). Sitrep showed test env in good shape (v5.7.1v on main, v5.5.8 deployed) but live repo has NO Org dashboard surface — this is greenfield deployment, not a delta migration. Two briefs drafted to put both threads (UX polish + live port) in motion in parallel.

**Architecture decision for live port (Path A — minimum viable):**

- Stand up SEPARATE live Worker `irlid-api-org` (parallel to existing live `irlid-api` consumer Worker). Wired to NEW production D1 `irlid-db-org`. CORS origin `https://irlid.co.uk`.
- Source: verbatim copy of `IRLid-TestEnvironment/irlid-api/src/index.js`. No merging into the consumer Worker — independent deployment cycles, lower risk for Wednesday, reversible.
- Schema: extracted from `irlid-db-test` `.schema` output as a single canonical DDL, pinned as v6 migration baseline.
- Files copied test→live: `OrgCheckin.html`, `js/orgapi.js`, `js/sign.js`, `js/offline-queue.js`, `js/offline-snapshot.js`, plus referenced QR/SW/asset files. `DEFAULT_BASE_URL` switched to the new Worker URL. DEV bootstrap path gated to test surfaces only.
- First-org bootstrap via direct D1 insert seed file (Captain runs `wrangler d1 execute --file=...` for his test venue).
- Forward-design placeholders left in code comments at v6 hook points (drone zone-gating, GPS-nearest-staff map widget mount, recognition_mode field stub, event_meta_json on receipts).

**Captain handoff sequence (target Wed 13 May):**

- Sunday (today): briefs ready.
- Monday: Captain forwards Phase 1 (Worker + D1 provisioning) to Codex. Mr. Data lands. Captain runs `wrangler d1 create` + `wrangler deploy` PowerShell.
- Tuesday AM: Phase 2 (file copy + API base URL switch). Mr. Data lands. Captain pushes; GitHub Pages auto-deploys to irlid.co.uk.
- Tuesday PM: Phase 3 (first-org seed). Mr. Data lands. Captain runs seed PowerShell.
- Tuesday eve / Wednesday AM: Captain hardware smoke.
- Wednesday PM: declare v5.9 live.

**Two briefs ready on test env main for forwarding:**

1. `HANDOVER-PositionGrid.md` — v5.7.1w [M], 9-button position picker + Outer/Centre/Inner anchor segmented control + animated dot inside each cell visualising the anchor offset. Replaces the 11-option position dropdown with a spatial picker. Retires the dangling `0bdcd0b` float toggle commit (do NOT cherry-pick it; the float concept is reborn properly inside the grid). Worker validation extends to add `bgImageAnchor: outer|centre|inner`. Build pill bump v5.7.1v → v5.7.1w. Independent of live port — can ship in parallel.
2. `HANDOVER-V5_9_LivePort.md` — v5.9 Path A [3 phases: M, M, S], live port master brief. Three sequential PRs with hard-stop boundaries so Captain can verify on hardware between phases.

### Open follow-ups for the next watch

- **Captain forwards Phase 1 of live port to Codex** when rate limit resets Monday.
- **Captain forwards `HANDOVER-PositionGrid.md`** to Codex (independent piece, can run alongside live port phases).
- **Local main restoration if needed** — Friday's PR #101 cleanup chain ran `git reset --hard f9a3f61` on the wrong branch (likely main) due to a leftover cherry-pick state. Remote main is fine. Captain's recovery PowerShell:
    ```powershell
    cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-TestEnvironment" ; git cherry-pick --abort ; git fetch origin main ; git switch main ; git reset --hard origin/main
    ```
    Worth running before any new work, even just to confirm clean state.
- **v5.5.8 end-to-end smoke** of new scrape endpoints on deployed Worker (still pending from Friday).
- **Draft `HANDOVER-V6Promotion.md`** — the v6 master brief covering schema unification, drone audit window, zone-gated VIP, GPS-nearest-staff, recognition-mode UI, event-receipts integration, dyslexia-friendly typography. Massive document; the natural shape of the post-v5.9-live watches.
- **DEV org api_key drift** in test env Worker — still pending.
- **IRLid logo contrast bug** — proper diagnostic deferred (need scan.html pattern + actual logo asset inspection).

### BOOTSTRAP §4 receipt #8 — cherry-pick state blocking branch switch

Friday evening's chain failed because `git switch` aborts on a leftover cherry-pick state, not just on a dirty working tree. Going forward: BOOTSTRAP §4 should explicitly mention `git cherry-pick --abort` (or `--quit`) as a precondition check alongside `git status`. Will fold into BOOTSTRAP next watch when fresh. **UPDATE Sun 10 May:** done — BOOTSTRAP §4 now has the cherry-pick precondition sub-bullet with `git cherry-pick --abort 2>$null` lead-in pattern and `git rebase --abort` / `git merge --abort` companions for full coverage of the trap family.

### Position grid dot-travel polish (defer to v6 polish band)

**Captain's call Sun 10 May after smoke-testing v5.7.1z:** the position grid's anchor function works correctly (changing Outer/Centre/Inner does shift the actual background image on the page), but the visual feedback dot inside the active cell only travels partway — it animates toward the cell centre rather than reaching the visual extreme expected. Functional, just imperfect feedback. Park for a polish pass post-v5.9. Likely fix involves either making cells larger again, increasing the active-state dot size, or recalibrating the percentage offsets to use bigger steps (e.g. Outer at 10% / Centre at 30% / Inner at 50% instead of the current 4px / 33% / 50%).

**Version-letter exhaustion on v5.7.1 band:** v5.7.1z is now the last single-letter slot used. Next inline patches use either patch-style v5.7.1z.1, z.2, etc. (preferred for small fixes) or promote to a new minor band v5.7.2 (preferred when the work is non-trivial). For this polish: v5.7.1z.1 if it ships as a small CSS adjustment; v5.7.2 if it folds into a broader customization-panel polish pass.

### Non-engineering follow-ups

**Trademark research — IRLid (Captain raised Sun 10 May).** Three live trademark databases need interactive search; they're JS-driven apps so web-fetch tools can't query them. Captain to run himself in browser:

1. UK IPO: `https://trademarks.ipo.gov.uk/ipo-tmtext` — search "IRLid" + variants `IRL ID`, `IR LID`, leave classes blank for first pass.
2. EUIPO eSearch: `https://euipo.europa.eu/eSearch/` — same query.
3. Adjacent-risk names to also screen: `iLid`, `RealID`, `IRL`, `IRL.ID`.

For class selection when filing: `https://www.search-uk-trade-mark-classes.service.gov.uk/searchclasses` — query "authentication software" / "identity verification" → expect classes 9 (downloadable software / authentication apparatus), 42 (SaaS / computer services), 45 (security / identity services).

Recommended filing strategy if searches come back clean: UK IPO word mark, classes 9 + 42 first pass (~£170 + £50 = £220 single class, ~£270 for two-class). DIY through IPO online portal is realistic for a solo founder; bring in a solicitor only on opposition or international (Madrid Protocol) expansion. Use ™ now to start common-law claim; switch to ® after registration completes (~4 months UK if unopposed). Open question: file as Captain personally vs as a company — defer until decision-time.

Number One web-search snapshot (Sun 10 May): general web search for "IRLid" trademark returned no hits — encouraging signal but NOT authoritative; the live IPO/EUIPO databases must be queried directly to be sure.





## Friday 9 May 2026 evening watch close-out — v5.5.8 shipped, PR #101 cleanup parked

**The headline:** Mr. Data's `v5.5.8` Website Theme Extraction (PR #102 [L]) merged cleanly. Captain ran `wrangler deploy` from `irlid-api/` — `irlid-api-test` deployed in 17ms, new `/api/scrape-site` (and image proxy) endpoints now live on the test Worker. Mr. Data's track record: 11 quality PRs in a row, no reverts.

**What this watch shipped:**

- `v5.5.8` — Website Theme Extraction (Settings → Branding). Mr. Data PR #102. Worker scrape endpoint with HTMLRewriter + image proxy (SSRF-protected via allowlist regex), client-side canvas pixel sampler with HSL binning for dominant colour extraction, "Use this colour / logo" picker UI, `websiteUrl` settings persistence. 3 files (`irlid-api/src/index.js` +257/-47, `js/orgapi.js` +20/-10, `OrgCheckin.html` +333/-66). Build pill bumped `v5.7.1u → v5.7.1v`. Mr. Data flagged Worker endpoints were `node --check`'d locally but not curl-tested — `wrangler deploy` ran post-merge but **end-to-end smoke of the new endpoints still pending**.
- `v5.7.1u.1` — Image float toggle cherry-picked to main earlier in watch (commit `0bdcd0b`). Float toggle now live; needs hardware verification.

**PR #101 cleanup attempted but NOT effective:**

The cleanup PowerShell ran but failed silently mid-chain due to leftover cherry-pick state from earlier in the watch:

```
fatal: cannot switch branch while cherry-picking
Consider "git cherry-pick --quit" or "git worktree add"
HEAD is now at f9a3f61 Mobile sweep customization panel
Everything up-to-date
```

Reading the chain: `git switch codex/...` aborted; `git reset --hard f9a3f61` ran on whatever branch was current (likely `main`, since Captain had just `wrangler deploy`'d from `irlid-api/`); `git push --force-with-lease origin codex/...` was a no-op because the local codex branch was never touched. **PR #101 on GitHub still has both commits** (Mr. Data's mobile sweep + my u.1 float toggle).

**Recovery for next watch (in order):**

1. **First, restore local main if it was reset.** Remote main is fine (the failed push targeted codex, not main). Local main may now be at `f9a3f61` (the codex branch tip, missing the v5.5.8 + u.1 cherry-picks):
    ```powershell
    cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-TestEnvironment" ; git cherry-pick --abort ; git fetch origin main ; git switch main ; git reset --hard origin/main
    ```
    The `git cherry-pick --abort` clears the leftover cherry-pick state that blocked the original switch. After that, local main matches remote main (which has v5.5.8 + u.1 + everything).

2. **Then redo the PR #101 codex cleanup, this time clean:**
    ```powershell
    cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-TestEnvironment" ; git status   # confirm clean working tree, on main
    git fetch origin codex/v5.7.1v-mobile-sweep-customization ; git switch codex/v5.7.1v-mobile-sweep-customization ; git reset --hard f9a3f61 ; git push --force-with-lease origin codex/v5.7.1v-mobile-sweep-customization ; git switch main
    ```

3. **Smoke v5.5.8 end-to-end.** Open Settings → Branding, enter a website URL, hit scrape, verify the Worker endpoint returns dominant colours + logo candidates without 5xx. Test with a real org website (e.g. irlid.co.uk itself, or one of the venue sites Captain has handy).

4. **Smoke v5.7.1u.1 image float toggle on hardware.**

### BOOTSTRAP §4 receipt #8 — cherry-pick state blocking branch switch

The branch-state-check rule has now tripped **eight times in nine days**. New shape: `git switch` aborts not only on a dirty working tree (receipt #6 / #7) but also on a leftover cherry-pick state. The chained `git reset --hard` then ran on the wrong branch. Going forward: BOOTSTRAP §4 should mention `git cherry-pick --abort` (or `--quit`) as a precondition check alongside `git status`. Will fold into BOOTSTRAP next watch when fresh.

### Open follow-ups for the next watch

- **Local main restoration + PR #101 cleanup redo** (PowerShell above).
- **v5.5.8 end-to-end smoke** of new scrape endpoints on deployed Worker.
- **v5.7.1u.1 image float hardware verification.**
- **BOOTSTRAP §4 strengthen** with cherry-pick-state precondition.
- **DEV org api_key drift** in test env Worker — still pending.
- **HANDOVER-V5_9_LivePort.md** — master brief for the live port chapter; carried over.
- **IRLid logo contrast bug** — proper diagnostic deferred (need scan.html pattern + actual logo asset inspection).



## Friday 9 May 2026 morning watch — three PRs merged + first Captain-driven UX iteration

**The headline:** the v5.7.1 polish series and v5.5.13 Tier 3 cached snapshot all shipped this morning. Mr. Data ran four quality PRs in succession (93, 94, 95, then 96/97/98 today) without a single revert. The fresh-Mr.-Data-prompt pattern from 8 May evening's K.I.A. continues to hold. Captain raised three architectural questions mid-watch (cross-site recognition, OAuth/blockchain GDPR, drone delivery offline-recipient) all answered substantively and banked into spec or v6 brief notes.

**What this watch (9 May morning) shipped:**

- `v5.7.1j` — mobile dashboard reshape (audit-as-primary). Mr. Data PR #96. On phones: hide Attendance Today + Developer diagnostics + Viewing-as Role; prominent "View Attendance Board" button calls enterAuditMode(); stats 2x2; Process scan default-open; Expected list scrollable max-height 60vh + chunky Add form. Light-theme variant included.
- `v5.5.13` — Tier 3 cached org snapshot. Mr. Data PR #97. js/offline-snapshot.js (new) + dashboard load-or-snapshot fallback + recogniseDeviceFp() snapshot fallback for offline doorman flow + freshness label on indicator. Single-org scope; cross-org is v5.8 §14.18 territory.
- `v5.7.1m` — customization panel image-vs-pattern split. Mr. Data PR #98 (Large, +716/-303). Image now top-level Background mode; positioning controls (centre/tile/cover/4 corners); alpha-cycle checkbox so transparent regions of uploaded images let the page palette show through. Worker validation for bgImagePosition + bgImageAlphaCycle.
- **PROTOCOL.md §14.18 refined to Option 2** (Captain's GDPR call). Worker `portal_user_external_links` now stores only `link_hash`; OAuth `external_id`, email, ID token all live in user-held envelope. New sub-sections: link envelope shape, linking flow, verification flow, GDPR position, future blockchain anchoring as additive layer (consistent with §11 tsTokens pattern).

**Three more briefs drafted and pushed (Mr. Data forwarding queue):**

- `HANDOVER-RecognitionToastTweak.md` — v5.5.13.1 [S], toast → console.log on offline-snapshot match.
- `HANDOVER-GatewaySizingMobileButtons.md` — v5.7.1k [M], enlarge gateway states (allow/deny/review/identity, NOT orange), site-wide 44×44 mobile buttons, audit-mode refresh button bottom-right.
- `HANDOVER-CustomizationImagePatternSplit.md` — already shipped via #98 (became v5.7.1m).

**Number One inline work landed (on codex branch — awaiting cherry-pick promotion):**

- `v5.7.1m.1` — Top/Bottom/Left/Right edge anchors added to image position dropdown. 11 total options. Worker validation updated. `wrangler deploy` already ran successfully.
- `v5.7.1.x` — IRLid fallback logo contrast on sidebar. data-irlid-fallback="true" attribute + theme-aware filter:invert(1) for prefers-color-scheme:light or [data-theme="light"]. Org-uploaded logos render as-is. Mirror of scan.html treatment.
- **Prototype-role badge bug fix** (the one Captain has been seeing on the audit board for two days). Diagnosed: org_checkins doesn't carry prototype_role; only org_expected does. Fix: client-side join in renderTable() via expected_id → expectedAttendees → prototype_role. Spencer/Kerry now show their actual staff role 'S' instead of defaulting to 'A'. No Worker change.

### Open follow-ups for the next watch

- **PROMOTE the codex branch work to main.** v5.7.1m.1 + logo contrast + prototype-role fix all live on `codex/v5.7.1m-customization-image-pattern-split` (commits 3c3b353 + new badge fix commit). Cherry-pick PowerShell:
    ```powershell
    cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-TestEnvironment" ; git stash ; git switch main ; git pull ; git cherry-pick 3c3b353 ; git cherry-pick <new-badge-fix-sha> ; git push
    ```
    After Pages redeploys: hard-refresh, verify the audit board shows correct role badges (Spencer 'S', Kerry 'S', Becky 'L'), verify the new edge-anchor positions in image mode, verify the IRLid logo flips contrast cleanly between light and dark mode.
- **Stale codex branch cleanup** post promotion: `git push origin --delete codex/v5.7.1m-customization-image-pattern-split ; git branch -D codex/v5.7.1m-customization-image-pattern-split`.
- **Mr. Data forwarding queue** — `v5.5.13.1` toast tweak [S] and `v5.7.1k` gateway sizing [M] briefs are pushed to test env main, awaiting Captain to forward to Codex when his rate limit resets.
- **`HANDOVER-V6Promotion.md`** — the master brief for the live port. Substantial document; the rest of the next watch's natural shape. Includes schema unification (5 consolidations identified), phased migration strategy (5 phases each shippable + reversible), W3C compliance threading + dyslexia-friendly type, drone audit window pattern, recognition-mode settings option (prebind/postattribute/both), zone-gated VIP access (Captain's "raised eyebrow" idea — clean primitive on top of org_expected), event-receipts-on-receipts-page goal.
- **Optional shift-start role confirmation** — banked for v6. Useful when someone holds multiple roles and wants to scope down for the shift. Off by default; orgs opt in.

### BOOTSTRAP §4 receipt #6 — wrong-branch landing under dirty working tree

The branch-state-check rule has now been tripped **six times in eight days**. New shape this morning: even with `git switch main` unconditionally at the start of the PowerShell chain, **`git switch` aborts when the working tree has uncommitted changes**. The rest of the chained command then runs on whatever branch was current. v5.7.1m.1 + logo contrast landed on the codex branch because Captain's working tree was dirty from a `wrangler deploy` cycle that left files modified, and the `git switch main` aborted silently while the chain continued.

**BOOTSTRAP §4 strengthened with a new sub-bullet** documenting the dirty-working-tree variant + recovery PowerShell using `git stash`. Going forward: before any Number One Edit intended for main, ask Captain to confirm `git status` shows BOTH "On branch main" AND a clean working tree.



## Friday 8 May 2026 evening — `v5.5.12` Tier 2 ALIVE on hardware

**The headline:** the offline-mode chapter that started as a proposal on 6 May night is now live and verified. Captain ticked OFFLINE in DevTools, added an attendee, watched the row appear with a `PENDING SYNC` red pill, untoggled offline, watched it drain to a real Expected row with the `SYNCED` green check fade. *"I built event check-in that survives the venue WiFi dying mid-shift"* is now a true claim — not just a roadmap promise.

**What this watch shipped:**

- `v5.7.1i` — `sign.js` consolidation in `OrgCheckin.html`. Mr. Data PR #93. Drops six `doorman*` duplicate helpers, replaces with `<script src="js/sign.js">` + canonical names. Eliminates the drift class that bit `v5.7.0c-fix` on 6 May night. The HZ: decompressor now uses the canonical `irlidDecompressFromB64url` reader-loop pattern.
- `v5.7.0d` — Multi-key bind UI in escalation modal. Mr. Data PR #94. Claimed Expected rows render dashed/muted with "already bound to `<fp-short>`" subtitle; clicks route to `bindAdditionalKey()` instead of Add-at-the-door (which created duplicates). Mr. Data added a light-theme variant proactively (good citizenship). Playwright smoke covered Bearer + Staff HELLO paths.
- `v5.5.12` — Tier 2 of `§16`: IndexedDB write queue + offline indicator. Mr. Data PR #95. **Three files:** `js/offline-queue.js` (new, 141 lines, IndexedDB `pending_ops` + replay loop, online + visibilitychange + post-load drain triggers); `js/orgapi.js` (single interception in `request()` with QUEUE_ELIGIBLE_PATHS whitelist, two-path enqueue: known-offline + fetch-throws); `OrgCheckin.html` (`§16.5` canonical CSS verbatim, indicator state machine for OFFLINE / SYNCING / SYNCED transitions with 1.5s green-check fade, optimistic local rendering for queued check-ins / settings / Expected adds). **Zero Worker changes** by design — `§16.3` accepts duplicates because the audit trail is the truth.
- `v5.5.12.1` — Indicator placement nudge. Captain's UX call: top-right at 16px (canonical `§16.5`) collided with topbar Refresh / Audit / CSV / Sign out controls. Moved to `bottom: 88px; left: 16px;` — sidebar empty space just above Settings, clear of footer build pill. CSS-only, +6/-1 lines. **Currently sitting on `codex/v5.5.12-offline-queue` as commit `0dae81a` instead of main** — wrong-branch landing during the post-#95 push. `git cherry-pick 0dae81a` onto main is the recovery. BOOTSTRAP §4 receipt +1.
- PROTOCOL.md `Version History` row for v5.7.1. Live repo, direct commit. Covers §14.17 doorman flow on hardware + §16 Tier 1 PWA shell + audit mode + v5.7.1f auto-staff-sign-in in one prose row.

**Three handover briefs drafted and consumed in one watch** — `HANDOVER-SignJsConsolidation.md`, `HANDOVER-MultiKeyBindUI.md`, `HANDOVER-OfflineWriteQueue.md`. The fresh-session prompt pattern (when Mr. Data #1 was K.I.A. on a Codex backend 503 mid-implementation, a fresh Mr. Data #2 picked up cleanly from the brief alone with no chat-history loss) held perfectly. Worth banking for next time.

**Smoke verified by Captain on hardware:** items 1–6, 14, 17, 18–21 from the smoke list, plus the `v5.5.12` acceptance scenario end-to-end.

### Open follow-ups for the next watch

- **`v5.5.12.1` indicator-placement cherry-pick.** PowerShell already provided; one click for Captain when ready: `cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-TestEnvironment" ; git switch main ; git cherry-pick 0dae81a ; git push`. After ~60s for Pages, indicator moves bottom-left.
- **Stale codex branch cleanup.** `codex/v5.5.12-offline-queue` is now stale (#95 merged via the squash that didn't include `0dae81a`). After cherry-pick lands: `git push origin --delete codex/v5.5.12-offline-queue ; git branch -D codex/v5.5.12-offline-queue`. Cosmetic.
- **DEV org api_key drift in test env Worker.** During smoke, the DEV bootstrap api_key returned 401 on `/org/settings`, `/org/attendance`, `/org/expected`. Real-auth (QR-Bearer) path works fine; only the DEV auto-login bootstrap is broken. Worker env var `DEV_DEFAULT_ORG_KEY` (or whatever the bootstrap fixture uses) has drifted from D1 row. Worth a small Worker patch when convenient. Not blocking — production uses real Bearer auth.
- **`v5.5.13` Tier 3 — Cached org snapshot.** §16.3 Tier 3. The chapter that turns offline mode from "the page loads + writes queue" into "the door actually recognises returning regulars without connectivity". Captain raised this directly mid-watch ("can offline let in those it's recognised before?"). Brief largely writes itself off the spec. Mr. Data candidate. Recommend queuing immediately after v5.5.12.1 lands.
- **Mobile Expected-list polish (`v5.7.1j`).** Captain's directive earlier in the watch: on mobile, Expected list at top filling most of viewport, Add attendee form below, large tap targets. Bundles with Task #37 (collapse Attendance Today on phones, default-open Process scan expander). Number One Task #12 (`HANDOVER-MobileExpectedPolish.md`) drafted-pending; bundling decision still awaiting Captain's call.
- **Gateway screen sizing.** Captain noted *"Gateway screens are still a little small"* mid-watch. The `org-entry.html` welcome state has plenty of empty real estate around small type. Quick CSS bump — Number One inline candidate.
- **Prototype-role badge bug** (carried over from morning). Spencer/Kerry show `A` on attendance rows despite staff role. Becky shows `L` correctly. Field-threading bug. Captain's framing: *"that for another time and another you"*. Worth a half-hour next watch.

### Deferred / known issues — leave alone unless Captain raises them

- **`v5.5.9` org-switch dashboard state bleed.** Switching orgs leaves previous org's Attendance Today rows visible until hard refresh. Captain explicitly said *"leave it alone"*.
- **USB webcam QR decode unreliability.** Hardware constraint, not code. Phone-as-scanner is the production deployment.
- **First sign-in needs two devices.** v5 hardware credential is per-device; v5.7.1c flow collapses it to one device + one biometric (post-`v5.7.1f` automatic on staff-list arrival).

### BOOTSTRAP §4 receipts

The branch-state-check rule has now been tripped **five times** in seven days:

1. PROTOCOL.md commit on `codex/v5.7.0a-doorman-worker` (6 May).
2. scan.html commit on `no1/scan-universal-ingress` (6 May).
3. Terminal still on feature branch after PR #4 merge (6 May).
4. `v5.7.0c-fix` landed on `codex/v5.7.0c-followup-2-process-scan-handler` instead of main, mid-recovery from #3 (6 May night).
5. **`v5.5.12.1` indicator move landed on `codex/v5.5.12-offline-queue` instead of main (8 May evening — this watch).**

The pattern: working tree on a feature branch, Number One edits a file, Captain commits-and-pushes assuming main, file lands on the wrong branch. The §4 rule mandates `git switch main` unconditionally before any push that must land on main. **The new shape this watch surfaced:** even when Number One's CSS edit is intended for main, if the working tree is on a feature branch when the Edit tool runs, the commit goes to the feature branch unless explicitly switched first. Worth a sub-bullet in §4 next BOOTSTRAP refresh: *"check working-tree branch before any Number One Edit that's intended for main."*

## Friday 8 May 2026 — port reached: `v5.7.1a..h` shipped, audit board live on hardware

**The headline:** the doorman flow that went live on hardware 6 May night watch is now wrapped in a deployable shell. PWA caches the dashboard offline-cold (Tier 1 of `§16`), staff-scan hand-off works phone-only, audit mode shows the attendance table as an airport-arrivals board edge-to-edge in landscape on tablets and PCs. Captain verified the final v5.7.1h audit-board view on his Huawei tablet propped on cardboard in his workspace — Kerry IN, Spencer IN, Becky expected, "Exit audit" button correctly placed, dark-themed table fills the screen.

**What this watch (7–8 May) shipped (live + test env, all deployed):**

- `v5.7.1a` — PWA shell (Tier 1 of `§16`). `sw.js` + `manifest.json` + Service Worker registration + `<link rel="manifest">`. Pre-cache `OrgCheckin.html` + `org-entry.html` + JS bundle + favicon + manifest. Cache-first strategy in v1.
- `v5.7.1b` — Staff-scan hand-off. `scan.html` device_key gate gets "Open in staff dashboard" button. Dashboard reads `#staff_scan=` hash on load, cleans the URL, after sign-in auto-populates Process scan and triggers it.
- `v5.7.1c` — Same-device direct WebAuthn sign-in. Dashboard receives staff_scan with no session → auto-redirect to `org-login.html?nonce=…&worker=…&return=…`. After WebAuthn, bounce back with pending nonce → poll once → restore session → process the staff scan inline. Single device, two QR scans, one biometric.
- `v5.7.1d` — Diagnostic `[staff_scan]` console logs added when v5.7.1c didn't fire. Stayed in for future debugging.
- `v5.7.1e` — PWA cache trap fix. Captain's phone was serving cached v5.7.1b after v5.7.1c+ deployed because cache-first wins for HTML. Two-part fix: bumped `CACHE_VERSION` v1 → v2 to force purge on next SW activation, AND switched HTML/navigation requests to network-first so future bumps aren't required to make updates propagate. Also: sign-out flag (`localStorage.irlid_signed_out`) set by `signOutOrg()` and respected by `DEV_AUTO_LOGIN` so refresh after sign-out doesn't silently re-sign-in.
- `v5.7.1f` — Auto staff sign-in on venue arrival. When `org-entry.html` recognises a staff-tier device (matched on Expected list with `staff`/`manager`/`lead_admin`/`developer` role) AND `hasActiveSession()` is false, after the 7s green-confirm hold the phone diverts to `org-login.html` with a pending nonce stashed in localStorage. Dashboard polls the nonce on return and restores. Net: staff walk in working, attendees walk in as guests. Captain's exact directive: "if staff are not on expected list auto permissions don't happen, they could be attend the event rather than working it" — honoured.
- `v5.7.1g` — Six bugs fixed in a single push:
  1. Delete record column alignment on IN rows. `.checkout-actions` wrapped Initiate-check-out + Delete record but didn't fill the cell, so the inner Delete's `margin-left:auto` only pushed against the wrapper. Fix: `.checkout-actions { flex: 1 1 auto; width: 100%; }` (and same for `.conflict-actions`).
  2. Refresh button visual feedback. `refreshAttendance()` was working silently. New `refreshAttendanceFromUI()` wrapper adds `.is-refreshing` class with spinning ↻ glyph + "Refreshing..." status + "Attendance refreshed" toast. Also refreshes Expected list.
  3. Mobile-friendly escalation modal. `@media (max-width: 640px)` block stacks the two-column body vertically, bumps fonts (h3 17→18px, row 12→15px), enforces 44px tap target heights.
  4. Orange QR centring + sizing. `body.status-orange .wrap { width: 100vw; padding: 16px 10px; }` overrides the default `.wrap` 92vw cap so the orange QR can fill the screen edge-to-edge instead of being clipped.
  5. F5 wipes Imbue Ventures session. `DEV_AUTO_LOGIN` was running on every page load and overwriting `STORAGE_KEY_ORG` with the DEV org, clobbering Captain's QR-signed-in api_key. Fix: skip `DEV_AUTO_LOGIN` when `irlid_login_session` has a session_token.
  6. Sidebar shows actual auth state. Was always saying "Signed in locally (DEV auto-login)" because it checked the `DEV_AUTO_LOGIN` constant, not whether DEV path actually ran. Now reflects `qrLoginSession`: "Signed in as {display_name}" / "(developer)" suffix / falls back to "DEV auto-login" only when DEV path actually fires.
- `v5.7.1h` — Stay/redirect + audit mode. After escalation resolution (bind/add succeeds), 3s "Linked: {name}" toast with "Stay on dashboard" button. Default action redirects to `scan.html` for the next chimp (pocket-shoving works). Stay tap → enters audit mode. Audit mode = `requestFullscreen()` + `screen.orientation.lock('landscape')` (best-effort, Safari iOS doesn't support but degrades gracefully) + `body.audit-mode` class hides sidebar/topbar/intro/stats/role-toolbar/details, promotes the attendance card to fill viewport with bumped 16px row fonts. Floating "↩ Exit audit" button top-right. Topbar `⛶ Audit` button visible only on Dashboard panel so staff can enter audit mode any time without a prior scan. **Verified on Captain's Huawei tablet** — airport-arrivals-board look as designed.

### Open follow-ups for the next watch

- **Prototype-role badge wrong on attendance rows** (Captain flagged 8 May, deferred). The audit board shows Spencer Austin and Kerry Austin with `A` role badge despite both being created at-the-door with `staff` role. Becky Wetherill correctly shows `L` (lead_admin). Likely a missing `prototype_role` / `role` field threading from the Expected entry through the attendance aggregation into the role-pill render in `renderTable()` / `att-role-col` cell. Captain's words: *"that for another time and another you"*. Probably 1–2 hours; small but visible.
- **`v5.5.12` Tier 2 of §16** (IndexedDB write queue + blinking-red-dot offline indicator). Tier 1 PWA shell is shipped. Tier 2 is the genuinely-new capability the offline proposal promised: queue Worker POSTs when offline, replay via Background Sync API on reconnect, show the blinking red dot from `§16.5` while offline. This is the next chapter of the project and what makes "I built event check-in that survives the venue WiFi dying mid-shift" a true claim.
- **`v5.7.0d` multi-key bind UI** (Task #32). Worker endpoint `/org/expected/:id/bind-additional-key` already exists from `v5.7.0a`. Escalation modal needs to show claimed Expected rows distinctly ("already bound to <fp-short>") and route picks to the bind endpoint instead of Add-at-the-door (which creates duplicates). Becky Wetherill's row in the audit board shows the kind of multi-key situation this would handle cleanly.
- **`sign.js` consolidation in `OrgCheckin.html`** (Task #31). Drop the doorman duplicates (`doormanB64urlDecode/Encode`, `doormanCanonical`, `doormanHashPayload`, `doormanDecompressB64urlJson`, `doormanVerifyDeviceEnvelope`) — they're stale copies of `js/sign.js` helpers and the divergence already bit us once during `v5.7.0c-fix`. Add `<script src="js/sign.js"></script>` to OrgCheckin head, delete duplicates, rename call sites.
- **Mobile-first staff dashboard polish** (Task #37). Pixel 8 Pro view of the dashboard is still cluttered; collapse Attendance Today on phones by default, default-open Process scan expander on phones, larger touch targets.
- **`scan.html` org-login QR recognition** (Task #38). v5.5 portal sign-in QR isn't routed by `scan.html`'s `classify()`. Add detection for `org-login.html?nonce=…&worker=…` URLs and pass through.
- **PROTOCOL.md Version History row for v5.7.1**. The §1.1 history table needs a v5.7.1 entry pointing at §14.17 doorman flow + §16 PWA shell + audit mode. Currently stops at v5.7.0.
- **Captain's house-keeping pending in live repo.** `DREAMS.md` has uncommitted entries dated 7–8 May (Captain's content). Audit found three stale local branches in live (`codex/assistqr-protocol`, `no1/protocol-1409-1417-regency`, `no1/v5-passkey-signing`) and one in test env (`codex/v5.7.0b.2-absolute-scan-url`) — already merged via squash, safe to delete. Not blocking; cosmetic.

### Deferred / known issues — leave alone unless Captain raises them

- **`v5.5.9` org-switch dashboard state bleed.** Switching orgs leaves previous org's Attendance Today rows visible until hard refresh. Captain explicitly said *"leave it alone"*. Mirror PR #82's reset pattern in `loadDashboardForOrg()` if priority shifts.
- **USB webcam QR decode unreliability.** TOALLIN 2K and consumer USB webcams generally — hardware constraint, not a code bug. Production deployment is phone-as-scanner. Don't burn watches chasing.
- **First sign-in needs two devices.** v5 hardware credential is per-device; the very first staff sign-in on a new phone needs `OrgCheckin.html` displaying a sign-in QR from another device, OR the v5.7.1c flow which collapses it to one device + one biometric (post-`v5.7.1f` this is automatic on staff-list arrival).

## Wednesday 6 May 2026 night watch — `v5.7.0` doorman flow ALIVE on hardware

**The headline:** the §14.17 doorman flow Captain has been chasing across multiple sessions is live on test env, end-to-end, on real phones. Pixel 4a (unrecognised) → orange device-key QR → 4a screenshot uploaded → desktop dashboard `Decode image` + `Process scan` → escalation modal opens → Add at the door → "Test 4a" Expected row created with `linked expected` green status, attendance row in Today's table.

**What the night watch shipped:**

- `v5.7.0c-fix` (test env, commit `a303116`) — `doormanDecompressB64urlJson` rewritten with explicit reader loop, matching the canonical `irlidDecompressFromB64url` pattern in `js/sign.js`. Closes the silent hang on compressed (`HZ:`) device-key QRs caused by Chrome's `new Response(stream).arrayBuffer()` mishandling of streams that error before emitting chunks. Process scan went from "Processing scan..." forever to clean modal in <100ms.
- `BOOTSTRAP §4` (live repo, commits `034f12f` then strengthened `914dcdc`) — branch-state-check rule. Pattern observed four times in three days (PROTOCOL.md commit on `codex/v5.7.0a-doorman-worker`, scan.html commit on `no1/scan-universal-ingress`, terminal-still-on-feature-branch after PR #4 merge, then `v5.7.0c-fix` itself landed on `codex/v5.7.0c-followup-2-process-scan-handler` mid-recovery from the third). Strengthened to mandate `git switch main` unconditionally before any push that must land on main; fenced PowerShell recovery dance written out in §4 itself.
- Stale `codex/v5.7.0c-followup-2-process-scan-handler` branch deleted both ends (closed superseded PR cleanly).

**Live diagnostic on hardware** (post-decompression-fix):

- 4a `pub_fp`: `6vWr4oPZPZRwKB4s` (unrecognised on Imbue Ventures, expected)
- Console: `[scan] decoded payload {type: 'device_key', pub_fp: '6vWr4oPZPZRwKB4s'}` — the line that never logged before tonight.
- Status: `Device-key QR opened escalation.`
- Dashboard row: `Test 4a · 06/05/2026, 19:11 · 0 scans · linked expected (green)`
- Escalation modal verified: device chip rendered, scanned-at timestamp shown, "Choose from List" populated with three unclaimed Expected rows (Kerry Austin, Some Random, Becky Wetherill), "Add at the door" with role-tiered tabs (Attendee/Staff/Manager/Lead Admin) and First-name/Surname fields.

**v5.7.0c-followup status:** RESOLVED in two waves. First wave was Mr. Data's PR #91 (scan widget relocated into Dashboard panel) + PR #92 (`[scan]` diagnostics + textarea-priority + Developer Bearer bypass) earlier today. Second wave was tonight's decompression hang fix. The flow now works end-to-end without console workarounds.

### Open follow-ups from tonight

- `v5.7.0d` — surface multi-key bind in escalation modal. Currently when a known person scans from a second device (Spencer's 4a alongside the 8 Pro), the existing Expected row is filtered out of "Choose from List" (only unclaimed rows show), so the only path is "Add at the door" which creates a duplicate. Worker endpoint `/org/expected/:id/bind-additional-key` from `v5.7.0a` already exists — UI just needs to (1) show claimed rows distinctly ("already bound to <device-fp-short>") in search results, (2) when picked, fire bind-additional-key, (3) update the Expected row's `device_key_fps[]` array. Mr. Data candidate, Medium PR.
- `v5.7.0c-fix` consolidation candidate — `OrgCheckin.html` maintains `doormanB64urlDecode/Encode`, `doormanCanonical`, `doormanHashPayload`, `doormanDecompressB64urlJson`, `doormanVerifyDeviceEnvelope` — all duplicates of helpers in `js/sign.js`. Drift risk between the two copies is exactly what bit us tonight. Add `<script src="js/sign.js"></script>` to `OrgCheckin.html` head, drop the doorman duplicates, use canonical names. Mr. Data candidate, Medium PR (~80 lines deleted, a few call sites renamed).
- `Polish 27` (Task #27) — `decodeDashboardQrPayload` error messages. When a non-payload URL is pasted (e.g. venue check-in URL), atob() throws "string to be decoded is not correctly encoded". Detect URL with no `payload`/`qr`/`irlid` param and emit a useful message instead.
- `Polish 28` (Task #28) — Staff Auth pill state for Developer Bearer. The `UNAUTHENTICATED` red pill on the Staff Auth panel is misleading when Bearer session is active and `is_developer:true`. Polish 11 sweep means Bearer satisfies staff-gated endpoints — pill should read "Bearer session active" or hide entirely for Developers. Same area as Task #25 (shrink Staff scan panel) — fold together.
- `Polish 29` (Task #29) — favicon for test env. Console-noise only.

### Cleanup item Captain may handle anytime

- Delete the `Test 4a` Expected row created tonight via the doorman-flow verification. One-click via Delete expected on the Dashboard.

### Late evening watch — `v5.7.0e` through `v5.7.0p` polish round

Shipped after the doorman-flow verification, before sleep. All test env unless noted.

- `v5.7.0e` — Dashboard compaction + permissions tidy. Staff Auth panel hidden for Developer Bearer (Polish 11 sweep makes it redundant). "Staff scan" header renamed "Process attendee scan." Debug maintenance + Expected attendee management collapsed into `<details>` expanders.
- `v5.7.0f` — Dashboard reorder (Attendance Today above Process scan) + GDPR default tab (Check-in panel, not Dashboard, on sign-in — public-safe branded screen with no PII).
- `v5.7.0g` — Cascading delete for full attendee records (Worker `DELETE /org/expected/:id/full` + UI Delete record button). Lead Admin+ only. Worker enforces "check them out first" guard with `?force=true` override for IN-status rows.
- `v5.7.0h–p` — Live webcam scanner (html5-qrcode, mirrored from live `scan.html` pattern) plus Role column moved out from under Action and CSS polish iterations. Camera viewport renders cleanly; the scanner library starts and reaches the decode loop.
- **`v5.7.0c-fix` was committed `a303116` with the explicit reader loop. Doorman flow is alive end-to-end on real hardware — verified with the Pixel 4a creating a `linked expected (green)` row in Imbue Ventures.**

**Webcam decode caveat (carry-over).** The TOALLIN USB webcam (and consumer USB webcams generally) struggle to decode QRs even with html5-qrcode running cleanly. Phones decode reliably because phone optics are tuned for it (aggressive autofocus, edge enhancement). Plan B (custom `jsQR + requestAnimationFrame` loop, mirroring the working pattern in live `scan.html` lines 552–570) is available but likely won't fix the hardware-side issue. Realistic deployment shape: phone-as-attendee, tablet-as-scanner. The desktop webcam is a development convenience, not a production scanner.

### `OFFLINE-MODE-PROPOSAL.md` ratified

Promoted to `PROTOCOL.md §16` (live commit `3cb4185`). Tiers 1–3 ship as `v5.5.x` patches. Tier 4 (multi-device offline mesh) ratified as `v6` flagship research-grade work. Original proposal preserved at `archive/OFFLINE-MODE-PROPOSAL.md` (git rename detected, history preserved). `HANDOVER-OfflineShell.md` for `v5.5.12` (PWA shell, Tier 1) drafted in test env, ready for Mr. Data Tuesday morning.

### `BOOTSTRAP §4` strengthened twice in three hours

Branch-state-check rule added (live commit `034f12f`) then strengthened (live commit `914dcdc`) after the rule was tripped a fourth time within the same hour as it shipped. Mandates `git switch main` unconditionally before any push that must land on main, with the recovery dance (cherry-pick + clean-up) written out as a fenced PowerShell block in §4 itself. The pattern is visible enough now that the next Number One inherits both the rule and the receipts of why it exists.

## Wednesday 6 May 2026 — full `v5.7.0` doorman stack shipped end-to-end

**Today landed a lot. Order of merges, all to test env unless noted:**

- `v5.5.4` confirmed live + working — PR #80 (Polish 11 Task 2 Bearer sweep) verified post-merge.
- `v5.5.5` merged + verified end-to-end — PR #82 (portalState + api_key resolution). Browser test: full save round-trip on Imbue Ventures, org-switch loads correct api_key, switch-back restores values from D1, hard-refresh persists. Morale-blocker closed.
- `v5.5.10` merged — PR #85 (both save buttons save absolutely everything; theme included in payload + readback parity check).
- `v5.5.11` merged — PR #90 (role-gated buttons hidden when role doesn't permit; effectiveRoleRank() used for gate; Staff role can no longer see Delete expected).
- Stranded doorman brief commit (`8bf88f7`) cherry-picked to test env `main`.
- `v5.7.0a` Worker merged + deployed — PR #81 (multi-key binding + role-gated Add + freshness gate).
- `v5.7.0a-followup` merged + deployed — PR #84 (`/org/expected/lookup-by-fp/:fp` polling endpoint, leverages existing `findExpectedByDeviceFp()`, multi-key `rebind_history` matches resolve as `linked` too).
- `v5.7.0b` merged — PR #83 (phone-side orange-state QR, signed `device_key` envelope, 2s polling, 5-min regenerate).
- `v5.7.0b-polish` merged — PR #87 (orange QR encoded as `scan.html?type=device_key&payload=...` URL; OrgCheckin.html unwraps payload param before scanning).
- `v5.7.0b.1` merged — PR #88 (orange QR maximised to ~82% viewport width, level-H error correction, "Hold your phone up so staff can scan it. You don't need to hand it over." subtitle).
- `v5.7.0b.2` already-shipped via PR #89 (orange QR URL is absolute `https://irlid.co.uk/scan.html?...`; Mr. Data correctly identified the change was already on main and didn't open a redundant PR).
- `v5.7.0c` merged — PR #86 (dashboard escalation modal + role-tiered Add tabs + scanner type-branch on `device_key` envelope).
- **Live repo: `scan.html v5.7.1`** merged — PR #3 (live repo, universal QR ingress: `?type=`/`?payload=` and compact `?h=`/`?hz=`/`?d=`/`?dz=` params, type-aware `classify()`, fullscreen gating overlay for non-receipt envelopes; Captain's blinking-red-dot directive captured for offline mode separately).

**Major proposal drafted, awaiting Captain's ratification:**

- `OFFLINE-MODE-PROPOSAL.md` at repo root — `PROTOCOL.md §16` candidate covering offline-first design principle, four-tier path (PWA shell → IndexedDB queue → cached snapshot → multi-device mesh), time-anchoring via `§11 tsTokens`, blinking red dot UI directive, connection to `v6` themes (Wisdom humanitarian, multi-party custody, trust network). Commit pending Captain's read.

### `v5.7.0c-followup` — scan widget orphan (urgent for testing)

**Found 6 May late evening during Captain's first end-to-end test attempt.** The unified Check-in design (`prototype-checkin` class on body) correctly hides the legacy Doorman mode card on the Check-in panel — but the dashboardScanBox / "Process scan" widget that `v5.7.0c` added lives INSIDE that hidden Doorman card. Result: the escalation modal can't be triggered through the unified UI; v5.7.0c is effectively unreachable without dev-console workarounds.

Brief drafted late evening, sent to Mr. Data. Branch `codex/v5.7.0c-followup-scan-widget-relocation`. Small fix — relocate the widget into the Dashboard panel where staff actions belong, or have `applyCheckinPrototypeLayout()` move it alongside `expectedPanel` and `roleToolbar`. Once shipped, end-to-end test of the doorman flow becomes possible without console hacks.

### Other open / queued items (logged 6 May)

- `v5.5.9` Dashboard table state bleed on org-switch — found 6 May morning. Mirror PR #82's reset pattern in `loadDashboardForOrg()`. Functional confusion, not data corruption. Still open.
- `v5.7.0b.1.1` (or polish) — orange QR centring on portrait viewports (Captain's testing 6 May late evening). Tiny CSS fix.
- `v5.7.0b polish` — orange screen +3s hold before transition (Captain's UX feedback earlier today). Small.
- `v5.7.x cleanup` — retire Doorman mode toggle / unified Check-in cleanup. Same area as the scan-widget-orphan fix; could fold together.
- `v6` GPS-guided "nearest staff" feature on orange screen — design captured for later. Includes Captain's directive to add a placeholder for the map widget NOW so the visual frame is ready when v6 lands.
- `v5.6.0` AssistQR — Mr. Data's continuing primary stack on `codex/assistqr-*` branches.
- `v5.5.6` Polish 11 Task 3 — jsQR Staff HELLO upload UI. Brief at HANDOVER-Polish11.md Task 3.
- `v5.5.7` Batch C.5 — Staff invite scan-in flow. Spec'd in PROTOCOL.md §14.15.
- `v5.5.8` Batch D — Website-scrape theme extraction. Spec'd in §14.13.
- `v5.7.1` polish — orange QR friendlier-for-non-IRLid-scanners. Largely superseded by `scan.html v5.7.1` shipping universal-ingress.

### Mr. Data's plate going into the night

- `v5.7.0c-followup` (scan widget relocation) — assigned end of evening; small fix.
- `v5.6.0` AssistQR — primary stack continues on his branches.

### Mr. La Forge

`HANDOVER-YubiKey.md` ready when commissioned. No change.

---

## Wednesday 6 May 2026 morning watch — `v5.5.5` closed + doorman moving

**Original morning summary (kept for historical record; superseded by today's full-day section above):**

- `v5.5.4` confirmed live + working — PR #80 (Polish 11 Task 2 Bearer sweep) verified post-merge.
- `v5.5.5` merged + verified end-to-end — PR #82 (portalState + api_key resolution).
- Stranded doorman brief commit (`8bf88f7`) cherry-picked to test env `main`.
- `v5.7.0a` Worker merged + deployed (PR #81, multi-key binding + role-gated Add + freshness gate).
- `v5.7.0b` phone work assigned to Mr. Data.

**New bug found this morning — `v5.5.9` candidate.** Dashboard table state bleed on org-switch. Switching from Org A to Org B leaves the previous org's Attendance Today rows visible until a hard refresh forces re-fetch. Same shape as the `v5.5.5` Branding bleed but on the dashboard's attendance/expected state surface, not portalState. PR #82 reset portalState on org-switch but didn't touch attendance table render. Likely fix: mirror PR #82's reset pattern in `loadDashboardForOrg()` — clear attendance + expected list state before re-fetching from the new org. Functional confusion, not data corruption.

**Second new bug — `v5.5.11` candidate.** Role-gated action buttons stay visible regardless of viewing role. The prototype-role-toolbar correctly displays the policy text (*"Staff can add attendees and assist review cases. Delete, clear, settings, and staff-role actions stay locked."*) when set to Staff, but the Delete expected buttons (and likely Clear test attendance, settings affordances, etc.) remain rendered and clickable. Should be hidden entirely (not just disabled) when current role doesn't permit. Use existing `effectiveRoleRank()` helper (commit `c58b23c`) for the gate. Investigation pass needed: enumerate all role-gated buttons in `OrgCheckin.html` first, then a single sweep PR. Captain's posture: prototype gating must enforce, not just label.

**Third gap surfaced — `v5.7.0a-followup` Worker.** Mr. Data spotted in his PR #83 description that PR #81 merged without exposing `GET /org/expected/lookup-by-fp/:fp`, so `v5.7.0b`'s phone polling has no live target. Brief written and ready to forward; small endpoint addition.

**Diagnostic notes from this morning:**

- `v5.5.5` initial test failed because Captain clicked "Save theme" (theme-only save) not "Save All Settings" (full payload save). UX confusion masking a working save path. Polish ticket: duplicate "Save All Settings" button near Branding fields. Tag `v5.5.10`.
- `wrangler` re-authed cleanly via OAuth. D1 query against `irlid-db-test` confirmed both orgs (`Imbue Ventures` + `Test Venue`) present with api_keys matching localStorage exactly.
- Direct URL test (`https://irlid-api-test.irlid-bunhead.workers.dev/org/settings?key=...`) returned 200 with full settings JSON — confirmed deployed Worker is healthy. Earlier 401 storm was the api_key race PR #82 fixed.

### Queue going forward

- `v5.5.6` — Polish 11 Task 3, jsQR Staff HELLO upload UI (jsQR vendoring already landed; UI follow-up open).
- `v5.5.7` — Batch C.5, Staff invite scan-in flow (spec'd in PROTOCOL.md §14.15).
- `v5.5.8` — Batch D, Website-scrape theme extraction (spec'd in §14.13).
- `v5.5.9` — Dashboard state bleed (new this morning, see above).
- `v5.5.10` — **Unify Save buttons. Both must save ABSOLUTELY EVERYTHING.** Captain's restated directive 6 May late-morning: Save All Settings (right panel) AND Save theme (Theme section) should both POST the full payload — basic gates + Branding + theme (with every sub-field: primary, accent, qrFg, palette, bgPalette, darkMode, bgMode, bgIntensity, bgPattern, bgImageUrl, cycleMode, bgAnimDuration, cycleAnimDuration). Same handler, same readback verification (must verify theme sub-fields round-trip too, not just basic + Branding), same toast. Acceptance: edit palette → click EITHER button → switch orgs → switch back → palette persists. If Mr. Data's first attempt only added `theme: activeTheme` to the payload without extending readback, the bug isn't truly closed and a second pass is needed.
- `v5.5.11` — Role-gating sweep: hide action buttons (Delete expected, Clear test attendance, settings affordances) entirely when current role doesn't permit. Found 6 May, see above.
- `v5.7.0a-followup` — Worker `GET /org/expected/lookup-by-fp/:fp` polling endpoint (closes the gap PR #81 left). Brief drafted 6 May; assigned to Mr. Data.
- `v5.6.0` — AssistQR / §15, Mr. Data's continuing primary stack on `codex/assistqr-*` branches.
- `v5.7.0b` — Doorman phone, Mr. Data assigned this morning.
- `v5.7.0c` — Doorman dashboard, queued after `v5.7.0b`.

### Mr. Data's plate going into Captain's work day

- `v5.7.0b` doorman phone (assigned, working overnight)
- `v5.6.0` AssistQR (continuing)

### Mr. La Forge's plate

`HANDOVER-YubiKey.md` ready when commissioned. No change.

---

## Tuesday 5 May 2026 evening watch — `v5.5.x` consolidation + tidy

**Three watches today** (Number One Sessions 01 morning + 02 afternoon + 03 evening). Sessions 01 + 02 covered: PROTOCOL.md §14.9 expansion + §14.17 doorman + §14.18 OAuth/recovery quorum (PR #2 merged), Polish 11 hotfix (`v5.5.3`) + Mr. Data's full Task 2 sweep (`v5.5.4` PR #80), `BOOTSTRAP.md` created, regency refinement to `LONG-TERM-SUCCESSION.md`, doorman implementation gap identified.

**Session 03 (this evening) — what landed:**

- `BOOTSTRAP.md` softened to "Working conventions" — copy-paste discipline, Mr. Data brief shape, version naming (`vX.Y.Z`), GitHub web links. Multiple commits.
- `memory/STATE-OF-PLAY.md` published — version-mapping authority + single-glance dashboard. Locks the legacy → `vX.Y.Z` mapping including the Batch-6.5 / roadmap-v6.5 collision retirement.
- `memory/AUDIT-2026-05-05-eve.md` written — orphans + junk audit across both repos.
- Live repo cleanup: `desktop.ini` removed and `.gitignore`'d (commit `1cc58f2`); 8 historical briefs moved to `archive/` (commit `00389ce`).
- Test env cleanup: stale `PROTOCOL.md` duplicate deleted (commit `eb8d009`, canonical wall restored per `memory/crew-protocol.md` §2.1).
- `IRLid-TestEnvironment\HANDOVER-DoormanEscalation.md` published — `v5.7.0` three-PR brief for Mr. Data (Worker → phone → dashboard).
- `CLAUDE.md` milestones retagged with `vX.Y.Z` prefixes (recent rows) + 5 May entries appended.
- Mr. Data assigned `v5.7.0a` — in flight on `codex/v5.7.0a-doorman-worker` branch.

### Open / queued for tomorrow's first Number One

1. **Recover stranded doorman-brief commit on test env.** Captain's final push of `HANDOVER-DoormanEscalation.md` went to `codex/v5.7.0a-doorman-worker` (Mr. Data's branch) instead of `main` — terminal was on the codex branch when the assignment to Mr. Data created it. Brief reachable from the codex branch so Mr. Data isn't blocked; `main` hygiene only. Recovery:
   ```powershell
   cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-TestEnvironment" ; git switch main ; git pull origin main ; git cherry-pick 8bf88f7 ; git push origin main ; git status
   ```
2. **`v5.5.5` Polish 11 Task 1 — settings persistence bug.** Awaiting Captain's browser repro (toast text + console + D1 row). Brief at `IRLid-TestEnvironment\HANDOVER-Polish11.md` lines 26–69.
3. **`v5.5.6` Polish 11 Task 3 — jsQR upload UI.** jsQR vendoring landed; UI follow-up open. Brief at `IRLid-TestEnvironment\HANDOVER-Polish11.md` lines 140–184.
4. **`v5.6.0` AssistQR / §15 — Mr. Data's primary stack.** In flight on `codex/assistqr-*` branches; status check tomorrow.
5. **YubiKey enrolment.** Mr. La Forge brief at `IRLid-TestEnvironment\HANDOVER-YubiKey.md`; awaiting La Forge commissioning (Captain's call).
6. **Audit follow-ups (deferred from 5 May audit):**
   - Test env `HANDOVER.md` refresh as pointer-doc to current open briefs.
   - Test env `org.html` delete + sweep references (Captain's call: redirect-only).
   - `OrgCheckin.html` Venue/Doorman comment sweep (~30 min, low priority).
   - `THEMING-SPEC-2026-05-03.md` — keep until Batches 6.5* land in live repo.
7. **`PROTOCOL.md` Version History cross-check.** Already mostly aligned; quick pass deferred — not blocking.

### Mr. Data's plate going into the night shift

- `v5.7.0a` Worker (multi-key binding + role-gated Add + freshness gate) — assigned tonight
- `v5.7.0b` Phone (orange-state QR rendering) — queued after a
- `v5.7.0c` Dashboard (escalation modal with role-tiered Add) — queued after b
- `v5.6.0` AssistQR — primary stack in flight (status TBC tomorrow)
- `v5.5.5` Polish 11 Task 1 — blocked on Captain's browser repro
- `v5.5.6` Polish 11 Task 3 — open

### Mr. La Forge's plate

`HANDOVER-YubiKey.md` ready when commissioned.

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
