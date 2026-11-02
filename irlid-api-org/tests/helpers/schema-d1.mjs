// A real SQLite database built from irlid-api-org/schema.sql, wrapped to look
// like Cloudflare D1, for rule conformance tests (docs/rules.md).
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker from "../../src/index.js";

export const ORG_KEY = "org_rule_test_key_1234567890";

class D1Statement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  stmt() { return this.db.prepare(this.sql); }
  async first() { return this.stmt().get(...this.args) ?? null; }
  async all() { return { results: this.stmt().all(...this.args) }; }
  async run() {
    if (/\bRETURNING\b/i.test(this.sql)) return { results: this.stmt().all(...this.args), meta: {} };
    const info = this.stmt().run(...this.args);
    return { meta: { changes: Number(info.changes) } };
  }
}

export class SchemaD1 {
  constructor(settings = {}, orgId = "org-1") {
    this.orgId = orgId;
    this.db = new DatabaseSync(":memory:");
    this.db.exec(readFileSync(new URL("../../schema.sql", import.meta.url), "utf8"));
    // Tables the Worker uses that schema.sql does not list (they came from the
    // migrations/*.ps1 scripts). Same shapes as the other org Worker tests.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS org_receipts (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, checkin_id TEXT, attendee_pub_fp TEXT, payload_json TEXT NOT NULL, signature TEXT NOT NULL, created_at INTEGER NOT NULL, privacy_mode INTEGER DEFAULT 1);
      CREATE TABLE IF NOT EXISTS expected_device_keys (org_id TEXT, expected_id INTEGER, device_key_fp TEXT, revoked_at INTEGER);
      CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, label TEXT);
      CREATE TABLE IF NOT EXISTS weekly_events (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, room_id TEXT, name TEXT NOT NULL, day_of_week INTEGER NOT NULL, start_time_local TEXT NOT NULL, duration_min INTEGER NOT NULL, capacity INTEGER, color_hex TEXT, notes TEXT, require_proof INTEGER DEFAULT 0, late_grace_min INTEGER DEFAULT 0, checkin_mode TEXT, created_at INTEGER NOT NULL, archived_at INTEGER);
    `);
    this.db.prepare("INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES (?,?,?,?,?,0,0)")
      .run(orgId, "Test Org", "test-org", ORG_KEY, JSON.stringify(settings));
  }
  prepare(sql) { return new D1Statement(this.db, sql); }
  async batch(statements) { const out = []; for (const s of statements) out.push(await s.run()); return out; }
  rows(sql, ...args) { return this.db.prepare(sql).all(...args); }
}

export async function call(d1, method, path, body, orgKey = ORG_KEY, env = {}) {
  const headers = { "Content-Type": "application/json" };
  if (orgKey) headers["X-Org-Key"] = orgKey;
  const response = await worker.fetch(new Request("https://worker.test" + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  }), { DB: d1, CORS_ORIGIN: "*", ...env });
  const text = await response.text();
  let json = null; try { json = JSON.parse(text); } catch (_) {}
  return { status: response.status, body: json, text };
}
