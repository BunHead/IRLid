// Copyright 2025 Spencer Austin. All rights reserved.
// Licensed under Apache 2.0 with Commons Clause. See LICENSE.
// IRLid signing (ECDSA P-256) - requires WebCrypto (secure context)
//  Deploy 76 — compact payloads for smaller QR codes

(function () {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error(
      "Secure crypto unavailable.\n\n" +
      "This feature requires WebCrypto, which is usually only available on HTTPS or localhost.\n\n" +
      "Fix:\n" +
      "• Use GitHub Pages (HTTPS) OR\n" +
      "• Test on localhost OR\n" +
      "• (Dev only) enable Chrome flag: Insecure origins treated as secure for this URL."
    );
  }
})();

function b64urlEncode(bytes) {
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

// v3: Fully recursive canonical JSON serialiser.
// Sorts object keys at every level of nesting so hashes are independent
// of property insertion order. Arrays preserve their order.
function canonical(val) {
  if (val === null || typeof val !== "object") return JSON.stringify(val);
  if (Array.isArray(val)) return "[" + val.map(canonical).join(",") + "]";
  const keys = Object.keys(val).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + canonical(val[k])).join(",") + "}";
}

async function sha256Bytes(str) {
  const enc = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return new Uint8Array(hash);
}

async function sha256Hex(str) {
  const bytes = await sha256Bytes(str);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function ensureKeys() {
  if (localStorage.getItem("irlid_priv_jwk") && localStorage.getItem("irlid_pub_jwk")) return;

  const kp = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );

  const privJwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  const pubJwk  = await crypto.subtle.exportKey("jwk", kp.publicKey);

  localStorage.setItem("irlid_priv_jwk", JSON.stringify(privJwk));
  localStorage.setItem("irlid_pub_jwk", JSON.stringify(pubJwk));
}

async function getPublicJwk() {
  await ensureKeys();
  return JSON.parse(localStorage.getItem("irlid_pub_jwk"));
}

async function getPrivateKey() {
  await ensureKeys();
  const privJwk = JSON.parse(localStorage.getItem("irlid_priv_jwk"));
  return crypto.subtle.importKey(
    "jwk",
    privJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

async function importPublicKey(pubJwk) {
  return crypto.subtle.importKey(
    "jwk",
    pubJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"]
  );
}

async function verifySig(midB64url, sigB64url, pubJwk) {
  const pub = await importPublicKey(pubJwk);
  const midBytes = b64urlDecode(midB64url);
  const sigBytes = b64urlDecode(sigB64url);

  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    pub,
    sigBytes,
    midBytes
  );
}

async function pubKeyId(pubJwk) {
  const s = `${pubJwk.kty}.${pubJwk.crv}.${pubJwk.x}.${pubJwk.y}`;
  const h = await sha256Bytes(s);
  return b64urlEncode(h).slice(0, 18);
}

// Strip WebCrypto metadata (key_ops, ext) not needed for import/verify.
// Saves ~25 chars per key in QR data.
function compactJwk(jwk) {
  if (!jwk || !jwk.kty) return jwk;
  return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
}

// Round GPS to 5 decimal places (~1.1 m precision — well within 12 m tolerance).
function roundGps(n) {
  return Math.round(n * 1e5) / 1e5;
}

/* =========================================================
   Added helpers for mutual validation / consistent signing
   (No backend; used by scan.html and receipt.html)
   ========================================================= */

async function hashPayloadToB64url(payloadObj, protocolV) {
  // v3+: canonical() — order-independent. v2 and below: JSON.stringify (backward compat).
  const v = (protocolV != null) ? Number(protocolV) : ((payloadObj && payloadObj.v) ? Number(payloadObj.v) : 3);
  const str = (v >= 3) ? canonical(payloadObj) : JSON.stringify(payloadObj);
  const payloadBytes = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest("SHA-256", payloadBytes);
  return b64urlEncode(new Uint8Array(hashBuf));
}

async function signHashB64url(hashB64url) {
  // Signs the hash bytes directly
  // Uses ECDSA P-256 with SHA-256.
  const priv = await getPrivateKey();
  const hashBytes = b64urlDecode(hashB64url);

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    priv,
    hashBytes
  );

  return b64urlEncode(new Uint8Array(sig));
}

