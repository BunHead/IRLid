-- R4 exception (Spencer, 25/11/2026): removes a restriction only; no row changes.
DROP INDEX IF EXISTS uq_org_expected_name;
-- Keep name lookups fast, without the uniqueness.
CREATE INDEX IF NOT EXISTS idx_org_expected_name
  ON org_expected (org_id, LOWER(display_name)) WHERE archived_at IS NULL;
