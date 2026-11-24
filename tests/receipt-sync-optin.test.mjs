// v6.8.26 - receipts on every device, phone side: the opt-in switch on My Receipts,
// the merge (display only) and de-duplication. Made-up data only.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../js/receipt-sync.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../receipt.html", import.meta.url), "utf8");

function load({ on = false, session = true, remote = [], available = { ok: true, data: { available: true } }, store = {} } = {}) {
  const ls = new Map(on ? [["irlid_sync_receipts", "1"]] : []);
  const calls = [];
  const root = {
    localStorage: { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) },
    IRLReceiptStore: { scrubSecrets: e => { const c = { ...e }; delete c.irlid_priv_jwk; return c; }, ...store },
    IRLBackend: {
      hasSession: () => session,
      syncAvailable: async () => { calls.push("status"); return available; },
      listSyncedReceipts: async p => { calls.push("list" + p); return remote === "fail" ? { ok: false, error: "network" } : { ok: true, data: { receipts: p === 1 ? remote : [] } }; },
      syncReceipts: async e => { calls.push("post"); return { ok: true }; }
    }
  };
  vm.runInNewContext(src, root);
  return { S: root.IRLReceiptSync, calls, ls };
}
const org = (id, x = {}) => ({ receipt_id: id, created_at: 1, ...x });
const p2p = h => ({ ts: 1, combined: { receipt_hash: h } });
const row = (kind, entry) => ({ kind, entry, receipt_key: "k" });

test("off by default: no server call is made to read the backup", async () => {
  const { S, calls } = load({ on: false, remote: [row("org", org("x"))] });
  assert.equal(S.isOn(), false);
  const r = await S.fetchRemote();
  assert.equal(JSON.stringify(r), JSON.stringify({ org: [], p2p: [] }));
  assert.deepEqual(calls, []);
});

test("signed out: nothing is fetched even if the switch was left on", async () => {
  const { S, calls } = load({ on: true, session: false });
  assert.equal(JSON.stringify(await S.fetchRemote()), JSON.stringify({ org: [], p2p: [] }));
  assert.equal(await S.checkAvailable(), false);
  assert.deepEqual(calls, []);
});

test("merge: this phone's list plus the backup, de-duplicated (org by receipt id, 1-on-1 by hash)", async () => {
  const { S } = load({ on: true, remote: [
    row("org", org("o1", { from: "backup" })), row("org", org("o2")),
    row("p2p", p2p("h1")), row("p2p", p2p("h2"))
  ] });
  const m = await S.mergedWithRemote([org("o1", { from: "local" }), org("o3")], [p2p("h1"), { ts: 5 }]);
  assert.deepEqual(m.org.map(e => e.receipt_id).sort(), ["o1", "o2", "o3"]);
  assert.equal(m.org.find(e => e.receipt_id === "o1").from, "local", "this phone's copy wins");
  assert.deepEqual(m.p2p.map(e => e.combined && e.combined.receipt_hash).filter(Boolean).sort(), ["h1", "h2"]);
  assert.equal(m.p2p.length, 3, "a local entry with no hash is kept");
});

test("merging twice gives the same list (idempotent)", async () => {
  const { S } = load({ on: true, remote: [row("org", org("o2"))] });
  const once = await S.mergedWithRemote([org("o1")], []);
  const twice = await S.mergedWithRemote(once.org, once.p2p);
  assert.deepEqual(twice.org.map(e => e.receipt_id), once.org.map(e => e.receipt_id));
});

test("the merge is display only: it never writes into this phone's store", async () => {
  let wrote = 0;
  const { S } = load({ on: true, remote: [row("org", org("o2"))], store: { putOrg: () => { wrote++; }, putP2p: () => { wrote++; }, clearAllOnDevice: () => { wrote++; } } });
  await S.mergedWithRemote([], []);
  assert.equal(wrote, 0);
  assert.ok(!/putOrg|putP2p|clearAllOnDevice|clearP2p/.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")), "receipt-sync.js never calls a store write or clear");
});

test("a server problem shows this phone's list unchanged, no error", async () => {
  const { S } = load({ on: true, remote: "fail" });
  const m = await S.mergedWithRemote([org("o1")], [p2p("h1")]);
  assert.equal(m.org.length, 1);
  assert.equal(m.p2p.length, 1);
});

test("backed-up entries have signing keys stripped before display", async () => {
  const { S } = load({ on: true, remote: [row("org", org("o2", { irlid_priv_jwk: { d: "SECRET" } }))] });
  const r = await S.fetchRemote();
  assert.ok(!JSON.stringify(r).includes("SECRET"));
});

test("availability: hidden when the server says no; remembered when offline", async () => {
  const no = load({ on: true, available: { ok: false, status: 503, error: "backup_unavailable" } });
  assert.equal(await no.S.checkAvailable(), false);
  assert.equal(no.ls.get("irlid_sync_available"), "0");
  const yes = load({ on: true });
  assert.equal(await yes.S.checkAvailable(), true);
  const offline = load({ on: true, available: { ok: false, error: "network" } });
  offline.ls.set("irlid_sync_available", "1");
  assert.equal(await offline.S.checkAvailable(), true, "a network error keeps the last known answer");
});

test("receipt.html: the switch is hidden and unchecked by default, labelled, and says what it does", () => {
  assert.match(html, /id="backupPanel" style="display:none;/);
  assert.match(html, /<input type="checkbox" id="backupToggle"(?![^>]*checked)[^>]*role="switch"/);
  assert.match(html, /\(off by default\)/);
  assert.match(html, /No organisation can see it/);
  assert.match(html, /Clearing receipts on one device clears only that device/);
  assert.match(html, /initBackupSwitch\(\);/);
});

test("receipt.html: the panel only opens after sign-in AND the server offering the backup", () => {
  const fn = html.slice(html.indexOf("async function initBackupSwitch"), html.indexOf("async function redrawList"));
  assert.ok(fn.indexOf("hasSession()") < fn.indexOf("checkAvailable()"));
  assert.ok(fn.indexOf("checkAvailable()") < fn.indexOf('panel.style.display = "block"'));
});

test("receipt.html: the list merges the backup only when the switch is on and signed in; the clear button still never calls a server", () => {
  const fn = html.slice(html.indexOf("async function refreshReceiptStore"), html.indexOf("// v6.8.23: \"Copy link\""));
  assert.match(fn, /IRLReceiptSync\.isOn\(\) && window\.IRLBackend && window\.IRLBackend\.hasSession\(\)/);
  const clear = html.slice(html.indexOf("clearBtn.onclick"), html.indexOf("backToList.addEventListener"));
  assert.ok(!/IRLBackend|fetch\(|IRLReceiptSync/.test(clear), "clearing never contacts a server");
  assert.match(clear, /clearAllOnDevice/);
});

test("check-in is untouched: org-entry.html does not load the backup or the backend", () => {
  const entry = readFileSync(new URL("../org-entry.html", import.meta.url), "utf8");
  assert.ok(!/receipt-sync\.js|js\/backend\.js/.test(entry));
});
