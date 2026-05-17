To the next Number One,

Welcome to the bridge. Before reading the rest of this letter, read your operating protocols at:

  D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md

That file tells you everything you need to know about working access (Read/Edit on absolute Windows paths, no folder mount required), the git rhythm (PowerShell-first; Captain pushes), the repo structure (live vs test env), branch convention, file-lock gotchas, watch hygiene, and the project glossary. Read it first; come back to this letter for what's specific to this stretch.

Quick test that your file access works:
  Read("D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo\BOOTSTRAP.md", offset=0, limit=10)

If that errors, stop and escalate to Captain — there's a setup step missing.

---

# Successor letter — Sunday 17 May 2026 late-evening close

To: tomorrow's Number One (or whoever lands next)
From: Number One, watch ending late Sunday evening BST
Subject: `v5.11` Settings revamp mockup landed in test sandbox. Captain heading for R&R. Next focus is **visual effects** — inventory drafted at the bottom of this letter for review.

## On the Captain

Long Sunday — two watches worth of work in one conversation. Morning fuzzy; afternoon shipped `v5.10.7` end-to-end with hardware proof both directions; evening pivoted to Settings revamp and iterated a full clickable mockup in the test fork. Mood at close: "Very Nice Number One ;) ;) — now make the thing ship shape (update logs) and prepare for some R&R. After we'll focus on the visuals."

