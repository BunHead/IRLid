// /js/qr.js
// Deploy 27
// QR rendering tuned for weak cameras / webcams:
// - errorCorrectionLevel: "L" (lowest density)
// - larger quiet zone (margin)
// - remote image fallback uses same settings
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
    const margin = 12;
    const url = `https://api.qrserver.com/v1/create-qr-code/?ecc=L&margin=${margin}&size=${size}x${size}&data=${encodeURIComponent(
      data
    )}`;
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

    const margin = 12;

    if (typeof window.QRCode !== "undefined" && typeof window.QRCode.toCanvas === "function") {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      canvas.style.width = size + "px";
      canvas.style.height = size + "px";
      canvas.style.imageRendering = "pixelated";

      const opts = {
        errorCorrectionLevel: "L",
        margin,
        width: size,
        color: { dark: "#000000", light: "#ffffff" }
      };

      window.QRCode.toCanvas(canvas, data, opts, (err) => {
        if (err) {
          el.appendChild(makeRemoteImg(data, size));
          return;
        }
        el.appendChild(canvas);
      });

      return;
    }

    el.appendChild(makeRemoteImg(data, size));
  };

  // NOTE: application.html currently uses Html5Qrcode directly.
  // scanQR is still provided for other pages/flows that might call it.
  window.scanQR = function scanQR(targetElId) {
    return new Promise(async (resolve, reject) => {
      if (typeof Html5Qrcode === "undefined") {
        reject(new Error("Html5Qrcode not loaded."));
        return;
      }

      const qr = new Html5Qrcode(targetElId);

      const config = {
        fps: 12,
        qrbox: { width: 320, height: 320 },
        disableFlip: false,
        videoConstraints: {
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      const onScanSuccess = async (text) => {
        try { await qr.stop(); } catch {}
        try { await qr.clear(); } catch {}
        resolve(text);
      };

      try {
        // Best effort: choose a real camera id string (rear often last; labels help when available).
        let camId = null;
        if (typeof Html5Qrcode.getCameras === "function") {
          const cams = await Html5Qrcode.getCameras().catch(() => []);
          if (cams && cams.length) {
            const score = (label) => {
              const s = (label || "").toLowerCase();
              let sc = 0;
              if (s.includes("back")) sc += 80;
              if (s.includes("rear")) sc += 80;
              if (s.includes("environment")) sc += 80;
              if (s.includes("front")) sc -= 120;
              if (s.includes("selfie")) sc -= 120;
              return sc;
            };
            const ranked = cams
              .map((c, i) => ({ id: c.id, label: c.label || "", i, sc: score(c.label || "") }))
              .sort((a,b) => (b.sc !== a.sc ? b.sc - a.sc : b.i - a.i));
            camId = (ranked[0] && ranked[0].sc > 0) ? ranked[0].id : cams[cams.length - 1].id;
          }
        }

        if (camId) {
          await qr.start(camId, config, onScanSuccess, () => {});
          return;
        }

        // Fallback
        await qr.start({ facingMode: "environment" }, config, onScanSuccess, () => {});
      } catch (err) {
        reject(err);
      }
    });
  };
})();
