// The deploy workflow must use one exact wrangler version (the same one
// package.json pins). "@latest" could change how a Durable Object migration
// deploys behind our back, and a DO migration cannot be rolled back.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);

test("deploy workflow pins wrangler to the same exact version as package.json", () => {
  const yml = readFileSync(new URL(".github/workflows/deploy-worker.yml", ROOT), "utf8");
  const pkg = JSON.parse(readFileSync(new URL("irlid-api-org/package.json", ROOT), "utf8"));
  const pinned = pkg.devDependencies.wrangler;
  assert.match(pinned, /^\d+\.\d+\.\d+$/, "package.json pins an exact version");
  const uses = [...yml.matchAll(/^\s*run:.*wrangler@([^\s]+)/gm)].map(m => m[1]);
  assert.ok(uses.length >= 1, "workflow runs wrangler");
  for (const v of uses) assert.equal(v, pinned, "every deploy step uses wrangler@" + pinned);
  assert.doesNotMatch(yml, /^\s*run:.*wrangler@latest/m);
});
