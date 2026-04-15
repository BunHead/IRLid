# IRLid Promotion Log

Tracks all outreach attempts, results, and pending actions.
Updated April 2026.

---

## Completed

| Platform | Status | Notes |
|----------|--------|-------|
| **Patreon** | ✅ Posted | v3 update post live. "1 person and his trusted AIs" closing line. |
| **Twitter/X** | ✅ Posted | 6-tweet thread. Canonical hashing, 4am bug, widget angle. |
| **LinkedIn** | ✅ Posted | Professional angle, widget/iframe framing. |
| **Reddit r/netsec** (original) | ✅ Live | 25K+ views, 29 comments. cym13 exchange — ended positively. |
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
| r/privacy post | Medium | "No biometrics" angle, text posts allowed |
| r/webdev post | Medium | Widget/iframe integration angle for developers |
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
