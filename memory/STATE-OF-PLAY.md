# State of Play — IRLid

**Last refreshed:** Thursday 14 May 2026 late evening — **`v5.10.0.5` LIVE on irlid.co.uk; Phase 0 per-action WebAuthn HARDWARE-PROVEN end-to-end on production with multiple devices and cycle stress.** Two real-device smokes passed tonight: Kerry Austin's 4a fp bound + check-in via 8 Pro signature; Spencer Austin's check-in attempt bound + check-in via 8 Pro signature. Captain then cycled both through signed check-OUT (`OUT lock signed`) → fresh check-IN (scan_count=2). Three Worker bug fixes earlier today (v5.10.0.4 body-pass refactor + v5.10.0.5 bootstrap-fp implicit-developer-role) closed the silent-fail rabbit hole. Late evening: recovery from corrupted `BOOTSTRAP_DEVELOPER_FP` secret (single-fp clean rotation to 8 Pro's current fp `n4FzIhV_1jc2u_HO`); D1 hygiene pass (display_name update, 2 phantom portal_users + 1 stale login_session purged, 12-15 testing org_checkins rows purged); dashboard now clean — 2 attendance rows from tonight's smokes + Poppy linked expected. **Open architectural question (next watch): v5.10.1 Path B — separate signature (non-repudiation) from authority (Bearer session resolution) in `requireSignedAction` so any device with a developer-tier session can sign manager actions without needing its fp in `BOOTSTRAP_DEVELOPER_FP`.** Currently only Captain's 8 Pro (fp `n4FzIhV_1jc2u_HO`) can sign per-action bind/invite envelopes — desktop binding remains broken until Path B lands. **Earlier today** Mr. Data's stale `OrgCheckin.html` baseline clobbered the `.13.x` celebration overhaul on the v5.9.14 ship; caught + reverted within ~10 min, hand-ported additive invite work onto the clean `.13.34` baseline.

**Earlier:** Wednesday 13 May 2026 evening — **`v5.9.0.13.34` LIVE on irlid.co.uk; eight PRs shipped today, demo didn't happen (Donald no-show at imbue), three briefs queued for upcoming watches.** Briefs at repo root: **A** `HANDOVER-StaffInviteQR.md` (`v5.9.0.14` — first-class multi-device staff enrolment via one-shot signed invite QR, Lead-Admin-only issuer, replaces the multi-fp `BOOTSTRAP_DEVELOPER_FP` workaround); **A1** `HANDOVER-SettingsRoleGatingRefactor.md` (`v5.9.0.15` — open Settings to Manager-tier with per-item `data-min-role` gating, depends on A merging first); **A2** `HANDOVER-AdminActionAuditLog.md` (`v5.9.0.16` — single canonical `org_admin_audit` table + retrofit logging hooks + Settings UI surface). **Brief B (Lead Admin swap)** is fully scoped in chat but not yet written to a file: Developer-only, soft-lockdown end-of-window behaviour, old-Lead-Admin-can-block, in-app banner notifications (no email). **Spec change to formalise in PROTOCOL.md §14.9 next watch:** Lead Admin invariant tightened from "at least one, no upper bound" to **"exactly one Lead Admin per org, except during a Developer-mediated swap window"** — enforced forward by Brief A rejecting any `role=lead_admin` invite with `400 lead_admin_invite_deferred`. **Anomaly worth banking:** `.29` GIF support (branch `codex/v5.9.0.13.29-gif-support` at `6d54c97`) holds unshipped GIF code; brief lives at `HANDOVER-GifSupport.md` in repo root; salvage when GIF feature comes back up. **Operational note for future Number Ones:** the bash sandbox mount caches stale views of OneDrive-synced files — use Read/Write/Edit/Grep/Glob (Windows-native) for working-tree inspection on this repo, not bash. Captain's Windows-side Git has `core.autocrlf=true` so CRLF/LF drift is invisible from PowerShell; line-endings are healthy.

**Earlier:** Tuesday 12 May 2026 ~22:45 demo-eve final — **`v5.9.0.13.26` LIVE; Mr. Data turbo'd two queued briefs into PRs awaiting review.** PR #13 (`v5.9.0.13.27` — symmetric background image) and PR #14 (`v5.9.0.13.28` — role vocabulary carries to Viewing-as + role pills). Late-night idea stream banked in `pending-work.md` (logo wobble / GIF import / WAV on accept / particle-dissolve QR / glow trail / layer system). Captain's local main also had Number One's multi-fp Worker patch + pill bump + brief files + memory updates ready to push. Demo Wednesday 13 May still uncertain at this point.

**Purpose:** Single-glance answer to "what are we doing and why." Skim this at session start before anything else operational. Detail lives in `PROTOCOL.md`, `CLAUDE.md`, `memory/pending-work.md`.

**Authority:** This file is the canonical mapping of legacy labels (Batch A/B/C, Polish 1–11, Batch 1–16) to the new `vX.Y.Z` convention. Other files defer to it.

*(Older watch-by-watch historical entries removed in the 13 May 2026 evening prune. Recover with `git log --all -p memory/STATE-OF-PLAY.md` if needed for forensics.)*

---

## Live (irlid.co.uk)

| Item | State |
|---|---|
| Protocol version | **v5** — hardware-backed signing via WebAuthn / Passkeys |
| Consumer site live since | 2 May 2026 |
| **Org dashboard live since** | **10 May 2026 (v5.9 — Path A live port)** |
| Score with v5 features active | up to 70/100 |
| Verified surfaces | Edge + Chrome + Windows Hello on Windows 11; Chrome + Pixel 8 Pro fingerprint on Android 10 |
| Last meaningful change | **`v5.10.0.5`** (14 May late evening, Worker version `86f8b430-...`) — `requireSignedAction(body, env, opts)` body-pass refactor (was failing "Invalid JSON" on bind because clone-after-consumption returns drained stream) + bootstrap-developer-fp implicit-developer-role fallback (was failing `insufficient_role` because bootstrap user has no `org_memberships` row). Phase 0 hardware-proven end-to-end same evening. |
| Live Worker (Org dashboard) | `irlid-api-org` at `https://irlid-api-org.irlid-bunhead.workers.dev` |
| Live D1 (Org dashboard) | `irlid-db-org` (`484dad86-e75c-412e-9423-ca0bb27cdcb8`), region WEUR |
| Live Worker (consumer) | `irlid-api` (untouched by v5.9 port — kept production-stable) |
| First seeded org | `0337bf2f-e8a3-48d4-a12b-3f9426354f4f` "Test Event" / slug `imbue-ventures` / api_key `org_1f6acd...4256` |
| Captain's Developer membership | `BOOTSTRAP_DEVELOPER_FP = "n4FzIhV_1jc2u_HO"` (8 Pro only) as of 14 May late-evening rotation. Previous multi-fp setup (`TvklFsivZk68R67j,65u-S-W_NFxr8u1L`) was overwritten with bad content during 13/14 May's debug spiral, recovered with clean single-fp rotation. Desktop binding deferred until v5.10.1 Path B lands. |
| Phase 0 hardware proof | ✅ 14 May late evening — Kerry Austin (4a fp `Zt-xZfDmtKu5Y1sr` bind via 8 Pro signing) + Spencer Austin (Captain's check-in attempt fp bind via 8 Pro signing) + multiple check-in/out/in cycles with signed `OUT lock signed` round-trips |

---

## Test environment (bunhead.github.io/IRLid-TestEnvironment)

| Item | State |
|---|---|
| Active version | **v5.5.12** (Tier 2 offline write queue + indicator) verified end-to-end on hardware 8 May; **v5.7.1h** (audit board) verified on Huawei tablet 8 May; **v5.6** (AssistQR) in flight |
| Codex Worker | `irlid-api-test` — connected to D1 `irlid-db-test` |

---

## In flight

| Track | Owner | Tag | Brief | State |
|---|---|---|---|---|
| **Per-action auth Path B** | Number One / Mr. Data | **`v5.10.1`** | (not yet briefed — write next watch) | **Top priority.** `requireSignedAction` accepts Bearer-resolved developer authority. Signature proves device acted; authority comes from session token. Unlocks desktop binding without per-device bootstrap-fp dance. ~30 lines Worker + PROTOCOL.md doc update. |
| Per-action auth Phase 1-5 | Number One / Mr. Data | `v5.10.x` | `HANDOVER-PerActionAuth.md` (repo root, from 13 May watch) | Gated on Path B. Phases: settings save, delete/invite, shift mgmt + `org_shifts` table, audit log integration, Staff HELLO retirement. |
| Staff-invite QR (Brief A) | Mr. Data (queued) | `v5.9.0.14` | `HANDOVER-StaffInviteQR.md` (repo root) | Ready to fire — Worker endpoints + `org_invites` D1 table + Settings modal + `scan.html` `I:` payload handler. Lead-Admin-only issuer. |
| Settings role-gating refactor (Brief A1) | Mr. Data (queued, depends on A) | `v5.9.0.15` | `HANDOVER-SettingsRoleGatingRefactor.md` (repo root) | Fire after A merges. Opens Settings to Manager with per-item `data-min-role` gating. |
| Admin action audit log (Brief A2) | Mr. Data (staged) | `v5.9.0.16` | `HANDOVER-AdminActionAuditLog.md` (repo root) | Cross-cutting forensic log. Retrofits A's invite + A1's settings-save + future B's swap events. |
| Lead Admin swap (Brief B) | Not yet briefed | TBD | (scoped in chat, not yet a file) | Developer-only with 1-hour overlap window, soft-lockdown past window, old-Lead-Admin-can-block. |
| AssistQR / §15 | Mr. Data | `v5.6.0` | `IRLid-TestEnvironment\HANDOVER-AssistQR.md` | Codex branches `codex/assistqr-*`; four-PR stack. |
| GIF support (unshipped, salvage candidate) | Held | `v5.9.0.13.29` | `HANDOVER-GifSupport.md` (repo root) | Branch `codex/v5.9.0.13.29-gif-support` at `6d54c97` holds the work; never merged. |
| YubiKey enrolment | Mr. La Forge | TBD | `IRLid-TestEnvironment\HANDOVER-YubiKey.md` | Awaiting La Forge commissioning |
| GPS-nearest-staff on orange screen | Open (v6 design) | `v6.0+` | (no brief — design captured in pending-work) | |
| Worker-mediated assist alternative | Open (v6 design) | `v6.0+` | (no brief — design captured in pending-work) | Captain's "Notify staff" alternative to QR scan. |
| Offline-capable operation / §16 | ✅ Tiers 1+2 shipped; 3+4 pending | Tier 3 `v5.5.x`+ | `PROTOCOL.md §16` (ratified 6 May) | Cached snapshot (Tier 3) + multi-device mesh (Tier 4) future. |

---

## Spec branches not yet on main

*(Empty — all current spec branches merged. PR #2 / `no1/protocol-1409-1417-regency` was the last; merged 5 May.)*

---

## Historical mapping (legacy → vX.Y.Z)

These labels appear in past commits, milestones, archived briefs, and PR titles. New work uses the right column.

| Legacy label | Maps to | Notes |
|---|---|---|
| Batch A | `v5.5.0` | §14 spec + Identity-Bound Sessions schema/endpoints (4 May) |
| Batch B | `v5.5.1` | Phone-side `org-login.html` + admin portal QR sign-in (4 May) |
| Batch C | `v5.5.2` | `/user/orgs` + `/user/create-org` Bearer endpoints (4 May) |
| Batch C polish 1–10 | `v5.5.3` | Settings persistence diagnostic + UI tightening (5 May) |
| Polish 11 Task 2 | `v5.5.4` | Full Bearer auth sweep across staff-gated endpoints |
| Polish 11 Task 1 | `v5.5.5` ✅ shipped 6 May | Settings persistence round-trip |
| Polish 11 Task 3 | `v5.5.6` (when shipped) | Staff HELLO QR upload (jsQR-decoded) |
| Batch C.5 (staff scan-in) | `v5.5.7` (when shipped) | Spec'd in §14.13 |
| Batch D (theme scrape) | `v5.5.8` (when shipped) | Spec'd in §14.13 |
| Save All Settings unify (theme) | `v5.5.10` ✅ shipped 6 May | Both buttons send full payload incl. theme |
| Role-gating button visibility | `v5.5.11` ✅ shipped 6 May | Hide role-gated buttons when role doesn't permit |
| Tier 2 of §16 (IndexedDB queue) | `v5.5.12` ✅ shipped 8 May | Offline write queue + indicator |
| AssistQR / Batch C.6 | `v5.6.0` (in flight) | Assist modal + §15 spec |
| Doorman / §14.17 | `v5.7.0a..d` ✅ shipped 6–8 May | Multi-key binding, phone orange QR, escalation modal, multi-key bind UI |
| Live `scan.html` universal ingress | `v5.7.1` ✅ shipped 6 May | URL-aware `classify()` |
| PWA shell / Tier 1 of §16 | `v5.7.1a/e` ✅ shipped 7 May | `sw.js` + `manifest.json` + SW registration |
| Audit board / fullscreen mode | `v5.7.1h` ✅ shipped 8 May | Verified on Huawei tablet |
| `sign.js` consolidation | `v5.7.1i` ✅ shipped 8 May | PR #93 — doorman helpers deleted, canonical `js/sign.js` used |
| OAuth identity link / §14.18 | `v5.8.0` (queued) | OAuth optional read-only identity + multi-account recovery quorum |
| Live port chapter | `v5.9.x` — **THIS CHAPTER** | Test env work promoted to `irlid.co.uk` |
| Trust network + multi-witness | `v6.x` (post-v5.9) | Multi-party custody + IoT/drones + ZK roadmap |
| Theming Batches 6.5b–6.5f | `v5.5.x` patch range | Label-collision note: theming is `v5.5`, NOT roadmap-`v6.5` |
| Batch 1–16 (late April) | Legacy | All shipped or superseded by v5/v5.5; archived briefs preserve historical labels |
| Polish 1–10 (test env, late April) | `v5.5.x` sub-range | UX tightening in `OrgCheckin.html` |

---

## Roadmap (forward)

| Major | Theme | Score cap | Status |
|---|---|---|---|
| **v3** | Base ECDSA P-256 + Haversine + 90s window | 20/100 | Live since first ship |
| **v4** | Trust history + bio-metric gate | 50/100 | Live since 17 April 2026 |
| **v5** | Hardware-backed signing (WebAuthn / Passkeys) | 70/100 | **LIVE since 2 May 2026** |
| **v5.5** | Identity-Bound Sessions (QR-scan login, Bearer sessions, doorman primitives, audit board) | (no score change) | **In test env, ready for live port** |
| **v5.6** | AssistQR (staff-mediated check-in path for unrecognised attendees) | (no score change) | In flight (Mr. Data) |
| **v5.7** | Doorman flow + audit board + offline tiers + customization | (no score change) | **In test env, ready for live port** |
| **v5.8** | OAuth identity link + recovery quorum (§14.18) | (no score change) | Spec ratified; implementation queued |
| **v5.9** | **Live port chapter** — promote test env work to `irlid.co.uk`; `receipt.html` extension to render org-checkin envelopes alongside co-presence receipts | (no score change) | **In progress — `v5.9.0.13.34` LIVE; `.14`/`.15`/`.16` briefs queued** |
| **v6** | Trust network + multi-witness time anchoring + multi-party custody + IoT/drones + zone-gated VIP access | 75–90/100 | Roadmap (post v5.9 live port) |
| **v7** | Zero-knowledge proofs (coordinate hiding → Schnorr → full ZK) | 100/100 | Roadmap |
| **v8+** | Founders' Quorum / regency / long-term succession (`LONG-TERM-SUCCESSION.md`) | (governance, not score) | Sketch |

Within each major, minors carry whole features and patches carry fixes/polish.

---

## Glossary (current concepts)

- **Identity-Bound Sessions** (v5.5) — QR-scan login flow that binds org-portal sessions to a hardware-backed device. Self-bootstrapping via `BOOTSTRAP_DEVELOPER_FP` env var. PROTOCOL.md §14.
- **AssistQR** (v5.6) — staff-mediated check-in path for unrecognised attendees. Phone shows signed assist QR; staff scans; staff picks from expected list, creates new attendee, or rejects. PROTOCOL.md §15.
- **Doorman flow / §14.17** (v5.7) — three-outcome state machine when staff scans an attendee at the door: green (recognised + allowed), red (recognised + not allowed), orange (unrecognised, escalate). Role-tiered Add capability.
- **OAuth identity link / §14.18** (v5.8) — optional second-tier identity proof. "Hardware signs, OAuth identifies." Tier 1 hardware credential (write authority), Tier 2 OAuth identifier (read only), Tier 3 multi-account recovery quorum (4-of-5 default).
- **Bearer session** — opaque 32-byte session token issued after QR-scan login; sliding 24h TTL. Replaces Staff HELLO for Developer.
- **Staff HELLO** — legacy staff-side authentication scan; being phased toward Bearer-replaces-Staff-HELLO via Polish 11 / `v5.5.x`.
- **Bootstrap fingerprint** — `BOOTSTRAP_DEVELOPER_FP` env var on the Worker; recognises Captain's `pub_fp`(s) at platform-level for first-time setup of a Developer account. Multi-fp comma-separated since 12 May `.26`.
- **Lead Admin invariant** — *(tightened 13 May 2026 evening)* exactly one Lead Admin per org at any normal time; up to two only during a Developer-mediated swap window (Brief B). PROTOCOL.md §14.9 update pending.
- **Staff-invite QR** (v5.9.0.14, queued) — `I:`-prefixed signed envelope; Lead Admin generates, new staff scans, device binds via WebAuthn, role assigned. One-shot, short-lived expiry.
- **Regency** — long-term-succession mode. Captain leaves a sealed envelope; Quorum operates in INTERIM mode until the AI-witness layer releases it. `LONG-TERM-SUCCESSION.md`.

---

## What this file replaces

- The "Current state pointers" section in `MEMORY.md` (which was dated 26 April 2026 and stale at "live version is v4")
- Ad-hoc version-mapping notes in session logs and successor letters
- The need to mentally reconstruct "which Batch was that and what version is it now"

`MEMORY.md` should now point here for current state; this file is refreshed end-of-watch (or on demand when something material changes).
