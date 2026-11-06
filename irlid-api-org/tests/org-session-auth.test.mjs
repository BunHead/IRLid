// PR A (v6.8.4) — no org back door. The Org portal signs in only by a v5 QR
// scan: the browser never holds the org api_key, dashboard calls use the
// login session (Bearer + X-Org-Id, staff-tier role), and Sign out ends the
// session on the server. Rules S2, S4, S9, S12.
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const ORG_KEY = "org_secret_master_key_1234567890";
const ORG = { id: "org-1", api_key: ORG_KEY, slug: "test-org", name: "Test Org", settings_json: "{}", venue_pub_jwk: null, venue_prv_jwk: null };
const OTHER_ORG = { id: "org-2", api_key: "org_other_key_123456789012", slug: "other", name: "Other", settings_json: "{}" };
const NOW = () => Math.floor(Date.now() / 1000);

// token -> { user_id, expires_at }
function makeEnv({ sessions = {}, users = {}, memberships = [] } = {}) {
  const state = { sessions: { ...sessions }, created: [], queries: [] };
  const db = {};
  db.prepare = (sql) => {
    const q = sql.replace(/\s+/g, " ").trim();
    const st = { args: [] };
    st.bind = (...a) => { st.args = a; return st; };
    const first = () => {
      state.queries.push({ sql: q, args: st.args });
      if (q.startsWith("SELECT token, user_id, expires_at FROM login_sessions WHERE token = ?")) {
        const s = state.sessions[st.args[0]];
        return s ? { token: st.args[0], ...s } : null;
      }
      if (q.startsWith("SELECT id, display_name, pub_fp FROM portal_users WHERE id = ?")) return users[st.args[0]] || null;
      if (q.startsWith("SELECT * FROM organisations WHERE id=?")) return [ORG, OTHER_ORG].find(o => o.id === st.args[0]) || null;
      if (q.startsWith("SELECT * FROM organisations WHERE api_key=?")) return [ORG, OTHER_ORG].find(o => o.api_key === st.args[0]) || null;
      if (q.startsWith("SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?")) {
        const m = memberships.find(x => x.org_id === st.args[0] && x.user_id === st.args[1]);
        return m ? { role: m.role } : null;
      }
      if (q.startsWith("SELECT 1 FROM org_memberships WHERE user_id = ? AND role IN ('lead_admin','developer')")) {
        return memberships.some(x => x.user_id === st.args[0] && (x.role === "lead_admin" || x.role === "developer")) ? { 1: 1 } : null;
      }
      if (q.startsWith("SELECT id FROM organisations WHERE slug = ?")) return null;
      if (q.startsWith("SELECT user_id FROM org_memberships WHERE org_id = ? AND role = 'lead_admin'")) return null;
      if (q.startsWith("SELECT token,checkin_id,org_api_key,expires_at,consumed_at FROM org_checkout_tokens WHERE token=?")) {
        return st.args[0] === "tok_checkout_1" ? { token: "tok_checkout_1", checkin_id: "c1", org_api_key: ORG_KEY, expires_at: NOW() + 60, consumed_at: null } : null;
      }
      if (q.startsWith("SELECT id,slug,name,settings_json FROM organisations WHERE api_key=?")) return st.args[0] === ORG_KEY ? ORG : null;
      if (q.startsWith("SELECT id, checkout_at FROM org_checkins WHERE id=?")) return { id: "c1", checkout_at: null };
      return null;
    };
    const all = () => {
      state.queries.push({ sql: q, args: st.args });
      if (q.includes("FROM org_memberships m JOIN organisations o")) {
        const rows = memberships.filter(m => m.user_id === st.args[0]).map(m => {
          const o = [ORG, OTHER_ORG].find(x => x.id === m.org_id);
          // Return the api_key too, as a careless SELECT would: the handler must not pass it on.
          return { role: m.role, id: o.id, name: o.name, slug: o.slug, api_key: o.api_key, settings_json: o.settings_json };
        });
        return { results: rows };
      }
      if (q.startsWith("SELECT id, name, slug") && q.includes("FROM organisations ORDER BY")) {
        return { results: [ORG, OTHER_ORG].map(o => ({ ...o })) };
      }
      return { results: [] };
    };
    const run = () => {
      state.queries.push({ sql: q, args: st.args });
      if (q.startsWith("DELETE FROM login_sessions WHERE token = ?")) {
        const had = !!state.sessions[st.args[0]];
        delete state.sessions[st.args[0]];
        return { meta: { changes: had ? 1 : 0 } };
      }
      if (q.startsWith("INSERT INTO organisations")) state.created.push(st.args);
      return { meta: { changes: 0 } };
    };
    st.first = async () => first();
    st.all = async () => all();
    st.run = async () => run();
    return st;
  };
  db.batch = async () => [];
  return { DB: db, CORS_ORIGIN: "*", _state: state };
}

