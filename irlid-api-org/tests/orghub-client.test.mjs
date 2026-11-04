// Page-side push client (js/orghub-client.js) + wiring checks on Org.html.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// Browser script: loading it registers window.IRLidOrgHubClient (globalThis here).
await import("../../js/orghub-client.js");
const { createOrgHubClient, BACKOFF_STEPS_MS, UNAVAILABLE_RETRY_MS } = globalThis.IRLidOrgHubClient;

// Manual timers so backoff can be asserted without waiting.
function harness(extra = {}) {
  const timers = []; const sockets = []; const states = []; const events = [];
  const WebSocketImpl = class {
    constructor(url, protocols) { this.url = url; this.protocols = protocols; this.sent = []; sockets.push(this); }
    send(m) { this.sent.push(m); } close() { this.closed = true; }
  };
  const client = createOrgHubClient({
    getTicket: async () => ({ ticket: "tkt123", protocol: "irlid.v1" }),
    buildUrl: () => "wss://worker.test/org/ws",
    onEvent: e => events.push(e), onState: s => states.push(s),
    WebSocketImpl, random: () => 0.5, isOnline: () => true,
    setTimeout: (fn, ms) => { const t = { fn, ms }; timers.push(t); return t; },
    clearTimeout: t => { if (t) t.cleared = true; },
    setInterval: (fn, ms) => ({ fn, ms, interval: true }), clearInterval: () => {},
    ...extra
  });
  const flush = () => new Promise(r => setImmediate(r));
  return { client, timers, sockets, states, events, flush };
}

test("connects with the ticket in the subprotocol, never in the URL", async () => {
  const h = harness(); h.client.start(); await h.flush();
  assert.equal(h.sockets.length, 1);
  assert.equal(h.sockets[0].url, "wss://worker.test/org/ws");
  assert.deepEqual(h.sockets[0].protocols, ["irlid.v1", "ticket.tkt123"]);
  assert.ok(!h.sockets[0].url.includes("tkt123"));
  h.sockets[0].onopen();
  assert.equal(h.client.isOpen(), true);
});

test("delivers parsed events, ignores pong and junk", async () => {
  const h = harness(); h.client.start(); await h.flush(); h.sockets[0].onopen();
  h.sockets[0].onmessage({ data: JSON.stringify({ type: "attendance", ids: ["c1"] }) });
  h.sockets[0].onmessage({ data: "pong" });
  h.sockets[0].onmessage({ data: "{not json" });
  h.sockets[0].onmessage({ data: JSON.stringify({ nope: 1 }) });
  assert.deepEqual(h.events, [{ type: "attendance", ids: ["c1"] }]);
});

test("reconnects with growing backoff, resets after a good connection", async () => {
  const h = harness(); h.client.start(); await h.flush();
  const delays = [];
  for (let i = 0; i < 4; i++) {
    h.sockets.at(-1).onclose();
    const t = h.timers.at(-1); delays.push(t.ms);
    t.fn(); await h.flush();
  }
  assert.deepEqual(delays, [1000, 2000, 4000, 8000]);
  assert.equal(h.client.state(), "connecting");
  h.sockets.at(-1).onopen();                      // success resets the counter
  h.sockets.at(-1).onclose();
  assert.equal(h.timers.at(-1).ms, 1000);
  assert.equal(h.client.isOpen(), false, "page falls back to polling while down");
});

test("backoff never exceeds its cap", async () => {
  const h = harness(); h.client.start(); await h.flush();
  for (let i = 0; i < 15; i++) { h.sockets.at(-1).onclose(); h.timers.at(-1).fn(); await h.flush(); }
  h.sockets.at(-1).onclose();
  assert.equal(h.timers.at(-1).ms, BACKOFF_STEPS_MS.at(-1));
});

test("a Worker without the hub (404/501) or a rejected key (401) is retried only rarely", async () => {
  for (const status of [404, 501, 401]) {
    const h = harness({ getTicket: async () => { const e = new Error("x"); e.status = status; throw e; } });
    h.client.start(); await h.flush();
    assert.equal(h.sockets.length, 0);
    assert.equal(h.timers.at(-1).ms, UNAVAILABLE_RETRY_MS);
    assert.equal(h.client.isOpen(), false);
  }
});

test("a network failure fetching the ticket uses normal backoff", async () => {
  const h = harness({ getTicket: async () => { throw new TypeError("Failed to fetch"); } });
  h.client.start(); await h.flush();
  assert.equal(h.timers.at(-1).ms, 1000);
});

test("does not try while offline; reconnectNow() (online event) connects without waiting", async () => {
  let online = false;
  const h = harness({ isOnline: () => online });
  h.client.start(); await h.flush();
  assert.equal(h.sockets.length, 0);
  online = true; h.client.reconnectNow(); await h.flush();
  assert.equal(h.sockets.length, 1);
});

test("stop() closes the socket, cancels retries and ignores late callbacks", async () => {
  const h = harness(); h.client.start(); await h.flush();
  const s = h.sockets[0]; s.onopen();
  h.client.stop();
  assert.equal(s.closed, true);
  assert.equal(h.client.state(), "stopped");
  s.onmessage({ data: JSON.stringify({ type: "attendance" }) });
  s.onclose();
  assert.equal(h.events.length, 0);
  assert.equal(h.timers.filter(t => !t.cleared).length, 0);
});

test("a missing WebSocket (old browser) just stays down", async () => {
  const h = harness({ WebSocketImpl: null });
  h.client.start(); await h.flush();
  assert.equal(h.client.isOpen(), false);
});

// ---- wiring in the shipped page (guards against the polls being removed) ----
const orgHtml = readFileSync(new URL("../../Org.html", import.meta.url), "utf8");
const sw = readFileSync(new URL("../../sw.js", import.meta.url), "utf8");

test("Org.html loads the push client and keeps slow-poll fallbacks, visible tab only", () => {
  assert.match(orgHtml, /<script src="js\/orghub-client\.js"><\/script>/);
  assert.match(orgHtml, /slowPollDue\('attendance', 60000, 15000\)/);
  assert.match(orgHtml, /slowPollDue\('nonce', 60000, 15000\)/);
  assert.match(orgHtml, /document\.visibilityState !== 'visible'\) return false/);
  assert.match(orgHtml, /setInterval\(checkVenueQrNonceUsed, 2000\)/, "backup-QR retry tick is unchanged");
});

test("backup-QR retry (no live nonce) runs before the hub gate, so offline mode is unchanged", () => {
  const body = orgHtml.slice(orgHtml.indexOf("async function checkVenueQrNonceUsed"));
  const retry = body.indexOf("if (venueQrOffline && navigator.onLine !== false) await generateVenueQR();");
  const gate = body.indexOf("slowPollDue('nonce'");
  assert.ok(retry > 0 && gate > retry);
});

test("service worker caches the client and the cache version moved on (W8)", () => {
  assert.match(sw, /'\.\/js\/orghub-client\.js'/);
  assert.ok(Number(sw.match(/CACHE_VERSION = 'irlid-shell-v(\d+)'/)[1]) >= 189);
});
