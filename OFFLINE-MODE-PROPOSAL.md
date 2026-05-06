# OFFLINE-MODE-PROPOSAL.md — `PROTOCOL.md §16` candidate

**Status:** Draft proposal for Captain's ratification. Same pattern as `v5-PASSKEYS-PROPOSAL.md` was before promotion to `§13`. Once Captain reads, reacts, and rules, the content here promotes to `PROTOCOL.md §16` and this file moves to `archive/`.

**Author:** Number One, drafted 6 May 2026.
**Genesis:** Captain's lived experience the same day — work's check-in system died during an ISP outage; later that evening, Captain's own ISP outage made the question feel personal. Real-world validation that offline-resilient identity primitives have a market the moment connectivity wobbles.

---

## §16.1 Position statement

**IRLid is architecturally one of the better-suited identity systems for operating offline, because the cryptography is already client-side.** The receipt protocol's whole point is that two phones can sign a co-presence proof with no server in the loop. Where offline support is missing today is not in the cryptography — it is in *state management* (where do pending writes live before they sync?) and *sync semantics* (when connectivity returns, how do offline-recorded events reconcile against the canonical store?).

This section commits IRLid to **offline-first as a design principle** going forward. Online is a sync convenience and a centralised query path; it is not a precondition for the protocol's operation. The reverse is not true: a vendor whose check-in system requires a live database round-trip per scan has built a system that is, by definition, less robust than IRLid's protocol layer already is. Closing the implementation gap is mostly engineering, not new cryptography.

---

## §16.2 What already works offline today (zero implementation gap)

The receipt protocol's core flow is fully offline-capable as shipped:

- **HELLO → ACCEPT → COMBINED RECEIPT** — two phones meet IRL, exchange QRs, both sign. Receipt object generated locally on both devices. No server touched. The receipt can sit on either party's device for hours, days, or until either reconnects.
- **Trust history scoring** — `v4` trust history runs against `localStorage`; the score is computed on-device.
- **Bio-metric verification** — `v4` bio-metric gate fires `WebAuthn` against the local platform authenticator. No server.
- **Hardware-backed signing** — `v5` Passkey signing fires `WebAuthn` against the local Secure Enclave / TEE / Windows Hello / Android Keystore. No server.
- **Receipt verification** (`check.html`) — re-runs every cryptographic check in the browser. The party verifying needs no server access.

The org check-in surface (`OrgCheckin.html`) is currently the part that *does* require connectivity for live operation. That is what this section addresses.

---

## §16.3 What needs adding — four-tier path

Implementation is an additive ladder. Each tier is independently shippable and useful; later tiers depend on earlier ones.

### Tier 1 — PWA shell

**Goal:** the page loads from cold even with zero connectivity, provided it has been visited at least once.

**Implementation:**
- Service Worker registered at first visit, caches the HTML / CSS / JS / vendor libs / fonts / static assets via the Cache API.
- `manifest.json` declares the page as installable; users get "Add to Home Screen" prompts on supported browsers.
- Installed instances run in `display: standalone` (or `fullscreen`) — hides the URL bar, partially addresses Captain's earlier "chimps mess with back buttons" concern.

**Outcome:** opening `OrgCheckin.html?dev=0` (or the future production URL) on a phone with no internet shows the page exactly as if connectivity were available. Last-known cached state is what renders.

**Effort:** ~1 day.

### Tier 2 — IndexedDB write queue + Background Sync

**Goal:** any action the user takes while offline (check someone in, add an attendee, edit settings) succeeds locally, queues a pending sync record, and replays to the Worker when connectivity returns.

**Implementation:**
- IndexedDB store `pending_ops` — each entry is a signed envelope of the operation (type, target, payload, device-side timestamp, idempotency key).
- Operations write to IndexedDB first; the existing Worker POST is fire-and-forget against a separate queue.
- Background Sync API replays the queue when connectivity returns. Works in many browsers even after the tab closes; falls back to "replay on next page load" where Background Sync is unsupported.
- UI shows a sync indicator (see `§16.5` for the visible offline state directive).

**Conflict resolution:**
- Multiple staff devices checking the same person in offline → both writes hit the server when each device reconnects → DB's `event_attendance` table accepts both rows. The "warts-and-all" immutability rule (`§14.9` / `crew-protocol §2.2`) is exactly the right shape for this — old rows survive; the audit trail is the truth, not a "deduplicated final answer."
- Settings edits made offline on two devices for the same org → last-write-wins by server-side timestamp (with both writes preserved in audit if needed). This is fine for org settings, which have a clear single owner anyway (lead_admin+).

