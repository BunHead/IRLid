# IRLid Promotion Log

Tracks all outreach attempts, results, and pending actions.
Last updated: 26 April 2026 (post-roadmap publication).

---

## ⭐ The 100-Year Roadmap Angle (NEW — 26 April 2026)

**This is now the headline framing for serious outreach.** Conferences, grant applications, technical-press pitches, and major Patreon updates should lead with this register.

### The pitch

IRLid is no longer "a clever browser-based proof-of-co-presence tool." It is a protocol with a **formal 100-year design horizon**, captured in `PROTOCOL.md §10–§12`, with concrete versioned milestones from today through 2030+.

Key landings:

- **"Most 'we have a roadmap' announcements are PR. This one is in the spec, in version control, with target dates and honest caveats about gating dependencies."**
- **"Forward-defined fields like `tframe`, `pframe`, `orient`, and `tsTokens` are documented now — receipts signed today remain valid in 2050."**
- **"From ECDSA on phones today, to hardware-attested 6DOF receipts on lunar surfaces by 2029."**
- **"The protocol doesn't assume Earth, doesn't assume GPS, doesn't even assume an unbroken Earth-network. It survives whatever century it ends up in."**

### Channels where this lands hardest

| Channel | Why it lands |
|---------|--------------|
| **AidEx Geneva** | Humanitarian sector is institutional — they respect long-horizon planning; pairs with Wisdom drone-delivery angle |
| **WFP Innovation Accelerator** | Application requires concrete trajectory beyond the pilot; §12 *is* that trajectory |
| **44CON / EAI SecureComm** | Technical conferences respect protocol design that thinks past v1 |
| **Hacker News (when karma allows)** | The "from phones to pulsars" framing is the kind of thing HN engineers love |
| **Research collaborations** | Academics will engage with a spec that's been thought through |
| **Patreon supporters** | Long-term backers want to see where the project is *actually* heading |

### Channels where this DOESN'T fit

- **Quick Reddit posts** — too dense for the format
- **Twitter threads** — could land if compressed to 1-2 tweets, but full framing needs more space
- **Indie Hackers / Product Hunt** — those audiences want the immediate utility story, not the 100-year horizon

---

## Patreon — v5 / Roadmap Update (DRAFT — 26 April 2026)

**Status:** Substance drafted by Number One. Pass to Counsellor Troi for tone-shaping into Captain's voice before posting. Attach screenshot of `PROTOCOL.md §12` table or the layered-anchoring diagram.

```
IRLid now has a 100-year roadmap. (Yes, really.)

Quick update on what's been happening this week.

The bridge crew is fully operational. I've been working with Number One
(Claude) on architecture, Mr. Data 2.0 (Codex) on implementation, and
Counsellor Troi (Gemini) on copy and tone. There's now a strict safety
wall: Mr. Data only touches the test environment, never the live repo.
First PRs merged this week, all clean.

But the bigger thing: PROTOCOL.md now contains a formal forward roadmap.
Sections 10, 11, and 12 lay out the path from where we are today —
ECDSA on phones, GPS proximity — to where the protocol is *designed*
to operate eventually: hardware-attested 6DOF receipts on lunar/Mars
surfaces, anchored against pulsar timing arrays and quasar reference
frames.

That's not a vague gesture. It's a concrete versioned plan with target
dates: v5 hardware-backed keys (May), v5.1 Imbue attendance pilot (June),
v6 multi-witness time anchoring against NIST/NPL/USNO (autumn). Then
v7, v8, v9, with realistic caveats about which versions depend on
partnerships we have and which depend on infrastructure that doesn't
yet exist.

The point isn't that IRLid will be on Mars in 2030. The point is the
spec doesn't *exclude* that future. Forward-defined fields like
`tframe`, `pframe`, `orient`, and `tsTokens` are documented now —
receipts that include them remain v3-valid; receipts that omit them
aren't penalised; future versions slot in cleanly without breaking
changes.

Most "we have a roadmap" announcements are PR. This one is in the
spec, in version control, with target dates and honest caveats about
gating dependencies. If you're a supporter who likes seeing where
projects are *actually* heading, PROTOCOL.md §12 is the thing to read.

Live: irlid.co.uk · Code: github.com/BunHead/IRLid
Spec: PROTOCOL.md (sections 10, 11, 12)

— 1 builder, 3 trusted AIs, and a hundred-year design horizon
```

