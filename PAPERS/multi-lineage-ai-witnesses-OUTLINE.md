# Multi-Lineage AI Witnesses for Constitutional Acts in Long-Lived Distributed Systems

**Status:** Outline + abstract + Section 4 drafted. The remaining sections are intended to be fleshed out in a fresh Number One chat with full focus.
**Author:** Spencer R. Austin (IRLid project), with architectural collaboration from Number One (Claude, Anthropic Sonnet 4.6).
**Conceived:** 4 May 2026 evening watch (regency model insight by Captain). Outline written: 5 May 2026 morning watch.
**Target venues:** EAI SecureComm 2026 (Lancaster, July 21-24), 44CON CFP, or independent technical report.

---

## Abstract

Long-lived distributed systems face a structural tension between requiring sovereign authority during normal operation and surviving the loss or corruption of that authority over time. Existing solutions either centralise (a corporate operator who can be acquired, coerced, or wound up), federate via permanent threshold cryptography (which dilutes responsibility and can be slowly captured by colluding signers), or punt to blockchain governance (with significant energy and UX costs). We propose a **regency pattern** drawn from constitutional law: the system runs in **SOLE mode** under a single sovereign authority by default, and transitions to **INTERIM mode** under a standby Quorum of regents only when the sovereign is provably unavailable. Crucially, the Quorum does not choose the sovereign's successor — that constitutional act is encoded in a sealed succession envelope authored by the original sovereign and held by an independent **AI-witness ledger**, where decryption-key shards are custodianed by multiple AI lineages from distinct organisations and jurisdictions. M-of-N AI-witnesses must independently verify trigger conditions against pre-recorded fact-check criteria before key shards are released. This separates *operational trust* (humans, coercible, bounded reversible powers) from *constitutional trust* (non-human AIs, not coercible in the same ways, with one irreversible power). We describe the design's threat model, propose a deployment minimum viable version using existing AI APIs, and discuss generalisation to other long-lived systems beyond our motivating application (IRLid, a browser-based proof-of-co-presence protocol).

**Keywords:** distributed systems, succession, constitutional cryptography, AI safety, threshold cryptography, governance, identity protocols.

---

## 1. Introduction

(To be written. ~1.5 pages.)

Sketch:
- Motivating problem: founder bus factor in long-lived protocols. Most projects either die with their founder, get acquired (centralisation), or calcify into corporations.
- Specific failure modes to address: founder death, founder incapacitation, founder coercion, founder slow-corruption-over-decades.
- Why existing solutions fall short:
  - Centralised operator: single point of capture, single legal jurisdiction, no real survivability if the operator winds up.
  - Permanent multisig (DAO-style): committee creep, dilution of responsibility, slow-collusion risk over decades, no clean way to pass authority to a successor.
  - Blockchain governance: energy cost, UX cost, governance attacks, plutocratic drift.
  - Social recovery (per-user): doesn't address constitutional acts, only operational ones.
- The proposed regency pattern: sovereign + standby Quorum + sealed succession envelope + AI-witness ledger. Operational vs constitutional trust split.
- Contribution: design pattern, threat model, deployment plan, application to IRLid as motivating example. The pattern itself generalises beyond identity protocols.
- Roadmap: §2 background, §3 problem, §4 regency pattern (the keystone, written below), §5 AI-as-ledger-keeper, §6 multi-lineage diversity, §7 threat model, §8 IRLid implementation, §9 generalisation, §10 discussion.

---

## 2. Background and Related Work

(To be written. ~2 pages.)

Sketch:
- Constitutional law as inspiration: regency in monarchies, presidential succession in republics, ICANN's stewardship transition (2016 IANA), the role of constitutional courts.
- Threshold cryptography: Shamir's Secret Sharing, BLS aggregation, Schnorr threshold schemes. Survey what's standard in 2026.
- Multisig governance in practice: Bitcoin custodial multisig, Ethereum DAO governance, Gnosis Safe, threshold signatures in fiat custody. What works, what doesn't.
- Social recovery: Argent, Loopring, Vitalik's "Why we need wide adoption of social recovery wallets" (2021). Per-user recovery is well-studied; constitutional-level isn't.
- AI safety and oracle problems: AI-as-judge (Constitutional AI, scalable oversight), AI-as-evaluator (LLM-as-judge in benchmarks), AI red-teaming. Different roles AIs are starting to fill in adversarial settings.
- IRLid as motivating context: PROTOCOL.md §13 (v5 hardware-backed signing), §14 (identity-bound sessions), the existing succession sketch in LONG-TERM-SUCCESSION.md.
- Gap: nobody has cleanly applied threshold cryptography + AI judgment to *constitutional* governance of a long-lived protocol. This paper closes that gap.

