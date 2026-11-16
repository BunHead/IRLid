// v6.8.18: Settings must show the real organisation slug (currentOrg.slug),
// never the old mockup "imbue-ventures". The slug is read-only.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const ROOT = new URL("../../", import.meta.url);
const html = readFileSync(new URL("Org.html", ROOT), "utf8");

function fnSource(name) {
  let start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name + " exists in Org.html");
  let depth = 0;
  for (let i = html.indexOf("{", html.indexOf(")", start)); i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}" && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error("unbalanced " + name);
}

test("the Settings masthead and slug box are not hard-coded as imbue-ventures", () => {
  const masthead = html.match(/<span class="v511-masthead-slug">([^<]*)<\/span>/);
  assert.ok(masthead, "masthead slug span exists");
  assert.notEqual(masthead[1].trim(), "imbue-ventures");
  assert.match(html, /id="v511OrgSlug"/);
  assert.doesNotMatch(html, /id="v511OrgSlug"[^>]*value="imbue-ventures"/);
  assert.doesNotMatch(html, /<input[^>]*value="imbue-ventures"[^>]*>/);
});

test("setSignedInUI and leaving an organisation both use applyOrgSlugToSettings", () => {
  const signedIn = fnSource("setSignedInUI");
  assert.match(signedIn, /applyOrgSlugToSettings\(currentOrg\)/);
  assert.match(signedIn, /applyOrgSlugToSettings\(null\)/);
  const reset = fnSource("resetOrgScopedState");
  assert.match(reset, /applyOrgSlugToSettings\(null\)/);
});

function apply(org) {
  const state = { masthead: "imbue-ventures", input: "imbue-ventures" };
  const ctx = createContext({
    document: {
      querySelector: (sel) => sel === ".v511-masthead-slug" ? { get textContent() { return state.masthead; }, set textContent(v) { state.masthead = v; } } : null,
      getElementById: (id) => id === "v511OrgSlug" ? { get value() { return state.input; }, set value(v) { state.input = v; } } : null
    }
  });
  runInContext(fnSource("applyOrgSlugToSettings"), ctx);
  ctx.org = org;
  runInContext("applyOrgSlugToSettings(org)", ctx);
  return state;
}

test("Imbue Ventures Ltd shows its real slug, not the mockup", () => {
  const s = apply({ id: "org-ltd", name: "Imbue Ventures Ltd", slug: "imbue-ventures-ltd" });
  assert.equal(s.masthead, "imbue-ventures-ltd");
  assert.equal(s.input, "imbue-ventures-ltd");
});

test("Test Event shows its real slug, even when that slug is imbue-ventures", () => {
  const s = apply({ id: "org-test", name: "Test Event", slug: "imbue-ventures" });
  assert.equal(s.masthead, "imbue-ventures");
  assert.equal(s.input, "imbue-ventures");
});

test("a missing slug, or leaving the organisation, shows an em dash and clears the box", () => {
  assert.deepEqual(apply({ id: "org-x", name: "No Slug" }), { masthead: "—", input: "" });
  assert.deepEqual(apply(null), { masthead: "—", input: "" });
});
