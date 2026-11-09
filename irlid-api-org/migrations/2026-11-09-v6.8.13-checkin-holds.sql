-- v6.8.13: first-scan hold (option C, docs/design-first-time-approval.md).
-- A first-time phone signs a hold on the live code it scanned, so its
-- check-in after staff approval is still "fresh". Single use, bound to one
-- device key, expires 10 minutes after the hold. The Worker also creates the
-- table on first use (ensureCheckinHoldStorage), so this is optional.
CREATE TABLE IF NOT EXISTS org_checkin_holds (id TEXT PRIMARY KEY, nonce TEXT NOT NULL, org_id TEXT NOT NULL, event_id TEXT, device_key_fp TEXT NOT NULL, hello_hash TEXT, held_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER, checkin_id TEXT, UNIQUE (nonce, device_key_fp));
