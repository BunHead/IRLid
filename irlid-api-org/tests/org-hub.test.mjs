import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import {
  OrgHub, mintWsTicket, verifyWsTicket, wsTicketOrgId, ticketFromProtocolHeader,
  cleanHubEvent, WS_PROTOCOL, MAX_SOCKETS_PER_ORG, MAX_SOCKET_AGE_MS
} from "../src/org-hub.js";
import { signedCheckinBody } from "./helpers/signed-checkin.mjs";

const ORG_KEY = "org_test_key_1234567890";
const ORG = { id: "org-1", api_key: ORG_KEY, slug: "test-org", name: "Test Org", settings_json: JSON.stringify({ anonymousMode: true }), venue_pub_jwk: null, venue_prv_jwk: null };
const nowS = () => Math.floor(Date.now() / 1000);

// ---- fakes ----------------------------------------------------------------
class FakeSocket {
  constructor(t = Date.now()) { this.sent = []; this.closed = null; this.att = { t }; }
  send(m) { this.sent.push(m); }
  close(code, reason) { this.closed = { code, reason }; }
  serializeAttachment(v) { this.att = v; }
  deserializeAttachment() { return this.att; }
}
function fakeCtx(sockets = []) {
  return { getWebSockets: () => sockets, acceptWebSocket: ws => sockets.push(ws), setWebSocketAutoResponse() {} };
}
// Node cannot build a 101 Response, so tests override the upgrade builder.
class TestHub extends OrgHub { makeUpgradeResponse(client) { return { status: 101, webSocket: client }; } }
globalThis.WebSocketPair = class { constructor() { this[0] = new FakeSocket(); this[1] = new FakeSocket(); } };

function fakeNamespace(hubs = new Map()) {
  return {
    hubs,
    idFromName: name => name,
    get(id) {
      if (!hubs.has(id)) hubs.set(id, new TestHub(fakeCtx(), {}));
      const hub = hubs.get(id);
      return { fetch: (input, init) => hub.fetch(input instanceof Request ? input : new Request(input, init)) };
    }
  };
}

class FakeStatement {
  constructor(db, sql) { this.db = db; this.sql = sql.replace(/\s+/g, " ").trim(); this.args = []; }
  bind(...a) { this.args = a; return this; }
  async first() { return this.db.execute(this.sql, this.args); }
  async all() { return { results: (await this.db.execute(this.sql, this.args)) || [] }; }
  async run() { return (await this.db.execute(this.sql, this.args)) || { meta: { changes: 0 } }; }
}
class FakeDB {
  constructor() { this.org = { ...ORG }; this.queries = []; }
  prepare(sql) { return new FakeStatement(this, sql); }
  async execute(sql, args) {
    this.queries.push(sql);
    if (sql.startsWith("SELECT * FROM organisations WHERE api_key=? OR id=? OR slug=?")) return this.org;
    if (sql.startsWith("SELECT * FROM organisations WHERE api_key=?")) return args[0] === ORG_KEY ? this.org : null;
    if (sql.startsWith("SELECT id, api_key FROM organisations WHERE id=?")) return args[0] === this.org.id ? { id: this.org.id, api_key: this.org.api_key } : null;
    if (sql.startsWith("CREATE TABLE IF NOT EXISTS org_checkin_nonces")) return { meta: { changes: 0 } };
    if (sql.startsWith("PRAGMA table_info(org_checkins)")) return ["id","org_id","event_id","assurance","gps_band","gps_distance_km","out_of_hours","clock_gap_s","checkout_at","checkout_method","live_nonce"].map(name => ({ name }));
    if (sql.startsWith("ALTER TABLE org_checkins ADD COLUMN")) return { meta: { changes: 0 } };
    if (sql.startsWith("SELECT nonce,org_api_key,event_id,expires_at,consumed_at FROM org_checkin_nonces")) return null;
    if (sql.startsWith("SELECT id,checkin_at,event_id,status,expected_id") && sql.includes("FROM org_checkins WHERE id=?")) return null;
    if (sql.includes("FROM weekly_events")) return null;
    if (sql.includes("FROM org_checkins WHERE org_id=? AND device_key_fp=?")) return null;
    if (sql.includes("FROM org_expected WHERE org_id=?") && sql.includes("LOWER(display_name)=LOWER(?)")) return null;
    if (sql.includes("FROM org_expected WHERE org_id=? AND device_pub_fp=?")) return null;
    if (sql.includes("FROM sqlite_master")) return null;
    if (sql.startsWith("INSERT INTO org_checkins")) return { meta: { changes: 1 } };
    if (sql.startsWith("INSERT INTO org_receipts")) return { meta: { changes: 1 } };
    if (sql.startsWith("SELECT id, staff_pub_fp, expires_at, created_at FROM org_staff_sessions")) return null;
    throw new Error(`Unhandled fake D1 query: ${sql}`);
  }
}

