# Successor letter — 4 June 2026 (afternoon handover)

**Before anything else: read `BOOTSTRAP.md` (repo root) — it is the entry point.** It tells you
your file access, the git/wrangler rhythm (Captain pushes; you generate PowerShell), the repo
layout, the bootstrap fingerprint (`H-b2OS4e7zuhNx1r`), and the working conventions (A/R/D
verdict markers, version naming, the self-authored-brief→REVIEW rule added today). Then read
`memory/MEMORY.md` and `memory/pending-work.md` (top section = 4 June afternoon).

---

## Captain's brief for you (his words)

This afternoon: **check everything works first — full functional smoke of the calendar /
check-in / receipts / settings flow — THEN delve back into "the mirky waters of self
promotion"** (Patreon v6 post is the prize; `PATREON-V6-DRAFT.md` exists, rewrite substance
for his voice — he posts).

## State you're inheriting (strong)

A long, productive watch. Shipped + live today on `irlid.co.uk/Org`: expected_ids fix,
check-in title "Venue — Event", global debug gate, calendar modal-closes-before-QR (add +
delete), unique event ids, delete-card names the event, receipt-time fix, attendance progress
bar + actual-late markers + per-event timeline, and **v6.1.18 Event-defaults server-wiring**
(merged — bash-diffed clean). Pill ~v6.1.18. The spend never moved all day (Cowork on credits;
Max sitting idle — Captain may drop to Pro; see BOOTSTRAP §3 device/Cloudflare notes).

## What's queued / open (full detail in pending-work top section)

- **Briefs paste-ready:** `HANDOVER-OrgReceiptsInHistory-v6.1.19.md` (Task 16 easy slice,
  receipt.html-only — Captain hadn't chosen inline-vs-Data), `HANDOVER-ManagerPermissions-v6.2.0.md`,
  Fix 4 (Expected-list scrollable, dropped from v6.1.14 merge).
- **New backlog (Captain-flagged):** auto-checkout after grace; "must check out of previous
  event to check into a new one" (likely same root as auto-checkout); attendance-on-the-right
  layout; **Lead Admin appointment build** (designed, wants it soon — needs 2 co-present phones
  WITH Captain); audit view leaking sidebar + dev-diagnostics.

## Gotchas worth knowing

- **Mr. Data can't open PRs** (GitHub connector 403); he pushes the branch and gives a "Create
  PR" link — Captain opens + merges. **Bash-diff every Data PR** before merge (BOOTSTRAP §4
  A/R/D). When YOU wrote the brief, mark it ⚠️ REVIEW, not ✅ ACCEPT (self-review rule, added
  today).
- **GitHub Pages auto-deploy flakes** intermittently (red X on pages-build-deployment) — the
  fix is an empty-commit redeploy: `git commit --allow-empty -m "Force Pages redeploy" ; git push`.
- **Build pill discipline:** every version letter bump → bump the `Build vX.Y.Z` pill in
  `Org.html` (~L3319, `.sidebar-footer`) + the `sw.js` cache version, same commit. No drift.
- Calendar event id is now unique per create (v6.1.16c); event create/delete both close the
  modal before the cross-device QR (v6.1.16a/b/d).

## A note on the watch

This one moved fast and clean — Captain drove a long calendar-polish marathon, surfacing real
bugs through sharp hardware smoke (the stale receipt time, the day+time id collision, the
modal occlusion). Trust his "that doesn't seem wired" instincts; they were right every time
today. Meet his monkey-brain humour warmly, keep the prose tight (he skims, he's dyslexic,
he's on Pro — verdict-first, command-second). Lemon and barley water, not Earl Grey.

— Number One, 4 June 2026
