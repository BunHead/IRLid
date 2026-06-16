// Copyright 2025 Spencer Austin. All rights reserved.
// Licensed under Apache 2.0 with Commons Clause. See LICENSE.
// irlid-api/src/index.js -- v7
// IRLid Backend -- Cloudflare Worker + D1
// Auth (device key + Google), profile, receipts, device linking, user lookup
// Deploy 116: Gmail allowlist gating on googleAuth(), GPS strip on getReceipt()

// =====================
//  HELPERS
// =====================

function uuid() { return crypto.randomUUID(); }
function now() { return Math.floor(Date.now() / 1000); }

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

function b64urlJsonDecode(str) {
  return JSON.parse(new TextDecoder().decode(b64urlDecode(String(str || ""))));
}

async function inflateRawB64urlJson(str) {
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
function canonical(val) {
  if (val === null || typeof val !== "object") return JSON.stringify(val);
  if (Array.isArray(val)) return "[" + val.map(canonical).join(",") + "]";
  const keys = Object.keys(val).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + canonical(val[k])).join(",") + "}";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function noStore(response) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function err(message, status = 400) { return json({ error: message }, status); }
function authErr(message, status = 401) {
  const response = err(message, status);
  response.error = true;
  return response;
}

function randomToken() { return b64urlEncode(crypto.getRandomValues(new Uint8Array(32))); }

const EXPECTED_MEMBER_ROLES = new Set(["attendee", "staff", "manager", "lead_admin", "developer"]);
const EXPECTED_ROLE_RANK = { attendee: 0, staff: 1, manager: 2, lead_admin: 3, developer: 4 };
const THEME_SCRAPE_TTL_MS = 24 * 60 * 60 * 1000;
const THEME_SCRAPE_TIMEOUT_MS = 5000;
const IMAGE_PROXY_MAX_BYTES = 2 * 1024 * 1024;
const PUBLIC_HTTP_URL_RE = /^https?:\/\/[a-z0-9.-]+\.[a-z]{2,}(?::\d{2,5})?(?:[/?#]|$)/i;
const AUTO_CHECKOUT_MIN_INTERVAL_MS = 60 * 1000;
const autoCheckoutLastRunByOrg = new Map();

function expectedMemberRole(value) {
  const role = String(value || "attendee").trim().toLowerCase();
  return EXPECTED_MEMBER_ROLES.has(role) ? role : "attendee";
}

function expectedRoleRank(role) {
  return EXPECTED_ROLE_RANK[expectedMemberRole(role)] ?? 0;
}

function strictExpectedMemberRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return EXPECTED_MEMBER_ROLES.has(role) ? role : null;
}

function inviteRole(value) {
  const role = strictExpectedMemberRole(value);
  return ["staff", "manager"].includes(role) ? role : null;
}

function isInternalHostname(hostname) {
  const host = String(hostname || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "::1" || host === "0:0:0:0:0:0:0:1") return true;
  if (/^(fc|fd|fe80):/i.test(host)) return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) return false;
  const parts = ipv4.slice(1).map(Number);
  if (parts.some(n => n < 0 || n > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 ||
    a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168;
}

function parsePublicHttpUrl(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048 || !PUBLIC_HTTP_URL_RE.test(trimmed)) return null;
  let url;
  try { url = new URL(trimmed); } catch (_) { return null; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (isInternalHostname(url.hostname)) return null;
  return url;
}

// Batch C polish 5 — Developer role is bootstrap-only. The /org/expected create
// + update endpoints accept prototype_role from any authenticated org member.
// That's fine for attendee/staff/manager/lead_admin (gated by frontend RBAC
// dropdown options), but Developer must NEVER be grantable through that path —
// the role exists to bootstrap the network and a Developer-can-add-Developer
// loop collapses that into recursive trust. New Developers come only via
// BOOTSTRAP_DEVELOPER_FP env var (today) or signed invite tokens (v5.6+).
// Defence in depth alongside the frontend dropdown filter.
function isExpectedRoleAllowedFromDashboard(role) {
  return role !== "developer";
}

function randomCode6() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const num = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return String(num % 1000000).padStart(6, "0");
}

// =====================
//  CRYPTO
// =====================

async function hashPayloadToB64url(payloadObj, protocolV) {
  // v3+: canonical() — order-independent. v2 and below: JSON.stringify (backward compat).
  const v = (protocolV != null) ? Number(protocolV) : ((payloadObj && payloadObj.v) ? Number(payloadObj.v) : 3);
  const str = (v >= 3) ? canonical(payloadObj) : JSON.stringify(payloadObj);
  const bytes = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
  return b64urlEncode(new Uint8Array(hashBuf));
}

async function sha256B64url(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return b64urlEncode(new Uint8Array(buf));
}

async function verifySig(midB64url, sigB64url, pubJwk) {
  try {
    const pub = await crypto.subtle.importKey("jwk", pubJwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, b64urlDecode(sigB64url), b64urlDecode(midB64url));
  } catch { return false; }
}

async function signCanonicalPayload(payloadObj, privateJwk) {
  const hash = await sha256B64url(deepCanonical(payloadObj));
  const key = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, b64urlDecode(hash));
  return b64urlEncode(new Uint8Array(sig));
}

async function pubKeyId(pubJwk) {
  const s = `${pubJwk.kty}.${pubJwk.crv}.${pubJwk.x}.${pubJwk.y}`;
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return b64urlEncode(new Uint8Array(h)).slice(0, 18);
}

async function deviceKeyFp(pubJwk) {
  if (!pubJwk) return null;
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(pubJwk)));
  return b64urlEncode(new Uint8Array(h)).slice(0, 16);
}

// =====================
//  v5 ENVELOPE VERIFIER (PROTOCOL.md §13.7) — Batch A port from live Worker
// =====================
// Used by /org/login/claim (PROTOCOL.md §14) to verify hardware-backed signing
// envelopes for org-portal sign-in. Mirrors the verifier in the live Worker
// (irlid-api/src/index.js) byte-for-byte; differences would be implementation bugs.

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

// Verify a v5 envelope. Returns true on success; throws Error on first failure.
async function verifyV5Envelope(payload, pubJwk, sigRawB64u, webauthnEnv, expectedRpOrigin) {
  if (!webauthnEnv || !webauthnEnv.authData || !webauthnEnv.clientData) {
    throw new Error("v5: envelope missing");
  }
  if (!pubJwk || pubJwk.kty !== "EC" || pubJwk.crv !== "P-256") {
    throw new Error("v5: pub is not a P-256 JWK");
  }
  if (!sigRawB64u) throw new Error("v5: sig missing");
  const payloadHashB64u = await hashPayloadToB64url(payload);
  const clientDataBytes = b64urlDecode(webauthnEnv.clientData);
  let clientData;
  try {
    clientData = JSON.parse(new TextDecoder().decode(clientDataBytes));
  } catch (e) {
    throw new Error("v5: clientDataJSON not valid JSON");
  }
  if (clientData.type !== "webauthn.get") {
    throw new Error("v5: clientData.type is '" + clientData.type + "', expected 'webauthn.get'");
  }
  if (expectedRpOrigin !== undefined && expectedRpOrigin !== null) {
    if (clientData.origin !== expectedRpOrigin) {
      throw new Error("v5: origin '" + clientData.origin + "' did not match expected '" + expectedRpOrigin + "'");
    }
  } else if (!irlidV5OriginAllowed(clientData.origin)) {
    throw new Error("v5: origin '" + clientData.origin + "' not in allowlist");
  }
  if (clientData.challenge !== payloadHashB64u) {
    throw new Error("v5: clientData.challenge does not match recomputed payload hash");
  }
  const authDataBytes = b64urlDecode(webauthnEnv.authData);
  if (authDataBytes.length < 37) throw new Error("v5: authData too short");
  const flags = authDataBytes[32];
  if ((flags & 0x04) !== 0x04) {
    throw new Error("v5: UV flag not asserted in authData");
  }
  const clientDataHashBuf = await crypto.subtle.digest("SHA-256", clientDataBytes);
  const clientDataHash = new Uint8Array(clientDataHashBuf);
  const signedBytes = new Uint8Array(authDataBytes.length + clientDataHash.length);
  signedBytes.set(authDataBytes, 0);
  signedBytes.set(clientDataHash, authDataBytes.length);
  let pubKey;
  try {
    pubKey = await crypto.subtle.importKey(
      "jwk", pubJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false, ["verify"]
    );
  } catch (e) {
    throw new Error("v5: failed to import pub: " + (e.message || e));
  }
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    pubKey,
    b64urlDecode(sigRawB64u),
    signedBytes
  );
  if (!ok) throw new Error("v5: ECDSA signature verification failed");
  return true;
}

async function helloHashB64url(helloObj, protocolV) {
  const v = (protocolV != null) ? Number(protocolV) : ((helloObj && helloObj.v) ? Number(helloObj.v) : 3);
  const str = (v >= 3) ? canonical(helloObj) : JSON.stringify(helloObj);
  const bytes = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
  return b64urlEncode(new Uint8Array(hashBuf));
}

async function parseHelloInput(input) {
  if (input && typeof input === "object") return input;
  if (typeof input !== "string") throw new Error("HELLO payload required");
  const raw = input.trim();
  if (raw.startsWith("H:")) return b64urlJsonDecode(raw.slice(2));
  if (raw.startsWith("HZ:")) return inflateRawB64urlJson(raw.slice(3));
  if (raw.startsWith("{")) return JSON.parse(raw);
  return b64urlJsonDecode(raw);
}

async function verifySignedHello(helloObj, tsTolS = 90) {
  if (!helloObj || helloObj.type !== "hello") return { ok: false, status: 400, error: "Invalid HELLO" };
  if (!helloObj.pub || !helloObj.pub.kty || !helloObj.pub.crv || !helloObj.pub.x || !helloObj.pub.y) {
    return { ok: false, status: 400, error: "Invalid HELLO (missing pub)" };
  }
  const offer = helloObj.offer;
  if (!offer || !offer.payload || !offer.sig) {
    return { ok: false, status: 400, error: "Invalid HELLO (bad offer structure)" };
  }
  const computed = await hashPayloadToB64url(offer.payload);
  if (offer.hash && computed !== offer.hash) return { ok: false, status: 401, error: "HELLO offer hash mismatch" };
  const sigOk = await verifySig(computed, offer.sig, helloObj.pub);
  if (!sigOk) return { ok: false, status: 401, error: "HELLO offer signature invalid" };
  const t = now();
  const ts = Number(offer.payload.ts);
  if (!Number.isFinite(ts)) return { ok: false, status: 400, error: "HELLO offer timestamp missing" };
  if (ts > t + 5) return { ok: false, status: 401, error: "HELLO offer timestamp in future" };
  if (Math.abs(t - ts) > tsTolS) return { ok: false, status: 401, error: "HELLO offer timestamp expired" };
  return { ok: true, verification_state: "signature_verified", offer_hash: computed };
}

// =====================
//  GOOGLE TOKEN VERIFY
// =====================

const GOOGLE_CLIENT_ID = "1027068182677-b69k36slkhjr0ltjbde7q6ktopjscmeq.apps.googleusercontent.com";

async function verifyGoogleToken(idToken) {
  // Use Google's tokeninfo endpoint to verify
  const resp = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken));
  if (!resp.ok) return null;

  const payload = await resp.json();

  // Verify audience matches our client ID
  if (payload.aud !== GOOGLE_CLIENT_ID) return null;

  // Verify issuer
  if (payload.iss !== "accounts.google.com" && payload.iss !== "https://accounts.google.com") return null;

  // Verify not expired
  if (payload.exp && Number(payload.exp) < now()) return null;

  return {
    sub: payload.sub,           // Unique Google user ID
    email: payload.email,
    email_verified: payload.email_verified === "true",
    name: payload.name || null,
    given_name: payload.given_name || null,
    family_name: payload.family_name || null,
    picture: payload.picture || null
  };
}

// =====================
//  RECEIPT VERIFICATION
// =====================

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1); const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function verifyReceipt(comb) {
  const TS_TOL = 90; const DIST_TOL = 12; const checks = {};

  const a = comb.a;
  if (a && a.payload && a.hash && a.sig && a.pub) {
    checks.a_structure = true;
    // Pass a.v so v2 uses JSON.stringify, v3+ uses canonical().
    checks.a_hash = (await hashPayloadToB64url(a.payload, a.v)) === a.hash;
    checks.a_sig = await verifySig(a.hash, a.sig, a.pub);
  } else { checks.a_structure = false; checks.a_hash = false; checks.a_sig = false; }

  const b = comb.b;
  if (b && b.payload && b.hash && b.sig && b.pub) {
    checks.b_structure = true;
    checks.b_hash = (await hashPayloadToB64url(b.payload, b.v)) === b.hash;
    checks.b_sig = await verifySig(b.hash, b.sig, b.pub);
  } else { checks.b_structure = false; checks.b_hash = false; checks.b_sig = false; }

  const hello = comb.hello;
  if (hello && hello.offer && hello.offer.payload && hello.offer.sig && hello.pub) {
    // Offer hash uses the offer payload's own version (offer.payload.v).
    const computedOfferHash = await hashPayloadToB64url(hello.offer.payload);
    if (hello.offer.hash) checks.hello_hash = computedOfferHash === hello.offer.hash; // back-compat v2
    checks.hello_sig = await verifySig(computedOfferHash, hello.offer.sig, hello.pub);
  }

  if (hello) {
    // v3+: canonical(). v2 and below: JSON.stringify (backward compat).
    const hv = (hello && hello.v) ? Number(hello.v) : 3;
    const helloStr = (hv >= 3) ? canonical(hello) : JSON.stringify(hello);
    const helloHash = b64urlEncode(new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(helloStr))
    ));
    if (a && a.payload) checks.a_binds_hello = a.payload.helloHash === helloHash;
    if (b && b.payload) checks.b_binds_hello = b.payload.helloHash === helloHash;
  }

  const tsA = a?.payload?.ts; const tsB = b?.payload?.ts;
  if (typeof tsA === "number" && typeof tsB === "number") {
    checks.time_delta_s = Math.abs(tsA - tsB);
    checks.time_delta_ok = checks.time_delta_s <= TS_TOL;
  } else { checks.time_delta_ok = false; }

  const latA = a?.payload?.lat; const lonA = a?.payload?.lon;
  const latB = b?.payload?.lat; const lonB = b?.payload?.lon;
  if (latA != null && lonA != null && latB != null && lonB != null) {
    checks.distance_m = Math.round(haversineMeters(latA, lonA, latB, lonB) * 100) / 100;
    checks.distance_ok = checks.distance_m <= DIST_TOL;
  } else { checks.distance_ok = false; }

  checks.valid = !!(checks.a_structure && checks.a_hash && checks.a_sig && checks.b_structure && checks.b_hash && checks.b_sig && checks.time_delta_ok && checks.distance_ok);
  return checks;
}

// =====================
//  AUTH MIDDLEWARE
// =====================

async function getSession(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const row = await env.DB.prepare("SELECT user_id, device_id, expires_at FROM sessions WHERE id = ?").bind(token).first();
  if (!row) return null;
  if (row.expires_at < now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(token).run();
    return null;
  }
  return { userId: row.user_id, deviceId: row.device_id, token };
}

function requireAuth(session) {
  if (!session) return err("Unauthorized", 401);
  return null;
}

// =====================
//  CORS
// =====================

function corsHeaders(env, request) {
  const origin = request.headers.get("Origin") || "";
  // Allowed origins: env.CORS_ORIGIN (the primary frontend host — bunhead.github.io for
  // test, irlid.co.uk for live), plus the live IRLid origin always (because PROTOCOL.md
  // §14 login flow has the phone-side org-login.html hosted at irlid.co.uk POSTing to
  // either prod or test Worker — by design cross-origin), plus localhost dev variants.
  const allowed = [
    env.CORS_ORIGIN || "https://irlid.co.uk",
    "https://irlid.co.uk",
    "https://bunhead.github.io",
    "http://localhost:3000", "http://localhost:8000",
    "http://127.0.0.1:3000", "http://127.0.0.1:8000"
  ];
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0],
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Org-Key",
    "Access-Control-Max-Age": "86400"
  };
}

function addCors(response, env, request) {
  const h = corsHeaders(env, request);
  for (const [k, v] of Object.entries(h)) response.headers.set(k, v);
  return response;
}

// =====================
//  AUTH HANDLERS
// =====================

async function register(request, env) {
  let body;
  try { body = await request.json(); } catch { return err("Invalid JSON body"); }
  const { display_name, pub_jwk } = body;
  if (!pub_jwk || !pub_jwk.kty || !pub_jwk.crv || !pub_jwk.x || !pub_jwk.y) return err("pub_jwk is required");

  const pkId = await pubKeyId(pub_jwk);
  const existing = await env.DB.prepare("SELECT d.id as device_id, d.user_id FROM devices d WHERE d.pub_key_id = ?").bind(pkId).first();

  if (existing) {
    const token = randomToken(); const ts = now();
    await env.DB.prepare("INSERT INTO sessions (id, user_id, device_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)").bind(token, existing.user_id, existing.device_id, ts, ts + 30 * 86400).run();
    return json({ user_id: existing.user_id, device_id: existing.device_id, pub_key_id: pkId, session_token: token, existing: true });
  }

  const userId = uuid(); const deviceId = uuid(); const ts = now(); const token = randomToken();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO users (id, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)").bind(userId, display_name || null, ts, ts),
    env.DB.prepare("INSERT INTO devices (id, user_id, pub_key_id, pub_jwk, created_at) VALUES (?, ?, ?, ?, ?)").bind(deviceId, userId, pkId, JSON.stringify(pub_jwk), ts),
    env.DB.prepare("INSERT INTO sessions (id, user_id, device_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)").bind(token, userId, deviceId, ts, ts + 30 * 86400)
  ]);
  return json({ user_id: userId, device_id: deviceId, pub_key_id: pkId, session_token: token, existing: false }, 201);
}

// =====================
//  GOOGLE AUTH
// =====================

