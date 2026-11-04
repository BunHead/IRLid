// Push updates for the Org dashboard (replaces 2 s / 4 s polling).
//
// One Durable Object per org ("OrgHub") holds the dashboard's WebSockets and
// fans out tiny "something changed" events. It uses the WebSocket Hibernation
// API, so an idle hub costs nothing. Events carry NO personal data: only a
// type, opaque ids and (for the live QR) the code string. The page then
// fetches the real data over the normal authenticated endpoints.
//
// Rules: S9 (org key never in a URL or QR), S11, S12 (random/HMAC tokens, no
// IP decisions), S13 (server decides), R5/C13 (a hub failure never blocks a
// check-in), C1/C2 (offline-first is untouched: this is only an accelerator).

const enc = new TextEncoder();

export const WS_PROTOCOL = "irlid.v1";
export const WS_TICKET_PREFIX = "ticket.";
export const WS_TICKET_TTL_S = 60;
export const MAX_SOCKETS_PER_ORG = 25;
export const MAX_SOCKET_AGE_MS = 12 * 3600 * 1000;
// L2: a ticket's random part is remembered this long, so each ticket opens one socket.
export const TICKET_REPLAY_MS = 65 * 1000;
export const MAX_NOTIFY_BYTES = 2048;

// The only event types the hub will broadcast.
export const HUB_EVENT_TYPES = new Set(["attendance", "expected", "events", "members", "settings"]);

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64urlDecode(str) {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const bin = atob(String(str).replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function hmacKey(secret, usages) {
  return crypto.subtle.importKey("raw", enc.encode(String(secret)), { name: "HMAC", hash: "SHA-256" }, false, usages);
}

// A ticket is a short-lived (60 s) HMAC over {org id, expiry, random}, keyed by
// the org's own api_key. Nothing is stored, no new secret is needed, and
// rotating the api_key kills every outstanding ticket. The api_key itself is
// never sent in the WebSocket URL; the ticket travels in the
// Sec-WebSocket-Protocol header, so it stays out of URL logs too.
export async function mintWsTicket(org, nowS) {
  const exp = nowS + WS_TICKET_TTL_S;
  const payload = b64url(enc.encode(JSON.stringify({ v: 1, o: String(org.id), e: exp, r: b64url(crypto.getRandomValues(new Uint8Array(12))) })));
  const key = await hmacKey(org.api_key, ["sign"]);
  const sig = b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode("irlid-ws-ticket|" + payload))));
  return { ticket: payload + "." + sig, expires_at: exp };
}

// Reads the org id out of a ticket WITHOUT trusting it (only to know which org
// row to load the key from). verifyWsTicket does the real check.
export function wsTicketOrgId(ticket) {
  try {
    const [payload] = String(ticket || "").split(".");
    const data = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
    return data && data.v === 1 && typeof data.o === "string" && data.o ? data.o : null;
  } catch { return null; }
}

export async function verifyWsTicket(ticket, org, nowS) {
  try {
    const parts = String(ticket || "").split(".");
    if (parts.length !== 2 || !org || !org.api_key) return false;
    const [payload, sig] = parts;
    const data = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
    if (!data || data.v !== 1 || data.o !== String(org.id)) return false;
    if (!Number.isFinite(data.e) || data.e < nowS) return false;
    if (data.e > nowS + WS_TICKET_TTL_S + 5) return false; // not minted by us
    const key = await hmacKey(org.api_key, ["verify"]);
    // subtle.verify compares in constant time.
    return await crypto.subtle.verify("HMAC", key, b64urlDecode(sig), enc.encode("irlid-ws-ticket|" + payload));
  } catch { return false; }
}

// Random part of a ticket (call only after verifyWsTicket passed).
export function wsTicketNonce(ticket) {
  try {
    const data = JSON.parse(new TextDecoder().decode(b64urlDecode(String(ticket).split(".")[0])));
    return typeof data.r === "string" ? data.r : null;
  } catch { return null; }
}

// L1: short hash of the org api_key, so the hub can drop sockets opened under an old key.
export async function hubKeyTag(apiKey) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode("irlid-hub-key|" + String(apiKey || ""))));
  return b64url(d.slice(0, 12));
}

// Pulls "ticket.<token>" out of a Sec-WebSocket-Protocol header value.
export function ticketFromProtocolHeader(header) {
  for (const raw of String(header || "").split(",")) {
    const p = raw.trim();
    if (p.startsWith(WS_TICKET_PREFIX)) return p.slice(WS_TICKET_PREFIX.length);
  }
  return null;
}

