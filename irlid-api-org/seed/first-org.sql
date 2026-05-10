-- v5.9 first-org seed. One-shot insert for Captain's test venue.
-- Replace the placeholder values before applying. After applying, the
-- api_key from the organisations table is Captain's sign-in Bearer token.
-- Captain runs from irlid-api-org/:
--   wrangler d1 execute irlid-db-org --file=./seed/first-org.sql --remote
--
-- Schema note: irlid-api-org/schema.sql defines organisations, not orgs,
-- and stores default settings in organisations.settings_json. There is no
-- separate org_settings table in this v5.9 live baseline schema.

BEGIN TRANSACTION;

INSERT INTO organisations (
  id,
  name,
  slug,
  api_key,
  venue_pub_jwk,
  venue_prv_jwk,
  settings_json,
  created_at,
  updated_at
)
VALUES (
  '<UUID - generate with crypto.randomUUID() and paste here>',
  '<venue name - replace>',
  '<venue slug - replace, e.g. captains-test-venue>',
  '<random 64-char hex - generate with: openssl rand -hex 32>',
  NULL,
  NULL,
  '{}',
  unixepoch(),
  unixepoch()
);

COMMIT;
