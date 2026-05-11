# State of Play — IRLid

**Last refreshed:** Monday 11 May 2026 morning watch close — **`v5.9.0.13` LIVE on irlid.co.uk.** Seven patch versions shipped in a single morning watch: `v5.9.0.7` SCAN_PAGE_URL + getQrScanDomain dynamic origin (rolled over from 10 May), `v5.9.0.8` PR #104 staff_scan localStorage stash/recovery forward-port (Mr. Data) + irlid_mock_* localStorage namespace cleanup (Number One inline, both shipped together via 3-way auto-merge), `v5.9.0.9` prototype-banner role-gated hide + celebration hook wired into runRecognisedDeviceKeyCheckin/runDoormanCheckin (Number One inline), `v5.9.0.10` Org Terms display field three-layer landing (Number One frontend ~15 touchpoints + Worker whitelist + length cap) shipped same version as Mr. Data's celebration overhaul (accept on venue QR + new deny animation — 3-way auto-merge), `v5.9.0.11` v5.7.1z.1 device_key routing fix forward-port (Mr. Data — mode='device_key_scan' → 'doorman_scan' with synthesized helloPayload), `v5.9.0.12` celebration glow visibility fix (Mr. Data — removed mix-blend-mode:screen on pseudo-elements that was invisible against .qr-box white background; animated rings on .qr-box directly), `v5.9.0.13` Settings panel visual polish (Mr. Data — halo-only celebration with stripes stripped, BG↔CEL duplicator arrows removed, Preview Celebration/Deny moved beside their buttons, Image position grid dot travel recalibrated, broader styling audit). Captain's verification across the morning: full check-in/check-out cycle proven 10 May; today's pass tightened UX + closed two latent bugs (white-background invisibility + device_key routing).

