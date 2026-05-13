# Archive INDEX

A manifest of what's in `archive/` and where to find things if you remember the topic but not the filename. Maintained at every prune.

**Quick rule for finding things:**

- Current state → `memory/STATE-OF-PLAY.md`
- Current backlog → `memory/pending-work.md`
- Partnership / bridge crew / how to work with Captain → `CLAUDE.md`
- Protocol spec → `PROTOCOL.md`
- Operational pitfalls / Ctrl+V traps / git hazards → `BOOTSTRAP.md`
- Long-term direction / unreleased ideas → `DREAMS.md`
- Long-term succession / regency → `LONG-TERM-SUCCESSION.md`
- Threat model → `THREAT-MODEL.md`
- Active feature briefs → `HANDOVER-*.md` at repo root
- **Historical material** → this archive (see below)
- **Even older material** → `git log -p` on the relevant file or `git log --all` for branches

---

## Shipped briefs (each describes a PR that landed in `main`)

| File | Version | What it shipped |
|---|---|---|
| `HANDOVER-BackgroundSymmetric.md` | `v5.9.0.13.27` / PR #13 | Symmetric background image — mirror across centre toggle, dragon/skull bookend effect. |
| `HANDOVER-RoleLabelsCarryOver.md` | `v5.9.0.13.28` / PR #14 | Role vocabulary labels carried into "Viewing as" dropdown + role-pill tooltips/initials. |
| `HANDOVER-SymmetryModes.md` | `v5.9.0.13.32` / PR #18 | Symmetry mode picker (Off / Horizontal / Vertical / Quad). |
| `HANDOVER-RoleVisibilityAndCSV.md` | `v5.9.0.13.33` / PR #19 | Role-column visibility flipped, GDPR initials via `nameForViewer()`, CSV sort-by-surname + role-filter dropdown. |
| `HANDOVER-HideViewingAsForNonDevs.md` | `v5.9.0.13.34` / PR #20 | Production lockdown: hide "Viewing as" prototype-role toolbar/dock/detail/strip for non-developers. CSS-only single-block gate. |
| `HANDOVER-Batch5-Worker.md` | Late-April legacy Batch 5 | Worker schema/endpoint work, superseded by v5.5 architecture. |
| `HANDOVER-Batch6.md` | Late-April legacy Batch 6 | Bake-off candidate brief for La Forge vs Mr. Data; never executed in this form. |
| `HANDOVER-Batch12.md` | Late-April legacy Batch 12 | Pre-v5 batch numbering. |
| `HANDOVER-Batch14-15-16.md` | Late-April legacy Batches 14/15/16 | Pre-v5 batch numbering. |

## Older proposals (now ratified into PROTOCOL or superseded)

| File | What it proposed | Outcome |
|---|---|---|
| `OFFLINE-MODE-PROPOSAL.md` | Four-tier offline-capable operation (PWA shell, write queue, cached snapshot, multi-device mesh) | Ratified 6 May → PROTOCOL.md §16. Tiers 1+2 shipped; 3+4 future. |
| `v5-PASSKEYS-PROPOSAL.md` | Hardware-backed signing via WebAuthn / Passkeys | Ratified → PROTOCOL.md §13 / v5. Live since 2 May 2026. |
| `PRE-LAUNCH-AUDIT-2026-05-03.md` | Pre-launch audit of consumer site | Captured what was ready before 2 May launch. Historical. |
| `ORG-AUDIT-2026-05-03.md` | Org dashboard schema/code audit | Drove the v5.5 Identity-Bound Sessions work. Historical. |
| `AUDIT-2026-05-05-eve.md` | Audit of state at 5 May evening | Superseded by subsequent STATE-OF-PLAY refreshes. |

## Resolved bug dossiers / context files

| File | Topic | Resolution |
|---|---|---|
| `open-bug-doorman-bind-2026-05-12.md` | Doorman bind flagged as silently failing at ~2am 12 May | Resolved 12 May evening — desktop path worked first try once Captain pasted an old orange QR. Two independent fresh-bind successes proven on `v5.9.0.13.25`. |
| `demo-smoke-test-2026-05-13.md` | Pre-demo smoke test checklist for the 13 May imbue demo | Demo didn't happen (Donald no-show). Checklist kept as template for future demos. |

## Archived UI artefacts

| File | What it is |
|---|---|
| `mockup-escalation-modal.html` | One-shot HTML mockup used to design the escalation modal action-label styling for `v5.9.0.13.22`. Shipped to live; mockup retained as design reference. |

## Older successor letters (`archive/letters/`)

Daily-ish "Number One to Number One" handover letters from when this watch-by-watch pattern got established. Keep the 3 most recent in `memory/letters/`; older ones live here. Each captures the state of the ship + Captain's mood + what the next Number One should reach for first.

| Date | File | Note |
|---|---|---|
| 2026-05-05 | `successor-2026-05-05-02.md`, `successor-2026-05-05-03.md` | Same day, two watches. |
| 2026-05-08 | `successor-2026-05-08.md`, `successor-2026-05-08-02.md` | Test-env v5.5.12 + v5.7.1h day. |
| 2026-05-09 | `successor-2026-05-09.md` | v5.5.8 ship. |
| 2026-05-10 | `successor-2026-05-10.md`, `successor-2026-05-10-02.md`, `successor-2026-05-10-03.md` | Live port `v5.9` first ship day, three watches. |
| 2026-05-11 | `successor-2026-05-11.md` | Morning watch close, seven patches in one watch. |

