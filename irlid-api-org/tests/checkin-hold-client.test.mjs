// First-scan hold, phone side (v6.8.13). org-entry.html sends the hold from
// the orange "Get a member of staff" screen only, without waiting for it,
// straight to the Worker (never through the offline queue), and its signed
// hello is accepted by the real Worker.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { DatabaseSync } from "node:sqlite";
import worker from "../src/index.js";
import { newDevice, hashHello } from "./helpers/signed-checkin.mjs";

const ROOT = new URL("../../", import.meta.url);
const entryHtml = readFileSync(new URL("org-entry.html", ROOT), "utf8");

function fnSource(name) {
  const start = entryHtml.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, name + " exists");
  let depth = 0;
  for (let i = entryHtml.indexOf("{", start); i < entryHtml.length; i++) {
    if (entryHtml[i] === "{") depth++;
    else if (entryHtml[i] === "}" && --depth === 0) return entryHtml.slice(start, i + 1);
  }
  throw new Error("unbalanced " + name);
}

test("renderVenue holds the code only for a phone the org does not know, and does not wait for it", () => {
  const src = fnSource("renderVenue");
  const holdAt = src.indexOf("holdLiveCode(pub);");
  assert.ok(holdAt > 0, "the hold is sent");
  assert.ok(!/await\s+holdLiveCode/.test(src), "the orange screen never waits for the hold");
  assert.ok(holdAt > src.indexOf("recognized?.recognized"), "a known phone checks in straight away, no hold");
  assert.ok(holdAt > src.indexOf("active?.active"), "a phone already checked in gets no hold");
  assert.ok(holdAt < src.indexOf("await renderDoormanEscalation(pub, fp)"), "sent before the orange screen");
});

test("holdLiveCode posts directly and swallows every failure", () => {
  const src = fnSource("holdLiveCode");
  assert.match(src, /postOrg\("\/org\/checkin\/hold"/);
  assert.doesNotMatch(src, /Resilient|enqueue|IRLidOfflineQueue/);
  assert.match(src, /catch \(err\)/);
});

test("the hold the page signs is accepted by the Worker", async () => {
  const ORG_KEY = "org_offline_test_key_123456";
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE organisations (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, api_key TEXT NOT NULL UNIQUE, settings_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE org_checkins (id TEXT PRIMARY KEY, org_id TEXT NOT NULL);
    CREATE TABLE org_checkin_nonces (nonce TEXT PRIMARY KEY, org_api_key TEXT NOT NULL, event_id TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, consumed_at INTEGER);
  `);
  db.prepare("INSERT INTO organisations (id,name,slug,api_key,created_at,updated_at) VALUES ('org-1','Test','test-org',?,0,0)").run(ORG_KEY);
  const t = Math.floor(Date.now() / 1000);
  db.prepare("INSERT INTO org_checkin_nonces VALUES ('cin_live1234',?,NULL,?,?,NULL)").run(ORG_KEY, t, t + 90);
  const d1 = {
    prepare(sql) {
      let args = [];
      const st = { bind(...a) { args = a; return st; },
        async first() { return db.prepare(sql).get(...args) ?? null; },
        async all() { return { results: db.prepare(sql).all(...args) }; },
        async run() { const i = db.prepare(sql).run(...args); return { meta: { changes: Number(i.changes) } }; } };
      return st;
    }
  };
  const device = await newDevice();
  const sent = [];
  const ctx = createContext({
    checkinNonce: "cin_live1234",
    orgParam: "test-org", // slim QRs carry the slug
    eventId: "",
    hashPayloadToB64url: (p) => hashHello(p),
    signHashB64url: (h) => device.sign(h),
    postOrg: async (path, body) => { sent.push({ path, body }); return { ok: true }; },
    console, Date, Math, JSON
  });
  runInContext(fnSource("holdLiveCode") + "; this.holdLiveCode = holdLiveCode;", ctx);
  await ctx.holdLiveCode(device.pub);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].path, "/org/checkin/hold");
  const res = await worker.fetch(new Request("https://worker.test/org/checkin/hold", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Org-Key": "test-org" },
    body: JSON.stringify(sent[0].body)
  }), { DB: d1, CORS_ORIGIN: "*" });
  const out = await res.json();
  assert.equal(res.status, 200, JSON.stringify(out));
  assert.equal(out.held, true);

  // No code (static QR): no hold is sent at all.
  sent.length = 0;
  ctx.checkinNonce = "";
  await ctx.holdLiveCode(device.pub);
  assert.equal(sent.length, 0);
});

test("the dashboard API never offline-queues a hold, check-in still queues", () => {
  const window = {};
  const ctx = createContext({ window, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, URL, console, setTimeout, clearTimeout, fetch: async () => { throw new Error("no"); } });
  runInContext(readFileSync(new URL("js/orgapi.js", ROOT), "utf8"), ctx);
  const api = window.IRLidOrgApi;
  assert.equal(api.isQueueEligible("/org/checkin/hold", "POST"), false);
  assert.equal(api.isQueueEligible("/org/checkin", "POST"), true);
});

test("build and cache are bumped (W8)", () => {
  const swVer = Number((readFileSync(new URL("sw.js", ROOT), "utf8").match(/CACHE_VERSION = 'irlid-shell-v(\d+)'/) || [])[1]);
  assert.ok(swVer >= 203, "sw.js CACHE_VERSION should be at least v203, got v" + swVer);
  assert.match(readFileSync(new URL("Org.html", ROOT), "utf8"), /Build v6\.8\.1[3-9]/);
});
