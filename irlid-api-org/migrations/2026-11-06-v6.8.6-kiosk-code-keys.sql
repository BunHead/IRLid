-- v6.8.6 Offline kiosk unlock codes (docs/kiosk-lock.md).
-- Additive only (R4). The Worker also creates this table on first use
-- (ensureKioskCodeStorage), so applying this ahead of deploy is optional.
CREATE TABLE IF NOT EXISTS kiosk_code_keys (
  key_id     TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  pub_fp     TEXT NOT NULL,
  seed       TEXT NOT NULL,
  created_at INTEGER NOT NULL,   -- milliseconds (W10)
  revoked_at INTEGER             -- milliseconds (W10)
);
CREATE INDEX IF NOT EXISTS idx_kiosk_code_keys_org ON kiosk_code_keys(org_id);