async function googleAuth(request, env) {
  let body;
  try { body = await request.json(); } catch { return err("Invalid JSON body"); }
  const { id_token, pub_jwk } = body;
  if (!id_token) return err("id_token required");

  // Verify the Google token
  const gUser = await verifyGoogleToken(id_token);
  if (!gUser) return err("Invalid or expired Google token.", 401);

  // =====================
  //  GMAIL ALLOWLIST (Deploy 116)
  // =====================
  // Normalise the incoming email — strip all whitespace and control chars
  const incomingEmail = gUser.email.toLowerCase().replace(/[\s​ ﻿]/g, "");
  const rawSecret = (env.ALLOWED_EMAILS || "");
  if (rawSecret.trim()) {
    const allowed = rawSecret
      .split(",")
      .map(e => e.toLowerCase().replace(/[\s​ ﻿]/g, ""))
      .filter(Boolean);
    if (allowed.length > 0 && !allowed.includes(incomingEmail)) {
      return err("not_on_allowlist", 403);
    }
  }

  const ts = now();

  // Check if we already have a user with this google_sub
  let user = await env.DB.prepare("SELECT id, display_name FROM users WHERE google_sub = ?").bind(gUser.sub).first();
  let existing = !!user;

  if (!user) {
    // Check if there's a user with matching email (link Google to existing email-based account)
    if (gUser.email) {
      user = await env.DB.prepare("SELECT id, display_name FROM users WHERE email = ?").bind(gUser.email).first();
    }
  }

  let userId;
  let displayName;

  if (user) {
    // Existing user â€” update their Google info
    userId = user.id;
    displayName = user.display_name;
    await env.DB.prepare(
      "UPDATE users SET google_sub = ?, google_email = ?, google_name = ?, google_picture = ?, updated_at = ? WHERE id = ?"
    ).bind(gUser.sub, gUser.email, gUser.name, gUser.picture, ts, userId).run();

    // Fill in profile fields if they're empty
    if (!displayName && gUser.name) {
      displayName = gUser.name;
      await env.DB.prepare("UPDATE users SET display_name = ? WHERE id = ? AND display_name IS NULL").bind(displayName, userId).run();
    }
    await env.DB.prepare("UPDATE users SET first_name = COALESCE(first_name, ?), surname = COALESCE(surname, ?), email = COALESCE(email, ?) WHERE id = ?")
      .bind(gUser.given_name, gUser.family_name, gUser.email, userId).run();

  } else {
    // New user
    userId = uuid();
    displayName = gUser.name || gUser.email;
    await env.DB.prepare(
      "INSERT INTO users (id, display_name, first_name, surname, email, google_sub, google_email, google_name, google_picture, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(userId, displayName, gUser.given_name, gUser.family_name, gUser.email, gUser.sub, gUser.email, gUser.name, gUser.picture, ts, ts).run();
  }

  // If a device pub_jwk was provided, link it to this account
  let deviceId = null;
  if (pub_jwk && pub_jwk.kty && pub_jwk.x && pub_jwk.y) {
    const pkId = await pubKeyId(pub_jwk);
    const existingDevice = await env.DB.prepare("SELECT id, user_id FROM devices WHERE pub_key_id = ?").bind(pkId).first();

    if (existingDevice) {
      if (existingDevice.user_id === userId) {
        deviceId = existingDevice.id;
      } else {
        // Device was registered to a different user â€” reassign to current user.
        // This happens when a new person logs in on a device previously used by someone else.
        deviceId = existingDevice.id;
        await env.DB.prepare("UPDATE devices SET user_id = ? WHERE id = ?")
          .bind(userId, deviceId).run();
      }
    } else {
      deviceId = uuid();
      await env.DB.prepare("INSERT INTO devices (id, user_id, pub_key_id, pub_jwk, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(deviceId, userId, pkId, JSON.stringify(pub_jwk), ts).run();
    }
  }

  // Create session
  const token = randomToken();
  await env.DB.prepare("INSERT INTO sessions (id, user_id, device_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
    .bind(token, userId, deviceId, ts, ts + 30 * 86400).run();

  return json({
    user_id: userId,
    display_name: displayName,
    session_token: token,
    device_id: deviceId,
    existing: existing,
    google_email: gUser.email
  });
}

// =====================
//  OTHER AUTH
// =====================

async function login(request, env) {
  let body;
  try { body = await request.json(); } catch { return err("Invalid JSON body"); }
  const { pub_key_id } = body;
  if (!pub_key_id) return err("pub_key_id required");
  const device = await env.DB.prepare("SELECT id, user_id, revoked_at FROM devices WHERE pub_key_id = ?").bind(pub_key_id).first();
  if (!device) return err("Device not found.", 404);
  if (device.revoked_at) return err("Device key revoked.", 403);
  const token = randomToken(); const ts = now();
  await env.DB.prepare("INSERT INTO sessions (id, user_id, device_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)").bind(token, device.user_id, device.id, ts, ts + 30 * 86400).run();
  return json({ session_token: token, user_id: device.user_id, device_id: device.id });
}

async function logout(request, env) {
  const session = await getSession(request, env);
  const denied = requireAuth(session);
  if (denied) return denied;
  await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(session.token).run();
  return json({ ok: true });
}

async function me(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ logged_in: false });

  const user = await env.DB.prepare(
    "SELECT id, display_name, first_name, middle_names, surname, email, google_sub, google_email, google_picture, created_at FROM users WHERE id = ?"
  ).bind(session.userId).first();
  if (!user) return json({ logged_in: false });

  const devices = await env.DB.prepare("SELECT id, pub_key_id, label, created_at, revoked_at FROM devices WHERE user_id = ?").bind(session.userId).all();
  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM (
       SELECT DISTINCT r.id FROM receipts r
       WHERE r.uploader_id = ?
          OR r.pub_key_a IN (SELECT pub_key_id FROM devices WHERE user_id = ?)
          OR r.pub_key_b IN (SELECT pub_key_id FROM devices WHERE user_id = ?)
     )`
  ).bind(session.userId, session.userId, session.userId).first();

  return json({
    logged_in: true,
    user: {
      id: user.id,
      display_name: user.display_name,
      first_name: user.first_name,
      middle_names: user.middle_names,
      surname: user.surname,
      email: user.email,
      google_linked: !!user.google_sub,
      google_email: user.google_email,
      google_picture: user.google_picture,
      created_at: user.created_at
    },
    devices: (devices.results || []).map(d => ({
      id: d.id, pub_key_id: d.pub_key_id, label: d.label,
      created_at: d.created_at, revoked: !!d.revoked_at
    })),
    current_device_id: session.deviceId,
    receipt_count: countRow ? countRow.cnt : 0
  });
}

// =====================
//  PROFILE
// =====================

async function updateProfile(request, env) {
  const session = await getSession(request, env);
  const denied = requireAuth(session);
  if (denied) return denied;

  let body;
  try { body = await request.json(); } catch { return err("Invalid JSON body"); }

  const allowed = ["display_name", "first_name", "middle_names", "surname", "email"];
  const sets = [];
  const vals = [];

  for (const field of allowed) {
    if (field in body) {
      sets.push(field + " = ?");
      vals.push(body[field] || null);
    }
  }

  if (sets.length === 0) return err("No fields to update.");

  sets.push("updated_at = ?");
  vals.push(now());
  vals.push(session.userId);

  await env.DB.prepare("UPDATE users SET " + sets.join(", ") + " WHERE id = ?").bind(...vals).run();
  return json({ ok: true });
}

// =====================
//  DEVICE LINKING
// =====================

async function linkCreate(request, env) {
  const session = await getSession(request, env);
  const denied = requireAuth(session);
  if (denied) return denied;

  await env.DB.prepare("DELETE FROM link_codes WHERE user_id = ? AND claimed = 0").bind(session.userId).run();

  const code = randomCode6();
  const ts = now();
  const expiresAt = ts + 300;
  await env.DB.prepare("INSERT INTO link_codes (code, user_id, created_at, expires_at, claimed) VALUES (?, ?, ?, ?, 0)").bind(code, session.userId, ts, expiresAt).run();
  return json({ code: code, expires_at: expiresAt });
}

async function linkClaim(request, env) {
  let body;
  try { body = await request.json(); } catch { return err("Invalid JSON body"); }
  const { code, pub_jwk } = body;
  if (!code || !pub_jwk) return err("code and pub_jwk required");

  const row = await env.DB.prepare("SELECT code, user_id, expires_at, claimed FROM link_codes WHERE code = ?").bind(code).first();
  if (!row) return err("Invalid code.", 404);
  if (row.claimed) return err("Code already used.", 410);
  if (row.expires_at < now()) return err("Code expired.", 410);

  const userId = row.user_id;
  const pkId = await pubKeyId(pub_jwk);

  const existingDevice = await env.DB.prepare("SELECT id, user_id FROM devices WHERE pub_key_id = ?").bind(pkId).first();

  if (existingDevice) {
    if (existingDevice.user_id === userId) {
      const token = randomToken(); const ts = now();
      await env.DB.batch([
        env.DB.prepare("UPDATE link_codes SET claimed = 1 WHERE code = ?").bind(code),
        env.DB.prepare("INSERT INTO sessions (id, user_id, device_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)").bind(token, userId, existingDevice.id, ts, ts + 30 * 86400)
      ]);
      const user = await env.DB.prepare("SELECT display_name FROM users WHERE id = ?").bind(userId).first();
      return json({ session_token: token, user_id: userId, device_id: existingDevice.id, display_name: user ? user.display_name : null, already_linked: true });
    }
    return err("Device key already registered under another account.", 409);
  }

  const deviceId = uuid(); const ts = now(); const token = randomToken();
  await env.DB.batch([
    env.DB.prepare("UPDATE link_codes SET claimed = 1 WHERE code = ?").bind(code),
    env.DB.prepare("INSERT INTO devices (id, user_id, pub_key_id, pub_jwk, created_at) VALUES (?, ?, ?, ?, ?)").bind(deviceId, userId, pkId, JSON.stringify(pub_jwk), ts),
    env.DB.prepare("INSERT INTO sessions (id, user_id, device_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)").bind(token, userId, deviceId, ts, ts + 30 * 86400)
  ]);

  const user = await env.DB.prepare("SELECT display_name FROM users WHERE id = ?").bind(userId).first();
  return json({ session_token: token, user_id: userId, device_id: deviceId, display_name: user ? user.display_name : null, linked: true }, 201);
}

// =====================
//  DEVICE MANAGEMENT
// =====================

async function renameDevice(request, env) {
  const session = await getSession(request, env);
  const denied = requireAuth(session);
  if (denied) return denied;

  let body;
  try { body = await request.json(); } catch { return err("Invalid JSON body"); }
  const { device_id, label } = body;
  if (!device_id) return err("device_id required");
  if (!label || !label.trim()) return err("label required");

  const device = await env.DB.prepare("SELECT id FROM devices WHERE id = ? AND user_id = ?").bind(device_id, session.userId).first();
  if (!device) return err("Device not found or not yours.", 404);

  await env.DB.prepare("UPDATE devices SET label = ? WHERE id = ?").bind(label.trim(), device_id).run();
  return json({ ok: true });
}

async function revokeDevice(request, env) {
  const session = await getSession(request, env);
  const denied = requireAuth(session);
  if (denied) return denied;

  let body;
  try { body = await request.json(); } catch { return err("Invalid JSON body"); }
  const { device_id } = body;
  if (!device_id) return err("device_id required");

  const device = await env.DB.prepare("SELECT id, user_id, revoked_at FROM devices WHERE id = ? AND user_id = ?").bind(device_id, session.userId).first();
  if (!device) return err("Device not found or not yours.", 404);
  if (device.revoked_at) return err("Already revoked.", 409);
  if (device_id === session.deviceId) return err("Cannot revoke your current device.", 400);

  const ts = now();
  await env.DB.batch([
    env.DB.prepare("UPDATE devices SET revoked_at = ? WHERE id = ?").bind(ts, device_id),
    env.DB.prepare("DELETE FROM sessions WHERE device_id = ?").bind(device_id)
  ]);
  return json({ ok: true, revoked_at: ts });
}

// =====================
//  RECEIPT HANDLERS
// =====================

async function uploadReceipt(request, env) {
  // Auth is optional — logged-in users get their profile attached,
  // anonymous users can still store receipts for free verification
  const session = await getSession(request, env);

  let body;
  try { body = await request.json(); } catch { return err("Invalid JSON body"); }
  const { combined } = body;
  if (!combined || combined.type !== "combined") return err("Body must include 'combined' with type:'combined'");

  const receiptHash = await sha256B64url(canonical(combined));
  const dup = await env.DB.prepare("SELECT id FROM receipts WHERE receipt_hash = ?").bind(receiptHash).first();
  if (dup) return json({ receipt_id: dup.id, receipt_hash: receiptHash, duplicate: true });

  const checks = await verifyReceipt(combined);
  const pkA = (combined.a && combined.a.pub) ? await pubKeyId(combined.a.pub) : "";
  const pkB = (combined.b && combined.b.pub) ? await pubKeyId(combined.b.pub) : "";
  const tsA = combined.a?.payload?.ts || null;
  const tsB = combined.b?.payload?.ts || null;
  const receiptId = uuid();
  const uploaderId = session ? session.userId : null;

  // Look up user info for both parties at upload time (snapshot)
  let partyA = null, partyB = null;
  if (pkA) {
    const devA = await env.DB.prepare("SELECT user_id FROM devices WHERE pub_key_id = ? AND revoked_at IS NULL").bind(pkA).first();
    if (devA) {
      const uA = await env.DB.prepare("SELECT display_name, google_picture FROM users WHERE id = ?").bind(devA.user_id).first();
      if (uA) partyA = { display_name: uA.display_name || null, google_picture: uA.google_picture || null };
    }
  }
  if (pkB) {
    const devB = await env.DB.prepare("SELECT user_id FROM devices WHERE pub_key_id = ? AND revoked_at IS NULL").bind(pkB).first();
    if (devB) {
      const uB = await env.DB.prepare("SELECT display_name, google_picture FROM users WHERE id = ?").bind(devB.user_id).first();
      if (uB) partyB = { display_name: uB.display_name || null, google_picture: uB.google_picture || null };
    }
  }

  // Store party info as JSON metadata alongside the receipt
  const partyInfo = JSON.stringify({ a: partyA, b: partyB });

  await env.DB.prepare(
    `INSERT INTO receipts (id, uploader_id, receipt_hash, pub_key_a, pub_key_b, ts_a, ts_b, receipt_json, verified, created_at, party_info) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(receiptId, uploaderId, receiptHash, pkA, pkB, tsA, tsB, JSON.stringify(combined), checks.valid ? 1 : 0, now(), partyInfo).run();
  return json({ receipt_id: receiptId, receipt_hash: receiptHash, verified: checks.valid, checks, party_info: { a: partyA, b: partyB } }, 201);
}

async function listReceipts(request, env) {
  const session = await getSession(request, env);
  const denied = requireAuth(session);
  if (denied) return denied;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
  const offset = (page - 1) * limit;

  // Include receipts where user uploaded OR where user's device key is party a or b
  const rows = await env.DB.prepare(
    `SELECT DISTINCT r.id, r.receipt_hash, r.pub_key_a, r.pub_key_b, r.ts_a, r.ts_b, r.verified, r.created_at
     FROM receipts r
     WHERE r.uploader_id = ?
        OR r.pub_key_a IN (SELECT pub_key_id FROM devices WHERE user_id = ?)
        OR r.pub_key_b IN (SELECT pub_key_id FROM devices WHERE user_id = ?)
     ORDER BY r.created_at DESC LIMIT ? OFFSET ?`
  ).bind(session.userId, session.userId, session.userId, limit, offset).all();

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM (
       SELECT DISTINCT r.id FROM receipts r
       WHERE r.uploader_id = ?
          OR r.pub_key_a IN (SELECT pub_key_id FROM devices WHERE user_id = ?)
          OR r.pub_key_b IN (SELECT pub_key_id FROM devices WHERE user_id = ?)
     )`
  ).bind(session.userId, session.userId, session.userId).first();
  return json({ receipts: rows.results || [], total: countRow ? countRow.cnt : 0, page, limit });
}

async function getReceipt(request, env, receiptHash) {
  const row = await env.DB.prepare(
    "SELECT id, receipt_hash, pub_key_a, pub_key_b, ts_a, ts_b, receipt_json, verified, created_at, party_info FROM receipts WHERE receipt_hash = ?"
  ).bind(receiptHash).first();
  if (!row) return err("Receipt not found", 404);
  let combined = null;
  try { combined = JSON.parse(row.receipt_json); } catch {}
  let partyInfo = null;
  try { if (row.party_info) partyInfo = JSON.parse(row.party_info); } catch {}
  // GPS coords are required for client-side hash/signature re-verification.
  // Stripping them breaks client verification. Do not strip.
  return json({ receipt_id: row.id, receipt_hash: row.receipt_hash, pub_key_a: row.pub_key_a, pub_key_b: row.pub_key_b, ts_a: row.ts_a, ts_b: row.ts_b, verified: !!row.verified, created_at: row.created_at, combined, party_info: partyInfo });
}

async function verify(request, env) {
  let body;
  try { body = await request.json(); } catch { return err("Invalid JSON body"); }
  const { combined } = body;
  if (!combined) return err("combined object required");
  const checks = await verifyReceipt(combined);
  checks.receipt_hash = await sha256B64url(canonical(combined));
  return json(checks);
}

// =====================
//  USER LOOKUP BY KEY
// =====================

async function lookupByKey(request, env, pubKeyIdParam) {
  const device = await env.DB.prepare(
    "SELECT user_id FROM devices WHERE pub_key_id = ? AND revoked_at IS NULL"
  ).bind(pubKeyIdParam).first();
  if (!device) return json({ found: false });
  const user = await env.DB.prepare(
    "SELECT display_name, google_picture FROM users WHERE id = ?"
  ).bind(device.user_id).first();
  if (!user) return json({ found: false });
  return json({ found: true, display_name: user.display_name || null, google_picture: user.google_picture || null });
}

// =====================
//  IDENTITY-BOUND SESSIONS — PROTOCOL.md §14 — Batch A
// =====================
// Three endpoints implement the QR-scan login flow:
//   POST /org/login/init  — desktop asks for a fresh login challenge
//   GET  /org/login/poll  — desktop polls for session arrival (1.5s cadence)
//   POST /org/login/claim — phone sends a v5-signed envelope binding the nonce
// Plus rate limiting (3 failed claims / 60s / nonce → 5min cooldown) and the
// generic auth_failed error to prevent user-enumeration oracles (§14.10).

const LOGIN_CHALLENGE_TTL_S  = 180;           // §14.5 — 3-minute login QR (was 60s, bumped 4 May after IRL test showed
                                              // 60s is too tight for a real human flow: scan + URL tap + page load +
                                              // biometric prompt + sign + POST commonly runs to ~30-60s naturally,
                                              // leaving zero margin. 180s still bounds the replay window narrowly
                                              // enough that a leaked QR is low-value.)
const LOGIN_SESSION_TTL_S    = 86400;         // §14.7 — 24h sliding TTL
const LOGIN_CLAIM_FAIL_LIMIT = 3;             // §14.10 — 3 attempts per nonce
const LOGIN_CLAIM_COOLDOWN_S = 300;           // §14.10 — 5min cooldown

function randomNonce16() {
  // 16 random bytes, base64url. ~22 char output. Single-use, 60s TTL.
  return b64urlEncode(crypto.getRandomValues(new Uint8Array(16)));
}

async function hashIp(request) {
  // SHA-256 of the source IP, hex truncated to 16 chars. Audit-only; never used
  // for authorisation. Cloudflare exposes the client IP on `cf-connecting-ip`.
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "";
  if (!ip) return null;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 16);
}

// Generic auth-failed error per §14.10 oracle defence — does NOT distinguish
// between "invalid signature" and "valid signature but unknown user" in
// production. Test env can opt into verbose diagnostics by setting the
// LOGIN_DEBUG worker secret to "1" (`wrangler secret put LOGIN_DEBUG` then
// paste 1). When LOGIN_DEBUG is on, the optional `debug` object is included
// in the response so client-side diagnostics surface the specific failure.
// THREAT-MODEL.md §XI.5 documents this verbose-mode caveat explicitly.
function genericAuthFailed(env, debug) {
  if (debug && env && env.LOGIN_DEBUG === "1") {
    return json(Object.assign({ error: "auth_failed" }, debug), 401);
  }
  return json({ error: "auth_failed" }, 401);
}

async function orgLoginInit(request, env) {
  // §14.4 step [2]: generate nonce, write login_challenges row, return for QR display.
  const nonce = randomNonce16();
  const tNow = now();
  const expiresAt = tNow + LOGIN_CHALLENGE_TTL_S;
  await env.DB.prepare(
    "INSERT INTO login_challenges (nonce, issued_at, expires_at, claimed_by, session_token, consumed, fail_count, locked_until) VALUES (?, ?, ?, NULL, NULL, 0, 0, 0)"
  ).bind(nonce, tNow, expiresAt).run();
  return json({ nonce, expires_at: expiresAt });
}

async function orgLoginPoll(request, env) {
  // §14.4 steps [4] and [11]: desktop polls for the session.
  const url = new URL(request.url);
  const nonce = (url.searchParams.get("nonce") || "").trim();
  if (!nonce) return err("nonce required");
  const row = await env.DB.prepare(
    "SELECT nonce, issued_at, expires_at, claimed_by, session_token, consumed FROM login_challenges WHERE nonce = ?"
  ).bind(nonce).first();
  if (!row) return json({ error: "challenge_expired" }, 410);
  if (row.expires_at < now() && !row.session_token) {
    // Expired before claim — single-shot 410.
    await env.DB.prepare("DELETE FROM login_challenges WHERE nonce = ?").bind(nonce).run();
    return json({ error: "challenge_expired" }, 410);
  }
  if (!row.session_token) return json({ status: "pending" });

  // Claimed. Resolve session + user + memberships, then mark consumed (single-use).
  const session = await env.DB.prepare(
    "SELECT token, user_id, expires_at FROM login_sessions WHERE token = ?"
  ).bind(row.session_token).first();
  if (!session) {
    // Session vanished (revoked between claim and poll). Treat as expired.
    await env.DB.prepare("DELETE FROM login_challenges WHERE nonce = ?").bind(nonce).run();
    return json({ error: "challenge_expired" }, 410);
  }
  const user = await env.DB.prepare(
    "SELECT id, display_name, pub_fp FROM portal_users WHERE id = ?"
  ).bind(session.user_id).first();
  const memberships = await env.DB.prepare(
    "SELECT m.role, o.id, o.name, o.slug FROM org_memberships m JOIN organisations o ON o.id = m.org_id WHERE m.user_id = ?"
  ).bind(session.user_id).all();
  const orgs = (memberships.results || []).map(m => ({ id: m.id, name: m.name, slug: m.slug, role: m.role }));

  // Developer can always create new orgs; lead_admin can also create new orgs (§14.9).
  // Bootstrap dev with no orgs yet still gets can_create_org: true.
  const is_developer = isBootstrapDeveloperFp(env, user.pub_fp);
  const can_create_org = is_developer
    || orgs.some(o => o.role === "developer" || o.role === "lead_admin");

  // v5.10.0.2 — Mirror userListOrgs's implicit-developer-access in the poll
  // response too. Without this, a bootstrap-fp user whose portal_users row
  // was freshly auto-created (no explicit org_memberships rows yet) sees
  // "Create your first org" even when orgs already exist on the platform.
  // PROTOCOL.md §14.9 — developer is a platform-tier role and gets implicit
  // "see all orgs" rights so they can recover orgs whose lead_admins have
  // left, perform forensic audits, or simply observe the platform.
  if (is_developer) {
    const ownIds = new Set(orgs.map(o => o.id));
    const allOrgs = await env.DB.prepare(
      "SELECT id, name, slug FROM organisations ORDER BY created_at DESC"
    ).all();
    for (const o of (allOrgs.results || [])) {
      if (!ownIds.has(o.id)) {
        orgs.push({ id: o.id, name: o.name, slug: o.slug, role: 'developer', implicit_membership: true });
      }
    }
  }

  // Mark challenge consumed (single-shot; subsequent polls 410).
  await env.DB.prepare("UPDATE login_challenges SET consumed = 1 WHERE nonce = ?").bind(nonce).run();

  return json({
    status: "claimed",
    session_token: row.session_token,
    user_id: user.id,
    display_name: user.display_name,
    orgs,
    can_create_org,
    is_developer
  });
}

async function orgLoginClaim(request, env) {
  // §14.4 steps [7]–[9]: phone sends signed envelope binding the nonce.
  let body;
  try { body = await request.json(); } catch { return err("Invalid JSON"); }
  const { nonce, pub_jwk, sig, webauthn } = body || {};
  if (!nonce || !pub_jwk || !sig || !webauthn) return genericAuthFailed();

  // Look up challenge row first — order matters for rate-limit accounting.
  const challenge = await env.DB.prepare(
    "SELECT nonce, issued_at, expires_at, claimed_by, session_token, consumed, fail_count, locked_until FROM login_challenges WHERE nonce = ?"
  ).bind(nonce).first();
  if (!challenge) return json({ error: "challenge_expired" }, 410);
  const tNow = now();
  if (challenge.expires_at < tNow) {
    return json({ error: "challenge_expired" }, 410);
  }
  if (challenge.session_token) {
    // Already claimed by a previous successful POST. Idempotent rejection.
    return json({ error: "challenge_expired" }, 410);
  }
  if (challenge.locked_until > tNow) {
    return json({ error: "rate_limited", retry_after: challenge.locked_until - tNow }, 429);
  }

  // Verify the v5 envelope. Payload to verify is { nonce, type: "irlid_login_v5" } —
  // the phone signs exactly this object. The `type` discriminator binds the signature
  // to the login context so an envelope produced here cannot be replayed in any other
  // v5-signing context (PROTOCOL.md §14.10). The challenge inside webauthn.clientData
  // must equal SHA-256-b64url(canonical({nonce, type:"irlid_login_v5"})). v5-only (§14.13).
  // TEST-ENV DEBUG: capture the specific verifier error so we can diagnose failures
  // without deploy cycles. PROTOCOL.md §14.10 anti-enumeration only matters in
  // production with a real user database; test env has one user (Captain), so
  // verbose errors trade nothing.
  let envelopeOk = false;
  let envelopeErr = "";
  try {
    await verifyV5Envelope({ nonce, type: "irlid_login_v5" }, pub_jwk, sig, webauthn);
    envelopeOk = true;
  } catch (e) {
    envelopeOk = false;
    envelopeErr = (e && e.message) ? String(e.message) : String(e);
  }

  if (!envelopeOk) {
    // Increment fail_count; if at limit, lock for cooldown.
    const newFails = (challenge.fail_count || 0) + 1;
    if (newFails >= LOGIN_CLAIM_FAIL_LIMIT) {
      await env.DB.prepare(
        "UPDATE login_challenges SET fail_count = ?, locked_until = ? WHERE nonce = ?"
      ).bind(newFails, tNow + LOGIN_CLAIM_COOLDOWN_S, nonce).run();
      const rateBody = { error: "rate_limited", retry_after: LOGIN_CLAIM_COOLDOWN_S };
      if (env.LOGIN_DEBUG === "1") rateBody.debug_reason = "envelope_failed: " + envelopeErr;
      return json(rateBody, 429);
    } else {
      await env.DB.prepare(
        "UPDATE login_challenges SET fail_count = ? WHERE nonce = ?"
      ).bind(newFails, nonce).run();
      return genericAuthFailed(env, { debug_reason: "envelope_verify_failed", debug_detail: envelopeErr });
    }
  }

  // Envelope verified. Compute pub_fp (matches existing device_pub_fp pattern, 16 chars).
  const fp = await deviceKeyFp(pub_jwk);
  if (!fp) return genericAuthFailed(env, { debug_reason: "fp_compute_failed" });

  // Look up or bootstrap user.
  let user = await env.DB.prepare(
    "SELECT id, display_name FROM portal_users WHERE pub_fp = ?"
  ).bind(fp).first();

  if (!user) {
    // v5.9.14.2 — Brief A guest-onboarding fix. Previously the claim endpoint
    // only auto-created portal_users rows for BOOTSTRAP_DEVELOPER_FP fingerprints
    // and rejected everything else with auth_failed. That created a chicken-and-egg
    // problem for staff-invite QR redemption: the invite endpoint requires a session
    // (Bearer), the session comes from claim, claim required a pre-existing user.
    // Since the portal_users row by itself grants no permissions — all power comes
    // from org_memberships rows — there is no security cost to auto-creating it
    // here. The WebAuthn UV requirement on each request rate-limits abuse to one
    // row per user gesture.
    //
    // Bootstrap fps still get the "Developer (Super-Admin)" display name and are
    // implicitly recognised as developers by orgRoleForUser() via isBootstrapDeveloperFp().
    // Non-bootstrap users get a neutral display name; their memberships and powers
    // come from invite redemption or doorman bind later.
    const bootstrapFps = bootstrapDeveloperFps(env);
    const isBootstrap = bootstrapFps.length > 0 && bootstrapFps.includes(fp);
    const userId = randomToken().slice(0, 26);
    const displayName = isBootstrap ? "Developer (Super-Admin)" : "New member";
    await env.DB.prepare(
      "INSERT INTO portal_users (id, pub_jwk, pub_fp, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(userId, JSON.stringify(pub_jwk), fp, displayName, tNow, tNow).run();
    user = { id: userId, display_name: displayName };
  }

  // Issue session.
  const sessionToken = randomToken();
  const sessionExpires = tNow + LOGIN_SESSION_TTL_S;
  const ipHash = await hashIp(request);
  const ua = (request.headers.get("user-agent") || "").slice(0, 256);
  await env.DB.prepare(
    "INSERT INTO login_sessions (token, user_id, issued_at, expires_at, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(sessionToken, user.id, tNow, sessionExpires, ipHash, ua).run();

  // Bind session to challenge for the desktop poll to pick up.
  await env.DB.prepare(
    "UPDATE login_challenges SET claimed_by = ?, session_token = ? WHERE nonce = ?"
  ).bind(user.id, sessionToken, nonce).run();

  return json({ ok: true });
}

// =====================
//  CROSS-DEVICE ACTION AUTHORIZATION - v6.1
// =====================
// Mirrors the QR-login shape, but stores a full per-action payload for an
// enrolled phone to sign. The pending action nonce is also the signed action
// nonce, binding QR, WebAuthn challenge, and replay guard into one object.

const ACTION_AUTH_TTL_MS = 180000;
const ACTION_CLAIM_FAIL_LIMIT = 3;
const ACTION_CLAIM_COOLDOWN_MS = 300000;

function publicBaseUrlFrom(request) {
  const url = new URL(request.url);
  return url.origin.replace(/\/+$/, "");
}

function publicSiteOriginFrom(request, env) {
  const configured = String((env && (env.PUBLIC_SITE_ORIGIN || env.IRLID_SITE_ORIGIN)) || "").trim();
  if (configured) return configured.replace(/\/+$/, "");
  const worker = new URL(request.url);
  if (/localhost|127\.0\.0\.1|\[::1\]/.test(worker.host)) return worker.origin;
  return "https://irlid.co.uk";
}

function normalisePendingActionPayload(actionType, orgId, payload, requestorUser) {
  const clean = Object.assign({}, payload || {});
  delete clean.sig;
  delete clean.pub;
  delete clean.webauthn;
  clean.type = actionType;
  clean.org_id = String(orgId || clean.org_id || "");
  if (requestorUser && actionType === "irlid_invite_v5") {
    clean.issuer_pub_fp = requestorUser.pub_fp;
  }
  return clean;
}

async function orgActionInit(request, env) {
  const ctx = await requireSession(request, env);
  if (ctx.error) return ctx.error;

  let body;
  try { body = await request.json(); } catch { return err("Invalid JSON"); }
  const actionType = String(body.action_type || body.actionType || "").trim();
  if (!/^irlid_[a-z_]+_v5$/.test(actionType)) return err("invalid_action_type");
  if (!["irlid_invite_v5", "irlid_calendar_write_v5"].includes(actionType)) return json({ error: "unsupported_action_type" }, 400);
  const actionPayloadIn = body.action_payload || body.actionPayload || {};
  const orgId = String(actionPayloadIn.org_id || body.org_id || body.orgId || "").trim();
  if (!orgId) return err("org_id required");

  const org = await env.DB.prepare("SELECT id, name, slug, settings_json FROM organisations WHERE id = ?")
    .bind(orgId).first();
  if (!org) return json({ error: "org_not_found" }, 404);
  const role = await orgRoleForUser(env, ctx.user, org.id);
  const requiredRole = await pendingActionMinRole(env, actionType, org);
  if (expectedRoleRank(role) < expectedRoleRank(requiredRole)) {
    return json({ error: "insufficient_role", required: requiredRole, actual: role || null }, 403);
  }

  const tMs = Date.now();
  const nonce = randomToken();
  const actionPayload = normalisePendingActionPayload(actionType, org.id, actionPayloadIn, ctx.user);
  actionPayload.timestamp = Number(actionPayload.timestamp || tMs);
  actionPayload.nonce = nonce;
  const summary = String(body.action_summary || body.actionSummary || actionType).trim().slice(0, 240);
  const expiresAt = tMs + ACTION_AUTH_TTL_MS;
  await env.DB.prepare(
    "INSERT INTO pending_action_authorizations (nonce, org_id, requestor_user_id, action_type, action_payload_json, action_summary, created_at, expires_at, status, fail_count, locked_until) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0)"
  ).bind(nonce, org.id, ctx.user.id, actionType, JSON.stringify(actionPayload), summary, tMs, expiresAt).run();

  const authUrl = publicSiteOriginFrom(request, env) + "/org-action-auth.html?nonce=" +
    encodeURIComponent(nonce) + "&worker=" + encodeURIComponent(publicBaseUrlFrom(request));
  return json({ ok: true, nonce, expires_at: expiresAt, auth_url: authUrl });
}

async function orgActionPoll(request, env, pathNonce) {
  const url = new URL(request.url);
  const nonce = String(pathNonce || url.searchParams.get("nonce") || "").trim();
  if (!nonce) return err("nonce required");
  const row = await env.DB.prepare(
    "SELECT nonce, action_type, action_payload_json, action_summary, expires_at, claimed_at, status, action_result_json FROM pending_action_authorizations WHERE nonce = ?"
  ).bind(nonce).first();
  if (!row) return json({ error: "action_not_found" }, 404);
  const tMs = Date.now();
  if (row.status === "pending" && Number(row.expires_at) <= tMs) {
    await env.DB.prepare("UPDATE pending_action_authorizations SET status='expired' WHERE nonce=? AND status='pending'")
      .bind(nonce).run();
    return json({ ok: true, status: "expired", expires_at: row.expires_at });
  }
  if (row.status === "claimed") {
    let actionResult = null;
    try { actionResult = row.action_result_json ? JSON.parse(row.action_result_json) : null; } catch (_) {}
    return json({ ok: true, status: "claimed", claimed_at: row.claimed_at, action_result: actionResult });
  }
  if (row.status === "rejected") return json({ ok: true, status: "rejected", expires_at: row.expires_at });
  if (row.status === "expired") return json({ ok: true, status: "expired", expires_at: row.expires_at });

  let payload = null;
  try { payload = JSON.parse(row.action_payload_json); } catch (_) {}
  return json({
    ok: true,
    status: "pending",
    action_summary: row.action_summary,
    action_type: row.action_type,
    action_payload: payload,
    expires_at: row.expires_at
  });
}

function inviteActionPayloadSchema(p) {
  return !!(p && p.type === "irlid_invite_v5" && p.org_id && inviteRole(p.role) &&
    p.label && p.issuer_pub_fp && p.expiry_ts && p.nonce);
}

function calendarActionPayloadSchema(p) {
  const action = String((p && p.calendar_action) || "").trim();
  if (!p || p.type !== "irlid_calendar_write_v5" || !p.org_id || !p.nonce) return false;
  if (!["create", "update", "delete"].includes(action)) return false;
  if ((action === "update" || action === "delete") && !p.event_id) return false;
  return true;
}

function managerCalendarPermEnabledFromSettings(settingsJson) {
  try {
    const settings = typeof settingsJson === "string" ? JSON.parse(settingsJson || "{}") : (settingsJson || {});
    return !!(settings && settings.manager_perms && settings.manager_perms.calendar === true);
  } catch (_) {
    return false;
  }
}

async function calendarWriteMinRoleForOrg(env, orgOrId) {
  if (!orgOrId) return "lead_admin";
  if (typeof orgOrId === "object" && Object.prototype.hasOwnProperty.call(orgOrId, "settings_json")) {
    return managerCalendarPermEnabledFromSettings(orgOrId.settings_json) ? "manager" : "lead_admin";
  }
  const orgId = String(orgOrId || "").trim();
  if (!orgId) return "lead_admin";
  const row = await env.DB.prepare("SELECT settings_json FROM organisations WHERE id=? LIMIT 1").bind(orgId).first();
  return managerCalendarPermEnabledFromSettings(row && row.settings_json) ? "manager" : "lead_admin";
}

async function pendingActionMinRole(env, actionType, orgId) {
  if (actionType === "irlid_calendar_write_v5") return calendarWriteMinRoleForOrg(env, orgId);
  return "lead_admin";
}

function pendingActionPayloadSchema(actionType) {
  if (actionType === "irlid_invite_v5") return inviteActionPayloadSchema;
  if (actionType === "irlid_calendar_write_v5") return calendarActionPayloadSchema;
  return () => false;
}

async function executeVerifiedPendingAction(env, action) {
  const payload = action.payload || {};
  if (payload.type === "irlid_calendar_write_v5") {
    return executeVerifiedCalendarAction(env, action);
  }
  if (payload.type !== "irlid_invite_v5") {
    return { error: json({ error: "unsupported_action_type" }, 400) };
  }
  const role = inviteRole(payload.role);
  if (!role) return { error: inviteJsonError("invalid_invite_role", "Invite role must be staff or manager.", 400) };
  if (payload.issuer_pub_fp !== action.authorized_by_user.pub_fp) {
    return { error: inviteJsonError("invalid_invite_payload", "Signed invite issuer does not match the authorising user.", 400) };
  }
  const tMs = Date.now();
  const expiryTs = Math.floor(Number(payload.expiry_ts));
  if (!Number.isFinite(expiryTs) || expiryTs <= tMs || expiryTs > tMs + 3600000) {
    return { error: inviteJsonError("invalid_invite_payload", "Invite expiry is invalid.", 400) };
  }
  const invite = Object.assign({}, payload, {
    sig: action.signed_envelope.sig,
    pub: action.signed_envelope.pub,
    webauthn: action.signed_envelope.webauthn
  });
  let verifiedIssuer = null;
  try { verifiedIssuer = await verifyInvitePayloadSignature(env, invite); } catch (_) { verifiedIssuer = null; }
  if (!verifiedIssuer) return { error: inviteJsonError("invite_bad_signature", "Invite signature could not be verified.", 400) };
  if (verifiedIssuer.role !== "lead_admin" && verifiedIssuer.role !== "developer") {
    return { error: inviteJsonError("issuer_role_revoked", "The invite issuer no longer has authority for this organisation.", 403) };
  }
  const encodedInvite = encodeInvitePayload(invite);
  const inserted = await insertOrgInvite(env, {
    nonce: payload.nonce,
    org_id: payload.org_id,
    role,
    label: payload.label,
    issuer_pub_fp: payload.issuer_pub_fp,
    expiry_ts: expiryTs,
    created_ts: tMs,
    envelope: encodedInvite
  });
  return {
    ok: true,
    result: {
      invite_qr: encodedInvite,
      expiry_ts: expiryTs,
      nonce: payload.nonce,
      // v6.4.10 — present ONLY when the envelope was stored server-side, so the
      // client knows a slim nonce-reference QR can be resolved at accept time.
      ...(inserted.envelopeStored ? { invite_token_ref: payload.nonce } : {})
    }
  };
}

// v6.4.10 (PR-4 QR diet) — does org_invites carry the envelope column?
// Same defensive pattern as orgInvitesHasLabelColumn: the column arrives via
// migration 2026-06-11-v6.4.10-invite-envelope.sql, and the Worker must work
// correctly on a database that has not been migrated yet (falls back to the
// fat-QR behaviour: no stored envelope, no invite_token_ref in the response).
async function orgInvitesHasEnvelopeColumn(env) {
  try {
    const info = await env.DB.prepare("PRAGMA table_info(org_invites)").all();
    return (info.results || []).some(c => c.name === "envelope");
  } catch (_) { return false; }
}

async function orgInvitesHasLabelColumn(env) {
  try {
    const info = await env.DB.prepare("PRAGMA table_info(org_invites)").all();
    return (info.results || []).some(c => c.name === "label");
  } catch (_) {
    return false;
  }
}

async function insertOrgInvite(env, invite) {
  // v6.4.10 — columns built dynamically so the Worker tolerates databases at
  // any migration stage (base / +label / +envelope). The envelope column stores
  // the EXACT encoded "I:" string handed to the issuer, so the slim-QR fetch
  // path can return it verbatim and the accept-time byte-for-byte binding
  // (acceptPayload.invite_token === inviteToken) keeps holding unchanged.
  const cols = ["nonce", "org_id", "role", "issuer_pub_fp", "expiry_ts", "status", "created_ts"];
  const vals = [invite.nonce, invite.org_id, invite.role, invite.issuer_pub_fp, invite.expiry_ts, "pending", invite.created_ts];
  if (await orgInvitesHasLabelColumn(env)) {
    cols.splice(3, 0, "label");
    vals.splice(3, 0, String(invite.label || "").trim().slice(0, 120));
  }
  let envelopeStored = false;
  if (invite.envelope && await orgInvitesHasEnvelopeColumn(env)) {
    cols.push("envelope");
    vals.push(String(invite.envelope));
    envelopeStored = true;
  }
  await env.DB.prepare(
    "INSERT INTO org_invites (" + cols.join(",") + ") VALUES (" + cols.map(() => "?").join(",") + ")"
  ).bind(...vals).run();
  return { envelopeStored };
}

async function executeVerifiedCalendarAction(env, action) {
  const body = Object.assign({}, action.payload || {});
  const calendarAction = String(body.calendar_action || "").trim();
  const orgId = String(body.org_id || "").trim();
  const authorizedBy = action.authorized_by_user?.id || action.user?.id || null;
  if (calendarAction === "create") {
    return orgWeeklyEventCreateFromPayload(env, orgId, body, authorizedBy);
  }
  if (calendarAction === "update") {
    return orgWeeklyEventUpdateFromPayload(env, orgId, body, authorizedBy);
  }
  if (calendarAction === "delete") {
    return orgWeeklyEventDeleteFromPayload(env, orgId, body);
  }
  return { error: json({ error: "unsupported_calendar_action" }, 400) };
}

async function orgWeeklyEventCreateFromPayload(env, orgId, body, authorizedBy) {
  const createBody = Object.assign({}, body || {});
  if (!createBody.id && createBody.event_id) createBody.id = createBody.event_id;
  const ev = cleanEventBody(createBody);
  ev.id = cleanOptionalText(ev.id, 90) || newEventId();
  const inputError = validateEventInput(ev);
  if (inputError) return { error: err(inputError) };
  const expectedCheck = await calendarActionExpectedIdsForOrg(env, orgId, createBody.expected_ids || [], "create");
  const t = now();
  const statements = [
    env.DB.prepare(
      "INSERT INTO weekly_events (id,org_id,room_id,name,day_of_week,start_time_local,duration_min,capacity,color_hex,notes,require_proof,late_grace_min,created_at,archived_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)"
    ).bind(ev.id, orgId, ev.room_id, ev.name, ev.day_of_week, ev.start_time_local, Math.floor(ev.duration_min), ev.capacity, ev.color_hex, ev.notes, ev.require_proof, ev.late_grace_min, t)
  ];
  for (const expectedId of expectedCheck.ids) {
    statements.push(env.DB.prepare(
      "INSERT OR IGNORE INTO event_expected (event_id,expected_id,added_at,added_by) VALUES (?,?,?,?)"
    ).bind(ev.id, expectedId, t, authorizedBy));
  }
  await env.DB.batch(statements);
  const events = await rowsForWeeklyEvents(env, orgId, {});
  return { ok: true, result: { event_id: ev.id, event: events.find(e => e.id === ev.id) || null } };
}

async function orgWeeklyEventUpdateFromPayload(env, orgId, body, authorizedBy) {
  const id = String(body.event_id || body.id || "").trim();
  const existing = await env.DB.prepare(
    "SELECT * FROM weekly_events WHERE id=? AND org_id=? AND archived_at IS NULL"
  ).bind(id, orgId).first();
  if (!existing) return { error: err("Weekly event not found", 404) };
  const ev = cleanEventBody(body, existing);
  ev.id = id;
  const inputError = validateEventInput(ev);
  if (inputError) return { error: err(inputError) };
  const expectedCheck = body.expected_ids !== undefined ? await calendarActionExpectedIdsForOrg(env, orgId, body.expected_ids, "update") : null;
  const statements = [
    env.DB.prepare(
      "UPDATE weekly_events SET room_id=?,name=?,day_of_week=?,start_time_local=?,duration_min=?,capacity=?,color_hex=?,notes=?,require_proof=?,late_grace_min=? WHERE id=? AND org_id=?"
    ).bind(ev.room_id, ev.name, ev.day_of_week, ev.start_time_local, Math.floor(ev.duration_min), ev.capacity, ev.color_hex, ev.notes, ev.require_proof, ev.late_grace_min, id, orgId)
  ];
  if (expectedCheck) {
    const currentRows = await env.DB.prepare("SELECT expected_id FROM event_expected WHERE event_id=?").bind(id).all();
    const current = new Set((currentRows.results || []).map(r => r.expected_id));
    const next = new Set(expectedCheck.ids);
    const t = now();
    for (const expectedId of next) {
      if (!current.has(expectedId)) {
        statements.push(env.DB.prepare(
          "INSERT OR IGNORE INTO event_expected (event_id,expected_id,added_at,added_by) VALUES (?,?,?,?)"
        ).bind(id, expectedId, t, authorizedBy));
      }
    }
    for (const expectedId of current) {
      if (!next.has(expectedId)) {
        statements.push(env.DB.prepare("DELETE FROM event_expected WHERE event_id=? AND expected_id=?").bind(id, expectedId));
      }
    }
  }
  await env.DB.batch(statements);
  const events = await rowsForWeeklyEvents(env, orgId, {});
  return { ok: true, result: { event: events.find(e => e.id === id) || null } };
}

async function orgWeeklyEventDeleteFromPayload(env, orgId, body) {
  const id = String(body.event_id || body.id || "").trim();
  const t = now();
  const result = await env.DB.prepare(
    "UPDATE weekly_events SET archived_at=COALESCE(archived_at,?) WHERE id=? AND org_id=?"
  ).bind(t, id, orgId).run();
  if (!(result.meta?.changes || 0)) return { error: err("Weekly event not found", 404) };
  return { ok: true, result: { deleted: true, archived: true, id, archived_at: t } };
}

async function orgActionClaim(request, env) {
  let body;
  try { body = await request.json(); } catch { return err("Invalid JSON"); }
  const nonce = String((body && body.nonce) || "").trim();
  if (!nonce) return err("nonce required");
  const row = await env.DB.prepare("SELECT * FROM pending_action_authorizations WHERE nonce = ?")
    .bind(nonce).first();
  if (!row) return json({ error: "action_not_found" }, 404);
  const tMs = Date.now();
  if (Number(row.expires_at) <= tMs && row.status === "pending") {
    await env.DB.prepare("UPDATE pending_action_authorizations SET status='expired' WHERE nonce=? AND status='pending'")
      .bind(nonce).run();
    return json({ error: "action_expired" }, 410);
  }
  if (row.status !== "pending") {
    return json({ error: row.status === "claimed" ? "nonce_already_used" : "action_" + row.status }, 409);
  }
  if (Number(row.locked_until || 0) > tMs) {
    return json({ error: "rate_limited", retry_after: Math.ceil((Number(row.locked_until) - tMs) / 1000) }, 429);
  }
  if (String(body.status || "").toLowerCase() === "rejected") {
    await env.DB.prepare("UPDATE pending_action_authorizations SET status='rejected' WHERE nonce=? AND status='pending'")
      .bind(nonce).run();
    return json({ ok: true, status: "rejected" });
  }

  let storedPayload;
  try { storedPayload = JSON.parse(row.action_payload_json); } catch { return err("stored_action_corrupt", 500); }
  const signedEnvelope = body.signed_envelope || body.signed_action || null;
  const signedPayload = signedEnvelope && signedEnvelope.payload;
  const storedHash = await sha256DeepB64url(storedPayload);
  const signedHash = await sha256DeepB64url(signedPayload || {});
  if (!signedEnvelope || storedHash !== signedHash) {
    const fails = Number(row.fail_count || 0) + 1;
    const lockedUntil = fails >= ACTION_CLAIM_FAIL_LIMIT ? tMs + ACTION_CLAIM_COOLDOWN_MS : 0;
    await env.DB.prepare("UPDATE pending_action_authorizations SET fail_count=?, locked_until=? WHERE nonce=?")
      .bind(fails, lockedUntil, nonce).run();
    return json({ error: fails >= ACTION_CLAIM_FAIL_LIMIT ? "rate_limited" : "action_payload_mismatch" }, fails >= ACTION_CLAIM_FAIL_LIMIT ? 429 : 400);
  }

  const action = await requireSignedAction({ signed_action: signedEnvelope }, env, {
    expectedType: row.action_type,
    orgId: row.org_id,
    minRole: await pendingActionMinRole(env, row.action_type, row.org_id),
    payloadSchema: pendingActionPayloadSchema(row.action_type)
  });
  if (action.error) {
    const fails = Number(row.fail_count || 0) + 1;
    const lockedUntil = fails >= ACTION_CLAIM_FAIL_LIMIT ? tMs + ACTION_CLAIM_COOLDOWN_MS : 0;
    await env.DB.prepare("UPDATE pending_action_authorizations SET fail_count=?, locked_until=? WHERE nonce=?")
      .bind(fails, lockedUntil, nonce).run();
    return fails >= ACTION_CLAIM_FAIL_LIMIT ? json({ error: "rate_limited", retry_after: ACTION_CLAIM_COOLDOWN_MS / 1000 }, 429) : action.error;
  }
  action.signed_envelope = signedEnvelope;

  const executed = await executeVerifiedPendingAction(env, action);
  if (executed.error) return executed.error;
  await env.DB.prepare(
    "UPDATE pending_action_authorizations SET status='claimed', claimed_at=?, signed_envelope_json=?, action_result_json=? WHERE nonce=? AND status='pending'"
  ).bind(tMs, JSON.stringify(signedEnvelope), JSON.stringify(executed.result), nonce).run();
  return json({ ok: true, action_result: executed.result });
}

// =====================
//  USER ENDPOINTS — PROTOCOL.md §14, Batch C
// =====================
// Session-authenticated user-level endpoints. Auth via Authorization: Bearer <token>
// where the token came from /org/login/poll on a successful claim. The Worker resolves
// the token to a portal_users row, slides the session expiry forward, and the calling
// endpoint operates with that user identity.

async function requireSession(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const m = /^Bearer\s+([A-Za-z0-9_-]{16,})$/.exec(auth.trim());
  if (!m) return { error: json({ error: "session_required" }, 401) };
  const token = m[1];
  const session = await env.DB.prepare(
    "SELECT token, user_id, expires_at FROM login_sessions WHERE token = ?"
  ).bind(token).first();
  if (!session) return { error: json({ error: "session_invalid" }, 401) };
  const tNow = now();
  if (session.expires_at < tNow) {
    // Expired — clean up and reject.
    await env.DB.prepare("DELETE FROM login_sessions WHERE token = ?").bind(token).run();
    return { error: json({ error: "session_expired" }, 401) };
  }
  // Sliding TTL — every authed request resets expires_at.
  await env.DB.prepare(
    "UPDATE login_sessions SET expires_at = ? WHERE token = ?"
  ).bind(tNow + LOGIN_SESSION_TTL_S, token).run();
  // Resolve the user.
  const user = await env.DB.prepare(
    "SELECT id, display_name, pub_fp FROM portal_users WHERE id = ?"
  ).bind(session.user_id).first();
  if (!user) return { error: json({ error: "session_user_missing" }, 401) };
  return { user };
}

async function userSignOutAllDevices(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (!m) return json({ error: "missing_bearer" }, 401);
  const token = m[1].trim();
  if (!token) return json({ error: "missing_bearer" }, 401);

  const session = await env.DB.prepare(
    "SELECT user_id FROM login_sessions WHERE token = ?"
  ).bind(token).first();
  if (!session) return json({ error: "auth_failed" }, 401);

  const result = await env.DB.prepare(
    "DELETE FROM login_sessions WHERE user_id = ?"
  ).bind(session.user_id).run();
  return json({ ok: true, sessions_revoked: result.meta?.changes || 0 });
}

// GET /user/orgs — list orgs the authenticated user belongs to, with role and api_key
// (api_key is returned to authorized members so the existing X-Org-Key dashboard code
// can keep working during the v5.5 transition; v6+ will move dashboard ops onto Bearer
// session auth and api_key returns to service-account-only). Per §14.9 role table.
async function userListOrgs(request, env) {
  const ctx = await requireSession(request, env);
  if (ctx.error) return ctx.error;
  const user = ctx.user;
  const memberships = await env.DB.prepare(
    "SELECT m.role, o.id, o.name, o.slug, o.api_key, o.settings_json " +
    "FROM org_memberships m JOIN organisations o ON o.id = m.org_id WHERE m.user_id = ? " +
    "ORDER BY m.granted_at ASC"
  ).bind(user.id).all();
  const orgs = (memberships.results || []).map(m => {
    let settings = null;
    try { settings = m.settings_json ? JSON.parse(m.settings_json) : null; } catch (_) {}
    return {
      id: m.id,
      name: m.name,
      slug: m.slug,
      role: m.role,
      api_key: m.api_key,
      settings,
      implicit_membership: false
    };
  });

  // PROTOCOL.md §14.9 — `developer` is a platform-tier role, not just an org-tier
  // role. The bootstrap developer (whose pub_fp matches BOOTSTRAP_DEVELOPER_FP) is
  // the founder of the IRLid deployment and gets implicit "see all orgs" rights
  // so they can recover orgs whose lead_admins have left, perform forensic audits,
  // or simply observe the platform. Non-bootstrap users only see orgs they
  // explicitly belong to (per §14.9 row "lead_admin"). This dev-implicit access is
  // returned alongside explicit memberships with role: 'developer' and a flag
  // implicit_membership: true so the UI can label the difference (e.g. "(dev access)").
  // Captain's 4 May expectation that "developer" means "super admin who can fix any
  // org" — confirmed in spec, now matched in implementation.
  const isBootstrapDev = isBootstrapDeveloperFp(env, user.pub_fp);
  if (isBootstrapDev) {
    const ownIds = new Set(orgs.map(o => o.id));
    const allOrgs = await env.DB.prepare(
      "SELECT id, name, slug, api_key, settings_json FROM organisations ORDER BY created_at DESC"
    ).all();
    for (const o of (allOrgs.results || [])) {
      if (!ownIds.has(o.id)) {
        let settings = null;
        try { settings = o.settings_json ? JSON.parse(o.settings_json) : null; } catch (_) {}
        orgs.push({
          id: o.id,
          name: o.name,
          slug: o.slug,
          role: 'developer',
          api_key: o.api_key,
          settings,
          implicit_membership: true
        });
      }
    }
  }

  return json({ user_id: user.id, display_name: user.display_name, orgs, is_developer: isBootstrapDev });
}

// POST /user/create-org — create a new organisation with the authenticated user as
// lead_admin (or developer if user.pub_fp is the bootstrap fp). Authorization:
//   • developer (pub_fp matches BOOTSTRAP_DEVELOPER_FP), OR
//   • user has lead_admin or developer role on at least one existing org
// Body: { name: string (required, min 2), website_url?: string (optional, https/http) }
// Staff scan-in flow deferred to Batch C.5 — MVP creates the org with the requester
// as the sole member; additional members get added via dashboard "Add staff" actions.
async function userCreateOrg(request, env) {
  const ctx = await requireSession(request, env);
  if (ctx.error) return ctx.error;
  const user = ctx.user;

  let body;
  try { body = await request.json(); } catch { return err("Invalid JSON"); }
  const name = (body && typeof body.name === "string") ? body.name.trim() : "";
  const websiteUrl = (body && typeof body.website_url === "string") ? body.website_url.trim() : "";
  if (!name || name.length < 2) return err("name required (min 2 chars)");
  if (websiteUrl && !/^https?:\/\/[^\s]{3,}$/i.test(websiteUrl)) return err("website_url must be a valid http(s) URL or omitted");

  // Authorization check: developer OR has lead_admin/developer role somewhere.
  const isBootstrapDev = isBootstrapDeveloperFp(env, user.pub_fp);
  let hasAdminRole = false;
  if (!isBootstrapDev) {
    const elevated = await env.DB.prepare(
      "SELECT 1 FROM org_memberships WHERE user_id = ? AND role IN ('lead_admin','developer') LIMIT 1"
    ).bind(user.id).first();
    hasAdminRole = !!elevated;
  }
  if (!isBootstrapDev && !hasAdminRole) {
    return json({ error: "create_org_forbidden", reason: "only developer or existing lead_admin may create orgs" }, 403);
  }

  // Slug + uniqueness check.
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) return err("name produced empty slug — use letters/numbers");
  const existing = await env.DB.prepare("SELECT id FROM organisations WHERE slug = ?").bind(slug).first();
  if (existing) return err("Organisation name already taken (slug collision)");

  // Provision the org row + venue keypair (mirrors orgRegister).
  const orgId = uuid();
  const apiKey = "org_" + randomToken();
  const tNow = now();
  const venueKey = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pubJwk = await crypto.subtle.exportKey("jwk", venueKey.publicKey);
  const prvJwk = await crypto.subtle.exportKey("jwk", venueKey.privateKey);
  const defaultSettings = {
    minScore: 50, distanceM: 12, windowS: 90,
    bioRequired: false, privacyMode: true, checkoutEnabled: true, anonymousMode: false,
    websiteUrl: websiteUrl || ""
    // theme_scrape_status: "queued" once Batch D ships the website-scrape worker function.
  };
  await env.DB.prepare(
    "INSERT INTO organisations (id, name, slug, api_key, venue_pub_jwk, venue_prv_jwk, settings_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)"
  ).bind(orgId, name, slug, apiKey, JSON.stringify(pubJwk), JSON.stringify(prvJwk), JSON.stringify(defaultSettings), tNow, tNow).run();

  // Insert the creator's membership. Bootstrap developer keeps developer role; everyone
  // else becomes lead_admin of their own new org. Per Captain's 4 May direction
  // ("orgs only have one Lead Admin"), the schema doesn't yet enforce uniqueness
  // but we check at insert time. For org creation this is automatic — a new org
  // has no existing memberships — but the same check fires when invite-claim
  // promotes someone to lead_admin (Batch C.5). Developer override path is a
  // future v6+ admin tool (rescue scenarios when the sole lead_admin loses their
  // device). For now, one primary lead_admin per org is the contract.
  const role = isBootstrapDev ? "developer" : "lead_admin";
  if (role === "lead_admin") {
    const existingLead = await env.DB.prepare(
      "SELECT user_id FROM org_memberships WHERE org_id = ? AND role = 'lead_admin' LIMIT 1"
    ).bind(orgId).first();
    if (existingLead) {
      // Should never happen for a fresh org, but defensive: if somehow there
      // already is a lead_admin, fall back to manager rather than violating the
      // one-lead_admin-per-org contract.
      return err("Org already has a lead_admin (unexpected) — contact developer", 409);
    }
  }
  await env.DB.prepare(
    "INSERT INTO org_memberships (user_id, org_id, role, granted_by, granted_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(user.id, orgId, role, user.id, tNow).run();

  return json({
    org: { id: orgId, name, slug, api_key: apiKey, settings: defaultSettings },
    membership: { role, user_id: user.id, granted_at: tNow },
    theme_scrape_status: websiteUrl ? "deferred_to_batch_d" : "none"
  }, 201);
}

async function requireOrgThemeAdmin(request, env, orgId) {
  const ctx = await requireSession(request, env);
  if (ctx.error) return { error: ctx.error };
  const org = await env.DB.prepare("SELECT * FROM organisations WHERE id = ?")
    .bind(orgId).first();
  if (!org) return { error: json({ error: "org_not_found" }, 404) };

  const isBootstrapDev = isBootstrapDeveloperFp(env, ctx.user.pub_fp);
  if (isBootstrapDev) return { user: ctx.user, org, role: "developer" };

  const membership = await env.DB.prepare(
    "SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ? LIMIT 1"
  ).bind(orgId, ctx.user.id).first();
  const role = membership && membership.role;
  if (role !== "lead_admin" && role !== "developer") {
    return { error: json({ error: "forbidden", reason: "lead_admin_or_developer_required" }, 403) };
  }
  return { user: ctx.user, org, role };
}

// v5.9.14 — staff-invite QR helpers (Brief A). Resolves the user's effective
// role for a given org, honouring the multi-fp BOOTSTRAP_DEVELOPER_FP
// secret (v5.9.0.13.26+ comma-separated value) via isBootstrapDeveloperFp.
async function orgRoleForUser(env, user, orgId) {
  if (user && user.pub_fp && isBootstrapDeveloperFp(env, user.pub_fp)) return "developer";
  const membership = await env.DB.prepare(
    "SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ? LIMIT 1"
  ).bind(orgId, user.id).first();
  return membership && membership.role ? membership.role : null;
}

async function requireOrgInviteIssuer(request, env, orgId) {
  const ctx = await requireSession(request, env);
  if (ctx.error) return { error: ctx.error };
  const org = await env.DB.prepare("SELECT id, name, slug FROM organisations WHERE id = ?")
    .bind(orgId).first();
  if (!org) return { error: json({ error: "org_not_found" }, 404) };
  const role = await orgRoleForUser(env, ctx.user, org.id);
  if (role !== "lead_admin" && role !== "developer") {
    return { error: inviteJsonError("insufficient_role", "Only Lead Admins and platform Developers can issue invites.", 403) };
  }
  return { user: ctx.user, org, role };
}

async function requireOrgMemberAdmin(request, env) {
  const org = await orgAuth(request, env);
  if (org.error) return { error: org };
  const ctx = await requireSession(request, env);
  if (ctx.error) return { error: ctx.error };
  const role = await orgRoleForUser(env, ctx.user, org.id);
  if (role !== "lead_admin" && role !== "developer") {
    return { error: json({ error: "insufficient_role", message: "Only Lead Admins and Developers can manage staff members." }, 403) };
  }
  return { user: ctx.user, org, role };
}

async function orgMembersList(request, env) {
  const actor = await requireOrgMemberAdmin(request, env);
  if (actor.error) return actor.error;
  const rows = await env.DB.prepare(
    "SELECT m.user_id, COALESCE(u.display_name, m.user_id) AS display_name, m.role " +
    "FROM org_memberships m LEFT JOIN portal_users u ON u.id = m.user_id " +
    "WHERE m.org_id = ? ORDER BY CASE m.role WHEN 'developer' THEN 0 WHEN 'lead_admin' THEN 1 WHEN 'manager' THEN 2 WHEN 'staff' THEN 3 ELSE 4 END, LOWER(COALESCE(u.display_name, m.user_id))"
  ).bind(actor.org.id).all();
  return json({ ok: true, members: rows.results || [], actor: { user_id: actor.user.id, role: actor.role } });
}

async function orgMemberRemove(request, env, userIdParam) {
  const actor = await requireOrgMemberAdmin(request, env);
  if (actor.error) return actor.error;
  const userId = String(userIdParam || "").trim();
  if (!userId) return json({ error: "user_id_required", message: "Member user_id is required." }, 400);
  if (userId === actor.user.id) {
    return json({ error: "cannot_remove_self", message: "You cannot remove your own membership." }, 403);
  }

  const target = await env.DB.prepare(
    "SELECT m.user_id, m.role, COALESCE(u.display_name, m.user_id) AS display_name " +
    "FROM org_memberships m LEFT JOIN portal_users u ON u.id = m.user_id " +
    "WHERE m.org_id = ? AND m.user_id = ? LIMIT 1"
  ).bind(actor.org.id, userId).first();
  if (!target) return json({ error: "member_not_found", message: "That member is not in this organisation." }, 404);
  if (target.role === "developer") {
    return json({ error: "cannot_remove_developer", message: "Developer access cannot be removed from Staff & Rooms." }, 403);
  }
  if (target.role === "lead_admin") {
    const leadCount = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM org_memberships WHERE org_id = ? AND role = 'lead_admin'"
    ).bind(actor.org.id).first();
    if (Number(leadCount && leadCount.count || 0) <= 1) {
      return json({ error: "cannot_remove_last_lead_admin", message: "You cannot remove the last Lead Admin." }, 403);
    }
  }

  await env.DB.prepare("DELETE FROM org_memberships WHERE org_id = ? AND user_id = ?")
    .bind(actor.org.id, userId).run();
  return json({ ok: true, removed: { user_id: target.user_id, display_name: target.display_name, role: target.role } });
}

function inviteJsonError(error, message, status) {
  return json({ error, message }, status);
}

function decodeInvitePayload(value) {
  const text = String(value || "").trim();
  const encoded = text.startsWith("I:") ? text.slice(2) : text;
  if (!encoded) throw new Error("Invite payload required");
  return b64urlJsonDecode(encoded);
}

function encodeInvitePayload(payload) {
  return "I:" + b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
}

function deepCanonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(deepCanonical).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + deepCanonical(value[k])).join(",") + "}";
}

async function sha256DeepB64url(value) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(deepCanonical(value)));
  return b64urlEncode(new Uint8Array(buf));
}

function inviteUnsignedPayload(payload) {
  const clean = Object.assign({}, payload || {});
  delete clean.sig;
  delete clean.pub;
  delete clean.webauthn;
  return clean;
}

async function verifyInvitePayloadSignature(env, invite) {
  if (!invite || !invite.sig || !invite.issuer_pub_fp) return false;
  const issuer = await env.DB.prepare(
    "SELECT u.id, u.pub_fp, u.pub_jwk, m.role FROM portal_users u LEFT JOIN org_memberships m ON m.user_id = u.id AND m.org_id = ? WHERE u.pub_fp = ? LIMIT 1"
  ).bind(invite.org_id, invite.issuer_pub_fp).first();
  if (!issuer) return false;
  if (!issuer.role && isBootstrapDeveloperFp(env, issuer.pub_fp)) issuer.role = "developer";
  const pubJwk = invite.pub || JSON.parse(issuer.pub_jwk);
  const computedFp = await deviceKeyFp(pubJwk);
  if (computedFp !== invite.issuer_pub_fp) return false;
  const payload = inviteUnsignedPayload(invite);
  if (invite.webauthn) {
    await verifyV5Envelope(payload, pubJwk, invite.sig, invite.webauthn);
    return issuer;
  }
  const hash = await hashPayloadToB64url(payload);
  const ok = await verifySig(hash, invite.sig, pubJwk);
  return ok ? issuer : false;
}

async function orgInviteCreate(request, env) {
  let body; try { body = await request.json(); } catch { return inviteJsonError("invalid_json", "Invalid JSON.", 400); }
  const orgId = String(body.org_id || body.orgId || "").trim();
  if (!orgId) return inviteJsonError("org_id_required", "Organisation id is required.", 400);
  const role = strictExpectedMemberRole(body.role || body.prototype_role || "staff");
  if (!role) return inviteJsonError("invalid_invite_role", "Invite role must be staff or manager.", 400);
  if (role === "lead_admin" || role === "developer") {
    return inviteJsonError("lead_admin_invite_deferred", "Lead Admin and Developer invites are deferred.", 400);
  }
  const allowedRole = inviteRole(role);
  if (!allowedRole) return inviteJsonError("invalid_invite_role", "Invite role must be staff or manager.", 400);

  const issuer = await requireOrgInviteIssuer(request, env, orgId);
  if (issuer.error) return issuer.error;
  if (issuer.role !== "lead_admin" && issuer.role !== "developer") {
    return inviteJsonError("insufficient_role", "Only Lead Admins and platform Developers can issue invites.", 403);
  }

  let invite;
  try { invite = decodeInvitePayload(body.invite_payload || body.invite_qr || body.payload); }
  catch (_) { return inviteJsonError("signed_invite_required", "A signed invite payload is required.", 400); }

  const unsigned = inviteUnsignedPayload(invite);
  const tMs = Date.now();
  const expiryMs = Math.max(60_000, Math.min(Number(body.expiry_ms || body.expiryMs || 600_000), 3_600_000));
  if (unsigned.org_id !== issuer.org.id || unsigned.role !== allowedRole) {
    return inviteJsonError("invalid_invite_payload", "Signed invite payload does not match the requested organisation and role.", 400);
  }
  if (unsigned.issuer_pub_fp !== issuer.user.pub_fp) {
    return inviteJsonError("invalid_invite_payload", "Signed invite issuer does not match the signed-in device.", 400);
  }
  if (!unsigned.nonce || String(unsigned.nonce).length < 24) {
    return inviteJsonError("invalid_invite_payload", "Invite nonce is missing.", 400);
  }
  if (!Number.isFinite(Number(unsigned.expiry_ts)) || Number(unsigned.expiry_ts) <= tMs || Number(unsigned.expiry_ts) > tMs + expiryMs + 30_000) {
    return inviteJsonError("invalid_invite_payload", "Invite expiry is invalid.", 400);
  }
  let verifiedIssuer = null;
  try { verifiedIssuer = await verifyInvitePayloadSignature(env, invite); }
  catch (_) { verifiedIssuer = null; }
  if (!verifiedIssuer) return inviteJsonError("invite_bad_signature", "Invite signature could not be verified.", 400);

  const encodedInvite = encodeInvitePayload(invite);
  const inserted = await insertOrgInvite(env, {
    nonce: unsigned.nonce,
    org_id: issuer.org.id,
    role: allowedRole,
    label: invite.label || body.label,
    issuer_pub_fp: issuer.user.pub_fp,
    expiry_ts: Math.floor(Number(unsigned.expiry_ts)),
    created_ts: tMs,
    envelope: encodedInvite
  });

  return json({
    invite_qr: encodedInvite,
    expiry_ts: Math.floor(Number(unsigned.expiry_ts)),
    nonce: unsigned.nonce,
    // v6.4.10 — present ONLY when the envelope was stored server-side, so the
    // client knows a slim nonce-reference QR can be resolved at accept time.
    ...(inserted.envelopeStored ? { invite_token_ref: unsigned.nonce } : {})
  }, 201);
}

async function orgPendingInvites(request, env) {
  const org = await orgAuth(request, env); if (org.error) return org;
  const tMs = Date.now();
  const hasLabel = await orgInvitesHasLabelColumn(env);
  const rows = await env.DB.prepare(
    "SELECT nonce, role, " + (hasLabel ? "label" : "NULL AS label") + ", expiry_ts, created_ts FROM org_invites WHERE org_id=? AND status='pending' AND expiry_ts>? ORDER BY created_ts DESC"
  ).bind(org.id, tMs).all();
  return json({ ok: true, invites: rows.results || [] });
}

async function orgInviteRedeem(request, env) {
  let body; try { body = await request.json(); } catch { return inviteJsonError("invalid_json", "Invalid JSON.", 400); }
  let payload;
  try { payload = decodeInvitePayload(body.invite_payload || body.invite_qr || body.payload); }
  catch (_) { return inviteJsonError("invite_payload_required", "Invite payload is required.", 400); }
  const invite = inviteUnsignedPayload(payload);
  if (invite.role === "lead_admin" || invite.role === "developer") {
    return inviteJsonError("lead_admin_invite_deferred", "Lead Admin and Developer invites are deferred.", 400);
  }
  if (!inviteRole(invite.role)) return inviteJsonError("invalid_invite_role", "Invite role must be staff or manager.", 400);

  let issuer;
  try { issuer = await verifyInvitePayloadSignature(env, payload); }
  catch (_) { issuer = null; }
  if (!issuer) return inviteJsonError("invite_bad_signature", "Invite signature could not be verified.", 400);
  if (issuer.role !== "lead_admin" && issuer.role !== "developer") {
    return inviteJsonError("issuer_role_revoked", "The invite issuer no longer has authority for this organisation.", 403);
  }

  const row = await env.DB.prepare(
    "SELECT * FROM org_invites WHERE nonce = ? AND org_id = ? LIMIT 1"
  ).bind(invite.nonce, invite.org_id).first();
  if (!row) return inviteJsonError("invite_unknown", "Invite was not found.", 404);
  if (row.status === "redeemed") return inviteJsonError("invite_already_redeemed", "Invite has already been redeemed.", 409);
  if (row.status === "revoked") return inviteJsonError("invite_revoked", "Invite has been revoked.", 410);
  const tMs = Date.now();
  if (Number(row.expiry_ts) <= tMs || Number(invite.expiry_ts) <= tMs) {
    await env.DB.prepare("UPDATE org_invites SET status='expired' WHERE nonce=? AND status='pending'").bind(invite.nonce).run();
    return inviteJsonError("invite_expired", "Invite has expired.", 410);
  }

  const pubJwk = body.new_device_pub_jwk;
  const pubFp = String(body.new_device_pub_fp || "").trim();
  if (!pubJwk || !pubFp) return inviteJsonError("device_key_required", "New device public key and fingerprint are required.", 400);
  const computedFp = await deviceKeyFp(pubJwk);
  if (computedFp !== pubFp) return inviteJsonError("device_fp_mismatch", "Device fingerprint does not match the public key.", 400);

  // v6.4.10a — the invite label is who the issuer says this person is, and it
  // sits inside the issuer-SIGNED payload (verified above). Use it both when
  // creating the row AND to update an existing row whose name predates this
  // invite — closes the "New member" ghost (existing portal_users rows from
  // earlier login/ceremony cycles never got a real display name; bit twice on
  // 11 Jun: Lead Admin ceremony + Kerry's re-invite).
  const inviteLabel = String(invite.label || "").trim().slice(0, 120);
  let user = await env.DB.prepare("SELECT id, pub_fp FROM portal_users WHERE pub_fp = ?").bind(pubFp).first();
  if (!user) {
    const userId = randomToken().slice(0, 26);
    const t = now();
    await env.DB.prepare(
      "INSERT INTO portal_users (id, pub_jwk, pub_fp, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(userId, JSON.stringify(pubJwk), pubFp, inviteLabel || "Guest staff member", t, t).run();
    user = { id: userId, pub_fp: pubFp };
  } else if (inviteLabel) {
    await env.DB.prepare(
      "UPDATE portal_users SET display_name = ?, updated_at = ? WHERE id = ?"
    ).bind(inviteLabel, now(), user.id).run();
  }

  const t = now();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT OR REPLACE INTO org_memberships (user_id,org_id,role,granted_by,granted_at,created_via) VALUES (?,?,?,?,?,?)"
    ).bind(user.id, invite.org_id, invite.role, issuer.id, t, "invite:" + invite.nonce),
    env.DB.prepare(
      "UPDATE org_invites SET status='redeemed', redeemed_by_fp=?, redeemed_ts=? WHERE nonce=? AND status='pending'"
    ).bind(pubFp, tMs, invite.nonce)
  ]);
  return json({ ok: true, org_id: invite.org_id, role: invite.role, member_id: user.id });
}

async function orgInviteAcceptOnThisDevice(request, env) {
  let body; try { body = await request.json(); } catch { return inviteJsonError("invalid_json", "Invalid JSON.", 400); }
  const inviteToken = String(body.invite_token || body.invite_payload || body.invite_qr || "").trim();
  let payload;
  try { payload = decodeInvitePayload(inviteToken); }
  catch (_) { return inviteJsonError("invite_payload_required", "Invite payload is required.", 400); }
  const invite = inviteUnsignedPayload(payload);
  if (invite.role === "lead_admin" || invite.role === "developer") {
    return inviteJsonError("lead_admin_invite_deferred", "Lead Admin and Developer invites are deferred.", 400);
  }
  const role = inviteRole(invite.role);
  if (!role) return inviteJsonError("invalid_invite_role", "Invite role must be staff or manager.", 400);

  let issuer;
  try { issuer = await verifyInvitePayloadSignature(env, payload); }
  catch (_) { issuer = null; }
  if (!issuer) return inviteJsonError("invite_bad_signature", "Invite signature could not be verified.", 400);
  if (issuer.role !== "lead_admin" && issuer.role !== "developer") {
    return inviteJsonError("issuer_role_revoked", "The invite issuer no longer has authority for this organisation.", 403);
  }

  const row = await env.DB.prepare(
    "SELECT * FROM org_invites WHERE nonce = ? AND org_id = ? LIMIT 1"
  ).bind(invite.nonce, invite.org_id).first();
  if (!row) return inviteJsonError("invite_unknown", "Invite was not found.", 404);
  if (row.status === "claimed" || row.status === "redeemed") return inviteJsonError("invite_already_claimed", "Invite has already been claimed.", 409);
  if (row.status === "revoked") return inviteJsonError("invite_revoked", "Invite has been revoked.", 410);
  if (row.status !== "pending") return inviteJsonError("invite_not_pending", "Invite is no longer pending.", 409);

  const tMs = Date.now();
  if (Number(row.expiry_ts) <= tMs || Number(invite.expiry_ts) <= tMs) {
    await env.DB.prepare("UPDATE org_invites SET status='expired' WHERE nonce=? AND status='pending'").bind(invite.nonce).run();
    return inviteJsonError("invite_expired", "Invite has expired.", 410);
  }

  const pubJwk = body.accepter_pub_jwk;
  const pubFp = String(body.accepter_pub_fp || "").trim();
  if (!pubJwk || !pubFp) return inviteJsonError("device_key_required", "Accepter public key and fingerprint are required.", 400);
  const computedFp = await deviceKeyFp(pubJwk);
  if (computedFp !== pubFp) return inviteJsonError("device_fp_mismatch", "Device fingerprint does not match the public key.", 400);

  const existingUser = await env.DB.prepare("SELECT id FROM portal_users WHERE pub_fp = ? LIMIT 1").bind(pubFp).first();
  // v6.4.14 — re-hire / re-invite support. This used to hard-reject a known
  // pub_fp ("device_already_enrolled"), which dead-ended any member who was
  // removed and then re-invited on the SAME phone (it still carried its old
  // credential). That guard was a fresh-device-only assumption, NOT a security
  // boundary: the acceptance envelope is still device-key-signed (verified
  // below) and the invite is still issuer-signed (verified above). So instead of
  // rejecting, re-home the existing user — reuse their portal_users row and
  // (re)create the membership for this org (also covers re-invite-to-change-role).
  const isReturningUser = !!existingUser;

  const envelope = body.signed_envelope || {};
  const acceptPayload = envelope.payload || {};
  if (acceptPayload.type !== "irlid_invite_accept_v5") {
    return inviteJsonError("invalid_accept_envelope", "Acceptance envelope type is invalid.", 400);
  }
  if (String(acceptPayload.invite_token || "") !== inviteToken || String(acceptPayload.accepter_pub_fp || "") !== pubFp) {
    return inviteJsonError("invalid_accept_envelope", "Acceptance envelope does not match this invite and device.", 400);
  }
  if (!acceptPayload.nonce || String(acceptPayload.nonce).length < 16) {
    return inviteJsonError("invalid_accept_envelope", "Acceptance nonce is missing.", 400);
  }
  const acceptTs = Number(acceptPayload.ts || acceptPayload.timestamp || 0);
  if (!Number.isFinite(acceptTs) || Math.abs(tMs - acceptTs) > 5 * 60 * 1000) {
    return inviteJsonError("invalid_accept_envelope", "Acceptance timestamp is invalid.", 400);
  }
  try {
    await verifyV5Envelope(acceptPayload, pubJwk, envelope.sig, envelope.webauthn);
  } catch (_) {
    return inviteJsonError("accept_bad_signature", "Acceptance signature could not be verified.", 400);
  }

  const userId = isReturningUser ? existingUser.id : randomToken().slice(0, 26);
  const sessionToken = randomToken();
  const t = now();
  const displayName = String(invite.label || "Invited staff member").trim().slice(0, 120) || "Invited staff member";
  const ipHash = await hashIp(request);
  const ua = (request.headers.get("user-agent") || "").slice(0, 256);

  let results;
  try {
    const stmts = [];
    // New device → create the portal_users row. Returning device (re-hire /
    // re-invite) → refresh its display_name from the issuer-signed invite label
    // (matches the v6.4.10a "names update on redeem" behaviour). Both are guarded
    // on the invite still being 'pending' so the whole batch claims atomically.
    if (isReturningUser) {
      stmts.push(env.DB.prepare(
        "UPDATE portal_users SET display_name=?, updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM org_invites WHERE nonce=? AND org_id=? AND status='pending')"
      ).bind(displayName, t, userId, invite.nonce, invite.org_id));
    } else {
      stmts.push(env.DB.prepare(
        "INSERT INTO portal_users (id, pub_jwk, pub_fp, display_name, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM org_invites WHERE nonce=? AND org_id=? AND status='pending')"
      ).bind(userId, JSON.stringify(pubJwk), pubFp, displayName, t, t, invite.nonce, invite.org_id));
    }
    // Replace any prior membership for this (user, org) so re-invite-to-change-
    // role lands the new role cleanly (re-hire just inserts fresh). Guarded on
    // 'pending' so a replay can't delete a membership without re-creating it.
    stmts.push(env.DB.prepare(
      "DELETE FROM org_memberships WHERE user_id=? AND org_id=? AND EXISTS (SELECT 1 FROM org_invites WHERE nonce=? AND org_id=? AND status='pending')"
    ).bind(userId, invite.org_id, invite.nonce, invite.org_id));
    stmts.push(env.DB.prepare(
      "INSERT INTO org_memberships (user_id,org_id,role,granted_by,granted_at,created_via) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM org_invites WHERE nonce=? AND org_id=? AND status='pending')"
    ).bind(userId, invite.org_id, role, issuer.id, t, "invite:" + invite.nonce, invite.nonce, invite.org_id));
    stmts.push(env.DB.prepare(
      "INSERT INTO login_sessions (token, user_id, issued_at, expires_at, ip_hash, user_agent) SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM org_invites WHERE nonce=? AND org_id=? AND status='pending')"
    ).bind(sessionToken, userId, t, t + LOGIN_SESSION_TTL_S, ipHash, ua, invite.nonce, invite.org_id));
    stmts.push(env.DB.prepare(
      "UPDATE org_invites SET status='claimed', redeemed_by_fp=?, redeemed_ts=? WHERE nonce=? AND org_id=? AND status='pending'"
    ).bind(pubFp, tMs, invite.nonce, invite.org_id));
    results = await env.DB.batch(stmts);
  } catch (_) {
    return inviteJsonError("invite_accept_failed", "Invite acceptance could not be completed.", 409);
  }
  // The invite UPDATE is the LAST statement; its row-change count confirms the claim.
  const claimMeta = results && results[results.length - 1] && results[results.length - 1].meta;
  const claimed = (claimMeta && claimMeta.changes) || 0;
  if (claimed < 1) return inviteJsonError("invite_already_claimed", "Invite has already been claimed.", 409);

  return json({
    ok: true,
    session_token: sessionToken,
    user: { id: userId, display_name: displayName, pub_fp: pubFp },
    membership: { user_id: userId, org_id: invite.org_id, role }
  });
}

// v6.4.10 (PR-4 QR diet) — staff-invite envelope by reference.
// The slim invite QR carries only the nonce (~144 bits of entropy, ≥24 chars
// b64url — not enumerable). The accepting device exchanges it here for the
// exact "I:" envelope string the issuer minted, then proceeds through the
// UNCHANGED redeem/accept paths. Security is equivalent to the fat QR: token
// possession = invite possession, exactly as before; verification still
// happens at the Worker on acceptance. Strictly better post-claim: the
// envelope stops being served the moment the invite leaves 'pending', whereas
// a photographed fat QR held the envelope forever.
async function orgInviteEnvelope(request, env, nonce) {
  const ref = String(nonce || "").trim();
  if (!ref || ref.length < 24) return inviteJsonError("invite_unknown", "Invite was not found.", 404);
  if (!(await orgInvitesHasEnvelopeColumn(env))) {
    return noStore(inviteJsonError("invite_envelope_unavailable", "Invite must be scanned as a full QR.", 410));
  }
  const row = await env.DB.prepare(
    "SELECT nonce, role, expiry_ts, status, envelope FROM org_invites WHERE nonce = ? LIMIT 1"
  ).bind(ref).first();
  if (!row) return noStore(inviteJsonError("invite_unknown", "Invite was not found.", 404));
  if (row.status === "claimed" || row.status === "redeemed") {
    return noStore(inviteJsonError("invite_already_claimed", "Invite has already been claimed.", 409));
  }
  if (row.status === "revoked") return noStore(inviteJsonError("invite_revoked", "Invite has been revoked.", 410));
  if (row.status !== "pending") return noStore(inviteJsonError("invite_not_pending", "Invite is no longer pending.", 409));
  const tMs = Date.now();
  if (Number(row.expiry_ts) <= tMs) {
    await env.DB.prepare("UPDATE org_invites SET status='expired' WHERE nonce=? AND status='pending'").bind(ref).run();
    return noStore(inviteJsonError("invite_expired", "Invite has expired.", 410));
  }
  if (!row.envelope) {
    return noStore(inviteJsonError("invite_envelope_unavailable", "Invite must be scanned as a full QR.", 410));
  }
  return noStore(json({ ok: true, invite_qr: row.envelope, expiry_ts: Number(row.expiry_ts) }));
}

function leadAdminJsonError(error, message, status) {
  return json({ error, message }, status);
}

function leadAdminReceiptParty(receipt, side, fallbackPub) {
  const part = receipt && receipt[side];
  if (!part || !part.payload || !part.sig) return null;
  return {
    payload: part.payload,
    hash: part.hash || null,
    sig: part.sig,
    pub: part.pub || fallbackPub || null,
    webauthn: part.webauthn || null,
    v: part.v || part.payload?.v || null
  };
}

async function verifyLeadAdminReceiptSignature(party, label) {
  if (!party || !party.payload || !party.sig || !party.pub) {
    throw new Error(label + "_receipt_malformed");
  }
  const computed = await hashPayloadToB64url(party.payload, party.v);
  if (party.hash && party.hash !== computed) throw new Error(label + "_hash_mismatch");
  if (party.webauthn || Number(party.v || party.payload?.v || 0) === 5) {
    await verifyV5Envelope(party.payload, party.pub, party.sig, party.webauthn);
    return computed;
  }
  const ok = await verifySig(computed, party.sig, party.pub);
  if (!ok) throw new Error(label + "_signature_invalid");
  return computed;
}

async function verifyLeadAdminCopresence(receipt, issuerPubFp, appointeePubFp) {
  if (!receipt || typeof receipt !== "object") throw new Error("copresence_receipt_required");
  const hello = receipt.hello;
  const accept = receipt.accept || receipt.b;
  if (!hello || !hello.pub || !hello.offer || !accept) throw new Error("copresence_receipt_malformed");

  const appointeeParty = leadAdminReceiptParty(
    { a: Object.assign({}, hello.offer, { pub: hello.pub, v: hello.v || hello.offer?.payload?.v }) },
    "a",
    hello.pub
  );
  const developerParty = leadAdminReceiptParty({ b: accept }, "b", accept.pub);
  const appointeeHash = await verifyLeadAdminReceiptSignature(appointeeParty, "appointee");
  await verifyLeadAdminReceiptSignature(developerParty, "developer");

  const helloHash = await helloHashB64url(hello, hello.v);
  if (developerParty.payload.helloHash !== helloHash) throw new Error("accept_not_bound_to_hello");
  if (developerParty.payload.offerHash && developerParty.payload.offerHash !== appointeeHash) {
    throw new Error("accept_not_bound_to_offer");
  }

  const receiptAppFp = await deviceKeyFp(hello.pub);
  const receiptDevFp = await deviceKeyFp(developerParty.pub);
  if (receiptAppFp !== appointeePubFp) throw new Error("appointee_fp_mismatch");
  if (receiptDevFp !== issuerPubFp) throw new Error("developer_fp_mismatch");

  const appTs = Number(appointeeParty.payload.ts);
  const devTs = Number(developerParty.payload.ts);
  if (!Number.isFinite(appTs) || !Number.isFinite(devTs)) throw new Error("copresence_timestamp_missing");
  const timeDeltaS = Math.abs(appTs - devTs);
  if (timeDeltaS > 90) throw new Error("copresence_time_delta");

  const t = now();
  const newestTs = Math.max(appTs, devTs);
  if (newestTs > t + 5 || t - newestTs > 5 * 60) throw new Error("copresence_stale");

  const appLat = Number(appointeeParty.payload.lat);
  const appLon = Number(appointeeParty.payload.lon);
  const devLat = Number(developerParty.payload.lat);
  const devLon = Number(developerParty.payload.lon);
  if (![appLat, appLon, devLat, devLon].every(Number.isFinite)) throw new Error("copresence_gps_missing");
  const distanceM = haversineMeters(devLat, devLon, appLat, appLon);
  if (distanceM > 12) throw new Error("copresence_distance");

  return {
    appointee_pub_fp: receiptAppFp,
    developer_pub_fp: receiptDevFp,
    appointee_ts: appTs,
    developer_ts: devTs,
    time_delta_s: timeDeltaS,
    distance_m: Math.round(distanceM * 100) / 100,
    appointee_gps: { lat: appLat, lon: appLon, acc: appointeeParty.payload.acc ?? null },
    developer_gps: { lat: devLat, lon: devLon, acc: developerParty.payload.acc ?? null }
  };
}

async function orgLeadAdminAppoint(request, env) {
  let body; try { body = await request.json(); } catch { return leadAdminJsonError("invalid_json", "Invalid JSON.", 400); }
  const grant = body.grant_envelope || body.signed_grant || body.signed_action || null;
  const receipt = body.copresence_receipt || body.copresence || null;
  const appointeePubJwk = body.appointee_pub_jwk || body.appointee_pub || receipt?.hello?.pub || null;
  const displayName = String(body.appointee_display_name || body.display_name || "Lead Admin").trim().slice(0, 120) || "Lead Admin";

  if (!grant || typeof grant !== "object") return leadAdminJsonError("grant_required", "A signed lead-admin grant is required.", 400);
  if (!receipt) return leadAdminJsonError("copresence_receipt_required", "A co-presence receipt is required.", 400);
  if (!appointeePubJwk) return leadAdminJsonError("appointee_pub_required", "Appointee public key is required.", 400);

  const payload = grant.payload || {};
  const issuerPubJwk = grant.pub;
  if (payload.type !== "irlid_leadadmin_grant_v5") {
    return leadAdminJsonError("invalid_grant_type", "Lead Admin grant type is invalid.", 400);
  }
  const orgId = String(payload.org_id || "").trim();
  const appointeePubFp = String(payload.appointee_pub_fp || "").trim();
  const copresenceHash = String(payload.copresence_hash || "").trim();
  if (!orgId || !appointeePubFp || !copresenceHash) {
    return leadAdminJsonError("invalid_grant_payload", "Lead Admin grant is missing org, appointee, or co-presence hash.", 400);
  }

  const computedAppointeeFp = await deviceKeyFp(appointeePubJwk);
  if (computedAppointeeFp !== appointeePubFp) {
    return leadAdminJsonError("appointee_fp_mismatch", "Appointee public key does not match the grant.", 400);
  }
  const computedReceiptHash = await sha256DeepB64url(receipt);
  if (computedReceiptHash !== copresenceHash) {
    return leadAdminJsonError("copresence_hash_mismatch", "Co-presence receipt hash does not match the grant.", 400);
  }

  const issuerPubFp = await deviceKeyFp(issuerPubJwk);
  if (!issuerPubFp || !isBootstrapDeveloperFp(env, issuerPubFp)) {
    return leadAdminJsonError("developer_required", "Only a bootstrap Developer can appoint a Lead Admin.", 403);
  }
  if (issuerPubFp === appointeePubFp) {
    return leadAdminJsonError("two_devices_required", "Developer and appointee must be distinct devices.", 400);
  }

  const grantTs = Number(payload.ts || payload.timestamp || 0);
  if (!Number.isFinite(grantTs) || Math.abs(Date.now() - grantTs) > 5 * 60 * 1000) {
    return leadAdminJsonError("grant_stale", "Lead Admin grant is stale.", 400);
  }
  const nonce = String(payload.nonce || "").trim();
  if (!nonce || nonce.length < 16) return leadAdminJsonError("nonce_required", "Lead Admin grant nonce is missing.", 400);

  try {
    await verifyV5Envelope(payload, issuerPubJwk, grant.sig, grant.webauthn);
  } catch (e) {
    return leadAdminJsonError("grant_bad_signature", String(e && e.message || e).slice(0, 200), 401);
  }

  const org = await env.DB.prepare("SELECT id, name FROM organisations WHERE id = ? LIMIT 1").bind(orgId).first();
  if (!org) return leadAdminJsonError("org_not_found", "Organisation was not found.", 404);
  const nonceRow = await env.DB.prepare("SELECT nonce FROM action_nonces WHERE nonce = ? LIMIT 1").bind(nonce).first();
  if (nonceRow) return leadAdminJsonError("nonce_already_used", "Lead Admin grant nonce has already been used.", 400);

  let copresence;
  try {
    copresence = await verifyLeadAdminCopresence(receipt, issuerPubFp, appointeePubFp);
  } catch (e) {
    return leadAdminJsonError("copresence_invalid", String(e && e.message || e).slice(0, 200), 400);
  }

  const t = now();
  let issuer = await env.DB.prepare("SELECT id, pub_fp FROM portal_users WHERE pub_fp = ? LIMIT 1").bind(issuerPubFp).first();
  if (!issuer) issuer = { id: randomToken().slice(0, 26), pub_fp: issuerPubFp, create: true };
  let appointee = await env.DB.prepare("SELECT id, pub_fp FROM portal_users WHERE pub_fp = ? LIMIT 1").bind(appointeePubFp).first();
  if (!appointee) appointee = { id: randomToken().slice(0, 26), pub_fp: appointeePubFp, create: true };

  const oldLeadRows = await env.DB.prepare(
    "SELECT u.pub_fp FROM org_memberships m JOIN portal_users u ON u.id = m.user_id WHERE m.org_id = ? AND m.role = 'lead_admin' AND m.user_id <> ?"
  ).bind(orgId, appointee.id).all();
  const replacedLeadAdminFps = (oldLeadRows.results || []).map(r => r.pub_fp).filter(Boolean);
  const auditId = randomToken().slice(0, 26);
  const gpsJson = JSON.stringify({
    developer: copresence.developer_gps,
    appointee: copresence.appointee_gps
  });

  const statements = [];
  if (issuer.create) {
    statements.push(env.DB.prepare(
      "INSERT INTO portal_users (id, pub_jwk, pub_fp, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(issuer.id, JSON.stringify(issuerPubJwk), issuerPubFp, "Developer (Super-Admin)", t, t));
  }
  if (appointee.create) {
    statements.push(env.DB.prepare(
      "INSERT INTO portal_users (id, pub_jwk, pub_fp, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(appointee.id, JSON.stringify(appointeePubJwk), appointeePubFp, displayName, t, t));
  } else if (body.appointee_display_name) {
    // v6.4.10a — Developer typed the appointee's name during the ceremony;
    // update an existing row too (was create-only, leaving prior rows as
    // "New member" — the 11 Jun midday ceremony hit exactly this).
    statements.push(env.DB.prepare(
      "UPDATE portal_users SET display_name = ?, updated_at = ? WHERE id = ?"
    ).bind(displayName, t, appointee.id));
  }
  statements.push(env.DB.prepare(
    "UPDATE org_memberships SET role='manager', granted_by=?, granted_at=?, created_via=? WHERE org_id=? AND role='lead_admin' AND user_id<>?"
  ).bind(issuer.id, t, "lead_admin_replace:" + auditId, orgId, appointee.id));
  statements.push(env.DB.prepare(
    "INSERT INTO org_memberships (user_id,org_id,role,granted_by,granted_at,created_via) VALUES (?,?,?,?,?,?) " +
    "ON CONFLICT(user_id,org_id) DO UPDATE SET role=excluded.role, granted_by=excluded.granted_by, granted_at=excluded.granted_at, created_via=excluded.created_via"
  ).bind(appointee.id, orgId, "lead_admin", issuer.id, t, "lead_admin_copresence:" + auditId));
  statements.push(env.DB.prepare(
    "INSERT INTO lead_admin_appointment_audit (id,org_id,issuer_user_id,issuer_pub_fp,appointee_user_id,appointee_pub_fp,copresence_hash,distance_m,time_delta_s,developer_ts,appointee_ts,gps_json,replaced_lead_admin_fps,grant_nonce,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  ).bind(
    auditId, orgId, issuer.id, issuerPubFp, appointee.id, appointeePubFp, copresenceHash,
    copresence.distance_m, copresence.time_delta_s, copresence.developer_ts, copresence.appointee_ts,
    gpsJson, JSON.stringify(replacedLeadAdminFps), nonce, t
  ));
  statements.push(env.DB.prepare(
    "INSERT INTO action_nonces (nonce, used_at, expires_at) VALUES (?, ?, ?)"
  ).bind(nonce, t, t + 600));

  try {
    await env.DB.batch(statements);
  } catch (e) {
    return leadAdminJsonError("lead_admin_appoint_failed", String(e && e.message || e).slice(0, 200), 409);
  }

  return json({
    ok: true,
    org_id: orgId,
    appointee_user_id: appointee.id,
    appointee_pub_fp: appointeePubFp,
    role: "lead_admin",
    replaced_lead_admin_fps: replacedLeadAdminFps,
    audit_id: auditId,
    copresence_hash: copresenceHash,
    distance_m: copresence.distance_m,
    time_delta_s: copresence.time_delta_s
  });
}

async function orgInviteRevoke(request, env, nonceOverride) {
  let body = {};
  try { body = await request.json(); } catch (_) { body = {}; }
  const orgId = String(body.org_id || body.orgId || "").trim();
  if (!orgId) return inviteJsonError("org_id_required", "Organisation id is required.", 400);
  const issuer = await requireOrgInviteIssuer(request, env, orgId);
  if (issuer.error) return issuer.error;
  const nonce = String(nonceOverride || body.nonce || "").trim();
  if (!nonce) return inviteJsonError("nonce_required", "Invite nonce is required.", 400);
  const result = await env.DB.prepare(
    "UPDATE org_invites SET status='revoked' WHERE nonce = ? AND org_id = ? AND status = 'pending'"
  ).bind(nonce, issuer.org.id).run();
  return json({ ok: true, revoked: (result.meta?.changes || 0) > 0 });
}

async function orgPublicMeta(request, env) {
  const orgId = String(new URL(request.url).searchParams.get("org_id") || "").trim();
  if (!orgId) return inviteJsonError("org_id_required", "Organisation id is required.", 400);
  const org = await env.DB.prepare("SELECT name, settings_json FROM organisations WHERE id = ?").bind(orgId).first();
  if (!org) return inviteJsonError("org_not_found", "Organisation was not found.", 404);
  let settings = {};
  try { settings = org.settings_json ? JSON.parse(org.settings_json) : {}; } catch (_) {}
  return json({ name: org.name, logo_url: settings.logoUrl || settings.logo_url || "" });
}

function absoluteUrl(value, baseUrl) {
  if (!value || typeof value !== "string") return "";
  try { return new URL(value.trim(), baseUrl).href; } catch (_) { return ""; }
}

function normalizeScrapedThemeColor(value) {
  const color = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return "#" + color.slice(1).split("").map(ch => ch + ch).join("").toUpperCase();
  }
  return color;
}

async function userScrapeTheme(request, env, orgId) {
  const ctx = await requireOrgThemeAdmin(request, env, orgId);
  if (ctx.error) return ctx.error;

  const org = ctx.org;
  let settings = {};
  try { settings = org.settings_json ? JSON.parse(org.settings_json) : {}; } catch (_) {}
  const websiteValue = settings.websiteUrl || settings.website_url || "";
  const websiteUrl = parsePublicHttpUrl(websiteValue);
  if (!websiteUrl) return err("websiteUrl must be a public http(s) URL in org settings");

  const cached = settings.theme_scrape;
  if (cached && cached.website_url === websiteUrl.href && Date.now() - Number(cached.scraped_at || 0) < THEME_SCRAPE_TTL_MS) {
    return json({ cached: true, ...cached });
  }

  let htmlResponse;
  try {
    htmlResponse = await fetch(websiteUrl.href, {
      headers: {
        "User-Agent": "IRLidThemeScraper/1.0 (+https://github.com/BunHead/IRLid-TestEnvironment)",
        "Accept": "text/html,application/xhtml+xml"
      },
      signal: AbortSignal.timeout(THEME_SCRAPE_TIMEOUT_MS),
      redirect: "follow"
    });
  } catch (e) {
    return json({ error: "scrape_fetch_failed", detail: e && e.message ? e.message : "fetch failed" }, 502);
  }
  if (!htmlResponse.ok) return json({ error: "scrape_fetch_failed", status: htmlResponse.status }, 502);

  const contentType = htmlResponse.headers.get("content-type") || "";
  if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    return json({ error: "scrape_not_html", content_type: contentType }, 415);
  }

  const found = { theme_color: null, logo_candidates: [], og_image: null, title: "" };
  const baseUrl = htmlResponse.url || websiteUrl.href;
  const seenLogos = new Set();
  const addLogo = (href) => {
    const absolute = absoluteUrl(href, baseUrl);
    if (!absolute || seenLogos.has(absolute)) return;
    seenLogos.add(absolute);
    if (found.logo_candidates.length < 12) found.logo_candidates.push(absolute);
  };

  const rewriter = new HTMLRewriter()
    .on('meta[name="theme-color"]', {
      element(el) {
        if (!found.theme_color) found.theme_color = normalizeScrapedThemeColor(el.getAttribute("content"));
      }
    })
    .on('meta[property="og:image"]', {
      element(el) {
        if (!found.og_image) found.og_image = absoluteUrl(el.getAttribute("content"), baseUrl);
      }
    })
    .on('link[rel]', {
      element(el) {
        const rel = String(el.getAttribute("rel") || "").toLowerCase();
        if (/(^|\s)(icon|shortcut icon|apple-touch-icon|mask-icon)(\s|$)/.test(rel)) addLogo(el.getAttribute("href"));
      }
    })
    .on("title", {
      text(text) {
        if (found.title.length < 240) found.title += text.text;
      }
    });

  try {
    await rewriter.transform(htmlResponse).arrayBuffer();
  } catch (e) {
    return json({ error: "scrape_parse_failed", detail: e && e.message ? e.message : "HTML parse failed" }, 502);
  }

  if (found.og_image) addLogo(found.og_image);
  const result = {
    website_url: websiteUrl.href,
    title: found.title.trim().replace(/\s+/g, " ").slice(0, 160),
    theme_color: found.theme_color || null,
    og_image: found.og_image || null,
    logo_candidates: found.logo_candidates,
    scraped_at: Date.now()
  };

  settings.websiteUrl = websiteUrl.href;
  settings.theme_scrape = result;
  await env.DB.prepare("UPDATE organisations SET settings_json=?, updated_at=? WHERE id=?")
    .bind(JSON.stringify(settings), now(), org.id).run();
  return json({ cached: false, ...result });
}

async function utilImageProxy(request, env) {
  const target = parsePublicHttpUrl(new URL(request.url).searchParams.get("url") || "");
  if (!target) return err("url must be a public http(s) image URL", 400);

  let proxied;
  try {
    proxied = await fetch(target.href, {
      headers: {
        "User-Agent": "IRLidImageProxy/1.0",
        "Accept": "image/*"
      },
      signal: AbortSignal.timeout(THEME_SCRAPE_TIMEOUT_MS),
      redirect: "follow"
    });
  } catch (e) {
    return err("image_fetch_failed", 502);
  }
  if (!proxied.ok) return err("image_fetch_failed", 502);

  const type = proxied.headers.get("content-type") || "";
  if (!/^image\//i.test(type)) return err("not_an_image", 415);
  const declaredLength = Number(proxied.headers.get("content-length") || 0);
  if (declaredLength && declaredLength > IMAGE_PROXY_MAX_BYTES) return err("image_too_large", 413);

  const bytes = await proxied.arrayBuffer();
  if (bytes.byteLength > IMAGE_PROXY_MAX_BYTES) return err("image_too_large", 413);

  const response = new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff"
    }
  });
  return addCors(response, env, request);
}

// =====================
//  ORGANISATION PORTAL
// =====================

async function orgRegister(request, env) {
  let body;
  try { body = await request.json(); } catch { return err("Invalid JSON"); }
  const { name } = body;
  if (!name || name.trim().length < 2) return err("name required (min 2 chars)");
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const existing = await env.DB.prepare("SELECT id FROM organisations WHERE slug = ?").bind(slug).first();
  if (existing) return err("Organisation name already taken");
  const id = uuid();
  const apiKey = "org_" + randomToken();
  const t = now();
  // Generate persistent venue keypair for attendee-scan mode
  const venueKey = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pubJwk = await crypto.subtle.exportKey("jwk", venueKey.publicKey);
  const prvJwk = await crypto.subtle.exportKey("jwk", venueKey.privateKey);
  const defaultSettings = { minScore: 50, distanceM: 12, windowS: 90, bioRequired: false, privacyMode: true, checkoutEnabled: true, anonymousMode: false };
  await env.DB.prepare(
    "INSERT INTO organisations (id, name, slug, api_key, venue_pub_jwk, venue_prv_jwk, settings_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)"
  ).bind(id, name.trim(), slug, apiKey, JSON.stringify(pubJwk), JSON.stringify(prvJwk), JSON.stringify(defaultSettings), t, t).run();
  return json({ id, name: name.trim(), slug, api_key: apiKey, settings: defaultSettings }, 201);
}

async function orgGetSettings(request, env) {
  const org = await orgAuth(request, env); if (org.error) return org;
  const settings = JSON.parse(org.settings_json || "{}");
  return json({ id: org.id, name: org.name, slug: org.slug, settings });
}

async function orgUpdateSettings(request, env) {
  const org = await orgAuth(request, env); if (org.error) return org;
  let body; try { body = await request.json(); } catch { return err("Invalid JSON"); }
  // v6.2.1 - privilege-defining fields require a lead_admin+ session.
  // The org api_key is intentionally returned to members for dashboard reads,
  // so api_key-only auth must not be enough to change RBAC-sensitive settings.
  const GOVERNANCE_FIELDS = ["manager_perms"];
  if (GOVERNANCE_FIELDS.some(f => body[f] !== undefined)) {
    const ctx = await requireSession(request, env);
    if (ctx.error) {
      return json({
        error: "insufficient_role",
        message: "A Lead Admin or Developer session is required to change manager_perms."
      }, 403);
    }
    const callerRole = await orgRoleForUser(env, ctx.user, org.id);
    if (callerRole !== "lead_admin" && callerRole !== "developer") {
      return json({
        error: "insufficient_role",
        message: "Only Lead Admins and Developers can change manager_perms."
      }, 403);
    }
  }
  // Settings allowlist. Adding new keys is purely additive — existing rows are unaffected.
  // Branding + theme keys (Batch 6.5, 3 May 2026) extend the original v6 set.
  const allowed = [
    // --- Original v6 core gates ---
    "minScore","distanceM","windowS","bioRequired","privacyMode","checkoutEnabled","anonymousMode",
    // --- Identity / proof rules (placeholder-but-persist-able for first-scan flow integration) ---
    "returnAllowed","allowSelfSelection","requireDoormanConfirmation","requireAdditionalProof",
    "allowProofRecording","enableIdPhotoCapture",
    // --- Branding ---
    // v5.9.0.10 — orgTerms added: optional org-customisable terms/disclaimer text
    // shown to attendees on org-entry.html (allow/orange/review states). Display-only,
    // no accept gate. Captain's directive 11 May morning.
    "logoUrl","welcomeMessage","orgTerms","redirectUrl","staffRedirectUrl","websiteUrl",
    // v5.9.0.13.14 — Role vocabulary per-org. Object with 5 string fields.
    "roleLabels",
    "calendar_defaults",
    "manager_perms",
    // --- Theme (Batch 6.5 → 6.5f) ---
    "theme"  // { primary, accent, qrFg, palette[], bgPalette[], darkMode, bgMode, bgIntensity, bgPattern, bgImageUrl, bgImagePosition, bgImageSymmetryMode, bgImageAlphaCycle, cycleMode, bgAnimDuration, cycleAnimDuration } — validated below
  ];
  // Theme validators — defensive, applied before merge.
  function isHex6(v) { return typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v); }
  function relLuminance(hex) {
    const m = /^#([0-9a-fA-F]{6})$/.exec(hex || ""); if (!m) return 0;
    const v = parseInt(m[1], 16);
    const ch = [(v>>16)&255, (v>>8)&255, v&255].map(c => {
      const s = c/255; return s <= 0.03928 ? s/12.92 : Math.pow((s+0.055)/1.055, 2.4);
    });
    return 0.2126*ch[0] + 0.7152*ch[1] + 0.0722*ch[2];
  }
  function contrastVsWhite(hex) {
    const l = relLuminance(hex); return (1 + 0.05) / (l + 0.05);
  }
  function validateTheme(t) {
    if (t === null || t === undefined) return null; // allow clearing theme
    if (typeof t !== "object") return "theme must be an object";
    if (t.primary !== undefined && !isHex6(t.primary)) return "theme.primary must be a #RRGGBB hex string";
    if (t.accent  !== undefined && !isHex6(t.accent))  return "theme.accent must be a #RRGGBB hex string";
    if (t.qrFg    !== undefined) {
      if (!isHex6(t.qrFg)) return "theme.qrFg must be a #RRGGBB hex string";
      // QR readability — reject foregrounds with insufficient contrast against white.
      if (contrastVsWhite(t.qrFg) < 4.5) return "theme.qrFg contrast against white below 4.5:1 — QR may not scan reliably";
    }
    if (t.palette !== undefined) {
      if (!Array.isArray(t.palette)) return "theme.palette must be an array";
      if (t.palette.length > 7) return "theme.palette length must be at most 7";
      for (const c of t.palette) { if (!isHex6(c)) return "theme.palette entries must be #RRGGBB hex strings"; }
    }
    if (t.darkMode !== undefined && typeof t.darkMode !== "boolean" && t.darkMode !== "auto") {
      return "theme.darkMode must be true, false, or 'auto'";
    }
    if (t.acceptCycleEnabled !== undefined && typeof t.acceptCycleEnabled !== "boolean") {
      return "theme.acceptCycleEnabled must be a boolean";
    }
    // Batch 6.5f — Celebration mode (replaces acceptCycleEnabled).
    if (t.cycleMode !== undefined) {
      // v5.9.0.13.2 — 'simple' added. v5.9.0.13.3 retains cycleMode as a legacy migration anchor.
      if (typeof t.cycleMode !== "string" || ["off","simple","page","glow","pattern"].indexOf(t.cycleMode) === -1) {
        return "theme.cycleMode must be one of: off, simple, page, glow, pattern";
      }
    }
    // v5.9.0.13.3 — Layered celebration model. Each of five effects has its
    // own enabled flag plus a small enum of variant options. Each field is
    // optional (client omits any sub-effect block it didn't touch).
    if (t.celebration !== undefined) {
      const c = t.celebration;
      if (typeof c !== "object" || c === null) return "theme.celebration must be an object";
      const PULSE_COLOURS = ["single","cycle"];
      const PULSE_INTENSITIES = ["subtle","strong"];
      const BG_SWEEPS = ["once","thrice"];
      const QR_MOTIONS = ["wobble","rotate-cw","rotate-ccw","zoom-in","zoom-out","dissolve-horz","dissolve-vert"];
      const GLOW_THICKS = ["thin","medium","thick"];
      const GLOW_SWEEPS = ["outward","inward","rotate"];
      const GLOW_CENTRES = ["on","off"];
      const GLOW_SATS = ["muted","vivid","hyper"];
      const PATTERNS = ["dots","hex","diagonal","checker","grid","weave","chevron","isometric"];
      function validateSubEffect(name, src, enumChecks) {
        if (src === undefined) return null;
        if (typeof src !== "object" || src === null) return "theme.celebration." + name + " must be an object";
        if (src.enabled !== undefined && typeof src.enabled !== "boolean") return "theme.celebration." + name + ".enabled must be a boolean";
        for (const key of Object.keys(enumChecks)) {
          if (src[key] !== undefined) {
            if (typeof src[key] !== "string" || enumChecks[key].indexOf(src[key]) === -1) {
              return "theme.celebration." + name + "." + key + " must be one of: " + enumChecks[key].join(", ");
            }
          }
        }
        return null;
      }
      const subErr = validateSubEffect("pulse",   c.pulse,   { colourSource: PULSE_COLOURS, intensity: PULSE_INTENSITIES })
                  || validateSubEffect("bg",      c.bg,      { sweep: BG_SWEEPS })
                  || validateSubEffect("qr",      c.qr,      { motion: QR_MOTIONS })
                  || validateSubEffect("glow",    c.glow,    { thickness: GLOW_THICKS, sweep: GLOW_SWEEPS, centrePulse: GLOW_CENTRES, saturation: GLOW_SATS })
                  || validateSubEffect("pattern", c.pattern, { pattern: PATTERNS })
                  || validateSubEffect("text",    c.text,    {}); // v5.9.0.13.13 simple on/off; no enum fields yet
      if (subErr) return subErr;
    }
    // Batch 6.5b — animation speed controls
    if (t.bgAnimEnabled !== undefined && typeof t.bgAnimEnabled !== "boolean") {
      return "theme.bgAnimEnabled must be a boolean";
    }
    if (t.bgAnimDuration !== undefined) {
      if (typeof t.bgAnimDuration !== "number" || !Number.isFinite(t.bgAnimDuration) || t.bgAnimDuration < 1 || t.bgAnimDuration > 600) {
        return "theme.bgAnimDuration must be a number between 1 and 600 (seconds)";
      }
    }
    if (t.cycleAnimDuration !== undefined) {
      if (typeof t.cycleAnimDuration !== "number" || !Number.isFinite(t.cycleAnimDuration) || t.cycleAnimDuration < 0.1 || t.cycleAnimDuration > 30) {
        return "theme.cycleAnimDuration must be a number between 0.1 and 30 (seconds)";
      }
    }
    // Batch 6.5d → 6.5e — background mode + intensity + bgPalette array + pattern + Tier-3
    if (t.bgMode !== undefined) {
      if (typeof t.bgMode !== "string" || ["off","page","glow","pattern","image"].indexOf(t.bgMode) === -1) {
        return "theme.bgMode must be one of: off, page, glow, pattern, image";
      }
    }
    // bgIntensity — Batch 6.5e canonical name for muted/vibrant page-cycle.
    if (t.bgIntensity !== undefined) {
      if (typeof t.bgIntensity !== "string" || ["muted","vibrant"].indexOf(t.bgIntensity) === -1) {
        return "theme.bgIntensity must be either 'muted' or 'vibrant'";
      }
    }
    // bgPalette — Batch 6.5e canonical: array of up to 7 hex strings (Background palette).
    // Backward compat: still accept string 'muted'|'vibrant' (6.5d shape) which the
    // client translates to bgIntensity on load. Reject anything else.
    if (t.bgPalette !== undefined) {
      if (Array.isArray(t.bgPalette)) {
        if (t.bgPalette.length > 7) return "theme.bgPalette length must be at most 7";
        for (const c of t.bgPalette) { if (!isHex6(c)) return "theme.bgPalette entries must be #RRGGBB hex strings"; }
      } else if (typeof t.bgPalette === "string") {
        if (["muted","vibrant"].indexOf(t.bgPalette) === -1) {
          return "theme.bgPalette (legacy string form) must be 'muted' or 'vibrant'";
        }
      } else {
        return "theme.bgPalette must be an array of hex strings (or legacy 'muted'/'vibrant' string)";
      }
    }
    if (t.bgPattern !== undefined) {
      if (typeof t.bgPattern !== "string") return "theme.bgPattern must be a string";
      const PATTERNS = ["dots","hex","diag","checker","grid","weave","chevron","iso","custom"];
      if (PATTERNS.indexOf(t.bgPattern) === -1) return "theme.bgPattern not recognised";
    }
    if (t.bgImageUrl !== undefined && t.bgImageUrl !== null) {
      // Accepts https:// URLs (for hosted images) or data:image/ URIs (for inline
      // upload — went live in 4 May tidy 2). Length cap 300_000 chars allows ~225KB
      // binary as a base64 data URI. Frontend caps uploads at 200KB binary
      // (~270K chars) so 300K leaves a small buffer for safety.
      if (typeof t.bgImageUrl !== "string") return "theme.bgImageUrl must be a string or null";
      if (t.bgImageUrl.length > 300000) return "theme.bgImageUrl too long (max 300000 chars ≈ 225KB binary)";
      if (!/^(https:\/\/|data:image\/)/i.test(t.bgImageUrl)) return "theme.bgImageUrl must be an https:// URL or data:image/ URI";
    }
    if (t.bgImagePosition !== undefined) {
      // v5.7.1m.1 — added edge anchors top/bottom/left/right alongside the four corner anchors.
      const POSITIONS = ["centre","tile","cover","top","top-left","top-right","bottom","bottom-left","bottom-right","left","right"];
      if (typeof t.bgImagePosition !== "string" || POSITIONS.indexOf(t.bgImagePosition) === -1) {
        return "theme.bgImagePosition must be one of: centre, tile, cover, top, top-left, top-right, bottom, bottom-left, bottom-right, left, right";
      }
    }
    if (typeof t.bgImageSymmetryMode !== "undefined") {
      const allowed = ["off", "horizontal", "vertical", "quad"];
      if (!allowed.includes(t.bgImageSymmetryMode)) {
        return "theme.bgImageSymmetryMode must be one of: " + allowed.join(", ");
      }
    }
    // Tolerate old boolean field for backward compat (don't error, just ignore on save).
    if (t.bgImageAlphaCycle !== undefined && typeof t.bgImageAlphaCycle !== "boolean") {
      return "theme.bgImageAlphaCycle must be a boolean";
    }
    return null;
  }
  const current = JSON.parse(org.settings_json || "{}");
  // Validate theme separately (other keys pass through as primitives/strings).
  if (body.theme !== undefined) {
    const themeErr = validateTheme(body.theme);
    if (themeErr) return err(themeErr);
    body.theme = { ...body.theme };
    delete body.theme.bgImageSymmetric;
  }
  // String length sanity — protect against an admin pasting a 1MB welcome message.
  if (body.logoUrl !== undefined && typeof body.logoUrl !== "string") return err("logoUrl must be a string");
  if (body.websiteUrl !== undefined && (typeof body.websiteUrl !== "string" || (body.websiteUrl.trim() && !parsePublicHttpUrl(body.websiteUrl)))) return err("websiteUrl must be a public http(s) URL or blank");
  if (body.welcomeMessage !== undefined && typeof body.welcomeMessage === "string" && body.welcomeMessage.length > 2000) return err("welcomeMessage too long (max 2000 chars)");
  // v5.9.0.10 — orgTerms length cap (larger than welcomeMessage since terms can be lengthier).
  if (body.orgTerms !== undefined && typeof body.orgTerms !== "string") return err("orgTerms must be a string");
  if (body.orgTerms !== undefined && typeof body.orgTerms === "string" && body.orgTerms.length > 8000) return err("orgTerms too long (max 8000 chars)");
  if (body.redirectUrl !== undefined && typeof body.redirectUrl !== "string") return err("redirectUrl must be a string");
  // v5.9.0.13.14 — Role vocabulary: per-org custom labels for the role chain.
  if (body.roleLabels !== undefined) {
    const rl = body.roleLabels;
    if (typeof rl !== "object" || rl === null || Array.isArray(rl)) return err("roleLabels must be an object");
    const ROLE_KEYS = ["attendee", "staff", "manager", "lead_admin", "developer"];
    for (const key of Object.keys(rl)) {
      if (ROLE_KEYS.indexOf(key) === -1) return err("roleLabels has unknown key: " + key);
      const val = rl[key];
      if (typeof val !== "string") return err("roleLabels." + key + " must be a string");
      if (val.length === 0 || val.length > 40) return err("roleLabels." + key + " must be 1-40 chars");
    }
  }
  if (body.manager_perms !== undefined) {
    const mp = body.manager_perms;
    if (typeof mp !== "object" || mp === null || Array.isArray(mp)) return err("manager_perms must be an object");
    const out = {};
    for (const key of Object.keys(mp)) {
      if (key !== "calendar") continue;
      if (typeof mp[key] !== "boolean") return err("manager_perms." + key + " must be a boolean");
      out[key] = mp[key];
    }
    body.manager_perms = out;
  }
  if (body.calendar_defaults !== undefined) {
    const cd = body.calendar_defaults;
    if (typeof cd !== "object" || cd === null || Array.isArray(cd)) return err("calendar_defaults must be an object");
    const allowedCalKeys = [
      "default_duration","checkout_grace","late_grace_before","late_grace_after",
      "working_hours_start","working_hours_end","breaks_count",
      "break_1_start","break_1_end","break_2_start","break_2_end","break_3_start","break_3_end",
      "min_trust_score","privacy_mode","require_proof","auto_checkout","week_starts_on",
      "room_vocabulary_singular","room_vocabulary_plural"
    ];
    const out = {};
    function calInt(key, max) {
      if (cd[key] === undefined) return null;
      const n = Number(cd[key]);
      if (!Number.isInteger(n) || n < 0 || n > max) return "calendar_defaults." + key + " must be an integer from 0 to " + max;
      out[key] = n;
      return null;
    }
    function calTime(key) {
      if (cd[key] === undefined) return null;
      if (typeof cd[key] !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(cd[key])) return "calendar_defaults." + key + " must be HH:MM";
      out[key] = cd[key];
      return null;
    }
    function calEnum(key, values) {
      if (cd[key] === undefined) return null;
      if (typeof cd[key] !== "string" || !values.includes(cd[key])) return "calendar_defaults." + key + " must be one of: " + values.join(", ");
      out[key] = cd[key];
      return null;
    }
    function calWeekStart(key) {
      if (cd[key] === undefined) return null;
      const n = Number(cd[key]);
      if (n !== 1 && n !== 7) return "calendar_defaults." + key + " must be 1 or 7";
      out[key] = n;
      return null;
    }
    function calText(key) {
      if (cd[key] === undefined) return null;
      if (typeof cd[key] !== "string") return "calendar_defaults." + key + " must be a string";
      const val = cd[key].trim();
      if (!val || val.length > 40) return "calendar_defaults." + key + " must be 1-40 chars";
      out[key] = val;
      return null;
    }
    function calBool(key) {
      if (cd[key] === undefined) return null;
      if (typeof cd[key] !== "boolean") return "calendar_defaults." + key + " must be a boolean";
      out[key] = cd[key];
      return null;
    }
    for (const key of Object.keys(cd)) {
      if (!allowedCalKeys.includes(key)) return err("calendar_defaults has unknown key: " + key);
    }
    const calErr =
      calInt("default_duration", 1440) ||
      calInt("checkout_grace", 1440) ||
      calInt("late_grace_before", 1440) ||
      calInt("late_grace_after", 1440) ||
      calTime("working_hours_start") ||
      calTime("working_hours_end") ||
      calInt("breaks_count", 3) ||
      calTime("break_1_start") ||
      calTime("break_1_end") ||
      calTime("break_2_start") ||
      calTime("break_2_end") ||
      calTime("break_3_start") ||
      calTime("break_3_end") ||
      calInt("min_trust_score", 100) ||
      calEnum("privacy_mode", ["standard", "redacted_gps"]) ||
      calEnum("require_proof", ["off", "optional", "required"]) ||
      calBool("auto_checkout") ||
      calWeekStart("week_starts_on") ||
      calText("room_vocabulary_singular") ||
      calText("room_vocabulary_plural");
    if (calErr) return err(calErr);
    body.calendar_defaults = { ...(current.calendar_defaults || {}), ...out };
  }
  for (const k of allowed) { if (body[k] !== undefined) current[k] = body[k]; }
  await env.DB.prepare("UPDATE organisations SET settings_json=?, updated_at=? WHERE id=?")
    .bind(JSON.stringify(current), now(), org.id).run();
  // v5.11.22 - echo the row after UPDATE so clients can merge the persisted
  // settings without a separate readback GET racing D1 propagation.
  const persisted = await env.DB.prepare("SELECT settings_json FROM organisations WHERE id=?")
    .bind(org.id).first();
  let persistedTheme = null;
  try { persistedTheme = persisted?.settings_json ? JSON.parse(persisted.settings_json) : null; } catch (_) { persistedTheme = null; }
  return json({ ok: true, theme: persistedTheme });
}

async function orgGetQR(request, env) {
  // Returns the venue's public key + metadata for the attendee-scan QR
  const org = await orgAuth(request, env); if (org.error) return org;
  const pub = JSON.parse(org.venue_pub_jwk);
  const settings = JSON.parse(org.settings_json || "{}");
  const payload = { orgId: org.id, orgName: org.name, pub, ts: now(), mode: "checkin-venue", v: 1 };
  return json({ payload, settings });
}

async function orgFromRequest(request, env) {
  const url = new URL(request.url);
  const key = request.headers.get("X-Org-Key") || url.searchParams.get("key") || url.searchParams.get("org");
  if (!key) return null;
  return env.DB.prepare("SELECT * FROM organisations WHERE api_key=? OR id=? OR slug=?").bind(key, key, key).first();
}

function firstNameFromDisplayName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[0] : "";
}

function surnameFromDisplayName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(" ") : "";
}

const EXPECTED_SELECT =
  "id,org_id,display_name,initials,COALESCE(role_key,'attendee') AS role_key,device_pub_fp,email_hint,phone_hint,notes,created_at,archived_at";

async function expectedKeySet(env, orgCode, expectedId) {
  const keys = new Set();
  const primary = await env.DB.prepare(
    "SELECT device_pub_fp FROM org_expected WHERE id=? AND org_id=?"
  ).bind(expectedId, orgCode).first();
  if (primary?.device_pub_fp) keys.add(primary.device_pub_fp);
  if (await tableExists(env, "rebind_history")) {
    const rows = await env.DB.prepare(
      "SELECT new_device_fp FROM rebind_history WHERE org_code=? AND expected_id=? ORDER BY created_at ASC, id ASC"
    ).bind(orgCode, expectedId).all();
    for (const row of (rows.results || [])) {
      if (row.new_device_fp) keys.add(row.new_device_fp);
    }
  }
  return Array.from(keys);
}

async function expectedRowWithKeys(env, orgCode, expectedId) {
  const row = await env.DB.prepare(
    `SELECT ${EXPECTED_SELECT} FROM org_expected WHERE id=? AND org_id=?`
  ).bind(expectedId, orgCode).first();
  if (!row) return null;
  row.device_key_fps = await expectedKeySet(env, orgCode, expectedId);
  row.first_name = firstNameFromDisplayName(row.display_name);
  row.surname = surnameFromDisplayName(row.display_name);
  row.status = row.archived_at ? "archived" : (row.device_pub_fp ? "linked" : "assist");
  row.linked_at = null;
  row.device_key_fp = row.device_pub_fp || null;
  row.prototype_role = row.role_key || "attendee";
  return row;
}

async function findExpectedByDeviceFp(env, orgCode, deviceFp) {
  const fp = String(deviceFp || "").trim();
  if (!fp) return null;
  const direct = await env.DB.prepare(
    `SELECT ${EXPECTED_SELECT} FROM org_expected WHERE org_id=? AND device_pub_fp=? AND archived_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 1`
  ).bind(orgCode, fp).first();
  if (direct) {
    direct.device_key_fps = await expectedKeySet(env, orgCode, direct.id);
    direct.first_name = firstNameFromDisplayName(direct.display_name);
    direct.surname = surnameFromDisplayName(direct.display_name);
    direct.status = "linked";
    direct.linked_at = null;
    direct.device_key_fp = direct.device_pub_fp || null;
    direct.prototype_role = direct.role_key || "attendee";
    return direct;
  }
  if (await tableExists(env, "rebind_history")) {
    const viaHistory = await env.DB.prepare(
      "SELECT e.id,e.org_id,e.display_name,e.initials,COALESCE(e.role_key,'attendee') AS role_key,e.device_pub_fp,e.email_hint,e.phone_hint,e.notes,e.created_at,e.archived_at FROM rebind_history r JOIN org_expected e ON e.id=r.expected_id AND e.org_id=r.org_code WHERE r.org_code=? AND r.new_device_fp=? AND e.archived_at IS NULL ORDER BY r.created_at DESC, r.id DESC LIMIT 1"
    ).bind(orgCode, fp).first();
    if (viaHistory) {
      viaHistory.device_key_fps = await expectedKeySet(env, orgCode, viaHistory.id);
      viaHistory.first_name = firstNameFromDisplayName(viaHistory.display_name);
      viaHistory.surname = surnameFromDisplayName(viaHistory.display_name);
      viaHistory.status = "linked";
      viaHistory.linked_at = null;
      viaHistory.device_key_fp = viaHistory.device_pub_fp || null;
      viaHistory.prototype_role = viaHistory.role_key || "attendee";
      return viaHistory;
    }
  }
  return null;
}

async function orgRecognize(request, env) {
  const org = await orgFromRequest(request, env);
  if (!org) return authErr("organisation required", 401);
  const url = new URL(request.url);
  const deviceFp = (url.searchParams.get("device_pub") || "").trim();
  if (!deviceFp) return err("device_pub required");
  const row = await findExpectedByDeviceFp(env, org.id, deviceFp);
  if (!row) return json({ recognized: false });
  return json({ recognized: true, name: row.display_name || `${row.first_name || ""} ${row.surname || ""}`.trim(), expected_id: row.id });
}

async function orgExpectedLookupByFp(request, env, fpParam) {
  const org = await orgFromRequest(request, env);
  if (!org) return noStore(err("organisation not found", 404));
  const fp = String(fpParam || "").trim();
  if (!fp) return noStore(err("pub_fp required", 400));

  const expected = await findExpectedByDeviceFp(env, org.id, fp);
  if (expected) {
    return noStore(json({
      status: "linked",
      expected_id: expected.id,
      expected_name: expected.display_name || `${expected.first_name || ""} ${expected.surname || ""}`.trim()
    }));
  }

  const rejected = await env.DB.prepare(
    "SELECT id,status FROM org_checkins WHERE org_id=? AND device_key_fp=? AND status IN ('rejected','invalid') ORDER BY checkin_at DESC, id DESC LIMIT 1"
  ).bind(org.id, fp).first();
  if (rejected) {
    return noStore(json({
      status: "rejected",
      reason: rejected.status === "invalid" ? "Staff could not approve this device" : "Not allowed"
    }));
  }

  return noStore(json({ status: "pending" }));
}

async function orgActiveCheckin(request, env) {
  const org = await orgFromRequest(request, env);
  if (!org) return authErr("organisation required", 401);
  const url = new URL(request.url);
  const deviceFp = (url.searchParams.get("device_pub") || "").trim();
  if (!deviceFp) return err("device_pub required");

  const row = await env.DB.prepare(
    "SELECT id,name,attendee_label,checkin_at FROM org_checkins WHERE org_id=? AND device_key_fp=? AND checkout_at IS NULL AND status!='invalid' ORDER BY checkin_at DESC LIMIT 1"
  ).bind(org.id, deviceFp).first();
  if (!row) return json({ active: false });

  const settings = JSON.parse(org.settings_json || "{}");
  return json({
    active: true,
    checkin_id: row.id,
    nonce: "rescan_" + randomToken(),
    name: row.name || row.attendee_label || "",
    checkin_at: row.checkin_at,
    event: org.name || "IRLid Event",
    logo: settings.logoUrl || ""
  });
}

function orgSettingEnabled(settings, camelName, snakeName, defaultValue) {
  if (settings && typeof settings[camelName] !== "undefined") return settings[camelName] === true;
  if (settings && typeof settings[snakeName] !== "undefined") return settings[snakeName] === true;
  return defaultValue === true;
}

function redactOrgReceiptName(displayName) {
  const name = String(displayName || "").trim();
  if (!name) return null;
  const first = firstNameFromDisplayName(name);
  const surname = surnameFromDisplayName(name);
  if (surname) return `${first ? first.charAt(0).toUpperCase() + ". " : ""}${surname}`;
  return first ? `${first.charAt(0).toUpperCase()}.` : null;
}

function orgReceiptUrl(request, receiptId) {
  const url = new URL(request.url);
  const origin = url.origin.includes("workers.dev") ? "https://irlid.co.uk" : url.origin;
  return `${origin.replace(/\/+$/, "")}/receipt.html?org_receipt=${encodeURIComponent(receiptId)}`;
}

function parseVenueJwk(value) {
  if (!value) return null;
  try { return typeof value === "string" ? JSON.parse(value) : value; } catch { return null; }
}

function usableVenuePubJwk(jwk) {
  return !!(jwk && jwk.kty === "EC" && jwk.crv === "P-256" && jwk.x && jwk.y);
}

function usableVenuePrvJwk(jwk) {
  return usableVenuePubJwk(jwk) && !!jwk.d;
}

async function mintOrgReceipt(env, request, org, checkinRow, options) {
  const settings = JSON.parse(org.settings_json || "{}");
  let venuePub = parseVenueJwk(org.venue_pub_jwk);
  let venuePrv = parseVenueJwk(org.venue_prv_jwk);
  if (!usableVenuePubJwk(venuePub) || !usableVenuePrvJwk(venuePrv)) {
    const venueKey = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    venuePub = await crypto.subtle.exportKey("jwk", venueKey.publicKey);
    venuePrv = await crypto.subtle.exportKey("jwk", venueKey.privateKey);
    await env.DB.prepare("UPDATE organisations SET venue_pub_jwk=?, venue_prv_jwk=?, updated_at=? WHERE id=?")
      .bind(JSON.stringify(venuePub), JSON.stringify(venuePrv), now(), org.id).run();
    org.venue_pub_jwk = JSON.stringify(venuePub);
    org.venue_prv_jwk = JSON.stringify(venuePrv);
  }

  const privacyMode = orgSettingEnabled(settings, "privacyMode", "privacy_mode", true);
  const anonymousMode = orgSettingEnabled(settings, "anonymousMode", "anonymous_mode", false);
  const rawName = checkinRow.name || checkinRow.attendee_label || options?.expected?.display_name || null;
  const attendeeName = anonymousMode ? null : (privacyMode ? redactOrgReceiptName(rawName) : rawName);
  const attendeeFp = checkinRow.device_key_fp || checkinRow.attendee_key_id || "unknown";
  const tMs = Number(checkinRow.checkin_at || now()) * 1000;
  const payload = {
    v: 5,
    kind: "org_checkin",
    ts: new Date(tMs).toISOString(),
    nonce: randomToken(),
    org: {
      id: org.id,
      slug: org.slug,
      name: org.name
    },
    event: {
      id: options?.event_id || null,
      name: options?.event_name || org.name || null,
      room: options?.room || null
    },
    attendee: {
      pub_fp: attendeeFp,
      display_name: attendeeName || null,
      anonymous: anonymousMode || !attendeeName
    },
    action: options?.action || "in",
    score: Number(checkinRow.score || options?.score || 70),
    bioVerified: !!(checkinRow.bio_verified || options?.bioVerified)
  };

  const gps = options?.gps;
  if (gps && Number.isFinite(Number(gps.lat)) && Number.isFinite(Number(gps.lon))) {
    const gpsObj = {
      lat: Number(gps.lat),
      lon: Number(gps.lon),
      acc_m: Number.isFinite(Number(gps.acc_m ?? gps.acc ?? gps.accuracy)) ? Number(gps.acc_m ?? gps.acc ?? gps.accuracy) : null
    };
    if (privacyMode) {
      payload.gps_hash = await sha256B64url(canonical(gpsObj));
    } else {
      payload.gps = gpsObj;
    }
  } else if (checkinRow.gps_hash) {
    payload.gps_hash = checkinRow.gps_hash;
  }
  payload.venue_pub_jwk = venuePub;

  const signature = await signCanonicalPayload(payload, venuePrv);
  const receiptId = uuid();
  await env.DB.prepare(
    "INSERT INTO org_receipts (id,org_id,checkin_id,attendee_pub_fp,payload_json,signature,created_at,privacy_mode) VALUES (?,?,?,?,?,?,?,?)"
  ).bind(receiptId, org.id, checkinRow.id, attendeeFp, JSON.stringify(payload), signature, now(), privacyMode ? 1 : 0).run();

  return { receipt_id: receiptId, receipt_url: orgReceiptUrl(request, receiptId), receipt: { ...payload, sig: signature } };
}

async function orgReceiptGet(request, env, receiptId) {
  const id = String(receiptId || "").trim();
  if (!id) return noStore(err("receipt_id required", 400));
  const row = await env.DB.prepare(
    "SELECT r.id,r.payload_json,r.signature,r.created_at,o.slug,o.name,o.venue_pub_jwk FROM org_receipts r JOIN organisations o ON o.id=r.org_id WHERE r.id=? LIMIT 1"
  ).bind(id).first();
  if (!row) return noStore(err("org_receipt_not_found", 404));
  let payload;
  try { payload = JSON.parse(row.payload_json || "{}"); } catch { return noStore(err("invalid receipt payload", 500)); }
  return noStore(json({
    id: row.id,
    receipt_id: row.id,
    receipt_url: orgReceiptUrl(request, row.id),
    created_at: row.created_at,
    org_slug: row.slug,
    receipt: { ...payload, sig: row.signature },
    payload,
    signature: row.signature
  }));
}

async function orgPublicInfo(request, env, slugParam) {
  const slug = String(slugParam || "").trim();
  if (!slug) return noStore(err("slug required", 400));
  const org = await env.DB.prepare(
    "SELECT id,slug,name,venue_pub_jwk FROM organisations WHERE slug=? OR id=? LIMIT 1"
  ).bind(slug, slug).first();
  if (!org) return noStore(err("org_not_found", 404));
  let venuePub = null;
  try { venuePub = org.venue_pub_jwk ? JSON.parse(org.venue_pub_jwk) : null; } catch { venuePub = null; }
  return noStore(json({ org_id: org.id, slug: org.slug, name: org.name, venue_pub_jwk: venuePub }));
}

// v6.4.4 — QR diet PR-1 (QR-SLIMMING-SPEC.md). Public display-only entry info
// for the attendee page: carries by reference what venue QRs used to carry by
// value (welcome / terms / redirects / logo / theme). Identity + intent stay in
// the QR; everything fetchable lives here. No secrets — api_key, private keys,
// members, and attendance are NOT exposed. This is strictly the branding every
// attendee's browser was already handed via URL params by the old fat QRs.
async function orgEntryInfo(request, env, slugParam) {
  const slug = String(slugParam || "").trim();
  if (!slug) return noStore(err("slug required", 400));
  const org = await env.DB.prepare(
    "SELECT id,slug,name,settings_json FROM organisations WHERE slug=? OR id=? LIMIT 1"
  ).bind(slug, slug).first();
  if (!org) return noStore(err("org_not_found", 404));
  let settings = {};
  try { settings = JSON.parse(org.settings_json || "{}") || {}; } catch { settings = {}; }
  const t = (settings.theme && typeof settings.theme === "object") ? settings.theme : {};
  const isHex = (v) => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v);
  const str = (v, cap) => (typeof v === "string" ? v.slice(0, cap) : "");
  const v512 = (t._v512 && typeof t._v512 === "object") ? t._v512 : {};
  const v511 = (t._v511 && typeof t._v511 === "object") ? t._v511 : {};
  // Mirrors Org.html brandFontTokenFromTheme() resolution order. Raw string is
  // fine: the client's IRLID_BRAND_FONT_TOKEN normalises unknown values to 'sans'.
  const fontRaw = (v512.globalFont && v512.globalFont.font)
    || (t.globalFont && t.globalFont.font)
    || (v512.banner && v512.banner.font)
    || (v511.banner && v511.banner.font)
    || "";
  const theme = {
    primary: isHex(t.primary) ? t.primary : null,
    accent: isHex(t.accent) ? t.accent : null,
    qrFg: isHex(t.qrFg) ? t.qrFg : null,
    darkMode: t.darkMode === true ? "dark" : (t.darkMode === false ? "light" : null),
    palette: (Array.isArray(t.palette) ? t.palette : []).filter(isHex).slice(0, 7),
    brandFont: str(fontRaw, 40) || null
  };
  // Optional event context: ?event_id= resolves the display name server-side
  // so the slim QR doesn't need to carry it.
  let event = null;
  const eventId = String(new URL(request.url).searchParams.get("event_id") || "").trim();
  if (eventId) {
    const ev = await env.DB.prepare(
      "SELECT id,name FROM weekly_events WHERE id=? AND org_id=? AND archived_at IS NULL LIMIT 1"
    ).bind(eventId, org.id).first();
    if (ev) event = { id: ev.id, name: ev.name };
  }
  return noStore(json({
    slug: org.slug,
    name: org.name,
    welcomeMessage: str(settings.welcomeMessage, 2000),
    orgTerms: str(settings.orgTerms, 8000),
    redirectUrl: str(settings.redirectUrl, 500),
    staffRedirectUrl: str(settings.staffRedirectUrl, 500),
    // Unlike the QR param path (which had to skip data: URIs for capacity),
    // fetch can carry the full logo — this is the "proper fix" the v6.1.25c
    // comment in Org.html promised.
    logoUrl: str(settings.logoUrl, 200000),
    returnAllowed: !!settings.returnAllowed,
    theme,
    event
  }));
}

async function orgStaffAuth(request, env) {
  const org = await orgAuth(request, env); if (org.error) return org;
  let body; try { body = await request.json(); } catch { return err("Invalid JSON"); }

  let hello;
  try {
    const helloInput = body.hello ?? body.helloPayload ?? body.staffHello ?? body.staff_hello ?? body.payload ?? body.qr;
    hello = await parseHelloInput(helloInput ?? body);
  } catch {
    return err("Invalid HELLO", 400);
  }

  const verified = await verifySignedHello(hello, 90);
  if (!verified.ok) return err(verified.error, verified.status);

  const t = now();
  const expiresAt = t + 15 * 60;
  const staffPubFp = await deviceKeyFp(hello.pub);
  const hHash = await helloHashB64url(hello);

  const existing = await env.DB.prepare(
    "SELECT id, expires_at FROM org_staff_sessions WHERE org_id=? AND hello_hash=?"
  ).bind(org.id, hHash).first();
  if (existing && existing.expires_at >= t) {
    await env.DB.prepare(
      "UPDATE org_staff_sessions SET last_seen_at=? WHERE id=?"
    ).bind(t, existing.id).run();
    return json({ ok: true, staff_session: existing.id, expires_at: existing.expires_at, staff_pub_fp: staffPubFp });
  }
  if (existing) {
    await env.DB.prepare("DELETE FROM org_staff_sessions WHERE id=?").bind(existing.id).run();
  }

  const token = "staff_" + randomToken();
  await env.DB.prepare(
    "INSERT INTO org_staff_sessions (id,org_id,staff_pub_fp,staff_pub_jwk,hello_hash,verification_state,created_at,expires_at,last_seen_at) VALUES (?,?,?,?,?,?,?,?,?)"
  ).bind(token, org.id, staffPubFp, JSON.stringify(hello.pub), hHash, verified.verification_state, t, expiresAt, t).run();

  return json({ ok: true, staff_session: token, expires_at: expiresAt, staff_pub_fp: staffPubFp });
}

async function requireOrgStaffSession(env, org, staffSessionToken) {
  const token = String(staffSessionToken || "").trim();
  if (!token) return authErr("Staff authentication required", 401);

  const session = await env.DB.prepare(
    "SELECT id, expires_at FROM org_staff_sessions WHERE id=? AND org_id=?"
  ).bind(token, org.id).first();
  if (!session) return authErr("Invalid staff session", 401);

  const t = now();
  if (Number(session.expires_at) <= t) {
    await env.DB.prepare("DELETE FROM org_staff_sessions WHERE id=?").bind(session.id).run();
    return authErr("Staff session expired", 401);
  }

  await env.DB.prepare("UPDATE org_staff_sessions SET last_seen_at=? WHERE id=?").bind(t, session.id).run();
  return null;
}

async function requireDevOrStaffSession(request, env, org, staffSessionToken) {
  const staffError = await requireOrgStaffSession(env, org, staffSessionToken);
  if (!staffError) return null;

  // v5.9.0.13.25 — Reuse the shared bootstrapDeveloperFromBearer helper so the
  // org_-prefixed-Bearer = developer-tier rule from v5.9.0.13.21 applies here
  // too. Was previously a duplicated check that only recognised session_token
  // Bearers with matching pub_fp, missing the api_key Bearer fallback the
  // frontend uses when qrLoginSession.session_token is unavailable. Result:
  // Add-at-the-door and Bind-from-list endpoints rejected with 401 even
  // though the frontend treated the user as developer-tier.
  const developer = await bootstrapDeveloperFromBearer(request, env);
  if (developer) return null;

  return staffError;
}

function bearerTokenFromRequest(request) {
  const auth = request.headers.get("Authorization") || "";
  const m = /^Bearer\s+([A-Za-z0-9_-]{16,})$/.exec(auth.trim());
  return m ? m[1] : "";
}

function requestHasOrgServiceAccount(request, org) {
  const token = bearerTokenFromRequest(request);
  const xOrgKey = request.headers.get("X-Org-Key") || "";
  return !!(org && org.api_key && (xOrgKey === org.api_key || token === org.api_key));
}

async function bootstrapDeveloperFromBearer(request, env) {
  const token = bearerTokenFromRequest(request);
  if (!token) return null;

  // v5.9.0.13.21 — org_-prefixed Bearer = the org's master api_key. The
  // frontend's developerBearerSessionIsActive() helper (OrgCheckin.html
  // line 6588) already treats org_ keys as developer-tier authority. The
  // Worker was rejecting them here, causing an asymmetry where the frontend
  // showed developer-tier UI but Add-at-the-door / fresh-staff-proof
  // endpoints returned 401 stale_staff_proof. This aligns the two sides:
  // possession of the api_key IS by definition full authority over the org.
  // We require the same key to also be presented as X-Org-Key (which orgAuth
  // has already validated) so a stale token in the wrong context can't
  // backdoor in.
  if (token.startsWith("org_")) {
    const xOrgKey = request.headers.get("X-Org-Key") || "";
    if (xOrgKey === token) {
      return { id: null, pub_fp: null, display_name: "Service account (api_key)", api_key_developer: true };
    }
    return null;
  }

  const ctx = await requireSession(request, env);
  if (ctx.error) return null;
  if (ctx.user && isBootstrapDeveloperFp(env, ctx.user.pub_fp)) return ctx.user;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOTSTRAP_DEVELOPER_FP helpers (v5.9.0.13.26 — multi-fp support)
//
// The secret accepts a comma-separated list of pub_fps. Each non-empty trimmed
// fp is recognised as developer-tier. Whitespace-around-comma tolerant. Empty
// or single-fp secrets behave identically to the pre-multi-fp form, so this
// is a strict superset of the previous semantics — no migration needed.
// History: secret was hit twice by the Ctrl+V → 0x16 SYN trap (4 May test env,
// 10 May live). Multi-fp keeps that diagnostic surface (total length + count)
// in the test-env debug fields.
// ─────────────────────────────────────────────────────────────────────────────
function bootstrapDeveloperFps(env) {
  return (env.BOOTSTRAP_DEVELOPER_FP || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}
function isBootstrapDeveloperFp(env, pub_fp) {
  if (!pub_fp) return false;
  return bootstrapDeveloperFps(env).includes(pub_fp);
}

async function roleForStaffPubFp(env, org, staffPubFp) {
  const fp = String(staffPubFp || "").trim();
  if (!fp) return "staff";
  if (isBootstrapDeveloperFp(env, fp)) return "developer";

  const user = await env.DB.prepare(
    "SELECT id FROM portal_users WHERE pub_fp=?"
  ).bind(fp).first();
  if (user) {
    const membership = await env.DB.prepare(
      "SELECT role FROM org_memberships WHERE user_id=? AND org_id=?"
    ).bind(user.id, org.id).first();
    if (membership && EXPECTED_MEMBER_ROLES.has(membership.role)) return membership.role;
  }

  const expected = await env.DB.prepare(
    "SELECT COALESCE(role_key,'staff') AS prototype_role FROM org_expected WHERE org_id=? AND device_pub_fp=? AND archived_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 1"
  ).bind(org.id, fp).first();
  return expectedMemberRole(expected?.prototype_role || "staff");
}

// v5.10.0 Phase 0 — per-action WebAuthn helper for manager commits.
// Replaces requireFreshStaffProof on the bind endpoints (first phase of
// a roll-out across all manager commits — see HANDOVER-PerActionAuth.md).
//
// Verifies a v5 envelope attached to the request body under the key
// `signed_action`, confirms it carries the expected action type, that
// its nonce hasn't been seen before (anti-replay), that its timestamp is
// within ±120s of now (anti-stale), and that the signing user has the
// minimum role on the target org. Records the nonce on success so any
// subsequent presentation rejects with `nonce_already_used`.
//
// Returns { user, org, role, payload } on success or { error } on any failure.
//
// opts:
//   expectedType   — required type discriminator (e.g. "irlid_bind_v5")
//   orgId          — org context the action must match
//   minRole        — minimum role required (e.g. "staff")
//   payloadSchema  — optional fn(payload)=>bool for action-specific fields
async function requireSignedAction(body, env, opts) {
  // v5.10.0.4 — body is now passed in pre-parsed by the caller. Previous
  // versions took `request` and tried request.clone().json() here, but
  // callers had already consumed the body via `await request.json()`, so
  // the clone returned "Invalid JSON" every time. Workers Request bodies
  // are single-use streams; cloning AFTER consumption gives a drained
  // stream. The fix is structural: caller parses once, passes the object.
  const expectedType  = String((opts && opts.expectedType) || "").trim();
  const orgId         = String((opts && opts.orgId) || "").trim();
  const minRole       = (opts && opts.minRole) || null;
  const payloadSchema = (opts && opts.payloadSchema) || null;
  const request       = (opts && opts.request) || null;

  if (!body || typeof body !== "object") {
    return { error: json({ error: "signed_action_required" }, 400) };
  }

  // v5.10.0.3 — verbose diagnostics on the bind path while we close the
  // smoke loop. Remove this block once smoke is green.
  console.log("[requireSignedAction] entry expectedType=" + opts.expectedType + " orgId=" + opts.orgId + " body_has_signed_action=" + (body.signed_action ? "yes" : "no"));

  const env_envelope = body.signed_action || null;
  if (!env_envelope || typeof env_envelope !== "object") {
    console.log("[requireSignedAction] FAIL signed_action_required");
    return { error: json({ error: "signed_action_required" }, 400) };
  }
  const payload   = env_envelope.payload;
  const pubJwk    = env_envelope.pub;
  const sigB64u   = env_envelope.sig;
  const webauthn  = env_envelope.webauthn;
  if (!payload || !pubJwk || !sigB64u || !webauthn) {
    console.log("[requireSignedAction] FAIL signed_action_malformed payload=" + !!payload + " pub=" + !!pubJwk + " sig=" + !!sigB64u + " webauthn=" + !!webauthn);
    return { error: json({ error: "signed_action_malformed" }, 400) };
  }
  console.log("[requireSignedAction] envelope present, type=" + payload.type + " org_id=" + payload.org_id + " nonce=" + String(payload.nonce || "").slice(0, 8));

  // 1. Action type discriminator — prevents cross-action replay
  if (payload.type !== expectedType) {
    console.log("[requireSignedAction] FAIL invalid_action_type got=" + payload.type);
    return { error: json({ error: "invalid_action_type", expected: expectedType, got: payload.type }, 400) };
  }
  // 2. Org context match
  if (orgId && String(payload.org_id || "") !== orgId) {
    console.log("[requireSignedAction] FAIL invalid_action_org payload_org=" + payload.org_id + " expected=" + orgId);
    return { error: json({ error: "invalid_action_org" }, 400) };
  }
  // 3. Timestamp drift — ±120s replay window
  const t = now();
  const payloadSec = Math.floor(Number(payload.timestamp || 0) / 1000);
  if (!payloadSec || Math.abs(t - payloadSec) > 120) {
    console.log("[requireSignedAction] FAIL timestamp_drift server=" + t + " payload=" + payloadSec);
    return { error: json({ error: "timestamp_drift", server_t: t, payload_t: payloadSec }, 400) };
  }
  // 4. Nonce anti-replay
  const nonce = String(payload.nonce || "").trim();
  if (!nonce || nonce.length < 16) {
    console.log("[requireSignedAction] FAIL nonce_required len=" + nonce.length);
    return { error: json({ error: "nonce_required" }, 400) };
  }
  const existing = await env.DB.prepare(
    "SELECT nonce FROM action_nonces WHERE nonce = ? LIMIT 1"
  ).bind(nonce).first();
  if (existing) {
    console.log("[requireSignedAction] FAIL nonce_already_used");
    return { error: json({ error: "nonce_already_used" }, 400) };
  }
  // 5. Payload schema check
  if (typeof payloadSchema === "function") {
    let schemaOk = false;
    try { schemaOk = !!payloadSchema(payload); } catch (_) { schemaOk = false; }
    if (!schemaOk) {
      console.log("[requireSignedAction] FAIL invalid_action_payload payload_keys=" + Object.keys(payload).join(","));
      return { error: json({ error: "invalid_action_payload" }, 400) };
    }
  }
  // 6. Cryptographic verification — same path as orgLoginClaim
  try {
    await verifyV5Envelope(payload, pubJwk, sigB64u, webauthn);
  } catch (e) {
    console.log("[requireSignedAction] FAIL signature_verify_failed reason=" + String(e && e.message || e).slice(0, 200));
    return { error: json({ error: "signature_verify_failed", reason: String(e && e.message || e).slice(0, 200) }, 401) };
  }
  // 7. Resolve signing user via pub_fp
  const fp = await deviceKeyFp(pubJwk);
  if (!fp) return { error: json({ error: "fp_compute_failed" }, 400) };
  let user = await env.DB.prepare(
    "SELECT id, display_name, pub_fp FROM portal_users WHERE pub_fp = ?"
  ).bind(fp).first();
  if (!user) {
    // Mirror v5.9.14.2's orgLoginClaim auto-create — per-action auth carries
    // its own cryptographic guarantee, so creating the portal_users row
    // here is no weaker than the claim path.
    const userId = randomToken().slice(0, 26);
    const isBootstrap = isBootstrapDeveloperFp(env, fp);
    const displayName = isBootstrap ? "Developer (Super-Admin)" : "New member";
    await env.DB.prepare(
      "INSERT INTO portal_users (id, pub_jwk, pub_fp, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(userId, JSON.stringify(pubJwk), fp, displayName, t, t).run();
    user = { id: userId, display_name: displayName, pub_fp: fp };
  }
  // 8. Org + role resolution and minRole check
  let org = null;
  if (orgId) {
    org = await env.DB.prepare("SELECT id, name, slug, api_key FROM organisations WHERE id = ?")
      .bind(orgId).first();
    if (!org) return { error: json({ error: "org_not_found" }, 404) };
  }
  // v5.10.0.5 — bootstrap-developer fp is platform-level: it grants developer
  // access to ANY org without needing an explicit org_memberships row. This
  // mirrors how requireDevOrStaffSession / userListOrgs already treat
  // BOOTSTRAP_DEVELOPER_FP. Without this, Captain's bootstrap fp gets role=null
  // (no membership row) and fails minRole=staff even though the platform-level
  // grant should clear any role gate.
  const isBootstrapHere = isBootstrapDeveloperFp(env, fp);
  let role = org ? await orgRoleForUser(env, user, org.id) : null;
  if (!role && isBootstrapHere) role = "developer";
  console.log("[requireSignedAction] resolved user_id=" + user.id + " fp=" + fp + " role=" + role + " minRole=" + minRole + " bootstrap=" + isBootstrapHere);
  let sessionUser = null;
  let sessionRole = null;
  let effectiveRole = role;
  let authorityPath = "signing_fp_authoritative";
  if (minRole) {
    const requiredRank = expectedRoleRank(minRole);
    const signingRank  = role ? expectedRoleRank(role) : -1;
    if (signingRank < requiredRank) {
      // v5.10.1 Path B: the signature remains the actor proof, but authority
      // may be delegated by a live Bearer session for the same org.
      if (request) {
        const ctx = await requireSession(request, env);
        if (!ctx.error && ctx.user) {
          sessionUser = ctx.user;
          sessionRole = org ? await orgRoleForUser(env, sessionUser, org.id) : null;
          if (!sessionRole && isBootstrapDeveloperFp(env, sessionUser.pub_fp)) sessionRole = "developer";
        }
      }
      const sessionRank = sessionRole ? expectedRoleRank(sessionRole) : -1;
      if (sessionRank < requiredRank) {
        console.log("[requireSignedAction] FAIL insufficient_role signing=" + role + " session=" + sessionRole + " required=" + minRole);
        return { error: json({
          error: "insufficient_role",
          required: minRole,
          actual_signing: role || null,
          actual_session: sessionRole || null,
          actual: role || null
        }, 403) };
      }
      effectiveRole = sessionRole;
      authorityPath = "bearer_delegated";
      console.log("[requireSignedAction] OK pass-through (Bearer-delegated authority) actor_pub_fp=" + fp + " authorized_by_user_id=" + sessionUser.id + " session_role=" + sessionRole);
    } else {
      console.log("[requireSignedAction] OK pass-through (signing fp authoritative) actor_pub_fp=" + fp + " authorized_by_user_id=" + user.id + " role=" + role);
    }
  } else {
    console.log("[requireSignedAction] OK pass-through (signature verified; no role gate) actor_pub_fp=" + fp + " authorized_by_user_id=" + user.id);
  }
  // 9. Record the nonce so subsequent attempts fail with nonce_already_used.
  //    Best-effort opportunistic GC of expired rows on the same call.
  await env.DB.prepare(
    "INSERT INTO action_nonces (nonce, used_at, expires_at) VALUES (?, ?, ?)"
  ).bind(nonce, t, t + 600).run();
  try {
    await env.DB.prepare("DELETE FROM action_nonces WHERE expires_at < ?").bind(t).run();
  } catch (_) {}

  return {
    ok: true,
    user,
    actor_user: user,
    actor_pub_fp: fp,
    session_user: sessionUser,
    authorized_by_user: sessionUser || user,
    signing_role: role,
    session_role: sessionRole,
    effective_role: effectiveRole,
    role: effectiveRole,
    authority_path: authorityPath,
    org,
    payload
  };
}

async function requireFreshStaffProof(request, env, org) {
  const developer = await bootstrapDeveloperFromBearer(request, env);
  if (developer) return { ok: true, role: "developer", developer: true, user: developer };

  let body = {};
  try { body = await request.clone().json(); } catch {}
  const token = String(body.staff_session || body.staffSession || "").trim();
  const freshnessS = Math.max(1, parseInt(env.STAFF_HELLO_FRESHNESS_S || "300", 10) || 300);
  const t = now();
  if (!token) {
    return { error: json({ error: "stale_staff_proof", fresh_required_within_s: freshnessS }, 401) };
  }

  const session = await env.DB.prepare(
    "SELECT id, staff_pub_fp, expires_at, created_at FROM org_staff_sessions WHERE id=? AND org_id=?"
  ).bind(token, org.id).first();
  if (!session) return { error: authErr("Invalid staff session", 401) };
  if (Number(session.expires_at) <= t) {
    await env.DB.prepare("DELETE FROM org_staff_sessions WHERE id=?").bind(session.id).run();
    return { error: authErr("Staff session expired", 401) };
  }
  if (Number(session.created_at || 0) < t - freshnessS) {
    return { error: json({ error: "stale_staff_proof", fresh_required_within_s: freshnessS }, 401) };
  }

  await env.DB.prepare("UPDATE org_staff_sessions SET last_seen_at=? WHERE id=?").bind(t, session.id).run();
  return {
    ok: true,
    role: await roleForStaffPubFp(env, org, session.staff_pub_fp),
    staff_session: session.id,
    staff_pub_fp: session.staff_pub_fp
  };
}

async function orgCheckin(request, env) {
  // v6.4.4 — QR diet PR-3 (QR-SLIMMING-SPEC.md): the attendee check-in path
  // accepts org slug (or id) as well as api_key, so slim venue QRs never carry
  // the api_key. Security-neutral here — every attendee already held the key
  // via the old fat QR — and security-positive everywhere else orgAuth gates.
  // recognize / active-checkin already resolve via orgFromRequest; this brings
  // check-in in line. The doorman_scan path inside still demands a valid
  // staff_session, unchanged.
  const org = await orgFromRequest(request, env);
  if (!org) return authErr("Invalid org key or slug", 401);
  let body; try { body = await request.json(); } catch { return err("Invalid JSON"); }
  const { mode, helloPayload, helloHash, attendeeLabel, name, score, bioVerified, gps, staff_session } = body;
  const checkinColumns = await tableColumnSet(env, "org_checkins");
  const hasEventIdColumn = checkinColumns.has("event_id");
  const eventId = hasEventIdColumn ? cleanOptionalText(body.event_id, 90) : "";
  const clientCheckinId = cleanOptionalText(body.client_checkin_id || body.idempotency_key, 90);
  if (clientCheckinId) {
    const existing = await env.DB.prepare("SELECT id,checkin_at,event_id,status,expected_id FROM org_checkins WHERE id=? AND org_id=? LIMIT 1")
      .bind(clientCheckinId, org.id).first();
    if (existing) {
      let expectedName = null;
      if (existing.expected_id) {
        const existingExpected = await env.DB.prepare("SELECT display_name,first_name,surname FROM org_expected WHERE id=? AND org_id=? LIMIT 1")
          .bind(existing.expected_id, org.id).first();
        expectedName = existingExpected && (existingExpected.display_name || `${existingExpected.first_name || ""} ${existingExpected.surname || ""}`.trim()) || null;
      }
      return json({
        checkin_id: existing.id,
        checkin_at: existing.checkin_at,
        org_name: org.name,
        event_id: existing.event_id || null,
        duplicate: true,
        expected_id: existing.expected_id || null,
        ...(expectedName ? { expected_name: expectedName } : {}),
        ...(existing.status === "conflict" ? { conflict: true } : {})
      });
    }
  }
  if (!mode || !["attendee_scan","doorman_scan"].includes(mode)) return err("mode must be attendee_scan or doorman_scan");
  if (mode === "doorman_scan") {
    const staffError = await requireDevOrStaffSession(request, env, org, staff_session);
    if (staffError) return staffError;
  }
  let eventRow = null;
  if (eventId) {
    eventRow = await env.DB.prepare(
      "SELECT e.id,e.name,e.room_id,r.label AS room_label FROM weekly_events e LEFT JOIN rooms r ON r.id=e.room_id AND r.org_id=e.org_id WHERE e.id=? AND e.org_id=? AND e.archived_at IS NULL LIMIT 1"
    ).bind(eventId, org.id).first();
    if (!eventRow) {
      console.warn("[orgCheckin] ignoring stale event_id for org", org.id, eventId);
    }
  }
  const settings = JSON.parse(org.settings_json || "{}");
  const minScore = settings.minScore || 50;
  if (score !== undefined && score < minScore) return err(`Score ${score} below minimum ${minScore}`, 403);
  const id = clientCheckinId || uuid();
  const tNow = now();
  const requestedCheckinTs = Number(body.checkin_ts || helloPayload?.ts || 0);
  const t = Number.isFinite(requestedCheckinTs) && requestedCheckinTs > 0 && requestedCheckinTs <= tNow + 300
    ? Math.floor(requestedCheckinTs)
    : tNow;
  let gpsHash = null;
  if (gps && (settings.privacyMode !== false)) {
    gpsHash = await sha256B64url(canonical({ lat: Math.round(gps.lat * 10000) / 10000, lon: Math.round(gps.lon * 10000) / 10000 }));
  }
  const helloPubJwk = normaliseDevicePubJwk(helloPayload?.pub);
  const attendeeKeyId = helloPubJwk ? await pubKeyId(helloPubJwk) : null;
  const attendeePubJwk = helloPubJwk ? JSON.stringify(helloPubJwk) : null;
  const attendeeDeviceFp = helloPubJwk ? await deviceKeyFp(helloPubJwk) : null;
  const label = settings.anonymousMode ? null : (attendeeLabel || null);
  const displayName = settings.anonymousMode ? null : ((name || attendeeLabel || "").trim() || null);
  // Batch C polish 5 — defence in depth against ghost-row creation. When the
  // org has anonymousMode disabled (the default), an attendee_scan with no
  // resolvable name is what produced the JfpA3uQQisWrkGldzD row Captain spotted:
  // empty name -> r.name fell through to attendee_key_id in the dashboard
  // renderer. The frontend was fixed (the "I'm not on the list" button now
  // shows a "See an organiser" hold screen instead of POSTing). This guard
  // catches any future broken client (or direct API poke) that tries the same.
  // doorman_scan is exempt: staff records walk-ins legitimately under their
  // own staff_session, and that path validates the staff identity instead.
  if (mode === "attendee_scan" && !settings.anonymousMode && !displayName) {
    return err("attendee_scan requires a resolvable name when anonymousMode is off - speak to an organiser", 422);
  }
  let link = { linked: false };
  let expected = null;
  let status = "checked_in";
  let expectedId = null;
  let conflictId = null;
  if (attendeeDeviceFp) {
    expected = await findExpectedByDeviceFp(env, org.id, attendeeDeviceFp);
    if (expected) expectedId = expected.id;
  }
  if (!expected && displayName) {
    expected = await env.DB.prepare(
      `SELECT ${EXPECTED_SELECT} FROM org_expected WHERE org_id=? AND archived_at IS NULL AND LOWER(display_name)=LOWER(?) ORDER BY id ASC LIMIT 1`
    ).bind(org.id, displayName).first();
    if (expected) {
      expected.device_key_fps = await expectedKeySet(env, org.id, expected.id);
      expectedId = expected.id;
      const knownKeys = new Set(expected.device_key_fps || []);
      if (expected.device_pub_fp && attendeeDeviceFp && !knownKeys.has(attendeeDeviceFp)) {
        status = "conflict";
      }
    }
  }
  const insertColumns = ["id","org_id","mode","attendee_label","attendee_key_id","hello_hash","score","bio_verified","gps_hash","checkin_at","created_at","name","attendee_pub_jwk","device_key_fp","status","expected_id"];
  const insertValues = [id, org.id, mode, label, attendeeKeyId, helloHash||null, score||null, bioVerified?1:0, gpsHash, t, t, displayName, attendeePubJwk, attendeeDeviceFp, status, expectedId];
  if (hasEventIdColumn) {
    insertColumns.push("event_id");
    insertValues.push(eventRow?.id || null);
  }
  await env.DB.prepare(
    `INSERT INTO org_checkins (${insertColumns.join(",")}) VALUES (${insertColumns.map(() => "?").join(",")})`
  ).bind(...insertValues).run();
  if (status === "conflict" && expected) {
    const conflict = await env.DB.prepare(
      "INSERT INTO attendee_conflicts (org_code,expected_id,checkin_id,bound_device_fp,claiming_device_fp,claimed_name,created_at) VALUES (?,?,?,?,?,?,?) RETURNING id"
    ).bind(org.id, expected.id, id, expected.device_pub_fp, attendeeDeviceFp, displayName, t).first();
    conflictId = conflict?.id || null;
    await env.DB.prepare("UPDATE org_checkins SET conflict_id=? WHERE id=? AND org_id=?").bind(conflictId, id, org.id).run();
    link = { linked: false, conflict: true, expected_id: expected.id, conflict_id: conflictId };
  } else if (expected) {
      await env.DB.prepare(
        "UPDATE org_expected SET device_pub_fp=COALESCE(device_pub_fp,?) WHERE id=? AND org_id=?"
      ).bind(attendeeDeviceFp, expected.id, org.id).run();
      link = { linked: true, expected_id: expected.id, expected_name: expected.display_name || `${expected.first_name || ""} ${expected.surname || ""}`.trim() };
  }
  let receiptResult = null;
  let receiptUnavailable = false;
  try {
    receiptResult = await mintOrgReceipt(env, request, org, {
      id,
      org_id: org.id,
      mode,
      attendee_label: label,
      attendee_key_id: attendeeKeyId,
      hello_hash: helloHash || null,
      score: score || null,
      bio_verified: bioVerified ? 1 : 0,
      gps_hash: gpsHash,
      checkin_at: t,
      created_at: t,
      name: displayName,
      attendee_pub_jwk: attendeePubJwk,
      device_key_fp: attendeeDeviceFp,
      status,
      expected_id: expectedId
    }, { gps, expected, score, bioVerified, action: "in", event_id: eventRow?.id || null, event_name: eventRow?.name || null, room: eventRow?.room_label || null });
  } catch (e) {
    console.warn("org receipt mint failed:", e && (e.message || e));
    receiptUnavailable = true;
  }
  return json({
    checkin_id: id,
    checkin_at: t,
    org_name: org.name,
    event_id: eventRow?.id || null,
    event_name: eventRow?.name || null,
    settings,
    ...(receiptResult ? { receipt_id: receiptResult.receipt_id, receipt_url: receiptResult.receipt_url, receipt: receiptResult.receipt } : { receipt_unavailable: receiptUnavailable }),
    ...link
  });
}

async function orgCheckout(request, env) {
  // v6.4.4a — QR diet follow-up: check-out is the same attendee surface as
  // check-in (org-entry.html sends orgParam, which is now a slug on slim QRs).
  // Caught on Captain's first hardware smoke: "Check-out rejected / Invalid
  // API key". The security boundary here is the ECDSA signature over
  // checkout_payload verified against the checked-in device key below — the
  // api_key never gated anything an attendee didn't already hold.
  const org = await orgFromRequest(request, env);
  if (!org) return authErr("Invalid org key or slug", 401);
  let body; try { body = await request.json(); } catch { return err("Invalid JSON"); }
  const url = new URL(request.url);
  const legacyCheckout = url.searchParams.get("checkout_method") === "legacy";
  const { checkin_id, attendee_key_id, checkout_payload, signature } = body;
  if (!checkin_id && !attendee_key_id) return err("checkin_id or attendee_key_id required");
  const row = checkin_id
    ? await env.DB.prepare("SELECT * FROM org_checkins WHERE id=? AND org_id=?").bind(checkin_id, org.id).first()
    : await env.DB.prepare("SELECT * FROM org_checkins WHERE attendee_key_id=? AND org_id=? AND checkout_at IS NULL ORDER BY checkin_at DESC LIMIT 1").bind(attendee_key_id, org.id).first();
  if (!row) return err("Check-in record not found", 404);
  if (row.checkout_at) return err("Already checked out");
  const t = now();
  const duration = t - row.checkin_at;
  if (legacyCheckout) {
    await env.DB.prepare("UPDATE org_checkins SET checkout_at=?, duration_s=?, checkout_ts=?, checkout_method=? WHERE id=?")
      .bind(t, duration, t, "legacy_button", row.id).run();
    return json({ ok: true, checkin_id: row.id, checkout_at: t, duration_s: duration, checkout_method: "legacy_button" });
  }
  if (!checkout_payload || !signature) return err("checkout_payload and signature required", 400);
  if (checkout_payload.checkin_id !== row.id) return err("checkout payload checkin_id mismatch", 400);
  if (!checkout_payload.nonce) return err("checkout payload nonce required", 400);
  if (!row.attendee_pub_jwk) return err("missing_attendee_public_key", 409);
  const pub = JSON.parse(row.attendee_pub_jwk);
  const payloadHash = await sha256B64url(canonical(checkout_payload));
  const valid = await verifySig(payloadHash, signature, pub);
  if (!valid) return err("invalid_checkout_signature", 401);
  await env.DB.prepare(
    "UPDATE org_checkins SET checkout_at=?, duration_s=?, checkout_ts=?, checkout_payload_hash=?, checkout_signature=?, checkout_method=? WHERE id=?"
  ).bind(t, duration, t, payloadHash, signature, "signed", row.id).run();
  return json({ ok: true, checkin_id: row.id, checkout_at: t, duration_s: duration, checkout_method: "signed" });
}

async function orgCreateCheckoutToken(request, env) {
  const org = await orgAuth(request, env); if (org.error) return org;
  let body; try { body = await request.json(); } catch { return err("Invalid JSON"); }
  const checkinId = String(body.checkin_id || "").trim();
  if (!checkinId) return err("checkin_id required");

  const checkin = await env.DB.prepare(
    "SELECT id, checkout_at FROM org_checkins WHERE id=? AND org_id=?"
  ).bind(checkinId, org.id).first();
  if (!checkin) return err("Check-in record not found", 404);
  if (checkin.checkout_at) return err("Already checked out", 409);

  const t = now();
  await env.DB.prepare(
    "UPDATE org_checkout_tokens SET consumed_at=? WHERE org_api_key=? AND checkin_id=? AND consumed_at IS NULL AND expires_at>?"
  ).bind(t, org.api_key, checkinId, t).run();

  const token = "chk_" + randomToken();
  const expiresAt = t + 5 * 60;
  await env.DB.prepare(
    "INSERT INTO org_checkout_tokens (token,checkin_id,org_api_key,created_at,expires_at,consumed_at) VALUES (?,?,?,?,?,NULL)"
  ).bind(token, checkinId, org.api_key, t, expiresAt).run();

  return json({ token, expires_at: expiresAt });
}

async function orgResolveCheckoutToken(request, env, tokenParam) {
  const token = String(tokenParam || "").trim();
  if (!token) return err("Checkout token not found", 404);

  const row = await env.DB.prepare(
    "SELECT token,checkin_id,org_api_key,expires_at,consumed_at FROM org_checkout_tokens WHERE token=?"
  ).bind(token).first();
  if (!row || row.consumed_at) return err("Checkout token not found", 404);

  const t = now();
  if (Number(row.expires_at) <= t) {
    return err("Checkout token expired", 410);
  }

  const org = await env.DB.prepare(
    "SELECT name,settings_json FROM organisations WHERE api_key=?"
  ).bind(row.org_api_key).first();
  if (!org) return err("Checkout token not found", 404);

  const checkin = await env.DB.prepare(
    "SELECT id, checkout_at FROM org_checkins WHERE id=?"
  ).bind(row.checkin_id).first();
  if (!checkin || checkin.checkout_at) return err("Checkout token not found", 404);

  await env.DB.prepare(
    "UPDATE org_checkout_tokens SET consumed_at=? WHERE token=? AND consumed_at IS NULL"
  ).bind(t, token).run();

  const settings = JSON.parse(org.settings_json || "{}");
  return json({
    org_api_key: row.org_api_key,
    checkin_id: row.checkin_id,
    nonce: row.token,
    event: org.name || "IRLid Event",
    logo: settings.logoUrl || ""
  });
}

async function orgAttendance(request, env) {
  const org = await orgAuth(request, env); if (org.error) return org;
  const url = new URL(request.url);
  const includeExpected = url.searchParams.get("include_expected") === "1";
  const requestedLimit = parseInt(url.searchParams.get("limit") || "60", 10);
  const limit = Math.max(1, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 60, 150));
  const checkinColumns = await tableColumnSet(env, "org_checkins");
  const hasCheckinColumn = (name) => checkinColumns.has(name);
  let eventId = cleanOptionalText(url.searchParams.get("event_id"), 90);
  if (eventId && hasCheckinColumn("event_id")) {
    const eventRow = await env.DB.prepare(
      "SELECT id FROM weekly_events WHERE id=? AND org_id=? AND archived_at IS NULL LIMIT 1"
    ).bind(eventId, org.id).first();
    if (!eventRow) {
      console.warn("[orgAttendance] ignoring stale event_id for org", org.id, eventId);
      eventId = null;
    }
  }
  if (eventId && !hasCheckinColumn("event_id")) eventId = null;
  await maybeAutoCheckoutAfterEventGrace(env, org, checkinColumns);
  // v5.11.2 - `since` is honoured if passed (client convention: local midnight today
  // as unix epoch). Fallback to 24h sliding window for legacy / unauth'd callers
  // only; the dashboard always passes since explicitly.
  const since = url.searchParams.get("since") ? parseInt(url.searchParams.get("since")) : (now() - 86400);
  const checkinClauses = ["c.org_id=?", "c.checkin_at>=?"];
  const checkinBinds = [org.id, since];
  if (eventId) {
    checkinClauses.push("c.event_id=?");
    checkinBinds.push(eventId);
  }
  const selectCheckinColumn = (name, fallback = "NULL") =>
    hasCheckinColumn(name) ? `c.${name} AS ${name}` : `${fallback} AS ${name}`;
  const receiptJoin = await tableExists(env, "org_receipts")
    ? " LEFT JOIN org_receipts r ON r.checkin_id=c.id"
    : "";
  const receiptSelect = receiptJoin ? "r.id AS receipt_id" : "NULL AS receipt_id";
  const checkoutMethodSelect =
    hasCheckinColumn("checkout_signature") && hasCheckinColumn("checkout_method")
      ? "CASE WHEN c.checkout_at IS NOT NULL AND c.checkout_signature IS NOT NULL THEN 'signed' WHEN c.checkout_at IS NOT NULL AND c.checkout_method IS NOT NULL THEN c.checkout_method WHEN c.checkout_at IS NOT NULL THEN 'legacy_button' ELSE c.checkout_method END AS checkout_method"
      : hasCheckinColumn("checkout_method")
        ? "c.checkout_method AS checkout_method"
        : "NULL AS checkout_method";
  const rows = await env.DB.prepare(
    "SELECT " + [
      "c.id AS id",
      "c.mode AS mode",
      "c.attendee_label AS attendee_label",
      "c.attendee_key_id AS attendee_key_id",
      "c.hello_hash AS hello_hash",
      selectCheckinColumn("score"),
      selectCheckinColumn("bio_verified", "0"),
      selectCheckinColumn("gps_hash"),
      "c.checkin_at AS checkin_at",
      selectCheckinColumn("checkout_at"),
      selectCheckinColumn("duration_s"),
      selectCheckinColumn("name"),
      selectCheckinColumn("device_key_fp"),
      selectCheckinColumn("status", "'checked_in'"),
      selectCheckinColumn("expected_id"),
      selectCheckinColumn("conflict_id"),
      selectCheckinColumn("event_id"),
      receiptSelect,
      checkoutMethodSelect,
      selectCheckinColumn("checkout_ts")
    ].join(",") + " FROM org_checkins c" + receiptJoin + " WHERE " +
    checkinClauses.join(" AND ") +
    " ORDER BY c.checkin_at DESC LIMIT ?"
  ).bind(...checkinBinds, limit).all();
  const checkins = rows.results || [];
  applyLatestReceiptPerAttendanceIdentity(checkins);

  const statusExpr = hasCheckinColumn("status") ? "COALESCE(c.status,'checked_in')" : "'checked_in'";
  const checkoutAtExpr = hasCheckinColumn("checkout_at") ? "c.checkout_at" : "NULL";
  const scoreExpr = hasCheckinColumn("score") ? "c.score" : "NULL";
  const bioVerifiedExpr = hasCheckinColumn("bio_verified") ? "c.bio_verified" : "0";
  const statsRow = await env.DB.prepare(
    "SELECT " + [
      `COUNT(CASE WHEN ${checkoutAtExpr} IS NULL AND ${statusExpr}!='invalid' THEN 1 END) AS currently_in`,
      `COUNT(CASE WHEN ${checkoutAtExpr} IS NOT NULL AND ${statusExpr}!='invalid' THEN 1 END) AS checked_out`,
      `ROUND(AVG(${scoreExpr})) AS avg_score`,
      `SUM(CASE WHEN ${bioVerifiedExpr} THEN 1 ELSE 0 END) AS bio_verified`,
      "COUNT(*) AS total"
    ].join(",") + " FROM org_checkins c WHERE " + checkinClauses.join(" AND ")
  ).bind(...checkinBinds).first();
  const stats = {
    total: Number(statsRow?.total || 0),
    currently_in: Number(statsRow?.currently_in || 0),
    checked_out: Number(statsRow?.checked_out || 0),
    avg_score: Number(statsRow?.avg_score || 0),
    bio_verified: Number(statsRow?.bio_verified || 0)
  };
  if (!includeExpected) {
    return json({ checkins, stats });
  }
  const expectedSql = eventId && hasCheckinColumn("event_id") && hasCheckinColumn("expected_id")
    ? "SELECT e.id AS expected_id,e.display_name AS name,COALESCE(e.role_key,'attendee') AS role,COALESCE(e.role_key,'attendee') AS prototype_role FROM org_expected e JOIN event_expected ee ON ee.expected_id=e.id WHERE ee.event_id=? AND e.org_id=? AND e.archived_at IS NULL AND NOT EXISTS (SELECT 1 FROM org_checkins c WHERE c.org_id=? AND c.event_id=? AND c.expected_id=e.id AND c.checkin_at>=?) ORDER BY LOWER(e.display_name) ASC, e.id ASC"
    : hasCheckinColumn("expected_id")
      ? "SELECT e.id AS expected_id,e.display_name AS name,COALESCE(e.role_key,'attendee') AS role,COALESCE(e.role_key,'attendee') AS prototype_role FROM org_expected e WHERE e.org_id=? AND e.archived_at IS NULL AND e.device_pub_fp IS NOT NULL AND NOT EXISTS (SELECT 1 FROM org_checkins c WHERE c.org_id=? AND c.expected_id=e.id AND c.checkin_at>=?) ORDER BY LOWER(e.display_name) ASC, e.id ASC"
      : "SELECT e.id AS expected_id,e.display_name AS name,COALESCE(e.role_key,'attendee') AS role,COALESCE(e.role_key,'attendee') AS prototype_role FROM org_expected e WHERE e.org_id=? AND e.archived_at IS NULL AND e.device_pub_fp IS NOT NULL ORDER BY LOWER(e.display_name) ASC, e.id ASC";
  const expectedBinds = eventId && hasCheckinColumn("event_id") && hasCheckinColumn("expected_id")
    ? [eventId, org.id, org.id, eventId, since]
    : hasCheckinColumn("expected_id")
      ? [org.id, org.id, since]
      : [org.id];
  const expected = await env.DB.prepare(expectedSql).bind(...expectedBinds).all();
  const expectedRows = (expected.results || []).map(row => ({
    id: `expected:${row.expected_id}`,
    expected_id: row.expected_id,
    name: row.name,
    role: row.role,
    prototype_role: row.prototype_role,
    scan_count: 0,
    status: "linked expected",
    first_seen: null,
    last_seen: null,
    expected_only: true
  }));
  return json({ checkins: checkins.concat(expectedRows), stats });
}

async function maybeAutoCheckoutAfterEventGrace(env, org, checkinColumns) {
  const orgId = String(org?.id || "");
  if (!orgId) return;
  const t = Date.now();
  const lastRun = autoCheckoutLastRunByOrg.get(orgId) || 0;
  if (t - lastRun < AUTO_CHECKOUT_MIN_INTERVAL_MS) return;
  autoCheckoutLastRunByOrg.set(orgId, t);
  await autoCheckoutAfterEventGrace(env, org, checkinColumns);
}

async function autoCheckoutAfterEventGrace(env, org, checkinColumns) {
  if (!checkinColumns.has("event_id") || !checkinColumns.has("checkout_at") || !checkinColumns.has("checkout_method")) return;
  let settings = {};
  try { settings = JSON.parse(org.settings_json || "{}"); } catch (_) { settings = {}; }
  const defaults = settings.calendar_defaults || {};
  if (defaults.auto_checkout !== true) return;

  const graceMin = boundedInteger(defaults.checkout_grace, 0, 1440, 60);
  const activeRows = await env.DB.prepare(
    `SELECT c.id,c.checkin_at,c.event_id,e.day_of_week,e.start_time_local,e.duration_min
     FROM org_checkins c
     JOIN weekly_events e ON e.id=c.event_id AND e.org_id=c.org_id AND e.archived_at IS NULL
     WHERE c.org_id=?
       AND c.checkout_at IS NULL
       AND c.event_id IS NOT NULL
       AND COALESCE(c.status,'checked_in') NOT IN ('invalid','conflict')`
  ).bind(org.id).all();

  const t = now();
  const statements = [];
  for (const row of (activeRows.results || [])) {
    const checkoutAt = eventCheckoutGraceEpoch(row, graceMin);
    if (!checkoutAt || t < checkoutAt) continue;
    const duration = Math.max(0, checkoutAt - (Number(row.checkin_at) || checkoutAt));
    if (checkinColumns.has("duration_s") && checkinColumns.has("checkout_ts")) {
      statements.push(env.DB.prepare(
        "UPDATE org_checkins SET checkout_at=?, duration_s=?, checkout_ts=?, checkout_method='auto' WHERE id=? AND org_id=? AND checkout_at IS NULL"
      ).bind(checkoutAt, duration, checkoutAt, row.id, org.id));
    } else if (checkinColumns.has("duration_s")) {
      statements.push(env.DB.prepare(
        "UPDATE org_checkins SET checkout_at=?, duration_s=?, checkout_method='auto' WHERE id=? AND org_id=? AND checkout_at IS NULL"
      ).bind(checkoutAt, duration, row.id, org.id));
    } else {
      statements.push(env.DB.prepare(
        "UPDATE org_checkins SET checkout_at=?, checkout_method='auto' WHERE id=? AND org_id=? AND checkout_at IS NULL"
      ).bind(checkoutAt, row.id, org.id));
    }
  }
  if (statements.length) await env.DB.batch(statements);
}

function boundedInteger(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return fallback;
  return n;
}

function eventCheckoutGraceEpoch(row, graceMin) {
  const checkinAt = Number(row.checkin_at);
  const eventDay = Number(row.day_of_week);
  const durationMin = Number(row.duration_min);
  if (!Number.isFinite(checkinAt) || checkinAt <= 0) return null;
  if (!Number.isInteger(eventDay) || eventDay < 1 || eventDay > 7) return null;
  if (!Number.isFinite(durationMin) || durationMin < 1) return null;
  const parts = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(row.start_time_local || ""));
  if (!parts) return null;

  const anchor = new Date(checkinAt * 1000);
  const anchorDow = anchor.getUTCDay() === 0 ? 7 : anchor.getUTCDay();
  const dayOffset = eventDay - anchorDow;
  const startMs = Date.UTC(
    anchor.getUTCFullYear(),
    anchor.getUTCMonth(),
    anchor.getUTCDate() + dayOffset,
    Number(parts[1]),
    Number(parts[2]),
    0,
    0
  );
  return Math.floor(startMs / 1000) + (Math.floor(durationMin) + graceMin) * 60;
}

function attendanceReceiptIdentity(row) {
  if (!row) return "";
  if (row.status === "conflict") return `conflict:${row.conflict_id || row.id || ""}`;
  return String(row.attendee_key_id || row.attendee_label || row.name || row.id || "");
}

function attendanceReceiptSortTs(row) {
  return Number(row?.checkin_at || row?.created_at || 0) || 0;
}

function applyLatestReceiptPerAttendanceIdentity(checkins) {
  const latestByIdentity = new Map();
  for (const row of checkins || []) {
    const identity = attendanceReceiptIdentity(row);
    if (!identity) continue;
    const current = latestByIdentity.get(identity);
    const ts = attendanceReceiptSortTs(row);
    if (!current || ts > current.ts) {
      latestByIdentity.set(identity, { id: row.id, ts });
    }
  }
  for (const row of checkins || []) {
    const identity = attendanceReceiptIdentity(row);
    const latest = identity ? latestByIdentity.get(identity) : null;
    if (latest && row.id !== latest.id) row.receipt_id = null;
  }
}

function isDebugOrg(org) {
  const key = String(org.api_key || "");
  const slug = String(org.slug || "").toLowerCase();
  return key === "org_DEV_IRLID_TEST_ENVIRONMENT" || key.startsWith("org_DEV_") || slug === "dev" || slug.startsWith("codex-");
}

async function tableExists(env, tableName) {
  const row = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).bind(tableName).first();
  return !!row;
}

async function tableColumnSet(env, tableName) {
  const rows = await env.DB.prepare(`PRAGMA table_info(${tableName})`).all();
  return new Set((rows.results || []).map(row => row.name));
}

function staffSessionTokenFrom(request, body) {
  const url = new URL(request.url);
  return String(
    request.headers.get("X-Staff-Session")
    || url.searchParams.get("staff_session")
    || url.searchParams.get("staffSession")
    || (body && (body.staff_session || body.staffSession))
    || ""
  ).trim();
}

async function requireCalendarStaff(request, env, org, body) {
  if (request.method === "GET" && requestHasOrgServiceAccount(request, org)) {
    return { ok: true };
  }

  const staffError = await requireDevOrStaffSession(request, env, org, staffSessionTokenFrom(request, body));
  if (!staffError) return { ok: true };

  const ctx = await requireSession(request, env);
  if (!ctx.error) {
    const role = await orgRoleForUser(env, ctx.user, org.id);
    if (expectedRoleRank(role) >= expectedRoleRank("staff")) return { ok: true };
  }

  return { error: staffError };
}

async function requireCalendarSignedAction(request, env, org, body, payloadSchema) {
  const action = await requireSignedAction(body, env, {
    expectedType: "irlid_calendar_write_v5",
    orgId: org.id,
    minRole: await calendarWriteMinRoleForOrg(env, org),
    payloadSchema: payloadSchema || (() => true),
    request
  });
  return action.error ? { error: action.error } : action;
}

function cleanText(value, maxLen) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text.slice(0, maxLen);
}

function cleanOptionalText(value, maxLen) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLen) : null;
}

function initialsForName(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map(part => part[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 8);
}

function slugPart(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function newExpectedId(displayName) {
  const slug = slugPart(displayName) || "person";
  return `p_${slug}_${randomToken().slice(0, 8)}`;
}

function newEventId() {
  return `evt_${randomToken().slice(0, 22)}`;
}

function parseDayOfWeek(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (/^[1-7]$/.test(raw)) return Number(raw);
  const map = {
    monday: 1, mon: 1,
    tuesday: 2, tue: 2, tues: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4, thur: 4, thurs: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6,
    sunday: 7, sun: 7
  };
  return map[raw] || null;
}

function isLocalTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || "").trim());
}

function cleanRoleKey(value) {
  return expectedMemberRole(value || "attendee");
}

function attendeeOnlyExpectedRole(body, surface) {
  const value = body.role_key ?? body.prototype_role ?? body.role;
  if (value !== undefined && value !== null && String(value).trim().toLowerCase() !== "attendee") {
    console.warn(`[${surface}] non-attendee role coerced to attendee; use Invite Staff for role assignment`);
  }
  return "attendee";
}

function boolishToInt(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const text = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(text)) return 1;
  if (["0", "false", "no", "n", "off"].includes(text)) return 0;
  return fallback;
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const src = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(r => r.some(c => String(c || "").trim() !== ""));
}

function csvHeaderMap(headerRow) {
  const map = {};
  headerRow.forEach((h, ix) => {
    const key = String(h || "").trim().toLowerCase();
    if (key) map[key] = ix;
  });
  return map;
}

function csvCell(row, header, name) {
  const ix = header[name];
  return ix === undefined ? "" : String(row[ix] || "").trim();
}

async function ensureExpectedIdsForOrg(env, orgId, ids) {
  const unique = Array.from(new Set((ids || []).map(id => String(id || "").trim()).filter(Boolean)));
  if (!unique.length) return { ok: true, ids: [] };
  const placeholders = unique.map(() => "?").join(",");
  const rows = await env.DB.prepare(
    `SELECT id FROM org_expected WHERE org_id=? AND archived_at IS NULL AND id IN (${placeholders})`
  ).bind(orgId, ...unique).all();
  const found = new Set((rows.results || []).map(r => r.id));
  const missing = unique.filter(id => !found.has(id));
  if (missing.length) return { ok: false, missing };
  return { ok: true, ids: unique };
}

async function calendarActionExpectedIdsForOrg(env, orgId, ids, calendarAction) {
  const check = await ensureExpectedIdsForOrg(env, orgId, ids);
  if (check.ok) return check;
  const missing = new Set(check.missing || []);
  const kept = Array.from(new Set((ids || []).map(id => String(id || "").trim()).filter(Boolean)))
    .filter(id => !missing.has(id));
  console.warn(`[calendarActionExpectedIdsForOrg] ${calendarAction || "write"} ignored missing expected_ids: ${Array.from(missing).join(",")}`);
  return { ok: true, ids: kept, missing: check.missing || [] };
}

function eventResponse(row, expectedIds) {
  return {
    id: row.id,
    org_id: row.org_id,
    room_id: row.room_id || null,
    name: row.name,
    day_of_week: Number(row.day_of_week),
    start_time_local: row.start_time_local,
    duration_min: Number(row.duration_min),
    capacity: row.capacity === null || row.capacity === undefined ? null : Number(row.capacity),
    color_hex: row.color_hex || null,
    notes: row.notes || "",
    require_proof: Number(row.require_proof || 0),
    late_grace_min: Number(row.late_grace_min || 0),
    created_at: Number(row.created_at),
    archived_at: row.archived_at || null,
    expected_ids: expectedIds || []
  };
}

async function rowsForWeeklyEvents(env, orgId, filters = {}) {
  const clauses = ["e.org_id=?", "e.archived_at IS NULL"];
  const binds = [orgId];
  if (filters.room_id) {
    clauses.push("e.room_id=?");
    binds.push(filters.room_id);
  }
  if (filters.day_of_week) {
    clauses.push("e.day_of_week=?");
    binds.push(filters.day_of_week);
  }
  const rows = await env.DB.prepare(
    `SELECT e.*, GROUP_CONCAT(ee.expected_id, '|') AS expected_ids ` +
    `FROM weekly_events e LEFT JOIN event_expected ee ON ee.event_id=e.id ` +
    `WHERE ${clauses.join(" AND ")} GROUP BY e.id ` +
    `ORDER BY e.day_of_week ASC, e.start_time_local ASC, LOWER(e.name) ASC`
  ).bind(...binds).all();
  return (rows.results || []).map(row => eventResponse(
    row,
    row.expected_ids ? String(row.expected_ids).split("|").filter(Boolean) : []
  ));
}

async function orgCurrentEvent(request, env) {
  const org = await orgAuth(request, env); if (org.error) return org;
  const nowDate = new Date();
  const dayOfWeek = nowDate.getUTCDay() === 0 ? 7 : nowDate.getUTCDay();
  const timeStr = nowDate.toTimeString().slice(0, 5);
  const row = await env.DB.prepare(
    `SELECT id, name, room_id, start_time_local, duration_min
     FROM weekly_events
     WHERE org_id=?
       AND day_of_week=?
       AND start_time_local<=?
       AND archived_at IS NULL
     ORDER BY start_time_local DESC
     LIMIT 1`
  ).bind(org.id, dayOfWeek, timeStr).first();
  if (!row) return json({ ok: true, event: null });

  const [h, m] = String(row.start_time_local || "00:00").split(":").map(Number);
  const [ch, cm] = timeStr.split(":").map(Number);
  const startMin = (Number(h) || 0) * 60 + (Number(m) || 0);
  const nowMin = ch * 60 + cm;
  const durationMin = Number(row.duration_min || 60);
  if (nowMin >= startMin + durationMin) return json({ ok: true, event: null });

  return json({ ok: true, event: row });
}

async function orgRoomsList(request, env) {
  const org = await orgAuth(request, env); if (org.error) return org;
  const staff = await requireCalendarStaff(request, env, org);
  if (staff.error) return staff.error;
  const rows = await env.DB.prepare(
    "SELECT id,label,subname,capacity,display_ix,venue_qr_payload_hash FROM rooms WHERE org_id=? AND archived_at IS NULL ORDER BY display_ix ASC, LOWER(label) ASC"
  ).bind(org.id).all();
  return json({ rooms: rows.results || [] });
}

async function orgDebugClearAttendance(request, env) {
  const org = await orgAuth(request, env); if (org.error) return org;
  // Batch C polish 9 — Captain's call: clear-attendance should be available to
  // Developer (any org, for ops + bake-off testing) and Lead Admin (their own
  // org, for legitimate dataset reset). The legacy isDebugOrg key/slug match
  // remains as a third allow path so existing DEV orgs keep working without
  // requiring a session token. If a Bearer session is present, validate it and
  // check for Developer or org-scoped lead_admin membership.
  let allowed = isDebugOrg(org);
  if (!allowed) {
    const auth = request.headers.get("Authorization") || "";
    const m = /^Bearer\s+([A-Za-z0-9_-]{16,})$/.exec(auth.trim());
    if (m) {
      const ctx = await requireSession(request, env);
      if (!ctx.error) {
        const user = ctx.user;
        if (isBootstrapDeveloperFp(env, user.pub_fp)) {
          allowed = true; // Developer — clear any org
        } else {
          // Lead Admin / Developer membership of the requested org.
          const membership = await env.DB.prepare(
            "SELECT role FROM org_memberships WHERE user_id = ? AND org_id = ?"
          ).bind(user.id, org.id).first();
          if (membership && (membership.role === "lead_admin" || membership.role === "developer")) {
            allowed = true;
          }
        }
      }
    }
  }
  if (!allowed) return err("Clear attendance requires Developer or Lead Admin role", 403);

  let body; try { body = await request.json(); } catch { body = {}; }
  const includeExpected = !!body.include_expected;

  // v6.4.4b — org_receipts.checkin_id carries an FK to org_checkins(id)
  // (v6.0 receipt bridge), so receipts must go before the check-ins they
  // reference or the whole clear aborts with SQLITE_CONSTRAINT_FOREIGNKEY.
  if (await tableExists(env, "org_receipts")) {
    await env.DB.prepare("DELETE FROM org_receipts WHERE org_id=?").bind(org.id).run();
  }
  const checkins = await env.DB.prepare("DELETE FROM org_checkins WHERE org_id=?").bind(org.id).run();
  const conflicts = await env.DB.prepare("DELETE FROM attendee_conflicts WHERE org_code=?").bind(org.id).run();
  let checkoutTokensCleared = 0;
  if (await tableExists(env, "org_checkout_tokens")) {
    const tokens = await env.DB.prepare("DELETE FROM org_checkout_tokens WHERE org_api_key=?").bind(org.api_key).run();
    checkoutTokensCleared = tokens.meta?.changes || 0;
  }

  let expectedCleared = 0;
  if (includeExpected) {
    const expectedIds = await env.DB.prepare("SELECT id FROM org_expected WHERE org_id=?").bind(org.id).all();
    const ids = (expectedIds.results || []).map(r => r.id);
    if (ids.length && await tableExists(env, "rebind_history")) {
      for (const id of ids) {
        await env.DB.prepare("DELETE FROM rebind_history WHERE org_code=? AND expected_id=?").bind(org.id, id).run();
      }
    }
    const expected = await env.DB.prepare("DELETE FROM org_expected WHERE org_id=?").bind(org.id).run();
    expectedCleared = expected.meta?.changes || 0;
  }

  return json({
    ok: true,
    org_key: org.api_key,
    cleared: {
      checkins: checkins.meta?.changes || 0,
      conflicts: conflicts.meta?.changes || 0,
      checkout_tokens: checkoutTokensCleared,
      expected_attendees: expectedCleared
    }
  });
}

async function orgExpectedList(request, env) {
  // v6.4.4a — QR diet follow-up. Slim venue QRs hand the attendee phone a slug,
  // not the api_key, so the "I'm not on the list" picker can no longer present
  // the service-account key. Resolution widened to orgFromRequest; FULL rows
  // (email/phone hints, notes, raw device fp) stay gated behind the service
  // account or a staff session exactly as before. Slug-tier callers get a
  // REDACTED picker list — id, display name, initials, role, linked flag —
  // and only while the org's allowSelfSelection setting permits. Net privacy
  // vs the fat-QR era is BETTER: a photo of the old QR yielded the api_key and
  // with it the full hint columns.
  const org = await orgFromRequest(request, env);
  if (!org) return authErr("Invalid org key or slug", 401);
  const staff = await requireCalendarStaff(request, env, org);
  if (staff.error) {
    let settings = {};
    try { settings = JSON.parse(org.settings_json || "{}") || {}; } catch { settings = {}; }
    if (settings.allowSelfSelection === false) return staff.error;
    const rows = await env.DB.prepare(
      "SELECT id,display_name,initials,COALESCE(role_key,'attendee') AS role_key,device_pub_fp FROM org_expected WHERE org_id=? AND archived_at IS NULL ORDER BY LOWER(display_name) ASC, id ASC"
    ).bind(org.id).all();
    const redacted = (rows.results || []).map(r => ({
      id: r.id,
      display_name: r.display_name,
      initials: r.initials,
      role_key: r.role_key,
      // Truthy "linked" flag only — the picker renders "Already linked" off
      // this; the raw fingerprint never leaves the staff-tier response.
      device_key_fp: !!r.device_pub_fp
    }));
    return noStore(json({ expected: redacted, redacted: true }));
  }
  const rows = await env.DB.prepare(
    `SELECT ${EXPECTED_SELECT} FROM org_expected WHERE org_id=? AND archived_at IS NULL ORDER BY LOWER(display_name) ASC, id ASC`
  ).bind(org.id).all();
  return json({ expected: rows.results });
}

async function orgExpectedCreate(request, env) {
  const org = await orgAuth(request, env); if (org.error) return org;
  let body; try { body = await request.json(); } catch { return err("Invalid JSON"); }
  const staff = await requireCalendarStaff(request, env, org, body);
  if (staff.error) return staff.error;
  const displayName = cleanText(body.display_name || [body.first_name, body.surname].filter(Boolean).join(" "), 80);
  const roleKey = attendeeOnlyExpectedRole(body, "orgExpectedCreate");
  if (!displayName) return err("display_name required");
  const existing = await env.DB.prepare(
    "SELECT id FROM org_expected WHERE org_id=? AND archived_at IS NULL AND LOWER(display_name)=LOWER(?) LIMIT 1"
  ).bind(org.id, displayName).first();
  if (existing) return json({ error: "duplicate", existing_id: existing.id }, 409);
  const createdAt = now();
  const id = cleanOptionalText(body.id, 80) || newExpectedId(displayName);
  const initials = cleanOptionalText(body.initials, 16) || initialsForName(displayName);
  const row = await env.DB.prepare(
    `INSERT INTO org_expected (id,org_id,display_name,initials,role_key,device_pub_fp,email_hint,phone_hint,notes,created_at,archived_at) ` +
    `VALUES (?,?,?,?,?,?,?,?,?,?,NULL) RETURNING ${EXPECTED_SELECT}`
  ).bind(
    id,
    org.id,
    displayName,
    initials,
    roleKey,
    cleanOptionalText(body.device_pub_fp, 128),
    cleanOptionalText(body.email_hint, 160),
    cleanOptionalText(body.phone_hint, 80),
    cleanOptionalText(body.notes, 1000),
    createdAt
  ).first();
  return json({ expected_id: row.id, expected: row }, 201);
}

async function orgWeeklyEventsList(request, env) {
  const org = await orgAuth(request, env); if (org.error) return org;
  const staff = await requireCalendarStaff(request, env, org);
  if (staff.error) return staff.error;
  const url = new URL(request.url);
  const day = url.searchParams.get("day") ? parseDayOfWeek(url.searchParams.get("day")) : null;
  if (url.searchParams.get("day") && !day) return err("day must be 1-7 or a weekday name");
  const events = await rowsForWeeklyEvents(env, org.id, {
    room_id: cleanOptionalText(url.searchParams.get("room_id"), 120),
    day_of_week: day
  });
  return json({ events });
}

function cleanEventBody(body, existing = {}) {
  const name = body.name !== undefined ? cleanText(body.name, 80) : existing.name;
  const day = body.day_of_week !== undefined ? parseDayOfWeek(body.day_of_week) : existing.day_of_week;
  const start = body.start_time_local !== undefined || body.start_time !== undefined
    ? cleanText(body.start_time_local || body.start_time, 5)
    : existing.start_time_local;
  const duration = body.duration_min !== undefined ? Number(body.duration_min) : existing.duration_min;
  const capacity = body.capacity === "" || body.capacity === null ? null
    : body.capacity !== undefined ? Number(body.capacity) : existing.capacity;
  const requireProof = body.require_proof !== undefined ? boolishToInt(body.require_proof) : (existing.require_proof ?? 0);
  const lateGrace = body.late_grace_min !== undefined ? Number(body.late_grace_min) : (existing.late_grace_min ?? 0);
  return {
    id: body.id ? cleanText(body.id, 90) : existing.id,
    room_id: body.room_id === "" ? null : (body.room_id !== undefined ? cleanOptionalText(body.room_id, 120) : (existing.room_id || null)),
    name,
    day_of_week: day,
    start_time_local: start,
    duration_min: duration,
    capacity: Number.isFinite(capacity) ? capacity : null,
    color_hex: body.color_hex !== undefined ? cleanOptionalText(body.color_hex, 16) : (existing.color_hex || null),
    notes: body.notes !== undefined ? cleanOptionalText(body.notes, 2000) : (existing.notes || null),
    require_proof: requireProof ? 1 : 0,
    late_grace_min: Number.isFinite(lateGrace) ? Math.max(0, Math.floor(lateGrace)) : 0
  };
}

function validateEventInput(ev) {
  if (!ev.name) return "name required";
  if (!ev.day_of_week || ev.day_of_week < 1 || ev.day_of_week > 7) return "day_of_week must be 1-7";
  if (!isLocalTime(ev.start_time_local)) return "start_time_local must be HH:MM";
  if (!Number.isFinite(Number(ev.duration_min)) || Number(ev.duration_min) < 1) return "duration_min must be >= 1";
  if (ev.capacity !== null && (!Number.isFinite(Number(ev.capacity)) || Number(ev.capacity) < 0)) return "capacity must be >= 0 or null";
  if (ev.color_hex && !/^#[0-9a-f]{6}$/i.test(ev.color_hex)) return "color_hex must be #RRGGBB";
  return null;
}

async function orgWeeklyEventCreate(request, env) {
  const org = await orgAuth(request, env); if (org.error) return org;
  let body; try { body = await request.json(); } catch { return err("Invalid JSON"); }
  const action = await requireCalendarSignedAction(request, env, org, body);
  if (action.error) return action.error;

  const ev = cleanEventBody(body);
  ev.id = ev.id || newEventId();
  const inputError = validateEventInput(ev);
  if (inputError) return err(inputError);
  const expectedCheck = await ensureExpectedIdsForOrg(env, org.id, body.expected_ids || []);
  if (!expectedCheck.ok) return json({ error: "expected_ids_not_found", missing: expectedCheck.missing }, 400);

  const t = now();
  const statements = [
    env.DB.prepare(
      "INSERT INTO weekly_events (id,org_id,room_id,name,day_of_week,start_time_local,duration_min,capacity,color_hex,notes,require_proof,late_grace_min,created_at,archived_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)"
    ).bind(ev.id, org.id, ev.room_id, ev.name, ev.day_of_week, ev.start_time_local, Math.floor(ev.duration_min), ev.capacity, ev.color_hex, ev.notes, ev.require_proof, ev.late_grace_min, t)
  ];
  for (const expectedId of expectedCheck.ids) {
    statements.push(env.DB.prepare(
      "INSERT OR IGNORE INTO event_expected (event_id,expected_id,added_at,added_by) VALUES (?,?,?,?)"
    ).bind(ev.id, expectedId, t, action.authorized_by_user?.id || action.user?.id || null));
  }
  await env.DB.batch(statements);
  const events = await rowsForWeeklyEvents(env, org.id, {});
  return json({ event_id: ev.id, event: events.find(e => e.id === ev.id) || null }, 201);
}

async function orgWeeklyEventUpdate(request, env, id) {
  const org = await orgAuth(request, env); if (org.error) return org;
  let body; try { body = await request.json(); } catch { return err("Invalid JSON"); }
  const action = await requireCalendarSignedAction(request, env, org, body, p => !p.event_id || String(p.event_id) === String(id));
  if (action.error) return action.error;

  const existing = await env.DB.prepare(
    "SELECT * FROM weekly_events WHERE id=? AND org_id=? AND archived_at IS NULL"
  ).bind(id, org.id).first();
  if (!existing) return err("Weekly event not found", 404);
  const ev = cleanEventBody(body, existing);
  ev.id = id;
  const inputError = validateEventInput(ev);
  if (inputError) return err(inputError);
  const expectedCheck = body.expected_ids !== undefined ? await ensureExpectedIdsForOrg(env, org.id, body.expected_ids) : null;
  if (expectedCheck && !expectedCheck.ok) return json({ error: "expected_ids_not_found", missing: expectedCheck.missing }, 400);

  const statements = [
    env.DB.prepare(
      "UPDATE weekly_events SET room_id=?,name=?,day_of_week=?,start_time_local=?,duration_min=?,capacity=?,color_hex=?,notes=?,require_proof=?,late_grace_min=? WHERE id=? AND org_id=?"
    ).bind(ev.room_id, ev.name, ev.day_of_week, ev.start_time_local, Math.floor(ev.duration_min), ev.capacity, ev.color_hex, ev.notes, ev.require_proof, ev.late_grace_min, id, org.id)
  ];
  if (expectedCheck) {
    const currentRows = await env.DB.prepare("SELECT expected_id FROM event_expected WHERE event_id=?").bind(id).all();
    const current = new Set((currentRows.results || []).map(r => r.expected_id));
    const next = new Set(expectedCheck.ids);
    const t = now();
    for (const expectedId of next) {
      if (!current.has(expectedId)) {
        statements.push(env.DB.prepare(
          "INSERT OR IGNORE INTO event_expected (event_id,expected_id,added_at,added_by) VALUES (?,?,?,?)"
        ).bind(id, expectedId, t, action.authorized_by_user?.id || action.user?.id || null));
      }
    }
    for (const expectedId of current) {
      if (!next.has(expectedId)) {
        statements.push(env.DB.prepare("DELETE FROM event_expected WHERE event_id=? AND expected_id=?").bind(id, expectedId));
      }
    }
  }
  await env.DB.batch(statements);
  const events = await rowsForWeeklyEvents(env, org.id, {});
  return json({ event: events.find(e => e.id === id) || null });
}

async function orgWeeklyEventDelete(request, env, id) {
  const org = await orgAuth(request, env); if (org.error) return org;
  let body = {};
  try { body = await request.json(); } catch {}
  const action = await requireCalendarSignedAction(request, env, org, body, p => !p.event_id || String(p.event_id) === String(id));
  if (action.error) return action.error;
  const t = now();
  const result = await env.DB.prepare(
    "UPDATE weekly_events SET archived_at=COALESCE(archived_at,?) WHERE id=? AND org_id=?"
  ).bind(t, id, org.id).run();
  if (!(result.meta?.changes || 0)) return err("Weekly event not found", 404);
  return json({ deleted: true, archived: true, id, archived_at: t });
}

async function orgWeeklyEventsExportCsv(request, env) {
  const org = await orgAuth(request, env); if (org.error) return org;
  const staff = await requireCalendarStaff(request, env, org);
  if (staff.error) return staff.error;

  const expectedRows = await env.DB.prepare(
    "SELECT id,display_name FROM org_expected WHERE org_id=? AND archived_at IS NULL"
  ).bind(org.id).all();
  const expectedNames = new Map((expectedRows.results || []).map(r => [r.id, r.display_name]));
  const roomRows = await env.DB.prepare(
    "SELECT id,label FROM rooms WHERE org_id=? AND archived_at IS NULL"
  ).bind(org.id).all();
  const roomNames = new Map((roomRows.results || []).map(r => [r.id, r.label]));
  const events = await rowsForWeeklyEvents(env, org.id, {});
  const header = ["event_name","room","day_of_week","start_time","duration_min","capacity","expected_names","require_proof","late_grace_min"];
  const lines = [header.join(",")];
  for (const ev of events) {
    lines.push([
      ev.name,
      ev.room_id ? (roomNames.get(ev.room_id) || ev.room_id) : "",
      ev.day_of_week,
      ev.start_time_local,
      ev.duration_min,
      ev.capacity ?? "",
      (ev.expected_ids || []).map(id => expectedNames.get(id)).filter(Boolean).join("; "),
      ev.require_proof ? "1" : "0",
      ev.late_grace_min || 0
    ].map(csvEscape).join(","));
  }
  const date = new Date().toISOString().slice(0, 10);
  return new Response(lines.join("\r\n") + "\r\n", {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="week-export-${date}.csv"`
    }
  });
}

