// /js/qr.js
// Deploy 27
// QR rendering tuned for weak cameras / webcams:
// - errorCorrectionLevel: "L" (lowest density)
// - larger quiet zone (margin)
// - remote image fallback uses same settings
// Also keeps scanQR() helper.
//
// Rear-camera + dropdown fix:
// - Prefer passing a cameraId STRING to Html5Qrcode.start() (most reliable)
// - Provide globals to list cameras + set a preferred camera id
// - scanQR() uses preferred camera when set; otherwise auto-picks best rear

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

  // ----- Camera helpers -----

  // Preferred camera id set by UI (dropdown).
  // application.html can call window.IRLID_setPreferredCamera(id)
  let preferredCameraId = null;

  window.IRLID_setPreferredCamera = function IRLID_setPreferredCamera(id) {
    preferredCameraId = typeof id === "string" && id.trim() ? id.trim() : null;
    try {
      localStorage.setItem("irlid_preferred_camera_id", preferredCameraId || "");
    } catch {}
  };

  function loadPreferredFromStorage() {
    try {
      const v = localStorage.getItem("irlid_preferred_camera_id");
      if (v && v.trim()) preferredCameraId = v.trim();
    } catch {}
  }

  function scoreRearCameraLabel(label) {
    const s = (label || "").toLowerCase();

    let score = 0;
    if (s.includes("back")) score += 80;
    if (s.includes("rear")) score += 80;
    if (s.includes("environment")) score += 80;

    // Often indicates rear lenses
    if (s.includes("wide")) score += 20;
    if (s.includes("ultra")) score += 10;

    // De-prioritize obvious front/selfie cameras.
    if (s.includes("front")) score -= 120;
    if (s.includes("user")) score -= 60;
    if (s.includes("face")) score -= 60;
    if (s.includes("selfie")) score -= 120;

    return score;
  }

  async function getCamerasSafe() {
    if (typeof Html5Qrcode === "undefined" || typeof Html5Qrcode.getCameras !== "function") return [];
    try {
      const cams = await Html5Qrcode.getCameras();
      return Array.isArray(cams) ? cams : [];
    } catch {
      return [];
    }
  }

  // Expose to application.html to populate dropdown
  window.IRLID_listCameras = async function IRLID_listCameras() {
    const cams = await getCamerasSafe();
    return cams.map((c) => ({ id: c.id, label: c.label || "" }));
  };

  async function pickBestRearCameraId() {
    const cameras = await getCamerasSafe();
    if (!cameras.length) return null;

    const ranked = cameras
      .map((c, idx) => ({
        id: c.id,
        label: c.label || "",
        idx,
        score: scoreRearCameraLabel(c.label || "")
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        // Tie-break: rear often appears later
        return b.idx - a.idx;
      });

    const best = ranked[0];
    if (!best) return cameras[cameras.length - 1].id;

    // If labels are useless, take the last camera (often rear).
    if (best.score <= 0) return cameras[cameras.length - 1].id;

    return best.id;
  }

  function makeConfig() {
    // Keep constraints light; avoid combos that trigger “front” selection.
    return {
      fps: 12,
      qrbox: { width: 320, height: 320 },
      disableFlip: false,
      videoConstraints: {
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    };
  }

  // ----- Scanner -----

  window.scanQR = function scanQR(targetElId) {
    return new Promise(async (resolve, reject) => {
      if (typeof Html5Qrcode === "undefined") {
        reject(new Error("Html5Qrcode not loaded."));
        return;
      }

      loadPreferredFromStorage();

      const qr = new Html5Qrcode(targetElId);
      const config = makeConfig();

      const onScanSuccess = async (text) => {
        try {
          await qr.stop();
        } catch {}
        try {
          await qr.clear();
        } catch {}
        resolve(text);
      };

      const onScanFailure = () => {};

      // 1) If UI has selected a camera, use it as a STRING cameraId.
      if (preferredCameraId) {
        try {
          await qr.start(preferredCameraId, config, onScanSuccess, onScanFailure);
          return;
        } catch (errPreferred) {
          // If that fails, fall through to auto-pick rear
          // (this can happen if device ids change).
        }
      }

      // 2) Auto-pick best rear camera id and start with cameraId STRING.
      const bestRearId = await pickBestRearCameraId();
      if (bestRearId) {
        try {
          await qr.start(bestRearId, config, onScanSuccess, onScanFailure);
          return;
        } catch (errRear) {
          // Fall through to facingMode attempts
        }
      }

      // 3) Fallback: facingMode environment (some browsers only accept this)
      try {
        await qr.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure);
        return;
      } catch (errEnv) {}

      // 4) Last fallback: some iOS versions require exact (and some reject exact)
      // Try exact then ideal.
      try {
        await qr.start({ facingMode: { exact: "environment" } }, config, onScanSuccess, onScanFailure);
        return;
      } catch (errExact) {}

      try {
        await qr.start({ facingMode: { ideal: "environment" } }, config, onScanSuccess, onScanFailure);
        return;
      } catch (errFinal) {
        reject(errFinal);
      }
    });
  };
})();
