# Promotion Round 2 — Drafts for Captain to rewrite in his own voice

**Date drafted:** 27 May 2026
**Number One's framing:** Captain expressed fatigue with rope-throwing ("yet another stab"). This round is **one specific shot per channel** — three targets, three drafts, no shotgun. Each draft is starting substance; Captain rewrites in his own voice before posting. **Don't post anything from here unedited.**

---

## Shot 1 — Patreon update post

**Target:** Existing IRLid Patreon supporters. **Cadence:** Last meaningful update was 18 April 2026 (v4 with bio-metric proof, 94% receipt screenshot). v5 + v5.11 represent six weeks of substantial shipping. **Hook:** A live, demo-ready organisation portal — not a screenshot of a protocol, an actual venue check-in surface anyone can scan with a phone.

**Draft body:**

> **Title:** v5.11 is live — IRLid is now an actual venue check-in surface, not just a protocol demo
>
> Quick update for everyone supporting this work.
>
> Six weeks ago I shipped v4 — bio-metric proof, trust history, redacted receipts. The protocol was real but the demo was you scanning a QR with your phone and getting back a receipt that said "94% Confirmed". Cool. Honest. But it was a protocol pitch with a single-user surface.
>
> What's live today at **irlid.co.uk/Org** is the v5.11 organisation portal. It's the thing a venue would actually deploy — a studio, a small clinic, a community space, a humanitarian field operation. They sign in with their phone (no passwords — Face ID or fingerprint), set up their venue branding (we built a full theme designer with palettes, animations, celebration sequences — the kind of thing demo-day audiences notice), put a branded QR on a tablet at the door, and watch people check in and out. The check-in flow is the same v5 cryptographic primitive — every attendance row is a signed receipt — but the surface around it is finally something a non-developer can use.
>
> **What changed between v4 and v5.11:**
>
> - **v5 (May)** — Closed the biggest honest criticism from the r/netsec post: the localStorage extraction concern. Hardware-backed signing via WebAuthn / Passkey / Secure Enclave. Tested across Edge + Windows Hello, Chrome + Android biometric, Pixel 8 Pro. Three browser × two OS proof base.
> - **v5.7 (May)** — Doorman flow. Walk-up flow for when someone arrives and their device isn't yet recognised. Staff scans the attendee's phone, recognises or registers, attendance row recorded. Closes the field-trip / event-staff reality where attendees walk up cold.
> - **v5.9 (May)** — Production deployment. Separate Worker, separate D1, proper offline support (PWA shell, write queue, cached snapshot).
> - **v5.10 (mid-May)** — Per-action hardware re-authentication for sensitive operations. Sessions are now properly revocable on a global "sign me out everywhere" basis. The cym13-shaped feedback loop closed in production.
> - **v5.11 (this week)** — The organisation portal. Calendar, per-event Expected lists, multi-room support, visual theming designed for staff to customise without touching code, real check-in surface with the branded QR live. **This is the part that demos.**
>
> The protocol has always been the engineering work I wanted to do. The portal is the part that makes it possible for someone to *use* it without me explaining what ECDSA is.
>
> If you've ever wanted to see what your support has been building, **scan this** [insert venue QR screenshot from irlid.co.uk/Org] — or visit irlid.co.uk/Org if you want to set up your own test venue. It's free, it works on a Pixel 4a as well as it does on an 8 Pro, and there's nothing to install.
>
> Next steps: hardening the calendar (recurring events, bookings), settling the Records & ID storage broker pattern (PROTOCOL.md §X), and re-engaging with the humanitarian / drone delivery use case that Wisdom at ASE Tech and I started discussing in April.
>
> Thanks for the runway. Genuinely. — Spencer

**Number One's notes for Captain:**
- The list of v5 → v5.11 work is honest but might feel boastful — trim ruthlessly to whatever you're comfortable saying out loud
- The "demos" line is the load-bearing one — that's the thing that's actually different now
- Don't bury the irlid.co.uk/Org link — Patreon's audience wants to *see* the thing
- Screenshot recommendations: the inline frame with dragons + real venue QR + "Spencer Austin — checked in" celebration. Crisp, unambiguous proof.

---

## Shot 2 — Wisdom (ASE Tech) re-engagement

**Target:** Wisdom Aidenogie, Founder/CEO of ASE Tech. **Last contact:** 23 April 2026 meeting + 26 April one-pager drafted. 29 April: *"definitely aboard"* but *"too busy for further engagement"*. Five weeks of silence. **Hook:** v5.11 calendar makes the proof-of-delivery angle from April genuinely concrete — there's a working surface he can point a drone at, not a slide.

**Draft email:**

