# HANDOVER — CSV completeness via server-side attendance merge (v5.10.3)

**Target:** `v5.10.3` (adjust to next available patch — current main is `v5.10.2` at commit `9f7c220`).
**Branch:** `codex/v5.10.3-csv-completeness`
**PR title:** `[codex] v5.10.3 — CSV completeness via server-side attendance merge`
**Scope:** Small (~50 lines Worker + ~10 lines frontend net).
**Repo:** LIVE `BunHead/IRLid`. Verify `git remote -v` before starting (see Discipline below).

---

## Why

Captain ran the CSV export with filter "All" on the dashboard. CSV returned Kerry + Spencer (who have `org_checkins` rows from today) but missed Poppy (status `linked` in `org_expected`, zero `org_checkins` rows today). Dashboard's "Attendance — Today" panel merges both tables and renders 3 rows; CSV exporter reads only `org_checkins` and exports 2. The CSV is silently shorter than the dashboard for any attendee who's linked-expected but hasn't arrived yet.

The dashboard already does the merge on the frontend. Locking that logic in the browser means any non-browser consumer (MCP server, scheduled report, integration partner) re-implements it or gets incomplete data. **Server should own the data shape.** Path B (server-side merge in `/org/attendance`) wins over Path A (frontend UNION).

## What

Extend `GET /org/attendance` in `irlid-api-org/src/index.js` to optionally include `linked` expected rows that have no checkin today. Frontend dashboard renderer + CSV exporter both call the merged endpoint. The frontend merge logic is removed (server owns it now).

## File-by-file changes

### 1. `irlid-api-org/src/index.js`

Locate the `orgAttendance(request, env)` handler. Extend it:

- Read `url.searchParams.get('include_expected')`. Treat strict `'1'` as truthy; anything else (including `'true'`, `'yes'`, missing) is falsy — defaults to legacy single-table behaviour.
- When truthy, after the existing query against `org_checkins`, run a second query against `org_expected` selecting rows where:
  - `org_id = :orgId`
  - `status = 'linked'`
  - No `org_checkins` row exists today (`date(timestamp) = date('now')`) for that `expected_id`
- Merge results in the response. Fields for merged-from-expected rows:
  - `scan_count = 0`
  - `status = 'linked expected'`
  - `first_seen = null`
  - `last_seen = null`
  - `name`, `role`, `expected_id` populated from `org_expected`
- Existing behaviour without the flag remains untouched (backward compat).

### 2. `OrgCheckin.html`

1. Locate the dashboard render function that fetches `/org/attendance` (search for `org/attendance` — there should be one fetch site for "Attendance — Today" rendering). Append `?include_expected=1` to the URL.
2. Locate the CSV export function (likely `exportCSV()` at line ~3305 calls some prep function). It should fetch the SAME merged endpoint (`/org/attendance?include_expected=1`). One fetch source of truth.
3. Find the frontend merge logic that combines `org_expected` rows with `org_checkins` rows for dashboard rendering — search for `linked expected` in the renderer. Remove it (server now provides merged rows directly).
4. Bump build pill: `Build v5.10.2` → `Build v5.10.3` (at line ~3284 in the `.sidebar-footer` div).

### 3. `sw.js`

Bump `CACHE_VERSION` from `irlid-shell-v11` to `irlid-shell-v12`. Update the trailing comment to reference v5.10.3 (e.g., `// v5.10.3 bump — CSV completeness via server-side attendance merge`).

## Acceptance criteria (numbered, testable)

1. With CSV filter "All", an org with 2 checked-in attendees + 1 linked-but-not-arrived attendee exports **3 rows** (not 2).
2. The merged-from-expected row in CSV shows `scan_count=0`, `status='linked expected'`, empty `first_seen` / `last_seen`.
3. Dashboard "Attendance — Today" panel renders the same 3 rows after the change (no regression in dashboard view).
4. Worker rejects malformed `?include_expected=foo` gracefully — defaults to legacy single-table behaviour.
5. `git diff origin/main` net: ~50 lines added in Worker (new query + merge), ~10 lines deleted in frontend (removed client merge), ~3 lines for build pill + SW cache bump + SW comment. Total well under 100 lines.

## Out of scope (do not touch)

- Calendar / multi-event work — that's `v5.11+` and a separate spec doc in progress.
- A1 Settings role-gating refactor — separate brief, separate version.
- Settings UX revamp — Captain + Number One own that track.
- Any UI changes to dashboard rendering beyond the data-source URL.
- New endpoints. Extend the existing one only.
- CSV column reordering or new columns. Same column set, just more rows.

## Risk + rollback

- **Risk:** existing browser-side merge logic could conflict with server-side merge → duplicate rows in dashboard. **Mitigation:** the client merge is removed in the same PR; verify dashboard renders correctly before opening PR.
- **Risk:** SW cache bump propagates the new behaviour to all devices on next page load — if the Worker change is bad, devices stuck on old client + new Worker would see only single-table results until next refresh. **Mitigation:** Worker change is additive; legacy behaviour preserved when flag absent.
- **Rollback:** single commit revert; D1 schema unchanged.

## Verification before opening PR

```powershell
cd "<repo>"
git remote -v   # confirm: https://github.com/BunHead/IRLid.git (NOT the TestEnvironment repo)
git switch main
git pull
git log --oneline -5   # confirm v5.10.2 tip is `9f7c220` or current
```

After implementation:
- `node --check irlid-api-org/src/index.js` passes
- Visual smoke locally if you can; otherwise Captain will smoke after merge

## Discipline reminders (BOOTSTRAP §6)

- Pull `origin/main` right before starting. Stale baselines have caused regressions.
- Diff every touched file against `origin/main` before opening PR. Any deletion outside the explicit removed-merge-logic scope is a baseline-drift warning.
- One PR per task. Scope expansion → stop and raise to Captain.
- Bump `sw.js` `CACHE_VERSION` on every frontend change that needs to reach devices.

---

Brief drafted 16 May 2026 by Number One. Captain reviewed and approved before push.
