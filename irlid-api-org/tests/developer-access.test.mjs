// Break-glass guard (reviews/break-glass-options.md, rungs 2 and 3). Removing
// the org key back door (PR #158) must not lock the Developer out:
//  - BOOTSTRAP_DEVELOPER_FP accepts several devices (comma list, spaces ok),
//    and each listed device gets Developer access to every org by session.
//  - Only a listed Developer device can appoint a Lead Admin, and a second
//    or third listed device passes that check too.
// Rules A1, A2, S4.
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const NOW = () => Math.floor(Date.now() / 1000);
const ORGS = [
  { id: "org-1", api_key: "org_key_one_1234567890123456", slug: "one", name: "One", settings_json: "{}" },
  { id: "org-2", api_key: "org_key_two_1234567890123456", slug: "two", name: "Two", settings_json: "{}" }
];

function makeEnv(devList) {
  const sessions = {
    sess_dev_phone_aaaaaaaaaaaa: { user_id: "u-phone", expires_at: NOW() + 3600 },
    sess_dev_desk_bbbbbbbbbbbbb: { user_id: "u-desk", expires_at: NOW() + 3600 },
    sess_stranger_cccccccccccc: { user_id: "u-x", expires_at: NOW() + 3600 }
  };
  const users = {
    "u-phone": { id: "u-phone", display_name: "Dev phone", pub_fp: "fp-dev-phone" },
    "u-desk": { id: "u-desk", display_name: "Dev desktop", pub_fp: "fp-dev-desk" },
    "u-x": { id: "u-x", display_name: "Stranger", pub_fp: "fp-stranger" }
  };
  const db = {
    prepare(sql) {
      const q = sql.replace(/\s+/g, " ").trim();
      const st = { args: [] };
      st.bind = (...a) => { st.args = a; return st; };
      st.first = async () => {
        if (q.startsWith("SELECT token, user_id, expires_at FROM login_sessions WHERE token = ?")) {
          const s = sessions[st.args[0]]; return s ? { token: st.args[0], ...s } : null;
        }
        if (q.startsWith("SELECT id, display_name, pub_fp FROM portal_users WHERE id = ?")) return users[st.args[0]] || null;
        if (q.startsWith("SELECT * FROM organisations WHERE id=?")) return ORGS.find(o => o.id === st.args[0]) || null;
        return null; // no memberships at all: Developer access must come from the list alone
      };
      st.all = async () => {
        if (q.includes("FROM organisations ORDER BY")) return { results: ORGS.map(o => ({ ...o })) };
        return { results: [] };
      };
      st.run = async () => ({ meta: { changes: 0 } });
      return st;
    },
    batch: async () => []
  };
  return { DB: db, CORS_ORIGIN: "*", BOOTSTRAP_DEVELOPER_FP: devList };
}

const req = (method, path, headers = {}, body) => new Request("https://worker.test" + path, {
  method, headers: body ? { "Content-Type": "application/json", ...headers } : headers, body: body ? JSON.stringify(body) : undefined
});
const DEV_LIST = " fp-dev-phone , fp-dev-desk,fp-dev-spare ";

test("every device on the Developer list reaches every org by session (no org key needed)", async () => {
  for (const tok of ["sess_dev_phone_aaaaaaaaaaaa", "sess_dev_desk_bbbbbbbbbbbbb"]) {
    for (const org of ORGS) {
      const res = await worker.fetch(req("GET", "/org/settings", { Authorization: "Bearer " + tok, "X-Org-Id": org.id }), makeEnv(DEV_LIST));
      assert.equal(res.status, 200, tok + " -> " + org.id);
      assert.equal((await res.text()).includes(org.api_key), false);
    }
  }
});

test("/user/orgs lists every org as Developer for the second listed device", async () => {
  const res = await worker.fetch(req("GET", "/user/orgs", { Authorization: "Bearer sess_dev_desk_bbbbbbbbbbbbb" }), makeEnv(DEV_LIST));
  assert.equal(res.status, 200);
  const orgs = (await res.json()).orgs;
  assert.deepEqual(orgs.map(o => o.id).sort(), ["org-1", "org-2"]);
  for (const o of orgs) assert.equal(o.role, "developer");
});

test("a device not on the list gets no Developer access", async () => {
  const res = await worker.fetch(req("GET", "/org/settings", { Authorization: "Bearer sess_stranger_cccccccccccc", "X-Org-Id": "org-1" }), makeEnv(DEV_LIST));
  assert.equal(res.status, 403);
});

// ---- Lead Admin appointment: the Developer-list check ----
function canonical(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
}
const b64u = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sha = async (s) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const fpOf = async (jwk) => b64u(await sha(canonical(jwk))).slice(0, 16);

async function appointBody(issuerJwk, appointeeJwk) {
  const receipt = { hello: { pub: appointeeJwk }, note: "co-presence receipt stand-in" };
  return {
    appointee_pub_jwk: appointeeJwk,
    copresence_receipt: receipt,
    grant_envelope: {
      pub: issuerJwk,
      payload: {
        type: "irlid_leadadmin_grant_v5",
        org_id: "org-1",
        appointee_pub_fp: await fpOf(appointeeJwk),
        copresence_hash: b64u(await sha(canonical(receipt))),
        ts: 1, // deliberately stale: passing the Developer check means the next refusal is grant_stale
        nonce: "nonce-0123456789abcdef"
      },
      sig: "x"
    }
  };
}
const jwk = (x) => ({ kty: "EC", crv: "P-256", x, y: x + "y" });

test("Lead Admin appointment: any listed Developer device passes the Developer check", async () => {
  const phone = jwk("phone"), desk = jwk("desk"), spare = jwk("spare"), appointee = jwk("appointee");
  const list = [await fpOf(phone), await fpOf(desk), await fpOf(spare)].join(", ");
  for (const issuer of [phone, desk, spare]) {
    const res = await worker.fetch(req("POST", "/org/lead-admin/appoint", {}, await appointBody(issuer, appointee)), makeEnv(list));
    const data = await res.json();
    assert.notEqual(data.error, "developer_required", "listed device refused as Developer");
    assert.equal(data.error, "grant_stale");
  }
});

test("Lead Admin appointment: a device not on the Developer list is refused", async () => {
  const phone = jwk("phone"), other = jwk("other"), appointee = jwk("appointee");
  const res = await worker.fetch(req("POST", "/org/lead-admin/appoint", {}, await appointBody(other, appointee)), makeEnv(await fpOf(phone)));
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, "developer_required");
});
