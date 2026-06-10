# HANDOVER — `v5.11.22` — Fix Settings save "works eventually" race

**Owner:** Whoever picks it up next — small, isolated, can be Number One inline or Mr. Data
**Type:** Worker change + tiny client tweak. **No D1 schema change, no new endpoints.**
**Target build pill:** `v5.11.22` (after `v5.11.20` Mr. Data Settings polish trio merges)
**SW cache bump:** monotonic — read current state of `sw.js` line 15 before bumping
**Gating:** Wait for v5.11.20 + v5.11.21 to land on origin/main; this builds on top. (Renumbered from v5.11.21 → v5.11.22 on 27 May to clear the v5.11.21 slot for Captain's higher-priority celebration text + banner font Settings UI work.)

---

## The bug Captain observed

After v5.11.18 deployed, Captain reported: *"save works on refresh page ;) ;) "* — meaning the save action SUCCEEDS, but the visible feedback in the UI requires a hard refresh to confirm the change persisted. Doing the save, then immediately reading back the settings, occasionally shows the OLD values for a few hundred milliseconds before settling on the new values.

**Symptom for users:** Saved field appears reverted briefly after save click, then "magically" appears correct after refresh. Confusing UX even though the data is correct.

## Root cause (diagnosed 27 May 2026 morning via Explore-agent audit of Org.html)

In `saveSettings()` (Org.html:~12609) the sequence is:

1. **POST** the new settings to `/org/settings` (Worker writes to D1)
2. **GET** `/org/settings` to read back the persisted state for the overlay-and-merge pattern (L12628)

The race window is the gap between step 1 returning HTTP 200 and step 2's GET hitting a Worker instance that has the new value committed. Cloudflare Workers + D1 are not strongly consistent across edge nodes — a POST that returns success on one Worker node may not be immediately visible to a GET on a different node servicing the readback request milliseconds later.

The current code at L12628 essentially does:

```javascript
// POST the new theme
await api.post('/org/settings', payload);
// Immediately GET it back to merge into local activeTheme
const fresh = await api.get('/org/settings');
activeTheme = { ...activeTheme, ...fresh.theme };
```

The GET can return stale data because the D1 row update from the POST hasn't propagated to the readback Worker's view yet.

## Fix — have the POST response echo the persisted state

Instead of doing the readback GET, have the **POST handler return the persisted theme in its 200 response**. The client uses the response body directly. No second round-trip, no race window.

### Worker change (irlid-api-org/src/index.js)

Find the POST `/org/settings` handler (search for the `updateOrgSettings` function or the route declaration). Currently it likely does:

```javascript
// Pseudocode of current shape
await env.DB.prepare("UPDATE organisations SET settings_json = ? WHERE id = ?")
  .bind(JSON.stringify(newSettings), orgId)
  .run();
return jsonResponse({ ok: true });
```

Change to return the persisted blob:

```javascript
await env.DB.prepare("UPDATE organisations SET settings_json = ? WHERE id = ?")
  .bind(JSON.stringify(newSettings), orgId)
  .run();
// v5.11.22 — Echo the persisted settings in the response so the client can
// merge directly without a separate readback GET. Eliminates the save-
// eventually race where the readback GET could hit a D1 edge node that
// hadn't yet seen the UPDATE commit.
const persisted = await env.DB.prepare("SELECT settings_json FROM organisations WHERE id = ?")
  .bind(orgId)
  .first();
let persistedTheme = null;
try { persistedTheme = persisted?.settings_json ? JSON.parse(persisted.settings_json) : null; } catch (_) { persistedTheme = null; }
return jsonResponse({ ok: true, theme: persistedTheme });
```

The SELECT after UPDATE in the same handler runs on the same Worker instance against the same D1 connection — by the time the SELECT returns, the UPDATE is visible. (Cloudflare D1 is strongly consistent within a single request handler; the race only exists between separate requests.)

### Client change (Org.html)

In `saveSettings()` around L12609-12628, change:

```javascript
const postResp = await api.post('/org/settings', payload);
// L12628-ish:
const fresh = await api.get('/org/settings');
activeTheme = { ...activeTheme, ...fresh.theme };
```

To:

```javascript
// v5.11.22 — Worker POST now echoes the persisted theme; skip the readback
// GET to eliminate the save-eventually race.
const postResp = await api.post('/org/settings', payload);
if (postResp && postResp.theme) {
  activeTheme = { ...activeTheme, ...postResp.theme };
} else {
  // Defensive fallback for pre-v5.11.22 Worker (shouldn't happen post-deploy,
  // but covers a Pages-deploys-faster-than-Worker race during rollout).
  const fresh = await api.get('/org/settings');
  if (fresh && fresh.theme) activeTheme = { ...activeTheme, ...fresh.theme };
}
```

The defensive fallback gracefully handles the brief window during rollout when the Pages-deployed client expects `postResp.theme` but the live Worker hasn't been wrangler-deployed yet. Once both are deployed, the fallback path never fires.

### Test

1. Open `irlid.co.uk/Org` after deploy, sign in, navigate Settings → Visual Theming.
2. Edit a Background palette colour.
3. Click **Save all settings**. Green Saved pulse flashes.
4. Without refreshing, observe the active swatch in the palette panel — should remain the new colour throughout.
5. Hard-refresh. Value persists. No reverted-then-corrected flash.
6. Repeat for Role vocabulary, Event defaults, and any other Settings section that uses the save round-trip.

Acceptance: save feedback is instant and stable across all Settings sections; no "save works eventually" experience.

## Deploy order

1. **Worker first:** `cd irlid-api-org ; npx wrangler deploy`. This is forward-compatible — older clients still doing the readback GET continue to work (they just do an extra round trip).
2. **Then client:** push the Org.html change. New clients use the echoed theme directly.

If wrangler deploy hits the API-timeout trap, use Cloudflare dashboard Quick Edit per BOOTSTRAP §6 (paste fresh source via dash.cloudflare.com → Workers & Pages → irlid-api-org → Edit code → paste → Deploy).

## What NOT to touch

- D1 schema (`organisations.settings_json` shape unchanged)
- Any other Worker endpoint
- Save badge UI (Mr. Data settling that in v5.11.20)
- Mr. Data's v5.11.20 work — wait for it to land first

## A/R/D verdict expectations

- **✅ ACCEPT ✅** — Diff bounded to (a) Worker POST handler echoing theme in 200 response and (b) client `saveSettings()` preferring `postResp.theme` over readback GET with defensive fallback. No new endpoints, no schema changes, no save-badge churn.
- **⚠️ REVIEW ⚠️** — Adds new fetch round-trip somewhere; changes the POST response shape in a breaking way (older clients reject); modifies any other Settings endpoint; touches D1.
- **⛔ DENY ⛔** — D1 schema migration; new endpoint; alters Mr. Data's v5.11.20 work.

— Number One (drafted 27 May 2026 morning while Mr. Data closed v5.11.20)
