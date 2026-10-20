// Crowd check-in — per-display rotating codes (docs/design-crowd-checkin.md).
//
// Each signed-in staff device that shows codes is a "display" with its own
// stream of codes, so a scan at one door never changes the code on another
// screen. A code rotates as soon as it has been used once (the display polls
// about once a second), but the server keeps accepting it for a short grace
// period after it was superseded so a crowd scanning the same frame all get in.
// A forwarded photo of the code goes stale within seconds.
//
// Storage is created lazily per isolate, same posture as the check-in nonce
// table; migrations/2026-10-20-crowd-checkin-codes.sql is the same DDL for a
// manual apply.

export const CROWD_CODE_GRACE_S = 5;       // accepted this long after being superseded
export const CROWD_CODE_MAX_AGE_S = 90;    // never accepted after this, used or not
export const CROWD_CODE_ROTATE_AGE_S = 60; // unused codes rotate before they near expiry
export const CROWD_CODE_MAX_USES = 50;     // caps how far one forwarded frame can travel

export const CHECKIN_MODES = new Set(["standard", "crowd"]);

let crowdStorageReady = false;

export async function ensureCrowdStorage(env) {
  if (crowdStorageReady) return;
  const eventColumns = await env.DB.prepare("PRAGMA table_info(weekly_events)").all();
  const hasMode = (eventColumns.results || []).some(row => row.name === "checkin_mode");
  if (!hasMode) {
    try {
      await env.DB.prepare("ALTER TABLE weekly_events ADD COLUMN checkin_mode TEXT DEFAULT 'standard'").run();
    } catch (e) {
      if (!/duplicate column/i.test(String(e?.message || e))) throw e;
    }
  }
  await env.DB.batch([
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS org_checkin_displays (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, event_id TEXT NOT NULL, label TEXT NOT NULL, opened_by_user_id TEXT NOT NULL, opened_at INTEGER NOT NULL, closed_at INTEGER, lat REAL, lon REAL)"
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS org_crowd_codes (code TEXT PRIMARY KEY, org_id TEXT NOT NULL, event_id TEXT NOT NULL, display_id TEXT NOT NULL, issued_at INTEGER NOT NULL, superseded_at INTEGER, use_count INTEGER NOT NULL DEFAULT 0)"
    ),
    env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS idx_crowd_codes_display ON org_crowd_codes(display_id, superseded_at)"
    )
  ]);
  crowdStorageReady = true;
}

export function resetCrowdStorageFlagForTests() {
  crowdStorageReady = false;
}

export async function eventCheckinMode(env, orgId, eventId) {
  if (!eventId) return null;
  await ensureCrowdStorage(env);
  const row = await env.DB.prepare(
    "SELECT checkin_mode FROM weekly_events WHERE id=? AND org_id=? AND archived_at IS NULL LIMIT 1"
  ).bind(eventId, orgId).first();
  if (!row) return null;
  return CHECKIN_MODES.has(row.checkin_mode) ? row.checkin_mode : "standard";
}

function newCrowdCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return "crc_" + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function codeResponse(row) {
  return {
    code: row.code,
    issued_at: Number(row.issued_at),
    expires_at: Number(row.issued_at) + CROWD_CODE_MAX_AGE_S
  };
}

// Supersede the display's current code (starting its grace period) and issue
// a fresh one, in one batch so the display never has two live codes. Codes
// past their maximum age are deleted, so the table never keeps a trail.
export async function issueCrowdCode(env, display, t) {
  const code = newCrowdCode();
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM org_crowd_codes WHERE display_id=? AND issued_at<=?"
    ).bind(display.id, t - CROWD_CODE_MAX_AGE_S),
    env.DB.prepare(
      "UPDATE org_crowd_codes SET superseded_at=? WHERE display_id=? AND superseded_at IS NULL"
    ).bind(t, display.id),
    env.DB.prepare(
      "INSERT INTO org_crowd_codes (code,org_id,event_id,display_id,issued_at,superseded_at,use_count) VALUES (?,?,?,?,?,NULL,0)"
    ).bind(code, display.org_id, display.event_id, display.id, t)
  ]);
  return codeResponse({ code, issued_at: t });
}

// The display's "has my code been used?" poll. Returns the code to show:
// the current one if still unused and young, otherwise a new one.
export async function currentCrowdCode(env, display, t) {
  const row = await env.DB.prepare(
    "SELECT code,issued_at,use_count FROM org_crowd_codes WHERE display_id=? AND superseded_at IS NULL ORDER BY issued_at DESC LIMIT 1"
  ).bind(display.id).first();
  if (row && Number(row.use_count) === 0 && Number(row.issued_at) > t - CROWD_CODE_ROTATE_AGE_S) {
    return { ...codeResponse(row), rotated: false };
  }
  return { ...(await issueCrowdCode(env, display, t)), rotated: true };
}

export async function closeCrowdDisplay(env, display, t) {
  await env.DB.batch([
    env.DB.prepare("UPDATE org_checkin_displays SET closed_at=COALESCE(closed_at,?) WHERE id=?").bind(t, display.id),
    env.DB.prepare(
      "UPDATE org_crowd_codes SET superseded_at=? WHERE display_id=? AND superseded_at IS NULL"
    ).bind(t, display.id)
  ]);
}

// Atomically count one use of a code. Accepted while the code is current, or
// within the grace period after it was superseded; never past max age or max
// uses, and never once its display has been closed. Used by the crowd
// check-in path.
export async function claimCrowdCode(env, { orgId, eventId, code }, t) {
  await ensureCrowdStorage(env);
  const value = String(code || "").trim();
  if (!value) return { ok: false, reason: "code_required" };
  const claimed = await env.DB.prepare(
    "UPDATE org_crowd_codes SET use_count=use_count+1 " +
    "WHERE code=? AND org_id=? AND event_id=? AND use_count<? AND issued_at>? " +
    "AND (superseded_at IS NULL OR superseded_at>=?) " +
    "AND display_id IN (SELECT id FROM org_checkin_displays WHERE closed_at IS NULL) " +
    "RETURNING display_id"
  ).bind(value, orgId, eventId, CROWD_CODE_MAX_USES, t - CROWD_CODE_MAX_AGE_S, t - CROWD_CODE_GRACE_S).first();
  if (claimed) return { ok: true, display_id: claimed.display_id };
  const known = await env.DB.prepare(
    "SELECT code FROM org_crowd_codes WHERE code=? AND org_id=? AND event_id=? LIMIT 1"
  ).bind(value, orgId, eventId).first();
  return { ok: false, reason: known ? "code_expired" : "code_not_found" };
}
