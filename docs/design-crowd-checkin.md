# Design note: large-crowd, anonymous check-in

Status: **agreed by Spencer, not built yet.** Written 20 Oct 2026 so the reasons are kept while Donald (Imbue Ventures) is away.
Nothing in this note changes code. It is the plan to agree before anyone writes code.

## Summary (plain English)

1. Donald asked: how do we check in a large crowd of people who are not registered?
2. People do not need to register. Each phone's browser makes its own key on the spot.
3. Today a crowd would jam: each check-in code works once and only changes every 45 seconds.
4. The plan: a code that changes on every scan (with a few-second grace), shown on any number of no-touch displays.
5. Check-ins are anonymous. The name stays on the person's phone. We keep a count and a sealed fingerprint only.

---

## 1. The problem today

- The venue QR code changes every 45 seconds (`Org.html:15985`, `startVenueQrNoncePolling`).
- Each code can be used **once** (`irlid-api-org/src/index.js:4065`, "Check-in nonce already used").
- If 20 people scan the same code at once, 1 gets in and 19 are refused until the next code.
- A check-in with **no** code is still accepted as "soft" (`index.js:4099-4103`). This is review item H5 in `docs/code-review-2026-10.md`.

## 2. Decisions (Spencer, Oct 2026)

| # | Decision | Why |
|---|---|---|
| D1 | **No communal devices.** People use their own phones. Nobody touches a shared device. | Works in a pandemic. |
| D2 | **The code changes on every scan**, plus a few-second grace period. | A crowd scanning one frame all get in; a forwarded photo goes stale in seconds. |
| D3 | **Any signed-in device can show codes**: wall screen, laptop, tablet, staff member's own phone. Several at once. | More lanes for big crowds. |
| D4 | **Anonymous by default.** We keep the count, not names. | Keep personal data away from our systems. |
| D5 | **The name stays on the phone**, sealed at check-in time. | Proof without us holding names. |
| D6 | **Original records only. Never edit a record afterwards.** | Edited records can be claimed to be doctored. |
| D7 | **Fresh key per event.** | Nobody (including us) can track a person across events. |
| D8 | **No backup of proofs.** Proofs live only on the phone. Lose the phone, lose the proofs. | Nothing extra to steal, demand or leak. Login can still be recovered. |

Not chosen:
- Pre-loaded guest lists (we would hold names in advance).
- Naming people afterwards by the organiser (that is an edited record, see D6).

## 3. How it would work

### 3.1 Showing the code (D2, D3)

1. A staff member signs in on any device and opens the check-in screen.
2. That device gets its **own** stream of codes, so a scan at one door does not change the code on a screen across the room.
3. The display checks the server about once a second: "has my code been used?" If yes, it shows a new one.
4. The server still accepts the **previous** code for a short grace period (suggest 5 seconds). This lets people who scanned the same frame get in.
5. Each check-in records **which display** its code came from (for example "Wall screen 1", "Sam's phone").

### 3.2 Checking in (D4, D5, D7)

On the attendee's phone:

1. Make a **fresh key for this event** (D7).
2. If the person wants to add a name: make a long random secret, then seal `name + secret` into a fingerprint (a SHA-256 hash). Without a name, there is no fingerprint.
3. Sign the check-in (code, time, event, fingerprint) with the event key and send it.
4. **Keep the name, the secret and the event key on the phone only.** They never leave it.

Our server stores only:

- a random check-in id,
- the event and time,
- the event key's public part (to check the signature),
- the sealed fingerprint (if any),
- which display issued the code,
- "within range: yes/no" (see 3.4).

The anonymous count is simply the number of check-ins.

### 3.3 Proving it later (D5, D6)

1. The person opens their proof on the same phone.
2. They show the name and the secret.
3. Anyone can rebuild the fingerprint and see it matches the **original** check-in record from the door.
4. Nothing on the server is added or changed. The record is the one made at the door.

The random secret matters: without it, someone could guess common names and test them against the fingerprint.

### 3.4 What we stop storing

Check-ins today can store a name, `attendee_label`, `device_key_fp` (the same across events), and `gps_hash` (`irlid-api-org/schema.sql:58-73`).

- **Name and label:** not stored in this mode.
- **Long-lived device fingerprint:** replaced by the per-event key.
- **GPS:** a hash of GPS can be reversed by trying every point near the venue, so it is not really private. Store only "within range: yes/no".
- **IP addresses:** check that no check-in path stores IPs or IP hashes. Login sessions store an `ip_hash` today (`index.js` `hashIp`), which is separate.

## 4. Login is separate from proofs

The phone holds two different things:

| Thing | Used for | If lost |
|---|---|---|
| Login key | Signing in to IRLid | Sign in again (Google, or a fresh invite / re-bind). A passkey synced by the phone may survive. |
| Per-event key + secret | Proving one check-in | That check-in can never be proven as yours. It still counts in the total. |

Clearing the browser usually loses both. That is accepted (D8).

## 5. How it could be misused

| Risk | How bad | What limits it |
|---|---|---|
| **Fake name.** Anyone can type any name. | Medium | The proof shows the name was given *at the door, at that time*, not that it is real. Only an ID check proves a real name, and that brings personal data back. Label it "self-declared". |
| **One person, many check-ins** (new browser tab = new key). | Medium | Inflates the count. Fresh keys per event (D7) make "one per phone" impossible to enforce strictly. Accept for head counts; use staff checks where numbers must be exact. |
| **Forwarded photo of the code.** | Low–Medium | Code changes every scan plus a 5-second grace. Within-range check helps, but phones report their own GPS, so it can be faked (review M1, M3). |
| **Lent phone.** I give you my phone; you check in as me. | Low | Cannot be fully stopped without biometrics tied to ID. |
| **Fake check-in screen.** Someone shows their own QR. | Low | Codes are only issued to signed-in staff devices; the server rejects any code it did not issue. |
| **Lost staff phone** keeps showing codes. | Low | "Sign out all devices" already exists. Each check-in records its display, so misuse is visible. |
| **Pressure to reveal.** Someone forces a person to show their proof. | Low (but serious in humanitarian use) | No backups (D8). The person can also delete the proof from their phone. |

## 6. Questions still open

1. **Grace period length.** Suggest 5 seconds. Shorter is safer; longer is kinder to slow phones.
2. **Is "one browser = one person" good enough** for the head counts Imbue needs? If not, which events need a staff check as well?
3. **Within-range distance.** Today `distanceM` defaults to 12 m. For crowds outdoors, is that too tight?
4. **Do existing named check-ins stay as they are?** Suggest yes: this is a new event mode, not a change to current events.
5. **What happens to the existing "soft" no-code check-in (H5)?** Suggest: refuse it for events using this mode.
6. **Offline.** Without signal the phone cannot get a code. Suggest: refuse, and say so on screen, rather than accept a weaker check-in.

## 7. Rough build plan (when ready)

| Step | What | Size |
|---|---|---|
| 1 | Per-display code streams, "has my code been used?" check, 5-second grace (Worker + `Org.html`) | Medium |
| 2 | Refuse no-code check-ins for events in this mode (fixes H5 for them) | Small |
| 3 | Per-event key and sealed name fingerprint on the phone (`js/sign.js`, `scan.html`) | Medium |
| 4 | Stop storing name, long-lived fingerprint and GPS hash in this mode; store within-range yes/no and display id | Small–Medium |
| 5 | "Prove my check-in" screen on the phone, and a verify page anyone can use | Medium |
| 6 | Tests for each step, including the misuse cases in section 5 | Medium |

Each step should be its own small PR, tested before the next.
