# HANDOVER — Mr. Data — `v6.3.0` — Lead Admin appointment (co-presence-gated) — BUILD

**Source of truth:** `HANDOVER-LeadAdminCoPresence-DESIGN.md` (ratified by Captain 30 May).
Read it first — this brief is the implementation of that spec, nothing more.

**⚠️ DEPLOY + SMOKE IN PERSON ONLY.** Co-presence needs the Developer phone + the appointee
phone physically together. Build + push the branches; **do NOT claim end-to-end** — Captain
runs the deploy + the two-phone smoke with Number One. Worker won't take effect until
`wrangler deploy`; migration must be run.

**Two PRs, Worker first** (frontend needs the endpoint to call):
- **PR-A** `codex/v6.3.0a-leadadmin-worker` — migration + Worker endpoint + verification.
- **PR-B** `codex/v6.3.0b-leadadmin-frontend` — the appointment ceremony UI (off PR-A merged).

---

## PR-A — Worker + migration (`irlid-api-org`)

### Migration (new audit table)
New migration script `apply_v6_3_0_leadadmin_audit.ps1` (a PowerShell wrapper that runs
`wrangler d1 execute` — NOT a `--file` SQL; match the existing org-migration pattern). Creates:
```sql
CREATE TABLE IF NOT EXISTS lead_admin_appointments (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  issuer_fp     TEXT NOT NULL,        -- Developer who appointed
  appointee_fp  TEXT NOT NULL,
  copresence_hash TEXT NOT NULL,      -- sha256 of the combined co-presence receipt
  distance_m    REAL,                 -- haversine metres at appointment
  replaced_fp   TEXT,                 -- prior lead_admin demoted in a Replace, else NULL
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leadadmin_appt_org ON lead_admin_appointments(org_id, created_at DESC);
```
Immutable audit (design principle — never rewrite/delete rows).

### Endpoint `POST /org/lead-admin/appoint`
Body: `{ grant, copresence_receipt, appointee_pub_jwk, appointee_enrolment? }` where `grant` is
the v5 envelope over `{ type:"irlid_leadadmin_grant_v5", org_id, appointee_pub_fp,
copresence_hash, ts, nonce }`.

**Verify, in order — all must pass (reuse existing primitives, don't rebuild):**
1. **Developer authority** — issuer fp is a `BOOTSTRAP_DEVELOPER_FP` (`isBootstrapDeveloperFp`)
   OR has a `developer` `org_memberships` row for this org. Else `insufficient_role`.
2. **Grant signature** — `verifyV5Envelope` on `grant`; UV asserted; recomputed pub_fp == issuer fp.
3. **Co-presence proof** (THE gate) — both signatures on `copresence_receipt` verify;
   `haversineMeters(devGPS, appGPS) ≤ 12` (reuse the existing constant); timestamps ≤ 90 s apart;
   **freshness ≤ 5 min** (receipt `ts` vs `now()` — stops replay of an old receipt); the appointee
   fp in the receipt == `grant.appointee_pub_fp`; the Developer fp in the receipt == issuer fp;
   `sha256(canonical(copresence_receipt))` == `grant.copresence_hash`. Any fail →
   `copresence_failed` (generic; put specifics behind a debug flag only).
4. **Appointee enrolment** — ensure a `portal_users` row for `appointee_pub_fp`; if absent and
   `appointee_enrolment` present, create it (mirror `orgInviteAcceptOnThisDevice`’s atomic create).
5. **Max-one = REPLACE (ratified decision 2)** — count current `lead_admin` memberships for the
   org. If ≥ 1, this appointment **atomically demotes** the existing lead_admin(s) → `manager`
   (record their fp in `replaced_fp`) AND promotes the appointee, in ONE `env.DB.batch` — no
   zero-lead-admin window. (Do not reject on max-one; Replace is the intended path.)
6. **Atomic write** (`env.DB.batch`): upsert appointee `org_memberships` role `lead_admin`;
   demote prior lead_admin(s) if any; INSERT the `lead_admin_appointments` audit row.

Return `{ ok:true, appointee_fp, distance_m, replaced_fp }`. Nonce single-use (reuse the existing
action-nonce store if there is one, else dedup on `grant.nonce`).

### Out of scope (PR-A)
- No frontend. No change to other endpoints. Lead Admin still cannot be *invited* (governance —
  Developer-appointment only); don't touch the invite path.

---

## PR-B — Frontend ceremony (`Org.html`), off PR-A merged

- **"Appoint Lead Admin"** panel, **Developer-only** (`qrLoginSession.is_developer` /
  `effectiveRoleRank` === developer). Lives in **Sign-in & Auth** tab (the authorization home).
- Pick appointee: an existing member OR "appoint a fresh person here" (they enrol on the spot).
- Drive the in-person **HELLO → ACCEPT co-presence handshake** against the appointee's phone
  (reuse the existing check-in HELLO/ACCEPT exchange + `irlidHaversineMeters` in `js/sign.js`),
  producing the combined receipt. Clear copy: *"Both phones must be together — scan {appointee}'s
  code now."*
- Then sign the `irlid_leadadmin_grant_v5` grant with a fresh per-action WebAuthn unlock (v5),
  and POST to `/org/lead-admin/appoint`.
- **Honest result copy:** *"Lead Admin appointed — co-presence verified ({distance}m apart,
  {seconds}s)."* If it's a Replace: *"… {old name} stepped down to Manager."* No overclaim.

---

## File touch list
| File | Change |
|---|---|
| `irlid-api-org/migrations/apply_v6_3_0_leadadmin_audit.ps1` | NEW audit table |
| `irlid-api-org/src/index.js` | `/org/lead-admin/appoint` + verification (PR-A) |
| `Org.html` | Appoint Lead Admin panel + handshake + grant signing (PR-B) |
| `sw.js` | cache bump (PR-B) |
| Build pill | → `v6.3.0` (PR-B) |

## A/R/D expectations
- **✅ ACCEPT ✅** — In-person: Developer appoints appointee → both within 12 m / 90 s → grant
  signed → D1 shows appointee `lead_admin` + an audit row with distance + copresence_hash; a
  second appointment demotes the first to manager (Replace) atomically; honest result copy.
- **⚠️ REVIEW ⚠️** — Co-presence not actually verified (distance/time/freshness skipped); audit
  row missing fields; Replace leaves two lead_admins or a zero-window.
- **⛔ DENY ⛔** — Any "Developer attests" shortcut bypassing real GPS+time (re-introduces the
  overclaim the honesty pass removed); lead_admin made invitable; non-atomic write; rewrites/deletes
  audit rows.

## Smoke (IN PERSON, with Captain — 8 Pro Developer + appointee phone)
1. Appoint a fresh appointee in person → success + honest distance/time copy
2. D1: `lead_admin` membership + `lead_admin_appointments` audit row present
3. Negative: stale receipt (>5 min) rejected; >12 m apart rejected; non-Developer issuer rejected
4. Second appointment → Replace: prior lead_admin demoted to manager, no zero-window

— Number One (4 June 2026)
