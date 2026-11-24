/* IRLid receipt sync (v6.8.24): OFF by default, add-only server backup.
 *
 * When the person turns on "Sync my receipts" (Settings) AND is linked
 * (has a session token), their receipts are copied to POST /me/receipts on the
 * consumer Worker. Copies only. There is no edit or delete call here, and
 * "Clear ... on this device" never touches the server copy (Spencer, 15/11).
 *
 * Never blocks or changes check-in (C1, C8, C13): every call is best effort,
 * swallows errors, and does nothing when sync is off, offline, or the server
 * is down. Signing keys are stripped before sending (scrubSecrets).
 * Stored entries are signed receipts with keys removed, not yet the encrypted
 * list from the test plan 8.5.
 */
(function (root) {
  "use strict";
  var LS_FLAG = "irlid_sync_receipts";
  var BATCH = 25;

  function isOn() {
    try { return root.localStorage.getItem(LS_FLAG) === "1"; } catch (e) { return false; }
  }
  function setOn(on) {
    try {
      if (on) root.localStorage.setItem(LS_FLAG, "1");
      else root.localStorage.removeItem(LS_FLAG);
    } catch (e) {}
  }

  function send(entries) {
    var B = root.IRLBackend;
    return B.syncReceipts(entries);
  }

  function scrub(e) {
    var S = root.IRLReceiptStore;
    return S && S.scrubSecrets ? S.scrubSecrets(e) : e;
  }

  // Copy everything on this phone that is not yet on the server. Safe to repeat.
  function syncAll() {
    var S = root.IRLReceiptStore, B = root.IRLBackend;
    if (!isOn() || !S || !B || !B.hasSession() || typeof B.syncReceipts !== "function") return Promise.resolve({ skipped: true });
    return Promise.all([S.listOrg(), S.listP2p()]).then(function (r) {
      var items = [];
      (r[0] || []).forEach(function (e) { if (e && e.receipt_id) items.push({ kind: "org", entry: scrub(e) }); });
      (r[1] || []).forEach(function (e) { if (e) items.push({ kind: "p2p", entry: scrub(e) }); });
      var sent = 0;
      var chain = Promise.resolve();
      for (var i = 0; i < items.length; i += BATCH) {
        (function (chunk) {
          chain = chain.then(function () { return send(chunk); }).then(function (res) {
            if (res && res.ok) sent += chunk.length;
          });
        })(items.slice(i, i + BATCH));
      }
      return chain.then(function () { return { sent: sent, total: items.length }; });
    }).catch(function () { return { error: true }; });
  }

  // One new receipt, right after it is saved on the phone.
  function syncOne(kind, entry) {
    var B = root.IRLBackend;
    if (!isOn() || !B || !B.hasSession() || typeof B.syncReceipts !== "function") return Promise.resolve({ skipped: true });
    return send([{ kind: kind, entry: scrub(entry) }]).catch(function () { return { error: true }; });
  }

  // ---- v6.8.26: show the backup on any device, merged with this phone's list ----
  // Display only. Nothing here writes the server list into this phone's store, so
  // "Clear receipts on this device" stays a clear of this device alone (the backup
  // is add-only and keeps what it has).
  var LS_AVAILABLE = "irlid_sync_available";

  // Same keys the server uses: org = receipt_id, 1-on-1 = receipt hash.
  function orgKey(e) { return e && typeof e.receipt_id === "string" ? e.receipt_id : ""; }
  function p2pHash(e) {
    var h = (e && e.combined && e.combined.receipt_hash) || (e && e.receipt_hash);
    return typeof h === "string" ? h : "";
  }

  // local wins on a clash (it may hold more detail); entries with no key are kept.
  function mergeBy(local, remote, keyOf) {
    var out = (local || []).slice();
    var seen = {};
    out.forEach(function (e) { var k = keyOf(e); if (k) seen[k] = true; });
    (remote || []).forEach(function (e) {
      var k = keyOf(e);
      if (!e || typeof e !== "object" || !k || seen[k]) return;
      seen[k] = true;
      out.push(e);
    });
    return out;
  }
  function mergeOrg(local, remote) { return mergeBy(local, remote, orgKey); }
  function mergeP2p(local, remote) { return mergeBy(local, remote, p2pHash); }

  // Does the server offer the backup? The answer is remembered so the switch
  // still shows offline. A missing table (503 / available:false) hides it.
  function checkAvailable() {
    var B = root.IRLBackend;
    if (!B || !B.hasSession() || typeof B.syncAvailable !== "function") return Promise.resolve(false);
    return B.syncAvailable().then(function (r) {
      var ok = !!(r && r.ok && r.data && r.data.available === true);
      var definite = !!(r && (r.ok || r.status === 503 || r.status === 403 || r.status === 401));
      try { if (definite) root.localStorage.setItem(LS_AVAILABLE, ok ? "1" : "0"); } catch (e) {}
      if (definite) return ok;
      try { return root.localStorage.getItem(LS_AVAILABLE) === "1"; } catch (e) { return false; }
    }).catch(function () { return false; });
  }

  // The person's own backup, newest first. Any problem returns [] and shows nothing.
  function fetchRemote() {
    var B = root.IRLBackend;
    if (!isOn() || !B || !B.hasSession() || typeof B.listSyncedReceipts !== "function") return Promise.resolve({ org: [], p2p: [] });
    var org = [], p2p = [];
    function page(n) {
      return B.listSyncedReceipts(n).then(function (r) {
        var rows = (r && r.ok && r.data && r.data.receipts) || [];
        rows.forEach(function (row) {
          if (!row || !row.entry || typeof row.entry !== "object") return;
          (row.kind === "org" ? org : p2p).push(scrub(row.entry));
        });
        if (rows.length >= 200 && n < 5) return page(n + 1);
      });
    }
    return page(1).then(function () { return { org: org, p2p: p2p }; })
      .catch(function () { return { org: [], p2p: [] }; });
  }

  // Local lists in, merged and de-duplicated lists out. Never throws.
  function mergedWithRemote(localOrg, localP2p) {
    return fetchRemote().then(function (rem) {
      return { org: mergeOrg(localOrg, rem.org), p2p: mergeP2p(localP2p, rem.p2p) };
    }).catch(function () { return { org: localOrg || [], p2p: localP2p || [] }; });
  }

  root.IRLReceiptSync = {
    isOn: isOn, setOn: setOn, syncAll: syncAll, syncOne: syncOne, FLAG: LS_FLAG,
    checkAvailable: checkAvailable, fetchRemote: fetchRemote, mergedWithRemote: mergedWithRemote,
    mergeOrg: mergeOrg, mergeP2p: mergeP2p
  };
})(typeof self !== "undefined" ? self : this);
