-- IRLid Org dashboard schema, snapshot from irlid-db-test on 2026-05-10. v6 migrations begin from this baseline.
-- v5.9-phase1 fix 10 May: removed `CREATE TABLE _cf_KV` (lines 3-6 of original snapshot).
-- _cf_KV is a Cloudflare D1 internal system table — D1 manages it automatically and
-- rejects user CREATE attempts on names with the `_cf_` prefix with SQLITE_AUTH.
-- The test env had it because D1 auto-created it there; it would be auto-created on
-- the live D1 too, no need (and not allowed) to declare it explicitly.

CREATE TABLE attendee_conflicts (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  org_code           TEXT NOT NULL,
  expected_id        INTEGER NOT NULL,
  checkin_id         TEXT,
  bound_device_fp    TEXT,
  claiming_device_fp TEXT NOT NULL,
  claimed_name       TEXT NOT NULL,
  created_at         INTEGER NOT NULL,
  resolution         TEXT DEFAULT NULL,
  resolved_at        INTEGER
);

CREATE TABLE devices (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  pub_key_id    TEXT NOT NULL UNIQUE,
  pub_jwk       TEXT NOT NULL,
  label         TEXT,
  created_at    INTEGER NOT NULL,
  revoked_at    INTEGER
);

CREATE TABLE link_codes (
  code          TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,
  claimed       INTEGER DEFAULT 0
);

CREATE TABLE login_challenges (
  nonce         TEXT PRIMARY KEY,
  issued_at     INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,
  claimed_by    TEXT,
  session_token TEXT,
  consumed      INTEGER NOT NULL DEFAULT 0,
  fail_count    INTEGER NOT NULL DEFAULT 0,
  locked_until  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE login_sessions (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  issued_at   INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  ip_hash     TEXT,
  user_agent  TEXT
);

CREATE TABLE org_checkins (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organisations(id),
  mode            TEXT NOT NULL,       -- 'attendee_scan' | 'doorman_scan'
  attendee_label  TEXT,                -- display name if known
  attendee_key_id TEXT,                -- pub_key_id from HELLO
  hello_hash      TEXT,                -- SHA-256 of canonical HELLO payload
  score           INTEGER,             -- trust score 0-100
  bio_verified    INTEGER DEFAULT 0,   -- 1 if bioVerified:true in signed payload
  gps_hash        TEXT,                -- SHA-256(canonical(GPS)) — privacy mode
  checkin_at      INTEGER NOT NULL,
  checkout_at     INTEGER,             -- NULL until checkout
  duration_s      INTEGER,             -- populated on checkout
  created_at      INTEGER NOT NULL
, name TEXT, attendee_pub_jwk TEXT, checkout_payload_hash TEXT, checkout_signature TEXT, checkout_ts INTEGER, checkout_method TEXT DEFAULT 'signed', device_key_fp TEXT, status TEXT DEFAULT 'checked_in', expected_id INTEGER, conflict_id INTEGER);

CREATE TABLE org_checkout_tokens (token TEXT PRIMARY KEY, checkin_id TEXT NOT NULL, org_api_key TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, consumed_at INTEGER);

CREATE TABLE org_expected (id INTEGER PRIMARY KEY AUTOINCREMENT, org_code TEXT NOT NULL, first_name TEXT NOT NULL, surname TEXT NOT NULL, status TEXT DEFAULT 'assist', created_at INTEGER NOT NULL, linked_at INTEGER, device_key_fp TEXT, prototype_role TEXT DEFAULT 'attendee');

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
CREATE INDEX idx_invites_org ON org_invites(org_id, status);
CREATE INDEX idx_invites_expiry ON org_invites(expiry_ts) WHERE status = 'pending';

CREATE TABLE org_memberships (
  user_id    TEXT NOT NULL,
  org_id     TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('attendee','staff','manager','lead_admin','developer')),
  granted_by TEXT,
  granted_at INTEGER NOT NULL,
  created_via TEXT,
  PRIMARY KEY (user_id, org_id)
);

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
CREATE INDEX idx_lead_admin_audit_org_created ON lead_admin_appointment_audit(org_id, created_at);
CREATE INDEX idx_lead_admin_audit_appointee ON lead_admin_appointment_audit(appointee_pub_fp);
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