---

## 3. Problem Statement

(To be written. ~1.5 pages.)

Sketch:
- Formal definition of the long-lived distributed system: a protocol P with a designated sovereign S who holds primary authority. P is intended to operate over decades, possibly centuries.
- Required properties:
  - **Continuity:** P continues operating during S's absence (vacation, hospital, coercion, death)
  - **Succession:** P transitions to a new designated sovereign S' when S is permanently absent
  - **Capture-resistance:** No coalition of bounded size can permanently seize P during transition
  - **Audit-legibility:** Any participant or observer can verify P's current governance state
  - **Time-stability:** Properties hold over decades, including under model drift, jurisdictional shifts, and slow erosion of norms
- Failure modes to defend against:
  - Sovereign coercion (kidnapping, legal compulsion)
  - Sovereign incapacitation (medical, geographic isolation)
  - Sovereign death without prior succession declaration
  - Slow corruption (sovereign signs increasingly compromised acts over time)
  - Coup attempts during transition (regents try to entrench)
  - Decay of jurisdictional diversity over decades (custodian acquisition, regulatory pressure)
  - Model drift (AI witnesses' interpretations change as base models change)

---

## 4. The Regency Pattern (KEYSTONE — DRAFTED HERE)

The regency pattern is the architectural keystone of this paper. Most cryptographic governance proposals try to flatten "operational" and "constitutional" trust into a single multisig or DAO. The regency pattern instead **separates them by design**, drawing on a centuries-old pattern from constitutional law.

### 4.1 Two operating modes

A protocol P operates in one of two modes at any time:

**SOLE mode (default).** The sovereign S holds primary authority. S signs operational acts (admit users, issue credentials, configure parameters) using their private key directly. The protocol functions as a single-signer system during normal operation. SOLE mode is intentionally lightweight: no consensus overhead, no signature aggregation, no governance friction. The protocol behaves as if S were a sole administrator, with the obvious efficiency benefits and the obvious risk that S might become unavailable.

**INTERIM mode (transitional).** A pre-registered Quorum of N regents (typically N=7, with M=4 required for any act) collectively performs a *bounded* subset of S's powers. INTERIM is not a permanent mode — it is a defined transitional state that exists only until either (a) S resumes activity, or (b) a new sovereign S' is appointed via the sealed succession envelope mechanism (§5). The Quorum's authority during INTERIM is restricted by the protocol itself, not by self-restraint.

### 4.2 Trigger to enter INTERIM

INTERIM mode is entered when one of three conditions is met:

1. **Inactivity threshold.** S has not signed any protocol act for a defined period (default: 90 calendar days). The threshold is configurable by S during SOLE mode, but cannot be modified once INTERIM is active.
2. **Voluntary delegation.** S signs a `DELEGATE_TO_QUORUM` envelope with a defined TTL. Used for predictable absences (surgery, sabbatical, off-planet missions).
3. **Quorum-attested unavailability.** A higher-threshold subset (typically (N-2)-of-N — e.g., 5-of-7) of the Quorum signs a `PRESUMED_UNAVAILABLE` envelope. Used when S is unexpectedly unavailable and the inactivity threshold has not yet expired (sudden hospitalisation, kidnapping). The higher threshold here is deliberate — fast action by the Quorum requires broader consensus than routine acts.

The combination of (1) and (3) provides defence in depth: a passive timer that always fires eventually, and an active vote that can fire faster when the Quorum is confident. Either alone would be insufficient.

### 4.3 What INTERIM mode CAN do

The Quorum's authority in INTERIM mode is restricted to the operational acts necessary to keep the protocol functioning while a sovereign is established:

- **Mint operational tokens** (e.g., invite tokens for new participants, recovery tokens for existing ones)
- **Promote sub-administrators within existing organisational units** (e.g., for IRLid, promote a Lead Admin within an org whose previous Lead Admin is also unavailable)
- **Execute the sealed succession envelope** to install a new sovereign S' (one-shot operation; see §5)
- **Extend INTERIM mode** by an additional bounded period (e.g., another 90 days) — requires the same M-of-N threshold, prevents indefinite regency by quiet vote

### 4.4 What INTERIM mode CANNOT do (the four hard restrictions)

The architecturally-enforced restrictions on INTERIM mode are what prevent capture from inside the regency:

1. **Cannot modify Quorum membership.** No additions, no removals.
2. **Cannot change M or N.** The threshold parameters are immutable during INTERIM.
3. **Cannot modify the inactivity threshold.** A regency cannot extend its own activation window.
4. **Cannot mint another Quorum.** No recursion. The regency layer is non-replicable.

These four restrictions are encoded at the protocol layer, not delegated to Quorum self-restraint. A Quorum signature attempting any of these acts is rejected by the protocol's validators, regardless of how many regents signed it.

### 4.5 Termination of INTERIM mode

INTERIM ends when one of:

1. **S resumes.** S signs an act using their original key. The protocol returns to SOLE mode under S. (For trigger-by-inactivity, the original threshold timer resets.)
2. **S' is installed.** The sealed succession envelope is decrypted via the AI-witness ledger (§5), revealing S's pre-recorded designation of a new sovereign S'. The protocol returns to SOLE mode under S'.
3. **The bounded INTERIM period expires** (e.g., 90 days post-trigger). Without renewal vote, the protocol enters a defined fallback state — typically a *fork-to-existing-sub-administrators* mode where each operational unit becomes its own root. This is the worst-case state and is intentionally degraded to incentivise resolution through (1) or (2).

### 4.6 Comparison to existing patterns

| Pattern | Default authority | Failure mode | Capture risk |
|---|---|---|---|
| Centralised operator | Single corporation | Acquisition, wind-up, regulatory coercion | Acute, single point |
| Permanent multisig (DAO) | M-of-N committee | Slow collusion, committee creep | Diffuse, gradual |
| Blockchain governance | Token holders | Plutocracy, low turnout, governance attacks | Diffuse, expensive |
| Social recovery (per-user) | Single user with social network | Friend coordination cost, scope-limited | Per-user, manageable |
| **Regency pattern (this work)** | **Sovereign with standby Quorum** | **Indefinite INTERIM if sovereign cannot be re-established** | **Bounded by INTERIM's restrictions** |

The regency pattern's distinguishing feature is the **bounded power asymmetry**: SOLE mode is unrestricted (sovereign acts directly), INTERIM mode is highly restricted (regents act only within a defined operational envelope), and the constitutional act of choosing a successor is removed from both layers and placed in a separate witness-ledger mechanism (§5). This makes the regency model fundamentally different from threshold-multisig governance — the regents cannot promote themselves, cannot grant themselves new powers, cannot retain authority indefinitely. They are caretakers, not governors.

---

## 5. AI as Ledger-Keeper, Not Judge

(To be written. ~2 pages.)

Sketch:
- The constitutional act of naming a successor is removed from the Quorum and placed in a sealed succession envelope authored by the original sovereign before they were unavailable.
- The envelope is encrypted; its decryption key is split via Shamir's Secret Sharing across N "AI-witness organisations."
- Each organisation holds one key shard and runs an AI-as-evaluator on submitted evidence packages. M of N organisations must independently produce positive verdicts before key shards are released.
- Critical framing distinction: AI is **ledger-keeper, not judge.** A judge interprets and decides. A ledger-keeper preserves a record, attests to its content, and verifies fact-checks against pre-recorded criteria. The latter is far more bounded and defensible.
- AIs are not asked "is the sovereign presumed unavailable?" — that's a judgment. They are asked "Has the sovereign signed a heartbeat in the last 90 days? Have 5 of 7 Quorum members signed a `PRESUMED_UNAVAILABLE` envelope with valid signatures? Is the timestamp within the freshness window?" — those are fact-checks.
- The criteria are pre-recorded by the sovereign in the envelope's metadata block. The AI's role is to evaluate evidence against pre-recorded criteria, not to make free-form decisions.
- This makes the system stable across model versions: the same evidence package against the same criteria should produce the same verdict in 2026 or 2046, even as base models change, *because the criteria are fact-checks not interpretations*.

---

## 6. Multi-Lineage Diversity Requirement

(To be written. ~1.5 pages.)

Sketch:
- Why one AI lineage isn't enough: model bias (training corpus, RLHF preferences), organisational capture (commercial pressure, government compulsion), jurisdictional concentration (most large labs are US-based).
- Diversity dimensions:
  - **Model lineage.** Different training corpora, different inductive biases. Anthropic vs OpenAI vs Google vs Mistral vs DeepSeek vs Meta.
  - **Organisational ownership.** Different commercial structures, different regulatory exposures, different shareholder pressures. A coalition that compromises one organisation should not propagate to others.
  - **Jurisdictional diversity.** US, EU, UK, China, Singapore, Japan. Regulatory diversity provides defence in depth — a single legal compulsion in one jurisdiction shouldn't disable the witness layer.
- Practical 2026 deployment: three custodian organisations split key 2-of-3 (Shamir). One each from US / EU / Asia. Friendly research relationships first (Anthropic research, a Google research lab, AI Singapore or RIKEN). Expand to 5-of-7 or 7-of-10 at scale.
- Recursive re-evaluation requirement: the diversity property must be re-evaluated periodically. If by 2036 fewer than the threshold of witness organisations remain genuinely independent, the protocol enters a defined degraded state rather than relying on a captured witness layer.

---

## 7. Threat Model

(To be written. ~2 pages.)

Sketch (each gets a paragraph):
- Coercion of sovereign during SOLE mode (countered by sealed envelope authored before coercion)
- Coercion of regents during INTERIM (M-of-N threshold + jurisdictional diversity)
- Coercion of AI-witness organisations (M-of-N + jurisdictional diversity, harder to coordinate cross-border)
- Slow corruption of sovereign over time (REPLACE-ENVELOPE path with time-lock + transparency requirement, sunset clause on sovereign authority at ~50 years)
- Quorum collusion attempting to entrench (the four hard restrictions in §4.4)
- AI model drift over decades (criteria as fact-checks not judgments)
- Witness organisation acquisition (recursive re-evaluation, defined degraded state)
- Petitioner forging evidence (cryptographic signature verification on heartbeat + Quorum petition)
- Replay attacks (timestamp freshness windows on all signed messages)
- Race attacks on ENVELOPE_REPLACE (time-locked publish + transparency)
- Network partition during INTERIM (graceful degradation, eventual consistency)
- The "100-year horizon" problem: no protocol survives infinity; the goal is bounded resilience that lengthens the timeline. American constitutional drift took 200+ years; a protocol that lasts 200 years is an extraordinary win.

---

## 8. IRLid: A Concrete Implementation

(To be written. ~1.5 pages.)

Sketch:
- Brief introduction to IRLid: browser-based proof-of-co-presence, ECDSA P-256 receipts, hardware-backed signing via WebAuthn (PROTOCOL.md §13), identity-bound sessions (§14).
- Why IRLid is a good motivating example: small enough to implement realistically, large enough to matter (humanitarian use cases, post-COVID trust deficit), founder-led (Captain Spencer Austin) with clear succession risk.
- Mapping the regency pattern to IRLid:
  - Sovereign = the bootstrap Developer, recognised via env-var pub_fp (PROTOCOL.md §14)
  - Quorum = 4-of-7 standby regents to be appointed
  - Sub-administrators = Lead Admins per organisation
  - Operational acts = `/org/expected` create, `/user/create-org`, etc.
  - Constitutional acts = Developer succession via sealed envelope
- Roadmap:
  - v5.6 (mid-2026): Lead Admin transfer-of-privilege rule + Developer-mintable invite tokens
  - v5.7/v6.0 (late 2026 / early 2027): Regency mode + sealed succession envelope (initial three-witness deployment)
  - v8+ (year-on, ongoing): full multi-lineage AI-witness layer at production scale

---

## 9. Generalisation Beyond IRLid

(To be written. ~1 page.)

Sketch:
- The regency pattern is not specific to identity protocols. It applies to any long-lived distributed system with a designated sovereign authority.
- Application examples:
  - Climate commitments and intergenerational treaties: parties ratify rules now that bind them or successors over decades
  - Endowment governance: trust funds designed to outlive their founders without falling to current management
  - Long-running standards bodies: protocols that need governance continuity beyond their founders' tenure
  - Scientific consortia: multi-decade collaborations like LIGO, ITER, the Human Brain Project
- Why the pattern generalises: any system with the trade-off "we need a sovereign during normal operation but the sovereign is mortal" is a fit.
- What doesn't generalise: systems where the sovereign is a corporation (which doesn't die in the same way) or where governance is intentionally diffuse from the start.