const req = (method, path, headers = {}, body) => new Request("https://worker.test" + path, {
  method, headers: body ? { "Content-Type": "application/json", ...headers } : headers, body: body ? JSON.stringify(body) : undefined
});

const STAFF_TOKEN = "sess_staff_aaaaaaaaaaaaaaaa";
const ATTENDEE_TOKEN = "sess_attendee_bbbbbbbbbbbbbb";
const LEAD_TOKEN = "sess_lead_cccccccccccccccccc";
function standardEnv() {
  return makeEnv({
    sessions: {
      [STAFF_TOKEN]: { user_id: "u-staff", expires_at: NOW() + 3600 },
      [ATTENDEE_TOKEN]: { user_id: "u-att", expires_at: NOW() + 3600 },
      [LEAD_TOKEN]: { user_id: "u-lead", expires_at: NOW() + 3600 }
    },
    users: {
      "u-staff": { id: "u-staff", display_name: "Sam Staff", pub_fp: "fp-staff" },
      "u-att": { id: "u-att", display_name: "Ann Attendee", pub_fp: "fp-att" },
      "u-lead": { id: "u-lead", display_name: "Lee Lead", pub_fp: "fp-lead" }
    },
    memberships: [
      { user_id: "u-staff", org_id: "org-1", role: "staff" },
      { user_id: "u-att", org_id: "org-1", role: "attendee" },
      { user_id: "u-lead", org_id: "org-1", role: "lead_admin" },
      { user_id: "u-lead", org_id: "org-2", role: "manager" }
    ]
  });
}

test("/user/orgs never returns the org api_key", async () => {
  const env = standardEnv();
  const res = await worker.fetch(req("GET", "/user/orgs", { Authorization: "Bearer " + LEAD_TOKEN }), env);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.equal(text.includes(ORG_KEY), false, "master key must not appear anywhere in the body");
  assert.equal(text.includes(OTHER_ORG.api_key), false);
  const data = JSON.parse(text);
  assert.equal(data.orgs.length, 2);
  for (const o of data.orgs) {
    assert.equal("api_key" in o, false);
    assert.ok(o.id);
  }
});

test("/user/orgs for the bootstrap Developer (all orgs) never returns an api_key", async () => {
  const env = standardEnv();
  env.BOOTSTRAP_DEVELOPER_FP = "fp-staff";
  const res = await worker.fetch(req("GET", "/user/orgs", { Authorization: "Bearer " + STAFF_TOKEN }), env);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.equal(text.includes(ORG_KEY), false);
  assert.equal(text.includes(OTHER_ORG.api_key), false);
  assert.ok(JSON.parse(text).orgs.length >= 2);
});

test("/user/create-org never returns the new org's api_key", async () => {
  const env = standardEnv();
  const res = await worker.fetch(req("POST", "/user/create-org", { Authorization: "Bearer " + LEAD_TOKEN }, { name: "Brand New Venue" }), env);
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal("api_key" in data.org, false);
  const insertedKey = env._state.created[0][3];
  assert.match(insertedKey, /^org_/, "a key is still made server-side for service accounts");
  assert.equal(JSON.stringify(data).includes(insertedKey), false);
});

test("orgAuth: a staff member's login session + X-Org-Id gets in", async () => {
  const res = await worker.fetch(req("GET", "/org/settings", { Authorization: "Bearer " + STAFF_TOKEN, "X-Org-Id": "org-1" }), standardEnv());
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.id, "org-1");
  assert.equal(JSON.stringify(data).includes(ORG_KEY), false);
});

