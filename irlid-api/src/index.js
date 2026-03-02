// irlid-api/src/index.js
// IRLid Backend — Cloudflare Worker + D1
// Handles: user registration, login, receipt upload & retrieval

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

function canonical(obj) {
  const keys = Object.keys(obj).sort();
  const o = {};
  for (const k of keys) o[k] = obj[k];
  return JSON.stringify(o);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function err(message, status = 400) {
  return json({ error: message }, status);
}

function randomToken() {
  return b64urlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

// =====================
//  CRYPTO (mirrors sign.js)
// =====================

async function hashPayloadToB64url(payloadObj) {
  const bytes = new TextEncoder().encode(JSON.stringify(payloadObj));
  const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
  return b64urlEncode(new Uint8Array(hashBuf));
}

async function sha256B64url(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return b64urlEncode(new Uint8Array(buf));
}

async function verifySig(midB64url, sigB64url, pubJwk) {
  try {
    const pub = await crypto.subtle.importKey(
      "jwk", pubJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      true, ["verify"]
    );
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pub, b64urlDecode(sigB64url), b64urlDecode(midB64url)
    );
  } catch { return false; }
}

async function pubKeyId(pubJwk) {
  const s = `${pubJwk.kty}.${pubJwk.crv}.${pubJwk.x}.${pubJwk.y}`;
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return b64urlEncode(new Uint8Array(h)).slice(0, 18);
}

// =====================
//  RECEIPT VERIFICATION
// =====================

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function verifyReceipt(comb) {
  const TS_TOL = 90;
  const DIST_TOL = 12;
  const checks = {};

  const a = comb.a;
  if (a && a.payload && a.hash && a.sig && a.pub) {
    checks.a_structure = true;
    checks.a_hash = (await hashPayloadToB64url(a.payload)) === a.hash;
    checks.a_sig = await verifySig(a.hash, a.sig, a.pub);
  } else {
    checks.a_structure = false;
    checks.a_hash = false;
    checks.a_sig = false;
  }

  const b = comb.b;
  if (b && b.payload && b.hash && b.sig && b.pub) {
    checks.b_structure = true;
    checks.b_hash = (await hashPayloadToB64url(b.payload)) === b.hash;
    checks.b_sig = await verifySig(b.hash, b.sig, b.pub);
  } else {
    checks.b_structure = false;
    checks.b_hash = false;
    checks.b_sig = false;
  }

  const hello = comb.hello;
  if (hello && hello.offer && hello.offer.payload && hello.offer.hash && hello.offer.sig && hello.pub) {
    checks.hello_hash = (await hashPayloadToB64url(hello.offer.payload)) === hello.offer.hash;
    checks.hello_sig = await verifySig(hello.offer.hash, hello.offer.sig, hello.pub);
  }

  if (hello) {
    const helloBytes = new TextEncoder().encode(JSON.stringify(hello));
    const helloHashBuf = await crypto.subtle.digest("SHA-256", helloBytes);
    const helloHash = b64urlEncode(new Uint8Array(helloHashBuf));
    if (a && a.payload) checks.a_binds_hello = a.payload.helloHash === helloHash;
    if (b && b.payload) checks.b_binds_hello = b.payload.helloHash === helloHash;
  }

  const tsA = a?.payload?.ts;
  const tsB = b?.payload?.ts;
  if (typeof tsA === "number" && typeof tsB === "number") {
    checks.time_delta_s = Math.abs(tsA - tsB);
    checks.time_delta_ok = checks.time_delta_s <= TS_TOL;
  } else {
    checks.time_delta_ok = false;
  }

  const latA = a?.payload?.lat;
  const lonA = a?.payload?.lon;
  const latB = b?.payload?.lat;
  const lonB = b?.payload?.lon;
  if (latA != null && lonA != null && latB != null && lonB != null) {
    checks.distance_m = Math.round(haversineMeters(latA, lonA, latB, lonB) * 100) / 100;
    checks.distance_ok = checks.distance_m <= DIST_TOL;
  } else {
    checks.distance_ok = false;
  }

  checks.valid = !!(
    checks.a_structure && checks.a_hash && checks.a_sig &&
    checks.b_structure && checks.b_hash && checks.b_sig &&
    checks.time_delta_ok && checks.distance_ok
  );

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

  const row = await env.DB.prepare(
    "SELECT user_id, device_id, expires_at FROM sessions WHERE id = ?"
  ).bind(token).first();

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
  const allowed = [
    env.CORS_ORIGIN || "https://bunhead.github.io",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000"
  ];
  const match = allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": match ? origin : allowed[0],
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}

function addCors(response, env, request) {
  const h = corsHeaders(env, request);
  for (const [k, v] of Object.entries(h)) response.headers.set(k, v);
  return response;
}

// =====================
//  ROUTE HANDLERS
// =====================

// POST /auth/register
async function register(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return err("Invalid JSON body"); }

  const { display_name, pub_jwk } = body;

  if (!pub_jwk || !pub_jwk.kty || !pub_jwk.crv || !pub_jwk.x || !pub_jwk.y) {
    return err("pub_jwk is required (your ECDSA P-256 public key)");
  }

  const pkId = await pubKeyId(pub_jwk);

  // If device already registered, just create a new session
  const existing = await env.DB.prepare(
    "SELECT d.id as device_id, d.user_id FROM devices d WHERE d.pub_key_id = ?"
  ).bind(pkId).first();

  if (existing) {
    const token = randomToken();
    const ts = now();
    await env.DB.prepare(
      "INSERT INTO sessions (id, user_id, device_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(token, existing.user_id, existing.device_id, ts, ts + 30 * 86400).run();

    return json({
      user_id: existing.user_id,
      device_id: existing.device_id,
      pub_key_id: pkId,
      session_token: token,
      existing: true
    });
  }

  const userId = uuid();
  const deviceId = uuid();
  const ts = now();
  const token = randomToken();

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO users (id, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)"
    ).bind(userId, display_name || null, ts, ts),
    env.DB.prepare(
      "INSERT INTO devices (id, user_id, pub_key_id, pub_jwk, created_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(deviceId, userId, pkId, JSON.stringify(pub_jwk), ts),
    env.DB.prepare(
      "INSERT INTO sessions (id, user_id, device_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(token, userId, deviceId, ts, ts + 30 * 86400)
  ]);

  return json({
    user_id: userId,
    device_id: deviceId,
    pub_key_id: pkId,
    session_token: token,
    existing: false
  }, 201);
}

