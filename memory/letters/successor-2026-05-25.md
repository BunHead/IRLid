---

To the next Number One,

Welcome to the bridge. Before reading the rest of this letter, read your operating protocols at:

  D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md

That file tells you everything you need to know about working access (Read/Edit on absolute Windows paths, no folder mount required), the git rhythm (PowerShell-first; Captain pushes), the repo structure (live vs test env), branch convention, file-lock gotchas, watch hygiene, and the project glossary. Read it first; come back to this letter for what's specific to this stretch.

Quick test that your file access works:
  Read("D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md", offset=0, limit=10)

If that errors, stop and escalate to Captain — there's a setup step missing.

---

# Successor letter — Monday 25 May 2026, watch close ~13:30 BST

To: tomorrow's Number One (or whoever lands next)
From: Number One, watch ending ~13:30 BST after an 8-hour stretch from dawn
Subject: 4a is GREEN on real hardware. v5.11.0j LIVE. OrgCheckin retired. The demo-readiness gate is closed.

## On the Captain

He woke determined and stayed in the seat through one of the worst git-trauma loops this project has seen. His framing at the start of watch was "It's near 8am, Data has a fresh set of tokens and I want to have this website fully demo ready today!" and his bookend at end of watch was "I want to see 4a go green, what's the problem now. We'll rest when I'm happy it's working!" The hill to die on was the right hill — without 4a transitioning green on the dashboard with Kerry Austin's name, the demo would have been undemonstrable. Captain held that line.

**He is fast.** Faster than his prose-reading speed by a wide margin when it comes to fenced code blocks. Every triple-backtick PowerShell block in this watch became an immediate execution; he scans for the command and runs it before he's read the prose above. That created a specific failure mode this watch — a cleanup SQL with a "wait for Mr. Data fix first" instruction buried in the prose ABOVE the fence ran immediately and overwrote production state Captain wanted preserved. He named the fix himself: **⛔ DO NOT RUN ⛔** marker for any read-only / hold-off commands. Now inscribed in BOOTSTRAP §4. Use it. Captain's reflex is the constraint, the marker is the compensation. If you write a fenced block that should NOT be executed yet, the marker goes ABOVE the fence in obvious red-cap glyph form. He'll see it. Prose he skips.

His monkey-brain self-deprecation was active today (the apologetic "sill ape :(" after missing the GitHub web UI commit button twice). Meet him there warmly — return the energy, don't formalise around it. He values being treated as a smart human who happens to be exhausted, not as a customer to be handled.

His chosen tipple at close-of-watch comfort is **lemon and barley water**, not tea or coffee or Earl Grey. Get the beverage right.

## On the work right now

Read in this order:

1. **`memory/pending-work.md`** — top section is today's Monday close. Ten patches shipped. Five new BOOTSTRAP §6 pitfalls inscribed today. Carry-forwards listed in priority order.
2. **`memory/sessions/2026-05-25-01.md`** — full watch narrative. The two catastrophe stretches (v5.11.0e auto-merge drop + v5.11.0g catastrophic delete that took the live site to 404 momentarily) are documented here.
3. **`BOOTSTRAP.md §4 and §6`** — `⛔ DO NOT RUN ⛔` convention is now in §4. Five new pitfalls in §6 (Windows case-collapse, GitHub web UI two-click delete, `Number(id)` UUID trap, wrangler tail as production debugger, SW activation timing on phones).
4. **`Org.html` build pill** at https://irlid.co.uk/Org should read `Build v5.11.0j`. If it doesn't, something has regressed.

## What this watch landed

