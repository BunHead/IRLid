# Requirement: offline-first check-in

**Status:** core requirement (set by Spencer, Oct 2026). Builds on PROTOCOL.md §16 (Offline-Capable Operation).

Part of the IRLid rules: see `docs/rules.md` (C1–C16).

## The rule
IRLid check-in **must keep working with no internet**, at the venue, on the phone, or both.

## Why
- Venues lose Wi-Fi (e.g. Imbue Ventures outages).
- Future use: drone-assisted scanning in remote areas (e.g. rural Africa) with no connectivity for hours or days.
- A proof-of-presence tool that fails when the network fails is not trustworthy in the places it matters most.

## Check-in signature rules (v6.7.0, rules v3.1)
The phone signs its check-in hello with its device key (`org-entry.html` `recordVenueCheckin()`: `helloPayload` v2 = `{mode, org, pub, ts, cid, event_id, nonce}`, `helloSig` = ECDSA P-256 over the canonical hash). Only the public key is sent (S3). The Worker (`orgCheckin`, `verifyCheckinSignature`) recomputes the hash, verifies the signature against `helloPayload.pub`, and checks the hello is bound to this org, `client_checkin_id`, event and live code (S1).

**Fresh is the server's call, never a phone flag (S13).** Only a live, unused code the Worker issued makes a check-in `fresh`. Everything else is accepted as `offline` / unverified and never refused (C2, C6, C14): no code (static QR), a stale / used / unknown code, a queued replay, an old hello. `offline_queued` is ignored; `score` / `bioVerified` are stored as reported and never accept or refuse an offline check-in. The phone's clock can only downgrade a check-in, never make it fresh.

| | Live scan (hello signed in the last 120 s) | Queued replay (signed earlier) |
|---|---|---|
| Bad signature | Refused, 401 | **Quarantined** (202, `org_checkin_quarantine`, `GET /org/checkin-quarantine`), visible notice on the phone, not counted (C8) |
| No signature at all, before the cutoff (old cached page) | Accepted as `offline` (C15) | Accepted as `offline` (C15) |
| No signature at all, after the cutoff | Refused, 401, unless the phone's queue marks it as a queued replay: then quarantined (202), so the queue never meets a final error (C8). An unsigned hello's time is never trusted to decide this, so an old page with a slow clock is refused, never shown a false "checked in" | Quarantined |
| Missing, stale, used or unknown code (static QR, crowd mode too) | Accepted as `offline`; the code is evidence only (C6, C14) | Accepted as `offline` |
| Live code, outside event times (30 min before start to end, UTC) | Refused, 403 `outside_event_times`, unless a staff-tier member (staff / manager / lead_admin / developer) sends a signed staff session for the same device key: accepted, flagged `out_of_hours` (C5) | n/a |
| No live code, outside event times | Accepted as `offline`, flagged `out_of_hours` | Accepted as `offline`, flagged `out_of_hours` |
| Already checked in (no check-out yet) | 409 `already_checked_in`: phone shows "Already signed in" and offers check-out; the code is not used up (C4) | Same device and event, scanned within 6 h of an earlier check-in that was not checked out before it: returned as a duplicate, not counted twice (C13). A visit after a check-out, or on another day, is recorded |

**C15 cutoff.** Check-ins with no signature at all (old cached pages, or queued before this shipped) land as `offline` until the server date `CHECKIN_SIGNING_CUTOFF` (Worker var: unix seconds or an ISO date; built-in default 2 Nov 2026, the day signing shipped: no one was using check-in before then, so there is no grace and a public key alone never signs anyone in (S2)). A signature that is present but wrong is never covered by this.

