# ACCESSIBILITY-SPEC.md

**Author:** Number One.
**Drafted:** Saturday 23 May 2026, morning watch (post-T4.3.56 merge).
**Status:** Draft for Captain's review.
**Scope:** Site-wide accessibility for all IRLid surfaces — `scan.html`, `OrgCheckin.html`, `accept.html`, `receipt.html`, `org-entry.html`, `org-login.html`, `check.html`, `widget.html`, `demo-login.html`, plus any future page.
**Companion docs:** `PROTOCOL.md`, `THREAT-MODEL.md`, `CLAUDE.md`. This spec sits at the same architectural tier — a long-term commitment with phased implementation, not a wishlist.

---

## §1 — Why

IRLid is a proof-of-co-presence tool. By design, it's used by *people meeting in physical space* — a domain where accessibility isn't optional. A blind user attending a community event needs to check themselves in. A user with motor impairment needs to scan a QR without precise phone-positioning. A user with vestibular sensitivity shouldn't be flashed with celebration animations they didn't ask for. A user with low vision needs WCAG-conformant contrast across every surface.

The product also has structural reasons to take accessibility seriously beyond user need:

- **Humanitarian use cases** (the ASE Tech proof-of-delivery angle, prison handovers, custody chains in `PROTOCOL.md §10.4`) frequently involve users with disabilities — a refugee resettlement context disproportionately serves disabled people; a custody-chain context includes incarcerated people whose accommodations are limited.
- **Institutional buyers** (universities, hospitals, councils, NGOs) require WCAG 2.2 AA conformance to procure. "WCAG 2.2 AA in progress, here's the roadmap" is a real procurement-grade differentiator versus competing handshake/check-in tools.
- **W3C Web Accessibility Initiative (WAI)** standards are the international baseline. Maintaining conformance protects against future legal exposure (EAA 2025 in the EU, ADA Title III litigation in the US, Equality Act 2010 in the UK).
- **The protocol's design ethos** — privacy-first, opt-in, no central authority — extends naturally to accessibility-first. The same architectural humility that says "we don't store your face by default" says "we don't assume you can see the screen."

Accessibility is a first-class feature, not a polish layer.

---

## §2 — Scope

**In scope (this spec):**

- User-level accessibility preferences (per-device, localStorage-backed, opt-in)
- Org-level accessibility defaults (admin-set, D1-backed, for shared/kiosk devices)
- Per-surface implementations across every IRLid page (see §6)
- WCAG 2.2 AA conformance roadmap (see §7)
- Formal certification pathway (see §8)

**Out of scope (v6+ or deferred):**

- Full WCAG AAA conformance (impractical on most interactive interfaces; aspirational)
- Sign language video instructions (deferred — needs production budget)
- Braille display testing (deferred — niche, expensive lab time)
- Multi-language i18n / localisation (separate spec; relates but distinct from accessibility)
- AT (assistive technology) device testing labs beyond NVDA / JAWS / VoiceOver / TalkBack on consumer hardware

---

## §3 — Architecture

### 3.1 — Storage model

Two layers, mirroring the existing user/org separation in `PROTOCOL.md §14`:

**User-level (per-device, localStorage):**
```
Key:   irlid_a11y_v1
Value: JSON blob (see §4 for shape)
Scope: One device, one user — the preferences travel with the device, not the user identity.
```

**Org-level (D1, admin-configurable):**
```
Table:  org_accessibility_defaults
Schema: { org_id, defaults_json (TEXT), updated_at }
Scope:  Kiosk / shared-device default state — when a tablet is the venue check-in device,
        these defaults apply unless overridden by a per-device user preference.
```

The user-level layer always wins. The org-level layer is a sensible starting state for devices that don't have a per-user preference yet (e.g. a freshly-deployed kiosk).

### 3.2 — Shared module

Single JS module loaded by every IRLid page:

```
js/accessibility.js
```

Responsibilities:
- Read/write the localStorage key (`irlid_a11y_v1`)
- Read org-level defaults from the Worker on first paint (cached in localStorage with TTL)
- Expose a `window.irlidA11y` object with: settings getter/setter, event emitters when settings change, helper functions for each feature (e.g. `irlidA11y.announce(message)` for TTS, `irlidA11y.beep(intensity)` for audio cues, `irlidA11y.vibrate(pattern)` for haptic)
- Respect the OS `prefers-reduced-motion` and `prefers-color-scheme` media queries as fallbacks when no explicit user preference is set
- Provide a settings UI component that any page can mount (`<div id="irlid-a11y-panel"></div>` placeholder, populated by the module)

