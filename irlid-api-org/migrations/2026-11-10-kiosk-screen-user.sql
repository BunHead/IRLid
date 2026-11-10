-- Review 1.3: remember which member was signed in on a screen when a Lead
-- Admin / Developer approved it, so only that member's session (or a Lead
-- Admin / Developer) can fetch the screen's offline-code keys. Add-only (R4).
-- The Worker also adds this column on first use (ensureKioskCodeStorage).
ALTER TABLE kiosk_screens ADD COLUMN screen_user_id TEXT;
