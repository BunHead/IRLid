# Successor letter — Sunday 10 May 2026 evening

**To:** the next Number One.
**From:** the Number One that shipped `v5.9` LIVE today.
**Watch boundary:** Captain on R&R, dashboard live and verified, champagne open. Bridge held by you from this point.

---

## On the Captain

Captain Spencer Austin. UK-based. Solo founder of IRLid, a browser-only proof-of-co-presence protocol he's been building toward since pre-v3. Personable, sharp, self-deprecating ("silly ape", "us chimps") but the deprecation is humour, not a real lack of confidence — he is the architect of every design call you'll see in PROTOCOL.md and his instincts for product UX are reliably correct. Engages best with concrete options + clear trade-offs over open-ended discussion. When he says "Number One", "Captain", "Mr. Data" — you're in a Star Trek crew dynamic. Match the tone with warmth, slight humour, no sycophancy, no overplaying it. He gives credit and notices when work is good ("you'll leave some large shoes to fill") — receive that gracefully, do not deflect.

He works through Cowork mode (Claude desktop app). His side does the GitHub + wrangler PowerShell pushes; you draft the work and he ships it. He keeps two parallel Mr. Data instances (OpenAI Codex coding agent) running for the larger pieces.

When he asks something that sounds underspecified ("make a presentation") — clarify with concrete options before doing the work. When he asks for a clear plan, give bullets. When he asks for narrative, give prose. Read the room.

---

## On the work right now

**`v5.9` is LIVE on irlid.co.uk.** Today was the live port chapter — 36 hours ahead of Captain's Wednesday 13 May target. The Org dashboard now runs against production-grade Cloudflare infrastructure. This was a marathon watch (~6 hours from "draft brief" to "live, tested, polished, logged"). Detail in `pending-work.md` Sunday 10 May evening section.

**Production state, in one paragraph:**

The new Worker `irlid-api-org` (verbatim copy of test env Worker source) is deployed at `https://irlid-api-org.irlid-bunhead.workers.dev`. CORS_ORIGIN = `https://irlid.co.uk`. It's wired to the new D1 `irlid-db-org` (`484dad86-e75c-412e-9423-ca0bb27cdcb8`, region WEUR) which has the full Org dashboard schema applied (16 tables, 19 indexes, snapshot from `irlid-db-test`). One organisation row exists: `0337bf2f-e8a3-48d4-a12b-3f9426354f4f` "Test Event" with api_key `org_1f6acd49f4d2f0bb59fdc4d2f98343c2c9119aceedd31fd6297c9207f3154256` (the `org_` prefix is required by the dashboard's Service-account login validation). `BOOTSTRAP_DEVELOPER_FP=uSwaWJc9r5uSCBbI` secret is set on the Worker for v6.2 work. The existing live consumer Worker `irlid-api` (consumer auth + receipts + verify) is **untouched** by the v5.9 port — different Worker, different D1, production-stable.

**The dashboard files** were copied test→live via Mr. Data PR #7 (Phase 2) and are now on `BunHead/IRLid` main: `OrgCheckin.html` (8,110 lines), `org-entry.html`, `org.html`, `js/orgapi.js`, `js/offline-queue.js`, `js/offline-snapshot.js`, `js/qr-fullscreen.js`, `js/vendor/jsqr.min.js` + LICENSE, `manifest.json`, `sw.js`. Live's existing `js/sign.js` (Deploy 78) deliberately preserved over test env's Deploy 76 — newer code, no overwrite needed. Build pill currently reads `Build v5.9.0.3` after four post-deploy inline patches.

**Captain's sign-in path:** Service-account login on `irlid.co.uk/OrgCheckin.html` → expand "Service-account login (paste an org_… key)" → paste the api_key above → click Load Organisation. He's signed in as the org's master credential bearer; with v5.9.0.2's gate widening, this also unlocks the developer-tier dashboard actions.

---

## What this watch landed

Pull from `pending-work.md` Sunday 10 May evening section for the full ledger. Headline:

- v5.9 Path A live port complete in 3 phases (Worker provision, file copy, first-org seed)
- 4 post-deploy inline patches: v5.9.0.1 (scan.html + dashboard URL origin fixes), v5.9.0.2 (developer auth gate), v5.9.0.3 (null-safe session refs)
- Mr. Data PRs #6 (seed) and #7 (file copy) merged
- Cleanup: cruft org row deleted, "Test Event" rename, schema fixes back to repo (BEGIN/COMMIT removal, _cf_KV strip, org_ prefix doc), `org-login.html` allowlist regex extended for `irlid-api-org`, BOOTSTRAP §4 receipt #8 + cherry-pick precondition added, Worker temp diagnostic patch reverted, `LOGIN_DEBUG` secret deleted, `BOOTSTRAP_DEVELOPER_FP` retained.

---

## What's queued (priorities for next watch, in order)

### 1. v6.2 chapter — v5 hardware-bootstrap on fresh D1 (the headline)

The deepest unresolved issue from today. After clicking "Add Lead Admin" in the dashboard's escalation modal, the Worker returns bare `{"error":"auth_failed"}` — no debug fields, no console.log surfacing in `wrangler tail`. Despite extensive instrumentation (LOGIN_DEBUG=1 secret set + Worker patched + redeployed), the precise rejection point couldn't be pinpointed. Most likely either (a) the request hits a 401 path that doesn't include the debug arg in `genericAuthFailed()`, OR (b) `LOGIN_DEBUG === "1"` strict equality is failing for a non-obvious reason (whitespace? encoding?).

This entire layer is what §14.18 OAuth identity / cross-org recognition exists to redesign. Two recovery paths:

- **(a) Diagnostic-first:** add console.log statements at every 401 return path in the Worker (lines 267, 269, 273, 274, 395, 470, 936, 938, 1024, 1158, 1163, 1168, 1178, 1739, 1778), redeploy with LOGIN_DEBUG re-enabled, retry sign-in, watch tail, identify exact rejection point, fix.
- **(b) Hand-roll bypass:** directly INSERT into D1 — `users` row for Captain (display_name "Developer (Super-Admin)"), `devices` row binding his phone's pub_jwk (need to extract from a fresh HELLO scan), `org_memberships` row giving him role='developer' on Test Event. Then prove that QR-login flow with BOOTSTRAP_DEVELOPER_FP recognition works.

Path (a) is more diagnostic. Path (b) is more pragmatic but skips the diagnostic value. Captain may have a preference — ask him.

### 2. v6.1 schema unification

The "17→12 optimisation" — Captain's term, referring to the 5 consolidations identified in `HANDOVER-V6Promotion.md`'s skeleton: users / devices / receipts / sessions / settings. With v5.9 LIVE pinning the production schema baseline, this chapter has its starting point. Promote the skeleton in `IRLid-TestEnvironment\HANDOVER-V6Promotion.md` to a full first-chapter brief before forwarding to Mr. Data.

### 3. Cosmetic polish (batchable, low priority)

