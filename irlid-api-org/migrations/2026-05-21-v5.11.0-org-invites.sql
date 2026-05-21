-- v5.11.0 - Staff-invite QR flow.
-- Replaces the earlier token-hash invite sketch with the signed one-shot
-- invite table from HANDOVER-StaffInviteQR.md.

DROP TABLE IF EXISTS org_invites;

CREATE TABLE IF NOT EXISTS org_invites (
  nonce TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  role TEXT NOT NULL,
  issuer_pub_fp TEXT NOT NULL,
  expiry_ts INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_ts INTEGER NOT NULL,
  redeemed_by_fp TEXT,
  redeemed_ts INTEGER,
  FOREIGN KEY (org_id) REFERENCES organisations(id)
);

CREATE INDEX IF NOT EXISTS idx_invites_org ON org_invites(org_id, status);
CREATE INDEX IF NOT EXISTS idx_invites_expiry ON org_invites(expiry_ts) WHERE status = 'pending';

ALTER TABLE org_memberships ADD COLUMN created_via TEXT;
