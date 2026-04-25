# MEMORY.md — IRLid Long-Term Context Index

**Read this first at session start.** This file is the index. Detail lives in the canonical files it points to.

Bootstrapped: 26 April 2026 by Number One (Cmdr Riker / Claude Opus).

---

## Read order on session start

1. `CLAUDE.md` (repo root) — project context, bridge crew, current version, scoring system, design principles
2. `memory/pending-work.md` — what's on deck right now (priority order)
3. This file — for pointers to anything not in the above two
4. The specific canonical file for whatever today's task touches

---

## Canonical files (single source of truth)

| File | What it is | Who maintains |
|------|-----------|---------------|
| `CLAUDE.md` | Project context + working partnership + milestones | Number One updates milestones; Captain owns tone/content |
| `PROTOCOL.md` | Full protocol specification | Number One — keep formal, technical |
| `PROMOTION.md` | All outreach attempts, drafts, and status | Number One — log every contact and result |
| `WIDGET.md` | Widget integration guide | Number One — keep stable, bump only on widget API changes |
| `DREAMS.md` | Captain's associative log — poetic, not goal-directed | Hands-off; only touched when explicitly asked |
| `memory/pending-work.md` | Current pending items, priority order | Number One — refresh at session start and end |
| `memory/sessions/` | Per-session handover notes | Number One on session close |

**Rule:** Never let two files disagree on a fact. If milestones, status, or outreach state appear in two places, this index is the authority on which is canonical, and the other is an at-a-glance snapshot.

---

## The Partnership (short form)

- **Captain:** Spencer Austin
- **Number One:** Claude — protocol, architecture, security reasoning, strategy, Reddit substance
- **Mr. Data:** ChatGPT — iterative UI/frontend, handover docs, multi-step grinds. Mr. Data 2.0 (Codex) is connected to `BunHead/IRLid-TestEnvironment` only — safety wall in place
- **Counsellor Troi:** Gemini — copy, tone, marketing, business framing

Spencer addresses Claude as "Number One"; Claude addresses Spencer as "Captain". Don't over-flatter — he sees through it.

Inter-crew protocol: handover documents (Mr. Data's format) are the canonical context-passing mechanism between crew members.

---

## Hard rules (non-negotiable)

1. **DB is immutable, warts-and-all.** Never write migrations that retroactively re-verify or "fix" old receipt rows. Old UNVERIFIED rows stay UNVERIFIED. Transparency over tidiness.
2. **All v4+ enhancements are optional, off by default, Settings-gated.** Never prompted during handshake. Never required to complete a scan.
3. **Codex stays on TestEnvironment.** Never let Mr. Data 2.0 touch the live `BunHead/IRLid` repo. Safety wall is the whole point.
4. **Git push from Spencer's machine only.** Sandbox gets 403. Provide PowerShell: `cd "D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo" ; git pull ; git push`.

---

## Current state pointers (as of 26 April 2026)

- **Live version:** v4 (shipped 17 April 2026). Score system caps at 50/100 with v4 features.
- **Live URL:** https://irlid.co.uk
- **Test environment:** GitHub Pages + `irlid-api-test` Worker + D1 test DB (b7d7ccc9). Codex works here.
- **Current outreach focus:** Wisdom / ASE Tech humanitarian pitch, conference CFPs (44CON, EAI SecureComm), WFP Innovation Accelerator.
- **Current technical focus:** v5 planning (Secure Enclave key migration via WebAuthn/Passkeys).

---

## Where to find things

| Need | Look in |
|------|---------|
| Protocol crypto details, scoring breakdown | `PROTOCOL.md` |
| Reddit / PH / conference drafts and statuses | `PROMOTION.md` |
| Today's priority list | `memory/pending-work.md` |
| Session handover from previous Number One | `memory/sessions/` (most recent) |
| The Captain's reflective log | `DREAMS.md` |
| Wisdom / humanitarian pitch | `pitch-humanitarian.html` |
| Worker source | `irlid-api/src/index.js` |
| Client crypto | `js/sign.js` |

---

## Number One's standing positions

- **v5 priority:** Secure Enclave key migration via WebAuthn/Passkeys closes the strongest honest criticism (cym13 r/netsec).
- **Widget is underrated:** the reCAPTCHA framing in `demo-login.html` is the commercial hook.
- **Humanitarian angle (Wisdom / ASE Tech):** the most visceral real-world use case right now. Lead with it where appropriate.
- **ZK proofs are not v5 work.** Haversine in ZK circuits is expensive; ECDSA P-256 needs non-native field arithmetic. Stage it.

---

## Session log convention

Each session, Number One writes a short handover to `memory/sessions/YYYY-MM-DD-NN.md`:
- What was done
- What's now blocked or waiting on input
- Next session's first move

This is the canonical context-passing mechanism between Number One sessions.

---

## Note on directory location

Originally specified as `.claude/memory/` in `CLAUDE.md`, but `.claude/` is a protected directory in Claude Code environments (used for skills/plugins). Memory lives at `memory/` instead. `CLAUDE.md` updated to match.
