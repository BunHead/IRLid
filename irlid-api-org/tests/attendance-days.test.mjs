// v6.8.15: "Attendance - Today" means today at the venue (Europe/London), and
// "Last 7 days" is the last 7 London days. Before, the dashboard sent no start
// time and the Worker used a rolling 24 hours, so yesterday evening stayed on
// "Today" until the same time the next day, and a phone in another time zone
// would have moved the boundary. Rule C5 (venue local time).
import test from "node:test";
import assert from "node:assert/strict";
import worker, { venueDayStart, venueDateOf } from "../src/index.js";
import { SqliteD1 } from "./helpers/sqlite-d1.mjs";

const iso = (s) => Math.floor(Date.parse(s) / 1000);
const KEY1 = "org_attendance_one_1234567890";
const KEY2 = "org_attendance_two_1234567890";

// ---- the day boundary -------------------------------------------------------

test("London midnight in winter (GMT) is 00:00 UTC", () => {
  assert.equal(venueDayStart(iso("2026-11-15T12:00:00Z")), iso("2026-11-15T00:00:00Z"));
  assert.equal(venueDayStart(iso("2026-11-15T00:00:00Z")), iso("2026-11-15T00:00:00Z"));
  assert.equal(venueDayStart(iso("2026-11-15T23:59:59Z")), iso("2026-11-15T00:00:00Z"));
});

test("London midnight in summer (BST) is 23:00 UTC the evening before", () => {
  assert.equal(venueDayStart(iso("2026-07-15T12:00:00Z")), iso("2026-07-14T23:00:00Z"));
  // 22:59 UTC on the 15th is 23:59 BST: still the 15th.
  assert.equal(venueDayStart(iso("2026-07-15T22:59:00Z")), iso("2026-07-14T23:00:00Z"));
  // 23:00 UTC on the 15th is 00:00 BST on the 16th: a new day.
  assert.equal(venueDayStart(iso("2026-07-15T23:00:00Z")), iso("2026-07-15T23:00:00Z"));
  assert.equal(venueDayStart(iso("2026-07-15T23:30:00Z")), iso("2026-07-15T23:00:00Z"));
});

test("clock-change days: 23 h in March, 25 h in October", () => {
  // Spring forward 29 Mar 2026: the day starts 00:00 GMT, the next day 00:00 BST (23:00 UTC).
  assert.equal(venueDayStart(iso("2026-03-29T12:00:00Z")), iso("2026-03-29T00:00:00Z"));
  assert.equal(venueDayStart(iso("2026-03-30T12:00:00Z")), iso("2026-03-29T23:00:00Z"));
  // Fall back 25 Oct 2026: the day starts 00:00 BST (23:00 UTC the 24th), the next 00:00 GMT.
  assert.equal(venueDayStart(iso("2026-10-25T12:00:00Z")), iso("2026-10-24T23:00:00Z"));
  assert.equal(venueDayStart(iso("2026-10-26T12:00:00Z")), iso("2026-10-26T00:00:00Z"));
});

test("six days back is the first of the last 7 London days, across a clock change", () => {
  assert.equal(venueDayStart(iso("2026-11-15T12:00:00Z"), 6), iso("2026-11-09T00:00:00Z"));
  // 27 Oct (GMT) minus 6 days is 21 Oct, which is still BST: midnight is 23:00 UTC on the 20th.
  assert.equal(venueDayStart(iso("2026-10-27T12:00:00Z"), 6), iso("2026-10-20T23:00:00Z"));
  // 26 Oct (GMT) minus 2 days is 24 Oct (BST): the 25 h day is crossed correctly.
  assert.equal(venueDayStart(iso("2026-10-26T12:00:00Z"), 2), iso("2026-10-23T23:00:00Z"));
});

test("venueDateOf gives the London calendar date", () => {
  assert.equal(venueDateOf(iso("2026-07-14T23:30:00Z")), "2026-07-15");
  assert.equal(venueDateOf(iso("2026-11-15T23:30:00Z")), "2026-11-15");
});

// ---- the API ----------------------------------------------------------------

function setup() {
  const d1 = new SqliteD1();
  d1.exec("INSERT INTO organisations (id,name,slug,api_key,created_at,updated_at) VALUES ('org-1','One','one',?,0,0)", KEY1);
  d1.exec("INSERT INTO organisations (id,name,slug,api_key,created_at,updated_at) VALUES ('org-2','Two','two',?,0,0)", KEY2);
  return d1;
}
let n = 0;
function checkin(d1, org, name, at, extra = {}) {
  n += 1;
  d1.exec(
    "INSERT INTO org_checkins (id,org_id,mode,attendee_label,name,checkin_at,checkout_at,created_at,assurance,status) VALUES (?,?,?,?,?,?,?,?,?,'checked_in')",
    "c" + n, org, "attendee_scan", name, name, at, extra.out || null, at, extra.assurance || "offline"
  );
}
async function withNow(isoNow, fn) {
  const real = Date.now;
  Date.now = () => Date.parse(isoNow);
  try { return await fn(); } finally { Date.now = real; }
}
async function get(d1, path, key = KEY1) {
  const res = await worker.fetch(new Request("https://worker.test" + path, { headers: { "X-Org-Key": key } }), { DB: d1, CORS_ORIGIN: "*" });
  return { status: res.status, body: await res.json() };
}
const names = (b) => b.checkins.map(c => c.name).sort();

