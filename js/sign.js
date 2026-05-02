// Copyright 2025 Spencer Austin. All rights reserved.
// Licensed under Apache 2.0 with Commons Clause. See LICENSE.
// IRLid signing (ECDSA P-256) - requires WebCrypto (secure context)
//  Deploy 78 — location hotspot clustering + novelty scoring for diversity

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

  // v5 short-circuits the bio-metric gate (its WebAuthn UV is the gate).
  // v3/v4 path uses the optional v4 bio-metric gate (Settings only, never prompted otherwise).
  const useV5 = irlidV5Enabled();
  let bioVerified = useV5;
  if (!useV5 && irlidBiometricEnabled()) {
    try { bioVerified = await irlidBiometricVerify(); } catch { bioVerified = false; }
  }

  // Offer payload version mirrors the signing path: v: 3 for v3/v4, v: 5 for v5.
  const offerPayload = {
    v: useV5 ? 5 : 3,
    lat,
    lon,
    acc,
    ts,
    nonce: nonceA
  };
  if (bioVerified) offerPayload.bioVerified = true;

  // Dispatch — picks v5 (Secure Enclave / passkey) or v3/v4 (localStorage ECDSA) based on Settings.
  const signed = await irlidSignPayload(offerPayload);

  // v3: offer.hash removed from HELLO — verifier recomputes it from offer.payload.
  // Saves ~88 chars. hash still used to sign (offerSig), just not transmitted.
  // JWK stripped of ext/key_ops (saves ~25 chars).
  // v5: webauthn envelope (authData, clientData) attached to the offer.
  const hello = {
    v: signed.v,
    type: "hello",
    pub: signed.pub,
    offer: {
      payload: offerPayload,
      sig: signed.sig
    }
  };
  if (signed.webauthn) hello.offer.webauthn = signed.webauthn;

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

  // v5: WebAuthn-envelope-wrapped signature. Verify the envelope (origin, type, challenge,
  // UV flag, ECDSA over authData||SHA-256(clientDataJSON)) instead of the raw v3 path.
  const isV5 = !!(offer.webauthn && Number(helloObj.v) === 5);
  let mode;
  if (isV5) {
    try {
      await irlidV5VerifyEnvelope(offer.payload, helloObj.pub, offer.sig, offer.webauthn);
    } catch (e) {
      throw new Error("HELLO offer v5 envelope: " + (e.message || e));
    }
    mode = "signed-v5";
  } else {
    const sigOk = await verifySig(computed, offer.sig, helloObj.pub);
    if (!sigOk) throw new Error("HELLO offer signature invalid.");
    mode = "signed-v3";
  }

  const now = Math.floor(Date.now() / 1000);
  const ts = Number(offer.payload.ts);
  if (!Number.isFinite(ts)) throw new Error("HELLO offer timestamp missing.");
  if (ts > now + 5) throw new Error("HELLO offer timestamp is in the future (" + (ts - now) + "s ahead).");
  const dt = Math.abs(now - ts);
  if (dt > tsTolS) throw new Error("HELLO offer timestamp outside tolerance (" + dt + "s > " + tsTolS + "s).");

  // Always return the computed hash so response builder can bind to it,
  // regardless of whether offer.hash was transmitted.
  return { ok: true, mode, offerHash: computed };
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

  // v5 short-circuits the bio-metric gate (its WebAuthn UV is the gate).
  // v3/v4 path uses the optional v4 bio-metric gate (Settings only, never prompted otherwise).
  // If the user has enrolled and enabled bio-metric verification, trigger Face ID / fingerprint now.
  // Result is committed into the signed payload: bioVerified:true proves the device owner was
  // physically present at the moment of signing. Self-reported, but cryptographically bound.
  const useV5 = irlidV5Enabled();
  let bioVerified = useV5;
  if (!useV5 && irlidBiometricEnabled()) {
    try { bioVerified = await irlidBiometricVerify(); } catch { bioVerified = false; }
  }

  // Payload version mirrors the signing path.
  const payload = {
    v: useV5 ? 5 : 3,
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

  // Dispatch — picks v5 (Secure Enclave / passkey) or v3/v4 (localStorage ECDSA) based on Settings.
  const signed = await irlidSignPayload(payload);

  // Deploy 76: stripped JWK (saves ~25 chars).
  // v5: webauthn envelope (authData, clientData) attached at the top level of the response.
  const resp = {
    v: signed.v,
    type: "response",
    payload,
    hash: signed.hash,
    sig: signed.sig,
    pub: signed.pub
  };
  if (signed.webauthn) resp.webauthn = signed.webauthn;

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
// =========================================================
//  Location clustering — groups GPS entries into 1km hotspots.
//  Returns array of { lat, lon, count } cluster objects.
//  Common areas (home, work) build up high counts.
//  Rare areas (Mansfield, Sheffield) stay at count=1.
// =========================================================
function irlidBuildLocationClusters(entries, radiusM) {
  if (!radiusM) radiusM = 1000;
  const clusters = [];
  for (const e of entries) {
    if (!Number.isFinite(e.lat) || !Number.isFinite(e.lon)) continue;
    let best = null, bestDist = radiusM;
    for (const c of clusters) {
      const d = irlidHaversineMeters({ lat: e.lat, lon: e.lon }, { lat: c.lat, lon: c.lon });
      if (d < bestDist) { bestDist = d; best = c; }
    }
    if (best) {
      best.count++;
      // Update running centroid — keeps the cluster centre accurate as it grows.
      best.lat += (e.lat - best.lat) / best.count;
      best.lon += (e.lon - best.lon) / best.count;
    } else {
      clusters.push({ lat: e.lat, lon: e.lon, count: 1 });
    }
  }
  return clusters;
}

// =========================================================
//  Location novelty score (0–1) for a specific lat/lon.
//  1.0 = never been here before (outlier like Sheffield).
//  0.0 = every scan is from this location (home).
//  Returned alongside cluster info so the UI can colour-code
//  the diversity badge and show the hotspot scan count.
// =========================================================
function irlidLocationNovelty(lat, lon, history) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { score: 0, clusterCount: 0, totalClusters: 0 };
  const coords = history.filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lon));
  if (coords.length === 0) return { score: 1.0, clusterCount: 0, totalClusters: 0 };

  const clusters = irlidBuildLocationClusters(coords);
  const total = clusters.reduce((s, c) => s + c.count, 0);

  // Find which cluster this location falls into (nearest within 1km).
  let clusterCount = 0;
  let minDist = Infinity;
  for (const c of clusters) {
    const d = irlidHaversineMeters({ lat, lon }, { lat: c.lat, lon: c.lon });
    if (d < 1000 && d < minDist) { minDist = d; clusterCount = c.count; }
  }

  // Brand-new area = maximum novelty.
  if (clusterCount === 0) return { score: 1.0, clusterCount: 0, totalClusters: clusters.length };

  // Score decays as the cluster share grows.
  // Home (40/55 = 73% share) → 0.27. Sheffield (1/55 = 2%) → 0.98.
  const score = Math.max(0, 1 - (clusterCount / total));
  return { score, clusterCount, totalClusters: clusters.length };
}

