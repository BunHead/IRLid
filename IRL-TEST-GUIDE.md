# IRLid — In-Real-Life Test Guide

**Purpose:** structured runbook for verifying that IRLid actually works on real devices in real situations, not just in unit tests. This is the smoke-test bible: any tester (Captain, supporter, technical reviewer) should be able to work through it without needing to ask questions mid-test.

**Audience:** anyone with two phones / a phone + laptop / a willing co-tester and 30–60 minutes. Some tests need going somewhere unfamiliar — those are flagged.

**Version:** 1.0 (1 May 2026, accompanying v5 client + Worker code-completion).

**How to escalate failures:** every test has a *"If it fails"* line. Most failures resolve to "copy the diagnostics blob from `v5-test.html` and paste it back into your IRLid working chat." When in doubt, do that.

---

## 0. Prerequisites

You will need (at minimum):

- **One device** with a recent browser (Safari iOS 16+, Chrome Android 9+, or Edge/Chrome on Windows with Hello set up).
- **A second device** for handshake tests (any reasonable phone/laptop combo works).
- **A live IRLid URL** to test against. Either:
  - `http://localhost:8000/` if you're running `npx --yes serve -l 8000 .` from the repo root, OR
  - `https://irlid.co.uk/` once v5 is deployed live, OR
  - `https://bunhead.github.io/IRLid-TestEnvironment/` for the test-environment build.
- **A Patreon-supporter account** is **NOT** required — IRLid handshakes work without any account.
- **A co-tester** for end-to-end handshakes. If you don't have one, you can simulate by holding both devices yourself, but the receipt's "two different keys" check will still pass because the devices have separate localStorage.

---

## 1. Quick reference — which tests need what

| Test tier | Location? | Devices needed | Co-tester? | Time |
|---|---|---|---|---|
| **Tier 1 — Single-device crypto** | anywhere | 1 | no | 5 min |
| **Tier 2 — Two-device handshake** | anywhere quiet | 2 | yes (or hold both) | 10 min |
| **Tier 3 — Location-novel** | **must leave home** | 1 | no | 15 min spread over 1–3 trips |
| **Tier 4 — Multi-day** | anywhere | 1 | no | spans 2+ days |
| **Tier 5 — Third-party verification** | anywhere with internet | 2 (one to scan, one to verify) | optional | 5 min |
| **Tier 6 — Production smoke** | anywhere | 2 | yes | 15 min |

**Don't do at home (or expect underwhelming results):** Tier 3 entirely. Your home location is already a saturated trust-history cluster — running scans there gives `LocationDiversityPts: 0` and `LocationNovelty: 0.0` no matter how many times you repeat. The purpose of Tier 3 is to *prove* the diversity scoring works, which requires fresh ground.

**Safe to do at home:** Tiers 1, 2, 4, 5. Cryptographic correctness is location-independent; trust-history *depth* and *device consistency* don't care where you are.

---

## 2. Tier 1 — Single-device crypto verification (no co-tester, anywhere)

### T1.1 — Unit test suite
- **What it proves:** the v3/v4/v5 cryptographic primitives are mathematically correct on this build.
- **Required:** node 18+ on the development machine.
- **Steps:**
  - Open PowerShell / Terminal in the repo root.
  - Run `node --test tests/sign.test.js`
  - Run `node --test irlid-api/tests/verify-receipt.test.mjs`
- **Expected:** ~110 tests + 12 tests, both suites report `pass <N>` and `fail 0`.
- **Pass criteria:** every test green, total runtime under 1 second.
- **If it fails:** copy the entire `not ok` block from the failing test and the surrounding context. Most likely cause: stale checkout (run `git pull`) or a code edit that broke an invariant.

### T1.2 — v5 diagnostic page (steps 1–6)
- **What it proves:** v5 hardware-backed signing works on *this specific device* (Touch ID / Face ID / Hello) end-to-end without involving GPS, QR codes, or any other party.
- **Required:** browser at the test URL, a working biometric (Face ID / Touch ID / Hello).
- **Steps:**
  - Navigate to `<base-url>/v5-test.html`.
  - Click each step in order: 1 → 2 → 3 → 4 → 5 → 6.
  - At Step 2 ("Enrol v5 credential"), the OS prompts for biometric. Approve.
  - At Step 3 ("Sign test payload"), the OS prompts again. Approve.
  - At Step 5 ("Round-trip test"), the OS prompts a third time. Approve.
  - At Step 6 ("Unenrol"), no prompt — just clears the local credential reference.
