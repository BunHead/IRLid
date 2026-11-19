// Themes, Worker side (test plan 4.7 P1, section 7 step 9).
//
// POST /org/settings validates a theme before it is saved, and the public
// GET /org/entry-info/<slug> (read by every attendee phone with no sign-in)
// hands out only safe branding. Runs the real Worker on in-memory SQLite.
//
// What the Worker does NOT do today (found while writing these, reported, not
// changed here): it keeps unknown theme keys as sent, and it only checks
// contrast for qrFg, not for primary or accent. It also accepts a theme save
// from a staff session (Settings is Lead Admin only in the dashboard). These
// are left for a separate decision, so there is no test here that would fail.
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { SqliteD1 } from "./helpers/sqlite-d1.mjs";

const ORG_KEY = "org_theme_test_key_1234567890ab";

function setup() {
  const d1 = new SqliteD1();
  d1.db.prepare("INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES (?,?,?,?,?,0,0)")
    .run("org-1", "Theme Hall", "theme-hall", ORG_KEY, JSON.stringify({ contactEmail: "door@theme.example", venueLat: 52.1, venueLon: -1.2, staffRedirectUrl: "https://theme.example/staff" }));
  const t = Math.floor(Date.now() / 1000);
  const tokens = {};
  for (const [id, role] of [["lead-1", "lead_admin"], ["manager-1", "manager"], ["staff-1", "staff"]]) {
    d1.db.prepare("INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES (?,?,?,?,0,0)").run(id, "{}", "fp-" + id, id);
    d1.db.prepare("INSERT INTO org_memberships (org_id,user_id,role,granted_at) VALUES (?,?,?,0)").run("org-1", id, role);
    const token = "sess_" + id + "_abcdefghijklmnop";
    d1.db.prepare("INSERT INTO login_sessions (token,user_id,issued_at,expires_at) VALUES (?,?,?,?)").run(token, id, t, t + 3600);
    tokens[role] = token;
  }
  return { d1, tokens, theme: () => JSON.parse(d1.db.prepare("SELECT settings_json FROM organisations WHERE id='org-1'").get().settings_json).theme };
}

async function call(d1, method, path, body, session) {
  const headers = { "Content-Type": "application/json" };
  if (session) { headers.Authorization = "Bearer " + session; headers["X-Org-Id"] = "org-1"; }
  const res = await worker.fetch(new Request("https://worker.test" + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  }), { DB: d1, CORS_ORIGIN: "*", BOOTSTRAP_DEVELOPER_FP: "" });
  return { status: res.status, body: await res.json() };
}
const saveTheme = (ctx, theme, role = "lead_admin") => call(ctx.d1, "POST", "/org/settings", { theme }, ctx.tokens[role]);

test("a good theme saves and reads back", async () => {
  const ctx = setup();
  const theme = { primary: "#B91C1C", accent: "#1D4ED8", qrFg: "#111111", palette: ["#B91C1C", "#F59E0B"], darkMode: true, bgMode: "pattern", bgPattern: "hex" };
  const res = await saveTheme(ctx, theme);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  for (const [k, v] of Object.entries(theme)) assert.deepEqual(ctx.theme()[k], v, k);
});

const BAD = [
  ["primary not hex", { primary: "red" }, /primary/],
  ["primary 3-digit hex", { primary: "#F00" }, /primary/],
  ["primary with CSS after it", { primary: "#B91C1C; background:url(https://evil.example)" }, /primary/],
  ["accent with a script", { accent: "<script>alert(1)</script>" }, /accent/],
  ["qrFg too pale to scan (contrast under 4.5:1 on white)", { qrFg: "#CCCCCC" }, /contrast/],
  ["palette longer than 7", { palette: Array(8).fill("#111111") }, /palette length/],
  ["palette with a bad entry", { palette: ["#111111", "blue"] }, /palette entries/],
  ["palette not an array", { palette: "#111111" }, /palette must be an array/],
  ["bgPalette longer than 7", { bgPalette: Array(8).fill("#111111") }, /bgPalette length/],
  ["darkMode not true/false/auto", { darkMode: "sometimes" }, /darkMode/],
  ["bgMode unknown", { bgMode: "video" }, /bgMode/],
  ["bgPattern unknown", { bgPattern: "<b>" }, /bgPattern/],
  ["bgImageUrl javascript:", { bgImageUrl: "javascript:alert(1)" }, /bgImageUrl/],
  ["bgImageUrl plain http", { bgImageUrl: "http://evil.example/x.png" }, /bgImageUrl/],
  ["bgImageUrl data: that is not an image", { bgImageUrl: "data:text/html,<script>alert(1)</script>" }, /bgImageUrl/],
  ["bgImageUrl too long", { bgImageUrl: "data:image/png;base64," + "A".repeat(300001) }, /too long/],
  ["bgAnimDuration out of range", { bgAnimDuration: 0 }, /bgAnimDuration/],
  ["theme not an object", "dark", /theme must be an object/]
];
for (const [name, theme, msg] of BAD) {
  test(`refused: ${name}; nothing is saved`, async () => {
    const ctx = setup();
    await saveTheme(ctx, { primary: "#15803D" });
    const res = await saveTheme(ctx, theme);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.match(res.body.error, msg);
    assert.deepEqual(ctx.theme(), { primary: "#15803D" }, "the earlier theme is untouched");
  });
}

