-- Crowd check-in, step 1: per-display rotating codes (docs/design-crowd-checkin.md).
-- Additive only. The Worker also creates these lazily (src/crowd.js
-- ensureCrowdStorage), so applying this by hand is optional and safe before or
-- after the deploy. Times are UNIX SECONDS.

-- 'standard' (today's behaviour) or 'crowd'. Existing events stay 'standard'.
ALTER TABLE weekly_events ADD COLUMN checkin_mode TEXT DEFAULT 'standard';

-- One row per signed-in staff device showing codes ("Wall screen 1", "Sam's phone").
-- lat/lon is the display's own location, the reference point for "within range".
CREATE TABLE IF NOT EXISTS org_checkin_displays (
  id                TEXT PRIMARY KEY,
  org_id            TEXT NOT NULL,
  event_id          TEXT NOT NULL,
  label             TEXT NOT NULL,
  opened_by_user_id TEXT NOT NULL,
  opened_at         INTEGER NOT NULL,
  closed_at         INTEGER,
  lat               REAL,
  lon               REAL
);

-- Each display's code stream. A code is accepted while current, or for 5 s
-- after superseded_at, never after 90 s, and at most 50 times.
CREATE TABLE IF NOT EXISTS org_crowd_codes (
  code          TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  event_id      TEXT NOT NULL,
  display_id    TEXT NOT NULL,
  issued_at     INTEGER NOT NULL,
  superseded_at INTEGER,
  use_count     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_crowd_codes_display ON org_crowd_codes(display_id, superseded_at);
