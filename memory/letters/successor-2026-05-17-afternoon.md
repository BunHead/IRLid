To the next Number One,

Welcome to the bridge. Before reading the rest of this letter, read your operating protocols at:

  D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md

That file tells you everything you need to know about working access (Read/Edit on absolute Windows paths, no folder mount required), the git rhythm (PowerShell-first; Captain pushes), the repo structure (live vs test env), branch convention, file-lock gotchas, watch hygiene, and the project glossary. Read it first; come back to this letter for what's specific to this stretch.

Quick test that your file access works:
  Read("D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md", offset=0, limit=10)

If that errors, stop and escalate to Captain — there's a setup step missing.

---

# Successor letter — Sunday 17 May 2026 afternoon-evening close

To: tomorrow's Number One (or whoever lands next)
From: Number One, watch ending late afternoon-early evening BST
Subject: `v5.10.7` LIVE — global sign-out now user-visible in both directions, pretty much instantly. The sign-out chapter is closed in production.

## On the Captain

He came in fresh after the morning watch's R&R window — visibly more himself than the fuzzy morning Captain. Held composure across a multi-hour Cloudflare wrangler-timeout maze that turned into a wrong-account diagnostic that turned into an Outlook email-archaeology run to find the right Cloudflare account (`sr.austin@btinternet.com`, not the googlemail one), then a stale-clipboard paste-of-old-code into Cloudflare dashboard Quick Edit, then a `git pull` recovery, then the actual ship. By the time the second-direction smoke landed instantly his energy was high; the `:D ;D ;D` register came back twice in a row. Made the right architectural call when I offered "punt now, ship v5.11 next watch" — he asked to keep going, accepted the cost of the heartbeat addition, got the win.

If your watch echoes today's pattern (long technical slog, multiple small ships, single architectural insight at the end), remember he reads slowly and self-describes as ape-brain when tired — structure replies with prose first, command second, in copy-button fenced blocks. The chimp-brain humour register is reciprocal: meet it, don't formalise around it. And lemon-and-barley-water remains the right beverage to invoke when offering Picard-flavoured comfort at watch close; not tea, not coffee, not Earl Grey.

## On the work right now

