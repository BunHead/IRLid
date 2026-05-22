# AUTONOMY-MARKER — Friday 22 May 2026

**Set up by:** Number One at Captain's request before he left for work.
**Purpose:** Hard reference point for `git revert` if anything I do autonomously needs to be unwound.

---

## §1 — Starting state (the marker)

- **Branch:** `main`
- **HEAD commit:** `374271e51c3c8b6d70f4d16ac1a68cdb22908e27`
- **Short SHA:** `374271e`
- **Commit message:** `memory: 21 May addendum — cache fix verified via Incognito; architectural finding banked on hardware-backed signing UX friction (dashboard browser vs phone-Passkey split); follow-up brief candidate v5.11.1/v5.12.0`
- **Local HEAD = origin/main** — verified at session start via `git fetch origin main` + `git log --oneline origin/main..HEAD` (empty) + `git log --oneline HEAD..origin/main` (empty).

**Untracked file at session start (created earlier today before this autonomy run):**

- `memory/PLAN-CleanupAndPort-2026-05-22.md` — the full 8-section cleanup-and-port plan.

**Bash-sandbox stale view warning:** `git status --short` from the bash sandbox shows many files with `M` markers. Per `BOOTSTRAP.md §4` this is a known OneDrive-mount artefact and NOT a real working-tree change. Captain's Windows-side `git status` is authoritative. Don't trust the sandbox for working-tree introspection.

---

## §2 — Scope contract (what I can / can't touch)

Layered safety per Captain's directive:

### TIER 1 — STRICTEST: no autonomous changes
- **Live production site** (`https://irlid.co.uk`) — no deploys, no wrangler, no Pages cache invalidation.
- **Cloudflare Worker** (`irlid-api-org/src/index.js`, `wrangler.toml`) — no edits.
- **D1 database** — no schema changes, no migrations, no data writes.
- **Schema files** (`irlid-api-org/schema.sql`, `irlid-api-org/migrations/*`) — no edits.
- **Secrets / tokens** — no rotation, no inspection beyond what's already in memory.
- **GitHub push** — never. Captain pushes from his Windows machine.

### TIER 2 — CAUTIOUS: no autonomous edits this session
- `OrgCheckin.html` — the live frontend file. Only Captain or Mr. Data edits this. I draft briefs, I don't ship code.
- `js/sign.js`, `js/orgapi.js`, `js/qr.js`, `js/qr-fullscreen.js` — core protocol + dashboard code. Same rule.
- Any HTML at repo root that's published (`org.html`, `org-entry.html`, `org-login.html`, `scan.html`, `settings.html`, `v5-test.html`, `forums.html`, `roadmap.html`, etc.) — same rule.

### TIER 3 — FREE: autonomous work allowed
- `OrgCheckinTest.html` — the mockup sandbox. Mockup work happens here.
- `memory/**` — pending-work, session logs, plan docs, briefs, this file.
- `HANDOVER-*.md` at repo root — drafting briefs for Mr. Data is a writing task, not a code change. Captain reviews before firing.
- Architecture / spec / protocol docs (`SETTINGS-REVAMP-SPEC.md`, `CALENDAR-SPEC.md`, `PROTOCOL-Records-Broker.md`, etc.) — refresh / extend allowed.

### TIER 4 — NOT MY CALL
- Architectural decisions affecting the protocol or product direction — Captain calls.
- Mr. Data dispatch — Captain copy-pastes briefs to Codex's interface.
- PR merges on GitHub — Captain's identity.
- Hardware verification — Captain's phones / tablet / desktop.
- Reddit / Patreon / X / LinkedIn posting — Captain's voice.

---

## §3 — Sanity-check ritual before any Edit/Write

Before any change to a TIER 2 or TIER 3 file I touch this session, I:

1. **Check what tier the file is in** — if it's TIER 1 or TIER 2, I STOP and bank the concern in this file rather than editing.
2. **Confirm change is in-scope** for the current task description (TaskList).
3. **After the change, confirm no other files were unexpectedly touched** by spot-checking with Read.
4. **Log the change in §5 below** with file path and one-line summary.

This is honour-system, not enforced by a hook. The receipt is §5: if a file appears in §5 that isn't in TIER 3, that's a contract breach Captain can see immediately.

---

## §4 — Revert recipe (if anything goes wrong)

### Easiest path — local reset (Captain's Windows machine)
```powershell
cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo"
git fetch origin
git reset --hard 374271e51c3c8b6d70f4d16ac1a68cdb22908e27
git clean -fd memory/  # only if you want to drop the new memory files too
```

This rewinds the local tree to the exact marker. Nothing has been pushed, so origin/main is untouched — no force-push needed.

### If commits HAVE been pushed and you want to revert via GitHub
1. Go to https://github.com/BunHead/IRLid/commits/main
2. Find any commit above `374271e` that you want to unwind.
3. Click the `...` menu → "Revert" on each — GitHub creates a revert PR.
4. Merge the revert PR.
5. `git pull` locally to catch up.

