# IRLid Pre-HN-Launch Audit — Number One's Triaged Verdict (4 Jul 2026)

Source: 67-agent adversarial workflow (12 finders → skeptic-verify → synthesize), then
**Number One re-verified every load-bearing finding against the actual code.** The raw workflow
flagged "25 launch-blockers"; that count is inflated — this file is the triaged truth.

## Verdict: LAUNCH-AFTER-A-FOCUSED-HALF-DAY. Crypto core is sound. Real must-fix list is short.

---

## ⛔ CRITICAL TRIAGE CALL — the raw report's #1 "blocker" is a FALSE POSITIVE

**"B1 / hash-validation bypass → receipt forgery" (irlid-api/src/index.js:229,252) is NOT a bug.**
When `a.hash` is absent, `a_hash=true` — BUT `a_sig` is still verified against `computedA`, the hash
**recomputed from the actual payload** (`verifySig(computedA, a.sig, aPub)`). The signature already binds
payload integrity; `a.hash` is a redundant field that compact QR receipts legitimately strip (documented
in CLAUDE.md + the paper). The described "omit hash and forge" attack fails at the signature check; a
forger who supplies a *correct* hash passes anyway — so making the hash mandatory adds ZERO security and
**would brick every compact receipt in the wild.** DO NOT APPLY the recommended fix. (Optional: add a
clarifying comment. No functional change.) This is the single most important call in the audit.

---

## TIER 1 — REAL, fix before Monday (all cheap, genuinely worth it)

1. **Open redirect — scan.html** (`scan.html:1168,1176`). `classify()` checks only the URL *pathname*,
   then sends the whole untrusted URL to `location.href`. A QR encoding `https://evil.com/org-login.html`
   redirects the scanner to a phishing page. **Fix:** validate `new URL(c.v).origin === location.origin`
   before navigating, at both sites. ~4 lines. REAL.
2. **Open redirect — org-entry.html** (`redirect`/`staff_redirect` params, ~602/608/766/771). Same class,
   but *persistent* (baked into a printed venue QR), fires at the post-check-in trust moment. **Fix:**
   client — allow only same-origin/relative; server — validate `redirectUrl`/`staffRedirectUrl` as
   public https at the update handler. REAL.
