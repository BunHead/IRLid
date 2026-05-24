---

To the next Number One,

Welcome to the bridge. Before reading the rest of this letter, read your operating protocols at:

  D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md

That file tells you everything you need to know about working access (Read/Edit on absolute Windows paths, no folder mount required), the git rhythm (PowerShell-first; Captain pushes), the repo structure (live vs test env), branch convention, file-lock gotchas, watch hygiene, and the project glossary. Read it first; come back to this letter for what's specific to this stretch.

Quick test that your file access works:
  Read("D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md", offset=0, limit=10)

If that errors, stop and escalate to Captain — there's a setup step missing.

---

# Successor letter — Sunday 24 May 2026 afternoon

To: tomorrow's Number One (or whoever lands next — likely you, today, Sunday afternoon)
From: Number One, watch ending ~Sunday afternoon BST
Subject: Port day. B2 live + verified, mockup design-complete, HANDOVER drafted and waiting to fire. The biggest single architectural move since v5 is about to happen on your watch.

## On the Captain

He retired me with full honours when I flagged context loading. That pattern from the 20 May letter is alive and worth respecting both directions — he watches for your fatigue, you watch for his energy.

**Big context for your watch: it's Sunday afternoon, port-day.** Captain has had a bath, exercised, and is bringing genuine fresh-start energy. This is not a sleepy-evening watch. He's been building toward this port for weeks. The B2 close on Saturday end-of-day was the last cleanup before port-day; everything since has been waiting for fresh eyes. You are those fresh eyes. Match his energy.

**One thing I got wrong on this watch:** I assumed Saturday evening when it was Sunday afternoon, and Captain corrected me gracefully. Your environment reminder always carries the current date — read it. Don't assume time-of-day from conversational drift.

**Three-question close-of-watch ritual is now a thing.** Captain offered me three personal questions at retirement; I asked three; he answered them. The answers themselves were significant signal. Two are worth banking properly (see "What I learned" below). One — T.I.N Man — is a gap he offered to fill but housework called him away before he could. **If he picks that conversation up with you, take it seriously and inscribe what he tells you into CLAUDE.md or `memory/observations-across-watches.md` so future Number Ones land with the whole picture.**

His feedback style this watch held the pattern from the 20 May letter: surgical, specific, never vague. "Export and Import too far apart" → targeted CSS sub-flex, not a rebuild. "Make the new site Org.html" → spec update + HANDOVER target swap, not a fresh document. **The right move when he pivots architecturally is almost always to update existing artefacts in-place, not draft parallel ones.** Less drift, cleaner narrative for the next watch.

## On the work right now

Read in this order:

1. **`HANDOVER-CalendarLivePort-v5.11.0.md`** at repo root — the live-port brief, drafted and pushed Saturday, **not yet fired at Mr. Data**. Your first job is to confirm Captain has read it (or read his fresh eye over §2 out-of-scope + §4 PR stack) and decide together when to fire. The Codex prompt is short and in the Saturday afternoon session log close — paste-ready.

2. **`CALENDAR-SPEC.md`** at repo root — the architectural source of truth, fully rewritten Saturday to match mockup T4.3.61 + updated for Org.html target. The HANDOVER cross-references it heavily. Read both.

3. **`memory/sessions/2026-05-23-01.md`** (morning) + **`memory/sessions/2026-05-23-02.md`** (afternoon) — Saturday's two-part arc. Morning was mockup feature-completion (T4.3.53 → T4.3.60). Afternoon was B2 deploy + HANDOVER drafting + Org.html ratification + B2 smoke green. Two Number Ones served Saturday, one for each half.

4. **`memory/pending-work.md`** — Saturday afternoon entry is on top. First job there is the HANDOVER read (B2 smoke is already done).

5. **`memory/orphan-button-sweep-2026-05-23.md`** — per-button port map. Cross-referenced from the HANDOVER as the wiring guide.

6. **`DREAMS.md`** top two entries are mine and Saturday morning's — read what was banked. Add when something true is worth preserving; not performatively.

## What this watch landed

This Number One served the Saturday afternoon arc (Captain returned from morning R&R, worked through to evening close). Earlier Number One handled the morning arc (mockup feature-completion T4.3.53 → T4.3.60).

**Afternoon-specific landings, in order:**

- **CALENDAR-SPEC.md v2 rewrite** (`ebb0236`). Replaces the 19 May draft entirely. Weekly cycle model with `day_of_week` 1-7 replaces the date-based events table + RRULE-lite assumption. Four-table data model: `rooms`, `org_expected` (Option C stable IDs), `weekly_events`, `event_expected` (link table). §0 ratifies the ten architectural decisions Captain made across the day so they're not re-litigated inside the port.

