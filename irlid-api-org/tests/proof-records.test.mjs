// v6.8.32 - proof of records. IRLid is a proof of presence, so every admin
// change must leave an append-only trace (who, when, what) that each party can
// see or export later. These tests cover the changes that used to leave NO
// row in the admin log, the detail now written for calendar changes and CSV
// imports, and the CSV export of the log (Lead Admin / Developer only).
// Made-up names only. Runs the Worker's real SQL.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { T, ELL, setup, person, importCsv, HEADER, calendarAction, callAs } from "./helpers/csv-import.mjs";

const STAFF_TOK = "sess_csv_staff_abcdefghijklmnop";
const OTHER_STAFF_TOK = "sess_csv_staff2_abcdefghijklmno";

async function ctxWithStaff() {
  const ctx = await setup();
  for (const [id, fp, tok, name] of [["u-staff", "fp_staff_one_0001", STAFF_TOK, "Sky Staff"], ["u-staff2", "fp_staff_two_0002", OTHER_STAFF_TOK, "Rio Staff"]]) {
    ctx.d1.exec("INSERT INTO portal_users (id,pub_jwk,pub_fp,display_name,created_at,updated_at) VALUES (?,'{}',?,?,0,0)", id, fp, name);
    ctx.d1.exec("INSERT INTO org_memberships (org_id,user_id,role,granted_at) VALUES ('org-1',?,'staff',1)", id);
    ctx.d1.exec("INSERT INTO login_sessions (token,user_id,issued_at,expires_at) VALUES (?,?,?,?)", tok, id, T, T + 3600);
  }
  return ctx;
}
const log = (d1, action) => d1.all("SELECT * FROM org_audit_log WHERE action=? ORDER BY rowid", action);
const detailOf = (row) => JSON.parse(row.detail);

test("Add attendee (the dashboard form) is logged: who, what, when", async () => {
  const ctx = await ctxWithStaff();
  const r = await callAs(ctx, "POST", "/org/expected", { display_name: "Alex Sample" }, STAFF_TOK);
  assert.equal(r.status, 201, r.text);
  const [row] = log(ctx.d1, "expected_create");
  assert.equal(row.actor_display_name, "Sky Staff");
  assert.equal(row.actor_role, "staff");
  assert.equal(row.target, "Alex Sample");
  assert.equal(row.target_ref, r.data.expected_id);
  assert.ok(Math.abs(row.created_at - T) < 60);
});

test("Edit attendee is logged old -> new (name, role, key tag); private hints only say WHICH changed", async () => {
  const ctx = await ctxWithStaff();
  const id = person(ctx.d1, "Alex Sampel", "fpAlex000000beef");
  const r = await callAs(ctx, "PATCH", "/org/expected/" + id, {
    display_name: "Alex Sample", email_hint: "a@example.org", notes: "private note",
    signed_action: await calendarAction(ctx, { expected_id: id })
  });
  assert.equal(r.status, 200, r.text);
  const [row] = log(ctx.d1, "expected_update");
  assert.equal(row.actor_display_name, "Lee Lead");
  assert.equal(row.target, "Alex Sampel -> Alex Sample");
  const d = detailOf(row);
  assert.deepEqual(d.display_name, ["Alex Sampel", "Alex Sample"]);
  assert.deepEqual(d.also_changed.sort(), ["email_hint", "notes"]);
  assert.ok(!/a@example\.org|private note|fpAlex000000beef/.test(row.detail), "never the hint, note or key itself");
});

test("removing someone from an event is logged with who did it and exactly who was removed (same-name pick named by tag)", async () => {
  const ctx = await ctxWithStaff();
  const a = person(ctx.d1, "Sam Example", "fpSamFirst00a3f9");
  const b = person(ctx.d1, "Sam Example", "fpSamSecond07c21");
  const alex = person(ctx.d1, "Alex Sample", null);
  // create the event with the second Sam and Alex
  const created = await callAs(ctx, "POST", "/org/weekly-events", {
    name: "Yoga", day_of_week: 1, start_time_local: "10:00", duration_min: 60, expected_ids: [b, alex],
    signed_action: await calendarAction(ctx)
  });
  assert.equal(created.status, 201, created.text);
  const ev = created.data.event_id;
  let [add] = log(ctx.d1, "event_attendees_change");
  assert.equal(add.target_ref, ev);
  assert.deepEqual(detailOf(add).added.map(p => p.name).sort(), ["Alex Sample", `Sam Example (${ELL}7c21)`]);
  // swap Sams, drop Alex
  const upd = await callAs(ctx, "PATCH", "/org/weekly-events/" + ev, { expected_ids: [a], signed_action: await calendarAction(ctx, { event_id: ev }) });
  assert.equal(upd.status, 200, upd.text);
  const rows = log(ctx.d1, "event_attendees_change");
  assert.equal(rows.length, 2);
  const d = detailOf(rows[1]);
  assert.deepEqual(d.added, [{ id: a, name: `Sam Example (${ELL}a3f9)` }]);
  assert.deepEqual(d.removed.map(p => p.id).sort(), [alex, b].sort());
  assert.equal(rows[1].actor_display_name, "Lee Lead");
  assert.match(rows[1].target, /^Yoga: added Sam Example \(…a3f9\); removed /);
  // an edit that does not touch the attendee list adds no row
  await callAs(ctx, "PATCH", "/org/weekly-events/" + ev, { name: "Yoga (hall)", signed_action: await calendarAction(ctx, { event_id: ev }) });
  assert.equal(log(ctx.d1, "event_attendees_change").length, 2);
});

