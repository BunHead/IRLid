-- v6.4.15 — Org authorization audit log.
-- Append-only, immutable ledger of every privileged authorization in an org:
-- who did it, when, what, on whom/what, and whether it was allowed or denied.
-- Mirrors the immutability posture of lead_admin_appointment_audit (no UPDATE,
-- no DELETE triggers) — the audit log is the ultimate warts-and-all record and
-- must never be rewritten. Additive: creating this table touches no existing
-- data, so it is safe to apply before OR after the Worker deploy. Until it
-- exists, the Worker's audit writes are best-effort no-ops and the viewer
-- endpoint degrades to an empty list.
--
-- created_at is UNIX SECONDS (now()), matching lead_admin_appointment_audit and
-- action_nonces — NOT milliseconds. Frontend must multiply by 1000 for Date().

CREATE TABLE IF NOT EXISTS org_audit_log (
  id                 TEXT PRIMARY KEY,
  org_id             TEXT NOT NULL,
  actor_user_id      TEXT,                 -- portal_users.id of the signer/authoriser (nullable)
  actor_pub_fp       TEXT,                 -- 16-char device fingerprint of the signing key
  actor_display_name TEXT,                 -- name snapshot at action time (viewer falls back to a live JOIN)
  actor_role         TEXT,                 -- effective role at action time
  action             TEXT NOT NULL,        -- e.g. irlid_bind_v5, lead_admin_appoint, invite_create, member_remove
  target             TEXT,                 -- human summary of what/whom (e.g. "Becky Wetherill as Manager")
  target_ref         TEXT,                 -- optional machine reference (id / fp / nonce)
  outcome            TEXT NOT NULL DEFAULT 'allowed',  -- 'allowed' | 'denied'
  detail             TEXT,                 -- optional reason / context (e.g. denial reason, co-presence metrics)
  nonce              TEXT,                 -- the signed-action nonce, when present
  created_at         INTEGER NOT NULL      -- UNIX SECONDS
);

CREATE INDEX IF NOT EXISTS idx_org_audit_log_org_created ON org_audit_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_audit_log_actor ON org_audit_log(actor_pub_fp);

-- Immutability: append-only. Same guard pattern as lead_admin_appointment_audit.
CREATE TRIGGER IF NOT EXISTS org_audit_log_no_update
BEFORE UPDATE ON org_audit_log
BEGIN
  SELECT RAISE(ABORT, 'org_audit_log is immutable');
END;
CREATE TRIGGER IF NOT EXISTS org_audit_log_no_delete
BEFORE DELETE ON org_audit_log
BEGIN
  SELECT RAISE(ABORT, 'org_audit_log is immutable');
END;
