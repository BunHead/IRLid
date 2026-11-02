-- v6.7.1 check-in hardening (on top of v6.7.0 signed check-in).
-- clock_gap_s: Worker arrival time minus the phone's signed scan time (C12).
-- org_checkin_quarantine_overflow: per-org, per-UTC-day count of quarantine
-- bodies past the daily cap, so a flood can't fill D1 (S1, C8).
-- Additive only: no UPDATEs, old rows are not backfilled (R4).
-- The Worker also creates both on demand. If the Worker already added
-- clock_gap_s, skip the ALTER (duplicate column).
ALTER TABLE org_checkins ADD COLUMN clock_gap_s INTEGER;
CREATE TABLE IF NOT EXISTS org_checkin_quarantine_overflow (org_id TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (org_id, day));
