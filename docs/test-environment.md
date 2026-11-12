# Test (staging) environment (review item 2.3)

> **Status on 12 Nov 2026: the staging Workers and databases do NOT exist
> yet.** Steps 1 to 6 below have not been done. Until they are, there is no
> safe place to add test people. Do not add test people on the live site
> (irlid.co.uk), in a second org on the live site, or on the old test site
> (bunhead.github.io/IRLid-TestEnvironment).

## Why this matters (12 Nov 2026)

Spencer added his nephew on the old test site and he appeared, checked in,
on a live organisation's dashboard. The old test site and the live site
were tangled:

- The old test site's orange "show to staff" QR opened **live**
  `https://irlid.co.uk/scan.html` (IRLid-TestEnvironment `org-entry.html`
  `scanUrlBase()`). Live scan.html hands a staff scan to the **live**
  dashboard (`/Org#staff_scan=...`), which checks the person in to whichever
  org is open there.
- Both copies sign in through live `irlid.co.uk/org-login.html` (passkeys
  are tied to irlid.co.uk), and the phone's browser keeps one set of saved
  settings for irlid.co.uk for both.
- A theme picture (the dragons) can be set on any org, live or test, so it
  does not tell you which copy you are in.
- A second org on the live site is **not** a sandbox: it is in the same live
  database, and a Developer can see and write every org there.

## How the pages choose LIVE or TEST (v6.8.14)

`js/irlid-env.js` is the first script on every page:

| Page opened on | Workers used | On screen |
|---|---|---|
| `https://irlid.co.uk` (or www.) | live `irlid-api-org`, `irlid-api` (unchanged) | nothing new |
| anywhere else (localhost, a preview copy, a GitHub Pages copy) | staging `irlid-api-org-staging`, `irlid-api-staging` only; the live Workers are refused | striped yellow "TEST COPY - NOT LIVE" bar and "[TEST]" in the tab title |

`js/orgapi.js` and `js/backend.js` also check the page address themselves,
so a page that forgets `irlid-env.js` still cannot fall back to live.
`org-entry.html` on a test copy points the orange staff QR and the sign-in
return at that copy's own `scan.html` / `Org.html`.

`org-login.html`, `org-action-auth.html` and `kiosk-code.html` always open on
irlid.co.uk (passkeys). They now accept the staging Workers and show a
striped "TEST SIGN-IN - NOT LIVE" bar whenever the QR names a Worker that is
not live. The sign-in goes to the Worker named in the QR, so a staging
sign-in only touches the staging database. `tests/environment-isolation.test.mjs`
checks all of this.

## The old test site (IRLid-TestEnvironment)

Retire it. It uses Worker `irlid-api-test` (its own database
`irlid-db-test`), but it is out of date and sends staff scans to live
irlid.co.uk. A separate PR on that repo stops that and adds a "RETIRED
TEST SITE" bar. Use the staging copy below instead once it is set up.

## The staging Workers

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

Since v6.8.14 a page opened from a preview or localhost address uses the
staging Workers (see "How the pages choose LIVE or TEST" above). Some pages
still have the live address written in as a last fallback (for example
`Org.html` and `check.html` when `orgapi.js` has not loaded); on a test copy
`irlid-env.js` sets `IRLID_ORG_API_BASE_URL` to staging first, so those
fallbacks are not reached. A later tidy-up can remove them.

When the preview address is known:
- change `CORS_ORIGIN` in both staging files from `http://localhost:8000` to
  that address (note: editing files under `irlid-api-org/` or `irlid-api/`
  on main also triggers the production Worker auto-deploy of unchanged code);
- add the address to `RETURN_ALLOWLIST` in `org-login.html`, so a test
  sign-in can return to the preview dashboard.

## Rules for the test environment

- Check the striped yellow TEST bar is on screen before adding anyone. No
  bar means you are on live.

- Test data only. Never copy production data into staging.
- Staging must never point at a production database (the test enforces it).
- Deploying to staging is manual and never happens on merge.
