# HANDOVER — GIF support for logo + background image (`v5.9.0.13.29` candidate)

**Repo:** IRLid-repo (LIVE — irlid.co.uk)
**Files involved:** `OrgCheckin.html`, `irlid-api-org/src/index.js`
**Scope:** Single PR. Extend the existing logo and background-image upload fields to accept animated GIFs. No second-logo-upload — see decision note below.

## Why this matters

Captain wants animated branding — the dragon (or future motifs) breathing on top of the page rather than sitting static. Both the logo and the background-image fields currently accept PNG / SVG / JPEG via the Worker validator. Adding `image/gif` to both unlocks animated branding with zero new architecture: `<img>` and CSS `background-image` already play animated GIFs natively, no extra rendering code.

## Decision: a single logo, not a second upload field

Captain raised the question of whether a SECOND logo upload (`logo2`?) is needed — e.g., one static logo for small nav surfaces, one animated logo for big venue displays. **Do not add this in this PR.** Reasoning:

1. **Premature.** The product has never had an animated logo. Ship the simpler change (GIF in the existing field), then see how it feels in practice. If the animated logo turns out to be distracting on the dashboard's top-left nav, THAT's the moment to add a static-fallback upload.
2. **Reversible.** Adding a second field later is straightforward — the data shape becomes `theme.logoUrl` + `theme.logoNavUrl` with a fallback rule (use nav-logo if set, else use logoUrl). Future PR work.
3. **Schema simplicity.** One logo field stays consistent with how `bgImageUrl` works. Don't fork the conceptual model unless we have to.

Captain has signed off on punting this question. If he changes his mind, it's PR 4 — not this one.

## Data shape changes

None. The existing fields stay:
- `theme.logoUrl: string` (URL or base64 data URI for the org logo)
- `theme.bgImageUrl: string` (URL or base64 data URI for the bg image)

Only the **validator's accepted MIME types** and the **size cap** change.

## Worker validator changes (`irlid-api-org/src/index.js`)

Find the existing image validator(s) — there will be at least one for `bgImageUrl` and possibly one for `logoUrl`. Look for the `image/png`, `image/svg`, `image/jpeg` MIME-type check.

Extend the accepted MIME types to include `image/gif`:
```js
const ALLOWED_IMAGE_MIME = [
  "image/png",
  "image/svg+xml",
  "image/jpeg",
  "image/gif"   // v5.9.0.13.29 — animated branding support
];
```

If the existing code uses a regex like `/^image\/(png|svg\+xml|jpeg)$/`, extend to include `gif`:
```js
/^image\/(png|svg\+xml|jpeg|gif)$/
```

**Bump the size cap** from 200 KB to 500 KB for any image type. Animated GIFs are inherently larger than static images. Find the existing cap constant (probably `IMAGE_MAX_BYTES` or similar) and update it. Apply uniformly — don't fork into per-MIME-type caps, that's complexity for no real win.

Apply the same MIME-type extension to BOTH the logo and the bg-image validators (audit for any other image fields too — there may be a website-favicon or similar from the v5.5.8 Website Theme Extraction work).

## Frontend changes (`OrgCheckin.html`)

For each `<input type="file">` that handles logo or bg-image upload:

1. **Update the `accept` attribute** to include GIF:
   ```html
   <input type="file" accept="image/png,image/svg+xml,image/jpeg,image/gif" ...>
   ```

2. **Update the helper text** below the input. Current text says something like "PNG, SVG, or JPEG up to 200 KB. Smaller is better, especially in Tile mode." Update to:
   ```
   PNG, SVG, JPEG, or GIF up to 500 KB. Animated GIFs are supported but larger files load slower.
   ```

3. **No JS changes required** for actual rendering — `<img>` and `background-image: url(...)` both play animated GIFs natively without any extra code. The existing rendering paths just work.

## Acceptance criteria

1. Settings panel: both Logo and Background Image file inputs accept `.gif` files. Helper text reads "PNG, SVG, JPEG, or GIF up to 500 KB" (or similar — match existing tone).
2. Uploading a static GIF works, renders as expected on the dashboard.
3. Uploading an animated GIF works, animates correctly on the dashboard (both as logo top-left and as background image).
4. Uploading a 600 KB image (any type) is rejected by the Worker with a clear error message about the size cap.
5. Uploading a `.bmp` or `.webp` file is still rejected (we're allowing GIF, not opening the floodgates).
6. Existing PNG/SVG/JPEG uploads behave identically to before (no regression).
7. Settings save + readback parity check passes — no new fields, so the existing check should still cover.
8. Build pill bumped to `v5.9.0.13.29`.

## Out of scope (do NOT add to this PR)

- **Second logo upload field (`logoNavUrl` or similar).** Punted per decision above.
- **Animated GIF playback controls** (autoplay toggle, loop count, pause-on-hover, etc.). If users want a static image, they upload a static image.
- **GIF optimization / re-encoding on upload.** Server-side image processing is a separate architectural decision.
- **WebP support.** Separate feature, separate PR.
- **Per-MIME-type size caps.** One cap, applies uniformly.
- **Logo for org-entry.html / check-in panel.** If that surface uses a different logo source than the dashboard's, treat it as a future PR — don't touch it.

## Merge-conflict note (important)

PRs #13 (`v5.9.0.13.27` — symmetric bg) and #14 (`v5.9.0.13.28` — role-labels-carryover) are also open against `main` and both touch `OrgCheckin.html`. This PR will be the third concurrent change to that file.

**Branching strategy:** Base this PR on `origin/main` as usual. **Do not stack on PR #13 or PR #14's branches** — they're independent features, and stacking would block this PR from merging until those are also merged.

**Expected merge conflicts:** the build pill version line (each PR bumps it) and possibly the Settings panel HTML if multiple PRs add new controls in the same neighborhood. Resolutions are straightforward — at merge time, take the highest version number for the pill, and the additive HTML from each PR keeps in source order.

The Worker file (`irlid-api-org/src/index.js`) is also touched by PR #13 (validator clause for `bgImageSymmetric`). This PR's Worker changes are in the image-validator section — different lines, low conflict risk, but still possible. Handle at merge time.

## Style / convention notes

- British spellings throughout (`colour`, `centre`, etc.).
- Match existing validator error message tone.
- Don't introduce new helper text styles — re-use whatever class the existing helper text below the inputs uses.
- Use `IMAGE_MAX_BYTES` or whatever the existing size-cap constant is named; don't introduce a parallel constant.

Ship as a single PR labelled `v5.9.0.13.29`. Captain will verify on his desktop dashboard with an animated GIF logo + an animated GIF background image before merge.
