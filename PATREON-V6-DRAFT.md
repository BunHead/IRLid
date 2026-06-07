# Patreon Post — v6 Update Draft
*Substance for Captain — rewrite in your own voice before posting*

---

**Subject line options:**
- "v6 is live — you can now prove you were there"
- "IRLid v6: check in, get a receipt, verify it forever"
- "The bit Patreon supporters asked for is finally here"

---

**Draft body:**

Something just landed that I've wanted to build since the beginning.

When someone checks in to an event using IRLid, they now get a receipt. Not a screenshot — an actual cryptographically signed receipt, tied to the specific check-in, signed by the venue's private key. You can open it on any device, share the link, and anyone can independently verify it at irlid.co.uk/check.html. No login. No central database to trust. Just the maths.

I tested it on myself. Checked in, hit the receipt link, watched it come back 100% Confirmed with all four checks passing — org receipt structure, venue public key present, venue signature, attendee device bound. It works.

This is the thing that makes the whole org check-in system honest. The venue can't retroactively change who was there. The attendee has proof. Neither needs to trust the other — or me — because the receipt stands on its own.

What else shipped in v6:

**Calendar.** Organisations can now set up recurring events — yoga on Mondays at 9, swimming on Thursdays at 6pm — and the check-in system knows which event an attendee belongs to. Per-event expected lists, per-event attendance records. Exactly what a gym, studio, or community group actually needs.

**What's next:** wiring the desktop admin flow so that adding events and inviting staff can be authorised from your phone rather than requiring a hardware credential on the computer. That's the next push.

If you want to try the receipt flow: check in at any IRLid venue (or ask me for a test link) and hit the receipt button in the dashboard. The verification page will show you exactly what it's signing.

Thank you for being here for this one. It's been a long road to "independently verifiable."

---

*Notes for Captain:*
- The "four checks passing" detail is real and specific — keep it if you want to sound technical-honest
- "I tested it on myself" is the tone that lands with this audience — they've followed the journey
- The "100% Confirmed" line is a direct quote from the UI, which is satisfying
- Keep it short — under 300 words in final form is better for Patreon
- Don't post until after v6.1.1 lands (event-save bug is still open — don't invite people to try calendar yet)

