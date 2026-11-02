// docs/rules.md R8 (org half) + C10: "Org receipts keep only the GPS band."
// "No raw position and no GPS hash is kept."
import test from "node:test";
import assert from "node:assert/strict";
import { SchemaD1, call, ORG_KEY } from "./helpers/schema-d1.mjs";
import { signedCheckinBody } from "./helpers/signed-checkin.mjs";

const VENUE = { venueLat: 51.5, venueLon: -0.12, venueRadiusM: 100 };
// About 3.3 km north of the venue: a "far" reading.
const FAR_GPS = { lat: 51.53, lon: -0.12, acc_m: 10 };
const NEAR_GPS = { lat: 51.5001, lon: -0.12, acc_m: 10 };

function gpsKeysIn(obj, path = "", out = []) {
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    const p = path ? path + "." + k : k;
    // The venue's own, org-provided location is allowed (asserted, not measured).
    if (p === "venue.lat" || p === "venue.lon") continue;
    if (/^(gps|gps_hash|lat|lon|latitude|longitude|acc|acc_m|accuracy|gps_distance_km|distance_km)$/.test(k)) out.push(p);
    gpsKeysIn(v, p, out);
  }
  return out;
}

async function checkIn(gps) {
  const d1 = new SchemaD1({ anonymousMode: true, ...VENUE });
  // Offline replay (no live code): accepted as "offline" with the band.
  const body = await signedCheckinBody({ org: ORG_KEY, ts: Math.floor(Date.now() / 1000) - 600, gps, offline_queued: true });
  const res = await call(d1, "POST", "/org/checkin", body);
  assert.ok(res.status < 300, res.text);
  const [row] = d1.rows("SELECT * FROM org_checkins");
  const [receipt] = d1.rows("SELECT payload_json FROM org_receipts");
  return { res, row, payload: receipt ? JSON.parse(receipt.payload_json) : null };
}

test("R8/C10: a near check-in stores and signs only the band", async () => {
  const { row, payload } = await checkIn(NEAR_GPS);
  assert.equal(row.gps_band, "near");
  assert.equal(row.gps_hash, null);
  assert.ok(payload, "a receipt was minted");
  assert.equal(payload.gps_band, "near");
  assert.deepEqual(gpsKeysIn(payload), []);
});

test("R8/C10: a far check-in's receipt carries only the band, not the distance", async () => {
  const { row, payload } = await checkIn(FAR_GPS);
  assert.equal(row.gps_band, "far");
  assert.equal(row.gps_hash, null);
  assert.equal(payload.gps_band, "far");
  assert.deepEqual(gpsKeysIn(payload), [], "distance + the venue's own lat/lon puts the attendee on a ring around the venue");
});

test("R8/C10: a far check-in's database row keeps only the band, not the distance", async () => {
  const { row } = await checkIn(FAR_GPS);
  assert.equal(row.gps_distance_km, null, "the row keeps the distance from the venue");
});

test("R8/C10: the check-in response returns no raw position", async () => {
  const { res } = await checkIn(FAR_GPS);
  const body = JSON.stringify(res.body);
  assert.ok(!body.includes(String(FAR_GPS.lat)), "raw latitude echoed back");
});
