// Review 4.1, step 1: Org.html's main stylesheet lives in css/org.css. The
// move must not change the page (same rules, same place in the cascade) and
// the stylesheet must work offline like the rest of the dashboard shell (C1).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");

test("Org.html links css/org.css where the head <style> block was, before any other style", () => {
  const html = read("Org.html");
  const link = html.indexOf('<link rel="stylesheet" href="css/org.css">');
  assert.ok(link > 0);
  const head = html.slice(0, html.indexOf("</head>"));
  assert.ok(head.includes('href="css/org.css"'), "linked in <head>");
  assert.ok(html.indexOf("<style") === -1 || html.indexOf("<style") > link, "no inline style block before it");
});

test("the service worker pre-caches css/org.css, intercepts it and serves it network-first", () => {
  const sw = read("sw.js");
  assert.match(sw, /'\.\/css\/org\.css',/);
  const m = sw.match(/const DASHBOARD_PATHS = (\/.*\/);/);
  assert.ok(m);
  const re = eval(m[1]);
  assert.ok(re.test("/css/org.css"), "dashboard path");
  assert.ok(!re.test("/css/style.css"), "consumer stylesheet still passes through");
  assert.match(sw, /if \(\/\\\.\(js\|css\)\(\\\?\|\$\)\/\.test\(url\.pathname\)\)/, "network-first like scripts");
});