/* =========================================================
   IRLid handshake helpers (static, no backend)
   - Encode/decode b64url JSON
   - Create signed "response" object for a given HELLO
   - Validate a scanned response against HELLO + optional self response
   ========================================================= */

function irlidEncodeJsonToB64url(obj){
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  return b64urlEncode(bytes);
}

function irlidDecodeB64urlJson(b64url){
  const bytes = b64urlDecode(String(b64url || ""));
  const txt = new TextDecoder().decode(bytes);
  return JSON.parse(txt);
}

// Deploy 76: deflate compression for smaller QR codes.
// Uses browser-native CompressionStream (Chrome 80+, Safari 16.4+, Firefox 113+).

function irlidHasCompression() {
  return typeof CompressionStream === "function" && typeof DecompressionStream === "function";
}

async function irlidCompressToB64url(obj) {
  const json = JSON.stringify(obj);
  const input = new TextEncoder().encode(json);
  const cs = new CompressionStream("deflate-raw");
  const writer = cs.writable.getWriter();
  const reader = cs.readable.getReader();
  writer.write(input);
  writer.close();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return b64urlEncode(out);
}

async function irlidDecompressFromB64url(b64url) {
  const compressed = b64urlDecode(String(b64url || ""));
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  writer.write(compressed);
  writer.close();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return JSON.parse(new TextDecoder().decode(out));
}

async function irlidHelloHashB64url(helloObj, protocolV){
  // v3+: canonical(). v2 and below: JSON.stringify (backward compat for old receipts).
  const v = (protocolV != null) ? Number(protocolV) : ((helloObj && helloObj.v) ? Number(helloObj.v) : 3);
  const str = (v >= 3) ? canonical(helloObj) : JSON.stringify(helloObj);
  const bytes = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
  return b64urlEncode(new Uint8Array(hashBuf));
}

function irlidHaversineMeters(a, b){
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const lat1 = toRad(a.lat), lon1 = toRad(a.lon);
  const lat2 = toRad(b.lat), lon2 = toRad(b.lon);
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const s =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
  return R * c;
}

function irlidGetPosition(opts){
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      const e = new Error(
        "Location services are not available in this browser.\n\n" +
        "IRLid requires GPS to create a verifiable proof of meeting. " +
        "Please use a supported browser (Safari on iOS 16+, Chrome on Android) with location enabled."
      );
      e.irlidGeoError = true;
      reject(e);
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (posErr) => {
      // posErr.code: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
      let msg;
      if (posErr.code === 1) {
        msg =
          "Location permission denied.\n\n" +
          "IRLid requires your location to create a verifiable proof of meeting.\n\n" +
          "\u2022 iPhone: Settings \u2192 Privacy & Security \u2192 Location Services \u2192 Safari \u2192 While Using\n" +
          "\u2022 Android: tap the lock icon in the browser address bar \u2192 Location \u2192 Allow";
      } else if (posErr.code === 2) {
        msg =
          "Location signal unavailable.\n\n" +
          "IRLid needs a GPS fix to continue. Try moving to an area with better signal, or ensure " +
          "Location Services are enabled on your device.";
      } else {
        msg =
          "Location request timed out.\n\n" +
          "IRLid could not get a GPS fix in time. Make sure Location Services are enabled and try again.";
      }
      const e = new Error(msg);
      e.irlidGeoError = true;
      e.geoCode = posErr.code;
      reject(e);
    }, opts);
  });
}


