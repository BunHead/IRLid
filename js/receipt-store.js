/* IRLid receipt store (v6.8.23, Phase 1: phone only).
 *
 * The person's own receipt list lives in IndexedDB on the phone instead of
 * localStorage, so "keep every receipt" is real (no 50 cap, no 5 MB limit).
 *
 *   p2p  - the 1-on-1 handshake list that used to be localStorage `irlid_receipts`
 *   org  - org check-in receipts, was localStorage `irlid_org_receipts`
 *          (keyed by receipt_id, so a later server list can be matched on it)
 *
 * Rules kept: C1 works with no internet; R1/R2 old receipts are copied, never
 * edited, and the old localStorage copy is left in place; S3 signing keys are
 * never stored here (see scrubSecrets). If IndexedDB is not available the same
 * API falls back to localStorage, so nothing breaks.
 *
 * Personal only: nothing here is sent anywhere, and no organisation can read it (A5).
 */
(function (root) {
  "use strict";

  var DB_NAME = "irlid_receipts_v1";
  var STORE_P2P = "p2p";
  var STORE_ORG = "org";
  var LS_P2P = "irlid_receipts";
  var LS_ORG = "irlid_org_receipts";
  var LS_MIGRATED = "irlid_receipts_idb_migrated";

  // Names that mean "signing key". These are removed from anything we store.
  var SECRET_NAMES = {
    irlid_priv_jwk: 1, priv_jwk: 1, privatekey: 1, private_key: 1, privjwk: 1,
    irlid_v5_priv: 1, secret: 1, seed: 1
  };

  function scrubSecrets(value, depth) {
    depth = depth || 0;
    if (value === null || typeof value !== "object" || depth > 12) return value;
    if (Array.isArray(value)) return value.map(function (v) { return scrubSecrets(v, depth + 1); });
    var isJwk = typeof value.kty === "string";
    var out = {};
    Object.keys(value).forEach(function (k) {
      var lower = String(k).toLowerCase();
      if (SECRET_NAMES[lower]) return;
      // A private JWK has `d` (and for RSA p, q, dp, dq, qi). Public parts stay.
      if (isJwk && (k === "d" || k === "p" || k === "q" || k === "dp" || k === "dq" || k === "qi")) return;
      out[k] = scrubSecrets(value[k], depth + 1);
    });
    return out;
  }

  // Small stable hash so the same old entry always gets the same key (migration is repeatable).
  function hashString(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  function p2pKey(entry) {
    var c = entry && entry.combined;
    if (c && c.receipt_hash) return "h:" + c.receipt_hash;
    if (entry && entry.receipt_hash) return "h:" + entry.receipt_hash;
    return "j:" + hashString(JSON.stringify(entry || {}));
  }

  function toArray(raw) {
    if (!raw) return [];
    try {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.items)) return parsed.items;
    } catch (e) {}
    return [];
  }

  function lsRead(key) {
    try { return toArray(root.localStorage.getItem(key)); } catch (e) { return []; }
  }

  function lsWrite(key, list) {
    try { root.localStorage.setItem(key, JSON.stringify(list)); } catch (e) {}
  }

  function hasIdb() {
    try { return !!(root.indexedDB && typeof root.indexedDB.open === "function"); } catch (e) { return false; }
  }

  var dbPromise = null;
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!hasIdb()) { reject(new Error("no_indexeddb")); return; }
      var req;
      try { req = root.indexedDB.open(DB_NAME, 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE_P2P)) db.createObjectStore(STORE_P2P, { keyPath: "_key" });
        if (!db.objectStoreNames.contains(STORE_ORG)) db.createObjectStore(STORE_ORG, { keyPath: "receipt_id" });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error("idb_open_failed")); };
      req.onblocked = function () { reject(new Error("idb_blocked")); };
    });
    dbPromise.catch(function () { dbPromise = null; });
    return dbPromise;
  }

  function idbAll(storeName) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, "readonly");
        var r = tx.objectStore(storeName).getAll();
        r.onsuccess = function () { resolve(r.result || []); };
        r.onerror = function () { reject(r.error); };
      });
    });
  }

  // Put-if-absent for migration; put (replace) for a new write.
  function idbPutMany(storeName, items, keepExisting) {
    if (!items.length) return Promise.resolve();
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, "readwrite");
        var os = tx.objectStore(storeName);
        items.forEach(function (it) {
          if (keepExisting) os.add(it).onerror = function (ev) { ev.preventDefault(); ev.stopPropagation(); };
          else os.put(it);
        });
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error("idb_abort")); };
      });
    });
  }

  function idbClear(storeName) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).clear();
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function withKeyP2p(entry) {
    var clean = scrubSecrets(entry);
    clean._key = p2pKey(clean);
    return clean;
  }

  function stripKey(entry) {
    if (entry && typeof entry === "object" && "_key" in entry) {
      var c = Object.assign({}, entry);
      delete c._key;
      return c;
    }
    return entry;
  }

  // Copy anything still in the old localStorage lists into IndexedDB. Never
  // deletes or edits the old copy (R1). Safe to run on every page load.
  var migrated = null;
  function migrate() {
    if (migrated) return migrated;
    migrated = (function () {
      var p2p = lsRead(LS_P2P).filter(function (e) { return e && typeof e === "object"; }).map(withKeyP2p);
      var org = lsRead(LS_ORG)
        .filter(function (e) { return e && typeof e === "object" && e.receipt_id; })
        .map(function (e) { return scrubSecrets(e); });
      return idbPutMany(STORE_P2P, p2p, true)
        .then(function () { return idbPutMany(STORE_ORG, org, true); })
        .then(function () { try { root.localStorage.setItem(LS_MIGRATED, "1"); } catch (e) {} });
    })();
    migrated.catch(function () { migrated = null; });
    return migrated;
  }

  function listP2p() {
    return migrate().then(function () { return idbAll(STORE_P2P); })
      .then(function (rows) { return rows.map(stripKey); })
      .catch(function () { return lsRead(LS_P2P); });
  }

  function listOrg() {
    return migrate().then(function () { return idbAll(STORE_ORG); })
      .catch(function () { return lsRead(LS_ORG); });
  }

  // Add or replace one org receipt (matched by receipt_id). No cap.
  function putOrg(entry) {
    if (!entry || !entry.receipt_id) return Promise.resolve(false);
    var clean = scrubSecrets(entry);
    return migrate().then(function () { return idbPutMany(STORE_ORG, [clean], false); })
      .then(function () { return true; })
      .catch(function () {
        var list = lsRead(LS_ORG).filter(function (i) { return i && i.receipt_id !== clean.receipt_id; });
        list.unshift(clean);
        lsWrite(LS_ORG, list);
        return true;
      });
  }

  function putP2p(entry) {
    if (!entry || typeof entry !== "object") return Promise.resolve(false);
    var keyed = withKeyP2p(entry);
    return migrate().then(function () { return idbPutMany(STORE_P2P, [keyed], false); })
      .then(function () { return true; })
      .catch(function () {
        var list = lsRead(LS_P2P);
        list.unshift(stripKey(keyed));
        lsWrite(LS_P2P, list);
        return true;
      });
  }

  // The receipts page's own "clear" button always cleared only the 1-on-1 list,
  // never the org check-ins, so this clears only that list. Local only; it never
  // touches a server copy.
  function clearP2p() {
    return idbClear(STORE_P2P).catch(function () {});
  }

  // Ask the browser not to evict our storage. Best effort, never blocks anything.
  // [UNCHECKED] on iPhone until tested on a real phone (W4): Safari may ignore or refuse it.
  function requestPersistence() {
    try {
      var s = root.navigator && root.navigator.storage;
      if (s && typeof s.persist === "function") {
        return s.persist().then(function (ok) { return !!ok; }, function () { return false; });
      }
    } catch (e) {}
    return Promise.resolve(false);
  }

  // ---- Copy link ----

  function baseUrl(loc) {
    loc = loc || (root.location || {});
    var origin = loc.origin || "";
    var path = String(loc.pathname || "/receipt.html");
    if (path.slice(-12) !== "receipt.html") path = path.replace(/[^\/]*$/, "") + "receipt.html";
    return origin + path;
  }

  function absolute(url, loc) {
    loc = loc || (root.location || {});
    if (/^https?:\/\//i.test(url)) return url;
    return baseUrl(loc).replace(/receipt\.html$/, "") + String(url).replace(/^\/+/, "");
  }

  function linkForOrg(entry, loc) {
    if (!entry) return "";
    var u = entry.receipt_url ||
      (entry.receipt_id ? "receipt.html?org_receipt=" + encodeURIComponent(entry.receipt_id) : "");
    return u ? absolute(u, loc) : "";
  }

  function linkForServer(hash, loc) {
    return hash ? baseUrl(loc) + "#receipt=" + hash : "";
  }

  function linkForCombined(encoded, loc) {
    return encoded ? baseUrl(loc) + "#COMB=" + encoded : "";
  }

  function copyText(text) {
    text = String(text || "");
    if (!text) return Promise.resolve(false);
    try {
      var nav = root.navigator;
      if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function") {
        return nav.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
      }
    } catch (e) {}
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    try {
      var d = root.document;
      if (!d) return false;
      var ta = d.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      d.body.appendChild(ta);
      ta.select();
      var ok = d.execCommand && d.execCommand("copy");
      d.body.removeChild(ta);
      return !!ok;
    } catch (e) { return false; }
  }

  root.IRLReceiptStore = {
    listP2p: listP2p,
    listOrg: listOrg,
    putOrg: putOrg,
    putP2p: putP2p,
    clearP2p: clearP2p,
    requestPersistence: requestPersistence,
    linkForOrg: linkForOrg,
    linkForServer: linkForServer,
    linkForCombined: linkForCombined,
    copyText: copyText,
    scrubSecrets: scrubSecrets,
    DB_NAME: DB_NAME
  };
})(typeof self !== "undefined" ? self : this);
