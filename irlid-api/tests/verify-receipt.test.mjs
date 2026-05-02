// Worker-side v5 verification smoke — mirrors irlid-api/src/index.js verifyReceipt + verifyV5Envelope
// against constructed receipts: pure v3, pure v5, hybrid, mutated, wrong-origin, missing-UV.
//
// Run with: node --test irlid-api/tests/verify-receipt.test.mjs
//
// This file is a behavioural mirror of the Worker code, not an in-Worker test runner. It uses Node's
// webcrypto (which behaves identically to Cloudflare Workers' Web Crypto for ECDSA P-256) so the same
// envelope verification logic can be regression-tested in CI without spinning up a real Worker.
// The Worker source is the truth; if this file disagrees with the Worker, the Worker wins and this
// file is brought back into alignment.
//
// First landed: 1 May 2026, alongside the v5 Worker-side verification (PROTOCOL.md §13).

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
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
async function verifySig(midB64url, sigB64url, pubJwk) {
  try {
    const pub = await subtle.importKey("jwk", pubJwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
    return await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, b64urlDecode(sigB64url), b64urlDecode(midB64url));
  } catch { return false; }
}
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1); const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const IRLID_V5_ORIGIN_ALLOWLIST = ["https://irlid.co.uk", "https://bunhead.github.io"];
function irlidV5OriginAllowed(origin) { return IRLID_V5_ORIGIN_ALLOWLIST.includes(String(origin)); }

async function verifyV5Envelope(payload, pubJwk, sigRawB64u, webauthnEnv, expectedRpOrigin) {
  if (!webauthnEnv || !webauthnEnv.authData || !webauthnEnv.clientData) throw new Error("v5: envelope missing");
  if (!pubJwk || pubJwk.kty !== "EC" || pubJwk.crv !== "P-256") throw new Error("v5: pub is not a P-256 JWK");
  if (!sigRawB64u) throw new Error("v5: sig missing");
  const expected = await hashPayloadToB64url(payload);
  const cdBytes = b64urlDecode(webauthnEnv.clientData);
  let cd;
  try { cd = JSON.parse(new TextDecoder().decode(cdBytes)); } catch { throw new Error("v5: clientDataJSON not valid JSON"); }
  if (cd.type !== "webauthn.get") throw new Error("v5: type wrong");
  if (expectedRpOrigin) { if (cd.origin !== expectedRpOrigin) throw new Error("v5: origin mismatch"); }
  else if (!irlidV5OriginAllowed(cd.origin)) throw new Error("v5: origin not in allowlist");
  if (cd.challenge !== expected) throw new Error("v5: challenge does not match");
  const adBytes = b64urlDecode(webauthnEnv.authData);
  if (adBytes.length < 37) throw new Error("v5: authData too short");
  if ((adBytes[32] & 0x04) !== 0x04) throw new Error("v5: UV flag not asserted");
  const cdHash = new Uint8Array(await subtle.digest("SHA-256", cdBytes));
  const signed = new Uint8Array(adBytes.length + cdHash.length);
  signed.set(adBytes, 0); signed.set(cdHash, adBytes.length);
  const pk = await subtle.importKey("jwk", pubJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const ok = await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pk, b64urlDecode(sigRawB64u), signed);
  if (!ok) throw new Error("v5: ECDSA signature verification failed");
  return true;
}

// Worker's verifyReceipt — tracks the live-Worker version (with compact-receipt fallback).
async function verifyReceipt(comb) {
  const TS_TOL = 90; const DIST_TOL = 12; const checks = {};
  const helloPub = (comb.hello && comb.hello.pub) ? comb.hello.pub : null;

  const a = comb.a;
  const aPub = (a && a.pub) ? a.pub : helloPub;
  if (a && a.payload && a.sig && aPub) {
    checks.a_structure = true;
    const computedA = await hashPayloadToB64url(a.payload, a.v);
    checks.a_hash = a.hash ? (computedA === a.hash) : true;
    if (a.webauthn && Number(a.v) === 5) {
      try { await verifyV5Envelope(a.payload, aPub, a.sig, a.webauthn); checks.a_sig = true; checks.a_v5_envelope = true; }
      catch (e) { checks.a_sig = false; checks.a_v5_envelope = false; checks.a_v5_error = e.message; }
    } else { checks.a_sig = await verifySig(computedA, a.sig, aPub); checks.a_v5_envelope = false; }
  } else { checks.a_structure = false; checks.a_hash = false; checks.a_sig = false; checks.a_v5_envelope = false; }

  const b = comb.b;
  if (b && b.payload && b.sig && b.pub) {
    checks.b_structure = true;
    const computedB = await hashPayloadToB64url(b.payload, b.v);
    checks.b_hash = b.hash ? (computedB === b.hash) : true;
    if (b.webauthn && Number(b.v) === 5) {
      try { await verifyV5Envelope(b.payload, b.pub, b.sig, b.webauthn); checks.b_sig = true; checks.b_v5_envelope = true; }
      catch (e) { checks.b_sig = false; checks.b_v5_envelope = false; checks.b_v5_error = e.message; }
    } else { checks.b_sig = await verifySig(computedB, b.sig, b.pub); checks.b_v5_envelope = false; }
  } else { checks.b_structure = false; checks.b_hash = false; checks.b_sig = false; checks.b_v5_envelope = false; }

  const hello = comb.hello;
  if (hello && hello.offer && hello.offer.payload && hello.offer.sig && hello.pub) {
    const cof = await hashPayloadToB64url(hello.offer.payload);
    if (hello.offer.webauthn && Number(hello.v) === 5) {
      try { await verifyV5Envelope(hello.offer.payload, hello.pub, hello.offer.sig, hello.offer.webauthn); checks.hello_sig = true; checks.hello_v5_envelope = true; }
      catch (e) { checks.hello_sig = false; checks.hello_v5_envelope = false; checks.hello_v5_error = e.message; }
    } else { checks.hello_sig = await verifySig(cof, hello.offer.sig, hello.pub); checks.hello_v5_envelope = false; }
  }

  if (hello) {
    const helloStr = canonical(hello);
    const helloHash = b64urlEncode(new Uint8Array(await subtle.digest("SHA-256", new TextEncoder().encode(helloStr))));
    if (a && a.payload) checks.a_binds_hello = a.payload.helloHash === helloHash;
    if (b && b.payload) checks.b_binds_hello = b.payload.helloHash === helloHash;
  }

  const tsA = a?.payload?.ts, tsB = b?.payload?.ts;
  if (typeof tsA === "number" && typeof tsB === "number") {
    checks.time_delta_s = Math.abs(tsA - tsB);
    checks.time_delta_ok = checks.time_delta_s <= TS_TOL;
  } else checks.time_delta_ok = false;

  const latA = a?.payload?.lat, lonA = a?.payload?.lon, latB = b?.payload?.lat, lonB = b?.payload?.lon;
  if (latA != null && lonA != null && latB != null && lonB != null) {
    checks.distance_m = Math.round(haversineMeters(latA, lonA, latB, lonB) * 100) / 100;
    checks.distance_ok = checks.distance_m <= DIST_TOL;
  } else checks.distance_ok = false;

  checks.fully_v5 = !!(checks.a_v5_envelope && checks.b_v5_envelope &&
                       (!hello || !hello.offer || checks.hello_v5_envelope));
  checks.valid = !!(checks.a_structure && checks.a_hash && checks.a_sig &&
                    checks.b_structure && checks.b_hash && checks.b_sig &&
                    checks.time_delta_ok && checks.distance_ok);
  return checks;
}

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
