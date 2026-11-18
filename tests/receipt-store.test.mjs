// v6.8.23 - the person's receipt list lives in IndexedDB on the phone.
// Runs js/receipt-store.js against a tiny in-memory IndexedDB and localStorage.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../js/receipt-store.js", import.meta.url), "utf8");
const receiptHtml = readFileSync(new URL("../receipt.html", import.meta.url), "utf8");
const orgEntryHtml = readFileSync(new URL("../org-entry.html", import.meta.url), "utf8");

function fakeIndexedDB(dbs) {
  const later = (fn) => setTimeout(fn, 0);
  const req = (fn) => { const r = {}; later(() => { try { r.result = fn(); r.onsuccess && r.onsuccess({}); } catch (e) { r.error = e; r.onerror && r.onerror({ preventDefault() {}, stopPropagation() {} }); } }); return r; };
  return {
    open(name) {
      const r = {};
      later(() => {
        let rec = dbs.get(name);
        const fresh = !rec;
        if (fresh) { rec = { stores: new Map(), keyPaths: new Map() }; dbs.set(name, rec); }
        const db = {
          objectStoreNames: { contains: (n) => rec.stores.has(n) },
          createObjectStore(n, { keyPath }) { rec.stores.set(n, new Map()); rec.keyPaths.set(n, keyPath); },
          transaction(n) {
            const tx = {};
            const m = rec.stores.get(n), kp = rec.keyPaths.get(n);
            tx.objectStore = () => ({
              getAll: () => req(() => [...m.values()].map((v) => structuredClone(v))),
              put: (v) => { m.set(v[kp], structuredClone(v)); later(() => tx.oncomplete && tx.oncomplete()); return {}; },
              add: (v) => {
                const q = {};
                if (m.has(v[kp])) later(() => q.onerror && q.onerror({ preventDefault() {}, stopPropagation() {} }));
                else m.set(v[kp], structuredClone(v));
                later(() => tx.oncomplete && tx.oncomplete());
                return q;
              },
              clear: () => { m.clear(); later(() => tx.oncomplete && tx.oncomplete()); return {}; }
            });
            return tx;
          }
        };
        r.result = db;
        if (fresh) r.onupgradeneeded && r.onupgradeneeded();
        r.onsuccess && r.onsuccess();
      });
      return r;
    }
  };
}

function phone({ ls = {}, dbs = new Map(), noIdb = false, clipboard } = {}) {
  const store = new Map(Object.entries(ls));
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
  const ctx = {
    console, setTimeout, structuredClone, Promise, JSON, Object, Array, Date,
    localStorage,
    indexedDB: noIdb ? undefined : fakeIndexedDB(dbs),
    navigator: { clipboard, storage: { persist: async () => true } },
    location: { origin: "https://irlid.co.uk", pathname: "/receipt.html" }
  };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return { S: ctx.IRLReceiptStore, localStorage, dbs };
}

const org = (i) => ({ receipt_id: "r" + i, org: "acme", created_at: 1000 + i, receipt: { action: "in" } });

test("no 50-receipt cap: 120 org receipts are all kept", async () => {
  const { S } = phone();
  for (let i = 0; i < 120; i++) await S.putOrg(org(i));
  assert.equal((await S.listOrg()).length, 120);
});

test("org-entry.html no longer slices the list to 50", () => {
  assert.ok(!/slice\(0,\s*50\)/.test(orgEntryHtml));
  assert.ok(!/irlid_org_receipts/.test(orgEntryHtml.split("function storeOrgReceipt")[1].split("function configureHelloPanel")[0]));
});

test("receipts survive a localStorage clear once in IndexedDB", async () => {
  const dbs = new Map();
  const old = [org(1), org(2)];
  const a = phone({ dbs, ls: { irlid_org_receipts: JSON.stringify(old), irlid_receipts: JSON.stringify([{ ts: 5, combined: { type: "combined", receipt_hash: "abc" } }]) } });
  assert.equal((await a.S.listOrg()).length, 2); // migrates
  assert.equal((await a.S.listP2p()).length, 1);
  await a.S.putOrg(org(3));
  a.localStorage.clear(); // e.g. "clear site data" that leaves IndexedDB, or a cleared list
  const b = phone({ dbs }); // same IndexedDB, empty localStorage
  assert.deepEqual((await b.S.listOrg()).map((r) => r.receipt_id).sort(), ["r1", "r2", "r3"]);
  assert.equal((await b.S.listP2p()).length, 1);
});

