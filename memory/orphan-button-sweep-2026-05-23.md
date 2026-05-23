# Orphan-button sweep — Saturday 23 May 2026

**Author:** Number One.
**Scope:** `OrgCheckinTest.html` at build `v5.11 mockup T4.3.61` cross-checked against live `OrgCheckin.html` at `v5.10.7`.
**Purpose:** Inventory every button across the two surfaces; classify each as wired / orphan / live-backed / intentional-placeholder. Provide port-time disposition guidance for the calendar-port HANDOVER drafter.
**Captain's directive (paraphrased):** sweep `OrgCheckinTest.html` for placeholder buttons with no action; for each decide direct-wire-during-port / hide / wire to demo modal / `(live — backed)` hint. Cross-check live `OrgCheckin.html` for feature parity; verify mockup buttons would receive correct inputs when wired during port.

---

## §1 — Headline findings

The mockup is in **remarkably good shape**. Of 75 button-IDs in `OrgCheckinTest.html`:

- **74 are wired** (event listener attached or inline `onclick` defined).
- **1 is intentionally disabled placeholder** (`websiteScrapeBtn` — copy says "(coming soon)").
- Plus **2 additional disabled placeholders without IDs** (Upload banner, Extract palette + logo) — both inside the Brand polish expander, both styled `opacity: 0.6`, parent labelled IN-DESIGN.

**No silent orphans.** Every visible button either fires its handler, is explicitly disabled with disclosure copy, or is part of the placeholder set Captain has already designed-in as `IN-DESIGN`.

Captain's earlier flag of `inviteStaffBtn` as orphan was a click-but-no-effect: the button opens its dialog correctly (wired to `openInviteStaffDialog`), but the dialog's `Create invite` action calls a Worker endpoint that has no session in the mockup. **It's a live-backed button on a live-backed flow** — works when the port lands and the user has signed in with a Lead Admin role.

---

## §2 — Live-vs-mockup feature parity matrix

### §2.1 In LIVE only (3 buttons)

| Button ID         | Live disposition                                                  | Port decision                                            |
|-------------------|-------------------------------------------------------------------|----------------------------------------------------------|
| `csvBtn`          | Top-toolbar global CSV export (whole-org attendance)              | **Intentionally retired** per Captain's 17 May call — per-event CSV (Import week / Export week in calendar toolbar) replaces it. Do NOT port. |
| `csvUploadBtn`    | Top-toolbar global CSV import (whole-org attendance)              | **Intentionally retired** — same reason as `csvBtn`. Do NOT port. |
| `signInHereBtn`   | Same-device WebAuthn quick-sign-in (hidden by default; shows when same-device session detected) | **Port back into mockup.** Same-device users shouldn't have to QR-scan their own browser. Currently the mockup only offers QR-login. Sub-task for the HANDOVER drafter. |

### §2.2 In MOCKUP only (22 buttons, all NEW for port)

All 22 are correctly wired in the mockup to local logic (localStorage state, in-browser events, scroll handlers). At port time they need to be re-wired to Worker endpoints per `CALENDAR-SPEC.md §2` and `SETTINGS-REVAMP-SPEC.md §2`.

#### Calendar surface (Event & Calendar tab)
| Button ID              | Mockup wiring                                  | Port wiring                                                 |
|------------------------|------------------------------------------------|-------------------------------------------------------------|
| `v511AddEventBtn`      | Opens modal pre-filled for `state.selectedDay` | POST `/org/weekly-events` on Save                           |
| `v511EventSaveBtn`     | Saves modal back into state + localStorage     | POST or PATCH `/org/weekly-events[/:id]` with full body     |
| `v511EventDeleteBtn`   | Removes from state + localStorage              | DELETE `/org/weekly-events/:id` (soft-delete)               |
| `v511EventCancelBtn`   | Closes modal, no save                          | UI-only, no Worker                                          |
| `v511EventCancelTopBtn`| × Close button at top of modal                 | UI-only, no Worker                                          |
| `v511ExportWeekBtn`    | Builds + downloads CSV client-side             | GET `/org/weekly-events/export-csv` (Worker returns CSV)    |
| `v511ImportWeekBtn`    | Reads file, parses, replaces state             | POST `/org/weekly-events/import-csv?replace=1` (multipart)  |
| `v511PrevWeekBtn`      | Decrements `state.weekStartIso` by 7 days      | UI-only, no Worker                                          |
| `v511ThisWeekBtn`      | Resets to current week's Monday                | UI-only, no Worker                                          |
| `v511NextWeekBtn`      | Increments by 7 days                           | UI-only, no Worker                                          |
| `v511WeekStartToggle`  | Toggles week_starts_on 0↔1, re-renders        | PATCH `/org/settings` with new `week_starts_on`             |
| `v511JumpNowBtn`       | Scrolls to Now line in active view             | UI-only, no Worker                                          |

