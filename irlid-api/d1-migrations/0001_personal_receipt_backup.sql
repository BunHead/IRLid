-- 0001: personal receipt backup (add-only). NEW TABLE ONLY (R4): receipts and
-- devices are not altered. Not applied by this PR; Spencer applies it by name.
-- Rows are only ever inserted. No route updates or deletes them, and the
-- nightly cleanup does not list this table.
-- Signing keys are never stored: the Worker strips them before the insert.
CREATE TABLE IF NOT EXISTS personal_receipts (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  kind          TEXT NOT NULL CHECK (kind IN ('p2p', 'org')),
  receipt_key   TEXT NOT NULL,   -- p2p: receipt_hash; org: receipt_id
  entry_json    TEXT NOT NULL,   -- the signed receipt, signing keys stripped
  created_at    INTEGER NOT NULL,
  UNIQUE (user_id, kind, receipt_key)
);
CREATE INDEX IF NOT EXISTS idx_personal_receipts_user ON personal_receipts(user_id, created_at);
