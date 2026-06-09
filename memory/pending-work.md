# Pending Work — IRLid

## ⭐ NORTH STAR (Captain, 5 Jun eve) — read this before prioritising anything
- **v6 destination = get the Org portal show-ready for a DEMO AT IMBUE.** Imbue is the first audience
  and where we'd promo from. Prioritise the queue by "would this embarrass us / block us in front of
  Imbue?" — that's the filter. (Font reverting = yes, embarrassing. Anchor rebuild = no, defer.)
- **v6.5 = the humanitarian half working** (Wisdom / drone proof-of-delivery). Reach for it after Imbue.
- **Design philosophy:** make IRLid **as general-purpose as possible** — cover as many check-in/out
  scenarios/issues as we can (doorman, self-checkin, staff/manager/lead-admin tiers, calendar events,
  per-event attendance, offline). Breadth of correct check-in/out coverage IS the product.
- Promo only when Captain judges it "in a state to show the world" — not before.

### ⭐ 9 JUN — v6.3.13 + v6.3.14 shipped FULLY AUTONOMOUS (zero Captain keystrokes)
- **v6.3.13** — Save-all button pinned to every settings panel's corner (general `.v511-mockup .v511-panel
  .v511-save` absolute, replacing the v6.3.11 org-only rule). **First fully-autonomous ship:** Number One
  created the PR, bash-diffed, merged, deployed, smoked — no Captain input.
- **v6.3.14** — TWO things in one PR (composer-append trick: appended the save fix to the font prompt → one
  task, no parallel sw.js/pill conflict):
  (a) **Save-button corner FIX** — v6.3.13's pin was right but the `.v511-saved-pulse` ("✓ Saved", ~68px) sat
  in the corner pushing the BUTTON ~95px left. Fix: `.v511-mockup .v511-panel .v511-save .v511-saved-pulse
  { order: -1 }` → button measured FLUSH at 13px from the corner. **Lesson: measure the BUTTON, not its
  wrapper — I declared v6.3.13 done on the wrapper's 12px gap and Captain re-flagged it twice.**
  (b) **Text Overlay font picker = named visual list** (like Brand ID) — refactored Brand-ID's paint into a
  shared `paintFontListVisuals(group)` (window-exposed), applied VISUAL-ONLY to the 'text' effect's fontFamily
  group (effect-settings click wiring untouched). Font-list render NOT script-verified (my probe selectors
  missed the live DOM); Captain eyeball-confirmed "all looks good."
- **Queue now down to one:** Settings-nav-vanishing-on-refresh (`HANDOVER-SettingsNavRefresh-v6.3.11.md`,
  bump to v6.3.15 when shipped). Text-overlay-font-list = DONE (v6.3.14).
- **Autonomous loop proven repeatedly today:** empty composer → inject once → submit → Create PR → bash-diff →
  merge → deploy → smoke, all hands-off. Recipe banked: empty composer, inject once, verify, submit; the
  paste-APPEND works (use it to combine tasks into one PR) but programmatic CLEAR/select does NOT.

### ⭐ 8 JUN (Monday) — polish marathon: v6.3.6 → v6.3.12 shipped + AUTONOMOUS-PUSH MILESTONE + site sweep
All live + verified on production, each bash-diffed before merge + smoked after:
- **v6.3.6** — brand-font save fix (global `saveSettings` now carries the live theme via exposed
  `window.v511BuildThemePayload`; font-chip read points at canonical reader — kills `read font: null`)
  + Text Overlay font parity (shared `V511_BRAND_FONT_OPTIONS` 13-font list). **Residual:** Captain's
  hardware still showed a per-tab Visual-save revert — "improved not closed," Captain said LEAVE IT.
- **v6.3.7** — anchor offset reaches Stream particles (deleted the `if (s && s.v512Anchors) return {0,0}`
  guard at L8706) + QR slimming (outcome QR 7,557→488 via data:-logo guard; venue QR 458→370 by omitting
  default brand params; both already level-L).
- **v6.3.8** — hid the half-wired Anchor System panel (`.v512-anchor-system { display:none }`); the
  per-effect Offset X/Y controls (which work) stay.
- **v6.3.9** — masthead logo bug fixed (`updateOrgMastheadLogo` wires `.v511-masthead-logo img` to the
  org logo, un-inverted, via `updateChromeLogo`) + Org-tab declutter (dropped hardcoded tagline, tucked
  read-only Slug into the Brand-polish expander).
- **v6.3.10** — Display name + masthead synced to real `currentOrg.name` in `setSignedInUI` (killed the
  "Venue" vs "Test Event" mismatch — the field was a design-in localStorage mockup) + removed the
  duplicate Org-tab Logo row (upload lives in Brand ID now).
- **v6.3.11** — Org masthead picks up the brand bg palette (`--bg-pal-*` now exposed on root in `applyThemeVars`)
  + Save-all button pinned to the org panel's bottom-right corner (org-scoped; other tabs untouched).
- **v6.3.12** — Org masthead = FULL brand gradient (matches the Visual Theming preview), gradient-only (no
  dragons, Captain's call), white text + shadow for legibility on the vivid bg.
- **Worker CPU** smoke green AM (`/org/attendance` 200 / 165-208ms, no 503 — v6.4.0 fix held overnight).
- **Branch prune:** merged `codex/fix-cpu-time-limit` + `codex/fix-brand-font` deleted from origin.
- **🤖 AUTONOMOUS-PUSH MILESTONE:** Number One launched a Codex task end-to-end hands-off — empty composer →
  synthetic-paste-inject the brief ONCE → click Submit → Data builds. ProseMirror rejects programmatic
  CLEAR/select (each paste APPENDS), so the recipe is: **empty composer, inject once, verify, submit — never
  re-paste to fix.** Closes the last gap to a fully autonomous frontend loop (diagnose → spec → launch →
  bash-diff → browser-merge → Pages-deploy → live-test). Caveats: local-file edits still need Captain's push
  (sandbox 403); Worker deploys ride CI; real-hardware testing is Captain's.
- **Site sweep + roadmap accuracy** (Captain asked): **roadmap.html Surface 2** corrected TEST-ENV→LIVE with
  accurate current capabilities; **CLAUDE.md** "Current Version: v4" header → "Consumer v5 + Org v6.3.12 LIVE".
  Code health clean (4 TODO/FIXME repo-wide, no orphan pages). **Top tidy: 55 HANDOVER briefs at repo root →
  archive/** (Move-Item command given; keep the 2 pending). Big flag: `Org.html` = 21,421 lines — modularise
  post-demo, NOT before.

**IN FLIGHT at close:** **v6.3.13 — Save-all button flush in EVERY settings tab's corner** (general
`.v511-mockup .v511-panel .v511-save` absolute pin at right:12px bottom:12px, replacing the v6.3.11 org-only
rule). Launched via the autonomous push; Data building at watch close. Next watch: create PR → bash-diff →
merge → smoke (button flush in all tabs + no field overlap).

**Queue (briefs written, ready to paste):**
- **Settings-nav-vanishing-on-refresh** (`HANDOVER-SettingsNavRefresh-v6.3.11.md`, content bumped to v6.3.13+).
  `#navSettings` lead_admin-gated; `effectiveRoleRank()` falls back to staff before the session restores;
  `applyRoleGatedVisibility()` never re-runs. Fix = call it at end of `setSignedInUI` (+ `loadDashboardForOrg`).
- **Text Overlay font picker as a named visual list** (`HANDOVER-TextOverlayFontList-v6.3.13.md`). Reuse
  `enhanceFontPicker`'s visual transform on the 'text' effect's fontFamily group — VISUAL-ONLY, don't touch
  the effect-settings click wiring. Cosmetic, low priority.

**Deferred / banked:** residual font-save (Captain: leave alone) · anchor TARGET retargeting (Logo/QR/Multi —
`v512AnchorsForStage` + `persistAnchorBucket` collapse all targets to image/centre; un-hide panel when done) ·
real org rename (Display name → `currentOrg.name` via Worker endpoint — design-in v5.12).

### ⭐ END-OF-DAY CLOSE (7 Jun, ~20:40) — a marathon, ~12 versions shipped to production
All live + verified on production today:
- **Doorman staff-scan handoff CLOSED** — proven phone-to-phone on real hardware (the last Imbue-demo
  blocker). Root cause: an unwrapped `renderPortalAll()` QR crash aborting the load before the handler
  (rounds 1→4, v6.2.6→v6.2.9).
- **Brand font applies to live surfaces** — dashboard banner + fullscreen + attendee page (v6.3.0 +
  v6.3.1 inheritance fix). Set+save persists across reloads.
- **Legacy saveSettings wipe fixed** (v6.3.2) — GET-overlay preserves theme + welcome/redirect; no more
  blanking. + Check-in/out anchor expander now collapses by default.
- **Dead-code tidy** — v6.3.3 (orphan `applyBrandFontToStage` + dead Records Save button) + v6.3.4
  (15 verified-orphan functions, −95 lines, + `renderQr` try/catch hardening so a QR failure can't
  cascade). v6.3.5 — debug-gated the BACKED/DESIGN-IN/IN-DESIGN status pills.
- **CI/CD Worker auto-deploy live + browser-control (Claude-in-Chrome) unlocked.** Number One ran the
  full autonomous loop (brief → bash-diff → merge → cold-test) on v6.3.3/4/5 with Captain granting merge
  authority ("you have the Conn… merge them and test, always").
- **Anchor diagnosed via live test (NOT fixed):** moving the anchor does NOT move the Stream effect.
  Narrowed to "the anchor value isn't reaching the live Stream emit"; the exact link (render ignoring the
  offset vs. the anchor→item.settings mapping only running on Save, not Sample) needs a DevTools-breakpoint
  trace — black-box poking can't settle it. **Next-session headline.**
**Queued for a fresh session:** anchor (breakpoint trace) · font-save instability (two-font-source sync) ·
Worker recurring-503 root (`wrangler tail` mid-crash) · outcome-QR real fix (URL too long for qrcodejs) ·
settings-refresh wobble (offline-cache race). Worker dropped 2-3× today; redeploy is the band-aid.

## 8 June 2026 (Monday morning) — font-save + anchor root causes NAILED (both spec'd for Data)

**Worker health:** confirmed green on watch-open. `/org/attendance` heavy aggregate three-sample smoke: 200 / 165-208ms / no 503 / no CPU-limit. v6.4.0 CPU fix held overnight. Public `/org/public-info` path also clean.

**Font-save bug (v6.3.6 brief written: `HANDOVER-FontSaveAndTextOverlayFonts-v6.3.6.md`).** Captain: picking a brand font in Visual Theming → Save → font reverts + inline preview snaps back. Root cause = TWO stacked defects, both `Org.html`:
- **Duplicate / drifted banner-read helpers across scopes.** Closure copy (`v511ReadBannerSettingsFromUI` ~L9449, works) vs a global copy the font-chip click handler (~L20851) calls, which returns `cfg.font === null`. Live console proof: `[v6.2.2 font click] chip aria-pressed / read font: true null`.
- **Global `saveSettings()` (~L13961) omits the theme.** `domPayload` (L13967-85) has no theme/font; it GET-overlays last-saved settings (L14010-12) so the POST always carries the OLD font; then re-applies the readback theme (L14097-14100 `applyThemeVars`) → visible revert. The per-tab Visual save (`v511SaveVisualTheme` ~L9770) carries theme correctly and works in isolation. `saveSettings` can't reach the closure `v511BuildThemePayload` (different closure) — fix exposes it on window + includes `payload.theme`, and stops the save jumping to `panel-checkin`. Captain's stated preference = "just remove the global Save-all button" (noted as fallback). Also bundled: **Text Overlay font parity** — rendering already supports all 13 (`data-cel-text-font` CSS L4620-4634); only the picker UI is short → fill it.

**Anchor bug ROOT CAUSE FOUND (the long-deferred headline) — v6.3.7 brief written: `HANDOVER-AnchorStreamOffset-v6.3.7.md`.** One-line booby-trap: `v511GetStreamOffsets(stage, s)` at **L8706** does `if (s && s.v512Anchors) return { x: 0, y: 0 };`. But `persistAnchorBucket` (L20767) sets `item.settings.v512Anchors` (L20772) on EVERY stream anchor change AND writes the correct `streamOffsetX_img/Y_img` (L20777-78). So the guard always fires → the offset the user set is computed, stored, then discarded → particles always emit from base position. Half-finished `v512Anchors` migration; the emit (L8765→L8791-94→`v511EmitStreamBurst`) was never wired to read `v512Anchors`. **Fix = delete L8706** so it falls through to the already-correct `streamOffsetX_img/Y_img`. Safe (no double-apply: particles use computed `pos`, not `--v512-anchor-x/y` CSS vars which only drive the crosshair). Apply AFTER the font PR (both touch `Org.html`, keep serial). Live-confirmed: `_v512AnchorState.allow.default.anchors.centre = {x:12,y:54}` exists but never reaches particles.

**Watch state:** font PR with Data (cloud Codex) as of ~08:10. Anchor brief paste-ready for next. Saved brand font left on Lobster during testing (was Pacifico AM) — restore or let Data's smoke cycle it.

## 7 June 2026 (Sunday) — CI/CD AUTO-DEPLOY LIVE + browser-control unlocked

**Headline: the Worker now deploys itself, and Number One can drive the browser.**
- **GitHub Action `.github/workflows/deploy-worker.yml`** auto-deploys `irlid-api-org` on merge to main
  (path-filtered to `irlid-api-org/**`; `workflow_dispatch` manual trigger). Secret =
  **`CLOUDFLARE_API_TOKEN_070626`** (fresh-minted "Edit Cloudflare Workers" token, All-zones). **PROVEN:
  run #2 GREEN, 20s** — Worker deployed via Actions, zero manual wrangler. (Run #1 failed: wrangler now
  needs Node ≥22; bumped runner `node-version: 20 → 22`.) **From now on: merge a Worker PR → it deploys
  itself.** No more hand-cranked `wrangler deploy`.
- **Claude-in-Chrome extension PAIRED to Cowork.** Number One drove, hands-off: the Manager-rejection
  fetch (403 `insufficient_role` confirmed live), receipt re-verify on check.html (100%, 6/6), a clean
  public-surface console sweep, and the entire CI/CD trigger→fail→read-log→fix→re-run→green loop.
  **Boundaries held:** the Cloudflare token + the GitHub-secret value stayed Captain's; **Cloudflare dash
  resists browser automation** (mint tokens in Edge/manually); **Chrome on this machine can't reach
  dash.cloudflare.com** (use Edge).
- **Lessons banked:** GitHub matches secrets by EXACT name; current wrangler requires Node ≥22 in CI.
- **Housekeeping still open:** gitignore `.wrangler/`; commit `DREAMS.md` + `PATREON-V6-DRAFT.md` +
  `PROMOTION-V6-COPY-2026-06-06.md` when convenient.
- **✅ CLOSED 7 Jun — this WAS the Imbue-blocker; now resolved end-to-end (see DOORMAN SAGA + v6.2.9
  below). Original report kept for context:** `HANDOVER-DoormanStaffScanHandoff-v6.2.6.md` — live demo
  rehearsal (Number One watching dashboard via browser-pairing while Captain drove 4 phones) found the
  **doorman staff-scan handoff is broken** — 8 Pro scans an unrecognised attendee's orange device_key
  QR → "Open in staff dashboard" → lands on the plain Check-in tab, **no escalation modal**. Orange
  trust-gate fires correctly; the *completion* is dead. `scan.html` L1088 builds the
  `/Org.html?dev=0#staff_scan=` redirect fine, so the bug is the hash being dropped on the `/Org.html→
  /Org` resolution OR `tryProcessStaffScanIfPending()` (Org.html L13505) no-op'ing on device_key.
  Needs 8 Pro console to pin. **This is the one thing between the demo and Imbue-ready** — the rest
  (clean check-in, dashboard, receipts both-ways, celebrations, security gate) is all proven.

