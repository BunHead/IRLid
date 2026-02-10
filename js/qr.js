function makeQR(elId, data, size = 320) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
  document.getElementById(elId).innerHTML = `<img alt="QR" src="${url}">`;
}

function scanQR(targetElId) {
  return new Promise((resolve, reject) => {
    const qr = new Html5Qrcode(targetElId);

    qr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      (text) => {
        qr.stop().then(() => resolve(text));
      },
      () => {}
    ).catch(err => reject(err));
  });
}
