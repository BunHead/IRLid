/**
 * IRLid sign.js unit tests
 * Run with: node --test tests/sign.test.js
 *
 * Tests the pure and crypto functions in js/sign.js without a browser.
 * Node 18+ has Web Crypto, btoa/atob, TextEncoder — no npm install needed.
 */

import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { createHash } from "node:crypto";

// ─── Global browser stubs ────────────────────────────────────────────────────
// sign.js checks for window.crypto at load time — set it up before eval.

const localStorageStore = {};
const localStorageMock = {
  _store: localStorageStore,
  getItem(k)    { return Object.prototype.hasOwnProperty.call(this._store, k) ? this._store[k] : null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; },
  clear()       { for (const k of Object.keys(this._store)) delete this._store[k]; }
};

// Build a VM context that looks enough like a browser for sign.js to load.
const ctx = createContext({
  window:        { crypto: globalThis.crypto },
  crypto:        globalThis.crypto,
  localStorage:  localStorageMock,
  navigator:     { geolocation: null, credentials: null },
  location:      { hostname: "localhost" },
  btoa:          globalThis.btoa,
  atob:          globalThis.atob,
  TextEncoder,
  TextDecoder,
  Uint8Array,
  Uint32Array,
  ArrayBuffer,
  Object,
  Array,
  JSON,
  Math,
  Number,
  String,
  Boolean,
  Promise,
  Error,
  console,
  // CompressionStream / DecompressionStream not needed for these unit tests
  CompressionStream:   undefined,
  DecompressionStream: undefined,
});

// Load sign.js once into the VM context
const signSrc = readFileSync(new URL("../js/sign.js", import.meta.url), "utf8");
runInContext(signSrc, ctx);

// Pull functions out of the VM context for convenience
const {
  b64urlEncode,
  b64urlDecode,
  canonical,
  sha256Hex,
  sha256Bytes,
  compactJwk,
  roundGps,
  irlidHaversineMeters,
  hashPayloadToB64url,
  irlidStripCombinedForEncoding,
  irlidMakeRedactedReceipt,
  irlidV4TrustScore,
  irlidTrustHistoryAppend,
  irlidTrustHistoryGet,
  pubKeyId,
  getPublicJwk,
  ensureKeys,
} = ctx;

// ─── b64url encoding ─────────────────────────────────────────────────────────

describe("b64urlEncode / b64urlDecode", () => {
  test("round-trips arbitrary bytes", () => {
    const original = new Uint8Array([0, 1, 127, 128, 255]);
    const encoded  = b64urlEncode(original);
    const decoded  = b64urlDecode(encoded);
    assert.deepEqual(decoded, original);
  });

  test("produces URL-safe chars (no +, /, or trailing =)", () => {
    // Generate bytes that would normally produce +/= in standard base64
    for (let i = 0; i < 256; i++) {
      const enc = b64urlEncode(new Uint8Array([i, i + 1, i + 2]));
      assert.ok(!enc.includes("+"), `+ found for byte ${i}`);
      assert.ok(!enc.includes("/"), `/ found for byte ${i}`);
      assert.ok(!enc.includes("="), `= found for byte ${i}`);
    }
  });

  test("round-trips empty array", () => {
    const enc = b64urlEncode(new Uint8Array([]));
    const dec = b64urlDecode(enc);
    assert.deepEqual(dec, new Uint8Array([]));
  });
});

// ─── canonical() ─────────────────────────────────────────────────────────────

describe("canonical()", () => {
  test("sorts object keys alphabetically", () => {
    const obj = { z: 1, a: 2, m: 3 };
    assert.equal(canonical(obj), '{"a":2,"m":3,"z":1}');
  });

  test("sorts keys recursively in nested objects", () => {
    const obj = { outer: { z: 1, a: 2 }, b: 0 };
    assert.equal(canonical(obj), '{"b":0,"outer":{"a":2,"z":1}}');
  });

  test("preserves array order", () => {
    const obj = { arr: [3, 1, 2] };
    assert.equal(canonical(obj), '{"arr":[3,1,2]}');
  });

  test("handles null values", () => {
    assert.equal(canonical(null), "null");
  });

  test("handles string primitives", () => {
    assert.equal(canonical("hello"), '"hello"');
  });

  test("handles numbers", () => {
    assert.equal(canonical(42), "42");
  });

  test("produces same output regardless of key insertion order", () => {
    const a = { lat: 53.1, lon: -1.5, ts: 1000, nonce: 42 };
    const b = { nonce: 42, ts: 1000, lon: -1.5, lat: 53.1 };
    assert.equal(canonical(a), canonical(b));
  });

  test("nested arrays of objects are sorted within each object", () => {
    const obj = { items: [{ z: 1, a: 2 }, { m: 3, b: 4 }] };
    assert.equal(canonical(obj), '{"items":[{"a":2,"z":1},{"b":4,"m":3}]}');
  });
});