The module is small (target <8KB minified), no external dependencies, vanilla JS so it works in every browser IRLid supports.

### 3.3 — Settings UI placement

**Primary placement:** every page gets an accessibility icon in a consistent location (top-right of the viewport, alongside any sign-out or settings affordance). Clicking opens the settings panel as a modal.

**Secondary placement:** the org dashboard's Settings panel gets an "Accessibility" tab (the 8th tab, after Records & ID) for admin-configurable org-level defaults.

**Tertiary placement:** OS prefers-* media queries — the module honours `prefers-reduced-motion: reduce`, `prefers-color-scheme: light/dark`, `prefers-contrast: more`, and `forced-colors: active` as defaults when the user hasn't explicitly set a preference in IRLid.

---

## §4 — User-level settings

The JSON shape stored under `irlid_a11y_v1`:

```json
{
  "version": 1,
  "meta": {
    "adoptOsSettings": true     // master switch — when true, OS prefers-* media queries supply defaults.
                                // Flips to false automatically the moment the user touches any explicit toggle below.
                                // User can manually flip back to true to re-adopt OS defaults.
  },
  "audio": {
    "scanBeep": false,          // proximity beep on scan.html (faster as QR centres)
    "beepVolume": 0.5,          // 0.0 to 1.0
    "tts": false,               // Web Speech API status announcements
    "ttsVoice": null,           // null = browser default, or specific voice name
    "ttsRate": 1.0,             // 0.5 to 2.0
    "outcomeSounds": true       // distinct accept/deny tones (already partially shipped)
  },
  "haptic": {
    "enabled": false,           // navigator.vibrate() for status changes
    "intensity": "medium"       // "light" / "medium" / "strong" — maps to vibration ms
  },
  "motion": {
    "reduced": false,           // disable celebration animations
    "celebrationDuration": 3.0  // seconds (range 0.5 - 10)
  },
  "visual": {
    "highContrast": false,      // pure black/white, no tints
    "largeText": false,         // 1.25x base size site-wide
    "focusRingThick": false,    // 3px focus rings instead of 2px
    "colorBlindSafe": true      // pair colour with icon/text where colour conveys meaning
  },
  "input": {
    "longPressEnabled": false,  // long-press to scan (motor-impairment friendly)
    "longPressDuration": 1.5,   // seconds
    "stickyFocus": false        // prevent accidental focus loss in modals
  },
  "scanner": {
    "largeReticle": false,      // 2x scan target area
    "voicePrompts": false,      // TTS: "Move phone closer", "Hold steady"
    "successAudio": true,       // separate accept/deny tones (distinct from outcomeSounds above)
    "showDecodedText": false    // for low-vision: show large text of what was scanned
  }
}
```

Defaults are deliberately conservative — most features start `false`. Users opt in. The exceptions (`colorBlindSafe: true`, `outcomeSounds: true`, `successAudio: true`) are zero-cost defaults that benefit everyone and have no downside if you don't need them.

---

## §5 — Org-level settings

The `org_accessibility_defaults.defaults_json` shape is identical to the user-level shape — it's the same JSON. Admins can pre-set sensible defaults for their venue's primary check-in devices.

Examples of org-level configurations:

**A care home venue:**
```json
{
  "audio": { "scanBeep": true, "tts": true, "beepVolume": 0.7 },
  "haptic": { "enabled": true, "intensity": "strong" },
  "motion": { "reduced": true },
  "visual": { "highContrast": true, "largeText": true, "focusRingThick": true },
  "scanner": { "largeReticle": true, "voicePrompts": true }
}
```

