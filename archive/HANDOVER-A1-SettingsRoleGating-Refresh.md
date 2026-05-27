# HANDOVER — Brief A1 Refresh: Settings panel role-gating (post-v5.10 retag)

**Owner:** Mr. Data (preferred) or Number One inline
**Version tag:** `v5.10.2` (was `v5.9.0.15` in the original brief — retagged for the post-Path-B era)
**Priority:** Medium — independent of v5.10.1 Path B, but ship Path B first as a hygiene gate
**Brief written:** Friday 15 May 2026 morning, before-work watch
**Supersedes:** the previous fire of this brief (Thursday 14 May morning) which misfired because the brief was not pushed to origin before the prompt was sent. **The body of the original brief is sound and unchanged — this refresh re-issues it with corrected version tag, current state context, and explicit precondition discipline at the top.**

---

## ⚠ Preconditions before firing (mandatory — BOOTSTRAP §4 discipline)

1. **This brief MUST be visible on `origin/main`** before Mr. Data is prompted. Verify:
   ```powershell
   cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo" ; git ls-remote origin main ; git log origin/main --oneline | Select-String "A1.*Refresh|SettingsRoleGating"
   ```
   If the brief is not on origin, **stop and push first**. Mr. Data cannot read briefs that exist only locally.

2. **The companion brief `HANDOVER-SettingsRoleGatingRefactor.md` MUST also be on `origin/main`** — it carries the full scope this refresh references. Verify with `git ls-files | Select-String "SettingsRoleGating"`.

3. **`v5.10.1` Path B should already be merged.** Not strictly required for A1's logic to work, but landing Path B first means the Settings save endpoint's authority model is the final one before A1 layers per-field role-gating on top. Avoid retrofit churn.

4. **Current main pill MUST be `v5.10.0.5` or later** at brief-fire time. Verify by reading `OrgCheckin.html` line ~3284 for `Build v5.10.x.x` text.

If any precondition fails, surface to Captain before code touch.

---

## What this brief does

Opens the Settings panel to Manager-tier users with per-section role-gating inside, so Managers can edit theme / role vocabulary / celebration config for their org without escalating to Lead Admin. Lead-Admin-only items (invite staff, Org Terms, QR test tools) stay gated.

**The full scope, acceptance criteria, file targets, and style notes are in the companion brief `HANDOVER-SettingsRoleGatingRefactor.md`. Read that file end-to-end before starting code.** This refresh document is a thin layer on top of it.

---

## Retag deltas vs original brief

The original brief was written against the `v5.9.x` codebase pre-Phase-0 per-action-auth. A few small updates for the post-v5.10 era:

### 1. Version tag and pill bump

