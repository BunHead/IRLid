// v6.8.26 - receipts on every device (opt-in backup). Worker side.
// Isolation, add-only, dedupe, sign-in required, and fail-safe when the
// personal_receipts table has not been created yet. Made-up data only.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import worker from "../src/index.js";

const migration = readFileSync(new URL("../d1-migrations/0001_personal_receipt_backup.sql", import.meta.url), "utf8");
const workerSrc = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const orgSrc = readFileSync(new URL("../../irlid-api-org/src/index.js", import.meta.url), "utf8");

class D1 {
  constructor({ migrated = true } = {}) {
    this.db = new DatabaseSync(":memory:");
    this.db.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE devices (id TEXT PRIMARY KEY, user_id TEXT, pub_key_id TEXT, revoked_at INTEGER);
      CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT, device_id TEXT, created_at INTEGER, expires_at INTEGER);
      CREATE TABLE receipts (id TEXT PRIMARY KEY);
    `);
    if (migrated) this.db.exec(migration);
    const far = Math.floor(Date.now() / 1000) + 3600;
    // u1 has two linked phones; u2 is another person.
    for (const [u, d, tok] of [["u1", "phoneA", "tokA"], ["u1", "phoneB", "tokB"], ["u2", "phoneC", "tokC"]]) {
      this.db.prepare("INSERT OR IGNORE INTO users (id) VALUES (?)").run(u);
      this.db.prepare("INSERT INTO devices (id, user_id, pub_key_id, revoked_at) VALUES (?,?,?,NULL)").run(d, u, "k" + d);
      this.db.prepare("INSERT INTO sessions VALUES (?,?,?,?,?)").run(tok, u, d, 1, far);
    }
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
  body: body === undefined || method === "GET" ? undefined : JSON.stringify(body)
}), { DB: d1, CORS_ORIGIN: "*" });

const org = (id, extra = {}) => ({ receipt_id: id, org: "sample-club", created_at: 1, receipt: { action: "in" }, ...extra });
const p2p = (hash) => ({ ts: 1, combined: { type: "combined", receipt_hash: hash, a: {}, b: {} } });

test("sign-in required: no token, a bad token, and a token for an unlinked device are all refused", async () => {
  const d1 = new D1();
  for (const [m, p] of [["GET", "/me/receipts"], ["POST", "/me/receipts"], ["GET", "/me/receipts/status"]]) {
    assert.equal((await call(d1, m, p, undefined, { entries: [] })).status, 401, m + " " + p + " without a token");
    assert.equal((await call(d1, m, p, "nope", { entries: [] })).status, 401, m + " " + p + " with a bad token");
  }
  d1.db.prepare("UPDATE devices SET revoked_at=5 WHERE id='phoneB'").run();
  assert.equal((await call(d1, "GET", "/me/receipts", "tokB")).status, 403, "a revoked device is not linked");
});

test("the same person sees one backup from either of their devices (any device they sign in on)", async () => {
  const d1 = new D1();
  await call(d1, "POST", "/me/receipts", "tokA", { entries: [{ kind: "org", entry: org("r-org-1") }, { kind: "p2p", entry: p2p("hash-1") }] });
  const fromB = await (await call(d1, "GET", "/me/receipts", "tokB")).json();
  assert.deepEqual(fromB.receipts.map(r => r.receipt_key).sort(), ["hash-1", "r-org-1"]);
});

test("isolation: another person never sees or collides with my receipts", async () => {
  const d1 = new D1();
  await call(d1, "POST", "/me/receipts", "tokA", { entries: [{ kind: "org", entry: org("shared-id", { note: "mine" }) }] });
  const other = await (await call(d1, "GET", "/me/receipts", "tokC")).json();
  assert.equal(other.receipts.length, 0);
  // The same receipt id backed up by someone else is their own row, not mine.
  await call(d1, "POST", "/me/receipts", "tokC", { entries: [{ kind: "org", entry: org("shared-id", { note: "theirs" }) }] });
  const mine = await (await call(d1, "GET", "/me/receipts", "tokA")).json();
  assert.equal(mine.receipts.length, 1);
  assert.equal(mine.receipts[0].entry.note, "mine");
});

test("no organisation can read a person's backup: no org route touches the table", () => {
  assert.ok(!/personal_receipts/.test(orgSrc), "the org Worker never mentions personal_receipts");
  // and nothing in the consumer Worker reads it without a user_id filter
  for (const m of workerSrc.matchAll(/FROM personal_receipts[^"`]*/g)) {
    assert.match(m[0], /user_id\s*=\s*\?/, "every read is scoped to one user: " + m[0]);
  }
});