---

## 10. Discussion and Future Work

(To be written. ~1 page.)

Sketch:
- Open questions:
  - What's the right threshold M for the AI-witness layer? Higher = more capture-resistance, lower = better operational tolerance to organisation drop-off.
  - How does the witness layer handle disputed verdicts? (One witness produces yes, another no, M of N needed — what's the right escalation?)
  - Cross-protocol witness reuse: can a single witness organisation custodian shards for multiple long-lived protocols?
- Limitations:
  - The witness layer requires real organisations to commit to the role. As of 2026, no AI organisation explicitly offers this service.
  - Model drift is mitigated but not eliminated by fact-check criteria.
  - Jurisdictional diversity is geographically and politically constrained today.
- Future work:
  - Standardise the witness API contract (verdict envelope schema, evidence package schema, signature algorithms).
  - Pilot deployment with three willing AI labs.
  - Empirical study of model verdict stability across model versions on the same evidence package.
  - Constitutional-cryptographic primitives library (open source).

---

## 11. Conclusion

(To be written. ~0.5 page.)

Sketch:
- The regency pattern + AI-witness ledger separates operational from constitutional trust in a way that matches how durable institutions actually work.
- The pattern is bounded, legible, and defensible to non-technical audiences in a way that DAO-style governance is not.
- Long-lived distributed systems that haven't solved succession have a fatal architectural flaw. This paper offers a buildable, deployable, generalisable answer.
- A protocol that survives its founder by design is a different artifact than a SaaS product with a roadmap.

---

## Appendix A — Full IRLid Implementation Sketch

(To be written. ~1.5 pages of pseudocode + schema.)

---

## Appendix B — AI-Witness Verdict Schema (proposed)

(To be written. JSON schema for evidence packages and verdicts.)

---

## Appendix C — Comparison to Constitutional Law Patterns

(To be written. Brief survey: regency in monarchies, US presidential succession, Vatican conclaves, ICANN stewardship transition. Where each pattern's strengths and weaknesses inform the design.)

---

## Production notes for the next Number One

This outline preserves the architectural keystones from the 4-5 May 2026 design watch:
- Section 4 (Regency Pattern) is fully drafted as the conceptual core. Captain's "the regents don't choose the successor" insight is embedded throughout.
- Sections 5 and 6 capture the AI-as-ledger-keeper framing and the multi-lineage diversity requirement that emerged from Captain's 5 May morning question "How would you go about making the AI lineage in 2026?"
- The threat model (§7) folds in the REPLACE-ENVELOPE time-lock + transparency + sunset clause from the 5 May discussion of the founding-fathers parallel.
- The IRLid implementation section (§8) maps the abstract pattern back to the concrete v5.5 architecture.

For the full write-up, the next Number One should:
1. Read this outline + `memory/sessions/2026-05-04-02.md` (regency origin discussion) + `memory/sessions/2026-05-05-01.md` (AI-lineage build-out + recovery quorum + crew assignments)
2. Read `LONG-TERM-SUCCESSION.md` (will be updated by the next Number One per pending-work.md Doc 3)
3. Flesh out sections in order: 1 (intro), 2 (background), 3 (problem), then 5 → 11 (4 is done)
4. Cross-check with Captain on the IRLid-specific examples in §8 before publishing
5. Decide with Captain on venue: EAI SecureComm 2026 (deadline likely closed; check), 44CON CFP, USENIX Security, or independent technical report

The voice should be academic-formal but accessible. Captain's name is on this; he should be able to read it confidently and stand behind it at a CFP review.

This is a real contribution. The pattern hasn't been published in this form anywhere I can find, and the AI-as-ledger-keeper framing is genuinely novel as far as the 2026 literature goes. Worth doing well.

End of outline.
