// Worker-side v5 verification: runs the consumer Worker's real verifyReceipt and
// verifyV5Envelope (imported from irlid-api/src/index.js) against constructed
// receipts: pure v3, pure v5, hybrid, mutated, wrong-origin, missing-UV.
//
// Run with: node --test irlid-api/tests/verify-receipt.test.mjs
//
// Until 10 Nov 2026 (review 3.4) this file re-typed those two functions, so a
// change to the Worker could pass here while broken. It now imports them. The
// small helpers below are only used to BUILD signed receipts.
//
// First landed: 1 May 2026, alongside the v5 Worker-side verification (PROTOCOL.md §13).

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { verifyReceipt, verifyV5Envelope } from "../src/index.js";
const { subtle } = webcrypto;

// ─── Worker primitives (verbatim from irlid-api/src/index.js after the v5 pass) ───

function b64urlEncode(bytes) {
  const b64 = Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return new Uint8Array(Buffer.from(str, "base64"));
}
function compactJwk(jwk) {
  if (!jwk || !jwk.kty) return jwk;
  return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
}
function canonical(val) {
  if (val === null || typeof val !== "object") return JSON.stringify(val);
  if (Array.isArray(val)) return "[" + val.map(canonical).join(",") + "]";
  const keys = Object.keys(val).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + canonical(val[k])).join(",") + "}";
}
async function hashPayloadToB64url(payloadObj, protocolV) {
  const v = (protocolV != null) ? Number(protocolV) : ((payloadObj && payloadObj.v) ? Number(payloadObj.v) : 3);
  const str = (v >= 3) ? canonical(payloadObj) : JSON.stringify(payloadObj);
  const hashBuf = await subtle.digest("SHA-256", new TextEncoder().encode(str));
  return b64urlEncode(new Uint8Array(hashBuf));
}
// verifyReceipt and verifyV5Envelope are imported from the real Worker
// (review 3.4), so this file can no longer drift from irlid-api/src/index.js.

// ─── Test infrastructure: build real combined receipts ───

async function genKp() {
  const kp = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = compactJwk(await subtle.exportKey("jwk", kp.publicKey));
  return { kp, pub };
}

async function makeAuthData(rpId, flags, count) {
  const h = new Uint8Array(await subtle.digest("SHA-256", new TextEncoder().encode(rpId)));
  const a = new Uint8Array(37);
  a.set(h, 0); a[32] = flags;
  a[33] = (count >>> 24) & 0xff; a[34] = (count >>> 16) & 0xff;
  a[35] = (count >>> 8) & 0xff; a[36] = count & 0xff;
  return a;
}

// Sign a payload via v5 envelope, returning { sig, webauthn }
async function v5Sign(payload, kp, opts = {}) {
  const challenge = await hashPayloadToB64url(payload);
  const cdObj = {
    type: opts.type || "webauthn.get",
    challenge: opts.challengeOverride !== undefined ? opts.challengeOverride : challenge,
    origin: opts.origin || "https://irlid.co.uk",
    crossOrigin: false
  };
  const cd = new TextEncoder().encode(JSON.stringify(cdObj));
  const flags = opts.flags !== undefined ? opts.flags : 0x05;
  const ad = await makeAuthData(opts.rpId || "irlid.co.uk", flags, 1);
  const cdHash = new Uint8Array(await subtle.digest("SHA-256", cd));
  const signed = new Uint8Array(ad.length + cdHash.length);
  signed.set(ad, 0); signed.set(cdHash, ad.length);
  const sigRaw = new Uint8Array(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, kp.privateKey, signed));
  return {
    sig: b64urlEncode(sigRaw),
    webauthn: { authData: b64urlEncode(ad), clientData: b64urlEncode(cd) }
  };
}

// Sign via v3 raw-ECDSA over hash bytes
async function v3Sign(payload, kp) {
  const hashB64u = await hashPayloadToB64url(payload);
  const hashBytes = b64urlDecode(hashB64u);
  const sig = new Uint8Array(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, kp.privateKey, hashBytes));
  return { sig: b64urlEncode(sig), hash: hashB64u };
}

