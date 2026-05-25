# HANDOVER — v5.11.0l Strip vestigial role-assignment surfaces

**Target pill bump:** `v5.11.0k` → `v5.11.0l`
**Service worker cache bump:** `v21` → `v22`
**Live repo:** `D:\SkyDrive\Pen Drive\WEBSITES\IRLid-repo`
**Branch:** `codex/v5.11.0l-strip-role-surfaces`
**Captain's architectural framing:** "Staff are meant to be invited elsewhere, so get rid entirely as this method should only add attendee's." Role assignment lives in `org_memberships` and is created via Settings → Staff & Rooms → Invite Staff (single-use QR). Every other surface that assigns role is vestigial from an older architecture and creates UI confusion + payload surface bugs.

---

## 1. Two surfaces to strip

### 1.1 Escalation modal "Add at the door" panel (in `Org.html`)

The escalation modal that opens when staff scan an attendee's orange device-key QR contains an "Add at the door" panel. Currently this panel has:

- Heading: "Add at the door"
- Subtitle: "Create a new entry with this device already bound."
- **Role chip row: Attendee / Staff / Manager / Lead admin** ← STRIP THIS
- First name input
- Surname input
- Add Attendee button (green)

**After strip:** heading → subtitle → First name input → Surname input → Add Attendee button. That's it. No role chips. No role selection UI.

The underlying JS mechanism (`doormanEscalationRole` variable, `roleKeyFromLabel()` helper) can stay in code — it'll just always evaluate to `'attendee'` since there's nothing to set it to anything else. Or you may simplify by removing those references entirely. Either is fine; Captain prefers the cleaner removal.

### 1.2 Dashboard "Expected attendee management" cold-add panel (in `Org.html`)

The bottom of the Dashboard tab has an "Expected attendee management" expander. Currently the cold-add panel shows:

- "Expected attendee management" heading + "(Staff add, Manager+ delete)" subtitle
- First Name input
- Surname input
- **Add button + "Attendee" dropdown (with roles)** ← STRIP THE DROPDOWN
- "When identity is unclear" help text on the right

**After strip:** First Name input → Surname input → Add button (no dropdown next to it). Always creates an attendee.

The "(Staff add, Manager+ delete)" subtitle can stay — it describes WHO can add (any staff or above) and WHO can delete (Manager+). The role description in that subtitle is about permissions, not about the role of the entry being created.

---

## 2. Worker change (`irlid-api-org/src/index.js`)

In both `createAndBindExpected` (for the door path) and whatever handler creates Expected attendees from the cold-add panel (likely `addExpected` or similar — find it):

- **Default `role` to `'attendee'`** when the field is absent from the payload
- **If the field IS present but value isn't `'attendee'`**, force-coerce to `'attendee'` and log a warning. These two endpoints are now attendee-only by design. Non-attendee role assignment moves to the (existing) Invite Staff endpoint.

Worker should accept payloads with NO role field (since frontend will no longer send one).

---

## 3. Out of scope (do NOT change)

- **Invite Staff flow** (Settings → Staff & Rooms → Invite staff button) — that's the canonical staff-onboarding path and stays as-is.
- **Sign-in / org-login.html** — staff sign-in flow is correct.
- **Role gating in dashboard UI** (`effectiveRoleRank()` helper, role-pill rendering, etc.) — already works, leave alone.
- **The escalation modal's Choose-from-List section** — Bind path is fine, only the Add-at-the-door panel needs the chip strip.
- **All v5.11 Settings UI work** — that's v5.11.0m, separate brief.
- **The `doormanEscalationRole` JS variable** can be left in place if its removal would cascade — Captain prefers cleaner but doesn't require it.

---

## 4. Pill + cache bumps

After all code changes:
- `Org.html` build pill: `v5.11.0k` → `v5.11.0l`
- `sw.js` `CACHE_VERSION`: `irlid-shell-v21` → `irlid-shell-v22` with comment

---

## 5. Acceptance criteria

After Captain merges + pulls + `wrangler deploy`s + hard-refreshes + closes/reopens phone tabs:

1. **Escalation modal "Add at the door" panel:** Role chips GONE. Panel renders: heading → subtitle → First name → Surname → Add Attendee button. Nothing else.
2. **Dashboard Expected attendee management cold-add panel:** Role dropdown next to Add button GONE. Panel renders: First Name → Surname → Add button (no dropdown).
3. **Add Attendee via door path** (Test 2 from `memory/demo-smoke-test-2026-05-25.md`): still works end-to-end, attendee created with role=attendee.
4. **Add via dashboard cold-add path** (Test 1 lifecycle): still works end-to-end, attendee created with role=attendee.
5. **Build pill reads `v5.11.0l`.**

---

## 6. Codex prompt template (Captain pastes verbatim)

```
Read HANDOVER-StripRoleSurfaces-v5.11.0l.md at repo root and execute.

Branch: codex/v5.11.0l-strip-role-surfaces
Open PR against main when complete.
Reply with PR number + one-paragraph confirmation of what was removed and what was left in place.
```

---

— Number One, drafted 25 May 2026 evening
