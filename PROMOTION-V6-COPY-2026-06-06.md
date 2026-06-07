# IRLid v6 — promo copy (substance for Captain)

**Date drafted:** 6 June 2026 · Number One brief → copy bench
**What this is:** Starting substance, not finished copy. Captain rewrites everything here in his own voice before anything posts. The Patreon piece can move soon (warm audience). The community post waits for the Captain's call on show-readiness.

**The one-line hook for everything below:**
> Proof people were actually there — browser-based, no app, tamper-evident, and it works even when the wifi doesn't.

**Honesty guardrails held throughout (non-negotiable):** "hardware-backed" / "device-unlock (fingerprint or passcode)", never "biometric" alone. "Tamper-evident", never "tamper-proof". "Signed record" / "strong evidence", never "proof" in the absolute sense. No invented metrics, no fake testimonials, no "military-grade". Manager-permissions and the lead-admin ceremony are framed as *next*, not shipped. The humanitarian half is framed as *direction*, not a shipped feature.

---

## 1 — Patreon v6 update

*Builds on PATREON-V6-DRAFT-2026-06-04.md. Tone: honest, a little self-deprecating, genuinely excited but not hype. Under ~350 words in final form. Don't invite people to hammer the calendar until the event-save bug is closed — point them at the receipt flow instead.*

**Subject line options:**
- "v6 is live — and IRLid grew up"
- "It used to prove two people met. Now it can run the whole room."
- "The version where IRLid stopped being a demo and started being a system"

**Draft body:**

When I started IRLid the whole thing was two people, two phones, two QR codes. You scan mine, I scan yours, and we both walk away with a signed receipt that says we were genuinely in the same place at the same time. No app, no account, nobody in the middle. That was the entire pitch, and I was quietly proud of it.

v6 is the version where that grew up.

The same cryptographic handshake now runs a whole venue. There's an organisation portal — set up an event or a space, and watch a live dashboard of who's checked in, who's checked out, scan counts, the lot. There's an "audit" view styled like an airport departures board that you can prop at a reception desk. There's a calendar with multiple rooms and a "who's here now" for each event. There's a doorman flow, so a guest just holds up their phone and a staff member scans it — nobody hands a device over. Staff sign in by scanning a QR and confirming with their phone's own unlock (fingerprint or passcode — your choice, never a password). Each organisation can theme its own check-in screen. And it all keeps working when the connection drops, then syncs when it's back — because a meeting that physically happened shouldn't be lost to a flaky signal.

The part I care about most is the receipts. Every check-in mints one, signed by the venue's own key and bound to the attendee's device. You can download it, hand it to someone, and they can verify it themselves at irlid.co.uk/check.html — no login, no trusting me. The venue can't fake it and can't quietly rewrite it later. I tested it on myself: checked in, opened the receipt, watched it come back 100% Confirmed with all four checks passing. That's the bit that makes the whole thing honest.

What's next is about trust *between people* — letting a venue safely hand specific powers to its managers, and a proper in-person ceremony for appointing the people at the top. Both are in build, not done. As ever, every layer is optional and off by default, and IRLid only ever claims what it can actually prove.

Thank you for being here for this one. It's been a long road to "independently verifiable."

— Spencer

---

## 2 — Social posts (X / LinkedIn)

*Three angles: technical, plain-English, humanitarian-direction. Each is short enough to post as-is or trim. Captain's voice on the final.*

### 2a — Technical (X)

```
IRLid v6 is live. The two-person co-presence handshake is now a full check-in/out system.

Every check-in mints a receipt signed by the venue's key + bound to the attendee's device. Anyone can verify it independently — no login, no trust in us. Staff sign in by QR + device-unlock. No passwords.

Tamper-evident, browser-based, works offline.

irlid.co.uk
```

*(~300 chars — trim the offline line if X is strict on the limit.)*

### 2b — Plain-English (LinkedIn or X)

```
For two years IRLid did one thing: prove two people were genuinely in the same place at the same time. Scan a QR, get a signed receipt, no app, no account.

v6 turns that into a check-in system any organisation can run — events, gyms, studios, clinics, reception desks. Live dashboard of who's in the room, branded check-in screen, staff sign in with a tap of their phone instead of a password. Each attendance record is a receipt the attendee can keep and anyone can verify.

And it keeps working when the wifi doesn't — a co-presence that physically happened shouldn't be lost to a dropped signal.

Same idea as day one. Just grown up.

irlid.co.uk
```

### 2c — Humanitarian-direction (LinkedIn) — *frame as where it's headed, not shipped*

```
IRLid v6 shipped this week: a cryptographically signed, tamper-evident record of who was actually present, now running as a full check-in/out system for venues and events.

Where I want to take it next is the harder version of the same problem. In humanitarian logistics, last-mile delivery is where accountability breaks down — supplies leave a warehouse, a drone reaches coordinates, and then there's a gap: did a real person actually receive what was intended, here, now?

The same primitive that signs a gym check-in can sign a proof-of-delivery. That's the direction — built with partners working on drone outreach, and not done yet. But the foundation it needs shipped this week.

Honest by design: tamper-evident, not tamper-proof. A signed record, not a metaphysical certainty. I'd rather under-claim and be trusted.

irlid.co.uk

#HumanitarianTech #LastMile #OpenSource
```