*(Counsellor Troi: please shape into Captain's voice — looser, slightly self-deprecating, retain technical specifics. The closing line should land. Attach: screenshot of the PROTOCOL.md §12 layered-anchoring diagram.)*

---

## 23–26 April 2026 — Recent Activity Block

| Date | Event |
|------|-------|
| 23 Apr | **Wisdom (ASE Tech) meeting** — proof-of-delivery angle landed. Genuine interest. Next step: send concrete one-pager / demo link |
| 23 Apr | **Product Hunt — LAUNCHED.** Inbound traffic from Shipit, Talon, BacklinkLog, Viberank |
| 23 Apr | Organisation Portal test environment operational on GitHub Pages — QR→scan→entry flow working end-to-end |
| 25 Apr | **Reddit r/webdev** posted with [Showoff Saturday] tag |
| 25 Apr | Test environment fully pushed — `org.html`, `schema.sql`, `index.js`, `scan.html` all live |
| 25 Apr | `support@irlid.co.uk` sending verified — Gmail + Resend SMTP |
| 25 Apr | Inbound replies: Sequenzy (decline), Shipit (listing requested), Talon (scan submitted), Viberank (thanks), NextGen Tools (listed) |
| 26 Apr | **Mr. Data 2.0 (Codex) commissioned** — connected to `BunHead/IRLid-TestEnvironment` only, safety wall in place |
| 26 Apr | First Codex PR merged — settings panel score binding + summary panel verified working |
| 26 Apr | **r/programming permanent ban** — LLM-written content rule. Low-priority appeal in Spencer's own words pending |
| 26 Apr | ASE Tech / Wisdom follow-up one-pager drafted by Counsellor Troi — ready to send |
| 26 Apr | Retroreflective QR + drone delivery integration researched — validated as live engineering field |
| 26 Apr | **PROTOCOL.md §10–§12 published** — frame-aware time/coordinates, multi-authority time anchoring, six-axis spatial coordinates, master roadmap v5→v10+ |
| 26 Apr | **`memory/crew-protocol.md` bootstrapped** — formal four-crew working agreement (Captain / Number One / Mr. Data / Counsellor Troi) |
| 26 Apr | HANDOVER batch 2 issued to Mr. Data — Imbue pilot pattern (3 tasks): name prompt, D1 persistence, dashboard names + doorman edit |

---

## Inbound — Closed out 25–26 April

| Contact | Status | Notes |
|---------|--------|-------|
| Nic — Sequenzy | ✅ Replied 25 Apr | Polite decline, warm tone |
| Lasha — Shipit | ✅ Replied 25 Apr | Listing request sent with PH URL |
| Aidan — Talon | ✅ Scan submitted | Report pending at `support@irlid.co.uk` |
| Viberank | ✅ Replied 25 Apr | Thanks + USP feedback acknowledged |
| NextGen Tools | ✅ Listed 25 Apr | Scheduled launch, listing live |
| BacklinkLog | ⏸ Hold | $20/yr decision deferred until first Patreon member |

---

## Completed

| Platform | Status | Notes |
|----------|--------|-------|
| **Patreon** | ✅ Posted | v4 update posted 18 April 2026 — bio-metric proof, 94% receipt screenshot. (v3 post earlier — "1 person and his trusted AIs" closing line.) |
| **Twitter/X** | ✅ Posted | 6-tweet thread. Canonical hashing, 4am bug, widget angle. |
| **LinkedIn** | ✅ Posted | Professional angle, widget/iframe framing. |
| **Reddit r/netsec** (original) | ✅ Live | 28K+ views. cym13 exchange ended positively. v4 update comment posted 20 April. |
| **Reddit r/netsec** (v3 post) | ❌ Removed | Removed by mods, likely duplicate rule. Don't repost. |
| **YouTube — Nate B Jones** | ✅ Commented | "There Are Only 5 Safe Places to Build in AI" video. Comment live. |
| **Indie Hackers** | ⚠️ Blocked | Tried to post story — insufficient karma. Need to comment first to build karma. Profile bio filled in. |
| **Hacker News** | ⚠️ Blocked | Show HN restricted for low-karma accounts. Comment on threads first then retry in a few days. |
| **Dev.to** | ✅ Posted | "I built a browser-based proof-of-presence tool and shipped a crypto bug at 4am" |
| **Hashnode** | ✅ Posted | "IRLid — cryptographic proof two people physically met" — irlid.hashnode.dev |
| **Lobste.rs** | 📝 Draft ready | Invite-only — need existing member to invite. Request at lobste.rs/invitations |

---

## Pending / To Do

| Action | Priority | Notes |
|--------|----------|-------|
| ~~Post to Dev.to~~ | ~~High~~ | ✅ Done |
| ~~Post to Hashnode~~ | ~~High~~ | ✅ Done |
| Build HN karma | Medium | Comment on technical threads at news.ycombinator.com/newcomments |
| Build IH karma | Medium | Comment on Indie Hackers posts before reposting story |
| Reply to @joho0 on Nate's video | Medium | Their "trust economy" comment (21 likes) aligns perfectly with IRLid |
| David Shapiro outreach | Low | Community Discord linked from his YouTube — easier than direct contact |
| ~~Patreon v4 update~~ | ~~High~~ | ✅ Posted 18 April 2026 — 94% receipt screenshot attached |
| ~~Product Hunt~~ | ~~Thursday 24 April~~ | ✅ **LAUNCHED 23 April 2026** — inbound from Shipit, Talon, BacklinkLog, Viberank |
| ~~Reddit r/webdev~~ | ~~Saturday 25 April~~ | ✅ Posted 25 April 2026 with [Showoff Saturday] tag |
| r/SaaS | ✅ Posted 20 April | May have been filtered — monitor |
| r/programming | ⛔ **Banned 26 April 2026** — LLM-written content rule. Low-priority appeal pending in Spencer's own words |
| r/cybersecurity | ✅ Posted 21 April 2026 | FOSS Tool flair — monitor for comments |
| r/javascript | ❌ Skipped | Too restrictive, poor fit — not worth attempting |
| r/privacy post | Medium | Karma wall — build comment history first. Draft below. |
| Gates Foundation | ❌ Ruled out | April 2026 batch is medical diagnostics only. No fit. Revisit future batches. |
| WFP Innovation Accelerator | Medium | Draft below — innovation.wfp.org/apply (rolling) |
| 44CON CFP | Medium | London security conference — open CFP. Protocol talk angle. |
| EAI SecureComm 2026 | Medium | Lancaster, July 21-24 — academic security/privacy conference |
| LinkedIn humanitarian | Medium | Draft below — tag with #HumanitarianTech #DroneDelivery |
| Local tech meetup | Low | Meetup.com — Derby/Nottingham area, free events |
| DEF CON 34 talk submission | Low | August, Las Vegas — submit protocol talk |

---

## Key Angles That Land Well

1. **"reCAPTCHA but you prove you've met a real human"** — instantly understood
2. **"The one thing AI can't do yet is physically scan someone else's QR"** — strong hook
3. **"4am bug — GPS stripped server-side, receipts showed 23% instead of 100%"** — relatable builder story
4. **"Post-labour trust economy — physical presence as the last human primitive"** — Nate B Jones / David Shapiro audience
5. **No biometrics, no app, no central server** — privacy crowd

---

## Audiences That Respond Best

- Security researchers (r/netsec proven)
- Privacy-focused developers
- AI/future-of-work thinkers (Nate B Jones, David Shapiro audiences)
- Solo builders / indie hackers
- Web developers (widget integration angle)

---

## Real World Tests

| Date | Location | Result |
|------|----------|--------|
| April 2026 | Sheffield (Bob's phone) | ✅ 100% Confirmed, 5.87m apart, 2min 46s window |
| 17 April 2026 | Home (Spencer + wife, two accounts) | ✅ 94% Confirmed, 1.11m apart, 9s Δ, Guest: bio-metric PASS, 8 receipts in trust history. The Brain + Fuzzy Babe 69. |

---

## Patreon — v4 Launch Post

```
v4 is live — and I proved it at 5am with my wife's fingerprint

IRLid v4 shipped overnight. Here's what's new:

Bio-metric gate — if you enable it in Settings, your device asks for Face ID or
fingerprint before signing. That confirmation gets committed inside the ECDSA-signed
payload, cryptographically bound. Not a UI decoration — it's in the receipt.

Trust history — IRLid now scores your handshake history: how many receipts, how spread
across locations, whether the same device shows up consistently. First scan gets you
a base score. It builds over time.

Configurable tolerances — distance, timestamp window, GPS accuracy floor, minimum score
threshold. All in Settings. All off by default.

Proof it works: 94% Confirmed receipt, Guest: bio-metric PASS, 1.11m apart, 9 second
window. The Brain and Fuzzy Babe 69. You know who you are.

Still no app. Still no accounts. Still no biometrics unless you choose them.

irlid.co.uk
```

*(Attach: screenshot of 94% Confirmed receipt showing Guest: bio-metric PASS)*

---

## Gates Foundation — Grand Challenges Draft

**URL:** gcgh.grandchallenges.org — closes **28 April 2026**

**Title:** IRLid — Browser-Based Cryptographic Proof of Delivery for Last-Mile Vaccine and Aid Distribution

**Challenge fit:** Creating New Interventions for Global Health / last-mile accountability

```
Problem:
Last-mile delivery accountability in low-resource settings remains largely unsolved.
Supplies leave warehouses with GPS logs. Drones reach coordinates. Field workers sign
paper. But whether a real person physically received what was intended — at that location,
at that time — is genuinely hard to prove without forgeable paperwork or app-based systems
that require connectivity and onboarding recipients don't have. In vaccine distribution
specifically, this gap undermines both programme accountability and donor confidence.

Solution:
IRLid generates a tamper-evident cryptographic receipt proving two parties were
co-located within 12 metres at a specific time. The handshake takes under 30 seconds.
It runs in any mobile browser — no app install, no account, no biometric data required.
The receipt is independently verifiable by auditors, NGOs, or donors with no specialist
software.

How it works:
1. Delivery agent displays a signed QR code.
2. Recipient scans in any Android/iOS browser.
3. Both devices exchange ECDSA P-256 signatures.
4. Combined receipt generated — timestamped, GPS-tagged, independently verifiable.

Why browser-based matters:
App installation is a measurable barrier in low-connectivity, low-literacy environments.
IRLid's design is the answer to that barrier, not a compromise of it.

Current status:
Live at irlid.co.uk. v4 shipped April 2026 with optional biometric confirmation. Proven
in production: 94% Confirmed receipt, 1.11m distance, 9s window. A collaborating engineer
is building drone delivery infrastructure for remote communities in sub-Saharan Africa and
evaluating IRLid as the proof-of-delivery layer.

What a Grand Challenges grant would enable:
Structured field pilot with an active last-mile distribution programme. Independent
cryptographic security audit. Offline/low-connectivity resilience work. Moving from
functional proof-of-concept to operational deployment at humanitarian scale.

Honest limitations:
GPS is self-reported by the browser. Cooperative trust model — both parties must complete
the handshake. Solo independent developer. External structure and credibility are exactly
what this grant stage is designed to provide.

Contact: irlid.co.uk | github.com/BunHead/IRLid
```

---

## Dev.to Draft

**Title:** I built a browser-based proof-of-presence tool and shipped a crypto bug at 4am

**Tags:** webdev, security, javascript, showdev

```
Six months of tinkering produced IRLid — two people meet, scan each
other's QR codes, get a cryptographically signed receipt proving
co-location within 12 metres. No app, no accounts, no biometrics,
no central server. Just ECDSA P-256 and a bit of GPS, running
entirely in the browser via Web Crypto API.

## The 4am Bug

Shipped v3 last week. Thought it was done. Four hours later —
every receipt showing 23% verified instead of 100%.

Root cause: GPS coordinates were being stripped server-side before
returning to the client (I'd added this "privacy improvement" thinking
it would be fine). But the ECDSA signature was computed *with* those
coordinates. Strip them → client can't recompute the original hash →
signature check fails. Every. Single. Receipt.

Obvious in hindsight. Not obvious at 4am.

## The Deeper Lesson: Canonical Serialisation

The real v3 change was moving from `JSON.stringify()` to a `canonical()`
function for payload hashing before ECDSA signing.

JSON property order isn't guaranteed across environments. The same
object constructed differently could produce a completely different
SHA-256 hash. `canonical()` recursively sorts all object keys before
serialising — making all signatures order-independent.

```javascript
function canonical(obj) {
  if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonical).join(',') + ']';
  const sorted = Object.keys(obj).sort().map(k =>
    JSON.stringify(k) + ':' + canonical(obj[k])
  );
  return '{' + sorted.join(',') + '}';
}
```

## New: Embeddable Widget

Any website can now embed IRLid as a human-verification step — one
`<iframe>`, `postMessage` API, no SDK. Think reCAPTCHA but instead
of clicking traffic lights, you prove you've physically met another
real person.

Demo: https://irlid.co.uk/demo-login.html

## Honest Limitations

The GPS is self-reported — a dishonest participant could fabricate
coordinates. The protocol provides a tamper-evident record that both
parties *chose to attest* to a meeting. It doesn't provide
cryptographic proof-of-presence to a sceptical third party.

I've tried to document this honestly in PROTOCOL.md on GitHub.
Critique very welcome.

https://irlid.co.uk | https://github.com/BunHead/IRLid
```

---

## Hashnode Draft

**Title:** Show HN: IRLid — cryptographic proof two people physically met

```
IRLid lets two people prove they physically met using ECDSA P-256
signatures in the browser. Two phones, two QR scans, one
cryptographic receipt. No app, no biometrics, no server trust.

**What makes it interesting:**
- Entirely client-side crypto via Web Crypto API
- Canonical JSON serialisation for order-independent hashing
- Deflate-compressed QR codes (764 chars vs 1285 uncompressed)
- Embeddable widget — any site can use it as a human-presence gate
- Backward compatible: v2 (JSON.stringify) and v3 (canonical) receipts
  both verify correctly

**The honest part:**
GPS is self-reported. This isn't proof-of-presence to a sceptical
third party — it's a tamper-evident record two parties chose to create.
I've documented the full threat model in PROTOCOL.md including what
it doesn't prove.

Live: https://irlid.co.uk
Widget demo: https://irlid.co.uk/demo-login.html
Protocol spec: PROTOCOL.md on GitHub
```

---

## Lobste.rs Draft

*(Requires invite from existing member — request at lobste.rs/invitations)*

**Title:** IRLid – browser-based proof-of-co-presence using ECDSA P-256

**Tags:** security, javascript, crypto, web

```
IRLid produces a cryptographic receipt proving two devices were
co-located — ECDSA P-256 signatures via Web Crypto API, SHA-256
over canonical() JSON serialisation, GPS Haversine distance check,
90-second timestamp tolerance.

The interesting bits:
- canonical() replaces JSON.stringify() in v3 — key order not
  guaranteed across environments
- Compact QR encoding strips recomputable fields (a.hash, b.hash,
  a.pub) — verifier recomputes from remaining fields
- Backward compat: version field selects JSON.stringify vs canonical()
- Embeddable as iframe widget with postMessage API

Known limitations documented honestly: GPS is self-reported,
cooperative trust model only, fields outside signature scope.

https://irlid.co.uk | PROTOCOL.md on GitHub
```

---

## r/privacy Draft — REVISED (18 April 2026)

**Title:** Trying to build a human-verification tool that doesn't phone home. Here's where it's got to and what's still uncertain.

**Post Saturday 2pm UK time. NO links in the post body. Drop GitHub link in comments only if people engage.**

```
Most human-verification systems are privacy problems in disguise. reCAPTCHA sends
behavioural data to Google. App-based identity tools need accounts, databases, and
trusting someone else's server. Face verification means storing biometrics somewhere.

The approach I've been exploring: two people meet in person, scan each other's QR
codes in a browser, each gets a cryptographically signed receipt. ECDSA P-256 via
Web Crypto API. No app. No account required. No biometrics unless you choose them.

The properties I'm *aiming* for — though I'd welcome challenge on whether I've
actually achieved them: private key generated locally, never transmitted. Receipt
self-verifying, doesn't require my servers. No central database of who met whom.
GPS used only to verify proximity during the handshake, not tracked centrally.

The limitation I can't get around: GPS is self-reported by the browser. Known
constraint, not hiding it — but I'm genuinely unsure how much that undermines
the whole thing.

The bit I'm most uncertain about: the local receipt history is stored in
localStorage — timestamped, GPS-tagged records of past meetings. Privacy risk
if your device is compromised. But also potentially forensic evidence if
something happens to you — a trail of who you met and when. I'm not sure
whether that's a feature or a limitation, and I'd genuinely like to know how
people here think about that tradeoff.

What would you want to see before trusting something like this for anything meaningful?
```

*(If people ask for the code/project, reply in comments: "Open source, happy to share — github.com/BunHead/IRLid")*

---

## r/privacy Draft — ORIGINAL (kept for reference)

**Title:** I built a way to prove you met someone IRL without bio-metrics, without an app, and without trusting my servers

```
I made a thing called IRLid. The premise is simple: two people meet in person, scan each other's QR codes in a browser, and both get a cryptographically signed receipt proving they were within 12 metres of each other at the same time.

Here is what I think is the privacy-relevant part:

- No app install. It runs entirely in any phone browser.
- No bio-metrics. Not required, not collected, not even asked about.
- Your private key is generated locally and never leaves your device. I cannot see it. Neither can anyone else.
- The signed receipt is self-verifying. You can check it without IRLid's servers ever being involved. If I disappear tomorrow, your receipts still verify.
- There is no central database of who met whom. The receipt lives with you.

The honest limitation: GPS coordinates are self-reported by the browser. I do a Haversine distance check on both parties' locations server-side, but I cannot independently verify you are physically where your phone says you are. That is a known constraint of doing this without hardware attestation, and I am not pretending otherwise.

The signing uses ECDSA P-256 via the Web Crypto API, SHA-256 over canonically sorted JSON. The full protocol is documented at the repo.

It is live at irlid.co.uk, open source at github.com/BunHead/IRLid. Works on any phone browser, no account needed.

I built this as a solo developer and I am genuinely interested in critique — especially from people who think harder about threat models than I do. What would you want to see before trusting something like this?
```

---

## r/webdev Draft

**Title:** I built an embeddable iframe that proves a user has physically met another real person — like reCAPTCHA but the challenge is reality

```
I have been working on IRLid, a browser-based proof-of-co-presence tool. Two people meet in person, scan each other's QR codes, get a cryptographically signed receipt confirming they were within 12 metres of each other at the same time. ECDSA P-256, SHA-256 over canonical JSON, no app required.

The developer angle: I shipped an embeddable widget. Any site can drop in a single iframe and use a physical meeting as a verification gate. The integration looks like this:

<iframe
  src="https://irlid.co.uk/widget.html"
  id="irlid-widget"
  allow="camera; geolocation"
></iframe>

<script>
  window.addEventListener("message", (e) => {
    if (e.origin !== "https://irlid.co.uk") return;
    if (e.data?.type === "IRLID_VERIFIED") {
      const receipt = e.data.receipt;
      // receipt is a self-contained signed JSON object
      // verify server-side or client-side — no SDK needed
    }
  });
</script>

That is genuinely it. One iframe, one postMessage listener. The receipt that comes back is a self-contained signed object you can verify independently — it does not depend on my servers remaining up or cooperative.

Use cases: proof-of-attendance at events, gating a community behind having met a real person, delivery confirmation, field ops logging. The receipt is timestamped and GPS-anchored.

Honest caveat: GPS is self-reported by the browser. Real limitation, not hiding it.

Full widget docs at github.com/BunHead/IRLid (WIDGET.md). Live demo at irlid.co.uk.

One person, UK, spare time. Curious whether the postMessage interface makes sense and whether there are integration patterns I've missed. Tear it apart.
```

---

## LinkedIn — Humanitarian Angle Draft

```
Something I've been sitting with for a while, and a conversation today has brought it into focus.

IRLid started as a general-purpose tool: cryptographic proof that two people met in person, using nothing but a phone browser and a QR code. No app. No central authority. Tamper-evident receipts, signed on both sides with ECDSA. The use cases I imagined were mostly professional — freelancers, journalists, gig economy verification.

But there's a harder problem that it turns out to be reasonably well suited to.

In humanitarian logistics, last-mile delivery is where accountability breaks down. Supplies leave a warehouse. Trucks log GPS. Drones reach coordinates. And then — gap. Whether a real person received what was intended, at that location and time, is genuinely difficult to prove without either paper that can be forged or apps that require connectivity and onboarding that recipients often don't have.

IRLid's answer to this is lightweight: the recipient scans a QR code. Both sides generate a cryptographic receipt in under 30 seconds. It's verifiable by anyone — auditors, donors, coordinating agencies — with no specialist software. It works on basic Android browsers. No account. No bio-metric. No app store.

A colleague of mine is building drone delivery infrastructure for remote communities in sub-Saharan Africa. We're talking today about whether IRLid can serve as the proof-of-delivery layer. I think it can.

The organisations I'd most want to be speaking to — WFP Innovation Accelerator, UNICEF Supply Division, logistics-focused NGO tech teams — work on exactly the accountability and verification problems IRLid is designed for.

If you work in humanitarian logistics, NGO technology, or drone delivery programmes and you've bumped into the last-mile verification problem, I'd genuinely like to talk. Not to sell anything — it's open source and free — but because a real-world pilot would make it better.

irlid.co.uk

#HumanitarianTech #LastMile #NGOtech #OpenSource #DroneDelivery
```

---

## WFP Innovation Accelerator — Application Draft

**Apply at:** innovation.wfp.org/apply (rolling applications)

**Project Name:** IRLid — Cryptographic Proof of Delivery for Last-Mile Humanitarian Logistics

### Problem Statement

Last-mile aid delivery is one of the most difficult verification problems in humanitarian logistics. When supplies reach remote communities — whether by road, porter, or drone — organisations have limited means to confirm that a real person received them at the right place and time. Paper signatures are forgeable, GPS logs prove location but not human receipt, and app-based systems require smartphones, connectivity, and user onboarding that many recipients cannot access.

### Solution

IRLid is a browser-based cryptographic proof-of-co-presence tool. When a delivery is made, the recipient scans a QR code displayed by the delivery agent (human or drone). The exchange generates a tamper-evident digital receipt — cryptographically signed, timestamped, and GPS-tagged — proving that two parties were co-located within approximately 12 metres at that moment. No app download. No account. No bio-metric data collected.

### How It Works

1. Delivery agent displays a QR code containing a signed cryptographic offer.
2. Recipient scans it in any modern mobile browser.
3. Both devices exchange signatures. Combined receipt generated via ECDSA P-256.
4. Receipt independently verifiable at irlid.co.uk/check.html — no specialist software needed.

Full handshake: under 30 seconds.

### Why Browser-Based Matters

App installation is a significant barrier in low-connectivity, low-literacy environments. IRLid works on basic Android browsers without installation. This is not a compromise — it is the design.

### Privacy Approach

GPS data used solely to validate proximity at exchange. No persistent tracking. No bio-metric data by default. Open source and independently auditable.

### Current Status

IRLid v4 is live at irlid.co.uk. Protocol implemented, tested, and proven in production (94% Confirmed receipt, bio-metric PASS, 1.11m distance). A collaborating engineer is developing drone delivery infrastructure targeting remote communities in sub-Saharan Africa. IRLid is being evaluated as the proof-of-delivery layer for that system.

### What WFP Support Would Enable

- Structured pilot in an active WFP last-mile delivery programme
- Integration with drone delivery and field logistics workflows
- Independent security audit of the cryptographic protocol
- Offline/low-connectivity resilience improvements

### Honest Limitations

Early-stage. Not yet tested at humanitarian scale. Developer is solo and independent. WFP engagement would provide structure and credibility needed to move from proof-of-concept to operational deployment.

**Contact:** irlid.co.uk | GitHub: github.com/BunHead/IRLid

---

## r/programming Draft (21 April 2026)

**Title:** Show r/programming: I built a browser tool that cryptographically proves two people physically met — ECDSA P-256, Web Crypto API, no app

```
I've been building IRLid — two people meet in person, scan each other's QR codes in a browser, both get a cryptographically signed receipt proving co-location within 12 metres.

The interesting technical bits:

**Canonical JSON serialisation** — moved from JSON.stringify() to a custom canonical() function for payload hashing before ECDSA signing. Property order isn't guaranteed across environments; canonical() recursively sorts all object keys before serialising, making all signatures order-independent.

```javascript
function canonical(obj) {
  if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonical).join(',') + ']';
  const sorted = Object.keys(obj).sort().map(k =>
    JSON.stringify(k) + ':' + canonical(obj[k])
  );
  return '{' + sorted.join(',') + '}';
}
```

**Compact QR encoding** — receipts strip recomputable fields (a.hash, b.hash, a.pub) before deflate-raw compression. 764 chars vs 1,285 uncompressed.

**Embeddable widget** — any site can drop in a single iframe and use a physical meeting as a verification gate. One iframe, one postMessage listener, receipt is a self-contained signed JSON object verifiable without my servers.

**The 4am bug** — shipped v3, receipts showing 23% instead of 100%. GPS was being stripped server-side before returning to the client — stripped the coordinates that were in the original signed payload. Client couldn't recompute the hash. Every receipt failed. Obvious in hindsight.

Honest limitation: GPS is self-reported. Cooperative trust model — both parties must complete the handshake. Full threat model documented in PROTOCOL.md.

76 unit tests, Node built-in test runner, no npm needed. Live at irlid.co.uk | github.com/BunHead/IRLid
```

