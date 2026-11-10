# Test (staging) environment (review item 2.3)

Today every change is first tried on the live site and the live database.
This adds a separate test copy of both Workers, so a change can be tried
with test data before it reaches real organisations.

**Nothing in this PR creates anything on Cloudflare or GitHub.** It adds
config and a manual workflow that stays switched off until Spencer does the
one-time setup below.

## What this PR adds

| File | What it does |
|---|---|
| `irlid-api-org/wrangler.staging.toml` | Worker `irlid-api-org-staging`, its own D1 database `irlid-db-org-staging`, its own Durable Object for push updates. |
| `irlid-api/wrangler.staging.toml` | Worker `irlid-api-staging`, its own D1 database `irlid-db-staging`. |
| `.github/workflows/deploy-staging.yml` | Manual only ("Run workflow" button). Runs the tests, then deploys both Workers with `-c wrangler.staging.toml`. It stops before deploying if the database ids are still placeholders. |
| `irlid-api-org/tests/staging-env-config.test.mjs` | Fails if staging ever points at the production database, reuses its id, allows the production site, or if the staging workflow could run on push. |

The production `wrangler.toml` files and the main-branch auto-deploy
(`deploy-worker.yml`) are not changed at all. The staging settings are in
separate files that only the manual workflow reads. Both
`wrangler deploy --dry-run` (production) and
`wrangler deploy --dry-run -c wrangler.staging.toml` were checked:
production still binds `irlid-db-org` and `irlid-db`; staging binds only the
staging databases.

If a later PR changes a production `wrangler.toml` (for example the nightly
cleanup cron in #176), copy the change into the staging file when it makes
sense. The config test checks the code entry point, compatibility settings
and Durable Object setup stay the same.

## What Spencer needs to set up (one time)

1. **Create two D1 databases** in the Cloudflare dashboard (Storage &
   Databases, then D1, then Create): `irlid-db-org-staging` and
   `irlid-db-staging`. Each shows a database id.
2. **Paste the ids** into the two `wrangler.staging.toml` files in place of
   `REPLACE_WITH_STAGING_D1_ID` (one in each file), in a small PR. A D1 id
   is not a secret; production ids are already in these files.
3. **Load the tables.** In the D1 console for each staging database, run the
   matching `schema.sql` and then the files in `migrations/` in date order.
   Note: `irlid-api-org/schema.sql` is out of date (review item 2.2), so some
   tables are only created when the Worker first needs them. That is fine on
   an empty test database.
4. **Check the API token.** The workflow reuses the
   `CLOUDFLARE_API_TOKEN_070626` secret. It works if the token is scoped to
   the whole account. If it was limited to the two production Workers, add
   the two staging Workers (and D1 edit) to it.
5. **Staging secrets, only if needed.** Production has secrets set with
   `wrangler secret put` (for example `BOOTSTRAP_DEVELOPER_FP`,
   `ALLOWED_EMAILS`). Staging has none. To sign in as Developer on staging,
   set `BOOTSTRAP_DEVELOPER_FP` for the staging org Worker in the Cloudflare
   dashboard (Workers, then `irlid-api-org-staging`, then Settings, then
   Variables and Secrets). Use a test phone's key if you can.
6. **Run it**: Actions tab, then "Deploy staging Workers", then Run workflow.
   The Workers appear at
   `https://irlid-api-org-staging.irlid-bunhead.workers.dev` and
   `https://irlid-api-staging.irlid-bunhead.workers.dev`.

## The preview website (not done yet, needs a decision)

GitHub Pages has one site and no preview copies. Options for a test copy of
the website:

- **Cloudflare Pages (recommended).** Create a Pages project connected to
  this repository with no build step. Every branch then gets its own preview
  address (`<branch>.<project>.pages.dev`), and production stays on GitHub
  Pages. Spencer creates the project in the Cloudflare dashboard.
- **Run it locally.** `python3 -m http.server 8000` in the repo root, then
  open `http://localhost:8000`. The staging Workers already allow this
  address (`CORS_ORIGIN = "http://localhost:8000"`).

Either way the pages still call the **production** API today: the API
address is written into the code in about 25 places (`js/orgapi.js`,
`js/backend.js`, `Org.html`, `org-entry.html`, `scan.html` and others). A
follow-up code PR would read the API address from one place and choose the
staging Workers when the page is opened from a preview or localhost address
(and add the staging host to the `orgapi.js` allowlist). Until then, a
preview site is useful for layout checks only, not for check-ins.

When the preview address is known, change `CORS_ORIGIN` in both staging
files from `http://localhost:8000` to that address.

## Rules for the test environment

- Test data only. Never copy production data into staging.
- Staging must never point at a production database (the test enforces it).
- Deploying to staging is manual and never happens on merge.