- **Expected:** every step shows a green "Pass" badge; no step shows "Fail."
- **Pass criteria:** all six steps green, the diagnostics blob at the bottom shows `signJsLoaded: true`, `hasIsUserVerifyingPAA: true`, and step logs that don't mention errors.
- **If it fails:** click "📋 Copy diagnostics" at the bottom of the page, paste the blob back to me. The blob includes everything I need to debug: browser/OS, sign.js function availability, per-step error messages.

### T1.3 — v3/v4 settings panel exercise (no v5)
- **What it proves:** the legacy v3/v4 settings (distance tolerance, time window, GPS accuracy floor, score threshold, bio-metric gate, trust-history view, clear data) all still work after the v5 changes.
- **Required:** browser at `<base-url>/settings.html`.
- **Steps:**
  - Toggle Debug mode on, then off.
  - Click each chip in the four chip rows (distance / time / GPS / score). Each click should highlight that chip and persist.
  - Click "Clear receipts only" — confirm it doesn't break anything.
  - In the Bio-metric panel: if the device supports it, click "Set up bio-metric," approve, then toggle and remove. If the device doesn't support it, the panel should say "Not available" without throwing an error.
  - In the v5 panel (separate from bio-metric): same drill — enrol, toggle, remove.
- **Expected:** every interaction either succeeds or fails gracefully with a clear message; no JavaScript errors in console.
- **Pass criteria:** open browser DevTools console, do all the clicks, console stays clean (no red errors).
- **If it fails:** open DevTools console, copy any red error messages, screenshot the panel state.

---

## 3. Tier 2 — Two-device handshake (anywhere quiet with both devices' GPS working)

### T2.1 — v3/v4 baseline handshake (v5 OFF on both)
- **What it proves:** the standard scan flow that's been live since April still works end-to-end after the v5 work touched `sign.js`. **Run this BEFORE any v5 test** so you have a regression baseline.
- **Required:** two devices, both with v5 toggle OFF in Settings (default), both at the test URL.
- **Steps:**
  - Device A: navigate to `<base-url>/index.html`, generate a HELLO QR.
  - Device B: navigate to `<base-url>/scan.html`, scan A's HELLO.
  - Device B produces a response QR.
  - Device A scans B's response.
  - A combined receipt page opens on Device A.
