// IRLid QR helpers
// Deploy 45 — RESTORE scan flow compatibility (HELLO/RESP/COMB), quiet zone QR rendering
//
// Exposes (globals):
//   - makeQR(targetElOrId, text, sizePx?)
//   - irlidClassifyText(text) -> { kind: "HELLO"|"RESP_B64"|"COMB_B64"|"UNKNOWN", value: string|null }
//   - irlidEncodeJsonToB64url(obj) -> string
//   - irlidDecodeB64urlJson(b64u) -> object
//   - makeHelloTokenAsync() -> Promise<b64urlHelloString>   (back-compat: may fall back to random token)
//   - makeReturnForHelloAsync(helloB64orToken) -> Promise<respObj>
//   - processScannedResponse(otherRespObj, opts?) -> Promise<{ ok:true, self, other, distM, dtS }>
//
// Dependencies:
//   - QR renderer: window.QRCode.toCanvas (js/vendor/qrcode.min.js OR CDN qrcode@1.5.3)
//   - Signing: js/sign.js providing getPublicJwk, hashPayloadToB64url, signHashB64url, verifySig, pubKeyId

(function () {
  "use strict";

  function assert(cond, msg) { if (!cond) throw new Error(msg); }

  // ---------------------------
  // b64url helpers (utf8)
  // ---------------------------
  function b64urlEncodeBytes(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }
  function b64urlDecodeToBytes(str) {
    str = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function irlidEncodeJsonToB64url(obj) {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    return b64urlEncodeBytes(bytes);
  }

  function irlidDecodeB64urlJson(b64u) {
    const bytes = b64urlDecodeToBytes(String(b64u || ""));
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  }

  // ---------------------------
  // JWK helpers (slim only)
  // ---------------------------
  function slimJwk(pubJwk) {
    return { kty: pubJwk.kty, crv: pubJwk.crv, x: pubJwk.x, y: pubJwk.y };
  }

  async function pubId(pub) {
    try {
      if (typeof window.pubKeyId === "function") return await window.pubKeyId(pub);
    } catch {}
    return `${pub.kty}.${pub.crv}.${pub.x}.${pub.y}`;
  }

  async function orderedPubs(pubA, pubB) {
    const idA = await pubId(pubA);
    const idB = await pubId(pubB);
    return (String(idA) <= String(idB)) ? [pubA, pubB] : [pubB, pubA];
  }

  // ---------------------------
  // URL/hash parsing + classifier
  // ---------------------------
  function isProbablyUrl(s) { return /^https?:\/\//i.test(String(s || "")); }

  function extractHashParam(text, key) {
    const t = String(text || "").trim();
    if (!t) return null;

    if (isProbablyUrl(t)) {
      try {
        const u = new URL(t);
        const h = (u.hash || "").replace(/^#/, "");
        if (!h) return null;
        for (const p of h.split("&")) {
          const [k, v] = p.split("=");
          if (k === key) return v || "";
        }
        return null;
      } catch { /* fall through */ }
    }

    const raw = t.startsWith("#") ? t.slice(1) : t;
    for (const p of raw.split("&")) {
      const [k, v] = p.split("=");
      if (k === key) return v || "";
    }
    return null;
  }

  function tryDecodeB64urlJson(s) {
    try {
      const t = String(s || "").trim();
      if (!t) return null;
      if (t.includes("://")) return null;
      if (t.startsWith("{") || t.startsWith("[")) return null;
      const obj = irlidDecodeB64urlJson(t);
      return obj && typeof obj === "object" ? obj : null;
    } catch {
      return null;
    }
  }

  function irlidClassifyText(text) {
    const hello = extractHashParam(text, "HELLO");
    if (hello != null) return { kind: "HELLO", value: hello };

    const resp = extractHashParam(text, "RESP");
    if (resp != null) return { kind: "RESP_B64", value: resp };

    const comb = extractHashParam(text, "COMB");
    if (comb != null) return { kind: "COMB_B64", value: comb };

    // Raw b64url JSON (no RESP=/COMB=/HELLO= wrapper)
    const obj = tryDecodeB64urlJson(text);
    if (obj) {
      if (obj.type === "response") return { kind: "RESP_B64", value: String(text).trim() };
      if (obj.type === "combined") return { kind: "COMB_B64", value: String(text).trim() };
      if (obj.v === 1 && (obj.t || obj.hello) && obj.pub) return { kind: "HELLO", value: String(text).trim() };
    }

    return { kind: "UNKNOWN", value: null };
  }

  // ---------------------------
  // Geo + distance
  // ---------------------------
  function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async function getGeoOnce(opts) {
    opts = opts || {};
    const timeoutMs = opts.timeoutMs ?? 8000;
    const highAcc = opts.highAccuracy ?? true;

    assert(navigator.geolocation, "Geolocation unavailable.");

    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("Geolocation timeout.")), timeoutMs);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(t);
          resolve({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            acc: pos.coords.accuracy
          });
        },
        (err) => {
          clearTimeout(t);
          reject(new Error("Geolocation error: " + (err && err.message ? err.message : err)));
        },
        { enableHighAccuracy: highAcc, maximumAge: 0, timeout: timeoutMs }
      );
    });
  }

  // ---------------------------
  // makeQR (quiet zone; scanner-friendly)
  // ---------------------------
  function makeQR(target, text, sizePx) {
    assert(window.QRCode && typeof window.QRCode.toCanvas === "function",
      "QRCode library missing: expected window.QRCode.toCanvas.");

    const el = (typeof target === "string") ? document.getElementById(target) : target;
    assert(el, "makeQR: target element not found.");

    while (el.firstChild) el.removeChild(el.firstChild);

    const outerPx = Math.max(280, Math.min(720, (sizePx | 0) || 360));
    const qz = Math.max(16, Math.floor(outerPx * 0.06));
    const innerPx = Math.max(120, outerPx - 2 * qz);

    const canvas = document.createElement("canvas");
    canvas.width = outerPx;
    canvas.height = outerPx;
    canvas.style.width = outerPx + "px";
    canvas.style.height = outerPx + "px";
    canvas.style.imageRendering = "pixelated";
    el.appendChild(canvas);

    const tmp = document.createElement("canvas");
    tmp.width = innerPx;
    tmp.height = innerPx;

    window.QRCode.toCanvas(
      tmp,
      String(text),
      { width: innerPx, margin: 1, errorCorrectionLevel: "L" },
      function (err) {
        if (err) throw err;

        const ctx = canvas.getContext("2d");
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;

        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, outerPx, outerPx);

        ctx.drawImage(tmp, qz, qz, innerPx, innerPx);
        ctx.restore();
      }
    );
  }

  // ---------------------------
  // HELLO token (includes initiator pub when possible)
  // ---------------------------
  function randomBytes(n) {
    const b = new Uint8Array(n);
    crypto.getRandomValues(b);
    return b;
  }

  async function makeHelloTokenAsync() {
    const token = b64urlEncodeBytes(randomBytes(16));

    try {
      if (typeof window.getPublicJwk === "function") {
        const pubFull = await window.getPublicJwk();
        const pub = slimJwk(pubFull);
        const helloObj = { v: 1, t: token, pub };
        return irlidEncodeJsonToB64url(helloObj);
      }
    } catch {}

    return token; // legacy token-only
  }

  function parseHello(helloStr) {
    const raw = String(helloStr || "").trim();
    if (!raw) return { token: "", initiatorPub: null };

    const obj = tryDecodeB64urlJson(raw);
    if (obj && (obj.t || obj.hello) && obj.pub) {
      return {
        token: String(obj.t || obj.hello),
        initiatorPub: (obj.pub && typeof obj.pub === "object") ? obj.pub : null
      };
    }

    return { token: raw, initiatorPub: null };
  }

  // ---------------------------
  // Response building + mutual processing
  // ---------------------------
  async function buildResponseForHello(helloStr, otherPubMaybe, geoOpts) {
    assert(typeof window.getPublicJwk === "function", "Return generation unavailable: getPublicJwk() missing in js/sign.js");
    assert(typeof window.hashPayloadToB64url === "function", "Return generation unavailable: hashPayloadToB64url() missing in js/sign.js");
    assert(typeof window.signHashB64url === "function", "Return generation unavailable: signHashB64url() missing in js/sign.js");

    const { token, initiatorPub } = parseHello(helloStr);

    const geo = await getGeoOnce(geoOpts || {});
    const pubFull = await window.getPublicJwk();
    const selfPub = slimJwk(pubFull);

    let pubs = null;
    const otherPub = otherPubMaybe || initiatorPub || null;
    if (otherPub && otherPub.kty && otherPub.x && otherPub.y) {
      pubs = await orderedPubs(selfPub, otherPub);
    }

    const payload = {
      v: 1,
      hello: String(token),
      ts: Date.now(),
      gps: { lat: geo.lat, lon: geo.lon, acc: geo.acc },
      pubs: pubs || undefined
    };

    const hash = await window.hashPayloadToB64url(payload);
    const sig = await window.signHashB64url(hash);

    return {
      type: "response",
      payload,
      hash,
      sig,
      pub: selfPub
    };
  }

  async function makeReturnForHelloAsync(helloStr, opts) {
    opts = opts || {};
    return await buildResponseForHello(helloStr, null, (opts && opts.geo) || {});
  }

  async function validateResponseObject(respObj) {
    assert(typeof window.verifySig === "function", "Verification unavailable: verifySig() missing in js/sign.js");
    assert(typeof window.hashPayloadToB64url === "function", "Verification unavailable: hashPayloadToB64url() missing in js/sign.js");

    assert(respObj && typeof respObj === "object", "RESP: not an object.");
    assert(respObj.type === "response", "RESP: invalid type.");
    assert(respObj.payload && typeof respObj.payload === "object", "RESP: missing payload.");
    assert(typeof respObj.hash === "string", "RESP: missing hash.");
    assert(typeof respObj.sig === "string", "RESP: missing sig.");
    assert(respObj.pub && typeof respObj.pub === "object", "RESP: missing pub.");

    const recomputed = await window.hashPayloadToB64url(respObj.payload);
    assert(recomputed === respObj.hash, "RESP: hash mismatch.");

    const okSig = await window.verifySig(respObj.hash, respObj.sig, respObj.pub);
    assert(okSig, "RESP: signature invalid.");

    return true;
  }

  async function processScannedResponse(otherRespObj, opts) {
    opts = opts || {};
    const tsTolS = Number.isFinite(opts.tsTolS) ? opts.tsTolS : 60;
    const distTolM = Number.isFinite(opts.distTolM) ? opts.distTolM : 2;
    const helloStr = String(opts.hello || "");

    await validateResponseObject(otherRespObj);

    const { token: helloToken } = parseHello(helloStr);
    if (helloToken) {
      const otherHello = otherRespObj && otherRespObj.payload ? otherRespObj.payload.hello : null;
      assert(String(otherHello || "") === String(helloToken), "RESP: hello token mismatch.");
    }

    const selfResp = await buildResponseForHello(helloStr, otherRespObj.pub, (opts.geo || {}));
    await validateResponseObject(selfResp);

    const tsA = Number(selfResp.payload && selfResp.payload.ts);
    const tsB = Number(otherRespObj.payload && otherRespObj.payload.ts);
    const dtS = Math.abs(tsA - tsB) / 1000;
    assert(Number.isFinite(dtS) && dtS <= tsTolS, "RESP: timestamps outside tolerance (Δt=" + dtS.toFixed(2) + "s).");

    const gA = selfResp.payload && selfResp.payload.gps;
    const gB = otherRespObj.payload && otherRespObj.payload.gps;
    assert(gA && gB && typeof gA.lat === "number" && typeof gA.lon === "number" && typeof gB.lat === "number" && typeof gB.lon === "number",
      "RESP: missing gps for distance check.");

    const distM = haversineMeters(gA.lat, gA.lon, gB.lat, gB.lon);
    assert(distM <= distTolM, "RESP: distance too far (" + distM.toFixed(2) + "m).");

    if (selfResp.payload && selfResp.payload.pubs && otherRespObj.payload && otherRespObj.payload.pubs) {
      const okPubs = JSON.stringify(selfResp.payload.pubs) === JSON.stringify(otherRespObj.payload.pubs);
      assert(okPubs, "RESP: pubs mismatch.");
    }

    return { ok: true, self: selfResp, other: otherRespObj, distM, dtS };
  }

  // Export globals
  window.makeQR = makeQR;
  window.irlidClassifyText = irlidClassifyText;
  window.irlidEncodeJsonToB64url = irlidEncodeJsonToB64url;
  window.irlidDecodeB64urlJson = irlidDecodeB64urlJson;
  window.makeHelloTokenAsync = makeHelloTokenAsync;
  window.makeReturnForHelloAsync = makeReturnForHelloAsync;
  window.processScannedResponse = processScannedResponse;

})();
