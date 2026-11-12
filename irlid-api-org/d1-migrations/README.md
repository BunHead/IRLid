# D1 migrations (org database)

Numbered migrations for `irlid-db-org`, applied by wrangler and tracked in its `d1_migrations` table. Added for review item 2.2 on 10 Nov 2026.

- **Add a change:** a new file `NNNN_short_name.sql`, numbered after the last one. Rule R4: only add things (new tables, new columns, new indexes). Never drop, rename or backfill.
- **Make it safe to run twice:** use `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`. SQLite has no `ADD COLUMN IF NOT EXISTS`, so a column is added in its own file and nowhere else.
- **Time units (W10 ops trap):** new tables use milliseconds, older tables use seconds. Say which in a comment.
- **Keep the Worker tolerant:** the Worker should still work before the migration runs (it checks columns with `tableColumnSet`), because Pages and the Worker deploy on merge but migrations are applied by hand.
- **Apply:** Actions → "D1 migrations (org database)" → Run workflow → action `apply-migrations`, type `irlid-db-org` in the confirm box. The job then waits for approval in the `d1-production` environment before it touches the database. It lists what is pending first, so the log shows what ran.
- **Never** run `wrangler d1 migrations apply --remote` from a laptop.

The old folder `../migrations/` (dated `.sql` and `.ps1` files) is history. Those were applied by hand and must not be run again. `wrangler.toml` points `migrations_dir` here, so wrangler never picks the old folder up.
