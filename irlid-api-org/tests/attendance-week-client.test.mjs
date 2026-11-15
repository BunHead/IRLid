// v6.8.15: "Last 7 days" list + CSV (js/attendance-week.js). Times are UK
// venue time whatever the viewer's time zone; names from the public can never
// run as a spreadsheet formula (rule S11 spirit); expected-only placeholder
// rows are not check-ins.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const ROOT = new URL("../../", import.meta.url);
const ctx = createContext({ Intl, Date, String, Number, Object, Array });
runInContext(readFileSync(new URL("js/attendance-week.js", ROOT), "utf8"), ctx);
const W = ctx.globalThis ? ctx.globalThis.IRLidAttendanceWeek : runInContext("IRLidAttendanceWeek", ctx);
const iso = (s) => Math.floor(Date.parse(s) / 1000);

test("UK time: a 23:30 UTC summer check-in is 00:30 the next London day", () => {
  assert.equal(W.londonDate(iso("2026-07-14T23:30:00Z")), "2026-07-15");
  assert.equal(W.londonTime(iso("2026-07-14T23:30:00Z")), "00:30");
  assert.equal(W.londonDate(iso("2026-11-14T23:30:00Z")), "2026-11-14");
  assert.equal(W.londonTime(iso("2026-11-14T23:30:00Z")), "23:30");
});

test("rows are grouped by London day, newest day first, earliest check-in first inside a day", () => {
  const days = JSON.parse(JSON.stringify(W.groupByDay([
    { name: "B", checkin_at: iso("2026-11-14T10:00:00Z") },
    { name: "A2", checkin_at: iso("2026-11-15T11:00:00Z") },
    { name: "A1", checkin_at: iso("2026-11-15T09:00:00Z") },
    { name: "Placeholder", expected_only: true },
    { name: "NoTime" }
  ])));
  assert.deepEqual(days.map(d => d.date), ["2026-11-15", "2026-11-14"]);
  assert.deepEqual(days[0].rows.map(r => r.name), ["A1", "A2"]);
  assert.equal(days.reduce((n, d) => n + d.rows.length, 0), 3, "placeholder and time-less rows are not check-ins");
});

test("CSV has a header, UK dates and times, status and how it was checked in", () => {
  const csv = W.buildCsv([
    { name: "Ann Archer", checkin_at: iso("2026-11-14T10:00:00Z"), checkout_at: iso("2026-11-14T12:30:00Z"), checkout_method: "signed", assurance: "fresh", event_id: "ev-1" },
    { name: "Bob", checkin_at: iso("2026-11-15T09:05:00Z"), assurance: "offline" }
  ]);
  const lines = csv.trim().split("\r\n");
  assert.equal(lines[0], "date,name,checked_in,checked_out,status,check_in_kind,check_out_method,event_id");
  assert.equal(lines[1], "2026-11-14,Ann Archer,10:00,12:30,out,fresh,signed,ev-1");
  assert.equal(lines[2], "2026-11-15,Bob,09:05,,in,offline / unverified,,");
  assert.ok(csv.endsWith("\r\n"));
});

test("an offline check-in is never labelled fresh (C9)", () => {
  assert.equal(W.kindOf({ assurance: "offline" }), "offline / unverified");
  assert.equal(W.kindOf({ assurance: "fresh" }), "fresh");
  assert.notEqual(W.kindOf({}), "fresh");
});

test("names that start like a spreadsheet formula are defused, commas and quotes are quoted", () => {
  const csv = W.buildCsv([
    { name: '=HYPERLINK("http://evil")', checkin_at: iso("2026-11-15T09:00:00Z") },
    { name: "+1 555", checkin_at: iso("2026-11-15T09:01:00Z") },
    { name: "-2+3", checkin_at: iso("2026-11-15T09:02:00Z") },
    { name: "@SUM(A1)", checkin_at: iso("2026-11-15T09:03:00Z") },
    { name: 'Smith, "Jo"', checkin_at: iso("2026-11-15T09:04:00Z") }
  ]);
  const body = csv.trim().split("\r\n").slice(1);
  assert.match(body[0], /^2026-11-15,"'=HYPERLINK\(""http:\/\/evil""\)",/);
  assert.match(body[1], /^2026-11-15,'\+1 555,/);
  assert.match(body[2], /^2026-11-15,'-2\+3,/);
  assert.match(body[3], /^2026-11-15,'@SUM\(A1\),/);
  assert.match(body[4], /^2026-11-15,"Smith, ""Jo""",/);
  for (const line of body) assert.doesNotMatch(line.split(",")[1] || "", /^[=+\-@]/);
});

test("an empty week gives just the header", () => {
  assert.equal(W.buildCsv([]), W.CSV_HEADER.join(",") + "\r\n");
});

test("the dashboard panel is staff-only, builds rows with textContent, and drops a late reply for another org", () => {
  const html = readFileSync(new URL("Org.html", ROOT), "utf8");
  assert.match(html, /id="attendanceWeekPanel" data-min-role="staff"/);
  const fn = html.slice(html.indexOf("async function loadAttendanceWeek"), html.indexOf("async function exportAttendanceWeekCsv"));
  assert.doesNotMatch(fn, /innerHTML/, "names never go into innerHTML (S11)");
  assert.match(fn, /generation !== orgLoadGeneration\) return/);
  assert.match(html, /attendanceWeekRows = null;/, "cleared when the organisation changes");
  assert.match(readFileSync(new URL("sw.js", ROOT), "utf8"), /'\.\/js\/attendance-week\.js'/);
});
