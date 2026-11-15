// IRLid attendee phone: plain-English reasons for a check-in that was queued
// or refused (v6.8.15). Pure text helpers, no DOM, no network.
// Rules: C7 (queued check-ins are never silent), C8 (a refused or quarantined
// one gets a visible notice), C9 / I1 (never pass an offline check-in off as
// verified), S13 (the phone only explains what the server or its own
// connection said; it decides nothing).
(function (root) {
  "use strict";

  // Why the check-in was saved on the phone instead of sent now.
  //   offline    - the phone reports no connection
  //   timeout    - the request hung and was stopped (js/fetch-timeout.js)
  //   unreachable - the request failed after retries
  function queuedReason(info) {
    var i = info || {};
    if (i.offline) return "offline";
    if (i.timedOut) return "timeout";
    return "unreachable";
  }

  var QUEUED_META = {
    offline: "Saved offline: no internet on this phone. It will send itself when you are back online.",
    timeout: "Saved offline: the venue server was too slow to answer. It will send itself shortly.",
    unreachable: "Saved offline: the venue server could not be reached. It will send itself when it can."
  };
  function queuedMeta(reason) { return QUEUED_META[reason] || QUEUED_META.unreachable; }

  // Why the check-in was refused or held. `err` is what the page caught:
  // err.status, err.data (the Worker's JSON), err.message.
  // Returns { title, subtitle, meta } for the result screen.
  function refusalText(err) {
    var e = err || {};
    var d = e.data || {};
    var reason = d.reason || "";
    if (reason === "live_code_required") {
      return { title: "Scan the live screen", subtitle: "This venue only counts check-ins made by scanning its screen in person", meta: "Not counted. Please ask staff for help" };
    }
    if (reason === "outside_event_times") {
      return { title: "Check-in rejected", subtitle: "This event is not open for check-in right now", meta: "Refused: outside the event's check-in times" };
    }
    if (d.quarantined || e.status === 202) {
      return { title: "Check-in held for staff", subtitle: "It was kept for staff to review and was not counted", meta: "Held: this phone's signature could not be verified. Please see staff." };
    }
    if (e.status === 401) {
      return { title: "Check-in rejected", subtitle: "This phone's signature did not verify", meta: "Refused: the check-in was not signed correctly. Please see staff." };
    }
    if (e.status === 403 && d.error === "session_org_mismatch") {
      return { title: "Check-in rejected", subtitle: "This sign-in belongs to a different organisation", meta: "Refused: wrong organisation. Please see staff." };
    }
    if (e.status === 429) {
      return { title: "Check-in not sent", subtitle: "Too many tries in a short time", meta: "Refused: please wait a minute and scan again" };
    }
    if (e.status >= 500) {
      return { title: "Check-in not sent", subtitle: "The venue server had a problem", meta: "Not recorded: please scan again or see staff" };
    }
    return {
      title: "Check-in rejected",
      subtitle: e.message || "Could not record check-in",
      meta: e.status ? "Refused by the venue server (" + e.status + "). Please ask staff for help" : "Please ask staff for help"
    };
  }

  root.IRLidCheckinReasons = { queuedReason: queuedReason, queuedMeta: queuedMeta, refusalText: refusalText };
})(typeof window !== "undefined" ? window : globalThis);
