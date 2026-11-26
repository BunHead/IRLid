// v6.8.29 - Event CSV import never guesses between people with the same name.
// Since v6.8.27 two active people may share a name. An `expected_names` entry
// now links only when exactly one active person has that name; with two or
// more, the row is reported as ambiguous (with each person's key tag) and
// nobody is added for that name, so an admin chooses. Made-up names only.
// Runs the Worker's real SQL; the import is signed with a v5 calendar action
// the way the dashboard does it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../src/index.js";
import { SqliteD1 } from "./helpers/sqlite-d1.mjs";

const T = Math.floor(Date.now() / 1000);
const ELL = "…";
const LIVE = `
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

async function setup() {
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
const person = (d1, name, fp, archivedAt = null) => {
  const id = "p_csv_" + (++seq);
  d1.exec("INSERT INTO org_expected (id,org_id,display_name,device_pub_fp,created_at,archived_at) VALUES (?,'org-1',?,?,?,?)", id, name, fp, T, archivedAt);
  return id;
};

async function importCsv({ env, lead }, csv) {
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
const HEADER = "event_name,studio,day_of_week,start_time,duration_min,expected_names\n";
const linked = (d1, eventId) => d1.all("SELECT expected_id FROM event_expected WHERE event_id=? ORDER BY expected_id", eventId).map(r => r.expected_id);

test("one person with the name: linked, exactly as before", async () => {
  const ctx = await setup();
  const alex = person(ctx.d1, "Alex Sample", "fpAlex000000beef");
  const r = await importCsv(ctx, HEADER + "Yoga,Studio,Mon,10:00,60,Alex Sample\n");
  assert.equal(r.status, 200, r.text);
  assert.equal(r.data.rows[0].status, "ok");
  assert.equal(r.data.ambiguous_count, 0);
  assert.deepEqual(linked(ctx.d1, r.data.rows[0].event_id), [alex]);
  assert.equal(r.data.org_expected_created, 0);
});

test("two active people with the name: nobody is linked, the row is reported as ambiguous with both key tags", async () => {
  const ctx = await setup();
  const a = person(ctx.d1, "Sam Example", "fpSamFirst00a3f9");
  const b = person(ctx.d1, "sam example", "fpSamSecond07c21");
  const alex = person(ctx.d1, "Alex Sample", null);
  const r = await importCsv(ctx, HEADER + "Yoga,Studio,Mon,10:00,60,Sam Example;Alex Sample\n");
  assert.equal(r.status, 200, r.text);
  const row = r.data.rows[0];
  assert.equal(row.status, "ambiguous");
  assert.deepEqual(linked(ctx.d1, row.event_id), [alex], "only the unambiguous name is linked");
  assert.equal(r.data.ambiguous_count, 1);
  const amb = r.data.ambiguous[0];
  assert.equal(amb.row, 2);
  assert.equal(amb.event_id, row.event_id);
  assert.equal(amb.event_name, "Yoga");
  assert.equal(amb.name, "Sam Example");
  assert.deepEqual(amb.candidates.map(c => c.id).sort(), [a, b].sort());
  assert.deepEqual(amb.candidates.map(c => c.name_label).sort(), [`Sam Example (${ELL}a3f9)`, `sam example (${ELL}7c21)`].sort());
  assert.ok(!/fpSamFirst|fpSamSecond|device_pub_fp/.test(r.text), "only the 4-character tag leaves the Worker");
  assert.equal(r.data.org_expected_created, 0, "an ambiguous name never creates a third person");
  assert.equal(ctx.d1.get("SELECT COUNT(*) AS n FROM org_expected WHERE LOWER(display_name)='sam example'").n, 2);
});

test("the event itself is still created for an ambiguous row", async () => {
  const ctx = await setup();
  person(ctx.d1, "Sam Example", "fpSamFirst00a3f9"); person(ctx.d1, "Sam Example", "fpSamSecond07c21");
  const r = await importCsv(ctx, HEADER + "Yoga,Studio,Mon,10:00,60,Sam Example\n");
  assert.equal(r.data.events_created, 1);
  assert.equal(ctx.d1.get("SELECT name FROM weekly_events WHERE id=?", r.data.rows[0].event_id).name, "Yoga");
  assert.deepEqual(linked(ctx.d1, r.data.rows[0].event_id), []);
});

test("an archived namesake does not count: one active person with the name still links", async () => {
  const ctx = await setup();
  const active = person(ctx.d1, "Sam Example", "fpSamFirst00a3f9");
  person(ctx.d1, "Sam Example", "fpSamSecond07c21", T - 10);
  const r = await importCsv(ctx, HEADER + "Yoga,Studio,Mon,10:00,60,Sam Example\n");
  assert.equal(r.data.rows[0].status, "ok");
  assert.deepEqual(linked(ctx.d1, r.data.rows[0].event_id), [active]);
});

test("a new name is created once and then reused by later rows (still exactly one person)", async () => {
  const ctx = await setup();
  const r = await importCsv(ctx, HEADER + "Yoga,Studio,Mon,10:00,60,Jo Newperson\nPilates,Studio,Tue,11:00,45,Jo Newperson\n");
  assert.equal(r.status, 200, r.text);
  assert.equal(r.data.org_expected_created, 1);
  const [one] = linked(ctx.d1, r.data.rows[0].event_id);
  assert.deepEqual(linked(ctx.d1, r.data.rows[1].event_id), [one]);
  assert.equal(r.data.ambiguous_count, 0);
});

test("ambiguous across several rows is reported for each row", async () => {
  const ctx = await setup();
  person(ctx.d1, "Sam Example", "fpSamFirst00a3f9"); person(ctx.d1, "Sam Example", null);
  const r = await importCsv(ctx, HEADER + "Yoga,Studio,Mon,10:00,60,Sam Example\nPilates,Studio,Tue,11:00,45,Sam Example\n");
  assert.equal(r.data.ambiguous_count, 2);
  assert.deepEqual(r.data.ambiguous.map(a => a.row), [2, 3]);
  assert.ok(r.data.ambiguous[0].candidates.some(c => c.name_label === "Sam Example (no key yet)"));
});

test("Unicode: the same name typed two ways (NFC / NFD) is one name; accents are never stripped", async () => {
  const NFC = "Jos\u00e9 Example";      // é as one character
  const NFD = "Jose\u0301 Example";     // e + combining acute
  assert.notEqual(NFC, NFD);
  // stored one way, typed the other: links
  let ctx = await setup();
  const jose = person(ctx.d1, NFD, null);
  let r = await importCsv(ctx, HEADER + `Yoga,Studio,Mon,10:00,60,${NFC}\n`);
  assert.equal(r.data.rows[0].status, "ok", r.text);
  assert.deepEqual(linked(ctx.d1, r.data.rows[0].event_id), [jose]);
  assert.equal(r.data.org_expected_created, 0, "no duplicate made for the other spelling");
  // two people stored the two ways ARE the same name: ambiguous, never a guess
  ctx = await setup();
  person(ctx.d1, NFC, "fpJoseOne000a3f9"); person(ctx.d1, NFD, "fpJoseTwo0007c21");
  r = await importCsv(ctx, HEADER + `Yoga,Studio,Mon,10:00,60,${NFD}\n`);
  assert.equal(r.data.rows[0].status, "ambiguous");
  assert.equal(r.data.ambiguous[0].candidates.length, 2);
  // a new name typed decomposed is saved composed (NFC), accent kept
  ctx = await setup();
  r = await importCsv(ctx, HEADER + "Yoga,Studio,Mon,10:00,60,Ren\u0065\u0301e Sample\n");
  assert.equal(r.data.org_expected_created, 1);
  assert.equal(ctx.d1.get("SELECT display_name FROM org_expected").display_name, "Ren\u00e9e Sample");
  // accents are not stripped: "Jose" is not "José"
  ctx = await setup();
  person(ctx.d1, NFC, null);
  r = await importCsv(ctx, HEADER + "Yoga,Studio,Mon,10:00,60,Jose Example\n");
  assert.equal(r.data.org_expected_created, 1, "Jose (no accent) is a different person");
});

test("Unicode: the dashboard labels treat NFC and NFD as the same name too", async () => {
  const ctx = await setup();
  person(ctx.d1, "Jos\u00e9 Example", "fpJoseOne000a3f9"); person(ctx.d1, "Jose\u0301 Example", "fpJoseTwo0007c21");
  const res = await worker.fetch(new Request("https://worker.test/org/expected", { headers: { Authorization: "Bearer sess_csv_lead_abcdefghijklmnop", "X-Org-Id": "org-1" } }), ctx.env, { waitUntil() {} });
  const data = await res.json();
  assert.equal(data.expected.filter(e => e.name_label).length, 2, JSON.stringify(data));
});

test("dashboard: the import tells the admin which rows need a choice, and the old local parser never guesses either", () => {
  const html = readFileSync(new URL("../../Org.html", import.meta.url), "utf8");
  assert.match(html, /const res=await api\('\/org\/weekly-events\/import-csv\?replace=1'/);
  assert.match(html, /importAmbiguousMessage\(res\)/);
  const msg = html.slice(html.indexOf("function importAmbiguousMessage"), html.indexOf("function rowDisplayName"));
  assert.match(msg, /matches more than one person/);
  // the local (mockup) parser: more than one match -> not added
  assert.match(html, /if \(same\.length === 1\) return same\[0\]\.id;\s*if \(same\.length > 1\) \{ skippedNames\.push/);
  assert.match(html, /normalize\('NFC'\)/);
});
