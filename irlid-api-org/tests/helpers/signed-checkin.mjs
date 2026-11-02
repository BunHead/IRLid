// Shared helpers for the org Worker check-in tests: a phone-like device key
// that signs its check-in hello the way org-entry.html recordVenueCheckin()
// does (canonical JSON -> SHA-256 -> ECDSA P-256 over the hash bytes).

const enc = new TextEncoder();

export function canonical(val) {
  if (val === null || typeof val !== "object") return JSON.stringify(val);
  if (Array.isArray(val)) return "[" + val.map(canonical).join(",") + "]";
  return "{" + Object.keys(val).sort().map(k => JSON.stringify(k) + ":" + canonical(val[k])).join(",") + "}";
}

export function b64url(bytes) {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(str) {
  return new Uint8Array(Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
}

export async function hashHello(hello) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(canonical(hello)))));
}

export async function newDevice() {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  const pub = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
  // Same fingerprint the Worker uses (deviceKeyFp).
  const fp = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(canonical(pub))))).slice(0, 16);
  return {
    pub,
    fp,
    async sign(hashB64url) {
      const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, b64urlDecode(hashB64url));
      return b64url(new Uint8Array(sig));
    }
  };
}

// A signed attendee_scan body. `ts` is the phone's scan time (seconds).
export async function signedCheckinBody({ org, device, ts, nonce = null, event_id = null, client_checkin_id, ...rest } = {}) {
  device = device || await newDevice();
  ts = ts ?? Math.floor(Date.now() / 1000);
  const cid = client_checkin_id || "checkin_" + crypto.randomUUID();
  const helloPayload = { mode: "attendee_scan", org, pub: device.pub, ts, cid, event_id: event_id || null, nonce: nonce || null, v: 2 };
  const helloHash = await hashHello(helloPayload);
  const helloSig = await device.sign(helloHash);
  return {
    mode: "attendee_scan",
    client_checkin_id: cid,
    checkin_ts: ts,
    helloPayload,
    helloHash,
    helloSig,
    event_id: event_id || null,
    nonce: nonce || null,
    score: 70,
    bioVerified: false,
    ...rest
  };
}

// Weekly-event columns for an event that is open right now (UTC), or one
// that is closed (started 6 hours ago, 60 minutes long).
export function eventScheduleAt(offsetMin = -10) {
  const d = new Date(Date.now() + offsetMin * 60000);
  const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  const hhmm = String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
  return { day_of_week: dow, start_time_local: hhmm };
}
