// PR A (v6.8.4) — the Org portal has no back door. The org api_key never sits
// in the browser: js/orgapi.js names the org by id (X-Org-Id) and signs each
// org call with the login session; Org.html has no key login, no "Continue
// with this organisation", no DEV auto-login and no ?orgKey= sign-in; Sign out
// ends the session on the server and wipes the saved session and org.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const ROOT = new URL("../../", import.meta.url);
const ORG_HTML = readFileSync(new URL("Org.html", ROOT), "utf8");
// Code only: comments may still mention the removed functions by name.
const ORG_CODE = ORG_HTML.replace(/<!--[\s\S]*?-->/g, "").replace(/^\s*\/\/.*$/gm, "");

function loadApi(fetchImpl) {
  const listeners = {};
  const window = {
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    dispatchEvent(ev) { (listeners[ev.type] || []).forEach(fn => fn(ev)); return true; }
  };
  const ctx = createContext({
    window,
    navigator: { onLine: true },
    fetch: (...a) => fetchImpl(...a),
    URL,
    URLSearchParams,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    console
  });
  runInContext(readFileSync(new URL("js/orgapi.js", ROOT), "utf8"), ctx);
  return window.IRLidOrgApi;
}

function recorder() {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, ...init }); return new Response("{}", { status: 200 }); };
  return { calls, fetchImpl };
}

test("orgapi: an org id goes out as X-Org-Id with the login session as Bearer, never as X-Org-Key", async () => {
  const { calls, fetchImpl } = recorder();
  const api = loadApi(fetchImpl);
  let token = "sess_live_token_1234567890";
  api.setSessionProvider(() => token);
  await api.getOrgSettings("org-uuid-1");
  await api.listAttendance("org-uuid-1");
  await api.wsTicket("org-uuid-1");
  for (const c of calls) {
    assert.equal(c.headers["X-Org-Id"], "org-uuid-1", c.url);
    assert.equal("X-Org-Key" in c.headers, false, c.url);
    assert.equal(c.headers.Authorization, "Bearer sess_live_token_1234567890", c.url);
  }
  // After sign-out the provider returns nothing, so no credential is sent at all.
  token = null;
  await api.getOrgSettings("org-uuid-1");
  assert.equal("Authorization" in calls.at(-1).headers, false);
});

test("orgapi: an explicit session token wins over the provider", async () => {
  const { calls, fetchImpl } = recorder();
  const api = loadApi(fetchImpl);
  api.setSessionProvider(() => "sess_provider_123456789012");
  await api.updateOrgSettings("org-uuid-1", { a: 1 }, "sess_explicit_123456789012");
  assert.equal(calls[0].headers.Authorization, "Bearer sess_explicit_123456789012");
});

test("orgapi: signOut POSTs /user/logout with the session", async () => {
  const { calls, fetchImpl } = recorder();
  const api = loadApi(fetchImpl);
  await api.signOut("sess_ending_1234567890123");
  assert.equal(calls[0].method, "POST");
  assert.match(calls[0].url, /\/user\/logout$/);
  assert.equal(calls[0].headers.Authorization, "Bearer sess_ending_1234567890123");
});

test("Org.html: no key-based way in (no 'Continue with this organisation', no key login, no DEV auto-login, no ?orgKey=)", () => {
  assert.equal(/Continue with this organisation/.test(ORG_CODE), false);
  for (const name of ["saveKeyAndContinue", "loadExistingKey", "registerOrg", "ensureDevOrg", "orgFromUrl", "DEV_ORG_KEY"]) {
    assert.equal(new RegExp("function\\s+" + name + "\\b|\\b" + name + "\\s*\\(").test(ORG_CODE), false, name + " must be gone");
  }
  for (const id of ["existingKeyInput", "apiKeyDisplay", "serviceAccountWrap\"", "v511AuthApiKey\""]) {
    assert.equal(ORG_HTML.includes('id="' + id.replace(/"$/, "")), false, id + " element must be gone");
  }
  assert.match(ORG_HTML, /const DEV_AUTO_LOGIN = false;/);
  assert.equal(/params\.get\('orgKey'\)/.test(ORG_HTML), false);
});

test("Org.html: never sends or reads the org api_key", () => {
  assert.equal(/'X-Org-Key'\s*:/.test(ORG_HTML), false, "no raw X-Org-Key header");
  assert.equal(/currentOrg\??\.api_key/.test(ORG_HTML), false, "currentOrg carries no api_key");
  assert.equal(/\bapi_key:\s*/.test(ORG_CODE), false, "no api_key field is built");
});

test("Org.html: Sign out ends the session on the server and wipes the saved session and org", () => {
  const start = ORG_HTML.indexOf("function signOutOrg() {");
  const body = ORG_HTML.slice(start, ORG_HTML.indexOf("\n}\n", start));
  assert.match(body, /IRLidOrgApi\.signOut\(/);
  assert.match(body, /wipeSavedOrgSession\(\)/);
  assert.match(body, /qrLoginSession = null/);
  const wipeStart = ORG_HTML.indexOf("function wipeSavedOrgSession() {");
  const wipe = ORG_HTML.slice(wipeStart, ORG_HTML.indexOf("\n}\n", wipeStart));
  assert.match(wipe, /removeItem\('irlid_login_session'\)/);
  assert.match(wipe, /removeItem\(STORAGE_KEY_ORG\)/);
});

test("Org.html: a refused session restore never falls back to the cached dashboard", () => {
  assert.match(ORG_HTML, /const workerRefused = !!\(err && err\.status\);/);
  assert.match(ORG_HTML, /const snap = workerRefused \? null : await loadCurrentOrgSnapshot\(\);/);
});