test("range=today drops yesterday evening at London midnight (BST); the old 24 h window did not", async () => {
  const d1 = setup();
  // Now is 00:30 BST on 15 July 2026.
  checkin(d1, "org-1", "Late Larry", iso("2026-07-14T22:00:00Z"));   // 23:00 BST on the 14th
  checkin(d1, "org-1", "Early Edna", iso("2026-07-14T23:10:00Z"));   // 00:10 BST on the 15th
  await withNow("2026-07-14T23:30:00Z", async () => {
    const today = await get(d1, "/org/attendance?range=today");
    assert.equal(today.status, 200);
    assert.deepEqual(names(today.body), ["Early Edna"]);
    assert.equal(today.body.since, iso("2026-07-14T23:00:00Z"));
    assert.equal(today.body.venue_time_zone, "Europe/London");
    const old = await get(d1, "/org/attendance"); // legacy callers keep the rolling 24 h
    assert.deepEqual(names(old.body), ["Early Edna", "Late Larry"]);
  });
});

test("range=today in winter flips at 00:00 UTC, and 23:30 UTC is still the same day", async () => {
  const d1 = setup();
  checkin(d1, "org-1", "Yesterday Yan", iso("2026-11-14T23:50:00Z"));
  checkin(d1, "org-1", "Today Tia", iso("2026-11-15T00:05:00Z"));
  await withNow("2026-11-15T23:30:00Z", async () => {
    assert.deepEqual(names((await get(d1, "/org/attendance?range=today")).body), ["Today Tia"]);
  });
});

test("the phone's own time zone cannot move the boundary (range wins over since)", async () => {
  const d1 = setup();
  checkin(d1, "org-1", "Old Olly", iso("2026-11-14T20:00:00Z"));
  checkin(d1, "org-1", "New Nia", iso("2026-11-15T09:00:00Z"));
  await withNow("2026-11-15T12:00:00Z", async () => {
    const sinceFromAnotherZone = iso("2026-11-14T10:00:00Z"); // e.g. a phone in Sydney
    const r = await get(d1, "/org/attendance?range=today&since=" + sinceFromAnotherZone);
    assert.deepEqual(names(r.body), ["New Nia"]);
  });
});

test("range=7d returns the last 7 London days, today included, newest data only", async () => {
  const d1 = setup();
  const days = ["2026-11-08", "2026-11-09", "2026-11-12", "2026-11-15"]; // 8 Nov is 7 days back: out
  days.forEach((d, i) => checkin(d1, "org-1", "P" + i + "-" + d, iso(d + "T10:00:00Z")));
  await withNow("2026-11-15T12:00:00Z", async () => {
    const r = await get(d1, "/org/attendance?range=7d");
    assert.equal(r.status, 200);
    assert.deepEqual(names(r.body), ["P1-2026-11-09", "P2-2026-11-12", "P3-2026-11-15"]);
    assert.equal(r.body.range, "7d");
    assert.equal(r.body.since, iso("2026-11-09T00:00:00Z"));
    assert.equal(r.body.truncated, false);
    // No "expected, not yet seen" placeholder rows in this list.
    assert.ok(r.body.checkins.every(c => !c.expected_only));
  });
});

test("range=7d never returns another organisation's check-ins", async () => {
  const d1 = setup();
  checkin(d1, "org-1", "Mine Mia", iso("2026-11-15T09:00:00Z"));
  checkin(d1, "org-2", "Theirs Tom", iso("2026-11-15T09:00:00Z"));
  await withNow("2026-11-15T12:00:00Z", async () => {
    assert.deepEqual(names((await get(d1, "/org/attendance?range=7d", KEY1)).body), ["Mine Mia"]);
    assert.deepEqual(names((await get(d1, "/org/attendance?range=7d", KEY2)).body), ["Theirs Tom"]);
    const noKey = await worker.fetch(new Request("https://worker.test/org/attendance?range=7d"), { DB: d1, CORS_ORIGIN: "*" });
    assert.ok(noKey.status === 401 || noKey.status === 403);
  });
});

test("range=7d says so when the list is cut at the limit", async () => {
  const d1 = setup();
  for (let i = 0; i < 5; i += 1) checkin(d1, "org-1", "Person " + i, iso("2026-11-15T09:0" + i + ":00Z"));
  await withNow("2026-11-15T12:00:00Z", async () => {
    const r = await get(d1, "/org/attendance?range=7d&limit=3");
    assert.equal(r.body.checkins.length, 3);
    assert.equal(r.body.truncated, true);
    assert.equal(r.body.stats.total, 5, "totals still count every row");
  });
});

test("the dashboard asks for range=today and the 7-day list for range=7d", async () => {
  const { readFileSync } = await import("node:fs");
  const html = readFileSync(new URL("../../Org.html", import.meta.url), "utf8");
  const api = readFileSync(new URL("../../js/orgapi.js", import.meta.url), "utf8");
  assert.match(html, /listAttendance\(currentOrg\.id, \{ range: 'today' \}\)/);
  assert.match(html, /listAttendance\(currentOrg\.id, \{ range: '7d' \}\)/);
  assert.match(api, /params\.set\("range", options\.range\)/);
});
