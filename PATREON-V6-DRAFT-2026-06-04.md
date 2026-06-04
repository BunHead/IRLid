# Patreon v6 post — DRAFT substance (4 June 2026)

> **Captain — this is starting substance, not finished copy. Rewrite it in your own voice
> before posting.** It's deliberately honest (says only what the crypto actually proves) because
> that's IRLid's whole edge. Number One's "claim / don't-claim" notes at the bottom.

---

## Draft post

**IRLid v6 is live — and it can now run a whole venue.**

When I started IRLid the idea was simple: two people meet, scan each other's codes, and walk
away with a receipt that proves they were really in the same place at the same time — no app, no
account, no central gatekeeper. v6 takes that same idea and scales it up to organisations.

**What's new:**

- **An Organisation portal.** A venue can set up a weekly, multi-room calendar — classes,
  sessions, events — and run check-in from a phone. Attendees scan the event's code and they're
  in. A live dashboard shows who's checked in, capacity, and who arrived late (to the minute).

- **Proof-of-attendance that doesn't ask you to trust the venue.** Every check-in now mints a
  receipt signed by the venue's own key and bound to the attendee's device. Anyone can drop that
  receipt into our public verifier and see for themselves that it's genuine and untampered —
  the organiser can't fake it, and they can't quietly change it later either. And now those
  receipts show up in the attendee's *own* history, not just the organiser's screen.

- **No passwords, anywhere.** Staff and organisers sign in by scanning a QR with their phone and
  confirming with the phone's own hardware unlock — your fingerprint or your passcode, your
  choice. The key never leaves the device. I've been signing in this way across a little fleet of
  cheap Android phones all week.

- **Offline-safe.** It keeps working when the signal drops and syncs up when it's back — because
  the places that most need a reliable record are often the places with the worst connection.

I build this on my own, from a desktop tower and a handful of phones, and your support is what
keeps it moving. The next chapter is about delegation and trust between people — letting a venue
safely hand specific powers to its managers, and a proper in-person ceremony for appointing the
people at the very top. As ever: every extra layer is optional and off by default. IRLid only
ever claims what it can actually prove.

Thank you for being here.

— Spencer

---

## Number One's notes (claim / don't-claim)

**Safe to claim (all live + demonstrated this week):** the org portal + multi-room weekly
calendar; per-event attendance with live capacity + actual-minutes-late; independently
verifiable proof-of-attendance receipts (verify in `check.html`); receipts now in the attendee's
own history; passwordless QR + hardware-unlock sign-in; multi-device; offline-safe.

**Do NOT claim (not done / would overclaim):**
- Don't say "biometric" — say **hardware-backed / device unlock (fingerprint or passcode)**.
  WebAuthn user-verification can't distinguish a fingerprint from a PIN.
- Don't say co-presence is absolute proof — it's **strong, tamper-evident, good-faith evidence**.
- The Event-defaults knobs (require_proof, etc.) **save but don't yet enforce** — don't imply
  they gate anything yet.
- Manager-permissions + Lead-Admin appointment are **in build**, not live — the post nods at them
  as "next," doesn't claim them as shipped.

**Suggested screenshot:** a 100%-Confirmed org receipt in `check.html` (the trust gate), and/or
the live dashboard with the attendance bar + a "late" marker.
