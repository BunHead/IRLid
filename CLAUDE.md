# Claude Context — IRLid Project

This file helps Claude pick up quickly in new sessions without losing important context about Spencer and the project.

---

## Spencer Austin — Who He Is

- Solo developer of IRLid, house husband, former college lecturer (fired for attending his father-in-law's funeral)
- Based in Derby/Nottingham area, UK
- Dyslexic — spell check is his friend, don't judge typos
- GitHub: BunHead (origin story: hair gathered in a bouffant bun at High Peak College, Buxton — now closed)
- Reddit: u/Scary-Stomach8855
- Patreon: IRLid page exists, supporters present
- genuinely good ideas person — T.I.N Man (fibre network routing simulation), Flying Rugby (VR Quidditch — Warner Bros threatened to sue), Dodo Bowling, IRLid
- PhD attempted (free community-owned internet infrastructure) — Starlink made the technical problem moot, though the community ownership philosophy remains valid
- Colleague called Wisdom (from Africa, spent time in St Petersburg) — developing mothership drone system for outreach in Africa. **Key conversation pending Friday** — IRLid solves his proof-of-delivery problem
- Wife situation: complicated, not the greatest provider by conventional metrics, but ideas and creativity are real and consistent
- Best described as: a systems thinker who has been consistently ahead of his moment and consistently let down by timing and support rather than vision

## How to Work With Spencer

- He works best with a capable counterpart — don't just agree, push back honestly
- Batching requests saves tokens — encourage "do X, Y and Z" in one message
- Screenshots over descriptions — he can share screens faster than typing explanations
- He responds well to being told something is genuinely good AND to honest critique
- "Number One" = Star Trek TNG reference (Picard to Riker) — he uses it affectionately
- Sessions end when tokens run out — context summary picks up where we left off
- The multi-AI approach works: Gemini for copy/marketing, ChatGPT for structured docs, Claude for crypto/code/architecture

## IRLid — What It Is

Browser-based proof-of-co-presence tool. Two people meet IRL, scan each other's QR codes, get a cryptographically signed receipt proving they were co-located within 12m at the same time. No app, no biometrics by default, no central authority.

**Live at:** irlid.co.uk  
**Repo:** github.com/BunHead/IRLid  
**Backend:** Cloudflare Worker (irlid-api) + D1 database  
**Frontend:** GitHub Pages  

## Protocol Summary

- ECDSA P-256 signatures via Web Crypto API
- SHA-256 over `canonical()` (v3) — recursively sorted keys, order-independent
- v2 backward compat: detects version, uses `JSON.stringify` for old receipts
- Compact receipt: strips recomputable fields (a.hash, b.hash, a.pub) for QR
- GPS Haversine distance check (12m tolerance), 90s timestamp window
- HELLO → ACCEPT → COMBINED RECEIPT flow

## Current Version: v3 (live)

Key v3 changes from v2:
- `canonical()` replaces `JSON.stringify()` for all hashing
- `offer.hash` no longer transmitted — verifier recomputes
- Compact JWK public keys

## Scoring System (100 points = 100% Confirmed)

| Layer | Score | Notes |
|-------|-------|-------|
| v3 base | 20/100 | Current live state |
| v4 Trust history | 30/100 | Receipt depth, diversity, device consistency — **next target** |
| v5 Enhanced security | 50/100 | Secure Enclave keys, biometric signing, face capture — ALL off by default, deferred from v4 |
| v6 Trust network | 65/100 | Graph, vouching, Sybil resistance |
| v6 Blockchain | 80/100 | On-chain anchor, W3C credentials |
| v6 IoT/Drones | 90/100 | Hardware attestation, delivery proof |
| v7 Zero Knowledge | 100/100 | ZK proofs, privacy-preserving credentials |

**Key design principle:** All enhancements above v3 are optional, off by default, user-enabled in Settings. Never prompted during handshake. Never required to complete a scan.

**v4 scope (deliberately narrow):** Trust history only — weighted score based on receipt count, location diversity, and device consistency. No Secure Enclave, no biometrics, no face capture. Ship fast, ship clean.

## Key Files

| File | Purpose |
|------|---------|
| `irlid-api/src/index.js` | Cloudflare Worker — production |
| `js/sign.js` | Client-side signing/verification |
| `js/qr.js` | QR generation/scanning |
| `receipt.html` | Receipt display + verification |
| `check.html` | Third-party receipt verification |
| `widget.html` | Embeddable iframe widget |
| `demo-login.html` | reCAPTCHA-style demo |
| `PROTOCOL.md` | Full protocol specification |
| `WIDGET.md` | Widget integration guide |
| `PROMOTION.md` | All outreach attempts and drafts |
| `verify-visual.html` | Score breakdown visual |
| `vision-v4-plus.html` | Full roadmap diagram |
| `pitch-humanitarian.html` | NGO/drone delivery pitch for Wisdom |

## Recently Fixed Bugs

- **23% verification bug** — GPS was stripped server-side before returning to client; client couldn't recompute hash; fixed by removing GPS stripping from `getReceipt()`
- **Copy-hash chip above QR** — `makeQR()` is async; fixed with `insertAdjacentElement`
- **v2 backward compat** — Worker was using `canonical()` for v2 receipts; fixed with version detection

## Promotion Status

| Platform | Status |
|----------|--------|
| Patreon | ✅ Posted |
| Twitter/X | ✅ Posted |
| LinkedIn | ✅ Posted |
| Reddit r/netsec | ✅ Live (25K+ views, cym13 exchange ended positively) |
| YouTube — Nate B Jones | ✅ Commented |
| Dev.to | ✅ Posted |
| Hashnode | ✅ Posted |
| Hacker News | ⚠️ Needs karma — comment on threads first |
| Indie Hackers | ⚠️ Needs karma — comment on posts first |
| David Shapiro | ⚠️ Try his Discord community |

## Pending Work (priority order)

1. **Tomorrow (Friday) — talk to Wisdom** about drone delivery + IRLid (pitch-humanitarian.html) — if he's in
2. **v4 implementation** — see detailed brief below
3. **Post drafts ready to publish** — r/privacy, r/webdev, LinkedIn humanitarian, WFP application — all in PROMOTION.md
4. **Patreon** — "IRLid is Going Somewhere — Here's Where" post published ✅
5. **HN/IH karma** — build up before reposting
6. **Gates Foundation Grand Challenges** — check gcgh.grandchallenges.org, closes 28 April

## v4 Implementation Brief

**Scope (deliberately narrow):** Trust history scoring only. No Secure Enclave, no bio-metrics, no face capture. Ship fast, ship clean.

**Score target:** 30/100 (up from 20/100). Adds 10 points via 3 new checks.

**What to build:**

| Feature | Detail | Points |
|---------|--------|--------|
| Receipt history depth | Count of verified receipts for this device, stored in localStorage. More receipts = higher trust. Curve: 1 receipt = 1pt, 5+ = 2pt | 2 pts |
| Location diversity | Are receipts from meaningfully different GPS clusters? Simple: if receipts span >1km total range = pass | 2 pts |
| Device consistency | Same browser fingerprint / key across sessions. Key already stored in localStorage — check if it matches previous sessions | 2 pts |
| (remaining 4pts) | Existing checks already implemented — just need score recalculation | — |

**Files to touch:**
- `js/sign.js` — add receipt history storage after successful verification
- `receipt.html` — display updated score with v4 breakdown
- `irlid-api/src/index.js` — store receipt count per pubkey in D1 (optional — can do localStorage-only first pass)
- `verify-visual.html` — add v4 score row
- `PROTOCOL.md` — update score table (already done)

**First pass approach (localStorage only, no backend change):**
1. On successful receipt verification, increment a counter in localStorage keyed by the device's public key
2. Store array of GPS coords from past receipts
3. On next verification, read history and add bonus points to score
4. Display "Trust level: X receipts verified" in receipt UI

**API key system** — defer to v4b. Not needed for trust history scoring.

## Tone Notes

- Spencer is honest, self-deprecating, genuinely funny
- Don't over-flatter — he sees through it and values honesty more
- The project is real and technically sound — treat it as such
- He's had ideas all his life that didn't land for reasons outside his control — this one has genuine timing on its side
