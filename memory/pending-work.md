# Pending Work — IRLid

## Saturday 23 May 2026 — v5.11 mockup feature-complete (T4.3.53 → T4.3.60) + ACCESSIBILITY-SPEC + port path identified

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