test("qrFg exactly dark enough is accepted (the 4.5:1 line)", async () => {
  const ctx = setup();
  // #767676 on white is 4.54:1, the lightest grey that passes.
  assert.equal((await saveTheme(ctx, { qrFg: "#767676" })).status, 200);
  assert.equal((await saveTheme(ctx, { qrFg: "#777777" })).status, 400, "#777777 is 4.48:1");
});

test("theme: null clears the theme back to the plain look", async () => {
  const ctx = setup();
  await saveTheme(ctx, { primary: "#15803D", palette: ["#15803D"] });
  const res = await saveTheme(ctx, null);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  // Stored as an empty object: no colours left, so pages fall back to IRLid's own.
  assert.deepEqual(ctx.theme() || {}, {});
  const info = await call(ctx.d1, "GET", "/org/entry-info/theme-hall");
  assert.equal(info.body.theme.primary, null);
  assert.deepEqual(info.body.theme.palette, []);
});

test("a theme save with no sign-in is refused", async () => {
  const ctx = setup();
  const res = await call(ctx.d1, "POST", "/org/settings", { theme: { primary: "#B91C1C" } });
  assert.ok(res.status === 401 || res.status === 403, String(res.status));
  assert.equal(ctx.theme(), undefined);
});

test("public entry-info hands out only safe branding: no keys, no members, no venue location", async () => {
  const ctx = setup();
  const res0 = await saveTheme(ctx, {
    primary: "#B91C1C", accent: "#1D4ED8", qrFg: "#111111", palette: ["#B91C1C", "#F59E0B"], darkMode: false,
    bgImageUrl: "https://theme.example/bg.png",
    _v512: { bannerText: "{org}", sound: { secret: "x" } },
    somethingUnknown: "<script>alert(1)</script>"
  });
  assert.equal(res0.status, 200, JSON.stringify(res0.body));
  const res = await call(ctx.d1, "GET", "/org/entry-info/theme-hall");
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const raw = JSON.stringify(res.body);
  for (const leak of [ORG_KEY, "org-1", "lead-1", "fp-lead", "door@theme.example", "52.1", "somethingUnknown", "<script>", "secret", "bg.png"]) {
    assert.ok(!raw.includes(leak), "entry-info must not contain " + leak + ": " + raw);
  }
  assert.deepEqual(Object.keys(res.body.theme).sort(), ["accent", "brandFont", "darkMode", "palette", "primary", "qrFg"]);
  assert.equal(res.body.theme.primary, "#B91C1C");
  assert.equal(res.body.theme.darkMode, "light");
  assert.equal(res.body.name, "Theme Hall");
});

test("entry-info re-checks stored colours, so a bad value already in the database is not handed out", async () => {
  const ctx = setup();
  // As if an old build had saved it before validation existed.
  ctx.d1.db.prepare("UPDATE organisations SET settings_json=? WHERE id='org-1'")
    .run(JSON.stringify({ theme: { primary: "red;background:url(x)", accent: "#1D4ED8", palette: ["#111111", "nope", "#222222"] } }));
  const res = await call(ctx.d1, "GET", "/org/entry-info/theme-hall");
  assert.equal(res.body.theme.primary, null);
  assert.equal(res.body.theme.accent, "#1D4ED8");
  assert.deepEqual(res.body.theme.palette, ["#111111", "#222222"]);
});
