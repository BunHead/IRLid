// v6.8.15: an offline scan says why it was queued or refused (rules C7, C8,
// C9, I1). Text only; the phone explains, the server decides (S13).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const ROOT = new URL("../../", import.meta.url);
const ctx = createContext({});
runInContext(readFileSync(new URL("js/checkin-reasons.js", ROOT), "utf8"), ctx);
const R = runInContext("globalThis.IRLidCheckinReasons", ctx);

test("queued reason: no internet, too slow, or could not reach", () => {
  assert.equal(R.queuedReason({ offline: true }), "offline");
  assert.equal(R.queuedReason({ offline: true, timedOut: true }), "offline");
  assert.equal(R.queuedReason({ timedOut: true }), "timeout");
  assert.equal(R.queuedReason({}), "unreachable");
  assert.equal(R.queuedReason(), "unreachable");
});

test("every queued reason has plain words, says it was saved offline, and never claims verified", () => {
  for (const reason of ["offline", "timeout", "unreachable", "something-else"]) {
    const m = R.queuedMeta(reason);
    assert.match(m, /^Saved offline: /);
    assert.match(m, /send itself/);
    assert.doesNotMatch(m, /verified|fresh/i);
  }
  assert.match(R.queuedMeta("offline"), /no internet/);
  assert.match(R.queuedMeta("timeout"), /too slow/);
  assert.match(R.queuedMeta("unreachable"), /could not be reached/);
});

test("refusal reasons: live screen required, outside event times, bad signature, held, rate limit, server fault", () => {
  assert.equal(R.refusalText({ status: 409, data: { reason: "live_code_required" } }).title, "Scan the live screen");
  const out = R.refusalText({ status: 403, data: { reason: "outside_event_times" } });
  assert.match(out.subtitle, /not open for check-in/);
  assert.match(out.meta, /^Refused: outside/);
  assert.match(R.refusalText({ status: 401, data: { error: "Check-in signature invalid" } }).meta, /^Refused: .*signed/);
  const held = R.refusalText({ status: 202, data: { quarantined: true } });
  assert.match(held.title, /held for staff/i);
  assert.match(held.subtitle, /not counted/);
  assert.equal(R.refusalText({ status: 202, data: null, message: "" }).title, "Check-in held for staff", "an unconfirmed 202 is shown as held, not 'checked in'");
  assert.match(R.refusalText({ status: 429, data: {} }).meta, /^Refused: please wait/);
  assert.match(R.refusalText({ status: 503, data: {} }).subtitle, /server had a problem/);
});

test("an unknown refusal still shows the server's words and the status", () => {
  const t = R.refusalText({ status: 418, message: "I am a teapot", data: {} });
  assert.equal(t.subtitle, "I am a teapot");
  assert.match(t.meta, /\(418\)/);
  assert.equal(R.refusalText({}).subtitle, "Could not record check-in");
});

test("org-entry.html uses these words for the queued screen and for refusals, and keeps the 'Syncing' line", () => {
  const html = readFileSync(new URL("org-entry.html", ROOT), "utf8");
  assert.match(html, /js\/checkin-reasons\.js/);
  assert.match(html, /queuedMeta\(payload\.queued_reason\)/);
  assert.match(html, /refusalText\(err\)/);
  assert.match(html, /subtitle: "Syncing when back online"/);
  assert.match(html, /queued_reason: window\.IRLidCheckinReasons/);
  assert.match(readFileSync(new URL("sw.js", ROOT), "utf8"), /'\.\/js\/checkin-reasons\.js'/);
});