const ticketReq = (headers = { "X-Org-Key": ORG_KEY }) => new Request("https://worker.test/org/ws-ticket", { method: "POST", headers });
const wsReq = (ticket, extra = {}) => new Request("https://worker.test/org/ws", {
  headers: { Upgrade: "websocket", "Sec-WebSocket-Protocol": `${WS_PROTOCOL}, ticket.${ticket}`, ...extra }
});

// ---- ticket auth -----------------------------------------------------------
test("ws-ticket needs the org key (401 without it)", async () => {
  const env = { DB: new FakeDB(), ORG_HUB: fakeNamespace(), CORS_ORIGIN: "*" };
  assert.equal((await worker.fetch(ticketReq({}), env)).status, 401);
  assert.equal((await worker.fetch(ticketReq({ "X-Org-Key": "org_wrong" }), env)).status, 401);
});

test("ws-ticket returns a short-lived, no-store ticket and never echoes the org key", async () => {
  const env = { DB: new FakeDB(), ORG_HUB: fakeNamespace(), CORS_ORIGIN: "*" };
  const res = await worker.fetch(ticketReq(), env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  const text = await res.text();
  assert.ok(!text.includes(ORG_KEY), "api_key must not appear in the response");
  const body = JSON.parse(text);
  assert.equal(body.protocol, WS_PROTOCOL);
  assert.equal(body.url, "wss://worker.test/org/ws");
  assert.ok(!body.url.includes("?"), "no secrets or tickets in the URL");
  assert.ok(body.expires_at - nowS() <= 60 && body.expires_at - nowS() > 0);
});

test("ws-ticket is 501 (page falls back to polling) when the DO binding is missing", async () => {
  const res = await worker.fetch(ticketReq(), { DB: new FakeDB(), CORS_ORIGIN: "*" });
  assert.equal(res.status, 501);
});

test("ticket verifies for its org, and fails for expiry, tampering, another key or another org", async () => {
  const { ticket } = await mintWsTicket(ORG, nowS());
  assert.equal(await verifyWsTicket(ticket, ORG, nowS()), true);
  assert.equal(wsTicketOrgId(ticket), "org-1");
  assert.equal(await verifyWsTicket(ticket, ORG, nowS() + 61), false, "expired");
  assert.equal(await verifyWsTicket(ticket, { ...ORG, api_key: "org_rotated" }, nowS()), false, "key rotated");
  assert.equal(await verifyWsTicket(ticket, { ...ORG, id: "org-2" }, nowS()), false, "other org");
  const [p, s] = ticket.split(".");
  assert.equal(await verifyWsTicket(`${p}.${s.slice(0, -2)}AA`, ORG, nowS()), false, "tampered signature");
  const forged = Buffer.from(JSON.stringify({ v: 1, o: "org-1", e: nowS() + 9999, r: "x" })).toString("base64url");
  assert.equal(await verifyWsTicket(`${forged}.${s}`, ORG, nowS()), false, "forged expiry");
  assert.equal(await verifyWsTicket("garbage", ORG, nowS()), false);
  assert.equal(await verifyWsTicket(null, ORG, nowS()), false);
});

test("ticket is read from the Sec-WebSocket-Protocol header", () => {
  assert.equal(ticketFromProtocolHeader("irlid.v1, ticket.abc.def"), "abc.def");
  assert.equal(ticketFromProtocolHeader("irlid.v1"), null);
  assert.equal(ticketFromProtocolHeader(null), null);
});

test("/org/ws rejects: no upgrade, no ticket, bad ticket, expired ticket, bad Origin", async () => {
  const ns = fakeNamespace();
  const env = { DB: new FakeDB(), ORG_HUB: ns, CORS_ORIGIN: "https://irlid.co.uk" };
  assert.equal((await worker.fetch(new Request("https://worker.test/org/ws"), env)).status, 426);
  assert.equal((await worker.fetch(new Request("https://worker.test/org/ws", { headers: { Upgrade: "websocket" } }), env)).status, 401);
  assert.equal((await worker.fetch(wsReq("nope"), env)).status, 401);
  const old = await mintWsTicket(ORG, nowS() - 3600);
  assert.equal((await worker.fetch(wsReq(old.ticket), env)).status, 401);
  const { ticket } = await mintWsTicket(ORG, nowS());
  assert.equal((await worker.fetch(wsReq(ticket, { Origin: "https://evil.example" }), env)).status, 403);
  assert.equal(ns.hubs.size, 0, "hub must not be touched for rejected requests");
});

test("/org/ws with a good ticket and allowed Origin reaches that org's hub only", async () => {
  const ns = fakeNamespace();
  const env = { DB: new FakeDB(), ORG_HUB: ns, CORS_ORIGIN: "https://irlid.co.uk" };
  const { ticket } = await mintWsTicket(ORG, nowS());
  const res = await worker.fetch(wsReq(ticket, { Origin: "https://irlid.co.uk" }), env);
  assert.equal(res.status, 101);
  assert.deepEqual([...ns.hubs.keys()], ["org-1"]);
});

// ---- the hub ---------------------------------------------------------------
test("hub broadcasts a small event to every socket and returns how many", async () => {
  const a = new FakeSocket(), b = new FakeSocket();
  const hub = new TestHub(fakeCtx([a, b]), {});
  const res = await hub.fetch(new Request("https://org-hub/notify", { method: "POST", body: JSON.stringify({ type: "attendance", ids: ["c1"], nonce: "cin_abc" }) }));
  assert.deepEqual(await res.json(), { sent: 2 });
  const msg = JSON.parse(a.sent[0]);
  assert.deepEqual(Object.keys(msg).sort(), ["at", "ids", "nonce", "type"]);
  assert.equal(msg.type, "attendance");
  assert.deepEqual(msg.ids, ["c1"]);
  assert.equal(b.sent.length, 1);
});

test("events carry no personal data: unknown fields and types are dropped", () => {
  const e = cleanHubEvent({ type: "attendance", ids: ["ok_1", "has space", "<script>"], nonce: "n1", name: "Jane Doe", email: "j@x.com", lat: 51.5, device_key: "k" });
  assert.deepEqual(Object.keys(e).sort(), ["at", "ids", "nonce", "type"]);
  assert.deepEqual(e.ids, ["ok_1"]);
  assert.equal(cleanHubEvent({ type: "launch_missiles" }), null);
  assert.equal(cleanHubEvent(null), null);
  assert.equal(cleanHubEvent({ type: "settings", nonce: "bad nonce!" }).nonce, undefined);
  assert.equal(cleanHubEvent({ type: "attendance", ids: Array.from({ length: 50 }, (_, i) => "id" + i) }).ids.length, 20);
});

test("hub rejects bad or oversized notify bodies", async () => {
  const hub = new TestHub(fakeCtx([]), {});
  const post = body => hub.fetch(new Request("https://org-hub/notify", { method: "POST", body }));
  assert.equal((await post("not json")).status, 400);
  assert.equal((await post(JSON.stringify({ type: "nope" }))).status, 400);
  assert.equal((await post("x".repeat(5000))).status, 413);
  assert.equal((await hub.fetch(new Request("https://org-hub/notify"))).status, 404);
});

test("a dead socket never stops the others getting the event", async () => {
  const dead = new FakeSocket(); dead.send = () => { throw new Error("gone"); };
  const live = new FakeSocket();
  const hub = new TestHub(fakeCtx([dead, live]), {});
  assert.equal(hub.broadcast({ type: "expected" }), 1);
  assert.equal(live.sent.length, 1);
});

test("sockets older than the max age are closed so the page re-authenticates", () => {
  const old = new FakeSocket(Date.now() - MAX_SOCKET_AGE_MS - 1000);
  const hub = new TestHub(fakeCtx([old]), {});
  assert.equal(hub.broadcast({ type: "expected" }), 0);
  assert.equal(old.closed.code, 1000);
});

test("hub caps connections by dropping the oldest", async () => {
  const sockets = Array.from({ length: MAX_SOCKETS_PER_ORG }, (_, i) => new FakeSocket(1000 + i));
  const hub = new TestHub(fakeCtx(sockets), {});
  const res = await hub.fetch(new Request("https://org-hub/connect", { headers: { Upgrade: "websocket" } }));
  assert.equal(res.status, 101);
  assert.equal(sockets[0].closed.code, 1008);
  assert.equal((await hub.fetch(new Request("https://org-hub/connect"))).status, 426);
});

test("the hub ignores anything a client sends", () => {
  const hub = new TestHub(fakeCtx([]), {});
  assert.equal(hub.webSocketMessage({}, "hello"), undefined);
});

// ---- router hook -----------------------------------------------------------
async function checkinOnce(env, ctx) {
  const body = await signedCheckinBody({ org: ORG_KEY, nonce: "cin_live1" });
  const req = new Request("https://worker.test/org/checkin", { method: "POST", headers: { "Content-Type": "application/json", "X-Org-Key": ORG_KEY }, body: JSON.stringify(body) });
  return worker.fetch(req, env, ctx);
}

test("a successful check-in notifies the org hub with ids + nonce only (no PII)", async () => {
  const ns = fakeNamespace();
  const sock = new FakeSocket();
  ns.get("org-1"); // create hub
  const hub = ns.hubs.get("org-1"); hub.ctx.acceptWebSocket(sock);
  const waits = [];
  const res = await checkinOnce({ DB: new FakeDB(), ORG_HUB: ns, CORS_ORIGIN: "*" }, { waitUntil: p => waits.push(p) });
  assert.equal(res.status, 200);
  await Promise.all(waits);
  assert.equal(sock.sent.length, 1);
  const msg = JSON.parse(sock.sent[0]);
  assert.equal(msg.type, "attendance");
  assert.equal(msg.nonce, "cin_live1");
  assert.deepEqual(Object.keys(msg).filter(k => !["type", "at", "ids", "nonce"].includes(k)), []);
  assert.ok(!sock.sent[0].includes("Jane") && !sock.sent[0].includes(ORG_KEY));
});

test("check-in works exactly as before with NO hub binding (offline-first, R5)", async () => {
  const res = await checkinOnce({ DB: new FakeDB(), CORS_ORIGIN: "*" });
  assert.equal(res.status, 200);
});

test("a broken hub never fails or slows the check-in (R5 / C13)", async () => {
  const broken = { idFromName: () => "x", get: () => ({ fetch: () => { throw new Error("DO down"); } }) };
  const res = await checkinOnce({ DB: new FakeDB(), ORG_HUB: broken, CORS_ORIGIN: "*" });
  assert.equal(res.status, 200);
  const rejecting = { idFromName: () => "x", get: () => ({ fetch: () => Promise.reject(new Error("DO down")) }) };
  const res2 = await checkinOnce({ DB: new FakeDB(), ORG_HUB: rejecting, CORS_ORIGIN: "*" });
  assert.equal(res2.status, 200);
});

test("the notify hook makes no extra D1 queries", async () => {
  const withHub = new FakeDB(), without = new FakeDB();
  await checkinOnce({ DB: withHub, ORG_HUB: fakeNamespace(), CORS_ORIGIN: "*" });
  await checkinOnce({ DB: without, CORS_ORIGIN: "*" });
  assert.equal(withHub.queries.length, without.queries.length);
});

test("failed or non-mutating requests do not notify", async () => {
  const ns = fakeNamespace();
  const res = await worker.fetch(new Request("https://worker.test/org/checkin", { method: "POST", headers: { "X-Org-Key": ORG_KEY }, body: "not json" }), { DB: new FakeDB(), ORG_HUB: ns, CORS_ORIGIN: "*" });
  assert.equal(res.status, 400);
  assert.equal(ns.hubs.size, 0);
});

test("hub refuses a second socket from the same ticket (L2)", async () => {
  const hub = new TestHub(fakeCtx([]), {});
  const mk = () => hub.fetch(new Request("https://org-hub/connect", { headers: { Upgrade: "websocket", "X-Hub-Ticket-Nonce": "abc" } }));
  assert.notEqual((await mk()).status, 401);
  assert.equal((await mk()).status, 401);
});

test("hub closes sockets opened under an old api_key (L1)", async () => {
  const closed = [];
  const mkSock = (k) => ({ deserializeAttachment: () => ({ t: Date.now(), k }), send() {}, close(c) { closed.push(k); } });
  const hub = new TestHub(fakeCtx([mkSock("old"), mkSock("new")]), {});
  const sent = hub.broadcast({ type: "attendance", at: 1 }, "new");
  assert.equal(sent, 1);
  assert.deepEqual(closed, ["old"]);
});
