// docs/rules.md R9: "Face witness (v5.x) is off unless both people say yes,
// every time. If either says no, the handshake still works with a lower score."
//
// Face witness is not built yet (features.html / roadmap.html say "planned").
// Until it ships with a two-sided consent step, no page may keep or send a
// camera frame, and no signed payload or Worker may carry a face field. When
// face witness is built, replace these guards with real consent tests.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const pages = readdirSync(root).filter(f => f.endsWith(".html"));
const scripts = readdirSync(new URL("js/", root)).filter(f => f.endsWith(".js")).map(f => "js/" + f);
const FACE_FIELD = /\b(face_hash|faceHash|face_witness|faceWitness|photo_hash|photoHash|witness_hash)\b/;

test("R9: no page or script turns a camera frame into a saved image", () => {
  // A camera frame reaches a canvas via drawImage(<video>...). Reading pixels
  // for QR decoding (getImageData + jsQR) is fine; exporting the canvas as an
  // image (toDataURL / toBlob) or ImageCapture.takePhoto is not, until face
  // witness ships with both people's yes.
  const hits = [];
  for (const f of [...pages, ...scripts]) {
    const lines = read(f).split("\n");
    lines.forEach((line, i) => {
      if (/new\s+ImageCapture\b|\.takePhoto\s*\(/.test(line)) hits.push(`${f}:${i + 1}: ${line.trim()}`);
      if (!/drawImage\(\s*[\w.]*(video|cam)\w*/i.test(line)) return;
      const after = lines.slice(i, i + 40).join("\n");
      if (/\.(toDataURL|toBlob)\s*\(/.test(after)) hits.push(`${f}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(hits, [], "a camera frame is exported as an image");
});

test("R9: no signed payload or Worker carries a face field", () => {
  const files = [...pages, ...scripts, "irlid-api/src/index.js", "irlid-api-org/src/index.js"];
  const hits = files.filter(f => FACE_FIELD.test(read(f)));
  assert.deepEqual(hits, []);
});
