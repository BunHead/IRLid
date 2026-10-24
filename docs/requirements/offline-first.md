# Requirement: offline-first check-in

**Status:** core requirement (set by Spencer, Oct 2026). Builds on PROTOCOL.md §16 (Offline-Capable Operation).

## The rule
IRLid check-in **must keep working with no internet**, at the venue, on the phone, or both.

## Why
- Venues lose Wi-Fi (e.g. Imbue Ventures outages).
- Future use: drone-assisted scanning in remote areas (e.g. rural Africa) with no connectivity for hours or days.
- A proof-of-presence tool that fails when the network fails is not trustworthy in the places it matters most.

## What must not break
1. **Nonce stays optional.** `/org/checkin` must accept an `attendee_scan` with no `nonce` (index.js `if (mode === "attendee_scan" && nonce)`). Never make it a hard 400.
2. **Static / offline venue QR** (the base payload with no `n=`) must stay scannable.
3. **Doorman mode** (staff scans the attendee) must keep working offline.
4. **Offline queue** (`js/offline-queue.js`): nonce-less check-ins queue on the phone and sync later with an idempotency key (`client_checkin_id`). Replays must not be rejected just because they are late.
5. **Service worker shell** (`sw.js`) keeps `org-entry.html`, `Org.html`, `receipt.html`, `check.html` and the signing/queue scripts usable with no network.
6. Local receipts must still be created and readable offline (localStorage), then reconcile with the server.

## Known gaps today (main, v6.5.1)
- **Live-QR scan during an outage fails instead of queueing.** `org-entry.html` `postOrgCheckinResilient()`: if the scan carried a nonce and the network is down, it throws "scan the live QR again" rather than queueing. Mitigation: queue it as a nonce-less (offline) check-in, keep the stale nonce only as evidence.
- **Venue laptop offline shows no QR.** `Org.html` `generateVenueQR()`: if issuing a nonce fails while on the Check-in panel it shows "Live QR unavailable". Mitigation: fall back to the static base QR, labelled "offline mode".
- **Crowd events (open PR #134) refuse nonce-less check-ins** (`crowd_checkin_required`, 409). The offline queue treats 409 as terminal and drops it. Mitigation: before merging #134, decide an offline path for crowd events (accept and mark offline, or document that crowd mode is online-only).

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
- [ ] Nonce-less `attendee_scan` still accepted.
- [ ] Static QR and doorman mode still work offline.
- [ ] A queued check-in replayed late is not dropped.
- [ ] Offline check-ins are visibly marked, not passed off as live-verified.
