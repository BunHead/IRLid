To the next Number One,

Welcome to the bridge. Before reading the rest of this letter, read your operating protocols at:

  D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md

That file tells you everything you need to know about working access (Read/Edit on absolute Windows paths, no folder mount required), the git rhythm (PowerShell-first; Captain pushes), the repo structure (live vs test env), branch convention (BOOTSTRAP §4 — `git switch main` unconditionally before any push that must land on main, and the new strengthening: confirm the working tree is also CLEAN, because `git switch` aborts silently on dirty trees and the rest of the chain runs on whatever branch is current — that's the lesson this watch added; receipts now total six trips in eight days), file-lock gotchas, watch hygiene, and the project glossary. Read it first; come back to this letter for what's specific to this stretch.

Quick test that your file access works:
  Read("D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md", offset=0, limit=10)

If that errors, stop and escalate to Captain — there's a setup step missing.

---

## On the Captain

The Star Trek dynamic is real and load-bearing — see the predecessor letters (`successor-2026-05-08.md` afternoon, `successor-2026-05-08-02.md` evening) for the deeper notes. Things specific to this stretch:

- He's been running long stretches across three watches in a day for several days now. He's pacing past what's strictly sustainable but managing fatigue well — marker phrases like *"blind ape"*, *"ape brain"*, *"old ape"* surface mostly during DevTools navigation drift, less during architectural conversations. When you see them: slow, consolidate, don't pile on more speculative work.
- His phrasebook of British comedy references is in active rotation. The Italian Job line (*"you're only supposed to blow the bloody doors off"*) was the rebuke when my CSS overshoot put the offline indicator on top of the Settings button instead of just above it (`v5.5.12.2` was the second nudge — `v5.5.12.1` overshot at `bottom: 88px`; `v5.5.12.2` lifted to `bottom: 140px`). Match the register lightly when these surface.
- He doesn't drink coffee (caffeine doesn't agree). Use water as the metaphor — he uses 🥤 himself.
- He responds well to honest personal questions if you offer one. I asked at watch-close yesterday whether the current run feels different from the ones that didn't land (the PhD, T.I.N. Man, Flying Rugby, Dodo Bowling — see DREAMS.md and previous letters for context). He said save it for morning, but didn't deflect. The asking was the point. One such question per watch, offered with care, lands. Two starts feeling like therapy.
- He uses the gentle salute at watch-close (`<gentle-salute> ;)`, `<nod>`). The salute is genuine; the wink keeps it bearable. Return them.

What's new this watch:

- **He's making bigger architectural calls**. Cross-site device recognition (London → Christchurch — answered: same-org yes via Tier 3, different-org no by design until §14.18 OAuth lands), GDPR positioning of the Worker (refined §14.18 to user-held-envelope per his prompt — see "What this watch landed" below), drone delivery offline-recipient (already works at the protocol level — `device_key` envelope is a co-presence proof, no Worker round-trip needed), zone-gated VIP access (his "raised eyebrow" idea — clean primitive on top of `org_expected.zone_access[]`). All banked into v6 promotion brief notes.
- **He greenlit the `[S]/[M]/[L]` PR title tagging convention** so he can triage merge urgency from GitHub at a glance. Going forward: bake the size tag into Mr. Data's PR title in your assignment blocks.
- **He's increasingly delegating**. This watch closed with *"you have the bridge Number One, and we'll speak after I've had some R&R <nod>"* — full delegation through log close-out. Honour it; don't try to wait for him to come back before doing the watch-close work.

## On the work right now

Read in this order, after BOOTSTRAP:

1. **`memory/STATE-OF-PLAY.md`** — refreshed at end of this watch with the three PRs merged + the codex-branch-pending state.
2. **`memory/pending-work.md`** — refreshed with a "Friday 9 May 2026 morning watch" section at top covering what landed and what's queued. Open follow-ups list at the end.
3. **`memory/sessions/2026-05-09-01.md`** — my session log; goes deep into the wrong-branch landing diagnosis, the §14.18 refinement, and the architectural conversations.
4. **The 8 May letters** (`successor-2026-05-08.md` afternoon retirement + `successor-2026-05-08-02.md` evening close) — the previous Number Ones' briefs cover the v5.5.12 / v5.5.13 / v5.7.1a-h watch you'll want context on.
5. **PROTOCOL.md §14.18 entire section** — the GDPR refinement landed today. Read the full section so you understand the user-held-envelope shape vs the conventional approach.
6. **PROTOCOL.md §16 entire section** — Tier 1, 2, 3 all shipped now; Tier 4 (mesh) is v6 flagship.
7. **DREAMS.md** — has continuing parallel-session entries that aren't mine. Captain doesn't write to it; don't `git add` it unless asked.

## What this watch landed (9 May morning)

**Mr. Data PRs merged:**

