// End-to-end: the staff dashboard's everyday path in a real browser
// (test plan 4.2 P1, section 7 step 4).
//
// The real Org.html in Chromium against the real org Worker
// (irlid-api-org/src/index.js) on an in-memory SQLite D1. A Lead Admin with
// one organisation:
//  1. Signs in. The dashboard opens that organisation on its own and shows
//     today's attendance, with yesterday's check-in left out (UK day).
//  2. A new check-in lands from an attendee phone. It appears without a reload.
//     A name with HTML in it is shown as text and never runs (S11).
//  3. Initiate check-out shows a check-out QR. The attendee phone signs the
//     check-out with its own key; the dashboard flips the row to OUT.
//     A wrong signature is refused and changes nothing.
//  4. "Last 7 days" lists the week grouped by UK day; Export CSV downloads a
//     file with the expected columns and a formula-looking name defused.
//  5. Sign out: nothing of the organisation is left in the browser, and the
//     session ends on the server.
//
// What this does not cover (unit tests do, see irlid-api-org/tests/
// attendance-days.test.mjs and attendance-week-client.test.mjs): midnight in
// BST and GMT, the clock-change days. Here the clock is real.
//
// Needs Playwright + Chromium. Skips itself when Playwright is not available.
// Run: npm run test:e2e
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanup } from "./cleanup.mjs";
import { chromium, e2eSkip, SITE_PORT, D1, listen, startWorker, startSite, addOrg, signInStaff, newContext } from "./harness.mjs";
import { signCanonicalPayload } from "../../irlid-api-org/src/crypto.js";

const ORG = { id: "org-smoke", name: "Smoke Test Hall", slug: "smoke-test-hall", apiKey: "org_e2e_smoke_key_1234567890" };
const HOSTILE = '<img src=x onerror="window.__pwned=1">Mallory';
const FORMULA = "=HYPERLINK(\"http://evil.example\",\"click\")";

async function attendeeKey() {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const prv = await crypto.subtle.exportKey("jwk", kp.privateKey);
  const p = await crypto.subtle.exportKey("jwk", kp.publicKey);
  return { prv, pub: { kty: "EC", crv: "P-256", x: p.x, y: p.y } };
}