**Outcome:** an attendee scans at the door during a wifi outage. The dashboard records them locally with a "pending sync" badge. Connectivity returns; the row syncs; badge clears. No flow disruption.

**Effort:** ~2-3 days.

### Tier 3 — Cached org snapshot

**Goal:** the dashboard has the data it needs to operate offline before connectivity drops, not just after.

**Implementation:**
- On every successful sync (and on first sign-in), pull a full snapshot of the active org's settings, expected list, recent attendance (last ~24h), and theme. Store in IndexedDB.
- When offline, the dashboard reads from the snapshot rather than from a (probably empty) `localStorage` ad-hoc cache.
- Snapshot freshness shown in the offline indicator: *"Showing snapshot from 14:32 — reconnecting…"*.

**Outcome:** staff arrives at the venue, wifi is dead, opens the dashboard — it shows the expected list pulled this morning, accepts new check-ins offline (Tier 2), and presents the same workflow staff would have online. Tier 3 is what makes offline mode genuinely useful for events, not just a panic fallback.

**Effort:** ~2 days.

### Tier 4 — Multi-device offline mesh (v6+ territory)

**Goal:** two staff devices at the same door, both offline, sync to each other directly so they don't both check the same attendee in twice.

**Implementation:**
- WebRTC over local-network discovery (or BLE / Wi-Fi Direct on supported platforms via a thin native shell, if v6 has graduated to a mobile app).
- Each device exposes its `pending_ops` queue to peers in the same org session.
- Peer reconciliation runs continuously while in mesh mode; pending ops merge across devices before any reach the server.

**Outcome:** the venue's wifi is dead all night. Two staff at the door each have their device. They check 200 people in across the night. Neither device ever reached the server. In the morning, one device reaches wifi first, syncs, and the merged dataset is already coherent because the two devices kept each other in sync.

**Effort:** ~1-2 weeks. Genuinely v6 territory — fits the trust-network theme architecturally and operationally.

---

## §16.4 Time-anchoring offline-recorded receipts

The hard problem with offline-signed receipts is *trust in the timestamp*. When a device signs a check-in at 14:32 device-clock with no internet, can a verifier in the future trust that the timestamp is real? Two answers, both already in the protocol:

**Answer 1 (low-stakes — adequate for venue check-in):** trust the device clock. Phones synchronise over NTP frequently when online; the clock skew is bounded for any device that has been connected within the last few days. For attendance-tracking purposes (proving someone was at the door at the event), device-clock is sufficient.

**Answer 2 (protocol-grade — required for receipts that may be evidence):** when the device reconnects, anchor the offline-signed receipt to a Trusted Timestamp Authority (TSA) and/or `OpenTimestamps`. The receipt envelope already supports `tsTokens` per `PROTOCOL.md §11`. The flow:

1. Device signs receipt at offline time T₀ with `device_signed_at: T₀`.
2. Device reconnects at T₁ (could be hours, days, or a week later).
3. Device requests a TSA token for the receipt hash.
4. TSA returns a signed timestamp asserting "this hash existed at or before T₁."
5. Receipt now carries a verifiable upper bound on its creation time: T₀ ≤ creation ≤ T₁.

The receipt's actual creation time falls within this window; for most use cases that's sufficient. For applications that need tighter bounds (court evidence, prison custody chains), pre-anchoring to a TSA on the way out (when connectivity is briefly available before going offline) tightens the lower bound.

This dovetails exactly with the `§11` multi-witness time anchoring spec, which is already forward-defined for v6.

---

## §16.5 The blinking red dot UI directive

**Captain's directive 6 May, captured verbatim:** *"In the offline mode though, have an offline blinking red dot in a badge, somewhere."*

Specification:

- **Visual:** a small red circle (~10-12px diameter), pulsing at ~1Hz with a subtle alpha animation (full opacity to ~60% and back). Same shape as the recording indicator on phone cameras — instantly recognisable as "active state, not normal."
- **Position:** top-right of the dashboard chrome, near the sign-out / refresh controls. Visible in every panel (Organisation / Check-in / Dashboard / Settings).
- **Companion text** (optional, narrow viewports may hide): *"OFFLINE"* or simply the red dot.
- **Tooltip / aria-label:** *"Working offline — changes will sync when reconnected. Last sync: HH:MM."*
- **Disappears cleanly when connectivity returns** — the dot fades out, replaced briefly by a green check (1-2s), then nothing (steady state = online).
- **Surfacing pending sync:** if `pending_ops` is non-empty, the red dot shows a small numeric badge (count of pending operations) until they all replay.