**A music venue with strobing lights already present:**
```json
{
  "motion": { "reduced": true }
}
```
(Disables IRLid's own celebrations because the room is already flashing — accumulating triggers is the risk.)

**A school registering young children:**
```json
{
  "audio": { "outcomeSounds": true, "tts": false },
  "visual": { "largeText": true }
}
```
(Bigger text + sound feedback but no TTS, since kids may be confused by it.)

The pattern: orgs set sensible defaults for their primary use case; individual users override per-device.

---

## §6 — Per-surface implementations

Each IRLid page implements the user/org settings in surface-specific ways.

### 6.1 — `scan.html` (universal QR ingress)

The headline accessibility surface. Highest investment.

- **Proximity beep** (`audio.scanBeep`): Web Audio API generates beep pulses. Beep interval is inversely proportional to scan confidence: silent when no QR candidate, slow (~1Hz) when a finder pattern is partially detected, faster (~3Hz) as the candidate region grows + stabilises, locked tone on successful decode. Volume controlled by `audio.beepVolume`.
- **TTS announcements** (`audio.tts`): "Scanner ready" on init, "QR detected, processing" on decode, "Welcome back, [name]" on accept, "Sorry, scan didn't work — please try again" on fail.
- **Voice prompts for positioning** (`scanner.voicePrompts`): "Move phone closer", "Hold steady", "Almost there" — derived from the same scan-confidence signal as the beep.
- **Haptic feedback** (`haptic.enabled`): single pulse on QR detect; distinct accept (one long buzz) vs deny (three short buzzes) patterns on outcome.
- **Large reticle** (`scanner.largeReticle`): 2x scan target area + bold high-contrast border instead of the current subtle finder.
- **Show decoded text** (`scanner.showDecodedText`): a large-text overlay shows the decoded QR's resolved identity (name / role / status) for low-vision users who can hear/feel the success cue but want to verify visually.

### 6.2 — `OrgCheckin.html` (organisation dashboard)

The staff-facing surface. Keyboard nav is the biggest gap here.

- **Reduced motion** (`motion.reduced`): celebration animations on accept/deny become static colour banners; the bouncing/pulsing pills become static; the "Welcome back" toast stays visible 3s with no movement.
- **Large text** (`visual.largeText`): root font-size bumps from 14px to 17.5px (1.25x); all relative units scale; layout reflows.
- **High contrast** (`visual.highContrast`): pure-white background, pure-black text, no tinted card surfaces, no shadow effects. WCAG AAA contrast (7:1) where AA was 4.5:1.
- **Focus rings thick** (`visual.focusRingThick`): 3px solid focus indicators with offset, visible on every focusable element. Default 2px.
- **Keyboard nav** (always-on, no toggle): Tab walks through every interactive element in logical order; Escape closes modals; Enter activates buttons; arrow keys navigate tab lists; Space toggles checkboxes. Tab order audited.
- **Screen reader announcements** (always-on via `aria-live="polite"` regions): the existing "Saved" pulse is one example; add similar regions for the Attendance table updates ("Spencer Austin checked in"), the role-toolbar state, and the dashboard refresh state.

### 6.3 — `accept.html` / `receipt.html` (receipt display / verification)

The post-scan landing surfaces.

- **Reduced motion**: no animated badges, no transitions.
- **Large text**: same 1.25x scale.
- **High contrast**: same overrides.
- **TTS**: on `accept.html` load, "Receipt accepted. Score [N] percent. Welcome." On `receipt.html` verify, "Receipt verified at [N] percent confidence."
- **Show decoded text**: receipt contents shown in large readable text (already mostly OK; some date/hash labels need a bigger-text override).

### 6.4 — `org-entry.html` (venue check-in landing)

The attendee-facing landing after a venue QR scan.

- **TTS**: "Welcome, scanning..." on init, "Welcome back, [name]" on recognition, "Please see staff" on orange-state (already in current copy but TTS-spoken).
- **Reduced motion**: orange-state QR doesn't animate; green-state celebration is static.
- **Large reticle / show decoded text** when scanning the orange QR back to staff: relevant settings apply.

### 6.5 — `org-login.html` (staff sign-in QR)

The staff-facing WebAuthn handshake.

- **TTS**: "Sign-in QR ready" on display, "Approval received" on claim, "Sign-in failed" on error.
- **High contrast / large text**: standard overrides.

### 6.6 — `widget.html` (embeddable iframe)

The reCAPTCHA-style co-presence verification.

- All user-level settings inherited from the parent page when possible (postMessage to read parent's `irlid_a11y_v1`).
- Standard high contrast / large text / reduced motion overrides.

### 6.7 — `check.html` (third-party receipt verification)

The lightweight verifier page.

- Standard high contrast / large text / reduced motion overrides.
- TTS: "Verifying..." on submit, "Verified at [N] percent" on result.

### 6.8 — `demo-login.html` (reCAPTCHA-style demo)

- Inherits all user-level settings.
- Standard overrides.

---

## §7 — WCAG 2.2 AA conformance roadmap

Where we currently stand, mapped against the WCAG 2.2 AA success criteria most relevant to IRLid's interaction model:

| WCAG criterion | Current status | Path to conformance |
|----------------|----------------|---------------------|
| 1.1.1 Non-text Content (A) | Partial — most images have alt text, QR codes need explicit "QR code for [purpose]" | Audit pass on all `<img>` and decorative SVGs |
| 1.3.1 Info and Relationships (A) | Partial — `role` attributes shipped during mockup work | Continue ARIA application in live port; audit semantic HTML |
| 1.4.3 Contrast (Minimum) (AA) | **Met** | 4.5:1 contrast applied across v5.11.1 cosmetic cleanup + T4.3.55 light-mode pills + T4.3.56 polish. Documented in briefs. |
| 1.4.10 Reflow (AA) | Likely met (responsive design throughout) | Verify at 320 CSS pixels viewport |
| 1.4.11 Non-text Contrast (AA) | Partial — focus indicators meet but some icon-only buttons may not | Audit pass on iconography |
| 1.4.12 Text Spacing (AA) | Unknown | Test with UA stylesheet override at 1.5x line-height, 0.12em letter-spacing |
| 1.4.13 Content on Hover or Focus (AA) | Met (tooltips dismissible, no time-out) | — |
| 2.1.1 Keyboard (A) | **Gap** | Full keyboard nav audit needed |
| 2.1.2 No Keyboard Trap (A) | Likely met (no custom focus traps yet) | — |
| 2.1.4 Character Key Shortcuts (A) | Met (no keystroke-only shortcuts) | — |
| 2.2.1 Timing Adjustable (A) | **Gap** — the 90s timestamp window in protocol isn't user-adjustable | Add a Settings option to extend (within security bounds); document the trade-off |
| 2.2.2 Pause, Stop, Hide (A) | **Gap** — celebration animations not user-pausable | Honour `motion.reduced` setting from §4 |
| 2.3.1 Three Flashes (A) | Likely met (no flashing >3Hz) | Audit celebration animations against threshold |
| 2.4.1 Bypass Blocks (A) | **Gap** — no skip-to-content links | Add to every page header |
| 2.4.3 Focus Order (A) | Likely met (DOM order matches visual order) | Verify with screen reader walk |
| 2.4.4 Link Purpose in Context (A) | Met | — |
| 2.4.5 Multiple Ways (AA) | Met (sidebar nav + tab nav) | — |
| 2.4.6 Headings and Labels (AA) | Mostly met (Title Case audit shipped in T4.3.56) | Continue at live port |
| 2.4.7 Focus Visible (AA) | Met (browser default focus rings) | `visual.focusRingThick` upgrades when user opts in |
| 2.5.1 Pointer Gestures (A) | Met (no multi-finger gestures) | — |
| 2.5.2 Pointer Cancellation (A) | Likely met (click on `mouseup` semantics) | — |
| 2.5.3 Label in Name (A) | Mostly met | Audit any `aria-label` that differs from visible text |
| 2.5.4 Motion Actuation (A) | Met (no shake/tilt input) | — |
| 2.5.5 Target Size (AAA, but worth pursuing) | Partial — 44×44px in most places | Full audit at live port |
| 2.5.7 Dragging Movements (AA, WCAG 2.2 new) | Met (no drag-required interactions; the celebration drag-to-reorder is non-essential UI) | — |
| 2.5.8 Target Size (Minimum) (AA, WCAG 2.2 new) | Partial | 24×24px minimum audit |
| 3.1.1 Language of Page (A) | **Gap** — `<html lang="en">` may be missing on some pages | Add to every page |
| 3.2.1 On Focus (A) | Met | — |
| 3.2.2 On Input (A) | Met | — |
| 3.2.6 Consistent Help (A, WCAG 2.2 new) | **Gap** — no consistent help mechanism yet | Add an "Accessibility help" link in the accessibility panel itself |
| 3.3.1 Error Identification (A) | Partial | Audit error messages |
| 3.3.2 Labels or Instructions (A) | Met | — |
| 3.3.7 Redundant Entry (A, WCAG 2.2 new) | Met (auth flow doesn't ask for repeat info) | — |
| 3.3.8 Accessible Authentication (AA, WCAG 2.2 new) | **Strongly met** — IRLid's v5 hardware-backed signing IS the accessibility win here. No passwords. No memory burden. The biometric IS the auth. | — |
| 4.1.2 Name, Role, Value (A) | Partial — ARIA in progress | Continue at live port |
| 4.1.3 Status Messages (AA) | Partial — `aria-live="polite"` on saved pulse | Extend to dashboard updates |

**Honest summary:** we're already at **partial AA** with the contrast work + some ARIA + the protocol-level v5 hardware-auth accessibility win. The main gaps are keyboard nav, reduced motion, skip links, screen reader testing, and a couple of WCAG 2.2 newcomers (3.2.6 Consistent Help). All are tractable; none require architectural rewrite.

**Target:** WCAG 2.2 AA self-certified by end of v5.12. Third-party audit thereafter as a polish gate.

---

## §8 — Formal certification pathway

The W3C does not directly certify websites. The certification ecosystem looks like this:

**Tier 1 — Self-certification (free, immediate):**
- VPAT (Voluntary Product Accessibility Template) — a self-completed document declaring conformance level per WCAG criterion. Sufficient for most institutional procurement (universities, NGOs, local government).
- Embed an "Accessibility statement" page on irlid.co.uk (legally required in the UK for public sector use under the 2018 Regulations; good practice for everyone).
- Run automated tools: axe DevTools (free browser extension), WAVE (free), Lighthouse Accessibility audit (built into Chrome). Document the green pass.

**Tier 2 — Third-party audit (paid, definitive):**
- Deque (creators of axe) — comprehensive audit, ~£8K-15K depending on scope.
- Level Access — similar tier.
- TPGi — similar tier.
- AbilityNet (UK charity) — cheaper, sometimes pro-bono for small NGOs.

A Tier 2 audit gives the formal "WCAG 2.2 AA conformant — audited by [firm]" claim that procurement teams actually trust.

**Tier 3 — Living certification (paid, ongoing):**
- Recertification annually as WCAG evolves and the site changes.
- Issue-tracking embedded in the dev process.

**Recommended path for IRLid (in order):**

1. **Now (v5.11–v5.12):** Self-certification via VPAT. Embed accessibility statement page. Run axe + Lighthouse on every page, document green pass.
2. **When commercial / institutional pilot lands:** Third-party audit (likely AbilityNet given the humanitarian + small-team profile). Use the audit as marketing material.
3. **When Patreon / grant funding allows:** Annual recertification cycle.

---

## §9 — Implementation phases

This is the v5.11–v6 work plan. Each phase is a separate Mr. Data brief.

### Phase A — Foundation (v5.11 mockup tier)
- `js/accessibility.js` shared module skeleton (read/write `irlid_a11y_v1`, expose API)
- Accessibility settings panel UI (an 8th tab in the v5.11 mockup: "Accessibility")
- Settings shape per §4
- Mockup-only at this stage; no behaviour wired yet
- Target: T4.3.57 brief

### Phase B — Reduced motion + contrast + large text (v5.11 → live port)
- `motion.reduced` honoured across all celebration animations (CSS-level via class toggle from the module)
- `visual.highContrast` CSS override layer
- `visual.largeText` root font-size scale
- These three are the lowest-risk site-wide wins; they ship to live first
- Target: v5.12.0 brief

### Phase C — Keyboard nav audit (live)
- Tab order walk on `OrgCheckin.html`, `scan.html`, `accept.html`, `org-entry.html`
- Add skip-to-content links to every page
- Add `<html lang="en">` to any page missing it
- Add `aria-live` regions for dashboard table updates
- Target: v5.12.1 brief

### Phase D — Audio: TTS + outcome sounds + scan beep (live)
- `audio.tts` wired via Web Speech API on all surfaces
- `audio.scanBeep` proximity feedback on `scan.html`
- `audio.outcomeSounds` already mostly there; add accessibility-mode-aware distinct tones
- Target: v5.12.2 brief

### Phase E — Haptic + scanner accessibility (live)
- `haptic.enabled` via `navigator.vibrate()` across all surfaces
- `scanner.largeReticle` + `scanner.voicePrompts` + `scanner.showDecodedText`
- Target: v5.12.3 brief

### Phase F — Org-level defaults (live + Worker)
- `org_accessibility_defaults` D1 table
- Worker endpoints: `GET /org/accessibility-defaults`, `PUT /org/accessibility-defaults` (lead_admin+)
- Module reads org defaults on first paint, caches with TTL
- Org-level semantics: defaults apply per session; user override is session-only, resets to org default when session ends (per §10.2)
- Target: v5.12.4 brief

### Phase G — User-held identity-bound preferences via signed envelope (v6.0)
- Extend v5 envelope schema in `js/sign.js` with optional `a11y_blob` field (~10 lines)
- Receiving venue / kiosk extracts `a11y_blob` from incoming envelope, applies to session via `js/accessibility.js` (~40 lines)
- User-facing toggle in accessibility panel: "Send my preferences with each scan" (default ON, ~5 lines)
- No D1 schema changes; preferences live in user's `irlid_a11y_v1` localStorage and travel via signed envelope only
- Honours "broker, not store" principle — IRLid does not store accessibility PII bound to identity server-side
- Worked example: Bob (blind, has TTS + haptic + large text on his own phone) visits a friend's IRLid-using gym. Bob scans the venue's QR. His phone signs the check-in envelope including his a11y blob. The gym kiosk reads the blob, applies preferences for Bob's session, resets to org default when he leaves.
- Target: v6.0 release

### Phase H — Self-certification (admin work, no code)
- VPAT document
- Accessibility statement page (`accessibility.html` at repo root)
- axe + Lighthouse audit on every page, document green pass
- Target: v5.12.5 (admin)

### Phase I — Third-party audit (when funding allows)
- Engage AbilityNet or equivalent
- Implement audit findings
- Earn the formal cert
- Target: v5.13+

---

## §10 — Architectural decisions (Captain ratified 23 May 2026 morning)

1. **Settings UI placement** — **All three.** Accessibility icon top-right of every page (primary), 8th tab in dashboard Settings panel (secondary), and `Alt+A` global keyboard shortcut (tertiary). Multiple discovery paths, all roads lead to the same modal.

2. **Org-level override semantics** — **Option B: admin sets default, user can override per session, resets next user.** Admin's preference is the sensible starting state; individual user override applies for the current session only; the device returns to org default when the session ends. Care home admins set Large Text ON for residents; a sighted visitor can flip it off momentarily without permanently disabling it for the next resident.

3. **Per-attendee preferences travelling with identity** — **Yes, scheduled for Phase G (v6.0).** Implementation via signed envelope, NOT server-side storage. The user's preferences live encrypted in their device's localStorage; when they scan a venue QR, an optional `a11y_blob` is attached to the v5 envelope. Receiving venue applies preferences for that session only, no storage. Honours the "broker, not store" principle. Estimated ~55 lines of code across `js/sign.js`, the dashboard receiver, and the user-facing toggle ("Send my preferences with each scan", default ON).

4. **OS `prefers-*` vs IRLid setting priority** — **IRLid setting wins** when the user has touched it. The new `meta.adoptOsSettings` master toggle (default ON for new users) supplies sensible OS-aware defaults; flips to OFF the moment the user touches any individual setting (signal of explicit user control). User can manually re-enable to re-adopt OS defaults. Best of both — sensible out-of-box behaviour, respect for explicit choice.

5. **Scan beep audio source** — **Web Audio API (synthesized) for v1.** Zero asset payload, swap to pre-recorded WAVs in v2 if user testing surfaces a fidelity complaint.

6. **TTS voice selection** — **Auto-pick by default, picker in Settings as override.** Best of both: works immediately for users who don't care, configurable for users who do.

---

## §11 — Notes banked

- The v5 hardware-backed sign-in (Passkey/Secure Enclave/Windows Hello) is itself an accessibility win — WCAG 3.3.8 (Accessible Authentication) is met by IRLid's design. The biometric IS the auth. No password to remember. This is a marketing-grade differentiator and worth calling out in any future grant application or institutional pitch.
- The privacy-first / opt-in design ethos transfers cleanly to accessibility — "off by default, user enables" is the same pattern.
- The bath-thought genesis of this spec (Captain, 23 May 2026 morning) makes it the first IRLid architectural document to originate during a bath. Pattern worth preserving.

---

— Number One.
