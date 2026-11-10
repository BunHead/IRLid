# Content-Security-Policy plan (review item 4.4)

A Content-Security-Policy (CSP) tells the browser which sites a page may load
scripts, styles, images and connections from. If someone ever manages to
inject a script tag into an IRLid page, a CSP stops the browser running it, or
sending data to a host we don't use.

Today every page has a small meta CSP (`object-src 'none'; base-uri 'self'`).
This plan adds a full policy in safe stages, so nothing breaks.

## Stage 1: write the policy and test it (this PR)

- The policy lives in `security/csp-report-only.txt`, one directive per line.
- `tests/e2e/csp-report-only.e2e.mjs` loads every `.html` page in a real
  browser with that policy sent as a `Content-Security-Policy-Report-Only`
  header and fails if the policy would have blocked anything. Report-only
  never blocks, so the pages run normally during the test.
- If a PR adds a new CDN script or font host, this test fails until the host
  is added to the policy file. That keeps the policy true.
- Limit: the test catches what pages load when they open. Hosts that are only
  reached after a click (for example the venue map search) are listed by hand
  from the code. Reports from real use (stage 2) catch anything missed.

Nothing changes for users in this stage.

## Stage 2: send it live in report-only mode (needs Spencer)

GitHub Pages can't add HTTP headers, and browsers ignore a report-only policy
written as a `<meta>` tag. So to run it live, one of these is needed:

**Option A (recommended): a Cloudflare rule in front of irlid.co.uk.**
This works only if irlid.co.uk's DNS is on Cloudflare with the orange cloud
(proxied) on the record that points at GitHub Pages. Spencer would:

1. In the Cloudflare dashboard, open irlid.co.uk, then Rules, then Transform
   Rules, then Modify Response Header.
2. Add a rule for all requests that sets the header
   `Content-Security-Policy-Report-Only` to the policy text (the lines of
   `security/csp-report-only.txt` joined with `; `).
3. Nothing is blocked. Violations show in the browser console. A later PR can
   add a small report endpoint on the org Worker so they are collected in
   Workers Logs.

Check first: switching the DNS record to proxied can affect GitHub Pages'
HTTPS certificate. Do it at a quiet time and check the site loads.

**Option B: the service worker adds the header.** `sw.js` already serves the
pages for returning visitors, and it can add the header to the HTML it
returns. This only covers visitors whose service worker is installed, and it
must wait until PR #178 (which also edits `sw.js`) is merged. The cache
version would need a bump at merge.

## Stage 3: enforce

When report-only has run for about two weeks with no real violations, send
the same policy as `Content-Security-Policy` (enforcing). With option A that
is renaming the header in the Cloudflare rule. Without Cloudflare, the policy
can go into each page's existing `<meta http-equiv="Content-Security-Policy">`
tag, which does enforce.

## Stage 4: drop 'unsafe-inline'

The policy still allows inline scripts, because the pages use inline
`<script>` blocks and `onclick=` handlers. Moving that code into `.js` files
lets us remove `'unsafe-inline'` from `script-src`, which is the part of a CSP
that blocks most injected scripts. This is a page-by-page job for later PRs.

## Notes

- `frame-ancestors` is left out on purpose: `widget.html` is meant to be
  embedded by other sites.
- `img-src` allows any https image because org logos and QR images can come
  from many hosts.
