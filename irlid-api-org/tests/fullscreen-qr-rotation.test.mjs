// PR C (6 Nov 2026): live check-ins were landing as "offline / unverified"
// while the kiosk was online. Root cause: fullscreenQR() in Org.html drew the
// venue QR into the full screen clone (#v511FullscreenStage) once, when full
// screen opened, and renderVenueQR() only refreshed #venueQrBox and the inline
// clone. A kiosk left in full screen kept showing its first live code: after
// one scan (used) or 90 s (expired) every later scan carried a dead code and
// the Worker accepted it as offline (C14). These tests run the real Org.html
// functions in a VM with a small fake DOM and check the full screen QR follows
// every rotation (rules C9, C14; offline-first "Offline check-ins are visibly
// marked").
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const orgHtml = readFileSync(new URL("../../Org.html", import.meta.url), "utf8");
const sw = readFileSync(new URL("../../sw.js", import.meta.url), "utf8");

// Pull one top-level function's source out of Org.html by brace matching.
function extractFunction(name) {
  const start = orgHtml.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} not found in Org.html`);
  let i = orgHtml.indexOf("{", start);
  let depth = 0;
  for (; i < orgHtml.length; i += 1) {
    if (orgHtml[i] === "{") depth += 1;
    else if (orgHtml[i] === "}" && --depth === 0) break;
  }
  return orgHtml.slice(start, i + 1);
}

class FakeEl {
  constructor(id = "", className = "") {
    this.id = id; this.className = className; this.children = []; this.parentNode = null;
    this.dataset = {}; this._text = ""; this.qrText = null;
  }
  set innerHTML(v) { this.children = []; this.qrText = null; this._text = String(v); }
  get innerHTML() { return this._text; }
  set textContent(v) { this.children = []; this.qrText = null; this._text = String(v); }
  get textContent() { return this._text; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  insertAdjacentElement(_pos, el) { (this.parentNode || this).appendChild(el); return el; }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this); }
  all() { return this.children.flatMap(c => [c, ...c.all()]); }
  querySelector(sel) {
    if (sel === ".v511-theme-preview-qr") return this.all().find(c => c.className.split(" ").includes("v511-theme-preview-qr")) || null;
    if (sel === ":scope > .venue-qr-offline-badge") return this.children.find(c => c.className === "venue-qr-offline-badge") || null;
    return null;
  }
}

function stageWithQrSlot(id) {
  const parent = new FakeEl(id + "-host");
  const stage = parent.appendChild(new FakeEl(id, "v511-theme-preview-stage"));
  const wrap = stage.appendChild(new FakeEl("", "qr-wrap"));
  wrap.appendChild(new FakeEl("", "v511-theme-preview-qr"));
  return stage;
}

function loadPage() {
  const els = new Map();
  const add = (el) => { els.set(el.id, el); return el; };
  add(new FakeEl("venueQrBox")).parentNode = new FakeEl("venueQrBox-host");
  add(new FakeEl("qrPayloadPreview"));
  add(stageWithQrSlot("v511InlineCheckinStage"));
  const document = {
    body: new FakeEl("body"),
    getElementById: (id) => els.get(id) || null,
    createElement: () => new FakeEl()
  };
  class QRCode {
    constructor(slot, opts) { slot.qrText = opts.text; slot.qrWidth = opts.width; }
  }
  QRCode.CorrectLevel = { L: 1, M: 0 };
  const ctx = createContext({ document, console });
  ctx.window = ctx;
  ctx.QRCode = QRCode;
  runInContext(`
    var venueQrPayload = null;
    var venueQrOffline = false;
    ${extractFunction("renderVenueQR")}
    ${extractFunction("renderRealVenueQrIntoInlineClone")}
    ${extractFunction("renderRealVenueQrIntoFullscreen")}
    ${extractFunction("setVenueQrOfflineMode")}
  `, ctx);
  return {
    ctx,
    openFullscreen() { return add(stageWithQrSlot("v511FullscreenStage")); },
    closeFullscreen() { els.delete("v511FullscreenStage"); },
    qrIn(id) { const el = els.get(id); return (id === "venueQrBox" ? el : el.querySelector(".v511-theme-preview-qr")).qrText; }
  };
}

const LIVE_1 = "https://irlid.co.uk/org-entry.html?type=checkin&org=test-org&n=cin_first";
const LIVE_2 = "https://irlid.co.uk/org-entry.html?type=checkin&org=test-org&n=cin_second";
const BACKUP = "https://irlid.co.uk/org-entry.html?type=checkin&org=test-org";

test("full screen QR follows every new live code (was frozen on the first one)", () => {
  const page = loadPage();
  page.ctx.renderVenueQR(LIVE_1);
  const fs = page.openFullscreen();
  page.ctx.renderRealVenueQrIntoFullscreen(fs); // what fullscreenQR() does on open
  assert.equal(page.qrIn("v511FullscreenStage"), LIVE_1);
  // The code is scanned (or 45 s pass) and generateVenueQR() rotates it.
  page.ctx.renderVenueQR(LIVE_2);
  assert.equal(page.qrIn("venueQrBox"), LIVE_2);
  assert.equal(page.qrIn("v511InlineCheckinStage"), LIVE_2);
  assert.equal(page.qrIn("v511FullscreenStage"), LIVE_2, "full screen must show the new code, or scans land as offline");
  assert.equal(fs.querySelector(".v511-theme-preview-qr").qrWidth, 840, "keeps the full screen size");
});

test("full screen switches to the backup QR (and back) with the badge", () => {
  const page = loadPage();
  page.openFullscreen();
  page.ctx.renderVenueQR(BACKUP);
  page.ctx.setVenueQrOfflineMode(true);
  assert.equal(page.qrIn("v511FullscreenStage"), BACKUP);
  const slot = page.ctx.document.getElementById("v511FullscreenStage").querySelector(".v511-theme-preview-qr");
  assert.ok(slot.parentNode.querySelector(":scope > .venue-qr-offline-badge"), "backup-QR badge shows in full screen");
  page.ctx.renderVenueQR(LIVE_2);
  page.ctx.setVenueQrOfflineMode(false);
  assert.equal(page.qrIn("v511FullscreenStage"), LIVE_2);
  assert.equal(slot.parentNode.querySelector(":scope > .venue-qr-offline-badge"), null);
});

test("no full screen open: rotation is unchanged and nothing throws", () => {
  const page = loadPage();
  page.ctx.renderVenueQR(LIVE_1);
  page.ctx.renderVenueQR(LIVE_2);
  assert.equal(page.qrIn("venueQrBox"), LIVE_2);
  assert.equal(page.qrIn("v511InlineCheckinStage"), LIVE_2);
});

test("fullscreenQR() draws through the shared helper and shows the backup badge", () => {
  const body = extractFunction("fullscreenQR");
  assert.match(body, /renderRealVenueQrIntoFullscreen\(clone\)/);
  assert.match(body, /setVenueQrOfflineMode\(venueQrOffline\)/);
  // The kiosk lock (PR #157) draws its own small unlock QR in here; only the
  // venue QR must go through the shared helper.
  assert.doesNotMatch(body, /new QRCode\([^;]*venueQrPayload/, "only one place draws the full screen venue QR");
});

test("cache and build moved on (W8)", () => {
  assert.ok(Number(sw.match(/CACHE_VERSION = 'irlid-shell-v(\d+)'/)[1]) >= 193);
  assert.match(orgHtml, /Build v6\.(8\.([3-9]|\d\d)|(9|\d\d)\.\d+)</, "build is v6.8.3 or later");
});