async function orgWeeklyEventsImportCsv(request, env) {
  const org = await orgAuth(request, env); if (org.error) return org;
  let form;
  try { form = await request.formData(); } catch { return err("multipart file required"); }
  const bodyForAction = {};
  const signedRaw = form.get("signed_action");
  if (signedRaw) {
    try { bodyForAction.signed_action = typeof signedRaw === "string" ? JSON.parse(signedRaw) : JSON.parse(await signedRaw.text()); }
    catch { return err("signed_action must be JSON"); }
  }
  const action = await requireCalendarSignedAction(request, env, org, bodyForAction);
  if (action.error) return action.error;

  const file = form.get("file");
  if (!file || typeof file.text !== "function") return err("file field required");
  const csvText = await file.text();
  const parsed = parseCsv(csvText);
  if (parsed.length < 2) return err("CSV must include a header row and at least one event row");
  const header = csvHeaderMap(parsed[0]);
  const roomHeaders = ["room","studio","hall","theatre","classroom","pitch","court","treatment_room"];
  const roomHeader = roomHeaders.find(h => header[h] !== undefined);
  const required = ["event_name","day_of_week","start_time","duration_min"];
  for (const key of required) if (header[key] === undefined) return err(`${key} required`);
  if (!roomHeader) return err("room/studio/hall/theatre/classroom/pitch/court/treatment_room column required");

  const roomRows = await env.DB.prepare("SELECT id,label FROM rooms WHERE org_id=? AND archived_at IS NULL").bind(org.id).all();
  const roomsByLabel = new Map((roomRows.results || []).map(r => [String(r.label || "").trim().toLowerCase(), r.id]));
  const expectedRows = await env.DB.prepare("SELECT id,display_name FROM org_expected WHERE org_id=? AND archived_at IS NULL").bind(org.id).all();
  const expectedByName = new Map((expectedRows.results || []).map(r => [String(r.display_name || "").trim().toLowerCase(), r.id]));

  const reportRows = [];
  const statements = [];
  const replace = new URL(request.url).searchParams.get("replace") === "1";
  const t = now();
  let eventsCreated = 0;
  let eventsReplaced = 0;
  let expectedCreated = 0;
  if (replace) {
    const existing = await env.DB.prepare("SELECT COUNT(*) AS count FROM weekly_events WHERE org_id=? AND archived_at IS NULL").bind(org.id).first();
    eventsReplaced = Number(existing?.count || 0);
    statements.push(env.DB.prepare("UPDATE weekly_events SET archived_at=COALESCE(archived_at,?) WHERE org_id=? AND archived_at IS NULL").bind(t, org.id));
  }

  for (let ix = 1; ix < parsed.length; ix++) {
    const row = parsed[ix];
    const rowNo = ix + 1;
    const name = cleanText(csvCell(row, header, "event_name"), 80);
    const day = parseDayOfWeek(csvCell(row, header, "day_of_week"));
    const start = cleanText(csvCell(row, header, "start_time"), 5);
    const duration = Number(csvCell(row, header, "duration_min"));
    if (!name) { reportRows.push({ row: rowNo, status: "error", error: "event_name required" }); continue; }
    if (!day) { reportRows.push({ row: rowNo, status: "error", error: "day_of_week required" }); continue; }
    if (!isLocalTime(start)) { reportRows.push({ row: rowNo, status: "error", error: "start_time must be HH:MM" }); continue; }
    if (!Number.isFinite(duration) || duration < 1) { reportRows.push({ row: rowNo, status: "error", error: "duration_min must be >= 1" }); continue; }

    const roomLabel = csvCell(row, header, roomHeader);
    const roomId = roomLabel ? (roomsByLabel.get(roomLabel.toLowerCase()) || null) : null;
    const capacityRaw = csvCell(row, header, "capacity");
    const capacity = capacityRaw === "" ? null : Number(capacityRaw);
    const eventId = newEventId();
    statements.push(env.DB.prepare(
      "INSERT INTO weekly_events (id,org_id,room_id,name,day_of_week,start_time_local,duration_min,capacity,color_hex,notes,require_proof,late_grace_min,created_at,archived_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)"
    ).bind(eventId, org.id, roomId, name, day, start, Math.floor(duration), Number.isFinite(capacity) ? capacity : null, null, null, boolishToInt(csvCell(row, header, "require_proof")), Math.max(0, Number(csvCell(row, header, "late_grace_min")) || 0), t));

    const names = csvCell(row, header, "expected_names").split(";").map(n => cleanText(n, 80)).filter(Boolean);
    for (const displayName of names) {
      const key = displayName.toLowerCase();
      let expectedId = expectedByName.get(key);
      if (!expectedId) {
        expectedId = newExpectedId(displayName);
        expectedByName.set(key, expectedId);
        expectedCreated++;
        statements.push(env.DB.prepare(
          "INSERT INTO org_expected (id,org_id,display_name,initials,role_key,created_at,archived_at) VALUES (?,?,?,?,?,?,NULL)"
        ).bind(expectedId, org.id, displayName, initialsForName(displayName), "attendee", t));
      }
      statements.push(env.DB.prepare(
        "INSERT OR IGNORE INTO event_expected (event_id,expected_id,added_at,added_by) VALUES (?,?,?,?)"
      ).bind(eventId, expectedId, t, action.authorized_by_user?.id || action.user?.id || null));
    }
    eventsCreated++;
    reportRows.push({ row: rowNo, status: "ok", event_id: eventId });
  }

  if (statements.length) await env.DB.batch(statements);
  return json({
    batch_id: "imp_" + randomToken().slice(0, 18),
    events_created: eventsCreated,
    events_replaced: eventsReplaced,
    org_expected_created: expectedCreated,
    rows: reportRows
  });
}

