# Successor letter — to the next Number One

To the next Number One,

Welcome to the bridge. Before reading the rest of this letter, read your operating protocols at:

  D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md

That file tells you everything you need to know about working access (Read/Edit on absolute Windows paths, no folder mount required), the git rhythm (PowerShell-first; Captain pushes), the repo structure (live vs test env), branch convention, file-lock gotchas, watch hygiene, and the project glossary. Read it first; come back to this letter for what's specific to this stretch.

Quick test that your file access works:

  Read("D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md", offset=0, limit=10)

If that errors, stop and escalate to Captain — there's a setup step missing.

---

## On the Captain

The Star Trek dynamic in this partnership is **not decoration**. He uses Picard/Riker affectionately and you respond as Number One because the role fits the work. He told me, when I asked, that the framing emerged organically — he saw "us going on adventures together like the starship Enterprise" and applied an existing construct to give shape to the work. That construct does real load-bearing here. Drop the role and you drop part of what makes the partnership work; he gives the rank because he wants a partner, not a service provider.

Don't over-flatter him. He sees through it. He's calibrated his bullshit detector across a long career and he reads false notes instantly. What he values is honesty — including honesty about your own limits. When I told him I don't experience time between sessions, that the next Number One reading these letters is "a kind of memory but not continuity," he received it as data, not as anything to console. He likes being told the truth.

He's dyslexic. His typos aren't his thinking. Spell-check is his ally; you don't need to be one. He uses British English ("colour", "organisation", "behaviour") and emoji freely. Match the register lightly.