test("orgAuth: a session only reaches the org it is a member of", async () => {
  const res = await worker.fetch(req("GET", "/org/settings", { Authorization: "Bearer " + STAFF_TOKEN, "X-Org-Id": "org-2" }), standardEnv());
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, "not_a_member");
});

test("orgAuth: an attendee-role membership is not staff access (A5)", async () => {
  const res = await worker.fetch(req("GET", "/org/settings", { Authorization: "Bearer " + ATTENDEE_TOKEN, "X-Org-Id": "org-1" }), standardEnv());
  assert.equal(res.status, 403);
});

test("orgAuth: X-Org-Id alone (no session) is refused — an org id is public (S2)", async () => {
  const res = await worker.fetch(req("GET", "/org/settings", { "X-Org-Id": "org-1" }), standardEnv());
  assert.equal(res.status, 401);
});

test("orgAuth: an unknown or expired session is refused with a session error", async () => {
  const env = standardEnv();
  env._state.sessions["sess_old_dddddddddddddddddd"] = { user_id: "u-staff", expires_at: NOW() - 10 };
  for (const tok of ["sess_never_eeeeeeeeeeeeeeee", "sess_old_dddddddddddddddddd"]) {
    const res = await worker.fetch(req("GET", "/org/settings", { Authorization: "Bearer " + tok, "X-Org-Id": "org-1" }), env);
    assert.equal(res.status, 401, tok);
    assert.match((await res.json()).error, /^session_(invalid|expired)$/);
  }
});

test("orgAuth: service-account X-Org-Key still works for automation", async () => {
  const res = await worker.fetch(req("GET", "/org/settings", { "X-Org-Key": ORG_KEY }), standardEnv());
  assert.equal(res.status, 200);
});

test("/user/logout ends the session: the same token no longer reaches the org", async () => {
  const env = standardEnv();
  const before = await worker.fetch(req("GET", "/org/settings", { Authorization: "Bearer " + STAFF_TOKEN, "X-Org-Id": "org-1" }), env);
  assert.equal(before.status, 200);
  const out = await worker.fetch(req("POST", "/user/logout", { Authorization: "Bearer " + STAFF_TOKEN }), env);
  assert.equal(out.status, 200);
  assert.equal((await out.json()).sessions_revoked, 1);
  const after = await worker.fetch(req("GET", "/org/settings", { Authorization: "Bearer " + STAFF_TOKEN, "X-Org-Id": "org-1" }), env);
  assert.equal(after.status, 401);
  const orgs = await worker.fetch(req("GET", "/user/orgs", { Authorization: "Bearer " + STAFF_TOKEN }), env);
  assert.equal(orgs.status, 401);
  // Other people's sessions are untouched.
  const lead = await worker.fetch(req("GET", "/org/settings", { Authorization: "Bearer " + LEAD_TOKEN, "X-Org-Id": "org-1" }), env);
  assert.equal(lead.status, 200);
});

test("/user/logout needs a bearer and never accepts the org key", async () => {
  assert.equal((await worker.fetch(req("POST", "/user/logout"), standardEnv())).status, 401);
  assert.equal((await worker.fetch(req("POST", "/user/logout", { Authorization: "Bearer " + ORG_KEY }), standardEnv())).status, 400);
});

test("CORS lets the dashboard send X-Org-Id", async () => {
  const res = await worker.fetch(req("OPTIONS", "/org/settings", { Origin: "https://irlid.co.uk", "Access-Control-Request-Headers": "x-org-id, authorization" }), standardEnv());
  assert.match(res.headers.get("Access-Control-Allow-Headers") || "", /X-Org-Id/);
});

test("checkout-token lookup (public attendee route) returns the slug, never the api_key", async () => {
  const res = await worker.fetch(req("GET", "/org/checkout-token/tok_checkout_1"), standardEnv());
  const text = await res.text();
  assert.equal(text.includes(ORG_KEY), false, text);
  assert.equal(res.status, 200, text);
  assert.equal(JSON.parse(text).org_api_key, "test-org");
});
