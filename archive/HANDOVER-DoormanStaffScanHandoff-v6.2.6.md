# HANDOVER — Mr. Data — `v6.2.6` — Doorman staff-scan handoff lands on Check-in, no escalation

**Branch:** `codex/v6.2.6-doorman-staff-scan-handoff`
**Severity:** DEMO-BLOCKER (the doorman flow is a headline Imbue beat). Found 7 Jun in a live
multi-device rehearsal.

## Symptom (reproduced on real hardware)
1. Fresh/unrecognised attendee (A20e) scans the venue Check-in QR → correctly gets the **orange**
   "This QR is for staff" device-key screen. ✅ (trust-gate fires correctly)
2. Staff (8 Pro, **already signed in** to the Org dashboard) scans that orange QR → scan.html shows
   "Staff-scan QR detected" → taps **"Open in staff dashboard."**
3. **BUG:** lands on the plain **Check-in tab** — **no escalation modal, no expected list, no auth
   prompt.** The doorman flow never completes; the attendee is never bound/admitted.

## What's already confirmed (don't re-investigate)
- `scan.html` (L1088) builds the handoff URL correctly:
  `dashboardOrigin + "/Org.html?dev=0#staff_scan=" + encodeURIComponent(window.location.href)` — the
  `#staff_scan=` hash IS attached.
- `Org.html` has the intended handler: page-load capture (~L17387-17420, `__staffScanPending`,
  `stashPendingStaffScan`) + `tryProcessStaffScanIfPending()` called after auth (L13505).
- The 8 Pro was signed in (no login redirect; landed on the signed-in Check-in view).

## DIAGNOSE WITH THE 8 PRO CONSOLE (USB remote debug) — pin which of these:
1. **Hash stripped on `/Org.html → /Org` resolution?** Captain's URL bar showed `/Org`, but scan.html
   redirects to `/Org.html`. If GitHub Pages (or a script) canonicalises `/Org.html`→`/Org` and drops
   the `#staff_scan=` fragment, the dashboard loads with nothing to process → defaults to Check-in.
   CHECK: at dashboard load, is `window.location.hash` non-empty and containing `staff_scan`?
2. **Capture not firing?** Does `stashPendingStaffScan` run and persist
   `irlid_pending_staff_scan_payload` to localStorage? Log it.
3. **`tryProcessStaffScanIfPending()` no-op'ing?** Does it run? Does it recognise the `device_key`
   payload and open the escalation, or silently return? Add a console.log at entry + each early-return.

## Fix direction
- If the hash is being dropped, switch the redirect target to the canonical surface the app actually
  loads on (`/Org` not `/Org.html`, or whatever GitHub Pages serves without a fragment-stripping
  redirect), so `#staff_scan=` survives. (Same file-copy/URL trap family flagged at scan.html L15802
  / BOOTSTRAP §6 — fifth+ instance.)
- Ensure `tryProcessStaffScanIfPending()` opens the escalation modal for a `device_key` payload on a
  signed-in staff/dev session, with the expected-list picker + Add-device option.

## File touch list
| File | Change |
|---|---|
| `scan.html` | redirect target so `#staff_scan=` survives the dashboard load |
| `Org.html` | ensure staff_scan hash is captured + `tryProcessStaffScanIfPending` opens escalation for device_key |
| Build pill | monotonic above v6.2.5 |
| `sw.js` | cache bump |

## A/R/D
- **✅ ACCEPT** — 8 Pro scans orange QR → "Open in staff dashboard" → escalation modal appears with
  expected-list + Add-device; completing it binds the attendee and they go GREEN on the dashboard.
- **⚠️ REVIEW** — escalation appears but expected list empty, or auth loops.
- **⛔ DENY** — still lands on Check-in; breaks normal (recognised) check-in.

## Smoke (needs 2 phones — Captain present)
Fresh phone → orange → staff phone scans → escalation → link/add → green on dashboard.

— Number One (7 June 2026) — found via live demo rehearsal