test("old localStorage copy is left untouched and migration is repeatable (R1)", async () => {
  const raw = JSON.stringify([org(1)]);
  const { S, localStorage } = phone({ ls: { irlid_org_receipts: raw } });
  await S.listOrg();
  assert.equal(localStorage.getItem("irlid_org_receipts"), raw);
});

test("same receipt_id replaces, not duplicates (match by receipt_id)", async () => {
  const { S } = phone();
  await S.putOrg(org(1));
  await S.putOrg({ ...org(1), org_name: "Acme" });
  const l = await S.listOrg();
  assert.equal(l.length, 1);
  assert.equal(l[0].org_name, "Acme");
});

test("falls back to localStorage when IndexedDB is missing", async () => {
  const { S } = phone({ noIdb: true });
  await S.putOrg(org(1));
  assert.equal((await S.listOrg()).length, 1);
});

test("signing keys are never stored in the list", async () => {
  const dbs = new Map();
  const { S } = phone({ dbs });
  const priv = { kty: "EC", crv: "P-256", x: "X", y: "Y", d: "SECRETD" };
  await S.putOrg({ ...org(1), irlid_priv_jwk: priv, receipt: { pub: { kty: "EC", crv: "P-256", x: "X", y: "Y" }, privateKey: priv, key: priv } });
  await S.putP2p({ ts: 1, combined: { type: "combined", receipt_hash: "h1", a: { payload: { pub: { kty: "EC", x: "X", y: "Y", d: "SECRETD" } } } } });
  const dump = JSON.stringify([...dbs.values()].map((d) => [...d.stores.values()].map((m) => [...m.values()])));
  assert.ok(!dump.includes("SECRETD"));
  assert.ok(!dump.includes("irlid_priv_jwk"));
  assert.ok(dump.includes('"x":"X"'), "public key parts are kept");
  // migration scrubs old entries too
  const m = phone({ ls: { irlid_org_receipts: JSON.stringify([{ ...org(9), irlid_priv_jwk: priv }]) } });
  assert.ok(!JSON.stringify(await m.S.listOrg()).includes("SECRETD"));
});

test("Copy link: org, server and combined links; clipboard and fallback", async () => {
  let copied = null;
  const { S } = phone({ clipboard: { writeText: async (t) => { copied = t; } } });
  assert.equal(S.linkForOrg({ receipt_id: "a b" }), "https://irlid.co.uk/receipt.html?org_receipt=a%20b");
  assert.equal(S.linkForOrg({ receipt_id: "x", receipt_url: "https://irlid.co.uk/receipt.html?org_receipt=x" }), "https://irlid.co.uk/receipt.html?org_receipt=x");
  assert.equal(S.linkForServer("deadbeef"), "https://irlid.co.uk/receipt.html#receipt=deadbeef");
  assert.equal(S.linkForCombined("ENC"), "https://irlid.co.uk/receipt.html#COMB=ENC");
  assert.equal(await S.copyText(S.linkForServer("deadbeef")), true);
  assert.equal(copied, "https://irlid.co.uk/receipt.html#receipt=deadbeef");
  assert.equal(await S.copyText(""), false);
  const none = phone(); // no clipboard, no document: reports failure, never throws
  assert.equal(await none.S.copyText("x"), false);
});

test("receipt.html: Copy link on org, local and server rows; no localStorage list reads", () => {
  assert.equal((receiptHtml.match(/addCopyLinkButton\(row, \(\) =>/g) || []).length, 3);
  assert.ok(receiptHtml.includes('js/receipt-store.js'));
  assert.ok(!/localStorage\.getItem\("irlid_org_receipts"\)/.test(receiptHtml));
  assert.ok(!/localStorage\.getItem\(KEY_LIST\)/.test(receiptHtml));
});

test("persistent storage is requested, and a refusal is harmless", async () => {
  const { S } = phone();
  assert.equal(await S.requestPersistence(), true);
});
