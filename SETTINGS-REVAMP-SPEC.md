# SETTINGS-REVAMP-SPEC.md

**Status:** Draft — Tuesday 19 May 2026 morning watch.
**Authoring crew:** Number One (Claude).
**Implementation target:** Mr. Data (Codex).
**Source of truth:** `OrgCheckinTest.html` at build pill `v5.10.2 + v5.11 mockup T4.1.10`.
**Destination:** `OrgCheckin.html` (live repo) — replacing the legacy `settings-shell` block (currently hidden under `display: none` in the test fork).

This spec transcribes the v5.11 Settings revamp mockup into an implementation brief. Where the mockup uses inline localStorage for design-fidelity, real implementation persists to the Cloudflare Worker (`POST/GET /org/settings`) and D1 (`organisations.settings_json` already exists).

The mockup is the canonical visual reference. **When mockup and spec disagree, the mockup wins** — Captain has been iterating on it directly for ~14 days and the design intent is encoded there.

---

## §1 — Top-level structure

The Settings page is a **single page with seven tabs** (replacing the legacy flat scrolling list). Tab order, icons, and labels are fixed:

| # | Icon | Tab label             | Purpose                                                                |
|---|------|-----------------------|------------------------------------------------------------------------|
| 1 | 🏢   | Organisation          | Brand, contact info, slug, masthead, theme scrape                       |
| 2 | 📅   | Event & calendar      | 24-hour calendar, multi-room, per-event drill-down, CSV import/export   |
| 3 | 👥   | Roles & staff         | Staff list, role vocabulary, rooms / spaces                              |
| 4 | 🎨   | Visual theming        | Palette, animation, overlays, QR, celebration                            |
| 5 | 🔐   | Sign-in & auth        | QR sign-in, session config, service-account login                        |
| 6 | 🔧   | Tools & diagnostics   | API health, audit log, debug switches                                    |
| 7 | 📋   | Records & ID          | Storage destination connectors (broker-not-store commitment)             |

**Tab markup** — `<button data-v511-tab="..." role="tab" aria-controls="..." aria-selected="...">` with `<section class="v511-panel" data-v511-panel="...">` panels. ARIA tab pattern fully wired in the mockup; copy verbatim.

**Persistence** — All tab content saves into `organisations.settings_json` via the existing `POST /org/settings` endpoint. Theme settings (palette, cycle direction, overlays) round-trip via `theme` sub-object. Form fields (org name, slug, etc.) live at the top level. Per-mode fields (Allow/Review/Deny welcome message + redirect + dwell) live under `modes.{allow|review|deny}.*`.

**Schema bump** — `settings_json.schema_version = 5.11` (was 5.10). Worker validates schema_version on load; rejects unknown future versions but accepts older ones via migration shim.

---

## §2 — Organisation tab

Layout:
- **Masthead** — branded banner at the top: org display name + slug pill + tagline + logo. Grid `1fr 180px`; responsive collapse to single column < 640px.
- **Slim main row** — Display name, slug, tagline as primary editable fields.
- **`<details>` "Brand polish"** — closed by default. Contains:
  - Contact info (per-item opt-in: phone, address, public email, emergency notice; all default OFF).
  - Logo upload (PNG/SVG, ≤ 100KB).
  - Theme scrape (paste a website URL, Worker fetches + sample-extracts dominant colours).

Slug field is read-only after first save with explanatory hint: *"URL-safe short name. Auto-generated from Display name. Used in receipt URLs and the api_key prefix. Read-only — changing it would break existing receipts."*

**Worker validation** — slug regex `^[a-z0-9-]{3,40}$`, no leading/trailing hyphens, unique across orgs. Display name 1–80 chars.

---

## §3 — Event & calendar tab

