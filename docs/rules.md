# IRLid rules (v3.1)

25 Oct 2026. Spencer's decisions up to today, with Number One's review.

- **This is the single source of IRLid rules.** Every AI reads it before any job (W1). If another doc disagrees, this file wins and the other doc gets fixed (W7).
- Only Spencer changes a rule. Propose changes in a PR; never edit a rule as a side effect of other work.
- Groups and rules are ordered biggest impact first.
- Rule numbers are kept stable. A retired number says where it went.
- "(default)" means Spencer had no preference, so the recommended answer stands until he says otherwise.
- **To do:** another model (e.g. Reg) reviews this version, not Claude.

## 1. Security (13)

- **S1. Check every signature, live or when a queued check-in syncs. A forged or invalid signature is always refused.**
  - Why: fakes must never get in. A signature check needs no internet.
- **S2. A public key or key ID never signs anyone in.**
  - Why: keys sit in every receipt.
- **S3. Keys never leave the phone (hardware keys from v5).**
  - Why: stolen keys mean fake proofs.
- **S4. Admin needs a hardware key (portal login is v5 only). Google or email alone is never enough.**
  - Why: email gets hacked.
- **S5. Big admin steps need a fresh staff scan, in person, with no email or code shortcut.**
  - Why: meeting in person is the moat.
- **S6. Codes are single use: login QRs, link codes and assist requests (5 minutes).**
  - Why: stops replays.
- **S7. Link codes have an attempt limit.**
  - Why: 6 digits can be guessed.
- **S8. Google is linked only to a verified email.**
  - Why: people can edit their email.
- **S9. The org key never goes in a QR.**
  - Why: QRs get photographed.
- **S10. Admin actions are never queued offline.**
  - Why: a stale admin action is unsafe.
- **S11. Org text never goes into innerHTML. Partner sites check where messages come from.**
  - Why: stops script attacks.
- **S12. Sessions are random tokens. An IP address never decides access.**
  - Why: IPs change and can be faked.
- **S13. Never trust what the phone says about itself (trust score, bioVerified, "offline" flag, its clock). The server checks for itself.**
  - Why: a phone can send anything.

## 2. Offline and check-in (15)

- **C1. Check-in must work with no internet.**
  - Why: Wi-Fi drops, and remote areas have none.
- **C2. When freshness checks can't run (no signal, no code, queued), accept, mark "offline / unverified", never refuse.**
  - Why: no one gets lost in an outage.
  - The signature is still checked (S1).
- **C3. Merged into S1 (default).**
- **C4. Scanning again while checked in says "You're already signed in" and offers check-out. Check-out asks first.**
  - Why: someone just arriving doesn't want to leave.
- **C5. Event times use the venue's local time. Refuse on time only when a live code proves the time. Static, queued and drone scans get an "outside event times" flag instead. Orgs with no events skip the check.**
  - Why: the live code is the server's own clock; the phone's clock can't be trusted (S13).
  - **Needs revisit.** Staff rule still open (question 1).
- **C6. The static QR and doorman mode keep working offline. The printed or static venue QR carries the venue (from the Orgs tab), signed by the org.**
  - Why: the backup when the screen or Wi-Fi fails, and the phone knows the venue with no signal.
  - Honest limit: the signature proves the QR is the org's, not that the scan happened at the venue. A photo works anywhere; the GPS flag is the only hint.
  - Org side only. Only the printed/static QR grows (~30 characters plus the signature); check against QR-SLIMMING-SPEC. The live screen QR stays slim.
- **C7. Queued check-ins sync later, however late, and are never dropped silently. Show "N waiting".**
  - Why: phones can be offline for days.
- **C8. Never send a final error on a path the queue replays.**
  - Exception: a bad signature on sync is quarantined with a visible notice, never dropped silently.
  - Why: the queue throws those away, but fakes must not land.
- **C9. Offline check-ins are never shown as "fresh".**
  - Why: be honest about trust.
- **C10. GPS only flags near / far / none. It never refuses. No raw position and no GPS hash is kept.**
  - Why: GPS is patchy and private. A hash of rounded GPS near a known venue can be reversed.
- **C11. Crowd mode is off by default. When it's on, the code changes after every scan with a 5 s grace.**
  - Why: lets a crowd in fast.
- **C12. The phone signs its own time and the server notes when it arrived. Phone time is recorded and flagged, never trusted. Flag big gaps.**
  - Why: offline clocks can be faked.
- **C13. Never lose or double-count a real check-in. A settings error never blocks check-in.**
  - Why: the count must be right.
- **C14. A used, expired or stale code is accepted as "offline", in every mode (default).**
  - Why: refusing it adds no security while a no-code scan gets in. Matches crowd mode and the static QR.
- **C15. When a new signing requirement ships, check-ins made by old cached pages or already queued on phones land as "offline / unverified" until a set cutoff (a server date), then the new requirement applies (default).**
  - Why: a fix must not strand real check-ins made before it.

- **C16. Offline time is backed by clocks agreeing, never by one clock alone: the phone, a signing venue device, and the phone's drift learned when last online. The server's arrival time is the latest it can have happened.**
  - Why: faking time means changing two clocks, not one.
  - Labels: "offline, times agree" ranks above "offline, times disagree"; both rank below "fresh".
  - Org side only. The 1-on-1 handshake already checks both signed times (90 s).
  - A printed QR has no clock, so this needs a signing venue device.

## 3. Records and data (9)

