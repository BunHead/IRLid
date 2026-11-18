// v6.8.24 - add-only personal receipt backup on the consumer Worker.
// Runs the real Worker against an in-memory SQLite with the real migration file.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker from "../src/index.js";

const migration = readFileSync(new URL("../d1-migrations/0001_personal_receipt_backup.sql", import.meta.url), "utf8");
const workerSrc = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

class D1 {
  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE devices (id TEXT PRIMARY KEY, user_id TEXT, pub_key_id TEXT, revoked_at INTEGER);
      CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT, device_id TEXT, created_at INTEGER, expires_at INTEGER);
      CREATE TABLE receipts (id TEXT PRIMARY KEY);
    `);
    this.db.exec(migration);
    const far = Math.floor(Date.now() / 1000) + 3600;
    for (const [u, d, tok, rev] of [["u1", "d1", "tok1", null], ["u1", "d1b", "tok1b", 5], ["u2", "d2", "tok2", null]]) {
      this.db.prepare("INSERT OR IGNORE INTO users (id) VALUES (?)").run(u);
      this.db.prepare("INSERT INTO devices (id, user_id, pub_key_id, revoked_at) VALUES (?,?,?,?)").run(d, u, "k" + d, rev);
      this.db.prepare("INSERT INTO sessions VALUES (?,?,?,?,?)").run(tok, u, d, 1, far);
    }
    // a session whose device row is missing (not linked)
    this.db.prepare("INSERT INTO sessions VALUES ('tokX','u1','ghost',1,?)").run(far);
  }
  prepare(sql) {
    const db = this.db; let args = [];
    return {
      bind(...a) { args = a; return this; },
      async first() { return db.prepare(sql).get(...args) ?? null; },
      async all() { return { results: db.prepare(sql).all(...args) }; },
      async run() { const i = db.prepare(sql).run(...args); return { meta: { changes: Number(i.changes) } }; }
    };
  }
  rows() { return this.db.prepare("SELECT * FROM personal_receipts").all(); }
}

const call = (d1, method, path, token, body) => worker.fetch(new Request("https://api.test" + path, {
  method,
  headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body)
}), { DB: d1, CORS_ORIGIN: "*" });

const orgEntry = (id, extra = {}) => ({ receipt_id: id, org: "acme", created_at: 1, receipt: { action: "in" }, ...extra });

test("a linked device can back up a receipt, and lists only its own", async () => {
  const d1 = new D1();
  const res = await call(d1, "POST", "/me/receipts", "tok1", { entries: [{ kind: "org", entry: orgEntry("r1") }] });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).results[0].ok, true);
  const mine = await (await call(d1, "GET", "/me/receipts", "tok1")).json();
  assert.equal(mine.receipts.length, 1);
  const theirs = await (await call(d1, "GET", "/me/receipts", "tok2")).json();
  assert.equal(theirs.receipts.length, 0); // A5: another account sees nothing
});

test("idempotent: the same receipt again is a no-op with the same receipt_id", async () => {
  const d1 = new D1();
  const body = { entries: [{ kind: "org", entry: orgEntry("r1") }] };
  const a = (await (await call(d1, "POST", "/me/receipts", "tok1", body)).json()).results[0];
  const resB = await call(d1, "POST", "/me/receipts", "tok1", body);
  assert.equal(resB.status, 200);
  const b = (await resB.json()).results[0];
  assert.equal(b.receipt_id, a.receipt_id);
  assert.equal(b.duplicate, true);
  assert.equal(d1.rows().length, 1);
});

test("a changed re-upload never overwrites the stored entry", async () => {
  const d1 = new D1();
  await call(d1, "POST", "/me/receipts", "tok1", { entries: [{ kind: "org", entry: orgEntry("r1", { org: "first" }) }] });
  await call(d1, "POST", "/me/receipts", "tok1", { entries: [{ kind: "org", entry: orgEntry("r1", { org: "second" }) }] });
  assert.equal(JSON.parse(d1.rows()[0].entry_json).org, "first");
});

test("the same receipt id from two accounts stays two separate private rows", async () => {
  const d1 = new D1();
  await call(d1, "POST", "/me/receipts", "tok1", { entries: [{ kind: "org", entry: orgEntry("r1") }] });
  await call(d1, "POST", "/me/receipts", "tok2", { entries: [{ kind: "org", entry: orgEntry("r1") }] });
  assert.equal(d1.rows().length, 2);
});

test("signing keys are stripped and never stored", async () => {
  const d1 = new D1();
  const entry = orgEntry("r1", {
    irlid_priv_jwk: { kty: "EC", d: "SECRETD", x: "X", y: "Y" },
    receipt: { priv_jwk: "SECRETJWK", irlid_v5_priv: "V5SECRET", pub: { kty: "EC", crv: "P-256", x: "X", y: "Y", d: "SECRETD2" } }
  });
  await call(d1, "POST", "/me/receipts", "tok1", { entries: [{ kind: "org", entry }] });
  const stored = d1.rows()[0].entry_json;
  for (const bad of ["SECRETD", "SECRETJWK", "V5SECRET", "SECRETD2", "irlid_priv_jwk", "priv_jwk"]) assert.ok(!stored.includes(bad), bad);
  assert.ok(stored.includes('"x":"X"')); // public parts stay
  const listed = JSON.stringify(await (await call(d1, "GET", "/me/receipts", "tok1")).json());
  assert.ok(!listed.includes("SECRETD"));
});

test("not signed in, revoked device, or device with no row are all refused", async () => {
  const d1 = new D1();
  const body = { entries: [{ kind: "org", entry: orgEntry("r1") }] };
  assert.equal((await call(d1, "POST", "/me/receipts", null, body)).status, 401);
  assert.equal((await call(d1, "GET", "/me/receipts", null)).status, 401);
  assert.equal((await call(d1, "POST", "/me/receipts", "tok1b", body)).status, 403); // revoked
  assert.equal((await call(d1, "GET", "/me/receipts", "tok1b")).status, 403);
  assert.equal((await call(d1, "POST", "/me/receipts", "tokX", body)).status, 403); // not linked
  assert.equal(d1.rows().length, 0);
});

test("no route can update or delete a stored entry", async () => {
  const d1 = new D1();
  await call(d1, "POST", "/me/receipts", "tok1", { entries: [{ kind: "org", entry: orgEntry("r1") }] });
  const id = d1.rows()[0].id;
  for (const method of ["PUT", "PATCH", "DELETE", "POST"]) {
    for (const path of ["/me/receipts/" + id, "/me/receipts/" + id + "/delete", "/me/receipts/delete", "/me/receipts/update", "/receipts/" + id, "/receipts"]) {
      if (method === "POST" && (path === "/receipts" || path === "/me/receipts")) continue;
      const res = await call(d1, method, path, "tok1", { receipt_id: id });
      assert.ok([404, 405].includes(res.status), method + " " + path + " -> " + res.status);
    }
  }
  assert.equal(d1.rows().length, 1);
  assert.equal(JSON.parse(d1.rows()[0].entry_json).org, "acme");
});

test("source check: the Worker never updates or deletes personal_receipts or the old receipts table", () => {
  assert.ok(!/(DELETE\s+FROM|UPDATE|DROP\s+TABLE|ALTER\s+TABLE|REPLACE\s+INTO)\s+(personal_receipts|receipts)\b/i.test(workerSrc));
  assert.ok(!/personal_receipts/.test(workerSrc.split("const CLEANUP_TARGETS")[1].split("async function cleanupExpiredRows")[0]));
  assert.ok(!/(ALTER|DROP|UPDATE|DELETE)/i.test(migration.replace(/--.*$/gm, "")));
  assert.ok(!/(ALTER\s+TABLE\s+(receipts|devices))/i.test(migration));
});

test("nonce-less / queued check-ins are not touched: the backup route is separate from check-in", () => {
  assert.ok(!/nonce/i.test(workerSrc.split("PERSONAL RECEIPT BACKUP")[1].split("//  CORS")[0]));
});