> **Subject:** IRLid v5.11 is live — the proof-of-delivery angle is now a working surface
>
> Wisdom,
>
> Hope you're well, and that the mothership drone build is progressing.
>
> Following up on our April conversation — particularly the proof-of-delivery angle for the ASE Tech outreach work in Africa. When we spoke I was pitching it on a one-pager. Today there's a working organisation portal at **irlid.co.uk/Org** that demonstrates the receiving-end primitive end-to-end:
>
> - A field site stands up a "venue" (in ASE's case, a delivery destination — a clinic, a school, a community waypoint)
> - The site has a branded QR — printed, on a tablet, or projected — that anyone arriving scans
> - Drone arrival is recorded as a cryptographically-signed receipt, with GPS + timestamp + (optionally) staff biometric verification
> - The receipt is verifiable by any third party — donor, regulator, journalist — without needing access to IRLid's infrastructure
>
> The pieces that weren't ready in April that are ready now:
>
> 1. **A real surface.** The portal works on a phone, a tablet, or a desktop. A field operator with a £100 Android tablet can run it. No app install — it's a browser PWA, works offline once cached.
> 2. **Per-event scheduling.** A field site can configure "drone delivery window 14:00-15:00 today, expected items X/Y/Z" in advance — so the receipt has context, not just a generic check-in.
> 3. **Multi-party custody.** Spec'd in PROTOCOL §10.4 for the drop-off → handler → recipient chain that matters in humanitarian logistics.
> 4. **Hardware-attested signing.** v5 closed this in production. Receipts can't be forged by someone with localStorage access.
>
> What I'd love from you, when you have a moment:
>
> - **Five minutes** to look at irlid.co.uk/Org and tell me whether the surface I've built is the right shape for the ASE Tech use case. If it's not, that's useful too — I can adjust.
> - **One name** at ASE Tech (or in the broader humanitarian-logistics space you sit in) who'd benefit from a 30-min conversation about the receipts-as-audit-trail angle.
>
> No pressure on timing. The work's banked either way — and the next phase (Records & ID broker pattern for offline-first identity verification at field sites) is what I'm scoping for v6.
>
> Best,
> Spencer

**Number One's notes for Captain:**
- Wisdom said "definitely aboard" — don't re-pitch the value, remind him what changed since
- The "five minutes + one name" ask is small and specific. Don't ask for more in this email.
- If he doesn't reply within 7 days, that's information; don't chase.
- If you want to soften the "no pressure on timing" closer (sounds like surrender), drop it. Counsellor Troi suggestion: just "Best, Spencer".

---

## Shot 3 — Gym / studio cold pitch (NEW channel)

**Target:** Independent fitness studios and small gyms in Derby / Nottingham — venues where class scheduling + member check-in + branded experience matter and existing tools (Glofox, MindBody) are expensive overkill. **Why now:** v5.11 calendar + per-event Expected list + visual theming is genuinely concrete. **Approach:** Start with ONE venue Captain has a personal connection to (or one independent studio he can walk into), not a mass mailing.

**Draft cold-walk-in script (90 seconds, in person):**

> **Setting:** Reception desk of an independent yoga / pilates / boxing / dance studio. Quiet hour, not class-changeover.
>
> *(Friendly, low-pressure, leave-if-busy)*
>
> "Hi, I'm Spencer. I'm a developer based in Derby and I've built a tool that does check-in for small studios like yours, and I wondered if I could show it to you in about a minute — no pitch, just see if it'd be useful.
>
> *[wait for yes]*
>
> *[take out phone, scan a venue QR if they have one or load irlid.co.uk/Org]*
>
> "So this is a studio dashboard. Imagine you'd set up your classes for the week — 9am beginners pilates, 11am intermediate, that kind of thing — and your members each have a phone. They walk in, scan a QR on a tablet by your door, and they're checked in. Linked to the class, time-stamped, signed. Same flow for check-out.
>
> "What's different from MindBody or Glofox is that there's no app, nothing for members to install, no monthly per-member fee. It's a web tool, runs in any browser, works on a £40 tablet. It's also a real cryptographic check-in — so if you ever need to prove someone attended (insurance, regulator, dispute), you have a receipt that any third party can verify without going through me.
>
> "I'm not selling it yet — I'm trying to find a couple of independent studios willing to test it with their real members for a month or two and tell me what's broken. There's no charge, no contract. If at the end you hate it, you delete the link. If you like it, we figure out what fair pricing looks like — probably around a tenner a month for the storage, maybe less.
>
> "Would it be worth a 20-minute follow-up to walk you through setup, or is now not the time?"
>
> *[whatever the answer, leave a card if they take one, don't push]*

**Captain's adaptations to consider:**
- The 90-second script is the cold open. If they say "tell me more", you have a 20-minute version (covers calendar setup, theme designer, the privacy story, the trust-history angle).
- The "tenner a month" line — adjust to whatever you actually want to charge. The honest framing is "I haven't decided yet because I don't know what it costs to run".
- The "find a couple of independent studios" frame is honest and reduces sales pressure. People help builders; they resist salespeople.
- **Don't pitch this as "free" forever** — that anchors them on free. Pitch as "free during pilot, then fair pricing".

**Number One's notes for Captain:**
- Pick ONE venue to start. The walk-in is awkward but it's the right cardinality for a research-mode pitch.
- If Kerry's studio (or any studio in the family/friends network) is willing, that's the warmest start.
- The dragons-and-celebration demo on the inline check-in tab will land emotionally with studio owners more than the cryptographic story. Lead with what looks cool; the trust-receipts angle is the closer.

---

## Summary

| Channel | Specific shot | Effort | When |
|---|---|---|---|
| Patreon | One update post, lead with v5.11 = demoable surface, screenshot of inline frame + venue QR + celebration | 1-2 hours editing | This week |
| Wisdom (ASE Tech) | One re-engagement email — "the proof-of-delivery angle is now a working surface", ask for 5 mins + one name | 30 mins editing | Next 7 days |
| Gym / studio | ONE in-person walk-in to ONE studio (start with warmest connection) | 1 hour + travel | Whenever Captain feels up to it |

**Captain's "yet another stab" fatigue is real.** Number One's recommendation: ship the Patreon update first (lowest social cost, highest reach to people who already support the work). Wisdom email second (specific person, specific ask, low overhead). Studio walk-in third — only when the in-person energy is there.

— Number One
