// The Worker must never deploy without the tests passing first (review 2.1).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");

test("Tests workflow runs on pull requests and every suite", () => {
  const yml = read(".github/workflows/tests.yml");
  assert.match(yml, /^\s+pull_request:/m);
  assert.match(yml, /^\s+workflow_call:/m);
  for (const s of ["npm test", "npm run test:org-worker", "npm run test:api", "npm run test:e2e"]) {
    assert.ok(yml.includes("run: " + s), "runs " + s);
  }
  assert.match(yml, /playwright@\d+\.\d+\.\d+/, "Playwright pinned to an exact version");
  assert.match(yml, /IRLID_E2E_REQUIRED: '1'/, "browser tests can't silently skip in CI");
});

test("deploy job needs the Tests workflow to pass", () => {
  const yml = read(".github/workflows/deploy-worker.yml");
  assert.match(yml, /^  tests:\n    uses: \.\/\.github\/workflows\/tests\.yml/m);
  assert.match(yml, /^  deploy:\n    needs: tests/m);
});

test("e2e test refuses to skip when CI requires it", () => {
  const src = read("tests/e2e/kiosk-offline-code.e2e.mjs");
  assert.match(src, /skip: !chromium && !process\.env\.IRLID_E2E_REQUIRED/);
});
