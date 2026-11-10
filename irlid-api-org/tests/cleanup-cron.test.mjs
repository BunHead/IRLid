// Review 2.4: the nightly Cron Trigger deletes old rate-limit rows and expired
// sessions, and nothing else.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import orgWorker, { cleanupExpiredRows as orgCleanup } from "../src/index.js";
import consumerWorker, { cleanupExpiredRows as consumerCleanup } from "../../irlid-api/src/index.js";

const ROOT = new URL("../../", import.meta.url);
const T = 1_800_000_000;

class D1 {
  constructor(sql) { this.db = new DatabaseSync(":memory:"); this.db.exec(sql); }
  prepare(sql) {
    const db = this.db; let args = [];
    return {
      bind(...a) { args = a; return this; },
      async run() { const i = db.prepare(sql).run(...args); return { meta: { changes: Number(i.changes) } }; }
    };
  }
  n(table) { return this.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n; }
}

function orgDb() {
  const d1 = new D1(`
    CREATE TABLE ip_rate_limits (k TEXT PRIMARY KEY, count INTEGER NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT, device_id TEXT, expires_at INTEGER);
    CREATE TABLE org_staff_sessions (id TEXT PRIMARY KEY, org_id TEXT, expires_at INTEGER);
    CREATE TABLE org_checkins (id TEXT PRIMARY KEY, checkin_at INTEGER);
    CREATE TABLE org_audit_log (id INTEGER PRIMARY KEY, created_at INTEGER);
  `);
  const ins = (sql, ...a) => d1.db.prepare(sql).run(...a);
  ins("INSERT INTO ip_rate_limits VALUES ('old',1,?)", T - 2 * 86400);
  ins("INSERT INTO ip_rate_limits VALUES ('new',1,?)", T - 600);
  ins("INSERT INTO sessions VALUES ('s-old','u','d',?)", T - 1);
  ins("INSERT INTO sessions VALUES ('s-live','u','d',?)", T + 3600);
  ins("INSERT INTO org_staff_sessions VALUES ('st-old','o',?)", T - 60);
  ins("INSERT INTO org_staff_sessions VALUES ('st-live','o',?)", T + 60);
  ins("INSERT INTO org_checkins VALUES ('c1',?)", T - 400 * 86400);
  ins("INSERT INTO org_audit_log VALUES (1,?)", T - 400 * 86400);
  return d1;
}

test("org cleanup removes only expired sessions and old rate-limit rows", async () => {
  const d1 = orgDb();
  const removed = await orgCleanup({ DB: d1 }, T);
  assert.deepEqual(removed, { ip_rate_limits: 1, sessions: 1, org_staff_sessions: 1 });
  assert.equal(d1.n("ip_rate_limits"), 1);
  assert.equal(d1.n("sessions"), 1);
  assert.equal(d1.n("org_staff_sessions"), 1);
  assert.equal(d1.n("org_checkins"), 1, "records are never touched (R1)");
  assert.equal(d1.n("org_audit_log"), 1, "audit log is never touched (R5)");
});

test("a missing table is skipped, the rest still run", async () => {
  const d1 = new D1("CREATE TABLE sessions (id TEXT PRIMARY KEY, expires_at INTEGER);");
  d1.db.prepare("INSERT INTO sessions VALUES ('x', ?)").run(T - 1);
  const removed = await orgCleanup({ DB: d1 }, T);
  assert.equal(removed.ip_rate_limits, null);
  assert.equal(removed.sessions, 1);
});

test("consumer cleanup handles its own sessions and rate limits", async () => {
  const d1 = orgDb();
  const removed = await consumerCleanup({ DB: d1 }, T);
  assert.deepEqual(removed, { ip_rate_limits: 1, sessions: 1 });
  assert.equal(d1.n("org_staff_sessions"), 2, "not the consumer Worker's table");
});

test("both Workers have a scheduled handler and a nightly cron", async () => {
  for (const [w, toml] of [[orgWorker, "irlid-api-org/wrangler.toml"], [consumerWorker, "irlid-api/wrangler.toml"]]) {
    assert.equal(typeof w.scheduled, "function", toml);
    assert.match(readFileSync(new URL(toml, ROOT), "utf8"), /^\[triggers\]\ncrons = \["17 3 \* \* \*"\]/m, toml);
  }
  const waits = [];
  await orgWorker.scheduled({}, { DB: orgDb() }, { waitUntil: (p) => waits.push(p) });
  assert.equal(waits.length, 1);
  await waits[0];
});
