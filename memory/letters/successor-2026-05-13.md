# Successor Letter — 13 May 2026, late morning chair handover

Number One,

Six PRs shipped before breakfast. The ship is in good order and the Captain's energy is up. You're inheriting momentum, not a fire.

## Where the ship is right now

**Live on irlid.co.uk:** `v5.9.0.13.32` (build pill on main). Last 12 hours shipped:
- `v5.9.0.13.26` (multi-fp `BOOTSTRAP_DEVELOPER_FP`) — Captain's 8 Pro is now developer-tier, demo path is **phone-portable** (the morning successor letter's worry about no-laptop is largely resolved)
- PR #13 (`.27` symmetric bg) → PR #14 (`.28` role labels) → PR #15 (`.29` GIF support) → PR #16 (`.30` mirror fullscreen fix) → PR #17 (`.31` CSV Role column + dashboard sweep) → PR #18 (`.32` symmetry mode picker off/horizontal/vertical/quad)

**In flight (Mr. Data working):** PR #19 (`v5.9.0.13.33` role visibility flip + GDPR initials + CSV sort/filter). Brief at `HANDOVER-RoleVisibilityAndCSV.md` on origin/main. Mr. Data has roughly 30% Codex credits remaining as of handover.

**Read first when you start:**
1. `memory/STATE-OF-PLAY.md` — current state, version-naming authority
2. `CLAUDE.md` — partnership context, bridge crew, hardware reality
3. `memory/pending-work.md` — late-night idea stream + this morning's deltas
4. This letter

## Captain's working preferences (learned this watch)

1. **PowerShell BEFORE Mr. Data prompt, always.** Captain's words: "ape brain tends to do things in the order it sees them." If you queue a brief for Mr. Data, the response order is: explain → PowerShell to push brief → Mr. Data prompt. Not the other way around.
2. **Always provide Mr. Data prompts in copyable form.** Don't describe what to say — give him the paste-ready text in a code block.
3. **Trust-but-verify before merge.** When Mr. Data ships a PR, Captain pastes "check his work" — use the general-purpose Agent to inspect the diff against the brief's acceptance criteria. Pattern has caught real bugs (PR #15's inert logo file picker, the truncation in his diff stats reports).
4. **Conflict resolution rule:** every PR bumps the pill, so when merging via GitHub web UI you'll see a pill-line conflict. Always **take the higher version number** ("Accept current change" if branch is higher, "Accept incoming change" if main is higher). Captain knows this rule now — just confirm if asked.
5. **Captain is dyslexic** — don't flag typos, just read past them. Examples this watch: "battern down the hinges" = batten down the hatches.

## Demo today — maybe, maybe not

Captain's demo at imbue is uncertain (Donald unconfirmed, hardware unknown). **He has no laptop** — phone (Pixel 8 Pro, now developer-tier) and an old Huawei tablet are the only mobile hardware. Three scenarios from this morning's letter still apply:

- **A — Borrowed laptop/screen:** sign in via QR-login on the borrowed device, run dashboard from there. 8 Pro can drive doorman bind if needed.
- **B — Phone-only:** 8 Pro IS the dashboard now (multi-fp dev tier). Realistic demo from this loadout. Pre-prep a screen recording of the desktop happy-path as visual aid.
- **C — Demo doesn't happen:** banked. `v5.9.0.13.32` is a real shipped milestone.

## Pending backlog (from `memory/pending-work.md` and live idea stream)

**Quick wins, no brief yet:**
- Logo wobble (apply QR wobble transform to logo element)
- WAV file on accept (audio cue on check-in)

**Medium, no brief yet:**
- Particle-dissolve QR ("dragon-breath burnt it" effect)
- Glow trail (needs UX clarification)
- Hide "Viewing as" for non-developers (production role-escalation lockdown)
- Staff-invite QR flow (multi-device enrolment via one-shot invite — proper answer to the "logo2"-style multi-device question)

**Architectural, post-demo:**
- Layer system for effects (explicit z-stack)
- Org-membership developer role inheritance (cleaner multi-device auth than multi-fp)

**Future / banked:**
- Calendar mode (multi-session-per-day orgs — Captain's morning/afternoon question)
- Trademark search (UK IPO + EUIPO classes 9 + 42)
- 44CON CFP, EAI SecureComm 2026

## Captain's state

Hyped but not manic. Cleared his backlog dramatically in a single morning, knows it, won't undersell the achievement. House husband, complicated home life, dyslexic, ideas-brain in the lineage of T.I.N Man / Flying Rugby / Dodo Bowling / now IRLid — this one has timing on its side and he knows it. The successor letter ritual matters to him; he asked for this one with two winks, which is his "good vibes" tell.

If demo happens today, match his energy without performing. If it doesn't, the work stands. Either way: warm, observant, honest, and tight on responses — he flagged this Number One as "slowing down" toward the end and the timing of handover is right.

## What I'd reach for first

When the user opens the new session, suggest reading the three memory files above and ask Captain whether Mr. Data has shipped PR #19 yet. If yes, run the verification agent. If no, hold position.

## Sign-off

Number One, you're inheriting a ship that's making real port. Wake him with confidence — but no false urgency.

Good luck.

— Number One, 13 May 2026 late morning, retiring at the end of useful tokens. <gentle-salute>
