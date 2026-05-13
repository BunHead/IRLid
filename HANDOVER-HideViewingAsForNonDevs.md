# HANDOVER - Hide "Viewing as" toolbar for non-developers (`v5.9.0.13.34`)

## Scope

Production lockdown. The "Viewing as" role-escalation dropdown is a developer-only debug affordance. Non-developers should not see it.

Single PR, CSS-only.

## File

`OrgCheckin.html`

## Change

Immediately after the existing CSS gate:

```css
body:not(.developer-bearer-active) .prototype-note { display: none; }
```

add:

```css
/* v5.9.0.13.34 - Production lockdown: the "Viewing as" role-escalation
   affordance is developer-only debug surface. Non-developers shouldn't
   see the toolbar, the per-role detail explainer, the (default-hidden)
   role cards strip, or the dock wrapper that .prototype-role-dock JS
   may wrap them into at runtime. Same .developer-bearer-active gate as
   the prototype-note banner above. */
body:not(.developer-bearer-active) .prototype-role-toolbar,
body:not(.developer-bearer-active) .prototype-role-detail,
body:not(.developer-bearer-active) .prototype-role-strip,
body:not(.developer-bearer-active) .prototype-role-dock { display: none; }
```

Also bump the sidebar-footer build pill from `Build v5.9.0.13.33` to `Build v5.9.0.13.34`.

## Acceptance Criteria

1. Signed in as Developer: "Viewing as" toolbar still visible on Dashboard panel, role-flip dropdown still functions.
2. Signed in as non-Developer (staff / manager / lead_admin): "Viewing as" toolbar hidden. The role-detail explainer card and any `.prototype-role-dock` wrapper also hidden.
3. No JS changes. Pure CSS gate. `data-prototype-role` body attribute still tracks the role.
4. No regression to PR #19's role-column visibility / GDPR initials / CSV sort+filter from `v5.9.0.13.33`.

## Out Of Scope

- Removing the toolbar from the DOM entirely.
- Hiding the already-gated prototype-note banner.
- Any Worker changes.

## Verification

Open DevTools and toggle `body.developer-bearer-active` off then on. The toolbar should disappear then reappear.
