13 HIGH / 0 MEDIUM / 0 LOW

## `css/style.css`

### `css/style.css:210` - selector `#responseArea`
- **What it is** - Scanner response container styling.
- **Evidence** - `#responseArea` is defined in `css/style.css`; bare-string grep for `responseArea` across all repo `.html` and `.js` files (excluding `js/vendor`) returned 0 references outside the CSS selector. No static HTML use and no JS-injected string use found.
- **Confidence** - HIGH.

### `css/style.css:289` - selector `.page-title-center`
- **What it is** - Centered page-title utility class.
- **Evidence** - `.page-title-center` is defined in `css/style.css`; bare-string grep for `page-title-center` across all repo `.html` and `.js` files (excluding `js/vendor`) returned 0 references outside the CSS selector. No static HTML use and no JS-injected string use found.
- **Confidence** - HIGH.

### `css/style.css:328` - selector `.mb0`
- **What it is** - Margin-bottom reset utility class.
- **Evidence** - `.mb0` is defined in `css/style.css`; bare-string grep for `mb0` across all repo `.html` and `.js` files (excluding `js/vendor`) returned 0 references outside the CSS selector. Related `.mt0` is used in `account.html`, but `.mb0` is not used.
- **Confidence** - HIGH.

### `css/style.css:347` - selector `.people-grid`
- **What it is** - Receipt-page two-column people layout.
- **Evidence** - `.people-grid` is defined in `css/style.css` and adjusted again in the media query at `css/style.css:355`; bare-string grep for `people-grid` across all repo `.html` and `.js` files (excluding `js/vendor`) returned 0 references outside the CSS selectors. No static HTML use and no JS-injected string use found.
- **Confidence** - HIGH.

### `css/style.css:364` - selector `.person-title`
- **What it is** - Receipt person-panel title styling.
- **Evidence** - `.person-title` is defined in `css/style.css`; bare-string grep for `person-title` across all repo `.html` and `.js` files (excluding `js/vendor`) returned 0 references outside the CSS selector. Neighboring receipt selectors such as `.person-panel`, `.person-row`, and `.person-note` are used in `receipt.html`, but `.person-title` is not.
- **Confidence** - HIGH.

### `css/style.css:405` - selector `a.maplink`
- **What it is** - Link styling for map links.
- **Evidence** - `a.maplink` is defined in `css/style.css`; bare-string grep for `maplink` across all repo `.html` and `.js` files (excluding `js/vendor`) returned 0 references outside the CSS selector. No static HTML use and no JS-injected string use found.
- **Confidence** - HIGH.

### `css/style.css:470` - selector `.sr-only`
- **What it is** - Shared screen-reader-only utility class.
- **Evidence** - `.sr-only` is defined in `css/style.css`; bare-string grep for `sr-only` across all repo `.html` and `.js` files (excluding `js/vendor`) returned 0 references outside the CSS selector. The adjacent `.skip-link` utility is injected by `js/nav.js`, but `.sr-only` has no current live usage.
- **Confidence** - HIGH.

## `js/sign.js`

### `js/sign.js:976` - function `irlidV5ExpectedOrigin`
- **What it is** - Helper that computes the expected WebAuthn origin for the current deployment.
- **Evidence** - Defined at `js/sign.js:976`; bare-string grep for `irlidV5ExpectedOrigin` across all repo `.html` and `.js` files (excluding `js/vendor`) returned only the definition. The nearby origin allowlist helper `irlidV5OriginAllowed` is live and called at `js/sign.js:1293`, but `irlidV5ExpectedOrigin` is not called.
- **Confidence** - HIGH.

### `js/sign.js:1472` - function `irlidCanonicalize`
- **What it is** - Thin wrapper around the local `canonical` helper.
- **Evidence** - Defined at `js/sign.js:1472`; bare-string grep for `irlidCanonicalize` across all repo `.html` and `.js` files (excluding `js/vendor`) returned only the definition. No inline handler, global dispatch string, or cross-file call was found.
- **Confidence** - HIGH.

### `js/sign.js:1486` - function `irlidCreateSignedInvitePayload`
- **What it is** - Invite-specific signing helper that strips signature fields, signs, then reattaches `sig`, `pub`, and optional `webauthn`.
- **Evidence** - Defined at `js/sign.js:1486`; bare-string grep for `irlidCreateSignedInvitePayload` across all repo `.html` and `.js` files (excluding `js/vendor`) returned only the definition. Current invite/action flows use other signing paths such as `signActionPayload`, `irlidSignPayload`, or cross-device action auth; no static or string-dispatch caller was found.
- **Confidence** - HIGH.

## `receipt.html`

### `receipt.html:699` - function `safeParseAny`
- **What it is** - JSON parsing helper that returns non-string inputs unchanged.
- **Evidence** - Defined in an inline script at `receipt.html:699`; bare-string grep for `safeParseAny` across all repo `.html` and `.js` files (excluding `js/vendor`) returned only the definition. Other receipt parsing paths use `readJson`, direct `JSON.parse`, or specialized decode helpers.
- **Confidence** - HIGH.

### `receipt.html:819` - function `escapeHtmlText`
- **What it is** - HTML escaping helper for receipt rendering.
- **Evidence** - Defined in an inline script at `receipt.html:819`; bare-string grep for `escapeHtmlText` across all repo `.html` and `.js` files (excluding `js/vendor`) returned only the definition. No template-rendering call or injected string reference was found.
- **Confidence** - HIGH.

## `scan.html`

### `scan.html:605` - function `drawNeonCorner`
- **What it is** - Canvas helper for drawing one neon QR tracking corner.
- **Evidence** - Defined in an inline script at `scan.html:605`; bare-string grep for `drawNeonCorner` across all repo `.html` and `.js` files (excluding `js/vendor`) returned only the definition. The active scanner overlay draws equivalent corner paths inline around `scan.html:767`, `scan.html:790`, and the static scan-zone fallback around `scan.html:875`.
- **Confidence** - HIGH.
