/* /js/qr.js
   IRLid QR rendering pipeline (redesigned for scan reliability)
   - Multi-CDN loader for `QRCode` (soldair/node-qrcode-style API)
   - Uses `QRCode.toCanvas` when available
   - HiDPI crisp canvas with integer module sizing + generous quiet zone
   - Error correction level fixed to "L"
   - Fallback to api.qrserver.com if library unavailable or canvas render fails
   - Adds optional “tap to fullscreen” overlay for large / dense codes (no layout redesign required)
   Deploy71

   Public API (kept stable):
     makeQR(targetId, text, sizePx) -> Promise<void>

   Notes:
   - Does NOT depend on any framework/build tooling.
   - Safe to include on pages that already call makeQR().
*/

(function () {
  "use strict";

  // ------------------------------------------------------------
  // Config
  // ------------------------------------------------------------
  const ECC_LEVEL = "L";          // requirement
  const DEFAULT_SIZE = 360;       // if caller passes null/0
  const MAX_FULLSCREEN = 640;     // overlay QR max size
  const MIN_FULLSCREEN = 320;
  const QUIET_ZONE_MODULES = 8;   // larger than spec minimum to aid camera recognition
  const MAX_RENDER_RETRIES = 1;   // if render fails, try once with looser params then fallback image

  // Multi-CDN URLs for the QRCode library
  // We expect a global `QRCode` with .toCanvas and (optionally) .create
  const CDN_URLS = [
    "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js",
    "https://unpkg.com/qrcode@1.5.4/build/qrcode.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.4/qrcode.min.js"
  ];

  // ------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function isProbablyUrl(s) {
    try { new URL(s); return true; } catch { return false; }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function ensureTargetEl(targetId) {
    const el = (typeof targetId === "string") ? document.getElementById(targetId) : targetId;
    if (!el) throw new Error("QR target not found: " + targetId);
    return el;
  }

  function clearEl(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function loadScriptOnce(url) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-irlid-qr="' + url + '"]');
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", () => reject(new Error("Script load failed: " + url)), { once: true });
        // If already loaded, resolve immediately
        if (existing.getAttribute("data-loaded") === "1") resolve();
        return;
      }
      const s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.defer = true;
      s.setAttribute("data-irlid-qr", url);
      s.onload = () => { s.setAttribute("data-loaded", "1"); resolve(); };
      s.onerror = () => reject(new Error("Script load failed: " + url));
      document.head.appendChild(s);
    });
  }

  async function ensureQRCodeLib() {
    if (window.QRCode && typeof window.QRCode.toCanvas === "function") return window.QRCode;

    let lastErr = null;
    for (const url of CDN_URLS) {
      try {
        await loadScriptOnce(url);
        if (window.QRCode && typeof window.QRCode.toCanvas === "function") return window.QRCode;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("QRCode library unavailable.");
  }

  // Try to estimate module count using QRCode.create if available.
  // If unavailable, we still render, but we won't be able to perfect integer module size.
  function tryGetModuleCount(QRCodeLib, text) {
    try {
      if (!QRCodeLib || typeof QRCodeLib.create !== "function") return null;
      // Margin does not affect module count; ECC and version do.
      const qr = QRCodeLib.create(text, { errorCorrectionLevel: ECC_LEVEL });
      const size = qr && qr.modules && typeof qr.modules.size === "number" ? qr.modules.size : null;
      return (size && size > 0) ? size : null;
    } catch {
      return null;
    }
  }

  // Compute a canvas pixel size that results in integer pixels per module.
  // totalModules = modules + 2*quietZoneModules
  function computeIntegerCanvasSize(modules, desiredCssSize, quietZoneModules) {
    if (!modules || modules <= 0) return { css: desiredCssSize, px: desiredCssSize };

    const total = modules + 2 * quietZoneModules;
    // Choose integer scale so css size is close to desired.
    const targetScale = Math.max(1, Math.round(desiredCssSize / total));
    const css = total * targetScale;
    return { css, px: css };
  }

  // Add click-to-fullscreen overlay for easier scanning.
  function attachFullscreen(el, text, preferredSize) {
    // Avoid double-binding
    if (el && el.__irlid_fs_bound) return;
    el.__irlid_fs_bound = true;

    // Only enable fullscreen if it looks like a URL or long payload (dense)
    const enable = (typeof text === "string" && (text.length > 600 || isProbablyUrl(text)));
    if (!enable) return;

    const handler = async (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      try {
        await showFullscreenQR(text, preferredSize);
      } catch {
        // ignore
      }
    };

    // Bind to container; canvas/img inside will bubble.
    el.style.cursor = "zoom-in";
    el.addEventListener("click", handler);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") handler(e);
    });
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", "Open QR fullscreen");
  }

  function ensureOverlay() {
    let overlay = document.getElementById("irlidQrOverlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "irlidQrOverlay";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "9999";
    overlay.style.display = "none";
    overlay.style.background = "rgba(0,0,0,0.72)";
    overlay.style.padding = "16px";
    overlay.style.boxSizing = "border-box";

    overlay.innerHTML = `
      <div id="irlidQrOverlayInner" style="
        position:absolute; inset:0;
        display:flex; align-items:center; justify-content:center;
        padding:16px; box-sizing:border-box;">
        <div style="
          background:#fff; border-radius:12px;
          padding:14px 14px 10px;
          max-width: 92vw; max-height: 92vh;
          box-sizing:border-box;
          display:flex; flex-direction:column; gap:10px;
          align-items:center;">
          <div style="width:100%; display:flex; justify-content:space-between; gap:10px; align-items:center;">
            <div style="font: 600 14px system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#111;">
              QR (tap outside to close)
            </div>
            <button id="irlidQrOverlayClose" type="button" style="
              appearance:none; border:1px solid #ddd; background:#fff;
              border-radius:10px; padding:6px 10px;
              font: 600 13px system-ui, -apple-system, Segoe UI, Roboto, Arial;
              cursor:pointer;">Close</button>
          </div>
          <div id="irlidQrOverlayBox" style="display:flex; align-items:center; justify-content:center;"></div>
          <div id="irlidQrOverlayHint" style="
            font: 12px system-ui, -apple-system, Segoe UI, Roboto, Arial;
            color:#444; text-align:center; max-width: 72ch;">
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector("#irlidQrOverlayClose");
    closeBtn.addEventListener("click", () => hideOverlay());

    overlay.addEventListener("click", (e) => {
      // close when clicking outside the white card
      const inner = overlay.querySelector("#irlidQrOverlayInner");
      if (e.target === overlay || e.target === inner) hideOverlay();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideOverlay();
    });

    return overlay;
  }

  function hideOverlay() {
    const overlay = document.getElementById("irlidQrOverlay");
    if (!overlay) return;
    overlay.style.display = "none";
    const box = overlay.querySelector("#irlidQrOverlayBox");
    if (box) box.innerHTML = "";
  }

  async function showFullscreenQR(text, preferredSize) {
    const overlay = ensureOverlay();
    const box = overlay.querySelector("#irlidQrOverlayBox");
    const hint = overlay.querySelector("#irlidQrOverlayHint");
    if (!box) return;

    box.innerHTML = "";
    overlay.style.display = "block";

    const size = clamp(
      Math.min(window.innerWidth, window.innerHeight) - 80,
      MIN_FULLSCREEN,
      MAX_FULLSCREEN
    );

    // Hint text
    hint.textContent = (text.length > 800)
      ? "Tip: hold steady and fill the scanner view. This receipt is data-dense."
      : "Tip: increase screen brightness for faster scanning.";

    // Render QR into overlay
    const tmp = document.createElement("div");
    box.appendChild(tmp);
    await renderQRInto(tmp, text, size, { fullscreen: true });
  }

  // ------------------------------------------------------------
  // Fallback image rendering (api.qrserver.com)
  // ------------------------------------------------------------
  function renderFallbackImage(container, text, sizeCss) {
    clearEl(container);
    const img = document.createElement("img");
    img.alt = "QR code";
    img.decoding = "async";
    img.loading = "eager";
    img.style.display = "block";
    img.style.margin = "0 auto";
    img.style.maxWidth = "100%";
    img.style.height = "auto";

    // Use large pixel size to aid scanning; QR server generates crisp raster.
    const px = Math.max(256, Math.min(1200, Math.floor(sizeCss * (window.devicePixelRatio || 1))));
    const url =
      "https://api.qrserver.com/v1/create-qr-code/" +
      "?size=" + px + "x" + px +
      "&ecc=" + encodeURIComponent(ECC_LEVEL) +
      "&margin=" + encodeURIComponent(QUIET_ZONE_MODULES) +
      "&data=" + encodeURIComponent(text);

    img.src = url;
    container.appendChild(img);
  }

  // ------------------------------------------------------------
  // Canvas rendering via QRCode.toCanvas
  // ------------------------------------------------------------
  async function renderQRInto(container, text, sizeCss, opts) {
    const QRCodeLib = await ensureQRCodeLib();
    clearEl(container);

    // Compute module count if possible to get integer pixels/module
    const modules = tryGetModuleCount(QRCodeLib, text);

    const desired = Math.max(220, Number(sizeCss) || DEFAULT_SIZE);
    const sizing = computeIntegerCanvasSize(modules, desired, QUIET_ZONE_MODULES);

    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1)); // cap DPR to avoid huge canvases
    const canvas = document.createElement("canvas");

    // CSS size (layout)
    canvas.style.width = sizing.css + "px";
    canvas.style.height = sizing.css + "px";
    canvas.style.display = "block";
    canvas.style.margin = "0 auto";

    // Physical pixels (crisp)
    canvas.width = Math.floor(sizing.px * dpr);
    canvas.height = Math.floor(sizing.px * dpr);

    // Ensure the QR library renders into full pixel grid
    const optionsBase = {
      errorCorrectionLevel: ECC_LEVEL,
      margin: QUIET_ZONE_MODULES,
      // qrcode library uses `scale` OR `width`. We set width to physical pixels.
      width: canvas.width,
      // Do not set colors; leave default (black on white) for best scanning
    };

    let lastErr = null;

    for (let attempt = 0; attempt <= MAX_RENDER_RETRIES; attempt++) {
      try {
        const options = Object.assign({}, optionsBase);

        // If first attempt fails (rare), reduce width to avoid memory or edge issues.
        if (attempt === 1) {
          const shrink = Math.max(256, Math.floor(canvas.width * 0.85));
          options.width = shrink;
        }

        await QRCodeLib.toCanvas(canvas, text, options);
        container.appendChild(canvas);

        // Optional fullscreen binding on container (not on overlay itself)
        if (!opts || !opts.fullscreen) attachFullscreen(container, text, sizing.css);

        return;
      } catch (e) {
        lastErr = e;
      }
    }

    // If canvas render fails, fallback image
    // (Still benefits from big margin & higher pixel size)
    renderFallbackImage(container, text, desired);
    if (!opts || !opts.fullscreen) attachFullscreen(container, text, desired);

    // Surface failure for debug console only
    if (lastErr) console.warn("QR canvas render failed; used fallback image.", lastErr);
  }

  // ------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------
  async function makeQR(targetId, text, sizePx) {
    const container = ensureTargetEl(targetId);
    const size = Number(sizePx) || DEFAULT_SIZE;

    // Improve odds by ensuring container background is white and not clipped
    try {
      const cs = getComputedStyle(container);
      if (!cs.backgroundColor || cs.backgroundColor === "rgba(0, 0, 0, 0)" || cs.backgroundColor === "transparent") {
        container.style.background = "#fff";
      }
      container.style.overflow = "visible"; // avoid clipping quiet zone
      container.style.display = "block";
    } catch {}

    // Render (canvas preferred; image fallback)
    try {
      await renderQRInto(container, String(text || ""), size, { fullscreen: false });
    } catch (e) {
      // If library load fails, fallback image
      renderFallbackImage(container, String(text || ""), size);
      attachFullscreen(container, String(text || ""), size);
      console.warn("QR render used fallback image:", e);
    }
  }

  // expose globally
  window.makeQR = makeQR;

})();
