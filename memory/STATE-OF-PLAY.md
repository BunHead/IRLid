# State of Play — IRLid

**Last refreshed:** 6 May 2026 night watch — doorman flow verified end-to-end on real hardware.
**Purpose:** Single-glance answer to "what are we doing and why." Skim this at session start before anything else operational. Detail lives in `PROTOCOL.md`, `CLAUDE.md`, `memory/pending-work.md`.
**Authority:** This file is the canonical mapping of legacy labels (Batch A/B/C, Polish 1–11, Batch 1–16) to the new `vX.Y.Z` convention. Other files defer to it.

---

## Live (irlid.co.uk)

| Item | State |
|---|---|
| Protocol version | **v5** — hardware-backed signing via WebAuthn / Passkeys |
| Live since | 2 May 2026 |
| Score with v5 features active | up to 70/100 |
| Verified surfaces | Edge + Chrome + Windows Hello on Windows 11; Chrome + Pixel 8 Pro fingerprint on Android 10 |
| Last meaningful change | v5 deploy + three-browser production verification (2 May) |

---

## Test environment (bunhead.github.io/IRLid-TestEnvironment)

| Item | State |
|---|---|
| Active version | **v5.5** (Identity-Bound Sessions) live; **v5.7.0** (Doorman flow) verified end-to-end on real hardware 6 May night; **v5.6** (AssistQR) in flight |
| Last shipped piece | `v5.7.0p` — dashboard polish series (compaction, GDPR default tab, cascading delete record, live webcam scanner, Role column, button alignment) shipped across v5.7.0e–p commits 6 May night. Camera viewport renders cleanly; QR decoding from USB webcam is a hardware-side limitation (phones decode reliably, USB webcams less so — typical of consumer optics). |
| Codex worker | `irlid-api-test` — connected to D1 `irlid-db-test` |

---

## In flight

| Track | Owner | Tag | Brief | State |
|---|---|---|---|---|
| AssistQR / §15 | Mr. Data | `v5.6.0` | `IRLid-TestEnvironment\HANDOVER-AssistQR.md` | Codex branches `codex/assistqr-*`; spec → Worker → phone → dashboard, four-PR stack |
| Doorman flow verification | ✅ Done 6 May night | `v5.7.0c` + `v5.7.0c-fix` | (closed) | Mr. Data's PR #91 + #92 relocated widget and added diagnostics; Number One's `a303116` killed the decompression hang. Real-hardware test passed on Pixel 4a. |
| Multi-key bind UI in escalation modal | Mr. Data candidate | `v5.7.0d` | (brief in `pending-work.md`) | Logged 6 May night — escalation modal currently filters out claimed Expected rows so 2nd-device scans force duplicates. Surface bind-additional-key UI; Worker endpoint already exists from `v5.7.0a`. |
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
| OAuth identity link / §14.18 | `v5.8.0` (when shipped) | OAuth optional read-only identity proof + multi-account recovery quorum |
| Offline-capable operation / §16 | (proposal drafted 6 May) | `OFFLINE-MODE-PROPOSAL.md` candidate at repo root awaiting Captain's ratification |
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
| **v5.5–v5.9** | Identity-Bound Sessions, AssistQR, Doorman, OAuth identity | (no score change) | v5.5 in test |
| **v6** | Multi-witness time anchoring + trust network + multi-party custody (drop-off, prison transfers) + IoT/drones (hardware attestation, drone delivery proof — ASE Tech / Wisdom-gated) | 75–90/100 | Roadmap |
| **v7** | Zero-knowledge proofs (coordinate hiding → Schnorr → full ZK) | 100/100 | Roadmap |
| **v8+** | Founders' Quorum / regency / long-term succession (`LONG-TERM-SUCCESSION.md`) | (governance, not score) | Sketch |

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