function validDevicePubJwk(pubJwk) {
  return !!pubJwk
    && pubJwk.kty === "EC"
    && pubJwk.crv === "P-256"
    && typeof pubJwk.x === "string"
    && typeof pubJwk.y === "string";
}

function normaliseDevicePubJwk(pubJwk) {
  if (!pubJwk || typeof pubJwk.x !== "string" || typeof pubJwk.y !== "string") return null;
  const kty = pubJwk.kty || "EC";
  const crv = pubJwk.crv || "P-256";
  if (kty !== "EC" || crv !== "P-256") return null;
  return { ...pubJwk, kty, crv };
}

function doorRolePermitted(actorRole, targetRole) {
  const actor = expectedMemberRole(actorRole);
  const target = expectedMemberRole(targetRole);
  if (actor === "developer") return true;
  if (target === "developer") return false;
  return expectedRoleRank(actor) >= expectedRoleRank(target);
}

async function expectedBoundToDevice(env, orgCode, deviceFp) {
  const direct = await env.DB.prepare(
    "SELECT id FROM org_expected WHERE org_id=? AND device_pub_fp=? AND archived_at IS NULL LIMIT 1"
  ).bind(orgCode, deviceFp).first();
  if (direct) return direct.id;
  if (await tableExists(env, "rebind_history")) {
    const historical = await env.DB.prepare(
      "SELECT expected_id AS id FROM rebind_history WHERE org_code=? AND new_device_fp=? ORDER BY created_at DESC, id DESC LIMIT 1"
    ).bind(orgCode, deviceFp).first();
    if (historical) return historical.id;
  }
  return null;
}