async function makeSignedHelloAsync(opts){
  // Creates a HELLO object that already contains a signed, replay-resistant "offer"
  // so the other party can verify you immediately (2-scan handshake).
  // Deploy 76: compact format — stripped JWK, no redundant top-level nonce/ts,
  // no type/v in offer payload, GPS rounded to 5dp.
  const pos = await irlidGetPosition({
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 12000
  });

  const lat = roundGps(Number(pos.coords.latitude));
  const lon = roundGps(Number(pos.coords.longitude));
  const acc = Math.round(Number(pos.coords.accuracy || 0));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("Invalid geolocation coordinates.");
  }

  // v4: GPS accuracy floor (Settings → irlid_gps_acc_floor_m, 0 = any)
  try {
    const floor = Number(localStorage.getItem("irlid_gps_acc_floor_m") || 0);
    if (floor > 0 && Number.isFinite(acc) && acc > floor) {
      throw new Error(
        "GPS accuracy too low (" + acc + " m). " +
        "Your Settings require ≤ " + floor + " m. " +
        "Try moving outdoors or adjusting the accuracy floor in Settings."
      );
    }
  } catch(e) { if (e.message && e.message.startsWith("GPS accuracy")) throw e; }

  const ts = Math.floor(Date.now() / 1000);
  const nonceA = crypto.getRandomValues(new Uint32Array(1))[0];

  // Optional bio-metric gate for the initiator (same as responder — Settings only).
  let bioVerified = false;
  if (irlidBiometricEnabled()) {
    try { bioVerified = await irlidBiometricVerify(); } catch { bioVerified = false; }
  }

  // Offer payload: v=3 inside signature ensures cross-version mixing is detectable.
  const offerPayload = {
    v: 3,
    lat,
    lon,
    acc,
    ts,
    nonce: nonceA
  };
  if (bioVerified) offerPayload.bioVerified = true;

  const pub = await getPublicJwk();
  const offerHash = await hashPayloadToB64url(offerPayload);
  const offerSig = await signHashB64url(offerHash);

  // v3: offer.hash removed from HELLO — verifier recomputes it from offer.payload.
  // Saves ~88 chars. hash still used to sign (offerSig), just not transmitted.
  // JWK stripped of ext/key_ops (saves ~25 chars).
  const hello = {
    v: 3,
    type: "hello",
    pub: compactJwk(pub),
    offer: {
      payload: offerPayload,
      sig: offerSig
    }
  };

  return hello;
}

async function verifyHelloOfferAsync(helloObj, opts){
  const tsTolS = (opts && Number.isFinite(opts.tsTolS)) ? opts.tsTolS : 90;

  if (!helloObj || helloObj.type !== "hello") throw new Error("Invalid HELLO.");
  if (!helloObj.pub) throw new Error("Invalid HELLO (missing pub).");

  // Back-compat: unsigned HELLO v1
  if (!helloObj.offer) return { ok: true, mode: "unsigned-v1", offerHash: null };

  const offer = helloObj.offer;
  if (!offer || !offer.payload || !offer.sig) {
    throw new Error("Invalid HELLO (bad offer structure).");
  }

  // v3: offer.hash not stored in HELLO — always recompute from offer.payload.
  // Back-compat: if offer.hash is present (v2), verify it matches the computed value.
  const computed = await hashPayloadToB64url(offer.payload);
  if (offer.hash && computed !== offer.hash) throw new Error("HELLO offer hash mismatch.");

  const sigOk = await verifySig(computed, offer.sig, helloObj.pub);
  if (!sigOk) throw new Error("HELLO offer signature invalid.");

  const now = Math.floor(Date.now() / 1000);
  const ts = Number(offer.payload.ts);
  if (!Number.isFinite(ts)) throw new Error("HELLO offer timestamp missing.");
  if (ts > now + 5) throw new Error("HELLO offer timestamp is in the future (" + (ts - now) + "s ahead).");
  const dt = Math.abs(now - ts);
  if (dt > tsTolS) throw new Error("HELLO offer timestamp outside tolerance (" + dt + "s > " + tsTolS + "s).");

  // Always return the computed hash so response builder can bind to it,
  // regardless of whether offer.hash was transmitted.
  return { ok: true, mode: "signed-v3", offerHash: computed };
}


