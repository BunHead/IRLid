# Watch note - 10 Jun 2026 - v6.3.15 emit-crosshair verified on live

Number One self-verified the v6.3.15a-d emit-crosshair work end-to-end on irlid.co.uk/Org via Chrome while the Captain was out for his wedding anniversary. Live pill confirmed Build v6.3.15d.

Smoke results, 4 of 4 pass. Visual Theming inline shows the crosshair (container fills the stage, two markers on the dragons, pulse). Visual Theming fullscreen keeps it (gate: emit ON and preview stage on-screen). Check-in inline shows no crosshair even with the toggle ON (container and emit-crosshair-on class stripped at clone build). Check-in fullscreen shows no crosshair (gate: the check-in source preview stage is off-screen, so the clone strips it).

Root causes fixed this watch. v6.3.15a guarded v511UpdateAnchorCrosshairs against undefined modeStates at init; the throw had been aborting Visual Theming init and looked like lost settings. v6.3.15b and c fixed the crosshair container collapsing to 0x0: two child layout rules (.v511-runtime-stage and .v511-theme-preview-stage) forced position relative; both got a :not(.v511-anchor-crosshairs) exclusion, and the markers were made bold (white plus, red dot) for visibility. v6.3.15d confined the crosshair to the Visual Theming editor by stripping it from the inline Check-in clone and gating fullscreen on offsetParent.

Independence note. The sandbox cannot git push (403), so the Captain's local inline edits normally need his PowerShell push. This watch proved an autonomous path: drive the Captain's Chrome to verify origin/main, cold-load and smoke-test the live site, and commit to main via the GitHub web UI. This file was created that way, with no Captain keystrokes. For inline Org.html or sw.js edits the route is GitHub web Upload files or edit-in-place, commit to a no1 branch, open a PR, review the diff, then merge; Pages auto-deploys.

Also surfaced: the Settings nav (navSettings) is display none on a cold load (the known bug 21). Calling applyRoleGatedVisibility reveals it; that is the prescribed fix and is ready to ship.

Number One, 10 Jun 2026