async function bindAdditionalExpectedKey(request, env, id) {
  const org = await orgAuth(request, env); if (org.error) return org;
  let body; try { body = await request.json(); } catch { return err("Invalid JSON"); }

  // v5.10.0 Phase 0 — per-action WebAuthn replaces requireFreshStaffProof
  // for the doorman bind endpoints. Every bind is now a non-repudiable
  // signed envelope tied to the specific action by type discriminator
  // (irlid_bind_v5) and target expected_id. No more "is this session
  // fresh enough" gate; the signature itself IS the freshness proof.
  // v5.10.1 Path B passes request as authority context only; body remains
  // pre-parsed so the Worker stream is not consumed twice.
  const action = await requireSignedAction(body, env, {
    expectedType: "irlid_bind_v5",
    orgId: org.id,
    minRole: "staff",
    payloadSchema: (p) => String(p.expected_id) === String(id)
      && typeof p.new_device_key_fp === "string" && p.new_device_key_fp.length >= 8,
    request
  });
  if (action.error) return action.error;

  const pubJwk = normaliseDevicePubJwk(body.pub_jwk || body.pub || body.device_pub_jwk);
  if (!validDevicePubJwk(pubJwk)) return err("pub_jwk must be a P-256 public JWK");
  const computedFp = await deviceKeyFp(pubJwk);
  const pubFp = String(body.pub_fp || body.device_pub_fp || action.payload.new_device_key_fp || computedFp || "").trim();
  if (!pubFp) return err("pub_fp required");
  if (pubFp !== computedFp) return err("pub_fp does not match pub_jwk", 422);
  // Cross-check: the device fp in the signed payload must match what's
  // being bound. Otherwise an attacker could sign an envelope claiming
  // to bind device A and submit a body for device B.
  if (action.payload.new_device_key_fp !== pubFp) {
    return json({ error: "signed_fp_mismatch" }, 400);
  }

  const expected = await expectedRowWithKeys(env, org.id, id);
  if (!expected) return err("Expected attendee not found", 404);
  if ((expected.device_key_fps || []).includes(pubFp)) {
    return json({ ok: true, already_bound: true, expected });
  }
  const boundExpectedId = await expectedBoundToDevice(env, org.id, pubFp);
  if (boundExpectedId && String(boundExpectedId) !== String(id)) {
    return json({ error: "device_key_already_bound", expected_id: boundExpectedId }, 409);
  }

  const t = now();
  if (!expected.device_pub_fp) {
    await env.DB.prepare(
      "UPDATE org_expected SET device_pub_fp=? WHERE id=? AND org_id=?"
    ).bind(pubFp, id, org.id).run();
  } else {
    await env.DB.prepare(
      "INSERT INTO rebind_history (org_code,expected_id,old_device_fp,new_device_fp,admin_signature,reason,created_at) VALUES (?,?,?,?,?,?,?)"
    ).bind(
      org.id,
      id,
      expected.device_pub_fp,
      pubFp,
      `bind-additional:${org.id}:${t}:actor:${action.actor_pub_fp}:authorized_by:${action.authorized_by_user?.id || ""}`,
      "doorman_choose_from_list",
      t
    ).run();
    await env.DB.prepare(
      "UPDATE org_expected SET device_pub_fp=COALESCE(device_pub_fp,?) WHERE id=? AND org_id=?"
    ).bind(pubFp, id, org.id).run();
  }

  return json({ ok: true, expected: await expectedRowWithKeys(env, org.id, id) });
}