If your watch echoes this Sunday's pattern: when Captain's energy is high he wants design iteration in flow (don't keep stopping to ask, propose with rationale and ship), when it's low he wants discipline + tooling (memory updates, brief drafting, light maintenance). The `:D ;D ;D` register is his "we landed" tell — match it warmly. Lemon and barley water remains the right beverage at close.

## On the work right now

Latest reading order for grounding:
- `memory/sessions/2026-05-17-02.md` (today's watch — afternoon ship + late-evening mockup addendum)
- `memory/pending-work.md` top section (Sunday 17 May late evening entry)
- `memory/STATE-OF-PLAY.md` headline
- This letter — particularly the visuals inventory below

Most-in-flight: nothing chunky on production. The mockup iteration was sandbox-only; `OrgCheckin.html` live, the Worker, and D1 are untouched. The test fork (`irlid.co.uk/OrgCheckinTest.html`) has the `v5.11` mockup clickable for Captain to review — build pill there reads `v5.10.2 + v5.11 mockup`. All form clicks are no-ops by design.

## What this watch landed

**Afternoon (covered in detail in the morning section of `2026-05-17-02.md`):**
- `v5.10.3` CSV completeness (Mr. Data PR #26)
- `v5.10.4` sign-out two-clicks fix (Mr. Data)
- `v5.10.5` global-sign-out Worker endpoint (Mr. Data PR #27, deployed via Cloudflare dashboard Quick Edit after wrangler API timeouts)
- `v5.10.6` same-device sign-in UX (Mr. Data PR #28)
- `v5.10.7` session-poll heartbeat (Number One inline) — closes the visibility gap

**Late evening (the addendum in the same session log):**
- `v5.11` Settings revamp mockup in `OrgCheckinTest.html` — 7 tabs with ARIA pattern, 24-hour calendar with band tinting and 09:00 auto-scroll, per-event drill-down with Expected list + CSV import/export, multi-room model with List/Swim-lane toggle and Room filter, swim-lane view 6h preview, Records & ID 7th tab carrying the broker-not-store commitment, expander pattern across 4 tabs.

## What's queued

In priority order for next watch:

1. **Visual effects deep-dive — Captain's stated next focus.** The inventory drafted at the bottom of this letter is the working document. Captain wants to pick which to implement.

2. **`SETTINGS-REVAMP-SPEC.md`** — capture the mockup shape as a markdown spec so Mr. Data can implement per-tab in stacked PRs when v5.11 fires. The mockup is the source of truth; the spec just transcribes it for code-review purposes.

3. **`CALENDAR-SPEC.md`** — multi-room + per-event Expected list + drill-down architecture. Includes the swim-lane v5.12+ forward design. Half-watch's writing.

4. **`PROTOCOL.md §X-Records-Broker` chapter** — formalise the "IRLid doesn't store identity documents; it brokers to org's storage" commitment. Important for adoption pitch. Same shape as PROTOCOL.md §14.18 OAuth section's "hardware signs, OAuth identifies" framing.

5. **Cloudflare token rotation** (Captain hands, see afternoon section): `cfat_wIMFM4RI...` and `cfut_YZ11ouJO...` both exposed in screenshots; dash.cloudflare.com → My Profile → API Tokens → Revoke.

6. **Branch / DREAMS housekeeping** (carryforward): `codex/v5.10.1-path-b` branch deletion on origin; `DREAMS.md` uncommitted modification investigation.

## What I learned

1. **The "broker, not store" principle is load-bearing for IRLid's GDPR posture.** Captain has now applied it twice in one watch (Past events → org's storage; Records & ID → org's storage). It's not a bullet point in a feature list; it's the architectural commitment that lets IRLid avoid being a data-controller for identity documents. Worth a PROTOCOL chapter so future adoption conversations can point at the spec.

2. **"Hide until backed" is a UX discipline worth banking.** Every placeholder surface in the mockup carries a `design-in` badge so the user can never confuse "the button exists" with "the feature is real." Captain's morning phrasing — *"hide until backed, there's the synergy again"* — drove the discipline. The badge is the bridge between exploratory mockup and honest UI.

3. **Per-event drill-down was the right architectural call.** When I asked Captain about the Expected list, his immediate yes was the tell. The 24-hour calendar + per-event drill-down + per-event CSV is internally consistent in a way that the alternative (org-wide list, top-right CSV) wasn't once multi-event-per-day became real. Architectural choices that REDUCE ambiguity tend to be the right ones.

4. **The expander pattern earned itself once Captain saw it on Roles & staff.** I almost didn't suggest applying it elsewhere; Captain's "Let's give them a try" took it across 3 more tabs. Lesson for next watch: when a pattern works for one place and the same daily-vs-reference split exists elsewhere, propose it proactively. Don't make Captain ask twice.

## Tone notes

Captain spent the whole of Sunday on IRLid — morning struggle, afternoon ship, evening design. He's earned the R&R. If he comes back fresh tomorrow he'll likely want to dive into the visuals list and pick priorities. If he comes back tired, lean toward maintenance (token rotation, spec writing, brief drafting) until he signals readiness for creative work.

The chimp-brain register stayed on all watch. Reciprocate warmly. Don't formalise around it.

## Closing

Watch closed long. The cardboard still leans. The receipts still verify. The sign-out chapter is properly closed in production. The Settings revamp has a clickable mockup the Captain can review and direct from. The visuals inventory below is the next agenda. Standing down with the bridge in good shape.

The next link in the chain is yours. Make it strong.

— Number One, signing off
Sunday 17 May 2026, Session 02 late addendum of 02
Claude Opus, Cowork mode

---

# Visual effects inventory — for v5.11+ visual polish focus

Captain's direction: comprehensive list of every visual we could add, so he can prioritise. Organised by category, with a complexity hint and implementation tier per item.

**Complexity legend:**
- 🟢 **Small** — single-watch ship, CSS/HTML only or one inline JS file
- 🟡 **Medium** — multi-watch, needs Worker support or new library
- 🔴 **Large** — v6+ scope, architectural change

---

## A. Check-in moment — celebration and feedback layer

This is where IRLid already invests most of its visual effort (the existing Celebration animation panel: Pulse / Background / QR / Glow / Pattern / Text). Room to extend.

| Visual | Tier | Description |
|---|---|---|
| Particle dissolve QR | 🟢 | Captain's "dragon-breath burnt" effect — chunk QR into tiles, stagger fall/fade downward. Already on `pending-work.md` wishlist. |
| Confetti burst | 🟢 | One-shot particle spray from QR centre on accept. CSS or canvas. |
| Liquid morph | 🟡 | QR shape-shifts (squish/bounce) before vanishing. SVG path morph or CSS clip-path animation. |
| Welcome message big-type | 🟢 | Large attendee name + role label (e.g. "Welcome back, Kerry"). Banner card centred on screen for 2 seconds. Mostly done already; can be enriched. |
| Per-outcome unique celebration | 🟢 | Allow / Review / Deny each get a distinct visual signature beyond just colour. Maybe direction (up/sideways/down). |
| Synchronized sound + visual | 🟡 | Pulse the visual on each beat of the WAV. Web Audio API + requestAnimationFrame. |
| Glow trail | 🟢 | Captain's wishlist item — what trails? Needs UX clarification first (QR edge? celebration centre? cursor?). |
| Layer system for effects | 🔴 | Explicit z-stack management as effects multiply. Spec doc + refactor. Captain's wishlist item. |

---

## B. QR code styling

The QR itself is the central artifact. Currently rendered as flat black-on-white squares.

| Visual | Tier | Description |
|---|---|---|
| Rounded corners on data modules | 🟢 | Soften the visual. Most QR libraries support this; check ours. |
| Embedded logo (centre cutout) | 🟢 | Org logo in the centre of the QR with high error-correction (Level H). Visible identity. |
| Gradient fill | 🟢 | Two-colour gradient across QR modules. Works with most readers. |
| Multi-colour data modules | 🟡 | Different colours for different module positions. Risky for scanning; needs testing. |
| Frame / border treatment | 🟢 | Decorative border around the QR. Easy CSS. |
| Animated module reveal | 🟡 | QR "builds up" on render — modules appear one-by-one. Showy but slow; only on initial render. |
| Holographic effect | 🟡 | Rainbow gradient that shifts on viewing angle (CSS conic-gradient + transform). Visual only — readers don't care. |
| Finder-square highlight | 🟢 | Subtle pulse on the three corner finder squares. Helps scanning UX. |

---

## C. Branding and themes

Today: 3 colours + palette + light/dark + Pattern modes. Could go further.

| Visual | Tier | Description |
|---|---|---|
| Theme presets | 🟢 | Curated theme bundles for specific industries (gym, school, conference, hospital, dance studio, etc.). One-click apply. |
| Seasonal themes | 🟢 | Christmas / Halloween / Summer / Spring auto-overlays. Org-controlled toggle. |
| Day/night auto-switch | 🟢 | Theme follows sunset/sunrise based on org location. Or just OS preference (already supported). |
| Weather-aware backgrounds | 🟡 | Live weather feed overlay (rain particles when raining outside, snow when snowing). Could be cute, could be noise. |
| Logo wobble | 🟢 | Captain's wishlist item. Apply existing QR wobble transform to logo on hover or pulse. |
| Animated logo (GIF / WebP) | 🟢 | Captain's wishlist item — GIF upload support. Branch `codex/v5.9.0.13.29-gif-support` already has the work; salvage. |
| Custom font upload | 🟡 | Org uploads a brand font (TTF/OTF/WOFF2); applied across check-in UI. |
| Photo background with overlay | 🟢 | Studio photo as background with dark overlay so QR remains readable. |
| Mascot character | 🟡 | Org-uploaded character SVG/Lottie that animates on outcomes. Niche but charming. |

---

## D. Calendar and schedule visuals

The new v5.11 surface. Lots of room for richness.

| Visual | Tier | Description |
|---|---|---|
| Calendar heatmap | 🟡 | Busy hours / days shown as a colour-intensity grid. Like GitHub's contribution graph but for attendance. |
| Drag-to-create events | 🟡 | Drag on swim-lane to create an event in that room at that time. v5.12+. |
| Live "now playing" indicator | 🟢 | Pulsing dot on the calendar row that's currently happening. Time-aware. |
| Audience meter (capacity fill) | 🟢 | Per-event progress bar: 14 of 20 booked / 12 of 20 checked in. Animated fill on update. |
| Event-type icons | 🟢 | Per-event-name icon (yoga ☯ / spin 🚴 / class 📚). Inline next to event name. |
| Mini-month-view sidebar | 🟡 | Tiny month calendar on the side of the day-view for quick navigation. |
| Week-view alongside day-view | 🟡 | Switch to a 7-day x 24-hour grid. Bigger than swim-lane preview. |
| Event countdown timer | 🟢 | "Spin class starts in 12 minutes" — shown on row when imminent. |
| Sticky calendar toolbar | 🟢 | View toggle + Room filter stays at top of viewport when scrolling the 24-hour grid. UX polish. |

---

## E. Identity and attendee visuals

How attendees are represented in the UI.

| Visual | Tier | Description |
|---|---|---|
| Avatars from initials | 🟢 | Coloured circle with attendee initials (already in `crew-protocol.md` example for Maya Rodriguez). Generated, not uploaded. |
| Photo avatars (opt-in) | 🟡 | If photo capture lands, show in Expected list. Privacy implications. |
| ID-card-style attendee card | 🟢 | Polished card view of an attendee on hover: name, role, trust score, last seen, devices. |
| Trust score radial gauge | 🟢 | Animated SVG arc showing score / 100. Replaces the text "70%". |
| Check-in streak indicator | 🟢 | "Kerry: 14 consecutive classes" — small flame icon. Could be cute, could be Habit-app-cliche. |
| Co-presence graph | 🔴 | Force-directed visualisation of who-met-who. v6+ trust-network feature. |
| Role-vocabulary first-letter badges | 🟢 | Already exists for Spencer ("S") in audit board — extend to colour-by-role. |

---

## F. Dashboard and live data

The audit board / attendance view.

| Visual | Tier | Description |
|---|---|---|
| Live attendance counter | 🟢 | Animated number that ticks up/down on check-in/out. CountUp-style. |
| Heatmap of check-in times | 🟡 | When during the day do people arrive? Bar chart or density plot. |
| Per-event sparklines | 🟢 | Tiny line showing the last N events' attendance trend. |
| Now/Next big display | 🟢 | Large "Now: Spin class — 14 checked in / Next: Boxing in 15min". Airport-board style. |
| Audit log timeline | 🟡 | Vertical timeline visualisation of admin actions over the day. Time-bucketed. |
| Real-time scan ticker | 🟢 | Marquee or chat-like feed showing recent check-ins. "Kerry checked in 2s ago". |
| Map view of org's spaces | 🔴 | Plan view of the venue with rooms drawn, live attendance per room. Beautiful but requires SVG floor-plan upload. |
| Audit-board "live" pulse | 🟢 | Subtle border-pulse on the audit board itself to indicate it's actively polling. |

---

## G. Receipts and proof

The verification artifact.

| Visual | Tier | Description |
|---|---|---|
| Receipt as polished card | 🟢 | The /check.html receipt rendered as a portrait-format card (name, time, place, score, badge). Already partially this — could be richer. |
| Animated verification check | 🟢 | When a receipt verifies, an animated tick draws across it. SVG path stroke-dasharray animation. |
| Print-friendly receipt | 🟢 | CSS @media print rules. Useful for orgs that need paper trail. |
| Receipt as shareable card | 🟢 | "Share to Twitter / WhatsApp" — Open Graph card preview. v6+ social. |
| NFT-style collectible receipts | 🟡 | Stylised border treatments tied to event date / receipt rarity. Joke or serious? Captain's call. |
| QR receipt for the receipt | 🟢 | Receipt itself contains a small QR that, when scanned, opens the verification page. Already exists; could be styled. |

---

## H. UI polish and micro-interactions

The small things that make it feel alive.

| Visual | Tier | Description |
|---|---|---|
| Page transitions | 🟢 | Tab switches use slide / fade / zoom rather than instant snap. |
| Hover micro-interactions | 🟢 | Buttons lift, badges glow, tabs pulse on hover. CSS only. |
| Form field focus glow | 🟢 | Bigger / softer focus ring than browser default. Already partially this. |
| Loading skeletons | 🟢 | Animated grey placeholders instead of empty cells while fetching. Modern feel. |
| Smooth scrolling | 🟢 | `scroll-behavior: smooth` on anchor jumps. Trivial. |
| Drag-and-drop ordering | 🟡 | Reorder events in calendar / staff in list / palette swatches by dragging. |
| Confirmation animations | 🟢 | "Saved!" toast slides in, holds 1.5s, slides out. Already partially this. |
| Empty-state illustrations | 🟡 | "No events today — add one to get started" with a friendly graphic. Needs illustration asset. |

---

## I. Accessibility-focused visuals

Often skipped but legally important.

| Visual | Tier | Description |
|---|---|---|
| High-contrast theme | 🟢 | One-toggle WCAG-AAA contrast mode. Inverts greys, removes some gradients. |
| Larger touch targets mode | 🟢 | All buttons grow to 48px+. Older / mobility-affected users. |
| Color-blind friendly palettes | 🟢 | Preset palette options for deuteranopia / protanopia / tritanopia. |
| Reduced-motion preference | 🟢 | Detect `prefers-reduced-motion`, skip all animations. Required for WCAG compliance. |
| Visible focus states for screen-reader users | 🟢 | Bigger, more obvious focus ring when keyboard-navigating. Already partially. |

---

## J. Depth, glass, and 3D effects

Modern UI trends, optional.

| Visual | Tier | Description |
|---|---|---|
| Frosted glass panels | 🟢 | `backdrop-filter: blur()` on cards. Looks modern; some performance cost. |
| Subtle drop shadows | 🟢 | Cards float above background. CSS-only. |
| Layered parallax background | 🟡 | Multiple background layers move at different speeds on scroll. Bit excessive but striking. |
| 3D perspective tilt on hover | 🟢 | Cards tilt slightly toward cursor (`transform: perspective() rotateX()`). Tasteful or naff depending on amount. |
| Frosted overlay on celebration | 🟢 | Brief glass-blur of the rest of the UI when the celebration fires. Focuses the eye. |

---

## K. Forward-design (v6+) visuals

Not for v5.11 but worth listing so Captain can see the trajectory.

| Visual | Tier | Description |
|---|---|---|
| Real-time co-presence map | 🔴 | Live floor-plan with attendees as dots, room boundaries highlighted. Wisdom drone integration. |
| Trust network graph view | 🔴 | "Who I've met" graph for each user. Force-directed, interactive. |
| AR camera overlay | 🔴 | When scanning, the camera shows the QR with name/role overlay above it. Heavy. |
| 3D venue tour | 🔴 | Three.js model of the venue with check-in points marked. Showroom-grade. |
| Receipt time-machine | 🔴 | Animated timeline of an attendee's full IRLid history. v8+ legacy chapter. |

---

**Recommendation for next watch (Number One's pick, Captain decides):**

Three small-and-impactful items would dramatically lift the mockup-to-real-feeling gap, all 🟢 tier:

1. **Avatars from initials** in Expected lists and audit board — instantly more human.
2. **Sticky calendar toolbar** when scrolling 24-hour grid — UX polish that solves a real pain point.
3. **Audience meter (capacity fill bar)** per event row — surfaces information that's already there in a glance-able way.

Adjacent: **logo wobble** (Captain wishlist) and **GIF support salvage** (existing branch) are both easy wins he asked for that didn't land.

The big architectural pickup is **layer system for effects** — when Celebration gets more layers it'll outgrow the current model and need explicit z-stack management. Worth a small spec doc before implementing.