Layout:
- **Toolbar at top** — View toggle (List / Swim-lane), Room filter (all / individual), Jump-to-now button, Day CSV export button (exports the whole day's attendance across all rooms).
- **Calendar** — 24-hour grid, hours `00:00`–`23:59` with 30-min slot rows. Working-hours band (09:00–17:59) lighter; off-hours dimmer. Page auto-scrolls to `09:00` on load. Now-line is a red horizontal bar with "NOW" label, repositioned every minute.
- **Per-event drill-down** — click "Edit" on any filled row to expand an inline accordion beneath it with:
  - Event details (name, start, end, room, expected count, capacity).
  - **Expected list** — staff/attendees pre-loaded for this event; CSV import + export buttons.
  - Add / Invite QR / Import CSV / Export CSV — same-shape symmetry on import/export.
  - Cancel / Save / Close controls.
- Single-open accordion behaviour (opening one closes any other).
- Past events: opacity 0.55, Edit button greyed out + `pointer-events: none`. Determined by `end_time < now`.

**Multi-room model** — rooms defined in tab 3 (Roles & staff). Each event references a `room_id`. Calendar Room filter dropdown narrows to that room's events; List view always shows all rooms (with room badge per row); Swim-lane shows one column per room over the day.

**See CALENDAR-SPEC.md for full multi-room + swim-lane forward design.**

---

## §4 — Roles & staff tab

Order (top to bottom):
1. **Staff list** (always visible) — paginated table: Name, Role, Initials, Pub_fp, Actions.
2. **`<details>` "Role vocabulary"** — rename what each role is called in YOUR org. 5 inputs: Attendee, Staff, Manager, Lead admin. Developer role is platform-level and hidden. Captain's design principle: vocabulary carries through everywhere (the role-pill, the "Viewing as" dropdown, role-pill tooltips, initials letter on attendance rows).
3. **`<details>` "Rooms / spaces"** — each event runs in one room; rooms have their own venue QR and capacity. Add / Edit / Remove. Each room gets its own auto-generated `room_id` + venue QR.

**D1 schema additions:**
- `organisations.role_vocabulary` JSON column — `{ attendee, staff, manager, lead_admin }` string map.
- New table `rooms` — `id, org_id, name, capacity, hint_note, venue_qr_payload_hash, created_at`.

---

## §5 — Visual theming tab (deepest)

**This tab is the most-iterated surface of the mockup.** The structure shipped in T4.1.10:

### §5.1 — Layout
- **Active mode selector** + **Sample button** at top.
- **Theme preview stage** — fullscreen-aspect rectangle that PROPORTIONALLY MATCHES end-user fullscreen via container-query units (`cqi`). Top-right badge: `DETECTED SCAN RES: W × H` (hidden in fullscreen mode). Double-click for fullscreen.
- **EDITING: ALLOW / REVIEW / DENY** pill in the panel heading (colour-matched to active mode).
- **Mode-tinted frame** — Allow = green ring, Review = amber, Deny = red — wraps the whole panel via border-color + box-shadow + radial wash on `::before`.
- **Light/dark mode** select (auto / light / dark).

### §5.2 — Four flat top-level expanders (Captain's call T4.1.9):
1. **Background** (open by default) — palette + cycle motion. **Contains Pattern overlay and Image overlay as nested sub-expanders** (Captain's T4.1.10 call).
2. **Post-Accept behaviour** — per-mode redirect, welcome message, dwell, outcome sound. **Contains QR customization as a nested sub-expander** (Captain's T4.1.10 call).

### §5.3 — Background expander contents
- **Background palette** — 1–7 swatches. One swatch = solid (no cycle). Two or more = gradient cycle. `<input type="color">` per swatch with hover-visible × remove button. `+ Add colour` (random hex) + `Reset to defaults` buttons.
- **9-cell cycle direction grid** — replaces the legacy 4-chip picker. Maps to CSS classes `bg-dir-{tl|t|tr|l|co|r|bl|b|br|ci}`. Centre cell toggles `co` ⊙ / `ci` ⊕ on each click.
- **Bounce toggle** — ON = `animation-direction: alternate` (ping-pong). OFF = `animation-direction: normal` (one-way loop).
- **Transition** chips — Fade (`ease-in-out`) / Snap (`steps(5, jump-end)`).
- **Cycle duration** slider — 5–120s, drives `--bg-cycle-dur`.
- **Pattern overlay** (nested sub-expander) — enable checkbox in summary, pattern picker dropdown inside. Patterns rendered via `::after` CSS gradients.
- **Image overlay** (nested sub-expander) — enable checkbox in summary; file upload (PNG/SVG/JPEG ≤ 200KB), Position/Tile/Cover chips, 9-cell position grid, Symmetry chips (Off/Horizontal/Vertical/Quad), Anchor chips (Outer/Centre/Inner), Image scale bidirectional slider (-100 to +100, exponential mapping `5^(slider/100)`). Canvas-generated mirror variants stored as `--bg-image-url`, `--bg-image-url-mx`, `--bg-image-url-my`, `--bg-image-url-mxy`.

### §5.4 — Post-Accept behaviour contents
- Outcome sound row (per active mode).
- Custom welcome message textarea.
- Post-accept redirect URL.
- Staff post-accept redirect URL (role-gated).
- Dwell time, First-time vs returning, Time-aware greeting, Add to calendar, Email/SMS confirmation — most flagged `design-in`.
- **QR customization** (nested sub-expander) — QR foreground colour, Celebration palette, Celebration animation effects (6 effect cards: Pulse / Background / QR motion / Glow / Pattern / Text, each with sub-settings + drag-to-reorder), Celebration cycle duration.

### §5.5 — Per-mode state preservation
Captain edits ONE mode at a time (Allow / Review / Deny). The dropdown swap snapshots all 16 form fields into a `modeStates` object before loading the new mode's state. The implementation should persist this on save:

```json
"modes": {
  "allow": { "celEffPulse": false, "celEffBg": false, "celEffQr": false, "celEffGlow": true, "celEffPattern": false, "celEffText": true, "celDuration": 1.4, "paWelcome": "Welcome back!", "paRedirect": "", ... },
  "review": { ... },
  "deny": { ... }
}
```

### §5.6 — Worker validation rules
- Palette: each colour `^#[0-9a-fA-F]{6}$`, 1–7 swatches per palette (bg + cel separately).
- Cycle direction: enum `tl|t|tr|l|co|ci|r|bl|b|br`.
- Bounce: bool.
- Transition: enum `fade|snap`.
- Cycle duration: 5–120s.
- Pattern enable / Image enable: bool.
- Image data URL: ≤ 250KB after base64 encoding. WCAG contrast check against `#fff` for palette colours (4.5:1 floor).

### §5.7 — Image upload pipeline
1. Captain selects file (≤ 200KB).
2. Client-side: `FileReader.readAsDataURL` → original.
3. Client-side: render through hidden `<canvas>` 4× (1×, X-flipped, Y-flipped, XY-flipped) → 4 PNG data URLs.
4. Save all 4 to `theme.image_variants.{orig|mx|my|mxy}` on settings save.
5. On load, set CSS vars from the 4 variants.

For images > 250KB, fallback to original-only and log a quota warning.

---

## §6 — Sign-in & auth tab

Mostly status display (no edits): QR sign-in toggle, Same-device sign-in toggle, Session expiry (24h sliding), Session-poll interval (30s fixed per v5.10.7). One `<details>` for "Service-account login" (legacy api_key + Bearer paste path, for non-interactive integrations).

---

## §7 — Tools & diagnostics tab

Existing live OrgCheckin.html surfaces:
- Recent attendance log / debug rows.
- D1 query helpers.
- Worker version pill.
- Cache version display.
- Sign out (single + all devices).
- Refresh button.

No changes from v5.10.x — just regrouped into a single tab.

---

## §8 — Records & ID tab (NEW)

**Architectural commitment:** IRLid brokers identity documents, never stores them. See `PROTOCOL-Records-Broker.md` for the formal protocol chapter.

Layout — storage destination connector list:
- Google Drive — OAuth-connect button.
- OneDrive — OAuth-connect.
- Dropbox — OAuth-connect.
- Box — OAuth-connect.
- AWS S3 — endpoint URL + access key.
- Cloudflare R2 — endpoint URL + access key.
- SFTP — host/port/user/password (key-pair preferred).
- Webhook — POST URL, signing secret (Worker signs payloads with org's private key).

**Behaviour** — when an attendee uploads ID at first sign-in, the document streams DIRECTLY to the org's chosen destination. IRLid Worker computes SHA-256 of the document, retains:
- The hash (`records_broker_hash`).
- The destination reference (e.g. `gdrive_file_id`, `s3_url`, `webhook_event_id`).
- Timestamp.

IRLid stores **no document bytes**. Receipts can later verify "the document the org has for this attendee is the same one they had at first sign-in" by re-hashing and comparing.

**D1 schema additions:**
- New table `org_storage_connectors` — `id, org_id, type, config_json, created_at`.
- New table `records_references` — `id, org_id, attendee_user_id, hash, destination_type, destination_ref, created_at`.

**Worker endpoints (v6+):**
- `POST /org/records/connector` — register / update a destination.
- `POST /org/records/upload-init` — issue a signed pre-upload token (org's destination).
- `POST /org/records/upload-complete` — Worker records the hash + destination reference after upload completes.
- `GET /org/records/verify/:attendee_id` — return the hash + reference for verification.

---

## §9 — Implementation phasing

**Phase 1** (this brief — Mr. Data assignable now):
- HTML/CSS port of all 7 tabs from `OrgCheckinTest.html` to `OrgCheckin.html`.
- ARIA tab pattern + expander wiring + per-mode dropdown.
- Visual theming tab: palette + 9-cell direction + Bounce + Transition + Pattern overlay + Image overlay (with canvas mirror variants).
- Save / load round-trip via existing `POST/GET /org/settings`.

**Phase 2** (Mr. Data, post Phase 1 ship):
- Calendar tab full implementation (see CALENDAR-SPEC.md).
- Per-event drill-down + CSV import/export pipeline.
- Multi-room model + Swim-lane view.

**Phase 3** (v6 work, Mr. Data + Number One):
- Records & ID tab connectors (OAuth flows for cloud storage).
- Worker endpoints for records-broker pattern.
- See `PROTOCOL-Records-Broker.md` for the full design.

**Phase 4** (v6+):
- W3C accessibility certification pass.
- Inline mockup-only `design-in` placeholders activated as real features.

---

## §10 — Out of scope (banked, not in this spec)

- Trademark search outcomes — operational, not a spec concern.
- Cloudflare token rotation — operational, deferred per Captain.
- Branch deletion `codex/v5.10.1-path-b` — housekeeping.
- Donald / Wisdom partnership follow-ups — outreach, not protocol.

---

## §11 — Sign-off checklist for Mr. Data

When implementing Phase 1, Mr. Data should:
1. Read `OrgCheckinTest.html` from `<!-- ================ v5.11 SETTINGS REVAMP MOCKUP -->` through `<!-- ================ /v5.11 MOCKUP -->` and port the structure verbatim into `OrgCheckin.html`.
2. Replace inline mockup localStorage with the existing `savePortalSettings()` / `getPortalSettings()` plumbing.
3. Add `schema_version: 5.11` to the settings JSON.
4. Verify Worker validators in `irlid-api-org/src/index.js` accept the new field set (palette arrays, cycle direction enum, bounce bool, etc.).
5. End-to-end smoke: change palette → Save All → refresh → palette restored from D1.
6. Bump live pill from `v5.10.7` → `v5.11.0` only when **Captain has verified on real hardware**.

— Number One, drafting from the bath-watch, Tuesday 19 May 2026.