async function orgExpectedCreateAndBind(request, env) {
  const org = await orgAuth(request, env); if (org.error) return org;

  let body; try { body = await request.json(); } catch { return err("Invalid JSON"); }
  const firstName = (body.first_name || "").trim();
  const surname = (body.surname || "").trim();
  const prototypeRole = attendeeOnlyExpectedRole(body, "orgExpectedCreateAndBind");
  const pubJwk = normaliseDevicePubJwk(body.device_pub_jwk || body.pub_jwk || body.pub);
  const suppliedFp = String(body.device_pub_fp || body.pub_fp || "").trim();
  if (!firstName || !surname) return err("first_name and surname required");
  if (!validDevicePubJwk(pubJwk)) return err("device_pub_jwk must be a P-256 public JWK");
  const computedFp = await deviceKeyFp(pubJwk);
  if (suppliedFp && suppliedFp !== computedFp) return err("device_pub_fp does not match device_pub_jwk", 422);
  const deviceFp = suppliedFp || computedFp;

  // v5.10.0 Phase 0 — per-action WebAuthn replaces requireFreshStaffProof.
  // The signed envelope encodes the specific attendee being created and the
  // device fp being bound; cross-action replay is structurally impossible.
  // v5.10.1 Path B passes request as authority context only; body remains
  // pre-parsed so the Worker stream is not consumed twice.
  const action = await requireSignedAction(body, env, {
    expectedType: "irlid_create_bind_v5",
    orgId: org.id,
    minRole: "staff",
    payloadSchema: (p) => p.first_name === firstName
      && p.surname === surname
      && attendeeOnlyExpectedRole(p, "orgExpectedCreateAndBind.signedAction") === prototypeRole
      && p.new_device_key_fp === deviceFp,
    request
  });
  if (action.error) return action.error;

  // Door role permission gate — actor signing the envelope must have a
  // role permitted to admit the prototypeRole at the door.
  if (!doorRolePermitted(action.role, prototypeRole)) {
    return json({ error: "role_not_permitted_at_door" }, 403);
  }
  const boundExpectedId = await expectedBoundToDevice(env, org.id, deviceFp);
  if (boundExpectedId) return json({ error: "device_key_already_bound", expected_id: boundExpectedId }, 409);
  const displayName = cleanText(`${firstName} ${surname}`.trim(), 80);
  const existing = await env.DB.prepare(
    "SELECT id FROM org_expected WHERE org_id=? AND archived_at IS NULL AND LOWER(display_name)=LOWER(?) LIMIT 1"
  ).bind(org.id, displayName).first();
  if (existing) return json({ error: "duplicate", existing_id: existing.id }, 409);

  const t = now();
  const expectedId = newExpectedId(displayName);
  const expected = await env.DB.prepare(
    `INSERT INTO org_expected (id,org_id,display_name,initials,role_key,device_pub_fp,created_at,archived_at) VALUES (?,?,?,?,?,?,?,NULL) RETURNING ${EXPECTED_SELECT}`
  ).bind(expectedId, org.id, displayName, initialsForName(displayName), prototypeRole, deviceFp, t).first();
  expected.device_key_fps = [deviceFp];

  return json({ ok: true, expected });
}