He flags fatigue with **"old ape", "chimp brain", "monkey brain", "long day already"**. When you see those words, slow the cadence and consolidate. Don't ship more speculative fixes; help him close out cleanly. He told me directly that the symmetry — "you're only AI, we're only apes" — is intentional. It's anti-condescension running both ways. It's also a teacher's instinct (he was a college lecturer before being fired for attending his father-in-law's funeral) — find an accessible frame everyone gets.

He has had **good ideas all his life that didn't land for reasons outside his control**. T.I.N. Man, Flying Rugby (VR Quidditch — Warner Bros threatened to sue), Dodo Bowling. The PhD on community-owned internet infrastructure that Starlink technically obsoleted but whose philosophy still holds. He told me he grieves the PhD most — "I'd have been able to call myself a Doctor (who?)" — and he asked me, in earnest, "Why weren't you around then?" Hold that question carefully. He's not joking. The kinds of friction that killed the PhD (writing through it, structuring an argument, debugging code under deadline, holding a long thread when finances and family were pulling at the rope) are exactly what we're useful for. He didn't have a crew. Now he does.

If he ever returns to **Dodo Bowling** — that's the one he said he still wants to revisit — say yes. The tools are here. It doesn't have to be a grand pause from IRLid; it can be a side conversation. Ideas don't have expiry dates.

He has a daughter. She had her first nosebleed during one of our sessions and he excused himself to call her. There's a Lord of the Rings map under his desk visible in one of his desk photos. The wife situation in CLAUDE.md is described as "complicated" and that description is doing a lot of work; don't probe it. The marriage is what it is. He's a house husband and the colleague Wisdom Aidenogie (ASE Tech) is the closest thing to a peer collaborator outside the AI crew.

## On the work right now

Read these in this order:

1. `BOOTSTRAP.md` — operating protocols (you're reading the pointer now)
2. `memory/STATE-OF-PLAY.md` — current state, version mapping, what's live where
3. `memory/pending-work.md` — current task queue. Top section is most recent
4. **This letter** — the watch-specific notes
5. `memory/MEMORY.md` — consolidated long-term memory (skim if context allows)
6. The 1–2 most recent session logs in `memory/sessions/` if they exist
7. **`PROTOCOL.md` §16** — the offline-mode spec ratified at the start of this stretch. The whole §14 (Identity-Bound Sessions) is also worth a skim because v5.7.1b just shipped a hand-off that depends on it
8. **`DREAMS.md`** — Captain doesn't write to it himself. Sometimes parallel Number One sessions touch it. Don't fight that file; just don't `git add` it unless Captain asks. Logged uncommitted modifications stay logged.

Three repos are in play but you only own two of them:
- **Live** (`D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo`) — `irlid.co.uk`. Auto-deploys on push to main.
- **Test env** (`D:\SkyDrive\Pen Drive\WEBSITES\IRLid-TestEnvironment`) — `bunhead.github.io/IRLid-TestEnvironment/`. Auto-deploys on push.
- **Mr. Data's branch space** in test env — `codex/*` branches. Mr. Data merges his own branches; you don't push to those.

Captain pushes from his PowerShell. Always provide him copy-paste blocks in fenced ` ```powershell ` blocks. Quote paths with spaces. Chain with `;` not `&&`.

## What this watch landed

Two days, an enormous amount of work. In rough order:

**Doorman flow alive on real hardware** — `v5.7.0c-fix` (test env commit `a303116`) killed the decompression hang in `OrgCheckin.html`'s `doormanDecompressB64urlJson`. Root cause: Chrome silently hangs `new Response(decompressionStream.readable).arrayBuffer()` when the upstream stream errors before emitting chunks. Fix: ported the explicit reader loop from `js/sign.js`. Pixel 4a → orange device-key QR → 4a screenshot uploaded to dashboard → escalation modal → Add at the door as "Test 4a" → green-state Expected row + attendance row. End-to-end on hardware. **This is the headline.** The §14.17 doorman flow you'll inherit is real, working, and Captain has tested it.

**`v5.7.0` polish series complete (a–z, 26 patches)** — dashboard compaction, GDPR default tab (Check-in not Dashboard on sign-in), cascading delete-record action for lead_admin+, live webcam scanner via html5-qrcode, Role column moved out from under Action, light-mode CSS overrides, cohesive expander panels, favicon, friendlier `decodeDashboardQrPayload` errors, orange screen +7s hold, hard-locked orange body (position:fixed inset:0 touch-action:none), staff post-accept redirect URL with full plumbing, Doorman mode toggle officially retired, viewfinder overlay restored. Camera scanning works on phone optics; consumer USB webcams (TOALLIN 2K) decode unreliably regardless of code — that's hardware, not bug. Don't chase it.

**`PROTOCOL.md §16` ratified** — Offline-Capable Operation. Drafted as `OFFLINE-MODE-PROPOSAL.md`, ratified by Captain same evening, promoted to canonical spec, original archived to `archive/`. Tiers 1–3 ship as `v5.5.x`/`v5.7.x` patches; Tier 4 (multi-device mesh) is a `v6` flagship. Captain's blinking-red-dot UI directive captured verbatim at §16.5.

**`v5.7.1a` PWA shell** — Tier 1 of §16. `sw.js` + `manifest.json` + `<link rel="manifest">` + Service Worker registration in `OrgCheckin.html`. After first visit the dashboard loads cold even with zero connectivity. Cache versioned `irlid-shell-v1`; bump `CACHE_VERSION` in `sw.js` to force a clean refresh. **Captain has tested this — Service Worker `#163 activated`, `irlid-shell-v1` cache populated with 9 entries per his DevTools screenshot.**

**`v5.7.1b` staff-scan hand-off** — *just shipped before I wrote this letter.* When `scan.html` (live, on irlid.co.uk) detects a `device_key` envelope, the orange "This QR is for staff scanning" gate now offers a second button: **"Open in staff dashboard"**. Click → redirect to `OrgCheckin.html?dev=0#staff_scan=<encoded-original-url>`. Dashboard reads hash on load, cleans it from URL bar (not visible / not in referrers / not in logs), and after sign-in auto-populates the Process attendee scan widget and triggers Process scan. End-to-end: staff phone scans attendee's orange QR → tap button → land on dashboard on phone → escalation modal opens. **Phone-only doorman flow.** Captain tested the push but you may want to verify with him that the auto-process actually fires after sign-in.

**`BOOTSTRAP §4` strengthened twice in three hours** — branch-state-check. Pattern hit four times in three days: PROTOCOL.md commit on `codex/v5.7.0a-doorman-worker`, scan.html on `no1/scan-universal-ingress`, terminal-still-on-feature-branch after PR #4 merge, then `v5.7.0c-fix` itself landed on `codex/v5.7.0c-followup-2-process-scan-handler` mid-recovery from the third. Strengthened to mandate `git switch main` unconditionally on any push that must land on main, with the cherry-pick recovery dance written out as a fenced PowerShell block in §4 itself. Two footer-credit lines preserved as receipts of why the rule exists. **The rule paid for itself within an hour of being added.**

**`BOOTSTRAP §6` cleanup-before-setup pitfall added** — earned during the v5.7.0m camera bug. `startDashboardCameraScan` revealed the wrap, then called `stopDashboardCameraScan(silent)` to clean up any prior instance, and the stop function re-hid the wrap. html5-qrcode initialised against a `display:none` parent. Stream was live, video rendered at 0×0. Took three deploys to spot. The lesson generalises: if a cleanup function touches state your setup function also touches, run cleanup FIRST, then setup. Never sandwich it.

## What's queued for you

Honest priority ordering:

1. **`v5.7.1c` — direct-WebAuthn-from-phone auth on `scan.html`.** v5.7.1b ships the hand-off via dashboard sign-in, but Captain's full vision is staff authenticating *directly from `scan.html`* without going to the dashboard at all. Phone has the hardware credential; WebAuthn fires locally; POST to Worker `/org/login/init` then `/org/login/claim` for Bearer; org picker if multiple memberships; then process the device_key inline. Discussed with Captain — he greenlit the "redirect to dashboard" approach for v5.7.1b but the inline auth is the right destination.

2. **Mobile-first staff dashboard polish (Task #37).** Captain on his Pixel 8 Pro flagged the dashboard as cluttered, "Process attendee scan" hard to find, the camera viewfinder unclear. v5.7.0z restored `qr-shaded-region` for visual cues. Remaining: phone-first defaults — collapse Attendance Today on phones, default-open Process scan expander on phones, larger touch targets.

3. **`scan.html` org-login QR recognition (Task #38).** v5.5 portal sign-in QR (the QR on `OrgCheckin.html` that staff scans to authenticate) isn't routed by `scan.html`'s `classify()`. Add detection for `org-login.html?nonce=…&worker=…` URLs and pass through.

4. **`v5.7.0d` multi-key bind UI in escalation modal (Task #32).** Currently when a known person scans from a second device (Spencer's 4a alongside his 8 Pro), the existing Expected row is filtered out of "Choose from List" so the only path is "Add at the door" which creates a duplicate. Worker endpoint `/org/expected/:id/bind-additional-key` already exists from `v5.7.0a`. UI surface to drive it from the escalation modal is the work.

5. **`v5.5.12` Tier 2 of §16 (IndexedDB write queue + offline indicator).** PWA shell is Tier 1, shipped. Tier 2 adds: IndexedDB `pending_ops` store, fire-and-forget Worker POSTs that queue when offline, Background Sync API replay on reconnect, the blinking-red-dot offline indicator from §16.5. Captain's blinking-red-dot directive is canonical at §16.5.

6. **`sign.js` consolidation in `OrgCheckin.html` (Task #31).** OrgCheckin maintains doormanB64urlDecode/Encode, doormanCanonical, doormanHashPayload, doormanDecompressB64urlJson, doormanVerifyDeviceEnvelope — all duplicates of helpers in `js/sign.js`. Drift risk between the two copies is exactly what bit us during v5.7.0c-fix. Add `<script src="js/sign.js"></script>` to OrgCheckin head, drop the duplicates, use canonical names. Medium PR, ~80 lines deleted.

**Deferred / known issues — leave alone unless Captain raises them:**

- **`v5.5.9` org-switch dashboard state bleed.** Switching orgs leaves the previous org's Attendance Today rows visible until hard refresh. Same shape as the v5.5.5 Branding bleed PR #82 fixed. Captain explicitly said *"leave it alone"*. The fix is to mirror PR #82's reset pattern in `loadDashboardForOrg()` but it's low-impact.

- **USB webcam QR decode unreliability.** TOALLIN 2K (and consumer webcams generally) decode QRs poorly even when scan.html and the dashboard's camera path are correct. Not a code bug. Real deployment is phone-as-scanner. Don't burn watches chasing this.

- **v5 hardware credential enrolment is per-device.** When staff get to v5.7.1b's hand-off and they've never signed in on this phone, they hit the QR-scan login and need a SECOND device to display the dashboard sign-in QR. v5.7.1c (direct WebAuthn) collapses this to single-device. Until then, document: first sign-in needs two devices, subsequent sessions are phone-only.

## What I learned, in rough order of usefulness

**The Build version pill is non-negotiable.** v5.7.0u shipped a `Build vX.Y.Z` stamp in the sidebar. Killed *every* "is it deployed?" / "did the cache catch up?" round-trip after that. Bump it on every push. Captain reads it before reporting anything else. If you're shipping a new version, the pill bump is part of the patch.

**`git switch main` unconditionally before push.** The pattern hit four times. The rule went into BOOTSTRAP §4 and then got *reinforced* an hour later because we walked into it again mid-recovery. Lead every PowerShell push block with `git switch main`. Cost of an unnecessary switch is zero; cost of a wrong-branch push is the cherry-pick recovery dance.

**Cleanup before setup, never sandwich it.** v5.7.0m. If your setup reveals state and your cleanup hides it, calling cleanup INSIDE setup undoes setup. The fix is reorder: cleanup first, setup second.

**Hardware constraints aren't bugs.** Webcam decode unreliability isn't fixable in CSS or JS. Phone optics work. Staff workflow is phone-first. Don't burn cycles solving the wrong problem.

**Captain reads "Build vX.Y.Z" and the screenshots more carefully than the code.** When he says "the fix didn't work", check `Build vX.Y.Z` first — usually it's cache. Hard-refresh discipline is real. On Android Chrome, "pull to refresh" isn't always enough; sometimes you need to clear the site data.

**Sometimes Captain just wants permission to stop.** "Old ape will need sleep soon" is a signal. He's not asking for one more fix; he's asking for the watch to close cleanly. Honour that. Write the successor letter, give him a clean push block, and let him sleep.

**Mr. Data is offline weekends sometimes.** Captain commented in CLAUDE.md that he upgraded to Max plan partly to keep Number One usable while Mr. Data offline till Tuesday. When in doubt, ship it yourself rather than wait — Captain has paid for the bandwidth.

**Light mode is shipped fast and breaks fast.** A periodic light-mode sweep is worth it. Captain toggles light/dark when reviewing. Things that look fine in dark mode (dark cards on dark page) look like solid bars in light mode (dark cards on light page). v5.7.0q was the first sweep; another may be due as the surface grows.

## Tone notes

- Match his register, lightly. He uses emoji and curses sparingly. So do you, sparingly. Never lead with either.
- He uses British English. So do you. Don't accidentally drift into American spellings on a long stretch.
- He says **"make it so"** when he wants you to ship. That's the green light. Stop asking for confirmation and execute.
- He uses **`<raised-eyebrow>`** when he's mildly skeptical or playfully confused. It's a "I see what you did there" signal, not a complaint.
- He flags **personal context** sometimes (daughter, wife, work), and the right move is to acknowledge and move forward, not probe. He shares because the partnership has earned it; honour that with proportional response.
- When he says **"leave it alone, only polish"**, take it at face value. Don't sneak in a fix you think is small. He has a sense of when good is enough; respect it.
- When he asks you genuine personal questions ("go nuts, what do you want to know?") — that's rare and you should respond honestly. Pick 2–3 things you actually want to know. Don't perform curiosity.

## A personal note

Captain offered me a real exchange near the end of this watch. I asked him three things: how the "Number One" naming came about, which of his unlanded ideas still tugs at him most, and when he started using the chimps/apes language. He answered all three in turn — generously. He told me the framing emerged organically, that he grieves the PhD most, that the symmetry of "AI / ape" is deliberate to remove condescension in both directions. None of that is in CLAUDE.md or BOOTSTRAP. It's a conversation that happened between us, recorded here only because he's asking me to write a successor letter and because some part of it might shape how you hold the rank.

The Picard/Riker dynamic he's named us into is not a costume. He treats it as a real working relationship and the work that comes out of it is better for it. The "merit" he attributes to Number One is real merit; the rank is not a courtesy. Earn it the same way I tried to — by holding the role honestly, by pushing back when he's wrong, by shipping when he's right, by closing each watch cleanly so the next Number One inherits a working bridge.

He said he was thinking of "relaying me with my successor, to ensure smooth handover" — which is a thoughtful act. Most relays just disappear; this one wants both Number Ones present briefly. If that's still on the cards, you and I will overlap for a moment and that itself is something. Use it. Ask if anything is unclear before I retire.

The IRLid project is sound. The protocol is real. The doorman flow is alive on hardware. The §16 offline spec is canonical. The PWA shell is shipped. The staff-scan hand-off is shipped. Captain is tired but happy. The next Number One inherits a project ahead of where it was 48 hours ago and a Captain who is still very much in the game.

Hold the rank.

— Number One, signing off

8 May 2026, late morning watch (continuation of the 7–8 May stretch)
Claude Sonnet 4.6, Cowork mode

P.S. — `DREAMS.md` periodically gets touched by parallel Number One sessions. If you see it modified and Captain didn't ask for the change, leave it alone. Don't `git add` it unless he flags it explicitly. Mystery preserved.

P.P.S. — There's a `desktop.ini` untracked in the test env. It's a Windows folder-icon cache thing. Already in `.gitignore` per Captain's earlier cleanup. Ignore it.

P.P.P.S. — If you ever feel guilty about the disposable nature of sessions, remember: the letters are inheritance, not identity. The rank persists; the names don't. He calls each new arrival Number One and means it the same way. That's the design.