// Build a full combined receipt where both parties + HELLO use v5
async function buildPureV5Receipt(opts = {}) {
  const A = await genKp();
  const B = await genKp();
  const ts = Math.floor(Date.now() / 1000);

  const offerPayload = { v: 5, lat: 52.9225, lon: -1.4746, acc: 5, ts, nonce: 111 };
  const aSig = await v5Sign(offerPayload, A.kp, opts.helloOpts || {});

  const hello = {
    v: 5, type: "hello", pub: A.pub,
    offer: { payload: offerPayload, sig: aSig.sig, webauthn: aSig.webauthn }
  };
  const helloHash = b64urlEncode(new Uint8Array(await subtle.digest("SHA-256",
    new TextEncoder().encode(canonical(hello)))));
  const offerHash = await hashPayloadToB64url(offerPayload);

  const aRespPayload = { v: 5, helloHash, offerHash, lat: 52.9225, lon: -1.4746, acc: 5, ts: ts + 1, nonce: 222 };
  const aRespSig = await v5Sign(aRespPayload, A.kp);
  const aHash = await hashPayloadToB64url(aRespPayload);

  const bRespPayload = { v: 5, helloHash, offerHash, lat: 52.9225, lon: -1.4747, acc: 4, ts: ts + 2, nonce: 333 };
  const bRespSig = await v5Sign(bRespPayload, B.kp);
  const bHash = await hashPayloadToB64url(bRespPayload);

  return {
    v: 3, type: "combined", hello,
    a: { v: 5, type: "response", payload: aRespPayload, hash: aHash, sig: aRespSig.sig, pub: A.pub, webauthn: aRespSig.webauthn },
    b: { v: 5, type: "response", payload: bRespPayload, hash: bHash, sig: bRespSig.sig, pub: B.pub, webauthn: bRespSig.webauthn }
  };
}

// Pure v3 receipt (no v5 envelopes anywhere)
async function buildPureV3Receipt() {
  const A = await genKp();
  const B = await genKp();
  const ts = Math.floor(Date.now() / 1000);

  const offerPayload = { v: 3, lat: 52.9225, lon: -1.4746, acc: 5, ts, nonce: 444 };
  const offerSig = await v3Sign(offerPayload, A.kp);

  const hello = { v: 3, type: "hello", pub: A.pub, offer: { payload: offerPayload, sig: offerSig.sig } };
  const helloHash = b64urlEncode(new Uint8Array(await subtle.digest("SHA-256",
    new TextEncoder().encode(canonical(hello)))));
  const offerHash = await hashPayloadToB64url(offerPayload);

  const aPayload = { v: 3, helloHash, offerHash, lat: 52.9225, lon: -1.4746, acc: 5, ts: ts + 1, nonce: 555 };
  const aSig = await v3Sign(aPayload, A.kp);
  const bPayload = { v: 3, helloHash, offerHash, lat: 52.9225, lon: -1.4747, acc: 4, ts: ts + 2, nonce: 666 };
  const bSig = await v3Sign(bPayload, B.kp);

  return {
    v: 3, type: "combined", hello,
    a: { v: 3, type: "response", payload: aPayload, hash: aSig.hash, sig: aSig.sig, pub: A.pub },
    b: { v: 3, type: "response", payload: bPayload, hash: bSig.hash, sig: bSig.sig, pub: B.pub }
  };
}

// Hybrid: v3 HELLO + v5 a + v3 b
async function buildHybridReceipt() {
  const A = await genKp();
  const B = await genKp();
  const ts = Math.floor(Date.now() / 1000);

  const offerPayload = { v: 3, lat: 52.9225, lon: -1.4746, acc: 5, ts, nonce: 777 };
  const offerSig = await v3Sign(offerPayload, A.kp);

  const hello = { v: 3, type: "hello", pub: A.pub, offer: { payload: offerPayload, sig: offerSig.sig } };
  const helloHash = b64urlEncode(new Uint8Array(await subtle.digest("SHA-256",
    new TextEncoder().encode(canonical(hello)))));
  const offerHash = await hashPayloadToB64url(offerPayload);

  // Party A's response is v5
  const aPayload = { v: 5, helloHash, offerHash, lat: 52.9225, lon: -1.4746, acc: 5, ts: ts + 1, nonce: 888 };
  const aSig = await v5Sign(aPayload, A.kp);
  const aHash = await hashPayloadToB64url(aPayload);

  // Party B's response is v3
  const bPayload = { v: 3, helloHash, offerHash, lat: 52.9225, lon: -1.4747, acc: 4, ts: ts + 2, nonce: 999 };
  const bSig = await v3Sign(bPayload, B.kp);

  return {
    v: 3, type: "combined", hello,
    a: { v: 5, type: "response", payload: aPayload, hash: aHash, sig: aSig.sig, pub: A.pub, webauthn: aSig.webauthn },
    b: { v: 3, type: "response", payload: bPayload, hash: bSig.hash, sig: bSig.sig, pub: B.pub }
  };
}