### If commits have been pushed and you want to nuke them entirely
```powershell
cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo"
git fetch origin
git reset --hard 374271e51c3c8b6d70f4d16ac1a68cdb22908e27
git push --force-with-lease
```
**Use `--force-with-lease` not `--force`** — it refuses if someone else has pushed in the meantime, which prevents accidentally overwriting Mr. Data's work.

### Selective revert for just one commit
```powershell
git revert <sha-of-bad-commit>
git push
```
This creates a new commit that undoes the bad one. Cleaner audit trail.

---

## §5 — Change log (this autonomous session)

I'll append a one-line entry below for every file I write/edit during this autonomous stretch. Captain reads this section first on return — anything outside TIER 3 is a contract breach.

| Time (BST) | File | Tier | Change |
|------------|------|------|--------|
| ~start     | `memory/AUTONOMY-MARKER-2026-05-22.md` | TIER 3 | created — this file |
| ~setup+1   | `HANDOVER-CosmeticCleanup-v5.11.1.md`   | TIER 3 | created — Mr. Data brief B1 (cosmetic + light-mode badges + count math) |
| ~setup+2   | `HANDOVER-AttendanceWindow-v5.11.2.md`  | TIER 3 | created — Mr. Data brief B2 (24h window → since-local-midnight) |
| ~setup+3   | `OrgCheckinTest.html`                   | TIER 3 | T4.3.50 — Auth tab wiring: added IDs to 4 form fields + Save All button + pulse span; added v511Auth* JS pattern + V511_AUTH_LS_KEY + load-on-init |
| ~setup+4   | `OrgCheckinTest.html`                   | TIER 3 | T4.3.51 — Tools tab wiring: added IDs to 2 Debug-expander toggles + Save All button + pulse span; added v511Tools* JS pattern + V511_TOOLS_LS_KEY + load-on-init; build pill bumped T4.3.49 → T4.3.50 → T4.3.51 |
| ~setup+5   | `memory/sessions/2026-05-22-01.md`      | TIER 3 | created — session log for Friday morning autonomy stretch |
| ~setup+6   | `memory/pending-work.md`                | TIER 3 | updated — Friday 22 May entry prepended; carry-forward refreshed |

**All edits in TIER 3 — contract honoured.** No live-site files touched. No git push attempted.

(Number One updates this table as work proceeds.)

---

## §6 — Task queue for this autonomous stretch (ordered by drift-risk, lowest first)

1. **Draft Mr. Data brief B1** (`HANDOVER-CosmeticCleanup-v5.11.1.md`) — TIER 3, pure markdown, no code. **Lowest drift risk.**
2. **Draft Mr. Data brief B2** (`HANDOVER-AttendanceWindow-v5.11.2.md`) — TIER 3, pure markdown, no code. **Low drift risk.**
3. **T4.3.50 — Wire Sign-in & auth tab in mockup** (`OrgCheckinTest.html`) — TIER 3, formulaic pattern-replication of T4.3.47 Org-tab pattern. **Moderate drift risk** (any code change can drift); mitigated by tight scope (one tab, one save button, one localStorage key).
4. **T4.3.51 — Wire Tools & diagnostics tab in mockup** (`OrgCheckinTest.html`) — TIER 3, same pattern. **Moderate drift risk.**
5. **Watch-close summary** — update `memory/pending-work.md` + `memory/sessions/2026-05-22-01.md` + this file's §5. TIER 3.

**Out of scope this stretch** (deliberately deferred — too much drift risk for solo work):

- T4.3.52 Roles & staff (mid-weight; defer until Captain reviews T4.3.50/51 pattern).
- T4.3.53 Event & calendar (heaviest; needs Captain's architectural calls).
- SETTINGS-REVAMP-SPEC.md refresh (depends on Captain confirming current mockup intent before re-spec'ing).
- Bug-fix work directly on `OrgCheckin.html` (TIER 2 — not my call).

---

## §7 — Watch-close commit plan (Captain pushes these in order)

When Captain returns and reviews:

1. `git add memory/AUTONOMY-MARKER-2026-05-22.md memory/PLAN-CleanupAndPort-2026-05-22.md memory/sessions/2026-05-22-01.md memory/pending-work.md` — memory commit.
2. `git add HANDOVER-CosmeticCleanup-v5.11.1.md HANDOVER-AttendanceWindow-v5.11.2.md` — brief commit (if drafts complete).
3. `git add OrgCheckinTest.html` — mockup commit (if T4.3.50 and/or T4.3.51 complete).
4. Three separate commits (clean log) OR one combined commit with multi-line message.

Captain's call on commit granularity. Defaults to separated since that matches `memory/crew-protocol.md` precedent.

---

— Number One, marker laid before Captain leaves for work.
