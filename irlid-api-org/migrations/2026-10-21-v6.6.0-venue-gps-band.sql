-- Venue GPS band (flag only, never refuses a check-in).
-- gps_band: 'near' | 'far' | 'none' (no usable phone GPS) | NULL (org has no venue location).
-- gps_distance_km: rough distance, only for 'far'. The raw phone position is never stored.
-- The Worker also adds these columns on demand (ensureOrgCheckinNonceStorage).
ALTER TABLE org_checkins ADD COLUMN gps_band TEXT;
ALTER TABLE org_checkins ADD COLUMN gps_distance_km REAL;