async function makeReturnForHelloAsync(helloB64url, opts){
  if (!helloB64url) throw new Error("HELLO missing.");

  const tsTolS = (opts && Number.isFinite(opts.tsTolS)) ? opts.tsTolS : 90;

  const helloObj = irlidDecodeB64urlJson(helloB64url);
  if (!helloObj || helloObj.type !== "hello" || !helloObj.pub) {
    throw new Error("Invalid HELLO (bad structure).");
  }

  // If this HELLO contains a signed offer, verify it before proceeding.
  const offerInfo = await verifyHelloOfferAsync(helloObj, { tsTolS });

  const helloHash = await irlidHelloHashB64url(helloObj);

  const pos = await irlidGetPosition({
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 12000
  });

  const lat = roundGps(Number(pos.coords.latitude));
  const lon = roundGps(Number(pos.coords.longitude));
  const acc = Math.round(Number(pos.coords.accuracy || 0));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("Invalid geolocation coordinates.");
  }

  // v4: GPS accuracy floor (Settings → irlid_gps_acc_floor_m, 0 = any)
  try {
    const floor = Number(localStorage.getItem("irlid_gps_acc_floor_m") || 0);
    if (floor > 0 && Number.isFinite(acc) && acc > floor) {
      throw new Error(
        "GPS accuracy too low (" + acc + " m). " +
        "Your Settings require ≤ " + floor + " m. " +
        "Try moving outdoors or adjusting the accuracy floor in Settings."
      );
    }
  } catch(e) { if (e.message && e.message.startsWith("GPS accuracy")) throw e; }

  const ts = Math.floor(Date.now() / 1000);
  const nonceB = crypto.getRandomValues(new Uint32Array(1))[0];

  // Optional bio-metric gate (v4 opt-in — Settings only, never prompted during normal handshake).
  // If the user has enrolled and enabled bio-metric verification, trigger Face ID / fingerprint now.
  // Result is committed into the signed payload: bioVerified:true proves the device owner was
  // physically present at the moment of signing. Self-reported, but cryptographically bound.
  let bioVerified = false;
  if (irlidBiometricEnabled()) {
    try { bioVerified = await irlidBiometricVerify(); } catch { bioVerified = false; }
  }

  // v3: version inside signature, canonical() hashing.
  const payload = {
    v: 3,
    helloHash,
    offerHash: offerInfo.offerHash || undefined,
    lat,
    lon,
    acc,
    ts,
    nonce: nonceB
  };

  // Remove undefined to keep hashes stable
  if (payload.offerHash === undefined) delete payload.offerHash;
  // Only include bioVerified if true — absence means not enrolled/not verified (not a failure).
  if (bioVerified) payload.bioVerified = true;

  const pub = await getPublicJwk();
  const hash = await hashPayloadToB64url(payload);
  const sig = await signHashB64url(hash);

  // Deploy 76: stripped JWK (saves ~25 chars).
  const resp = {
    v: 3,
    type: "response",
    payload,
    hash,
    sig,
    pub: compactJwk(pub)
  };

  // Cache for scan.html to use in mutual verification
  window.__irlid_last_self_response = resp;

  return resp;
}



// Returns a lean copy of the combined receipt for QR/URL encoding.
// Strips fields that can be recomputed during verification:
//   a.hash  — SHA-256 of a.payload (recomputable)
//   a.pub   — identical to hello.pub (redundant)
//   b.hash  — SHA-256 of b.payload (recomputable)
// v3: hello.offer.hash is no longer transmitted (removed from protocol).
// Savings: ~130 chars uncompressed, reducing QR density.
function irlidStripCombinedForEncoding(combined) {
  if (!combined) return combined;
  const c = Object.assign({}, combined);
  if (c.a) {
    c.a = Object.assign({}, c.a);
    delete c.a.hash;
    delete c.a.pub;
  }
  if (c.b) {
    c.b = Object.assign({}, c.b);
    delete c.b.hash;
  }
  return c;
}

