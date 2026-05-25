# HANDOVER — v5.11.0k Add at the door modal: fix `display_name` persistence + strip role chips + diagnose `invalid_action_payload`

**Target pill bump:** `v5.11.0j` → `v5.11.0k`
**Service worker cache bump:** `v20` → `v21` (force eviction across devices)
**Live repo:** `D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo`
**Branch:** `codex/v5.11.0k-add-at-the-door`
**Captain's framing:** "Staff are meant to be invited elsewhere, so get rid entirely as this method should only add attendee's." This is the doorman's hot path. Role decisions belong in Settings → Roles & Staff. The escalation-modal "Add at the door" panel is for attendees by definition.

---

## 1. Diagnose first (read these files in this order before editing)

1. **`Org.html`** — find function `addEscalationAtDoor` (search the source). Note:
   - Which HTML elements are queried for First name / Surname / role
   - What payload shape is constructed
   - Which Worker endpoint is `POST`ed
   - How the response is handled (and how errors render — `invalid_action_payload` shows in red somewhere)

2. **`irlid-api-org/src/index.js`** — find:
   - The `/org/expected/create-and-bind` route handler (likely `createAndBindExpected` or similar)
   - Its `requireSignedAction(body, env, opts)` call — particularly the `payloadSchema` clause it passes
   - The D1 INSERT statement against `org_expected` — confirm whether `display_name` column is being written
   - The default-role logic (or absence of)

3. Write your diagnosis into the PR description before writing code. Captain reads PR descriptions; this is how he confirms you understood before merging.

---

## 2. Frontend changes (`Org.html`)

### 2.1 Strip role chips from "Add at the door" panel

The escalation modal has an "Add at the door" section with:
- "Create a new entry with this device already bound." subtitle
- Role chip row: Attendee / Staff / Manager / Lead admin
- First name input
- Surname input
- Add Attendee button (green)

**Remove the entire role chip row** — HTML, any associated CSS class rules, and any JS event handlers that read/write the selected role chip. Captain's screenshot from 25 May watch-close shows the chips active; in v5.11.0k they should not exist.

After the strip, the panel reads (top to bottom): heading "Add at the door" → subtitle → First name input → Surname input → Add Attendee button. That's it.

### 2.2 Fix the `addEscalationAtDoor` payload

Once role chips are gone, the function should:
- Read First name + Surname from the inputs
- Build `display_name` from `${firstName} ${surname}`.trim() — handle case where one is empty (skip the join; use whichever is present; if both empty, refuse to submit with a visible "Enter a name" message rather than POSTing)
- Construct payload WITHOUT a `role` field — Worker will default to attendee
- POST to `/org/expected/create-and-bind`

### 2.3 Error rendering

If the Worker rejects (any error code), the visible red text in the modal should show the human-readable error, NOT the raw error code. Map `invalid_action_payload` → "Could not add attendee — please check name and try again." Keep the raw code in a `console.error` for diagnostics, but don't expose it to the doorman who's standing in front of a real human.

---

## 3. Worker changes (`irlid-api-org/src/index.js`)

### 3.1 Default role to `attendee`

In `createAndBindExpected` (or whatever the actual function name is for the `/org/expected/create-and-bind` route):
- If the incoming payload has no `role` field, default it to `'attendee'`
- If it has `role` and the value is anything other than `'attendee'` for this endpoint, log a warning and force it back to `'attendee'` — this endpoint is **attendee-only by design** going forward
- (Staff / Manager / Lead admin onboarding will get a separate invite-QR endpoint in a later version — not this brief)

### 3.2 Persist `display_name`

Audit the D1 INSERT for `org_expected` in this code path:
- Confirm the INSERT statement names `display_name` as a column
- Confirm the parameter binding receives the `display_name` value from the payload
- If either is missing, add them
- If the column doesn't exist in the v5.11 schema, escalate — but check `irlid-api-org/migrations/` first to confirm it does (v5.11.0 schema migration added it)

