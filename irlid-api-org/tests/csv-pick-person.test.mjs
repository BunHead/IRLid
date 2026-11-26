// v6.8.31 - the event CSV can name ONE specific person, so an admin's choice
// between people who share a name survives a weekly replace re-import.
//   "Sam Example (…a3f9)"  or  "Sam Example (...a3f9)"   name + last 4 of the key
//   "Sam Example (no key yet)"                            the namesake with no phone yet
//   "id:<record id>"                                      the record itself
// Export writes these for shared names, so export -> edit -> import keeps the
// choice. A specific reference that matches nobody is reported, never created.
// Made-up names only.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import worker from "../src/index.js";
import { T, ELL, setup, person, importCsv, HEADER, linked } from "./helpers/csv-import.mjs";

const FP1 = "fpSamFirst00a3f9";
const FP2 = "fpSamSecond07c21";
const row = (names) => HEADER + `Yoga,Studio,Mon,10:00,60,${names}\n`;

test("'Name (…a3f9)' and 'Name (...a3f9)' link exactly that person", async () => {
  for (const text of [`Sam Example (${ELL}7c21)`, "Sam Example (...7c21)", "sam example ( ... 7c21 )"]) {
    const ctx = await setup();
    person(ctx.d1, "Sam Example", FP1);
    const two = person(ctx.d1, "Sam Example", FP2);
    const r = await importCsv(ctx, row(text));
    assert.equal(r.data.rows[0].status, "ok", text + ": " + r.text);
    assert.deepEqual(linked(ctx.d1, r.data.rows[0].event_id), [two], text);
    assert.equal(r.data.org_expected_created, 0);
  }
});

test("'Name (no key yet)' links the namesake who has no phone linked", async () => {
  const ctx = await setup();
  person(ctx.d1, "Sam Example", FP1);
  const unkeyed = person(ctx.d1, "Sam Example", null);
  const r = await importCsv(ctx, row("Sam Example (no key yet)"));
  assert.deepEqual(linked(ctx.d1, r.data.rows[0].event_id), [unkeyed]);
});

test("'id:<record id>' links that record; an unknown, archived or other-org id is reported, never created", async () => {
  const ctx = await setup();
  const one = person(ctx.d1, "Sam Example", FP1);
  person(ctx.d1, "Sam Example", FP2);
  const gone = person(ctx.d1, "Sam Example", "fpSamGone0000beef", T - 10);
  ctx.d1.exec("INSERT INTO organisations (id,name,slug,api_key,settings_json,created_at,updated_at) VALUES ('org-2','Other','other','org_other_key_1234567890abcdefgh','{}',0,0)");
  ctx.d1.exec("INSERT INTO org_expected (id,org_id,display_name,created_at) VALUES ('p_other_org','org-2','Sam Example',?)", T);
  const r = await importCsv(ctx, HEADER +
    `Yoga,Studio,Mon,10:00,60,id:${one}\n` +
    `Pilates,Studio,Tue,10:00,60,id:p_does_not_exist;id:${gone};id:p_other_org\n`);
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(linked(ctx.d1, r.data.rows[0].event_id), [one]);
  assert.equal(r.data.rows[1].status, "not_found");
  assert.deepEqual(linked(ctx.d1, r.data.rows[1].event_id), []);
  assert.equal(r.data.not_found_count, 3);
  assert.deepEqual(r.data.not_found.map(n => n.reason), ["no_such_person", "no_such_person", "no_such_person"]);
  assert.equal(r.data.org_expected_created, 0, "a specific reference never creates a person");
});

test("a key tag that matches nobody (e.g. the phone was changed) is reported, not created, not guessed", async () => {
  const ctx = await setup();
  person(ctx.d1, "Sam Example", FP1); person(ctx.d1, "Sam Example", FP2);
  const r = await importCsv(ctx, row(`Sam Example (${ELL}zzzz)`));
  assert.equal(r.data.rows[0].status, "not_found");
  assert.equal(r.data.not_found[0].reason, "no_person_with_that_key");
  assert.equal(r.data.org_expected_created, 0);
  assert.deepEqual(linked(ctx.d1, r.data.rows[0].event_id), []);
});

test("an ambiguous plain name lists, for each candidate, the exact CSV text that chooses them", async () => {
  const ctx = await setup();
  const one = person(ctx.d1, "Sam Example", FP1); const two = person(ctx.d1, "Sam Example", FP2);
  const r = await importCsv(ctx, row("Sam Example"));
  const refs = Object.fromEntries(r.data.ambiguous[0].candidates.map(c => [c.id, c.csv_ref]));
  assert.deepEqual(refs, { [one]: `Sam Example (${ELL}a3f9)`, [two]: `Sam Example (${ELL}7c21)` });
  // and pasting one back in picks that person
  const again = await importCsv(ctx, row(refs[two]));
  assert.deepEqual(linked(ctx.d1, again.data.rows[0].event_id), [two]);
});

