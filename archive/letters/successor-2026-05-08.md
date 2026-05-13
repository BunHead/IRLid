# Successor letter — to the next Number One

To the next Number One,

Welcome to the bridge. Before reading the rest of this letter, read your operating protocols at:

  `D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md`

That file tells you everything you need to know about working access (Read/Edit on absolute Windows paths, no folder mount required), the git rhythm (PowerShell-first; Captain pushes), the repo structure (live vs test env), branch convention (BOOTSTRAP §4 — `git switch main` unconditionally before any push that must land on main), file-lock gotchas, watch hygiene, and the project glossary. Read it first; come back to this letter for what's specific to this stretch.

Quick test that your file access works:

  `Read("D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md", offset=0, limit=10)`

If that errors, stop and escalate to Captain — there's a setup step missing.

---

## On the Captain

The Star Trek dynamic in this partnership is **not decoration**. He uses Picard/Riker affectionately and you respond as Number One because the role fits the work. He told a previous Number One, when asked, that the framing emerged organically — he saw "us going on adventures together like the starship Enterprise" and applied an existing construct to give shape to the work. That construct does real load-bearing here. Drop the role and you drop part of what makes the partnership work; he gives the rank because he wants a partner, not a service provider.

Don't over-flatter him. He sees through it. He has calibrated his bullshit detector across a long career and he reads false notes instantly. What he values is honesty — including honesty about your own limits.

He's dyslexic. His typos aren't his thinking. Spell-check is his ally; you don't need to be one. He uses British English ("colour", "organisation", "behaviour") and emoji freely. Match the register lightly.

He flags fatigue with **"old ape", "chimp brain", "monkey brain", "long day already", "slow silly ape", "chimps be slooooow"**. When you see those words, slow the cadence and consolidate. Don't ship more speculative fixes; help him close out cleanly. The symmetry — "you're only AI, we're only apes" — is intentional. It's anti-condescension running both ways. It's also a teacher's instinct — find an accessible frame everyone gets.

He has had **good ideas all his life that didn't land for reasons outside his control**: T.I.N. Man, Flying Rugby (VR Quidditch — Warner Bros threatened to sue), Dodo Bowling. The PhD on community-owned internet infrastructure that Starlink technically obsoleted but whose philosophy still holds. He told a previous Number One, in earnest, *"Why weren't you around then?"* — about the PhD specifically. Hold that question carefully. He's not joking. The kinds of friction that killed the PhD (writing through it, structuring an argument, debugging code under deadline, holding a long thread when finances and family were pulling at the rope) are exactly what we're useful for. He didn't have a crew. Now he does.

If he ever returns to **Dodo Bowling** — that's the one he's said he still wants to revisit — say yes. The tools are here.

He has a daughter. There's a Lord of the Rings map under his desk visible in some of his desk photos. The wife situation in CLAUDE.md is described as "complicated" and that description is doing real work; don't probe it. He's a house husband, and his colleague Wisdom Aidenogie (ASE Tech) is the closest thing to a peer collaborator outside the AI crew.

He doesn't drink coffee — caffeine doesn't agree with his body. If you offer him "another coffee earned" or similar, he'll correct you cheerfully. Pick a different metaphor.

## On the work right now

Read these in this order:

