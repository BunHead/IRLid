# HANDOVER — Mr. Data — `v6.1.24` — Slim invite QR (short nonce, not the whole token)

**Branch:** `codex/v6.1.24-slim-invite-qr`
**Why:** Today's staff-invite QR was too **dense to scan reliably** and, once opened, prompted a
**PWA install** that interrupted the accept. Root cause: the QR/URL embeds the *entire signed
invite token* (`#staff_invite=<huge encoded payload>`), which packs the code edge-to-edge.

## DIAGNOSE FIRST
The invite already creates an **`org_invites`** row (nonce, role, label, expiry, status — and the
signed `invite_payload`). Confirm: (a) the full signed token is stored server-side in
`org_invites`; (b) whether a **lookup-by-nonce** read endpoint exists (grep the Worker for
`org_invites` reads, e.g. the pending-invites / lookup paths). If no read endpoint exists, add one.

## The fix
1. **Shrink the QR to a short nonce.** Change the invite QR/URL from the full token to
   `https://irlid.co.uk/Org#staff_invite=<nonce>` where `<nonce>` is the existing `org_invites`
   nonce (short, single-use, 15-min TTL). This collapses the QR to a tiny, instantly-scannable code.
2. **Accept flow looks the invite up by nonce.** In the `staff_invite` accept handler (Org.html),
   when the hash is a bare nonce (not a full token), call a Worker **`GET /org/invite/by-nonce/:nonce`**
   (add if missing) that returns the invite details (role, label, org, issuer info needed for the
   accept) for a `status='pending'`, unexpired row. Then proceed with the existing accept/enrol
   path. The Worker still verifies the issuer signature it stored at creation — security unchanged
   (the nonce is a capability token: single-use, short-lived, server-validated).
3. **Backward compat:** if the hash is a long encoded token (old QRs in the wild), keep the
   existing decode path as a fallback. Detect by length / shape.
4. **Suppress the PWA install prompt on the accept path.** When the page loads with a
   `#staff_invite=` hash, capture the `beforeinstallprompt` event and `preventDefault()` it (don't
   show "Add to home screen" mid-accept). Normal PWA install on other pages is unaffected.

## Out of scope
- Changing how invites are *created/signed* (only the QR *payload* shrinks; the signed token still
  lives in `org_invites`).
- The single-device accept/enrol logic itself (works; just reached via a shorter URL).
- Schema beyond what a lookup endpoint needs (org_invites already exists).

## File touch list
| File | Change |
|---|---|
| `Org.html` | invite QR encodes `#staff_invite=<nonce>`; accept handler fetches invite by nonce (long-token fallback kept); suppress beforeinstallprompt on accept |
| `irlid-api-org/src/index.js` | `GET /org/invite/by-nonce/:nonce` lookup (if missing) — returns pending, unexpired invite details |
| `sw.js` | cache bump |
| Build pill | → `v6.1.24` |

## A/R/D expectations
- **✅ ACCEPT ✅** — The invite QR is small + scans first try; scanning it opens the accept screen
  (no PWA install interruption); accept/enrol completes and creates the membership; old long-token
  QRs still work via fallback; security unchanged (nonce single-use, expires, issuer sig still
  verified server-side).
- **⚠️ REVIEW ⚠️** — Nonce reusable / not single-use; install prompt still fires on accept; old
  QRs broken.
- **⛔ DENY ⛔** — Weakens invite verification (skips the issuer signature); makes the nonce
  long-lived; schema change beyond the lookup.

## Smoke
1. + Invite staff → the QR is visibly **small** and scans on the first try
2. Scanning opens the accept screen directly — **no** "add to home screen" interruption
3. Accept & enrol → membership created (check dashboard / D1)
4. An old long-token invite link (if you have one) still works

— Number One (4 June 2026)
