// IRLid QR helpers
// Deploy 44 — FIX: guaranteed quiet zone + no cropping + no CSS scaling artifacts
//
// Exposes (globals):
//   - makeQR(targetElOrId, text, sizePx?)
//   - irlidClassifyText(text) -> { kind: "HELLO"|"RESP"|"COMB"|"UNKNOWN", value: string|null }
//   - makeReturnForHelloAsync(hello) -> Promise<urlString>
//   - processScannedResponse(text, opts?) -> Promise<{ ok:true, resp, ageMs, distM }>
//
// Dependencies:
//   - QR renderer: js/vendor/qrcode.min.js providing window.QRCode.toCanvas
//   - Signing: js/sign.js providing getPublicJwk, hashPayloadToB64url, signHashB64url, verifySig

(function () {
  "use strict";

  function assert(cond, msg) { if (!cond) throw new Error(msg); }
  function isString(x) { return typeof x === "string" || x instanceof String; }

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
    return !!a && !!b && a.kty === b.kty && a.crv === b.crv && a.x === b.x && a.y === b.y;
  }

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
  // ✅ makeQR (guaranteed quiet zone)
  // ---------------------------
  function makeQR(target, text, sizePx) {
    assert(window.QRCode && typeof window.QRCode.toCanvas === "function",
      "QRCode library missing: expected window.QRCode.toCanvas (check js/vendor/qrcode.min.js).");

    // Desired overall size (outer canvas including quiet zone)
    const outerPx = Math.max(280, Math.min(720, (sizePx | 0) || 360));

    // Quiet zone in pixels (must be visibly white; scanners need it)
    // Use at least 16px, or ~6% of size (whichever is larger).
    const qz = Math.max(16, Math.floor(outerPx * 0.06));

    // Inner QR render size
    const innerPx = Math.max(120, outerPx - 2 * qz);

    let host = target;
    if (isString(target)) {
      host = document.getElementById(String(target));
      assert(host, "makeQR: target element not found: " + target);
    }
    assert(host && host.nodeType === 1, "makeQR: invalid target element.");

    // Visible canvas (outer, includes quiet zone)
    let canvas;
    if (host.tagName && host.tagName.toLowerCase() === "canvas") {
      canvas = host;
    } else {
      host.innerHTML = "";
      canvas = document.createElement("canvas");
      host.appendChild(canvas);
    }

    // Lock display size so browser never rescales (important for decoding)
    canvas.width = outerPx;
    canvas.height = outerPx;
    canvas.style.width = outerPx + "px";
    canvas.style.height = outerPx + "px";
    canvas.style.maxWidth = "100%";
    canvas.style.imageRendering = "pixelated";
    canvas.style.display = "block";
    canvas.style.margin = "0 auto";
    host.style.background = "#fff";
    host.style.display = "block";
    host.style.maxWidth = "100%";

    // Render QR into an offscreen canvas at innerPx
    const tmp = document.createElement("canvas");
    tmp.width = innerPx;
    tmp.height = innerPx;

    // Ask library for margin too, but we *still* enforce quiet zone ourselves.
    window.QRCode.toCanvas(
      tmp,
      String(text),
      { width: innerPx, margin: 1, errorCorrectionLevel: "M" },
      function (err) {
        if (err) throw err;

        const ctx = canvas.getContext("2d");

        // White background for entire outer area (quiet zone)
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, outerPx, outerPx);

        // Draw inner QR centered with quiet zone padding
        ctx.drawImage(tmp, qz, qz, innerPx, innerPx);
        ctx.restore();
      }
    );
  }

  function irlidClassifyText(text) {
    const hello = extractHashParam(text, "HELLO");
    if (hello != null) return { kind: "HELLO", value: hello };

    const resp = extractHashParam(text, "RESP");
    if (resp != null) return { kind: "RESP", value: resp };

    const comb = extractHashParam(text, "COMB");
    if (comb != null) return { kind: "COMB", value: comb };

    return { kind: "UNKNOWN", value: null };
  }

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

  async function processScannedResponse(text, opts) {
    opts = opts || {};
    const nowMs = opts.nowMs ?? Date.now();
    const maxAgeMs = opts.maxAgeMs ?? 60000;
    const maxDistM = opts.maxDistM ?? 2;

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

    assert(sameSlimJwk(resp.payload.pub, resp.pub), "RESP: payload.pub does not match outer pub.");

    const recomputed = await window.hashPayloadToB64url(resp.payload);
    assert(recomputed === resp.hash, "RESP: hash mismatch.");

    const okSig = await window.verifySig(resp.hash, resp.sig, resp.pub);
    assert(okSig, "RESP: signature invalid.");

    const ts = Number(resp.payload.ts);
    assert(Number.isFinite(ts), "RESP: invalid ts.");
    const ageMs = Math.abs(nowMs - ts);
    assert(ageMs <= maxAgeMs, "RESP: timestamp outside window (" + ageMs + "ms).");

    const myGeo = await getGeoOnce(opts.geo || {});
    const distM = haversineMeters(myGeo.lat, myGeo.lon, Number(resp.payload.lat), Number(resp.payload.lon));
    assert(distM <= maxDistM, "RESP: distance too far (" + distM.toFixed(2) + "m).");

    return { ok: true, resp, ageMs, distM };
  }

  // Export globals
  window.makeQR = makeQR;
  window.irlidClassifyText = irlidClassifyText;
  window.makeReturnForHelloAsync = makeReturnForHelloAsync;
  window.processScannedResponse = processScannedResponse;

})();
