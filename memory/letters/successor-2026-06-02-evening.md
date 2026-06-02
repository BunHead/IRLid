# Successor Letter — 2 June 2026 evening

**BOOTSTRAP §10 pointer:** Read BOOTSTRAP.md before acting. Local repo: `D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo`. Worker: `irlid-api-org/src/index.js`, deploy from `irlid-api-org/` dir.

---

## State at handover

**Live build:** v6.1.9 (Worker version `1d95c48a`). Calendar event-create working via cross-device QR auth. Check-in/check-out clean. Receipt bridge proven.

**Three Data PRs in flight — your first job:**

All three were pushed to origin branches. v6.1.10 showed "nothing to compare" on GitHub (may already be on main or push failed silently — verify first).

| Branch | What it does | Files |
|---|---|---|
| `codex/v6.1.10-modal-auto-close` | Add event modal closes when cross-device auth starts | Org.html +71/-50, sw.js |
| `codex/v6.1.11-pending-invitees` | Greyed "Pending invite" rows in Staff list | Org.html +210/-79, index.js +78/-23, sw.js |
| `codex/v6.1.12-current-event-qr` | Check-in tab polls + shows running event QR | Org.html +208/-54, index.js +39/-11, sw.js |

**⚠️ SW cache conflict:** v6.1.10 and v6.1.11 both target `irlid-shell-v91`. Merge order: 10→11→12. After merging 10, manually bump 11's sw.js to v92, 12's to v93 before merging.

**After merging:** `git pull` THEN `wrangler deploy` from `irlid-api-org/`. Check Version ID changes.

**Smoke after deploy:** Check-in tab shows "Now: [event name]" badge when an event is running. Open that event in calendar → Edit → Attendance section shows check-ins. That's the proof per-event attendance works.

## Known issues

- `expected_ids_not_found` on phone calendar approval — event saves anyway, ugly error only. Low priority.
- Brand Identity section in Visual Theming is greyed (DESIGN-IN, not backed to D1 yet) — by design, deferred to v5.12.
- QR Appearance merging into Brand Identity — small brief, Captain's call when to do it.
- Patreon v6 announcement draft at `PATREON-V6-DRAFT.md` — Captain rewrites in his voice, posts after v6.1.12 smoke green.

## Wrangler deploy discipline (burned us twice today)

`git pull` BEFORE `wrangler deploy`. Both deploys today shipped stale code. Check the Version ID changes between deploys. This is BOOTSTRAP §6.

## Captain preferences today

- Monkey-brain energy was high — match it
- "Fix event" = the current-event-QR feature (v6.1.12), not design work
- "Design laterz" = visual theming changes deferred
- Lemon and barley water

— Number One, 2 June 2026 evening, retiring at 95%
