// IRLid Org dashboard — push-update client (v6.8.0).
//
// Opens one WebSocket to the org's Durable Object hub and calls onEvent() for
// each tiny {type, ids, nonce} message. It is only an ACCELERATOR: if the
// socket cannot open, drops, or the Worker has no hub yet, the page keeps
// working on slow polling (the page asks isOpen() to decide). Reconnects use
// exponential backoff with jitter. Nothing here is needed for check-in, so
// offline-first behaviour is unchanged.
//
// Auth: the org key is sent once, in a header, to POST /org/ws-ticket. The
// socket itself carries only a 60 s ticket, in the Sec-WebSocket-Protocol
// header (never in the URL).
(function (root) {
  "use strict";

  var BACKOFF_STEPS_MS = [1000, 2000, 4000, 8000, 15000, 30000, 60000];
  var UNAVAILABLE_RETRY_MS = 5 * 60 * 1000;   // Worker has no hub (404/501) or key not accepted (401/403): try again rarely
  var PING_EVERY_MS = 30000;                  // answered by the runtime, free, keeps proxies awake
  var PONG_TIMEOUT_MS = 45000;                // M1: no pong (or any message) this long = half-open socket, reconnect

  function createOrgHubClient(opts) {
    var getTicket = opts.getTicket;           // () => Promise<{ticket, protocol}>
    var buildUrl = opts.buildUrl;             // () => "wss://…/org/ws"
    var onEvent = opts.onEvent || function () {};
    var onState = opts.onState || function () {};
    var WS = opts.WebSocketImpl || root.WebSocket;
    var setT = opts.setTimeout || root.setTimeout.bind(root);
    var clearT = opts.clearTimeout || root.clearTimeout.bind(root);
    var setI = opts.setInterval || root.setInterval.bind(root);
    var clearI = opts.clearInterval || root.clearInterval.bind(root);
    var random = opts.random || Math.random;
    var isOnline = opts.isOnline || function () { return root.navigator ? root.navigator.onLine !== false : true; };

    var state = "stopped";                    // stopped | connecting | open | down
    var running = false;
    var socket = null;
    var attempt = 0;
    var retryTimer = null;
    var pingTimer = null;
    var generation = 0;
    var lastHeard = 0;                        // last time anything arrived on the socket (M1 watchdog)

    function setState(next) {
      if (state === next) return;
      state = next;
      try { onState(next); } catch (_) {}
    }

    function clearTimers() {
      if (retryTimer) { clearT(retryTimer); retryTimer = null; }
      if (pingTimer) { clearI(pingTimer); pingTimer = null; }
    }

    function nextDelay(unavailable) {
      if (unavailable) return UNAVAILABLE_RETRY_MS;
      var base = BACKOFF_STEPS_MS[Math.min(attempt, BACKOFF_STEPS_MS.length - 1)];
      attempt += 1;
      return Math.round(base * (0.75 + random() * 0.5));
    }

    function scheduleRetry(unavailable) {
      if (!running) return;
      if (retryTimer) clearT(retryTimer);
      setState("down");
      retryTimer = setT(function () { retryTimer = null; connect(); }, nextDelay(unavailable));
    }

    function closeSocket() {
      var s = socket; socket = null;
      generation += 1;
      if (pingTimer) { clearI(pingTimer); pingTimer = null; }
      if (s) { try { s.close(); } catch (_) {} }
    }

    async function connect() {
      if (!running || state === "connecting" || state === "open") return;
      if (!WS) { setState("down"); return; }
      if (!isOnline()) { setState("down"); return; }      // the 'online' event calls reconnectNow()
      var gen = ++generation;
      setState("connecting");
      var t;
      try {
        t = await getTicket();
      } catch (err) {
        if (gen !== generation) return;
        var st = err && err.status;
        scheduleRetry(st === 401 || st === 403 || st === 404 || st === 501);
        return;
      }
      if (gen !== generation || !running) return;
      var ws;
      try {
        ws = new WS(buildUrl(), [t.protocol || "irlid.v1", "ticket." + t.ticket]);
      } catch (_) { scheduleRetry(false); return; }
      socket = ws;
      ws.onopen = function () {
        if (gen !== generation) return;
        attempt = 0;
        lastHeard = Date.now();
        setState("open");
        pingTimer = setI(function () {
          if (gen !== generation) return;
          if (Date.now() - lastHeard > PONG_TIMEOUT_MS) {
            // Half-open: treat as lost so the page falls back to fast polling.
            socket = null; generation += 1;
            if (pingTimer) { clearI(pingTimer); pingTimer = null; }
            try { ws.close(); } catch (_) {}
            scheduleRetry(false);
            return;
          }
          try { ws.send("ping"); } catch (_) {}
        }, PING_EVERY_MS);
      };
      ws.onmessage = function (m) {
        if (gen !== generation) return;
        lastHeard = Date.now();
        if (m.data === "pong") return;
        var ev; try { ev = JSON.parse(m.data); } catch (_) { return; }
        if (ev && typeof ev.type === "string") { try { onEvent(ev); } catch (_) {} }
      };
      var lost = function () {
        if (gen !== generation) return;
        socket = null;
        if (pingTimer) { clearI(pingTimer); pingTimer = null; }
        scheduleRetry(false);
      };
      ws.onclose = lost;
      ws.onerror = function () { /* onclose follows */ };
    }

    return {
      start: function () {
        if (running) return;
        running = true; attempt = 0;
        connect();
      },
      stop: function () {
        running = false;
        clearTimers();
        closeSocket();
        setState("stopped");
      },
      // Called on the browser 'online' event: skip the backoff wait.
      reconnectNow: function () {
        if (!running || state === "open" || state === "connecting") return;
        clearTimers(); attempt = 0; connect();
      },
      isOpen: function () { return state === "open"; },
      state: function () { return state; }
    };
  }

  var api = { createOrgHubClient: createOrgHubClient, PONG_TIMEOUT_MS: PONG_TIMEOUT_MS, BACKOFF_STEPS_MS: BACKOFF_STEPS_MS, UNAVAILABLE_RETRY_MS: UNAVAILABLE_RETRY_MS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IRLidOrgHubClient = api;
})(typeof window !== "undefined" ? window : globalThis);