---

## 3 — Community angle (r/selfhosted / r/privacy / indie-maker)

*Substance only. Captain rewrites in his voice and posts when HE judges it show-ready — public cold-launch waits for his call. Honesty-forward, because that audience punishes overclaiming and rewards a builder who names the limits first. No links in the body for the Reddit version; drop the GitHub link in a comment if people engage. Pick ONE target.*

### 3a — r/selfhosted angle

**Title:** I built a browser-based check-in system where every attendance record is a receipt you can verify yourself — no app, runs offline, no central authority to trust

```
I've been building IRLid — it started as a way for two people to prove they
were genuinely in the same place at the same time (scan each other's QR codes
in a browser, both get a cryptographically signed receipt). v6 turns that same
primitive into a full check-in / check-out system an organisation can run:
events, venues, gyms, studios, clinics, reception desks.

Why it might interest this crowd specifically:

- No app, no SDK. It's a browser surface. A field operator with a cheap
  Android tablet can run the door.
- Every check-in mints a receipt signed by the venue's own key and bound to
  the attendee's device. You can download it and anyone can verify it
  independently — it doesn't depend on my servers staying up. If I vanish,
  your receipts still verify.
- Staff sign in by scanning a QR and confirming with their phone's hardware
  unlock (fingerprint or passcode). No passwords, no pasted keys.
- Offline-safe — the dashboard and check-in keep working through a dropped
  connection and sync when it's back. A co-presence that physically happened
  shouldn't be lost to a flaky signal.
- The records are immutable. I never retroactively rewrite a receipt — and I
  think that constraint is a feature, not a limitation.

The honest part, because this sub will ask anyway:

- It's "tamper-evident", not "tamper-proof". You can tell if a receipt was
  altered; that's a different and weaker claim than "cannot be altered".
- GPS is self-reported by the browser. The protocol gives you a strong,
  good-faith record that two parties attested to being co-located — not
  metaphysical certainty against a determined liar. The threat model is
  documented openly, including what it does NOT prove.
- "Hardware-backed sign-in" means WebAuthn user-verification — which can be a
  fingerprint OR a passcode. I can't and don't claim it was a face.
- I'm one person building this from a desktop tower and a handful of cheap
  phones. It's open source.

The thing I'd most welcome a sceptical eye on is the verifier and the threat
model — I'd rather hear where it's weak now than after someone relies on it.
```

*(For r/privacy, lead harder on "no central database of who met whom", "private key never leaves the device", and the localStorage→hardware-backed migration story from v5 — that sub cares about the data-minimisation angle more than the self-hosting angle.)*

### 3b — Indie-maker / Hacker News "Show" angle (tighter)

```
Show: IRLid v6 — browser-based check-in where every attendance record is an
independently-verifiable signed receipt

IRLid began as a two-person "prove we met" handshake — scan QR codes, both get
a signed co-presence receipt, no app, no account. v6 scales it to a check-in /
check-out system for venues: live attendance dashboard, multi-room calendar,
a doorman flow (staff scans the guest's phone, nobody hands a device over),
passwordless staff sign-in via QR + device-unlock, per-org branded check-in
screens, and offline support that syncs when the signal returns.

The design bet: it's general-purpose on purpose. I'm trying to cover as many
check-in/out needs as possible rather than build one narrow vertical tool.

Honest framing up front: tamper-evident, not tamper-proof. Signed record, not
absolute proof. GPS is self-reported. One solo dev, open source, full threat
model published. Critique very welcome — especially on the verifier.

Live: irlid.co.uk
```

---

## Number One's notes — claim / don't-claim

**Safe to claim (all live in v6):** organisation portal with live attendance dashboard (checked-in / checked-out, scan counts, scores); airport-board audit view; calendar + per-event expected lists + multi-room + "who's here now"; doorman flow; roles (attendee / staff / manager / lead-admin gating); passwordless QR + hardware-unlock staff sign-in; per-org branding of the check-in screen; offline-safe dashboard + check-in with sync; downloadable, independently-verifiable receipts (verify at check.html); receipts in the attendee's own history; multi-device.

**Do NOT claim:**
- Never "biometric" alone → **hardware-backed / device-unlock (fingerprint or passcode)**. WebAuthn user-verification can't distinguish a fingerprint from a PIN.
- Never "tamper-proof" → **tamper-evident**. Never "proof" in the absolute sense → **signed record / strong, good-faith evidence**.
- No invented metrics, no fake testimonials, no "military-grade".
- **Manager-permissions and the lead-admin appointment ceremony are in build, not live** — nod to them as "next", don't claim them as shipped.
- **The humanitarian / proof-of-delivery half (v6.5, with Wisdom / ASE Tech) is direction, not a shipped feature** — frame as where it's headed.
- The "100% Confirmed, four checks passing" line is a real, specific self-test result — fine to keep. Don't dress it up beyond what the UI actually said.
- Lean into the immutability/honesty as the pitch: the records are never retroactively rewritten, and that transparency is the selling point. The audience IRLid wins is the one that's tired of being lied to.

**Suggested screenshots:** a 100%-Confirmed org receipt in check.html (the trust gate); the live dashboard with the attendance bar; and/or the airport-board audit view propped at a desk.