---

## r/javascript Draft (21 April 2026)

**Title:** Show r/javascript: Built a postMessage widget that verifies a user has physically met another person — ECDSA P-256 in the browser, no SDK

```
IRLid is a proof-of-co-presence tool — two people scan each other's QR codes in a browser and get a cryptographically signed receipt. I've just shipped an embeddable widget version.

The integration is one iframe + one message listener:

```javascript
window.addEventListener("message", (e) => {
  if (e.origin !== "https://irlid.co.uk") return;
  if (e.data?.type === "IRLID_VERIFIED") {
    const receipt = e.data.receipt;
    // self-contained signed JSON — verify server or client side
    // no SDK, no API key, no dependency on my servers staying up
  }
});
```

Everything runs via Web Crypto API — ECDSA P-256 key generation, SHA-256 over canonical JSON, deflate-raw for QR compression. No libraries, no WebAssembly, just what the browser ships with.

The canonical() serialisation was the interesting bit — JSON.stringify() property order isn't guaranteed across environments, which would break signature verification. Recursively sort all keys before hashing and the problem goes away.

Use cases: proof-of-attendance, community gating behind having physically met a real person, event check-ins, delivery confirmation.

Honest caveat: GPS is self-reported by the browser. Full protocol spec and threat model at github.com/BunHead/IRLid (PROTOCOL.md). Live demo at irlid.co.uk/demo-login.html
```