// Returns { receiptDepthPts, locationDiversityPts, deviceConsistencyPts, receiptCount, clusters }
async function irlidV4TrustScore() {
  const history = irlidTrustHistoryGet();
  const receiptCount = history.length;

  // --- Receipt depth (0–2 pts) ---
  let receiptDepthPts = 0;
  if (receiptCount >= 5) receiptDepthPts = 2;
  else if (receiptCount >= 1) receiptDepthPts = 1;

  // --- Location diversity (0–2 pts) ---
  // Based on distinct 1km clusters, not just max pairwise distance.
  // 1 cluster (home only) = 0pts. 2 distinct areas = 1pt. 3+ = 2pts.
  let locationDiversityPts = 0;
  const coordEntries = history.filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lon));
  const clusters = irlidBuildLocationClusters(coordEntries);
  if (clusters.length >= 3) locationDiversityPts = 2;
  else if (clusters.length >= 2) locationDiversityPts = 1;

  // --- Device consistency (0–2 pts) ---
  let deviceConsistencyPts = 0;
  if (history.length >= 2) {
    const days = new Set(history.map(e => {
      try { return new Date(e.ts).toDateString(); } catch { return null; }
    }).filter(Boolean));
    if (days.size >= 2) deviceConsistencyPts = 2;
    else if (days.size === 1) deviceConsistencyPts = 1;
  }

  return { receiptDepthPts, locationDiversityPts, deviceConsistencyPts, receiptCount, clusters };
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
    // Fallback: if this device's key isn't in the receipt (e.g. viewing on desktop
    // when the scan was done on mobile), record GPS from whichever side has it.
    // Both parties were within 12m so the location is accurate enough for diversity.
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      if (sideA && sideA.payload && Number.isFinite(sideA.payload.lat)) {
        lat = sideA.payload.lat;
        lon = sideA.payload.lon;
      } else if (sideB && sideB.payload && Number.isFinite(sideB.payload.lat)) {
        lat = sideB.payload.lat;
        lon = sideB.payload.lon;
      }
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

  // v5 envelope path vs v3/v4 raw-hash path
  const isV5 = !!(other.webauthn && Number(other.v) === 5);
  if (isV5) {
    try {
      await irlidV5VerifyEnvelope(other.payload, other.pub, other.sig, other.webauthn);
    } catch (e) {
      throw new Error("Response v5 envelope: " + (e.message || e));
    }
  } else {
    const sigOk = await verifySig(other.hash, other.sig, other.pub);
    if (!sigOk) throw new Error("Signature invalid.");
  }

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

