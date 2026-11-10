// Review 2.3: the staging (test) copy of the Workers is config only and can
// never reach production data or deploy by accident.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");
const val = (toml, key) => { const m = toml.match(new RegExp("^" + key + ' = (.+)$', "m")); return m ? m[1].trim() : null; };

for (const [dir, stagingName, stagingDb] of [
  ["irlid-api-org", "irlid-api-org-staging", "irlid-db-org-staging"],
  ["irlid-api", "irlid-api-staging", "irlid-db-staging"]
]) {
  test(`${dir}: staging config has its own Worker name and its own D1 database`, () => {
    const prod = read(dir + "/wrangler.toml");
    const stg = read(dir + "/wrangler.staging.toml");
    assert.equal(val(stg, "name"), `"${stagingName}"`);
    assert.notEqual(val(stg, "name"), val(prod, "name"));
    assert.equal(val(stg, "database_name"), `"${stagingDb}"`);
    assert.notEqual(val(stg, "database_name"), val(prod, "database_name"), "staging must not bind the production DB");
    assert.notEqual(val(stg, "database_id"), val(prod, "database_id"), "staging must not reuse the production database id");
    assert.doesNotMatch(stg, /irlid\.co\.uk/, "staging must not allow the production site origin");
    assert.match(stg, /^\[\[d1_databases\]\]$/m);
    assert.equal(stg.match(/database_name =/g).length, 1, "exactly one database binding");
  });

  test(`${dir}: staging config runs the same code as production`, () => {
    const prod = read(dir + "/wrangler.toml");
    const stg = read(dir + "/wrangler.staging.toml");
    for (const k of ["main", "compatibility_date", "compatibility_flags"]) assert.equal(val(stg, k), val(prod, k), k);
    if (/ORG_HUB/.test(prod)) {
      assert.match(stg, /name = "ORG_HUB"\nclass_name = "OrgHub"/);
      assert.match(stg, /tag = "v1-org-hub"\nnew_sqlite_classes = \["OrgHub"\]/);
    }
  });
}

test("staging deploy workflow is manual only, always uses the staging config, and stops on placeholder ids", () => {
  const yml = read(".github/workflows/deploy-staging.yml");
  const on = yml.slice(yml.indexOf("\non:"), yml.indexOf("\npermissions:"));
  assert.match(on, /workflow_dispatch/);
  assert.doesNotMatch(on, /push|pull_request|schedule/);
  const deploys = yml.match(/wrangler@[\d.]+ deploy[^\n]*/g) || [];
  assert.equal(deploys.length, 2);
  for (const d of deploys) assert.match(d, / -c wrangler\.staging\.toml$/);
  const check = yml.indexOf("grep -n 'REPLACE_WITH_STAGING_D1_ID'");
  assert.ok(check > 0 && check < yml.indexOf("deploy -c wrangler.staging.toml"), "placeholder check runs before any deploy");
});

test("production auto-deploy never uses the staging config", () => {
  assert.doesNotMatch(read(".github/workflows/deploy-worker.yml"), /staging/);
});