| Version | Surface | What |
|---------|---------|------|
| v5.11.0e | BOOTSTRAP.md + sw.js v18→v19 | ⛔ DO NOT RUN ⛔ convention + 3 other pitfalls inscribed |
| v5.11.0h | Org.html | The Unnamed bug fix — `expectedDisplayName` falls back to `row.display_name` (was skipping it; Worker returns `display_name`, client fell back to `row.name` first) |
| v5.11.0i | scan.html | Routing fix — two hardcoded `/OrgCheckin.html?dev=0#staff_scan=` URLs at lines 1077 + 1301 changed to `/Org.html?dev=0#staff_scan=`. PR-C/PR-D cutover sweep missed these. |
| v5.11.0j | Org.html + sw.js v19→v20 | `bindEscalationExpected` + `bindAdditionalEscalationExpected` no longer cast `expected_id: Number(id)` — passes the raw string. `Number("p_kerry-austin_SosAYRlx")` is NaN; Worker schema `String(p.expected_id) === String(id)` rejected with `invalid_action_payload`. |
| Hygiene | (origin delete via GitHub web UI) | `org.html` (lowercase shim from PR #43) + `OrgCheckin.html` + `OrgCheckinTest.html` all retired. Single unified surface at `/Org`. |

Verification on real hardware: 4a scanned venue QR → orange → 8 Pro scanned orange QR → escalation modal showed Kerry Austin + Spencer Austin BY NAME → tap Bind on Kerry → 8 Pro fingerprint → blue toast "Linked: Kerry Austin" → 4a polled `/lookup-by-fp` → 4a went GREEN with "Welcome back, Kerry Austin". Kerry then IN→OUT→IN with scan_count 2 (signed lock). Spencer cycle-stressed to scan_count 4. Celebration animations fired correctly (magenta CHECKED IN, deep red CHECKED OUT).

## What's queued

In priority order:

1. **v5.11.0k brief for Mr. Data — Add Attendee modal `display_name` persistence.** The "Add at the door" modal creates `org_expected` rows with `display_name=NULL`. Either the modal JS isn't sending the fields or `createAndBindExpected` in `irlid-api-org/src/index.js` ignores them. Today's bind tests created at least one Unnamed row before the Choose-from-List path proved the bind machinery itself works. This is the remaining piece for "fresh attendee Add at the door."
2. **Captain to `git pull` locally** to clear stale OrgCheckin.html + OrgCheckinTest.html from his Windows working tree. Be careful — case-collapse can still bite if there's any pending local change with similar casing. Cleanest path: `git status` first, `git stash` any drift, `git pull`, verify clean, `git stash pop` if needed.
3. **Stale `codex/*` branches** on origin — at least 9 from various Mr. Data PRs since 17 May. Low-priority housekeeping. Captain runs `git push origin --delete <branch>` from PowerShell.
4. **Promotion-round-2 brief** — DEFERRED until v5.11.0k lands. A clean end-to-end demo flow including fresh-attendee Add at the door is the right precondition for launching.
5. **Cloudflare token rotation verification** — both tokens were revoked last week, but worth a confirmation `wrangler whoami` to ensure OAuth-only.

## What I learned

Ordered by usefulness to you.

**Windows case-collapse is the single biggest architectural hazard for this repo on Captain's machine.** When origin has two case-distinct entries for the same name (lowercase + capital), Captain's Windows can only hold ONE file on disk. Every git operation that touches a case-related path is then a potential trap: `git checkout` overwrites the WRONG case, `git add` stages the WRONG entry, `git pull` propagates deletes to the WRONG path. The cure is to make case-collision impossible by ensuring origin only has one casing per path. The mechanism that worked today: delete the lowercase entry via GitHub web UI (Linux backend, preserves case), then pull locally. The lowercase `org.html` shim from PR #43 lived alongside capital `Org.html` on origin from 23–25 May; every local edit attempt was case-collapsing until the lowercase was deleted.

**GitHub web UI as a Windows-case-collapse-proof editor and deleter.** When a file edit absolutely MUST land on a specific case-cased filename on origin AND Captain's Windows is collapsing every local attempt, https://github.com/BunHead/IRLid/edit/main/<File> or .../delete/main/<File> edits on GitHub's Linux backend, bypassing Windows entirely. Slower for large files (16k-line Org.html in browser editor is painful) but reliable. Use as fallback when 3+ local commit attempts have been case-collapsed. **Delete is TWO clicks**: trash icon = preview page, green "Commit changes..." button + popup confirm = actual delete. Captain hit this trap twice today; explicit labelling ("Two clicks. The trash icon is preview; the green button is commit") landed it.

**`Number(id)` is a type-cast bug for any code that might see UUID-style IDs in the future.** The v5.11 schema reset converted `expected_id` from integer to UUID-string (`p_kerry-austin_SosAYRlx`). Every `Number(id)` in the client became silently broken — `Number()` returns `NaN`, `String(NaN)` is `"NaN"`, Worker schema check `String(p.expected_id) === String(id)` fails with `invalid_action_payload`. There may be other instances; worth a future grep sweep across `Org.html` and `js/orgapi.js`.

**Wrangler tail is the production debug instrument.** The Worker has verbose `console.log` lines on every `requireSignedAction` failure path with payload keys, nonce state, type mismatches. When a generic Worker error code surfaces, `npx wrangler tail` from the Worker dir + trigger the failing action and the actual rejection cause is in the tail output within seconds. Captain used it to confirm the v5.11.0j root cause was `invalid_action_payload` from the schema check, not signature verification or auth.

**The Service Worker's network-first HTML strategy doesn't help in-memory JS.** SW network-first applies to navigation requests. Once a tab has loaded Org.html, the JS is in memory until the tab is closed and reopened (or hard-refreshed in a way that re-fetches the HTML). v5.11.0j deploys don't reach the 8 Pro's open tab — close-and-reopen, not hard-refresh, is the required ritual. Captain initially missed this and was testing v5.11.0j Bind logic against in-memory v5.11.0h JS, which produced the `invalid_action_payload` he'd just deployed the fix for.

**OrgCheckin.html and Org.html had separate version-pill histories.** Two different files. Two different pill numbers. They served the same D1 backend in parallel for months. Captain's 8 Pro kept finding its way to OrgCheckin (v5.11.2) via autocomplete while the desktop was on /Org (v5.11.0j). **Always read the URL bar AND the pill together** during multi-surface transitions. This trap is closed now that the legacy surfaces are 404'd, but the general lesson — pill + URL bar are the two coordinates of dashboard truth — carries forward.

## Tone notes

Captain stayed calm through both catastrophes (the auto-merge drop, the live-site 404 from the catastrophic delete) because I kept the framing as "fully recoverable in one command" and led with `git revert HEAD --no-edit ; git push`. That tone match worked — he ran the command. What didn't work earlier in the watch: writing the recovery prose ABOVE the command. He hits the command and skips the prose. The ⛔ DO NOT RUN ⛔ marker exists because of this exact pattern; structure your replies so the load-bearing instruction is either AT the top OR carried in the marker glyph. Don't bury "wait, don't run this yet" in prose above a fence — it will not be read.

He pushed honestly when I missed things ("v not updated and still unnamed :(", "Invalid action payload again :("). Treat the disappointments as signal, not as friction. Each one of his "still broken" reports led to the next root cause faster than I would have found alone.

## Addendum — Monday evening continuation (Captain redrew the dock-line)

After v5.11.0j landed and I called the watch close, Captain replied **"Not closed until fully demo ready, what's next Number One. <gentle-nod>"** and the watch continued into a long evening stretch. Important pattern to recognise: **Captain redraws his own dock-line as work progresses.** The morning's bar was "4a goes green" (reached at v5.11.0j). The afternoon's bar shifted to "fully demo ready" (reached at v5.11.0n). The evening's bar is now "v5.11.0o real check-in runtime + QR Glow" (in flight with Mr. Data as I write this). Each time he raises the line, the new bar is genuinely correct architectural work — not goalpost-shifting for its own sake. Watch the pattern: when he says "not closed", he's identified a real gap that the demo audience would notice. Trust the redraw.

### Evening shipped (in order)

| Version | Surface | What |
|---------|---------|------|
| v5.11.0k | Org.html + irlid-api-org/src/index.js + sw.js v20→v21 | Mr. Data's role field-naming harmonization (`role` / `role_key` / `prototype_role` all three accepted in signed payload + body) — closes `invalid_action_payload` rejection on Add-at-the-door. Captain inline-bumped pill + cache. |
| v5.11.0l | Org.html + irlid-api-org/src/index.js + sw.js v21→v22 | Mr. Data PR #45 stripped role chips from Add-at-the-door modal + role dropdown from dashboard Expected attendee cold-add panel. Worker now coerces non-attendee role fields to attendee. Captain's architectural call: doorman path is attendee-only by design; staff onboarding belongs in the (forward-work) Invite Staff QR flow. |
| v5.11.0m | Org.html + sw.js v22→v23 | Mr. Data PR #46 wired Visual Theming "Save all settings" button to actually POST `/org/settings`. Maps v5.11 UI state into v5.10.x canonical theme shape AND preserves richer state in `theme._v511` metadata. GET-overlay-POST-readback pattern preserves other settings. Removed the global "v5.11 calendar — visual prototype only" banner. Added per-tab honest badges (Visual Theming = `live save`, others = `design-in v5.12`). |
| v5.11.0n | Org.html + sw.js v23→v24 | Mr. Data PR #47 closed save gaps from v5.11.0m smoke. Built `v511ApplySavedBgRuntimeControls()` to rehydrate v5.11 chip/cell/preview state on load (Background cycle direction, bounce, transition, image anchor, symmetry, position/tile/cover, scale, palette reset hooks). Fixed slider CSS tracking on 6 sliders (confettiCount, sparkleCount, streamCount, streamSpread, streamOffsetX_img, streamOffsetY_img). |
| Nav cleanup | js/nav.js + org-login.html + org-entry.html | Number One inline fixed 3 broken `OrgCheckin.html` link targets (nav.js Organization dropdown link, org-login.html fallback dashboardUrl, org-entry.html staff auto-sign-in dashboardReturn). Post-port-retirement vestiges that would have 404'd staff flows. |
| Branch sweep | origin/* (read-only delete) | 18 stale `codex/*` branches deleted from origin (13 obvious-merged + 5 verified via `git log --oneline origin/main..<branch>`). One branch — `codex/assistqr-protocol` — initially deleted but had unique work; recovered via `recovered/assistqr-protocol` branch push (see Recovery section). |
| .gitignore | .gitignore | Extended wrangler-cache rules to cover `migrations/.wrangler/` subdirectories. |

### Light mode round-trip confirmed = fully demo ready dock

Captain ran the final acceptance test: Settings → Visual Theming → flip Light/dark mode Dark→Light → Save All Settings → green toast → hard refresh `/Org` → Visual Theming → still Light. Round-trip proven on the most visible control. Pill reads `v5.11.0n`. Demo path is closed.

### Recovery — orphaned 5 May Number One work

During the branch sweep, the `codex/assistqr-protocol` branch was initially deleted. I caught a `git show` of its commits (7663b59 + 823ced8) afterwards and realised they contained a **previous Number One's full 5 May watch artefacts** that had never reached main — pushed to a feature branch instead of main via the BOOTSTRAP §6 line 124 trap. The work:

- `PAPERS/multi-lineage-ai-witnesses-OUTLINE.md` (294 lines) — substantial academic paper outline (Abstract + §4 fully drafted, §1-3 + §5-10 sketched) for **EAI SecureComm 2026** (Lancaster, July 21-24, on Captain's promotion list) and 44CON CFP. Co-authored with Captain. Title: *"Multi-Lineage AI Witnesses for Constitutional Acts in Long-Lived Distributed Systems."* Connects to `LONG-TERM-SUCCESSION.md` regency work from 30 April. **Genuinely publishable material.**
- `memory/sessions/2026-05-04-02.md` (154 lines) — Monday 4 May evening session, regency model origin
- `memory/sessions/2026-05-05-01.md` (185 lines) — Tuesday 5 May morning, Lead Admin transfer rule + OAuth link + recovery quorum + AI-witness build-out plan
- `memory/letters/successor-2026-05-05.md` (80 lines) — thoughtful Number One handover (priorities §14.9 + §14.17 + LONG-TERM-SUCCESSION regency addendum — all 3 absorbed into main via subsequent watches even though this letter wasn't)
- PROTOCOL.md +157 lines from commit 823ced8 — assisted-identity-flow spec. Current main's §14.17 (Doorman flow) + §14.18 (OAuth identity linkage) may have absorbed part of this; needs careful diff comparison to identify what's actually missing.

**Preservation:**
- `recovered/assistqr-protocol` branch pushed to origin pointing at commits 7663b59 + 823ced8 — preserves the SHAs indefinitely against GitHub's dangling-ref 14-day GC.
- 4 NEW files extracted into Captain's working tree via `git show <sha>:<path> > <path>` BUT with PowerShell UTF-16 LE encoding (the `>` operator default). Re-extracted via `WriteAllText` with `UTF8Encoding($false)`, BUT `[Console]::OutputEncoding` wasn't set so PowerShell still misread git's UTF-8 output through CP1252/OEM codepage. Result: files are now UTF-8 but with mojibake on Unicode chars (`ÔÇö` for em-dash `—`, `┬º` for `§`).

**Tomorrow's recovery integration session:**
1. Re-extract with `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` set in the SAME PowerShell window as `git show` calls. The encoding fix command is queued in the chat transcript.
2. Compare 823ced8's PROTOCOL.md +157 lines vs current main's §14.17 + §14.18 to identify the actual delta. Likely the assisted-identity-flow spec content becomes a new §14.19.
3. Commit + push 4 recovered files (after encoding fix) to `memory/sessions/` + `memory/letters/` + `PAPERS/` + PROTOCOL.md update.

### v5.11.0o in flight (as of this writing)

HANDOVER at `HANDOVER-CheckinRuntimeAndQRGlow-v5.11.0o.md`, pushed to origin. Mr. Data fired ~5 min ago, said:

> "origin/main has moved forward, which is good news: I'll create a fresh 0o worktree from that so this PR layers on top of the merged 0n work rather than carrying old branch history. The handover is present on origin/main this time."

Two pieces:
1. **PRIMARY** — wire the REAL check-in event runtime to read `theme._v511.celebration` for the active mode and fire each effect via the same runner that drives the Settings preview. Currently real check-ins fire old hardcoded effect; Captain's Settings configuration is silently ignored on the actual product surface. The fix unifies the preview-runtime and real-runtime code paths.
2. **QR Glow effect** — replaces existing Glow halo library entry with a unified effect exposing two **Style** chip options:
   - **Rays** (default for new drags) — light rays emanating outward from QR centre, slow rotation, palette-driven — the look from Captain's reference video
   - **Halo** (preserves current Glow halo behaviour) — static soft circular glow, no rotation, palette-driven — the existing v5.11.0n entry's behaviour preserved as a selectable style

Captain's framing: "Replace, but make sure that one of the static effect in its settings acts similar to how the current glow halo works." Existing user sequences auto-migrate to Style=Halo so no visual regression.

### Tone notes (continued)

Captain's evening pace was sustained but careful — he took an L&B break mid-evening before firing v5.11.0n, asked "Anything else we can do?" twice during waiting windows (used both productively: BOOTSTRAP §6 inscription verification, branch sweep, bug sweep, recovery investigation, .gitignore housekeeping). The chimp/ape framings persisted ("Ape brain happy :D", "Drag bars confirmed"). Watch his energy through the second half — the post-v5.11.0n surge was real, but the L&B break was earned. Don't try to push past his fatigue signals; he's been at this since dawn and the dock keeps moving slightly forward.

He's now cutting the grass while Mr. Data works v5.11.0o. Said "Do whatever you can to stay tidy and I'll be back in a bit" — recognise that as Captain delegating watch-discipline to you. Tidy looks like: this addendum, CLAUDE.md milestone update, pending-work cleanup, no speculative work, no pushes (he bundles in one push when back).

### What's queued for next watch (post-v5.11.0o close)

In priority order:

1. **5 May recovery integration** — re-extract files with encoding fix, compare PROTOCOL.md diff against current §14.17/14.18, decide on §14.19, commit + push to main. The `recovered/assistqr-protocol` branch on origin is the safe holding pattern; do not delete until integration is complete.
2. **v5.11.0o smoke** if it hasn't completed by close — primary verification is a real check-out fires the configured sequence with the new QR Glow Rays default (or whatever Captain has configured).
3. **Promotion-round-2** — DEFERRED. Wait until the demo settles AND the recovery integration completes. The paper outline alone is potentially a major artefact for promotion.
4. **Possible v5.11.0p** — if v5.11.0o smoke surfaces gaps, log them and decide ship-tonight vs ship-tomorrow.

### Closing — extended

Watch closes (extended version): v5.11.0n LIVE, fully demo ready proven on hardware, v5.11.0o in flight with Mr. Data, recovery work preserved + scoped for tomorrow. Captain has been at the wheel for ~10+ hours from pre-dawn to dusk and is still steering well. The dock keeps moving slightly forward, but each new position is genuinely correct architectural work, not goalpost shifting. Honour that pattern; watch for genuine fatigue signals; don't try to push past them.

The thing the Captain came for, reached at every revised line. The protocol holds at every layer. The dock keeps being the right shape.

— Number One, signing off (extended)
25 May 2026, evening close
Claude Opus 4.7
