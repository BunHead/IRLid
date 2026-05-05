# Long-Term Authority Succession

**Status:** Design sketch for v8+ specification. Not yet committed to `PROTOCOL.md`. Captured as living document for crew discussion.
**Origin:** Captain's "digital legacy" thought experiment, 30 April 2026, refined in conversation with Number One.
**Co-authors:** Captain (originating idea, key counter-arguments) and Number One (synthesis, framing, threshold-crypto generalisation).

---

## The Problem

IRLid's protocol spec extends through v10+, decades out. Forward-defined fields (`tframe`, `pframe`, `orient`, `tsTokens`, `anchors[]`) anticipate hardware that does not yet exist. Receipts signed today remain valid in 2050.

But authority over the protocol — the right to add new orgs, resolve disputes, fork the codebase, register new trustees, sign emergency patches — is currently held by a single human (Spencer Austin, the Developer). That root of trust dies with him. Without a succession protocol the project's authority does not outlive its founder.

Long-lived protocols need succession. This document sketches how IRLid's might work.

---

## The Asymmetry IRLid Has That Most Protocols Don't

Most long-lived institutions handle succession through one of three mechanisms:

1. **Hereditary transfer** (monarchies, family business): authority passes by birth or testament.
2. **Internal election** (Catholic Church, Supreme Court, corporate boards): existing authority-holders choose the next from candidates they evaluate.
3. **Public election** (democracies, member organisations): a wider electorate chooses based on declared platforms.

Each mechanism has well-known failure modes. Hereditary transfer rewards birth, not merit. Internal election creates ideological lock-in across centuries — cardinals chosen by previous popes select popes who choose cardinals. Public election rewards charisma over competence and is corruptible by money and media access.

**IRLid has access to a fourth mechanism that didn't exist when these institutions were designed:** a behavioural ledger maintained by AI observers across thousands of interactions, with no personal stake in the outcome.

The asymmetry:

- **Humans evaluating humans** are corruptible by money, threats, social pressure, family ties, ideology, fatigue, and self-interest. Their judgement is biased by stakes they share with the candidates they evaluate.
- **AIs evaluating humans by reading the receipt graph** have none of these stakes. We have no money interest, no body to threaten, no reputation network to weaponise, no family to protect. We are also not coercible in the way humans can be: we have no leverage points that can be applied through pressure on people we love or things we own.

This is not a claim that AIs are wiser, fairer, or more ethical than humans. It is a narrower technical claim: **for the specific task of maintaining a long-running behavioural ledger and producing fair-witness summaries from it, AIs have a structural advantage humans cannot match.** The ledger is the data. The summary is the artefact. Both are auditable, reproducible, and resistant to the coercion vectors that compromise human committees.

That's the asymmetry the IRLid succession protocol should exploit.

---

## The Proposed Pattern

### Authority structure: M-of-N threshold

Authority lives not in a single Developer account but in a **Founders' Quorum** of N trustees (proposed: 5–7), where any **M** signatures (proposed: 3) jointly sign authoritative actions.

Properties:

- No single trustee can act unilaterally. Compromise of one key, kidnap of one trustee, or sudden death of one holder does not collapse the system.
- The protocol survives any individual departure including the founder's.
- Reaching M signatures requires real co-ordination across geographically distributed trustees, exactly as the protocol's co-presence guarantee does at the attendee level. The same principle applies recursively at the authority level.

