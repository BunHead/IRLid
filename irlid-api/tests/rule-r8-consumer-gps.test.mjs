// docs/rules.md R8 (consumer half): "Never strip GPS from consumer handshake
// receipts." A stored receipt must come back with every GPS field intact, or
// client-side re-verification of hashes and signatures breaks.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker from "../src/index.js";

class Stmt {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...a) { this.args = a; return this; }
  async first() { return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() { const i = this.db.prepare(this.sql).run(...this.args); return { meta: { changes: Number(i.changes) } }; }
}
function d1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  return { prepare: (sql) => new Stmt(db, sql), batch: async (s) => { for (const x of s) await x.run(); return []; } };
}
const fetchW = (env, path, init) => worker.fetch(new Request("https://api.test" + path, init), env);

test("R8: a consumer handshake receipt keeps its GPS through upload and fetch", async () => {
  const env = { DB: d1(), CORS_ORIGIN: "*" };
  const gpsA = { lat: 51.50735, lon: -0.12776, acc: 8 };
  const gpsB = { lat: 51.50736, lon: -0.12774, acc: 9 };
  const combined = {
    type: "combined",
    a: { v: 3, payload: { ts: 1760000000, ...gpsA }, hash: "h_a", sig: "s_a", pub: { kty: "EC", crv: "P-256", x: "ax", y: "ay" } },
    b: { v: 3, payload: { ts: 1760000003, ...gpsB }, hash: "h_b", sig: "s_b", pub: { kty: "EC", crv: "P-256", x: "bx", y: "by" } },
    hello: { pub: { kty: "EC", crv: "P-256", x: "ax", y: "ay" }, ...gpsA }
  };
  const up = await fetchW(env, "/receipts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ combined }) });
  const upBody = await up.json();
  assert.ok(up.status < 300, JSON.stringify(upBody));
  const got = await fetchW(env, "/receipts/" + encodeURIComponent(upBody.receipt_hash));
  const body = await got.json();
  assert.equal(got.status, 200, JSON.stringify(body));
  assert.deepEqual(body.combined, combined, "the receipt comes back byte-for-byte, GPS included");
});