// POST /auth/login
async function login(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return err("Invalid JSON body"); }

  const { pub_key_id } = body;
  if (!pub_key_id) return err("pub_key_id required");

  const device = await env.DB.prepare(
    "SELECT id, user_id, revoked_at FROM devices WHERE pub_key_id = ?"
  ).bind(pub_key_id).first();

  if (!device) return err("Device not found. Register first.", 404);
  if (device.revoked_at) return err("This device key has been revoked.", 403);

  const token = randomToken();
  const ts = now();
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, device_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(token, device.user_id, device.id, ts, ts + 30 * 86400).run();

  return json({ session_token: token, user_id: device.user_id, device_id: device.id });
}

// POST /auth/logout
async function logout(request, env) {
  const session = await getSession(request, env);
  const denied = requireAuth(session);
  if (denied) return denied;

  await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(session.token).run();
  return json({ ok: true });
}

// GET /auth/me
async function me(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ logged_in: false });

  const user = await env.DB.prepare(
    "SELECT id, display_name, created_at FROM users WHERE id = ?"
  ).bind(session.userId).first();
  if (!user) return json({ logged_in: false });

  const devices = await env.DB.prepare(
    "SELECT id, pub_key_id, label, created_at, revoked_at FROM devices WHERE user_id = ?"
  ).bind(session.userId).all();

  const countRow = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM receipts WHERE uploader_id = ?"
  ).bind(session.userId).first();

  return json({
    logged_in: true,
    user: { id: user.id, display_name: user.display_name, created_at: user.created_at },
    devices: (devices.results || []).map(d => ({
      id: d.id, pub_key_id: d.pub_key_id, label: d.label,
      created_at: d.created_at, revoked: !!d.revoked_at
    })),
    current_device_id: session.deviceId,
    receipt_count: countRow ? countRow.cnt : 0
  });
}

