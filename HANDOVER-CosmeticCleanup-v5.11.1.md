# HANDOVER — Cosmetic cleanup + light-mode badges + count math (v5.11.1)

**Author:** Number One.
**Drafted:** Friday 22 May 2026 morning watch.
**Target:** Mr. Data (Codex).
**Scope:** `OrgCheckin.html` only. No Worker, no D1, no schema, no other files.
**Estimated diff:** ~60 lines net.
**Estimated time:** single PR, under an hour.
**Branch suggestion:** `codex/v5.11.1-cosmetic-cleanup`.

---

## §1 — Why

Number One ran a site scan on the live dashboard Friday morning after Captain spotted yesterday's check-ins still showing as "Today" data. The scan surfaced five small bugs that all share the same shape: they're cosmetic or display-layer issues with line-level fixes. No protocol logic, no data-flow changes, no Worker contact.

This brief closes the five smallest items. A second brief (`HANDOVER-AttendanceWindow-v5.11.2.md`) covers the date-window data-correctness fix separately.

---

## §2 — Out of scope (do NOT touch)

- `irlid-api-org/**` — Worker is being left alone in this PR.
- `OrgCheckinTest.html` — mockup sandbox, not your concern this brief.
- `js/**` — protocol code untouched.
- Schema files / migrations — none.
- D1 — no writes.
- Any new features — strictly cleanup.
- Bug **E** (BIO-METRIC always 0 in doorman flow) — architectural decision pending Captain's call. Skip.
- Bug **A/B/D** (24-hour window) — covered by `HANDOVER-AttendanceWindow-v5.11.2.md`. Skip.

---

## §3 — Tasks

### Task 1 — Trim prototype scratch copy from Settings page (Bug F)

**File:** `OrgCheckin.html`
**Line:** 3669
**Current text:**

```html
<p>Compact desktop settings screen with the old app nav restored. Local-only test mode. No Cloudflare writes.</p>
```

This `<p>` sits inside `.settings-card-header` directly, NOT wrapped in `.prototype-note`, so it shows to real Lead Admins — not just developers like the Dashboard banner. It's mockup-era scratch copy that should never have shipped.

**Action:** Replace with a neutral, accurate description of what the Organisation settings card does. Suggested copy:

```html
<p>Organisation identity, branding, and core policy.</p>
```

Or whatever single-line description fits the surrounding tone — short, accurate, not "test" or "mock" wording.

---

### Task 2 — Bump sidebar protocol version from v4 to v5 (Bug G)

**File:** `OrgCheckin.html`
**Line:** 3289
**Current:**

```html
<div class="sidebar-footer">IRLid Protocol v4<br><span class="env-badge-test">Test Environment</span><span class="env-badge-live">Live</span> / Offline-safe<br><span style="color: var(--accent, #58a6ff); font-weight: 600;">Build v5.11.0</span></div>
```

The "IRLid Protocol v4" string is stale — production has been on v5 since 2 May 2026.

**Action:** Change `IRLid Protocol v4` to `IRLid Protocol v5`. One-word edit.

---

### Task 3 — Rename "Basic test identity" section + clear placeholder defaults (Bug H)

**File:** `OrgCheckin.html`
**Lines:** 3673 (heading) and 3675–3677 (default values).

**Current heading at line 3673:**

```html
<h4>Basic test identity</h4>
```

**Current defaults at lines 3675–3676 (and similar pattern at 3677):**

```html
<label class="settings-field"><span>Org code</span><input id="orgCode" type="text" value="test"></label>
<label class="settings-field"><span>Event code</span><input id="eventCode" type="text" value="demo-night"></label>
```

**Action:**

1. Rename `<h4>Basic test identity</h4>` to `<h4>Basic identity</h4>`.
2. Remove the hard-coded `value="test"` and `value="demo-night"` attributes. The fields should start empty so the Worker's saved values from `organisations.settings_json` populate them on load. If a placeholder is needed visually, use `placeholder="org-code"` and `placeholder="event-code"` respectively — NOT `value=`.
3. Leave `Minimum Trust Score` at `value="70"` — that's a real default policy value, not placeholder copy.

---

### Task 4 — Fix dashboard "attendees seen" sub-label math (Bug C)

**File:** `OrgCheckin.html`
**Line:** 6548
**Current:**

```js
document.getElementById('statInSub').textContent = rows.length ? `${rows.length} attendees seen` : 'No attendance yet';
```

The `rows` array passed into `renderStats(rows, stats)` is the concat of `checkins` + `expectedRows` (per `irlid-api-org/src/index.js:2670`). So when 3 expected rows are visible alongside 2 IN check-ins, the sub-label reads "5 attendees seen" — counting expected stubs as sightings.

**Action:** Change `rows.length` to `stats.total`. The Worker already returns `total: checkins.length` in the stats object (line 2670 of the Worker), which is the count of actual check-in rows (sightings), not expected stubs.

```js
document.getElementById('statInSub').textContent = stats && stats.total ? `${stats.total} attendees seen` : 'No attendance yet';
```

Defensive null-check on `stats` because it might be undefined during early renders.

---

