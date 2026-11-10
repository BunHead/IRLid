# IRLid

IRLid is browser-based proof that two people, or a person and a venue, really met: each phone signs with its own ECDSA P-256 key, and anyone can check the signed receipt later. No app to install, and no central authority needed to verify a receipt.

Live site: [irlid.co.uk](https://irlid.co.uk). Licence: Apache 2.0 with Commons Clause (see `LICENSE` and `NOTICE`).

## What's in this repo

| Part | Where | What it is |
|---|---|---|
| Website and phone pages | `*.html`, `js/`, `css/` | Static pages on GitHub Pages. `scan.html` and `receipt.html` for one-to-one handshakes, `check.html` to verify a receipt, `org-entry.html` for venue check-in. |
| Org portal | `Org.html`, `settings.html`, `kiosk-code.html` | The organisation dashboard (check-in screen, guest list, kiosk mode, settings). `sw.js` keeps it working offline. |
| Consumer Worker | `irlid-api/` | Cloudflare Worker + D1 for accounts, devices and stored receipts. |
| Org Worker | `irlid-api-org/` | Cloudflare Worker + D1 + a Durable Object for organisations: sign-in, check-ins, guest lists, kiosk, audit log, push updates. |
| Protocol and threat model | `PROTOCOL.md`, `THREAT-MODEL.md` | How the signatures, receipts and check-ins work, and what they do and don't prove. |
| Rules and design notes | `docs/` | `docs/rules.md` is the single source of IRLid's rules. Read it first. |

## Running the tests

Node 22 or later (the tests use the built-in `node:test` and `node:sqlite`). Nothing to install for the unit tests.

    npm test                  # signing library (js/sign.js)
    npm run test:org-worker   # org Worker, against a real in-memory SQLite
    npm run test:api          # consumer Worker
    npm run test:e2e          # browser test (needs Playwright; skips without it)

GitHub runs all of them on every pull request.

## How changes ship

- Every change goes through a pull request. **Merging to `main` deploys**: GitHub Pages serves the site, and the "Deploy Worker" workflow deploys both Workers.
- Database changes are applied by hand, never by a merge (see `irlid-api-org/d1-migrations/README.md` once that lands).
- Release history: `CHANGELOG.md`. The build number shown in the portal is the version pill in `Org.html`, and the offline cache name is `CACHE_VERSION` in `sw.js`. Both are set when a release is merged. `package.json`'s `version` is not the build number.

## Before working on it

Read `AGENTS.md`, `docs/rules.md` and `docs/requirements/offline-first.md`.
