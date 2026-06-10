# HANDOVER — "Today" means today (v5.11.2)

**Author:** Number One.
**Drafted:** Friday 22 May 2026 morning watch.
**Target:** Mr. Data (Codex).
**Scope:** `irlid-api-org/src/index.js` (Worker) + `OrgCheckin.html` (caller). No D1 schema changes. No new tables.
**Estimated diff:** ~30 lines Worker + ~20 lines client.
**Estimated time:** single PR, under an hour.
**Branch suggestion:** `codex/v5.11.2-attendance-window`.

---

## §1 — Why

Captain spotted yesterday's check-ins still showing under the "Attendance — Today" header on Friday morning. Root cause: the Worker's `/org/attendance` endpoint defaults its date filter to `now() - 86400` (a sliding 24-hour window from the current moment), not "since midnight local time today." So at any time of day, yesterday's late-afternoon check-ins remain inside the window.

This bug surfaces in three visible places, all from the same root:

- **Bug A** — "Attendance — Today" header shows rows with `checkin_at` from yesterday.
- **Bug B** — Each yesterday-checked-in attendee appears TWICE in the table (once as IN, once as linked-expected) because the Expected dedupe on the Worker only excludes check-ins where `date(checkin_at,'unixepoch')=date('now')` — i.e. it only suppresses today's check-ins, leaving yesterday's check-ins to leak through as duplicates.
- **Bug D** — CHECKED OUT count includes yesterday's checkouts.

One fix closes all three.

---

## §2 — Out of scope (do NOT touch)