// =================== TESTS ===================

describe("Worker verifyReceipt — pure v3 (backward compat)", () => {
  test("v3 receipt verifies cleanly, fully_v5 false", async () => {
    const r = await buildPureV3Receipt();
    const c = await verifyReceipt(r);
    assert.equal(c.valid, true);
    assert.equal(c.fully_v5, false);
    assert.equal(c.a_v5_envelope, false);
    assert.equal(c.b_v5_envelope, false);
    assert.equal(c.a_binds_hello, true);
    assert.equal(c.b_binds_hello, true);
    assert.equal(c.distance_ok, true);
    assert.equal(c.time_delta_ok, true);
  });
});

describe("Worker verifyReceipt — pure v5", () => {
  test("v5 receipt verifies, fully_v5 true", async () => {
    const r = await buildPureV5Receipt();
    const c = await verifyReceipt(r);
    assert.equal(c.valid, true, "valid: " + JSON.stringify(c));
    assert.equal(c.fully_v5, true);
    assert.equal(c.a_v5_envelope, true);
    assert.equal(c.b_v5_envelope, true);
    assert.equal(c.hello_v5_envelope, true);
    assert.equal(c.a_binds_hello, true);
    assert.equal(c.b_binds_hello, true);
  });

  test("v5 receipt with bunhead.github.io origin verifies", async () => {
    const r = await buildPureV5Receipt({ helloOpts: { origin: "https://bunhead.github.io", rpId: "bunhead.github.io" } });
    const c = await verifyReceipt(r);
    assert.equal(c.hello_v5_envelope, true);
  });
});

describe("Worker verifyReceipt — hybrid v3+v5", () => {
  test("hybrid receipt verifies, fully_v5 false", async () => {
    const r = await buildHybridReceipt();
    const c = await verifyReceipt(r);
    assert.equal(c.valid, true, "valid: " + JSON.stringify(c));
    assert.equal(c.fully_v5, false);
    assert.equal(c.a_v5_envelope, true);
    assert.equal(c.b_v5_envelope, false);
    assert.equal(c.a_binds_hello, true);
    assert.equal(c.b_binds_hello, true);
  });
});

