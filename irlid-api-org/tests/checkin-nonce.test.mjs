import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const ORG_KEY = "org_test_key_1234567890";
const ORG = {
  id: "org-1",
  api_key: ORG_KEY,
  slug: "test-org",
  name: "Test Org",
  settings_json: JSON.stringify({ anonymousMode: true }),
  venue_pub_jwk: null,
  venue_prv_jwk: null
};

class FakeStatement {
  constructor(db, sql) { this.db = db; this.sql = sql.replace(/\s+/g, " ").trim(); this.args = []; }
  bind(...args) { this.args = args; return this; }
  async first() { return this.db.execute(this.sql, this.args, "first"); }
  async all() { return { results: await this.db.execute(this.sql, this.args, "all") || [] }; }
  async run() { return this.db.execute(this.sql, this.args, "run") || { meta: { changes: 0 } }; }
}

class FakeDB {
  constructor({ settings, nonces = {}, duplicate = null } = {}) {
    this.org = { ...ORG, settings_json: JSON.stringify(settings || { anonymousMode: true }) };
    this.nonces = new Map(Object.entries(nonces));
    this.duplicate = duplicate;
    this.checkins = [];
  }
  prepare(sql) { return new FakeStatement(this, sql); }
  async execute(sql, args, kind) {
    if (sql.startsWith("SELECT * FROM organisations WHERE api_key=? OR id=? OR slug=?")) return this.org;
    if (sql.startsWith("CREATE TABLE IF NOT EXISTS org_checkin_nonces")) return { meta: { changes: 0 } };
    if (sql.startsWith("PRAGMA table_info(org_checkins)")) {
      return ["id","org_id","event_id","assurance"].map(name => ({ name }));
    }
    if (sql.startsWith("SELECT nonce,org_api_key,event_id,expires_at,consumed_at FROM org_checkin_nonces")) {
      return this.nonces.get(args[0]) || null;
    }
    if (sql.startsWith("UPDATE org_checkin_nonces SET consumed_at=?")) {
      const row = this.nonces.get(args[1]);
      if (!row || row.consumed_at !== null) return { meta: { changes: 0 } };
      row.consumed_at = args[0];
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("SELECT id,checkin_at,event_id,status,expected_id FROM org_checkins WHERE id=?")) return null;
    if (sql.includes("FROM weekly_events")) return null;
    if (sql.includes("FROM org_checkins WHERE org_id=? AND device_key_fp=?")) return this.duplicate;
    if (sql.includes("FROM org_expected WHERE org_id=?") && sql.includes("LOWER(display_name)=LOWER(?)")) return null;
    if (sql.startsWith("INSERT INTO org_checkins")) {
      this.checkins.push({ sql, args });
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("UPDATE organisations SET venue_pub_jwk=")) {
      this.org.venue_pub_jwk = args[0]; this.org.venue_prv_jwk = args[1];
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("INSERT INTO org_receipts")) return { meta: { changes: 1 } };
    if (sql.startsWith("SELECT id, staff_pub_fp, expires_at, created_at FROM org_staff_sessions")) return null;
    throw new Error(`Unhandled fake D1 query (${kind}): ${sql}`);
  }
}

function request(body, { bearer = false } = {}) {
  const headers = { "Content-Type": "application/json", "X-Org-Key": ORG_KEY };
  if (bearer) headers.Authorization = `Bearer ${ORG_KEY}`;
  return new Request("https://worker.test/org/checkin", { method: "POST", headers, body: JSON.stringify(body) });
}

async function checkin(db, body, options) {
  const response = await worker.fetch(request(body, options), { DB: db, CORS_ORIGIN: "*" });
  return { response, body: await response.json() };
}

function attendee(overrides = {}) {
  return { mode: "attendee_scan", client_checkin_id: crypto.randomUUID(), score: 70, ...overrides };
}

test("valid nonce succeeds, marks fresh, and is consumed atomically", async () => {
  const nonce = "cin_valid";
  const db = new FakeDB({ nonces: { [nonce]: { nonce, org_api_key: ORG_KEY, event_id: null, expires_at: 4_000_000_000, consumed_at: null } } });
  const result = await checkin(db, attendee({ nonce }));
  assert.equal(result.response.status, 200);
  assert.equal(result.body.assurance, "fresh");
  assert.equal(typeof db.nonces.get(nonce).consumed_at, "number");
  assert.match(db.checkins[0].sql, /assurance/);
  assert.ok(db.checkins[0].args.includes("fresh"));
  assert.equal(result.body.receipt.assurance, "fresh");
});

test("replaying the same nonce returns 409", async () => {
  const nonce = "cin_replay";
  const db = new FakeDB({ nonces: { [nonce]: { nonce, org_api_key: ORG_KEY, event_id: null, expires_at: 4_000_000_000, consumed_at: null } } });
  const payload = attendee({ nonce });
  assert.equal((await checkin(db, payload)).response.status, 200);
  assert.equal((await checkin(db, payload)).response.status, 409);
});

test("expired nonce returns 410", async () => {
  const nonce = "cin_expired";
  const db = new FakeDB({ nonces: { [nonce]: { nonce, org_api_key: ORG_KEY, event_id: null, expires_at: 1, consumed_at: null } } });
  assert.equal((await checkin(db, attendee({ nonce }))).response.status, 410);
});

test("nonce issued for another org returns 404", async () => {
  const nonce = "cin_wrong_org";
  const db = new FakeDB({ nonces: { [nonce]: { nonce, org_api_key: "org_other", event_id: null, expires_at: 4_000_000_000, consumed_at: null } } });
  assert.equal((await checkin(db, attendee({ nonce }))).response.status, 404);
});

test("missing nonce is rejected when fresh check-in is required", async () => {
  const db = new FakeDB({ settings: { anonymousMode: true, requireFreshCheckin: true } });
  assert.equal((await checkin(db, attendee())).response.status, 409);
});

test("soft check-in repeated on the same device within 60 seconds is a no-op", async () => {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = await crypto.subtle.exportKey("jwk", keys.publicKey);
  const duplicate = { id: "existing", checkin_at: Math.floor(Date.now() / 1000), event_id: null, status: "checked_in", expected_id: null };
  const db = new FakeDB({ duplicate });
  const result = await checkin(db, attendee({ helloPayload: { pub } }));
  assert.equal(result.response.status, 200);
  assert.equal(result.body.duplicate, true);
  assert.equal(result.body.assurance, "soft");
  assert.equal(db.checkins.length, 0);
});

test("doorman_scan remains nonce-exempt", async () => {
  const db = new FakeDB({ settings: { anonymousMode: false, requireFreshCheckin: true } });
  const result = await checkin(db, { mode: "doorman_scan", client_checkin_id: crypto.randomUUID(), name: "Walk-in", score: 70 }, { bearer: true });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.assurance, undefined);
  assert.equal(db.checkins.length, 1);
  assert.ok(db.checkins[0].args.includes(null));
});
