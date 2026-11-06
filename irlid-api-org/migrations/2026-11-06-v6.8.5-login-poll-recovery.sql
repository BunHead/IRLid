-- v6.8.5 QR login: lost-reply recovery (PR B).
-- poll_secret_hash: SHA-256 (b64url) of the secret /org/login/init gives the
--   desktop. Never in the QR. Every /org/login/poll must present the secret.
-- consumed_at: when the desktop first collected the session.
-- recover_count: lost-reply recoveries used (max 3, within 120 s).
-- Additive only, old rows not backfilled (R4). The Worker also adds these on
-- demand; if it already did, skip the ALTERs (duplicate column).
ALTER TABLE login_challenges ADD COLUMN poll_secret_hash TEXT;
ALTER TABLE login_challenges ADD COLUMN consumed_at INTEGER;
ALTER TABLE login_challenges ADD COLUMN recover_count INTEGER NOT NULL DEFAULT 0;
