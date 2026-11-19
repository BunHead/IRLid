// End-to-end: themes in a real browser (test plan 4.7 P1, section 7 step 9).
//
// For a spread of organisation themes (IRLid's own look, light mode, the red
// "dragon" theme, a green dark theme, and a pale yellow light theme as the
// worst case) this opens the real Org.html (Check-in, Dashboard and Settings
// panels) and the attendee's first-scan screen in org-entry.html, and checks
// every visible piece of text for contrast (WCAG AA, tests/e2e/lib/contrast.js).
//
// Contrast problems that exist today are listed in KNOWN_LOW_CONTRAST below,
// so they are visible rather than skipped. The test fails if:
//   - a new low-contrast text appears that is not on the list, or
//   - something on the list is fixed (then take it off, so it can't come back).
// It also checks that a script put into theme text or the organisation's name
// never runs on the dashboard or the attendee's phone (S11).
//
// Needs Playwright + Chromium. Skips itself when Playwright is not available.
// Run: npm run test:e2e
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanup } from "./cleanup.mjs";
import { chromium, e2eSkip, ROOT, SITE_PORT, D1, listen, startWorker, startSite, addOrg, signInStaff, newContext } from "./harness.mjs";

const CONTRAST = readFileSync(new URL("./lib/contrast.js", import.meta.url), "utf8");
const STAGING_WORKER_HOST = "irlid-api-org-staging.irlid-bunhead.workers.dev";

const THEMES = {
  plain: null,
  light: { darkMode: false },
  dragon: { primary: "#B91C1C", accent: "#F59E0B", palette: ["#B91C1C", "#F59E0B", "#111111"] },
  greenDark: { primary: "#15803D", darkMode: true },
  paleYellowLight: { primary: "#FDE047", accent: "#FEF9C3", darkMode: false, palette: ["#FDE047", "#FFFFFF"] }
};

// Low-contrast text found on 19 Nov 2026, as "screen|element". Each one is a
// real accessibility gap (I5) to fix in its own PR. When one is fixed, this
// test fails until it is taken off the list, so it can't quietly come back.
// None of these change with the theme's colours: they are IRLid's own CSS.
const KNOWN_LOW_CONTRAST = new Set([
  // Attendee phone, first scan: white text on the orange screen (2.0 to 2.9:1).
  "entry|#title", "entry|#subtitle", "entry|#orangeScanInstruction", "entry|#helloStatus",
  // Dashboard sidebar footer, every panel: grey on dark (3.8:1); in light mode the
  // blue "Build v..." line on white (2.5:1).
  "checkin|.sidebar-footer", "dashboard|.sidebar-footer", "settings|.sidebar-footer",
  "checkin|.env-badge-test", "dashboard|.env-badge-test", "settings|.env-badge-test",
  "checkin|.sidebar-footer>span", "dashboard|.sidebar-footer>span", "settings|.sidebar-footer>span",
  // Check-in panel, light mode: white banner and crosshair labels on the pale
  // preview stage (1.1:1), the blue event badge (2.5:1), grey card note (3.1:1).
  "checkin|.v511-theme-preview-banner", "checkin|.v512-stage-crosshair>span",
  "checkin|#currentEventQrBadge", "checkin|.card-header>div",
  // Dashboard panel, light mode: the expected-attendee box keeps a dark
  // background with dark text (1.1:1) and grey labels (2.7:1); stat and refresh text.
  "dashboard|#expectedAdminPanelTitle", "dashboard|#expectedArchivedBox>label", "dashboard|.match-panel>h5",
  "dashboard|.match-panel>p", "dashboard|.mini-help", "dashboard|.input-group>label",
  "dashboard|#statBio", "dashboard|#lastRefresh",
  // Settings: white name and slug on the yellow masthead (1.2 and 2.4:1), map
  // attribution links in default blue on dark (1.7:1).
  "settings|.v511-masthead-name", "settings|.v511-masthead-slug", "settings|.v511-hint>a",
]);

