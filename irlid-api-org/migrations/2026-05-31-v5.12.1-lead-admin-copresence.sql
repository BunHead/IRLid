CREATE TABLE IF NOT EXISTS lead_admin_appointment_audit (
  id                       TEXT PRIMARY KEY,
  org_id                   TEXT NOT NULL REFERENCES organisations(id),
  issuer_user_id           TEXT,
  issuer_pub_fp            TEXT NOT NULL,
  appointee_user_id        TEXT,
  appointee_pub_fp         TEXT NOT NULL,
  copresence_hash          TEXT NOT NULL,
  distance_m               REAL NOT NULL,
  time_delta_s             INTEGER NOT NULL,
  developer_ts             INTEGER NOT NULL,
  appointee_ts             INTEGER NOT NULL,
  gps_json                 TEXT NOT NULL,
  replaced_lead_admin_fps  TEXT NOT NULL DEFAULT '[]',
  grant_nonce              TEXT NOT NULL,
  created_at               INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_admin_audit_org_created
  ON lead_admin_appointment_audit(org_id, created_at);

CREATE INDEX IF NOT EXISTS idx_lead_admin_audit_appointee
  ON lead_admin_appointment_audit(appointee_pub_fp);

CREATE TRIGGER IF NOT EXISTS lead_admin_appointment_audit_no_update
BEFORE UPDATE ON lead_admin_appointment_audit
BEGIN
  SELECT RAISE(ABORT, 'lead_admin_appointment_audit is immutable');
END;

CREATE TRIGGER IF NOT EXISTS lead_admin_appointment_audit_no_delete
BEFORE DELETE ON lead_admin_appointment_audit
BEGIN
  SELECT RAISE(ABORT, 'lead_admin_appointment_audit is immutable');
END;