- **R1. Never edit a record.**
  - A fix or auto check-out adds a new linked note (what, when, why).
  - Check-out fields are filled once and never changed.
  - Exception: "Delete record" and "Clear attendance" are deliberate erasure. The log records that it happened (who, when, how many rows), never the erased data (default).
  - Why: edited records look doctored, but people can still erase data on purpose.
- **R2. Old receipts stay valid forever. Old v3 phones always work. Anything newer is optional, off by default, and can change the score, never validity.**
  - Why: old proofs and everyday phones must still work.
- **R3. Keep data small: name, device ID, time and venue. GDPR is the org's job.**
  - Why: less data, less risk.
- **R4. Database changes only add things. Old rows are never backfilled.**
  - Why: the originals stay original.
- **R5. The audit log never blocks an action and can't be edited.**
  - Why: the trail must be true.
- **R6. Auto check-out is marked "auto" and has no trust score.**
  - Why: it isn't a person's proof.
- **R7. Never use IRLid to watch staff performance.**
  - Why: staff trust.
  - Source not found yet (question 2).
- **R8. Never strip GPS from consumer handshake receipts. Org receipts keep only the GPS band (C10).**
  - Why: consumer re-checks broke before.
- **R9. Face witness (v5.x) is off unless both people say yes, every time. If either says no, the handshake still works with a lower score.**
  - Why: consent, and honesty about what is captured.
  - Prompt: "Take a photo of [name] for this record? Only a fingerprint of the photo is saved. The photo stays on your phone. Ask them first."
  - The other person sees: "[Name] wants a photo of you for this record. Yes / No."
  - Affects the 1-on-1 side: adds ~43 characters to that half of the QR, only when used.

## 4. Roles and admin (5)

- **A1. Exactly one Lead Admin per org. A handover replaces them in one step, in person, with Spencer (Developer, super admin) appointing and fixing problems.**
  - Why: one person in charge, never orphaned.
  - Ratified 30 May. Overlap idea: question 3.
- **A2. Role names in the database never change, only labels. Developer can't be handed out.**
  - Why: stops role grabs.
- **A3. Change a role by re-inviting. Only the Lead Admin or Developer removes people.**
  - Why: a clean trail.
- **A4. Manager powers are off by default. Managers can never be given invite power or the permissions settings.**
  - Why: limits damage.
- **A5. Attendees never see the guest list or dashboard. Deny screens show no other names.**
  - Why: privacy.

## 5. Interface (6)

- **I1. Claim only what the crypto proves ("signed record", not "proves presence").**
  - Why: honesty.
- **I2. Hide anything not working yet. Placeholders never pretend.**
  - Why: trust.
- **I3. No spinners. Show sync as a small dot or counter.**
  - Why: feels instant.
- **I4. Debug and setup tools are hidden from customers.**
  - Why: keeps it clean.
- **I5. Full accessibility (ARIA) everywhere.**
  - Why: everyone can use it.
- **I6. No demo events for a real org.**
  - Why: looks broken otherwise.

## 6. Ease of use (5)

- **E1. Check-in is just scanning a QR. No how-to sheet.**
  - Why: anyone can do it.
- **E2. Remove anything unused.**
  - Why: less to go wrong.
- **E3. Don't build for problems that don't exist yet.**
  - Why: keep it small.
- **E4. Event defaults never get stricter on their own.**
  - Why: no surprise refusals.
- **E5. Use the phones and screens the venue already has. No devices we supply (doorman and kiosk screens are fine).**
  - Why: cheap and clean.

## 7. How the AIs work (10)

- **W1. Read this file and docs/requirements/offline-first.md before any job.**
  - Why: AIs forgot the rules before.
- **W2. A new branch and a PR every time. Never main. The AI never merges. Spencer merges each PR by name.**
  - Why: Spencer stays in control.
- **W3. Run all tests. Every S, C, R and A rule gets a test.**
  - Why: tests catch what reading misses.
- **W4. Never guess. Test on a real phone.**
  - Why: past "fixes" didn't work.
- **W5. Keep to scope and budget. Don't touch other branches.**
  - Why: no extra cost.
- **W6. "Incorporate" means write it down, not build it.**
  - Why: no surprise work.
- **W7. Never let two docs disagree.**
  - Why: one truth.
- **W8. Bump the build and cache version on every page change.**
  - Why: phones get the update.
- **W9. Don't approve your own brief or review. Write plain-English PR summaries.**
  - Why: honest, easy review.
- **W10. Follow the ops traps list (kept by Spencer; ask for it before Worker, wrangler or D1 work).**
  - Why: each one broke something before.

## Open questions (pending Spencer)

1. **Staff and event times.** Recommended: exempt staff-tier roles, flag their check-in "outside event times", no separate window (E3). The exemption must rest on a signed staff session, not a device match.
2. **R7 source.** Keep it and note where it was agreed, or drop it?
3. **Lead Admin handover.** Keep the one-step Replace, or build a two-admin overlap?
4. **C5 revisit.** Check it against drone and static-QR use once those are live.
5. **Defaults to confirm:** C3 (merged into S1), C14 (stale code accepted as offline), C15 (grace period after a new signing requirement), the local-time part of C5, and the R1 erasure log.
6. **Drones (parked until there's a drone partner, E3).** The drone is the second device: it signs a fresh HELLO or scans the recipient's QR. Its GPS clock backs the time (C16). At the drop point, only a printed QR can be assumed, so the drone's photo of it in place is the evidence; a fingerprint of the photo goes in the drone's signed half. Proves what the drone saw, not who was there.
7. **Mr Data's environment:** on hold until he has a job.
8. **Assist nonce wording in PROTOCOL:** tidy it up.