#### Staff & Rooms tab
| Button ID              | Mockup wiring                                  | Port wiring                                                 |
|------------------------|------------------------------------------------|-------------------------------------------------------------|
| `v511AddRoomBtn`       | Adds room to localStorage state, re-renders    | POST `/org/rooms` per `SETTINGS-REVAMP-SPEC §4`             |
| `inviteStaffBtn`       | Opens existing live `openInviteStaffDialog`    | **Already live-wired** — works as-is once port lands. Add to Staff & Rooms tab from the existing live position. |

#### Settings tabs (Org / Visual / Auth / Tools)
| Button ID              | Mockup wiring                                  | Port wiring                                                 |
|------------------------|------------------------------------------------|-------------------------------------------------------------|
| `v511OrgSaveBtn`       | Writes calendar settings to localStorage       | PATCH `/org/settings` with org-tab payload                  |
| `v511VisualSaveBtn`    | Writes theme settings to localStorage          | PATCH `/org/settings` with theme payload (already in live)  |
| `v511AuthSaveBtn`      | Writes auth settings to localStorage           | PATCH `/org/settings` with auth payload                     |
| `v511ToolsSaveBtn`     | Writes tools/diag settings to localStorage     | PATCH `/org/settings` with tools payload                    |

#### Sample / preview (Visual Theming tab)
| Button ID              | Mockup wiring                                  | Port wiring                                                 |
|------------------------|------------------------------------------------|-------------------------------------------------------------|
| `v511SampleBtn`        | Plays animation library + tone preview client-side | UI-only, no Worker                                       |
| `v511WavReplaceBtn`    | Opens file picker, FileReader to data URL      | UI-only, no Worker                                          |
| `v511WavResetBtn`      | Restores default tone for the active mode      | UI-only, no Worker                                          |

### §2.3 In BOTH (53 buttons, no port change needed)

These come from the original `OrgCheckin.html` and are wired identically in mockup and live. The mockup inherits live behaviour:
`refreshBtn`, `auditModeBtn`, `signOutBtn`, `signedInSwitchBtn`, `signedInCreateBtn`, `signedInSignOutBtn`, `qrLoginStartBtn`, `qrLoginCancelBtn`, `orgPickerCreateBtn`, `createOrgSubmitBtn`, `viewBoardBtn`, `clearAttendanceBtn`, `staffAuthBtn`, `staffAuthClearBtn`, `manualCheckinBtn`, `dashboardScanCameraStopBtn`, `dashboardScanCameraStartBtn`, `dashboardScanDecodeBtn`, `dashboardScanSubmitBtn`, `expectedAddBtn`, `themeScrapeBtn`, `themeBgPaletteAdd`, `themeBgPaletteReset`, `themePaletteAdd`, `themePaletteReset`, `themePreviewBgAnim`, `themePreviewAcceptCycle`, `themePreviewDenyCycle`, `themeSampleButton`, `themeSaveBtn`, `copyOutcomeMiniBtn`, `testFireOutcomeBtn`, `savePortalSettingsBtn`, `copyOutcomeUrlBtn`, `copySettingsBtn`, `copyScanUrlBtn`, `resetPortalSettingsBtn`, `websiteScrapeBtn` (intentionally disabled), `inviteStaffCreateBtn`, `inviteStaffCopyBtn`, `inviteStaffRevokeBtn`, `inviteStaffCloseBtn`, `staffHelloCancelBtn`, `staffHelloDecodeBtn`, `staffHelloSubmitBtn`, `expectedCancelDeleteBtn`, `expectedConfirmDeleteBtn`, `escalationCloseBtn`, `escalationAddBtn`, `escalationCancelBtn`, `postResolutionStayBtn`, `auditExitBtn`, `auditRefreshBtn`.

---

## §3 — Delegated buttons (no ID, handler by class or data-attribute)

The mockup uses delegation for several large button groups. Each group is wired via a single parent listener that resolves the target's `data-*` attribute.