// ─── sha256Hex() ─────────────────────────────────────────────────────────────

describe("sha256Hex()", () => {
  test("known vector: empty string", async () => {
    const hex = await sha256Hex("");
    assert.equal(hex, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  test("matches Node native crypto for 'abc'", async () => {
    // Cross-check Web Crypto against Node's native SHA-256 — if these agree, the function is correct.
    const expected = createHash("sha256").update("abc").digest("hex");
    const actual   = await sha256Hex("abc");
    assert.equal(actual, expected);
  });

  test("returns 64 hex chars", async () => {
    const hex = await sha256Hex("IRLid");
    assert.equal(hex.length, 64);
    assert.match(hex, /^[0-9a-f]+$/);
  });

  test("same input always produces same output", async () => {
    const a = await sha256Hex("test");
    const b = await sha256Hex("test");
    assert.equal(a, b);
  });

  test("different inputs produce different hashes", async () => {
    const a = await sha256Hex("hello");
    const b = await sha256Hex("world");
    assert.notEqual(a, b);
  });
});

// ─── compactJwk() ────────────────────────────────────────────────────────────

describe("compactJwk()", () => {
  test("strips key_ops and ext, keeps kty/crv/x/y", () => {
    const full = {
      kty: "EC", crv: "P-256",
      x: "abc", y: "def",
      key_ops: ["verify"], ext: true
    };
    const compact = compactJwk(full);
    // Use JSON comparison to avoid VM cross-realm deepEqual issues
    assert.equal(JSON.stringify(compact), JSON.stringify({ kty: "EC", crv: "P-256", x: "abc", y: "def" }));
    assert.equal(compact.key_ops, undefined);
    assert.equal(compact.ext,     undefined);
  });

  test("passes through null/undefined safely", () => {
    assert.equal(compactJwk(null), null);
    assert.equal(compactJwk(undefined), undefined);
  });

  test("leaves already-compact JWK unchanged", () => {
    const jwk = { kty: "EC", crv: "P-256", x: "abc", y: "def" };
    const result = compactJwk(jwk);
    assert.equal(result.kty, jwk.kty);
    assert.equal(result.crv, jwk.crv);
    assert.equal(result.x,   jwk.x);
    assert.equal(result.y,   jwk.y);
  });
});

// ─── roundGps() ──────────────────────────────────────────────────────────────

describe("roundGps()", () => {
  test("rounds to 5 decimal places", () => {
    assert.equal(roundGps(53.123456789), 53.12346);
  });

  test("preserves values already at 5dp", () => {
    assert.equal(roundGps(53.12345), 53.12345);
  });

  test("handles negative coordinates", () => {
    assert.equal(roundGps(-1.987654321), -1.98765);
  });

  test("handles zero", () => {
    assert.equal(roundGps(0), 0);
  });
});

// ─── irlidHaversineMeters() ──────────────────────────────────────────────────

describe("irlidHaversineMeters()", () => {
  test("returns 0 for identical coordinates", () => {
    const p = { lat: 52.9, lon: -1.4 };
    assert.equal(irlidHaversineMeters(p, p), 0);
  });

  test("Derby to Nottingham is roughly 22km", () => {
    // Derby city centre → Nottingham city centre
    const derby      = { lat: 52.9225, lon: -1.4746 };
    const nottingham = { lat: 52.9540, lon: -1.1581 };
    const d = irlidHaversineMeters(derby, nottingham);
    assert.ok(d > 20000 && d < 24000, `Expected ~22km, got ${Math.round(d)}m`);
  });

  test("1.11m test case matches the live production scan", () => {
    // Spencer's real-world 94% receipt: 1.11m between Brain and Fuzzy Babe 69
    // Use two points ~1.11m apart at same latitude
    // 1 degree longitude at 52.9° ≈ 66,730m → 1.11m ≈ 0.0000166°
    const a = { lat: 52.92250, lon: -1.47460 };
    const b = { lat: 52.92250, lon: -1.47458 }; // ~1.33m apart
    const d = irlidHaversineMeters(a, b);
    assert.ok(d < 12, `Should be within 12m tolerance, got ${d.toFixed(2)}m`);
  });

  test("12m tolerance boundary — just inside", () => {
    // ~11.9m apart at Derby latitude
    const a = { lat: 52.92250, lon: -1.47460 };
    const b = { lat: 52.92251, lon: -1.47460 }; // ~11.1m
    const d = irlidHaversineMeters(a, b);
    assert.ok(d < 12, `Expected <12m, got ${d.toFixed(2)}m`);
  });

  test("12m tolerance boundary — just outside", () => {
    // ~13m apart
    const a = { lat: 52.92250, lon: -1.47460 };
    const b = { lat: 52.92262, lon: -1.47460 }; // ~13.3m
    const d = irlidHaversineMeters(a, b);
    assert.ok(d > 12, `Expected >12m, got ${d.toFixed(2)}m`);
  });

  test("antipodal points are roughly 20,000km", () => {
    const a = { lat: 0, lon: 0 };
    const b = { lat: 0, lon: 180 };
    const d = irlidHaversineMeters(a, b);
    assert.ok(d > 19_900_000 && d < 20_100_000, `Expected ~20,000km, got ${Math.round(d / 1000)}km`);
  });
});

// ─── hashPayloadToB64url() ───────────────────────────────────────────────────

describe("hashPayloadToB64url()", () => {
  test("v3: same result regardless of key insertion order", async () => {
    const a = { v: 3, lat: 53.1, lon: -1.5, ts: 1000, nonce: 42 };
    const b = { nonce: 42, ts: 1000, lon: -1.5, lat: 53.1, v: 3 };
    const ha = await hashPayloadToB64url(a);
    const hb = await hashPayloadToB64url(b);
    assert.equal(ha, hb);
  });

  test("v2: key order matters (JSON.stringify — backward compat)", async () => {
    const a = { v: 2, z: 1, a: 2 };
    const b = { v: 2, a: 2, z: 1 };
    const ha = await hashPayloadToB64url(a);
    const hb = await hashPayloadToB64url(b);
    // With JSON.stringify these will differ because key order is preserved
    assert.notEqual(ha, hb);
  });

  test("returns a non-empty b64url string", async () => {
    const h = await hashPayloadToB64url({ v: 3, foo: "bar" });
    assert.ok(h.length > 0);
    assert.ok(!h.includes("="));
    assert.ok(!h.includes("+"));
    assert.ok(!h.includes("/"));
  });

  test("different payloads produce different hashes", async () => {
    const ha = await hashPayloadToB64url({ v: 3, ts: 1000 });
    const hb = await hashPayloadToB64url({ v: 3, ts: 1001 });
    assert.notEqual(ha, hb);
  });
});

// ─── irlidStripCombinedForEncoding() ─────────────────────────────────────────

describe("irlidStripCombinedForEncoding()", () => {
  test("removes a.hash, a.pub, and b.hash", () => {
    const combined = {
      v: 3,
      type: "combined",
      hello: { type: "hello", pub: { kty: "EC" } },
      a: { payload: { ts: 1 }, hash: "hashA", pub: { kty: "EC" }, sig: "sigA" },
      b: { payload: { ts: 2 }, hash: "hashB", pub: { kty: "EC" }, sig: "sigB" }
    };
    const stripped = irlidStripCombinedForEncoding(combined);
    assert.equal(stripped.a.hash, undefined);
    assert.equal(stripped.a.pub,  undefined);
    assert.equal(stripped.b.hash, undefined);
    // b.pub should still be present
    assert.ok(stripped.b.pub);
    // Originals should be unmodified
    assert.ok(combined.a.hash);
    assert.ok(combined.a.pub);
  });

  test("handles null gracefully", () => {
    assert.equal(irlidStripCombinedForEncoding(null), null);
  });

  test("preserves other fields", () => {
    const combined = {
      v: 3, type: "combined",
      hello: { type: "hello" },
      a: { payload: { ts: 1 }, hash: "x", sig: "sigA" },
      b: { payload: { ts: 2 }, hash: "y", pub: { kty: "EC" }, sig: "sigB" }
    };
    const stripped = irlidStripCombinedForEncoding(combined);
    assert.equal(stripped.v, 3);
    assert.equal(stripped.type, "combined");
    assert.equal(stripped.a.sig, "sigA");
    assert.equal(stripped.b.sig, "sigB");
  });
});

// ─── irlidMakeRedactedReceipt() ──────────────────────────────────────────────

describe("irlidMakeRedactedReceipt()", () => {
  const makeCombined = () => ({
    v: 3,
    type: "combined",
    hello: {
      type: "hello",
      pub: { kty: "EC", crv: "P-256", x: "x1", y: "y1" },
      offer: {
        payload: { v: 3, lat: 52.9225, lon: -1.4746, acc: 5, ts: 1000, nonce: 1 },
        sig: "offerSig"
      }
    },
    a: {
      payload: { v: 3, lat: 52.9225, lon: -1.4746, acc: 5, ts: 1001, nonce: 2 },
      hash: "hashA", sig: "sigA",
      pub:  { kty: "EC", crv: "P-256", x: "x1", y: "y1" }
    },
    b: {
      payload: { v: 3, lat: 52.9225, lon: -1.4746, acc: 4, ts: 1002, nonce: 3 },
      hash: "hashB", sig: "sigB",
      pub:  { kty: "EC", crv: "P-256", x: "x2", y: "y2" }
    }
  });

  test("removes lat/lon/acc from both sides", async () => {
    const r = await irlidMakeRedactedReceipt(makeCombined());
    assert.equal(r.a.payload.lat, undefined);
    assert.equal(r.a.payload.lon, undefined);
    assert.equal(r.a.payload.acc, undefined);
    assert.equal(r.b.payload.lat, undefined);
    assert.equal(r.b.payload.lon, undefined);
    assert.equal(r.b.payload.acc, undefined);
  });

  test("replaces GPS with gps_hash on both sides", async () => {
    const r = await irlidMakeRedactedReceipt(makeCombined());
    assert.ok(typeof r.a.payload.gps_hash === "string" && r.a.payload.gps_hash.length === 64);
    assert.ok(typeof r.b.payload.gps_hash === "string" && r.b.payload.gps_hash.length === 64);
  });

  test("removes GPS from hello.offer.payload too", async () => {
    const r = await irlidMakeRedactedReceipt(makeCombined());
    assert.equal(r.hello.offer.payload.lat, undefined);
    assert.equal(r.hello.offer.payload.lon, undefined);
  });

  test("sets redacted:true and _privacy_note", async () => {
    const r = await irlidMakeRedactedReceipt(makeCombined());
    assert.equal(r.redacted, true);
    assert.ok(typeof r._privacy_note === "string" && r._privacy_note.length > 0);
    assert.ok(Number.isFinite(r.redacted_at));
  });

  test("does not mutate the original combined receipt", async () => {
    const orig = makeCombined();
    await irlidMakeRedactedReceipt(orig);
    assert.ok(Number.isFinite(orig.a.payload.lat), "Original a.lat should be intact");
    assert.ok(Number.isFinite(orig.b.payload.lat), "Original b.lat should be intact");
  });

  test("gps_hash is deterministic — same coordinates produce same hash", async () => {
    const r1 = await irlidMakeRedactedReceipt(makeCombined());
    const r2 = await irlidMakeRedactedReceipt(makeCombined());
    assert.equal(r1.a.payload.gps_hash, r2.a.payload.gps_hash);
  });

  test("gps_hash changes when coordinates change", async () => {
    const c1 = makeCombined();
    const c2 = makeCombined();
    c2.a.payload.lat = 51.5074; // London, not Derby
    const r1 = await irlidMakeRedactedReceipt(c1);
    const r2 = await irlidMakeRedactedReceipt(c2);
    assert.notEqual(r1.a.payload.gps_hash, r2.a.payload.gps_hash);
  });
});

// ─── Trust history + v4 scoring ──────────────────────────────────────────────

describe("Trust history & v4TrustScore()", () => {
  before(() => localStorageMock.clear());

  test("empty history → zero scores", async () => {
    localStorageMock.clear();
    const s = await irlidV4TrustScore();
    assert.equal(s.receiptCount, 0);
    assert.equal(s.receiptDepthPts, 0);
    assert.equal(s.locationDiversityPts, 0);
    assert.equal(s.deviceConsistencyPts, 0);
  });

  test("1 receipt → receiptDepthPts = 1", async () => {
    localStorageMock.clear();
    irlidTrustHistoryAppend({ ts: Date.now(), keyId: "key1", lat: 52.9225, lon: -1.4746 });
    const s = await irlidV4TrustScore();
    assert.equal(s.receiptDepthPts, 1);
  });

  test("5+ receipts → receiptDepthPts = 2", async () => {
    localStorageMock.clear();
    for (let i = 0; i < 5; i++) {
      irlidTrustHistoryAppend({ ts: Date.now(), keyId: "key1", lat: 52.9225, lon: -1.4746 });
    }
    const s = await irlidV4TrustScore();
    assert.equal(s.receiptDepthPts, 2);
  });

  test("same location all entries → locationDiversityPts = 0", async () => {
    localStorageMock.clear();
    for (let i = 0; i < 3; i++) {
      irlidTrustHistoryAppend({ ts: Date.now(), keyId: "key1", lat: 52.9225, lon: -1.4746 });
    }
    const s = await irlidV4TrustScore();
    assert.equal(s.locationDiversityPts, 0);
  });

  test("entries >1km apart → locationDiversityPts = 2", async () => {
    localStorageMock.clear();
    // Derby and Nottingham are ~22km apart
    irlidTrustHistoryAppend({ ts: Date.now(), keyId: "key1", lat: 52.9225, lon: -1.4746 }); // Derby
    irlidTrustHistoryAppend({ ts: Date.now(), keyId: "key1", lat: 52.9540, lon: -1.1581 }); // Nottingham
    const s = await irlidV4TrustScore();
    assert.equal(s.locationDiversityPts, 2);
  });

  test("entries on 2+ different days → deviceConsistencyPts = 2", async () => {
    localStorageMock.clear();
    const day1 = new Date("2026-04-17").getTime();
    const day2 = new Date("2026-04-18").getTime();
    irlidTrustHistoryAppend({ ts: day1, keyId: "key1" });
    irlidTrustHistoryAppend({ ts: day2, keyId: "key1" });
    const s = await irlidV4TrustScore();
    assert.equal(s.deviceConsistencyPts, 2);
  });

  test("both entries same day → deviceConsistencyPts = 1", async () => {
    localStorageMock.clear();
    const sameDay = new Date("2026-04-17").getTime();
    irlidTrustHistoryAppend({ ts: sameDay,       keyId: "key1" });
    irlidTrustHistoryAppend({ ts: sameDay + 3600, keyId: "key1" });
    const s = await irlidV4TrustScore();
    assert.equal(s.deviceConsistencyPts, 1);
  });

  test("irlidTrustHistoryGet round-trips stored entries", () => {
    localStorageMock.clear();
    const entry = { ts: 1713388800000, keyId: "testkey", lat: 52.9225, lon: -1.4746 };
    irlidTrustHistoryAppend(entry);
    const history = irlidTrustHistoryGet();
    assert.equal(history.length, 1);
    assert.deepEqual(history[0], entry);
  });
});

// ─── ECDSA key generation + sign/verify round-trip ───────────────────────────

describe("ECDSA sign/verify round-trip", () => {
  before(() => localStorageMock.clear());

  test("ensureKeys() creates keys in localStorage", async () => {
    localStorageMock.clear();
    await ensureKeys();
    assert.ok(localStorageMock.getItem("irlid_priv_jwk"), "private key missing");
    assert.ok(localStorageMock.getItem("irlid_pub_jwk"),  "public key missing");
  });

  test("getPublicJwk() returns a valid EC P-256 JWK", async () => {
    const pub = await getPublicJwk();
    assert.equal(pub.kty, "EC");
    assert.equal(pub.crv, "P-256");
    assert.ok(pub.x && pub.y, "x and y coords missing");
  });

  test("hashPayloadToB64url → sign → verify round-trip", async () => {
    const payload = { v: 3, lat: 52.9225, lon: -1.4746, ts: Math.floor(Date.now() / 1000), nonce: 99 };

    // Hash it
    const hash = await hashPayloadToB64url(payload);
    assert.ok(hash.length > 0);

    // Sign it (uses private key from localStorage)
    const { signHashB64url, verifySig, getPublicJwk: getPub } = ctx;
    const sig = await signHashB64url(hash);
    assert.ok(sig.length > 0);

    // Verify it
    const pub = await getPub();
    const ok  = await verifySig(hash, sig, pub);
    assert.equal(ok, true);
  });

  test("tampered hash fails verification", async () => {
    const payload = { v: 3, ts: 12345, nonce: 77 };
    const hash    = await hashPayloadToB64url(payload);
    const { signHashB64url, verifySig, getPublicJwk: getPub, b64urlEncode: enc } = ctx;
    const sig     = await signHashB64url(hash);
    const pub     = await getPub();

    // Flip one byte in the hash
    const { b64urlDecode: dec } = ctx;
    const hashBytes   = dec(hash);
    hashBytes[0]     ^= 0xFF;
    const badHash     = enc(hashBytes);

    const ok = await verifySig(badHash, sig, pub);
    assert.equal(ok, false);
  });

  test("pubKeyId() returns 18-char b64url string", async () => {
    const pub = await getPublicJwk();
    const id  = await pubKeyId(pub);
    assert.equal(id.length, 18);
    assert.ok(!id.includes("=") && !id.includes("+") && !id.includes("/"));
  });
});
