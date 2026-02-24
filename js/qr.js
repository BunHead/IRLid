// /js/qr.js
// Deploy 26
// QR rendering tuned for weak cameras / webcams:
// - errorCorrectionLevel: "L" (lowest density)
// - larger quiet zone (margin)
// - remote image fallback uses same settings
// Also keeps scanQR() helper.
//
// Rear-camera fix:
// - Prefer an actual rear camera deviceId via Html5Qrcode.getCameras()
// - Fall back to facingMode: "environment"
// - Avoid constraint combos that cause browsers to pick the front camera

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
    // Larger quiet zone helps cheap/older cameras lock on.
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

    // Larger quiet zone helps scanners more than most other tweaks.
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

  function scoreRearCameraLabel(label) {
    const s = (label || "").toLowerCase();

    // Strong signals (rear/back/environment) score high.
    let score = 0;
    if (s.includes("back")) score += 50;
    if (s.includes("rear")) score += 50;
    if (s.includes("environment")) score += 50;

    // Often indicates rear lenses
    if (s.includes("wide")) score += 15;
    if (s.includes("ultra")) score += 10;

    // De-prioritize obvious front/selfie cameras.
    if (s.includes("front")) score -= 80;
    if (s.includes("user")) score -= 40;
    if (s.includes("face")) score -= 40;
    if (s.includes("selfie")) score -= 80;

    return score;
  }

  async function pickBestCameraId() {
    if (typeof Html5Qrcode === "undefined" || typeof Html5Qrcode.getCameras !== "function") return null;

    let cameras = [];
    try {
      cameras = await Html5Qrcode.getCameras();
    } catch {
      return null;
    }

    if (!Array.isArray(cameras) || cameras.length === 0) return null;

    // Prefer the camera with the best “rear” label score.
    const ranked = cameras
      .map((c, idx) => ({
        id: c.id,
        label: c.label || "",
        idx,
        score: scoreRearCameraLabel(c.label || "")
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        // Tie-break: on many devices, the rear camera tends to appear later.
        return b.idx - a.idx;
      });

    // If all scores are terrible (e.g., labels hidden), pick the last camera.
    const best = ranked[0];
    if (!best) return cameras[cameras.length - 1].id;

    if (best.score <= 0) {
      return cameras[cameras.length - 1].id;
    }

    return best.id;
  }

  window.scanQR = function scanQR(targetElId) {
    return new Promise(async (resolve, reject) => {
      if (typeof Html5Qrcode === "undefined") {
        reject(new Error("Html5Qrcode not loaded."));
        return;
      }

      const qr = new Html5Qrcode(targetElId);

      // Config: keep scan box stable; use higher-res frames where possible.
      // IMPORTANT: We keep videoConstraints lightweight to avoid overriding the chosen camera.
      const config = {
        fps: 12,
        qrbox: { width: 320, height: 320 },
        disableFlip: false,
        // Keep only resolution-ish ideals here; do NOT put facingMode here because
        // some browsers treat it differently and can end up choosing the front camera.
        videoConstraints: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        }
      };

      // 1) Best effort: pick an actual rear camera id.
      let cameraChoice = null;
      try {
        const bestId = await pickBestCameraId();
        if (bestId) cameraChoice = { deviceId: { exact: bestId } };
      } catch {
        cameraChoice = null;
      }

      // 2) Fallback: facingMode environment.
      if (!cameraChoice) {
        cameraChoice = { facingMode: "environment" };
      }

      function cleanupAndResolve(text) {
        (async () => {
          try {
            await qr.stop();
          } catch {}
          try {
            await qr.clear();
          } catch {}
          resolve(text);
        })();
      }

      // Start, with an additional fallback retry path:
      // If deviceId exact fails (rare on some browsers), retry with facingMode.
      const onScanSuccess = async (text) => cleanupAndResolve(text);

      const onScanFailure = () => {};

      try {
        await qr.start(cameraChoice, config, onScanSuccess, onScanFailure);
      } catch (err1) {
        // If we tried deviceId exact and it failed, retry with facingMode.
        const triedDeviceId =
          cameraChoice && typeof cameraChoice === "object" && "deviceId" in cameraChoice;

        if (triedDeviceId) {
          try {
            await qr.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure);
            return;
          } catch (err2) {
            reject(err2);
            return;
          }
        }

        reject(err1);
      }
    });
  };
})();
