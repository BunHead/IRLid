// Local QR generation (no remote API)
// Improves contrast, quiet zone, and webcam scannability

(function () {
  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  window.makeQR = function makeQR(elId, data, size = 320) {
    const el = document.getElementById(elId);
    clear(el);

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";

    QRCode.toCanvas(canvas, data, {
      errorCorrectionLevel: "Q",
      margin: 4,
      width: size,
      color: { dark: "#000", light: "#fff" }
    }, err => {
      if (err) el.textContent = err.message;
      else el.appendChild(canvas);
    });
  };
})();
