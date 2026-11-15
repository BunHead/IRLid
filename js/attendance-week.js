// IRLid dashboard: the "Last 7 days" attendance list and its CSV (v6.8.15).
// Pure helpers, no DOM and no network, so they can be tested on their own.
// All dates and times are venue time (Europe/London, rule C5), never the
// viewer's phone time zone.
(function (root) {
  "use strict";
  var TZ = "Europe/London";
  var dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  var timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hourCycle: "h23", hour: "2-digit", minute: "2-digit" });
  var dayNameFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });

  function toMs(v) {
    var n = Number(v);
    if (!isFinite(n) || n <= 0) return null;
    return n < 1e12 ? n * 1000 : n; // the Worker sends unix seconds
  }
  function londonDate(v) { var ms = toMs(v); return ms ? dateFmt.format(new Date(ms)) : ""; }
  function londonTime(v) { var ms = toMs(v); return ms ? timeFmt.format(new Date(ms)) : ""; }
  function londonDayLabel(v) { var ms = toMs(v); return ms ? dayNameFmt.format(new Date(ms)) : ""; }

  function rowName(r) { return String((r && (r.name || r.attendee_label)) || "").trim(); }

  // How it was checked in, in words (never "fresh" for an offline one, rule C9).
  function kindOf(r) {
    var a = String((r && r.assurance) || "").toLowerCase();
    if (a === "fresh") return "fresh";
    if (a === "offline") return "offline / unverified";
    return a ? a : "unverified";
  }
  function statusOf(r) {
    if (r && r.checkout_at) return "out";
    return "in";
  }

  // Check-ins only: a "linked expected" placeholder row has no check-in time.
  function realRows(rows) {
    return (rows || []).filter(function (r) { return r && !r.expected_only && toMs(r.checkin_at); });
  }

  // Newest day first; inside a day, earliest check-in first.
  function groupByDay(rows) {
    var days = {};
    realRows(rows).forEach(function (r) {
      var d = londonDate(r.checkin_at);
      (days[d] = days[d] || []).push(r);
    });
    return Object.keys(days).sort().reverse().map(function (d) {
      var list = days[d].slice().sort(function (a, b) { return toMs(a.checkin_at) - toMs(b.checkin_at); });
      return { date: d, label: londonDayLabel(list[0].checkin_at), rows: list };
    });
  }

  // A spreadsheet runs a cell that starts with = + - @ as a formula. Names
  // come from the public, so defuse them (S11-style: never trust org text).
  function csvCell(value) {
    var s = String(value == null ? "" : value);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  var CSV_HEADER = ["date", "name", "checked_in", "checked_out", "status", "check_in_kind", "check_out_method", "event_id"];

  function buildCsv(rows) {
    var lines = [CSV_HEADER.join(",")];
    groupByDay(rows).slice().reverse().forEach(function (g) { // oldest day first in the file
      g.rows.forEach(function (r) {
        lines.push([
          g.date,
          rowName(r),
          londonTime(r.checkin_at),
          londonTime(r.checkout_at),
          statusOf(r),
          kindOf(r),
          r.checkout_at ? String(r.checkout_method || "") : "",
          r.event_id || ""
        ].map(csvCell).join(","));
      });
    });
    return lines.join("\r\n") + "\r\n";
  }

  root.IRLidAttendanceWeek = {
    TZ: TZ, CSV_HEADER: CSV_HEADER,
    londonDate: londonDate, londonTime: londonTime, londonDayLabel: londonDayLabel,
    groupByDay: groupByDay, buildCsv: buildCsv, csvCell: csvCell, kindOf: kindOf
  };
})(typeof window !== "undefined" ? window : globalThis);
