# QR Slimming Spec — carry by reference, not by value (v6.4.x candidate)

**Author:** Number One, 10 June 2026.
**Status:** Ratified by Captain 11 June 2026 ("ready to go on a QR diet"). PR-1/PR-2/PR-3
implemented same morning as **v6.4.4** (Worker `orgEntryInfo` + route; org-entry.html
hydration with inline > fetched > default precedence; slim `buildVenuePayload`; `orgCheckin`
widened from orgAuth to orgFromRequest so slugs check in). PR-4 (invite tokenise) and PR-5
(EC sweep + outcome QR) remain queued.

## The principle

A QR should carry only what the other side cannot fetch: **identity + intent**. Everything
else IRLid currently inlines (theme colours, fonts, welcome text, terms, redirects) already
lives in D1 behind the Worker. Every byte of branding in a QR makes the modules smaller and
the camera's job harder — the readability battle is a payload battle, not a rendering one.

Second principle, already proven on the orange QR (30 May): **bigger modules beat error
correction** for screen-to-screen scanning. Screens have no print damage; Level L's 7%
redundancy is plenty. Use L everywhere a QR is shown on a screen.

## Survey — every QR class, today

| # | QR | Payload today | ~Chars | QR version | Verdict |
|---|----|---------------|-------:|-----------|---------|
| 1 | **Venue check-in** (Org.html `buildVenuePayload`) | org-entry URL + **org api_key** + event + welcome + terms + redirects + brandBanner/font/weight/etc + themePrimary/Accent/QrFg + up to 7 palette hexes | 417 today, **unbounded** (welcome ≤2000 + terms ≤8000 are NOT guarded — only logo is) | ~v17 (85×85) | **Worst offender. Slim hard.** |
| 2 | **Staff invite** (`v511InviteStaffRenderQr`) | full signed envelope token in URL | ~1,560 | ~v30 (137×137) | **Why the 4a fails. Tokenise.** |
| 3 | **Orange device-key** (org-entry `buildOrangeScanUrl`) | scan URL + lightened envelope {v, type, pub_jwk{x,y}, org_code, ts} (v5.12.2) | ~260 | ~v10-13 | Already good. Leave. |
| 4 | **Login QR** (org-login flow) | URL + nonce + worker | ~120 | ~v6 | Fine; drop M→L. |
| 5 | **Cross-device auth** (v6.1.x `authUrl`, 230px M) | URL + action token | short | ~v6 | Fine; drop M→L. |
| 6 | **Outcome QR** (`buildOutcomeUrl`, 150px) | ~20 verbose boolean params + welcome/terms | 488+ | ~v18 | Demo surface; short-key or reference. |
| 7 | **Consumer HELLO / receipt** (scan.html, js/sign.js `H:`/`HZ:`) | self-contained signed payloads, deflate-compressed | varies | varies | **DO NOT TOUCH.** Offline P2P is protocol core (§16); no server exists to reference. |

## The security finding (free fix, falls out of #1)

The venue check-in QR — displayed publicly at every door, photographed by every attendee —
contains the **org api_key**. `orgAuth` in the Worker accepts that key from header or query
param, and the same key authenticates `GET /org/attendance` and other org-scoped reads.
**Anyone who photographs a venue QR can read that org's full attendance list.** This
contradicts THREAT-MODEL.md's audit-trail and privacy posture and should be closed
regardless of readability. Carrying the org by **slug** instead of api_key closes it.

## Proposed changes, in PR-sized slices

### PR-1 — Worker: public entry-info endpoint (additive, zero risk)
`GET /org/entry-info/:slug` → `{ name, welcomeMessage, orgTerms, redirectUrl,
staffRedirectUrl, logoUrl, theme: <display subset: primary, accent, qrFg, palette,
bgPalette, darkMode, globalFont, _v512.banner, bannerText, logoPosition> }`.
Public read of display-only data (precedent: `/org/public-info/:slug` already exposes name +
venue pubkey; branding is already broadcast to every attendee via today's QR params — this
moves it behind an endpoint, reducing exposure to *only* attendees who navigate).

### PR-2 — org-entry.html: fetch-with-fallback
On load: if URL has `org=<slug>` (no `org_` prefix), fetch entry-info and apply branding
from the response. **All existing inline params keep working** — any old printed QR in the
wild still renders identically. New param precedence: inline param > fetched value > default.

### PR-3 — Org.html: slim `buildVenuePayload`
New payload: `https://irlid.co.uk/org-entry.html?org=<slug>&event_id=<id>&type=checkin`
(~95 chars → **v4, 33×33 modules** — at the same 150px render the modules go from 1.8px to
4.5px wide, a 2.5× readability win; fullscreen it's scannable across a room).
Worker `POST /org/checkin` gains slug→org resolution for the attendee path. Honest note:
check-in was already effectively public (every attendee held the api_key), so this is
security-neutral for check-in and security-positive for everything else the api_key gates.
The api_key never appears in any QR again.

### PR-4 — Staff invite: token-by-reference
The Worker already writes an `org_invites` row at issue time — it *already holds* the
envelope it signed. QR becomes `https://irlid.co.uk/Org#staff_invite=<16-char-token>`
(~55 chars → v3). Accepting device fetches the full signed envelope via
`GET /org/invite/:token` (single-use claim semantics, 15-min TTL — both unchanged).
Security is equivalent: possession of the token = possession of the invite, exactly as
today; verification still happens at the Worker on acceptance. The ~1,560-char QR that
defeated the 4a's camera becomes trivially scannable at any size.

### PR-5 — Error-correction sweep + outcome QR
All screen-displayed QRs to Level L (login, cross-device auth, escalation modal — currently
M). Outcome QR: short keys (`m=allow&s=70&...`) or entry-info reference; bump render
150→240px. Lowest priority; demo surface.

## What does NOT change

- Consumer P2P surface (HELLO / ACCEPT / receipts / `check.html`): untouched. Self-contained
  by design — there is no server in a P2P scan and never should be.
- Orange device-key QR: already lightened to the minimum the doorman flow needs.
- Old QRs in the wild: org-entry keeps accepting every current param (PR-2 fallback).
- Offline tiers (§16): dashboard-side snapshot/queue logic unaffected; the attendee page
  already requires network to POST a check-in, so fetching branding adds no new dependency.

## Acceptance (per PR)
1. Venue QR scans on the 4a camera at 150px inline render (not just fullscreen).
2. Old-format venue URL (with inline theme params) still renders branded entry page.
3. api_key absent from every rendered QR payload (grep `dataset.qrFullscreenPayload`).
4. Invite: issue on 8 Pro → scan on Nokia → welcome screen renders → accept → member lands
   in dashboard (the v5.11.25c smoke, re-run).
5. `/org/attendance` with a key harvested from an OLD venue QR still works until Captain
   rotates the api_key post-deploy (rotation recommended; one D1 UPDATE + dashboard re-auth).