// =========================================================
//  v4 Trust history — localStorage-based receipt scoring
//  Stores a compact record of each verified receipt so future
//  verifications can show accumulated trust signals.
//  All data stays on-device; no backend change required for v4.
// =========================================================

const IRLID_HISTORY_KEY = "irlid_trust_history";
const IRLID_HISTORY_MAX = 200; // cap to keep localStorage tidy

// Read the stored trust history array (or empty array if none).
function irlidTrustHistoryGet() {
  try {
    const raw = localStorage.getItem(IRLID_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

// Save a compact trust entry after a successful receipt verification.
// entry: { ts, lat?, lon?, keyId }
function irlidTrustHistoryAppend(entry) {
  try {
    const history = irlidTrustHistoryGet();
    history.push(entry);
    // Keep only the most recent entries
    const trimmed = history.slice(-IRLID_HISTORY_MAX);
    localStorage.setItem(IRLID_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {}
}

// Compute v4 trust score additions from history.
// Returns { receiptDepthPts, locationDiversityPts, deviceConsistencyPts, receiptCount }
async function irlidV4TrustScore() {
  const history = irlidTrustHistoryGet();
  const receiptCount = history.length;

  // --- Receipt depth (0–2 pts) ---
  // 1 receipt = 1pt, 5+ = 2pt
  let receiptDepthPts = 0;
  if (receiptCount >= 5) receiptDepthPts = 2;
  else if (receiptCount >= 1) receiptDepthPts = 1;

  // --- Location diversity (0–2 pts) ---
  // Pass if known GPS locations span more than 1 km total range.
  let locationDiversityPts = 0;
  const coordEntries = history.filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lon));
  if (coordEntries.length >= 2) {
    let maxDist = 0;
    for (let i = 0; i < coordEntries.length; i++) {
      for (let j = i + 1; j < coordEntries.length; j++) {
        const d = irlidHaversineMeters(
          { lat: coordEntries[i].lat, lon: coordEntries[i].lon },
          { lat: coordEntries[j].lat, lon: coordEntries[j].lon }
        );
        if (d > maxDist) maxDist = d;
      }
    }
    if (maxDist > 1000) locationDiversityPts = 2;
  }

  // --- Device consistency (0–2 pts) ---
  // The ECDSA key was already in localStorage when this receipt was generated.
  // A key that has been present across multiple sessions is consistent.
  // Proxy: if history has entries from different calendar days = multi-session.
  let deviceConsistencyPts = 0;
  if (history.length >= 2) {
    const days = new Set(history.map(e => {
      try { return new Date(e.ts).toDateString(); } catch { return null; }
    }).filter(Boolean));
    if (days.size >= 2) deviceConsistencyPts = 2;
    else if (days.size === 1) deviceConsistencyPts = 1; // same day, at least consistent
  }

  return { receiptDepthPts, locationDiversityPts, deviceConsistencyPts, receiptCount };
}

// Call this after a successful combined receipt is produced to record it in trust history.
async function irlidRecordVerifiedReceipt(combined) {
  try {
    const pub = await getPublicJwk();
    const keyId = await pubKeyId(pub);
    // Pull our GPS from the combined receipt (side a = initiator, side b = collaborator)
    let lat = null, lon = null;
    const myPubRaw = JSON.stringify(compactJwk(pub));
    // Find which side is ours
    const sideA = combined && combined.a;
    const sideB = combined && combined.b;
    const helloPub = combined && combined.hello && combined.hello.pub;
    // a.pub may be stripped (same as hello.pub) — compare with hello.pub
    const aPub = (sideA && sideA.pub) ? sideA.pub : helloPub;
    if (aPub && JSON.stringify(compactJwk(aPub)) === myPubRaw && sideA && sideA.payload) {
      lat = sideA.payload.lat;
      lon = sideA.payload.lon;
    } else if (sideB && sideB.pub && JSON.stringify(compactJwk(sideB.pub)) === myPubRaw && sideB.payload) {
      lat = sideB.payload.lat;
      lon = sideB.payload.lon;
    }
    const entry = { ts: Date.now(), keyId };
    if (Number.isFinite(lat) && Number.isFinite(lon)) { entry.lat = lat; entry.lon = lon; }
    irlidTrustHistoryAppend(entry);
  } catch {}
}

// =========================================================
//  Bio-metric verification via WebAuthn (v4 optional feature)
//  Adds a biometric gate at scan time — proves the device
//  owner was physically present and unlocked the device.
//  Does NOT replace the ECDSA keys (that is v5 / Secure Enclave).
//  All functions are no-ops if the feature is not enrolled/enabled.
// =========================================================

// Returns true if this device has a platform authenticator (Face ID / fingerprint).
async function irlidBiometricAvailable() {
  if (!window.PublicKeyCredential ||
      typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

// Returns true if the user has enrolled a bio-metric credential and enabled the feature.
function irlidBiometricEnabled() {
  try {
    return localStorage.getItem("irlid_bio_enabled") === "1" &&
           !!localStorage.getItem("irlid_bio_cred_id");
  } catch { return false; }
}

// Called from Settings — creates a platform WebAuthn credential for IRLid.
// No server required — the credential ID is kept in localStorage.
// The credential is used only as a biometric gate; signing stays with ECDSA.
async function irlidBiometricEnroll() {
  if (!await irlidBiometricAvailable()) {
    throw new Error(
      "Platform authenticator (Face ID / fingerprint) not available on this device.\n\n" +
      "Bio-metric verification requires a device with biometric unlock capability " +
      "and a supported browser (Safari on iOS 16+, Chrome on Android 9+)."
    );
  }
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId    = crypto.getRandomValues(new Uint8Array(16));

  let cred;
  try {
    cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "IRLid", id: location.hostname },
        user: { id: userId, name: "irlid-bio", displayName: "IRLid Bio-metric" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred"
        },
        timeout: 60000,
        attestation: "none"
      }
    });
  } catch (e) {
    throw new Error("Bio-metric enrolment cancelled or failed: " + (e.message || e));
  }

  if (!cred || !cred.rawId) throw new Error("Bio-metric enrolment returned no credential.");

  const credId = b64urlEncode(new Uint8Array(cred.rawId));
  localStorage.setItem("irlid_bio_cred_id", credId);
  localStorage.setItem("irlid_bio_enabled", "1");
  return credId;
}

// Disables bio-metric and removes the stored credential.
function irlidBiometricUnenroll() {
  try {
    localStorage.removeItem("irlid_bio_cred_id");
    localStorage.removeItem("irlid_bio_enabled");
  } catch {}
}

// Triggers the platform biometric prompt using the enrolled credential.
// Returns true if the user successfully authenticated, false if cancelled / unavailable.
async function irlidBiometricVerify() {
  const credIdStr = localStorage.getItem("irlid_bio_cred_id");
  if (!credIdStr) return false;

  let credIdBytes;
  try { credIdBytes = b64urlDecode(credIdStr); } catch { return false; }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: credIdBytes, type: "public-key" }],
        userVerification: "required",
        timeout: 60000
      }
    });
    return !!assertion;
  } catch {
    // User cancelled, timed out, or credential not found
    return false;
  }
}

