# Pending Work — IRLid

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