- **Expected:** receipt loads, all checks green, score around 20–24/100 (v3 base + small v4 bonuses if you've used the system before on this device).
- **Pass criteria:** the receipt URL on Device A shows green check marks for: structure, hash, signature, HELLO binding, time tolerance, distance tolerance.
- **If it fails:** screenshot the full receipt page, including any red X marks.

### T2.2 — v3/v4 + bio-metric gate (one device with v4 bio enrolled)
- **What it proves:** the optional v4 bio-metric gate (Settings → Bio-metric Verification) commits `bioVerified: true` into the signed payload.
- **Required:** one device with v4 bio enrolled and "Require bio-metric to sign" toggled ON; other device default.
- **Steps:** as T2.1, but the device with bio-metric ON will prompt for Face ID / Touch ID before producing its HELLO and again before producing its response.
- **Expected:** receipt verifies, the bio-enabled side's payload shows `"bioVerified": true` (visible in the receipt JSON if you scroll to the raw view).
- **Pass criteria:** combined receipt verifies AND the bio-enabled side's payload in the receipt JSON has `bioVerified: true`.
- **If it fails:** check Settings → Bio-metric panel says "Enrolled — bio-metric credential active" with the toggle ON.

### T2.3 — v5 handshake (BOTH devices v5 ON)
- **What it proves:** v5 hardware-backed signing works in the full scan flow, not just the diagnostic page.
- **Required:** both devices v5-enrolled AND v5 toggle ON. Use Settings → "Hardware-backed signing — v5 (beta)" panel on each.
- **Important:** this exchange will require **three biometric prompts on the initiator's device (HELLO offer + response + the OS may re-confirm) and one prompt on the responder's device.** That's expected. v5 design.
- **Steps:** as T2.1.
- **Expected:** receipt loads, all checks green, score around 40+/100 (v3 base + v5 envelope bonus). The receipt's JSON should show `"v": 5` and `"webauthn": { ... }` at the response level on both sides.
- **Pass criteria:** receipt verifies AND `comb.a.webauthn` exists AND `comb.b.webauthn` exists AND `comb.hello.offer.webauthn` exists.
- **If it fails:** the most likely failure is "v5 envelope verification failed" — copy the receipt URL and paste back. Also note the browser/OS combo on each device.

### T2.4 — v5 hybrid handshake (ONE device v5 ON, OTHER v5 OFF)
- **What it proves:** v3/v4 and v5 receipts can coexist in the same handshake; the receipt verifies even though the two parties used different signing modes.
- **Required:** one device with v5 toggle ON, other device with v5 toggle OFF (or v5 not even enrolled).
- **Steps:** as T2.1. The v5-enabled side will get extra biometric prompts.
- **Expected:** receipt verifies. The verification UI may show a "fully_v5: false" indicator (this is correct — hybrid receipts score at the v4 ceiling, not the v5 ceiling).
- **Pass criteria:** receipt verifies AND only the v5-enabled side has a `webauthn` field in the receipt JSON.
- **If it fails:** screenshot the receipt page; the failure mode here is the most architecturally interesting one because it tests the dispatcher logic.

---

## 4. Tier 3 — Location-novel scans (must leave home; spread over multiple trips)

> **Why these can't be done at home:** the v4 trust system clusters past locations by 1km radius. If you've ever scanned at home before, the home cluster already has `count: <large>`. Any new home-scan adds to that count without exercising the diversity machinery. To prove the location novelty + diversity scoring works, you need to scan at places ≥1km from each previous cluster.

### T3.1 — Fresh-location single scan (first novel scan today)
- **What it proves:** `irlidLocationNovelty()` returns ~1.0 for a brand-new area; the receipt UI shows the novelty as "high" / "fresh."
- **Required:** travel to somewhere ≥1km from your home cluster. Pub, café, supermarket, friend's house, work — anywhere you don't routinely scan.
- **Steps:**
  - At the new location, do a self-handshake (or with a co-tester) per T2.1.
  - Open the resulting receipt's `verify-visual.html` view (or check Settings → Trust History).
- **Expected:** the receipt's location score / badge indicates "fresh" / "1.0 novelty" / "new area." Trust history shows two clusters (home + new) if this is your second cluster, or one cluster (just here) if you've never scanned at home.
- **Pass criteria:** `LocationNovelty.score > 0.85` for this receipt, OR if you check `irlidV4TrustScore()` from DevTools console, `clusters.length` increased by 1.
- **If it fails:** likely cause: GPS didn't lock or you're actually inside your home cluster's 1km radius. Confirm via DevTools `navigator.geolocation.getCurrentPosition`.
- **† Important (surfaced 2 May 2026):** in the standard 2-scan handshake, **only the initiator's device records the combined receipt** to its trust history. The responder signs a response, hands it back, and never sees the combined object — so the responder's `irlid_trust_history` doesn't grow from this handshake. If you're testing trust-history accumulation on a *specific* device (e.g. proving a fresh phone goes 0/2 → 2/2), that device must be the **initiator** (open `index.html` → generate HELLO) at each test location. The role-swap is trivial: swap which phone shows the QR first; everything else is identical. Same locations work, just different role assignment.

### T3.2 — Build location diversity to 2/2 points
- **What it proves:** scanning at 3+ distinct locations earns the maximum `LocationDiversityPts: 2`.
- **Required:** three trips to three places ≥1km apart from each other (and from home, if home counts as a cluster). Examples: home, your work / regular café, a supermarket in a different town.
- **Steps:**
  - Do a scan at location 1 — **with the device-under-test as the initiator** (it generates the HELLO; co-tester scans + responds).
  - Travel to location 2 (≥1km away). Do a scan as initiator again.
  - Travel to location 3 (≥1km from both prior). Do a scan as initiator again.
  - Open Settings → Trust History line on the device-under-test.
- **Expected:** the line shows "Diversity: 2/2 pts."
- **Pass criteria:** Settings page reads "Diversity: 2/2 pts" exactly. If it reads 1/2 or 0/2, you need more genuinely distinct locations OR you weren't the initiator (see footnote on T3.1).
- **If it fails:** the clusters might be silently merging. Open DevTools, run `irlidBuildLocationClusters(irlidTrustHistoryGet())`. Inspect `count` and `lat/lon` per cluster. If two locations you thought were distinct ended up in one cluster, they were probably <1km apart on the actual GPS coords. **OR** the device-under-test was the responder for some/all scans (responders don't accumulate — see T3.1 footnote). If you have a cluster count of 2 instead of 3 on the device-under-test but think you scanned at 3 places, the missing scan was probably one where this device was the responder.
- **Note:** if the device-under-test has pre-existing receipts (e.g. a "home" cluster from prior testing), the test passes after **2** distinct fresh scans rather than 3. Total cluster count of 3 — across home + 2 new — qualifies for `Diversity: 2/2`.

### T3.3 — Hotspot saturation behaviour
- **What it proves:** repeating scans at one location grows that cluster's count without growing the cluster *count*; the novelty score for that location decays toward 0 as repeats accumulate.
- **Required:** the same location, ≥5 separate scans on different visits.
- **Steps:** do 5 scans at the same café over a week (or wherever's convenient that's not home). Each time, check `irlidLocationNovelty(lat, lon, irlidTrustHistoryGet())` from DevTools.
- **Expected:** the score starts ~1.0 (first visit, fresh), decays each visit (~0.8, 0.6, 0.4, 0.2 roughly).
- **Pass criteria:** by the 5th visit, novelty < 0.3.
- **If it fails:** the scans are probably going into different clusters because GPS jitter is putting them >1km apart. Outdoor scans in concrete urban environments can vary by 10–50m, which is fine; >1km variation suggests GPS source is unreliable.

---

## 5. Tier 4 — Multi-day device consistency (passive — just use the system)

### T4.1 — Single-day → 1pt; multi-day → 2pts
- **What it proves:** `DeviceConsistencyPts` correctly distinguishes single-day usage (1pt) from multi-day usage (2pts).
- **Required:** at least one scan today, at least one scan tomorrow (or any two distinct calendar days, same device).
- **Steps:** do a scan today. Sleep on it. Do another scan tomorrow. Open Settings → Trust History.
- **Expected:** "Consistency: 2/2 pts" appears.
- **Pass criteria:** the settings line shows "Consistency: 2/2 pts" once you have receipts on ≥2 different calendar days.
- **If it fails:** check that the device's clock didn't roll back; check that `irlidTrustHistoryGet()` from DevTools shows `ts` values from different days (Date object representations).

### T4.2 — Receipt depth → 5+ for full 2pts
- **What it proves:** `ReceiptDepthPts` rewards usage volume.
- **Required:** five or more verified handshakes on this device (any time, any location).
- **Steps:** accumulate over time. Check Settings → Trust History → "Depth: 2/2 pts."
- **Pass criteria:** "Depth: 2/2 pts."
- **If it fails:** count the entries in `irlidTrustHistoryGet()` from DevTools. If it's <5, you need more receipts. If it's ≥5 but the score is 1/2, there's a bug — copy the `irlidV4TrustScore()` output and report.

---

## 6. Tier 5 — Third-party receipt verification

### T5.1 — Verify a generated receipt on a different device
- **What it proves:** a receipt URL produced on one device verifies cleanly when opened on any other device.
- **Required:** a receipt URL from a previous test (e.g. T2.1 or T2.3), and a different device with internet.
- **Steps:**
  - Copy the full receipt URL from the device that produced it (it'll be `<base-url>/receipt.html#COMB_Z=...`).
  - Open that URL on a different device or a different browser profile.
- **Expected:** the receipt loads, the "What this proves" section appears, all checks green.
- **Pass criteria:** receipt page renders without errors, no red ✗ marks, the verification badge says verified.
- **If it fails:** check if the URL was truncated when copied (mobile share menus sometimes drop the hash). Copy via "Copy URL" button on the receipt page if available.

### T5.2 — Privacy-mode receipt verification
- **What it proves:** a receipt with GPS redacted still verifies via signature alone (limited check, but still proves the signature was valid at signing time).
- **Required:** a receipt produced with privacy mode (use the 🔒 button on receipt.html to make a redacted version).
- **Steps:**
  - On the source device, open a receipt and click the 🔒 / "Copy (privacy mode)" button.
  - Paste the privacy URL into a different browser / device.
- **Expected:** the receipt page loads in privacy mode, shows "Privacy receipt" header, the signature check is green, the GPS coordinates are NOT shown.
- **Pass criteria:** signature green, "GPS replaced with hash" is acknowledged in the UI, no GPS leak.
- **Important caveat (PROTOCOL.md §13.16):** for v5 receipts in privacy mode, the v5 envelope cannot be re-verified after redaction (the envelope's challenge committed to the unredacted payload bytes). The page will surface this limitation honestly. v3/v4 privacy-mode receipts verify fully.
- **If it fails:** check the URL has `#COMB_Z=` style hash, not raw JSON.

---

## 7. Tier 6 — Production smoke (after live deploy)

### T6.1 — Repeat T2.3 against `https://irlid.co.uk`
- **What it proves:** v5 works in production after live deploy, not just on localhost / GitHub Pages.
- **Required:** v5 deployed to `https://irlid.co.uk`. Two devices.
- **Steps:** as T2.3, but at `https://irlid.co.uk/`.
- **Important:** if you previously enrolled a v5 credential at `localhost:8000` or `bunhead.github.io`, you'll need to re-enrol at `irlid.co.uk` because credentials are bound to RP ID. This is by design (PROTOCOL.md §13 RP-ID lock).
- **Expected:** clean v5 handshake.
- **Pass criteria:** as T2.3.
- **If it fails:** check the live `https://irlid.co.uk/v5-test.html` first — if that fails, the deploy didn't update sign.js (cache problem) or the Worker didn't deploy.

### T6.2 — Worker production verification via curl
- **What it proves:** the live Worker at `irlid-api.<workers.dev>` correctly verifies a hand-rolled v5 receipt.
- **Required:** terminal with curl and a hand-rolled v5 receipt JSON (the `manufactureV5Envelope` infrastructure in `irlid-api/tests/verify-receipt.test.mjs` produces the bytes).
- **Steps:** see PROTOCOL.md §13.15 + HANDOVER-Batch5-Worker.md for the curl command shape.
- **Expected:** Worker returns `{ valid: true, fully_v5: true }` for a well-formed receipt; rejects with the appropriate `*_v5_error` field for malformed ones.
- **Pass criteria:** at least one positive test (well-formed) and one negative test (mutated payload) work as expected.
- **If it fails:** copy the curl command and full Worker response.

---

## 8. Failure escalation cheat sheet

If any test fails, paste this back into the IRLid working chat:

1. The test ID (e.g. T2.3).
2. **What you did differently from the steps**, if anything (e.g. "did this on Firefox not Chrome").
3. **Browser + OS + device** ("iPhone 14 / iOS 17.4 / Safari", "ThinkPad T14 / Windows 11 / Edge 124").
4. **The error you saw** — diagnostic blob from `v5-test.html` if applicable, or screenshot of receipt page, or DevTools console output.
5. **What you expected** — i.e. which "Pass criteria" you couldn't meet.

That's enough for me to either reproduce locally or write a targeted fix.

---

## 9. Glossary

- **HELLO** — Party A's opening QR; contains A's public key + signed offer (timestamp, GPS, nonce).
- **Response** — a party's signed acknowledgement of a HELLO; commits to the HELLO hash + offer hash.
- **Combined receipt** — `{ hello, a, b }`. The thing you save / share. Self-verifying.
- **HELLO offer signature** — A's signature over the offer payload. Signed at HELLO-display time.
- **Bio-metric gate (v4)** — optional; commits `bioVerified: true` into the signed payload before it's hashed.
- **v5 envelope** — `{ authData, clientData }`. Required for v5 receipts. The real signature lives over `authData || SHA-256(clientData)`.
- **fully_v5** — Worker-side flag: true only if BOTH parties + the HELLO offer all verified their v5 envelopes. False for hybrid (one-side-v5) receipts.
- **Trust history cluster** — a 1km-radius greedy cluster of past scan locations.
- **Location novelty** — score 0–1 measuring how rare this location is relative to your history. Brand-new area = 1.0; saturated home cluster = 0.0.
- **RP ID** — WebAuthn relying-party identifier. For IRLid: `irlid.co.uk` in production, `bunhead.github.io` in test, `localhost` for local dev. Credentials are bound to one RP ID and cannot be moved.

---

*Maintained alongside PROTOCOL.md and THREAT-MODEL.md by Number One. Update when a new test category becomes worth running.*