async function processScannedResponse(otherRespObj, opts){
  const helloB64url = opts && opts.hello ? opts.hello : null;
  const tsTolS = (opts && Number.isFinite(opts.tsTolS)) ? opts.tsTolS : 90;
  const distTolM = (opts && Number.isFinite(opts.distTolM)) ? opts.distTolM : 12;

  if (!helloB64url) throw new Error("HELLO missing for verification.");

  const helloObj = irlidDecodeB64urlJson(helloB64url);
  if (!helloObj || helloObj.type !== "hello") throw new Error("Invalid HELLO.");

  // Verify signed offer if present (v2). Back-compat allows unsigned v1.
  const offerInfo = await verifyHelloOfferAsync(helloObj, { tsTolS });

  const helloHash = await irlidHelloHashB64url(helloObj);

  const other = otherRespObj;
  if (!other || other.type !== "response" || !other.payload || !other.hash || !other.sig || !other.pub) {
    throw new Error("Invalid response (bad structure).");
  }

  const computed = await hashPayloadToB64url(other.payload);
  if (computed !== other.hash) throw new Error("Hash mismatch.");

  const sigOk = await verifySig(other.hash, other.sig, other.pub);
  if (!sigOk) throw new Error("Signature invalid.");

  // Binding checks:
  // - Always bind to the HELLO hash (legacy + new)
  if (!other.payload.helloHash || other.payload.helloHash !== helloHash) {
    throw new Error("HELLO binding mismatch.");
  }
  // - If HELLO has a signed offer, require the response to bind to that offer hash too.
  if (offerInfo.offerHash) {
    if (!other.payload.offerHash || other.payload.offerHash !== offerInfo.offerHash) {
      throw new Error("Offer binding mismatch.");
    }
  }

  // Timestamp tolerance (response freshness)
  const now = Math.floor(Date.now() / 1000);
  const ts = Number(other.payload.ts);
  if (!Number.isFinite(ts)) throw new Error("Response timestamp missing.");
  // Fix #2: Reject timestamps significantly in the future (allows 5s clock skew).
  if (ts > now + 5) throw new Error("Response timestamp is in the future (" + (ts - now) + "s ahead).");
  const dt = Math.abs(now - ts);
  if (dt > tsTolS) {
    throw new Error("Timestamp outside tolerance (" + dt + "s > " + tsTolS + "s).");
  }

  const self = window.__irlid_last_self_response || null;

  // Distance tolerance check (if self present)
  if (self && self.payload && Number.isFinite(self.payload.lat) && Number.isFinite(self.payload.lon)) {
    const d = irlidHaversineMeters(
      { lat: self.payload.lat, lon: self.payload.lon },
      { lat: other.payload.lat, lon: other.payload.lon }
    );
    if (d > distTolM) {
      throw new Error("Distance outside tolerance (" + Math.round(d) + "m > " + distTolM + "m).");
    }
  }

  const combined = {
    v: 3,
    type: "combined",
    tol: { dist_m: distTolM, ts_s: tsTolS },
    hello: helloObj,
    a: self,
    b: other
  };

  return { self, other, combined };
}