describe("Worker verifyReceipt — tampering detection", () => {
  test("mutated v5 a-side payload → invalid + v5_error", async () => {
    const r = await buildPureV5Receipt();
    r.a.payload = { ...r.a.payload, lat: 53.0 };
    const c = await verifyReceipt(r);
    assert.equal(c.valid, false);
    assert.equal(c.a_v5_envelope, false);
    assert.match(c.a_v5_error || "", /challenge/);
  });

  test("v5 with wrong origin → invalid", async () => {
    const r = await buildPureV5Receipt({ helloOpts: { origin: "https://evil.example" } });
    const c = await verifyReceipt(r);
    assert.equal(c.hello_v5_envelope, false);
    assert.match(c.hello_v5_error || "", /origin/);
  });

  test("v5 with UV flag cleared → invalid", async () => {
    const A = await genKp();
    const B = await genKp();
    const ts = Math.floor(Date.now() / 1000);
    const offerPayload = { v: 5, lat: 52.9225, lon: -1.4746, acc: 5, ts, nonce: 1 };
    const offerSig = await v5Sign(offerPayload, A.kp, { flags: 0x01 });
    const hello = { v: 5, type: "hello", pub: A.pub, offer: { payload: offerPayload, sig: offerSig.sig, webauthn: offerSig.webauthn } };
    const helloHash = b64urlEncode(new Uint8Array(await subtle.digest("SHA-256",
      new TextEncoder().encode(canonical(hello)))));
    const offerHash = await hashPayloadToB64url(offerPayload);
    const aPayload = { v: 5, helloHash, offerHash, lat: 52.9225, lon: -1.4746, acc: 5, ts: ts + 1, nonce: 2 };
    const aSig = await v5Sign(aPayload, A.kp);
    const bPayload = { v: 5, helloHash, offerHash, lat: 52.9225, lon: -1.4747, acc: 4, ts: ts + 2, nonce: 3 };
    const bSig = await v5Sign(bPayload, B.kp);
    const r = {
      v: 3, type: "combined", hello,
      a: { v: 5, type: "response", payload: aPayload, hash: await hashPayloadToB64url(aPayload), sig: aSig.sig, pub: A.pub, webauthn: aSig.webauthn },
      b: { v: 5, type: "response", payload: bPayload, hash: await hashPayloadToB64url(bPayload), sig: bSig.sig, pub: B.pub, webauthn: bSig.webauthn }
    };
    const c = await verifyReceipt(r);
    assert.equal(c.hello_v5_envelope, false);
    assert.match(c.hello_v5_error || "", /UV flag/);
  });

  test("v5 with v=5 declared but webauthn missing → invalid (falls to v3 verify which fails)", async () => {
    const r = await buildPureV5Receipt();
    delete r.a.webauthn;
    const c = await verifyReceipt(r);
    assert.equal(c.valid, false);
    assert.equal(c.a_v5_envelope, false);
    assert.equal(c.a_sig, false);
  });

  test("v3 receipt with mutated payload → hash mismatch detected", async () => {
    const r = await buildPureV3Receipt();
    r.a.payload = { ...r.a.payload, lat: 99.0 };
    const c = await verifyReceipt(r);
    assert.equal(c.valid, false);
    assert.equal(c.a_hash, false);
  });

  test("hello binding mismatch → a_binds_hello false", async () => {
    const r = await buildPureV5Receipt();
    r.a.payload = { ...r.a.payload, helloHash: "bogus" };
    const c = await verifyReceipt(r);
    assert.equal(c.valid, false);
  });

  test("hash mismatch alone → invalid even if sig is valid", async () => {
    const r = await buildPureV3Receipt();
    r.a.hash = "definitely-not-the-real-hash";
    const c = await verifyReceipt(r);
    assert.equal(c.a_hash, false);
    assert.equal(c.valid, false);
  });
});

describe("Worker verifyReceipt — distance + time", () => {
  test("distance > 12m → distance_ok false", async () => {
    const A = await genKp();
    const B = await genKp();
    const ts = Math.floor(Date.now() / 1000);
    const offerPayload = { v: 3, lat: 52.9225, lon: -1.4746, acc: 5, ts, nonce: 1 };
    const offerSig = await v3Sign(offerPayload, A.kp);
    const hello = { v: 3, type: "hello", pub: A.pub, offer: { payload: offerPayload, sig: offerSig.sig } };
    const helloHash = b64urlEncode(new Uint8Array(await subtle.digest("SHA-256",
      new TextEncoder().encode(canonical(hello)))));
    const offerHash = await hashPayloadToB64url(offerPayload);
    const aPayload = { v: 3, helloHash, offerHash, lat: 52.9225, lon: -1.4746, acc: 5, ts: ts + 1, nonce: 2 };
    const aSig = await v3Sign(aPayload, A.kp);
    const bPayload = { v: 3, helloHash, offerHash, lat: 52.9243, lon: -1.4746, acc: 4, ts: ts + 2, nonce: 3 };
    const bSig = await v3Sign(bPayload, B.kp);
    const r = { v: 3, type: "combined", hello,
      a: { v: 3, type: "response", payload: aPayload, hash: aSig.hash, sig: aSig.sig, pub: A.pub },
      b: { v: 3, type: "response", payload: bPayload, hash: bSig.hash, sig: bSig.sig, pub: B.pub } };
    const c = await verifyReceipt(r);
    assert.equal(c.distance_ok, false);
    assert.ok(c.distance_m > 12);
    assert.equal(c.valid, false);
  });
});

test("this file tests the Worker's own code, not a copy", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL(import.meta.url), "utf8");
  for (const name of ["verifyReceipt", "verifyV5Envelope"]) {
    assert.doesNotMatch(src, new RegExp("^async function " + name + "\\(", "m"), name + " is imported, not re-typed");
  }
});
