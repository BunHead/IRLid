-- v5.9 first-org seed. One-shot insert for Captain's test venue.
-- Replace the placeholder values before applying. After applying, the
-- api_key from the organisations table is Captain's sign-in Bearer token.
-- Captain runs from irlid-api-org/:
--   wrangler d1 execute irlid-db-org --file=./seed/first-org.sql --remote
--
-- Schema note: irlid-api-org/schema.sql defines organisations, not orgs,
-- and stores default settings in organisations.settings_json. There is no
-- separate org_settings table in this v5.9 live baseline schema.
--
-- v5.9 first-run fix 10 May: removed BEGIN TRANSACTION; / COMMIT; wrapper.
-- D1's remote execute disallows raw SQL transactions ("To execute a transaction,
-- please use the state.storage.transaction() or state.storage.transactionSync()
-- APIs instead"); single statements run atomically anyway, so the wrapper was
-- unnecessary AND blocking.

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
  '<api_key - MUST start with "org_" prefix; generate as: org_<random 64-char hex via openssl rand -hex 32>. The dashboard Service-account login rejects keys not starting with org_. Example: org_1f6acd49f4d2f0bb59fdc4d2f98343c2c9119aceedd31fd6297c9207f3154256>',
  NULL,
  NULL,
  '{}',
  unixepoch(),
  unixepoch()
);