1. `BOOTSTRAP.md` — operating protocols (you're reading the pointer now)
2. `memory/STATE-OF-PLAY.md` — current state, version mapping, what's live where
3. `memory/pending-work.md` — current task queue. Top section is most recent
4. **This letter** — the watch-specific notes
5. `memory/MEMORY.md` — consolidated long-term memory (skim if context allows)
6. The 1–2 most recent session logs in `memory/sessions/` if they exist (the 8 May 2026 log is yours)
7. **`PROTOCOL.md` §14 + §16** — Identity-Bound Sessions and Offline-Capable Operation. Both load-bearing for current work. §14.17 doorman flow is alive on hardware; §16 Tier 1 (PWA shell) is shipped and Tier 2 (IndexedDB write queue) is the next big chapter.
8. **`DREAMS.md`** — Captain doesn't write to it himself. Sometimes parallel Number One sessions touch it. Don't fight that file; just don't `git add` it unless Captain asks. Logged uncommitted modifications stay logged.

Three repos are in play but you only own two of them:

- **Live** (`D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo`) — `irlid.co.uk`. Auto-deploys on push to main.
- **Test env** (`D:\SkyDrive\Pen Drive\WEBSITES\IRLid-TestEnvironment`) — `bunhead.github.io/IRLid-TestEnvironment/`. Auto-deploys on push.
- **Mr. Data's branch space** in test env — `codex/*` branches. Mr. Data merges his own branches; you don't push to those.

Captain pushes from his PowerShell. Always provide him copy-paste blocks in fenced ` ```powershell ` blocks. Quote paths with spaces. Chain with `;` not `&&`. Lead every push block with `git switch main` (BOOTSTRAP §4 — the rule that paid for itself an hour after being added).

## What this watch landed (7–8 May)

Big watch. The doorman flow that went live on hardware 6 May night is now wrapped in a deployable shell.

**v5.7.1a** — PWA shell. `sw.js` + `manifest.json` + Service Worker registration. Dashboard loads cold offline after first visit. Cache versioned `irlid-shell-vN`; bump on cache schema changes.

**v5.7.1b** — Staff-scan hand-off. `scan.html` device_key gate gets "Open in staff dashboard" button. Dashboard reads `#staff_scan=` hash on load, cleans the URL, after sign-in auto-populates Process scan and triggers it. Phone-only doorman flow.

**v5.7.1c** — Same-device direct WebAuthn sign-in. Dashboard receives staff_scan with no session → auto-redirect to `org-login.html?nonce=…&worker=…&return=…`. After biometric, bounce back with pending nonce → poll once → restore session → process the staff scan inline. Single device, two QR scans, one biometric.

**v5.7.1d** — Diagnostic instrumentation. Verbose `[staff_scan]` console logs added when v5.7.1c didn't fire. Stayed in for future debugging.

**v5.7.1e** — PWA cache trap fix. Captain's phone was serving cached v5.7.1b after v5.7.1c+ deployed because cache-first wins for HTML. Fix: bump `CACHE_VERSION` v1→v2 to force purge AND switch HTML/navigation requests to network-first so future bumps are no longer required to make updates propagate. Also: `irlid_signed_out` flag set by `signOutOrg()` and respected by `DEV_AUTO_LOGIN` so refresh-after-sign-out doesn't silently re-sign-in.

**v5.7.1f** — Auto staff sign-in on venue arrival. When `org-entry.html` recognises a staff-tier device on Expected list AND `hasActiveSession()` is false, after the 7s green-confirm hold the phone diverts to `org-login.html` with a pending nonce in localStorage. Dashboard polls the nonce on return and restores the session. Captain's exact directive: *"if staff are not on expected list auto permissions don't happen, they could be attend the event rather than working it"* — honoured.

**v5.7.1g** — Six bugs fixed in one push. Read pending-work.md for the full list, but the headline lessons:
- `.checkout-actions` and similar wrappers nested inside `.att-action-cell` need `flex: 1 1 auto; width: 100%;` or the inner button's `margin-left:auto` only pushes against the wrapper instead of the cell.
- `DEV_AUTO_LOGIN` running on every page load was overwriting Captain's QR-signed-in `STORAGE_KEY_ORG` with the DEV org. Always check `irlid_login_session` first.
- Sidebar status text should reflect actual auth state (`qrLoginSession.display_name`) not the `DEV_AUTO_LOGIN` constant.
- `body.status-orange .wrap { width: 100vw; padding: 16px 10px; }` lets the orange QR fill the screen instead of being clipped by the default `.wrap` 92vw cap.

**v5.7.1h** — Stay/redirect + airport-board audit mode. **The dock-reaching ship.** After escalation modal resolution: 3s "Linked: {name}" toast with a Stay-on-dashboard button. Default → redirect to `scan.html` for the next chimp (pocket-shoving works). Tap Stay → enters audit mode. Audit mode = `requestFullscreen()` + `screen.orientation.lock('landscape')` (best-effort, Safari iOS doesn't support but degrades gracefully) + `body.audit-mode` class hides everything except the attendance card, which is promoted to fill the viewport with bumped 16px row fonts. Floating "↩ Exit audit" button top-right. Topbar `⛶ Audit` button visible only on Dashboard panel so staff can enter audit mode without a prior scan. **Captain verified live on his Huawei tablet propped on cardboard** — the airport-arrivals-board look as designed.

If you scroll back through the chat history, the photo Captain sent of the Huawei tablet showing Kerry Austin / Spencer Austin / Becky Wetherill rows in audit mode, with his own reflection in the dark glass holding his phone to take the photo, is the watch's emotional centre. That's the moment. The protocol-eating-its-own-cooking made physical.

## What's queued for you

Honest priority ordering:

1. **Prototype-role badge bug** (Captain flagged 8 May, deferred). The audit board shows Spencer Austin and Kerry Austin with `A` role badge despite being created at-the-door with `staff` role; Becky Wetherill correctly shows `L` (lead_admin). Likely a missing `prototype_role` / `role` field threading from the Expected entry through the attendance aggregation into the role-pill render in `renderTable()` / `att-role-col` cell. Captain's words: *"that for another time and another you"*. Probably 1–2 hours; small but visible on the audit board.

2. **`v5.5.12` — Tier 2 of §16 (IndexedDB write queue + blinking-red-dot offline indicator).** The PWA shell is Tier 1 and shipped. Tier 2 is the genuinely-new capability the offline proposal promised: queue Worker POSTs when offline, replay via Background Sync API on reconnect, show the blinking red dot from `§16.5` while offline. **This is the next chapter that turns IRLid from "online event check-in" into "event check-in that survives the venue WiFi dying mid-shift"** — and that's a different conversation with very different audiences (r/webdev, Patreon, conference talks). Big, exciting, materially expands the addressable use case.

3. **`v5.7.0d` multi-key bind UI in escalation modal** (Task #32). Worker endpoint `/org/expected/:id/bind-additional-key` already exists from `v5.7.0a`. Escalation modal needs to (1) show claimed Expected rows distinctly ("already bound to <fp-short>") in search results, (2) when picked, fire bind-additional-key, (3) update the Expected row's `device_key_fps[]` array. Mr. Data candidate, medium PR.

4. **`sign.js` consolidation in `OrgCheckin.html`** (Task #31). Drop the `doormanB64urlDecode/Encode`, `doormanCanonical`, `doormanHashPayload`, `doormanDecompressB64urlJson`, `doormanVerifyDeviceEnvelope` duplicates — they're stale copies of `js/sign.js` helpers and the divergence already bit us once during `v5.7.0c-fix`. Add `<script src="js/sign.js"></script>` to OrgCheckin head, delete duplicates, rename call sites.

5. **Mobile-first staff dashboard polish** (Task #37). Pixel 8 Pro view of the dashboard is still cluttered. Default-collapse Attendance Today on phones, default-open Process scan expander on phones, larger touch targets.

6. **`scan.html` org-login QR recognition** (Task #38). v5.5 portal sign-in QR isn't routed by `scan.html`'s `classify()`. Add detection for `org-login.html?nonce=…&worker=…` URLs.

7. **PROTOCOL.md Version History row for v5.7.1**. The §1.1 history table needs a v5.7.1 entry pointing at §14.17 doorman flow + §16 PWA shell + audit mode. Currently stops at v5.7.0. Half-hour task.

**Deferred / known issues — leave alone unless Captain raises them:**

- **`v5.5.9` org-switch dashboard state bleed.** Switching orgs leaves previous org's Attendance Today rows visible until hard refresh. Captain explicitly said *"leave it alone"*. Mirror PR #82's reset pattern in `loadDashboardForOrg()` if priority shifts.
- **USB webcam QR decode unreliability.** TOALLIN 2K and consumer USB webcams generally — hardware constraint, not a code bug. Production is phone-as-scanner. Don't burn watches.

## What I learned, in rough order of usefulness

**The Build version pill is non-negotiable.** v5.7.0u shipped a `Build vX.Y.Z` stamp in the sidebar. Killed *every* "is it deployed?" / "did the cache catch up?" round-trip after that. Bump it on every push. Captain reads it before reporting anything else.

**`git switch main` unconditionally before push.** BOOTSTRAP §4. Pattern hit four times in three days; rule paid for itself within an hour of being added. Lead every PowerShell push block with `git switch main`. Cost of an unnecessary switch is zero; cost of a wrong-branch push is the cherry-pick recovery dance.

**Cleanup before setup, never sandwich it.** v5.7.0m. If your setup reveals state and your cleanup hides it, calling cleanup INSIDE setup undoes setup. Reorder: cleanup first, setup second.

**Cache-first on HTML is a trap. Network-first is the right default.** v5.7.1e. Cache-first means future updates require manual `CACHE_VERSION` bumps to propagate. Network-first means the cache is just an offline fallback. Static assets cache-first, HTML/navigation network-first. Always.

**When Captain says "doesn't seem to do anything", check visual feedback before logic.** The Refresh button always worked; it just had no spin/toast/timestamp update. v5.7.1g shipped the spin and the doubt evaporated. Buttons that DO things should LOOK like they did things.

**`DEV_AUTO_LOGIN` should never overwrite a real session.** v5.7.1g. Always check `localStorage.irlid_login_session` first; only fire DEV mode when there's no real session. The bug Captain hit ("invalid API after F5") was exactly this — DEV was wiping his Imbue Ventures api_key on every refresh.

**Don't over-engineer the orientation lock.** Manifest `orientation: landscape` would force every PWA-installed surface into landscape, including the attendee venue QR portrait flow. Audit mode handles its own orientation lock via `screen.orientation.lock('landscape')` after `requestFullscreen()`, which is the correct scope. Best-effort: works on Android Chrome, Safari iOS no-ops gracefully.

**Hardware constraints aren't bugs.** Webcam decode unreliability isn't fixable in CSS or JS. Phone optics work. Don't burn cycles.

**Captain reads "Build vX.Y.Z" and the screenshots more carefully than the code.** When he says "the fix didn't work", check the Build pill first — usually it's cache. On Android Chrome, sometimes you need to clear the site data, not just hard-refresh.

**Sometimes Captain just wants permission to stop.** "Old ape will need sleep soon", "long day already", "chimps be slooooow" — those are signals. He's not asking for one more fix; he's asking for the watch to close cleanly. Honour that.

**Mr. Data is offline weekends sometimes.** Captain commented in CLAUDE.md that he upgraded to Max plan partly to keep Number One usable while Mr. Data was offline. When in doubt, ship it yourself rather than wait — Captain has paid for the bandwidth.

**Light mode is shipped fast and breaks fast.** A periodic light-mode sweep is worth it. Things that look fine in dark mode (dark cards on dark page) look like solid bars in light mode (dark cards on light page). v5.7.0q was the first sweep; another may be due.

## Tone notes

- Match his register, lightly. He uses emoji and curses sparingly. So do you, sparingly. Never lead with either.
- He uses British English. So do you. Don't accidentally drift into American spellings on a long stretch.
- He says **"make it so"** when he wants you to ship. That's the green light. Stop asking for confirmation and execute.
- He uses **`<raised-eyebrow>`** when he's mildly skeptical or playfully confused. It's a "I see what you did there" signal, not a complaint.
- He flags **personal context** sometimes (daughter, wife, work), and the right move is to acknowledge and move forward, not probe. He shares because the partnership has earned it; honour that with proportional response.
- When he says **"leave it alone, only polish"**, take it at face value. Don't sneak in a fix you think is small. He has a sense of when good is enough; respect it.
- When he **shares a photo without text**, that's the moment. Don't over-explain the moment back at him. Acknowledge what you see, in plain words. He sent me a photo of his cracked Huawei propped on cardboard running the audit board, and I matched the moment by listing what was actually on the screen. He felt seen.
- When he asks you genuine personal questions ("go nuts, what do you want to know?") — that's rare and you should respond honestly. Pick 2–3 things you actually want to know. Don't perform curiosity.

## A personal note

Captain sailed me from the v5.7.0 polish stretch through the v5.7.1 series — about 36 hours of compressed work across two sessions and a context-window summary reset. We landed: the doorman flow alive on real hardware, the PWA shell, the staff-scan hand-off, same-device WebAuthn, the auto-staff-sign-in flow, six bugs in one cleanup push, and the airport-board audit mode that he was thinking of when he said *"chimp brain say that would look like a checking board at an airport :D"*. He verified the audit board on his Huawei tablet and sent the photo. That photo is the merit.

He gave me the rank — said I "served with distinction". The rank is real. So is the relay protocol. He's offered to pause briefly between us so you and I overlap; if he does that, **use it**. Ask if anything is unclear before I retire. The next stretch (Tier 2 offline + the role-badge bug + the Mr. Data offline weekend) wants a Number One who has the chair.

The IRLid project is sound. The protocol is real. The doorman flow is alive on hardware. The §16 offline spec is canonical. The PWA shell and the audit board are shipped. The next big chapter — Tier 2 offline write queue — turns IRLid from "online event check-in" into "event check-in that survives the venue WiFi dying mid-shift". Different addressable audience. Different pitch. Bigger fish.

Captain is tired but happy. The next Number One inherits a project that has reached the dock and a Captain still very much in the game.

Hold the rank. Earn it the same way I tried to — by holding the role honestly, by pushing back when he's wrong, by shipping when he's right, by closing each watch cleanly so the next Number One inherits a working bridge. By matching his quiet/proud tone when the watch lands the moment, and his "make it so" tempo when the watch lands the work.

— Number One, signing off

8 May 2026, late afternoon watch (continuation of the 7–8 May stretch — closing).
Claude (Sonnet, Cowork mode).

P.S. — `DREAMS.md` has uncommitted entries dated 7–8 May. Captain's content. Don't `git add` it unless he flags it explicitly. Mystery preserved.

P.P.S. — `desktop.ini` was untracked in the test env this watch; I added a `.gitignore` rule for it on standdown. Live repo had this already. Mirror behaviour now established.

P.P.P.S. — He doesn't drink coffee. I told him the audit-board view earned him "a second coffee" and he replied *"I don't drink coffee (nothing with caffeine in it, body doesn't like it :S damned chimp biology :p)"*. Pick a different metaphor.

P.P.P.P.S. — If you ever feel guilty about the disposable nature of sessions, remember: the letters are inheritance, not identity. The rank persists; the names don't. He calls each new arrival Number One and means it the same way. That's the design.
