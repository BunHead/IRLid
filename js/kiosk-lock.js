// Kiosk lock for the full screen check-in QR (org setting "Lock full screen",
// off by default).
//
// When the org turns it on, the X on the full screen check-in QR becomes a
// padlock, with a round "refresh QR" button to its left. Leaving full screen
// (the padlock, Esc or F11) needs a one-time unlock QR scanned by a staff-tier
// member's enrolled v5 phone. Until the Worker says that scan was signed and
// accepted, the screen stays locked: if the browser drops full screen anyway
// (Esc cannot be blocked), the stage stays over the whole page and the next
// tap puts it back into full screen.
//
// A small dot shows whether the kiosk is online (green) or offline (red).
//
// Honest limit (I1): a web page cannot block the Windows key, Alt+Tab,
// Ctrl+Alt+Del or closing the browser. This is a deterrent for the dashboard
// behind the QR, not a sealed kiosk. For a real kiosk use Windows Assigned
// Access (see docs/kiosk-lock.md).
//
// This file has no dependencies and works in the browser (window.IRLidKioskLock)
// and in Node (module.exports) so the unlock flow can be tested.
(function (root) {
  "use strict";

  const UNLOCK_ACTION = "irlid_kiosk_unlock_v5";

  function defaultSleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  // Lock state. Only a "claimed" result from the Worker unlocks it.
  function createLockState(locked) {
    let isLocked = !!locked;
    return {
      isLocked: function () { return isLocked; },
      // An attempt to leave full screen (padlock, Esc, F11, fullscreenchange).
      // Returns "exit" only when the screen is not locked.
      exitAttempt: function () { return isLocked ? "stay" : "exit"; },
      // Offline code: only a verifier result that matched a cached key.
      acceptOfflineUnlock: function (checked) {
        if (checked && checked.ok === true && typeof checked.key_id === "string" && checked.key_id) {
          isLocked = false;
          return true;
        }
        return false;
      },
      acceptUnlock: function (polled) {
        if (polled && polled.status === "claimed" && polled.action_result && polled.action_result.unlocked === true) {
          isLocked = false;
          return true;
        }
        return false;
      }
    };
  }

  // One unlock attempt: ask the Worker for a single-use unlock code, show it
  // as a QR, and poll until a staff phone has signed it, it is rejected, it
  // expires, or it is cancelled. Network errors are retried with backoff;
  // the screen stays locked the whole time.
  //
  // api:  { init() -> {nonce, auth_url, expires_at}, poll(nonce) -> {status, action_result} }
  // ui:   { showQr(text), setStatus(text, kind) }
  // opts: { isCancelled(), sleep(ms), now(), state }
  async function runUnlock(api, ui, opts) {
    opts = opts || {};
    const sleep = opts.sleep || defaultSleep;
    const now = opts.now || function () { return Date.now(); };
    const isCancelled = opts.isCancelled || function () { return false; };
    const state = opts.state;
    let init;
    ui.setStatus("Getting an unlock code...", "wait");
    try {
      init = await api.init();
    } catch (err) {
      const code = String((err && err.data && err.data.error) || (err && err.message) || "");
      if (/session/i.test(code)) {
        ui.setStatus("This computer's sign-in has expired, so it cannot make an unlock code. The screen stays locked.", "err");
        return { outcome: "no_session" };
      }
      if (/kiosk_lock_off/.test(code)) {
        ui.setStatus("Lock full screen is off for this org, so there is no unlock code. Reload the page to leave full screen.", "err");
        return { outcome: "lock_off" };
      }
      ui.setStatus("Unlocking needs the internet. The screen stays locked. Try again when the dot is green.", "err");
      return { outcome: "offline" };
    }
    if (!init || !init.nonce || !init.auth_url) {
      ui.setStatus("Could not get an unlock code. The screen stays locked.", "err");
      return { outcome: "failed" };
    }
    ui.showQr(init.auth_url);
    ui.setStatus("Waiting for a staff phone to scan and approve...", "wait");
    let delay = 1500;
    for (;;) {
      if (isCancelled()) return { outcome: "cancelled" };
      if (Number(init.expires_at || 0) && Number(init.expires_at) <= now()) {
        ui.setStatus("The unlock code expired. Tap New unlock code.", "err");
        return { outcome: "expired" };
      }
      await sleep(delay);
      if (isCancelled()) return { outcome: "cancelled" };
      let polled;
      try {
        polled = await api.poll(init.nonce);
        delay = 1500;
      } catch (err) {
        // Flaky network: keep the lock, keep trying, back off up to 8 s.
        ui.setStatus("Connection lost. Still waiting...", "wait");
        delay = Math.min(delay * 2, 8000);
        continue;
      }
      const status = polled && polled.status;
      if (status === "claimed") {
        if (state ? state.acceptUnlock(polled) : (polled.action_result && polled.action_result.unlocked === true)) {
          ui.setStatus("Unlocked.", "ok");
          return { outcome: "unlocked" };
        }
        ui.setStatus("That approval was not an unlock. The screen stays locked.", "err");
        return { outcome: "failed" };
      }
      if (status === "rejected") {
        ui.setStatus("Unlock was rejected on the phone. The screen stays locked.", "err");
        return { outcome: "rejected" };
      }
      if (status === "expired") {
        ui.setStatus("The unlock code expired. Tap New unlock code.", "err");
        return { outcome: "expired" };
      }
    }
  }

  // ---------- Offline unlock code ----------
  // See docs/kiosk-lock.md and the Worker (orgKioskCodeEnrol). A Lead Admin's
  // or Developer's phone holds a random seed; each kiosk only holds
  //   kiosk_key = HMAC-SHA256(seed, "irlid-kiosk-code|" + org_id + "|" + kiosk_id)
  // and checks  code = 8 digits of HMAC-SHA256(kiosk_key, "unlock|" + challenge)
  // against a one-time challenge it made itself (90 s, single use, 5 tries).

  const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford: no I, L, O, U
  const OFFLINE_TTL_MS = 90000;
  const OFFLINE_MAX_TRIES = 5;

  function subtle() {
    const c = (root && root.crypto) || (typeof globalThis !== "undefined" && globalThis.crypto);
    if (!c || !c.subtle) throw new Error("WebCrypto unavailable");
    return c;
  }

  function randomB32(n) {
    const bytes = new Uint8Array(n);
    subtle().getRandomValues(bytes);
    let out = "";
    for (let i = 0; i < n; i += 1) out += B32[bytes[i] & 31];
    return out;
  }

  function b64uToBytes(str) {
    const b64 = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    const bin = (typeof atob === "function") ? atob(padded) : Buffer.from(padded, "base64").toString("binary");
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function hmac(keyBytes, text) {
    const c = subtle();
    const key = await c.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return new Uint8Array(await c.subtle.sign("HMAC", key, new TextEncoder().encode(text)));
  }

  function deriveKioskKey(seedBytes, orgId, kioskId) {
    return hmac(seedBytes, "irlid-kiosk-code|" + orgId + "|" + kioskId);
  }

  async function offlineCode(kioskKeyBytes, challenge) {
    const mac = await hmac(kioskKeyBytes, "unlock|" + challenge);
    const n = ((mac[0] & 0x7f) << 24 | mac[1] << 16 | mac[2] << 8 | mac[3]) >>> 0;
    return String(n % 100000000).padStart(8, "0");
  }

  function normaliseCode(code) {
    return String(code || "").replace(/[^0-9]/g, "");
  }

  function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  function newKioskId() { return randomB32(10); }

  // One verifier per lock screen. Each challenge is single use: it is retired
  // after an unlock, after 5 wrong codes, or after 90 s.
  // keys: [{key_id, k (base64url kiosk key)}] cached from the Worker.
  function createOfflineVerifier(opts) {
    opts = opts || {};
    const now = opts.now || function () { return Date.now(); };
    const ttl = opts.ttlMs || OFFLINE_TTL_MS;
    const maxTries = opts.maxTries || OFFLINE_MAX_TRIES;
    let current = null;
    const used = new Set();
    function fresh() {
      let c;
      do { c = randomB32(8); } while (used.has(c));
      current = { challenge: c, created: now(), tries: 0 };
      return current;
    }
    return {
      challenge: function () {
        if (!current || now() - current.created > ttl) fresh();
        return { challenge: current.challenge, expires_at: current.created + ttl };
      },
      renew: function () { fresh(); return { challenge: current.challenge, expires_at: current.created + ttl }; },
      check: async function (code) {
        const keys = (typeof opts.getKeys === "function" ? opts.getKeys() : opts.keys) || [];
        if (!keys.length) return { ok: false, reason: "no_keys" };
        if (!current) return { ok: false, reason: "expired" };
        const ch = current.challenge;
        if (now() - current.created > ttl) { used.add(ch); fresh(); return { ok: false, reason: "expired", challenge: ch }; }
        const typed = normaliseCode(code);
        if (typed.length !== 8) return { ok: false, reason: "format" };
        for (const key of keys) {
          let bytes;
          try { bytes = b64uToBytes(key.k); } catch (_) { continue; }
          if (bytes.length !== 32) continue;
          const want = await offlineCode(bytes, ch);
          if (timingSafeEqual(want, typed)) {
            used.add(ch);
            current = null;
            return { ok: true, key_id: key.key_id, challenge: ch };
          }
        }
        current.tries += 1;
        if (current.tries >= maxTries) {
          used.add(ch);
          fresh();
          return { ok: false, reason: "locked_out", challenge: ch };
        }
        return { ok: false, reason: "wrong", tries_left: maxTries - current.tries };
      }
    };
  }

  // ---------- Browser UI ----------

  const PADLOCK_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Zm3 4a2 2 0 0 1 1 3.73V19h-2v-1.27A2 2 0 0 1 12 14Z"/></svg>';
  const REFRESH_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35Z"/></svg>';

  function ensureStyles(doc) {
    if (doc.getElementById("irlidKioskLockStyles")) return;
    const style = doc.createElement("style");
    style.id = "irlidKioskLockStyles";
    style.textContent = [
      ".irlid-kiosk-btn{position:fixed;top:18px;width:42px;height:42px;border:0;border-radius:999px;background:rgba(255,255,255,0.18);color:#fff;display:grid;place-items:center;cursor:pointer;z-index:100002;padding:0;}",
      ".irlid-kiosk-btn:focus-visible{outline:2px solid #fff;outline-offset:2px;}",
      ".irlid-kiosk-padlock{right:18px;}",
      ".irlid-kiosk-refresh{right:70px;}",
      ".irlid-kiosk-dot{position:fixed;left:14px;bottom:14px;width:10px;height:10px;border-radius:50%;z-index:100002;background:#3fb950;box-shadow:0 0 0 2px rgba(0,0,0,0.35);}",
      ".irlid-kiosk-dot[data-online='false']{background:#f85149;}",
      ".irlid-kiosk-panel{position:fixed;inset:0;z-index:100003;display:grid;place-items:center;padding:20px;background:rgba(1,4,9,.86);}",
      ".irlid-kiosk-card{width:min(420px,100%);background:#0d1117;color:#e6edf3;border:1px solid rgba(139,148,158,.35);border-radius:8px;padding:20px;text-align:center;font:400 14px/1.45 'Segoe UI',system-ui,sans-serif;}",
      ".irlid-kiosk-card h2{margin:0 0 8px;font-size:20px;line-height:1.2;}",
      ".irlid-kiosk-card p{margin:0 0 12px;color:#8b949e;}",
      ".irlid-kiosk-qr{width:250px;min-height:250px;margin:12px auto;display:grid;place-items:center;background:#fff;color:#24292f;border-radius:8px;padding:10px;}",
      ".irlid-kiosk-qr canvas,.irlid-kiosk-qr img{display:block;max-width:100%;height:auto;}",
      ".irlid-kiosk-status{min-height:20px;font-weight:700;color:#d29922;}",
      ".irlid-kiosk-status[data-kind='ok']{color:#7ee787;}",
      ".irlid-kiosk-status[data-kind='err']{color:#f85149;}",
      ".irlid-kiosk-card button{margin-top:14px;min-height:36px;border-radius:8px;border:1px solid rgba(139,148,158,.45);background:#161b22;color:#e6edf3;padding:0 14px;cursor:pointer;}",
      ".irlid-kiosk-offline{margin-top:10px;font-size:13px;color:#8b949e;}",
      ".irlid-kiosk-offline input{width:11ch;font:700 22px/1.2 ui-monospace,monospace;letter-spacing:.12em;text-align:center;padding:6px 8px;border-radius:8px;border:1px solid rgba(139,148,158,.6);background:#010409;color:#e6edf3;}",
      ".irlid-kiosk-challenge{font:700 16px/1.3 ui-monospace,monospace;color:#e6edf3;letter-spacing:.06em;}",
      ".irlid-kiosk-relock{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:100002;background:rgba(0,0,0,.7);color:#fff;border-radius:999px;padding:8px 14px;font:600 13px/1.2 'Segoe UI',system-ui,sans-serif;}"
    ].join("");
    doc.head.appendChild(style);
  }

  // Attach the lock UI to a full screen stage.
  // opts: {
  //   locked, isOnline(), onRefresh(), requestFullscreen(),
  //   initUnlock(), pollUnlock(nonce), renderQr(el, text),
  //   onUnlocked()   -> caller leaves full screen and removes the stage
  // }
  function attach(stage, opts) {
    opts = opts || {};
    const doc = stage.ownerDocument || document;
    const win = doc.defaultView || window;
    ensureStyles(doc);
    const state = createLockState(opts.locked);
    const controls = [];

    // Online dot (shown locked or not).
    const dot = doc.createElement("div");
    dot.className = "irlid-kiosk-dot";
    dot.setAttribute("role", "status");
    stage.appendChild(dot);
    controls.push(dot);
    function paintDot() {
      let online = true;
      try { online = typeof opts.isOnline === "function" ? !!opts.isOnline() : win.navigator.onLine !== false; } catch (_) { online = false; }
      dot.dataset.online = online ? "true" : "false";
      dot.setAttribute("aria-label", online ? "Online" : "Offline");
      dot.title = online ? "Online" : "Offline";
    }
    paintDot();
    const dotTimer = win.setInterval(paintDot, 3000);
    win.addEventListener("online", paintDot);
    win.addEventListener("offline", paintDot);

    let panel = null;
    let relockHint = null;
    // Each unlock attempt has its own token, so "Stay locked" ends that
    // attempt's wait and a new padlock tap starts a fresh one.
    let attempt = null;

    function closePanel() {
      if (attempt) attempt.cancelled = true;
      attempt = null;
      if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
      panel = null;
    }

    function showRelockHint(show) {
      if (show && !relockHint) {
        relockHint = doc.createElement("div");
        relockHint.className = "irlid-kiosk-relock";
        relockHint.setAttribute("role", "status");
        relockHint.textContent = "Screen locked. Tap to return to full screen.";
        stage.appendChild(relockHint);
      } else if (!show && relockHint) {
        relockHint.remove();
        relockHint = null;
      }
    }

    async function openUnlock() {
      if (!state.isLocked()) return;
      if (attempt && panel) return; // already showing an unlock code
      closePanel();
      const mine = { cancelled: false };
      attempt = mine;
      panel = doc.createElement("div");
      panel.className = "irlid-kiosk-panel";
      panel.innerHTML =
        '<section class="irlid-kiosk-card" role="dialog" aria-modal="true" aria-labelledby="irlidKioskUnlockTitle">' +
          '<h2 id="irlidKioskUnlockTitle">Unlock this screen</h2>' +
          '<p>Scan with a staff phone that has an enrolled hardware key, then approve on the phone.</p>' +
          '<div class="irlid-kiosk-qr" aria-label="Unlock QR code"></div>' +
          '<div class="irlid-kiosk-status" role="status" aria-live="polite"></div>' +
          '<button type="button" class="irlid-kiosk-cancel">Stay locked</button>' +
          (opts.offline ? '<button type="button" class="irlid-kiosk-use-offline" style="margin-left:8px">No internet? Lead Admin or Developer code</button>' : '') +
        '</section>';
      stage.appendChild(panel);
      const qr = panel.querySelector(".irlid-kiosk-qr");
      const status = panel.querySelector(".irlid-kiosk-status");
      const cancelBtn = panel.querySelector(".irlid-kiosk-cancel");
      cancelBtn.addEventListener("click", function (e) { e.stopPropagation(); closePanel(); });
      const offlineBtn = panel.querySelector(".irlid-kiosk-use-offline");
      if (offlineBtn) offlineBtn.addEventListener("click", function (e) { e.stopPropagation(); openOffline(); });
      try { cancelBtn.focus(); } catch (_) {}
      const ui = {
        showQr: function (text) {
          qr.textContent = "";
          try { opts.renderQr(qr, text); } catch (_) { qr.textContent = "QR unavailable"; }
        },
        setStatus: function (text, kind) {
          status.textContent = text || "";
          status.dataset.kind = kind || "";
        }
      };
      const result = await runUnlock(
        { init: opts.initUnlock, poll: opts.pollUnlock },
        ui,
        { state: state, isCancelled: function () { return mine.cancelled; } }
      );
      if (attempt === mine) attempt = null; // finished; the panel stays to show the message
      if (result && (result.outcome === "offline" || result.outcome === "no_session") && opts.offline && panel) {
        const st = panel.querySelector(".irlid-kiosk-status");
        if (st) st.textContent += " A Lead Admin or Developer can use an offline code instead.";
      }
      if (result && result.outcome !== "unlocked" && result.outcome !== "cancelled" && panel && panel.contains(cancelBtn)) {
        const again = doc.createElement("button");
        again.type = "button";
        again.className = "irlid-kiosk-again";
        again.textContent = "New unlock code";
        again.style.marginLeft = "8px";
        again.addEventListener("click", function (e) { e.stopPropagation(); openUnlock(); });
        cancelBtn.insertAdjacentElement("afterend", again);
      }
      if (result && result.outcome === "unlocked") {
        closePanel();
        destroy();
        if (typeof opts.onUnlocked === "function") opts.onUnlocked();
      }
    }

    // Offline unlock: no internet needed. The kiosk shows its own one-time
    // challenge (as a QR for the admin's phone and as text); the admin types
    // the 8-digit code their phone shows.
    const verifier = opts.offline ? createOfflineVerifier({ getKeys: opts.offline.getKeys, now: opts.offline.now }) : null;
    function openOffline() {
      if (!state.isLocked() || !verifier) return;
      closePanel();
      const mine = { cancelled: false };
      attempt = mine;
      panel = doc.createElement("div");
      panel.className = "irlid-kiosk-panel";
      panel.innerHTML =
        '<section class="irlid-kiosk-card" role="dialog" aria-modal="true" aria-labelledby="irlidKioskOfflineTitle">' +
          '<h2 id="irlidKioskOfflineTitle">Offline unlock</h2>' +
          '<p>Lead Admin or Developer: scan this with your phone (no internet needed), confirm with your fingerprint or face, and type the code it shows.</p>' +
          '<div class="irlid-kiosk-qr" aria-label="Offline unlock challenge QR"></div>' +
          '<div class="irlid-kiosk-challenge"></div>' +
          '<form class="irlid-kiosk-offline"><label>Code <input inputmode="numeric" autocomplete="off" maxlength="9" aria-label="8-digit unlock code"></label> <button type="submit">Unlock</button></form>' +
          '<div class="irlid-kiosk-status" role="status" aria-live="polite"></div>' +
          '<button type="button" class="irlid-kiosk-cancel">Stay locked</button>' +
        '</section>';
      stage.appendChild(panel);
      const qr = panel.querySelector(".irlid-kiosk-qr");
      const chEl = panel.querySelector(".irlid-kiosk-challenge");
      const form = panel.querySelector("form");
      const input = form.querySelector("input");
      const status = panel.querySelector(".irlid-kiosk-status");
      const setStatus = function (text, kind) { status.textContent = text || ""; status.dataset.kind = kind || ""; };
      panel.querySelector(".irlid-kiosk-cancel").addEventListener("click", function (e) { e.stopPropagation(); closePanel(); });
      let shown = null;
      function show(ch) {
        shown = ch;
        qr.textContent = "";
        try { opts.renderQr(qr, opts.offline.codeUrl(ch.challenge)); } catch (_) { qr.textContent = "QR unavailable"; }
        chEl.textContent = "Screen " + opts.offline.kioskId + " · challenge " + ch.challenge.slice(0, 4) + "-" + ch.challenge.slice(4);
      }
      const keys = (opts.offline.getKeys && opts.offline.getKeys()) || [];
      show(verifier.challenge());
      if (!keys.length) {
        setStatus("No offline code is set up on this screen yet. A Lead Admin or Developer must set one up on their phone, then this screen must be online once.", "err");
      }
      // Refresh the challenge display when it runs out.
      const tick = win.setInterval(function () {
        if (attempt !== mine) { win.clearInterval(tick); return; }
        const ch = verifier.challenge();
        if (!shown || ch.challenge !== shown.challenge) { show(ch); setStatus("New challenge. Scan again.", "wait"); }
      }, 1000);
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        e.stopPropagation();
        const r = await verifier.check(input.value);
        input.value = "";
        if (r.ok && state.acceptOfflineUnlock(r)) {
          setStatus("Unlocked.", "ok");
          try { if (typeof opts.offline.onLog === "function") opts.offline.onLog({ key_id: r.key_id, challenge: r.challenge, at: Date.now(), outcome: "allowed" }); } catch (_) {}
          win.clearInterval(tick);
          closePanel();
          destroy();
          if (typeof opts.onUnlocked === "function") opts.onUnlocked();
          return;
        }
        if (r.reason === "locked_out") {
          try { if (typeof opts.offline.onLog === "function") opts.offline.onLog({ challenge: r.challenge, at: Date.now(), outcome: "denied" }); } catch (_) {}
          show(verifier.challenge());
          setStatus("5 wrong codes. That challenge is retired; scan the new one.", "err");
        } else if (r.reason === "expired") {
          show(verifier.challenge());
          setStatus("That challenge ran out. Scan the new one.", "err");
        } else if (r.reason === "no_keys") {
          setStatus("No offline code is set up on this screen yet. The screen stays locked.", "err");
        } else if (r.reason === "format") {
          setStatus("Type the 8-digit code from the phone.", "err");
        } else {
          setStatus("Wrong code. " + r.tries_left + " tries left. The screen stays locked.", "err");
        }
      });
      try { input.focus(); } catch (_) {}
    }

    let padlock = null;
    let refresh = null;
    if (state.isLocked()) {
      padlock = doc.createElement("button");
      padlock.type = "button";
      padlock.className = "irlid-kiosk-btn irlid-kiosk-padlock";
      padlock.setAttribute("aria-label", "Screen locked. Scan with a staff phone to leave full screen");
      padlock.title = "Locked";
      padlock.innerHTML = PADLOCK_SVG;
      padlock.addEventListener("click", function (e) { e.stopPropagation(); openUnlock(); });
      stage.appendChild(padlock);
      controls.push(padlock);

      refresh = doc.createElement("button");
      refresh.type = "button";
      refresh.className = "irlid-kiosk-btn irlid-kiosk-refresh";
      refresh.setAttribute("aria-label", "Refresh QR");
      refresh.title = "Refresh QR";
      refresh.innerHTML = REFRESH_SVG;
      refresh.addEventListener("click", function (e) {
        e.stopPropagation();
        try { if (typeof opts.onRefresh === "function") opts.onRefresh(); } catch (_) {}
      });
      stage.appendChild(refresh);
      controls.push(refresh);
    }

    // Tapping the stage while it has dropped out of browser full screen puts
    // it back (requestFullscreen needs a tap, so it can't be automatic).
    function onStagePointer(e) {
      if (!state.isLocked() || panel) return;
      if (e.target && e.target.closest && e.target.closest(".irlid-kiosk-btn")) return;
      if (!doc.fullscreenElement && typeof opts.requestFullscreen === "function") {
        try { opts.requestFullscreen(); } catch (_) {}
      }
    }
    stage.addEventListener("pointerdown", onStagePointer);

    function onBeforeUnload(e) {
      if (!state.isLocked()) return;
      e.preventDefault();
      e.returnValue = "";
      return "";
    }
    win.addEventListener("beforeunload", onBeforeUnload);

    function destroy() {
      win.clearInterval(dotTimer);
      win.removeEventListener("online", paintDot);
      win.removeEventListener("offline", paintDot);
      win.removeEventListener("beforeunload", onBeforeUnload);
      stage.removeEventListener("pointerdown", onStagePointer);
      controls.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
      showRelockHint(false);
      closePanel();
    }

    return {
      isLocked: state.isLocked,
      // Call for Esc / F11 / the browser leaving full screen. Returns true
      // when the caller may close the stage.
      handleExitAttempt: function (source) {
        if (state.exitAttempt() === "exit") return true;
        if (source === "fullscreenchange") showRelockHint(!doc.fullscreenElement);
        openUnlock();
        return false;
      },
      onFullscreenRestored: function () { showRelockHint(false); },
      openUnlock: openUnlock,
      openOffline: openOffline,
      repaintOnline: paintDot,
      destroy: destroy
    };
  }

  const api = {
    UNLOCK_ACTION, createLockState, runUnlock, attach,
    deriveKioskKey, offlineCode, createOfflineVerifier, newKioskId, randomB32, b64uToBytes
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.IRLidKioskLock = api;
})(typeof window !== "undefined" ? window : null);