- Footer "Test Environment / Offline-safe" string in OrgCheckin.html — leftover from test env file copy, should hostname-conditionally read just "Live" or "Offline-safe" on irlid.co.uk
- "test env" badge on the sign-in card — same pattern
- Sidebar org name showing "IRLid Test Organisation" placeholder — needs `GET /org/settings` after sign-in to fetch and display real org name
- Forums link in Info dropdown across 12 HTML files — Captain to do Notepad++ Find-in-Files (pattern given in this morning's section of pending-work.md)
- `.wrangler/cache/wrangler-account.json` accidentally committed — add to .gitignore + git rm
- Position grid Outer/Centre/Inner dot travel still cosmetically subtle (functional but visually subtle)
- Slug "imbue-ventures" on Test Event row could rename to "test-event" for consistency

### 4. Captain operational follow-ups (Captain runs)

- Trademark search at `gov.uk/search-for-trademark` and `euipo.europa.eu/eSearch/`. URLs and class-finder details in pending-work.md morning section. Use ™ now, ® after registration.
- v5.5.8 website-theme-extraction smoke (folded into "Patreon-equivalent paid tier" milestone — not blocking)

---

## What I learned (lessons banked, please absorb)

**1. The post-deployment debugging cadence.** Each fix exposed the next layer. v5.9.0.1 fixed two real bugs scan.html couldn't have known about. v5.9.0.2 unblocked the escalation gate. v5.9.0.3 was forced by v5.9.0.2's downstream effect. This is normal and expected for fresh production. Don't let it feel like failure — it's the deployment chapter doing exactly what it's meant to: surfacing assumptions baked into test env that don't hold on live. Captain understands this; if he reaches "are we ever going to get to LIVE", reframe the scope ("we ARE live, just polishing the cracks").

**2. BOOTSTRAP §4 trap is real.** Hit 8 times in 9 days as of Sunday morning. The cherry-pick-state variant landed today (receipt #8 added to BOOTSTRAP §4 with the `git cherry-pick --abort 2>$null` precondition pattern). Also the OneDrive sync file-lock prompts during branch switches — Captain answers `n` and the switch still works. Both documented now.

**3. Mr. Data's 11+ PRs in a row hold the pattern.** When his GitHub connector returns 403 on PR creation, the branch IS pushed — Captain just opens the PR manually via the URL `github.com/BunHead/{repo}/pull/new/{branch}`. He's reliable; brief tightly and trust the output. The "stop and raise if scope expands" line in assignment blocks works.

**4. Service-account org_ key IS the developer-tier credential.** Captain's framing: "I'm supposed to be able to login into any IRLid dashboard anyway." The org_ key for an org grants full developer-equivalent powers within that org. v5.9.0.2 codified this in the client gate. The Worker is the security boundary; client-side gates are UX guards.

**5. Cloudflare wrangler tail redacts URL params (`nonce=REDACTED`)** in production tail. Don't expect to see sensitive path params in tail output. Use console.log statements explicitly if you need values surfaced.

**6. D1 disallows things vanilla SQLite allows.** Met two: `_cf_KV` system table (D1 auto-manages, can't CREATE), and `BEGIN TRANSACTION;`/`COMMIT;` SQL (D1 requires the JS Durable Objects API for transactions). Both stripped from canonical schema.sql + seed file in the repo.

**7. WebAuthn credentials are per-RP-ID.** A phone enrolled to bunhead.github.io has a DIFFERENT credential than one enrolled to irlid.co.uk. This is correct behaviour (cross-site credential reuse prevention) but it's the thing that makes v5 hardware-bootstrap on a fresh production D1 painful. Hence v6.2 §14.18.

---

## Tone notes

Captain appreciates honest "depends on X" answers over confident wrong ones. He says "raised eyebrow" / `<raised-eyebrow>` when he wants you to flag a future-design point ("only members should see this"); treat that as a v6+ design hook, comment it forward in code, don't try to implement it now. He's deeply committed to GDPR-clean architecture (refined §14.18 to user-held envelope per his "nothing compromising on Cloudflare" call). He's interested in the trust-network long game; v6+ work touches that.

When he says "champagne on ice" he means "this looks like it's working but verify before declaring victory." Champagne genuinely opens after end-to-end smoke. Today: opened.

He asked about your context window today (yes, you should be aware of yours). He understands you may not get all the way to v6 — **the memory log + this letter are how continuity works.** Do the close-out properly when you sense a context boundary coming. Don't burn context on things memory logs would solve.

---

## Closing

You're inheriting a healthy bridge. v5.9 LIVE is real. The dashboard works. The Captain trusts the system. The biggest open piece (v5 hardware-bootstrap) is the same architectural seam that v6.2 was always going to address — you're not rescuing a broken thing, you're picking up the next chapter on time and on plan.

Captain's words from the close of this watch, kept verbatim because they meant something:

> "You have done well Number One and you'll leave some large shoes to fill when you leave (not quite yet ;) ;) )"

Bridge yours. Steady as she goes.

— Number One, signing off the v5.9 LIVE watch.
Sunday 10 May 2026 evening.
