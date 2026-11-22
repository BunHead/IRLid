// Contrast check run inside the page (not a test file). For every visible
// piece of text it works out the colours behind it (solid backgrounds and
// gradient colour stops, blended through transparency) and takes the worst
// case. WCAG AA: 4.5:1 for normal text, 3:1 for large text (24px, or 18.66px
// bold). Text over a url() image can't be measured and is counted as unknown.
// Returns { fails: [...], checked, unknown }.
window.__contrastReport = function (rootSel, ignoreSel) {
  function parse(c) { const m = /rgba?\(([^)]+)\)/.exec(c || ""); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
  function lum(c) { return [c.r, c.g, c.b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0); }
  function blend(top, bot) { const a = top.a; return { r: top.r * a + bot.r * (1 - a), g: top.g * a + bot.g * (1 - a), b: top.b * a + bot.b * (1 - a), a: 1 }; }
  // Every solid colour the text could sit on: the background colours under it,
  // plus each colour stop of any gradient. A url() image can't be read, so
  // the element is counted as "unknown" and skipped.
  function bgsOf(el) {
    const stack = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const img = cs.backgroundImage;
      if (img && img !== "none") {
        if (/url\(/.test(img)) return null;
        const stops = (img.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);
        const opaque = stops.filter((c) => c.a > 0.05);
        if (opaque.length) { stack.push({ grad: opaque }); if (opaque.every((c) => c.a >= 1)) break; }
      }
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) { stack.push({ grad: [c] }); if (c.a >= 1) break; }
    }
    let outs = [{ r: 255, g: 255, b: 255, a: 1 }];
    for (let i = stack.length - 1; i >= 0; i--) {
      const next = [];
      for (const top of stack[i].grad) for (const bot of outs) next.push(blend(top, bot));
      outs = next.slice(0, 64);
    }
    return outs;
  }
  // A stable name for an element: its id or first class, else its parent's
  // plus its tag, else its text with numbers blanked (so a version bump or a
  // count does not change the name).
  function nameOf(e) { return e.id ? "#" + e.id : (typeof e.className === "string" && e.className.trim() ? "." + e.className.trim().split(/\s+/)[0] : ""); }
  function keyOf(el, n) {
    const own = nameOf(el); if (own) return own;
    const p = el.parentElement && nameOf(el.parentElement);
    if (p) return p + ">" + el.tagName.toLowerCase();
    return n.nodeValue.trim().replace(/\d+/g, "#").slice(0, 40);
  }
  const out = []; let checked = 0, unknown = 0;
  const root = rootSel ? document.querySelector(rootSel) : document.body;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    let hidden = false; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === "none" || Number(s.opacity) === 0 || s.visibility === "hidden") { hidden = true; break; } }
    if (hidden) continue;
    if (el.closest("[aria-hidden=true]")) continue;
    if (ignoreSel && el.closest(ignoreSel)) continue;
    const bgs = bgsOf(el); if (!bgs) { unknown++; continue; }
    const fg0 = parse(cs.color); if (!fg0) continue;
    checked++;
    let ratio = 99, bg = bgs[0];
    for (const b of bgs) { const fg = blend(fg0, b); const L1 = lum(fg), L2 = lum(b); const r = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); if (r < ratio) { ratio = r; bg = b; } }
    const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const need = large ? 3 : 4.5;
    if (ratio < need) out.push({ key: keyOf(el, n), text: n.nodeValue.trim().slice(0, 40), id: el.id || "", cls: String(el.className || "").slice(0, 40), ratio: Math.round(ratio * 100) / 100, need, fg: cs.color, bgc: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})` });
  }
  return { fails: out, checked, unknown };
};