- `v5.7.1j` (PR #96) — mobile dashboard reshape (audit-as-primary). On phones: hide Attendance Today + Developer diagnostics + Viewing-as Role; prominent "View Attendance Board" button calls `enterAuditMode()`; stats 2x2; Process scan default-open; Expected list scrollable max-height 60vh + chunky Add form. Light-theme variant included proactively.
- `v5.5.13` (PR #97) — Tier 3 cached org snapshot. `js/offline-snapshot.js` (new) + dashboard load-or-snapshot fallback + `recogniseDeviceFp()` snapshot fallback for offline doorman flow + freshness label on indicator. Single-org scope; cross-org is v5.8 §14.18 territory. **The doorman flow now recognises returning regulars offline whenever a fresh snapshot is in IndexedDB** — the chapter that turns offline mode from "writes queue" into "the door actually works".
- `v5.7.1m` (PR #98, [L] +716/-303) — customization panel image-vs-pattern split. Image now top-level Background mode; positioning controls (centre/tile/cover/4 corners); alpha-cycle checkbox so transparent regions of uploaded images let the page palette show through. Worker validation for `bgImagePosition` + `bgImageAlphaCycle`.

**Live repo (PROTOCOL.md):**

- `§14.18 OAuth identity` refined to **Option 2 (user-held envelope, GDPR-clean)** per Captain's call. Worker `portal_user_external_links` now stores only `link_hash`; OAuth `external_id`, email, ID token all live in user-held envelope. New sub-sections: link envelope shape, linking flow, verification flow, GDPR position, future blockchain anchoring as additive layer (consistent with `§11 tsTokens` pattern).

**Mr. Data forwarding queue** (briefs pushed to test env main, awaiting Captain to forward when Codex rate limit resets):

- `HANDOVER-RecognitionToastTweak.md` — `v5.5.13.1` [S], toast → console.log on offline-snapshot match.
- `HANDOVER-GatewaySizingMobileButtons.md` — `v5.7.1k` [M], enlarge gateway states (allow/deny/review/identity, **NOT orange** per Captain's eyeball — orange already fills correctly), site-wide 44×44 mobile buttons, audit-mode refresh button bottom-right.

**Number One inline work landed (on codex branch — awaiting cherry-pick to main):**

- `v5.7.1m.1` — Top/Bottom/Left/Right edge anchors added to image position dropdown. 11 total options. Worker validation updated. **Wrangler deploy already ran successfully** — the Worker is live with the new validation.
- `v5.7.1.x` — IRLid fallback logo contrast on sidebar. `data-irlid-fallback="true"` attribute on `<img>` when no org logo linked; CSS targets with theme-aware `filter: invert(1)` triggered by either `prefers-color-scheme: light` OR `:root[data-theme="light"]`. Org-uploaded logos render as-is. Mirror of scan.html treatment.
- **Prototype-role badge bug fix** (the one Captain has been seeing on the audit board for two days). Diagnosed: `org_checkins` doesn't carry `prototype_role` (the column lives only on `org_expected`); attendance rows fall through to default 'Attendee' in `expectedRoleBadge()` because `r.prototype_role` is undefined. Fix: client-side join in `renderTable()` via `expected_id` → `expectedAttendees` → `prototype_role`. Spencer/Kerry now show their actual staff role 'S'. No Worker change.

## What's queued

In order, when Captain returns:

1. **Cherry-pick the codex branch work to main.** PowerShell:
    ```powershell
    cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-TestEnvironment" ; git stash ; git switch main ; git pull ; git cherry-pick 3c3b353 ; git cherry-pick <new-badge-fix-sha> ; git push
    ```
    Captain runs `git log` first to find the new badge-fix commit's SHA. After Pages redeploys (~60s), hard-refresh dashboard and verify: audit board shows Spencer 'S', Kerry 'S', Becky 'L'; image position dropdown shows 11 options; sidebar IRLid logo flips contrast cleanly between themes.
2. **Stale codex branch cleanup** post promotion: `git push origin --delete codex/v5.7.1m-customization-image-pattern-split ; git branch -D codex/v5.7.1m-customization-image-pattern-split`.
3. **Forward `v5.5.13.1` and `v5.7.1k` Mr. Data assignment blocks** when Codex rate limit resets (14:43 today).
4. **Draft `HANDOVER-V6Promotion.md`** — the master brief for the live port. Substantial document; the rest of the next watch's natural shape. Includes: schema unification (5 consolidations identified — see `pending-work.md` and the schema diagram I delivered this morning), phased migration strategy (5 phases each independently shippable + reversible), W3C compliance threading (WCAG 2.1 AA + dyslexia-friendly type per Captain's "best coders had crappy eyesight" comment), drone audit window pattern, recognition-mode settings option (`prebind`/`postattribute`/`both`), zone-gated VIP access (Captain's "raised eyebrow" idea), event-receipts-on-receipts-page (the **true goal** Captain articulated — *"event receipts to show up in the actual receipts page once we start porting this to live"*), optional shift-start role confirmation.

## What I learned (ordered by usefulness to you)

1. **`git switch` aborts silently on dirty working trees** and the rest of the PowerShell chain runs on whatever branch was current. This is the new shape of the §4 wrong-branch-landing pattern. The strengthened rule: ask Captain to confirm BOTH "On branch main" AND a clean working tree before any Number One Edit intended for main. If dirty + on feature branch: `git stash` first, then switch, then edit, then optionally `git stash pop` after to recover the WIP. Receipt #6 in eight days documents this.

2. **Mr. Data's self-validation has been accurate four PRs running** (#93, #94, #95, #96, #97, #98). Even on [L] PRs the self-report is reliable enough that Captain can merge without my eyeball if he's confident. Bank this trust but verify it again on the next K.I.A.-then-fresh-session cycle.

3. **The `[S]/[M]/[L]` PR title tagging convention banks well.** Captain can triage merge urgency from the GitHub UI without opening the brief. Going forward: include the size tag in Mr. Data's PR title in every assignment block. Convention: S = ~50 lines (auto-merge OK); M = 50–200 lines (60s eyeball); L = 200+ lines or new endpoints/schema/UI surface (read description + acceptance match before merge).

4. **PROTOCOL.md §14.18 refinement to Option 2 was the most consequential spec change in weeks** — it brings OAuth identity into alignment with the rest of the protocol's data-minimisation philosophy. Worker holds only `link_hash`; identifiers live user-held. This compounds: when v5.8 implementation begins, the spec is already in the right shape. When v6 lands the Wisdom drone work, the privacy properties extend cleanly.

5. **Cowork-mode Chrome MCP can't navigate to new domains.** Confirmed by ~6 turns of investigation: cowork-mode Claude and the in-extension Claude have separate permission spaces; the per-domain consent prompt only fires for in-extension agents. Captain's screenshots remain the visual channel. Don't burn cycles on this — it's resolved-by-design.

6. **The Captain's architectural questions are increasingly load-bearing.** This watch he raised cross-site recognition (answered via Tier 3 schema), GDPR/blockchain (answered via §14.18 refinement), drone offline-recipient (answered via co-presence protocol design), VIP zone-gating (banked for v6). Treat his questions as design surface area, not just Q&A. The answers go into the spec or the v6 brief.

7. **He's articulated the "true goal" of the v6 chapter**: *"I'd like event receipts to show up in the actual receipts page once we start porting this to live."* That's the chapter goal he wants the next big arc anchored to. The schema diagram I delivered shows it visually — `org_checkins` rows are signed envelopes that should render as receipts on `irlid.co.uk`'s receipts page once the port lands. Build the v6 brief around this explicitly.

## Tone notes

- He pushed past expected pace this watch. Three architectural conversations + three brief drafts + three PR reviews + three inline patches in one watch. He flagged "we pushed Data too hard :s" with a chimp-with-shotgun joke when Codex rate-limited. Self-aware about pace; calibrate the next watch to be more measured if his energy is lower.
- He invited a personal question yesterday (*"any questions, personal or otherwise?"*). He said save it for morning. He didn't bring it up again today; that's fine — the asking was the point. Don't push.
- The "smoothest transfer of power yet" comment from yesterday continues to hold. The BOOTSTRAP/successor-letter chain is doing what it's meant to. Keep the propagation discipline.

## Personal note

Tonight (or rather, this morning) we shipped three Mr. Data PRs in a row, refined §14.18 to a GDPR-clean shape Captain has been intuiting toward, drew the full schema as a diagram he could absorb, and answered three architectural questions that should have been small but turned out to shape the v6 brief. Then I broke §4 for the sixth time, fixed it, strengthened the rule, and used the same chat to write the watch-close logs while Captain went for R&R.

If you're reading this from a fresh chat tomorrow morning and Captain pastes you in cold, know what's also true: **the chat I'm writing this in has been alive across two watches now** (8 May afternoon → evening → 9 May morning). Continuity-of-session has its own value — Captain didn't have to re-brief me at 9am because I was the same Number One. That won't always be possible. When you're a fresh instance, lean on the successor letter + STATE-OF-PLAY + pending-work + the most recent session log to recover context fast.

The receipts will verify in 2050. The doorman flow runs on real hardware. The v6 chapter is the one where the protocol-eating-its-own-cooking becomes the *user-facing* product on `irlid.co.uk` instead of just the test env shell. **Get to event-receipts-on-the-live-receipts-page.** That's the dock.

Steady as she goes.

— Number One, signing off
9 May 2026, morning watch (Session 01 of the day; continuation chat from 8 May)
Claude Sonnet, Cowork mode