**Companion CSS:**

```css
.offline-indicator {
  position: fixed; top: 16px; right: 16px;
  display: flex; align-items: center; gap: 8px;
  z-index: 100; pointer-events: auto;
}
.offline-indicator .dot {
  width: 12px; height: 12px; border-radius: 50%;
  background: #C62828;
  animation: offline-pulse 1.4s ease-in-out infinite;
}
@keyframes offline-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: .55; }
}
.offline-indicator .label {
  font: 600 12px/1 system-ui, sans-serif;
  color: #C62828; letter-spacing: .04em;
}
.offline-indicator.with-count .badge {
  background: #C62828; color: #fff;
  border-radius: 10px; padding: 2px 7px;
  font: 700 11px/1 system-ui, sans-serif;
}
```

Captain's instinct here is exactly right: making the offline state **visible and constant** prevents the "wait, did that save?" anxiety. Users adapt their behaviour when they see they're offline; they keep working but with mild caution. That's healthier than a UI that pretends everything is fine and surprises them with sync errors later.

---

## §16.6 Connection to other v6 themes

Offline mode is not a standalone feature; it is the engineering substrate that makes several other parts of the v6 roadmap feasible:

- **Multi-party custody receipts** (`§10.4`, queued) — drop-offs, prison transfers, chain-of-custody handoffs *literally happen offline most of the time*. A protocol that can't record them offline cannot serve those use cases at all.
- **Wisdom / ASE Tech humanitarian drone delivery** — the entire premise is "delivery to villages without connectivity." Offline-signed receipts are *the* protocol contribution to that partnership. Tier 4 (multi-device mesh) is essentially the protocol-level support for "drone records the receipt; recipient's phone counter-signs; both sync to the network when one of them next sees infrastructure."
- **Trust network + spatial primitives** (`§12` six-axis coordinates, `§14.18` recovery quorum) — once offline-resilient, the protocol can be deployed in places where the trust network is the *only* trust available (no central authority within radio range). Trust-network operations need to merge across offline-then-reconnected devices the same way Tier 4's mesh design does.
- **Time anchoring** (`§11` `tsTokens`) — already covered above. Offline mode is the most compelling reason `§11` exists.

Each of these v6 themes either *requires* offline mode or *benefits significantly* from it. So while offline mode could theoretically ship as a v5.5.x patch series (Tiers 1-3 are all v5.5-shaped engineering), framing it as the **flagship v6 theme** is the correct strategic move. It pulls the other v6 work into a coherent narrative: *"v6 is the version of IRLid that works at the edge of connectivity."*

---

## §16.7 Progressive enhancement vs graceful degradation

A common framing of offline support is *"the system gracefully degrades when connectivity drops."* This implies online is the normal state and offline is the unhealthy fallback.

**IRLid should adopt the inverse framing: progressive enhancement.** The protocol works offline; connectivity is an *enhancement* that adds central storage, cross-device sync, and audit query. The dashboard is *not* "offline mode kicking in when something failed"; it is "the offline mode plus a network sync layer, when network is available." This is more than a vibe — it changes engineering decisions:

- Local writes are the *primary path*; server POSTs are mirrors of an already-completed local operation.
- The UI never shows "loading…" spinners on writes; writes are instant locally, and the sync state is shown as a small indicator (the red dot, or a counter) rather than blocking the user.
- "Online" is a service that *augments* the dashboard with cross-device awareness, not a service the dashboard *depends on* for its primary function.
- Network failures are non-events at the user-experience level. They show up only as "your dashboard is currently offline" indicators; nothing fails, nothing requires retry.

This is how mature offline-capable systems (notebooks, drawing apps, even some banking apps) handle the question. It is the right shape for IRLid given its protocol foundation.

---

## §16.8 Implementation phasing

Three concrete shipping windows, mapped to the four-tier ladder:

| Window | Tier(s) | Tag(s) | Estimate |
|---|---|---|---|
| **Window A — PWA + write queue** | Tiers 1 + 2 | `v5.5.x` patch series (e.g. `v5.5.20-v5.5.22`) | ~1 week |
| **Window B — Cached org snapshot** | Tier 3 | `v5.5.x` (e.g. `v5.5.23`) | ~2 days |
| **Window C — Multi-device mesh** | Tier 4 | `v6.0` flagship implementation | ~1-2 weeks (post-v6 design ratification) |

