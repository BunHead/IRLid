# Demo Smoke Test — Wednesday 13 May 2026

**Target version:** `v5.9.0.13.16` (after PRs #105 + #106 merged).
**Time budget:** ~25 minutes end-to-end. Run start-to-finish; if anything ⚠️ flags, pause and decide whether to ship-with-known-gap or block.

---

## 0. Pre-flight (1 min)

- [ ] Live URL loads: `https://irlid.co.uk/OrgCheckin.html`
- [ ] Sidebar pill reads `Build v5.9.0.13.16` (or whatever's latest after merges)
- [ ] Footer reads "Live / Offline-safe" (not "Test Environment")
- [ ] Signed in as Developer (Super-Admin) on Test Event

## 1. Settings panel — Role vocabulary (2 min)

- [ ] Panel renders below QR test tools with 7 preset chips (Default / Education / Corporate / Healthcare / Hospitality / Conference / Custom)
- [ ] Click "Education" → inputs populate Student / Lecturer / Course lead / Dean / Developer
- [ ] Edit any input → preset chip flips to Custom automatically
- [ ] Save All Settings → toast confirms; no "didn't round-trip" warning
- [ ] Hard refresh → labels persist

## 2. Settings panel — Celebration animation (5 min)

- [ ] All six effect cards click-toggle cleanly (Pulse / Background / QR / Glow / Pattern / Text)
- [ ] Ticking expands the body; unticking collapses
- [ ] Each effect's chips select properly (e.g. QR motion: Wobble / Zoom in / Zoom out / Dissolve horz / Dissolve vert / Rotate CW / Rotate CCW)
- [ ] **Text effect (new from #105):** template field accepts custom text; `{name}` token rendered with attendee name on Preview; position chips work (top/centre/bottom); size chips work (small/medium/large/huge)
- [ ] **Per-effect Muted/Vivid (new from #106):** chips appear on Pulse/Background/QR/Pattern; Glow keeps its existing Muted/Vivid/Hyper

## 3. Preview celebration (2 min)

- [ ] Tick all six effects, hit Preview celebration
- [ ] Centre-screen banner: "Test Attendee CHECKED IN" blue border
- [ ] Body-edge palette flash fires
- [ ] Whole page Background tint cycles (if Background ticked)
- [ ] Preview QR chip fires Pulse + Glow + Pattern + QR motion + Text overlay
- [ ] Preview deny → "Test Attendee CHECKED OUT" red border
- [ ] No console errors (F12 → Console)

## 4. QR test tools — Test fire (1 min)

- [ ] Click Allow mode → click "Test fire animation" → accept celebration fires
- [ ] Click Deny mode → click "Test fire animation" → deny celebration fires
- [ ] Banner shows "Test Attendee" name

## 5. Real check-in flow — small QR (5 min)

This is the demo path. Use a real phone, not the dashboard's preview.

- [ ] Switch to Check-in panel (sidebar)
- [ ] Venue QR visible on dashboard
- [ ] **Phone scans venue QR** (8 Pro or another phone)
- [ ] Phone shows green success page
- [ ] Within 4 seconds: dashboard fires banner ("Name CHECKED IN") + body flash + configured Celebration effects
- [ ] Attendance Today table updates with new row + scan count

## 6. Real check-in flow — fullscreen QR (3 min)

- [ ] Click venue QR or press F → fullscreen mode active
- [ ] Phone scans the fullscreen QR
- [ ] Within 4 seconds: celebration fires on fullscreen holder + banner overlays
- [ ] Press Esc → fullscreen exits cleanly

## 7. Check-out flow (3 min)

- [ ] Existing checked-in attendee scans venue QR again (or use Initiate check-out on dashboard row)
- [ ] Dashboard fires "CHECKED OUT" banner red border
- [ ] Attendance row reflects checkout time

## 8. Offline mode (2 min)

- [ ] DevTools → Network → throttle to Offline
- [ ] Phone scans venue QR → green page still appears (PWA cached)
- [ ] Check-in queues via IndexedDB (look for OFFLINE red dot + queue depth on dashboard footer)
- [ ] Throttle back to Online → SYNCING → green ✓ SYNCED → row appears in Attendance Today

## 9. CSV export (1 min)

- [ ] Click ↓ CSV in topbar
- [ ] File downloads as `irlid-attendance-YYYY-MM-DD.csv`
- [ ] Open file → headers include Name / First seen / Last seen / Scan count
- [ ] ⚠️ Role column NOT YET expected — that's pending Phase 2 of role vocab (stashed branch). Note as known gap.

## 10. Mobile / audit board (2 min)

- [ ] Pop dashboard up on phone or tablet — audit mode reachable via topbar `⛶ Audit`
- [ ] Audit board shows full-screen attendance table, landscape-locked
- [ ] Exit audit → returns to standard dashboard cleanly

---

## Known gaps going into demo (acceptable)

- Role vocabulary Phase 2 dashboard sweep — labels still show as "Attendee/Staff/etc" in Role column and escalation modal. Phase 1 (the panel + persistence) ships; Phase 2 (sweep) is queued.
- Sign-out paper-cut from 10 May — phones occasionally require two clicks first sign-out. Workaround: just click twice. Demo non-blocking.

## ⚠️ Block-the-demo conditions

If any of these surface during smoke testing, pause and escalate:

- Banner doesn't fire on real check-in (the demo's dock-reach)
- Worker rejects settings save (would prevent the role-vocab/celebration changes from persisting for a customer pitch)
- Fullscreen QR broken (limits demo to small-screen)
- Offline mode regression (Tier 2 IndexedDB queue was a v5.5.12 ship; should still work)

## Sign-off

Smoke test completed by: _______________  
Date/time: _______________  
Pass / Pass-with-gaps / Block: _______________  
Notes: _______________