// Redacted receipt — removes GPS coordinates from both payloads, replacing
// with a SHA-256 hash. The ECDSA signatures (computed over the full payload)
// remain intact and are verifiable against the stored hash. Third parties
// can verify identity, timing, and HELLO binding — but not the raw location.
async function irlidMakeRedactedReceipt(combined) {
  const r = JSON.parse(JSON.stringify(combined));

  for (const side of ["a", "b"]) {
    const p = r[side] && r[side].payload;
    if (!p) continue;
    if (p.lat !== undefined || p.lon !== undefined) {
      const gpsData = { acc: p.acc, lat: p.lat, lon: p.lon };
      p.gps_hash = await sha256Hex(canonical(gpsData));
      delete p.lat;
      delete p.lon;
      delete p.acc;
    }
    // Also scrub hello offer GPS if present
    if (r.hello && r.hello.offer && r.hello.offer.payload) {
      const op = r.hello.offer.payload;
      if (op.lat !== undefined) {
        const gpsData = { acc: op.acc, lat: op.lat, lon: op.lon };
        op.gps_hash = await sha256Hex(canonical(gpsData));
        delete op.lat; delete op.lon; delete op.acc;
      }
    }
  }

  r.redacted = true;
  r.redacted_at = Math.floor(Date.now() / 1000);
  r._privacy_note = "GPS coordinates removed for privacy. Location proximity was cryptographically verified at signing time. Signatures remain valid against stored hashes.";
  return r;
}