let seq = 0;
function addCheckin(d1, { name, at, pub = null, out = null }) {
  const id = "chk-e2e-" + (++seq);
  d1.run(`INSERT INTO org_checkins (id,org_id,mode,attendee_label,name,attendee_key_id,hello_hash,score,checkin_at,checkout_at,created_at,attendee_pub_jwk,status,assurance,checkout_method)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, ORG.id, "attendee_scan", name, name, "key-" + seq, "hash-" + seq, 80, at, out, at, pub ? JSON.stringify(pub) : null, "checked_in", "live", out ? "signed" : null);
  return id;
}

const rowText = (page) => page.evaluate(() => Array.from(document.querySelectorAll("#attendanceRows tr")).map((tr) => tr.textContent.replace(/\s+/g, " ").trim()));

test("dashboard smoke: sign in, today's list, live check-in, signed check-out, last 7 days CSV, sign out", { skip: e2eSkip, timeout: 120000 }, async (t) => {
  const res = cleanup(t);
  const d1 = new D1();
  const env = { DB: d1, CORS_ORIGIN: "*", BOOTSTRAP_DEVELOPER_FP: "" };
  try {
    addOrg(d1, ORG);
    const nowS = Math.floor(Date.now() / 1000);
    addCheckin(d1, { name: "Ada Early", at: nowS - 60 });
    addCheckin(d1, { name: "Yesterday Person", at: nowS - 2 * 86400 });
    addCheckin(d1, { name: FORMULA, at: nowS - 3 * 86400, out: nowS - 3 * 86400 + 3600 });

    const workerPort = await listen(res.server(startWorker(env)), 0);
    await listen(res.server(startSite()), SITE_PORT);
    const browser = res.browser(await chromium.launch());
    const ctx = await newContext(browser, workerPort);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const site = "http://localhost:" + SITE_PORT;

    // ---------- 1. sign in: the one organisation opens with today's list ----------
    await page.goto(site + "/Org.html");
    const TOKEN = "sess_e2e_smoke_leadadmin_abcdefgh";
    await signInStaff(page, d1, env, { userId: "u-lead", name: "Lena Lead", orgId: ORG.id, role: "lead_admin", token: TOKEN });
    await page.goto(site + "/Org.html?n=1");
    await page.waitForFunction(() => typeof currentOrg !== "undefined" && currentOrg && currentOrg.id === "org-smoke", null, { timeout: 15000 });
    await page.waitForFunction(() => document.querySelectorAll("#attendanceRows tr").length >= 1, null, { timeout: 15000 });
    assert.equal(await page.textContent("#sidebarOrgName"), ORG.name);
    let rows = await rowText(page);
    assert.ok(rows.some((r) => r.includes("Ada Early") && r.includes("IN")), "today's check-in is listed as IN: " + JSON.stringify(rows));
    assert.ok(!rows.some((r) => r.includes("Yesterday Person")), "a check-in from two days ago is not in today's list");

    // ---------- 2. a new check-in appears without a reload; HTML in a name never runs ----------
    const att = await attendeeKey();
    const liveId = addCheckin(d1, { name: HOSTILE, at: Math.floor(Date.now() / 1000), pub: att.pub });
    await page.evaluate(() => refreshAttendance());
    await page.waitForFunction(() => /Mallory/.test(document.getElementById("attendanceRows")?.textContent || ""), null, { timeout: 15000 });
    assert.equal(await page.evaluate(() => window.__pwned), undefined, "the name's onerror never ran (S11)");
    assert.equal(await page.evaluate(() => document.querySelectorAll("#attendanceRows img").length), 0, "no <img> was made from the name");
    assert.ok((await rowText(page)).some((r) => r.includes("<img") && r.includes("Mallory")), "the name is shown as plain text");

    // ---------- 3. check-out: QR on the dashboard, signed on the attendee's phone ----------
    await page.click("#navDashboard");
    await page.waitForFunction(() => document.body.dataset.activePanel === "dashboard", null, { timeout: 5000 });
    await page.click(`button[onclick="requestCheckout('${liveId}')"]`);
    await page.waitForFunction((id) => !!document.querySelector(`#checkoutQr_${id}[data-qr-text], #checkoutQr_${id} [data-qr-text]`), liveId, { timeout: 15000 });
    const qrText = await page.evaluate((id) => {
      const box = document.getElementById("checkoutQr_" + id);
      return box.getAttribute("data-qr-text") || box.querySelector("[data-qr-text]").getAttribute("data-qr-text");
    }, liveId);
    assert.match(qrText, /^https?:\/\//, "the check-out QR is a link the attendee's camera can open");
    const tok = d1.get("SELECT token, consumed_at FROM org_checkout_tokens WHERE checkin_id=?", liveId);
    assert.ok(tok && !tok.consumed_at, "a check-out token was made for this check-in");
    assert.ok(qrText.includes(tok.token) || qrText.includes(encodeURIComponent(tok.token)), "the QR carries that token");

    const workerBase = "http://localhost:" + workerPort;
    const checkout = async (payload, prv) => {
      const signature = await signCanonicalPayload(payload, prv);
      const r = await fetch(workerBase + "/org/checkout", {
        method: "POST", headers: { "Content-Type": "application/json", "X-Org-Key": ORG.slug },
        body: JSON.stringify({ checkin_id: liveId, checkout_payload: payload, signature })
      });
      return { status: r.status, body: await r.json() };
    };
    // A phone that is not the one that checked in cannot sign the check-out.
    const stranger = await attendeeKey();
    const bad = await checkout({ checkin_id: liveId, nonce: "n-bad", ts: Math.floor(Date.now() / 1000) }, stranger.prv);
    assert.equal(bad.status, 401, "a check-out signed by another key is refused");
    assert.equal(d1.get("SELECT checkout_at FROM org_checkins WHERE id=?", liveId).checkout_at, null, "and nothing changed");

    const good = await checkout({ checkin_id: liveId, nonce: "n-good", ts: Math.floor(Date.now() / 1000) }, att.prv);
    assert.equal(good.status, 200, JSON.stringify(good.body));
    assert.equal(good.body.checkout_method, "signed");
    // The dashboard notices within its 2.5 s check-out poll.
    await page.waitForFunction(() => checkoutConfirmId === null, null, { timeout: 15000 });
    await page.waitForFunction(() => Array.from(document.querySelectorAll("#attendanceRows tr")).some((tr) => /Mallory/.test(tr.textContent) && /OUT/.test(tr.textContent)), null, { timeout: 15000 });
    rows = await rowText(page);
    assert.ok(rows.some((r) => r.includes("Mallory") && r.includes("lock signed")), "the row is marked as a signed check-out: " + JSON.stringify(rows));
    assert.ok(rows.some((r) => r.includes("Ada Early") && r.includes("IN")), "the other attendee is still IN");

    // ---------- 4. Last 7 days and its CSV ----------
    if (!(await page.isVisible("#attendanceWeekExportBtn"))) await page.click("#navCheckin").catch(() => page.evaluate(() => showPanel("checkin", document.getElementById("navCheckin"))));
    await page.evaluate(() => { const p = document.getElementById("attendanceWeekPanel"); p.open = true; });
    await page.waitForFunction(() => /in the last 7 days/.test(document.getElementById("attendanceWeekStatus")?.textContent || ""), null, { timeout: 15000 });
    assert.match(await page.textContent("#attendanceWeekStatus"), /^4 check-ins in the last 7 days \(UK time\)\./);
    const weekText = await page.textContent("#attendanceWeekBody");
    for (const n of ["Ada Early", "Yesterday Person", "Mallory", "HYPERLINK"]) assert.ok(weekText.includes(n), n + " is in the 7-day list");
    assert.equal(await page.evaluate(() => document.querySelectorAll("#attendanceWeekBody img").length, 0), 0, "the 7-day list builds names as text too");
    assert.ok(await page.evaluate(() => document.querySelectorAll("#attendanceWeekBody table").length) >= 3, "grouped into one table per UK day");

    const [download] = await Promise.all([page.waitForEvent("download"), page.click("#attendanceWeekExportBtn")]);
    assert.match(download.suggestedFilename(), /^irlid-attendance-last-7-days-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = readFileSync(await download.path(), "utf8");
    const lines = csv.trim().split(/\r?\n/);
    assert.equal(lines.length, 5, "a header and one line per check-in");
    const header = lines[0].replace(/^﻿/, "");
    assert.equal(header, "date,name,checked_in,checked_out,status,check_in_kind,check_out_method,event_id", "CSV columns");
    const formulaLine = lines.find((l) => l.includes("HYPERLINK"));
    assert.ok(formulaLine, "the formula-looking name is in the CSV");
    assert.ok(!/(^|,)"?=HYPERLINK/.test(formulaLine), "and it cannot start a cell with = (defused): " + formulaLine);

    // ---------- 5. sign out ----------
    await page.evaluate(() => showPanel("setup", document.getElementById("navOrganisation")));
    await page.click("#signedInSignOutBtn");
    await page.waitForFunction(() => document.getElementById("sidebarOrgName").textContent === "Not signed in", null, { timeout: 15000 });
    const after = await page.evaluate(() => ({
      org: currentOrg,
      session: qrLoginSession,
      kept: ["irlid_login_session", "irlid_org_local", "irlid_org_local_settings", "irlid_org_local_expected_attendees", "irlid_portal_full_v1"].filter((k) => localStorage.getItem(k) !== null),
      attendance: attendanceData.length,
      week: (document.getElementById("attendanceWeekBody")?.textContent || "").includes("Mallory")
    }));
    assert.equal(after.org, null);
    assert.equal(after.session, null);
    assert.deepEqual(after.kept, [], "no organisation data left in the browser");
    assert.equal(after.attendance, 0);
    assert.equal(after.week, false, "the 7-day list is cleared too");
    assert.equal(d1.get("SELECT COUNT(*) AS n FROM login_sessions WHERE token=?", TOKEN).n, 0, "the session ended on the server");

    assert.deepEqual(errors, [], "no page errors");
  } finally {
    await res.closeAll();
  }
});
