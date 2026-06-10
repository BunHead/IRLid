# DESIGN SPEC — Lead Admin appointment, co-presence-gated

**Status:** ✅ RATIFIED by Captain 30 May 2026. Ready to build (do NOT deploy until smoked in person — co-presence needs Developer + appointee phones together).
**Principle (Captain, 30 Apr + 30 May):** Only the Developer (Super-Admin) appoints Lead Admins. Max one per org, briefly two during a crossover the Developer runs. The grant must require the Developer and the appointee to be **physically co-present** — no async/email/OTP/sendable path. And "co-presence" must mean **real** co-presence (GPS + time, IRLid's own core proof), not a Developer-attested honour system — otherwise we re-introduce the exact overclaim the 30 May honesty pass removed.

---

## Why real co-presence (not a shortcut)

A "Developer scans the appointee's QR in person" gate relies on the Developer's good faith that they didn't scan a screenshot. That's attestation, not proof. IRLid's whole thesis is cryptographic co-presence (GPS within 12 m, same 90 s window, mutually signed). The highest org grant should be made with that exact proof. It's on-brand, and it's the only version we can describe honestly.

**Good news for build size:** the org Worker (`irlid-api-org`) already has `haversineMeters` + the 12 m / 90 s constants (used by the check-in path), and `js/sign.js` has `irlidHaversineMeters`. The co-presence primitives already exist on both sides — we reuse, not rebuild.

---

## The ceremony (in person, both devices)

1. Developer opens **Appoint Lead Admin** (visible only to a Developer session) and picks the appointee (an existing member, or a fresh person who enrols on the spot).
2. The two phones do an IRLid **co-presence handshake** — the existing HELLO → ACCEPT exchange, GPS + time bound:
   - Appointee shows a HELLO QR (their pub key + GPS + timestamp + nonce).
   - Developer scans it, their device adds its own GPS + timestamp, and signs the ACCEPT.
   - Result: a **combined co-presence receipt** — both pub keys, both GPS readings (Haversine ≤ 12 m), both timestamps (≤ 90 s apart), signed by both devices.
3. Developer then signs the **lead-admin grant** with a fresh per-action WebAuthn unlock (v5):
   ```
   { type: "irlid_leadadmin_grant_v5", org_id, appointee_pub_fp,
     copresence_hash: <sha256 of the combined receipt>, ts, nonce }
   ```
4. Client POSTs `/org/lead-admin/appoint` with: the grant envelope, the combined co-presence receipt, and the appointee's pub JWK (+ enrolment envelope if fresh).

## Worker verification (all must pass, atomic)

1. **Developer authority** — issuer fp is a `BOOTSTRAP_DEVELOPER_FP` or has a `developer` membership for this org.
2. **Grant signature** — `verifyV5Envelope` on the grant; UV asserted; fp matches the issuer.
3. **Co-presence proof** — both signatures on the combined receipt verify; `haversineMeters(devGPS, appGPS) ≤ 12`; timestamps ≤ 90 s apart **and** the receipt is fresh (e.g. ≤ 5 min old, so a recorded receipt can't be replayed weeks later); the appointee fp in the receipt == `appointee_pub_fp`; the Developer fp in the receipt == the grant issuer fp. **This is the co-presence gate.**
4. **Max-one** — count current `lead_admin` memberships for the org. If ≥ 1 → reject `lead_admin_exists` (Developer must remove or use an explicit Replace first). *(Decision 2 below.)*
5. **Appointee enrolment** — ensure a `portal_users` row exists for the appointee fp; create it if fresh (mirror of `orgInviteAcceptOnThisDevice`).
6. **Atomic** (`env.DB.batch`): upsert `org_memberships` role `lead_admin` for the appointee; insert an **audit row** recording issuer fp, appointee fp, `copresence_hash`, GPS distance, timestamp. (Immutable audit — design principle: warts-and-all, never rewritten.)

## Frontend

- Developer-only **Appoint Lead Admin** panel (gate on `qrLoginSession.is_developer` / `effectiveRoleRank`).
- Drives the HELLO/ACCEPT handshake against the appointee's device, then the grant signature, then the POST. Clear in-person instruction copy ("Both phones must be together — scan {appointee}'s code now").
- Honest result copy: "Lead Admin appointed — co-presence verified (Xm apart, Ys)". No overclaim.

---

## Decisions — ✅ RATIFIED by Captain 30 May 2026

1. **Real GPS+time co-presence — YES.** The honest option. Issuer is always a bootstrap Developer.
2. **Max-one handling — REPLACE.** Appoint-new + auto-demote-old in one atomic action, so the 2→1 crossover is a single deliberate move with no zero-lead-admin window. (Reject only when something else fails.)
3. **Appointee scope — ALLOW FRESH.** A brand-new person can be appointed in person and enrols on the spot (mirror of `orgInviteAcceptOnThisDevice`). The co-presence ceremony + Developer signature already out-verify the async invite path, so prior membership isn't required for trust.

## Build steps (after sign-off)

- **Worker** (`irlid-api-org`): `/org/lead-admin/appoint` + co-presence verification (reusing `haversineMeters`) + max-one/Replace + audit row + migration for the audit table. Deploy via wrangler. ~120–160 lines.
- **Frontend** (`Org.html`): appointment panel + handshake wiring + grant signing. ~120 lines.
- **Smoke** (real hardware): 8 Pro (Developer) + a second phone (appointee), in person → appoint → verify lead_admin membership + audit row in D1. Negative tests: stale receipt rejected; >12 m rejected; non-Developer issuer rejected; second appointment hits max-one/Replace.

**Not demo-critical** (internal governance, not a live-demo surface), so we have room to do it properly. Mr. Data could take the Worker half tomorrow once his tokens reset, if you'd rather I keep my tank for demo polish.

— Number One, 30 May 2026
