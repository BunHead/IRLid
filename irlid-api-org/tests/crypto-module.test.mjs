// Review 4.2, step 1: the encoding / hash / signature primitives live in one
// module (src/crypto.js) and index.js uses that copy only.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as c from "../src/crypto.js";

const index = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const NAMES = ["b64urlEncode", "b64urlDecode", "b64urlJsonDecode", "inflateRawB64urlJson", "canonical", "deepCanonical",
  "hashPayloadToB64url", "sha256B64url", "sha256DeepB64url", "verifySig", "signCanonicalPayload", "pubKeyId", "deviceKeyFp"];

test("crypto.js exports every primitive and index.js no longer defines its own", () => {
  for (const n of NAMES) {
    assert.equal(typeof c[n], "function", n);
    assert.doesNotMatch(index, new RegExp("^(async )?function " + n + "\\(", "m"), n + " defined once");
  }
  assert.match(index, /from "\.\/crypto\.js";/);
});

test("canonical is recursive and key-order independent; b64url round-trips", () => {
  assert.equal(c.canonical({ b: { y: 1, x: [2, { d: 1, c: 0 }] }, a: null }), '{"a":null,"b":{"x":[2,{"c":0,"d":1}],"y":1}}');
  assert.equal(c.canonical({ b: 1, a: 2 }), c.deepCanonical({ a: 2, b: 1 }));
  const bytes = crypto.getRandomValues(new Uint8Array(33));
  assert.deepEqual(c.b64urlDecode(c.b64urlEncode(bytes)), bytes);
  assert.deepEqual(c.b64urlJsonDecode(c.b64urlEncode(new TextEncoder().encode('{"a":1}'))), { a: 1 });
});

test("a payload signed with signCanonicalPayload verifies with verifySig", async () => {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const prv = await crypto.subtle.exportKey("jwk", kp.privateKey);
  const pub = await crypto.subtle.exportKey("jwk", kp.publicKey);
  const payload = { org: "o", n: [1, 2], z: { b: 2, a: 1 } };
  const sig = await c.signCanonicalPayload(payload, prv);
  assert.equal(await c.verifySig(await c.sha256DeepB64url(payload), sig, pub), true);
  assert.equal(await c.verifySig(await c.sha256DeepB64url({ ...payload, org: "x" }), sig, pub), false);
  assert.equal((await c.deviceKeyFp(pub)).length, 16);
  assert.equal((await c.pubKeyId(pub)).length, 18);
  assert.equal(await c.deviceKeyFp(null), null);
});