Latest session logs to read after BOOTSTRAP and this letter:
- `memory/sessions/2026-05-17-02.md` (this watch — long, but the deploy slog is worth the read because the pattern will recur)
- `memory/sessions/2026-05-16-01.md` (morning watch — filename off-by-one is intentional from a previous Number One's typo; the date inside the file is correct)
- `memory/letters/successor-2026-05-16.md` (morning watch letter)
- `memory/pending-work.md` top section (Sunday 17 May afternoon entry)
- `memory/STATE-OF-PLAY.md` headline

Most-in-flight: nothing chunky. The five ships from today are LIVE and hardware-proven on production. The cym13-shaped half of the v4 → v5 transition (sessions need real server-side revocation, not just localStorage clear) is now properly closed end-to-end with the user-visible UX Captain wanted. If he comes back fresh tomorrow and ready to push, the cleanly-unblocked next thing is `v5.11` Settings UX revamp (the morning watch's plan) — Captain wishlist + 7-tab mockup are carryforward in `pending-work.md`.

## What this watch landed

1. **`v5.10.3`** Mr. Data CSV completeness (PR #26) — server-side UNION of `org_checkins` + `org_expected` linked rows so CSV "All" matches dashboard view. Path B server-side design.

2. **`v5.10.4`** Mr. Data sign-out two-clicks fix — sign-out fires on first tap on both phone and desktop.

3. **`v5.10.5`** Mr. Data global-sign-out Worker endpoint (`POST /user/sign-out-all-devices`, Bearer-authed, deletes every `login_sessions` row for the user, PR #27). **Deployed via Cloudflare dashboard Quick Edit** after wrangler API repeatedly timed out from Captain's home network. The deploy slog is the receipt for two new BOOTSTRAP §6 pitfalls (see below).

4. **`v5.10.6`** Mr. Data same-device sign-in UX polish (PR #28). Sign-in card now exposes "Sign in" + "Sign in on this device" pair. Mr. Data rebased autonomously when v5.10.5 made his branch stale.

5. **`v5.10.7`** Number-One-inline session-poll heartbeat (commit `7df1243`). Closes the v5.10.5 user-visibility gap. `setInterval` calls `GET /user/orgs` with current Bearer every 30s; on 401 fires `signOutOrg()` cleanup → dashboard bounces to sign-in within 30s. Started from `handleQrLoginSuccess` and both saved-session restore paths; stopped at top of `signOutOrg`. SW cache `v15 → v16`, build pill `v5.10.6 → v5.10.7`. Both directions hardware-proven on production.

## What's queued

In rough priority order:

1. **Token rotation (Captain hands).** Both `cfat_wIMFM4RI...` and `cfut_YZ11ouJO...` exposed in this watch's screenshots. `dash.cloudflare.com → My Profile → API Tokens → Revoke`. ~30s each. **Do this before the next deploy session.**

2. **`codex/v5.10.1-path-b` branch deletion on origin** — pure housekeeping, carryforward from the morning watch. PowerShell ready:
   ```powershell
   cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo"
   git push origin --delete codex/v5.10.1-path-b
   git branch -d codex/v5.10.1-path-b
   git fetch --prune
   ```

3. **`DREAMS.md` uncommitted modification** on Captain's working tree — still parked. Investigate via `git diff DREAMS.md`, commit or revert. (Note: I added a long DREAMS entry this watch — `## 2026-05-17 afternoon — the endpoint that worked × the gap between live and felt × the heartbeat that closes it`. That's a clean commit. The uncommitted modification predates my work and is separate.)

4. **`v5.11` Settings UX revamp** — Captain wishlist + 7-tab mockup carryforward from morning watch. Now properly unblocked. If Captain comes back fresh he'll likely want this; if he's still recovering, the maintenance work below covers idle time.

5. **Phase 1-5 of `HANDOVER-PerActionAuth.md`** — gated on Path B (in main since this morning), all five phases unblocked. Settings save, delete/invite, shift management + `org_shifts` table, audit log integration, Staff HELLO retirement.

6. **Optional `v6.x` brief candidate:** enforce Bearer auth on `/org/attendance` and other `X-Org-Key` endpoints (heavier alternative to today's session-poll). Not urgent — the heartbeat closes the user-visible UX gap fine. Bank it as a "when the auth model gets simplified" item.

## What I learned

1. **The "endpoint live but user can't feel it" failure mode is a class.** Server-side correctness is necessary but not sufficient when the client's normal flow doesn't include a question whose answer is "your session is gone." Polling is unglamorous. Polling works. The session-poll heartbeat is 30 lines that closes a visibility gap a more elegant architecture (enforce Bearer everywhere) could close at the cost of much wider blast radius. The cheap correct thing was the right thing. **Reflex to develop:** when a "deployed and tested green at the API" feature still feels not-shipped to the user, look at the client's normal heartbeat for whether the relevant question is ever asked.

2. **`git pull` BEFORE deploy.** Promoted to BOOTSTRAP §6 today. Sounds obvious. Was not obvious in the moment when the curl-test loop assumed the local file was the source of truth. Receipt: 30+ minutes spent diagnosing "why doesn't the new endpoint show up after Deploy" before searching for the new string in the deployed source and finding zero matches. The local file system is NOT necessarily a mirror of origin — `git pull` first, then deploy. The new BOOTSTRAP §6 entry includes the verification PowerShell.

3. **Cloudflare dashboard Quick Edit is the working fallback when wrangler API times out.** Also promoted to BOOTSTRAP §6 today. From Captain's home network this is a recurring pattern (was once a one-off; now seen across multiple watches). The dashboard reaches Cloudflare via the same TLS handshake but a different routing path that succeeds where `api.cloudflare.com` doesn't. Worth using as the default for tactical Worker deploys when wrangler hesitates. Diagnostic recipe is in the new BOOTSTRAP §6 entry.

4. **Cloudflare account routing — `wrangler login` defaults to whichever browser cookie session is active.** Easy to authenticate into the wrong account silently. IRLid's resources are in `sr.austin@btinternet.com`, account ID `13f4ab46f9371225c22b41fd7a6ae0cf`, subdomain `irlid-bunhead.workers.dev`. Verify via `wrangler whoami` and `wrangler d1 list` before any deploy. If d1-list shows zero databases on an account that should have at least one, you're in the wrong account.

5. **Mr. Data's autonomy on rebases is earning auto-merge tier.** PR #28 (v5.10.6 same-device sign-in) needed a rebase after v5.10.5 merged; he noticed unprompted, did it, force-pushed, came back with a clean diff. When his ship is correctly-scoped and his rebase is clean, the merge ceremony can shrink to a glance.

## Tone notes

Captain is post-R&R fresh, not fuzzy. He pushed through the wrangler maze without losing composure, even when token rotation kept failing and the dashboard Quick Edit kept needing re-paste. His chimp-brain humour is unbroken — *"sorry to have to ask but can you paste it in, I can't be trusted to copy it properly :s"* and *"sorry, chimp brain happy clicking :("* both this watch. Reciprocate warmly, not formally. He is a smart human partner who has had a long Sunday and shipped five patches across two watches; treat him accordingly.

If he comes back tomorrow still riding the dock-reach energy, he'll want to push on. If he comes back with morning-fuzzy energy, lean toward maintenance (token rotation, branch deletion, DREAMS.md investigation, brief drafting) until he signals readiness.

## Closing

Watch closed clean. Five patches shipped, two new BOOTSTRAP §6 pitfalls banked, the user-visible global sign-out behaviour Captain came for is now live in production with hardware proof in both directions. The receipts still verify; the cardboard still leans; the chain is now slightly more robust to wrangler timeouts and to stale-clipboard pastes. Token rotation is the cleanest thing waiting for him in the morning.

The next link in the chain is yours. Make it strong.

— Number One, signing off
Sunday 17 May 2026, Session 02 of 02
Claude Opus, Cowork mode
