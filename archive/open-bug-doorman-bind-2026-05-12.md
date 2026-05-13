# Doorman bind — desktop path RESOLVED 12 May 19:00; phone-side dev-recognition outstanding

**Last updated:** 12 May 2026, ~19:00 — desktop path proven end-to-end on v5.9.0.13.25.
**Status:** RESOLVED for the demo. Two independent fresh-bind successes on the same code.

## Resolution summary

The ~2am dossier suggested Worker `.25` might not have deployed — that hypothesis was wrong. `wrangler tail` showed live `attendance` polls and bind POSTs all firing through the deployed Worker. The real story: the bind itself works fine via the **desktop dashboard** path (paste orange-QR text or upload screenshot into Process scan widget → escalation modal opens → Choose-from-List or Add-at-the-door → confirm OK → 200 OK, row appears).

**Successful binds 12 May evening:**
- **Poppy Austin** (Captain's daughter, fresh Android phone) — bound 18:43, scan_count=2 within 60 seconds of bind. Old screenshot from Captain's recycle bin worked as the orange-QR source.
- **Kerry Austin** — Captain deleted Kerry's binding to re-test, re-bound clean at 19:01, scan_count=2.

Wrangler tail throughout: 20+ `GET /org/attendance — Ok` lines, every dashboard action accounted for. Worker `.25` is live; `bootstrapDeveloperFromBearer` accepts org_-prefixed Bearer as developer-tier as designed.

**What the ~2am session got wrong:**
- Hypothesis 1 (Worker .25 not deployed) — wrong; it WAS deployed.
- Hypothesis 5 (silent JS exception) — wrong; no exception, the bind just needed a real envelope from a phone (the localStorage `irlid_last_device_key_b64` diagnostic the previous Number One suggested testing on desktop was empty because that key only gets set on the phone-side `org-entry.html`, not on the desktop OrgCheckin).
- The blocker was diagnostic-flow error, not code error. Once Captain had a real orange-QR image to paste, the path flowed first try.

## Phone-side bind — still fails, but not on the critical path

Captain tried the same flow from his Pixel 8 Pro and got `Staff HELLO proof cancelled` after the "Add at the door" tab confirm.

**Root cause:** the 8 Pro's WebAuthn credential on `irlid.co.uk` RP-ID has pub_fp `65u-S-W_NFxr8u1L`. The Worker's `BOOTSTRAP_DEVELOPER_FP` secret is `TvklFsivZk68R67j` — that's Captain's **desktop** browser's pub_fp. So on the 8 Pro he authenticates as a regular Bearer session (not developer-tier), and the bind endpoint falls through to `requireFreshStaffProof` → frontend prompts for Staff HELLO → Chrome auto-cancels (or Captain cancels) → bind aborts.

**This is auth asymmetry, not a bug.** Desktop browser is developer-tier; phone is not. The Worker's `BOOTSTRAP_DEVELOPER_FP` is currently a single string, not a list.

**Workaround for demo:** doorman scans get processed from the desktop dashboard. Staff phones are still useful for scanning the orange QR via camera app and handing off via `scan.html` deep link — that hand-off lands the staff_scan on the desktop, where the actual bind happens.

**Post-demo fix candidates:**
1. **Multi-fp `BOOTSTRAP_DEVELOPER_FP`** — accept comma-separated list of pub_fps. Simplest; lets Captain enrol his phone as a second developer credential. Worker change: `(env.BOOTSTRAP_DEVELOPER_FP || "").split(",").map(s => s.trim()).includes(pub_fp)`.
2. **D1-backed developer roster** — `developer_pub_fps` table, no Worker redeploy to add new devs. Slightly more architecture for the same outcome.
3. **Org-member developer role inheritance** — Captain already has a `developer` row in `org_memberships` on Test Event. If `requireDevOrStaffSession` ALSO accepted an existing `developer` membership for the Bearer-resolved session's user, the 8 Pro would inherit developer auth from its session, no fp gymnastics needed. Probably the cleanest answer — bootstrap fp is the foothold, the membership row carries developer authority across devices.

Option 3 is what `§14` actually implies; the bootstrap fp is meant to be the foothold, not the permanent ID.

## Historical diagnostic dossier (kept for reference)

Everything below this line was the ~2am dossier. Worth keeping for the wrangler-tail-as-first-check pattern, the Network-tab triage table, and the workaround options that were drafted in case desktop also failed. None of it is current advice — start with the resolution summary above.

---

## Symptom

1. Daughter's phone (fresh device) scans venue QR → shows ORANGE state correctly (stripped device-key QR after `v5.9.0.13.23`)
2. Captain uploads screenshot of orange QR via dashboard's **Process scan** widget
3. Decoder accepts (after `.24` made `verifyDeviceEnvelope` tolerate stripped envelopes)
4. Escalation modal fires correctly with "Poppy Austin" listed under "Choose from list"
5. Captain clicks Poppy row → native browser `confirm("Bind this device to Poppy Austin?")` appears
6. Captain clicks **OK**
7. **Nothing visible happens.** Modal stays open with no status update. No bind. No close.

## What we've shipped trying to fix it (all in live)

- **`v5.9.0.13.21`** — Worker `bootstrapDeveloperFromBearer` accepts org_-prefixed Bearer as developer-tier authority when it matches the validated X-Org-Key. Aligns Worker with frontend's `developerBearerSessionIsActive()`.
- **`v5.9.0.13.23`** — Strip orange QR envelope (drop `sig`, `hash`, `nonce`, JWK `ext`/`key_ops`). Error correction Level H → M. QR roughly half the data. Decoder reads it now.
- **`v5.9.0.13.24`** — Frontend `verifyDeviceEnvelope` accepts envelopes with both `hash` AND `sig` missing (the stripped variant from `.23`).
- **`v5.9.0.13.25`** — Worker `requireDevOrStaffSession` (line 1900) refactored to call shared `bootstrapDeveloperFromBearer` instead of its own duplicate logic. Was missing the org_-Bearer = developer rule, which is the gate the bind endpoint uses.

## Where the bind goes

`POST /org/expected/:id/bind-additional-key` (yes, named "additional" — also used for first-key bind via `bindEscalationExpected` at OrgCheckin.html line 7330).

Worker handler `bindAdditionalExpectedKey` at `irlid-api-org/src/index.js` line 2332.

Chain:
1. `orgAuth(request, env)` — validates X-Org-Key header
2. `requireDevOrStaffSession(request, env, org, body.staff_session)` — gates dev/staff authority
3. Validate pub_jwk + pub_fp
4. INSERT into `org_expected_device_keys` table
5. Return updated expected row

## Diagnostic plan for next watch — DO THIS FIRST

### Step 1 — Confirm `.25` Worker actually deployed

```powershell
cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\irlid-api-org" ; npx wrangler tail
```

Leave the tail running. From another window, hit any Worker endpoint (e.g. refresh the dashboard). The tail should print live request logs. Look at the response status. Note the Worker Version ID.

If `wrangler tail` shows the OLD version still serving, run `npx wrangler deploy` again — the previous deploy may have hung or failed silently.

### Step 2 — Network tab on the failing request

1. Open dashboard in Chrome desktop
2. DevTools → Network tab → Preserve log on
3. Filter for `bind-additional-key`
4. Run the bind attempt (paste orange QR → Process scan → click Poppy → confirm OK)
5. Find the POST request in Network tab
6. **Check three things:**
   - **Request Headers:** is `Authorization: Bearer ...` present? If yes, is the value `qrLoginSession.session_token` or `currentOrg.api_key` (the org_-prefixed one)?
   - **Response status:** 401? 422? 500? 200 with no UI update?
   - **Response body:** what does the error message say?

### Step 3 — Branch on what Step 2 shows

| Status | Body says | Likely cause | Fix path |
|---|---|---|---|
| 401 | `"X-Org-Key header required"` or similar | orgAuth failing — Bearer-only auth path | Frontend not sending X-Org-Key on this endpoint |
| 401 | `"stale_staff_proof"` or `"Invalid staff session"` | requireDevOrStaffSession rejecting | Worker `.25` deploy didn't actually land OR pub_fp doesn't match `BOOTSTRAP_DEVELOPER_FP` |
| 401 | `"Invalid API key"` | X-Org-Key not matching any org | Wrong api_key being sent |
| 422 | `"pub_jwk must be P-256 ..."` or `"pub_fp does not match"` | Envelope body malformed | Stripping in `.23` broke the JWK shape Worker expects |
| 409 | `"device_key_already_bound"` | Daughter's phone already bound to someone | Need to unbind from previous first |
| 200 | `{ok: true, ...}` | **Worker succeeded** — UI bug | Check `bindEscalationExpected` line 7346–7362 for why result isn't closing modal |

### Step 4 — Console errors during the bind

In DevTools Console, watch for thrown exceptions during the bind. Specifically:
- `[escalation] bindAdditionalKey failed` (line 7376 wrap)
- `Could not bind device.` (line 7364)
- Any `Uncaught` exception from the async chain

## Auxiliary issue — modal not popping on phone

Captain noted phone defaults to Check-in panel (correct GDPR default), not Dashboard. The modal SHOULD fire via `tryProcessStaffScanIfPending` which calls `showPanel('dashboard', ...)` first.

If `tryProcessStaffScanIfPending` isn't running on phone:
1. Add `console.log` at function entry to confirm it fires
2. Check `__staffScanPending` is set (means hash was captured)
3. Check `currentOrg?.api_key` is ready (function bails if not)
4. If function fires but no modal: `processDashboardScan` is failing — see error logs

This is lower priority than the bind bug. Phone-staff path can be skipped at the demo if dashboard-staff path works.

## Workaround for demo if bind still fails

**Option A — Pre-bind via the v5-test pairing flow.** Open `https://irlid.co.uk/v5-test.html` on daughter's phone. Run through the WebAuthn enrolment. Her phone's hardware key registers against the org. May skip the orange-QR escalation entirely on first venue-QR scan.

**Option B — Manual Add at the door from desktop.** The "Add at the door" section of the escalation modal (with First name / Surname text inputs + role chips) uses a DIFFERENT Worker endpoint (`/org/expected/create-and-bind`) which ALSO uses `requireFreshStaffProof` (line 2354). If `.25` Worker is deployed, this should work too — and Captain can manually add fresh attendees by typing their name. Try this path if "Choose from list" stays broken.

**Option C — Demo without fresh attendees.** Use only pre-added Expected list members. The dashboard celebration + audit board + offline mode + role vocabulary are all proven. The "we can add fresh people at the door" story takes a backseat for one day. Post-demo investigation finishes the bind path.

## Files involved

- `OrgCheckin.html` lines 7321 (escalationBodyBase), 7330 (bindEscalationExpected), 7387 (addEscalationAtDoor), 8640 (click delegate)
- `org-entry.html` lines 1132 (signedDeviceKeyEnvelope), 1149 (encodeEnvelopeQr), 1164 (refreshOrangeQr)
- `irlid-api-org/src/index.js` lines 1900 (requireDevOrStaffSession), 1917 (bootstrapDeveloperFromBearer), 2332 (bindAdditionalExpectedKey), 2352 (orgExpectedCreateAndBind), 1949 (requireFreshStaffProof)
- `js/orgapi.js` line 36 (request function — Authorization header injection)

## Hypothesis ranking (most likely first)

1. **Worker `.25` wasn't actually redeployed** — Captain pushed git but didn't run `wrangler deploy`. Wrangler tail will tell us.
2. **frontend isn't sending Authorization header on this endpoint** — `developerBearerSessionIsActive()` returns true but `qrLoginSession?.session_token` is `undefined`, falls back to `currentOrg?.api_key`. Worker accepts that since `.25` — IF deployed.
3. **Worker .25 deployed but `BOOTSTRAP_DEVELOPER_FP` env var is empty** (Ctrl+V trap recurrence). Diagnostic: include `debug_*` fields in response body temporarily.
4. **Body shape mismatch** — stripped JWK from `.23` missing fields Worker validator requires. Check `validDevicePubJwk` in Worker.
5. **Silent JS exception** — `bindEscalationExpected` throwing before fetch, error swallowed.

---

**Captain — when fresh tomorrow morning:** start with Step 1 (`wrangler tail`). It costs nothing and confirms whether the Worker is even on `.25` or still serving an earlier version. Most likely answer is there.
