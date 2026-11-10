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
    assert.doesNotMatch(sql, /\b(DROP|DELETE|UPDATE|RENAME)\b/i, f + " only adds things (R4)");
    // Every file is valid SQLite.
    const db = new DatabaseSync(":memory:");
    db.exec(read("irlid-api-org/schema.sql"));
    db.exec(sql);
  }
});