CREATE TABLE org_staff_sessions (
  id                 TEXT PRIMARY KEY,
  org_id             TEXT NOT NULL REFERENCES organisations(id),
  staff_pub_fp       TEXT NOT NULL,
  staff_pub_jwk      TEXT NOT NULL,
  hello_hash         TEXT NOT NULL,
  verification_state TEXT NOT NULL,
  created_at         INTEGER NOT NULL,
  expires_at         INTEGER NOT NULL,
  last_seen_at       INTEGER NOT NULL
);

CREATE TABLE organisations (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  api_key       TEXT NOT NULL UNIQUE,
  venue_pub_jwk TEXT,                  -- persistent venue keypair for attendee-scan mode
  venue_prv_jwk TEXT,                  -- stored encrypted; used to sign QR
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE portal_users (
  id           TEXT PRIMARY KEY,
  pub_jwk      TEXT NOT NULL,
  pub_fp       TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE rebind_history (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  org_code        TEXT NOT NULL,
  expected_id     INTEGER NOT NULL,
  old_device_fp   TEXT,
  new_device_fp   TEXT NOT NULL,
  admin_signature TEXT,
  reason          TEXT,
  created_at      INTEGER NOT NULL
);

CREATE TABLE receipts (
  id            TEXT PRIMARY KEY,
  uploader_id   TEXT REFERENCES users(id),
  receipt_hash  TEXT NOT NULL UNIQUE,
  pub_key_a     TEXT NOT NULL,
  pub_key_b     TEXT NOT NULL,
  ts_a          INTEGER,
  ts_b          INTEGER,
  receipt_json  TEXT NOT NULL,
  verified      INTEGER DEFAULT 0,
  created_at    INTEGER NOT NULL,
  party_info    TEXT
);

CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  device_id     TEXT NOT NULL REFERENCES devices(id),
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL
);

CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT);

CREATE TABLE users (
  id              TEXT PRIMARY KEY,
  display_name    TEXT,
  first_name      TEXT,
  middle_names    TEXT,
  surname         TEXT,
  email           TEXT,
  google_sub      TEXT,
  google_email    TEXT,
  google_name     TEXT,
  google_picture  TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX idx_attendee_conflicts_org ON attendee_conflicts(org_code, resolution);

CREATE INDEX idx_challenges_expires ON login_challenges(expires_at);

CREATE INDEX idx_checkins_at ON org_checkins(org_id, checkin_at);

CREATE INDEX idx_checkins_org ON org_checkins(org_id);

CREATE INDEX idx_checkout_tokens_checkin ON org_checkout_tokens(org_api_key, checkin_id, expires_at);

CREATE INDEX idx_checkout_tokens_expires ON org_checkout_tokens(expires_at);

CREATE INDEX idx_devices_pubkey ON devices(pub_key_id);

CREATE INDEX idx_devices_user ON devices(user_id);

CREATE INDEX idx_memberships_org ON org_memberships(org_id);

CREATE INDEX idx_memberships_user ON org_memberships(user_id);

CREATE INDEX idx_org_apikey ON organisations(api_key);

CREATE INDEX idx_org_expected_org ON org_expected(org_code);

CREATE INDEX idx_org_slug ON organisations(slug);

CREATE INDEX idx_rebind_history_expected_month ON rebind_history(org_code, expected_id, created_at);

CREATE INDEX idx_receipts_hash ON receipts(receipt_hash);

CREATE INDEX idx_receipts_keys ON receipts(pub_key_a, pub_key_b);

CREATE INDEX idx_receipts_uploader ON receipts(uploader_id);

CREATE INDEX idx_sessions_expires ON login_sessions(expires_at);

CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE INDEX idx_staff_sessions_org ON org_staff_sessions(org_id, expires_at);

CREATE UNIQUE INDEX idx_staff_sessions_org_hello ON org_staff_sessions(org_id, hello_hash);

-- v5.10.0 Phase 0 (per-action WebAuthn) — anti-replay nonces for per-action
-- signed envelopes on manager commits. Each envelope carries a 32-byte random
-- nonce that the Worker records on first use and rejects on any subsequent
-- presentation within the freshness window. Rows expire ~10 minutes after
-- creation; a periodic cleanup or per-request GC sweeps stale rows.
CREATE TABLE action_nonces (
  nonce      TEXT PRIMARY KEY,
  used_at    INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_action_nonces_expires ON action_nonces(expires_at);