The most recent three (`2026-05-12`, `2026-05-13`, `2026-05-13-02`) remain in `memory/letters/` — current operational context.

## Archived session logs (`archive/sessions/`)

Working session transcripts / per-session notes from the early phase of the project. All from 26 April → 9 May 2026. Captain previously used these as scratchpads during long working sessions; the pattern was largely replaced by successor letters + STATE-OF-PLAY refreshes. Files are dated `YYYY-MM-DD-NN.md`.

---

## Topic-based navigation (find by what you remember)

If you remember the **topic** but not where it was discussed, start here.

### Celebration animation architecture
- The orthogonal-effects rewrite (6 checkboxes: Pulse / Background / QR / Glow / Pattern / Text) happened across 13 inline patches `v5.9.0.13.1` → `.13` on Tuesday 12 May 2026 mid-afternoon. Detail in `memory/pending-work.md` (top section under "Tuesday 12 May 2026 mid-afternoon watch"). For even earlier celebration-overhaul context: `git log -p --all -- '*celebration*'`.

### Doorman flow / orange QR / escalation
- Shipped 6 May 2026 across `v5.7.0a..d` plus `v5.7.1a..i`. Briefs at `IRLid-TestEnvironment/HANDOVER-DoormanEscalation.md`, `HANDOVER-MultiKeyBindUI.md`, `HANDOVER-OrangeQRPayloadStrip.md`. Resolved bug dossier above for the 12 May bind issue.

### v5.9 live port (the chapter we're in)
- The port from test env to `irlid.co.uk` started ~10 May (`v5.9.0.x` series). Top of `STATE-OF-PLAY.md` always has current state. Historical detail across the archived letters from 10–11 May and `git log -- '*OrgCheckin*'`.

### Identity-Bound Sessions / QR-scan login / Bearer sessions
- Core spec at `PROTOCOL.md §14`. Implementation history: `v5.5.0..v5.5.12` series; deepest detail in `git log -p` between commits 4 May (Batch A) and 8 May (v5.5.12 Tier 2 IndexedDB queue).

### Offline mode / §16
- Ratified spec at `PROTOCOL.md §16`. Original proposal at `archive/OFFLINE-MODE-PROPOSAL.md`. Tier 1 shipped `v5.7.1a/e`. Tier 2 (IndexedDB write queue) shipped `v5.5.12`. Tiers 3+4 pending.

### Multi-fp `BOOTSTRAP_DEVELOPER_FP` (developer-tier on multiple devices)
- Shipped 12 May evening as `v5.9.0.13.26`. Comma-separated secret accepts both desktop fp `TvklFsivZk68R67j` and 8 Pro fp `65u-S-W_NFxr8u1L`. Worker helpers `bootstrapDeveloperFps(env)` + `isBootstrapDeveloperFp(env, pub_fp)`. See `git show 76a0f20` for the commit.

### GIF support (unshipped, still pending)
- Brief at `HANDOVER-GifSupport.md` (repo root, still active). Branch `codex/v5.9.0.13.29-gif-support` at `6d54c97` holds the code. Never merged. Salvage when feature comes back up.

### Staff-invite QR / multi-device staff enrolment (queued)
- Brief at `HANDOVER-StaffInviteQR.md` (repo root). Will become `v5.9.0.14`. Lead-Admin-only issuer.

### Settings role-gating refactor (queued, depends on staff-invite)
- Brief at `HANDOVER-SettingsRoleGatingRefactor.md` (repo root). Will become `v5.9.0.15`. Opens Settings to Manager-tier with per-item `data-min-role` gating.

### Admin action audit log (staged)
- Brief at `HANDOVER-AdminActionAuditLog.md` (repo root). Will become `v5.9.0.16`. Cross-cutting forensic log retrofitted onto invite / settings-save / swap events.

### Lead Admin swap (Brief B — scoped but not yet briefed)
- Captain's call 13 May evening: invariant tightened to "exactly one Lead Admin per org, except during a Developer-mediated swap window." End-of-window behaviour: soft-lockdown. Old Lead Admin can block. In-app banner notifications only (no email). Detail in `memory/pending-work.md`'s 13 May evening close entry.

### PROTOCOL.md spec branches and historical work
- `no1/protocol-1409-1417-regency` was merged 5 May via PR #2 — §14.9 expansion (Lead Admin invariant), §14.17 doorman flow, §14.18 OAuth/recovery quorum. Branch deleted 13 May evening prune; content lives in `PROTOCOL.md` and in the merge commit.

### Theming / customization
- `THEMING-SPEC-2026-05-03.md` at repo root carries the spec. Theming Batches 6.5b–6.5f map to `v5.5.x` patch range — NOT roadmap-v6.5 (label collision). See `STATE-OF-PLAY.md` Historical mapping table.

---

## How to maintain this index

After every prune that moves files into `archive/`, update the relevant section here. If a topic doesn't have a section yet but archived material covers it, add one to the "Topic-based navigation" section above. Keep entries terse — one or two lines, with the path or commit SHA so future-you can grep or `git show` quickly.

The index is itself committable and prunable — but it should grow alongside the archive, not shrink. The goal is "if it's been said somewhere, INDEX.md knows where."