### 3.3 Fix `requireSignedAction` payloadSchema

The current `payloadSchema` clause is rejecting Captain's Add Attendee click with `invalid_action_payload`. Identify which clause is failing:
- Likely candidate: the schema expects a field the frontend isn't sending (or vice versa) after the v5.11 schema reset
- Could be: the schema expects `role` but the frontend was sending a stripped value; could be the schema expects `display_name` and the frontend sends `first_name`/`surname` separately; could be `new_device_key_fp` shape mismatch

Once identified, fix the schema OR fix the frontend payload to match. Whichever is cleaner. Both ends end up consistent.

### 3.4 Audit log

Keep the existing audit-log row write for the bind (so we know who was added at the door + when + by which staff session). No new audit columns needed.

---

## 4. Out of scope (do NOT change)

- The Choose-from-List **Bind** flow (`bindEscalationExpected` / `bindAdditionalEscalationExpected`) — these were fixed in v5.11.0j and are working on real hardware. Do not touch.
- The Expected list cold-add path (the "Add attendee" surface in Settings or top panel) — out of scope.
- The Staff invite QR path — does not exist yet, forward work.
- Any styling beyond removing the role-chip CSS — if a chip-related CSS class is dead after the strip, you may delete it; otherwise leave styling alone.
- The orange QR generation, the venue check-in flow, the `scan.html` routing — all working post-v5.11.0i.

---

## 5. Pill + cache bumps

After all code changes:
- `Org.html` build pill: bump `v5.11.0j` → `v5.11.0k` (search for the pill string — there's exactly one definition)
- `sw.js` `CACHE_VERSION`: `irlid-shell-v20` → `irlid-shell-v21` with comment noting the v5.11.0k version
- Single commit per logical unit (frontend / worker / pill+cache) is fine; one PR

---

## 6. Acceptance criteria

After Captain merges and Worker is `wrangler deploy`'d, the following smoke MUST pass (Captain will run; you do not deploy):

1. **Add Attendee path is clean:**
   - 4a in orange state → 8 Pro scans orange → escalation modal opens
   - "Add at the door" panel shows: heading, subtitle, First name input, Surname input, green Add Attendee button — NO role chips
   - Captain types "Kerry" / "Austin", taps Add Attendee
   - 8 Pro fingerprint prompts (per-action WebAuthn)
   - NO red `invalid_action_payload` error
   - 4a transitions GREEN with "Welcome back, Kerry Austin"
   - Dashboard shows Kerry IN with `display_name = "Kerry Austin"` (NOT "Unnamed attendee")
   - Kerry's role in the dashboard view = `attendee`

2. **Empty name guard works:**
   - Try Add Attendee with both name fields empty → visible "Enter a name" message, NO Worker call fired

3. **Bind path still works (regression check):**
   - With Kerry already on Expected list, fresh 4a scan → orange → 8 Pro scan → modal shows Kerry in Choose-from-List → tap Bind → fingerprint → green. Identical behaviour to v5.11.0j.

4. **Build pill reads `v5.11.0k` on the dashboard sidebar.**

---

## 7. Codex prompt template (Captain pastes this verbatim)

```
Read HANDOVER-AddAtTheDoor-v5.11.0k.md at repo root and execute.

Branch: codex/v5.11.0k-add-at-the-door
Open PR against main when complete.
Reply when complete with PR number + a one-paragraph diagnosis of the root cause(s) before describing the fix.
```

---

## 8. Notes for Number One after merge

- Captain runs the smoke (see `memory/demo-smoke-test-2026-05-25.md` if Number One created one — otherwise the in-chat smoke step-by-step)
- If any acceptance criterion fails, log a `v5.11.0k-followup` brief — do NOT chain follow-ups into this one mid-flight
- After v5.11.0k green, the next priority is the OrgCheckin.html + OrgCheckinTest.html local-tree cleanup (Captain pulls), then the stale `codex/*` branch sweep

— Number One, drafted 25 May 2026 evening