- **Original:** `v5.9.0.14 → v5.9.0.15`
- **Refresh:** `v5.10.x → v5.10.2` (where `v5.10.x` is whatever's current at fire time — likely `v5.10.1` once Path B lands)

Update `OrgCheckin.html` build pill accordingly. Also bump `sw.js` `CACHE_VERSION` (currently `irlid-shell-v9` from v5.10.0.5; next would be `irlid-shell-v10` for v5.10.1 Path B, then `irlid-shell-v11` for A1). Match whatever increment is current at PR-open time.

### 2. Settings-save endpoint relationship to per-action auth

The original brief's section "3. Worker per-field save validation" assumes the settings-save endpoint validates the caller's role from the Bearer session. **This remains correct for A1.** Settings save is NOT yet per-action signed — it stays Bearer-auth.

Per-action signing for settings save is **Phase 1 of `HANDOVER-PerActionAuth.md`** and comes later (not part of A1). When Phase 1 ships, the per-field role check in A1 will sit alongside the per-action signature gate. A1 does the role-gating; future Phase 1 layers in the signature. Both are additive.

### 3. Developer override clarification

Acceptance criterion 6 in the original brief says "Developer-tier session is treated as `>=lead_admin` for all gating." This now has two paths after v5.10.1 Path B:

- Bootstrap fp's session → developer role → bypasses all gates ✓
- Any device's session with `developer` role on the org (via `org_memberships`) → also bypasses all gates ✓

Both should work after Path B lands. Mr. Data's per-field check should call the same helper used elsewhere (`isBootstrapDeveloperFp` + `org_memberships` lookup, or whatever consolidated helper Path B leaves behind).

### 4. Audit log readiness clause (criterion 8)

Original brief says "the per-field save validation should include a structured log line for each save (e.g., `[settings] actor=<fp> role=<role> field=<field> action=save`)."

**Refresh:** add `session_user_id=<id>` to that log line so the audit trail captures both *who signed* (when per-action signing comes later in Phase 1) and *who authorised* (the session user, after Path B). Example shape:

```
[settings] session_user_id=abc123 actor_fp=n4FzIhV_1jc2u_HO role=developer field=roleVocab action=save
```

For A1, `actor_fp` may be empty (no signature yet) — log it as `actor_fp=bearer` or similar sentinel. Phase 1 will populate it for real.

---

## Discipline notes from last night's misfire

The original A1 brief was fine in content. Mr. Data shipped Brief A1 work when he was supposed to ship Phase 0 of `HANDOVER-PerActionAuth.md`. Root cause: Phase 0 brief was not pushed to origin before the prompt was sent, so Mr. Data couldn't find it. He defaulted to the next-best brief he could see — A1.

The discipline rule banked from that miss:

> **Push briefs to `origin/main` BEFORE firing Mr. Data with the prompt that references them.** Mr. Data reads files from the cloud-synced repo state, not from local file system. If the brief exists only locally when the prompt fires, he will substitute the closest brief he can find — and may ship the wrong thing.

This is now BOOTSTRAP.md §6 pitfall #N (Number One should bank this on next BOOTSTRAP update if not already there).

---

## Acceptance gate before declaring v5.10.2 shipped

In addition to the original brief's 9 acceptance criteria, add:

10. **Worker logs show `session_user_id` in the structured save log line** — Verifiable via wrangler tail on a real save action.
11. **No regression to v5.10.0.5 + v5.10.1 Path B** — Per-action bind from any device with a developer session continues to work. The settings-save endpoint's new field-role validation does NOT interfere with `requireSignedAction` for the bind endpoints.
12. **Pill update propagates** — Build pill on dashboard reads `v5.10.2`, SW cache version incremented, hard-refresh on 8 Pro + desktop both show the new pill within one reload.

---

## Out of scope (explicit — same as original brief plus these)

- **Per-action signed Save** — that's Phase 1 of `HANDOVER-PerActionAuth.md`, NOT part of A1.
- **Audit log persistence to D1** — that's Brief A2 (`HANDOVER-AdminActionAuditLog.md` — exists at repo root if not yet shipped).
- **New permission tiers between Manager and Lead Admin.**
- **Mobile responsive polish of the Settings panel.** A1 is a role-gating refactor, not a layout refresh.

---

## Deliverables

1. **PR title:** `v5.10.2 - Settings role-gating refactor (Brief A1 refresh, post-v5.10 retag)`
2. **Files:** `OrgCheckin.html` (Settings nav + section gating + CSS), `irlid-api-org/src/index.js` (per-field role validation in save endpoint), `sw.js` (CACHE_VERSION bump)
3. **Acceptance:** 12 tests (original 9 + refresh 3)
4. **Memory:** STATE-OF-PLAY.md "Last refreshed" bump + milestone row in CLAUDE.md + pending-work.md update

---

## Mr. Data prompt format (suggested)

When firing Mr. Data, the prompt should reference both files explicitly and confirm the precondition check happened:

> "Read `HANDOVER-A1-SettingsRoleGating-Refresh.md` first (preconditions + retag deltas), then `HANDOVER-SettingsRoleGatingRefactor.md` (full scope). Both are on `origin/main` as of commit [hash]. Ship as PR `v5.10.2`. Confirm preconditions before code touch — surface if any fails."

The hash reference is important: it lets Mr. Data verify he's reading the post-refresh version, not some stale cached copy.
