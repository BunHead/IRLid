-- Baseline (review 2.2, 10 Nov 2026). Nothing to change.
--
-- The live database already has every table and column up to v6.8.13: those
-- were applied by hand from irlid-api-org/migrations/ (dated files and .ps1
-- scripts) or created on demand by the Worker. This first numbered migration
-- only records that starting point in wrangler's d1_migrations table, so every
-- later numbered file is applied exactly once, in order.
SELECT 1;