**Clock gap (C12).** Every signed check-in keeps `clock_gap_s` (Worker arrival time minus the phone's signed time). A phone time more than 1 h before arrival, or more than 60 s after it, is flagged `clock_gap` on the response and the receipt. Flagged, never refused. Telling a slow sync from a wrong clock needs a second clock (C16).

**Quarantine cap.** Each org stores at most 200 quarantined bodies per UTC day. Past that the phone still gets the same 202 notice (C8), the body is not stored, and the day's count goes into `org_checkin_quarantine_overflow` (`not_stored` in `GET /org/checkin-quarantine`). Fakes are never counted as check-ins either way (S1).

**GPS (C10).** Only a `near` / `far` / `none` band is stored and shown. No raw position and no GPS hash is kept: not on check-ins, not in receipts, not in quarantined bodies. Org receipts carry the band only.

The phone shows "checked in" only when the Worker returns a check-in id or the check-in is really queued offline; anything else (e.g. a quarantined, uncounted check-in) gets the normal failed message (I1, C9).

The phone's queue holds a check-in until it is past the live window (`not_before`), so a quick reconnect never meets the "already signed in" refusal. Doorman mode (`doorman_scan`) is unchanged: it rides on the staff session.

## What must not break
1. **Check-ins need no nonce.** An `attendee_scan` with no `nonce`, or a stale one, is always accepted (as offline), online or queued. A live code only makes it fresh (see the rules above).
2. **Static / offline venue QR** (the base payload with no `n=`) must stay scannable offline.
3. **Doorman mode** (staff scans the attendee) must keep working offline.
4. **Offline queue** (`js/offline-queue.js`): nonce-less check-ins queue on the phone and sync later with an idempotency key (`client_checkin_id`). Replays must not be rejected just because they are late.
5. **Service worker shell** (`sw.js`) keeps `org-entry.html`, `Org.html`, `receipt.html`, `check.html` and the signing/queue scripts usable with no network.
6. Local receipts must still be created and readable offline (localStorage), then reconcile with the server.

## Known gaps today (main, v6.5.1)
- **Live-QR scan during an outage fails instead of queueing.** `org-entry.html` `postOrgCheckinResilient()`: if the scan carried a nonce and the network is down, it throws "scan the live QR again" rather than queueing. Mitigation: queue it as a nonce-less (offline) check-in, keep the stale nonce only as evidence.
- **Venue laptop offline shows no QR.** `Org.html` `generateVenueQR()`: if issuing a nonce fails while on the Check-in panel it shows "Live QR unavailable". Mitigation: fall back to the static base QR, labelled "offline mode".
- **Crowd events (open PR #134) refuse nonce-less check-ins** (`crowd_checkin_required`, 409). The offline queue treats 409 as terminal and drops it. Fixed by PR #141 (rules v3.1, C14): crowd mode now accepts a missing or used code as `offline`.

## Risks of offline-first, and mitigations that keep offline working
| Risk | Mitigation |
|---|---|
| **Remote replay**: a photo of the QR, with `n=` removed, checks in from anywhere, any time. | Record every nonce-less check-in as `assurance: "offline"` / unverified. Show that on receipts, the dashboard and check.html. Never present it as "fresh". Optional org setting: "require live QR when online". |
| **Clock / time trust**: an offline phone's clock can be wrong or faked. | Phone signs its own timestamp (`checkin_ts`). Server also records `received_at` on sync. Show both; flag large gaps. When the venue has a signed beacon/time (doorman device), prefer that. |
| **Sync conflicts**: duplicate or out-of-order check-ins/outs after reconnect. | Keep idempotency keys. Order by device-signed timestamp. Never drop silently (keep `irlid:queue-dropped` toasts). Show "N waiting to sync". |
| **Terminal-status drops**: 4xx on replay drops the op (offline-queue.js `isTerminalHttpStatus`). | Any new server check (nonce, crowd code, schedule) must accept late, nonce-less check-ins or return a non-terminal status. Add a test for "queued check-in replayed 24 h later still lands". |
| **Google sign-in needs internet.** | Google stays optional. Device keys (local ECDSA / WebAuthn) are the identity for check-in. Linking to Google happens after sync. |
| **Server-only receipts plan** (org receipts listed from the account). | Keep the local copy as the source while offline; merge with the server list when online (match by `receipt_id`). |
| **Account-linking plan / PR #132 auth fix.** | Login proof must be a device-key signature, which works offline to sign and is verified on sync. Don't add steps that need a live round-trip before a check-in can be recorded. |
| **Location (GPS) offline** | GPS works without data; keep privacy mode. Mark "no GPS" rather than failing. |
| **Venue GPS flag (v6.6.0)** | Org sets `venueLat`/`venueLon`/`venueRadiusM` (default 200 m). org-entry sends best-effort phone GPS (4 s, optional). Server (live or on queued replay) stores only a band: `near` / `far` (+ rough km) / `none`; poor accuracy counts as `none`. Flag only, never a refusal. Receipts carry `venue.lat`/`venue.lon`, `gps_band`, `gps_distance_km`; never the raw phone position. |

## Checklist for any PR touching check-in
- [ ] Nonce-less `attendee_scan` offline replay still accepted.
- [ ] Every attendee check-in still needs a valid device signature (a bad one is refused live or quarantined when queued); a live code only makes it fresh.
- [ ] Static QR and doorman mode still work offline.
- [ ] A queued check-in replayed late is not dropped.
- [ ] Offline check-ins are visibly marked, not passed off as live-verified.
- [ ] One visit replayed under a new check-in id is not counted twice (C13).
