// IRLid QR helpers
// Deploy 39 (fix: ensure makeQR exists; restore Scan helpers)
// Requires: js/qrcode.min.js (window.QRCode.toCanvas)
// Requires: js/sign.js (getPublicJwk, hashPayloadToB64url, signHashB64url, verifySig)

(function () {
  "use strict";

  // ---------- tiny utils ----------
  function assert(cond, msg) {
    if (!cond) throw new Error(msg);
  }

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
    // per your protocol: slimmed to {kty, crv, x, y}
    return {
      kty: pubJwk.kty,
      crv: pubJwk.crv,
      x: pubJwk.x,
      y: pubJwk.y
    };
  }

  function isProbablyUrl(s) {
    return /^https?:\/\//i.test(s);
  }

  function extractHashParam(text, key) {
    // Supports:
    // - full URL ...#HELLO=...
    // - raw "HELLO=..."
    // - raw "#HELLO=..."
    const t = String(text || "").trim();

    if (!t) return null;

    // If URL, parse hash
    if (isProbablyUrl(t)) {
      try {
        const u = new URL(t);
        const h = (u.hash || "").replace(/^#/, "");
        if (!h) return null;
        const parts = h.split("&");
        for (const p of parts) {
          const [k, v] = p.split("=");
          if (k === key) return v || "";
        }
        return null;
      } catch {
        // fall through
      }
    }

    // Raw hash-ish
    const raw = t.startsWith("#") ? t.slice(1) : t;
    const parts = raw.split("&");
    for (const p of parts) {
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

    if (!navigator.geolocation) throw new Error("Geolocation unavailable.");

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

  // ---------- public API: makeQR ----------
  // makeQR(target, text, size)
  // - target: element id string OR element
  // - text: payload string
  // - size: px (optional)
  function makeQR(target, text, size) {
    assert(globalThis.QRCode && typeof globalThis.QRCode.toCanvas === "function",
      "QR library missing: expected window.QRCode.toCanvas (check js/qrcode.min.js).");

    const px = Math.max(160, Math.min(1024, (size | 0) || 360));

    let host = target;
    if (typeof target === "string") {
      host = document.getElementById(target);
      assert(host, "makeQR: target element not found: " + target);
    }
    assert(host && host.nodeType === 1, "makeQR: invalid target.");

    // Render into host: if host is not canvas, create one
    let canvas;
    if (host.tagName && host.tagName.toLowerCase() === "canvas") {
      canvas = host;
    } else {
      host.innerHTML = "";
      canvas = document.createElement("canvas");
      host.appendChild(canvas);
    }

    globalThis.QRCode.toCanvas(canvas, String(text), { width: px }, function (err) {
      if (err) throw err;
    });
  }

  // ---------- classify scanned text ----------
  // Returns: { kind: "HELLO"|"RESP"|"COMB"|"UNKNOWN", value: string|null }
  function irlidClassifyText(text) {
    const hello = extractHashParam(text, "HELLO");
    if (hello != null) return { kind: "HELLO", value: hello };

    const resp = extractHashParam(text, "RESP");
    if (resp != null) return { kind: "RESP", value: resp };

    const comb = extractHashParam(text, "COMB");
    if (comb != null) return { kind: "COMB", value: comb };

    return { kind: "UNKNOWN", value: null };
  }

  // ---------- make Return QR for HELLO ----------
  // Produces a URL pointing to application.html#RESP=...
  // Response object shape (per your protocol):
  // {
  //   type: "response",
  //   payload: { hello, ts, lat, lon, pub },
  //   hash,
  //   sig,
  //   pub
  // }
  async function makeReturnForHelloAsync(hello, opts) {
    opts = opts || {};

    assert(typeof globalThis.getPublicJwk === "function", "sign.js missing: getPublicJwk()");
    assert(typeof globalThis.hashPayloadToB64url === "function", "sign.js missing: hashPayloadToB64url(payload)");
    assert(typeof globalThis.signHashB64url === "function", "sign.js missing: signHashB64url(hashB64url)");

    const geo = await getGeoOnce(opts.geo || {});
    const pubFull = await globalThis.getPublicJwk();
    const pub = slimJwk(pubFull);

    const payload = {
      hello: String(hello),
      ts: Date.now(),
      lat: geo.lat,
      lon: geo.lon,
      pub
    };

    const hash = await globalThis.hashPayloadToB64url(payload);
    const sig = await globalThis.signHashB64url(hash);

    const respObj = {
      type: "response",
      payload,
      hash,
      sig,
      pub
    };

    const b64u = encodeJsonToB64url(respObj);

    const url = new URL("application.html", location.href);
    url.hash = "RESP=" + b64u;
    return url.toString();
  }

  // ---------- parse + validate scanned RESP ----------
  // Options:
  //  - nowMs (default Date.now())
  //  - maxAgeMs (default 60000)
  //  - requireGeo (default false)
  //  - geo: {lat, lon} OR if requireGeo true, will request geo
  //  - maxDistM (default 2)
  //
  // Returns:
  //  { ok:true, resp, ageMs, distM? } OR throws error
  async function processScannedResponse(text, opts) {
    opts = opts || {};
    const nowMs = opts.nowMs ?? Date.now();
    const maxAgeMs = opts.maxAgeMs ?? 60000;
    const maxDistM = opts.maxDistM ?? 2;
    const requireGeo = !!opts.requireGeo;

    assert(typeof globalThis.verifySig === "function", "sign.js missing: verifySig(midB64url, sigB64url, pubJwk)");
    assert(typeof globalThis.hashPayloadToB64url === "function", "sign.js missing: hashPayloadToB64url(payload)");

    const respB64u = extractHashParam(text, "RESP") || (irlidClassifyText(text).kind === "RESP" ? irlidClassifyText(text).value : null);
    assert(respB64u, "Not a RESP payload.");

    const resp = decodeJsonFromB64url(respB64u);

    assert(resp && resp.type === "response", "RESP: invalid type.");
    assert(resp.payload && typeof resp.payload === "object", "RESP: missing payload.");
    assert(resp.hash && typeof resp.hash === "string", "RESP: missing hash.");
    assert(resp.sig && typeof resp.sig === "string", "RESP: missing sig.");
    assert(resp.pub && typeof resp.pub === "object", "RESP: missing pub.");
    assert(resp.payload.pub && typeof resp.payload.pub === "object", "RESP: payload.pub missing.");

    // payload.pub matches outer pub
    const ppub = resp.payload.pub;
    const opub = resp.pub;
    const samePub =
      ppub.kty === opub.kty &&
      ppub.crv === opub.crv &&
      ppub.x === opub.x &&
      ppub.y === opub.y;
    assert(samePub, "RESP: payload.pub does not match outer pub.");

    // hash(payload) matches
    const recomputed = await globalThis.hashPayloadToB64url(resp.payload);
    assert(recomputed === resp.hash, "RESP: hash mismatch.");

    // signature verifies (ECDSA P-256)
    const okSig = await globalThis.verifySig(resp.hash, resp.sig, resp.pub);
    assert(okSig, "RESP: signature invalid.");

    // timestamps <= 60s
    const ts = Number(resp.payload.ts);
    assert(Number.isFinite(ts), "RESP: invalid ts.");
    const ageMs = Math.abs(nowMs - ts);
    assert(ageMs <= maxAgeMs, "RESP: timestamp too old/new (" + ageMs + "ms).");

    // distance <= 2m (optional here unless requireGeo enabled)
    let distM = null;
    if (requireGeo) {
      let geo = opts.geo;
      if (!geo || typeof geo.lat !== "number" || typeof geo.lon !== "number") {
        const g = await getGeoOnce(opts.geoOpts || {});
        geo = { lat: g.lat, lon: g.lon };
      }
      distM = haversineMeters(geo.lat, geo.lon, resp.payload.lat, resp.payload.lon);
      assert(distM <= maxDistM, "RESP: distance too far (" + distM.toFixed(2) + "m).");
    }

    return { ok: true, resp, ageMs, distM };
  }

  // ---------- expose globals (existing app expects these on window) ----------
  globalThis.makeQR = makeQR;
  globalThis.irlidClassifyText = irlidClassifyText;
  globalThis.makeReturnForHelloAsync = makeReturnForHelloAsync;
  globalThis.processScannedResponse = processScannedResponse;

})();
