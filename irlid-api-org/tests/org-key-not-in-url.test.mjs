// M2 (Worf review of #152): the org api_key is accepted from the X-Org-Key
// header only. "?key=" is refused; "?org=" is a public identifier (slug / id)
// and never resolves an api_key. Header auth is unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const ORG_KEY = "org_test_key_1234567890";
const ORG = { id: "org-1", api_key: ORG_KEY, slug: "test-org", name: "Test Org", settings_json: "{}", venue_pub_jwk: null, venue_prv_jwk: null };

function makeDb() {
  const db = { queries: [] };
  db.prepare = (sql) => {
    const q = sql.replace(/\s+/g, " ").trim();
    const st = { args: [] };
    st.bind = (...a) => { st.args = a; return st; };
    const run = () => {
      db.queries.push({ sql: q, args: st.args });
      if (q.startsWith("SELECT * FROM organisations WHERE api_key=? OR id=? OR slug=?")) {
        return st.args.some(a => a === ORG_KEY || a === ORG.id || a === ORG.slug) ? ORG : null;
      }
      if (q.startsWith("SELECT * FROM organisations WHERE id=? OR slug=?")) {
        return st.args.some(a => a === ORG.id || a === ORG.slug) ? ORG : null;
      }
      if (q.startsWith("SELECT * FROM organisations WHERE api_key=?")) return st.args[0] === ORG_KEY ? ORG : null;
      return null;
    };
    st.first = async () => run();
    st.all = async () => ({ results: [] });
    st.run = async () => ({ meta: { changes: 0 } });
    return st;
  };
  db.batch = async () => [];
  return db;
}
const env = () => ({ DB: makeDb(), CORS_ORIGIN: "*" });
const get = (path, headers = {}) => new Request("https://worker.test" + path, { headers });
const post = (path, headers = {}) => new Request("https://worker.test" + path, { method: "POST", headers });

test("orgAuth: ?key= alone is refused (401)", async () => {
  const e = env();
  const res = await worker.fetch(post("/org/ws-ticket?key=" + ORG_KEY), e);
  assert.equal(res.status, 401);
  assert.equal(e.DB.queries.some(q => q.args.includes(ORG_KEY)), false, "the key from the URL is never even looked up");
});

test("orgAuth: ?key= is refused even beside a valid X-Org-Key header", async () => {
  const res = await worker.fetch(post("/org/ws-ticket?key=" + ORG_KEY, { "X-Org-Key": ORG_KEY }), env());
  assert.equal(res.status, 401);
  assert.match((await res.json()).error, /org_key_in_url_not_accepted/);
});

test("orgAuth: other header-authed routes also refuse ?key= (audit-log, settings read)", async () => {
  for (const path of ["/org/audit-log", "/org/settings", "/org/expected"]) {
    const res = await worker.fetch(get(path + "?key=" + ORG_KEY), env());
    assert.equal(res.status, 401, path);
  }
});

test("orgAuth: header auth is unchanged (X-Org-Key still gets a ticket route past auth)", async () => {
  const res = await worker.fetch(post("/org/ws-ticket", { "X-Org-Key": ORG_KEY }), env());
  assert.notEqual(res.status, 401); // 501 here: the test env has no ORG_HUB, which is after auth
});

test("orgAuth: an org_ Bearer token still works (frontend fallback)", async () => {
  const res = await worker.fetch(post("/org/ws-ticket", { Authorization: "Bearer " + ORG_KEY }), env());
  assert.notEqual(res.status, 401);
});

test("orgFromRequest: ?key= is refused on slug-tier routes (recognize, active-checkin)", async () => {
  for (const path of ["/org/recognize", "/org/active-checkin"]) {
    const e = env();
    const res = await worker.fetch(get(`${path}?key=${ORG_KEY}&device_pub=abc`), e);
    assert.equal(res.status, 401, path);
    const res2 = await worker.fetch(get(`${path}?key=${ORG_KEY}&org=test-org&device_pub=abc`), env());
    assert.equal(res2.status, 401, path + " with a public ?org= beside it");
    const res3 = await worker.fetch(get(`${path}?key=x&device_pub=abc`, { "X-Org-Key": "test-org" }), env());
    assert.equal(res3.status, 401, path + " with a header beside it");
  }
});

test("orgFromRequest: ?org=<slug> and ?org=<id> still resolve (slim QRs, phone pages)", async () => {
  for (const ident of ["test-org", "org-1"]) {
    const res = await worker.fetch(get(`/org/recognize?org=${ident}&device_pub=abc`), env());
    assert.equal(res.status, 200, ident);
    assert.deepEqual(await res.json(), { recognized: false });
  }
});

test("orgFromRequest: ?org=<api_key> no longer resolves (the key is not an identifier)", async () => {
  const res = await worker.fetch(get(`/org/recognize?org=${ORG_KEY}&device_pub=abc`), env());
  assert.equal(res.status, 401);
});

test("orgFromRequest: the header still takes a key, id or slug (org-entry phone page)", async () => {
  for (const v of [ORG_KEY, "org-1", "test-org"]) {
    const res = await worker.fetch(get("/org/recognize?device_pub=abc", { "X-Org-Key": v }), env());
    assert.equal(res.status, 200, v);
  }
});

test("orgFromRequest: nothing at all is still 401", async () => {
  const res = await worker.fetch(get("/org/recognize?device_pub=abc"), env());
  assert.equal(res.status, 401);
});

// ---- guard: no shipped page or script sends the key in a URL --------------
import { readFileSync, readdirSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const files = [...readdirSync(root).filter(f => f.endsWith(".html") || f === "sw.js"), ...readdirSync(new URL("js/", root)).filter(f => f.endsWith(".js")).map(f => "js/" + f)];

test("no page or script sends the org key in a URL (?key= / ?org=<key>)", () => {
  for (const f of files) {
    const src = readFileSync(new URL(f, root), "utf8");
    assert.doesNotMatch(src, /[?&]key=\$\{|[?&]key=['"`]\s*\+|\/org\/[a-z-]+\?(?:[a-z_]+=[^&'"`]*&)*key=/i, f + " builds a ?key= URL");
    assert.doesNotMatch(src, /\?org=\$\{encodeURIComponent\((?:orgParam|orgKey|[A-Za-z.]*api_key)\)\}/, f + " puts the org key in ?org=");
  }
});
