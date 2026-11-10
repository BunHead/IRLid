// Review 1.5 (old M5): anonymous receipt upload is capped in size and rate,
// and only receipts that verify are stored. Runs the real consumer Worker.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import worker from "../src/index.js";

const { subtle } = globalThis.crypto;
const b64u = (bytes) => Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const fromB64u = (s) => new Uint8Array(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
function canonical(val) {
  if (val === null || typeof val !== "object") return JSON.stringify(val);
  if (Array.isArray(val)) return "[" + val.map(canonical).join(",") + "]";
  return "{" + Object.keys(val).sort().map(k => JSON.stringify(k) + ":" + canonical(val[k])).join(",") + "}";
}
const hash = async (obj) => b64u(new Uint8Array(await subtle.digest("SHA-256", new TextEncoder().encode(canonical(obj)))));
async function keyPair() {
  const kp = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const j = await subtle.exportKey("jwk", kp.publicKey);
  return { kp, pub: { kty: j.kty, crv: j.crv, x: j.x, y: j.y } };
}
async function sign(payload, kp) {
  const h = await hash(payload);
  return { hash: h, sig: b64u(new Uint8Array(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, kp.privateKey, fromB64u(h)))) };
}
async function validV3Receipt() {
  const A = await keyPair(); const B = await keyPair();
  const ts = Math.floor(Date.now() / 1000);
  const offer = { v: 3, lat: 52.9225, lon: -1.4746, acc: 5, ts, nonce: 444 };
  const offerSig = await sign(offer, A.kp);
  const hello = { v: 3, type: "hello", pub: A.pub, offer: { payload: offer, sig: offerSig.sig } };
  const helloHash = await hash(hello);
  const offerHash = await hash(offer);
  const aP = { v: 3, helloHash, offerHash, lat: 52.9225, lon: -1.4746, acc: 5, ts: ts + 1, nonce: 555 };
  const bP = { v: 3, helloHash, offerHash, lat: 52.9225, lon: -1.4747, acc: 4, ts: ts + 2, nonce: 666 };
  const aS = await sign(aP, A.kp); const bS = await sign(bP, B.kp);
  return {
    v: 3, type: "combined", hello,
    a: { v: 3, type: "response", payload: aP, hash: aS.hash, sig: aS.sig, pub: A.pub },
    b: { v: 3, type: "response", payload: bP, hash: bS.hash, sig: bS.sig, pub: B.pub }
  };
}

class D1 {
  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec(`
      CREATE TABLE receipts (id TEXT PRIMARY KEY, uploader_id TEXT, receipt_hash TEXT UNIQUE, pub_key_a TEXT, pub_key_b TEXT, ts_a INTEGER, ts_b INTEGER, receipt_json TEXT, verified INTEGER, created_at INTEGER, party_info TEXT);
      CREATE TABLE devices (id TEXT, user_id TEXT, pub_key_id TEXT, revoked_at INTEGER);
      CREATE TABLE users (id TEXT, display_name TEXT, google_picture TEXT);
      CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id TEXT, expires_at INTEGER);
    `);
  }
  prepare(sql) {
    const db = this.db; let args = [];
    return {
      bind(...a) { args = a; return this; },
      async first() { return db.prepare(sql).get(...args) ?? null; },
      async all() { return { results: db.prepare(sql).all(...args) }; },
      async run() { const i = db.prepare(sql).run(...args); return { meta: { changes: Number(i.changes) } }; }
    };
  }
  count() { return this.db.prepare("SELECT COUNT(*) AS n FROM receipts").get().n; }
}

function upload(d1, body, ip = "203.0.113.5") {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return worker.fetch(new Request("https://api.test/receipts", {
    method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip }, body: raw
  }), { DB: d1, CORS_ORIGIN: "*" });
}

test("a valid receipt is stored as before", async () => {
  const d1 = new D1();
  const res = await upload(d1, { combined: await validV3Receipt() });
  assert.equal(res.status, 201, await res.clone().text());
  assert.equal((await res.json()).verified, true);
  assert.equal(d1.count(), 1);
});

test("a receipt that fails verification is refused and not stored", async () => {
  const d1 = new D1();
  const combined = await validV3Receipt();
  combined.b.payload.nonce = 999; // tampered after signing
  const res = await upload(d1, { combined });
  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.error, "receipt_not_valid");
  assert.equal(body.verified, false);
  assert.equal(d1.count(), 0);
});

test("an oversized upload is refused before it is parsed", async () => {
  const d1 = new D1();
  const combined = await validV3Receipt();
  combined.padding = "x".repeat(70 * 1024);
  const res = await upload(d1, { combined });
  assert.equal(res.status, 413);
  assert.equal(d1.count(), 0);
});

test("uploads are capped per IP, other IPs are unaffected", async () => {
  const d1 = new D1();
  const junk = { combined: { type: "combined" } };
  let last;
  for (let i = 0; i < 31; i++) last = await upload(d1, junk);
  assert.equal(last.status, 429);
  const other = await upload(d1, { combined: await validV3Receipt() }, "198.51.100.1");
  assert.equal(other.status, 201);
});
