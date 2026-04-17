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
- Colleague called Wisdom (from Africa, spent time in St Petersburg) — developing mothership drone system for outreach in Africa. **Meeting today (Friday 17 April)** — IRLid solves his proof-of-delivery problem
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

## Current Version: v4 (LIVE — shipped 17 April 2026)

Key v4 additions (all optional, off by default, Settings-gated):
- **Trust history** — localStorage receipt log; depth (0–2pts), location diversity (0–2pts), device consistency (0–2pts)
- **Bio-metric gate** — WebAuthn platform authenticator (Face ID / fingerprint) fires before signing; `bioVerified:true` committed into ECDSA-signed payload; tested and confirmed working on Android
- **Settings panel** — live chip pickers for distance tolerance (5/12/25/50m), time window (30s/90s/3/5min), GPS accuracy floor, minimum score threshold
- **Configurable tolerances** — scan.html reads distance/time from localStorage; sign.js enforces GPS accuracy floor
- **Proven in production** — 94% Confirmed receipt with Guest: bio-metric PASS, 9s Δ, 1.11m distance, 8 receipts in trust history

Key v3 changes from v2 (still the protocol base):
- `canonical()` replaces `JSON.stringify()` for all hashing
- `offer.hash` no longer transmitted — verifier recomputes
- Compact JWK public keys

## Scoring System (100 points = 100% Confirmed)

| Layer | Score | Notes |
|-------|-------|-------|
| v3 base | 20/100 | Protocol foundation |
| v4 Trust history + bio-metric | 50/100 | **LIVE** — receipt depth/diversity/device consistency + WebAuthn gate |
| v5 Enhanced security | 70/100 | Secure Enclave keys, face capture — ALL off by default, deferred from v4 |
| v6 Trust network | 65/100 | Graph, vouching, Sybil resistance |
| v6 Blockchain | 80/100 | On-chain anchor, W3C credentials |
| v6 IoT/Drones | 90/100 | Hardware attestation, delivery proof |
| v7 Zero Knowledge | 100/100 | ZK proofs, privacy-preserving credentials |

**Key design principle:** All enhancements above v3 are optional, off by default, user-enabled in Settings. Never prompted during handshake. Never required to complete a scan.

**v4 shipped with:** Trust history (receipt count, location diversity, device consistency) + WebAuthn bio-metric gate (optional, off by default). No Secure Enclave, no face capture — those are v5. Shipped fast, shipped clean.

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

1. **Wisdom meeting — today** — pitch-humanitarian.html ready, lead with proof-of-delivery angle, 94% receipt screenshot as live demo
2. **Gates Foundation Grand Challenges** — gcgh.grandchallenges.org — closes **28 April** (URGENT — 11 days). Draft ready in PROMOTION.md.
3. **Patreon v4 update** — draft ready in PROMOTION.md. Attach 94% bio-metric receipt screenshot.
4. **Marketing push** — r/privacy and r/webdev drafts ready in PROMOTION.md. LinkedIn humanitarian angle. WFP Innovation Accelerator.
5. **HN/IH karma** — comment on threads first, then repost
6. **v5 planning** — Secure Enclave key migration, face capture (deliberately deferred from v4)

## v4 — SHIPPED ✅

All features live at irlid.co.uk as of 17 April 2026. No further v4 work needed unless bugs found.

Bio-metric accounts: Spencer's Gmail = "Brain" (Pinky & the Brain) avatar. Wife's account = "Fuzzy Babe 69" badge.

Location diversity will flip to PASS once a scan happens >1km from home (city centre, Wisdom's office, etc).

## Tone Notes

- Spencer is honest, self-deprecating, genuinely funny
- Don't over-flatter — he sees through it and values honesty more
- The project is real and technically sound — treat it as such
- He's had ideas all his life that didn't land for reasons outside his control — this one has genuine timing on its side