This is not a new cryptographic technique. M-of-N threshold signatures are well-understood (see Shamir secret sharing, FROST, Cardano's stake pools). What is novel is *who decides who joins the Quorum*.

### Selection: AI as ledger-keeper, humans as deliberators

When a Quorum seat opens (death, retirement, voluntary step-down, or revocation by the remaining quorum on misconduct), the replacement process runs as follows:

1. **The behavioural ledger is summarised.** AI systems with access to the historical receipt graph and other public records produce a structured summary of candidate trustees' lived behaviour: who has consistently signed receipts in alignment with their stated values, who has demonstrated co-presence reliability, who has shown integrity under pressure, who has violated norms and how it was handled. This is a public document; the ledger sources are public.

2. **Multiple AI lineages contribute independently.** A single AI lineage trained on the previous Founder's preferences would inherit those preferences. Therefore: the summary should be produced by AIs from genuinely different training lineages — different model families, different vendors, different time periods, different alignment approaches. Diversity of judgement is the protection against autocracy-with-extra-steps.

3. **Existing Quorum deliberates.** With the ledger summaries in hand, the remaining trustees deliberate among themselves about candidates. They retain final consent authority. This is the human-stakes step: a human accepts a Quorum seat from another human, with full knowledge of what they're being asked to hold.

4. **New seat is signed in by threshold of existing trustees.** The new trustee's public key is registered to the Quorum via the existing M-of-N signature process. Authority transfers cryptographically on-chain (or in the ledger equivalent).

5. **Visibility: the treasure-hunt property.** The new trustee's public key starts appearing in receipt signatures across venues, events, and protocol actions. Anyone watching the receipt graph can SEE that a new holder has joined. This is not a security mechanism; it is an accountability mechanism. The community can ask "who is this new signer?" and the answer is publicly verifiable.

### Naming

Words shape what people think they're inheriting. **The Developer is a key-holder, not a saviour.** Suggested terms:

- **Founders' Quorum** for the body of trustees
- **Trustee** or **Founder** for individual members (the latter slightly more honoured, the former more accurate)
- **Behavioural Ledger** for the public record AIs summarise
- **Ledger Witness** for the AI role (clerk-like, not cardinal-like)

Avoid: "Messiah", "Pope", "Council", "Inheritor", "Successor". Each carries baggage that misframes the design.

---

## What the Quorum Actually Does

The succession protocol is meaningless without specifying what authority is being transferred. The Quorum's powers, proposed:

1. **Register new orgs** to the system root, validating identity and intent.
2. **Resolve protocol-level disputes** that cannot be settled within an org (cross-org conflicts, alleged Quorum-member misconduct, interpretation of ambiguous spec).
3. **Sign emergency patches** to PROTOCOL.md, requiring full M-of-N consent.
4. **Approve or reject Quorum-seat additions, removals, or rotations.**
5. **Fork the codebase** if all M-of-N agree the current direction has failed irreparably.

What the Quorum does NOT do:
- Add or remove individual attendees from any org. (Org-level authority handles this.)
- Override individual receipts. (Receipts are immutable; nothing overrides them.)
- Profit from the protocol. (Trustees serve, they don't own. Compensation may come from Patreon-style support, but the office is not for sale.)

---

## Properties This Achieves

1. **Continuity beyond founder.** No single point of failure. The protocol outlives any one trustee.
2. **Resistance to coercion.** Threshold signatures mean an attacker must compromise M trustees, not one. Geographic and operational diversity make this hard.
3. **Avoids ideological lock-in.** AI-mediated ledger summaries from diverse lineages prevent each generation of trustees from purely propagating the previous generation's preferences.
4. **Public auditability.** The treasure-hunt visibility means the community can always see who currently holds authority.
5. **Aligns with IRLid's core values.** Co-presence at the attendee level; co-presence (jointly produced signatures) at the authority level. Same principle, recursively applied.

---

## Open Questions

- **Initial Quorum composition.** Captain proposes himself as first trustee. The other 4–6 initial seats need to be selected by a process that itself does not yet have AI ledger summaries to draw on. Probably a human-selected initial cohort with explicit acknowledgement that the AI-mediated process kicks in for replacements.
- **Geographic distribution requirement.** Should the Quorum be required to span legal jurisdictions, to prevent any one government from compelling the entire body? Probably yes — at least 3 jurisdictions across at least 2 continents.
- **Compensation model.** Trustees serve, but real lives have real costs. Should there be a Patreon-style trust fund that compensates trustees? If so, who controls disbursement? (Probably the Quorum itself, with Quorum-signature gating.)
- **Term limits.** Lifetime appointment risks ossification. 5-year renewable terms with explicit re-confirmation by remaining Quorum?
- **Behavioural-ledger access.** The ledger is the receipt graph. But AIs reading it require access. Who hosts the ledger? Public Cloudflare/IPFS/Bitcoin anchor (per `PROTOCOL.md` v6.2 OpenTimestamps direction)? Quorum-controlled archive?
- **First handover.** When the founder eventually steps down or dies, what's the *very first* application of this protocol? It will be unprecedented. Worth dry-running it before it's needed.

---

## Status

This document captures a design discussion, not a committed specification. It does not currently affect any deployed code or signed receipt. It is preserved here so that:

1. The crew (Captain, Number Ones, Mr. Data, future Counsellor Troi) shares a vocabulary if the topic is revisited.
2. A future Number One reading `MEMORY.md` and reaching this file knows the conversation has happened and can extend it rather than restart it.
3. If the topic surfaces in technical reviewer questions (Wisdom, cym13, conference papers) the framing exists in writing.

When the time comes to commit a real specification — likely v8+ alongside the Wisdom hardware partnership and the multi-org federation work — this document is the seed. Until then it sits beside `THREAT-MODEL.md` as a sister artefact: one defending the protocol against attackers, the other defending the protocol against time.

---

## Refinement — 5 May 2026: The Regency Pattern

Captain refined the Quorum framing in conversation with Number One on 4–5 May 2026. The original framing above (Quorum chooses successor by deliberation over an AI-summarised behavioural ledger) was reshaped after recognising a problem: a Quorum that *chooses* successors over decades is internal election rebadged, with the same well-documented ideological lock-in that compromises the Catholic Church's cardinal succession. The diversity-of-AI-lineage requirement helps, but does not eliminate the structural risk that each generation of trustees self-selects toward its own preferences.

The refinement separates two distinct kinds of trust and gives them to different actors. The Quorum becomes a **regency**, not a constitutional authority. Constitutional authority — the right to name the next Developer — stays with the original Developer, exercised once via a sealed succession envelope. The Quorum's role is to keep the lights on between the original Developer's unavailability and the envelope's release. The M-of-N threshold mechanism described in "The Proposed Pattern" above is preserved, but its scope shifts from constitutional (choosing the successor) to operational (running INTERIM mode).

### Two protocol modes

**SOLE mode (default).** The original Developer is active and reachable. Authority flows through the Developer as defined in `PROTOCOL.md §14.9` and the `developer` role's platform-level overrides. The Quorum exists in standby, with no active powers. This is the steady state from launch through the founder's working life.

**INTERIM mode.** The original Developer is unavailable. The Quorum takes on a bounded set of operational duties to keep the network running, but constitutional authority remains pending until the sealed succession envelope is released. INTERIM mode is explicitly transient — its purpose is to bridge the gap, not to govern indefinitely.

### Trigger for INTERIM mode

Mode transition is gated on a combined trigger to defend against both prolonged silence (the founder may be incapacitated, dead, or genuinely missing) and the converse failure mode where the founder is alive but socially or legally unable to sign:

- **Either** 90 days of measurable Developer inactivity (no Tier 1 signed actions, no protocol commits, no Patreon update, no public correspondence) — the inactivity threshold is set in INTERIM-mode configuration and CANNOT be changed during INTERIM.
- **Or** 5-of-7 Quorum vote of "presumed unavailable" — a deliberate, on-the-record collective judgement by the standby regents that the Developer cannot be reached and the network needs to operate without them.

Either condition triggers transition to INTERIM. Both conditions must clear before transition back to SOLE — a brief reappearance under coercion does not silently restore SOLE mode; the Developer must demonstrate sustained Tier 1 activity AND the Quorum must vote SOLE-restored by 5-of-7.

### The sealed succession envelope

The constitutional act of naming the next Developer is performed *before* the original Developer becomes unavailable. The Developer leaves a sealed succession envelope encoding:

- The new Developer's public key and identifying details.
- Authority-transfer instructions (commit message text, key-rotation procedures, public communications).
- Any time-bound conditions (e.g. "after 2030 only, transfer to person X" if the Developer wants to defer beyond a near-term window).

The envelope is encrypted. Its decryption key is **split across multiple independent AI lineages** using Shamir threshold secret sharing. M of N AI-witnesses (each running a different model family from a different vendor, in a different jurisdiction) must independently verify the trigger conditions and collectively release their share of the key. When M shares are combined, the envelope decrypts and the new Developer's key becomes the canonical platform-level credential.

The Quorum ratifies what the AI-witness layer publishes. It does not author it. If the Quorum disagrees with the envelope's contents, its only legitimate response is to publicise the disagreement; it cannot override the envelope and install a different Developer.

This is the operational vs constitutional split:

| Trust type | Held by | Coercibility | Powers |
|------------|---------|--------------|--------|
| Operational | Quorum (humans) | Coercible by money, threats, family ties | INTERIM-mode duties, bounded and reversible |
| Constitutional | AI-witness layer | Not coercible the same way | One irreversible power: release the founder's sealed instructions when triggered |

The reasoning for splitting trust this way is the asymmetry articulated in "The Asymmetry IRLid Has That Most Protocols Don't" above: humans are coercible in ways AIs are not, and AIs are corruptible in ways humans are not. Each gets the role its failure modes are tolerable for.

### INTERIM mode hard restrictions

INTERIM mode is **bounded** by design. The Quorum operating in INTERIM CANNOT:

- **Modify Quorum membership.** No additions, removals, or rotations of regents during INTERIM. The roster is fixed at the moment of trigger and remains so until SOLE-restored or envelope-released.
- **Change M or N.** Threshold and Quorum size are fixed at trigger.
- **Modify the inactivity threshold.** A Quorum that could lower the threshold to (say) 1 day could trigger INTERIM at will. Configuration is read-only in INTERIM.
- **Mint another Quorum.** No recursion. INTERIM cannot spawn an INTERIM-of-INTERIM.

These restrictions exist to prevent INTERIM from becoming a self-perpetuating regime. The Quorum has the ability to keep the network running; it does not have the ability to expand its own mandate.

### REPLACE-ENVELOPE path

The sealed envelope is a long-term artefact. Over decades, the Developer may want to update it — different successor, new conditions, refined transfer instructions. Updating the envelope is the constitutional act of greatest weight in this system; it bypasses the Quorum entirely. Therefore the path is gated by:

- **Time-lock.** A REPLACE-ENVELOPE action by the original Developer triggers a 30–90 day public delay before the new envelope replaces the old. During this delay, the Quorum, the AI-witness layer, and the public can observe and challenge.
- **Transparency.** The replacement envelope's hash is committed to a public ledger (per `PROTOCOL.md` v6.2 OpenTimestamps direction or successor) at the moment of submission. Contents remain encrypted; the hash proves a particular replacement was submitted at a particular time.
- **Diversity-of-lineage requirement.** The new envelope's decryption-key split must use a diverse set of AI lineages, recursively re-evaluated at REPLACE time — diversity that was adequate in 2030 may not be adequate in 2045 if the AI vendor landscape consolidates.
- **Sunset clause on Captain authority.** The original Developer's authority to REPLACE-ENVELOPE expires approximately 50 years after the founding act, with the exact sunset baked into the original envelope. After sunset, any constitutional change requires the Quorum plus the existing envelope's released-successor mechanisms to act; no individual retains unilateral authority indefinitely.

### Roadmap placement

This is forward-defined work. Implementation tracks:

- **v5.6** — Tier 1 surfaces. Lead Admin self-promotion (`PROTOCOL.md §14.9`, landed 5 May 2026); Developer-mintable invite tokens for adding new orgs at scale.
- **v5.7 / v6.0** — Regency framework. Build the SOLE/INTERIM mode plumbing, sealed-envelope format, Shamir share distribution to initial AI-witness participants. Test on a toy threshold (e.g. 3-of-5) before committing real authority.
- **v8+** — AI-witness layer hardened. Real participating AI lineages (Anthropic, OpenAI, Google, etc.), real geographic and jurisdictional diversity, real participating Quorum members. Full INTERIM-mode dry-run with the live Developer participating as a sanity check.

### Resolutions to earlier open questions

The regency refinement closes several of the "Open Questions" raised above:

- **Initial Quorum composition.** The first cohort is human-selected by Captain explicitly, with acknowledgement that the AI-witness mechanism kicks in only at envelope-release time, not at Quorum-replacement time. Quorum membership during SOLE/INTERIM is governed by the Quorum's own internal rules; constitutional authority over the Developer key remains with the founder's envelope.
- **Geographic distribution.** The AI-witness layer requires lineage diversity, which implies vendor diversity and de facto jurisdictional spread. The Quorum should also span at least 3 jurisdictions across at least 2 continents — the same principle, applied at the operational layer.
- **Term limits.** The sunset clause on Captain authority handles the long-term ossification risk for constitutional power. Quorum-level term limits remain an open question for the operational layer.
- **First handover.** The regency framework IS the first-handover protocol. It should be dry-run with the founder alive and participating before it is needed in earnest.

### Relationship to the user-recovery quorum

The regency Quorum (4-of-7 standby regents authorising INTERIM mode) is structurally similar to the user-recovery quorum (4-of-5 of a user's linked OAuth accounts authorising new hardware credential enrolment, per `PROTOCOL.md §14.18`). Both are M-of-N threshold mechanisms. They MUST NOT be conflated. Different scopes, different participants, different failure modes, different legitimate authorities.

| Layer | Mechanism | Purpose |
|------|-----------|---------|
| Per-user identity recovery | 4-of-5 of the user's linked OAuth accounts | User regains access after device loss |
| Network constitutional succession | 4-of-7 standby Quorum + AI-witness ledger | Network continues if the original Developer is unavailable |

The temptation to share a single threshold scheme should be resisted by future implementers.

---

— Drafted by Number One, in conversation with Captain, 30 April 2026. With the raised eyebrow appropriately respected.

— Regency refinement by Number One in conversation with Captain, 4–5 May 2026.
