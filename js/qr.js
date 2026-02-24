// IRLid QR helpers
// Deploy 49 — QR readability: NO CSS scaling, larger quiet zone, errorCorrectionLevel "L"
//
// Exposes (globals):
//   - makeQR(targetElOrId, text, sizePx?)
//   - irlidClassifyText(text) -> { kind: "HELLO"|"RESP"|"COMB"|"UNKNOWN", value: string|null }
//   - makeReturnForHelloAsync(hello) -> Promise<urlString>   (legacy; application.html may wrap)
//   - processScannedResponse(text, opts?) -> Promise<{ ok:true, resp, ageMs, distM }>
//
// Dependencies:
//   - QR renderer: window.QRCode.toCanvas (qrcode library)
//   - Signing: js/sign.js providing getPublicJwk, hashPayloadToB64url, signHashB64url, verifySig

(function () {
  "use strict";

  function assert(cond, msg) { if (!cond) throw new Error(msg); }
  function isString(x) { return typeof x === "string" || x instanceof String; }

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

  // ---------------------------
  // QR rendering (scanner-first)
  // ---------------------------
  function makeQR(target, text, sizePx) {
    assert(window.QRCode && typeof window.QRCode.toCanvas === "function",
      "QRCode library missing: expected window.QRCode.toCanvas.");

    // Choose a big, stable size. Bigger is easier to scan.
    const outerPx = Math.max(320, Math.min(720, (sizePx | 0) || 520));

    // Quiet zone: >= 24px or 8% of size (whichever larger)
    const qz = Math.max(24, Math.floor(outerPx * 0.08));

    const innerPx = Math.max(160, outerPx - 2 * qz);

    let host = target;
    if (isString(target)) {
      host = document.getElementById(String(target));
      assert(host, "makeQR: target element not found: " + target);
    }
    assert(host && host.nodeType === 1, "makeQR: invalid target element.");

    // Host resets
    if (host.tagName && host.tagName.toLowerCase() === "canvas") {
      // ok
    } else {
      host.innerHTML = "";
    }

    // Outer (final) canvas
    const canvas = (host.tagName && host.tagName.toLowerCase() === "canvas")
      ? host
      : document.createElement("canvas");

    if (canvas !== host) host.appendChild(canvas);

    // CRITICAL: lock pixel size and DO NOT allow CSS scaling.
    canvas.width = outerPx;
    canvas.height = outerPx;
    canvas.style.width = outerPx + "px";
    canvas.style.height = outerPx + "px";
    canvas.style.display = "block";
    canvas.style.margin = "0 auto";
    canvas.style.imageRendering = "pixelated";

    // Host wrapper: allow horizontal scroll instead of scaling
    host.style.background = "#fff";
    host.style.display = "block";
    host.style.overflowX = "auto";
    host.style.padding = "0";
    host.style.maxWidth = "100%";

    // Render QR onto an offscreen inner canvas
    const tmp = document.createElement("canvas");
    tmp.width = innerPx;
    tmp.height = innerPx;

    // Use LOW error correction per your requirement (less dense, easier scan)
    window.QRCode.toCanvas(
      tmp,
      String(text).trim(),
      { width: innerPx, margin: 2, errorCorrectionLevel: "L" },
      function (err) {
        if (err) throw err;

        const ctx = canvas.getContext("2d");
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;

        // White quiet zone
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, outerPx, outerPx);

        // Draw inner QR
        ctx.drawImage(tmp, qz, qz, innerPx, innerPx);
        ctx.restore();
      }
    );
  }

  // ---------------------------
  // Classifier
  // ---------------------------
  function irlidClassifyText(text) {
    const hello = extractHashParam(text, "HELLO");
    if (hello != null) return { kind: "HELLO", value: hello };

    const resp = extractHashParam(text, "RESP");
    if (resp != null) return { kind: "RESP", value: resp };

    const comb = extractHashParam(text, "COMB");
    if (comb != null) return { kind: "COMB", value: comb };

    return { kind: "UNKNOWN", value: null };
  }

  // ---------------------------
  // Legacy functions (unchanged stubs)
  // NOTE: These are still present to avoid breaking existing pages.
  // ---------------------------
  async function makeReturnForHelloAsync() {
    throw new Error("makeReturnForHelloAsync not implemented in this build. Use application.html flow.");
  }

  async function processScannedResponse() {
    throw new Error("processScannedResponse not implemented in this build. Use application.html flow.");
  }

  // Export
  window.makeQR = makeQR;
  window.irlidClassifyText = irlidClassifyText;
  window.makeReturnForHelloAsync = makeReturnForHelloAsync;
  window.processScannedResponse = processScannedResponse;

})();