### Task 5 — Deeper-saturated light-mode badge contrast (Bug I)

**Files:** `OrgCheckin.html` (CSS rules block, currently around lines 778–907 + light-mode overrides around 1289–1314).

**The problem:** Light-mode brand colour vars (`--blue`, `--green`, `--orange`, `--red`) are tuned for legibility on dark surfaces. On a white surface they read pale. Four badges currently use them directly with no light-mode override:

| Class | Lines | Issue |
|-------|-------|-------|
| `.role-mini` | 733–765 (dark), 1289–1298 (light override exists) | Light override exists but uses same vars — still washed out. |
| `.expected-pill.ok` / `.warn` | 291–293 (dark), 1300–1314 (light override exists) | Same issue. |
| `.status-in` / `.status-out` | 778–779 | **No light-mode override at all** — uses `var(--green)` / `var(--red)` directly. |
| `.checkout-signed-badge` | 907 | **No light-mode override at all** — uses `var(--green)` directly. |

**Action:** Add a `:root[data-theme="light"]` block near the existing light-mode overrides (~line 1314 onwards) that defines deeper-saturated variants:

```css
/* v5.11.1 — Deeper light-mode badge colours.
   Brand colour vars (--blue/--green/--orange/--red) are tuned for dark surfaces;
   on white they read washed out. WCAG 4.5:1 floor on white surface. */
:root[data-theme="light"] .role-mini.staff       { border-color: #1f6feb; color: #1f6feb; }
:root[data-theme="light"] .role-mini.manager     { border-color: #9a6b00; color: #9a6b00; }
:root[data-theme="light"] .role-mini.lead_admin,
:root[data-theme="light"] .role-mini.developer   { border-color: #1a7f37; color: #1a7f37; }

:root[data-theme="light"] .expected-pill.ok      { background: #c8e7d4; border-color: #1a7f37; color: #1a7f37; }
:root[data-theme="light"] .expected-pill.warn    { background: #fff1bf; border-color: #9a6b00; color: #9a6b00; }

:root[data-theme="light"] .status-in             { color: #1a7f37; }
:root[data-theme="light"] .status-out            { color: #b62324; }
:root[data-theme="light"] .checkout-signed-badge { color: #1a7f37; }
:root[data-theme="light"] .checkout-legacy-badge { color: #9a6b00; }
```

The colours above are GitHub's accessible-light-mode palette (`#1a7f37` green, `#9a6b00` amber, `#1f6feb` blue, `#b62324` red — all hit WCAG 4.5:1 on white).

**Verify in light mode:**
- Switch the dashboard to light mode via Settings → Visual theming (or whichever path is active in v5.11.0).
- Confirm each badge reads clearly against the white surface.
- Confirm dark mode still looks unchanged.

---

## §4 — Acceptance criteria

Mr. Data, please verify before marking PR ready-for-review:

1. **Settings page** no longer shows "Local-only test mode. No Cloudflare writes."
2. **Sidebar footer** reads "IRLid Protocol v5" — confirmed visually in dark AND light mode.
3. **"Basic test identity"** heading is now "Basic identity"; `value="test"` / `value="demo-night"` defaults are gone.
4. **Dashboard Checked-In sub-label** reads the actual count of check-in rows (sightings), not the merged rows + expected count.
5. **Light mode badges** all readable on white: role-mini (S/M/L/D), expected-pill ok/warn, status-in/out, checkout-signed-badge.
6. **Dark mode unchanged** — no regression on the dark surface that worked before.
7. **Build pill** bumped from `v5.11.0` to `v5.11.1` in the sidebar footer.
8. **Service Worker cache version** bumped in `sw.js` if you touched anything cache-relevant (you probably won't this brief, but mention if you did).
9. **Diff scope** — only `OrgCheckin.html` (and possibly `sw.js` for cache bump if needed). No Worker / no other files.

---

## §5 — Self-verify checklist before PR ready

- [ ] Diff is `OrgCheckin.html` only (+ optionally `sw.js` for cache bump).
- [ ] Five tasks all complete.
- [ ] Build pill `v5.11.0` → `v5.11.1` bumped.
- [ ] No regressions in dark mode (you can verify by toggling Visual theming → Light/dark/auto).
- [ ] All five badge classes confirmed legible in light mode.
- [ ] No new dependencies added.
- [ ] Commit messages follow the v5.x.x convention (see prior PRs for shape).

---

## §6 — Notes for Captain

- This brief is the smallest-blast-radius bug-fix package — purely cosmetic, no protocol contact.
- Bug E (bio-metric 0 in doorman flow) needs your architectural call before any brief lands for it. Options: (a) wire bio-verification into doorman flow, or (b) hide/relabel the stat card when org uses doorman as primary flow.
- Bug A/B/D (24-hour-window → today) is the next brief — `HANDOVER-AttendanceWindow-v5.11.2.md`.
- After v5.11.1 + v5.11.2 land, the next big brief is `HANDOVER-SettingsRevamp-Port-Phase1.md` for the mockup → live port — see `memory/PLAN-CleanupAndPort-2026-05-22.md` §3.

— Number One.
