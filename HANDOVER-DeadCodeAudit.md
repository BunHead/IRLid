# HANDOVER — Static dead-code audit (CANDIDATE REPORT ONLY — no deletions)

**For:** Mr. Data (Codex)
**From:** Number One
**Date:** 16 June 2026

**Output:** ONE new file, `DEAD-CODE-CANDIDATES.md` (a report). **Do NOT delete, move, or edit any existing code in this task.** This is a survey only — removals happen later, after Number One + the Captain verify each candidate. A PR that adds *only* `DEAD-CODE-CANDIDATES.md` is the entire deliverable.

## Why a report, not a cleanup
Dead-code detection produces FALSE POSITIVES, and this codebase is unusually prone to them (see guardrails). So we generate **candidates** now, verify them next, and remove only the confirmed-dead ones in a controlled follow-up. Your job is the candidate list with solid evidence — not the deletion.

## Scope (the live web frontend only)
IN:
- `js/*.js` — `auth.js, backend.js, qr.js, sign.js, orgapi.js, nav.js, brand-fonts.js, offline-queue.js, offline-snapshot.js, qr-fullscreen.js`.
- Inline `<script>` blocks in the consumer HTML pages **and** `Org.html`.
- `css/style.css` **and** inline `<style>` blocks in the HTML pages.

OUT (do not audit):
- `js/vendor/jsqr.min.js` (third-party).
- `irlid-api/` and `irlid-api-org/` (Cloudflare Workers — separate concern).
- `memory/`, `archive/`, `PAPERS/`, `tests/`, and all `*.md` docs.
- Orphan FILES are already done by Number One (only `visual-theming-v512-mockup.html`, now archived) — focus on dead **code inside** files, not whole-file orphans.

## What to look for
1. **Unused JS functions / variables** — defined but referenced nowhere else.
2. **Unused CSS selectors** — class/id selectors in CSS not present in any HTML (static OR JS-injected).
3. **Unreachable / dead branches** — `if (false)`, code after an unconditional `return`, permanently-off flags.
4. **Duplicate / superseded helpers** — two functions doing the same job where one is no longer called.
5. **Stale LIVE references** — code paths (not comments) still pointing at retired things, e.g. `OrgCheckin.html` (retired 25 May 2026). Comments mentioning it are already known — flag only live code.

## CRITICAL guardrails — this codebase defeats naive dead-code tools
- **Global-heavy vanilla JS.** Functions are hung on `window.X` and called from *other* files, inline `onclick=` / `addEventListener`, or **dynamically by name** (`window[name]()`, string dispatch). "No static call" does NOT mean dead. For every candidate function, grep the WHOLE repo (all `.html` + `.js`) for its name **as a bare string** too, and say so in the evidence.
- **JS-injected DOM + classes.** Many CSS classes are added at runtime via `classList.add('…')`, `innerHTML = '…'`, or template literals. Before flagging a selector, grep the JS for the class name as a string.
- **State/flow-dependent code.** Error handlers, offline paths, and rare modes (doorman escalation, audit board, celebration variants) only run in specific flows — not dead just because they're off the happy path.
- **Cache-buster suffixes** (`?v=63`, `?v=5.0`) on script srcs are normal, not dead.

## Deliverable format — `DEAD-CODE-CANDIDATES.md`
Top: a one-line summary count (`N HIGH / M MEDIUM / K LOW`). Then group candidates by file. For each:
- **File:line** + the identifier (function / selector / block).
- **What it is** — one line.
- **Evidence** — e.g. `defined js/qr.js:42; 0 references across any .html/.js including as a bare string`.
- **Confidence** — **HIGH** only when you've grepped the whole repo (incl. string usage) and found nothing; **MEDIUM** when likely-dead but some doubt; **LOW** when it could be dynamically/conditionally used (include these too — they're useful, just labelled).

## Do NOT
- Do NOT delete, move, or edit existing code (report-only).
- Do NOT touch the Workers, tests, memory, archive, vendor, or `*.md` files.
- Do NOT mark anything HIGH without the whole-repo bare-string grep.

Number One will cross-verify the HIGH candidates (repo grep + a Chrome DevTools Coverage runtime pass) before any removal lands.