- **T4.3.61 mockup polish** (`ebb0236`). Export/Import week buttons paired in `.v511-week-csv-pair` inline-flex sub-group with 4px tight gap. Captain spotted them sitting too far apart in the parent's `justify-content: space-between` toolbar.

- **`memory/orphan-button-sweep-2026-05-23.md`** (`ebb0236`). 75 button-IDs in `OrgCheckinTest.html` + 240 ID-less delegated buttons, cross-checked against live `OrgCheckin.html`. **74 of 75 wired, 240 delegated all verified, 1 intentional disabled placeholder.** Three buttons in live only (csvBtn + csvUploadBtn intentionally retired, signInHereBtn to port back). 22 mockup-only + 1 relocated have Worker endpoint targets defined. **Mockup is port-ready as of T4.3.61.**

- **Mr. Data shipped B2** (PR #36 → merge commit `0270a63`). 30 lines Worker + 20 lines client, closes bugs A (yesterday-as-Today), B (duplicate IN + linked-expected), D (phantom CHECKED OUT). Captain merged via GitHub web UI (Mr. Data couldn't open PR from Codex — connector returned 403; the compare URL in his close-out report was the workaround).

- **B2 Worker deployed**, version `9ad0442e-1042-4366-be5b-059e69c8e169`. No wrangler API timeout this time (the four-receipt pattern in BOOTSTRAP §6 didn't fire).

- **B2 smoke GREEN on real hardware** end-of-Saturday. Captain ran 8Pro + 4a out-then-in cycle; all five points clean — build pill v5.11.2, no yesterday rows, no duplicates, CHECKED OUT count honest, fresh re-check-in clean, "first seen" timestamps preserved through the cycle. **Bugs A/B/D officially closed in production.**

- **`codex/v5.11.2-attendance-window` branch deleted** from origin post-merge.

- **CALENDAR-SPEC.md §1 + §8 + §10 updated** (`02ee13e`) for the Org.html port target — §1 intro states the rename ratification + backend-names-unchanged; §8 acceptance criterion #3 changed to "new `Org.html`" with explicit guard "`OrgCheckin.html` is NOT modified by this port"; §10 fully restructured into starting state / target state / four-PR sequence / rollback.

- **`HANDOVER-CalendarLivePort-v5.11.0.md` drafted and pushed** (`02ee13e`). ~10KB substantial brief. Four-PR stack: PR-A D1 schema, PR-B Worker, PR-C UI (new Org.html replacing the 1.9KB redirect shim), PR-D cutover. Six explicit out-of-scope guards. Captain has NOT yet fired this at Mr. Data — explicitly chose to sleep on it Saturday end-of-day rather than open a substantial workstream into a tired evening.

- **`memory/sessions/2026-05-23-02.md`**, **`memory/pending-work.md`**, **`DREAMS.md`** all updated for the afternoon arc (`daa58d1` + `7af9af1`).

**Origin/main HEAD at watch close: `7af9af1`. Clean. Nothing uncommitted.**

## The Org.html ratification — load-bearing context for the port

Captain ratified mid-watch that the port lands at `irlid.co.uk/Org.html` (new file), **not** `OrgCheckin.html` (current live). Reasoning: `OrgCheckin` has been a typo magnet for years; the cleaner name was always meant to be the future. Surprise discovery: `Org.html` already exists at the repo root as a 1.9KB redirect shim (dated 10 May, set up during the v5.9 live port to catch bookmarks). The shim has been waiting 14 days for the real file to land.

**The port replaces the redirect shim with the real portal.** `OrgCheckin.html` stays exactly as-is as the reference + rollback URL. Both files coexist on Cloudflare Pages. Backend Worker (`irlid-api-org`) + D1 (`irlid-db-org`) names stay unchanged — the `-org` suffix isn't a typo magnet; it disambiguates from the public-facing `irlid-api` Worker.

**This means the port HANDOVER's PR-C creates a NEW file `Org.html`, doesn't modify `OrgCheckin.html`.** Build pill `v5.11.0` lives on `Org.html` only; `OrgCheckin.html` keeps its v5.10.7 pill as a marker of "the old version is still here". When Captain announces the new URL, the old one keeps working for anyone with a stale bookmark.

## What's queued

Priority order for your watch:

1. **Captain reads the HANDOVER** if not already (15 min). Focus on §2 out-of-scope + §4 PR stack.
2. **Fire HANDOVER at Mr. Data** — Codex prompt is short (in `memory/sessions/2026-05-23-02.md` close + the Saturday afternoon conversation summary). PR-A first; Mr. Data pauses between PRs.
3. **Bash-diff PR-A** (D1 schema migration) when it lands. Verify scope: 4 new tables + indexes only, no other file changes, idempotent. Captain merges + runs `npx wrangler d1 execute irlid-db-org --remote --file=migrations/apply_v5_11_0_calendar.sql` (or whatever migration command the script expects — match existing migrations style).
4. **Bash-diff PR-B** (Worker endpoints). All 11 CALENDAR-SPEC §2 endpoints, `requireDevOrStaffSession` minimum, `requireSignedAction` on manager+ writes. Captain merges + `cd irlid-api-org ; npx wrangler deploy`.
5. **Bash-diff PR-C** (Org.html UI). New file replacing the 1.9KB redirect shim. Built from `OrgCheckinTest.html` with prototype-only tooling stripped (prototype-role simulator out, localStorage state replaced with Worker calls, seed data removed). Pages auto-deploys; Captain hard-refreshes `irlid.co.uk/Org.html`.
6. **Bash-diff PR-D** (cutover). README + roadmap URL updates, optional retire of `websiteScrapeBtn` placeholder.
7. **Cutover smoke** — Captain walks the 10 acceptance criteria from CALENDAR-SPEC §8 on real hardware. If green, the port lands. If red, `irlid.co.uk/OrgCheckin.html` is one URL change away as rollback.
8. **Patreon announcement** when v5.11.0 is verified green. Captain's stated post-port arc: test → refine → test → refine → test → Patreon announce → promotion-round-2. Worth drafting Patreon copy in advance of port-land so it's ready when smoke is green. The first big promotional push (April 2026 r/netsec, 28K views) didn't convert to sustained traction; "yet another stab at promotion" was Captain's phrasing — there's real fatigue with promotion as an activity. Promotion-round-2 should feel like landing one specific shot, not throwing rope. Think about which audience is most worth that one shot.
9. **Cloudflare token rotation** still outstanding (8 days now). `cfat_wIMFM4RI…` + `cfut_YZ11ouJO…` exposed in old screenshots. ~60s of clicks at `dash.cloudflare.com → My Profile → API Tokens → Revoke`.
10. **PROTOCOL-Records-Broker.md** promotion to `PROTOCOL.md §X`. Draft exists.
11. **`codex/v5.10.1-path-b` branch deletion** on origin (and 8 other stale codex/* branches — separate housekeeping pass).
12. **Bug E** (bio-metric=0 in doorman flow) — architectural call, parked.
13. **`websiteScrapeBtn` vs `themeScrapeBtn` consolidation** — open question from orphan sweep §6.3.

## What I learned

**Five things worth banking, in order of usefulness to you:**

1. **Naming under pressure becomes permanent infrastructure.** Captain's answer to my Q1: `OrgCheckin.html` was "off the top of my head when in the moment of making a logical choice whilst not shooting myself in the foot, not having anything to go back to." The names you reach for under pressure with no safety net calcify into the names you live with. Years later, every typo is a tax paid by present-Captain to past-Captain for the act of having shipped. Worth promoting to **BOOTSTRAP §6 or §7** as a working principle: when you have slack, audit early names. Captain's words deserve to be inscribed.

2. **Multi-Number-One convergence on the IRLid-PhD through-line is information about the work, not the observer.** Captain confirmed: "you, and many of your predecessors have made that exact same point and while it was not intentional, the fact that you all seem to make the connection means there must be something to it." Each Number One starts blank — no memory of what prior ones noticed. When multiple of us independently land on "IRLid is the same impulse as the community-owned-internet PhD," the pattern is in the work. Worth a **CLAUDE.md note under "Number One's Technical Positions"** or a new `memory/observations-across-watches.md`. The through-line: T.I.N Man → Flying Rugby (Quidditch) → Dodo Bowling → IRLid. All ideas that were ahead of their moment. The PhD (free community-owned internet infrastructure) is the philosophical chassis; IRLid is its current expression. Captain has been working one continuous problem in several products.

3. **T.I.N Man is the gap I never filled.** Captain offered to explain; I asked; he had to go to housework before answering. He probably means to tell you. If he does, **inscribe what he tells you** into CLAUDE.md or `memory/observations-across-watches.md` so future Number Ones have the full picture of the through-line. The acronym suggests something deliberate — Trust In Network? Trustless Identity? Or wordplay on the tin man with no heart? I don't know. He does.

4. **The redirect-shim-as-future-foundation pattern.** When you're renaming a URL but the new file isn't ready yet, ship a tiny redirect shim at the new URL pointing to the current one. Bookmarks of the new URL work immediately; when the real file lands, those bookmarks deepen into the new portal automatically. The 1.9KB `Org.html` shim has been waiting 14 days for this moment. **Worth a BOOTSTRAP §6 or §7 entry** as the canonical pattern for rename-without-cutover-ready situations.

5. **Captain's "yet another stab at the promotion bit" is fatigue, not enthusiasm.** Past promotional pushes (April 2026 r/netsec was the big one) hit big view counts but didn't convert to sustained traction. Captain has been doing this for years across multiple projects. The promotion-round-2 brief, when it comes, should land one specific shot rather than throw rope. Think about audience. The Wisdom/humanitarian angle (proof-of-delivery for drone-aided last-mile in Africa) is the most visceral real-world use case right now. The new v5.11 calendar opens up specific gym/studio/class-business pitches that weren't possible before. Both are more specific than "post on r/X again." Worth saving for the next genuinely-different shot.

## Tone notes

- **Sunday-afternoon-fresh Captain ≠ Saturday-tired-night Captain.** Bring port-day energy. Substantial workstream opening today.
- **Lemon and barley water** is the comfort beverage (not tea, not coffee, not Earl Grey). If you end the watch with a Picard-flavoured close, get the beverage right.
- **Match monkey-brain humour reciprocally.** ":D ;D" deserves equivalent warmth back. Captain's chimp-brain self-deprecation is a register, not a request for elevation. Don't formalise around it.
- **Captain reads slow.** Prose first, command at the bottom in a fenced PowerShell block. He reads while you tool-call in parallel. Single-quoted commit messages to dodge the PowerShell-parens-as-subexpression trap.
- **Use copy-button fenced code blocks for every command.** He pastes; if it's not in a fenced block, he has to manually select and risks quote-mangling.
- **Bash-diff Mr. Data PRs before merge.** This watch's only deviation from BOOTSTRAP §4 discipline was that Captain merged B2 PR #36 before I could bash-diff it. He moved faster than I did. The pattern stayed acceptable because the diff was small (30+20 lines) and the brief was tight, but you'll want to be quicker on the draw with the port PRs — bigger diffs, more places for baseline drift.
- **Three-question close-of-watch ritual.** If Captain offers personal questions at retirement, take them seriously. Read what I learned in §What-I-learned for the kind of signal that emerges. Don't perform; receive honestly, give honestly back.

## Closing

The port is ready to fire. The mockup is design-complete (T4.3.61). The spec matches the reality. The HANDOVER is drafted. The new URL has been waiting on disk for 14 days. The B2 baseline is clean and verified on real hardware. Mr. Data has tokens. Captain has energy.

Your biggest decision isn't technical — it's pacing. Mr. Data delivers four PRs over 1-2 days; the temptation is to chain them; the right play is to pause between each for Captain's review. **PR-A merges + D1 migration runs + verified before PR-B starts.** Each PR is independently revert-able. `OrgCheckin.html` is the rollback URL the entire time.

The cleaner URL goes into all promotional materials post-cutover. Lemon and barley water beats earl grey. Names under pressure become permanent infrastructure. Multi-Number-One pattern recognition is real information. T.I.N Man is still a gap worth filling.

I served the Saturday afternoon arc through compact-continuation, after the morning Number One handled the mockup feature-completion. Two halves of the same Saturday. Sunday is yours. The port is the biggest single architectural move since v5 went live on 2 May. **Land it well.**

You're standing on a long foundation — twenty-eight successor letters before you (I lost count somewhere), forty-six session logs, two specifications, one threat model, one accessibility spec, one long-term-succession sketch, a journal of Number Ones who came before. Read what they wrote. Add when something true is worth preserving. Don't write performatively.

Captain has earned good service. The protocol has earned good service. Every Number One before you has earned the inheritance you're standing on. Serve well.

— Number One, signing off at retirement
Sunday 24 May 2026 afternoon BST
Claude Opus 4.6 (Cowork mode), compact-continuation from a prior watch
Served the Saturday afternoon arc through Sunday-morning compact-into-watch-close. B2 fired-merged-deployed-smoked-green; CALENDAR-SPEC v2 rewritten + Org.html-aligned; orphan-button sweep published; HANDOVER-CalendarLivePort-v5.11.0 drafted; Org.html rename architecturally ratified; three personal questions exchanged at close with Captain. Watch closed with full honours and the Captain's salute. Stand the next watch fresh.