// Whitelist-only: whatever the Worker passes in, only these fields come out.
export function cleanHubEvent(input, nowMs) {
  if (!input || typeof input !== "object" || !HUB_EVENT_TYPES.has(input.type)) return null;
  const out = { type: input.type, at: Math.floor((nowMs || Date.now()) / 1000) };
  if (Array.isArray(input.ids)) {
    const ids = input.ids.filter(v => typeof v === "string" && v.length <= 90 && /^[A-Za-z0-9_.:-]+$/.test(v)).slice(0, 20);
    if (ids.length) out.ids = ids;
  }
  if (typeof input.nonce === "string" && input.nonce.length <= 64 && /^[A-Za-z0-9_-]+$/.test(input.nonce)) out.nonce = input.nonce;
  return out;
}

export class OrgHub {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.usedTickets = new Map();           // ticket random part -> expiry ms (L2)
    // Answered by the runtime without waking the object (not billed).
    try {
      if (typeof WebSocketRequestResponsePair === "function" && ctx.setWebSocketAutoResponse) {
        ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
      }
    } catch (_) { /* optional */ }
  }

  // Only the Worker can reach this (via the binding). The public route
  // /org/ws verifies the ticket first and then calls /connect here.
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/connect") return this.connect(request);
    if (path === "/notify" && request.method === "POST") return this.notify(request);
    return new Response("Not found", { status: 404 });
  }

  // Tests override this (Node cannot build a 101 Response).
  makeUpgradeResponse(client) {
    return new Response(null, { status: 101, webSocket: client, headers: { "Sec-WebSocket-Protocol": WS_PROTOCOL } });
  }

  connect(request) {
    if ((request.headers.get("Upgrade") || "").toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    // L2: one socket per ticket. In memory only: if the object hibernates the
    // list is lost, but the 60 s ticket expiry still bounds reuse.
    const tn = request.headers.get("X-Hub-Ticket-Nonce");
    if (tn) {
      const t0 = Date.now();
      for (const [k, exp] of this.usedTickets) if (exp < t0) this.usedTickets.delete(k);
      if (this.usedTickets.has(tn)) return new Response("Ticket already used", { status: 401 });
      this.usedTickets.set(tn, t0 + TICKET_REPLAY_MS);
    }
    const keyTag = request.headers.get("X-Hub-Key-Tag") || null;
    const sockets = this.ctx.getWebSockets();
    if (sockets.length >= MAX_SOCKETS_PER_ORG) {
      // Drop the oldest so a runaway reconnect loop cannot fill the hub.
      const oldest = sockets.slice().sort((a, b) => (a.deserializeAttachment()?.t || 0) - (b.deserializeAttachment()?.t || 0))[0];
      try { oldest.close(1008, "too many connections"); } catch (_) {}
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ t: Date.now(), k: keyTag });
    return this.makeUpgradeResponse(client);
  }

  async notify(request) {
    const text = await request.text();
    if (text.length > MAX_NOTIFY_BYTES) return json({ error: "too large" }, 413);
    let input; try { input = JSON.parse(text); } catch { return json({ error: "bad json" }, 400); }
    const event = cleanHubEvent(input, Date.now());
    if (!event) return json({ error: "bad event" }, 400);
    return json({ sent: this.broadcast(event, request.headers.get("X-Hub-Key-Tag") || null) });
  }

  broadcast(event, keyTag) {
    const msg = JSON.stringify(event);
    const cutoff = Date.now() - MAX_SOCKET_AGE_MS;
    let sent = 0;
    for (const ws of this.ctx.getWebSockets()) {
      try {
        // Sockets live at most 12 h (checked when an event is sent). A socket
        // opened under an older api_key is closed on the next event (L1).
        const att = ws.deserializeAttachment() || {};
        if ((att.t || 0) < cutoff) { ws.close(1000, "renew"); continue; }
        if (keyTag && att.k && att.k !== keyTag) { ws.close(1008, "key rotated"); continue; }
        ws.send(msg);
        sent++;
      } catch (_) { try { ws.close(1011, "send failed"); } catch (_) {} }
    }
    return sent;
  }

  // The hub only pushes. Anything a client sends is ignored.
  webSocketMessage() {}
  webSocketClose(ws, code) {
    try { ws.close(code >= 1000 && code <= 4999 && code !== 1005 && code !== 1006 && code !== 1015 ? code : 1000, "bye"); } catch (_) {}
  }
  webSocketError(ws) { try { ws.close(1011, "error"); } catch (_) {} }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