// =========================================================
//  v5 — Hardware-Backed Signing (WebAuthn / Passkeys / Secure Enclave)
//  Specification: PROTOCOL.md §13.
//  All v5 features OFF by default; enabling is per-user via Settings.
//  v3/v4 paths above are untouched. v5 functions live entirely in this block.
// =========================================================

const IRLID_V5_CRED_ID_KEY  = "irlid_v5_cred_id";
const IRLID_V5_PUB_JWK_KEY  = "irlid_v5_pub_jwk";
const IRLID_V5_ENABLED_KEY  = "irlid_v5_enabled";

// Returns true if this device exposes a platform authenticator we could enrol against.
async function irlidV5Available() {
  if (!window.PublicKeyCredential ||
      typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

// Returns true if the user has enrolled a v5 credential (credId + pub JWK both present).
function irlidV5Enrolled() {
  try {
    return !!localStorage.getItem(IRLID_V5_CRED_ID_KEY) &&
           !!localStorage.getItem(IRLID_V5_PUB_JWK_KEY);
  } catch { return false; }
}

// Returns true if v5 is enrolled AND the user has toggled it on.
function irlidV5Enabled() {
  try {
    return irlidV5Enrolled() && localStorage.getItem(IRLID_V5_ENABLED_KEY) === "1";
  } catch { return false; }
}

// Returns the stored v5 public JWK (compact form) or null if not enrolled.
function irlidV5GetPublicJwk() {
  try {
    const raw = localStorage.getItem(IRLID_V5_PUB_JWK_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// Compute the RP ID for the current origin: eTLD+1, lowercase.
// Production: irlid.co.uk. Test: bunhead.github.io. Localhost: localhost.
// Note: this is a heuristic; for unusual deployments the operator can override
// via window.IRLID_RP_ID before sign.js loads.
function irlidV5RpId() {
  if (typeof window !== "undefined" && window.IRLID_RP_ID) return String(window.IRLID_RP_ID);
  const host = (typeof location !== "undefined" && location.hostname) ? location.hostname.toLowerCase() : "localhost";
  // Special-case the deployment hosts we know
  if (host === "irlid.co.uk" || host.endsWith(".irlid.co.uk")) return "irlid.co.uk";
  if (host === "bunhead.github.io" || host.endsWith(".bunhead.github.io")) return "bunhead.github.io";
  // Localhost / 127.0.0.1
  if (host === "localhost" || host === "127.0.0.1") return host;
  // Default: pass through. The browser will reject if it doesn't match the registrable domain.
  return host;
}

// Compute the expected RP origin for verification of a v5 envelope produced at this deployment.
// Verifiers receiving cross-origin receipts use the issuer's published origin allowlist instead.
function irlidV5ExpectedOrigin() {
  if (typeof window !== "undefined" && window.IRLID_RP_ORIGIN) return String(window.IRLID_RP_ORIGIN);
  const host = (typeof location !== "undefined" && location.hostname) ? location.hostname.toLowerCase() : "localhost";
  if (host === "irlid.co.uk" || host.endsWith(".irlid.co.uk")) return "https://irlid.co.uk";
  if (host === "bunhead.github.io" || host.endsWith(".bunhead.github.io")) return "https://bunhead.github.io";
  if (host === "localhost" || host === "127.0.0.1") {
    const port = (location.port && location.port !== "80" && location.port !== "443") ? (":" + location.port) : "";
    return location.protocol + "//" + host + port;
  }
  return location.protocol + "//" + host;
}

// Allowed origins for cross-origin verification.
// A receipt signed at irlid.co.uk and verified at bunhead.github.io is legitimate;
// the verifier checks the receipt's claimed origin against this list, not against location.origin.
const IRLID_V5_ORIGIN_ALLOWLIST = [
  "https://irlid.co.uk",
  "https://bunhead.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];

function irlidV5OriginAllowed(origin) {
  return IRLID_V5_ORIGIN_ALLOWLIST.includes(String(origin));
}

// =========================================================
//  DER ↔ raw P-256 signature conversion
//  WebAuthn returns DER-encoded ECDSA signatures.
//  crypto.subtle.verify with { name: "ECDSA" } expects raw IEEE P1363 r||s.
//  Both directions, fully tested round-trip in tests/sign.test.js.
// =========================================================

function irlidV5DerToRawP256(der) {
  if (!(der instanceof Uint8Array)) der = new Uint8Array(der);
  if (der.length < 8) throw new Error("v5: DER signature too short");
  if (der[0] !== 0x30) throw new Error("v5: DER signature missing SEQUENCE tag");

  // SEQUENCE length — short-form is one byte. P-256 sigs are always short-form (≤ 70 bytes).
  let pos = 2;
  if (der[1] & 0x80) {
    // Long-form length encoding (rare for P-256 sigs)
    const lenBytes = der[1] & 0x7f;
    pos = 2 + lenBytes;
  }

  // INTEGER r
  if (der[pos] !== 0x02) throw new Error("v5: DER signature missing first INTEGER tag (r)");
  const rLen = der[pos + 1];
  let r = der.slice(pos + 2, pos + 2 + rLen);
  pos += 2 + rLen;

  // INTEGER s
  if (der[pos] !== 0x02) throw new Error("v5: DER signature missing second INTEGER tag (s)");
  const sLen = der[pos + 1];
  let s = der.slice(pos + 2, pos + 2 + sLen);

  // DER encodes positive integers; if the high bit of the magnitude is set,
  // a leading 0x00 byte is prepended to disambiguate from a negative number.
  // Strip that leading zero before producing raw format.
  while (r.length > 32 && r[0] === 0x00) r = r.slice(1);
  while (s.length > 32 && s[0] === 0x00) s = s.slice(1);
  if (r.length > 32 || s.length > 32) {
    throw new Error("v5: r or s component larger than 32 bytes (not a valid P-256 signature)");
  }

  // Pad to 32 bytes each (DER strips leading zeros; raw requires fixed-width).
  const out = new Uint8Array(64);
  out.set(r, 32 - r.length);
  out.set(s, 64 - s.length);
  return out;
}

function irlidV5RawToDerP256(raw) {
  if (!(raw instanceof Uint8Array)) raw = new Uint8Array(raw);
  if (raw.length !== 64) throw new Error("v5: raw signature must be exactly 64 bytes");

  let r = raw.slice(0, 32);
  let s = raw.slice(32, 64);

  // Strip leading zeros for DER minimal encoding (must keep at least one byte)
  let rStart = 0;
  while (rStart < r.length - 1 && r[rStart] === 0x00) rStart++;
  r = r.slice(rStart);
  let sStart = 0;
  while (sStart < s.length - 1 && s[sStart] === 0x00) sStart++;
  s = s.slice(sStart);

  // If high bit is set, prepend 0x00 so the integer is unambiguously positive
  if (r[0] & 0x80) {
    const pad = new Uint8Array(r.length + 1);
    pad.set(r, 1);
    r = pad;
  }
  if (s[0] & 0x80) {
    const pad = new Uint8Array(s.length + 1);
    pad.set(s, 1);
    s = pad;
  }

  // Build SEQUENCE { INTEGER r, INTEGER s }
  const totalContent = 2 + r.length + 2 + s.length;
  const der = new Uint8Array(2 + totalContent);
  der[0] = 0x30;             // SEQUENCE tag
  der[1] = totalContent;     // SEQUENCE length (short-form)
  der[2] = 0x02;             // INTEGER tag (r)
  der[3] = r.length;
  der.set(r, 4);
  der[4 + r.length] = 0x02;  // INTEGER tag (s)
  der[5 + r.length] = s.length;
  der.set(s, 6 + r.length);
  return der;
}

// =========================================================
//  v5 Enrolment, Unenrolment, Signing
// =========================================================

// Enrol a new v5 credential. Stores credId + public JWK in localStorage.
// Throws if a credential already exists, the device lacks a platform authenticator,
// or the user cancels the enrolment prompt.
async function irlidV5Enroll() {
  if (!await irlidV5Available()) {
    throw new Error(
      "Hardware-backed signing not available on this device.\n\n" +
      "v5 requires a platform authenticator (Touch ID, Face ID, fingerprint, or Windows Hello). " +
      "Try Safari on iOS 16+, Chrome on Android 9+, or a Windows machine with Windows Hello set up."
    );
  }
  if (irlidV5Enrolled()) {
    throw new Error("v5 already enrolled. Remove the existing credential before enrolling a new one.");
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId    = crypto.getRandomValues(new Uint8Array(16));
  const rpId      = irlidV5RpId();

  let cred;
  try {
    cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "IRLid", id: rpId },
        user: { id: userId, name: "irlid-signer", displayName: "IRLid Signing Key" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],   // ES256 ONLY
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
    throw new Error("v5 enrolment cancelled or failed: " + (e.message || e));
  }

  if (!cred || !cred.rawId) throw new Error("v5 enrolment returned no credential.");

  // Extract the SPKI public key from the attestation response. Modern browsers (Chrome 85+,
  // Safari 14.5+, Firefox 119+) expose getPublicKey() directly. Falling back to CBOR-parsing
  // the attestationObject is non-trivial; we require getPublicKey().
  if (typeof cred.response.getPublicKey !== "function") {
    throw new Error(
      "v5 enrolment: AuthenticatorAttestationResponse.getPublicKey() not supported in this browser. " +
      "Please use a more recent version of Chrome, Safari, or Firefox."
    );
  }
  const spkiBytes = cred.response.getPublicKey();
  if (!spkiBytes) throw new Error("v5 enrolment: getPublicKey() returned null.");

  // Confirm we got an ES256 (P-256) key
  if (typeof cred.response.getPublicKeyAlgorithm === "function") {
    const alg = cred.response.getPublicKeyAlgorithm();
    if (alg !== -7) {
      throw new Error("v5 enrolment: authenticator returned alg=" + alg + ", expected -7 (ES256). " +
                      "v5 requires P-256 keys.");
    }
  }

  // SPKI → JWK → compact JWK
  let pubJwk;
  try {
    const cryptoKey = await crypto.subtle.importKey(
      "spki", spkiBytes,
      { name: "ECDSA", namedCurve: "P-256" },
      true, ["verify"]
    );
    const fullJwk = await crypto.subtle.exportKey("jwk", cryptoKey);
    pubJwk = compactJwk(fullJwk);
    if (pubJwk.kty !== "EC" || pubJwk.crv !== "P-256" || !pubJwk.x || !pubJwk.y) {
      throw new Error("v5 enrolment: imported public key is not P-256.");
    }
  } catch (e) {
    throw new Error("v5 enrolment: failed to import public key: " + (e.message || e));
  }

  const credIdB64u = b64urlEncode(new Uint8Array(cred.rawId));
  localStorage.setItem(IRLID_V5_CRED_ID_KEY, credIdB64u);
  localStorage.setItem(IRLID_V5_PUB_JWK_KEY, JSON.stringify(pubJwk));
  // Default-OFF after enrolment — user must explicitly toggle to use v5 for signing
  localStorage.setItem(IRLID_V5_ENABLED_KEY, "0");

  return { credIdB64u, pubJwk };
}

// Remove the v5 credential locally. Does not delete the platform credential itself —
// the user can do that via OS settings (iCloud Keychain / Google Password Manager / Windows Hello).
function irlidV5Unenroll() {
  try {
    localStorage.removeItem(IRLID_V5_CRED_ID_KEY);
    localStorage.removeItem(IRLID_V5_PUB_JWK_KEY);
    localStorage.removeItem(IRLID_V5_ENABLED_KEY);
  } catch {}
}

// Sign a payload hash via the enrolled v5 credential.
// Input: payloadHashBytes — Uint8Array of length 32 (the SHA-256 of canonical(payload))
// Returns: { sigRaw: Uint8Array(64), authData: Uint8Array, clientData: Uint8Array }
async function irlidV5SignPayloadHash(payloadHashBytes) {
  if (!irlidV5Enrolled()) throw new Error("v5 not enrolled.");
  if (!(payloadHashBytes instanceof Uint8Array) || payloadHashBytes.length !== 32) {
    throw new Error("v5 sign: payloadHashBytes must be a 32-byte Uint8Array.");
  }

  const credIdStr = localStorage.getItem(IRLID_V5_CRED_ID_KEY);
  const credIdBytes = b64urlDecode(credIdStr);

  let assertion;
  try {
    assertion = await navigator.credentials.get({
      publicKey: {
        challenge: payloadHashBytes,                                      // ← OUR data
        allowCredentials: [{ id: credIdBytes, type: "public-key" }],
        userVerification: "required",
        timeout: 60000
      }
    });
  } catch (e) {
    throw new Error("v5 sign: assertion cancelled or failed: " + (e.message || e));
  }
  if (!assertion || !assertion.response) throw new Error("v5 sign: no assertion returned.");

  const authData   = new Uint8Array(assertion.response.authenticatorData);
  const clientData = new Uint8Array(assertion.response.clientDataJSON);
  const sigDer     = new Uint8Array(assertion.response.signature);
  const sigRaw     = irlidV5DerToRawP256(sigDer);

  // Sanity: confirm UV flag was actually asserted (some authenticators silently downgrade)
  if (authData.length < 37) throw new Error("v5 sign: authenticatorData too short.");
  const flags = authData[32];
  if ((flags & 0x04) !== 0x04) {
    throw new Error("v5 sign: authenticator did not assert UV flag (userVerification was not actually performed).");
  }

  // Sanity: confirm clientData challenge matches our payload hash before we ship it
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder().decode(clientData));
  } catch (e) {
    throw new Error("v5 sign: clientDataJSON is not valid JSON.");
  }
  if (parsed.type !== "webauthn.get") {
    throw new Error("v5 sign: clientData.type is " + parsed.type + ", expected 'webauthn.get'.");
  }
  const expectedChallenge = b64urlEncode(payloadHashBytes);
  if (parsed.challenge !== expectedChallenge) {
    throw new Error("v5 sign: clientData.challenge does not match our payload hash.");
  }

  return { sigRaw, authData, clientData };
}

// Verify a v5 envelope — used by both peer-side scan verification and Worker-side verification.
// Inputs:
//   payload          — the receipt payload object
//   pubJwk           — the receipt's pub field (compact JWK, P-256)
//   sigRawB64u       — the receipt's sig field (raw r||s, base64url)
//   webauthnEnv      — { authData: <b64url>, clientData: <b64url> }
//   expectedRpOrigin — optional override; defaults to checking against allowlist
// Returns: true if all checks pass; throws on the first failure with a descriptive message.
async function irlidV5VerifyEnvelope(payload, pubJwk, sigRawB64u, webauthnEnv, expectedRpOrigin) {
  if (!webauthnEnv || !webauthnEnv.authData || !webauthnEnv.clientData) {
    throw new Error("v5 verify: webauthn envelope missing.");
  }
  if (!pubJwk || pubJwk.kty !== "EC" || pubJwk.crv !== "P-256") {
    throw new Error("v5 verify: pub is not a P-256 JWK.");
  }
  if (!sigRawB64u) throw new Error("v5 verify: sig missing.");

  // 1. Compute expected payload hash (same canonical form as v3/v4)
  const payloadHashB64u = await hashPayloadToB64url(payload);

  // 2. Parse and validate clientDataJSON
  const clientDataBytes = b64urlDecode(webauthnEnv.clientData);
  let clientData;
  try {
    clientData = JSON.parse(new TextDecoder().decode(clientDataBytes));
  } catch (e) {
    throw new Error("v5 verify: clientDataJSON not valid JSON.");
  }
  if (clientData.type !== "webauthn.get") {
    throw new Error("v5 verify: clientData.type is '" + clientData.type + "', expected 'webauthn.get'.");
  }
  // Origin check: explicit override, else allowlist
  if (expectedRpOrigin !== undefined && expectedRpOrigin !== null) {
    if (clientData.origin !== expectedRpOrigin) {
      throw new Error("v5 verify: origin '" + clientData.origin + "' did not match expected '" + expectedRpOrigin + "'.");
    }
  } else if (!irlidV5OriginAllowed(clientData.origin)) {
    throw new Error("v5 verify: origin '" + clientData.origin + "' not in allowlist.");
  }
  if (clientData.challenge !== payloadHashB64u) {
    throw new Error("v5 verify: clientData.challenge does not match recomputed payload hash.");
  }

  // 3. Verify UV flag in authenticatorData
  const authDataBytes = b64urlDecode(webauthnEnv.authData);
  if (authDataBytes.length < 37) throw new Error("v5 verify: authData too short.");
  const flags = authDataBytes[32];
  if ((flags & 0x04) !== 0x04) {
    throw new Error("v5 verify: UV flag not asserted in authData.");
  }

  // 4. Reconstruct signedBytes = authData || SHA-256(clientDataJSON)
  const clientDataHashBuf = await crypto.subtle.digest("SHA-256", clientDataBytes);
  const clientDataHash = new Uint8Array(clientDataHashBuf);
  const signedBytes = new Uint8Array(authDataBytes.length + clientDataHash.length);
  signedBytes.set(authDataBytes, 0);
  signedBytes.set(clientDataHash, authDataBytes.length);

  // 5. Verify ECDSA P-256 signature
  let pubKey;
  try {
    pubKey = await crypto.subtle.importKey(
      "jwk", pubJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false, ["verify"]
    );
  } catch (e) {
    throw new Error("v5 verify: failed to import pub: " + (e.message || e));
  }

  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    pubKey,
    b64urlDecode(sigRawB64u),
    signedBytes
  );
  if (!ok) throw new Error("v5 verify: ECDSA signature verification failed.");
  return true;
}

// =========================================================
//  Unified signing dispatcher
//  Picks v5 path if enabled, else v3/v4 path.
//  Returns: { v, sig, pub, webauthn? }
// =========================================================
async function irlidSignPayload(payloadObj) {
  const payloadHashB64u = await hashPayloadToB64url(payloadObj);

  if (irlidV5Enabled()) {
    const payloadHashBytes = b64urlDecode(payloadHashB64u);
    const v5 = await irlidV5SignPayloadHash(payloadHashBytes);
    return {
      v: 5,
      hash: payloadHashB64u,
      sig: b64urlEncode(v5.sigRaw),
      pub: irlidV5GetPublicJwk(),
      webauthn: {
        authData:   b64urlEncode(v5.authData),
        clientData: b64urlEncode(v5.clientData)
      }
    };
  }

  // v3/v4 path — localStorage-resident ECDSA
  const sig = await signHashB64url(payloadHashB64u);
  const pub = await getPublicJwk();
  return {
    v: 3,
    hash: payloadHashB64u,
    sig,
    pub: compactJwk(pub),
    webauthn: null
  };
}