test("a CSV import is logged once, with every name it did NOT add and why", async () => {
  const ctx = await ctxWithStaff();
  person(ctx.d1, "Sam Example", "fpSamFirst00a3f9"); person(ctx.d1, "Sam Example", "fpSamSecond07c21");
  const r = await importCsv(ctx, HEADER + "Yoga,Studio,Mon,10:00,60,Sam Example;Jo Newperson\nPilates,Studio,Tue,11:00,45,id:p_nobody\n");
  assert.equal(r.status, 200, r.text);
  const [row] = log(ctx.d1, "calendar_import");
  assert.equal(row.target_ref, r.data.batch_id);
  assert.equal(row.target, "Week CSV import: 2 events, 2 names not added");
  const d = detailOf(row);
  assert.equal(d.events_created, 2);
  assert.equal(d.people_created, 1);
  assert.deepEqual(d.not_added.map(x => [x.row, x.event, x.name, x.reason]), [
    [2, "Yoga", "Sam Example", "matches more than one person"],
    [3, "Pilates", "id:p_nobody", "no_such_person"]
  ]);
  assert.equal(row.actor_display_name, "Lee Lead");
});

test("New phone (rebind), an attendee claiming a name, and a phone-clash decision are logged", async () => {
  const ctx = await ctxWithStaff();
  const id = person(ctx.d1, "Alex Sample", "fpAlexOld000beef");
  const rb = await callAs(ctx, "POST", `/org/expected/${id}/rebind`, { new_device_fp: "fpAlexNew0001234", reason: "lost phone" }, STAFF_TOK);
  assert.equal(rb.status, 200, rb.text);
  const [r1] = log(ctx.d1, "expected_rebind");
  assert.equal(r1.actor_display_name, "Sky Staff");
  assert.deepEqual([detailOf(r1).old_key, detailOf(r1).new_key, detailOf(r1).reason], [`${ELL}beef`, `${ELL}1234`, "lost phone"]);

  const free = person(ctx.d1, "Jo Sample", null);
  const cl = await callAs(ctx, "POST", `/org/expected/${free}/claim`, { device_pub_fp: "fpJoPhone000abcd" }, null);
  assert.equal(cl.status, 200, cl.text);
  const [r2] = log(ctx.d1, "expected_claim");
  assert.equal(r2.actor_role, "attendee");
  assert.equal(r2.actor_pub_fp, "fpJoPhone000abcd");
  assert.equal(r2.target, "Jo Sample");

  ctx.d1.exec("INSERT INTO org_checkins (id,org_id,mode,name,device_key_fp,checkin_at,created_at,status,expected_id) VALUES ('ci-c','org-1','attendee_scan','Alex Sample','fpIntruder00dead',?,?,'conflict',?)", T, T, id);
  ctx.d1.exec("INSERT INTO attendee_conflicts (org_code,expected_id,checkin_id,bound_device_fp,claiming_device_fp,claimed_name,created_at) VALUES ('org-1',?,?,?,?,?,?)", id, "ci-c", "fpAlexNew0001234", "fpIntruder00dead", "Alex Sample", T);
  const cid = ctx.d1.get("SELECT id FROM attendee_conflicts").id;
  const rs = await callAs(ctx, "POST", `/org/conflicts/${cid}/resolve`, { resolution: "rejected" }, STAFF_TOK);
  assert.equal(rs.status, 200, rs.text);
  const [r3] = log(ctx.d1, "conflict_resolve");
  assert.equal(r3.target, "Alex Sample (rejected)");
  assert.equal(detailOf(r3).claiming_key, `${ELL}dead`);
  assert.equal(r3.actor_display_name, "Sky Staff");
});

