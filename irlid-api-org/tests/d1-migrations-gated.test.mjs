// Review 2.2: D1 migrations are numbered and tracked, and the workflow that
// applies them can only be started by hand and must stop for approval.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const ROOT = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");

test("the D1 workflow is manual only, confirmed, and waits in a protected environment", () => {
  const yml = read(".github/workflows/d1-migrations.yml");
  const on = yml.slice(yml.indexOf("\non:"), yml.indexOf("\npermissions:"));
  assert.match(on, /workflow_dispatch:/);
  for (const trigger of ["push:", "pull_request", "schedule:", "workflow_run"]) assert.ok(!on.includes(trigger), "no " + trigger + " trigger");
  assert.match(yml, /^\s+environment: d1-production$/m);
  assert.match(yml, /^\s+needs: tests$/m);
  const guard = yml.indexOf('"$CONFIRM" != "irlid-db-org"');
  assert.ok(guard > 0, "confirmation guard present");
  const firstRemote = yml.indexOf("--remote");
  assert.ok(firstRemote > guard, "the guard runs before anything touches the live database");
  for (const m of yml.matchAll(/wrangler@([^\s]+)/g)) {
    assert.equal(m[1], JSON.parse(read("irlid-api-org/package.json")).devDependencies.wrangler);
  }
});

test("wrangler uses the numbered folder, never the hand-applied history", () => {
  const toml = read("irlid-api-org/wrangler.toml");
  assert.match(toml, /^migrations_dir = "d1-migrations"$/m);
});

test("numbered migrations are well named, in order, and only add things (R4)", () => {
  const dir = new URL("irlid-api-org/d1-migrations/", ROOT);
  const files = readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
  assert.equal(files[0], "0001_baseline.sql");
  files.forEach((f, i) => assert.match(f, new RegExp("^" + String(i + 1).padStart(4, "0") + "_[a-z0-9_]+\\.sql$"), f));
  for (const f of files) {
    const sql = readFileSync(new URL(f, dir), "utf8").replace(/--.*$/gm, "");
    if (R4_EXCEPTIONS[f]) {
      // The one approved exception: DROP is allowed here, but still nothing
      // that changes or removes a row.
      assert.doesNotMatch(sql, /\b(DELETE|UPDATE|RENAME|INSERT|ALTER)\b/i, f + " changes no rows (R4 exception)");
      continue; // checked against the live table shape in its own test below
    }
    assert.doesNotMatch(sql, /\b(DROP|DELETE|UPDATE|RENAME)\b/i, f + " only adds things (R4)");
    // Every file is valid SQLite.
    const db = new DatabaseSync(":memory:");
    db.exec(read("irlid-api-org/schema.sql"));
    db.exec(sql);
  }
});

// R4 exceptions Spencer approved, by exact file name. Nothing else may DROP.
const R4_EXCEPTIONS = {
  "0003_allow_same_name.sql": "Spencer, 25/11/2026: \"Do same name as agreed\" (docs/proposal-same-name-index.md)"
};
const MIGRATIONS = new URL("irlid-api-org/d1-migrations/", ROOT);
const sqlOf = (f) => readFileSync(new URL(f, MIGRATIONS), "utf8");

test("R4 exception: only the named file may DROP; the gate still catches a DROP anywhere else", () => {
  const files = readdirSync(MIGRATIONS).filter(f => f.endsWith(".sql"));
  for (const f of files) {
    const body = sqlOf(f).replace(/--.*$/gm, "");
    if (/\bDROP\b/i.test(body)) assert.ok(R4_EXCEPTIONS[f], f + " uses DROP but is not an approved R4 exception");
  }
  assert.deepEqual(Object.keys(R4_EXCEPTIONS), ["0003_allow_same_name.sql"], "exactly one approved exception");
  // The same gate rejects a DROP in any other file name.
  const gate = (name, text) => !!R4_EXCEPTIONS[name] || !/\b(DROP|DELETE|UPDATE|RENAME)\b/i.test(text.replace(/--.*$/gm, ""));
  assert.equal(gate("0004_something_else.sql", "DROP INDEX IF EXISTS uq_org_expected_name;"), false);
  assert.equal(gate("0003_allow_same_name_v2.sql", "DROP TABLE org_expected;"), false);
  assert.equal(gate("0002_login_session_orgs.sql", "DROP TABLE x;"), false);
});

test("0003_allow_same_name.sql is exactly the approved change: one DROP INDEX, one CREATE INDEX, the dated header", () => {
  const raw = sqlOf("0003_allow_same_name.sql");
  assert.equal(raw.split("\n")[0], "-- R4 exception (Spencer, 25/11/2026): removes a restriction only; no row changes.");
  const statements = raw.replace(/--.*$/gm, "").split(";").map(x => x.replace(/\s+/g, " ").trim()).filter(Boolean);
  assert.deepEqual(statements, [
    "DROP INDEX IF EXISTS uq_org_expected_name",
    "CREATE INDEX IF NOT EXISTS idx_org_expected_name ON org_expected (org_id, LOWER(display_name)) WHERE archived_at IS NULL"
  ]);
  // and it matches the SQL written in the approved proposal
  const doc = read("docs/proposal-same-name-index.md");
  for (const st of statements) assert.ok(doc.replace(/\s+/g, " ").includes(st), "proposal has: " + st);
});

test("0003 on the live table shape: removes the unique index, keeps every row, allows two same-name people, safe to run twice", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE org_expected (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, display_name TEXT NOT NULL, initials TEXT,
    role_key TEXT DEFAULT 'attendee', device_pub_fp TEXT, email_hint TEXT, phone_hint TEXT, notes TEXT,
    created_at INTEGER NOT NULL, archived_at INTEGER);
    CREATE UNIQUE INDEX uq_org_expected_name ON org_expected (org_id, LOWER(display_name)) WHERE archived_at IS NULL;`);
  const ins = db.prepare("INSERT INTO org_expected (id,org_id,display_name,created_at) VALUES (?,?,?,0)");
  ins.run("p1", "org-1", "Sam Example");
  ins.run("p2", "org-1", "Alex Sample");
  assert.throws(() => ins.run("p3", "org-1", "sam example"), /UNIQUE/, "before: the database refuses a same name");
  const before = JSON.stringify(db.prepare("SELECT * FROM org_expected ORDER BY id").all());
  db.exec(sqlOf("0003_allow_same_name.sql"));
  db.exec(sqlOf("0003_allow_same_name.sql")); // idempotent
  assert.equal(JSON.stringify(db.prepare("SELECT * FROM org_expected ORDER BY id").all()), before, "no row changed");
  const idx = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='org_expected' AND name NOT LIKE 'sqlite_autoindex_%'").all();
  assert.deepEqual(idx.map(i => i.name), ["idx_org_expected_name"]);
  assert.doesNotMatch(idx[0].sql, /UNIQUE/);
  ins.run("p3", "org-1", "sam example");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM org_expected WHERE LOWER(display_name)='sam example'").get().n, 2);
  // and on a database that never had the old index
  const fresh = new DatabaseSync(":memory:");
  fresh.exec("CREATE TABLE org_expected (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, display_name TEXT NOT NULL, created_at INTEGER NOT NULL, archived_at INTEGER);");
  fresh.exec(sqlOf("0003_allow_same_name.sql"));
});
