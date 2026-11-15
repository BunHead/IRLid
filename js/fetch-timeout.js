// IRLid: fetch with a time limit (v6.8.15).
// A request that hangs (a Wi-Fi network with no internet behind it, a stalled
// Worker) used to wait for as long as the browser liked, so the page sat
// "loading" and the offline queue never took over. With a limit, a hung
// request fails cleanly as a network-type error (TypeError, timedOut = true),
// which every caller already treats like "no connection": check-ins are queued
// (rules C1, C7), the dashboard shows its normal "could not reach" message.
// Never use it for anything that must not be abandoned halfway: it only stops
// WAITING, the Worker may still finish the request, which is why every queued
// write carries an idempotency key.
(function (root) {
  "use strict";
  var DEFAULT_MS = 15000;

  function timedOutError(ms) {
    var e = new TypeError("Request timed out after " + Math.round(ms / 1000) + " s");
    e.timedOut = true;
    e.name = "TypeError";
    return e;
  }

  // fetchWithTimeout(url, options, ms): same as fetch(url, options), plus a limit.
  // A caller's own options.signal still works (it also cancels the request).
  function fetchWithTimeout(url, options, ms) {
    var limit = Number(ms) > 0 ? Number(ms) : DEFAULT_MS;
    var opts = Object.assign({}, options || {});
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var callerSignal = opts.signal || null;
    var timedOut = false;
    var timer = null;
    var onCallerAbort = null;
    if (ctl) {
      if (callerSignal) {
        if (callerSignal.aborted) ctl.abort();
        else {
          onCallerAbort = function () { ctl.abort(); };
          callerSignal.addEventListener("abort", onCallerAbort, { once: true });
        }
      }
      opts.signal = ctl.signal;
    }
    var racing = new Promise(function (_, reject) {
      timer = setTimeout(function () {
        timedOut = true;
        if (ctl) { try { ctl.abort(); } catch (_) {} }
        reject(timedOutError(limit));
      }, limit);
    });
    function cleanup() {
      clearTimeout(timer);
      if (callerSignal && onCallerAbort) callerSignal.removeEventListener("abort", onCallerAbort);
    }
    var request;
    try { request = fetch(url, opts); } catch (e) { cleanup(); return Promise.reject(e); }
    return Promise.race([request, racing]).then(
      function (r) { cleanup(); return r; },
      function (e) {
        cleanup();
        // An abort we caused is a timeout; one the caller caused stays an abort.
        if (timedOut && !(e && e.timedOut)) throw timedOutError(limit);
        throw e;
      }
    );
  }

  root.IRLidFetch = { fetch: fetchWithTimeout, DEFAULT_MS: DEFAULT_MS, isTimeout: function (e) { return !!(e && e.timedOut); } };
})(typeof window !== "undefined" ? window : globalThis);