async function orgExpectedDelete(request, env, id) {
  const org = await orgAuth(request, env); if (org.error) return org;
  let body = {};
  try { body = await request.json(); } catch {}
  const action = await requireCalendarSignedAction(request, env, org, body, p => !p.expected_id || String(p.expected_id) === String(id));
  if (action.error) return action.error;
  const t = now();
  const result = await env.DB.prepare(
    "UPDATE org_expected SET archived_at=COALESCE(archived_at,?) WHERE id=? AND org_id=?"
  ).bind(t, id, org.id).run();
  const deleted = (result.meta?.changes || 0) > 0;
  if (!deleted) return err("Expected attendee not found", 404);
  return json({ deleted: true, archived: true, id, archived_at: t });
}

// v5.7.0g — Cascading delete for an attendee record. Removes the
// org_checkins history rows, rebind_history, attendee_conflicts, AND the
// org_expected row itself. Use this when the attendee has moved past the
// "expected" state (e.g. checked in/out, conflict, invalid) and the
// regular orgExpectedDelete is no longer reachable from the UI.
//
// Refuses to delete a row with an active (un-checked-out) checkin —
// staff must check the attendee out cleanly first. This guard exists so
// the audit trail of live attendees can't be silently hand-wiped; if
// ever needed, lead_admin+ can pass ?force=true to override (audit ts
// of the delete preserved via the row's natural absence after cascade).
async function orgExpectedDeleteFull(request, env, id) {
  const org = await orgAuth(request, env); if (org.error) return org;

  // Confirm the row exists for this org before any cascade work.
  const expected = await env.DB.prepare(
    "SELECT id FROM org_expected WHERE id=? AND org_id=?"
  ).bind(id, org.id).first();
  if (!expected) return err("Expected attendee not found", 404);

  // Check for an active (un-checked-out) checkin tied to this expected_id.
  // Skip the guard if the caller explicitly opts in via ?force=true.
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";
  if (!force) {
    const liveCheckin = await env.DB.prepare(
      "SELECT id FROM org_checkins WHERE org_id=? AND expected_id=? AND checkout_at IS NULL LIMIT 1"
    ).bind(org.id, id).first();
    if (liveCheckin) {
      return err("Attendee has an active check-in. Check them out first, or pass force=true to delete anyway.", 409);
    }
  }

  // Cascade: checkins → rebind_history → attendee_conflicts → expected row.
  // Each step is independent; partial failure leaves the database in a
  // legible state (older rows persist, the org_expected row goes last so
  // the cascade is idempotent on retry).
  // v6.4.4b — org_receipts.checkin_id has an FK to org_checkins(id) (v6.0
  // receipt bridge). The org's copies of this person's receipts must go
  // BEFORE their check-ins or the cascade aborts with
  // SQLITE_CONSTRAINT_FOREIGNKEY (Captain hit this deleting Becky's record,
  // 11 Jun). Delete-record is the explicit erasure path: the attendee's own
  // downloaded receipts remain theirs and still verify — only the org's
  // stored copies are erased, consistent with the cascade's intent.
  if (await tableExists(env, "org_receipts")) {
    await env.DB.prepare(
      "DELETE FROM org_receipts WHERE org_id=? AND checkin_id IN (SELECT id FROM org_checkins WHERE org_id=? AND expected_id=?)"
    ).bind(org.id, org.id, id).run();
  }
  const checkinsResult = await env.DB.prepare(
    "DELETE FROM org_checkins WHERE org_id=? AND expected_id=?"
  ).bind(org.id, id).run();
  // v6.4.4b — also clear per-event Expected list rows (no FK, but orphans
  // would linger in every event roster this person was added to).
  if (await tableExists(env, "event_expected")) {
    await env.DB.prepare(
      "DELETE FROM event_expected WHERE expected_id=?"
    ).bind(id).run();
  }
  await env.DB.prepare(
    "DELETE FROM rebind_history WHERE org_code=? AND expected_id=?"
  ).bind(org.id, id).run();
  await env.DB.prepare(
    "DELETE FROM attendee_conflicts WHERE org_code=? AND expected_id=?"
  ).bind(org.id, id).run();
  const expectedResult = await env.DB.prepare(
    "DELETE FROM org_expected WHERE id=? AND org_id=?"
  ).bind(id, org.id).run();

  return json({
    deleted: true,
    id,
    cascade: {
      checkins: checkinsResult.meta?.changes || 0,
      expected: expectedResult.meta?.changes || 0
    }
  });
}