**Standby state at watch close:** Mr. Data out of Codex credits until **12 May 10:49**; v5.9.0.14 brief (Celebration architecture — 10 accept + 5 deny modes, Vibrant Palette toggles on Background + Celebration panels) pushed to test env main, queued for him tomorrow. Three new Mr. Data briefs landed today (PR #104 staff_scan stash forward-port, device_key routing forward-port, celebration glow visibility fix, Settings visual polish — 4 PRs total today plus 2 Number One inline pushes + 1 paired auto-merge release). Sign-out-twice paper-cut from 10 May still parked. Watch shipped FOUR live patches (`v5.9.0.4` bootstrap fp recovery; `v5.9.0.5` mock_org self-heal + hostname-gating; `v5.9.0.6` scan.html dynamic dashboardOrigin; `v5.9.0.7` SCAN_PAGE_URL + getQrScanDomain fallback dynamic) plus test env companion `v5.7.1z.1`. Hard-refresh durability verified. Sign-in works first-time-every-time. **One open UX bug for next watch:** sign-out required two clicks on both phones to register the first time; subsequent sign-outs were instant. Likely localStorage-clear timing or session-token race. Detail below in next-watch follow-ups. Three patches landed in single watch — `v5.9.0.4` BOOTSTRAP_DEVELOPER_FP secret recovery + first developer membership seeded; `v5.9.0.5` `freshOrgFromSession` fall-back-to-orgs[0] (breaks corrupt-savedOrg cycle from `irlid_mock_org` localStorage trap) + hostname-gated test-env strings on live (debug-banner spans hide, footer flips "Test Environment" → "Live"); `v5.9.0.6` scan.html staff_scan handoff uses dynamic dashboardOrigin (was hardcoded to test env, sending live attendee phones to bunhead.github.io after scanning the orange QR; now live → live, test env → test env). Test env got `v5.7.1z.1` matching evening (Mr. Data PR #104 staff_scan stash/recovery + Number One device_key routing fix `mode='device_key_scan'` → `mode='doorman_scan'` with synthesized helloPayload). End-to-end on LIVE production: attendee phone scans live check-in QR → orange "Get a member of staff" → staff phone scans orange QR via camera app → live dashboard auto-processes staff_scan → "Linked: Kerry Austin" post-resolution toast on phone → desktop dashboard shows Kerry IN at 18:44 with scan_count=2, 70% AVG SCORE, real-time sync confirmed. Test env separately proven end-to-end with full check-in + check-out cycle. Two new BOOTSTRAP §6 pitfalls promoted: wrangler-secret Ctrl+V trap (now hit twice) + `irlid_mock_*` localStorage trap with sacred-list of consumer-side keys never to delete during recovery. Forward-port queued: PR #104's localStorage stash/recovery for staff_scan needs to come from test env to live OrgCheckin (live still has older v5.7.1c/d handler).

**Earlier this watch:** `v5.9.0.4` ran the v5 hardware-bootstrap rabbit hole to ground without resorting to the hand-roll-bypass plan. `BOOTSTRAP_DEVELOPER_FP` secret was 1 byte (SYN char) — Ctrl+V trap from 4 May had bitten live Worker too. Recovered via stdin pipe (`"TvklFsivZk68R67j" | npx wrangler secret put`). Captain's actual phone fp on irlid.co.uk RP-ID is `TvklFsivZk68R67j`, not `uSwaWJc9r5uSCBbI` as morning watch's successor letter claimed.

**Original watch 2 entry below this kept for narrative continuity:**

**Last refreshed:** Sunday 10 May 2026 evening watch 2 — **`v5.9.0.4` LIVE on irlid.co.uk; bootstrap developer recognition fully working.** Diagnostic-first session ran the v5 hardware-bootstrap rabbit hole to ground without resorting to the hand-roll-bypass plan. Two real bugs surfaced and fixed: (1) `BOOTSTRAP_DEVELOPER_FP` secret was 1 byte (`` SYN char) — the Ctrl+V trap from 4 May had bitten the live Worker too. Recovered via stdin pipe (`"TvklFsivZk68R67j" | npx wrangler secret put`); Captain's actual phone fp on irlid.co.uk RP-ID is `TvklFsivZk68R67j`, NOT the `uSwaWJc9r5uSCBbI` the previous successor letter claimed. (2) `irlid_mock_org` localStorage entry was duplicating the last 6 chars of the api_key — test-env file-copy leftover writing into live's localStorage; deleted via DevTools, dashboard now fetches clean api_key from `/user/orgs`. First Captain → Test Event `org_memberships` row INSERTed via D1 (developer role). End-to-end smoke green: signed in as Developer (Super-Admin), added Kerry Austin as Staff to Expected list, attendance row materialised. Diagnostic Worker reverted in same session — live runs production-clean code, just with the recovered secret. See `pending-work.md` for the polish follow-up list (now includes `irlid_mock_org` codebase fix as separate item from the localStorage recovery).
**Purpose:** Single-glance answer to "what are we doing and why." Skim this at session start before anything else operational. Detail lives in `PROTOCOL.md`, `CLAUDE.md`, `memory/pending-work.md`.
**Authority:** This file is the canonical mapping of legacy labels (Batch A/B/C, Polish 1–11, Batch 1–16) to the new `vX.Y.Z` convention. Other files defer to it.

---

## Live (irlid.co.uk)

| Item | State |
|---|---|
| Protocol version | **v5** — hardware-backed signing via WebAuthn / Passkeys |
| Consumer site live since | 2 May 2026 |
| **Org dashboard live since** | **10 May 2026 (v5.9 — Path A live port)** |
| Score with v5 features active | up to 70/100 |
| Verified surfaces | Edge + Chrome + Windows Hello on Windows 11; Chrome + Pixel 8 Pro fingerprint on Android 10 |
| Last meaningful change | v5.9.0.13 (11 May morning watch close) — Settings panel visual polish on top of full doorman+check-in+check-out e2e baseline. Seven patches shipped today (v5.9.0.7 → .13): PR #104 staff_scan stash forward-port, irlid_mock_* namespace cleanup, prototype-banner gating, celebration hook wiring, Org Terms field, celebration overhaul, device_key routing fix, glow visibility fix, Settings visual polish. v5.9.0.14 Celebration architecture queued for Mr. Data when credits reset 12 May 10:49. |
| Live Worker (Org dashboard) | `irlid-api-org` at `https://irlid-api-org.irlid-bunhead.workers.dev` |
| Live D1 (Org dashboard) | `irlid-db-org` (`484dad86-e75c-412e-9423-ca0bb27cdcb8`), region WEUR |
| Live Worker (consumer) | `irlid-api` (untouched by v5.9 port — kept production-stable) |
| First seeded org | `0337bf2f-e8a3-48d4-a12b-3f9426354f4f` "Test Event" / slug `imbue-ventures` / api_key `org_1f6acd...4256` |
| Captain's Developer membership | `org_memberships` row inserted 10 May evening — role `developer` on Test Event, `pub_fp` `TvklFsivZk68R67j` |
| Captain's phone fp on `irlid.co.uk` RP-ID | `TvklFsivZk68R67j` (16 chars) — matches `BOOTSTRAP_DEVELOPER_FP` on the Worker |

---

## Test environment (bunhead.github.io/IRLid-TestEnvironment)

| Item | State |
|---|---|
| Active version | **v5.5.12** (Tier 2 offline write queue + indicator) verified end-to-end on hardware 8 May evening; **v5.7.1h** (audit board) verified on Huawei tablet 8 May; **v5.6** (AssistQR) in flight |
| Last shipped piece | `v5.5.12` — Tier 2 of `§16` Offline-Capable Operation. `js/offline-queue.js` IndexedDB `pending_ops` store + replay loop, single-interception in `js/orgapi.js` `request()` with whitelist, blinking-red-dot indicator with queue-depth badge per `§16.5`, optimistic local rendering with PENDING SYNC pill on queued check-ins / settings / Expected adds. Zero Worker changes by design (`§16.3` — duplicates accepted, audit trail is the truth). PR #95 merged. `v5.5.12.1` indicator placement nudge (top-right → bottom-left, above Settings) cherry-pick pending after a wrong-branch landing on `codex/v5.5.12-offline-queue` (BOOTSTRAP §4 receipts +1). |
| Codex worker | `irlid-api-test` — connected to D1 `irlid-db-test` |

---

## In flight

| Track | Owner | Tag | Brief | State |
|---|---|---|---|---|
| AssistQR / §15 | Mr. Data | `v5.6.0` | `IRLid-TestEnvironment\HANDOVER-AssistQR.md` | Codex branches `codex/assistqr-*`; spec → Worker → phone → dashboard, four-PR stack |
| Doorman flow verification | ✅ Done 6 May night | `v5.7.0c` + `v5.7.0c-fix` | (closed) | Mr. Data's PR #91 + #92 relocated widget and added diagnostics; Number One's `a303116` killed the decompression hang. Real-hardware test passed on Pixel 4a. |
| Multi-key bind UI in escalation modal | ✅ Done 8 May | `v5.7.0d` | `IRLid-TestEnvironment\HANDOVER-MultiKeyBindUI.md` | Mr. Data PR #94 merged — claimed Expected rows render dashed/muted with "already bound to `<fp-short>`" subtitle; clicks route to `bindAdditionalKey()` instead of Add-at-the-door. Light-theme variant added proactively. Playwright smoke covered Bearer + Staff HELLO + claimed/unclaimed paths. |
| Dashboard table state bleed on org-switch | Open | `v5.5.9` | (no brief — see `pending-work.md`) | Found 6 May morning. Same shape as `v5.5.5` Branding bleed, on attendance table. |
| Orange QR centring + screen +3s hold | Open (polish) | `v5.7.0b.x` | (no brief — see `pending-work.md`) | Captain's testing 6 May late evening. Small CSS fixes. |
| Doorman mode toggle retirement | Open (cleanup) | `v5.7.x cleanup` | (no brief) | Same area as scan-widget-orphan; could fold together. |
| Staff HELLO QR upload | Mr. Data | `v5.5.6` (when shipped) | `IRLid-TestEnvironment\HANDOVER-Polish11.md` Task 3 | jsQR vendoring landed; UI follow-up open |
| YubiKey enrolment | Mr. La Forge | TBD | `IRLid-TestEnvironment\HANDOVER-YubiKey.md` | Awaiting La Forge commissioning |
| GPS-nearest-staff on orange screen | Open (v6 design) | `v6.0+` | (no brief — design captured) | Includes Captain's directive: visual placeholder for map widget NOW so frame is ready when v6 lands. |
| Worker-mediated assist alternative | Open (v6 design) | `v6.0+` | (no brief — design captured in pending-work) | Captain's "Notify staff" alternative to QR scan. Online-friendly; QR fallback for offline. |
| **Offline-capable operation (`§16` candidate)** | Number One drafted | `v5.5.x` patches + `v6.0` flagship | `OFFLINE-MODE-PROPOSAL.md` at repo root | **Awaiting Captain's read + ratification.** If ratified, contents promote to `PROTOCOL.md §16`. Four-tier path, time-anchoring, blinking-red-dot UI, connection to v6 themes. |

---

## Spec branches not yet on main

| Branch | What | Status |
|---|---|---|
| `no1/protocol-1409-1417-regency` (live repo) | §14.9 expansion + §14.17 doorman + §14.18 OAuth/recovery quorum, 3 commits | ✅ Merged 5 May via PR #2 |

---

## Historical mapping (legacy → vX.Y.Z)

These labels appear in past commits, milestones, archived briefs, and PR titles. New work uses the right column.

| Legacy label | Maps to | Notes |
|---|---|---|
| Batch A | `v5.5.0` | §14 spec + Identity-Bound Sessions schema/endpoints (4 May) |
| Batch B | `v5.5.1` | Phone-side `org-login.html` + admin portal QR sign-in (4 May) |
| Batch C | `v5.5.2` | `/user/orgs` + `/user/create-org` Bearer endpoints (4 May) |
| Batch C polish 1–10 (test env) | `v5.5.3` | Settings persistence diagnostic + UI tightening rounds (5 May morning) |
| "Polish 11 hotfix" (deployment #123) | `v5.5.3` (cont.) | Single-endpoint Bearer-bypasses-Staff-HELLO patch (5 May afternoon) |
| Polish 11 Task 2 (PR #80, commit `68f96ff`) | `v5.5.4` | Full sweep — Bearer auth across all staff-gated endpoints (5 May evening) |
| Polish 11 Task 1 | `v5.5.5` ✅ shipped 6 May | Settings persistence round-trip — PR #82, browser-verified end-to-end |
| Polish 11 Task 3 | `v5.5.6` (when shipped) | Staff HELLO QR upload (jsQR-decoded) |
| Save All Settings unify (theme included) | `v5.5.10` ✅ shipped 6 May | Both buttons send full payload incl. theme — PR #85 |
| Role-gating button visibility | `v5.5.11` ✅ shipped 6 May | Hide role-gated buttons when role doesn't permit — PR #90 |
| Batch C.5 (staff scan-in) | `v5.5.7` (when shipped) | Spec'd in §14.13 |
| Batch D (theme scrape) | `v5.5.8` (when shipped) | Spec'd in §14.13 |
| AssistQR / Batch C.6 | `v5.6.0` (in flight) | Assist modal + §15 spec — Mr. Data on `codex/assistqr-*` |
| Doorman / §14.17 (Worker primitives) | `v5.7.0a` ✅ shipped 6 May | Multi-key binding + role-gated Add + freshness gate — PR #81 |
| Doorman polling endpoint | `v5.7.0a-followup` ✅ shipped 6 May | `GET /org/expected/lookup-by-fp/:fp` — PR #84 |
| Doorman / §14.17 (phone orange QR) | `v5.7.0b` ✅ shipped 6 May | Phone-side orange-state QR + 2s polling — PR #83 |
| Doorman polish (URL encoding) | `v5.7.0b-polish` ✅ shipped 6 May | Orange QR encoded as scan.html URL — PR #87 |
| Doorman polish (QR maximisation) | `v5.7.0b.1` ✅ shipped 6 May | Maximised QR + level-H + "Hold your phone up" subtitle — PR #88 |
| Doorman polish (absolute URL) | `v5.7.0b.2` ✅ already shipped via PR #89 | Absolute `https://irlid.co.uk/scan.html` URL |
| Doorman / §14.17 (dashboard escalation modal) | `v5.7.0c` ✅ shipped 6 May | Scanner type-branch + escalation modal + role-tiered Add — PR #86 |
| Scan widget orphan + Process scan handler | `v5.7.0c-followup` ✅ shipped 6 May | Mr. Data PRs #91 (relocate widget) + #92 (`[scan]` diagnostics + textarea-priority + Developer Bearer bypass) |
| Decompression hang on `HZ:` orange QRs | `v5.7.0c-fix` ✅ shipped 6 May night | Test env commit `a303116` — explicit reader loop in `doormanDecompressB64urlJson`, matches canonical `irlidDecompressFromB64url` pattern in `js/sign.js`. Doorman flow now alive on real hardware. |
| Multi-key bind UI in escalation modal | `v5.7.0d` (queued) | Logged 6 May night — surface bind-additional-key in escalation modal so 2nd-device scans don't force duplicate Expected rows |
| Live `scan.html` universal QR ingress | `v5.7.1` ✅ shipped 6 May | Live repo PR #3 — URL-aware `classify()` + fullscreen gating + `?type=`/`?payload=` and compact-form params |
| PWA shell / Tier 1 of §16 | `v5.7.1a` ✅ shipped 7 May | `sw.js` + `manifest.json` + Service Worker registration. Dashboard loads cold offline after first visit. CACHE_VERSION starts at v1. |
| Staff-scan hand-off (`scan.html` → dashboard) | `v5.7.1b` ✅ shipped 7 May | "Open in staff dashboard" button on device_key gate; dashboard reads `#staff_scan=` hash and auto-processes |
| Same-device direct WebAuthn sign-in | `v5.7.1c` ✅ shipped 7 May | Dashboard receives staff_scan with no session → auto-redirect to `org-login.html?return=…` → WebAuthn → bounce back → poll → restore session |
| Diagnostic instrumentation | `v5.7.1d` ✅ shipped 7 May | Verbose `[staff_scan]` console logs for debugging |
| PWA cache trap fix + sign-out flag | `v5.7.1e` ✅ shipped 7 May | `CACHE_VERSION` v1→v2 + HTML/navigation requests switched to network-first. `irlid_signed_out` flag respected by `DEV_AUTO_LOGIN` |
| Auto staff sign-in on venue arrival | `v5.7.1f` ✅ shipped 8 May | `org-entry.html` recognises staff-tier device on Expected list, diverts to `org-login.html` after 7s green hold instead of the standard post-accept redirect. Attendee path unchanged. |
| Six-bug polish push | `v5.7.1g` ✅ shipped 8 May | Delete align (.checkout-actions { flex: 1 1 auto; width: 100% }) + Refresh feedback + mobile escalation modal + orange QR centring/sizing + F5 api_key wipe fix + sidebar reflects actual auth state |
| Stay/redirect + airport-board audit mode | `v5.7.1h` ✅ shipped 8 May | 3s "Linked: {name}" toast with Stay-on-dashboard override; default → redirect to `scan.html` for next chimp. Audit mode = fullscreen + landscape lock + table-only chrome. Topbar `⛶ Audit` button on Dashboard panel. **Verified live on Captain's Huawei tablet.** |
| `sign.js` consolidation in `OrgCheckin.html` | `v5.7.1i` ✅ shipped 8 May | Mr. Data PR #93 merged — six `doorman*` helpers deleted; `<script src="js/sign.js">` added to head; `doormanVerifyDeviceEnvelope` retained (renamed `verifyDeviceEnvelope`) using canonical helpers. Eliminates the drift class that bit `v5.7.0c-fix`. Playwright smoke covered both H: and HZ: device-key paths. |
| Multi-key bind UI in escalation modal | `v5.7.0d` ✅ shipped 8 May | Mr. Data PR #94 merged — claimed Expected rows route to `bindAdditionalKey()`. See In-flight row above. |
| Tier 2 of §16 (IndexedDB write queue + indicator) | `v5.5.12` ✅ shipped 8 May | Mr. Data PR #95 merged. `js/offline-queue.js` (new), `js/orgapi.js` patched with single-interception + whitelist, `OrgCheckin.html` indicator chrome + state machine + optimistic queued rendering. Zero Worker changes (per `§16.3`). Verified end-to-end on hardware: offline → Add → PENDING SYNC pill + OFFLINE red dot with queue-depth badge → online → SYNCING → ✓ SYNCED green check → row drains to real Expected entry, no PENDING SYNC pill. |
| Indicator placement nudge (top-right → bottom-left) | `v5.5.12.1` cherry-pick pending | Captain UX call after `v5.5.12` ship — top-right at 16px collided with topbar Refresh / Audit / CSV / Sign out controls. CSS-only, +6/-1 lines in `OrgCheckin.html`. Edit landed on `codex/v5.5.12-offline-queue` (commit `0dae81a`) instead of main; `git cherry-pick 0dae81a` onto main + push needed. |
| PROTOCOL.md `Version History` row for v5.7.1 | ✅ shipped 8 May | Live repo, no PR — direct Number One commit. Doorman flow on hardware + §16 Tier 1 PWA shell + audit mode + auto-staff-sign-in covered in one row. |
| OAuth identity link / §14.18 | `v5.8.0` (when shipped) | OAuth optional read-only identity proof + multi-account recovery quorum |
| Offline-capable operation / §16 | ✅ ratified 6 May | `PROTOCOL.md §16`. Tier 1 PWA shell shipped (v5.7.1a/e). Tiers 2 (IndexedDB write queue, `v5.5.12`), 3 (cached snapshot), 4 (multi-device mesh) pending. |
| Tier 2 of §16 (IndexedDB queue + offline indicator) | `v5.5.12` (queued) | The genuinely-new capability the offline proposal promised. Queue Worker POSTs when offline, Background Sync replay on reconnect, blinking-red-dot indicator from §16.5. |
| **Theming Batches 6.5b–6.5f** (test env) | `v5.5.x` patch range | **Not roadmap-v6.5.** This is a label collision — the theming work is visual customisation under v5.5, unrelated to the roadmap's v6 (multi-witness time + trust network). When this work consolidates and lands in live, it gets a clean `v5.5.x` tag. |
| Batch 1–16 (old numbering, late April) | Legacy | All shipped or superseded by v5/v5.5 work; archived briefs preserve historical labels |
| Polish 1–10 (test env, late April) | `v5.5.x` sub-range | UX-tightening rounds in `OrgCheckin.html` |

---

## Roadmap (forward)

| Major | Theme | Score cap | Status |
|---|---|---|---|
| **v3** | Base ECDSA P-256 + Haversine + 90s window | 20/100 | Live since first ship |
| **v4** | Trust history + bio-metric gate | 50/100 | Live since 17 April 2026 |
| **v5** | Hardware-backed signing (WebAuthn / Passkeys) | 70/100 | **LIVE since 2 May 2026** |
| **v5.5** | Identity-Bound Sessions (QR-scan login, Bearer sessions, doorman primitives, audit board) | (no score change) | **In test env, ready for live port** |
| **v5.6** | AssistQR (staff-mediated check-in path for unrecognised attendees) | (no score change) | In flight (Mr. Data) |
| **v5.7** | Doorman flow + audit board + offline tiers (PWA shell, write queue, cached snapshot) + customization panel | (no score change) | **In test env, ready for live port** |
| **v5.8** | OAuth identity link + recovery quorum (§14.18, refined 9 May to user-held-envelope GDPR-clean shape) | (no score change) | Spec ratified; implementation queued |
| **v5.9** | **Live port chapter** — promote test env work to `irlid.co.uk`, extend `receipt.html` to render org-checkin envelopes alongside co-presence receipts (Captain's *"event receipts on the receipts page"* goal), W3C compliance threading throughout | (no score change) | **Next major chapter** |
| **v6** | Trust network + multi-witness time anchoring + multi-party custody (drop-off, prison transfers) + IoT/drones (hardware attestation, drone delivery proof — ASE Tech / Wisdom-gated) + zone-gated VIP access (Captain's *"raised eyebrow"* idea) | 75–90/100 | Roadmap (post v5.9 live port) |
| **v7** | Zero-knowledge proofs (coordinate hiding → Schnorr → full ZK) | 100/100 | Roadmap |
| **v8+** | Founders' Quorum / regency / long-term succession (`LONG-TERM-SUCCESSION.md`) | (governance, not score) | Sketch |

*Versioning refinement 9 May 2026 (Captain's call): v6 was previously bundling "live port" with "trust network themes" — two distinct chapters in one bucket. Split: v5.9 carries the live port (the foundation), v6 stays cleanly the trust-network research-grade work that builds on top.*

Within each major, minors carry whole features and patches carry fixes/polish.

---

## Glossary (current concepts)

- **Identity-Bound Sessions** (v5.5) — QR-scan login flow that binds org-portal sessions to a hardware-backed device, using IRLid's own primitives. Self-bootstrapping via `BOOTSTRAP_DEVELOPER_FP` env var. PROTOCOL.md §14.
- **AssistQR** (v5.6) — staff-mediated check-in path for unrecognised attendees. Phone shows signed assist QR; staff scans; staff picks from expected list, creates new attendee, or rejects. PROTOCOL.md §15 (TBD when implementation begins).
- **Doorman flow / §14.17** (v5.7) — three-outcome state machine when staff scans an attendee at the door: green (recognised + allowed), red (recognised + not allowed), orange (unrecognised, escalate). Role-tiered Add capability (staff = Attendee, manager = + Staff, lead_admin = + Manager + Lead Admin).
- **OAuth identity link / §14.18** (v5.8) — optional second-tier identity proof. "Hardware signs, OAuth identifies." Three-tier proof model: Tier 1 hardware credential (write authority), Tier 2 OAuth identifier (read only), Tier 3 multi-account recovery quorum (4-of-5 default).
- **Bearer session** — opaque 32-byte session token issued after QR-scan login; sliding 24h TTL. Replaces Staff HELLO for Developer; lives alongside Staff HELLO for Lead Admins (until v5.6 invite-token batch).
- **Staff HELLO** — legacy staff-side authentication scan; being phased toward Bearer-replaces-Staff-HELLO via Polish 11 / `v5.5.x`.
- **Bootstrap fingerprint** — `BOOTSTRAP_DEVELOPER_FP` env var on the Worker; recognises Captain's `pub_fp` at platform-level for first-time setup of a Developer account.
- **Lead Admin invariant** — every org has at least one Lead Admin; no upper bound; cannot orphan an org. Worker returns `409 would_orphan_org` on attempts to remove the last Lead Admin without handover. PROTOCOL.md §14.9.
- **Regency** — the long-term-succession mode. Captain leaves a sealed envelope; Quorum operates in INTERIM mode until the AI-witness layer releases the envelope. `LONG-TERM-SUCCESSION.md`.

---

## What this file replaces

- The "Current state pointers" section in `MEMORY.md` (which was dated 26 April 2026 and stale at "live version is v4")
- Ad-hoc version-mapping notes in session logs and successor letters
- The need to mentally reconstruct "which Batch was that and what version is it now"

`MEMORY.md` should now point here for current state; this file is refreshed end-of-watch (or on demand when something material changes).