| Pattern                        | Count | Wiring                                                            |
|--------------------------------|-------|-------------------------------------------------------------------|
| `data-v511-tab="..."`          | 7     | Tab navigation. Wired via global `.v511-tabs` click listener.     |
| `data-cal-view="..."`          | 2     | List view / Swim-lane view toggle.                                |
| `data-effect="..."`            | 25    | Celebration animation builder library chips.                      |
| `data-pos="..."`               | 18    | 9-cell position grid + role-tier position chips.                  |
| `data-value="..."`             | 32    | Chip-group inputs (palette mode, intensity, working hours preset, etc.) |
| `data-dir="..."`               | 8     | Direction-9 chips inside Celebration effect settings.             |
| `data-mode`, `data-bounce`, `data-trans`, `data-radial` | 8 | Various per-effect chip groups.                                |
| `data-drill-close`             | 1     | Per-event drill-down close button.                                |
| `data-bind-expected-id`, `data-bind-additional-id` | template strings | Escalation modal row clicks; wired by escalation handler. |

All delegated groups verified wired (parent listener exists for each pattern). No orphans.

---

## §4 — Intentional placeholders (3)

These are correctly disclosed as "not yet functional":

| Element                                           | Disclosure                                | Disposition                          |
|---------------------------------------------------|-------------------------------------------|--------------------------------------|
| Org tab > Brand polish > "Upload banner"          | `disabled` + `opacity: 0.6` row           | Wire at port time (image upload UI)  |
| Org tab > Brand polish > "Extract palette + logo" | `disabled` + `opacity: 0.6` row           | Live equivalent (`themeScrapeBtn`) already works — wire mockup version through to it |
| Visual Theming > "Import suggested theme (coming soon)" (`websiteScrapeBtn`) | `disabled` + copy "(coming soon)" | Duplicate of `themeScrapeBtn`? Resolve at port — keep one, retire the other |

---

## §5 — Records & ID tab — special note

Captain's screenshot at watch-open confirmed the Records & ID tab visuals look good. The tab carries the "broker, not store" architectural commitment and shows storage connector types (Google Drive / OneDrive / Dropbox / Box / S3 / R2 / SFTP / webhook). **None of these surfaces are wired at port time** — they're explicitly the `v5.13 / v6.0` workstream per `PROTOCOL-Records-Broker.md` (draft) and `ACCESSIBILITY-SPEC.md Phase G`.

For port purposes: the Records & ID tab ships **as-is** (visual only). Worker has no `/org/storage-connectors` endpoints yet. All Records & ID buttons in the mockup are UI-stubs that read/write localStorage — exactly the right shape for design-in. The port HANDOVER should explicitly call out "Records & ID tab is mockup-only this port; backend wiring deferred to v5.13+."

---

## §6 — Port-readiness summary

### §6.1 Pre-port checklist (no new mockup work needed)

- [x] Every visible mockup button is either wired, explicitly disabled with disclosure, or intentionally placeholder.
- [x] Mockup-only buttons (22 v511-prefix + 1 `inviteStaffBtn`) have Worker endpoint targets defined in `CALENDAR-SPEC.md §2`.
- [x] Live-only buttons (3) have port decisions documented: `csvBtn` / `csvUploadBtn` retired, `signInHereBtn` to be ported back.
- [x] Delegated button groups verified wired.

### §6.2 Disposition map for the HANDOVER drafter

| Category                          | Action at port                              |
|-----------------------------------|---------------------------------------------|
| In BOTH (53 buttons)              | No code change. Inherits live wiring.       |
| Only in MOCKUP, calendar surface (12) | Re-wire to Worker endpoints per CALENDAR-SPEC §2 |
| Only in MOCKUP, Staff & Rooms (2) | Wire `v511AddRoomBtn` to POST `/org/rooms`. `inviteStaffBtn` reuses existing live handler — just relocate. |
| Only in MOCKUP, settings tabs (4) | Each consolidates to a single PATCH `/org/settings` call with tab-scoped payload |
| Only in MOCKUP, sample/preview (3)| UI-only, no Worker. Keep client-side.       |
| Only in LIVE (3)                  | Retire 2 (`csvBtn`, `csvUploadBtn`); port `signInHereBtn` back |
| Intentional placeholders (3)      | Wire at port (banner upload + theme scrape) or retire one of the two scrape buttons |
| Records & ID tab (whole tab)      | Ship as mockup-only this port. Backend deferred. |

### §6.3 One open question for Captain

`websiteScrapeBtn` (Visual Theming) reads "Import suggested theme (coming soon)" and is `disabled`. `themeScrapeBtn` (Org tab footer) reads "Extract from website" and is **functional** in live. They appear to be two buttons aimed at the same feature. **Recommendation:** retire `websiteScrapeBtn` at port time and consolidate to `themeScrapeBtn` only.

---

— Number One, orphan sweep closed clean. Mockup is port-ready as of T4.3.61.
