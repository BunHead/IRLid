# Proposal: allow two people with the same name in the live database

**Status: APPROVED by Spencer, 25/11/2026 ("Do same name as agreed").** Written as migration `irlid-api-org/d1-migrations/0003_allow_same_name.sql` (R4 exception, see `docs/rules.md` R4). Not applied yet: it is applied only through the "D1 migrations (org database)" workflow after the PR is merged.

## Why this needed a decision (history)

The live org database may still have a unique index made by the old setup scripts
(`irlid-api-org/migrations/apply_v5_11_0_calendar.ps1` and
`apply_v5_11_0_org_expected_reset.ps1`):

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_expected_name
  ON org_expected (org_id, LOWER(display_name)) WHERE archived_at IS NULL;
```

While it exists, the database itself refuses a second active person with the same
name. Removing it needs a `DROP INDEX`. Rule **R4** says database changes only add
things, and `d1-migrations/README.md` plus `d1-migrations-gated.test.mjs` refuse any
migration with `DROP`. So this is not written as a migration file: only Spencer
changes a rule (AGENTS.md, rule 2).

Dropping this index changes no row and loses no data. It only removes a restriction.

## What works without it

The v6.8.27 Worker works either way:

- **Index still there:** same as today. A second person with the same name gets the
  existing "already on the list" message (409), never an error page.
- **Index removed:** two people may share a name, and admins see the key tag.

## Steps (approved 25/11/2026)

1. ~~Agree an R4 exception~~ Done: Spencer, 25/11/2026, for this one file only.
2. Check whether the index exists (read-only):
   `SELECT name FROM sqlite_master WHERE type='index' AND name='uq_org_expected_name';`
3. Done: migration `irlid-api-org/d1-migrations/0003_allow_same_name.sql` in its own PR,
   with `d1-migrations-gated.test.mjs` allowing DROP in this one named file only:

```sql
-- R4 exception (Spencer, 25/11/2026): removes a restriction only; no row changes.
DROP INDEX IF EXISTS uq_org_expected_name;
-- Keep name lookups fast, without the uniqueness.
CREATE INDEX IF NOT EXISTS idx_org_expected_name
  ON org_expected (org_id, LOWER(display_name)) WHERE archived_at IS NULL;
```

4. Apply it through the "D1 migrations (org database)" workflow, never from a laptop.
