// Review 1.4 (old M6): the theme scraper and image proxy check a URL once, so
// a redirect must not be allowed to land on an internal or non-http host.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import worker, { fetchPublicUrl } from "../src/index.js";

function fakeFetch(routes) {
  const calls = [];
  const impl = async (href, init) => {
    calls.push({ href, redirect: init.redirect });
    const r = routes[href];
    if (!r) return new Response("missing", { status: 404 });
    if (r.location) return new Response(null, { status: r.status || 302, headers: { location: r.location } });
    return new Response(r.body || "ok", { status: 200, headers: { "content-type": r.type || "text/html" } });
  };
  return { impl, calls };
}

test("a redirect to another public host is followed by hand", async () => {
  const { impl, calls } = fakeFetch({
    "https://a.example/": { location: "https://b.example/page" },
    "https://b.example/page": { body: "hello" }
  });
  const res = await fetchPublicUrl("https://a.example/", {}, impl);
  assert.equal(await res.text(), "hello");
  assert.deepEqual(calls.map(c => c.redirect), ["manual", "manual"]);
});

test("a redirect to an internal host is refused", async () => {
  for (const location of ["http://127.0.0.1/admin", "http://localhost:8787/", "http://169.254.169.254/latest/meta-data", "http://10.0.0.5/", "file:///etc/passwd"]) {
    const { impl, calls } = fakeFetch({ "https://a.example/": { location } });
    await assert.rejects(fetchPublicUrl("https://a.example/", {}, impl), /redirect_not_public|bad_redirect/, location);
    assert.equal(calls.length, 1, "the internal host is never fetched: " + location);
  }
});

test("relative redirects resolve against the current URL and are re-checked", async () => {
  const { impl } = fakeFetch({
    "https://a.example/x": { status: 301, location: "/y" },
    "https://a.example/y": { body: "y" }
  });
  assert.equal(await (await fetchPublicUrl("https://a.example/x", {}, impl)).text(), "y");
});

test("redirect loops stop after a few hops", async () => {
  const { impl, calls } = fakeFetch({
    "https://a.example/1": { location: "https://a.example/2" },
    "https://a.example/2": { location: "https://a.example/1" }
  });
  await assert.rejects(fetchPublicUrl("https://a.example/1", {}, impl), /too_many_redirects/);
  assert.ok(calls.length <= 4);
});

test("a non-public starting URL is refused before any fetch", async () => {
  const { impl, calls } = fakeFetch({});
  await assert.rejects(fetchPublicUrl("http://192.168.1.1/", {}, impl), /not_a_public_url/);
  assert.equal(calls.length, 0);
});

class D1 {
  constructor() { this.db = new DatabaseSync(":memory:"); }
  prepare(sql) {
    const db = this.db; let args = [];
    return {
      bind(...a) { args = a; return this; },
      async first() { return db.prepare(sql).get(...args) ?? null; },
      async all() { return { results: db.prepare(sql).all(...args) }; },
      async run() { const i = db.prepare(sql).run(...args); return { meta: { changes: Number(i.changes) } }; }
    };
  }
}

test("image proxy: redirect to an internal host is a 502, and it is rate limited per IP", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (href) => {
    if (href === "https://img.example/logo.png") return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/secret.png" } });
    if (href === "https://img.example/ok.png") return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/png" } });
    throw new Error("unexpected fetch " + href);
  };
  try {
    const env = { DB: new D1(), CORS_ORIGIN: "*" };
    const get = (u, ip = "203.0.113.9") => worker.fetch(new Request("https://worker.test/util/image-proxy?url=" + encodeURIComponent(u), { headers: { "CF-Connecting-IP": ip } }), env);
    assert.equal((await get("https://img.example/logo.png")).status, 502);
    assert.equal((await get("https://img.example/ok.png")).status, 200);
    let last;
    for (let i = 0; i < 120; i++) last = await get("https://img.example/ok.png");
    assert.equal(last.status, 429, "capped per IP");
    assert.equal((await get("https://img.example/ok.png", "198.51.100.7")).status, 200, "other IPs unaffected");
  } finally {
    globalThis.fetch = realFetch;
  }
});