test("add-only: no update or delete route, repeat uploads never change a stored row", async () => {
  const d1 = new D1();
  await call(d1, "POST", "/me/receipts", "tokA", { entries: [{ kind: "org", entry: org("r1", { note: "first" }) }] });
  const before = JSON.stringify(d1.rows());
  for (const method of ["PUT", "PATCH", "DELETE"]) {
    for (const path of ["/me/receipts", "/me/receipts/r1", "/me/receipts/status"]) {
      const res = await call(d1, method, path, "tokA", { entries: [] });
      assert.ok([404, 405].includes(res.status), `${method} ${path} answered ${res.status}`);
    }
  }
  await call(d1, "POST", "/me/receipts", "tokA", { entries: [{ kind: "org", entry: org("r1", { note: "changed" }) }] });
  assert.equal(JSON.stringify(d1.rows()), before, "a changed re-upload does not overwrite");
  assert.ok(!/UPDATE personal_receipts|DELETE FROM personal_receipts/i.test(workerSrc));
  assert.ok(!/personal_receipts/.test(workerSrc.slice(workerSrc.indexOf("async function cleanup") >= 0 ? workerSrc.indexOf("async function cleanup") : 0, workerSrc.indexOf("async function cleanup") >= 0 ? workerSrc.indexOf("async function cleanup") + 3000 : 0)), "nightly cleanup never lists it");
});

test("dedupe: the same receipt sent from two phones is stored once", async () => {
  const d1 = new D1();
  const body = { entries: [{ kind: "p2p", entry: p2p("hash-9") }, { kind: "org", entry: org("o9") }] };
  await call(d1, "POST", "/me/receipts", "tokA", body);
  const again = await (await call(d1, "POST", "/me/receipts", "tokB", body)).json();
  assert.ok(again.results.every(r => r.ok && r.duplicate));
  assert.equal(d1.rows().length, 2);
});

test("fail safe: with no personal_receipts table, status says unavailable and the other routes answer 503, never 500", async () => {
  const d1 = new D1({ migrated: false });
  const st = await call(d1, "GET", "/me/receipts/status", "tokA");
  assert.equal(st.status, 200);
  assert.deepEqual(await st.json(), { available: false });
  for (const [m, body] of [["GET", undefined], ["POST", { entries: [{ kind: "org", entry: org("r1") }] }]]) {
    const res = await call(d1, m, "/me/receipts", "tokA", body);
    assert.equal(res.status, 503);
    const text = await res.text();
    assert.match(text, /backup_unavailable/);
    assert.ok(!/no such table|SQLITE|\bat \S+ \(/.test(text), "no internal error text: " + text);
  }
});

test("status says available once the migration has been applied", async () => {
  const d1 = new D1();
  assert.deepEqual(await (await call(d1, "GET", "/me/receipts/status", "tokA")).json(), { available: true });
});

test("the migration is one new table only (R4) and is not applied by the repo", () => {
  assert.ok(/CREATE TABLE IF NOT EXISTS personal_receipts/.test(migration));
  assert.ok(!/ALTER TABLE|DROP |UPDATE |DELETE /i.test(migration));
  assert.deepEqual(readdirSync(new URL("../d1-migrations/", import.meta.url)), ["0001_personal_receipt_backup.sql"]);
});

test("signing keys are never stored", async () => {
  const d1 = new D1();
  await call(d1, "POST", "/me/receipts", "tokA", { entries: [{ kind: "org", entry: org("rk", { irlid_priv_jwk: { d: "SECRET" }, key: { kty: "EC", x: "x", d: "SECRET" } }) }] });
  assert.ok(!JSON.stringify(d1.rows()).includes("SECRET"));
});