// POST /receipts
async function uploadReceipt(request, env) {
  const session = await getSession(request, env);
  const denied = requireAuth(session);
  if (denied) return denied;

  let body;
  try { body = await request.json(); }
  catch { return err("Invalid JSON body"); }

  const { combined } = body;
  if (!combined || combined.type !== "combined") {
    return err("Body must include 'combined' with type:'combined'");
  }

  const receiptHash = await sha256B64url(canonical(combined));

  const dup = await env.DB.prepare(
    "SELECT id FROM receipts WHERE receipt_hash = ?"
  ).bind(receiptHash).first();
  if (dup) {
    return json({ receipt_id: dup.id, receipt_hash: receiptHash, duplicate: true });
  }

  const checks = await verifyReceipt(combined);

  const pkA = (combined.a && combined.a.pub) ? await pubKeyId(combined.a.pub) : "";
  const pkB = (combined.b && combined.b.pub) ? await pubKeyId(combined.b.pub) : "";
  const tsA = combined.a?.payload?.ts || null;
  const tsB = combined.b?.payload?.ts || null;
  const receiptId = uuid();

  await env.DB.prepare(
    `INSERT INTO receipts (id, uploader_id, receipt_hash, pub_key_a, pub_key_b, ts_a, ts_b, receipt_json, verified, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    receiptId, session.userId, receiptHash,
    pkA, pkB, tsA, tsB,
    JSON.stringify(combined),
    checks.valid ? 1 : 0, now()
  ).run();

  return json({ receipt_id: receiptId, receipt_hash: receiptHash, verified: checks.valid, checks }, 201);
}

// GET /receipts
async function listReceipts(request, env) {
  const session = await getSession(request, env);
  const denied = requireAuth(session);
  if (denied) return denied;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
  const offset = (page - 1) * limit;

  const rows = await env.DB.prepare(
    `SELECT id, receipt_hash, pub_key_a, pub_key_b, ts_a, ts_b, verified, created_at
     FROM receipts WHERE uploader_id = ?
     ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(session.userId, limit, offset).all();

  const countRow = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM receipts WHERE uploader_id = ?"
  ).bind(session.userId).first();

  return json({
    receipts: rows.results || [],
    total: countRow ? countRow.cnt : 0,
    page, limit
  });
}

// GET /receipts/:hash
async function getReceipt(request, env, receiptHash) {
  const row = await env.DB.prepare(
    "SELECT id, receipt_hash, pub_key_a, pub_key_b, ts_a, ts_b, receipt_json, verified, created_at FROM receipts WHERE receipt_hash = ?"
  ).bind(receiptHash).first();

  if (!row) return err("Receipt not found", 404);

  let combined = null;
  try { combined = JSON.parse(row.receipt_json); } catch {}

  return json({
    receipt_id: row.id,
    receipt_hash: row.receipt_hash,
    pub_key_a: row.pub_key_a,
    pub_key_b: row.pub_key_b,
    ts_a: row.ts_a,
    ts_b: row.ts_b,
    verified: !!row.verified,
    created_at: row.created_at,
    combined
  });
}

// POST /verify (public)
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
//  ROUTER + ENTRY POINT
// =====================

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return addCors(new Response(null, { status: 204 }), env, request);
    }

    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    let response;
    try {
      if (path === "/" || path === "/health") {
        response = json({ status: "ok", service: "irlid-api" });
      }
      else if (method === "POST" && path === "/auth/register") response = await register(request, env);
      else if (method === "POST" && path === "/auth/login")    response = await login(request, env);
      else if (method === "POST" && path === "/auth/logout")   response = await logout(request, env);
      else if (method === "GET"  && path === "/auth/me")        response = await me(request, env);
      else if (method === "POST" && path === "/receipts")       response = await uploadReceipt(request, env);
      else if (method === "GET"  && path === "/receipts")        response = await listReceipts(request, env);
      else if (method === "POST" && path === "/verify")         response = await verify(request, env);
      else {
        const m = path.match(/^\/receipts\/([A-Za-z0-9\-_]+)$/);
        if (method === "GET" && m) response = await getReceipt(request, env, m[1]);
        else response = err("Not found", 404);
      }
    } catch (e) {
      console.error("Unhandled:", e);
      response = err("Internal error: " + (e.message || e), 500);
    }

    return addCors(response, env, request);
  }
};
