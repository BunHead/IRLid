// v6.8.21 — the retired GitHub Pages test site must not be on the live org
// Worker's CORS / WebSocket origin list.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/index.js"), "utf8");

test("allowedOrigins() no longer includes the retired test site origin", () => {
  const start = src.indexOf("function allowedOrigins(env)");
  const end = src.indexOf("function corsHeaders(env, request)");
  assert.ok(start >= 0 && end > start);
  const allowedOrigins = new Function(src.slice(start, end) + "; return allowedOrigins;")();
  const list = allowedOrigins({ CORS_ORIGIN: "https://irlid.co.uk" });
  assert.ok(list.includes("https://irlid.co.uk"));
  assert.ok(list.includes("http://localhost:8000"));
  assert.ok(list.includes("http://127.0.0.1:8000"));
  assert.ok(!list.includes("https://bunhead.github.io"));
  assert.ok(list.every((o) => !String(o).includes("IRLid-TestEnvironment")));
});
