// js/sign.js
// IRLid signing + verify + combine (ECDSA P-256)
// Includes QR payload compression helpers (deflate) + COMB-Lite v3
// Deploy 72

(function () {
  "use strict";

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

  // -----------------------------
  // Base64url helpers
  // -----------------------------
  function b64urlEncode(bytes) {
    const b64 = btoa(String.fromCharCode(...bytes));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function b64urlDecode(str) {
    str = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    const bin = atob(str);
    return Uint8Array.from(bin, c => c.charCodeAt(0));
  }

  async function sha256Bytes(str) {
    const enc = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest("SHA-256", enc);
    return new Uint8Array(hash);
  }

  // =========================================================
  // QR payload compression (deflate) with prefix tags
  // =========================================================
  async function irlidCompressDeflate(bytes) {
    if (typeof CompressionStream === "undefined") return null;
    try {
      const cs = new CompressionStream("deflate");
      const writer = cs.writable.getWriter();
      await writer.write(bytes);
      await writer.close();
      const ab = await new Response(cs.readable).arrayBuffer();
      return new Uint8Array(ab);
    } catch {
      return null;
    }
  }

  async function irlidDecompressDeflate(bytes) {
    if (typeof DecompressionStream === "undefined") return null;
    try {
      const ds = new DecompressionStream("deflate");
      const writer = ds.writable.getWriter();
      await writer.write(bytes);
      await writer.close();
      const ab = await new Response(ds.readable).arrayBuffer();
      return new Uint8Array(ab);
    } catch {
      return null;
    }
  }

  /**
   * QR-safe encoding:
   *   "Z" + b64url(deflate(JSONbytes))  (preferred when smaller)
   *   "J" + b64url(JSONbytes)           (fallback)
   * Also decodes legacy plain b64url(JSONbytes) without prefix.
   */
  async function irlidEncodeForQR(obj) {
    const json = JSON.stringify(obj);
    const raw = new TextEncoder().encode(json);

    const deflated = await irlidCompressDeflate(raw);
    if (deflated && deflated.length) {
      const z = b64urlEncode(deflated);
      const j = b64urlEncode(raw);
      if (z.length + 1 < j.length + 1) return "Z" + z;
    }
    return "J" + b64urlEncode(raw);
  }

  async function irlidDecodeFromQR(str) {
    const s = String(str || "");
    if (!s) throw new Error("Empty QR payload.");

    const prefix = s[0];
    const body = s.slice(1);

    if (prefix === "Z") {
      const comp = b64urlDecode(body);
      const raw = await irlidDecompressDeflate(comp);
      if (!raw) throw new Error("Cannot decompress payload on this browser.");
      return JSON.parse(new TextDecoder().decode(raw));
    }

    if (prefix === "J") {
      const raw = b64urlDecode(body);
      return JSON.parse(new TextDecoder().decode(raw));
    }

    // legacy: no prefix
    const raw = b64urlDecode(s);
    return JSON.parse(new TextDecoder().decode(raw));
  }

  // Legacy JSON b64 helpers (HELLO remains legacy)
  function irlidEncodeJsonToB64url(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    return b64urlEncode(bytes);
  }
  function irlidDecodeB64urlJson(b64url) {
    const bytes = b64urlDecode(String(b64url || ""));
    const txt = new TextDecoder().decode(bytes);
    return JSON.parse(txt);
  }

  // =========================================================
  // Key management
  // =========================================================
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

    // cache SPKI for compact QR payloads
    try {
      const spkiBuf = await crypto.subtle.exportKey("spki", kp.publicKey);
      localStorage.setItem("irlid_pub_spki_b64", b64urlEncode(new Uint8Array(spkiBuf)));
    } catch {}
  }

  // ✅ index.html depends on this
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

  async function importPublicKeyJwk(pubJwk) {
    return crypto.subtle.importKey(
      "jwk",
      pubJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["verify"]
    );
  }

  async function importPublicKeySpkiB64(spkiB64url) {
    const spkiBytes = b64urlDecode(spkiB64url);
    return crypto.subtle.importKey(
      "spki",
      spkiBytes,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["verify"]
    );
  }

  async function getPublicSpkiB64url() {
    await ensureKeys();
    const cached = localStorage.getItem("irlid_pub_spki_b64");
    if (cached && cached.trim()) return cached.trim();

    const pubJwk = await getPublicJwk();
    const pubKey = await importPublicKeyJwk(pubJwk);
    const spkiBuf = await crypto.subtle.exportKey("spki", pubKey);
    const spkiB64 = b64urlEncode(new Uint8Array(spkiBuf));
    try { localStorage.setItem("irlid_pub_spki_b64", spkiB64); } catch {}
    return spkiB64;
  }

  async function jwkToSpkiB64url(pubJwk) {
    const pubKey = await importPublicKeyJwk(pubJwk);
    const spkiBuf = await crypto.subtle.exportKey("spki", pubKey);
    return b64urlEncode(new Uint8Array(spkiBuf));
  }

  async function verifySigFlexible(midB64url, sigB64url, pubAny) {
    const midBytes = b64urlDecode(midB64url);
    const sigBytes = b64urlDecode(sigB64url);

    let pubKey;
    if (typeof pubAny === "string") {
      pubKey = await importPublicKeySpkiB64(pubAny);
    } else if (pubAny && typeof pubAny === "object" && typeof pubAny.spki === "string") {
      pubKey = await importPublicKeySpkiB64(pubAny.spki);
    } else {
      pubKey = await importPublicKeyJwk(pubAny);
    }

    return crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pubKey,
      sigBytes,
      midBytes
    );
  }

  // =========================================================
  // Hashing + signing
  // =========================================================
  async function hashPayloadToB64url(payloadObj) {
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payloadObj));
    const hashBuf = await crypto.subtle.digest("SHA-256", payloadBytes);
    return b64urlEncode(new Uint8Array(hashBuf));
  }

  async function signHashB64url(hashB64url) {
    const priv = await getPrivateKey();
    const hashBytes = b64urlDecode(hashB64url);
    const sig = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      priv,
      hashBytes
    );
    return b64urlEncode(new Uint8Array(sig));
  }

  // =========================================================
  // Geo + time
  // =========================================================
  function irlidHaversineMeters(a, b) {
    const R = 6371000;
    const toRad = (d) => d * Math.PI / 180;
    const lat1 = toRad(a.lat), lon1 = toRad(a.lon);
    const lat2 = toRad(b.lat), lon2 = toRad(b.lon);
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    const s =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    return R * c;
  }

  function irlidGetPosition(opts) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation unavailable."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, (err) => {
        reject(new Error(err && err.message ? err.message : "Geolocation error."));
      }, opts);
    });
  }

  // =========================================================
  // HELLO v2 (legacy, unchanged)
  // =========================================================
  async function makeSignedHelloAsync() {
    const pos = await irlidGetPosition({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 12000
    });

    const lat = Number(pos.coords.latitude);
    const lon = Number(pos.coords.longitude);
    const acc = Number(pos.coords.accuracy || 0);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error("Invalid geolocation coordinates.");
    }

    const ts = Math.floor(Date.now() / 1000);
    const nonceA = crypto.getRandomValues(new Uint32Array(1))[0];

    const offerPayload = {
      v: 1,
      type: "offerPayload",
      lat,
      lon,
      acc,
      ts,
      nonce: nonceA
    };

    const pub = await getPublicJwk();
    const offerHash = await hashPayloadToB64url(offerPayload);
    const offerSig = await signHashB64url(offerHash);

    return {
      v: 2,
      type: "hello",
      pub,
      nonce: nonceA,
      ts,
      offer: {
        payload: offerPayload,
        hash: offerHash,
        sig: offerSig
      }
    };
  }

  async function irlidHelloHashB64url(helloObj) {
    const bytes = new TextEncoder().encode(JSON.stringify(helloObj));
    const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
    return b64urlEncode(new Uint8Array(hashBuf));
  }

  async function verifyHelloOfferAsync(helloObj, opts) {
    const tsTolS = (opts && Number.isFinite(opts.tsTolS)) ? opts.tsTolS : 90;

    if (!helloObj || helloObj.type !== "hello") throw new Error("Invalid HELLO.");
    if (!helloObj.pub) throw new Error("Invalid HELLO (missing pub).");

    if (!helloObj.offer) return { ok: true, mode: "unsigned-v1", offerHash: null };

    const offer = helloObj.offer;
    if (!offer || !offer.payload || !offer.hash || !offer.sig) {
      throw new Error("Invalid HELLO (bad offer structure).");
    }

    const computed = await hashPayloadToB64url(offer.payload);
    if (computed !== offer.hash) throw new Error("HELLO offer hash mismatch.");

    const sigOk = await verifySigFlexible(offer.hash, offer.sig, helloObj.pub);
    if (!sigOk) throw new Error("HELLO offer signature invalid.");

    const now = Math.floor(Date.now() / 1000);
    const ts = Number(offer.payload.ts);
    if (!Number.isFinite(ts)) throw new Error("HELLO offer timestamp missing.");
    const dt = Math.abs(now - ts);
    if (dt > tsTolS) throw new Error("HELLO offer timestamp outside tolerance (" + dt + "s > " + tsTolS + "s).");

    return { ok: true, mode: "signed-v2", offerHash: offer.hash };
  }

  // =========================================================
  // COMB-Lite v3
  // =========================================================
  function irlidIsRespV3(obj) {
    return !!(obj && obj.v === 3 && typeof obj.pk === "string" && obj.pl && typeof obj.s === "string");
  }

  async function irlidHelloLiteFromHelloAsync(helloObj) {
    if (!helloObj || helloObj.type !== "hello" || !helloObj.pub) throw new Error("Invalid HELLO.");

    const pk = await jwkToSpkiB64url(helloObj.pub);

    if (helloObj.offer && helloObj.offer.payload && helloObj.offer.sig) {
      return { v: 3, pk, off: { pl: helloObj.offer.payload, s: helloObj.offer.sig } };
    }

    const lite = { v: 3, pk, u: 1 };
    if (Number.isFinite(Number(helloObj.ts))) lite.ts = Number(helloObj.ts);
    if (Number.isFinite(Number(helloObj.nonce))) lite.n = Number(helloObj.nonce);
    return lite;
  }

  async function irlidHelloHashV3FromHelloLiteAsync(helloLite) {
    const h = await sha256Bytes(JSON.stringify(helloLite));
    return b64urlEncode(h);
  }

  async function irlidHelloHashV3FromHelloAsync(helloObj) {
    const helloLite = await irlidHelloLiteFromHelloAsync(helloObj);
    const hh = await irlidHelloHashV3FromHelloLiteAsync(helloLite);
    return { helloLite, hh };
  }

  function irlidCompactPayloadFromGpsTsNonce(binding) {
    const pl = { hh: binding.hh, la: binding.lat, lo: binding.lon, ac: binding.acc, t: binding.ts, n: binding.nonce };
    if (binding.oh) pl.oh = binding.oh;
    return pl;
  }

  // =========================================================
  // Make RESP v3 (Accept)
  // =========================================================
  async function makeReturnForHelloAsync(helloB64url, opts) {
    if (!helloB64url) throw new Error("HELLO missing.");

    const tsTolS = (opts && Number.isFinite(opts.tsTolS)) ? opts.tsTolS : 90;

    // HELLO still uses legacy encoding (plain b64url JSON)
    const helloObj = irlidDecodeB64urlJson(helloB64url);
    if (!helloObj || helloObj.type !== "hello" || !helloObj.pub) {
      throw new Error("Invalid HELLO (bad structure).");
    }

    const offerInfo = await verifyHelloOfferAsync(helloObj, { tsTolS });
    const { helloLite, hh } = await irlidHelloHashV3FromHelloAsync(helloObj);

    const pos = await irlidGetPosition({ enableHighAccuracy: true, maximumAge: 0, timeout: 12000 });
    const lat = Number(pos.coords.latitude);
    const lon = Number(pos.coords.longitude);
    const acc = Number(pos.coords.accuracy || 0);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("Invalid geolocation coordinates.");

    const ts = Math.floor(Date.now() / 1000);
    const nonceB = crypto.getRandomValues(new Uint32Array(1))[0];

    const pl = irlidCompactPayloadFromGpsTsNonce({
      hh,
      oh: offerInfo.offerHash || undefined,
      lat,
      lon,
      acc,
      ts,
      nonce: nonceB
    });

    const pk = await getPublicSpkiB64url();
    const h = await hashPayloadToB64url(pl);
    const s = await signHashB64url(h);

    const respV3 = { v: 3, pk, pl, s };
    window.__irlid_last_self_response = respV3;
    window.__irlid_last_hello_lite = helloLite;
    return respV3;
  }

  // =========================================================
  // Verify scanned response + build combined receipt
  // =========================================================
  async function processScannedResponse(otherRespObj, opts) {
    const helloB64url = opts && opts.hello ? opts.hello : null;
    const tsTolS = (opts && Number.isFinite(opts.tsTolS)) ? opts.tsTolS : 90;
    const distTolM = (opts && Number.isFinite(opts.distTolM)) ? opts.distTolM : 12;

    if (!helloB64url) throw new Error("HELLO missing for verification.");

    const helloObj = irlidDecodeB64urlJson(helloB64url);
    if (!helloObj || helloObj.type !== "hello") throw new Error("Invalid HELLO.");

    const offerInfo = await verifyHelloOfferAsync(helloObj, { tsTolS });
    const { helloLite, hh } = await irlidHelloHashV3FromHelloAsync(helloObj);

    const other = otherRespObj;
    if (!irlidIsRespV3(other) && !(other && other.type === "response")) {
      throw new Error("Invalid response (bad structure).");
    }

    const selfAny = window.__irlid_last_self_response || null;

    // --- Legacy v2 response support ---
    if (!irlidIsRespV3(other)) {
      if (!other.payload || !other.hash || !other.sig || !other.pub) throw new Error("Invalid response (bad structure).");

      const computed = await hashPayloadToB64url(other.payload);
      if (computed !== other.hash) throw new Error("Hash mismatch.");

      const sigOk = await verifySigFlexible(other.hash, other.sig, other.pub);
      if (!sigOk) throw new Error("Signature invalid.");

      const helloHashV2 = await irlidHelloHashB64url(helloObj);
      if (!other.payload.helloHash || other.payload.helloHash !== helloHashV2) throw new Error("HELLO binding mismatch.");
      if (offerInfo.offerHash) {
        if (!other.payload.offerHash || other.payload.offerHash !== offerInfo.offerHash) throw new Error("Offer binding mismatch.");
      }

      const now = Math.floor(Date.now() / 1000);
      const ts = Number(other.payload.ts);
      if (!Number.isFinite(ts)) throw new Error("Response timestamp missing.");
      if (Math.abs(now - ts) > tsTolS) throw new Error("Timestamp outside tolerance.");

      // distance check if self present
      if (selfAny && selfAny.payload) {
        const a = { lat: Number(selfAny.payload.lat), lon: Number(selfAny.payload.lon) };
        const b = { lat: Number(other.payload.lat), lon: Number(other.payload.lon) };
        if (Number.isFinite(a.lat) && Number.isFinite(a.lon) && Number.isFinite(b.lat) && Number.isFinite(b.lon)) {
          const d = irlidHaversineMeters(a, b);
          if (d > distTolM) throw new Error("Distance outside tolerance (" + Math.round(d) + "m > " + distTolM + "m).");
        }
      }

      const combinedV2 = {
        v: 2,
        type: "combined",
        tol: { dist_m: distTolM, ts_s: tsTolS },
        hello: helloObj,
        a: (selfAny && selfAny.type === "response") ? selfAny : null,
        b: other
      };

      return { self: selfAny, other, combined: combinedV2 };
    }

    // --- RESP v3 ---
    const otherPayload = other.pl;
    const computedOtherHash = await hashPayloadToB64url(otherPayload);
    const sigOk = await verifySigFlexible(computedOtherHash, other.s, other.pk);
    if (!sigOk) throw new Error("Signature invalid.");

    if (!otherPayload.hh || otherPayload.hh !== hh) throw new Error("HELLO binding mismatch.");
    if (offerInfo.offerHash) {
      if (!otherPayload.oh || otherPayload.oh !== offerInfo.offerHash) throw new Error("Offer binding mismatch.");
    }

    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(otherPayload.t)) throw new Error("Response timestamp missing.");
    if (Math.abs(now - Number(otherPayload.t)) > tsTolS) throw new Error("Timestamp outside tolerance.");

    // distance check if self present
    if (selfAny && irlidIsRespV3(selfAny)) {
      const a = { lat: Number(selfAny.pl.la), lon: Number(selfAny.pl.lo) };
      const b = { lat: Number(otherPayload.la), lon: Number(otherPayload.lo) };
      if (Number.isFinite(a.lat) && Number.isFinite(a.lon) && Number.isFinite(b.lat) && Number.isFinite(b.lon)) {
        const d = irlidHaversineMeters(a, b);
        if (d > distTolM) throw new Error("Distance outside tolerance (" + Math.round(d) + "m > " + distTolM + "m).");
      }
    }

    const combined = {
      v: 3,
      t: "c",
      tol: { d: distTolM, s: tsTolS },
      h: helloLite,
      a: selfAny,
      b: other
    };

    return { self: selfAny, other, combined };
  }

  // =========================================================
  // Export globals explicitly (fixes ReferenceErrors)
  // =========================================================
  Object.assign(window, {
    // QR encoding helpers
    irlidEncodeForQR,
    irlidDecodeFromQR,

    // key helpers used by index.html
    ensureKeys,
    getPublicJwk,

    // legacy helpers used elsewhere
    irlidEncodeJsonToB64url,
    irlidDecodeB64urlJson,

    // crypto + protocol
    makeSignedHelloAsync,
    makeReturnForHelloAsync,
    verifyHelloOfferAsync,
    processScannedResponse,

    // verify helpers used by receipt.html
    hashPayloadToB64url,
    verifySigFlexible,
    irlidHelloHashV3FromHelloLiteAsync
  });
})();