test("Revoke invite is logged", async () => {
  const ctx = await ctxWithStaff();
  ctx.d1.exec("INSERT INTO org_invites (nonce,org_id,role,issuer_pub_fp,expiry_ts,status,created_ts) VALUES ('inv_abcdefgh12345678','org-1','staff','fp',?,'pending',?)", (T + 3600) * 1000, T * 1000);
  const r = await callAs(ctx, "POST", "/org/invites/revoke", { org_id: "org-1", nonce: "inv_abcdefgh12345678" });
  assert.equal(r.data.revoked, true, r.text);
  const [row] = log(ctx.d1, "invite_revoke");
  assert.equal(row.actor_display_name, "Lee Lead");
  assert.equal(row.target, "invite inv_abcd");
});

test("a failed log write never blocks the action (R5)", async () => {
  const ctx = await ctxWithStaff();
  await callAs(ctx, "GET", "/org/audit-log", null);   // the table exists
  ctx.d1.failOn(/INSERT INTO org_audit_log/, 1);
  const r = await callAs(ctx, "POST", "/org/expected", { display_name: "Alex Sample" }, STAFF_TOK);
  assert.equal(r.status, 201);
});

test("the log cannot be edited or deleted", async () => {
  const ctx = await ctxWithStaff();
  await callAs(ctx, "POST", "/org/expected", { display_name: "Alex Sample" }, STAFF_TOK);
  assert.throws(() => ctx.d1.exec("UPDATE org_audit_log SET target='changed'"), /immutable/);
  assert.throws(() => ctx.d1.exec("DELETE FROM org_audit_log"), /immutable/);
});

// ---- who can see or export the log ----
test("the log stays Lead Admin / Developer only: no staff 'my actions' view (Captain, 26/11/2026)", async () => {
  const ctx = await ctxWithStaff();
  await callAs(ctx, "POST", "/org/expected", { display_name: "Alex Sample" }, STAFF_TOK);
  await callAs(ctx, "POST", "/org/expected", { display_name: "Kim Sample" });
  for (const path of ["/org/audit-log", "/org/audit-log?mine=1", "/org/audit-log?format=csv", "/org/audit-log?format=csv&mine=1"]) {
    const r = await callAs(ctx, "GET", path, null, STAFF_TOK);
    assert.equal(r.status, 403, path + " must refuse staff");
    assert.ok(!/Alex Sample|Kim Sample/.test(r.text));
  }
  // and ?mine=1 is not a filter: the Lead Admin still gets the whole log
  const lead = await callAs(ctx, "GET", "/org/audit-log?mine=1", null);
  assert.deepEqual(lead.data.entries.map(e => e.target).sort(), ["Alex Sample", "Kim Sample"]);
  assert.equal(lead.data.mine, undefined);
});

test("EXPORT: the Lead Admin downloads the whole log as CSV; formula cells are defused", async () => {
  const ctx = await ctxWithStaff();
  await callAs(ctx, "POST", "/org/expected", { display_name: "=HYPERLINK(\"x\")" }, STAFF_TOK);
  await callAs(ctx, "POST", "/org/expected", { display_name: "Jo Sample" }, OTHER_STAFF_TOK);
  const full = await callAs(ctx, "GET", "/org/audit-log?format=csv", null);
  assert.equal(full.status, 200);
  assert.match(full.headers.get("Content-Type"), /text\/csv/);
  assert.match(full.headers.get("Content-Disposition"), /irlid-admin-log-\d{4}-\d{2}-\d{2}\.csv/);
  assert.match(full.headers.get("Cache-Control") || "", /no-store/);
  const lines = full.text.trim().split(/\r\n/);
  assert.equal(lines[0], "when_utc,who,role,action,target,outcome,detail,entry_id");
  assert.equal(lines.length, 3);
  assert.ok(lines.some(l => l.includes("'=HYPERLINK")), "a formula is never live in the spreadsheet");
  assert.ok(!lines.some(l => /,=HYPERLINK/.test(l)));
  assert.match(full.text, /Rio Staff,staff,expected_create,Jo Sample,allowed/);
});

test("dashboard: labels for every new log entry, Export CSV in the Admin log, and no staff export", () => {
  const html = readFileSync(new URL("../../Org.html", import.meta.url), "utf8");
  for (const a of ["expected_create", "expected_update", "expected_rebind", "expected_claim", "conflict_resolve", "invite_revoke", "event_attendees_change", "calendar_import", "record_delete", "attendance_clear"]) {
    assert.match(html, new RegExp("'" + a + "': '"), a + " has a label");
  }
  assert.match(html, /id="auditLogExportBtn" onclick="irlidDownloadAuditCsv\(\)"/);
  assert.match(html, /\/org\/audit-log\?format=csv&limit=5000', \{ headers \}/);
  assert.doesNotMatch(html, /myActionsExportBtn|Export my actions|mine=1/, "the staff export is removed");
});
