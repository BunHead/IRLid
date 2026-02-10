// js/qr.js
// Robust QR rendering:
// 1) Prefer local canvas (QRCode library) for high contrast + quiet zone
// 2) Fallback to remote QR image API if QRCode library didn't load
// Also keeps scanQR() helper.

(function () {
  "use strict";

  function elById(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`qr.js: element not found: ${id}`);
    return el;
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function makeRemoteImg(data, size) {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
    const img = document.createElement("img");
    img.alt = "QR";
    img.src = url;
    img.style.width = size + "px";
    img.style.height = size + "px";
    img.style.imageRendering = "pixelated";
    return img;
  }

  window.makeQR = function makeQR(elId, data, size = 320) {
    const el = elById(elId);
    clear(el);

    // Prefer local QRCode canvas if available
    if (typeof window.QRCode !== "undefined" && typeof window.QRCode.toCanvas === "function") {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      canvas.style.width = size + "px";
      canvas.style.height = size + "px";
      canvas.style.imageRendering = "pixelated";

      // Q: good balance between robustness and density.
      const opts = {
        errorCorrectionLevel: "Q",
        margin: 4,      // quiet zone
        width: size,
        color: { dark: "#000000", light: "#ffffff" }
      };

      window.QRCode.toCanvas(canvas, data, opts, (err) => {
        if (err) {
          // If local generator fails for any reason, fallback to remote API.
          el.appendChild(makeRemoteImg(data, size));
          return;
        }
        el.appendChild(canvas);
      });

      return;
    }

    // Fallback: remote image API
    el.appendChild(makeRemoteImg(data, size));
  };

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
          fps: 10,
          qrbox: { width: 280, height: 280 },
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
