// Test plan section 7, step 1: docs/rule-test-map.md maps every rule in
// docs/rules.md to the tests that prove it (rule W3). This keeps the map true:
// every rule has exactly one row, every named test file exists, and the list
// of rules with no test yet only ever shrinks.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const DIRS = { "org/": "irlid-api-org/tests/", "api/": "irlid-api/tests/", "unit/": "tests/", "e2e/": "tests/e2e/" };
const STATUSES = new Set(["tested", "partial", "gap", "design only", "process", "merged"]);

// Rules with code but no test yet. Closing one: add its tests to the map AND
// take it off this list (the test below fails until both agree).
const KNOWN_GAPS = ["I3", "I4", "I6", "E4"];

function rulesInRulesMd() {
  return [...read("docs/rules.md").matchAll(/^- \*\*([A-Z]\d+)\./gm)].map(m => m[1]);
}
function mapRows() {
  const rows = [];
  for (const line of read("docs/rule-test-map.md").split("\n")) {
    if (!/^\| [A-Z]\d+ \|/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map(c => c.trim());
    assert.equal(cells.length, 4, "a map row needs 4 cells: " + line);
    rows.push({ rule: cells[0], status: cells[1], tests: cells[2].split(",").map(t => t.trim()).filter(Boolean), note: cells[3] });
  }
  return rows;
}

test("every rule in docs/rules.md has exactly one row in the map, and no row names a rule that does not exist", () => {
  const rules = rulesInRulesMd();
  assert.ok(rules.length >= 60, "found the rules (" + rules.length + ")");
  const rows = mapRows();
  const counts = new Map();
  for (const r of rows) counts.set(r.rule, (counts.get(r.rule) || 0) + 1);
  const missing = rules.filter(r => !counts.has(r));
  const extra = [...counts.keys()].filter(r => !rules.includes(r));
  const twice = [...counts].filter(([, n]) => n > 1).map(([r]) => r);
  assert.deepEqual(missing, [], "rules with no row in docs/rule-test-map.md: " + missing.join(", "));
  assert.deepEqual(extra, [], "rows for rules that are not in docs/rules.md: " + extra.join(", "));
  assert.deepEqual(twice, [], "rules with more than one row: " + twice.join(", "));
});

test("every row has a known status, and tested / partial rows name at least one test", () => {
  for (const r of mapRows()) {
    assert.ok(STATUSES.has(r.status), r.rule + ": unknown status '" + r.status + "'");
    if (r.status === "tested" || r.status === "partial") assert.ok(r.tests.length > 0, r.rule + " is " + r.status + " but names no test");
    if (r.status === "gap" || r.status === "design only" || r.status === "merged") assert.equal(r.tests.length, 0, r.rule + " is " + r.status + " but names tests");
  }
});

test("every test file the map names exists", () => {
  const bad = [];
  for (const r of mapRows()) {
    for (const t of r.tests) {
      const prefix = Object.keys(DIRS).find(p => t.startsWith(p));
      if (!prefix) { bad.push(r.rule + ": " + t + " (use org/, api/, unit/ or e2e/)"); continue; }
      if (!existsSync(new URL(DIRS[prefix] + t.slice(prefix.length), ROOT))) bad.push(r.rule + ": " + t);
    }
  }
  assert.deepEqual(bad, [], "missing test files: " + bad.join("; "));
});

test("the gap list only shrinks: map and KNOWN_GAPS agree", () => {
  const gaps = mapRows().filter(r => r.status === "gap").map(r => r.rule).sort();
  assert.deepEqual(gaps, [...KNOWN_GAPS].sort(),
    "docs/rule-test-map.md gaps and KNOWN_GAPS differ. A new gap needs Spencer to know (add it to both); a closed gap comes off both.");
});

test("W3: every S, C, R and A rule is tested, partial, design only, merged or a listed gap (no silent blanks)", () => {
  const scra = mapRows().filter(r => /^[SCRA]\d+$/.test(r.rule));
  assert.ok(scra.length >= 40);
  const process = scra.filter(r => r.status === "process" && r.rule !== "R7");
  assert.deepEqual(process.map(r => r.rule), [], "S, C, R and A rules are product rules, not process (R7 is policy only)");
});
