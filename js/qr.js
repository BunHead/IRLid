// /js/qr.js — Deploy 57
// Robust QR rendering for GitHub Pages:
// - Tries to load QR library from multiple CDNs (no local qrcode.min.js required)
// - Uses QRCode.toCanvas when available
// - Falls back to remote PNG QR image if library is unavailable or render fails
// - Renders crisp on HiDPI to avoid “vibrate but no link” decode failures
//
// Exposes:
//   window.makeQR(elId, data, sizePx)
//   window.scanQR(targetElId)  (unchanged; requires Html5Qrcode elsewhere)

(function () {
  "use strict";

  function elById(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error("qr.js: element not found: " + id);
    return el;
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.onload = () => resolve(url);
      s.onerror = () => reject(new Error("Failed to load: " + url));
      document.head.appendChild(s);
    });
  }

  async function ensureQrLib() {
    if (window.QRCode && typeof window.QRCode.toCanvas === "function") return true;

    const cdns = [
      "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js",
      "https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.3/qrcode.min.js"
    ];

    for (const url of cdns) {
      try {
        await loadScript(url);
        if (window.QRCode && typeof window.QRCode.toCanvas === "function") return true;
      } catch (_) {
        // try next
      }
    }
    return false;
  }

  function makeRemoteImg(data, sizeCssPx) {
    // Keep your original remote fallback idea, but make it bigger and with margin.
    // NOTE: If your network blocks this domain, we still attempt it as a last resort.
    const px = Math.max(240, Math.floor(sizeCssPx));
    const url =
      "https://api.qrserver.com/v1/create-qr-code/" +
      "?ecc=L&margin=10&size=" + px + "x" + px +
      "&data=" + encodeURIComponent(String(data));

    const img = document.createElement("img");
    img.alt = "QR";
    img.src = url;
    img.style.width = px + "px";
    img.style.height = px + "px";
    img.style.imageRendering = "pixelated";
    img.decoding = "async";
    img.loading = "eager";
    return img;
  }

  function makeCanvasHiDpi(sizeCssPx) {
    const css = Math.max(220, Math.floor(sizeCssPx));
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const px = Math.floor(css * dpr);

    const canvas = document.createElement("canvas");
    canvas.width = px;
    canvas.height = px;

    canvas.style.width = css + "px";
    canvas.style.height = css + "px";
    canvas.style.imageRendering = "pixelated";
    canvas.style.display = "block";
    canvas.style.margin = "0 auto";

    return { canvas, css, px, dpr };
  }

  window.makeQR = async function makeQR(elId, data, size = 320) {
    const el = elById(elId);
    clear(el);

    // Never let CSS rescale the canvas; scroll instead.
    el.style.overflowX = "auto";
    el.style.maxWidth = "100%";

    const ok = await ensureQrLib();

    if (ok && window.QRCode && typeof window.QRCode.toCanvas === "function") {
      const { canvas, px } = makeCanvasHiDpi(size);

      // Lowest density + generous quiet zone
      const opts = {
        errorCorrectionLevel: "L",
        margin: 10,
        width: px,
        color: { dark: "#000000", light: "#ffffff" }
      };

      try {
        window.QRCode.toCanvas(canvas, String(data), opts, (err) => {
          if (err) {
            clear(el);
            el.appendChild(makeRemoteImg(data, size));
            return;
          }
          el.appendChild(canvas);
        });
        return;
      } catch (_) {
        // fall through to remote
      }
    }

    // Final fallback
    el.appendChild(makeRemoteImg(data, size));
  };

  // Keep existing scan helper (unchanged)
  window.scanQR = function scanQR(targetElId) {
    return new Promise((resolve, reject) => {
      if (typeof Html5Qrcode === "undefined") {
        reject(new Error("Html5Qrcode not loaded."));
        return;
      }

      const qr = new Html5Qrcode(targetElId);

      qr.start(
        { facingMode: "environment" },
        {
          fps: 12,
          qrbox: { width: 320, height: 320 },
          disableFlip: false,
          videoConstraints: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          }
        },
        async (text) => {
          try { await qr.stop(); } catch {}
          try { await qr.clear(); } catch {}
          resolve(text);
        },
        () => {}
      ).catch(err => reject(err));
    });
  };
})();
