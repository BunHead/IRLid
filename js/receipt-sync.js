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

  root.IRLReceiptSync = { isOn: isOn, setOn: setOn, syncAll: syncAll, syncOne: syncOne, FLAG: LS_FLAG };
})(typeof self !== "undefined" ? self : this);