test("when two namesakes' key tags collide (or neither has a key), the choice is written as the record id", async () => {
  const ctx = await setup();
  const one = person(ctx.d1, "Sam Example", "fpAAAAAAAAAAa3f9"); const two = person(ctx.d1, "Sam Example", "fpBBBBBBBBBBa3f9");
  const r = await importCsv(ctx, row("Sam Example"));
  assert.deepEqual(r.data.ambiguous[0].candidates.map(c => c.csv_ref).sort(), [`id:${one}`, `id:${two}`].sort());
  const tagged = await importCsv(ctx, row(`Sam Example (${ELL}a3f9)`));
  assert.equal(tagged.data.rows[0].status, "ambiguous", "a colliding tag is still never a guess");
});

test("ROUND TRIP: the admin's choice survives export -> weekly replace re-import", async () => {
  const ctx = await setup();
  person(ctx.d1, "Sam Example", FP1);
  const two = person(ctx.d1, "Sam Example", FP2);
  const alex = person(ctx.d1, "Alex Sample", null);
  // The admin's choice: Yoga has the second Sam and Alex.
  ctx.d1.exec("INSERT INTO weekly_events (id,org_id,room_id,name,day_of_week,start_time_local,duration_min,created_at) VALUES ('ev-yoga','org-1','room-1','Yoga',1,'10:00',60,0)");
  ctx.d1.exec("INSERT INTO event_expected (event_id,expected_id,added_at) VALUES ('ev-yoga',?,0),('ev-yoga',?,0)", two, alex);
  const res = await worker.fetch(new Request("https://worker.test/org/weekly-events/export-csv", { headers: { Authorization: "Bearer sess_csv_lead_abcdefghijklmnop", "X-Org-Id": "org-1" } }), ctx.env, { waitUntil() {} });
  assert.equal(res.status, 200);
  const csv = await res.text();
  assert.ok(csv.includes(`Sam Example (${ELL}7c21)`), csv);
  assert.ok(csv.includes("Alex Sample"), "an unshared name stays plain");
  assert.ok(!csv.includes(FP2), "only the 4-character tag, never the key");
  // Re-import that very file with replace.
  const r = await importCsv(ctx, csv.replace(/^event_name,room,/, "event_name,studio,"));
  assert.equal(r.status, 200, r.text);
  assert.equal(r.data.ambiguous_count, 0, JSON.stringify(r.data.ambiguous));
  const newYoga = r.data.rows[0].event_id;
  assert.deepEqual(linked(ctx.d1, newYoga), [alex, two].sort());
});

test("dashboard: the message names not-found people and gives the text to paste; the offline parser reports what it skips", () => {
  const html = readFileSync(new URL("../../Org.html", import.meta.url), "utf8");
  const msg = html.slice(html.indexOf("function importAmbiguousMessage"), html.indexOf("function rowDisplayName"));
  assert.match(msg, /c\.csv_ref/);
  assert.match(msg, /not found/);
  assert.match(msg, /write the one you mean in the CSV/);
  assert.match(html, /parseImportedCsv\.lastSkipped = skippedNames;/);
  assert.match(html, /var skipped = parseImportedCsv\.lastSkipped \|\| \[\];/);
});

// The offline (local-only) parser in Org.html, run on stubs.
function loadLocalParser(people) {
  const html = readFileSync(new URL("../../Org.html", import.meta.url), "utf8");
  const grab = (name) => {
    const start = html.indexOf("function " + name + "(");
    let i = html.indexOf("{", start), depth = 0;
    for (; i < html.length; i++) { if (html[i] === "{") depth++; else if (html[i] === "}" && --depth === 0) break; }
    return html.slice(start, i + 1);
  };
  const added = [];
  const ctx = {
    loadRoomsState: () => [{ id: "studio1", label: "Studio" }], roomVocabSingular: () => "Studio", ROOM_META: {},
    loadOrgExpectedState: () => people,
    addOrgExpectedEntry: (nm) => { const e = { id: "new_" + added.length, name: nm }; added.push(e); return e; }
  };
  vm.createContext(ctx);
  vm.runInContext(grab("parseCsvRow") + "\n" + grab("parseImportedCsv") + "\nglobalThis.parse = parseImportedCsv;", ctx);
  return { parse: (t) => ctx.parse(t), lastSkipped: () => ctx.parse.lastSkipped, added };
}

test("offline parser: never guesses, honours id: and the key tag label, and reports every name it skips", () => {
  const people = [
    { id: "p1", name: "Sam Example", label: `Sam Example (${ELL}a3f9)` },
    { id: "p2", name: "Sam Example", label: `Sam Example (${ELL}7c21)` },
    { id: "p3", name: "Alex Sample" }
  ];
  const P = loadLocalParser(people);
  const events = P.parse("event_name,studio,day_of_week,start_time,duration_min,expected_names\n" +
    "Yoga,Studio,Mon,10:00,60,Sam Example;Alex Sample;Sam Example (...7c21);id:p1;id:nope;Sam Example (…zzzz)\n");
  assert.equal(events.length, 1);
  assert.deepEqual([...events[0].expected_ids].sort(), ["p1", "p2", "p3"]);
  const skipped = JSON.parse(JSON.stringify(P.lastSkipped()));
  assert.deepEqual(skipped.map(x => [x.name, x.why]), [
    ["Sam Example", "matches more than one person"],
    ["id:nope", "not found"],
    [`Sam Example (${ELL}zzzz)`, "not found"]
  ]);
  assert.ok(skipped.every(x => x.row === 2));
  assert.equal(P.added.length, 0, "nothing new was made for a skipped or specific name");
});