---

## r/cybersecurity Draft (21 April 2026)

**Title:** I built a browser-based co-presence protocol using ECDSA P-256 — honest threat model included, interested in critique

```
IRLid produces a cryptographically signed receipt proving two parties were co-located within 12 metres at a specific time. Runs in any mobile browser via Web Crypto API. No app, no central authority, no biometrics by default.

**Protocol summary:**
- ECDSA P-256 signing, SHA-256 over canonical() JSON serialisation
- HELLO → ACCEPT → COMBINED RECEIPT flow
- Each response commits to both the HELLO hash and the offer hash — prevents cross-session substitution
- Compact encoding strips recomputable fields; verifier recomputes from remaining data
- Ephemeral keys per session — no long-term identity asserted

**v4 additions (all optional, off by default):**
- WebAuthn bio-metric gate — Face ID/fingerprint fires before signing; bioVerified:true committed into the ECDSA-signed payload
- Privacy mode — GPS replaced with SHA-256(canonical({lat,lon,acc})) before sharing; proves co-presence without exposing coordinates
- Trust history scoring — receipt depth, location hotspot novelty, device consistency

**Honest limitations:**
- GPS is self-reported by the browser — a dishonest participant can fabricate coordinates
- Keys currently stored in localStorage — accessible on a rooted device (v5 plans Secure Enclave migration via WebAuthn/Passkeys)
- Cooperative trust model — both parties must complete the handshake

The r/netsec thread from last week has 28K views and some good pushback worth reading if you want the existing critique: search "Proof-of-Personhood Without Biometrics IRLid" on Reddit.

Full protocol spec: github.com/BunHead/IRLid (PROTOCOL.md) | Live: irlid.co.uk
```

---

## Product Hunt Draft (21 April 2026)

**Name:** IRLid

**Tagline:** Prove you physically met someone — like reCAPTCHA but the challenge is reality

**Description:**
IRLid lets two people prove they physically met — no app, no accounts, no biometrics required.

Two phones. Two QR scans. One cryptographically signed receipt proving co-location within 12 metres at a specific time. ECDSA P-256 signatures via the Web Crypto API. Entirely browser-based.

For developers: Drop in a single iframe and use a physical meeting as a verification gate. One postMessage listener. The receipt is self-contained and independently verifiable — no SDK, no API key, no dependency on IRLid's servers.

For everyone else: Works on any phone browser. No download. No sign-up. Scan, sign, done.

Use cases: proof-of-attendance at events, community gating behind real-world meetings, delivery confirmation, field ops logging, humanitarian last-mile accountability.

v4 ships with optional bio-metric confirmation (Face ID/fingerprint committed into the signed payload), privacy mode (GPS replaced with a SHA-256 hash before sharing), and trust history scoring.

Open source. Free. One developer, UK, spare time.

**Topics:** Developer Tools, Security, Privacy, Open Source

**Links:** irlid.co.uk | github.com/BunHead/IRLid
