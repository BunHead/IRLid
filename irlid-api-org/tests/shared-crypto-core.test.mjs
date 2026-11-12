// Review 4.3 step 1: shared/crypto-core.js is the one copy of the crypto
// helpers both Workers need. The consumer Worker imports it. The org Worker
// still carries its own copy until step 2, so this test fails if the two
// ever differ (the drift that once left the org Worker with a non-recursive
// canonical()).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as shared from "../../shared/crypto-core.js";

const SHARED = ["b64urlEncode", "b64urlDecode", "canonical", "hashPayloadToB64url", "sha256B64url", "verifySig", "pubKeyId"];

function fnSource(src, name) {
  const re = new RegExp("(?:^|\\n)(?:export )?(async )?function " + name + "\\([\\s\\S]*?\\n}\\n");
  const m = src.match(re);
  return m ? m[0].replace(/^\n/, "").replace(/^export /, "").trim() : null;
}

function orgSources() {
  // After PR #181 the org copies live in src/crypto.js; before it, in index.js.
  let src = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  try { src += "\n" + readFileSync(new URL("../src/crypto.js", import.meta.url), "utf8"); } catch (_) {}
  return src;
}

test("shared/crypto-core.js exports every shared helper", () => {
  for (const n of SHARED) assert.equal(typeof shared[n], "function", n);
});

test("org Worker's own copies match shared/crypto-core.js exactly (no drift)", () => {
  const sharedSrc = readFileSync(new URL("../../shared/crypto-core.js", import.meta.url), "utf8");
  const org = orgSources();
  for (const n of SHARED) {
    const a = fnSource(sharedSrc, n);
    const b = fnSource(org, n);
    assert.ok(a, "shared source for " + n);
    assert.ok(b, "org source for " + n);
    assert.equal(b, a, n + " differs between the org Worker and shared/crypto-core.js");
  }
});

test("consumer Worker imports the shared module and keeps no copy of its own", () => {
  const src = readFileSync(new URL("../../irlid-api/src/index.js", import.meta.url), "utf8");
  assert.match(src, /from "\.\.\/\.\.\/shared\/crypto-core\.js"/);
  for (const n of SHARED) assert.equal(fnSource(src, n), null, "consumer still defines " + n);
});

test("deploy workflow redeploys the Workers when shared/ changes", () => {
  const yml = readFileSync(new URL("../../.github/workflows/deploy-worker.yml", import.meta.url), "utf8");
  assert.match(yml, /- 'shared\/\*\*'/);
});

test("canonical is recursive and order-independent", () => {
  assert.equal(shared.canonical({ b: { y: 1, x: [2, { d: 1, c: 0 }] }, a: null }), '{"a":null,"b":{"x":[2,{"c":0,"d":1}],"y":1}}');
});

test("b64url round-trips bytes and hashes are stable", async () => {
  const bytes = new Uint8Array([0, 251, 255, 62, 63, 10]);
  assert.deepEqual(shared.b64urlDecode(shared.b64urlEncode(bytes)), bytes);
  assert.equal(await shared.sha256B64url(""), "47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU");
  assert.equal(await shared.hashPayloadToB64url({ b: 1, a: 2 }), await shared.hashPayloadToB64url({ a: 2, b: 1 }));
});

test("verifySig accepts a real P-256 signature and rejects a tampered one", async () => {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = await crypto.subtle.exportKey("jwk", kp.publicKey);
  const mid = await shared.hashPayloadToB64url({ hello: "world", v: 3 });
  const sig = shared.b64urlEncode(new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, kp.privateKey, shared.b64urlDecode(mid))));
  assert.equal(await shared.verifySig(mid, sig, pub), true);
  const other = await shared.hashPayloadToB64url({ hello: "world!", v: 3 });
  assert.equal(await shared.verifySig(other, sig, pub), false);
  assert.equal((await shared.pubKeyId(pub)).length, 18);
});