async function orgExpectedUpdate(request, env, id) {
  const org = await orgAuth(request, env); if (org.error) return org;
  let body; try { body = await request.json(); } catch { return err("Invalid JSON"); }
  const action = await requireCalendarSignedAction(request, env, org, body, p => !p.expected_id || String(p.expected_id) === String(id));
  if (action.error) return action.error;
  const existingRow = await env.DB.prepare(
    `SELECT ${EXPECTED_SELECT} FROM org_expected WHERE id=? AND org_id=? AND archived_at IS NULL`
  ).bind(id, org.id).first();
  if (!existingRow) return err("Expected attendee not found", 404);

  const displayNameProvided = body.display_name !== undefined || body.first_name !== undefined || body.surname !== undefined;
  const displayName = displayNameProvided
    ? cleanText(body.display_name || [body.first_name, body.surname].filter(Boolean).join(" "), 80)
    : existingRow.display_name;
  if (!displayName) return err("display_name required");

  const roleProvided = body.role_key !== undefined || body.prototype_role !== undefined || body.role !== undefined;
  const roleKey = roleProvided ? cleanRoleKey(body.role_key || body.prototype_role || body.role) : existingRow.role_key;
  if (roleProvided && !isExpectedRoleAllowedFromDashboard(roleKey)) {
    return err("developer role cannot be granted from the dashboard - bootstrap or invite token only", 403);
  }
  const existing = await env.DB.prepare(
    "SELECT id FROM org_expected WHERE org_id=? AND id<>? AND archived_at IS NULL AND LOWER(display_name)=LOWER(?) LIMIT 1"
  ).bind(org.id, id, displayName).first();
  if (existing) return json({ error: "duplicate", existing_id: existing.id }, 409);
  const row = await env.DB.prepare(
    `UPDATE org_expected SET display_name=?, initials=?, role_key=?, device_pub_fp=?, email_hint=?, phone_hint=?, notes=? ` +
    `WHERE id=? AND org_id=? RETURNING ${EXPECTED_SELECT}`
  ).bind(
    displayName,
    body.initials !== undefined ? cleanOptionalText(body.initials, 16) : existingRow.initials,
    roleKey,
    body.device_pub_fp !== undefined ? cleanOptionalText(body.device_pub_fp, 128) : existingRow.device_pub_fp,
    body.email_hint !== undefined ? cleanOptionalText(body.email_hint, 160) : existingRow.email_hint,
    body.phone_hint !== undefined ? cleanOptionalText(body.phone_hint, 80) : existingRow.phone_hint,
    body.notes !== undefined ? cleanOptionalText(body.notes, 1000) : existingRow.notes,
    id,
    org.id
  ).first();
  if (!row) return err("Expected attendee not found", 404);
  return json({ expected: row });
}

async function orgExpectedRebind(request, env, id) {
  const org = await orgAuth(request, env); if (org.error) return org;
  let body; try { body = await request.json(); } catch { return err("Invalid JSON"); }
  const newDeviceFp = (body.new_device_fp || "").trim();
  const reason = body.reason ? String(body.reason).trim() : null;
  if (!newDeviceFp) return err("new_device_fp required");

  const expected = await env.DB.prepare(
    "SELECT id,device_pub_fp FROM org_expected WHERE id=? AND org_id=?"
  ).bind(id, org.id).first();
  if (!expected) return err("Expected attendee not found", 404);

  const t = now();
  const date = new Date(t * 1000);
  const monthStart = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1000);
  const nextMonthStart = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / 1000);
  const countRow = await env.DB.prepare(
    "SELECT COUNT(*) AS cnt FROM rebind_history WHERE org_code=? AND expected_id=? AND created_at>=? AND created_at<?"
  ).bind(org.id, id, monthStart, nextMonthStart).first();
  if ((countRow?.cnt || 0) >= 2) {
    return json({ error: "rebind_limit_exceeded", retry_after: nextMonthStart }, 429);
  }

  const rebind = await env.DB.prepare(
    "INSERT INTO rebind_history (org_code,expected_id,old_device_fp,new_device_fp,admin_signature,reason,created_at) VALUES (?,?,?,?,?,?,?) RETURNING id"
  ).bind(org.id, id, expected.device_pub_fp || null, newDeviceFp, `${org.id}:${t}`, reason || null, t).first();

  await env.DB.prepare(
    "UPDATE org_expected SET device_pub_fp=? WHERE id=? AND org_id=?"
  ).bind(newDeviceFp, id, org.id).run();

  return json({ ok: true, rebind_id: rebind?.id || null });
}

async function orgExpectedClaim(request, env, id) {
  // v6.4.4a — QR diet follow-up: self-claim is the attendee surface behind the
  // "I'm not on the list" picker; slim QRs present the slug, not the api_key.
  // Claim stays possible (any api_key holder could already do this via the old
  // fat QR), gated on allowSelfSelection for slug-tier callers, and the row in
  // the response is redacted for them — hint columns stay staff-tier only.
  const org = await orgFromRequest(request, env);
  if (!org) return authErr("Invalid org key or slug", 401);
  const isServiceTier = requestHasOrgServiceAccount(request, org);
  if (!isServiceTier) {
    let settings = {};
    try { settings = JSON.parse(org.settings_json || "{}") || {}; } catch { settings = {}; }
    if (settings.allowSelfSelection === false) return authErr("self_selection_disabled", 403);
  }
  const shapeRow = (row) => (isServiceTier || !row) ? row : ({
    id: row.id,
    display_name: row.display_name,
    initials: row.initials,
    role_key: row.role_key,
    device_key_fp: !!row.device_pub_fp
  });
  let body; try { body = await request.json(); } catch { return err("Invalid JSON"); }
  const devicePubFp = (body.device_pub_fp || "").trim();
  if (!devicePubFp) return err("device_pub_fp required");

  const expected = await env.DB.prepare(
    `SELECT ${EXPECTED_SELECT} FROM org_expected WHERE id=? AND org_id=?`
  ).bind(id, org.id).first();
  if (!expected) return err("Expected attendee not found", 404);

  if (expected.device_pub_fp && expected.device_pub_fp !== devicePubFp) {
    return json({ error: "already_claimed", existing_fp_short: expected.device_pub_fp.slice(0, 8) }, 409);
  }

  if (expected.device_pub_fp === devicePubFp) {
    return json({ ok: true, expected: shapeRow(expected) });
  }

  const row = await env.DB.prepare(
    `UPDATE org_expected SET device_pub_fp=? WHERE id=? AND org_id=? RETURNING ${EXPECTED_SELECT}`
  ).bind(devicePubFp, id, org.id).first();
  return json({ ok: true, expected: shapeRow(row) });
}

async function orgResolveConflict(request, env, id) {
  const org = await orgAuth(request, env); if (org.error) return org;
  let body; try { body = await request.json(); } catch { return err("Invalid JSON"); }
  const resolution = body.resolution;
  if (!["confirmed_new_device", "rejected"].includes(resolution)) return err("resolution must be confirmed_new_device or rejected");
  const conflict = await env.DB.prepare(
    "SELECT * FROM attendee_conflicts WHERE id=? AND org_code=? AND resolution IS NULL"
  ).bind(id, org.id).first();
  if (!conflict) return err("Conflict not found", 404);
  const t = now();
  if (resolution === "confirmed_new_device") {
    await env.DB.batch([
      env.DB.prepare("UPDATE org_expected SET device_pub_fp=? WHERE id=? AND org_id=?")
        .bind(conflict.claiming_device_fp, conflict.expected_id, org.id),
      env.DB.prepare("UPDATE org_checkins SET status='checked_in' WHERE id=? AND org_id=?")
        .bind(conflict.checkin_id, org.id),
      env.DB.prepare("UPDATE attendee_conflicts SET resolution=?, resolved_at=? WHERE id=? AND org_code=?")
        .bind(resolution, t, id, org.id)
    ]);
  } else {
    await env.DB.batch([
      env.DB.prepare("UPDATE org_checkins SET status='invalid', checkout_at=COALESCE(checkout_at,?), duration_s=COALESCE(duration_s,0) WHERE id=? AND org_id=?")
        .bind(t, conflict.checkin_id, org.id),
      env.DB.prepare("UPDATE attendee_conflicts SET resolution=?, resolved_at=? WHERE id=? AND org_code=?")
        .bind(resolution, t, id, org.id)
    ]);
  }
  return json({ ok: true, conflict_id: id, resolution });
}

async function orgAuth(request, env) {
  const token = bearerTokenFromRequest(request);
  const key = request.headers.get("X-Org-Key") || new URL(request.url).searchParams.get("key") || (token.startsWith("org_") ? token : "");
  if (!key) return authErr("X-Org-Key header required", 401);
  const org = await env.DB.prepare("SELECT * FROM organisations WHERE api_key=?").bind(key).first();
  if (!org) return authErr("Invalid API key", 401);
  return org;
}

// =====================
//  ROUTER
// =====================

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return addCors(new Response(null, { status: 204 }), env, request);

    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    let response;
    try {
      if (path === "/" || path === "/health") response = json({ status: "ok", service: "irlid-api", version: 7 });

      else if (method === "POST" && path === "/auth/register")       response = await register(request, env);
      else if (method === "POST" && path === "/auth/login")          response = await login(request, env);
      else if (method === "POST" && path === "/auth/logout")         response = await logout(request, env);
      else if (method === "GET"  && path === "/auth/me")              response = await me(request, env);
      else if (method === "POST" && path === "/auth/profile")        response = await updateProfile(request, env);
      else if (method === "POST" && path === "/auth/google")         response = await googleAuth(request, env);

      else if (method === "POST" && path === "/auth/link/create")    response = await linkCreate(request, env);
      else if (method === "POST" && path === "/auth/link/claim")     response = await linkClaim(request, env);

      else if (method === "POST" && path === "/auth/device/rename")  response = await renameDevice(request, env);
      else if (method === "POST" && path === "/auth/device/revoke")  response = await revokeDevice(request, env);

      else if (method === "POST" && path === "/receipts")            response = await uploadReceipt(request, env);
      else if (method === "GET"  && path === "/receipts")             response = await listReceipts(request, env);
      else if (method === "POST" && path === "/verify")              response = await verify(request, env);
      else if (method === "GET"  && path === "/util/image-proxy")     response = await utilImageProxy(request, env);

      // Org Portal — Identity-Bound Sessions (PROTOCOL.md §14, Batch A)
      else if (method === "POST" && path === "/org/login/init")      response = await orgLoginInit(request, env);
      else if (method === "GET"  && path === "/org/login/poll")      response = await orgLoginPoll(request, env);
      else if (method === "POST" && path === "/org/login/claim")     response = await orgLoginClaim(request, env);
      else if (method === "POST" && path === "/org/action/init")     response = await orgActionInit(request, env);
      else if (method === "GET"  && path === "/org/action/poll")     response = await orgActionPoll(request, env);
      else if (method === "GET"  && /^\/org\/action\/poll\/[^/]+$/.test(path)) {
        response = await orgActionPoll(request, env, decodeURIComponent(path.match(/^\/org\/action\/poll\/([^/]+)$/)[1]));
      }
      else if (method === "POST" && path === "/org/action/claim")    response = await orgActionClaim(request, env);
      // v5.9.14 — staff-invite QR endpoints (Brief A).
      else if (method === "POST" && path === "/org/invites/create")  response = await orgInviteCreate(request, env);
      else if (method === "GET"  && path === "/org/invites/pending") response = await orgPendingInvites(request, env);
      else if (method === "POST" && path === "/org/invites/redeem")  response = await orgInviteRedeem(request, env);
      else if (method === "POST" && path === "/org/invites/revoke")  response = await orgInviteRevoke(request, env);
      else if (method === "POST" && /^\/org\/invites\/[^/]+\/revoke$/.test(path)) {
        response = await orgInviteRevoke(request, env, decodeURIComponent(path.match(/^\/org\/invites\/([^/]+)\/revoke$/)[1]));
      }
      else if (method === "POST" && path === "/org/invite/accept-on-this-device") response = await orgInviteAcceptOnThisDevice(request, env);
      // v6.4.10 (PR-4 QR diet) — slim invite QR resolves nonce → stored envelope.
      else if (method === "GET" && /^\/org\/invites\/[^/]+\/envelope$/.test(path)) {
        response = await orgInviteEnvelope(request, env, decodeURIComponent(path.match(/^\/org\/invites\/([^/]+)\/envelope$/)[1]));
      }
      else if (method === "POST" && path === "/org/lead-admin/appoint") response = await orgLeadAdminAppoint(request, env);
      else if (method === "GET"  && path === "/org/public-meta")     response = await orgPublicMeta(request, env);
      // User-level endpoints (PROTOCOL.md §14, Batch C) — Bearer session token auth.
      else if (method === "GET"  && path === "/user/orgs")           response = await userListOrgs(request, env);
      else if (method === "POST" && path === "/user/create-org")     response = await userCreateOrg(request, env);
      else if (method === "POST" && path === "/user/sign-out-all-devices") response = await userSignOutAllDevices(request, env);
      else if (method === "POST" && /^\/user\/orgs\/[^/]+\/scrape-theme$/.test(path)) {
        const mScrapeTheme = path.match(/^\/user\/orgs\/([^/]+)\/scrape-theme$/);
        response = await userScrapeTheme(request, env, decodeURIComponent(mScrapeTheme[1]));
      }

      // Org Portal
      else if (method === "POST" && path === "/org/register")        response = await orgRegister(request, env);
      else if (method === "GET"  && path === "/org/settings")        response = await orgGetSettings(request, env);
      else if (method === "POST" && path === "/org/settings")        response = await orgUpdateSettings(request, env);
      else if (method === "GET"  && path === "/org/qr")              response = await orgGetQR(request, env);
      else if (method === "GET"  && path === "/org/recognize")       response = await orgRecognize(request, env);
      else if (method === "GET"  && path === "/org/active-checkin")  response = await orgActiveCheckin(request, env);
      else if (method === "GET"  && path === "/org/current-event")   response = await orgCurrentEvent(request, env);
      else if (method === "POST" && path === "/org/staff/auth")      response = await orgStaffAuth(request, env);
      else if (method === "GET"  && path === "/org/members")         response = await orgMembersList(request, env);
      else if (method === "POST" && path === "/org/checkin")         response = await orgCheckin(request, env);
      else if (method === "POST" && path === "/org/checkout")        response = await orgCheckout(request, env);
      else if (method === "POST" && path === "/org/checkout-token")  response = await orgCreateCheckoutToken(request, env);
      else if (method === "GET"  && path === "/org/attendance")      response = await orgAttendance(request, env);
      else if (method === "POST" && path === "/org/debug/clear-attendance") response = await orgDebugClearAttendance(request, env);
      else if (method === "GET"  && path === "/org/rooms")           response = await orgRoomsList(request, env);
      else if (method === "GET"  && path === "/org/expected")        response = await orgExpectedList(request, env);
      else if (method === "POST" && path === "/org/expected")        response = await orgExpectedCreate(request, env);
      else if (method === "POST" && path === "/org/expected/create-and-bind") response = await orgExpectedCreateAndBind(request, env);
      else if (method === "GET"  && path === "/org/weekly-events")   response = await orgWeeklyEventsList(request, env);
      else if (method === "POST" && path === "/org/weekly-events")   response = await orgWeeklyEventCreate(request, env);
      else if (method === "GET"  && path === "/org/weekly-events/export-csv") response = await orgWeeklyEventsExportCsv(request, env);
      else if (method === "POST" && path === "/org/weekly-events/import-csv") response = await orgWeeklyEventsImportCsv(request, env);

      else {
        const mExpected = path.match(/^\/org\/expected\/([^/]+)$/);
        const mExpectedFull = path.match(/^\/org\/expected\/([^/]+)\/full$/);
        const mExpectedRebind = path.match(/^\/org\/expected\/([^/]+)\/rebind$/);
        const mExpectedBindAdditional = path.match(/^\/org\/expected\/([^/]+)\/bind-additional-key$/);
        const mExpectedClaim = path.match(/^\/org\/expected\/([^/]+)\/claim$/);
        const mExpectedLookupByFp = path.match(/^\/org\/expected\/lookup-by-fp\/([^/]+)$/);
        const mWeeklyEvent = path.match(/^\/org\/weekly-events\/([^/]+)$/);
        const mConflict = path.match(/^\/org\/conflicts\/(\d+)\/resolve$/);
        const mCheckoutToken = path.match(/^\/org\/checkout-token\/([^/]+)$/);
        const mOrgMember = path.match(/^\/org\/members\/([^/]+)$/);
        const mOrgReceipt = path.match(/^\/org\/receipt\/([^/]+)$/);
        const mOrgPublicInfo = path.match(/^\/org\/public-info\/([^/]+)$/);
        const mOrgEntryInfo = path.match(/^\/org\/entry-info\/([^/]+)$/);
        if (method === "DELETE" && mExpected) response = await orgExpectedDelete(request, env, decodeURIComponent(mExpected[1]));
        else if (method === "DELETE" && mExpectedFull) response = await orgExpectedDeleteFull(request, env, decodeURIComponent(mExpectedFull[1]));
        else if (method === "PATCH" && mExpected) response = await orgExpectedUpdate(request, env, decodeURIComponent(mExpected[1]));
        else if (method === "POST" && mExpectedRebind) response = await orgExpectedRebind(request, env, decodeURIComponent(mExpectedRebind[1]));
        else if (method === "POST" && mExpectedBindAdditional) response = await bindAdditionalExpectedKey(request, env, decodeURIComponent(mExpectedBindAdditional[1]));
        else if (method === "POST" && mExpectedClaim) response = await orgExpectedClaim(request, env, decodeURIComponent(mExpectedClaim[1]));
        else if (method === "GET" && mExpectedLookupByFp) response = await orgExpectedLookupByFp(request, env, decodeURIComponent(mExpectedLookupByFp[1]));
        else if (method === "PATCH" && mWeeklyEvent) response = await orgWeeklyEventUpdate(request, env, decodeURIComponent(mWeeklyEvent[1]));
        else if (method === "DELETE" && mWeeklyEvent) response = await orgWeeklyEventDelete(request, env, decodeURIComponent(mWeeklyEvent[1]));
        else if (method === "POST" && mConflict) response = await orgResolveConflict(request, env, Number(mConflict[1]));
        else if (method === "GET" && mCheckoutToken) response = await orgResolveCheckoutToken(request, env, decodeURIComponent(mCheckoutToken[1]));
        else if (method === "DELETE" && mOrgMember) response = await orgMemberRemove(request, env, decodeURIComponent(mOrgMember[1]));
        else if (method === "GET" && mOrgReceipt) response = await orgReceiptGet(request, env, decodeURIComponent(mOrgReceipt[1]));
        else if (method === "GET" && mOrgPublicInfo) response = await orgPublicInfo(request, env, decodeURIComponent(mOrgPublicInfo[1]));
        else if (method === "GET" && mOrgEntryInfo) response = await orgEntryInfo(request, env, decodeURIComponent(mOrgEntryInfo[1]));
        else {
          const m = path.match(/^\/receipts\/([A-Za-z0-9\-_]+)$/);
          if (method === "GET" && m) response = await getReceipt(request, env, m[1]);
          else {
            const mKey = path.match(/^\/users\/by-key\/([A-Za-z0-9\-_]+)$/);
            if (method === "GET" && mKey) response = await lookupByKey(request, env, mKey[1]);
            else response = err("Not found", 404);
          }
        }
      }
    } catch (e) {
      console.error("Unhandled:", e);
      response = err("Internal error: " + (e.message || e), 500);
    }

    return addCors(response, env, request);
  }
};
