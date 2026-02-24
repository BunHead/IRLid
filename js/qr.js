// IRLid QR helpers
// Deploy 41
//
// Provides (globals):
//   - makeQR(targetElOrId, text, sizePx?)
//   - irlidClassifyText(text) -> { kind: "HELLO"|"RESP"|"COMB"|"UNKNOWN", value: string|null }
//   - makeReturnForHelloAsync(hello) -> Promise<urlString>
//   - processScannedResponse(text, opts?) -> Promise<{ ok:true, resp, ageMs, distM }>
// Requirements enforced in processScannedResponse:
//   - hash(payload) matches outer hash
//   - signature verifies (ECDSA P-256)
//   - payload.pub matches outer pub
//   - timestamps <= 60s (default)
//   - GPS distance <= 2m (default)
//
// Dependencies:
//   - QR renderer: qrcode@1.5.3 build (window.QRCode) from js/vendor/qrcode.min.js
//   - Signing: js/sign.js (getPublicJwk, hashPayloadToB64url, signHashB64url, verifySig)

(function () {
  "use strict";

  // ---------- small helpers ----------
  function assert(cond, msg) {
    if (!cond) throw new Error(msg);
  }

  function isString(x) {
    return typeof x === "string" || x instanceof String;
  }

  function b64urlEncodeBytes(bytes) {
    // Do not rely on sign.js b64urlEncode to keep this file standalone
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

  function encodeJsonToB64url(obj) {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    return b64urlEncodeBytes(bytes);
  }

  function decodeJsonFromB64url(b64u) {
    const bytes = b64urlDecodeToBytes(b64u);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  }

  function slimJwk(pubJwk) {
    return { kty: pubJwk.kty, crv: pubJwk.crv, x: pubJwk.x, y: pubJwk.y };
  }

  function sameSlimJwk(a, b) {
    return !!a && !!b &&
      a.kty === b.kty &&
      a.crv === b.crv &&
      a.x === b.x &&
      a.y === b.y;
  }

  function isProbablyUrl(s) {
    return /^https?:\/\//i.test(String(s || ""));
  }

  function extractHashParam(text, key) {
    // Supports:
    //  - full URL ...#KEY=...
    //  - "KEY=..."
    //  - "#KEY=..."
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
      } catch {
        // fall through
      }
    }

    const raw = t.startsWith("#") ? t.slice(1) : t;
    for (const p of raw.split("&")) {
      const [k, v] = p.split("=");
      if (k === key) return v || "";
    }
    return null;
  }

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

  // ---------- QR render ----------
  function makeQR(target, text, size) {
    // qrcode@1.5.3 build exposes window.QRCode with toCanvas
    assert(window.QRCode && typeof window.QRCode.toCanvas === "function",
      "QRCode library missing: expected window.QRCode.toCanvas (check js/vendor/qrcode.min.js).");

    const px = Math.max(220, Math.min(720, (size | 0) || 360));

    let host = target;
    if (isString(target)) {
      host = document.getElementById(String(target));
      assert(host, "makeQR: target element not found: " + target);
    }
    assert(host && host.nodeType === 1, "makeQR: invalid target element.");

    // Render into a canvas inside host (or use host if it is a canvas)
    let canvas;
    if (host.tagName && host.tagName.toLowerCase() === "canvas") {
      canvas = host;
    } else {
      host.innerHTML = "";
      canvas = document.createElement("canvas");
      host.appendChild(canvas);
    }

    window.QRCode.toCanvas(
      canvas,
      String(text),
      { width: px, margin: 1, errorCorrectionLevel: "M" },
      function (err) {
        if (err) throw err;
      }
    );
  }

  // ---------- classify ----------
  function irlidClassifyText(text) {
    const hello = extractHashParam(text, "HELLO");
    if (hello != null) return { kind: "HELLO", value: hello };

    const resp = extractHashParam(text, "RESP");
    if (resp != null) return { kind: "RESP", value: resp };

    const comb = extractHashParam(text, "COMB");
    if (comb != null) return { kind: "COMB", value: comb };

    return { kind: "UNKNOWN", value: null };
  }

  // ---------- HELLO -> Return (RESP) ----------
  async function makeReturnForHelloAsync(hello, opts) {
    opts = opts || {};

    assert(typeof window.getPublicJwk === "function", "Return generation unavailable: getPublicJwk() missing in js/sign.js");
    assert(typeof window.hashPayloadToB64url === "function", "Return generation unavailable: hashPayloadToB64url() missing in js/sign.js");
    assert(typeof window.signHashB64url === "function", "Return generation unavailable: signHashB64url() missing in js/sign.js");

    const geo = await getGeoOnce(opts.geo || {});
    const pubFull = await window.getPublicJwk();
    const pub = slimJwk(pubFull);

    const payload = {
      hello: String(hello),
      ts: Date.now(),
      lat: geo.lat,
      lon: geo.lon,
      pub
    };

    const hash = await window.hashPayloadToB64url(payload);
    const sig = await window.signHashB64url(hash);

    const respObj = {
      type: "response",
      payload,
      hash,
      sig,
      pub
    };

    const respB64u = encodeJsonToB64url(respObj);

    const url = new URL("application.html", location.href);
    url.hash = "RESP=" + respB64u;
    return url.toString();
  }

  // ---------- Validate RESP ----------
  async function processScannedResponse(text, opts) {
    opts = opts || {};
    const nowMs = opts.nowMs ?? Date.now();
    const maxAgeMs = opts.maxAgeMs ?? 60000; // 60s
    const maxDistM = opts.maxDistM ?? 2;     // 2m

    assert(typeof window.verifySig === "function", "Verification unavailable: verifySig() missing in js/sign.js");
    assert(typeof window.hashPayloadToB64url === "function", "Verification unavailable: hashPayloadToB64url() missing in js/sign.js");

    const respB64u = extractHashParam(text, "RESP");
    assert(respB64u, "Not a RESP payload.");

    const resp = decodeJsonFromB64url(respB64u);

    assert(resp && resp.type === "response", "RESP: invalid type.");
    assert(resp.payload && typeof resp.payload === "object", "RESP: missing payload.");
    assert(resp.hash && typeof resp.hash === "string", "RESP: missing hash.");
    assert(resp.sig && typeof resp.sig === "string", "RESP: missing sig.");
    assert(resp.pub && typeof resp.pub === "object", "RESP: missing pub.");
    assert(resp.payload.pub && typeof resp.payload.pub === "object", "RESP: payload.pub missing.");

    // payload.pub matches outer pub
    assert(sameSlimJwk(resp.payload.pub, resp.pub), "RESP: payload.pub does not match outer pub.");

    // hash(payload) matches
    const recomputed = await window.hashPayloadToB64url(resp.payload);
    assert(recomputed === resp.hash, "RESP: hash mismatch.");

    // signature verifies (ECDSA P-256)
    const okSig = await window.verifySig(resp.hash, resp.sig, resp.pub);
    assert(okSig, "RESP: signature invalid.");

    // timestamps <= 60s
    const ts = Number(resp.payload.ts);
    assert(Number.isFinite(ts), "RESP: invalid ts.");
    const ageMs = Math.abs(nowMs - ts);
    assert(ageMs <= maxAgeMs, "RESP: timestamp outside window (" + ageMs + "ms).");

    // distance <= 2m (always enforced per your spec)
    const myGeo = await getGeoOnce(opts.geo || {});
    const distM = haversineMeters(myGeo.lat, myGeo.lon, Number(resp.payload.lat), Number(resp.payload.lon));
    assert(distM <= maxDistM, "RESP: distance too far (" + distM.toFixed(2) + "m).");

    return { ok: true, resp, ageMs, distM };
  }

  // ---------- export globals ----------
  window.makeQR = makeQR;
  window.irlidClassifyText = irlidClassifyText;
  window.makeReturnForHelloAsync = makeReturnForHelloAsync;
  window.processScannedResponse = processScannedResponse;

})();