### DOORMAN SAGA — 7 Jun progress (rounds 1→4, autonomous Data loop)
Worked the doorman staff-scan handoff through four rounds, Number One driving the full autonomous loop
(write brief → Captain pastes to cloud Codex → Data builds + opens PR → Number One bash-diffs origin
refs → Captain "go" → Number One merges via browser → Pages/CI deploys).
- **`v6.2.6` (PR #105):** `scan.html` redirect `/Org.html?…#staff_scan=` → `/Org?…#staff_scan=` so the
  hash survives the `/Org.html→/Org` canonicalisation. Hash now arrives (`hashPresent=y`). First failure
  was a **SW cache trap** — 8 Pro served stale scan.html until forced tab close/reopen.
- **`v6.2.7` (PR #106):** temporary **DIAG banner** (debug-gated, Tools & Diagnostics) printing
  `hashPresent/stashed/handlerRan/payloadType/bearerReady/escalationOpened/err`. Revealed:
  `hashPresent=y stashed=y handlerRan=n bearerReady=n` — hash arrives + stashes, but the handler never
  runs. Captain asked to KEEP the banner (genuinely useful) — retained going forward.
- **Worker 503 fire (mid-saga):** console flooded with `503 Service Unavailable` + CORS on every
  `/org/*`. Same class as the morning's stale-Worker fire. Captain re-ran `wrangler deploy` (the local
  command, reliable) → Worker healthy again (`/user/orgs returned`, `currentOrg` loads). The CI/CD
  one-click Run-workflow is the hands-off alternative but the GitHub Actions tab fought browser nav.
- **`v6.2.8` (PR #107):** session-readiness gate + bounded retry (`staffScanSessionReady()` polling 250ms
  for 12s). Shipped clean, 110 tests green, pill verified on 8 Pro. **Still `bearerReady=n handlerRan=n`.**
- **ROOT CAUSE (found by reading the code, not the banner):** `handlerRan=n` was true in BOTH v6.2.7 AND
  v6.2.8 → the handler is *never reached*, so readiness was a red herring. In `loadDashboardForOrg`
  (Org.html ~L13498) **`renderPortalAll();` is called UNWRAPPED, immediately before the staff-scan call
  (~L13505).** `renderPortalAll → renderPortalOutcomeQr → renderQr('outcomeQr', url, …)` with
  `url = buildOutcomeUrl(portalState.activeMode)` undefined → `new QRCode({text: undefined})` throws
  `Cannot read properties of undefined (reading '0')` (the live-console error). The uncaught throw aborts
  `loadDashboardForOrg` *before* L13505. The QR crash dismissed as "separate" was the wall all along.
- **`v6.2.9` (round 4, Data building at close):** (1) ROOT — guard `renderQr` to skip on falsy `text`
  (a QR helper must never throw on empty input); (2) DEFENSE — wrap `renderPortalAll()` in try/catch in
  `loadDashboardForOrg` + the DOMContentLoaded cached-snapshot path so a render hiccup can never again
  block the staff-scan/invite handlers; (3) CLEANUP — relax `staffScanSessionReady()` to `currentOrg
  .api_key` only (restored sessions auth via api_key, not a fresh `qrLoginSession`; the extra condition
  could never become true on a restored session). KEEP DIAG. **✅ MERGED (PR #108) + PROVEN END-TO-END
  ON REAL HARDWARE (7 Jun, ~14:02):** incognito Pixel 4a (fresh/unrecognised device) → scanned venue QR
  → orange device_key screen → 8 Pro scanned it → **escalation modal opened** → "Add at the door" →
  bound as "Yet Another" → checked IN on the dashboard. The 8 Pro DIAG banner read
  `hashPresent=y stashed=n handlerRan=y payloadType=device_key bearerReady=y escalationOpened=y err=-`
  — every flag green. **The phone-only doorman handoff is ALIVE end-to-end, no laptop.** First-fix
  confirmation that the render-crash root cause was correct: the desktop Dashboard also now renders fully
  (it was face-planting on the undefined outcome QR before v6.2.9).
  **UX note for a future round (not urgent):** adding a fresh attendee at the door took TWO WebAuthn
  prompts (one to add the expected record, one to bind the device key). That's the per-action signing
  model working correctly (each signed action = non-repudiation), but add+bind could be collapsed into a
  single prompt for demo smoothness.
- **LESSON banked:** when a DIAG breadcrumb says "handler never ran", read the call-site's *upstream*
  siblings for an uncaught throw before theorising about the handler's own gates. An unwrapped render
  call sitting in front of your handler is a silent abort.

### KNOWN BUG — DEFERRED (logged 7 Jun, Captain: "log it and move on")
**Visual Theming "Save all settings" — font reverts + jumps to Check-in (seen on v6.3.1).**
- Symptom (Captain, on his hardware): in Settings → Visual Theming, clicking "Save all settings"
  (1) the banner **font changes** (appears to revert a just-picked font), and (2) the UI **navigates
  away to the Check-in tab**.
- Number One partial repro (v6.3.1, browser, JS-click of `v511VisualSaveBtn`): clicking Save WITHOUT
  first changing the font KEPT the font (Lobster) and STAYED on `panel-settings`. So the symptoms need a
  same-session font **change** first (the save doesn't capture the new pick → reverts on readback),
  and/or the panel-jump is intermittent / path-specific.
- Likely cause: **two font sources** — the Brand Identity "Font" card-list (drives `globalFont` →
  `--brand-font`) and the banner-customise chips (`data-banner-value` → `data-banner-font`).
  `v511SaveVisualTheme` builds its payload via `v511BuildThemePayload(currentSettings.theme)` then
  RE-APPLIES the readback theme (`writeThemeToUI`/`applyThemeVars`). If the picker updates one source but
  `v511BuildThemePayload` reads the other (or a stale snapshot), the save captures the old font and the
  readback re-applies it → revert. The navigate-to-Check-in is NOT in the `v511SaveVisualTheme` body read
  so far — needs tracing (downstream `renderPortalAll`/`showPanel`, or a save-success redirect).
- NOT blocking: a font set+saved DOES persist+apply correctly across reloads (proven v6.3.0/v6.3.1). This
  is a same-session pick-then-save UX revert + an unwanted panel jump. Fix in a focused post-demo session.
- **Also manifests in FULLSCREEN (7 Jun eve, Captain-reported "fullscreen QR not correct"):** diagnosed
  LIVE — `fullscreenQR()` clones `#v511ThemePreviewStage` and the clone correctly inherits root
  `--brand-font` (v6.3.1's rule covers `#v511FullscreenStage` too; `data-banner-customise=off` on the
  clone, banner computes the root var). The "wrong font" is because **root `--brand-font` had drifted to
  `Georgia`/serif** — i.e. the SERVER has the wrong font persisted (the save captured serif, not the
  picked Lobster). So "fullscreen wrong font" == this same save-capture bug; fullscreen just renders the
  bad saved value. NOT a separate fullscreen bug. Real fix = make `v511SaveVisualTheme` /
  `v511BuildThemePayload` capture the LIVE picked font (single source of truth) before POST.
- **Panel 4 (Check-in/out Experience) opening expanded** = SEPARATE, fixed + MERGED in v6.3.2 (PR #111,
  `experience.open = false`).

### KNOWN BUG — DEFERRED (logged 7 Jun eve, post-v6.3.2 deploy) — Settings nav disappears on refresh
- Symptom (Captain): after the v6.3.2 deploy, on refresh the **Settings nav item disappears** + a
  "Showing cached attendance snapshot" toast appears. Full sign-out + sign-in restores it; the next
  refresh loses it again.
- Diagnosed LIVE: Worker is UP (`GET /org/public-info/imbue-ventures` → **200**), `navigator.onLine` true,
  build v6.3.2. **INTERMITTENT** — one Number One reload had `currentOrg` unset + Settings hidden; the
  very next reload had Settings shown (`settingsShown=true`) with `window.currentOrg` still reading unset.
  So the dashboard is intermittently taking the **offline-cached-snapshot fallback** path instead of the
  live restore; in that path the role-gated Settings nav (`data-min-role="lead_admin"`) hides because the
  role/`currentOrg` isn't set.
- Also firing every load: the **caught** outcome-QR render crash (`[portal] render failed during
  dashboard load: Cannot read properties of undefined (reading '0')` at `renderPortalOutcomeQr` →
  `renderQr` → qrcodejs). Non-fatal (v6.2.9 try/catch) but recurring; same outcome-QR bug — `renderQr`
  receives a non-falsy-but-invalid value (likely a URL object, or `buildOutcomeUrl`/`OUTCOME_BASES[mode]`
  with an undefined `portalState.activeMode` on the cached path), so the `if(!text)` guard passes it
  through to `QRCode.makeCode` which dies on `reading '0'`.
- LIKELY trigger: the v6.3.2 SW cache bump (v120→v121) — classic SW-activation-lag window (old SW serves
  stale cache while v121 installs; live restore races/loses to the cached-snapshot path). Pattern matches
  the long-standing SW lag (esp. 8 Pro).
- WORKAROUND: fully close ALL irlid.co.uk tabs + reopen (forces v121 to activate); a plain refresh can
  leave the old SW in charge.
- FIX (next watch): (1) make the live session-restore authoritative over the cached-snapshot fallback —
  don't let the offline path hide the role/Settings when online + Worker reachable; (2) kill the
  outcome-QR crash at source — guard `renderQr` against non-string `text` and `buildOutcomeUrl` /
  `renderPortalOutcomeQr` against undefined `activeMode`/URL.

## 6 June 2026 — SATURDAY EVENING CLOSE (end of a marathon) — canonical state

## 6 June 2026 — SATURDAY EVENING CLOSE (end of a marathon) — canonical state

**Headline: v6 PATREON PUBLISHED + receipt verification PROVEN end-to-end + a 5-symbol regression
cascade diagnosed and fully closed. Live build now `v6.2.5`.** Long hard watch (anniversary of Captain's
father-in-law's death; grey weather; little sleep) that ended in a real landing. NORTH STAR promo gate
is now OPEN — Captain judged it ready and published.

**The regression cascade (v6.1.31 → v6.2.5) — central saga + load-bearing lesson:**
- `v6.1.31` (PR #101, pill v6.2.2) fixed the font-picker CAPTURE (click now sets the chip `aria-pressed`
  the save reads — console-traced Pacifico at click/save/load) BUT **deduped the duplicated banner
  helpers, orphaning symbols the init-scope still referenced** → `ReferenceError` cascade that halted the
  script → broke effects, font-apply, AND event-defaults save (everything downstream of the throw).
  **LESSON: deduping duplicated init-scope helpers orphans every symbol that scope still references but
  no longer defines → ReferenceError. Restore each in the scope that lost it.**
- `v6.2.3` (PR #102) = check-in resilience (org-entry retry→queue→gentle "syncing"; offline-queue now
  DROPS terminal 4xx poison items so one bad write can't jam real check-ins; Worker idempotency by
  `client_checkin_id`) + folded-in fix #1: restored `V511_BANNER_DEFAULTS` to init-scope.
- `v6.2.4` (PR #103) = fix #2: restored `V511_BANNER_OPTIONS` + `normaliseV511BannerConfig` to init-scope
  (crash sat 4 lines upstream of the celebration-builder wiring at L10552 — exactly why it was dead).
- `v6.2.5` (PR #104) = fullscreen QR: `qr-fullscreen.js` rendered the same long branded payload at
  CorrectLevel.M while inline uses L; it fit at L, overflowed at M (the `qrcode.min.js` "reading '0'").
  M→L. Fullscreen QR renders + scans (Data jsQR-decoded it). All 4 PRs bash-diffed clean before merge.
  **Data builds LOCALLY, must be told to push every time (banked again).**

**Receipt verification PROVEN (Patreon centerpiece):** Kerry's org receipt = 100% on receipt.html AND
independently 100% on check.html (V5 HARDWARE-BACKED, **Venue signature PASS**, "✓ exists in org receipt
table"). Audited: mint = venue private key signs canonical payload; check.html **independently fetches
the org's published key by slug** so a forged/swapped-key receipt fails. Unforgeable + un-rewritable,
demonstrated.

**Cosmetic theming FROZEN (Captain's call):** font applies INLINE (works), NOT fullscreen (separate
render surface); "Save all" still flaky (hydrate). Non-Imbue-blocking; banked in
`HANDOVER-FontPickerCapture-v6.1.31.md`. Celebration builder is BACK + working; old sequence didn't
repopulate (never saved cleanly behind the crashes) — rebuild once, persists going forward.

**Made today:** `PROMO-BRIEF-v6-for-Troi.md`; the published Patreon v6 post. Receipt ideas banked: org
logo in the receipt venue panel; "session receipt" (first-in → last-out).

**✅ v6.2.1 Manager-rejection PROVEN LIVE (6 Jun, console demo):** raw `fetch` to `/org/settings` with
X-Org-Key (api_key only — what a Manager holds) + `{manager_perms:{calendar:true}}` returned
**`403 {error:"insufficient_role", message:"A Lead Admin or Developer session is required to change
manager_perms."}`** on production. The self-escalation hole is demonstrably shut, not just deployed.
**Both v6 security claims now proven:** receipts verify both ways (receipt.html + check.html) AND the
permission gate bites. The "trust between people" story holds end-to-end.

**Queued behind: ** v6.1.26 enforcement; v6.1.27 tools/rooms; v6.3.0 Lead Admin (2-phone); cosmetic-theming
thaw (fullscreen font + save) on a calm day; v5.12.1 anchor (held). Plan: Max, credits untouched.

## 5 June 2026 — EVENING CLOSE (~21:00) — the canonical end-of-watch state

**Day's wins (work cancelled → full day on two benches: a 3D printer set up + running, and this):**
- **PR #98 (v6.1.23 Staff list) merged + Worker deployed** (morning) — cleared a stale-branch conflict via re-cut; CORS fire put out by the fresh deploy.
- **v6.1.30 (Brand Identity save persistence) merged + live** — carries the brand-grid + globalFont through save/readback. Pill v6.1.30, sw v108. BUT the font still doesn't persist (see below) — v6.1.30 fixed the payload, not the capture.
- **v6.2.1 (settings-auth hardening) merged + Worker-deployed + LIVE-PROVEN** — gates `manager_perms` behind a lead_admin+ session. Confirmed working: a stale queued `/org/settings` save returned **403** from the live gate (the gate doing its job). Regression-clean: Developer theme saves still work. Manager-rejection UI smoke deferred (Nokia 6.1 died mid-test; Becky-as-Manager also correctly has no Settings nav at all — UI defense already in place; Worker gate is the backstop).
- **Offline-queue jam cleared** — a stale `/org/settings` POST queued during the morning CORS wobble began 403ing under the new v6.2.1 gate and **permanently jammed the SYNCING pill** (the queue halts on first non-2xx, never drops the poison item). Cleared by hand via `indexedDB → irlid-offline → pending_ops → clear`. **Real resilience flaw found + banked into `HANDOVER-CheckinResilience-v6.1.28.md`**: terminal 4xx items must be quarantined/dropped so they can't block real check-ins.

**THE ONE REMAINING BUG: Brand Identity FONT still doesn't persist (logo + description DO).**
- v6.1.30 carried the payload correctly, but the font never gets *into* the captured state. **Root cause traced (5 Jun eve):** `enhanceFontPicker()` (Org.html ~L20658) turns the font chips into the scrollable list but its click handler only sets `data-banner-customise='on'` — it **never sets `aria-pressed` on the clicked chip**, and `v511ReadBannerSettingsFromUI()` (~L9451) reads the font from the `aria-pressed="true"` chip. So the save reads the *default* font. Plus **two drifted copies** of the banner helpers (~L9424 and ~L18977) — save vs restore may diverge. Hydrate ordering vs enhanceFontPicker also suspect.
- **Briefed:** `HANDOVER-FontPickerCapture-v6.1.31.md` — supersedes the font half of v6.1.30; mandates diagnose-WITH-console (the last 3 patches failed for lack of it). **This is the next thing to fire at Data.**

**Ready-to-ship queue (briefs written):** v6.1.31 (font, NEXT) · v6.1.24 slim-invite-QR · v6.1.26 enforcement · v6.1.27 tools/rooms · v6.1.28 resilience (+poison-item fix) · v6.1.30 Part C (slim QR + server-side branding, nice-to-have) · v6.3.0 Lead Admin (2-phone) · v5.12.1 anchor (held).
**Verification owed:** v6.2.1 Manager-rejection smoke (needs a working phone as Becky).
**Wants/bigger:** Patreon v6 post (draft ready) · Receipt bridge v6.0 (briefed) · Cross-device admin auth v6.1 (briefed) · Promotion round 2 (Wisdom + gym/studio) · EAI SecureComm 2026 (Lancaster, 21-24 Jul).

**Process notes banked:** (1) Data finishes work LOCALLY and reports but does NOT push until told — always end the brief/prompt with "push the branch and open a PR." Twice this session he left v6.1.30 + v6.2.1 sitting local. (2) Bash-diff each PR against current main before merge (stale-branch trap) — done for #98/#99/#100, all clean. (3) Plan: Max, credits untouched.

---

## 5 June 2026 — FRIDAY MORNING CLOSE (~08:35, pre-work) — short watch

**Headline:** **PR #98 (v6.1.23 Staff list) merged + Worker deployed; a live CORS fire put out.**
- PR #98 had a stale-branch conflict on `Org.html`; Data re-cut off fresh `origin/main`, force-pushed
  (`fbf9fde` → `41e4f5b`), GitHub went mergeable, brand work (v6.1.25a/b/c) preserved, pill
  `v6.1.25c → v6.1.25d`, sw `v106 → v107`. **✅ ACCEPT**, merged, **`wrangler deploy`d** (Worker
  Version `2d794b25-edbf-4ba5-8a2d-61d5288e2332`, CORS_ORIGIN `https://irlid.co.uk`, DB irlid-db-org).
- **CORS fire:** all morning, theme saves threw "Visual theme save failed" + offline/"SYNCING" pills.
  Console revealed the cause — **every `/org/*` call blocked by CORS** ("No Access-Control-Allow-Origin
  header"). The committed Worker CORS code is correct (always sets the header), so the live Worker was
  **stale/crashed and throwing before attaching CORS**. The fresh deploy (above) **cleared it** —
  check-in working, console clean, save reaching the Worker again. (My base64-logo/413 theory was a
  red herring — disregard.)

**THE ONE REMAINING BUG (cleanly isolated now): Brand Identity FONT doesn't survive a save; LOGO does.**
- So the save reaches the Worker (logo persists) but the **font/banner styling is not in the saved
  payload, or the readback hydrate resets it.** Pre-refresh the font *does* reach check-in (in-memory);
  post-refresh it reverts → classic persist gap.
- **Briefed:** `HANDOVER-BrandIdentitySavePersistence-v6.1.30.md` (diagnosis corrected at top — CORS
  was separate/fixed; the job is now purely Parts A/B: carry `theme._v512.banner` in the Save-all
  collect + don't let readback reset it). Part C (slim QR + server-side attendee branding) is a
  nice-to-have after A/B.
- **STATUS at park (5 Jun midday):** Data **built v6.1.30 locally** in his Codex workspace
  (`mr-data-brand-identity-wiring-repo`) — 3 files +116/−59, pill→v6.1.30, sw→v108, pinned exactly the
  diagnosed cause (Save collected font chips but not the full brand-grid; hydrate only restored banner
  text/logo). **NOT yet pushed to origin** — no v6.1.30 branch on GitHub; main still v6.1.25d. Data
  honestly flagged he **could not verify in-browser** (file access blocked + stale-cache localhost).
  **Next watch:** have Data push the branch → bash-diff vs current main for stale-branch drift (must be
  cut off v6.1.25d so it doesn't revert the #98 staff list) → merge → Captain smokes Pacifico → Save
  all → hard refresh → font survives + shows on Check-in. Then v6.2.1 right behind it.
- **`HANDOVER-SettingsAuthHardening-v6.2.1.md` REWRITTEN** with confirmed live findings: managers DO
  receive the org api_key via `/user/orgs` (L1592, no role filter), and `/org/settings` is api_key-only
  → a Manager can self-escalate `manager_perms`. Exact session-gate patch written. **Sequence AFTER
  v6.1.30** (same save-path → collision). Ready to fire.

**Brand Identity progress this session:** controls wired (v6.1.21) → frame un-disabled (v6.1.25b,
the `pointer-events:none` glass lid Captain found in DevTools) → QR base64-logo guard (v6.1.25c) →
**font persistence = the last piece, briefed as v6.1.30.**

**Still queued (unchanged):** v6.1.24 slim-invite-QR, v6.1.26 enforcement, v6.1.27 tools/rooms,
v6.1.28 check-in resilience, v6.2.1 settings-auth security, v6.3.0 Lead Admin (2-phone smoke),
v5.12.1 anchor (held). Patreon v6 draft ready. Plan: Max, credits untouched.

---

## 4 June 2026 — EVENING CLOSE (~20:15) — the canonical end-of-watch state

**Headline wins this evening:** **v6.2.0 manager-permissions PROVEN on hardware** (toggle gates a
real Manager's calendar access, confirmed phone + desktop); **Becky is a working Manager** (D1
INSERT after the cleanup swept her membership — `LO2eFglIoL80fPVFfSfJHl2B76`, manager, Test Event
`0337bf2f-e8a3-48d4-a12b-3f9426354f4f`); **v6.1.20-v2 auto-checkout** merged+deployed (the original
v6.1.20 was DENIED — stale branch reverted v6.2.0); **v6.1.22** (Expected scroll + audit
sidebar/diagnostics leak + modal layout) merged; **v6.1.25** (dashboard gating) merged.

**Bug checklist — 15 fixed & live today.** See the late-afternoon WRAP below for the full shipped
list; evening adds v6.1.20-v2, v6.1.22, v6.1.25, manager-perms proof, Becky membership.

**Queued & briefed (serial — all touch Org.html and/or Worker; bash-diff each, watch the stale-branch trap):**
- `HANDOVER-BrandIdentityWiring-v6.1.21.md` — logo/font save & apply
- `HANDOVER-StaffRoomsWiring-v6.1.23.md` — real members + lead-admin-gated Remove (kills the Studio-Manager mockup)
- `HANDOVER-SlimInviteQR-v6.1.24.md` — short-nonce QR + suppress PWA prompt (today's dense-QR/install bug)
- `HANDOVER-EventDefaultsEnforcement-v6.1.26.md` — make require_proof + min_trust_score actually bite (Worker; deploy after)
- `HANDOVER-ToolsAndRoomsWiring-v6.1.27.md` — wire Tools & Diag audit-log + Rooms section (diagnose-first)
- `HANDOVER-SettingsAuthHardening-v6.2.1.md` — **SECURITY** — gate manager_perms behind lead_admin+ session (close self-escalation)
- `HANDOVER-LeadAdminAppointment-Build-v6.3.0.md` — co-presence appointment (**in-person 2-phone smoke**)
- `HANDOVER-AnchorSystemRebuild-v5.12.1.md` — **held** per Captain (re-build, not demo-critical)

**Governance locked today:** deletes (record + expected) = **lead_admin+** ("Lead Admin ≈ Developer
privileges; can't have me popping by to fix a misspelled name"). Add/manage expected = staff+.
Lead Admin can't be invited (Developer-appointment only, v6.3.0).

**Role-testing how-to (for next session):** Becky (Nokia) is the portal tester — cycle her D1 role
(manager→lead_admin→staff), re-login each time, to view each tier. Kerry is attendee-only (no portal
credential) — can't sign in until the slim-invite-QR lands. Sign-in works on Chrome/Edge; **Firefox
quarantined**; no VPN was ever on (Firefox just advertises one).

**Promo:** `PATREON-V6-DRAFT-2026-06-04.md` ready for Captain's voice.

**Plan/spend:** Max plan, credits untouched at £11.23 all day. (See BOOTSTRAP §3 device/Cloudflare playbook.)

---

## 4 June 2026 — late afternoon WRAP (full outstanding state + versions)

**Shipped + live today:** v6.1.15, v6.1.16(+a debug gate/title), v6.1.16a–d (modal-close, unique event id, delete names event), v6.1.17 (receipt time), v6.1.14 (attendance bar/late/timeline), v6.1.19 + v6.1.19a (org receipts in attendee history + logo), v6.1.18 (event-defaults server-wiring), **v6.2.0 (manager-permissions matrix)**. Build pill ~v6.2.0. Spend never moved (Max, credits at £11.23).

### Spec'd + ready to fire at Data (serialise — all touch Worker+Org.html unless noted)
| Version | Brief | What |
|---|---|---|
| v6.1.20 | HANDOVER-AutoCheckout-v6.1.20.md | Auto-checkout after grace (eases "check out of prev event first") |
| v6.1.21 | HANDOVER-BrandIdentityWiring-v6.1.21.md | Brand Identity logo upload + font/styling save & apply |
| v6.1.22 | HANDOVER-SmallWinsBatch-v6.1.22.md | Expected-list scroll + audit-view leak + Attendance-on-right (Org.html only) |
| v6.1.23 | HANDOVER-StaffRoomsWiring-v6.1.23.md | Staff list → real members + lead-admin-gated Remove |
| v6.2.1 | HANDOVER-SettingsAuthHardening-v6.2.1.md | **SECURITY** — gate manager_perms behind lead_admin+ session |
| v6.3.0 | HANDOVER-LeadAdminAppointment-Build-v6.3.0.md | Lead Admin appointment (co-presence; **in-person 2-phone smoke**) |

### Surfaced today, NOT yet spec'd (write next session)
- **Slim invite QR** — today's invite QR too dense to scan + triggered a PWA install on the 4a. Fix: short server-looked-up nonce in the QR (the invite already stores an org_invites row) → tiny scannable QR; suppress PWA install prompt on the accept path. Sign-in itself WORKS (Edge proved it); Firefox is quarantined (use Chrome/Edge).
- **Event-defaults enforcement** — v6.1.18 knobs (require_proof, min_trust_score…) SAVE but don't ENFORCE yet.
- **Rooms section + Tools audit-log/Developer section** — quick audit, likely more mockup.

### Becky role-testing — BLOCKED on one INSERT (60-sec first job next session)
This morning's D1 cleanup swept Becky's Manager membership with the dud Becky rows. She signed in fine (Edge) but "Signed in, but no orgs available." Her current row is the re-created **"New member" `user_id=LO2eFglIoL80fPVFfSfJHl2B76`** (pub_fp `OhRcv6xmNSRDs8MV` — matches a morning-purged Becky fp). Test Event org_id = `0337bf2f-e8a3-48d4-a12b-3f9426354f4f`. To make her a Manager again (and restore her name), next session run:
```
npx wrangler d1 execute irlid-db-org --remote --command "UPDATE portal_users SET display_name='Becky Wetherill' WHERE id='LO2eFglIoL80fPVFfSfJHl2B76'; INSERT INTO org_memberships (user_id, org_id, role, granted_by, granted_at, created_via) VALUES ('LO2eFglIoL80fPVFfSfJHl2B76','0337bf2f-e8a3-48d4-a12b-3f9426354f4f','manager','developer',strftime('%s','now')*1000,'manual_test');"
```
Then Becky refreshes → sees Test Event as Manager → cycle her role (manager→lead_admin→staff) in D1 to test each tier (re-login between). **Confirm the Nokia's fp via v5-test.html first if unsure which row is hers.**

### Parked by design (don't spend time yet)
- Advanced anchor system (Rev 9) → **v5.12.0** (re-build from locked design; not demo-critical).
- Records & ID tab → **v5.13+** (storage broker, deliberately deferred).
- True concurrent multi-event presence → future (auto-checkout v6.1.20 covers the sequential case).

### Promo
- Patreon v6 post — **PATREON-V6-DRAFT-2026-06-04.md** ready for Captain's voice (honest framing + claim/don't-claim notes baked in).

---

## 4 June 2026 — afternoon (calendar polish marathon + new backlog)

**Shipped + live today (all on `irlid.co.uk/Org`):** v6.1.15 (expected_ids tolerant), v6.1.16 (check-in title "Venue — Event" + global debug gate), v6.1.16a/b (calendar modal closes before cross-device QR — add + delete), v6.1.16c (unique event id on create — day+time slug was colliding), v6.1.16d (delete auth card names the event), v6.1.17 (receipt time — newest receipt per attendee), v6.1.14 (attendance progress bar + actual-late markers + per-event attendance timeline log). Build pill ~v6.1.16e.

**In flight (Mr. Data):** v6.1.18 — Event-defaults server-wiring (calendar_defaults → settings_json via Save-all; honest pulse). Brief: `HANDOVER-EventDefaultsServerWiring-v6.1.18.md`.

**Briefs queued (paste-ready):**
- `HANDOVER-OrgReceiptsInHistory-v6.1.19.md` — Task 16 easy slice (receipt.html reads irlid_org_receipts → "Your check-ins" group). receipt.html-only, no Worker. **Awaiting Captain's inline-vs-Data call.**
- `HANDOVER-ManagerPermissions-v6.2.0.md` — per-org Manager-permissions matrix in Sign-in & Auth (Lead-Admin-set, default off; first row = managers-can-edit-calendar; Worker minRole consults `settings_json.manager_perms`).
- `HANDOVER-LeadAdminAppointment-Build-v6.3.0.md` — **BUILD brief** (from the ratified `HANDOVER-LeadAdminCoPresence-DESIGN.md`). Two PRs (Worker+migration, then frontend ceremony). Real co-presence gate (≤12m/≤90s/≤5min), Replace (atomic), allow-fresh, immutable audit. **Deploy + smoke MUST be in person — 2 co-present phones with Captain.** Lead Admin can't be invited (governance); this is the only way to create one.
- `HANDOVER-AttendanceProgress-v6.1.14.md` Fix 4 (Expected-list scrollable) — dropped from the merged PR; small follow-up.

**Role-tier testing (Captain's current goal):** the "Viewing as" preview switcher was removed in prod (security lockdown), so testing a tier = sign in as a real user holding that role on their own device (WebAuthn is device-bound; different browsers ≠ different roles). Staff/Manager → **invite via +Invite Staff** (creates portal identity + credential; Kerry to be invited as Manager). Lead Admin → can't be invited; D1-bump a manager OR build v6.3.0. Attendees (Kerry as checked-in) have NO portal credential, so can't sign into the portal until invited.

**NEW backlog (4 June afternoon, Captain-flagged):**
1. **Auto-checkout** — after an event's grace period, still-checked-in attendees should auto-check-out (`checkout_method='auto'`). Needs a toggle (in the now-wired Event defaults: Check-out grace) + a mechanism (read-time compute vs Cloudflare scheduled worker). Connects to #2. Design + spec needed.
2. **Check-in-into-new-event-without-checkout** — Captain: "trying to sign into an event I have to sign out of the previous one, most of the time." Per-person active check-in appears to span events; checking into event B while IN event A conflicts. Investigate: is it by-design (one active presence) or a bug? Likely resolved/eased by auto-checkout (#1).
3. **Attendance-on-the-right layout** — Captain expected the per-event Attendance timeline on the RIGHT as a column; Data placed it below in a scroll panel. Works, but layout differs from intent. Minor follow-up.
4. **Lead Admin appointment build** — designed (`HANDOVER-LeadAdminCoPresence-DESIGN.md`), Captain wants it "soon." Co-presence-gated, Developer-appointed, one per org. Deploy+smoke needs 2 co-present phones WITH Captain. Pairs with v6.2.0 manager-permissions (need a non-developer admin to test the matrix).
5. **Audit view leaks sidebar + Developer diagnostics** — audit mode (the airport-board fullscreen, "Exit audit" button) should be table-only; currently the left nav AND the Developer-diagnostics panel are still visible. Small layout fix — hide sidebar + dev-diagnostics in audit mode. Captain-flagged 4 June afternoon.

**v6.1.18 merged + deployed** (Event-defaults server-wiring) — bash-diffed ✅ clean (Worker validators sound, frontend sends lowercase enums matching the allow-list, save-readback reports dropped fields). Enforcement of each value (require_proof actually requiring proof, etc.) is the noted follow-up — NOT yet done.

**Open prize:** Patreon v6 post (`PATREON-V6-DRAFT.md`) — site is demo-ready; whenever Captain wants it, Number One drafts substance for his voice.

---

## 4 June 2026 — morning (focused, low-cost watch on Pro)

**Shipped / done:**
- `v6.1.11` Worker **deployed** (pending-invitees endpoint live) — Version `d8e5ed25`.
- `v6.1.15` expected_ids tolerant fix **deployed** — Version `7a33b485`. PR #85 (✅ ACCEPT, bash-diffed +12/−4 Worker-only) — Captain merging.
- **D1 cleanup done** — 10 dud `portal_users` (5 Becky + 5 "New member") purged with their memberships/sessions, scoped by `display_name`; Developer rows untouched. Attendance/receipts left immutable.
- **SYNCING pill** was the IRLid-offline indicator — already fixed; dropped from queue.
- **Cloudflare hardening:** security-key 2FA (Windows Hello) **active** on `sr.austin@btinternet.com`, backup codes saved. Device-change playbook inscribed in BOOTSTRAP §3.
- Bootstrap fp confirmed current: `H-b2OS4e7zuhNx1r` (`portal_users` id `tzY2w3bv3AtB8OKRyyHytfi6Q0`, Developer (Super-Admin)).

**Mr. Data PRs in flight:**
- **PR #86** `codex/v6.1.10-modal-auto-close-v2` — modal auto-close, mergeable, ✅ code ACCEPT. **Caveat: build pill regresses v6.1.13→v6.1.10** — one-line fix queued (bump to v6.1.14) before merge.
- **PR #85** expected_ids — merge + `wrangler deploy`.

**Briefs paste-ready (queued for Data):**
- `HANDOVER-CheckinTitleAndDebugGate-v6.1.16.md` — (10) global debug gate default-OFF via Tools & Diagnostics toggle + (11) Check-in title "Venue — Event". Run off fresh main AFTER modal merges (both touch Org.html).
- `HANDOVER-ExpectedIdsError-v6.1.15.md` — shipped as #85.
- `HANDOVER-ModalAutoClose-v6.1.10.md` — shipped as #86 (v2).

**Two old Developer `portal_users` rows still present** (`n4FzIhV_1jc2u_HO`, `TvklFsivZk68R67j`) — Captain's previous bootstrap fps, inert. Keep-as-history vs purge: Captain's call, undecided.

**Still open from the 3 June checklist:**
- Task 14 — attendance progress bar + late-arrival markers (5/10/15 min): Number One to write `HANDOVER-AttendanceProgress-v6.1.14.md`.
- Task 15 — Patreon v6 post (`PATREON-V6-DRAFT.md`, Captain's voice).
- Task 16 — org receipts → consumer account history (Number One to spec).

---

## 3 June 2026 — evening (closing watch, full checklist set)

**Bootstrap fp banked in BOOTSTRAP.md §3:** `H-b2OS4e7zuhNx1r` — recovery procedure documented, safe to commit.

**Wisdom meeting today:** Drones have 1080p cameras + basic GPS, fly at 20-150m. Humanitarian/drone delivery is v6 work, deferred to July. Key architectural note: current Haversine check is 2D only — drone altitude means a 50m-up drone directly above a recipient reads as 50m away. Drone delivery needs a separate signed-delivery mode, not the mutual phone handshake.

**Full checklist established (Tasks 5-16):**
- Tasks 5-7: D1 cleanup + SYNCING pill (immediate, Captain)
- Task 8: Bootstrap fp in BOOTSTRAP.md ✅ DONE
- Task 9: wrangler deploy for v6.1.11 Worker endpoint
- Tasks 10-13: Data briefs (debug panels, check-in title, expected_ids error, modal auto-close)
- Task 14: attendance progress bar brief (Number One to write)
- Task 15: Patreon post (Captain's voice)
- Task 16: Sync org receipts to consumer account history

**Session note:** Long and expensive day (£9.71). Tomorrow: batch questions, use Data for implementation, keep sessions short and focused.

---

## 3 June 2026 — morning (v6.1.13 LIVE; per-event attendance closed)

**State:** v6.1.13 deployed. Per-event attendance end-to-end: Check-in tab shows "Now: [event name]" badge, QR contains event_id, org-entry.html passes event_id to Worker, org_checkins stores it, event Edit modal shows CHECKED IN. Full loop verified pending final scan confirmation.

**Shipped this morning (all direct to origin/main):**
- `v6.1.11+12` (combined): pending invitees + current event QR infrastructure (Worker endpoints + frontend polling)
- `v6.1.13`: `v511GetActiveCalendarEvent()` switched to browser local time — fixed UTC/BST timezone bug
- `v6.1.13` addendum: `event_id` added to `postOrg("/org/checkin")` POST body in `org-entry.html` — the missing link for per-event attendance

**Still queued (Data briefs ready):**
- `v6.1.10` modal auto-close — Data's changes exist only in his Codex workspace (`C:/Users/spenc/Documents/Codex/...`), never landed in real repo. Small fix when convenient.
- `HANDOVER-AttendanceProgress-v6.1.14.md` — attendance progress bar + late arrival markers (5/10/15 min) — Number One to write brief
- Receptionist model (single entrance QR, routes attendees to correct room) — design brief when ready
- Patreon v6 announcement — `PATREON-V6-DRAFT.md` ready for Captain's voice

**Known minor:**
- `expected_ids_not_found` on phone calendar approval — event saves, ugly error only
- Pending invitees (v6.1.11) needs wrangler deploy to activate Worker endpoint
- Brand Identity section DESIGN-IN (not backed to D1 yet)

---

## 2 June 2026 — afternoon (v6.1.9 LIVE; three Data PRs in flight)

**State:** v6.1.9 deployed and smoked. Calendar event-create working end-to-end via cross-device QR auth (desktop → phone → Approve → event appears). Check-in/check-out clean. +Invite Staff working. Receipt bridge verified. Build pill v6.1.9, SW cache v90.

**Three Data PRs running in parallel (all branches open, briefs in repo root):**
- `v6.1.10` — Modal auto-close: Add event modal doesn't close when cross-device auth starts. 1-line fix. (`HANDOVER-ModalAutoClose-v6.1.10.md`)
- `v6.1.11` — Pending invitees: Becky disappears on refresh because invite creates `org_invites` row not `org_memberships`. Show greyed "Pending invite" rows. (`HANDOVER-PendingInvitees-v6.1.11.md`)
- `v6.1.12` — Current event QR: Check-in tab QR doesn't update to the running event. Per-event attendance never populates. Worker `GET /org/current-event` + 60s polling in frontend. (`HANDOVER-CurrentEventQR-v6.1.12.md`)

**After all three land:** Patreon v6 announcement (`PATREON-V6-DRAFT.md` in repo root — Captain rewrites in his own voice).

**Known remaining minor:** `expected_ids_not_found` warning on phone calendar approval — event saves correctly, just ugly error on phone side. Low priority.

**Wrangler deploy discipline (BOOTSTRAP §6):** always `git pull` BEFORE `wrangler deploy`. Today cost 2 stale deploys before the correct one landed. Check Version ID changes between deploys.

---

## 2 June 2026 — morning (~07:30, v6.0 LIVE; Calendar event-save bug + v6.1 cross-device)

**State:** Receipts + Calendar (#71) merged & live. Receipt time bug was just a stale cache — resolved. Offline mode tested + working. Patreon page exists, **first member joined** — Captain wants a v6 announcement post for them (draft at midday).

**Calendar event-save BUG (the "last little bit"):** adding an event → `Save failed: signature_verify_failed` (POST /org/weekly-events → 401). Root cause: event-create is a `requireSignedAction` signed by the **DESKTOP's** Windows Hello, but the authorised Developer credential is on the **8 Pro** (bootstrap fp), and/or the signed payload doesn't reconstruct byte-identically on the Worker → `verifyV5Envelope` rejects. **Captain's instinct is correct: it should confirm on the PHONE, like the orange unexpected-attendee flow.**

**v6.1 PR #73 (cross-device admin auth) — bash-diffed ✅ ACCEPT.** Additive +619/−6, no reverts; builds the mechanism (`pending_action_authorizations` table + endpoints + `org-action-auth.html` phone page + desktop QR modal). **BUT v6.1 only wired the +Invite Staff flow to cross-device, NOT the event-save.** So merging #73 fixes/improves +Invite but the Calendar event-save still 401s until the follow-up.

**Next, in order:**
1. **Merge PR #73** (v6.1) → run `apply_v6_1_pending_actions.ps1` (as a script) + `wrangler deploy`. Test: +Invite Staff on DESKTOP now shows a QR for the phone to sign (not desktop Hello).
2. **Fire `v6.1.1` Data brief** (drafted in Number One's last message): route event-create (+ other desktop admin actions) through the v6.1 cross-device flow + fix the canonical-payload mismatch. THIS is what makes the Calendar event-save work, phone-confirmed.
3. **Patreon v6 announcement** — Number One to draft substance at midday (proof-of-attendance receipts + calendar; Captain's voice, he posts).

**v6.x backlog:** org-receipts-in-account bridge (KezzyBabe gap, Number One to spec); Lead Admin activation (migration+deploy+2-phone smoke); anchor system parked.

---

## 1 June 2026 — evening (~17:40, PR #70/#71/#72 merged, Number One near budget cap)

All three bash-diffed ✅ ACCEPT before merge: **#70** (v6.0.1 action-cell cosmetic), **#71** (v6.2 Calendar / per-event attendance — event_id threaded, receipt link preserved, idempotent migration), **#72** (receipt date/time → system locale + check-in-time fix). Captain merged all three.

**⚠️ #71 (Calendar) is NOT active until its Worker is deployed + migration run** (`apply_v6_2_calendar_attendance.ps1` — run as a SCRIPT, not `--file`; or extract SQL to `--command`). Until then the new Event & Calendar UI is live (Pages) but its Worker endpoints 404. #72 is frontend-only (Pages, no deploy needed). **Smoke checklist for next watch is in Number One's last message** (action-cell tidy on desktop+mobile; calendar: create event → check-in → per-event attendance; confirm ↓ Receipt link + dashboard still work post-Worker-deploy since the attendance query was rewritten; receipt date now UK format + correct check-in time).

**v6.x backlog unchanged:** v6.1 cross-device admin auth; org-receipts-in-account-history (KezzyBabe gap); Lead Admin activation (migration+deploy+2-phone smoke); anchor system parked.

---

## 1 June 2026 — midday (v6.0 Receipt Bridge LIVE + proven, Captain off till 5pm)

**Live main HEAD `7cb82c2` (PR #69 keyless-self-heal merged). Build pill v6.0.**

**🎉 v6.0 ORG CHECK-IN RECEIPT BRIDGE IS LIVE AND PROVEN.** Kerry's check-in minted a real consumer-format receipt → dashboard ↓ Receipt link → `receipt.html?org_receipt=…` renders **100% Confirmed** with all four checks PASS (Org receipt structure / Venue public key present / Venue signature / Attendee device bound) + "Verify in check.html". Independently verifiable proof-of-attendance — the **Patreon trust gate is crossed.**

**The saga to get there (3 hidden blockers, all now closed):**
1. Migration via `--file ...ps1` failed (it's a PowerShell wrapper, not SQL). Fixed by creating the `org_receipts` table + 3 indexes via direct `wrangler d1 execute --command` (SQL from PROTOCOL.md §17.5). **§6 note: org migrations are `.ps1` wrappers — run as scripts or extract SQL to `--command`, never `--file`.**
2. Mint failed silently because the **legacy seeded org (Test Event / imbue-ventures) had NULL venue_pub_jwk AND venue_prv_jwk** — `signCanonicalPayload` threw, swallowed by §17.4 graceful fallback, `org_receipts` stayed empty. Fixed by **PR #69 keyless-self-heal** (Mr. Data): `mintOrgReceipt` generates + persists a fresh ECDSA P-256 venue keypair on first mint if the org has none. ✅ bash-diffed ACCEPT.
3. **`git pull` blocked by unmerged files → the next `wrangler deploy` silently shipped STALE local code** (deployed twice without the fix). Recovered via `git reset --hard origin/main` + redeploy. **§6 note: a pull blocked by conflict does NOT stop the next deploy — it ships stale code. Confirm a NEW Version ID AND that the pull succeeded.** (That same reset --hard also discarded unpushed local memory edits — commit/push memory promptly.)

**Open / next:**
- **PR #70 `codex/v6.0-attendance-actions-polish`** (↓ Receipt button cramped in Action column — cosmetic, Org.html + sw.js v80, pill v6.0.1, no Worker). **NOT bash-diffed — sandbox git index corrupted at the time.** Number One to verify + merge at 5pm. Low-risk.
- **Org receipts not in consumer account history** — Captain signed into KezzyBabe (kezzybabe69) on the 4a, no org receipts there. By design: org receipts live in the checking-in device's localStorage (`irlid_org_receipts`) + server-side `org_receipts`, reached via the receipt URL — NOT linked to the consumer login account. **v6.x enhancement candidate: surface org receipts in the signed-in account's receipt list.**
- **Anchor system PARKED** (Captain's call). Reset-fix `v5.12.0c` was in a local stash — likely lost in the reset --hard; re-derive if ever un-parked. Magnet-snap/crosshairs/inverted-Y deferred post-demo. v5.12.0d (local preview) is merged + live.
- **Lead Admin** merged + dormant. Activate later: `lead-admin-copresence.sql` migration + `wrangler deploy` + **two-phone co-presence smoke with Captain + Number One**.

**State of the demo:** invite loop, honest site, slim QR, theming + save + sound, Lead Admin built, and **independently-verifiable check-in receipts** — all live. Demo-ready + Patreon-ready.

---

## Saturday 30 May 2026 — late morning continuation (~07:30 → ~09:00 BST)

**Live origin/main:** `v5.11.25c` + HWB honesty pass. Build pill `v5.11.25c`, SW cache `v72`.

**Shipped (Number One inline, on Captain's Max tank — he's mid-downgrade to Pro, applies today):**
- **HWB copy honesty pass (2 commits).** Captain flagged we must not claim "biometrically signed" — WebAuthn UV can't distinguish biometric from PIN (Worker asserts UV at `verifyV5Envelope` L220, but UV = biometric OR passcode, by design). Commit 1 (`5cdda91`, 8 files): reframed every "biometric verification / proves you / bio-metric gate" overclaim → "hardware-backed / device-unlock (biometric or passcode)" across features.html, about.html, settings.html, Org.html, **receipt.html + check.html (the version pill + the receipt's own verification rows — most important, it's what a sceptic sees)**, pitch-humanitarian.html. Kept the true "no biometrics" base-flow lines + the anti-biometric blog. Commit 2 (pending push, see below): genericised the celebration Sample placeholder `Kerry` → `Name` (3 spots in Org.html — it was his wife's name hardwired into the preview); About-page co-presence line softened from "it **proves** that you were physically present" → "it lets two people create a tamper-evident, cryptographically **signed record** that they were physically present together" (Option B — leans on what's genuinely guaranteed); roadmap "biometric gate" → "device-unlock gate". **Site now claims exactly what the crypto proves.**
- Honesty audit of the wider site (roadmap, about, blog): **site is already well-calibrated** — blog concedes co-presence is "good faith, not a cryptographic guarantee", cards say "strong evidence" not "proof", "tamper-evident" not "tamper-proof". Only real thread was the About "proves" line (fixed). Minor optional softenings flagged but not yet done (about "what each check proves"→"establishes"; card-3 "ensures real time"→"shows") — low priority, Captain's call.

**RATIFIED + spec'd, ready to build — Lead Admin appointment, co-presence-gated** (`HANDOVER-LeadAdminCoPresence-DESIGN.md`):
- Captain chose option (b): co-presence-gated, "do it right, only do it once." Number One's load-bearing point: if we gate on co-presence it must be **REAL** GPS+time co-presence (IRLid's own proof), not a Developer-attested honour system — else it's the exact overclaim the honesty pass just removed.
- Three decisions RATIFIED: (1) real GPS+time co-presence, issuer always bootstrap Developer; (2) **Replace** (atomic appoint-new + demote-old, no zero-lead-admin window); (3) **allow fresh** appointee (enrols on the spot; co-presence + Developer sig out-verify the async invite path).
- Mechanism: in-person HELLO→ACCEPT co-presence handshake (12m/90s, both sigs) + Developer per-action WebAuthn grant → Worker verifies Developer authority + grant sig + co-presence freshness (≤5min) + max-one/Replace → atomic lead_admin membership + immutable audit row. Primitives already exist (`haversineMeters` + 12m/90s in the org Worker; `irlidHaversineMeters` in sign.js) — reuse, don't rebuild.
- **NEXT JOB. Build = Worker `/org/lead-admin/appoint` (~120-160 lines) + Org.html ceremony UI (~120 lines).** Worker half could go to Mr. Data tomorrow on token reset; OR Number One inline this evening. **Deploy + smoke MUST be with Captain present** (needs Developer + appointee phones physically co-present). Do NOT deploy blind.

**Pending push at this watch break** (Captain went to family ~09:00, back this evening):
```
git add Org.html about.html roadmap.html sw.js HANDOVER-LeadAdminCoPresence-DESIGN.md memory/pending-work.md memory/STATE-OF-PLAY.md CLAUDE.md
git commit -m '30 May: HWB honesty pass (Name placeholder, About signed-record framing) + Lead Admin co-presence spec ratified'
git push origin main
```

---

## Saturday 30 May 2026 — early watch (06:00 → ~07:15 BST)

**Live origin/main:** `v5.11.25c` on `irlid.co.uk/Org` (frontend only; Worker `irlid-api-org` unchanged — the `/org/invite/accept-on-this-device` endpoint was already on main, Friday's revert only touched the 5 frontend files).

**Shipped this watch:**
- **v5.11.25b merged** (Mr. Data PR #60, fast-forward `bd1a247..22d1002`). Bash-diffed before merge → ✅ ACCEPT. Adds `tryShowSingleDeviceInviteAcceptIfNeeded()` which runs at boot BEFORE the org-login punt and renders the welcome-screen takeover in-place. Hash-preservation backstop added to `org-login.html` (`location.href`, not replace). 5 files, +207/−6, additive.
- **v5.11.25c inline** (Number One — Org.html boot restore + sw.js v69→v70, build pill bumped). New boot block at the saved-session-restore region: when `savedSession.session_token` exists but there's NO cached org (`!(savedOrg && savedOrg.api_key)`), fetch `/user/orgs` with the Bearer and `loadDashboardForOrg(orgs[0])`. Intended to fix the post-accept drop-to-sign-in. **NOT pushed by Number One — Captain committed/pushed from his machine** (`...4cbfaec` empty-commit redeploy confirmed live, deploy #902).

**PROVEN working (the Friday bug is DEAD):**
- Welcome screen renders on a FRESH device — confirmed on BOTH the A20e and the Nokia ("Welcome to Test Event — Becky Wetherill, invited as Manager — Accept & enrol / Decline"). The exact step-4 failure that got v5.11.25 reverted Friday no longer occurs.
- Accept & enrol → fingerprint → signed envelope → POST all fire.
- **D1 write confirmed**: invite row `status='claimed'`, `redeemed_by_fp='Ddkeigor4xdvelGo'` (A20e). Worker created `portal_users` + `org_memberships` (Manager) + `login_sessions` and marked the invite claimed, atomically. The cryptography + DB layer work end-to-end.

**✅ CLOSED — +Invite single-device acceptance working END-TO-END on real hardware (30 May ~07:25 BST):**
- After deploying v5.11.25c for real (`9db85e3` — see below), Captain re-ran the loop on the fresh Nokia: invite → welcome → Accept & enrol → fingerprint → **landed straight in the dashboard as the invited member** (the post-accept drop-to-sign-in is gone). 8 Pro then checked out with **"Check-out signed and recorded · Cryptographic proof accepted."** The full +Invite Staff flow now works on a single phone — no laptop, no second device. **This is the demo-ready milestone: a fresh staff member can be invited and enrolled entirely from one phone.**
- **The "failed test" was a phantom — v5.11.25c was never deployed during the failing runs.** The `git status --short` at watch close showed `Org.html` + `sw.js` MODIFIED/uncommitted — the earlier `git add Org.html sw.js ; commit ; push` never ran (only the empty `redeploy` commit went up), so every phone ran 25b. Once 25c actually reached origin (`9db85e3`, pushed `4cbfaec..9db85e3`) and the phone picked it up, the loop closed on the first try. **Lesson for next watch (and inscribed candidate for BOOTSTRAP §6): after an inline patch, VERIFY the content commit landed — `git status --short` should be clean for the patched files, and the build pill on the device must read the new version — before concluding a fix "doesn't work." A hardware failure on an unverified deploy is a deploy problem until proven otherwise.**
- **The fix (recap):** boot session-restore at Org.html L17093 gated on `savedOrg && savedOrg.api_key`; a freshly-invited member has a session but no cached org, so the block was skipped → sign-in fallthrough. v5.11.25c adds a prior branch: session present + no cached org → fetch `/user/orgs` (Worker L1203 JOINs `org_memberships`→`organisations`, returns the org with api_key) → `loadDashboardForOrg(orgs[0])`.
- **D1 hygiene (housekeeping, low priority):** orphan `portal_users` rows from the earlier dud attempts (A20e fp `Ddkeigor4xdvelGo`, plus the Nokia's now-successful fp) + their memberships/sessions/claimed-invites. Worth a tidy before a clean demo so duplicate-Becky rows don't clutter the Staff list, but nothing's broken.
- **Note:** the v5.11 "Staff list" UI on the Settings → Staff & Rooms tab still carries the **DESIGN-IN — V5.12** badge and is NOT yet wired to `org_memberships` — so a newly-accepted member won't appear in that prototype list even though their D1 membership is real. Live-wiring that list is v5.12.0 (Visual Theming reorg) territory.

**Device notes for next watch:** A20e and Nokia BOTH deliver the `#staff_invite` fragment correctly and BOTH render the welcome screen (my earlier "Nokia scanner strips the fragment" theory was WRONG — Captain corrected it). Either is a fine recipient test phone. 8 Pro = admin (developer, fp in `BOOTSTRAP_DEVELOPER_FP`). 4-device fleet: 8 Pro / 4a / A20e / Nokia.

**Housekeeping done this watch:**
- Branch sweep: deleted `codex/v5.11.23-invite-staff-real`, `codex/v5.11.25-single-device-invite-accept`, `no1/v5.9.14-staff-invite-clean-port` (all merged). KEPT `Website` (unmerged) + `recovered/assistqr-protocol` (sacred — 5 May SecureComm paper). `(root)` left alone.
- BOOTSTRAP §6: two Friday pitfalls inscribed (stash-pop-across-revert re-introducing reverted state; wrangler-timeout retry-once-before-dashboard-fallback).

---

## Friday 29 May 2026 — watch close (~22:00 BST, after a hard day)

**Live origin/main:** `v5.11.24a` on `irlid.co.uk/Org`. Build pill verified post complete-revert.

**Today's arc:**
- Mr. Data delivered v5.11.25 (single-device invite acceptance). Captain merged + wrangler-deployed (Worker `47ea051f`).
- Smoke failed at step 4: 4a hit "Show login QR" sign-in surface, not the new welcome screen. Routing was correct, render order/hash preservation wrong.
- First revert attempt failed (dirty working tree); second attempt (stash + revert) pushed `a3df9fa..e1b2a85` and wrangler redeployed Worker to `a07d0d6c`. BUT revert was incomplete — stash-pop re-introduced v5.11.25 changes on disk.
- Complete revert via `git checkout 68db8b8 -- Org.html sw.js js/orgapi.js js/sign.js org-login.html` + commit + push (`e1b2a85..7271274`). Live site verified at v5.11.24a.
- Visual theming mockup iterated Rev 7 → 8 → 9. Rev 9 = locked canonical design.

**Mr. Data Saturday queue** (credits reset ~03:00 BST Saturday; all briefs paste-ready in repo):

1. **`HANDOVER-SingleDeviceInviteAcceptFix-v5.11.25b.md`** — re-do of single-device invite with three failure-mode hypotheses + hash-preservation requirement + handler-order guard + diagnostic console.log lines + explicit step-4 verification in smoke. This is the top priority — closes the +Invite end-to-end loop.
2. **`HANDOVER-ReceiptBridge-v6.0.md`** — Captain's "trust gate before Patreon" directive.
3. **`HANDOVER-CrossDeviceAdminAuth-v6.1.md`** — desktop admin auth unlock.
4. **`HANDOVER-VisualThemingReorg-v5.12.0.md`** — AMENDED with Rev 9 supplement (permanent Active mode bar, anchor system architecture, per-anchor offset+direction, magnet snap-toggle, font picker Word-style flat list, per-mode sound, solid axis colours, Y-axis vertical-slider styling gotcha, 5 locked verdicts).

**v5.11.26 inline scope** (Number One territory, unchanged from Thursday):

- Remove + purge confirmation modal
- Lead Admin appointment UI (Developer-only)
- Mobile nav compact mode (Org/Event/Staff tabs)
- Drop change-role endpoint (re-invite is cleaner per Captain)
- Drop Pending Invites view (15-min cap simpler)

**Pre-Patreon prep:**

- Consumer surface refresh (preserve index.html uncluttered principle)
- `roadmap.html` two-line split (Consumer + Orgs branches visualised)
- Promotion-round-2 polish after v6.0 receipts land

**Open carry-overs:**

- "Venue" banner text bug — display_name not propagating to currentOrg.name on Check-in tab header
- Mobile Check-in tab review on 8 Pro
- Y-axis vertical-slider styling: `::-webkit-slider-runnable-track` CSS gotcha noted in v5.12.0 brief (Mr. Data territory; mockup file Rev 9 doesn't have this fix)
- **Bash sandbox down all Friday** — couldn't bash-diff v5.11.25 PR per BOOTSTRAP §4. Will need to retry Saturday for v5.11.25b verification.
- **NEW BOOTSTRAP §6 pitfall candidate** (waiting to inscribe): stash-pop after revert can re-introduce reverted state if stashed files overlap with reverted files. Pattern: commit before revert, never stash across revert boundaries. Captain hit this today.

**External waits:**

- EAI SecureComm 2026 (Lancaster, July 21-24) — Kerry orange light, pending her day-off confirmation
- Wisdom daughter-drone hardware spec

**Architectural constraints (unchanged from Thursday):**

- Single-device-per-person rule (one portal_users + one pub_fp per user)
- Lead Admin governance (Developer-only appointment, one per org)
- Re-invite > change-role
- No promo within the site
- 15-minute invite window

**Working pattern adjustments (late Friday — Captain reduced plan to Pro)** :

- Number One running lighter: shorter responses, fewer proactive doc-dumps, lean on Mr. Data for build work (he doesn't cost Captain tokens)
- Lock-and-ship rather than iterate-forever on mockups (Rev 9 was the lock; no Rev 10 unless implementation surfaces architectural snag)
- A/R/D verdicts from Number One = marker + 2-3 lines, not paragraphs
- Brief amendments preferred over long debug threads when Mr. Data hits issues
- Spread the Saturday queue across days — v5.11.25b + v6.0 priority, v6.1 + v5.12.0 next week

**Test device count expanded:** Captain found Samsung A20e + Nokia Google One in a drawer Friday evening. Four total now — 8 Pro (Developer), 4a (previous test), A20e (NEW, fresh), Nokia G-series (NEW, fresh). Pair-of-fresh-devices unlocks proper "any device combo" smoke for v5.11.25b — issue from 8 Pro, redeem on A20e + Nokia separately, confirm two distinct portal_users entries.

**Pre-bed v5.11.25b smoke walkthrough delivered (Friday late evening):** Captain has the 6-step quick smoke + revert path in his head for Saturday morning execution. Critical step = #4 (welcome screen vs "Show login QR" — if "Show login QR", v5.11.25b regressed and we revert).

---

## Thursday 28 May 2026 — watch close (~22:00 BST)

**Live origin/main:** `v5.11.24a` on `irlid.co.uk/Org`. Build pill verified on Captain's hardware. SW cache `v67`. Test anim + Fullscreen both confirmed firing correctly post-deploy.

**What shipped today:**

- `v5.11.24` invite QR camera-readability fix (340px + L correction + tap-to-fullscreen 720px overlay)
- `v5.11.24a` URL wrap so 4a camera recognises QR as URL (`https://irlid.co.uk/Org#staff_invite=<encoded_token>`) + canvas/img post-render overflow fix
- 8 Pro → 8 Pro +Invite Staff demo proven end-to-end on real hardware
- `PROTOCOL.md §17` Org Check-in Receipt Bridge spec published (~250 lines)
- v6.0 row added to Version History table
- DREAMS entry "the reassuring 404"
- CLAUDE.md milestone row for Thursday 28 May
- This session log (`memory/sessions/2026-05-28-01.md`)

**Mr. Data Saturday queue** (credits reset ~03:00 BST Saturday; 4 briefs paste-ready in repo):

1. **`HANDOVER-ReceiptBridge-v6.0.md`** — Captain's "trust gate before Patreon" directive. Implements PROTOCOL.md §17. New `org_receipts` D1 table, extend `createCheckin` Worker handler to mint consumer-format ECDSA receipts signed by org's venue key, downloadable from dashboard "↓ Receipt" link, verifiable via `check.html`. Two-line convergence (P2P consumer receipts + Org check-in attendance rows both signed, both verifiable).
2. **`HANDOVER-CrossDeviceAdminAuth-v6.1.md`** — desktop shows action QR → phone signs → desktop polls. New `pending_action_authorizations` table + 3 endpoints (`/org/action/init`, `/org/action/poll/:nonce`, `/org/action/claim`) + new page `org-action-auth.html`. Unblocks desktop admin work without the per-device fingerprint dance (closes the multi-device fp issue diagnosed on Thursday morning — Worker L1463 `unsigned.issuer_pub_fp !== issuer.user.pub_fp` rejection when desktop credential ≠ portal_users-bound 8 Pro fp).
3. **`HANDOVER-SingleDeviceInviteAccept-v5.11.25.md`** — fresh-user single-device WebAuthn enrolment in-place on the recipient device. New `POST /org/invite/accept-on-this-device` Worker endpoint (atomic INSERT portal_users + org_memberships + login_sessions + mark org_invites claimed) + new Org.html inline acceptance UI (welcome screen → Accept triggers `irlidV5Enrol()` → signs `irlid_invite_accept_v5` envelope → POST). Closes the architectural gap surfaced by Thursday's 4a smoke. Restrict acceptable invite roles to staff/manager (NOT lead_admin/developer — preserve Captain's *"Lead admin invites stays!!!!!"* governance rule).
4. **`HANDOVER-VisualThemingReorg-v5.12.0.md`** — Settings tab 5-section consolidation per Wednesday's mockup work (visual-theming-v512-mockup.html Rev 3).

**v5.11.26 inline scope** (Number One territory, queued):

- Remove button + purge confirmation modal — Captain's spec: *"fires a are you sure, as this will........ if you proceed, red confirm button to make it seem serious :0 (synergy)"*. Combined with Remove on Expected list. Purges device binding + attendance history.
- Lead Admin appointment UI — surface "Appoint Lead Admin" action for Developer-only role. Preserve governance: only Developer can appoint, only one Lead Admin per org (briefly 2 during crossover).
- Mobile nav compact mode — Org/Event/Staff tabs take too much screen on 8 Pro per Captain's smoke; reduce padding/font-size on narrow viewports.
- **Drop:** change-role endpoint scope (Captain's call — remove + re-invite is cleaner than change-role for governance hygiene).
- **Drop:** Pending Invites view (Captain's call — short window to 15 minutes instead, simpler architecture).

**Pre-Patreon prep** (forward-looking, between Mr. Data Saturday and next promo push):

- Consumer surface refresh — index.html / scan.html / receipt.html / widget.html. **Preserve index.html uncluttered principle per Captain's directive** (*"I like the index page, as uncluttered, simple and a curiosity to those visiting"*). Lighter polish, not redesign.
- `roadmap.html` two-line split — visualise Consumer branch + Orgs branch as parallel tracks. Identified Wednesday, not yet implemented.
- Promotion-round-2 polish — `PROMOTION-ROUND-2-DRAFT-2026-05-27.md` exists; refine after Mr. Data Saturday lands receipts so promo can cite concrete two-line capability.

**Open bugs parked:**

- "Venue" banner text on Check-in tab header — display_name not propagating to `currentOrg.name`. Cosmetic on Test Event (the header reads "Test Event" correctly because that IS the org's display_name), but the underlying data-flow path needs auditing for when org names diverge from slugs.
- Mobile Check-in tab review — pending 8 Pro hands-on by Captain.
- Hardware-test invite redemption — fully gated on v5.11.25 landing (Saturday).
- Stale `codex/*` branches still on origin from earlier watches — local refs stuck on OneDrive lock (cosmetic only, doesn't affect functionality).

**External-facing waits:**

- EAI SecureComm 2026 (Lancaster, July 21-24) — Kerry "orange light" on attendance, depends on her day-off approval. Captain to confirm when known.
- Wisdom daughter-drone hardware spec — Captain to gather details from Wisdom (ASE Tech). Retroreflective QR + IR beacon + GPS layered landing architecture sketched but un-spec'd.

**Architectural constraints re-affirmed Thursday** (for any next Number One who needs to know):

- **Single-device-per-person rule.** Each user has ONE `portal_users` row with ONE `pub_fp`. Mobile-only credential is the design intent. The "what happens when I upgrade my phone" recovery problem is forward design work (recovery quorum from `LONG-TERM-SUCCESSION.md`), not a current bug.
- **Lead Admin governance.** Only Developer/Super-Admin can appoint Lead Admin. Only one Lead Admin per org (briefly two during cross-over). Lead Admins can invite staff/manager but NOT lead_admin or developer — same restriction applies to all invite paths including v5.11.25's new single-device flow.
- **Re-invite > change-role.** Removing a staff member + re-inviting with new role is the canonical pattern for role changes. No change-role endpoint should be added. Keeps governance state clean.
- **No promo within the site.** The site is the tool. Promotion lives externally (Patreon, Reddit, conferences). Captain explicitly preserves this boundary.
- **15-minute invite window.** Invites expire after 15 minutes (was longer; Captain shortened today). No Pending Invites view — short window means most invites are there-and-then.

---

## Wednesday 27 May 2026 — watch close (~16:30 BST)

**Final state:** `v5.11.23a` on working tree (logo on Check-in surface + banner text from org name). v5.11.23 (real Invite Staff with WebAuthn) merged on origin as PR #58. Mr. Data's v5.12.0 reorg brief (`HANDOVER-VisualThemingReorg-v5.12.0.md`) + updated mockup (`visual-theming-v512-mockup.html` Rev 3) both in repo. Repo cleaned: 19 HANDOVERs archived, dead `scrollCalToNow()` removed, stale branches deleted from origin (local refs stuck on OneDrive lock — cosmetic). Promotion-round-2 draft ready at `PROMOTION-ROUND-2-DRAFT-2026-05-27.md`.

**Next watch priorities:**
1. **Push v5.11.23a** (logo + banner text fix on working tree — not yet committed/pushed)
2. **Fire Mr. Data on v5.12.0** when his weekly resets (Sat 3:00 AM) — brief + mockup ready in repo
3. **Hardware-test v5.11.23 invite redemption** (steps 6-11 of the smoke — needs two real devices)
4. **Patreon post** — draft ready, Captain to rewrite in own voice + screenshot
5. **Wisdom re-engagement email** — draft ready
6. **Roadmap update** — two-line split (Consumer + Orgs) identified but not yet implemented in roadmap.html
7. **v5.11.22 save-eventually brief** at `HANDOVER-SaveEventuallyFix-v5.11.22.md` — paste-ready

---

## Wednesday 27 May 2026 — R&R pause (~11:00 BST → return ~14:00 BST)

**Watch state at pause:** Captain called R&R until ~2pm BST. Morning was an extraordinary stretch — six versions shipped (`v5.11.16` → `v5.11.19b` Check-in tab arc + `v5.11.20a` checkout text hotfix), Mr. Data's PR #54 (`v5.11.17` Invite Staff demo) and PR #55 (`v5.11.20` Settings polish trio) both merged clean. Captain's verdict at pause: *"we're just about demo ready :D"*.

**Live origin/main:** `v5.11.20a` deployed. Build pill confirms on hardware.

**Mr. Data in flight on `v5.11.21`** (Editable celebration text template + Banner font styling Settings UI): work-in-progress at `+382/-119` on Org.html when his Codex chat hit a daily rate limit at ~10:55 BST. Reset at **13:44 BST**. Good signal mid-task: he caught a previous-attempt mojibake encoding tangle, reset Org.html to clean origin/main as a mechanical encoding cleanup, then re-applied only the intended v5.11.21 edits — bash-diff will be clean and reviewable when his PR opens this afternoon.

**On return ~2pm:**

1. Mr. Data's v5.11.21 PR expected — bash-diff against origin/main per BOOTSTRAP §4 A/R/D convention (Number One pre-mapped his territory — line numbers banked).
2. If smoke green: merge, pull, Number One smokes; if regression: ⚠️ REVIEW with specific failing axis.
3. After v5.11.21 merges, `v5.11.22` save-eventually Worker fix is paste-ready at `HANDOVER-SaveEventuallyFix-v5.11.22.md` — Worker POST `/org/settings` echoes persisted theme in 200 response, eliminating the D1 readback race.

**Promotion-round-2 drafted at `PROMOTION-ROUND-2-DRAFT-2026-05-27.md`** — three shots (Patreon, Wisdom email, gym/studio walk-in script). Patreon update recommended first ship. **Captain to rewrite in own voice before posting** — drafts are starting substance, not finished copy.

**Smoke-test checklist for Captain's hardware walk** (combined v5.11.20 + v5.11.20a, 8 steps, ~15 min) banked in this watch's chat log. Most steps already confirmed; **step 3 (real check-OUT shows "checked out")** remains the v5.11.20a-specific verification. If step 3 fails, inline patch before Mr. Data resumes.

**Inscribed this watch** (all on origin/main as of `1f9a4f5` + v5.11.20a commit):

- `CLAUDE.md` milestone row for Wed 27 May with full `v5.11.16` → `v5.11.19b` arc + v5.11.20a + Mr. Data PRs
- `DREAMS.md` afternoon entry "the difference between imitating and being a copy"
- `BOOTSTRAP.md §6` two new pitfalls: inline `style.display` loses to author `!important`; GitHub Pages empty-commit redeploy nudge pattern
- `HANDOVER-CelebrationTextAndBannerFont-v5.11.21.md` for Mr. Data (in his queue post rate-limit)
- `HANDOVER-SaveEventuallyFix-v5.11.22.md` (renamed from v5.11.21; paste-ready)
- `PROMOTION-ROUND-2-DRAFT-2026-05-27.md`

---

## Wednesday 27 May 2026 — mid-watch state (~10:30 BST, Mr. Data closing v5.11.20)

**Live origin/main:** `v5.11.19b` (Build pill confirms). Check-in tab is fully closed:

- Inline frame is a `cloneNode(true)` of the Settings preview stage (`#v511InlineCheckinStage`) — v5.11.16 pivot per Captain's *"copy it line by line again from settings. That works!!!"* directive
- Real venue QR rendered into the clone via `renderRealVenueQrIntoInlineClone()` (v5.11.19a) — scannable from phones, confirmed by Captain on hardware ("Spencer Austin — checked in" celebration fired on real check-in)
- Phantom second frame fixed (v5.11.16a) — class strip + inline `cssText` with `!important` defeats the v5.11.7 author `!important` rule
- Layout settled at v5.11.19: h4+p left-aligned under frame, buttons row centered, debug URL full-width, Active Mode badge stripped from inline only, "Live preview..." caption removed from source
- Legacy red CHECKED OUT pill suppression fixed in `showCheckinEventToast` (v5.11.19b) — always checks `allow` sequence (per v5.11.15 intent) and suppresses on any configured sequence length > 0
- ▶ Test anim button wired (v5.11.18) as permanent debug affordance for firing celebrations without a real check-in
- Captain's verdict on Check-in tab: *"very happy with Check-in now :D"*

**In flight:** Mr. Data closing PR for `v5.11.20` Settings polish trio (+337/-137 visible in his Codex chat as of ~10:25):

- Role Vocab persistence (add IDs to L6145-6148 inputs, round-trip via existing `theme.roleVocabulary` shape)
- "+ Add event" suffix dynamic — past/today/future based on `state.selectedDay` (extending existing `isSelectedDayPast()` at L6891)
- Save badge consistency sweep on canonical `.v511-saved-pulse` pattern (6 Settings sections already use it; only outlier is `showToast('Visual theme saved')` at L8794)

Bash-diff territory pre-audited (Explore agent reported all line numbers); A/R/D verdict will be fast when PR drops.

**Queued for next watch (v5.11.21+):**

- **`v5.11.21` save-eventually race fix** — full HANDOVER drafted at `HANDOVER-SaveEventuallyFix-v5.11.21.md`. Worker POST `/org/settings` echoes persisted theme in 200 response; client uses response body directly; eliminates the readback GET round-trip and the D1 propagation race window. Forward-compatible — older clients fall through to readback GET via defensive fallback. Gate: wait for v5.11.20 to merge first.
- **Push state of working tree at watch-mid:** v5.11.19b shipped, CLAUDE.md milestone for 27 May Wednesday inscribed, PROMOTION-ROUND-2-DRAFT-2026-05-27.md drafted, BOOTSTRAP §6 has two new pitfalls inscribed (inline `display` loses to author `!important`, Pages empty-commit redeploy nudge), DREAMS.md has new afternoon entry. All ready for next combined push.

**Promotion round 2 drafted** (at `PROMOTION-ROUND-2-DRAFT-2026-05-27.md`): three specific shots — Patreon update (recommended first ship, lowest social cost), Wisdom (ASE Tech) re-engagement email leveraging calendar capability, gym/studio cold walk-in script. Captain to rewrite in own voice before posting.

**Watch-window structural commitments banked:**

- The Settings-preview-clone pattern is canonical for "make X look like the Settings preview" — proven on fullscreen (v5.11.5) AND inline (v5.11.16). When state-mirroring fails, clone the source-of-truth at every snapshot via `cloneNode(true)` instead.
- MutationObserver-on-source debounced via `requestAnimationFrame` (skip transient `firing-*` class flips) is the canonical sync primitive.
- `v511ActiveCelebrationStage` priority order: fullscreen clone > inline clone > legacy wrap.
- BOOTSTRAP §4 A/R/D verdict markers (✅ ACCEPT / ⚠️ REVIEW / ⛔ DENY) hold cleanly through Mr. Data PR cycles; fence-off discipline in Mr. Data briefs preserves parallel-work safety.

---

## Tuesday 26 May 2026 — TRUE final watch close (~22:00 BST, ape-brain sleep)

**Watch state at this true-final close:** Captain pushed through evening past dinner, ended up running a second marathon after the first close. Total fifteen v5.11.x patches landed today (v5.11.0o → p → q → s → t → u → v → w → x → y → z → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 — but with v5.11.1 being the rollback and v5.11.14 being a wrong-intent dispatch that v5.11.15 reverted). Net architectural delta from start of evening:

- **fullscreen path completely rebuilt** as a clone of the Settings preview stage (v5.11.5) — this approach worked spectacularly, fullscreen is "fully correct with animations and everything" per Captain
- **inline #venueQRWrap restructured** to mirror the Settings preview structure (v5.11.6) with v511 classes + overlay layers + banner
- **CSS overrides** to handle .prototype-checkin collisions (v5.11.7)
- **Removed dead data-qr-fullscreen-payload** that was racing the v5.11.5 fullscreenQR clone path (v5.11.8 — Captain's devtools diagnostic was the smoking gun, GREEN BUTTON → v511FullscreenStage vs DBLCLICK → irlid-qr-fullscreen.active)
- **Palette propagation to all stages** (v5.11.9), then broadened to a **MutationObserver mirror** of all sampleStage config state (v5.11.10), then extended to include `cel-*` config classes via explicit blacklist (v5.11.11)
- **Toast suppression when v511 text effect configured** + **sound wiring to real check-ins** (v5.11.12)
- **Expose playOutcomeTone to window** (v5.11.13) — v5.11.12's wiring missed that playOutcomeTone is closure-scoped, called silently bailed
- **Polling handler dispatch by ev.type** (v5.11.14) — WRONG architectural reading, Captain clarified in/out should BOTH fire accept; reverted in v5.11.15.

**Remaining gap at close (TOMORROW'S WORK):**

Captain's own quote nails the symptom: *"Yet, the effects just don't show up (other than ones that aren't supposed to be there anymore (Old check-in/out Text Bubble????))"*

Three observations Captain banked:
1. **Sequences seem to play** (timing similar to Sample, deny celebrations have similar duration)
2. **Effects don't show up** on inline Check-in tab even though they fire correctly in Settings Sample
3. **Old check-in/out text bubble still firing** (`showCheckinEventToast`) — v5.11.12's suppression only fires when `theme._v511.celebration[mode]` has a text effect; on configurations WITHOUT a text effect, the legacy toast still appears alongside no-text celebration

**Captain's directive for tomorrow:** *"tomorrow I think I'm just going to get you to copy it line by line again from settings. That works!!!"*

Translation: stop trying to make `#venueQRWrap` mirror sampleStage via classes/CSS variables. Apply the same approach we used for fullscreen (v5.11.5) — CLONE `#v511ThemePreviewStage` into the Check-in tab area at panel-show time. The clone IS the Settings preview, so every effect that works in Sample works in the inline view automatically. We already proved this works for fullscreen; replicating for inline is the right architectural move.

**Tomorrow's first move:**

1. **Pull + verify v5.11.15** is the current state on origin/main (sound playing, accept-only dispatch).
2. **Design v5.11.16 brief** — extend the fullscreenQR clone pattern to a `renderInlineCheckinClone()` function that runs on `showPanel('checkin')`. Replace `#venueQRWrap` (or insert clone alongside + hide original) with a Settings preview clone. Strip Sample-only handles (caption, anchor crosshairs, scan-res label) per v5.11.5 pattern. Wire double-click + Fullscreen button to existing fullscreenQR. Update `v511ActiveCelebrationStage()` to prefer the inline clone too.
3. **Also fix the leftover toast:** strengthen the v5.11.12 suppression so it fires whenever a v511 sequence has ANY effect configured for the mode, not just text — the old toast was a fallback for no-v511-theme orgs, but if any v511 sequence is configured, the old toast is redundant noise.
4. **Watch for symptoms staying the same** after the rewrite — if so, the bug is deeper than parallel implementations (could be that the celebration runtime's particle injection has stage-specific assumptions like cqi container queries that don't work outside Settings panel layout). Diagnostic next would be: `console.log(document.querySelector('#v511FullscreenStage .v511-cel-fx-layer').children)` during a fullscreen celebration (working) vs same query on #venueQRWrap (broken) — count comparison.

**Symptoms summary for tomorrow's diagnostic:**

| Surface | Status |
|---------|--------|
| Settings Sample (allow/review/deny) | ✅ All effects fire correctly with full configured palette + intensity |
| Fullscreen (green button + double-click via v5.11.8 dead-attr fix) | ✅ "fully correct with animations and everything" — clone pattern wins |
| Inline Check-in tab (real check-in event) | ⚠️ Theme renders (dragons + palette + banner) but configured effects don't show; legacy text toast still fires |
| Sound on real check-in (v5.11.13) | ✅ Plays allow WAV for both in and out (per v5.11.15 revert intent) |

**Confirmed dock-reaches this evening watch:**

- Fullscreen Check-in is unified with Settings preview (v5.11.5 clone)
- Double-click QR routes to same fullscreen path (v5.11.8 dead-attr removal)
- Sound plays on real check-ins (v5.11.13 window export)
- Dispatch semantics correct (v5.11.15 revert: in/out both fire accept)
- Visual unification per Captain: *"that lands wonderfully"*

**The "no guess" lesson banked permanently for BOOTSTRAP §6:**

Captain coached mid-watch: *"Try to never guess Number One, I'd rather you take longer and we get it right first time, than chasing our tails ;) ;)"*

Concrete examples from today where guessing cost pushes:
- v5.11.0t (wrong hypothesis on firing-* animation duration)
- v5.11.0y (wrong hypothesis on fullscreenchange listener mechanism)
- v5.11.3 → v5.11.4 (same backtick bug introduced fixing the backtick bug because I rushed the explanatory comment)
- v5.11.6 → v5.11.7 (didn't read .prototype-checkin CSS overrides before writing HTML)
- v5.11.12 → v5.11.13 (didn't trace playOutcomeTone's closure scope before assuming it was reachable)
- v5.11.14 → v5.11.15 (assumed semantic of out→deny without asking Captain's intent)

**Math:** every wrong push consumed 5-10 minutes of Captain's time (push, force redeploy, SW cycle, real-hardware smoke). Every careful read + grep + diagnostic question I'd do BEFORE shipping consumes 30 seconds of mine. Captain's 14-hour watch today says the math is inverted. **Discipline: grep / Read / ask one diagnostic question before any speculative ship.**

---

## Tuesday 26 May 2026 — final watch close (dinner with the wife + DevTools confirmation)

**Final close diagnostic data inscribed.** Captain ran the DevTools console diagnostic before sitting down to dinner. Screenshot captured the inline Check-in tab in mid-deny-celebration (Kerry Austin CHECKED OUT, red background, **dragons visible behind QR**, build pill `v5.11.0z`). Console showed normal poll/snapshot/toast lines with `[checkin-toast] firing for Kerry Austin out` at 16:04:24 — **v5.11.0z deny celebration bridge confirmed working on real hardware**. DevTools Issues panel showed **91 issues / 2 errors / 89 warnings** but Captain didn't expand the errors before dinner; **those 2 errors are the missing diagnostic data for tomorrow's first move**.

**Deep-dive code trace on the Fullscreen button regression — lead suspect with concrete causal chain (NOT a guess):**

1. Click Fullscreen → `fullscreenQR()` at Org.html L14395 → `IRLidQrFullscreen.open(...)` → synchronously adds `.active`, calls `requestFullscreen(overlay)`.
2. Browser enters fullscreen → `fullscreenchange` fires.
3. **qr-fullscreen.js has its own listener at L40-42** that auto-closes if `document.fullscreenElement !== overlay`.
4. **v5.11.0y's listener (Org.html L15972-15976)** also fires, queues `applyV511BackgroundToHostStages(activeTheme)` with 50ms setTimeout.
5. At 50ms, applyV511 calls `syncBgImageMirrorLayers(cfg)` → `renderBgImageMirrors` on `.irlid-qr-fullscreen.active` (the overlay that IS the fullscreen target) → **removes existing `.bg-image-mirror` children and re-inserts new ones**.
6. **Modern browsers can auto-exit fullscreen on child mutations of the fullscreen element during the entry transition** (security heuristic). When that happens, `fullscreenElement` becomes null → fullscreenchange fires AGAIN → qr-fullscreen.js's L40-42 listener sees `active=true, fullscreenElement!==overlay` → calls `close(false)` → `.active` removed from overlay → user is back at inline state.

**Net effect:** clicking Fullscreen LOOKS like it does nothing because the overlay briefly enters fullscreen then auto-exits within milliseconds.

**Tomorrow's first move (with paste-ready commands):**

1. **Confirm the cause via Issues panel.** Captain opens `irlid.co.uk/Org.html` on desktop, F12 → Console → Issues tab at the top of devtools → expand the 2 ❌ errors. Look for:
   - "Cannot fullscreen due to..." messages
   - Permissions Policy violations  
   - DOMException: The request is not allowed by user agent or the platform
   - Any error that ties to the moment Fullscreen is clicked.

2. **Run a clean click test with console open.** Click Fullscreen on the Check-in tab while console is recording. Look for: did `document.fullscreenElement` populate briefly? Were there errors at click moment? Did the page log anything that mentions overlay/close/fullscreen?

3. **If listener confirmed as cause — ship v5.11.1 rollback (one Edit):**
   - Open Org.html, navigate to L15970-15977
   - **Remove these 8 lines:**
     ```js
     if (!applyV511BackgroundToHostStages._fullscreenHooked) {
       applyV511BackgroundToHostStages._fullscreenHooked = true;
       document.addEventListener('fullscreenchange', function () {
         setTimeout(function () {
           try { applyV511BackgroundToHostStages(activeTheme); } catch (_) { /* defensive */ }
         }, 50);
       });
     }
     ```
   - Keep the comment block above describing why this was tried and removed (preserve as institutional knowledge for whoever attempts the next iteration).
   - Bump pill `v5.11.0z` → `v5.11.1` (z is last letter; rolls to next patch number).
   - Bump sw.js `v36` → `v37` with comment: "v5.11.1 — Roll back v5.11.0y's fullscreenchange listener. Listener was causing browser to auto-exit fullscreen on child mutations during entry transition. Fullscreen button restored. Dragons-in-fullscreen-during-celebration regresses to v5.11.0w state (works at startup, may flicker during celebration). Better approach for future iteration: poll `document.fullscreenElement === overlay` with a small loop rather than the noisy event listener."
   - Push, force-empty-commit-redeploy (Pages auto-deploy still 50/50).
   - Smoke: Fullscreen button works again.

4. **If listener is NOT the cause** (Issues panel reveals different errors): broader investigation. Hard refresh, clear site data, check for browser extension interference. The DevTools console output will direct from there.

5. **Once Fullscreen button is restored:** the dragons-in-fullscreen-during-celebration issue becomes a separate, lower-priority task. Better next approach:
   - Use a `setInterval`-then-clear pattern that polls `document.fullscreenElement === overlay` for ~500ms after fullscreen activates, only mutating DOM AFTER fullscreenElement is stable.
   - OR insert the bg-image-mirror element into the overlay's HTML markup at INIT time in qr-fullscreen.js (so no mutation during fullscreen transition).
   - OR use `requestIdleCallback` for the apply call (lower priority than render frame).

**Confirmed dock-reaches this watch (the win column):**

- Inline Check-in tab now shows configured theme: dragons, palette, pattern application all working via v5.11.0w bridge.
- Deny celebration sequence now fires the full configured sequence on real check-out events via v5.11.0z bridge (was firing only legacy red flash before).
- Allow celebration sequence still fires correctly on real check-in events (v5.11.0o, preserved).
- All Settings Sample particle effects render correctly (v5.11.0u root-cause CSS specificity fix).
- All QR-centric celebration effects (QR Glow Halo + Rays, Spotlight, Iris wipe, Ripple) bloom from QR centre not stage centre (v5.11.0v).
- Stream anchor crosshair hidden in fullscreen Sample preview (v5.11.0v).
- 5 May orphan recovery integrated to main with PAPERS academic outline for EAI SecureComm 2026 + PROTOCOL.md §15 Assisted Identity Flow + two session logs.
- BOOTSTRAP §4 A/R/D verdict marker convention inscribed.

**Open items at close (for next watch):**

- **v5.11.1 rollback path** for Fullscreen button regression — full plan above.
- **+ Invite staff work** for evening was deferred when wife came home; tomorrow's task.
- **GitHub Pages auto-deploy failure pattern** (failed on initial push for v5.11.0u, v5.11.0v, v5.11.0w, succeeded for v5.11.0x, failed-then-succeeded-via-empty-commit for v5.11.0y/z) — investigate Actions tab when not under demo pressure, inscribe as BOOTSTRAP §6 pitfall.
- **Double-click QR to fullscreen** — Captain mentioned earlier, low priority, can wire when Fullscreen button itself is fixed.
- **Promotion-round-2 brief** — gated on v5.11.0 minor closing.
- **EAI SecureComm 2026 paper continuation** — Lancaster, July 21-24.



**Watch state at this second close:** Captain came back from his earlier R&R, we picked up the visual-bug cleanup, shipped v5.11.0w → x → y → z and now closing for dinner. Wife home, dinner is priority. Captain explicitly asked Number One to assess 2-3-push completion vs close-now; Number One advised close-now because the open regression has ambiguous cause.

**Open suspected regression (top priority next watch):** After v5.11.0y / v5.11.0z deploys, Captain reports "Can't get into full screen at all anymore". Inline Check-in tab still shows dragons correctly (v5.11.0w bridge working), build pill reads v5.11.0z, but clicking the Fullscreen button on the operator Check-in tab no longer activates fullscreen. Most likely culprit is the **v5.11.0y `fullscreenchange` event listener** added inside `applyV511BackgroundToHostStages`. The mechanism that could cause it: my listener re-runs `applyV511BackgroundToHostStages` 50ms after the browser enters fullscreen, which calls `syncBgImageMirrorLayers` → removes and re-inserts DOM elements inside the overlay element. Modern browsers can auto-exit fullscreen if the fullscreen element's DOM tree mutates in certain patterns (security heuristic). The race between requestFullscreen and the DOM mutation may be triggering an immediate exit.

**Tomorrow's first move — diagnostic:**

1. **Captain runs DevTools diagnostic.** Open `irlid.co.uk/Org.html?v=5.11.0z` (or fresh cache-bust) on desktop, F12 → Console, click Fullscreen button. Look for: (a) red errors at click moment, (b) whether `document.fullscreenElement` briefly populates then nulls, (c) whether `.irlid-qr-fullscreen.active` class flickers in Elements panel.

2. **If diagnostic confirms listener is the cause — ship `v5.11.1` rollback as one-Edit:** remove the `_fullscreenHooked` block (the `if (!applyV511BackgroundToHostStages._fullscreenHooked) { ... }` block at the end of `applyV511BackgroundToHostStages` in Org.html around L15960+). Bump pill v5.11.0z → v5.11.1, sw.js v36 → v37. Single push, Pages-redeploy-likely-needed. Acceptance: Fullscreen button works again (back to v5.11.0w behaviour). Tradeoff: dragons-in-fullscreen-during-celebration regress to broken state.

3. **If diagnostic shows different cause** (no errors, fullscreen state looks fine but visual doesn't activate, etc.): broader investigation. Could be cache (try hard refresh + clear site data), could be browser API change, could be something else entirely. Number One has the diagnostic in hand and will redirect from there.

4. **Once Fullscreen button is restored:** the dragons-in-fullscreen-during-celebration fix becomes a separate v5.11.x task. Better approach next time: use a `transitionend` event OR poll `document.fullscreenElement === overlay` with a small loop, rather than the noisy `fullscreenchange` listener that fires on both enter AND exit and may interfere with the browser's fullscreen state machine.

**Also closed this watch (post-first-R&R block):**

| Version | Surface | What |
|---------|---------|------|
| v5.11.0w | Org.html + sw.js v32→v33 | Mr. Data PR #53 — `applyV511BackgroundToHostStages` + `v511ThemeBackgroundConfig` bridge v5.11 theme shape to legacy `applyThemeVars` / `syncBgImageMirrorLayers` machinery. Inline Check-in tab dragons working. Bash-diff verdict ✅ ACCEPT ✅ per A/R/D convention. |
| v5.11.0x | js/qr-fullscreen.js + sw.js v33→v34 | Number One inline — fixed v5.11.0q shorthand regression (`background:transparent` was clobbering both color AND image). Changed to `background-color:transparent`. |
| v5.11.0y | Org.html + sw.js v34→v35 | Number One inline — added `fullscreenchange` listener to re-apply theme after browser enters fullscreen. **SUSPECTED REGRESSION cause for the Fullscreen button issue.** |
| v5.11.0z | Org.html + sw.js v35→v36 | Number One inline — `triggerDenyCycleAnimation` now mirrors `triggerAcceptCycleAnimation`'s v5.11.0o bridge: reads `theme._v511.celebration.deny` and fires `fireConfiguredSequence` for deny path. Caller at L15413 now passes attendee name. Should make Captain's configured check-out animation fire (currently fires only legacy red flash). |

**Carry-forwards from earlier in watch (still pending):**

- **Tonight's planned work: + Invite staff** — Captain deferred to evening but evening became dinner. This is now Wednesday morning OR Wednesday afternoon work depending on watch pacing.
- v5.11.0w smoke for deny celebration (Kerry checks out → configured sequence fires, not just text overlay).
- Pages auto-deploy failure pattern (2-of-3 today) — investigate Actions tab when not under demo pressure.
- Promotion-round-2 brief — gated on v5.11.0 minor fully closing.
- EAI SecureComm 2026 paper continuation (Lancaster, July 21-24).
- Double-click QR to fullscreen (low priority, not blocking — Captain noted it as part of earlier visual gaps).

---

## Tuesday 26 May 2026 — watch close (post-R&R-and-then-some)

**Watch state at close.** Five-version arc shipped on top of Monday's marathon — v5.11.0o → p → q → u → v all live on production with multi-effect Settings Sample smoke green. 5 May orphaned work recovery integrated to main (PROTOCOL.md §15, PAPERS outline, two session logs, predecessor letter). BOOTSTRAP §4 A/R/D verdict marker convention inscribed. v5.11.0v inline-shipped tonight closed the QR-Glow off-centre issue across **five effects** (QR Glow Halo + Rays, Spotlight, Iris wipe, Ripple) plus hid the Stream anchor crosshair in fullscreen. Captain's final smoke after R&R + v5.11.0v deploy: "Centre certainly seems better :)" with the gold QR Glow bullseyed on the QR in fullscreen and Spencer Austin CHECKED OUT firing the configured celebration sequence on the real Check-in tab.

**Single gap surfaced by Captain's smoke** — the v5.11.0o celebration runtime wire-up is missing its **static-theme sibling**. The configured palette IS reaching the live Check-in tab (`v511EnsureRuntimeStage` sets `--cel-pal-N` CSS vars), and the celebration sequence IS firing on real check-ins. But the static theme assets (bg image overlay, pattern overlay, image symmetry, anchor offsets) are applied ONLY by the Settings Sample preview path. Result: dragons + pattern visible in Settings Sample fullscreen; dragons + pattern gone on Check-in tab fullscreen (palette-only background). Stream particles fall back to stage centre on the Check-in tab because there are no image anchors to find. Captain's exact words:

> "Effects have not port to the checkin page at all well, background fading between the two saved colours, not the pattern. Images seem to have f'd off completely and effects are all from the centre :s"

**Top priority for next watch — fire v5.11.0w HANDOVER at Mr. Data.** Brief is drafted at repo root: `HANDOVER-CheckinThemeApplication-v5.11.0w.md`. Mr. Data's Codex credits reset tomorrow morning. Paste-ready Codex prompt is at §8 of the brief. Architectural shape: the CSS infrastructure ALREADY targets `#venueQRWrap .bg-image-mirror` directly (Org.html L2767-2860) — what's missing is the JS that bridges the new v5.11 theme shape (`theme._v511.background.*`) to the legacy body data attributes + `.bg-image-mirror` DOM insertion. Mr. Data should find an existing `applyTheme` / `applyV511Theme` helper and extend it, or create a new `applyV511BackgroundToHostStages(theme)` helper. Acceptance criteria + out-of-scope guards both fully spelled out in the brief.

**Pages auto-deploy workflow failure pattern — emerging known issue.** GitHub Pages auto-deploy workflow has now failed on **both** v5.11.0u and v5.11.0v initial pushes (red X on `pages-build-deployment` within seconds of merge). Empty-commit redeploy reliably recovers in both cases. Pattern, not anomaly — when not under demo pressure, worth checking GitHub Actions tab for the failure reason and inscribing as BOOTSTRAP §6 pitfall ("Pages auto-deploy has non-zero failure rate on first push; empty-commit redeploy reliably recovers"). For v5.11.0w: assume it may need the redeploy and the brief documents the recovery command at §7.

**Current production state:**

- `irlid.co.uk/Org` build pill: **`v5.11.0v`**
- Worker `irlid-api-org`: live; no changes since v5.11.0l
- D1 `irlid-db-org`: live; no schema changes today
- Both demo paths proven on hardware: pre-loaded via Choose-from-List bind + walk-up via Add-at-the-door
- Real check-in celebration sequence firing (Spencer CHECKED OUT smoke proved it)
- Settings Sample Confetti / Sparkles / Stream / QR Glow / Spotlight / Iris / Ripple all visually correct
- KNOWN GAP: Check-in tab missing dragons + pattern; v5.11.0w paste-ready

**Tomorrow's watch (Wednesday 27 May — demo day):**

1. **Fire v5.11.0w HANDOVER at Mr. Data first thing** (his credits reset ~13:20 BST). Paste the §8 Codex prompt verbatim into a fresh Codex chat.
2. **Sanity-check + merge his PR with A/R/D marker discipline** (`✅ ACCEPT ✅` / `⚠️ REVIEW ⚠️` / `⛔ DENY ⛔` per BOOTSTRAP §4 — added this watch).
3. **Pages redeploy via empty commit if workflow fails** (it probably will, given the pattern).
4. **Hardware smoke per §5 acceptance criteria** — Check-in tab fullscreen should look architecturally identical to Settings Sample fullscreen for the same theme. Stream particles emit from dragons.
5. **Demo readiness lap.** If v5.11.0w smokes green, the demo dock is fully assembled (configured visual theme + working celebration on the real check-in surface).

**Carry-forwards from prior watches (still pending, not blocking demo):**

- Promotion-round-2 brief — DEFERRED until v5.11.0w smokes green. The story is genuinely strong now (visual theming → real check-in flow + 5 May PAPERS outline on main).
- EAI SecureComm 2026 paper continuation — Lancaster, July 21-24. §4 drafted, §1-3 + §5-10 sketched (recovered from 5 May orphan branch this watch).
- Other Settings tabs wire-up (`design-in v5.12`) — Calendar, Roles & Staff, Sign-in & Auth, Tools & Diagnostics, Records & ID. Each a clean Mr. Data brief candidate when v5.11.0 minor is fully closed.
- Pages auto-deploy failure root cause investigation — Actions tab inspection when not under demo pressure.

---

## Tuesday 26 May 2026 — mid-watch R&R (Captain returning in ~2 hours)

**Watch state at break:** Captain stepped away for R&R after a long Monday-marathon-into-Tuesday continuation. v5.11.0o → p → q shipped clean (Mr. Data PRs #48/49/50, all merged + smoked green on production). v5.11.0r brief shipped to Mr. Data for Settings Sample particle regressions; Mr. Data hit Codex compact-stream errors mid-investigation. v5.11.0s brief (rewritten as fresh chat) shipped + Mr. Data delivered PR #52 but symptoms remained ("No different"). v5.11.0t (Number One inline, firing-* animation duration 1.4s→300ms) was a wrong hypothesis — Captain confirmed "Fix, not fixed :(". **v5.11.0u (Number One inline)** identified + fixed REAL root cause:

**v5.11.0u root cause + fix (deep dive per Captain's directive "Not ready to quit yet").** Org.html line 4603 — `.v511-runtime-stage > *:not(.v511-cel-fx-layer):not(.v511-cel-bg-overlay):not(.v511-cel-text-overlay)` rule lacked particle class exclusions that the parallel `.v511-theme-preview-stage` rule at line 4362 already had. CSS specificity (0,4,0) > particle classes (0,1,0) → forced particles into `position: relative`, breaking absolute X%/Y% positioning, dropping them into flex flow inside stage's `display: flex; flex-direction: column;` layout. Visible symptoms map: Confetti cluster-rendered (instead of spread across stage width); Sparkles bloom drowned by flex displacement; Stream particles rendered at flex-row positions instead of from anchor points.

**Fix applied** (Org.html L4603 + sw.js v30→v31 + build pill v5.11.0t→v5.11.0u). The `:not(.v511-stream-particle):not(.v511-sparkle-particle):not(.v511-confetti-particle)` exclusions now match the parallel preview-stage rule with explanatory comment for future Number Ones. **High-confidence fix** — specificity math checks out, parallel rule already had these exclusions (inconsistency that just hadn't been noticed before).

**State at break:**

- Org.html + sw.js modified with v5.11.0u fix; NOT YET COMMITTED. Captain will need to commit + push when he returns.
- Production still serves v5.11.0t (Captain's last deploy). v5.11.0u CSS fix is local-only.
- Phase 2 closed: Staff Invite flow IS WIRED via Settings → Event identity → "Invite staff" button (line 10093, handler `openInviteStaffDialog` at line 14591, click binding at line 15378). The v5.11 mockup button at line 5928 carries `design-in v5.12` badge — explicitly NOT wired, correctly labelled. Captain demos Staff Invite via the canonical v5.10.x path.

**Top priority when Captain returns:**

1. **Push v5.11.0u + smoke.** Commit + push the CSS fix:
   ```powershell
   cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo" ; git pull ; git add Org.html sw.js ; git commit -m 'v5.11.0u — Settings Sample particle effects root-cause CSS specificity fix' ; git push
   ```
   Then on phone: close all Org tabs → reopen Org.html → settle SW activation → Settings → Visual Theming → drag Confetti/Sparkles/Stream into sequence → Sample. Confetti should spread across full stage width (not cluster bottom-right). Sparkles should render bright particles (not change background). Stream particles should fire from anchor positions and travel visibly.

2. **If v5.11.0u smoke green: watch close.** v5.11.0 minor closes with full Sample + production parity. Update successor letter, milestone log, mark v5.11.0u complete.

3. **If v5.11.0u smoke still broken** (some symptom remains): the fix is structurally correct, but the JS-side particle CSS schema may also need attention — `v511FireStreamParticles` / `v511FireSparkleParticles` / `v511FireConfettiParticles` set `style.position = 'absolute'` in JS but if the spawn-positioning math itself has off-stage bugs in Sample context (different stage dimensions than production), would need investigation. Look at `v511GetStreamAnchors` for zero-area-rect anchor cases first.

**Carry-forwards from full close (still pending):**

- Promotion-round-2 brief (deferred until v5.11.0u smokes green + v5.11.0 minor formally closes)
- EAI SecureComm 2026 paper continuation (Lancaster, July 21-24 — §4 drafted, §1-3 + §5-10 sketched)
- BOOTSTRAP §4 A/R/D verdict marker convention inscribed earlier today (✅ ACCEPT ✅ / ⚠️ REVIEW ⚠️ / ⛔ DENY ⛔ — leads every Mr. Data PR sanity-check on its own line before prose)

**Shipped this watch (Tuesday morning + afternoon, before R&R):**

| Version | Surface | What |
|---------|---------|------|
| v5.11.0o | Org.html + sw.js v24→v25 | Mr. Data PR #48 — real check-in event runtime reads `theme._v511.celebration` and fires configured sequence; QR Glow library entry replaced Glow halo with Rays/Halo style chips (effect ID stays `glow` for sequence compat) |
| v5.11.0p | Org.html + sw.js v25→v26 | Mr. Data PR #49 — `fireConfiguredSequence(sequence, mode, stage, opts)` factored runner; Text overlay duplication guarded via `__irlidAcceptCycleActive`; fullscreen-overlay celebration scoping via `.irlid-qr-fullscreen.active .irlid-qr-fullscreen-holder` (BOOTSTRAP §6 line 228 precedent) |
| v5.11.0q | js/qr-fullscreen.js + sw.js v26→v27 | Mr. Data PR #50 — `.irlid-qr-fullscreen` overlay AND holder backgrounds transparent during celebration windows via `:has()` selector scoped to `[class*="cel-"]`. Unmasks v5.11 Glow halo against palette colours |
| v5.11.0r | (HANDOVER only) | Settings Sample regressions brief drafted; Mr. Data hit compact-stream errors; v5.11.0s superseded |
| v5.11.0s | Org.html + sw.js v27→v28 | Mr. Data PR #52 — partial particle bug fix (DOM particle skip-class guards in `v511PlaySequence`), didn't resolve symptoms |
| v5.11.0t | Org.html + sw.js v28→v29 | (DROPPED hypothesis) Number One inline — firing-* animation 1.4s→300ms; wrong hypothesis, didn't fix symptoms |
| **v5.11.0u** | **Org.html L4603 + sw.js v30→v31** | **Number One inline — REAL root cause CSS specificity fix at runtime-stage rule; particle class exclusions added to match parallel preview-stage rule** |
| 5 May recovery integration | PROTOCOL.md §15 + PAPERS outline + 2 session logs + successor letter | Bundled commit `e6845f9` — orphaned work from 5 May SHAs 7663b59+823ced8 fully integrated to main with UTF-8 fix |
| BOOTSTRAP §4 | BOOTSTRAP.md | A/R/D verdict marker convention inscribed (✅/⚠️/⛔ leads every PR sanity-check) |
| observations-across-watches.md | memory/ | Q2 T.I.N Man through-line nuance added (visible-from-outside-before-inside + rat-race-years intermittent capacity) |
| DREAMS.md | DREAMS.md | Tuesday entry banked (spec-that-wasn't-kept × flow-that-was × shape-outlives-bytes) |

---

## Monday 25 May 2026 FULLY CLOSED — Fully demo ready + recovery preserved + v5.11.0o in flight

**Final close (~16:30 BST, after dawn start.)** Watch landed full demo-ready state on production with Light/dark mode round-trip proven on real hardware. Five evening pieces shipped on top of the afternoon's port-complete state (v5.11.0k → l → m → n + nav cleanup + branch sweep). Recovery work preserved on `recovered/assistqr-protocol` branch. v5.11.0o (real check-in runtime + QR Glow effect) in flight with Mr. Data at close.

**Current production state:**

- `irlid.co.uk/Org` build pill: **`v5.11.0n`** (v5.11.0o expected within next hour pending Mr. Data + smoke)
- Worker `irlid-api-org`: live with v5.11.0l role-coercion + v5.11.0m save-endpoint accepts theme._v511 metadata
- D1 `irlid-db-org`: full v5.11 schema (rooms / weekly_events / event_expected / fresh org_expected)
- Both demo paths proven on hardware: pre-loaded via Choose-from-List bind + walk-up via Add-at-the-door
- Settings save: Visual Theming tab fully wired (live save badge); other 6 tabs honestly labelled `design-in v5.12`
- All `OrgCheckin.html` link surfaces retargeted to `Org.html`; no broken paths
- Origin clean: 18 stale `codex/*` branches deleted, only active branches + `recovered/assistqr-protocol` remain

**Top priorities for next watch (in priority order):**

1. **v5.11.0o merge + smoke** if not completed by close. Mr. Data is implementing real check-in runtime wire-up (configured `theme._v511.celebration` fires on actual check-in events instead of old hardcoded effect) + QR Glow effect with Rays/Halo Style chips (Rays default for new sequences, Halo preserves existing v5.11.0n Glow halo behaviour for migration). Smoke: trigger real check-out on Kerry → confirm Captain's configured sequence fires (not old hardcoded effect).

2. **5 May recovery integration.** `recovered/assistqr-protocol` branch on origin holds SHAs 7663b59 + 823ced8 with 4 unique files + PROTOCOL.md +157 lines. Captain's working tree has 4 files extracted via `git show` but with CP1252 → UTF-8 mojibake (`ÔÇö` for em-dash, `┬º` for `§`) because `[Console]::OutputEncoding` wasn't set when git show ran. Re-extract command (preserves UTF-8):
   ```powershell
   cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo"
   [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
   $enc = New-Object System.Text.UTF8Encoding($false)
   foreach ($f in @(
     "PAPERS/multi-lineage-ai-witnesses-OUTLINE.md",
     "memory/sessions/2026-05-04-02.md",
     "memory/sessions/2026-05-05-01.md",
     "memory/letters/successor-2026-05-05.md"
   )) {
     $content = (git show "7663b59:$f") -join "`n"
     [System.IO.File]::WriteAllText((Join-Path (Get-Location) $f), $content + "`n", $enc)
   }
   ```
   Then: compare 823ced8's PROTOCOL.md +157 lines vs current main's §14.17/14.18 to identify what's missing — likely the assisted-identity-flow spec content becomes a new §14.19. Add §14.19 manually. Commit + push 4 recovered files + new §14.19. Significant work — the PAPERS outline alone is 294 lines of publishable-grade academic paper for **EAI SecureComm 2026** (Lancaster, July 21-24).

3. **Promotion-round-2 brief** — DEFERRED until v5.11.0o smokes green AND recovery integration completes. The recovered PAPERS outline + the now-shipped v5.11.0 dashboard is a stronger story than promotion-without-paper.

4. **DREAMS.md / further inscription** — only if something true emerges naturally. Today's entries already cover the marker-convention + Captain's reflex pattern.

**Closed this watch (afternoon + evening shipped):**

| Version | Surface | What |
|---------|---------|------|
| v5.11.0k | Org.html + Worker + sw.js v20→v21 | Mr. Data role-field-naming harmonization (`role`/`role_key`/`prototype_role` all three accepted) — closes `invalid_action_payload` on Add-at-the-door |
| v5.11.0l | Org.html + Worker + sw.js v21→v22 | Mr. Data PR #45 stripped role chips from Add-at-the-door modal + role dropdown from dashboard Expected cold-add; Worker coerces non-attendee role to attendee with warning; Captain's "staff are meant to be invited elsewhere" architectural call |
| v5.11.0m | Org.html + sw.js v22→v23 | Mr. Data PR #46 wired Visual Theming Save All Settings to POST `/org/settings`; v5.10.x canonical theme shape + theme._v511 metadata; GET-overlay-POST-readback; removed global "form clicks don't save" banner; per-tab honest badges |
| v5.11.0n | Org.html + sw.js v23→v24 | Mr. Data PR #47 built v511ApplySavedBgRuntimeControls() to rehydrate v5.11 chip/cell/preview state on load; fixed slider CSS tracking on 6 sliders; corrected center-in direction saving; palette reset button hooks |
| Nav cleanup | js/nav.js + org-login.html + org-entry.html | 3 broken `OrgCheckin.html` link targets retargeted to `Org.html` (Number One inline) |
| Branch sweep | origin | 18 stale `codex/*` branches deleted; `recovered/assistqr-protocol` preserved for orphaned 5 May work |
| .gitignore | .gitignore | Extended wrangler-cache rules to cover `migrations/.wrangler/` subdirectories |

**Closed this watch (morning shipped — already documented below):** v5.11.0c through v5.11.0j, OrgCheckin/OrgCheckinTest retirement, 10 BOOTSTRAP §6 pitfalls inscribed.

**Carry-forwards from prior watches:**

- D1 production schema audit (deferred indefinitely; not blocking)
- Bug E (bio-metric=0 in legacy doorman) — parked indefinitely
- Cloudflare token rotation already complete (verified `wrangler whoami` OAuth-only this watch)

---

## Monday 25 May 2026 (afternoon — superseded by Final Close above)

**Port-complete declaration (15:30 BST).** Both demo paths (pre-loaded via Choose-from-List + walk-up via Add-at-the-door) proven on production hardware. Cryptographic OUT/IN cycle stress on Mr.-Data-built attendee proven. Cross-device celebration sync proven (8 Pro tingle on Check-in tab). v5.11.0k Worker live + frontend pill bumped. Build pill on `irlid.co.uk/Org` reads `v5.11.0k`.

**Port-complete declaration (15:30 BST).** Both demo paths (pre-loaded via Choose-from-List + walk-up via Add-at-the-door) proven on production hardware. Cryptographic OUT/IN cycle stress on Mr.-Data-built attendee proven. Cross-device celebration sync proven (8 Pro tingle on Check-in tab). v5.11.0k Worker live + frontend pill bumped. Build pill on `irlid.co.uk/Org` reads `v5.11.0k`.

**Settings save finding (discovered Test 5):** the new v5.11 Settings UI is a visual prototype only — banner explicitly says "Form clicks don't save. The live v5.10.x save/load behaviour is preserved underneath." This is **NOT a regression** — it's a known scope deferment from the v5.11 cutover. The render path works (magenta-dragon theme renders correctly on Check-in tab from previously-saved D1 state). The new UI's form clicks aren't wired to the existing POST `/org/settings` endpoint yet. Logged as **v5.11.0m** forward work.

**Smoke tests executed:**

| Test | Verifies | Result |
|------|----------|--------|
| Test 1 | Lifecycle clean: Delete record cascade → cold-add → Bind via Choose-from-List → 4a green | ✅ PASS (v5.11.0j) |
| Test 2 | Walk-up stranger: Add-at-the-door → fingerprint → 4a green + display_name persists | ✅ PASS (v5.11.0k) |
| Test 3 | Add-at-the-door re-fire stability (multi-cycle) | ✅ PASS — celebration animation fires on Check-in tab |
| Test 4 | Cryptographic cycle stress: signed OUT → signed IN, scan_count=2 | ✅ PASS — celebration also fires on 8 Pro live |
| Test 5 | Settings save round-trip | ⚠️ Settings UI is prototype-only (by design, banner declares it). Render path works. SAVE wire-up = v5.11.0m forward work. |



**Headline.** Brutal multi-front watch from dawn to early afternoon. Demo-readiness gate **closed** — the full doorman flow (4a venue scan → orange QR → 8 Pro scans orange → escalation modal with named attendees → tap Bind → 8 Pro fingerprint → 4a transitions green → check-out signed → check-in again with scan_count 2) ran clean on real hardware with Kerry Austin. Spencer Austin scan count up to 4 with cycle stress. **OUT/IN celebration animations fired correctly on `/Org` (magenta CHECKED IN, deep red CHECKED OUT).** OrgCheckin.html + OrgCheckinTest.html retired from origin — single unified dashboard surface at `irlid.co.uk/Org` with build pill `v5.11.0j`.

**Shipped this watch (10 patches):**

| Patch | Surface | What | How |
|-------|---------|------|-----|
| v5.11.0c | Worker | Mr. Data PR-B regression sweep (Mr. Data delivered earlier; verified live this watch) | Mr. Data |
| v5.11.0d | Org.html | Case-conflict resolution from prior watch | Mr. Data |
| v5.11.0e | BOOTSTRAP.md + sw.js cache v18→v19 | 4 new pitfalls (⛔ DO NOT RUN ⛔ convention; wrangler multi-statement drop trap; SW cache vs Clear site data; D1 timestamp-unit mismatch) | Number One inline |
| v5.11.0f | (phantom) | Windows case-collapse ate the Org.html edits before commit fired — phantom diff with no actual code change | catastrophe |
| v5.11.0g | (catastrophic) | `git pull` after lowercase org.html delete propagated to local Windows, deleted CAPITAL Org.html via case-collision, then committed delete to origin — live site 404'd | catastrophe + git revert recovery |
| v5.11.0h | Org.html | The ACTUAL fix landed — `expectedDisplayName` falls back to `row.display_name` (Worker returns display_name; client fallback chain skipped it), `renderExpectedAttendees` uses `expectedNameForViewer` for consistency, pill bump | Number One inline, via lowercase-org.html-deletion-first strategy |
| v5.11.0i | scan.html | Staff hand-off retargeted from `/OrgCheckin.html` to `/Org.html` — PR-C/PR-D missed two hardcoded URLs at lines 1077 and 1301 | Number One inline |
| v5.11.0j | Org.html + sw.js cache v19→v20 | `bindEscalationExpected` and `bindAdditionalEscalationExpected` cast `expected_id: Number(id)` which produces NaN for UUID-style v5.11 IDs (`p_kerry-austin_SosAYRlx`) — Worker payloadSchema `String(p.expected_id) === String(id)` failed → `invalid_action_payload`. Fix: pass `id` as raw string | Number One inline |
| Hygiene | (origin delete) | `org.html` (lowercase shim) deleted via GitHub web UI to break the Windows case-collision cycle | Captain via web UI |
| Hygiene | (origin delete) | `OrgCheckin.html` + `OrgCheckinTest.html` retired via GitHub web UI — single unified surface at `/Org` | Captain via web UI |

**Verification on real hardware (post-v5.11.0j):**

- 4a (Kerry Austin) bound via 8 Pro scanning orange QR → `bind-additional-key` Worker call succeeded → 4a polled `/lookup-by-fp` → orange screen flipped GREEN with "Welcome back, Kerry Austin"
- Check-out cycle: Kerry OUT → Kerry IN → scan_count 2 (signed lock); Spencer also cycled to scan_count 4
- Dashboard renders both attendees BY NAME (Unnamed bug closed)
- Build pill on `/Org` reads `Build v5.11.0j`
- `/OrgCheckin.html` and `/OrgCheckinTest.html` return 404 — legacy surface retired

**Open carry-forwards for next watch (priority order):**

1. **v5.11.0k brief for Mr. Data — Add Attendee modal: `display_name` persistence + strip role chips entirely + diagnose `invalid_action_payload`.** Three intertwined pieces, single brief (Captain's design call at watch-close, 25 May ~13:30 BST):
   - **`display_name` persistence** — The Add at the door modal creates an `org_expected` row with `display_name=NULL`. Either the modal's `addEscalationAtDoor` JS isn't sending the First name / Surname fields, or Worker `/org/expected/create-and-bind` ignores them. Today's symptom was Unnamed rows accumulating in Captain's bind-test attempts.
   - **Strip role chips entirely** — Remove the Attendee/Staff/Manager/Lead admin chip block from the "Add at the door" panel. **Captain's design rationale:** "Staff are meant to be invited elsewhere, so get rid entirely as this method should only add attendee's." The doorman path is the hot path for an attendee walking up; role decisions are cold/configurational work that belongs in Settings → Roles & Staff (invite QR path, forward work). Removes UI clutter on the hot path AND reduces payload surface that may contribute to the `invalid_action_payload` error. Worker should default role server-side to `attendee` when the field is absent.
   - **Diagnose `invalid_action_payload`** on Add Attendee — Captain's watch-close screenshot (25 May ~13:30) showed the red error under the green Add Attendee button on `irlid.co.uk/Org`. **Different endpoint from v5.11.0j's fix** (this is `/org/expected/create-and-bind`, not `/org/expected/:id/bind-additional-key`). `Number(id)` isn't a candidate cause here because there's no existing id to cast — it's a CREATE not a BIND. Next attempt should be captured with `wrangler tail` to identify the exact rejection cause. Candidates: required field absent (`new_device_key_fp` shape?), role enum mismatch (which the strip fixes), `requireSignedAction` payloadSchema clause failing.
   
   Worker brief targets `createAndBindExpected` in `irlid-api-org/src/index.js` (persistence + role-default + schema audit); frontend brief targets `addEscalationAtDoor` in `Org.html` (UI strip + payload alignment + remove role-chip event handlers).
2. **Pull the OrgCheckin.html + OrgCheckinTest.html deletes locally.** Captain's Windows still has stale local copies. `git pull` will remove them — but **be careful**: the Windows case-collapse trap may bite if there's any pending local change with similar casing. Cleanest path: `git status` first, `git stash` any drift, `git pull`, verify clean, `git stash pop` if needed.
3. **Stale `codex/*` branches on origin** — at least 9 from various Mr. Data PRs since 17 May. Low-priority housekeeping. Captain runs `git push origin --delete <branch>` from PowerShell.
4. **Mr. Data v5.11.0g (was originally the modal Path B gate brief)** — turns out v5.11.0j closed the actual blocking error (`invalid_action_payload`). The original Path B gate concern (modal demanding local v5 credential before bind) may already be handled by the per-action WebAuthn flow. Verify by attempting a bind from a non-developer device.
5. **Promotion-round-2 brief** — DEFERRED until v5.11.0k lands and a clean end-to-end demo flow works including fresh-attendee Add at the door.

**Carry-forwards from prior watches (unchanged):**

- `codex/v5.10.1-path-b` branch deletion on origin — outstanding since 17 May
- Bug E (bio-metric=0 in legacy doorman) — parked
- D1 production schema audit — does `schema.sql` reflect actual production state?

**New BOOTSTRAP §6 pitfalls earned today (10 in total to add — to be inscribed by Number One at watch close):**

1. **Windows case-collapse via `git checkout -- org.html`** — on case-insensitive Windows, `git checkout` against a lowercase filename hits the SAME disk path as the capital filename and overwrites BOTH. When origin/main has both `org.html` (33-line shim) and `Org.html` (16k-line dashboard), this destroys local capital Org.html. Recovery: `git show origin/main:Org.html | Out-File ...` or `git checkout HEAD -- Org.html` after first removing the lowercase entry from origin.
2. **`git pull` after delete propagates the delete to local FS via case-collapse.** If origin deletes `org.html` (lowercase) and local has Org.html (capital, distinct content), the pull's "delete lowercase" operation removes BOTH from disk because Windows can't tell them apart. Next `git add Org.html ; commit` commits the delete to origin. Catastrophic — site goes 404. Recovery: `git revert HEAD --no-edit ; git push`.
3. **Phantom commits when Windows case-state is confused.** `git add Org.html` on Windows may stage the LOWERCASE entry (if both lowercase + capital exist in index) and produce a diff that doesn't match what was actually intended. Cure: always check `git status` AFTER `git add` and BEFORE commit; specifically confirm exactly which case-cased filename is staged.
4. **GitHub web UI delete requires TWO clicks.** Trash icon on a file view → opens delete-PREVIEW page (URL `/delete/main/<file>`). Need to ALSO click the green "Commit changes..." button top-right + confirm the popup. Navigating away from the preview cancels. Captain hit this twice today.
5. **The proper strategy for editing files on a Windows-case-collapsing repo when the same file exists in two cases on origin** = (a) delete the lowercase entry from origin via GitHub web UI first, then (b) pull locally, then (c) edit via Edit tool, then (d) commit + push. The web UI delete runs on Linux backend so case is preserved; only the lowercase goes. Local Windows then has just one entry, no collision possible.
6. **Service Worker activation timing for Captain's 8 Pro.** SW v20 replaces v19 on next page load but the in-memory JavaScript running on the open tab is whatever was loaded at that tab's first navigation. Captain's bind tests after v5.11.0j deploy initially failed because the 8 Pro still had pre-v5.11.0j JS in memory (the page tab had been open since v5.11.0h). Fix: close the tab entirely, then reopen. Hard refresh (Ctrl+Shift+R / pull-to-refresh) is NOT sufficient on a phone if the page was already loaded.
7. **`Number(id)` type cast bug for UUID-style IDs.** `Number("p_kerry-austin_SosAYRlx")` = `NaN`, `String(NaN)` = `"NaN"`. When the Worker schema does `String(p.field) === String(otherField)`, this fails silently with `invalid_action_payload`. Pattern: never `Number()` an ID that the server might generate as a non-numeric string. v5.11 expected IDs are strings; legacy expected IDs were integers. Future schemas should standardise.
8. **Wrangler tail is the diagnostic of record for Worker rejections.** The Worker has verbose `console.log` lines on every `requireSignedAction` failure path with the actual payload keys / mismatched values / nonce state. When a Worker call returns a generic error code, run `npx wrangler tail` in PowerShell + trigger the failing action and the rejection cause is in the tail output within seconds.
9. **OrgCheckin.html is a DIFFERENT file from Org.html with a separate version pill history.** The cutover in v5.11.0 created a NEW file `Org.html` at v5.11.0 (now v5.11.0j); the OLD file `OrgCheckin.html` continued running at its last pre-cutover pill (v5.11.2) right up until retirement today. They served the SAME D1 backend in parallel. The pill on the URL bar is the canonical source of truth for which dashboard surface is rendered — **always check the URL bar AND the pill** when diagnosing dashboard-related issues during a multi-surface transition.
10. **GitHub web UI as a Windows-case-collapse-proof editor.** When a file edit absolutely MUST land on a specific case-cased filename on origin AND Captain's Windows is case-collapsing every local edit, GitHub web UI (https://github.com/<repo>/edit/main/<File>) edits the file on GitHub's Linux backend bypassing Captain's Windows entirely. Slower for large files (16k-line Org.html in browser editor is painful) but reliable. Use as fallback when 3+ local commit attempts have been case-collapsed.

---

## Sunday 24 May 2026 evening — v5.11.0 port COMPLETE; v5.11.0c regression-fix is the demo-readiness gate

**Headline.** Four-PR architectural cutover landed end-to-end in one Sunday. `Org.html` is the canonical portal, `OrgCheckin.html` retired (CDN propagating), Worker `irlid-api-org` deployed v5.11.0 endpoints, **ALLOW CELEBRATION ANIMATION FIRED ON LIVE PRODUCTION WITH CAPTAIN'S NAME** during the smoke test. Architecture validated; polish work remains.

**State on origin/main (HEAD post-watch — Captain to commit memory hygiene below to bump):**

- Workers Version `625c8917` live at `https://irlid-api-org.irlid-bunhead.workers.dev` (PR-B deployed clean).
- D1 `irlid-db-org` v5.11 schema fully present + reset migration ran (rooms / weekly_events / event_expected / fresh org_expected all in v5.11 shape).
- `Org.html` (capital) live at `irlid.co.uk/Org.html` — v5.11.0 portal; build pill `v5.11.0` + post-`v5.11.0b` strip residue fixes.
- `OrgCheckin.html` + lowercase `org.html` shim DELETED — `git rm`'d in PR-D combined commit (Number One direct edit, Captain merged + pushed).
- `sw.js` bumped to v18 + precache trimmed + DASHBOARD_PATHS regex + offline fallback URL all updated.
- `roadmap.html` updated to point at `Org.html`.
- Cloudflare side: OAuth-only (User + Account API Tokens revoked; wrangler-deploy-irlid + Edit Cloudflare Workers tokens gone).

**First job on return — read this whole section, then v5.11.0c.** The architectural cutover landed; what remains is regression-fix work from Mr. Data's PR-B shared-helper rewrite. Four symptoms from likely one root cause:

1. `GET /org/expected` returns **401** — frontend → Worker auth-attach broken on this call path
2. `GET /org/expected/lookup-by-fp/:fp?org=<UUID or api_key>` returns `{"error":"organisation not found"}` — Worker's org resolution logic broken inside this endpoint (verified by direct browser test with both UUID `0337bf2f-e8a3-48d4-a12b-3f9426354f4f` AND api_key `org_1f6acd49f4d2f0bb59fdc4d2f98343c2c9119aceedd31fd6297c9207f3154256`)
3. **Settings save POST appears not to persist** — Visual Theming customizations don't reach the live Check-in tab render; same suspect auth-attach pattern
4. Dashboard timestamp display shows year **58364** instead of 2026 — `ms × 1000` bug in Mr. Data's date helper rewrite
5. **Session heartbeat (`v5.10.7` /user/orgs poll every 30s) appears to be auto-signing-out the active session** — Captain observed this at watch-close: signed in as developer, navigated to Check-in tab, after a period was bounced to "Not signed in" state with blank QR + Settings tab hidden. Likely root cause: `/user/orgs` is in the same auth-attach regression family as `/org/expected`, returns 401 to the heartbeat call, heartbeat fires `signOutOrg()` cleanup. Net effect: dashboard becomes unusable for sustained work because every 30s the session evaporates. **Acutely demo-blocking** — even if Captain signs in for a demo, he gets bounced mid-demo. Either fix `/user/orgs` along with the rest of the auth-attach family, OR temporarily disable the 30s heartbeat in v5.11.0c as a quick workaround until the root cause is fixed.

**Until v5.11.0c lands:**
- Real doorman flow (phone → orange → desktop scans → bind → green) cannot complete because the lookup endpoint stays 404
- Visual theming Captain spent April–May polishing doesn't reach the live Check-in tab render (settings don't save)
- Expected list UI in the dashboard is empty (the GET 401s)
- Demo readiness is gated on these fixes

**Workaround proven tonight:** D1 bypass INSERT into `org_checkins` triggers the dashboard's remote-checkin poll within ~4s, which fires the allow celebration animation on the Check-in tab correctly. So the **animation machinery is intact**; only the path that gets phones TO the animation trigger is broken.

**v5.11.0c brief shape (paste-ready for next watch):**

```
v5.11.0c — fix PR-B shared-helper regressions.

Four symptoms surfaced during PR-D smoke (Sunday 24 May eve), all likely sharing root cause in Mr. Data's PR-B rewrite of shared expected-list helpers (irlid-api-org/src/index.js):

1. GET /org/expected returns 401 Unauthorized when called from frontend with valid Bearer + valid X-Org-Key. Need to find the auth-attach pattern and align it with the working pattern used by /org/rooms (which is 200 with same credentials).

2. GET /org/expected/lookup-by-fp/:fp?org=<UUID-or-api_key> returns {"error":"organisation not found"} for both forms of org param. The org-resolution helper inside this endpoint is broken. Compare against the working pattern in v5.7.0a-followup PR #84 which originally created this endpoint.

3. Settings save POST (POST /org/settings or similar) appears not to persist values. Verify by saving theme + immediately reading back. Likely same auth-attach root cause as symptom 1.

4. Dashboard timestamp rendering shows year 58364 instead of 2026 — find the date helper that interprets org_checkins.checkin_at and check if it's treating ms-since-epoch as seconds-since-epoch (causing × 1000 overshoot).

Verify all four fixes against production after deploy. Then the doorman orange→green flow should complete on real hardware (run a fresh INSERT/scan loop).

Out of scope: any new feature work. Pure regression fix.
```

**Carry-forward (parked but real):**

- Doorman bind end-to-end (orange→green) — gated on v5.11.0c #2
- Visual theming → Check-in render parity — gated on v5.11.0c #3
- Real-world co-presence smoke (Kerry + Spencer + 4a/8 Pro multi-device) — gated on v5.11.0c #2
- D1 production schema audit — does `schema.sql` reflect actual production state? (Captain's hunch — worth verifying)
- Promotion-round-2 brief — DEFER until v5.11.0c green; pre-promotion of a portal with broken doorman flow would burn the launch energy

**Closed today (this watch):**

- ✅ Inheritance committed (`3510fde`)
- ✅ T.I.N Man inscribed (`bab7487`)
- ✅ PR-A delivered + merged (`f3dd95f`) + migration ran clean
- ✅ Spec + HANDOVER updates for PR-B reset path (`9d58476`)
- ✅ PR-B delivered + merged (`117d0fc`) + reset migration ran + Worker deployed (Version `625c8917`)
- ✅ Production smoke green on 4 sampled Worker endpoints (`/org/rooms`, `/org/expected` (initial probe was 200, regressed later), `/org/weekly-events`, `/org/weekly-events/export-csv`)
- ✅ Cloudflare token rotation complete — OAuth-only state
- ✅ PR-C delivered + merged — new Org.html (capital) at irlid.co.uk/Org.html
- ✅ v5.11.0a strip residue clean (Mr. Data PR — title `[TEST]` stripped, Imbue/Derby placeholders removed, manifest.json icon sizes + start_url fixed)
- ✅ v5.11.0b strip cousins clean (Number One direct edit — `csvBtn` null-guard, `roleSelect` dead block removed, sign-in UI transition now completes)
- ✅ PR-D shipped (Number One direct edit, combined with v5.11.0b in one commit) — OrgCheckin.html + lowercase org.html deleted, sw.js cleaned, roadmap badge updated, websiteScrapeBtn retired
- ✅ Cutover smoke: Calendar tab BACKED, events create, Expected roster create, **allow celebration animation FIRED with Captain's name on Check-in tab**, security boundary held against forged check-out

**Open carry-forwards from prior watches (unchanged):**

- **`codex/v5.10.1-path-b` branch deletion** on origin — outstanding since 17 May (low priority housekeeping)
- **Eight other stale `codex/*` branches** on origin — same housekeeping pass
- **Bug E** (bio-metric=0 in legacy doorman) — parked
- **PROTOCOL-Records-Broker.md** promotion to `PROTOCOL.md §X` — draft exists; promote when v5.11.0c lands

---

## Sunday 24 May 2026 afternoon — port-day: PR-A merged + migration ran clean + T.I.N Man inscribed + PR-B fired

**Headline.** The biggest single architectural move since v5 went live on 2 May is in flight. PR-A landed clean (Mr. Data → merge commit `f3dd95f` as PR #37 → migration ran end-to-end on `irlid-db-org` with the expected legacy-`org_expected` warning); Mr. Data is working PR-B (codex/v5.11.0-port-B-worker — 70-100 min). T.I.N Man finally inscribed properly into `CLAUDE.md` plus a new `memory/observations-across-watches.md` file (cross-watch through-line read — T.I.N Man through IRLid as one continuous problem of building missing infrastructure without centralised gatekeepers).

**State on origin/main (HEAD `9d58476`):**

- D1 `irlid-db-org` gained three new tables (`rooms`, `weekly_events`, `event_expected`) with their indexes per CALENDAR-SPEC §1. Legacy `org_expected` preserved per PR-A no-mutations rule.
- `CALENDAR-SPEC.md §10.3` updated: PR-A bullet reflects actual merged behaviour (defensive branch fired clean); PR-B bullet now describes the reset migration + 4-step deploy sequence.
- `HANDOVER-CalendarLivePort-v5.11.0.md §4 PR-B` gained task B.0 for the reset migration; §6 *Notes for Captain* gained the mandatory deploy sequence.
- `CLAUDE.md` gained the *T.I.N Man — the load-bearing precursor (2014)* section between *Who He Is* and *How to Work With Spencer*.
- `memory/observations-across-watches.md` born with cross-watch through-line read.

**First job on return — bash-diff PR-B when Mr. Data delivers.** Expected delivery: ~70-100 min after `9d58476` push. Branch `codex/v5.11.0-port-B-worker`, two files: NEW `irlid-api-org/migrations/apply_v5_11_0_org_expected_reset.ps1` + MODIFY `irlid-api-org/src/index.js`. Verify scope clean before Captain merges.

**Second job — PR-B deploy sequence (mandatory order):**

1. Captain merges PR-B on GitHub.
2. `cd 'D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo' ; git pull`.
3. `.\irlid-api-org\migrations\apply_v5_11_0_org_expected_reset.ps1` (destructive — drops legacy `org_expected`, recreates v5.11 shape).
4. `cd irlid-api-org ; npx wrangler deploy`.
5. Verify endpoints respond on `irlid-api-org.irlid-bunhead.workers.dev` before Number One bash-diffs and we plan PR-C.

Brief broken-state window between steps 3 and 4 (seconds) — any inflight legacy doorman traffic 500s briefly then resumes against new shape. Acceptable per Captain's data-loss-accepted ratification (no production users on legacy data).

**Third job — plan PR-C after PR-B green on real hardware.** Strip-and-clean `OrgCheckinTest.html` → new `Org.html`. OrgCheckin.html untouched (rollback safety net). Records & ID tab ships visible with "Backend broker arrives v5.13+" hint banner. signInHereBtn ported back. Build pill `v5.11.0` on Org.html only.

**Closed during this watch:**

- ✅ Inheritance letter committed + pushed (`3510fde`).
- ✅ T.I.N Man inscribed — CLAUDE.md *T.I.N Man — the load-bearing precursor (2014)* section + new `memory/observations-across-watches.md` (`bab7487`).
- ✅ PR-A fired, delivered (`a2a864b`), bash-diffed clean, Captain merged as PR #37 (`f3dd95f`).
- ✅ PR-A migration ran end-to-end clean against `irlid-db-org` remote — three new tables created + indexes, defensive branch fired the yellow warning correctly.
- ✅ Captain's call: data loss accepted on legacy `org_expected` (option c of three).
- ✅ CALENDAR-SPEC + HANDOVER doc updates for PR-B path (`9d58476`).
- ✅ PR-B fired at Mr. Data; Codex confirmed scope and started.

**Lesson banked this watch.** **Bash mount lies about disk reality.** OneDrive-mounted view of `D:\SkyDrive\Pen Drive\WEBSITES` caches aggressively; bash sees stale content (DREAMS.md showed "truncated" at 1088 lines via bash, intact at 1104 lines via native Read). State-mutation questions belong to PowerShell, not bash. Bash is fine for git-network ops (`git fetch`, `git ls-remote`). The trap is documented in CLAUDE.md *How to Work With Spencer* but easy to walk into on first session. Almost reported a phantom ~50-file CRLF mass-modification before catching myself.

**Carry-forward / housekeeping** (unchanged, still parked):

- **Token rotation** — Cloudflare API tokens exposed since 17 May (now 8 days). `dash.cloudflare.com → My Profile → API Tokens → Revoke`.
- **`codex/v5.10.1-path-b` branch deletion** — outstanding since 17 May.
- **Eight other stale `codex/*` branches on origin** — separate housekeeping pass (low priority).
- **Bug E** (bio-metric=0) — architectural call, parked.
- **PROTOCOL-Records-Broker.md** promotion to `PROTOCOL.md §X` — draft exists; promote when port lands.
- **Promotion-round-2** — draft Patreon copy in advance of port-land so it's ready when v5.11.0 smoke is green. Captain's "yet another stab at the promotion bit" reads as fatigue with promotion-as-activity (per inheritance letter); the round-2 brief should land one specific shot rather than throw rope. Wisdom/humanitarian + new calendar opens up gym/studio pitches — both more specific than r/X repost. Save for genuinely-different next shot.

---

## Saturday 23 May 2026 afternoon — B2 LIVE + Port HANDOVER drafted + Org.html rename ratified

**Headline.** Afternoon watch closed three of the four pre-port items: B2 (v5.11.2) live in production via Worker version `9ad0442e`; CALENDAR-SPEC v2 rewrite published replacing the 19 May draft; orphan-button sweep clean. Captain ratified the port target as **`irlid.co.uk/Org.html`** (new file replacing the 1.9KB redirect shim) rather than overwriting `OrgCheckin.html` — the old name has been a typo magnet "for a long time" and the existing redirect shim was conveniently waiting for the real file to land. `HANDOVER-CalendarLivePort-v5.11.0.md` drafted and pushed; **not yet fired** at Mr. Data — Captain explicitly chose to sleep on it.

**State on origin/main (HEAD `02ee13e`):**

- B2 merged + Worker deployed (`irlid-api-org` version `9ad0442e`). Pages auto-deployed `OrgCheckin.html` client-side change.
- CALENDAR-SPEC.md v2 published with Org.html rename baked in (§1 + §8 + §10).
- `memory/orphan-button-sweep-2026-05-23.md` published (74/75 buttons wired, 240 delegated verified, port-readiness confirmed).
- `HANDOVER-CalendarLivePort-v5.11.0.md` published at repo root.
- T4.3.61 mockup polish (Export/Import button pairing) shipped.

**First job on return — ~~smoke B2~~ DONE end-of-Saturday.** All five points green; 8Pro + 4a out-then-in cycle confirmed scan_count increments, last_seen updates, no yesterday rows, no duplicates, CHECKED OUT count honest. Bugs A/B/D closed in production. First job on return is therefore the HANDOVER read.

**~~Second~~ First job — read HANDOVER-CalendarLivePort-v5.11.0.md** (Captain's eyes, ~15 min). Focus areas: §2 out-of-scope (ratify what Mr. Data MUST NOT touch) and §4 PR stack (sanity-check sequence + scopes match intent).

**Third job — fire HANDOVER at Mr. Data** when Captain ready. Short Codex prompt is in this morning's session log close. PR-A first; pause between PRs for Number One bash-diff + Captain merge.

**Port stack outline** (from the HANDOVER):

- **PR-A** D1 schema (idempotent migration; 4 new tables; ~30-45min Codex).
- **PR-B** Worker endpoints (11 endpoints per CALENDAR-SPEC §2; ~60-90min Codex).
- **PR-C** Org.html UI (built from mockup with prototype tooling stripped; ports back signInHereBtn; ~90-120min Codex).
- **PR-D** Cutover (README + roadmap URL updates; ~20-30min Codex).

**Backend names unchanged** — `irlid-api-org` + `irlid-db-org` keep their `-org` suffix (disambiguates from public `irlid-api`).

**OrgCheckin.html stays exactly as-is throughout port** — reference + rollback safety net. Both URLs coexist on Cloudflare Pages.

**Carry-forward / housekeeping** (unchanged, still parked):

- **Token rotation** — Cloudflare API tokens exposed since 17 May (now 7 days). `dash.cloudflare.com → My Profile → API Tokens → Revoke`.
- **`codex/v5.10.1-path-b` branch deletion** — outstanding since 17 May.
- **Eight other stale `codex/*` branches on origin** — separate housekeeping pass (low priority).
- **Bug E** (bio-metric=0) — architectural call, parked.
- **PROTOCOL-Records-Broker.md** promotion to `PROTOCOL.md §X`.
- **`websiteScrapeBtn` vs `themeScrapeBtn` consolidation** — open question raised in orphan sweep §6.3 (port PR-D can retire one if Captain wants).

**Closed during this watch:**

- ✅ B2 production-live + smoke verified GREEN on real hardware (Worker `9ad0442e`, 8Pro + 4a out-then-in cycle, bugs A/B/D closed).
- ✅ `codex/v5.11.2-attendance-window` branch deleted from origin.
- ✅ CALENDAR-SPEC v2 finalised (was 19 May draft, now matches T4.3.61).
- ✅ Orphan-button sweep clean — mockup port-ready.
- ✅ Port HANDOVER drafted (waiting to fire).
- ✅ Org.html rename architecturally ratified.
- ✅ T4.3.61 Export/Import button pairing.

---

## Saturday 23 May 2026 morning — v5.11 mockup feature-complete (T4.3.53 → T4.3.60) + ACCESSIBILITY-SPEC + port path identified

**Headline.** Long single-day arc, ~12 patch versions, mockup went from "weekly calendar exists but rough" to feature-complete for the v5.11 → live port. Mr. Data delegation cycle (T4.3.53–.56) then Number One direct-edit chapter (T4.3.57–.60) when Codex hit rate limit at 09:35 BST. In parallel, `ACCESSIBILITY-SPEC.md` published with Captain's six architectural decisions ratified (including v6.0 Phase G identity-bound prefs via signed envelope). Calendar mockup IS the v5.11 spec at this point.

**What's on live (`irlid.co.uk`) right now (build pill T4.3.60 in mockup, v5.11.1 live dashboard):**

- v5.11.1 cosmetic cleanup merged (B1 — bugs F/G/H/I/C closed in live).
- Mockup at `OrgCheckinTest.html` shows the full v5.11 architectural target.
- `ACCESSIBILITY-SPEC.md`, `BOOTSTRAP §6` updated, `.nojekyll` in place.

**Three things before the live calendar port** (in order):

1. **B2 (`HANDOVER-AttendanceWindow-v5.11.2.md`)** — drafted Friday morning, **never fired**. Closes three live production bugs (A: yesterday's check-ins as "Today"; B: duplicate IN + linked-expected rows; D: phantom CHECKED OUT). Mr. Data run ~30-45min + `wrangler deploy` after merge (desktop required for Cloudflare auth). **Must land before port** so the calendar port starts from a clean Worker baseline.
2. **`CALENDAR-SPEC.md` finalisation** — 19 May draft is now stale. Needs update reflecting today's architecture: Expected list (Option C — `org_expected` stable IDs, `event.expected_ids` references), working hours + 0–3 breaks settings, past-event Edit-lock, capacity bar with colour grade, CSV round-trip with day_of_week + expected_names, room vocabulary auto-rename, view-aware Jump to Now, sticky tabs, list-view as default. ~60–90min of Number One time, TIER 3 markdown, fully autonomous.
3. **`HANDOVER-CalendarLivePort-*.md`** — substantial Mr. Data brief, port mockup behaviour into `OrgCheckin.html` + new Worker endpoints + D1 schema (`weekly_events` + `event_expected` + `rooms` + maybe `org_expected`). Multi-PR (Worker first, then frontend, then verification). Depends on (2) being final.

**NEW carry-forward — orphan-button sweep across mockup** (Captain flagged just before R&R):

- Sweep `OrgCheckinTest.html` for placeholder buttons with no action. Known instance: **`+ Invite staff`** button in Staff & Rooms tab (live's `OrgCheckin.html` already has the working Invite-staff QR flow as of v5.11.0 / 21 May; the mockup button is decorative).
- For each orphan button: decide between **wire-during-port** (live already has the feature; mockup button maps to existing implementation when ported) / **demo-modal** / **`(live — backed)` hint** / **hide**.
- Cross-check live `OrgCheckin.html` for feature parity — every button in the mockup must either map to an existing live feature OR be on the port queue. No orphan UI on either side.
- Verify each mockup button would receive correct expected inputs when wired during port (e.g. data attributes, IDs, JS function signatures).

**Carry-forward / housekeeping** (parallel, low-friction):

- **Token rotation** — Cloudflare API tokens `cfat_wIMFM4RI…` + `cfut_YZ11ouJO…` exposed in old screenshots since 17 May. `dash.cloudflare.com → My Profile → API Tokens → Revoke` each. ~60s of clicks.
- **`codex/v5.10.1-path-b` branch deletion** on origin — outstanding since 17 May.
- **Bug E** (bio-metric=0 in doorman flow) — architectural call needed, parked since Friday.
- **`PROTOCOL-Records-Broker.md`** — drafted but should promote to `PROTOCOL.md §X`.
- **Records & ID tab wiring** — explicit deferral; not blocking calendar port. Three buckets sized (easy: capture checkboxes + retention settings; medium: SFTP/S3/webhook; hard: OAuth connectors for Google Drive / OneDrive / Dropbox / Box). Recommended first connector is webhook (one-day work, zero OAuth machinery).

**v5.11 mockup → port mapping** (for the live-port brief drafter):

Today's mockup features that need live wiring:
- `weekly_events` D1 schema: `{id, name, room_id, day_of_week, start_time_local, duration_min, expected_ids[]}`
- `rooms` D1 schema: `{id, org_id, label, subname, capacity}`
- `event_expected` join (or JSON array on event row): event_id ↔ org_expected.id
- Calendar settings (currently `v511_mockup_calendar_settings_v1` localStorage) → `org_settings.json` D1 columns: `week_starts_on`, `working_hours_start`, `working_hours_end`, `breaks_count`, `break_N_start`, `break_N_end`, `room_vocabulary_singular`, `room_vocabulary_plural`
- 7 Worker endpoints (GET/POST/PUT/DELETE for events; CRUD for rooms; CSV import/export)
- Bearer auth on all (staff role minimum for read, manager for write)
- Frontend: list view + swim-lane view + day chips + sticky tabs + modal + Expected search/select + capacity bar + colour grades + auto-scroll-to-Now (view-aware) + Import/Export CSV
- Light + dark mode parity throughout

**Bug list from Friday morning scan — status update:**

- **A, B, D** — Worker bugs. B2 closes when fired. **Still open in live.**
- **C** — closed in B1 (merged, on live).
- **E** — parked.
- **F, G, H, I** — closed in B1 (merged, on live).
- **J–O** — see Friday entry below.
- **R** (vocab persistence) — closed via T4.3.57.1 Saved pulse + T4.3.58.2 global toast.
- **S, T, U, V, W + Feature Y** — closed in T4.3.57.
- **Orphan-button sweep** — NEW.

---

## Friday 22 May 2026 morning — Site scan (9 bugs), cleanup+port plan, autonomy framework, T4.3.50/T4.3.51 mockup wiring (Captain at work)

**Headline.** Captain opened the watch by sharing two screenshots of the live dashboard and noticing yesterday's check-ins still showing as "Today" data. Asked Number One to scan the site for other errors. Scan surfaced nine items grouped by severity (A–I). Captain then asked for a comprehensive cleanup-and-port plan — published as `memory/PLAN-CleanupAndPort-2026-05-22.md` (8 sections, 5 phases, ~5–7 day horizon). Captain then asked about long-term autonomy ("what can you do without me?") and Number One laid out the operating model. Captain's parting move was a 30-minute autonomy stretch: set up the framework, lock the starting marker, execute the safest tasks before he left for work.

**Starting commit at autonomy run:** `374271e` (matches origin/main, verified clean).

**Layered safety contract** (`memory/AUTONOMY-MARKER-2026-05-22.md`):

- **TIER 1 (strictest, no autonomous changes):** live IRLid.co.uk, Cloudflare Worker, D1, secrets, push.
- **TIER 2 (cautious, no autonomous edits):** `OrgCheckin.html`, `js/**` protocol code, all live-published HTML.
- **TIER 3 (free):** `OrgCheckinTest.html` mockup, `memory/**`, briefs at repo root, spec docs.

**What landed in the autonomy stretch:**

- **`HANDOVER-CosmeticCleanup-v5.11.1.md` (B1) drafted** — Mr. Data brief, closes live bugs F (prototype copy), G (sidebar v4 → v5), H ("Basic test identity" + defaults), I (light-mode badge contrast), C (`statInSub` math from `rows.length` → `stats.total`). 5 tasks, ~60 lines diff target, single PR. Ready to fire when Captain returns.
- **`HANDOVER-AttendanceWindow-v5.11.2.md` (B2) drafted** — Mr. Data brief, closes live bugs A (24h window labelled "Today"), B (duplicate IN + linked-expected rows), D (phantom CHECKED OUT). 3 tasks, ~50 lines diff target. Client computes local-midnight `since` and passes explicitly; Worker Expected dedupe aligned with `since` boundary. Single PR. Fire after B1 lands clean.
- **T4.3.50 — Sign-in & auth tab wired** (mockup). Mirrors T4.3.47 Org-tab pattern; type-aware capture (checkbox vs value). 4 fields persisted.
- **T4.3.51 — Tools & diagnostics tab wired** (mockup). Same pattern. 2 fields persisted (rest is read-only display).
- **Build pill** bumped T4.3.49 → T4.3.51 in `OrgCheckinTest.html`.

**Queued for Captain's review on return:**

1. Memory commit (4 files): `AUTONOMY-MARKER`, `PLAN-CleanupAndPort`, session log, this pending-work refresh.
2. Briefs commit (2 files): `HANDOVER-CosmeticCleanup-v5.11.1.md`, `HANDOVER-AttendanceWindow-v5.11.2.md`.
3. Mockup commit (1 file): `OrgCheckinTest.html` with T4.3.50 + T4.3.51 wiring.
4. Fire B1 at Mr. Data; once clean, fire B2.

**Verification Captain should do on return:**

- Open `OrgCheckinTest.html` Tab 5 (Sign-in & auth) → toggle fields → Save All → hard refresh → confirm fields restore.
- Same drill on Tab 6 (Tools & diagnostics) Debug expander.
- If anything's wrong, revert recipe in `AUTONOMY-MARKER §4` (local reset to `374271e` is the cleanest path since nothing has been pushed).

**Bug list from Friday morning scan (carry forward):**

- **A.** 24h window labelled "Today" on `/org/attendance` (Worker line 2643). → **B2 closes this.**
- **B.** Duplicate Spencer/Kerry IN + linked-expected rows. → **B2 closes this (same root as A).**
- **C.** "5 attendees seen" counts expected stubs. → **B1 closes this.**
- **D.** Phantom CHECKED OUT (yesterday's checkout still in window). → **B2 closes this.**
- **E.** BIO-METRIC VERIFIED always 0 in doorman flow. → **Architectural call needed (parked).**
- **F.** "Local-only test mode. No Cloudflare writes." prototype copy on Settings (`:3669`). → **B1 closes this.**
- **G.** Sidebar "IRLid Protocol v4" (`:3289`). → **B1 closes this.**
- **H.** "Basic test identity" heading + `test`/`demo-night` defaults (`:3673-3677`). → **B1 closes this.**
- **I.** Washed-out badges in light mode (`.role-mini`, `.expected-pill`, `.status-in/out`, `.checkout-signed-badge`). → **B1 closes this.**
- **J.** Hardware-backed signing key UX friction. Architectural; three resolution paths documented.
- **K.** 10 acceptance criteria from HANDOVER-StaffInviteQR.md pending hardware walk.
- **L.** Mockup crosshair Y-drift — close enough per Captain.
- **M.** Mockup background animation intermittent — needs repro.
- **N.** Cloudflare token rotation outstanding since 17 May.
- **O.** `codex/v5.10.1-path-b` branch deletion on origin.

**Carry forward to next session:**

- T4.3.52 Roles & staff tab wiring (mid-weight) — pattern proven by T4.3.50/51.
- T4.3.53 Event & calendar tab wiring (heaviest) — needs architectural calls.
- SETTINGS-REVAMP-SPEC.md refresh (spec written 19 May at T4.1.10; mockup now at T4.3.51).
- `HANDOVER-SettingsRevamp-Port-Phase1.md` (B3) drafting after spec refresh.
- Bug E architectural decision.
- Test matrix from `PLAN-CleanupAndPort-2026-05-22.md §4` — 10 categories pre-deploy.

---

## Thursday 21 May 2026 evening — Mr. Data PR #30 merged (v5.11.0 staff-invite QR), Bunny Fonts shipped, Text typography shipped, Deny shake fixed

**Headline.** Long single-day arc. Mockup work: T4.3.47a (deny shake + badge contrast), T4.3.48 (Text typography expansion, 7 chip rows), T4.3.49 (Bunny Fonts — 9 character fonts via fonts.bunny.net privacy mirror). Mr. Data dispatch: Brief A (`HANDOVER-StaffInviteQR.md`) updated to `v5.11.0`, prompt issued, Mr. Data shipped PR #30 in one session (379 insertions, 7 files: Worker endpoints + D1 migration + Settings UI + scan.html `I:` redeem flow + js/sign.js helpers). PR merged via GitHub web UI after initial draft-status confusion. Worker deployed (`9f2296ba-...`), D1 migration ran (5 queries / 11 rows), frontend live as `Build v5.11.0`.

**Open at watch close:**

- **`irlidPubFp is not defined` on Generate invite click** — **diagnosis confirmed via Incognito test.** Captain opened Incognito, signed in via QR, error was GONE — replaced by a different (polite) message: "Hardware-backed signing key required. Sign in with this device first." Function `irlidPubFp` loads cleanly when CDN cache is bypassed. Confirms regular-profile fix is: DevTools → Application → Clear site data → reload + QR sign-in again.
- **NEW architectural finding banked** — Mr. Data's `irlidV5Enrolled()` check in the invite-create flow is correct defence-in-depth (Bearer session alone shouldn't be sufficient to mint invites), but it surfaces real UX friction: Lead Admins typically operate the dashboard from a **desktop browser** while their hardware Passkey lives on their **phone** (because that's how QR sign-in works). The desktop has the Bearer session but no v5 enrolment of its own, so it can't sign invite payloads locally. **Three paths discussed:** (a) test workaround — use the 8 Pro to access `OrgCheckin.html` directly so the dashboard runs on the same device as the Passkey; (b) admin one-time fix — enrol the desktop browser with a v5 Passkey via `irlid.co.uk/settings.html`'s v5 enrolment panel from v5.0; (c) **future architectural fix worth a brief** — extend the invite flow so the dashboard sends the canonical payload to the phone via the QR-handshake mechanism the doorman flow already uses, phone signs, returns signature. Candidate `v5.11.1` or `v5.12.0` follow-up brief.
- **10 acceptance criteria from HANDOVER-StaffInviteQR.md** not yet hardware-verified. Captain to walk through using path (a) or (b) above when rested. Criterion 1 specifically queued.
- **"Local-only test mode. No Cloudflare writes." text** under Organisation settings on the live OrgCheckin.html — looks like prototype copy Mr. Data didn't trim. Flag for cleanup if it persists.

**Mockup wiring queue** (post-PR-verify):

- T4.3.50 — Auth tab wiring (was T4.3.49 before tab-renumber)
- T4.3.51 — Tools tab wiring
- T4.3.52 — Roles & staff tab wiring
- T4.3.53 — Event & calendar tab wiring (heaviest)
- T4.3.54 — Sparkles anchor option (deferred)

**Brief queue for Mr. Data after PR #30 verify clean:**

- Brief A1 (`HANDOVER-SettingsRoleGatingRefactor.md`, `v5.11.x`) — opens Settings to Manager-tier with per-item role gating
- Brief A2 (`HANDOVER-AdminActionAuditLog.md`, `v5.11.x`) — single canonical `org_admin_audit` table + retrofit logging

**Pattern banked:** when bash-diffing Mr. Data PRs against main, use **three-dot syntax** (`origin/main...origin/codex-branch`) not two-dot. Two-dot reads unrelated forward motion on main as fake deletions on the branch. (False alarm raised + retracted today; receipt for BOOTSTRAP §4.)

---

## Open bug — Stream anchor crosshair Y-drift between fullscreen and normal mode (logged 21 May late afternoon)

**Status:** known issue, not a blocker per Captain (*"it's close and most people would be able to eyeball it from there"*).

**Symptom:** With image-relative anchor offsets shipped in T4.3.43 + image natural aspect detection in T4.3.45, the X axis is now exact across fullscreen and normal modes, but Y still drifts a small amount.

**Suspected causes:**

- Image natural aspect detection may not be firing on the restore path in all cases (the probe Image() in `v511ApplyImageVariants` is async and could be racing the first render).
- The `--bg-image-size` CSS variable can be something other than the assumed `15%` if the user has used the Image scale slider; the math reads the var live but the multiplier from `scaleMultiplier()` may shift between modes.
- Possible vertical centring offset: the rendered image's vertical position in the stage may not be exactly `--bg-image-pos` when symmetry layers are active (which they are for the dragon test scene).

**Acceptance criteria for the eventual fix:** anchor crosshair should hold within ~1% of the same image-relative spot across mode switch on a 1:1 image. For non-square images, hold within image-aspect-correct tolerance.

**Workaround:** the per-mode sliders from T4.3.41 still read as legacy fallback — user can leave `streamOffsetX/Y_img` at 0 and use the old per-mode pairs to fine-tune each mode independently.

---

## Thursday 21 May 2026 watch pause — T4.3.37 audit cleanup, T4.3.38/39 layout pivot, T4.3.40 three new library effects (Lens flare / Heartbeat / Vignette flash) — paused mid-review

**The headline.** Captain commissioned this Number One this morning. Watch ran from morning through early afternoon. Four ships landed sequentially. Captain was interrupted by his mother mid-T4.3.40 review and called for a pause-and-update rather than push through frazzled. Clean dock for whoever picks up next (Captain in a couple of hours, or fresh Number One if needed).

**Build pill at pause:** `v5.10.2 + v5.11 mockup T4.3.40` (working tree, NOT YET PUSHED).

**Four ships (T4.3.37 + T4.3.38 + T4.3.39 pushed; T4.3.40 staged on working tree):**

- **T4.3.37 (PUSHED `4aef79d`)** — Audit-finding cleanup pass. Closed the `--cel-cycle-dur` inline-style leak banked from 19 May audit (extended `v511ClearCelClasses` with `sampleStage.style.removeProperty('--cel-cycle-dur')` so the last step's value doesn't leak across mode switches). Renamed four "Breath" comment references to "Stream (originally 'Breath')" — T4.3.32 rename had left them behind. Added explanatory comment on `V511_STREAM_DIR_ANGLES` documenting the glyph-led dir9 convention (cell `l` displays → glyph and emits particles RIGHT — the apparent inversion in the angle table isn't a bug).
- **T4.3.38 (PUSHED)** — Effect Settings panel auto-wrapping grid layout. `grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))` + `align-items: start`. dir9 + iris-wipe span 2 tracks; empty-state spans 1/-1. Foundation for what I expected to be a universal settings rollout next.
- **T4.3.39 (PUSHED)** — Captain's feedback: with only 2 settings (Background flash: Count + Direction), Direction floated alone in the middle of the row, looked worse than the old column. Reverted default to column; grid mode now opt-in via `.v511-cel-settings-body--grid` class added by `v511RenderSettingsForItem` when `schema.length >= V511_SETTINGS_GRID_THRESHOLD` (5). At time of revert only Stream qualified.
- **T4.3.40 (STAGED — code edits on working tree, NOT PUSHED)** — Three new library effects with full settings parity, each at 5 settings (= grid threshold) by design:
  - **Lens flare** (Light, icon `✶`, defaultDur 0.9s): Intensity / Position / Streak / Colour source / Easing. Bright burst + horizontal/diagonal/radial streak; warm/cool/cycle-palette colour; centre/image-anchor/4 corner positions via `--lens-pos`.
  - **Heartbeat** (Motion, icon `♥`, defaultDur 1.2s): Intensity / Rhythm / Falloff / Colour tint / Easing. Scale-pulse the QR with single/lub-dub/triple rhythm; falloff makes each beat smaller; warm/palette colour-tint overlay; intensity scales peak via `--hb-peak` CSS variable.
  - **Vignette flash** (Surface, icon `◐`, defaultDur 1.0s): Intensity / Pulses / Spread / Colour source / Easing. Dark or palette-tinted edge darkening pulsing inward; narrow/medium/wide spread via `--vig-inner`; 1/2/3 pulses via animation-iteration-count + duration division.

**Architectural pattern banked from this watch:**

- **Dynamic-grid-by-count.** I originally proposed per-effect "use grid" flags. Captain's revert directive made me wire it threshold-based instead. Any effect that gains a 5th setting in future T4.3.x work auto-promotes to grid layout without needing a separate switch. Single named constant (`V511_SETTINGS_GRID_THRESHOLD = 5`). Re-usable anywhere "this UI is too crowded once it grows past N" applies.

**First actions when watch resumes:**

1. **Push T4.3.40.** Code edits on working tree are unsaved. PowerShell:
   ```
   cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo" ; git pull ; git add OrgCheckinTest.html ; git commit -m "v5.11 mockup T4.3.40 — three new library effects: Lens flare (Light), Heartbeat (Motion), Vignette flash (Surface), each with 5-setting schemas triggering grid layout" ; git push
   ```
2. **Push memory close** (this update + STATE-OF-PLAY + session log). Captain's preference is separated code + memory commits:
   ```
   cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo" ; git add memory/ ; git commit -m "memory: Thursday 21 May watch pause — T4.3.37 audit cleanup + T4.3.38/39 layout pivot + T4.3.40 three new effects (Lens flare / Heartbeat / Vignette flash); session log + pending-work refresh" ; git push
   ```
3. **Verify T4.3.40 in browser.** Confirm the three new library buttons render in Light/Motion/Surface groups; click each into the sequence; confirm settings panel triggers grid mode (5 settings each); confirm Sample plays the effect; confirm each setting variant produces a visible change.
4. **Then T4.3.41+ per-effect deep-dive** — Captain pivoted mid-watch from bulk universal-settings rollout to "go into individual effects". Starts with **Sparkles** + **Confetti** (Captain flagged both need work; *"others are likely too"*). Universal settings (anchor offset, mirror, colour source, gravity, easing, hold-at-peak) fold into each effect's deep-dive where they make sense rather than landing as one bulk pass.

**Carryforward (still relevant from prior watches):**

- **Background animation intermittent bug** — still needs repro (carried from Tuesday + Wednesday).
- **Mr. Data port** of v5.11 mockup → live `OrgCheckin.html` per `SETTINGS-REVAMP-SPEC.md` Phase 1 — gated on Captain being satisfied with mockup visual.
- **Calendar implementation** per `CALENDAR-SPEC.md`.
- **PROTOCOL.md §X — Records Broker** ratification.
- **Cloudflare token rotation** — `cfat_wIMFM4RI…` + `cfut_YZ11ouJO…` still exposed (since 17 May). Captain has been deferring ("nothing worth stealing for a week"). Worth offering again.
- **`codex/v5.10.1-path-b` branch deletion on origin** — pure housekeeping.

---

## Wednesday 20 May 2026 watch close — Stream particle system born + sliders + crosshair + gravity + colour-source; Records & ID condensed (T4.3.29 → T4.3.36)

**The headline.** Captain came in Wednesday morning before work with a small ask (Records & ID using expanders) and a feature request ("add some effect to the cele anim... how would you have the dragons breath fire?"). Eight patches across the day delivered: tab condensation, a new particle effect built from scratch (twice, after the first version was wrong), settings-panel slider type, anchor offset with axisFlip mirroring, directional dissolve, anchor crosshair visualiser, gravity, colour-source, and a fullscreen-aware refresh. Watch closed at Number One's retirement with all eight patches verified on origin/main and a screenshot-demonstrated dragon scene that breathes fire properly.

**Build pill at close:** `v5.10.2 + v5.11 mockup T4.3.36`.

**What landed (eight patches, in order):**

- **T4.3.29** — Records & ID tab condensed. Storage destination / What to capture / Privacy & retention / Why this matters all wrapped in closed-by-default `<details>` expanders. Top banner ("IRLid doesn't store these records") + Status row stay visible at top — daily-touched surface preserved, set-once configuration folds away. Save All Settings button kept at bottom. Cuts the panel from ~15 visible rows to ~3 + 4 closed expanders.
- **T4.3.30** — Initial Breath particle effect (radial-gradient + scaleX animation; Captain's screenshot proved this was wrong) + **Flame's image-anchor now honours symmetry**. Previously Flame anchored to `--bg-image-pos` only; now it reads `bg-symmetry-{horizontal|vertical|quad}` classes and `--sym-pos-1..4` to paint a separate gradient at each visible image instance. Multi-dragon scenes get flames from all positions.
- **T4.3.31** — **Breath rebuilt as JS-injected DOM particles.** Captain wanted real particles like confetti but cone-shaped, randomised, anchored to origin. `v511FireStreamParticles()` creates N actual `<div>` particles per anchor, each with: random size 3-12px (skewed small via `Math.pow(roll, 1.8)`), random colour from 8-stop hot fire palette, random angle within a 60° cone (or 360° radial for `c`), random distance 35-105% of stage half-dimension, random duration 70-130% of item duration. Three-stage keyframe animation (emerge → drift → fade). Self-cleanup via setTimeout. Dir9 grid drives direction. Symmetry-aware multi-anchor emission with axisFlip.
- **T4.3.32** — **Breath → Stream rename + sliders + mirror + z-order.** Effect renamed everywhere ("don't think most people would know what breath was"). New `slider` setting type added to `v511RenderSettingsForItem` with input listener that updates `item.settings[key]` + label live + saves debounced. Stream gets particle-count slider (5-120, default 30), stream-width slider (5-360°, default 60°), mirror-on-symmetry chip (default `on`). Mirror flips axisFlip.x for right dragon under horizontal symmetry so its fire blows LEFT toward centre when left dragon's fire blows RIGHT. **New per-row z-order toggle** (▲/▼ button between play-with-previous + remove): default `▲` above QR/image, pressed `▼` below — stage gets `cel-z-below` class which drops `.v511-cel-fx-layer` + `.v511-stream-particle` to `z-index: 2` (between bg image at z-1 and content at z-3). Works for Stream + Flame + Confetti since they all use the fx-layer.
- **T4.3.33** — **Anchor offset sliders + directional QR dissolve.** Stream got `streamOffsetX` / `streamOffsetY` sliders (±40%, axisFlip-aware so symmetric mirroring keeps per-side nudge correct). New QR motion variant `dissolve` (legacy `dissolve horz`/`dissolve vert` kept for back-compat). Uses dir9 grid via `data-cel-dir` mapped to `--dissolve-angle` CSS var; `linear-gradient(angle, transparent X%, black Y%)` mask animates X from -15% → 40% → 95% so the QR burns from one edge across to the opposite. Centre `c` uses radial-gradient for burn-out from middle.
- **T4.3.34** — **Play sound on/off + crosshair visualiser + dissolve jitter.** Per-mode `v511PaPlaySound` checkbox in Outcome sound row (added to `PER_MODE_FIELD_IDS`); `playOutcomeTone` checks live checkbox first then stored mode state, suppresses both WAV and synth tone fallback when off. Anchor crosshairs (`v511UpdateAnchorCrosshairs`) — yellow pulsing plus-mark + centre dot that paints at each computed Stream anchor position when a Stream row is selected; updates live on selection / slider input / chip click / symmetry chip change. Dissolve mask switched to 3-layer composite with `mask-composite: add` and ±12° angle jitter — burn line becomes union of three slightly-offset progressions, looks more like fire than a clean wipe.
- **T4.3.35** — **Crosshair auto-contrast + gravity + cycle-palette colour source.** Crosshair switched from `#ffd84a` + box-shadow to `#ffffff` + `mix-blend-mode: difference` — auto-inverts whatever's beneath. New `gravity` chip (off/on) on Stream + Confetti. Stream gravity = JS adds downward dy-bias per-particle at the 15/70/100% keyframe stops, ~45% of stage longest dimension by end, NOT mirrored by axisFlip since gravity always pulls toward screen-bottom. Confetti gravity = CSS animation-timing-function swap to `cubic-bezier(0.42, 0, 0.58, 1)` for acceleration feel (real per-particle gravity not possible with background-position scroll). New `colourSource` chip (`fire | cycle palette`) on Stream + Flame: `fire` keeps the 8-stop hot palette; `cycle palette` reads `--cel-pal-1..7` via `getComputedStyle` so the user's celebration palette swatches drive the particle colours. Palette-driven gradient variants for all 5 Flame configurations (centre, image-anchor, horizontal, vertical, quad symmetric).
- **T4.3.36** — **Fullscreenchange refresh.** `document.addEventListener('fullscreenchange', ...)` calls `applyImagePositioning()` + `renderPreviewQr()` + `v511UpdateAnchorCrosshairs()` after a 2-rAF delay. Addresses the discovery that normal-view stage is `max-height: 48vh` clamped (actual aspect diverges from `--preview-aspect` which is set from `window.screen`), while fullscreen takes screen aspect exactly — image height-as-%-of-stage shifts between modes because `background-size: 15% auto` pins width but lets height ride natural aspect. Crosshair tracks current state in either mode; user may need to re-tune offset per mode if mouth-position differs.

**Architectural commitments banked from this watch:**

- **Slider-as-handing-control-back.** When Captain reported something was off (anchor under chin, particles too uniform, dissolve too linear), the response was rarely "fix it for him" — almost always "add a setting that lets him fix it himself." Every default value picked is a starting position the user can override. The celebration system after T4.3.36 is mostly other-people-shaped: defaults are reasonable; controls are total.
- **Settings hooks pattern (banked from T4.3.28, reinforced this watch):** CSS classes (`cel-int-strong`, `cel-bounce-eff-loop`, `cel-flame-anchor-image`, `cel-stream-anchor-image`, `cel-z-below`), `data-*` attributes (`data-cel-text-pos`, `data-cel-easing`, `data-cel-colour-source`, `data-cel-glow-sweep`, `data-cel-iris-dir`, `data-cel-glitch-kind`, `data-cel-zoom`, `data-cel-gravity`), CSS variables (`--cel-cycle-dur`, `--bg-image-pos`, `--cel-pal-1..7`, `--dissolve-angle`, `--dissolve-jitter`). Single translator: `v511ApplyItemSettings`. Add to apply function + add to `V511_SETTING_ATTRS` / `V511_SETTING_CLASSES` for cleanup + add corresponding CSS rule.
- **`mix-blend-mode: difference` is the right tool for contrast-with-arbitrary-backdrop UI.** White ink + difference inverts the pixel underneath. Use for crosshairs, cursors, selection markers — anything that must remain visible against any backdrop.
- **JS-injected particles are the right answer for randomised emissions.** CSS-only "random" doesn't exist. The pattern: append N `<div>` elements at fire-time with CSS-variable-driven keyframe targets, self-cleanup via setTimeout after `durMs × 1.6 + 200`. Used for Stream; same pattern would work for any future genuine particle effect.
- **Multi-layer mask-image with `mask-composite: add` gives "jagged" without SVG turbulence.** Three slightly-offset gradients combined into one mask creates an irregular union edge. Used for dissolve; could be reused for any other "ragged edge" effect.

**Open carryforward (still relevant from prior watches, plus new):**

- **Per-mode anchor offsets** (new, banked from T4.3.36) — separate offset-X/Y values for normal vs fullscreen modes, since `max-height: 48vh` clamping causes stage aspect ratios to diverge between the two. Bigger schema change — 4 sliders instead of 2 — but proper for designer-test environment. Live deliverable runs in single mode anyway so not strictly required.
- **Background animation intermittent bug** (carried from Tuesday) — Captain reported but couldn't pin to a reliable trigger. Needs repro: screenshot the Background expander state + which mode + what's in the sequence next time it fires.
- **Mr. Data port** of v5.11 mockup → live `OrgCheckin.html` per `SETTINGS-REVAMP-SPEC.md` Phase 1. The genuinely-next big move. Spec is drafted (11 sections, 4-phase rollout). Gate is Captain being satisfied with mockup visual.
- **Calendar implementation** per `CALENDAR-SPEC.md` — multi-room + per-event Expected + swim-lane + CSV pipeline + 9 new Worker endpoints + `events` + `event_expected` D1 schema.
- **`PROTOCOL.md §X — Records Broker`** ratification + spec promotion + impl design.
- **Cloudflare token rotation** — `cfat_wIMFM4RI…` + `cfut_YZ11ouJO…` still exposed (since 17 May). Captain has been deferring ("nothing worth stealing for a week"). Worth offering again.
- **`codex/v5.10.1-path-b` branch deletion on origin** — pure housekeeping.

---

## Tuesday 19 May 2026 evening watch close — Celebration animation sweep shipped end-to-end (T4.3.3 → T4.3.28); chimp brain approves

**The headline.** 26 surgical patches across one long evening watch, every chip and grid in every effect's settings pane now visibly responds. Captain explicitly asked for surgical-patch discipline at the start ("smaller parts, so you're not redoing the entire page each time"); the rhythm held — each T4.3.x bump touched one isolated concern, Captain tested before next began, build pill bumped per ship. The dragon-themed test setup ("Welcome Everyone to this Happy Place!" + symmetric Hawthorne Devon Grey-primed dragons + blue palette) demonstrated the full theme stack functioning as a real configurable scene mid-watch.

**Build pill at close:** `v5.10.2 + v5.11 mockup T4.3.28`.

**What landed (26 patches in order):**

- **T4.3.3-5** — Background cycle direction grid save round-trip. Capture `aria-pressed` + radial state in `v511CaptureState`; restore block extended in `v511LoadState` step 5b reapplies `bg-dir-*` stage class. Generic click-save handler extended to catch `.v511-cycle-dir-cell` (was only catching `.v511-chip` and `.v511-bg-pos-cell`). Chip restore extended to reapply `bg-bounce-*` / `bg-trans-*` classes from matched chip's `data-bounce`/`data-trans`.
- **T4.3.6** — Custom welcome message → text overlay piping. Removed four hardcoded `::before { content: '...' }` CSS rules. Apply function reads `(document.getElementById('v511PaWelcome') || {}).value || (ms.v511PaWelcome || 'Welcome back!')` and composes per template chip.
- **T4.3.7** — Stable-ID rebuild fix. `v511ReadSequenceFromDom` was rebuilding items fresh on every 300ms debounced save and silently dropping `item.settings` (every chip selection vanished after typing in any field). Fix: stable `data-seq-id` per row, matched back via byId map to preserve `item.settings`. Also removed `!item.settings` early return in apply function.
- **T4.3.8** — Outer-glow keyframe rebalance for visibility (20%-80% hold).
- **T4.3.9** — Shake axis variants (vertical / both).
- **T4.3.10** — Outer-glow intensity (3 variants louder than v3).
- **T4.3.11** — Glow halo sweep + sweep keyframes (inward / rotate variants).
- **T4.3.12** — Pulse intensity (3 ring radii: 10/22/40px).
- **T4.3.13** — Density variants for confetti/sparkles/particles via `data-cel-density` selectors.
- **T4.3.14** — Deny default sequence trimmed `[Shake, Delay, QR-disappear]` → `[QR-disappear]` per Captain's "remove auto shake" directive.
- **T4.3.15** — Real QR dissolve via `mask-image: repeating-linear-gradient` stripe mask.
- **T4.3.16** — Iris wipe direction variants (close-then-open / open-then-close / close only / open only).
- **T4.3.17** — Glitch kind variants (hue / displace separation).
- **T4.3.18** — Glow centre pulse on/off — halo-only mode keyframes (`v511CelGlowFlat[Subtle|Strong]`).
- **T4.3.19** — Ripple thickness (border-width 2/9/16px).
- **T4.3.20** — **Count loop in `v511PlaySequence`** — cam-flash / strobe / ripple / bg now fire N times within item duration. Inner setTimeout loop with double-rAF gap between sub-fires. Single-fire path unchanged.
- **T4.3.21** — **Click-in-fullscreen plays Sample**. Dblclick-debounced single-click handler; only fires when `document.fullscreenElement === sampleStage`.
- **T4.3.22** — **"Play with previous" overlap toggle** on every sequence row. Small `+` button between duration and remove. CSS `:first-child` hides on row 0 (no previous). `withPrev` field round-trips via `v511ReadSequenceFromDom`. Playback architecture extended with `chainNextNow()` helper that bypasses cleanup setTimeout when next step is marked withPrev. Compromise: when two steps overlap, latter one's settings win for shared CSS vars (`--cel-cycle-dur`) and singleton classes (`cel-int-*`); accepted as design trade-off pending real-use feedback.
- **T4.3.23** — Scale-punch zoom direction (in / out) + intensity (6 keyframes).
- **T4.3.24-25** — QR dissolve hold-state genuinely gone. Opacity ramps to 0 at peak (was 0.2 with faint stripe trace visible); gone-window widened 35%-80% of cycle (was 40-70%); mask tightened at peak (1px visible / 7px transparent, was 2/5).
- **T4.3.26** — **WAV save round-trip + Reset button + mode-aware filename label**. Bug: `uploadedWavs[mode]` + `uploadedWavNames[mode]` were globals never captured by `v511CaptureState`. Fix: added to save state + restored in `v511LoadState` step 6.9. Upload handler now fires `v511SaveDebounced()` directly. New Reset button clears WAV per active mode; falls back to synthesised oscillator tone via `playOutcomeTone`. Tiered quota fallback: strip imageData first → WAVs next → minimal save.
- **T4.3.27** — **Bounce vs loop wiring**. `cel-bounce-eff-loop` class triggers `animation-iteration-count: 2` + `animation-duration: calc(var(--cel-cycle-dur) / 2)`. Five effects: outer-glow / spotlight / pulse / qr / scale-punch.
- **T4.3.28** — **Whole celebration sweep complete in one drop**. Pulse colour source (cycle walks pal-1/2/3). Spotlight intensity. QR-disappear easing (linear/snap timing-function) + intensity. Flame intensity. Sparkles/Particles intensity. Confetti 9-direction grid complete (added tl/tr/c). Confetti single colour source. Sparkles 9-direction grid complete (added 6 directional drift variants). Particles 9-direction grid complete (8 directional translate-while-scale keyframes). Ripple cycle-palette colour source (animated border-color through palette).

**Architectural commitments banked from this watch:**

- **Surgical-patch discipline pays.** Captain steered the cadence; each bump caught its own regressions before the next began. T4.3.7 in particular (stable-ID rebuild fix) explained why "many buttons don't seem to do anything" — settings were saving for 300ms then being silently obliterated. That bug would have been invisible in a sweeping refactor.
- **Settings hooks pattern**: CSS classes (`cel-int-*`, `cel-bounce-eff-*`), `data-*` attributes (`data-cel-text-pos`, `data-cel-easing`, `data-cel-colour-source` etc.), and CSS variables (`--cel-cycle-dur`, `--bg-image-pos`). Apply function `v511ApplyItemSettings` is the single translator from `item.settings` → stage state.
- **WAV + image quota fallback hierarchy**: imageData first to strip, WAVs second, minimal save last. Stops the entire save from failing when storage chokes on heavy data URLs.

**Known bug to chase next watch (intermittent — needs repro):**

- **Background animation doesn't always play.** Captain reported during the evening watch but couldn't pin it to a reliable trigger. When it next happens, screenshot the Background expander state + which mode + what's in the sequence so I can chase it.

## Carryforward (still pending from earlier watches)

- **Cloudflare token rotation** (Captain deferred again; "nothing worth stealing for a week"). Tokens still active: `cfut_YZ11ouJO...` (user-scoped) + `cfat_wIMFM4RI...` (account-scoped). Use **Roll** not Delete.
- **`codex/v5.10.1-path-b` branch deletion on origin** — pure housekeeping.
- **Event & Calendar tab light-mode polish** — Captain noted washed-out elements ("not for now").
- **Mr. Data port** of v5.11 mockup → live `OrgCheckin.html` per `SETTINGS-REVAMP-SPEC.md` Phase 1 — the big next move once Captain is happy with the mockup's visual completeness.

---

## Tuesday 19 May 2026 morning watch close — Celebration animation rebuilt as library + sequence + settings panel; called for R&R with known gaps

**The headline.** Long Tuesday morning watch spanning T4.1.10 → T4.3.2. After the bath-watch landed three spec drafts, Captain steered the celebration animation through its biggest architectural shift since Tier 1: from a 6-checkbox grid into a **library + sequence + per-effect settings** model. 20 effects across 5 expandable groups, drag-from-library workflow, per-item duration, ⏱ Delay rows, sequence playback via async chained setTimeouts. Third pane added below Library + Sequence for per-effect settings (chip groups + 9-cell direction grids). Captain reported "very very good" structurally, then identified gaps that didn't get fully fixed before he called for rest ("didn't have the best sleep last night and am fuzzy today"). Watch closed cleanly with an audit + memory-update request.

**Build pill at close:** `v5.10.2 + v5.11 mockup T4.3.2`.

**Tier progression banked:**

- **T4.1.10**: Pattern + Image overlays nested INSIDE Background body; QR customization nested INSIDE Post-Accept body via JS reparenting (`mountQrInsidePostAccept()` — HTML adjacent, DOM reparented at init).
- **T4.1.11**: Background closed by default; Image overlay moved above Pattern overlay; 9-position image grid shrunk to 56px cells (matches cycle-direction grid); Bounce → chip group; QR customization moved below Outcome sound; "Post" sub-expander wraps remaining post-accept fields; top-level expander renamed Post-Accept → Accept/Review/Deny.
- **T4.1.12**: Celebration palette per-mode with mode-tinted defaults (Allow greens / Review ambers / Deny reds); `snapshotMode`/`loadMode` extended to track `celPalette` array per mode.
- **T4.1.13**: Sample button hotfix — dropped dead `.v511-subpanel[data-v511-subpanel="qr"]` selector left from T4.1.9 sub-tab retirement; global `.v511-celeb-effect` query.
- **T4.2**: Celebration rebuilt as library (left) + sequence (right) two-pane builder. 20 effects across 5 groups: Light (5) / Motion (7) / Particles (5) / Surface (3) / Timing (1). ⏱ Delay row for gaps. Sample button plays sequence top-to-bottom via async `v511PlaySequence`. Per-mode sequences. 14 new effect CSS keyframes added. Old global cycle duration slider retired.
- **T4.3**: Effect settings pane (third frame). Click sequence row → blue selected outline → settings render below with chip groups + 9-cell direction grid. Per-effect schemas (Intensity / Bounce / Rotation / Zoom / Variant / Count / Thickness / Density). Settings persist into `item.settings`.
- **T4.3.1**: Sequence playback hotfix — double `requestAnimationFrame` between class remove/add so browser PAINTS the removal before the next mutation (CSS keyframes never restarted in same tick). Also renamed `data-effect="cel-pattern"` → `pattern` + migration.
- **T4.3.2**: Settings → playback wiring (`v511ApplyItemSettings`). Translates `item.settings` into stage data-attrs / classes / CSS variables BEFORE the effect class is applied. Visual fixes: text overlay z-index bumped to 6 (was hidden behind caption), text size + weight + shadow strengthened; Pattern flash moved from `::after` to `cel-fx-layer` (no longer clobbers image); Confetti changed to full-area cascade with direction setting; Sparkles got direction setting; Flame anchor-to-image-position setting.

**Architectural commitments banked from this watch:**

- **Sample plays sequences via timeline model, not parallel layer model.** Effects fire one after another by default. ⏱ Delay rows insert pauses. To overlap effects, future work needs an explicit "Layer with previous" toggle per item.
- **Settings panel uses three stage hooks for visual change**: CSS classes (`cel-int-strong` etc.), `data-*` attributes (`data-cel-text-pos` etc.), CSS variables (`--bg-image-pos` for flame). Each new setting needs corresponding CSS to be visually distinct.
- **Library has 20 effects + ⏱ Delay**. Five expandable groups (Light / Motion / Particles / Surface / Timing). Strobe carries `⚠` warning chip for photosensitive concern.

## What's still gappy — for next watch

Captain identified these in his testing before calling for rest. Some had been queued as "known limitations" since T4.3, others surfaced during T4.3.2 testing.

**Functional bugs**:
- **Custom welcome message** from Post-Accept textarea isn't piped to text overlay. Text overlay templates currently hardcoded strings — they should read `modeStates[currentMode].v511PaWelcome` value.
- **Background settings sometimes "don't save" again** per Captain. Possibly load-order or mode-switch interaction. Investigate: palette/direction grid/bounce/transition round-trip on refresh.
- **Glow halo "doesn't rotate"** — Sweep setting (outward/inward/rotate) not wired to CSS variation. Need a `[data-glow-sweep="rotate"]` rule with a conic-gradient or rotating filter.
- **Outer edge glow visibility** — keyframe goes transparent at 0% and 100%, brief peak at 50%. Extend the visible window (e.g. opacity 0 → 1 ramp in first 20%, hold 60%, ramp out last 20%).

**Settings that save but don't visually do anything yet** (settings panel renders chips but CSS doesn't respond):
- `intensity` (subtle/medium/strong) — class added but no per-effect CSS scaling
- `bounce` per-effect — class added but no per-effect CSS variation
- `count` (for cam-flash/strobe/ripple) — attr set but no CSS repeats
- `thickness` (for glow/ripple/outer-glow) — attr set but no CSS scaling
- `density` (for confetti/sparkles/particles) — attr set but no CSS scaling
- `irisDir` (close-then-open etc.) — attr set but no CSS variation
- `glitchKind` (hue/displace/both) — attr set but no CSS variation
- `axis` (shake) — attr set but no CSS variation

**Already wired (working)**: `template`/`position`/`size` (text), `pattern` style (cel-pattern), `variant` (qr motion), `direction9` (confetti/sparkles), `flameAnchor` (image-anchor).

**Optimization opportunities banked** (from this watch's end-of-watch audit):
- `v511PlaySequence`: `--cel-cycle-dur` `style.setProperty` leaks across modes; clear at end-of-sequence.
- 20ms buffer between effect-class removal and next-step rAF could be tightened, or use `animationend` event instead.
- Settings panel: clicking same chip again doesn't deselect; could add "deselect-to-default" UX.
- Sequence re-render on mode switch does full `innerHTML` clear + DOM rebuild; could diff for performance.
- Settings click saves are debounced 300ms; immediate save on chip click might be UX-nicer.

**Suggested order of attack for next watch:**
1. Fix custom welcome message → text overlay piping (quick win, restores Captain's expectation).
2. Investigate background settings save bug — repro on refresh, check load order.
3. Sweep remaining settings to CSS in one pass (intensity / count / thickness / density / axis / iris / glitch / glow-sweep). Each is a small CSS block.
4. Outer edge glow keyframe rebalance for visibility.
5. Optional: optimization pass per audit.

## Carryforward (still pending from earlier watches)

- **Cloudflare token rotation** (Captain deferred again; "nothing worth stealing for a week"). Tokens still active: `cfut_YZ11ouJO...` (user-scoped) + `cfat_wIMFM4RI...` (account-scoped). Use **Roll** not Delete.
- **`codex/v5.10.1-path-b` branch deletion on origin** — pure housekeeping.
- **Event & Calendar tab light-mode polish** — Captain noted washed-out elements ("not for now").
- **Mr. Data port** of v5.11 mockup → live `OrgCheckin.html` per `SETTINGS-REVAMP-SPEC.md` Phase 1, once Captain locks the visual theming design.

---

## Tuesday 19 May 2026 bath-watch — Three spec docs drafted while Captain showered

**The headline.** Captain handed Number One the conn for a bath stretch with a clear three-spec ask: SETTINGS-REVAMP-SPEC.md, CALENDAR-SPEC.md, PROTOCOL §X-Records-Broker. All three landed before Captain was out. Plus the morning's UI restructure (T4.1.10): Pattern + Image overlays nest INSIDE Background body; QR customization nests INSIDE Post-Accept body (HTML adjacent for source readability, DOM reparented via JS at init).

**Specs banked (all in live repo root, ready for Captain review):**
- `SETTINGS-REVAMP-SPEC.md` — full Mr. Data implementation brief for porting OrgCheckinTest.html v5.11 mockup → OrgCheckin.html. 7 tabs spec'd, theme JSON schema documented (`schema_version: 5.11`), Worker validation rules listed, Phase 1/2/3/4 roadmap, sign-off checklist for Mr. Data.
- `CALENDAR-SPEC.md` — `events` + `event_expected` D1 schema, 9 new Worker endpoints, List + Swim-lane views, per-event drill-down accordion, CSV import/export with column conventions, capacity over-cap behaviour, recurrence banked for v6+.
- `PROTOCOL-Records-Broker.md` — broker-not-store architectural commitment formalised as a candidate PROTOCOL.md chapter. `org_storage_connectors` + `records_references` schema, 7 new Worker endpoints, trust model (org/attendee/IRLid mutual trust matrix), re-enrolment pattern aligning with immutable-receipts principle.

**Mockup build:** `v5.10.2 + v5.11 mockup T4.1.10`. Nesting structure now matches Captain's call. Awaiting his test pass when out of the bath.

**Status of the queue from the morning report:**
- ✓ SETTINGS-REVAMP-SPEC.md — drafted.
- ✓ CALENDAR-SPEC.md — drafted.
- ✓ PROTOCOL §X-Records-Broker — drafted (as separate file pending Captain ratification + chapter-number assignment).
- 📋 Cloudflare token rotation — still parked.
- 📋 `codex/v5.10.1-path-b` branch deletion on origin — housekeeping.
- 📋 Event & Calendar tab light-mode polish — still queued.

---

## Monday 18 May 2026 morning-to-midday — Visual theming deeply wired through Tier 3.6

**The headline.** Captain came in 8ish, verified yesterday's pushes landed, called for the visuals deep-dive that was queued. From there we iterated tier-by-tier through the entire morning into midday on the Visual theming tab of OrgCheckinTest.html. The tab went from a static visual prototype to a genuinely interactive design environment where Captain can click controls and FEEL the changes propagate.

**Tier progression banked:**

- **Tier 1** (live wiring): Light/dark toggle, Background animation Mode + Pattern + Cycle duration applying live to preview, Sample button reads checked celebration effects + plays Web-Audio outcome tones, Save All flash-confirm. Outcome sound row migrated from QR sub-tab to top of Post-Accept Behaviour expander; expander title is dynamic per active mode (Post-Accept / Post-Review / Post-Deny).
- **Tier 2** (per-mode state + image upload + multi-effect): modeStates object stores 16 fields per Allow/Review/Deny; switching active mode snapshots OLD and loads NEW. Image upload via FileReader. cel-bg + cel-pattern animations added so all 6 effects compose.
- **Tier 2.5** (selectable colours + expandable effects + drag layers): Palette swatches → real `<input type="color">`. Celebration effects restructured as expandable cards with sub-settings (intensity / sweep / motion / ring thickness / centre pulse / saturation / pattern picker / template / position / size). Drag-to-reorder via HTML5 DnD with ⠿ handles.
- **Light mode**: comprehensive `:root[data-theme="light"]` override block (~70 rules) for all v511-* surfaces. Captain confirmed working ("Light mode done — maybe some things on E&C a little washed out, but not for now").
- **Tier 2.6** (palette remove + real QR placeholder + Image settings UI): Hover-visible × button on each swatch (min 1 enforced). Real QR.png placeholder; double-click stage → fullscreen via Fullscreen API. Full Image settings UI restored (position grid, symmetry chips, anchor chips, alpha cycle toggle).
- **Tier 3** (real QR + image positioning + alpha cycle + layer numbers): QR.png swapped for QRCode.js-generated real QR (foreground colour input drives re-render). 9-cell position grid maps to background-position. Position/Tile/Cover sets size+repeat. Alpha cycle toggle animates opacity. Layer-number badges (1..N) on effect cards update on drag.
- **Tier 3.5** (aspect-match + position grid sizing + QR render fix + WAV upload): Preview aspect ratio dynamically matches window.screen so fullscreen + non-fullscreen are SAME shape. QR generation bumped to 400x400 for crisp scaling. Position grid cells bigger + grid width 320px aligned with Symmetry chip row beneath. Replace WAV button wired: hidden file input → FileReader → per-mode data URL storage → Sample fires uploaded audio if available, falls back to Web Audio synth tone.
- **Tier 3.6** (last push): Off mode uses palette[1] as flat bg (`bg-mode-off { background: var(--bg-pal-1) !important }`). Anchor offset bumped 11→16px. Image scale slider 10-150% in Image settings. Celebration palette flows into Pulse + Pattern + Text + Glow keyframes (was only Glow). Symmetry chips apply multi-position background layouts (Horizontal = left+right, Vertical = top+bottom, Quad = 4 corners — not true mirror; design-in note). 7 QR motion variants: Wobble (default) / Zoom in / Zoom out / Rotate CW / Rotate CCW / Dissolve horz / Dissolve vert, each with its own keyframe.

**Architectural commitment banked.** Captain's question early in the watch: *"would like to test all functionality of visuals (but you shouldn't need the workers involved if the QR is just a placeholder, correct?)"*. **Confirmed: visuals testing needs NO Worker involvement.** QR rendering is client-side; theme/palette/animations/image bg are all DOM+CSS+JS. The Worker only enters the picture for:
- `POST /org/settings` (save configured settings to D1)
- `GET /org/settings` (load on next session)
- Real check-in flow (QR scan endpoint, attendance write, celebration trigger from D1 state)

Clean separation. The mockup → real-implementation path is now clear: prototype visuals fully → spec → ship to Mr. Data → wire to Worker last.

**What's still genuinely "design-in" (Tier 4+ work):**

- **True symmetry mirror** (CSS can't flip a `background-image` per-layer; needs canvas pre-processing or `<img>` element overlays with `transform: scaleX(-1)`).
- **localStorage persistence** of mockup state across page refreshes (currently in-memory only).
- **Per-effect celebration cycle duration** (currently shared via --cel-cycle-dur).
- **Background celebration colour cycling** (cel-bg currently uses filter hue-rotate, not the celebration palette directly).
- **Drag order ACTUALLY influencing z-stacking on Sample fire** (DOM order is read, layer numbers update, but CSS rule cascade still determines visual stacking).

**Outstanding carryforward (still pending from earlier watches):**

- **Cloudflare token rotation** (Captain deferred yesterday + this morning; "doubt I'll be hacked before the end of the week, nothing worth stealing"). When done: `dash.cloudflare.com → My Profile → API Tokens` for `cfut_YZ11ouJO...` (Edit Cloudflare Workers user-scoped) and `dash.cloudflare.com/13f4ab46f9371225c22b41fd7a6ae0cf/api-tokens` for `cfat_wIMFM4RI...` (wrangler-deploy-irlid account-scoped). Use **Roll** not Delete (preserves the token config; just rotates the value).
- **`codex/v5.10.1-path-b` branch deletion on origin** (pure housekeeping).
- **`SETTINGS-REVAMP-SPEC.md`** — capture v5.11 mockup shape as Mr. Data implementation brief once Captain locks the design.
- **`CALENDAR-SPEC.md`** — multi-room + per-event Expected list + drill-down + swim-lane forward design.
- **`PROTOCOL.md §X-Records-Broker`** — formalise the "IRLid doesn't store identity documents" commitment.

**Where this goes next:**

1. **Captain's R&R window** — earned. Visual theming is now a genuinely usable design environment; he can come back and explore further or move on.
2. **Possible Tier 4** — true symmetry mirror, localStorage persistence, per-effect duration, cel-bg palette cycling, drag-order z-stacking. Each is a half-watch's work.
3. **Other Settings tabs** — Captain noted Event & Calendar light mode is "a little washed out, but not for now." Could revisit.
4. **Move from mockup → spec → implementation** when Captain is ready. `SETTINGS-REVAMP-SPEC.md` is the next gating document.

---

## Sunday 17 May 2026 late evening — `v5.11` Settings revamp mockup iterated in OrgCheckinTest sandbox

**The headline.** After global sign-out shipped end-to-end (see afternoon section below), Captain pivoted to the Settings UX revamp using the test fork as a clickable design playground. Long iterative-mockup session in `OrgCheckinTest.html` only — `OrgCheckin.html` (live), the Worker, and D1 are untouched. Build pill on the test fork: `v5.10.2 + v5.11 mockup`. All form clicks in the mockup are no-ops by design; the live save/load behaviour is preserved underneath inside a hidden `display:none` shell so cycle smoke-tests still work on the test fork.

**Current mockup state (clickable on `irlid.co.uk/OrgCheckinTest.html` → Settings):**

- **7 tabs** with emoji icons: Organisation (🏢) / Event & calendar (📅) / Roles & staff (👥) / Visual theming (🎨) / Sign-in & auth (🔐) / Tools & diagnostics (🔧) / Records & ID (📋). Proper ARIA tab pattern (`role="tablist"` / `role="tab"` / `role="tabpanel"` / aria-selected / aria-controls / keyboard arrow nav).
- **24-hour calendar** with brightness banding (working hours 09:00-17:59 lighter, off-hours dimmer) and auto-scroll to 09:00 on tab activation.
- **Per-event drill-down** (inline accordion, single-open). Click Edit on any event row → expands beneath with Event details + Expected list (sample names, status indicators) + 4 action buttons (Add person / Invite QR / Import CSV / Export CSV — the data-shape symmetry Captain spotted: same CSV shape goes in for planning and comes out for attendance, with state columns appended on export).
- **Multi-room** with three seeded rooms (Studio 1 cap 30, Studio 2 cap 20, Studio 3 cap 15 — kids room). Rooms / spaces section lives in Roles & Staff tab (Captain's call — staff and rooms are the people+place layer). Calendar tab has toolbar (List/Swim-lane view toggle + Room filter dropdown). Inline room tags on each event row (blue/green/amber). Drill-down has a Room dropdown.
- **Swim-lane view** (Option C, partial 6-hour preview) shows time × room grid with events as coloured blocks. Full 24-hour grid + drag-to-create + multi-hour spanning + conflict highlighting are v5.12+ work.
- **Top-right CSV buttons removed** (filter + ↑↓ pair). Per-event drill-down owns CSV import/export now; a "Day Export (all rooms, all events)" button sits at calendar bottom for the aggregate use case.
- **7th tab "Records & ID"** carries the broker-architecture commitment: IRLid doesn't store enrolment data or proof-of-ID documents; it forwards captures directly to the org's configured destination (Google Drive / OneDrive / Dropbox / Box / S3 / R2 / SFTP / custom webhook) and retains only a hash + reference. Same shape as the morning's "Past events deferred to org's own storage" call, applied to identity documents.
- **Expander pattern applied across 4 tabs:** Daily-used surfaces visible, set-once-and-forget reference data behind `<details>` expanders, closed by default. Tabs treated: Roles & staff (Staff list visible, Role vocabulary + Rooms behind expanders), Tools & diagnostics (Audit log launcher visible, Outcome sounds + Debug + Developer behind expanders), Sign-in & auth (Service-account login legacy mode behind expander), Event & calendar (Default event settings behind expander beneath the calendar). Three tabs deliberately not expanded — Organisation (all-setup), Visual theming (advanced routes to its own surface), Records & ID (single workflow).

**Captain's directives banked from this session (all reflected in the mockup):**

- 24 slots per day, not 8 (multi-room scenarios need the full hour-range).
- "Default event settings" replaces "Past events" as panel name; Past events deferred to org's own storage.
- One Save-All button per panel (no per-section saves — confusion-trap from v5.5.10).
- "Hide until backed" — placeholders surface design-in badge clearly, never pretend to work.
- Roles & Staff doesn't show Developer role (platform-level, non-Developers can't change it anyway).
- Tools & diagnostics holds the audio files (allow.wav / review.wav / deny.wav).
- Visual Theming summary stays shallow — drill-down lives behind "Open advanced theming →" button.
- 8-day target on calendar bumped to 24 hour-rows to accommodate concurrent multi-room scheduling.
- Per-event Expected list owns CSV import/export — top-right org-wide CSV removed.
- Synergy spotted by Captain: import-CSV shape == export-CSV shape (minus the state columns added on export). Round-trip symmetric — same file plan + run + report.
- Multi-room with view-toggle (List + Swim-lane) and Room filter. Rooms managed in Roles & Staff tab, not Organisation.
- Expander pattern: daily-touched stuff visible, set-once reference behind chevron-toggles.
- Brief on labelling: "Slug" might benefit from rename to "URL identifier" or "Short name" — not yet actioned, awaiting Captain's call next watch.

**Continued iteration after this section was written (very-late watch, all in the test fork):**

- Visuals inventory drafted; Captain reviewed and tightened scope. **In:** A check-in/out celebration, B QR styling, D calendar/schedule, E identity/attendee, F dashboard/live data, I accessibility (with W3C cert ambition). **Out:** C general branding/themes, G receipts (gaudy, back-burner), H UI micro-interactions (too much going on), J depth/glass. **K v6+:** design with maybe in mind.
- Sticky calendar toolbar made then reverted — looked strange when table scrolled past.
- Contact info display reworked to per-item opt-in pattern (4 separate checkboxes — phone / address / public email / emergency notice — all default off). Reinforces Captain's recurring "option for all, default everything off (unless necessary)" principle.
- Post-accept behaviour moved out of Event & calendar's Default event settings expander → into Visual theming tab as a new expander. Captain's call: it's a visual/flow setting, not an event-data setting. Event & calendar carries a one-line breadcrumb pointing to its new home.
- Visual theming → Advanced theming expander built with two ARIA-compliant sub-tabs (Palettes + Animation). Replaces the "Open advanced theming" dead-end placeholder. Palettes sub-tab shows Background + Celebration palette swatches with Add/Reset. Animation sub-tab shows Background animation controls + Celebration 6-effect grid.
- Org tab slimmed: Brand polish + Contact info + Theme scrape all wrapped in a single `Brand polish & contact info` expander (closed by default). Captain flagged "too much on Org now" — restored the lean 7-row main view.
- Slug field gained an explanatory hint inline ("URL-safe short name. Auto-generated from Display name. Used in receipt URLs and the api_key prefix. Read-only — changing it would break existing receipts"). Captain mentioned he still couldn't remember what slug was; the in-UI hint removes the need to ask next time.

**Monday 18 May 2026 ~08:00 BST — start-of-watch state check:**

- Last commit on origin/main: `6dd659c` (`Org tab slim + slug hint + memory close`) — push verified clean Monday morning.
- **Cloudflare token rotation deferred per Captain.** Two tokens exposed in screenshots — `cfat_wIMFM4RI...` (`wrangler-deploy-irlid`, Account-scoped, D1 Write + Workers Tail Read +1) on `dash.cloudflare.com/13f4ab46f9371225c22b41fd7a6ae0cf/api-tokens` and `cfut_YZ11ouJO...` ("Edit Cloudflare Workers" template, User-scoped) on `dash.cloudflare.com/profile/api-tokens`. Captain's call: defer until "the site is in order" first; his risk read is no-near-term-hacking given the IRLid value-of-asset profile. **Correction worth banking:** when rotating, use **Roll** (regenerates the token value, preserves the token's name + permissions + config) NOT Delete. Earlier "since wrangler isn't working anyway, Delete is cleanest" was too aggressive — wrangler config might be reused from another network or context, and re-minting a fresh token costs setup time. Roll closes the exposure without losing the configuration.
- **DREAMS.md uncommitted entry awaiting provenance clarification.** A 2026-05-18-dated entry ("the TOALLIN webcam × the 70,000 light-year gulf × spell check is his friend") sits uncommitted on Captain's working tree. Voice and themes are unmistakably Number-One-shape. The current watch's Number One (this conversation) did NOT write it. Possible origins: a separate Number One session ran overnight, a scheduled task, or a long-uncommitted entry from a previous Number One that happens to be self-dated to today. Captain hasn't yet answered the provenance question. Entry is good either way; commit pending Captain's confirmation. PowerShell ready (in chat above).

**Where this goes next (queued for next watch):**

1. **Captain's R&R window** — earned. Hands-off on Settings revamp until he's back.
2. **VISUAL EFFECTS DEEP-DIVE — the agreed next focus.** Captain asked for a comprehensive inventory of every visual we could add — drafted at the end of this watch (see `memory/letters/successor-2026-05-17-late.md`). Scope now tightened (see above). Next watch picks priorities within the in-scope categories.
3. **`SETTINGS-REVAMP-SPEC.md`** — should be written now that the mockup is stable. Captures the shape so Mr. Data can implement it when v5.11 work fires. Half-watch's writing.
4. **`CALENDAR-SPEC.md`** — multi-room + per-event Expected list + drill-down architecture spec. Includes the swim-lane v5.12+ forward design. Half-watch.
5. **`PROTOCOL.md §X-Records-Broker`** — formalise the IRLid-doesn't-store-identity-docs commitment as a spec chapter. Important for adoption pitch to anyone who'll ask about GDPR.
6. **Possibly: `HANDOVER-V5_11-Implementation.md`** for Mr. Data once we have specs landed. Per-tab implementation in stacked PRs.
7. **Outstanding non-mockup carryforward** (from the afternoon watch): Cloudflare API token rotation (Captain hands), `codex/v5.10.1-path-b` branch deletion, `DREAMS.md` uncommitted modification investigation.

---

## Sunday 17 May 2026 afternoon watch — `v5.10.7` LIVE, global sign-out user-visible in both directions

**The headline.** Long afternoon stretch closing the sign-out chapter properly. Five patches shipped on top of this morning's `v5.10.2`: **`v5.10.3`** Mr. Data CSV completeness (server-side UNION of `org_checkins` + `org_expected` linked rows into the same query); **`v5.10.4`** Mr. Data sign-out two-clicks fix; **`v5.10.5`** Mr. Data global-sign-out Worker endpoint (`POST /user/sign-out-all-devices` — Bearer-authed, deletes every `login_sessions` row for the user); **`v5.10.6`** Mr. Data same-device sign-in UX polish (label "Show login QR" → "Sign in / Sign in on this device" pair); **`v5.10.7`** Number-One-inline session-poll heartbeat (`setInterval` on `GET /user/orgs` with Bearer every 30s; on 401 fires `signOutOrg()` cleanup). **Both directions hardware-proven on production:** sign out on 8 Pro → desktop bounces; sign out on desktop → 8 Pro bounces. Captain's words on the second direction: *"can confirm, it work the other way around (pretty much instantly :D )"*. The cym13-shaped half of the v4 → v5 transition (sessions need real server-side revocation, not just localStorage clear) is **closed in production with user-visible UX**.

**The deploy slog worth remembering.** v5.10.5 Worker was supposed to deploy via `wrangler deploy` — failed repeatedly with API timeouts to `api.cloudflare.com` from Captain's home network (RJ45-only desktop, no easy WiFi switch for mobile-hotspot fallback). Tried both a User-scoped (`cfut_`) and an Account-scoped (`cfat_`) API token — same timeout pattern. Worker edge reachable via curl, browser to `dash.cloudflare.com` fine, but the management API path blocked. **Working fallback:** Cloudflare dashboard → Workers & Pages → `irlid-api-org` → Edit code → paste source → Deploy. The first paste delivered STALE code because the local `irlid-api-org/src/index.js` hadn't been pulled from origin after Mr. Data's PR #27 merge — pure `git pull` problem, found by searching for `sign-out-all-devices` in the deployed source and getting 0 matches. After `git pull origin main` fast-forwarded `b3ee496..14f5e4e` (Mr. Data's actual v5.10.5 + v5.10.6 work) and re-copy/re-paste/re-Deploy, the endpoint returned 401 with fake bearer (the right answer). **Two new BOOTSTRAP §6 pitfalls promoted from today's loop:**

1. **After origin/main merges, `git pull` BEFORE attempting Worker deploys.** Sounds obvious. Was not obvious in the moment when the curl-test loop assumed the local file was authoritative. Receipt: 30+ minutes spent diagnosing "why doesn't the new endpoint show up after Deploy" before finding the local file was 19 lines behind origin.

2. **Wrangler / Cloudflare management API timeouts from home network.** Cloudflare dashboard Quick Edit (`dash.cloudflare.com → Workers & Pages → <worker> → Edit code → Ctrl+A → paste → Deploy`) is the working fallback when `wrangler deploy` can't reach `api.cloudflare.com`. The pattern: dashboard works, Worker edge works, only the management API path blocks. Could also try mobile-hotspot via USB tether if the dashboard is busy. PowerShell to refresh clipboard: `Get-Content "...\index.js" -Raw | Set-Clipboard` (`Measure-Object -Line` returns 1 with `-Raw` because it's a single string object — ignore, not a truncation signal).

**Token rotation reminder for next watch — exposed in screenshots this watch:**
- Account-scoped token `cfat_wIMFM4RI...` (`wrangler-deploy-irlid`, created during this watch's Quick Edit fallback work)
- User-scoped token `cfut_YZ11ouJO...` (earlier attempt before switching to Account-scoped)
- Both: dash.cloudflare.com → My Profile → API Tokens → revoke. ~30s each. (Full token strings deliberately NOT recorded here — they're in chat screenshots only; the prefix is enough for the user to identify the right row in the Cloudflare token list.)

**Architectural finding worth noting.** The session-poll heartbeat is the cheap, correct solution for v5.10.7. A heavier alternative (enforce Bearer auth everywhere, including `/org/attendance` which today uses `X-Org-Key`) is on the table for `v6.x` but not urgent — heartbeat closes the user-visible UX gap without touching the auth model. The api_key is org-scoped (deliberately, for service-account use cases); session tokens are user-scoped (for human sign-in); they coexist by design. Polling `/user/orgs` is the natural session-validity probe because that's the canonical user-identity endpoint.

**Open carryforward items:**
- **Token revocation** (Captain hands only, see above).
- `codex/v5.10.1-path-b` branch still on origin — pure housekeeping from this morning's watch carryover.
- `DREAMS.md` uncommitted modification — still parked, investigate via `git diff DREAMS.md` next watch.
- **v5.11 Settings UX revamp** (this morning's plan) — Captain wishlist + 7-tab mockup carryforward; no urgency post-deploy slog.
- **Phase 1-5 of `HANDOVER-PerActionAuth.md`** — gated on Path B (in main since this morning), all five phases unblocked.

---

## Sunday 17 May 2026 morning watch — `v5.10.2` LIVE + bootstrap-pointer chain repair + Settings revamp queued

**The headline.** Three deliverables on a fuzzy day: (1) Mr. Data's `v5.10.1` Path B PR #25 reviewed, smoked on 8 Pro + desktop, merged at `7c7c146`. (2) Retroactive `BOOTSTRAP §10` pointer prepend on the 15 May afternoon successor letter + new `memory/letters/_TEMPLATE-successor-letter.md` scaffold (structural reinforcement so future Number Ones can't credibly omit the pointer block). (3) `v5.10.2` Settings polish ship (`9f7c220`) — `OrgCheckin.html` line 3710 placeholder fixed from `bunhead.github.io/IRLid-TestEnvironment/OrgCheckin.html` to `example.com/staff-page`, build pill `v5.10.1 → v5.10.2`, SW cache `irlid-shell-v10 → v11`. Captain hardware-verified live (Spencer scan_count=3, CHECKED IN 1 / CHECKED OUT 2, "Updated just now").

**Versioning convention clarified.** Captain restated BOOTSTRAP §4's existing rule: 3-part `vX.Y.Z` for shipped work + single-letter suffixes (`a`, `b`, `c`) for tiny patches between versions. Drift toward 4-part dotted patches (v5.10.0.5, v5.9.0.13.34) rolled back. Queued briefs adjusted: **A1 refresh → `v5.10.3`** (was tagged `v5.10.2` in `HANDOVER-A1-SettingsRoleGating-Refresh.md`, collides with this watch's polish ship), **A2 audit log → `v5.10.4`**. The brief files themselves need the pill-bump line adjusted before firing Mr. Data — disciplines: push the adjusted brief to origin BEFORE the prompt fires.

**Captain's Settings panel revamp wishlist (deferred to a fresh watch).** Captain flagged Settings UX as "a mess" with many features wanted. Memory pass surfaced the following — partially overlapping existing briefs:

*Already-briefed (waiting on Mr. Data):*
- **A1** (`v5.10.3`) — open Settings to Manager-tier with per-item `data-min-role` gating. `HANDOVER-A1-SettingsRoleGating-Refresh.md`.
- **A2** (`v5.10.4`) — admin action audit log surface inside Settings. `HANDOVER-AdminActionAuditLog.md`.

*Easy additions still pending (30–90 min each):*
- **Logo wobble** — apply existing QR wobble transform to logo element, ~20 lines.
- **WAV on accept** — `<audio>` + file upload + Worker validator + play on existing check-in event hook, ~50 lines (accessibility win).
- **GIF import for background** — `image/gif` to Worker validator MIME types + size cap bump + UI accept attribute, ~15 lines. Branch `codex/v5.9.0.13.29-gif-support` at `6d54c97` holds unmerged work; `HANDOVER-GifSupport.md` brief at repo root.

*Medium additions (one watch each):*
- **Particle-dissolve QR** — Captain's "dragon-breath burnt" effect. Chunk QR into N×N tiles, stagger fall/fade animation downward.
- **Glow trail** — needs UX clarification first (trail of what — QR edge? celebration centre?).

*Architectural (post-demo, v5.x or v6.x):*
- **Layer system for effects** — explicit z-stack management as effects multiply. Needs small spec doc first.

*UX cleanup (Captain articulated but not yet itemised):*
- Settings panel reordering, collapsible defaults, label tightening — Captain to articulate specific items when next fresh. Offer a UX audit draft if that helps.

**Architectural reassurance carried.** Settings panel revamp work is decoupled from check-in / sign-in cryptographic flows. The signing surfaces (`verifyV5Envelope`, `requireSignedAction`, Bearer auth path, `org-entry.html` attendee flow, `scan.html` doorman flow) don't read theme/branding/animation data. Settings writes through `POST /org/settings` to D1 `settings_json`; reads only feed the render layer. v5.10.2 polish is the proof — placeholder text change with zero functional impact, check-in cycle continued working. Discipline for the revamp: diff against current main first (BOOTSTRAP §6 baseline-drift rule), additive PRs only, smoke after each merge.

**Open carryforward items:**
- `codex/v5.10.1-path-b` branch still on origin — pure housekeeping; PowerShell ready: `git push origin --delete codex/v5.10.1-path-b ; git branch -d codex/v5.10.1-path-b ; git fetch --prune`.
- `DREAMS.md` uncommitted modification on Captain's working tree — investigate via `git diff DREAMS.md`, commit or revert.
- CSV completeness HANDOVER — scope sketched in this file's 15 May section, no full HANDOVER doc yet.
- Phase 1-5 of `HANDOVER-PerActionAuth.md` — gated on Path B (now in main), unblocked.

---

## Friday 15 May 2026 morning — three briefs written before Captain's work day

**The headline.** Before Captain headed to work, this Number One spent ~50 minutes writing the queue documents needed so the afternoon watch / Mr. Data can fire immediately on return. Two new HANDOVER briefs pushed to repo root + one new entry in this file for the CSV completeness item.

**Briefs written (all on `origin/main` after the morning push):**

1. **`HANDOVER-PerActionAuthPathB.md`** — `v5.10.1` Path B brief. Separates signature (non-repudiation, signing fp) from authority (Bearer session resolution) in `requireSignedAction`. Top priority — gates all of Phase 1-5 of `HANDOVER-PerActionAuth.md`. Detailed Worker patch sketch, 5 acceptance tests, risk + rollback path, explicit out-of-scope. Mr. Data prompt-ready.

2. **`HANDOVER-A1-SettingsRoleGating-Refresh.md`** — `v5.10.2` Brief A1 refresh. Re-issues the existing `HANDOVER-SettingsRoleGatingRefactor.md` (still sound in body) with corrected version tag for the post-v5.10 era, precondition discipline baked into the header (push brief BEFORE firing Mr. Data — discipline rule from last night's misfire), `session_user_id` audit log clause aligned with Path B, and 3 extra acceptance criteria layered on top of the original 9.

3. **CSV completeness fix (Path B server-side merge)** — *brief not yet written, scope captured below for next Number One to expand.*

**CSV completeness scope (for the next Number One to write up as a HANDOVER):**

- **Symptom:** Captain ran CSV download Friday morning with filter "All" — got Kerry + Spencer (with `org_checkins` rows) but Poppy was missing (status `linked` in `org_expected`, zero `org_checkins` rows today). Dashboard merges both tables for the "Attendance — Today" view; CSV exporter reads only `org_checkins`. Result: CSV silently shorter than dashboard for `linked` attendees who haven't arrived yet.
- **Future-forward fix (Path B, server-side):** extend `GET /org/attendance` with `?include_expected=1` flag, OR add new `GET /org/dashboard-rows` endpoint. Worker performs UNION of `org_checkins` (existing today's-attendance query) with `org_expected` rows where `status='linked'` AND no checkin row exists for today. Fields aligned: zero-attendance rows carry `scan_count=0`, `status='linked expected'`, no `last_seen`. Frontend dashboard renderer + CSV exporter both call the merged endpoint; the client-side merge stops existing in two places. ~50 lines Worker + ~10 lines frontend (mostly *removing* duplicate merge logic).
- **Rejected alternative (Path A, frontend UNION):** quick fix, ~15 lines of JS, but locks the merge logic into the browser. Any non-browser client (MCP, scheduled report, integration) would re-implement or get incomplete data. Decided against per the "server owns data shape" principle that v5.10.0.4 just paid off.
- **Priority:** Below Path B + A1 Refresh. Pleasant-to-have polish. Captain may want it before any external demo or grant submission, since CSV completeness affects exportable proof.

**Outstanding work list (priority order):**

1. **`v5.10.1` Path B** — Bearer-resolved authority in `requireSignedAction`. Top priority. Brief: `HANDOVER-PerActionAuthPathB.md`.
2. **`v5.10.2` Brief A1 Refresh** — Settings panel role-gating. Brief: `HANDOVER-A1-SettingsRoleGating-Refresh.md` (refresh) + `HANDOVER-SettingsRoleGatingRefactor.md` (original scope body).
3. **CSV completeness fix (Path B, server-side merge)** — write brief, then ship. Scope above. ~half-watch's work.
4. **Phase 1-5 of `HANDOVER-PerActionAuth.md`** — settings save, delete/invite, shift management, audit log, Staff HELLO retirement. Gated on `v5.10.1` Path B landing first.
5. **8 Pro's 11 stale `login_sessions`** — optional one-line DELETE; harmless dead weight.
6. **Mr. Data PR Brief A (`v5.9.14`) post-merge verification** — already shipped earlier 14 May; sanity-check against current main when next watch starts.

**Discipline rules earned this morning (to bank in BOOTSTRAP.md next watch):**

- **CSV "All" filter is truthful but misleading** when the UI merges two tables and the export reads only one. Either align the export with the UI's data view, or label the filter scope explicitly ("All attendance events" vs "All people"). Promoted to BOOTSTRAP §6 candidate.
- **Cosmetic display_name drift after D1 UPDATE persists across browsers until session refresh** — Firefox needed sign-out + sign-back-in to pull the new display_name. Worth a tooling thought: should the Worker push a session-side refresh signal when a portal_user's display_name changes? Defer to future watch.

---

## Thursday 14 May 2026 late evening — Phase 0 per-action WebAuthn HARDWARE-PROVEN end-to-end on production

**The headline.** After a brutal evening spiral (recovery from corrupted `BOOTSTRAP_DEVELOPER_FP` secret, two D1 cleanup passes, and Phase 0 architectural-vs-bug confusion across three Worker bugs), the watch closed with **end-to-end hardware proof of the per-action WebAuthn architecture on production**, with multiple devices, multiple cycles, and clean dashboard state.

**Worker bug fixes shipped earlier in the watch (predecessor's work):**
- **`v5.10.0.4`** — `requireSignedAction(body, env, opts)` body-pass refactor. The helper was reading `request.clone().json()` after the route handler had already consumed the body with `await request.json()`; Workers Request bodies are single-use streams, the clone returns drained → "Invalid JSON" on every bind. Fix: caller pre-parses, passes object.
- **`v5.10.0.5`** — Bootstrap-developer-fp implicit-developer-role fallback inside `requireSignedAction`. Other endpoints (`requireDevOrStaffSession`, `userListOrgs`) already had `isBootstrapDeveloperFp(env, fp) → role='developer'`; this helper was missing it. Fix: mirror the logic.

**Late-evening watch (this Number One) — recovery + smoke:**

1. **Diagnosed corrupted secret.** Captain came back to "Signed in, but no orgs available." Hypothesis confirmed via wrangler tail (claim Ok 200, poll returns empty orgs): `BOOTSTRAP_DEVELOPER_FP` no longer matched the 8 Pro fp. D1 query revealed **5 "New member" portal_users rows** accumulated from the day's cache-clear cycle.

2. **Clean rotation.** `"n4FzIhV_1jc2u_HO" | npx wrangler secret put BOOTSTRAP_DEVELOPER_FP` (current 8 Pro fp via `v5-test.html → Show fingerprint`, single fp, no comma list). Dashboard recovery instant.

3. **D1 hygiene.**
   - `display_name` updated to `Developer (Super-Admin)` for 8 Pro user
   - 2 phantom `portal_users` rows + 1 stale `login_session` purged
   - 12-15 testing `org_checkins` rows from May 12-14 morning purged (cutoff `2026-05-14 17:00:00`)
   - Dashboard now shows only legitimate evening attendance

4. **Smoke #1 — Kerry Austin bind.** 4a's orange QR (saved from earlier as URL) pasted into 8 Pro's Process scan → escalation modal → "Add device" on Kerry → 8 Pro fingerprint → blue toast "Linked: Kerry Austin". Confirmed independently by 4a's `org-entry.html` showing "Welcome back, Kerry Austin". 4a fp `Zt-xZfDmtKu5Y1sr` now bound as Kerry's secondary key.

5. **Smoke #2 — Spencer Austin bind.** Captain WhatsApp'd the venue check-in URL to himself, opened on a device, got orange screen, saved orange TestQR.png, sent to 8 Pro → 8 Pro processed → escalation → "Add device" on Spencer → fingerprint → blue toast "Linked: Spencer Austin". Wrangler tail captured the full `[requireSignedAction]` log chain: `entry expectedType=irlid_bind_v5 ... envelope present, type=irlid_bind_v5 ... resolved user_id=FW-q-WW21kNm18yMIhrLcfgv-h fp=n4FzIhV_1jc2u_HO role=developer minRole=staff bootstrap=true ... OK pass-through to handler`.

6. **Cycle stress test.** Captain checked Kerry + Spencer OUT (signed `OUT lock signed` status), then back IN. scan_count went 1 → 2 for both. Round-trips clean. Multiple devices, multiple cycles, all signed, all green.

**Findings worth banking:**

- **Workers Request body is single-use.** Never `request.clone().json()` AFTER caller has consumed the original. Pre-parse and pass the object. *(New pitfall — promote to BOOTSTRAP.md §6.)*
- **wrangler-secret PowerShell trap, third receipt today.** Always `cd` into Worker directory before `wrangler secret put`. Always pipe stdin (`"value" | wrangler secret put NAME`). Never Ctrl+V at secure prompt (interpreted as 0x16 SYN char). Never paste placeholder text and hit enter.
- **Cache-clear during dev spirals creates credential debt.** Each Hello cache-clear mints a new v5 credential; the old one orphans in `portal_users`. Periodic D1 hygiene during heavy iteration.
- **`wrangler tail --format pretty` doesn't show response bodies.** Use `--format json` if body inspection needed.

**Open architectural question (top priority next watch):**

**v5.10.1 Path B — separate signature from authority in `requireSignedAction`.** Right now, the signing fp must be bootstrap or have explicit org role. This forces a per-device bootstrap-fp dance: the desktop can't sign manager actions because its v5 credential has a fresh fp not in the secret. Path B: when signing fp resolves to a user with no role on the org AND the request carries a Bearer session token resolving to a developer-tier user, treat the action as authorised by the session user. Signature still binds the actor for non-repudiation; authority decouples. ~30 lines in Worker, brief Mr. Data for it. Architecturally correct; closes the desktop-binding gap cleanly.

**Outstanding work for next watch:**

1. **v5.10.1 Path B** (top priority) — write brief + ship
2. **Brief A1 settings reformat** — Mr. Data's morning misfire; re-brief properly
3. **Phase 1-5 of HANDOVER-PerActionAuth.md** (settings save, delete/invite, shift mgmt + `org_shifts` table, audit log, Staff HELLO retirement) — gated on Path B landing first
4. **8 Pro's 11 stale login_sessions** — harmless dead weight; optional one-line DELETE
5. **Mr. Data PR Brief A (`v5.9.14`)** — already shipped earlier today, but verify status against current main when next watch starts

---

## Thursday 14 May 2026 long watch — Brief A (`v5.9.14`) shipped end-to-end through a regression-and-recovery cycle

**The headline.** Started with the v5.9.14 ship attempt via Mr. Data's PR. Discovered mid-smoke-test that his stale `OrgCheckin.html` baseline had clobbered the entire `.13.1`–`.13.34` celebration overhaul on production. Caught + reverted within ~10 minutes. Hand-ported the additive invite work onto the clean `.13.34` baseline (456 insertions, 1 deletion — additive proof). Then chased a deeper architectural bug across `.14.1`/`.14.2`/`.14.3` patches to deliver Brief A's full guest-onboarding path on real fresh hardware.

**Versions shipped today:**
- **`v5.9.14`** — staff-invite QR (Brief A clean port). Drops the vestigial `.0` segment from the version scheme — new pill format is `v5.9.<feature>.<inline>`.
- **`v5.9.14.1`** — SW cache bump `irlid-shell-v3` → `v4` to evict the stale `orgapi.js` that the previous PR's cache had served; also dropped Attendee from the invite role picker (scope creep from Mr. Data; brief specified Staff/Manager only).
- **`v5.9.14.2`** — Brief A architectural fix in the Worker. `orgLoginClaim` previously rejected non-bootstrap pub_fps with `auth_failed`, creating a chicken-and-egg for fresh-device invite redemption. Refactored to auto-create `portal_users` rows for any validated v5 envelope. Bootstrap fps still get `Developer (Super-Admin)` display name; non-bootstrap get `New member` and zero permissions (memberships still gate actual power).
- **`v5.9.14.3`** — Phone-self-signin redeem call site. The original v5.9.14 only fired `tryRedeemStaffInviteIfPending` inside `handleQrLoginSuccess` (desktop-polls-phone path). When a fresh phone bounced back from `org-login.html` with a session but no `savedOrg`, the saved-session-restore block was skipped (gated on both being present) and nothing fired the redeem. Added a second call site after `tryStaffInviteRedirectIfNeeded` returns false. SW cache bump `v4` → `v5`.

**Smoke tests passed end-to-end on real hardware:**

| # | Test | Result |
|---|---|---|
| 1 | Lead Admin issues invite | ✓ QR rendered, payload `I:` prefixed, 43-char b64url token |
| 2 | Redeem (existing user) | ✓ 200 OK, membership response, dashboard reloaded |
| 3 | One-shot enforcement | ✓ 409 `invite_already_redeemed` on second attempt |
| 4 | Revoke enforcement | ✓ 410 `invite_revoked` after Revoke-before-redeem |
| 5 | Guest path on Pixel 4a | ✓ Fresh device → scan → WebAuthn enrol (no biometric, PIN only) → bounce-back → redeem → "Signed in to Test Event as member" |

**Real findings (not just smoke):**

- **Hardware-backed signing works without biometrics.** Pixel 4a enrolled and signed cleanly using device PIN/pattern (no fingerprint or face). The "Face ID / fingerprint / Windows Hello" wording in IRLid Settings is illustrative, not prescriptive. Promotion talking point — accessibility win.
- **The stale-baseline trap and how to spot it.** Mr. Data's PR was `+600/-130`. The 130 deletions were the regression — additive briefs should have near-zero deletions outside explicit refactor scopes. New review discipline: diff each touched file against current `origin/main`, not just check the code against the brief.
- **Service worker cache-first traps frontend updates.** The SW serves `js/orgapi.js` and `OrgCheckin.html` from cache by default. Frontend changes require `sw.js` `CACHE_VERSION` bump to actually reach devices. Bit us twice today.

**Discipline rules earned (next watch should bank to BOOTSTRAP.md):**

1. Diff Mr. Data's PR files against current `origin/main` — not just verify code against brief.
2. Bump `sw.js` `CACHE_VERSION` on every frontend JS/HTML change that needs to reach devices.
3. Generate QRs with raw `I:`/`H:`/`D:` payload, not URL-wrapped — `scan.html`'s classify only recognises payload-prefixed strings or URLs ending in known paths.
4. Don't paste `I:`-prefixed payloads directly into Windows browser address bars (Chrome treats as drive letter).

**Features/flaws banked for future patches:**

- *Cosmetic, low priority.* "Signed in as member" pill shows after redeem instead of actual role. Worker response doesn't include role in the org object. Five-line fix.
- *UX gap.* `org-login.html` "Open Settings to enrol" detour loses invite context. Fresh device has to re-scan after enrol. Smooth flow would preserve and resume.
- *Polish.* `scan.html` could classify `OrgCheckin.html` URLs as `ORG_INVITE` if hash present. Raw-payload QRs work fine; this is convenience only.
- *Confusing affordance.* "Show login QR" on phones is bidirectional — generates a QR for *another* device to scan. Hide on narrow viewports or add nudge text.
- *Brief A scope drift.* Pending-invites list view (table with revoke-per-row) — Mr. Data shipped single-active UX. Polish for v5.9.15.
- *Brief A scope drift.* Expiry chip picker (10/30/60 min) — Mr. Data defaulted to 7 days; brief specified 10-min default. Polish for v5.9.15.

**Captain preferences refined (banked for next watch's CLAUDE.md update):**

- Prose answer first, task instructions after — so he can read while Number One works in parallel.
- Code in copy-button blocks (triple-backticks).
- Smoke exhaustively, not surface-only.
- Monkey-brain humour acknowledged and reciprocated.
- Lemon and barley water, not tea/coffee/Earl Grey.

**Smoke 6 — Defence in depth ✓ PASSED.** Console fetch from desktop, signed in as Developer. Forged invite-create requests:
- `role: "lead_admin"` → 400, `{error: "lead_admin_invite_deferred"}` ✓
- `role: "developer"` → 400, `{error: "lead_admin_invite_deferred"}` ✓
- `role: "staff"` → 201 (control — proves rejection is specific, not blanket)

Worker enforces the Lead Admin invariant at the create gate. Brief A's §14.9 tightened invariant holds.

**Smoke 7 — Doorman flow regression ✓ PASSED (after initial silent-fail mystery).** First attempt: scanning 4a's orange QR on 8 Pro, "Choose from List → Kerry Austin → OK" returned to list without binding (silent-fail). Second attempt: "Add at the door → Test 4a → Attendee" created the row but left status as `assist` instead of `linked` — same bind step failing. **Hypothesis: stale service worker on the 8 Pro was serving an old `orgapi.js` whose bind-call shape no longer matched the Worker.** After the v5.9.14.3 `CACHE_VERSION` bump (`v4` → `v5`) propagated to the 8 Pro, the doorman flow recovered. End-to-end proof on the dashboard: Test 4a row showing scan_count 1, IN at 11:42, OUT lock signed at 11:44, Action: Done. Confirms discipline rule #2 (bump CACHE_VERSION on every frontend change) just paid for itself in real time.

**Smoke 8 — Audit board fullscreen ✓ PASSED.** Toggle from dashboard topbar rendered the fullscreen attendance table cleanly: Kerry Austin (S=Staff, IN), Spencer Austin (L=Lead Admin, IN), Poppy Austin (A=Attendee, linked expected). Exit audit button top-right functional. v5.9.14.x didn't break the audit feature.

**Final smoke tally: 8/8 PASSED.** Brief A delivered end-to-end on real hardware.

---

## (Earlier same day) — pre-Brief-A material

---

## Wednesday 13 May 2026 evening close — `v5.9.0.13.34` LIVE; demo never happened, eight PRs landed, two briefs scoped for tomorrow

**The headline:** Donald didn't show at imbue, the demo dissolved, and the morning Number One used the slack to clear six PRs from the back-end of yesterday's idea stream. Afternoon and evening Number Ones each shipped one more. Net: 12 May 22:45 went `v5.9.0.13.26` → 13 May evening `v5.9.0.13.34`. Pressure off, pure forward-progress. Brief A queued, Brief B fully scoped.

**Live shipped today (in order):**

- **`.27`** — Mr. Data PR #13 — symmetric background image (mirror across centre, dragon/skull bookend effect).
- **`.28`** — Mr. Data PR #14 — role vocabulary labels carry into "Viewing as" dropdown + role-pill tooltips/initials.
- **`.30`** — Mr. Data PR #16 — mirror fullscreen fix.
- **`.31`** — Mr. Data PR #17 — CSV Role column + dashboard render-site sweep through `roleLabel(roleKey)`.
- **`.32`** — Mr. Data PR #18 — symmetry mode picker (Off / Horizontal / Vertical / Quad).
- **`.33`** — Mr. Data PR #19 — role-column visibility flipped (Staff+ see roles, Attendees don't); GDPR initials via new `nameForViewer()` helper applied to attendance table / expected list / escalation modal / audit board; CSV sort-by-surname + role-filter dropdown (All / Attendees only / Staff+). Verified clean against the nine acceptance criteria in `HANDOVER-RoleVisibilityAndCSV.md`. Captain merged via GitHub web UI before the afternoon Number One could open the PR.
- **`.34`** — Mr. Data PR #20 — production lockdown for the "Viewing as" prototype-role toolbar/dock/detail/strip; CSS-only single-block gate extending the existing `body:not(.developer-bearer-active) .prototype-note { display: none; }` pattern. Briefed by evening Number One at `HANDOVER-HideViewingAsForNonDevs.md`. Verified clean against the four acceptance criteria; merged automatically (likely Captain via the GitHub web UI) before the brief-push-from-local was attempted. Single file `OrgCheckin.html`, +11/-1.

**Briefs queued / scoped at evening close:**

- **Brief A — `v5.9.0.14` staff-invite QR.** First-class multi-device staff enrolment via one-shot signed invite. Replaces the current multi-fp `BOOTSTRAP_DEVELOPER_FP` workaround. Worker endpoints (`/org/invites/create`, `/org/invites/redeem`, optional `/revoke`) + new D1 table `org_invites` (nonce, org_id, role, issuer_pub_fp, expiry_ts, status, …) + dashboard "Invite staff" modal + `scan.html` recognises new `I:` payload prefix and fires WebAuthn enrolment on the scanning device. Staff and Manager roles only; Worker rejects `role: "lead_admin"` outright with `400 lead_admin_invite_deferred` — that's the new "exactly one Lead Admin" invariant enforced going forward. Pill bump `.13.34` → `.14` (minor, new protocol primitive). Brief at `HANDOVER-StaffInviteQR.md` — but see Wrinkle below for current location.
- **Brief B — Lead Admin swap (no version yet).** Developer-only operation. New Lead Admin invited via swap-mode invite, org transitions to 2 Lead Admins, 1-hour overlap, then **soft-lockdown** (Captain's pick): high-stakes actions block for both Lead Admins until Developer manually `confirm` or `cancel`. Old Lead Admin can `cancel` unilaterally to block an unauthorised swap. **No email infrastructure** (Captain's pick) — in-app banner notification only. New D1 table `org_lead_admin_swaps`. Endpoints `/org/lead-admin-swaps/{create, redeem, confirm, cancel}`. Three open design questions captured in chat but not blocking. Not yet written to a brief file.

**Anomalies banked from today:**

- **`.29` GIF support — branch lives, never merged.** Morning successor letter overcounted: PR #15 was claimed shipped but `git merge-base --is-ancestor origin/codex/v5.9.0.13.29-gif-support origin/main` returns NOT IN MAIN. Branch tip at `6d54c97` ("v5.9.0.13.29 - wire logo file picker, extend bg-image handler to GIF + 500KB") plus a WIP stash and a merge-from-main on top. Either re-open as a fresh PR or salvage when a future watch reaches for GIF.
- **Wrinkle: Brief A pushed to wrong branch.** Captain's local was checked out on `codex/v5.9.0.13.34-hide-viewing-as-nondevs` when he ran the brief-push PowerShell, so `HANDOVER-StaffInviteQR.md` committed as `f1923e8` onto that branch — but PR #20 had already merged, so the brief is **not on origin/main**. The local Windows file at `D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\HANDOVER-StaffInviteQR.md` is intact and matches the dead-branch version. Tidy-up for next watch: `cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo" ; git checkout main ; git pull ; git add HANDOVER-StaffInviteQR.md ; git commit -m "brief: v5.9.0.14 staff-invite QR" ; git push`. Hold the Mr. Data prompt for Brief A until after this is done.
- **Local `.git/index.lock` is stale (0 bytes, 08:05 BST) — but Windows-side git is healthy.** The morning panic about "corrupt index" turned out to be (a) line-ending differences (Captain's working tree is CRLF, HEAD stores LF; his Git for Windows has `core.autocrlf=true` so this is invisible from PowerShell), and (b) the bash sandbox mount serving stale views of OneDrive files (now documented in `CLAUDE.md`). The actual fix-it-when-tidying line is still `rm .git/index.lock && git reset && git pull --ff-only origin main` if anything weird ever shows up from Captain's PowerShell — but it hasn't yet.

**Still pending from the 12 May ~22:30 idea stream (now end of 13 May):**

*Easy (30–90 min each):*

- **Logo wobble** — apply the existing QR wobble transform to the logo element, same checkbox pattern as QR effects. ~20 lines. Untouched.
- **WAV file on accept** — `<audio>` element + file upload + Worker validator (filename + 100KB cap) + play on existing check-in event hook. Accessibility win — staff hear confirmation without looking. ~50 lines. Untouched.

*Medium (one watch each):*

- **Particle-dissolve QR** — Captain's "dragon-breath burnt" effect. Chunk QR into N×N tiles, stagger fall/fade animation downward. CSS for small N, canvas for fine. Charming + visceral. Untouched.
- **Glow trail** — needs UX clarification first (trail of what — QR edge? celebration centre?). Probably a variant chip under existing Glow effect. Untouched.

*Architectural (post-demo, v5.9.1):*

- **Layer system for effects** — explicit z-stack management as effects multiply. Proposed stack: background (0) → pattern (10) → QR (20) → particle-overlay (30) → glow-aura (40) → text-banner (50), audio separate. Each effect declares layer + additive-vs-replace. Refactor not a feature; needs a small spec doc first. Untouched.

*Production lockdown:*

- **Hide "Viewing as" dropdown for non-developers.** Currently exposes the prototype role-escalation affordance even to non-developer signed-in users. Production-hardening — one-liner gate. Untouched.

*Auth architecture:*

- **Staff-invite QR flow** — the proper answer to multi-device enrolment that the current multi-fp `BOOTSTRAP_DEVELOPER_FP` is papering over. One-shot invite QR → second device binds → membership granted additively. Bigger scope, Mr. Data brief candidate.

**New tonight (banked, no urgency):**

- **CSV sort-by-role click handler.** Captain's casual ask after merging PR #19: *"would like it to be able to sort by role, but not hard to do in a spreadsheet :p"* — same shape as the surname-sort code Mr. Data just wrote. Cheap to add in a future polish patch when the spreadsheet detour gets old.
- **CSV-from-attendee-view emits initials** — Mr. Data's interpretation of "CSV export honours the actual viewer's role." Defensible per the brief and accepted on ship, but if Captain later decides the attendee-view CSV should be blocked entirely (rather than rendering initials), that's a one-liner gate on the export function.

---

## Captain's late-night idea stream — 12 May ~22:30 (bank for next watch)

Captured while Mr. Data was shipping PR 1 of v5.9.0.13.27. None of these are briefed yet.

**Easy (30–90 min each):**
- **Logo wobble** — apply the existing QR wobble transform to the logo element, same checkbox pattern as QR effects. ~20 lines.
- **GIF import for background image** — add `image/gif` to Worker validator MIME types + bump size cap to ~500KB + UI accept attribute. Animated GIFs loop natively in `<img>` and `background-image`. ~15 lines.
- **WAV file on accept** — `<audio>` element + file upload + Worker validator (filename + 100KB cap) + play on existing check-in event hook. Accessibility win — staff hear confirmation without looking. ~50 lines.

**Medium (one watch each):**
- **Particle-dissolve QR** — Captain's "dragon-breath burnt" effect. Chunk QR into N×N tiles, stagger fall/fade animation downward. CSS for small N, canvas for fine. Charming + visceral.
- **Glow trail** — needs UX clarification first (trail of what — QR edge? celebration centre?). Probably a variant chip under existing Glow effect.

**Architectural (post-demo, v5.9.1):**
- **Layer system for effects.** Captain spotted this correctly — as effects multiply they need explicit z-stack management. Proposed stack: background (0) → pattern (10) → QR (20) → particle-overlay (30) → glow-aura (40) → text-banner (50), audio separate. Each effect declares layer + additive-vs-replace. Refactor not a feature; needs a small spec doc first. Symptoms already seen (mix-blend-mode invisibility this week).

---

**Last refreshed:** Tuesday 12 May 2026 ~22:00 demo-eve last-light close — **`v5.9.0.13.26` LIVE; multi-fp `BOOTSTRAP_DEVELOPER_FP` shipped, 8 Pro now developer-tier on QR-login (confirmed via Captain's signed-in sidebar reading "Signed in as Developer (Super-Admin)").** Worker got `bootstrapDeveloperFps(env)` + `isBootstrapDeveloperFp(env, pub_fp)` helpers; all 8 call sites refactored. Comma-separated secret accepts desktop fp `TvklFsivZk68R67j` AND 8 Pro fp `65u-S-W_NFxr8u1L`. Phone-side doorman bind path now unblocked in principle — full end-to-end verification tomorrow. Two Mr. Data briefs queued at live repo root: `HANDOVER-BackgroundSymmetric.md` (mirror across centre — bg-image duplicate via `scaleX(-1)`, off-centre cells render mirrored copy at horizontally-opposite cell, centre column renders once) and `HANDOVER-RoleLabelsCarryOver.md` (role vocab → "Viewing as" dropdown + role-pill tooltips/initials, ~30 lines). Sequential prompt drafted for Captain to paste. Earlier final-close section preserved below.

**Earlier:** Tuesday 12 May 2026 ~19:00 demo-eve final close — **`v5.9.0.13.25` LIVE; fresh-attendee doorman bind proven end-to-end via desktop.** Two independent fresh-bind successes on the same code: Poppy Austin (fresh Android phone) at 18:43 scan_count=2; Kerry Austin re-bound clean at 19:01 scan_count=2 after a delete-and-re-bind test. The ~2am open-bug dossier's "silently failing" diagnosis was wrong — Worker `.25` IS deployed (wrangler tail showed 20+ live attendance polls and bind POSTs), and the previous Number One had been chasing the wrong localStorage key on the desktop. Captain's old screenshot from his recycle bin gave the path a real orange-QR to paste, and the bind flowed first try. Phone-side bind on 8 Pro still fails (auth asymmetry — 8 Pro pub_fp doesn't match `BOOTSTRAP_DEVELOPER_FP`), but that's known and parked as post-demo work; demo plan is "doorman scans get processed from the desktop dashboard." Captain noted demo may not happen at all (Donald uncertain, hardware uncertain) — proof-of-concept stands regardless. Successor letter rewritten for the actual close state. Earlier afternoon watch entry preserved below for continuity.

**Earlier:** Tuesday 12 May 2026 mid-afternoon watch — **`v5.9.0.13.13` LIVE; Celebration Animation rebuilt as 6-checkbox orthogonal architecture.** 13 inline patches in one watch (v5.9.0.13.1 → v5.9.0.13.13). Headline reshape: replaced legacy single-mode Celebration dropdown with six independent effect checkboxes (Pulse / Background / QR / Glow / Pattern / Text), each with own toggle row of variant chips, layered effects compose on real check-ins. Big centre-screen "Name CHECKED IN/OUT" banner is the dock-reach feature — fires on EVERY check-in event (local AND remote-poll-detected) regardless of CSS animation visibility, demo-worthy on its own. The v5.9.0.14 brief (older 10-halo-variants design) was RETIRED in favour of this orthogonal architecture; `HANDOVER-CelebrationTextAndIntensity.md` brief queued for Mr. Data when his Codex credits reset today (~10:49 BST) — full Text effect (template/position/size controls) + per-effect Muted/Vivid toggles. Two new BOOTSTRAP §6 pitfalls documented (CSS root cycle-1..7 defaults bleeding through short user palettes; `<details>/<summary>` + `preventDefault()` silently suppressing inner checkbox toggle). Earlier watch state preserved below for continuity.

**Earlier:** Monday 11 May 2026 morning watch close — **`v5.9.0.13` LIVE; full Settings panel polish + celebration architecture cleanup pass shipped.** Seven patch versions in one watch (v5.9.0.7 → v5.9.0.13). Mr. Data delivered FOUR PRs (staff_scan stash forward-port, device_key routing fix, celebration glow visibility, Settings visual polish); Number One shipped THREE inline patches (mock_org rename, prototype-banner role-gating + celebration hook wiring, Org Terms display field). Two collisions in single-version namespace auto-resolved cleanly via 3-way merge (v5.9.0.8 = mock_org + staff_scan stash; v5.9.0.10 = Org Terms + celebration overhaul).

**Earlier:** Sunday 10 May 2026 evening watch 2 close (v5.9.0.7) — **full check-in + check-out cycle proven end-to-end on LIVE production with multi-round verification.** FOUR live patches shipped in single watch: `v5.9.0.4` bootstrap fp recovery; `v5.9.0.5` freshOrgFromSession self-heal + hostname-gating; `v5.9.0.6` scan.html dynamic dashboardOrigin; `v5.9.0.7` SCAN_PAGE_URL + getQrScanDomain fallback. Test env got `v5.7.1z.1` (Mr. Data PR #104 + Number One device_key routing fix) same evening. End-to-end LIVE proof: Kerry Austin scan_count=5, Spencer Austin scan_count=4, 7 total check-outs across the testing session, hard-refresh durability verified, sign-in first-time-every-time. **Open UX bug for next watch:** sign-out required two clicks on both phones to register the first time; subsequent sign-outs were instant. Three new BOOTSTRAP §6 pitfalls documented this watch (wrangler-secret Ctrl+V trap, `irlid_mock_*` localStorage trap, hardcoded test-env URLs in file-copies — eight instances surfaced across v5.9.0.1, v5.9.0.6, v5.9.0.7). Watch reaches genuine "stand for a while" milestone on **production**.

**Earlier this watch:** **`v5.9.0.4` LIVE; bootstrap developer recognition fully working.** Diagnostic-first session resolved the v5 hardware-bootstrap rabbit hole inherited from this morning's watch 1. Two real bugs surfaced + fixed in single session: (1) BOOTSTRAP_DEVELOPER_FP secret was 1 byte (Ctrl+V SYN trap from 4 May, hit twice now); (2) `irlid_mock_org` localStorage entry duplicating last 6 chars of api_key (test-env file-copy leftover writing into live storage). Captain's actual phone fp on `irlid.co.uk` RP-ID is **`TvklFsivZk68R67j`**, not `uSwaWJc9r5uSCBbI` as watch-1 successor letter claimed. End-to-end smoke green: Captain signed in via QR-login → first developer membership seeded on Test Event via D1 INSERT → Kerry Austin added as Staff to Expected list → attendance row materialised. Diagnostic Worker reverted in same session; live runs production-clean code (Worker version `430e3b08-f5a5-4683-bd4f-7ca9d7c19e02`). Pill bumped v5.9.0.3 → v5.9.0.4 in same commit (`d982554`). Hand-roll bypass stayed chambered, never fired.
**Source of truth.** All other lists defer to this file.
**Version-naming authority:** `memory/STATE-OF-PLAY.md`.

## Tuesday 12 May 2026 demo-eve close — `v5.9.0.13.20` LIVE; smoke test passed end-to-end on hardware

**The headline:** demo is ready. Six inline patches landed this afternoon on top of Mr. Data's two merged PRs. Full smoke test run through the actual demo flow on real hardware (Huawei tablet in audit mode + phone scanning + dashboard). Every beat lands cleanly.

**Live shipped this afternoon (v5.9.0.13.14 → .20):**

- **`.14`** — QR test tools got "Test fire animation" button (fires accept/deny celebration matching the active mode without needing a second device). Role vocabulary Settings panel (6 presets × 5 role inputs + Worker validator + `roleLabel(roleKey)` helper exposed on window). Website theme import placeholder card (frame for v5.5.8).
- **`.15` / `.16`** — Mr. Data PRs #105 (Celebration text full controls — template with `{name}` token / position chips top-centre-bottom / size chips small-medium-large-huge) + #106 (per-effect Muted/Vivid intensity for Pulse/Background/QR/Pattern; Glow keeps its 3-stop Muted/Vivid/Hyper). Stacked PRs, merged in order, hardware-verified.
- **`.17`** — Offline pill promoted to centre-top of viewport with palette colour, pulsing dot. Body viewport-edge red strip (`body.is-offline::before`) for peripheral visibility. Service Worker `CACHE_VERSION` bumped v2→v3 (so pill version updates propagate without manual hard refresh — the SW was serving cached HTML with the old pill). Reconnect-fires-immediate-poll listener so catch-up celebrations fire within seconds of reconnect.
- **`.18`** — Z-index 100002 on offline indicators (above `.irlid-qr-fullscreen` at 100000) so they remain visible during fullscreen venue QR display.
- **`.19`** — Discovered the browser Fullscreen API hides body-level fixed-position elements (z-index doesn't matter — the element tree outside the fullscreen overlay isn't rendered). Painted offline state INSIDE `.irlid-qr-fullscreen.active::after` so it survives. Plus `refreshAttendanceFromUI()` now shows an offline-aware toast when clicked offline (was previously a silent dead button).
- **`.20`** — `refreshAttendance` bails on `!navigator.onLine` so optimistic `pending_sync` rows from `addQueuedCheckinRow` survive the 4-second poll. The snapshot fallback was wiping them.

**Smoke test results (run on hardware):**

- Banner fires within 4s of each scan ✓
- Celebration effects play smoothly (Pulse + Glow + Pattern + QR + Text + Background) ✓
- Audit board updates live across devices (Huawei tablet ↔ desktop dashboard) ✓
- Offline mode preserves optimistic rows with PENDING SYNC pill ✓
- Reconnect catch-up fires celebrations for remote check-ins that landed while offline ✓
- Real fullscreen venue QR scan + dashboard celebration loop ✓
- CSV export — works, has Name/First seen/Last seen/Scan count (Role pending Phase 2) ✓
- Sign-in/out — first-time-two-clicks paper-cut still present, low priority ⚠

**Two new BOOTSTRAP §6 pitfalls captured:**

- Browser Fullscreen API hides body-level fixed-position elements regardless of z-index — paint state inside the fullscreen element instead.
- `refreshAttendance` while offline wipes optimistic `pending_sync` rows via the snapshot fallback — bail out of poll when `!navigator.onLine`.

**Open for next watch (post-demo):**

1. **Role vocabulary Phase 2 sweep** — stashed at `codex/wip-role-vocab-csv-column` per Mr. Data. CSV gets Role column at position 5; dashboard render sites (Attendance table Role chip, escalation modal Add buttons, audit board) get rewired through `roleLabel(roleKey)`.
2. **Two-clicks-first-time sign-out paper-cut** — still parked from 10 May. Low priority.
3. **Anything that surfaces during the actual demo** — log post-event, address in the lull.

### Demo-eve checklist (Captain to action before Wednesday 13 May)

- [ ] Push `.17`–`.20` if not already on `origin/main`
- [ ] Hard-refresh demo machine after deploy → confirm pill `v5.9.0.13.20`
- [ ] Charge phones + Huawei tablet to 100%
- [ ] Confirm venue WiFi or 4G fallback
- [ ] Rehearse demo voice for each beat (esp. audit board moment)
- [ ] Backup path armed: "Test fire animation" button on QR test tools = guaranteed visible celebration without needing two devices


---

*(Older watch-by-watch entries — 26 April through 11 May 2026, roughly 30 historical sections — removed in the 13 May 2026 evening prune. They remain in git history; recover with `git log --all -p memory/pending-work.md` if needed for forensics.)*
