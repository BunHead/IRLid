-- v6.7.0 signed check-in (docs/requirements/offline-first.md, check-in signature rules).
-- out_of_hours: 1 when a staff-tier member checked in outside the event's
-- times with a signed staff session, or an offline replay was signed outside them.
-- org_checkin_quarantine: offline replays with a bad or missing device
-- signature, kept for staff review (GET /org/checkin-quarantine), never counted.
-- The Worker also creates both on demand.
ALTER TABLE org_checkins ADD COLUMN out_of_hours INTEGER DEFAULT 0;
CREATE TABLE IF NOT EXISTS org_checkin_quarantine (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, client_checkin_id TEXT, reason TEXT NOT NULL, signed_ts INTEGER, received_at INTEGER NOT NULL, body_json TEXT);
