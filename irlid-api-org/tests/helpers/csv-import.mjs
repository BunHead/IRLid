// Shared set-up for the event CSV import tests: the real Worker on an
// in-memory SQLite, and an import signed with a v5 calendar action the way
// the dashboard sends it. Made-up names only.
import worker from "../../src/index.js";
import { SqliteD1 } from "./sqlite-d1.mjs";

export const T = Math.floor(Date.now() / 1000);
export const ELL = "…";
export const LIVE = `
  DROP TABLE org_expected;
  CREATE TABLE org_expected (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, display_name TEXT NOT NULL, initials TEXT,
    role_key TEXT DEFAULT 'attendee', device_pub_fp TEXT, email_hint TEXT, phone_hint TEXT, notes TEXT,
    created_at INTEGER NOT NULL, archived_at INTEGER);
  CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, label TEXT, subname TEXT, capacity INTEGER,
    display_ix INTEGER DEFAULT 0, venue_qr_payload_hash TEXT, created_at INTEGER, archived_at INTEGER);
  CREATE TABLE IF NOT EXISTS weekly_events (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, room_id TEXT, name TEXT NOT NULL,
    day_of_week INTEGER NOT NULL, start_time_local TEXT NOT NULL, duration_min INTEGER NOT NULL, capacity INTEGER,
    color_hex TEXT, notes TEXT, require_proof INTEGER DEFAULT 0, late_grace_min INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL, archived_at INTEGER, checkin_mode TEXT DEFAULT 'standard');
  CREATE TABLE IF NOT EXISTS event_expected (event_id TEXT NOT NULL, expected_id TEXT NOT NULL, added_at INTEGER NOT NULL, added_by TEXT,
    PRIMARY KEY (event_id, expected_id));
`;

// ---- v5 signing (same as kiosk-lock.test.mjs) ----
const b64u = (bytes) => Buffer.from(bytes).toString("base64url");
function canonical(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
}
const sha256 = async (b) => new Uint8Array(await crypto.subtle.digest("SHA-256", b));
async function makeDevice() {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
  const pub = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
  return { kp, pub, fp: b64u(await sha256(new TextEncoder().encode(canonical(pub)))).slice(0, 16) };
}
async function signV5(device, payload) {
  const challenge = b64u(await sha256(new TextEncoder().encode(canonical(payload))));
  const clientData = new TextEncoder().encode(JSON.stringify({ type: "webauthn.get", challenge, origin: "https://irlid.co.uk" }));
  const authData = new Uint8Array(37); authData[32] = 0x05;
  const signed = new Uint8Array(69); signed.set(authData, 0); signed.set(await sha256(clientData), 37);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, device.kp.privateKey, signed));
  return { payload, pub: device.pub, sig: b64u(sig), webauthn: { authData: b64u(authData), clientData: b64u(clientData) } };
}

export async function setup() {
  const d1 = new SqliteD1(LIVE);
  d1.exec("INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES ('org-1','Sample Club','sample-club','org_csv_key_1234567890abcdefgh','{}',0,0)");
  const lead = await makeDevice();
  d1.exec("INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES ('u-lead',?,?,'Lee Lead',0,0)", JSON.stringify(lead.pub), lead.fp);
  d1.exec("INSERT INTO org_memberships (org_id,user_id,role,granted_at) VALUES ('org-1','u-lead','lead_admin',1)");
  d1.exec("INSERT INTO login_sessions (token,user_id,issued_at,expires_at) VALUES ('sess_csv_lead_abcdefghijklmnop','u-lead',?,?)", T, T + 3600);
  d1.exec("INSERT INTO rooms (id,org_id,label,created_at) VALUES ('room-1','org-1','Studio',0)");
  return { d1, lead, env: { DB: d1, CORS_ORIGIN: "*" } };
}
let seq = 0;
export const person = (d1, name, fp, archivedAt = null) => {
  const id = "p_csv_" + (++seq);
  d1.exec("INSERT INTO org_expected (id,org_id,display_name,device_pub_fp,created_at,archived_at) VALUES (?,'org-1',?,?,?,?)", id, name, fp, T, archivedAt);
  return id;
};

export async function importCsv({ env, lead }, csv) {
  const form = new FormData();
  form.append("file", new Blob([csv], { type: "text/csv" }), "week.csv");
  const payload = { type: "irlid_calendar_write_v5", org_id: "org-1", nonce: "nonce_" + crypto.randomUUID().replace(/-/g, ""), timestamp: Date.now() };
  form.append("signed_action", JSON.stringify(await signV5(lead, payload)));
  const res = await worker.fetch(new Request("https://worker.test/org/weekly-events/import-csv", {
    method: "POST", headers: { Authorization: "Bearer sess_csv_lead_abcdefghijklmnop", "X-Org-Id": "org-1" }, body: form
  }), env, { waitUntil() {} });
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch (_) {}
  return { status: res.status, data, text };
}
export const HEADER = "event_name,studio,day_of_week,start_time,duration_min,expected_names\n";
export const linked = (d1, eventId) => d1.all("SELECT expected_id FROM event_expected WHERE event_id=? ORDER BY expected_id", eventId).map(r => r.expected_id);