- D1 schema or migrations — no changes.
- Any `org_checkins` row mutations (DB stays warts-and-all per Captain's `Design Principles` in `CLAUDE.md`).
- Cosmetic / copy / badge contrast — covered by `HANDOVER-CosmeticCleanup-v5.11.1.md`.
- Bio-metric stat (Bug E) — architectural, parked.
- Mockup `OrgCheckinTest.html` — not your concern this brief.

---

## §3 — Design decision: where does timezone live?

The Worker runs in UTC. Local-midnight-today is a client-side concept (depends on the user's timezone). Two options:

### Option A — Server-side timezone handling
Worker reads a `tz` query param and computes local midnight server-side. Pulls a tz database. **Heavier:** new dependency, ongoing tz-data maintenance.

### Option B — Client passes explicit `since` ✅ **Recommended**
Client computes local midnight (using the browser's `new Date()` + `setHours(0,0,0,0)` then `getTime()/1000`) and passes it as `?since=<unix_ts>`. Worker stays UTC-agnostic — it just honours whatever `since` it's given. Already-supported per line 2643: `url.searchParams.get("since")` is checked first.

**Choose Option B.** Less Worker change, no new dependencies, and the Worker already supports it.

The only Worker-side change needed: make the **default fallback** (when the client doesn't pass `since`) sane. Right now the default is `now() - 86400` (sliding 24h). After this fix the default should still be backwards-compatible-ish for any legacy caller, but the dashboard will always pass `since` explicitly.

---

## §4 — Tasks

### Task 1 — Update Worker default + Expected dedupe to use a `since` boundary consistently

**File:** `irlid-api-org/src/index.js`
**Function:** `orgAttendance` (currently at line 2638).

Current relevant lines:

```js
async function orgAttendance(request, env) {
  const org = await orgAuth(request, env); if (org.error) return org;
  const url = new URL(request.url);
  const includeExpected = url.searchParams.get("include_expected") === "1";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
  const since = url.searchParams.get("since") ? parseInt(url.searchParams.get("since")) : (now() - 86400);
  const rows = await env.DB.prepare(
    "SELECT id,mode,attendee_label,attendee_key_id,hello_hash,score,bio_verified,gps_hash,checkin_at,checkout_at,duration_s,name,device_key_fp,status,expected_id,conflict_id,CASE WHEN checkout_at IS NOT NULL AND checkout_signature IS NOT NULL THEN 'signed' WHEN checkout_at IS NOT NULL THEN 'legacy_button' ELSE checkout_method END AS checkout_method,checkout_ts FROM org_checkins WHERE org_id=? AND checkin_at>=? ORDER BY checkin_at DESC LIMIT ?"
  ).bind(org.id, since, limit).all();
  // ...
  const expected = await env.DB.prepare(
    "SELECT e.id AS expected_id,(TRIM(COALESCE(e.first_name,'') || ' ' || COALESCE(e.surname,''))) AS name,COALESCE(e.prototype_role,'attendee') AS role,COALESCE(e.prototype_role,'attendee') AS prototype_role FROM org_expected e WHERE e.org_code=? AND e.status='linked' AND NOT EXISTS (SELECT 1 FROM org_checkins c WHERE c.org_id=? AND c.expected_id=e.id AND date(c.checkin_at,'unixepoch')=date('now')) ORDER BY LOWER(e.surname) ASC, LOWER(e.first_name) ASC, e.id ASC"
  ).bind(org.id, org.id).all();
```

**Changes:**

1. Keep the `since` default at `now() - 86400` for backwards compatibility with any caller that doesn't pass `since` — this is fine because the dashboard will always pass an explicit `since` after Task 2.
2. **Update the Expected dedupe** to align with the `since` boundary instead of using `date('now')`. The dedupe currently asks "is there a check-in for this expected_id on calendar-day-today (UTC)?" — it needs to ask "is there a check-in for this expected_id since the window's `since` timestamp?":

```sql
SELECT e.id AS expected_id, ... FROM org_expected e
WHERE e.org_code = ?
  AND e.status = 'linked'
  AND NOT EXISTS (
    SELECT 1 FROM org_checkins c
    WHERE c.org_id = ?
      AND c.expected_id = e.id
      AND c.checkin_at >= ?
  )
ORDER BY ...
```

Binding becomes `.bind(org.id, org.id, since)` instead of `.bind(org.id, org.id)`.

This way, whatever `since` the client passes (or the Worker defaults to), both the check-ins query AND the Expected dedupe agree on the boundary — so a person can never appear in both the check-ins list AND the expected list within the same window.

---

### Task 2 — Client always passes explicit `since` for "Today" view

**File:** `OrgCheckin.html`
**Search for:** every call site that fetches `/org/attendance` (search: `/org/attendance` or `attendance?` or wherever the dashboard refresh URL is built).

**Action:**

For the "Today" view (which is the only view in v5.11.x), the client computes `local midnight today` and passes it as `since`:

```js
function localMidnightToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}
```

Then at the fetch call:

```js
const since = localMidnightToday();
const url = `${ORIGIN_BASE}/org/attendance?since=${since}&include_expected=1`;
```

Apply the same change everywhere `/org/attendance` is fetched (there may be 1–3 call sites — search exhaustively).

---

### Task 3 — Document the contract

Add a one-line comment above the Worker's `since` line explaining the boundary contract:

```js
// v5.11.2 — `since` is honoured if passed (client convention: local midnight today
// as unix epoch). Fallback to 24h sliding window for legacy / unauth'd callers
// only; the dashboard always passes since explicitly.
const since = url.searchParams.get("since") ? parseInt(url.searchParams.get("since")) : (now() - 86400);
```

---

## §5 — Acceptance criteria

Mr. Data, please verify before marking PR ready-for-review:

1. **At any time of day**, "Attendance — Today" shows ONLY rows whose `checkin_at` is on or after the user's local-midnight-today. Yesterday's rows do NOT appear.
2. **No duplicate IN + linked-expected rows** for the same attendee — the Expected dedupe correctly excludes anyone who has a check-in in the window.
3. **CHECKED OUT count** matches the visible OUT rows in the table — no phantom yesterday checkouts.
4. **Worker still accepts explicit `since` from any client** (regression: don't break `since=0` for "all time" callers, if any exist).
5. **Build pill** bumped from `v5.11.x` to `v5.11.2`.

### Smoke test
- Captain checks in on the live dashboard at any time after midnight.
- Refresh the dashboard the next morning — yesterday's row should be GONE from the Today view.
- Same person re-checks in today — appears once as IN, no duplicate linked-expected row.

---

## §6 — Self-verify checklist before PR ready

- [ ] Worker `orgAttendance` updated: Expected dedupe aligned with `since` boundary.
- [ ] Worker comment explains the `since` contract.
- [ ] Client passes explicit `since=<local midnight unix>` at all `/org/attendance` call sites.
- [ ] No D1 schema changes.
- [ ] Diff scope: `irlid-api-org/src/index.js` + `OrgCheckin.html`. Nothing else.
- [ ] Build pill bumped.
- [ ] Worker rebuild + wrangler deploy preview if you have one handy (else Captain will deploy on review).

---

## §7 — Notes for Captain

- This brief is the data-correctness companion to v5.11.1. Together they close bugs A–D and F–I from Number One's Friday morning site scan.
- The Worker deploy step uses your usual `cd irlid-api-org ; npx wrangler deploy` after merge. If wrangler API timeouts hit (you've been bitten three times now), fall back to Cloudflare dashboard Quick Edit per `BOOTSTRAP §6`.
- Bug E (bio-metric 0 in doorman flow) remains parked pending your architectural call.
- After v5.11.1 + v5.11.2 ship clean, next big brief is the SETTINGS-REVAMP-SPEC.md Phase 1 port — see `memory/PLAN-CleanupAndPort-2026-05-22.md` §3.

— Number One.
