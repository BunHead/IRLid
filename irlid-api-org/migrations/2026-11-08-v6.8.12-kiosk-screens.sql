-- v6.8.12 Approved screens for offline kiosk codes (docs/kiosk-lock.md).
-- Additive only (R4). The Worker also creates this table on first use
-- (ensureKioskCodeStorage), so applying this ahead of deploy is optional.
CREATE TABLE IF NOT EXISTS kiosk_screens (
  approval_id         TEXT PRIMARY KEY,  -- the signed action's nonce
  org_id              TEXT NOT NULL,
  kiosk_id            TEXT NOT NULL,
  secret_hash         TEXT NOT NULL,
  approved_by_user_id TEXT NOT NULL,
  approved_by_pub_fp  TEXT,
  approved_at         INTEGER NOT NULL,  -- milliseconds (W10)
  expires_at          INTEGER NOT NULL,  -- milliseconds (W10)
  revoked_at          INTEGER,           -- milliseconds (W10)
  revoked_by_user_id  TEXT
);
CREATE INDEX IF NOT EXISTS idx_kiosk_screens_org_kiosk ON kiosk_screens(org_id, kiosk_id);