// Theme text and an organisation name with script in them (S11). The Worker
// keeps unknown theme keys as sent, so _v512 text reaches the dashboard as is.
const HOSTILE = '<img src=x onerror="window.__pwned=1">';
const HOSTILE_ORG = {
  id: "org-hostile", name: "Evil " + HOSTILE + "Hall", slug: "org-hostile", apiKey: "org_e2e_theme_hostile_1234567890",
  settings: {
    welcomeMessage: "Hi " + HOSTILE, orgTerms: "Terms " + HOSTILE,
    theme: { primary: "#B91C1C", _v512: { bannerText: "{org} " + HOSTILE + " {event}", textTemplate: HOSTILE + "{name}" } }
  }
};

function report(page, ignore) {
  return page.evaluate((ig) => window.__contrastReport(null, ig), ignore || null);
}

test("every theme: text is readable on the dashboard and the attendee screen; theme text never runs as script", { skip: e2eSkip, timeout: 240000 }, async (t) => {
  const res = cleanup(t);
  const d1 = new D1();
  const env = { DB: d1, CORS_ORIGIN: "*", BOOTSTRAP_DEVELOPER_FP: "" };
  try {
    let i = 0;
    for (const [k, theme] of Object.entries(THEMES)) {
      addOrg(d1, { id: "org-" + k, name: "Org " + k, slug: "org-" + k.toLowerCase(), apiKey: "org_e2e_theme_" + k + "_1234567890", settings: theme ? { theme } : {}, createdAt: 100 + i++ });
    }
    const workerPort = await listen(res.server(startWorker(env)), 0);
    await listen(res.server(startSite()), SITE_PORT);
    const browser = res.browser(await chromium.launch());
    const site = "http://localhost:" + SITE_PORT;
    const found = [];
    const errors = [];

    const attendeePage = async (ctx) => {
      const ph = await ctx.newPage();
      // On localhost the attendee page calls the staging Worker host; send it to the local Worker.
      await ph.route((url) => url.host === STAGING_WORKER_HOST, async (route) => {
        const req = route.request();
        const u = new URL(req.url());
        const r = await fetch("http://localhost:" + workerPort + u.pathname + u.search, {
          method: req.method(), headers: req.headers(), body: ["GET", "HEAD"].includes(req.method()) ? undefined : req.postDataBuffer()
        });
        const headers = {};
        r.headers.forEach((v, kk) => { headers[kk] = v; });
        headers["access-control-allow-origin"] = "*";
        await route.fulfill({ status: r.status, headers, body: Buffer.from(await r.arrayBuffer()) });
      });
      ph.on("pageerror", (e) => errors.push("entry: " + e));
      return ph;
    };

    for (const [k, theme] of Object.entries(THEMES)) {
      const ctx = await newContext(browser, workerPort);
      await ctx.addInitScript(CONTRAST);
      const page = await ctx.newPage();
      page.on("pageerror", (e) => errors.push(k + ": " + e));
      await page.goto(site + "/Org.html");
      await signInStaff(page, d1, env, { userId: "u-" + k, name: "Lead " + k, orgId: "org-" + k, role: "lead_admin", token: "sess_e2e_theme_" + k + "_abcdefghijkl" });
      await page.goto(site + "/Org.html?n=1");
      await page.waitForFunction((id) => typeof currentOrg !== "undefined" && currentOrg && currentOrg.id === id, "org-" + k, { timeout: 15000 });
      // The theme really is applied: colour and light/dark mode follow the organisation.
      if (theme && theme.primary) {
        await page.waitForFunction((c) => activeTheme.primary.toUpperCase() === c, theme.primary, { timeout: 5000 });
      }
      const wantMode = theme && theme.darkMode === false ? "light" : "dark";
      await page.waitForFunction((m) => document.documentElement.dataset.theme === m, wantMode, { timeout: 5000 })
        .catch(() => {});
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), wantMode, k + ": light/dark mode follows the theme");

      for (const [panel, nav] of [["checkin", "navCheckin"], ["dashboard", "navDashboard"], ["settings", "navSettings"]]) {
        await page.click("#" + nav);
        await page.waitForFunction((p) => document.body.dataset.activePanel === p, panel, { timeout: 5000 });
        await page.waitForTimeout(400); // let entrance animations finish
        const r = await report(page);
        assert.ok(r.checked > 20, `${k} ${panel}: measured ${r.checked} texts`);
        for (const f of r.fails) found.push({ theme: k, screen: panel, ...f });
      }

      // The attendee's phone, first scan: the orange "Get a member of staff" screen.
      const ph = await attendeePage(ctx);
      await ph.goto(site + "/org-entry.html?type=checkin&org=org-" + k.toLowerCase());
      await ph.waitForFunction(() => /member of staff/.test(document.getElementById("subtitle")?.textContent || ""), null, { timeout: 15000 });
      await ph.waitForTimeout(400);
      // #helloQrBox holds the test's stand-in "QR" text, not real text.
      const r2 = await report(ph, "#helloQrBox");
      assert.ok(r2.checked >= 3, `${k} entry: measured ${r2.checked} texts`);
      for (const f of r2.fails) found.push({ theme: k, screen: "entry", ...f });
      await ctx.close();
    }

    // ---------- script in theme text or the org's name never runs ----------
    addOrg(d1, { ...HOSTILE_ORG, createdAt: 999 });
    {
      const ctx = await newContext(browser, workerPort);
      const page = await ctx.newPage();
      page.on("pageerror", (e) => errors.push("hostile: " + e));
      await page.goto(site + "/Org.html");
      await signInStaff(page, d1, env, { userId: "u-hostile", name: "Lead hostile", orgId: "org-hostile", role: "lead_admin", token: "sess_e2e_theme_hostile_abcdefghij" });
      await page.goto(site + "/Org.html?n=1");
      await page.waitForFunction(() => typeof currentOrg !== "undefined" && currentOrg && currentOrg.id === "org-hostile", null, { timeout: 15000 });
      for (const nav of ["navCheckin", "navDashboard", "navSettings"]) { await page.click("#" + nav); await page.waitForTimeout(300); }
      await page.click("#navCheckin");
      await page.waitForFunction(() => /Evil/.test(document.getElementById("venueQRBanner")?.textContent || ""), null, { timeout: 10000 });
      assert.ok((await page.textContent("#venueQRBanner")).includes("<img"), "the banner shows the theme text as plain text");
      assert.equal(await page.textContent("#sidebarOrgName"), HOSTILE_ORG.name, "the org name is shown as plain text");
      const ph = await attendeePage(ctx);
      await ph.goto(site + "/org-entry.html?type=checkin&org=org-hostile");
      await ph.waitForFunction(() => /member of staff/.test(document.getElementById("subtitle")?.textContent || ""), null, { timeout: 15000 });
      await ph.waitForTimeout(500);
      assert.equal(await page.evaluate(() => window.__pwned), undefined, "nothing ran on the dashboard");
      assert.equal(await ph.evaluate(() => window.__pwned), undefined, "nothing ran on the attendee's phone");
      assert.equal(await page.evaluate(() => document.querySelectorAll('img[src="x"]').length), 0, "no <img> made from theme text on the dashboard");
      assert.equal(await ph.evaluate(() => document.querySelectorAll('img[src="x"]').length), 0, "or on the phone");
      await ctx.close();
    }

    const fmt = (f) => `${f.theme} ${f.screen} "${f.text}" (${f.key}) ${f.ratio}:1, needs ${f.need}:1, ${f.fg} on ${f.bgc}`;
    const unexpected = found.filter((f) => !KNOWN_LOW_CONTRAST.has(f.screen + "|" + f.key));
    const seen = new Set(found.map((f) => f.screen + "|" + f.key));
    const fixed = [...KNOWN_LOW_CONTRAST].filter((k) => !seen.has(k));
    if (process.env.IRLID_THEME_DEBUG) console.log(found.map(fmt).join("\n"));
    assert.deepEqual(unexpected.map(fmt), [], "text below WCAG AA contrast that is not on the known list");
    assert.deepEqual(fixed, [], "these are fixed now: take them off KNOWN_LOW_CONTRAST");
    assert.deepEqual(errors, [], "no page errors");
  } finally {
    await res.closeAll();
  }
});
