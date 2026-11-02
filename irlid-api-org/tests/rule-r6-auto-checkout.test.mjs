// docs/rules.md R6: "Auto check-out is marked "auto" and has no trust score."
// The auto check-out runs when staff load attendance after an event's grace.
import test from "node:test";
import assert from "node:assert/strict";
import { SchemaD1, call } from "./helpers/schema-d1.mjs";
import { eventScheduleAt } from "./helpers/signed-checkin.mjs";

// The Worker runs auto check-out at most once a minute per org, so each test
// uses its own org id.
let orgSeq = 0;
function setup() {
  const org = `org-r6-${++orgSeq}`;
  const d1 = new SchemaD1({ calendar_defaults: { auto_checkout: true, checkout_grace: 0 } }, org);
  // Event started 3 hours ago and ran 60 minutes, so its grace has passed.
  const { day_of_week, start_time_local } = eventScheduleAt(-180);
  d1.db.prepare("INSERT INTO weekly_events (id,org_id,name,day_of_week,start_time_local,duration_min,created_at) VALUES ('ev-1',?,'Class',?,?,60,0)")
    .run(org, day_of_week, start_time_local);
  const checkinAt = Math.floor(Date.now() / 1000) - 170 * 60;
  d1.db.prepare("INSERT INTO org_checkins (id,org_id,mode,score,checkin_at,created_at,name,event_id,status) VALUES ('c-1',?,'attendee_scan',85,?,?,'Ann','ev-1','checked_in')")
    .run(org, checkinAt, checkinAt);
  return d1;
}

test("R6: an auto check-out is stored with checkout_method 'auto' and no signature or proof", async () => {
  const d1 = setup();
  const res = await call(d1, "GET", "/org/attendance?since=0");
  assert.equal(res.status, 200, res.text);
  const [row] = d1.rows("SELECT * FROM org_checkins WHERE id='c-1'");
  assert.ok(row.checkout_at, "the auto check-out ran");
  assert.equal(row.checkout_method, "auto");
  assert.equal(row.checkout_signature, null, "no signature: it is not a person's proof");
  assert.equal(row.checkout_payload_hash, null);
});

test("R6: the dashboard API reports the auto check-out as 'auto', with no check-out score", async () => {
  const d1 = setup();
  const res = await call(d1, "GET", "/org/attendance?since=0");
  const row = res.body.checkins.find(r => r.id === "c-1");
  assert.ok(row, JSON.stringify(res.body));
  assert.equal(row.checkout_method, "auto");
  const scoreKeys = Object.keys(row).filter(k => /score/i.test(k) && k !== "score");
  assert.deepEqual(scoreKeys, [], "no check-out trust score field");
  assert.equal(row.score, 85, "the check-in's own score is untouched");
});