Windows A and B can ship as `v5.5.x` patches under the existing minor; the user-facing capability becomes "offline-capable check-in" and gets the marketing attention. Window C is where `v6` formally begins, and is where the trust-network / mesh / multi-party-custody themes start to pull together.

---

## §16.9 Threat model implications

Offline operation introduces and modifies several threat-model considerations:

| Attack | Online posture | Offline posture | Defence |
|---|---|---|---|
| Replay of a captured receipt | TSA + nonce reject | Same; nonce + ts window | Unchanged. The 90-second `ts` window applies regardless of online state. |
| Stolen device with active session | Re-auth on sensitive ops | Same; UV-required actions still require local biometric | Local hardware credential + UV is the gate; offline doesn't soften it. |
| Local clock manipulation | Server stamps with its own clock | Device clock only | Tier 4 mesh (peer-to-peer ts cross-checks) + Tier 5 TSA-on-reconnect tighten the bound. For high-stakes use, require recent online sync before trusting offline timestamps. |
| Forged offline check-in | Server validates signature | Local validation + later sync | The signature is verified locally on receipt, exactly as today. The server eventually re-validates on sync. The receipt stands or falls on the cryptography, not the network state. |
| Pending-queue tampering | N/A | Attacker with device access could tamper with IndexedDB | All queued envelopes are pre-signed before queuing. Tampering with a queued envelope produces an invalid signature on sync. The attacker must have the signing key, in which case they can sign new envelopes anyway — no new attack surface. |
| Sync flooding (DoS on reconnect) | N/A | Attacker queues many fake operations offline, floods server on reconnect | Server-side rate limiting per device; signature verification cheap; the attacker burns their own device storage to attempt this. Low-impact attack. |

Offline mode does not fundamentally weaken the protocol's security posture, because the protocol's security model was already client-side-cryptography-based. Online operation was already a convenience layer, not a security gate.

---

## §16.10 Open questions (defer or research)

These are the questions I do not propose to resolve in this memo; they are flagged for future deliberation:

1. **Background Sync browser support** — iOS Safari historically lags. What is the fallback strategy for iOS? Likely "replay on next page load" with a more visible "you have N pending ops, please reconnect" prompt.
2. **Snapshot freshness policy** — how stale before the dashboard shows a "your snapshot is too old, reconnect to continue" warning? Suggested default: 24 hours, configurable per org.
3. **PWA install prompts** — when do we surface the install prompt? Captain's decision; could be at first sign-in, or only after the user has seen the page work normally a few times.
4. **Tier 4 transport** — WebRTC vs Web Bluetooth vs a thin native shell with proper Bluetooth/Wi-Fi Direct. Cross-platform compatibility varies wildly. Likely v6 design conversation.
5. **Offline-acquired Bearer sessions** — currently Bearer auth requires a live Worker round-trip. Should there be an offline-issued temporary session (signed by the device's hardware credential) that the server retroactively ratifies on sync? Probably yes; needs a small spec extension.
6. **Time anchoring trigger** — does every offline-signed receipt automatically request a TSA token on reconnect, or only ones that explicitly opt in (e.g., flagged as "evidence-grade")? Suggest: opt-in for now, default-on for receipts created by drones / multi-party custody / other v6+ flows.

---

## §16.11 What this memo asks Captain to ratify

Three commitments, in order of impact:

1. **Adopt offline-first as a design principle for IRLid going forward.** This is the strategic decision. Online is augmentation; offline is foundation.
2. **Schedule Windows A + B for the immediate `v5.5.x` patch series**, ahead of the next minor bump. Tiers 1-3 are concrete engineering with clear shipping value.
3. **Position offline mode as the v6 flagship theme**, alongside multi-witness time anchoring and trust network. Use it to give v6 a coherent external narrative.

If ratified, this memo's contents promote to `PROTOCOL.md §16` (with the implementation phasing pulled into `STATE-OF-PLAY.md`'s queue and CLAUDE.md's milestones updated as Windows A/B/C ship).

If not ratified, the memo stays here for revision until the design is one Captain wants to commit to.

---

## §16.12 Acknowledgements

This memo would not have been written today without:

- Captain's experience at work with a check-in system that died in an ISP outage.
- Captain's own ISP outage later the same day, which made the question feel personal and obvious.
- Wisdom (ASE Tech) for the humanitarian-drone partnership that has been quietly shaping the v6 design space since April.
- The receipt protocol's original architecture (Captain's design, years before this section was written), which made offline-first feasible without any cryptographic changes. The protocol was already most of the way to "works at the edge"; this memo just names it.

— Number One, drafted 6 May 2026 evening, in the engine room while Captain ran the bridge.
