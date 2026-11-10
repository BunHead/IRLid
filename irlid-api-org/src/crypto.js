// Encoding and signature primitives for the org Worker (review 4.2, step 1).
// Moved out of index.js unchanged on 10 Nov 2026: pure functions with no
// database, request or env access. index.js imports them, so behaviour is
// identical. Keep them byte-identical to js/sign.js where they mirror it.

export function b64urlEncode(bytes) {
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

export function b64urlJsonDecode(str) {
  return JSON.parse(new TextDecoder().decode(b64urlDecode(String(str || ""))));
}

export async function inflateRawB64urlJson(str) {
  if (typeof DecompressionStream !== "function") throw new Error("Compressed HELLO unsupported");
  const stream = new Blob([b64urlDecode(String(str || ""))]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return JSON.parse(await new Response(stream).text());
}

// v6.4.8 — FULLY RECURSIVE canonical, byte-identical to the client's canonical()
// in js/sign.js. The previous version sorted ONLY top-level keys then
// JSON.stringify'd, leaving nested objects in insertion order. Every signature
// in the system is computed over the client's recursive form, so any nested
// payload (the HELLO carries offer / offer.payload / pub) hashed differently
// on the Worker → accept_not_bound_to_hello in the Lead Admin co-presence
// check (Captain hit this 11 Jun). This is the same non-recursive-canonical
// trap the CONSUMER Worker was fixed for on 1 May 2026; the org Worker never
// got the upgrade because no org flow hashed a nested structure until the
// Lead Admin ceremony. Strictly corrective: flat payloads (per-action grants,
// gps {lat,lon}) produce identical output either way, so no path regresses.
export function canonical(val) {
  if (val === null || typeof val !== "object") return JSON.stringify(val);
  if (Array.isArray(val)) return "[" + val.map(canonical).join(",") + "]";
  const keys = Object.keys(val).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + canonical(val[k])).join(",") + "}";
}

export function deepCanonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(deepCanonical).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + deepCanonical(value[k])).join(",") + "}";
}

// ---- Hashes and ECDSA P-256 signatures ----

export async function hashPayloadToB64url(payloadObj, protocolV) {
  // v3+: canonical() — order-independent. v2 and below: JSON.stringify (backward compat).
  const v = (protocolV != null) ? Number(protocolV) : ((payloadObj && payloadObj.v) ? Number(payloadObj.v) : 3);
  const str = (v >= 3) ? canonical(payloadObj) : JSON.stringify(payloadObj);
  const bytes = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
  return b64urlEncode(new Uint8Array(hashBuf));
}

export async function sha256B64url(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return b64urlEncode(new Uint8Array(buf));
}

export async function sha256DeepB64url(value) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(deepCanonical(value)));
  return b64urlEncode(new Uint8Array(buf));
}

export async function verifySig(midB64url, sigB64url, pubJwk) {
  try {
    const pub = await crypto.subtle.importKey("jwk", pubJwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, b64urlDecode(sigB64url), b64urlDecode(midB64url));
  } catch { return false; }
}

export async function signCanonicalPayload(payloadObj, privateJwk) {
  const hash = await sha256B64url(deepCanonical(payloadObj));
  const key = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, b64urlDecode(hash));
  return b64urlEncode(new Uint8Array(sig));
}

export async function pubKeyId(pubJwk) {
  const s = `${pubJwk.kty}.${pubJwk.crv}.${pubJwk.x}.${pubJwk.y}`;
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return b64urlEncode(new Uint8Array(h)).slice(0, 18);
}

export async function deviceKeyFp(pubJwk) {
  if (!pubJwk) return null;
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(pubJwk)));
  return b64urlEncode(new Uint8Array(h)).slice(0, 16);
}