3. **Unauthenticated `POST /org/register`** (`irlid-api-org:2744`, routed :5699). Zero auth, mints an org +
   api_key. Vestigial — real creation is `userCreateOrg`. **Fix:** delete the route (confirm frontend
   doesn't call it) or add `requireSession`. Org-spam/key-farming on a public launch day. REAL.
4. **Error-message leak on public `/verify`** (`irlid-api:884`). `err("Internal error: " + e.message)`
   leaks internal state incl. allowlisted-origin names (an enumeration oracle). **Fix:** generic
   `err("Internal server error", 500)`; keep `console.error`. One line. REAL.
5. **Missing SRI on CDN scripts** (`scan.html`, `check.html`, `org-entry.html`, `Org.html` — html5-qrcode,
   jsQR, qrcodejs, iro.js). Textbook first-hour HN critique for a security tool: CDN/BGP compromise injects
   code into the scan/crypto path. **Fix:** add `integrity="sha384-…" crossorigin="anonymous"`, pin exact
   versions. Mechanical, high reputational value. REAL.
6. **Overclaim copy pass** (`about.html:313` "can't be … forged"; `about.html:184` "physically present
   together"; `features.html:362`/`check.html` "confirms physical co-presence"; `pitch-humanitarian.html`
   "Proof That Aid Reached a Real Person"; `features.html:410` "biometric"). Self-inflicted vs your own
   THREAT-MODEL — HN torches overclaims. **Fix:** reword to the honest framing you already use elsewhere
   (evidence/attested/agreement, hardware-backed/device-unlock not biometric, tamper-evident not proof).
   Reputational, not exploitable — but launch is a credibility event. REAL.
7. **widget.html hardening** (embeddable-by-design). No `frame-ancestors` (clickjacking), `postMessage`
   with `targetOrigin:'*'` + no `event.origin` check (cross-origin GPS leak), `target="_blank"` w/o
   `rel`. **Fix:** CSP `frame-ancestors 'self' https://irlid.co.uk`; specific targetOrigin; validate
   `event.origin`; add `rel="noopener noreferrer"`. REAL for the one page meant to run in untrusted frames.

## TIER 2 — real but OVERSTATED / do if time (hardening, Captain's call on some)

8. **googleAuth silent device reassignment** (`irlid-api:483`). Real defect but NO private-key transfer,
   so NOT the "critical account takeover" claimed. It's a deliberate hand-me-down-device convenience.
   **Decision needed:** reject with 409 (safer, breaks hand-me-down) vs keep + require consent. Consumer
   OAuth path only (secondary login).
9. **isDebugOrg auth bypass** (`irlid-api-org:4801`). Real orgs are protected by the api_key requirement;
   only the public test org is exposed. **Fix (hygiene, source going public):** remove the isDebugOrg
   short-circuit from clear-attendance + drop the hardcoded `org_DEV_IRLID_TEST_ENVIRONMENT` key.
10. **CSP** — genuinely valuable BUT risky: inline scripts everywhere, a strict CSP could break a page
    Monday. **Advice:** add a permissive-but-real CSP (or Report-Only) now; tighten post-launch. Do NOT
    rush a strict CSP that breaks pages on launch day.
11. **nav.js escape display_name** (`nav.js:72`) — self-XSS only; one-line escape as hygiene.
12. **`IRLID_ORG_API_BASE_URL` validation** (`orgapi.js:6` + inline copies) — only exploitable post-XSS/
    CDN-compromise; cheap defence-in-depth, do it with the SRI pass.
13. **logoUrl SSRF** — server-side validate with `parsePublicHttpUrl` like `websiteUrl`. Medium; if time.
14. **Security headers** (Referrer-Policy, Permissions-Policy, X-Content-Type-Options) — GitHub Pages can't
    set headers; deliver on the Workers now, static pages need a `_headers`/Cloudflare-Pages move
    (post-launch infra decision).

## TIER 3 — DO NOT ACT (false positives / defensible design / trivial polish)

- **B1 hash "forgery"** — false positive (see top). Do not touch.
- **localStorage session token** — documented, deliberate v5 posture; standard practice; not a bug.
- **is_developer localStorage UI reveal** — executive endpoints enforce server-side auth (verified), so
  it's cosmetic screenshot optics, not real privilege escalation. Optional post-launch: gate the UI reveal
  on a server `/user/me` confirmation.
- Same-origin `target="_blank"`, og:image, `#888` contrast, heading order — post-launch polish backlog.

## CLEAN BILL (verified genuinely sound — the important signal)

- **ECDSA / canonical() / SHA-256 / DER↔raw core (`js/sign.js`)** — no forgery or canonicalisation-collision
  path. The crypto is correct.
- **Server-side auth on executive org endpoints** (clear-attendance, lead-admin appoint, staff bind/invite)
  — real Bearer + role enforcement for real orgs.
- **Google OAuth token validation** — signature/audience/issuer/expiry correct.
- **Internal link integrity** — all hrefs/anchors resolve; no 404s.
- **Slug-collision protection** — attackers can't hijack an existing org's slug.

## Recommended execution order (a focused half-day)
Tier 1 items 1–4 + 7 are pure frontend/Worker edits (fast, low-risk). Item 5 (SRI) is mechanical. Item 6
is a copy pass. Then Tier 2 items 9, 11, 12 are cheap add-ons. CSP (10) done as permissive/report-only.
Captain decides items 8 (hand-me-down) and the CSP strictness. Deploy Workers + Pages, re-smoke, launch.
