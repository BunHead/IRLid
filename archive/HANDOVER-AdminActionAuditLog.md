# HANDOVER — Admin action audit log (`v5.9.0.16` candidate)

**Repo:** IRLid-repo (LIVE — irlid.co.uk)
**Files:** `irlid-api-org/src/index.js` (Worker — logging hooks + read endpoint), `irlid-api-org/schema.sql` (D1 — new table), `OrgCheckin.html` (Settings → "Recent admin actions" UI).
**Scope:** Single canonical audit log of all admin-flavoured actions in an org. Forensic-grade accountability — "who changed what, when, from what to what." Retrofits onto the actions that already exist (invite create/redeem, settings save, member removal, role change) and is ready for Brief B's swap events when those land.

**Depends on:** `v5.9.0.14` (Brief A — invite endpoints exist) and ideally `v5.9.0.15` (Brief A1 — structured logging skeleton in per-field save) merged into main first. Standalone if A1 isn't merged yet — just hook into invite + settings save directly.

---

## Background

Captain's question at 13 May evening close, after the Manager-access-to-Settings discussion: *"Would there be a way to know which manager changed something if the blame game happens?"*

Yes. Build a single canonical audit table. Every admin action in the system funnels through one logging helper, one D1 table, one read surface. Cross-cutting and reusable — Brief A's invite endpoints write to it, Brief A1's settings-save validation writes to it, Brief B's swap events will write to it when they land.

The design goal is forensic-grade, not just "nice logs in the console." The audit log answers questions like:

- "When did Spencer revoke John's Manager role and assign Sarah?"
- "Who changed the celebration animation on 8 May?"
- "Did anyone issue an invite during the security incident window?"
- "Did Lead Admin X actually authorise the Lead Admin swap, or was the new device redeemed before X signed off?"

## D1 schema — new table

```sql
CREATE TABLE IF NOT EXISTS org_admin_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id TEXT NOT NULL,
  ts INTEGER NOT NULL,                      -- unix ms
  actor_pub_fp TEXT NOT NULL,               -- the 16-char fp of the device that took the action
  actor_role TEXT NOT NULL,                 -- the role at time of action (snapshot, not lookup)
  action_type TEXT NOT NULL,                -- 'invite_create' | 'invite_redeem' | 'invite_revoke'
                                            -- | 'settings_save' | 'member_remove' | 'role_change'
                                            -- | 'org_terms_update' | 'swap_create' | 'swap_redeem'
                                            -- | 'swap_confirm' | 'swap_cancel' | ...
  target TEXT,                              -- the thing acted on: pub_fp, setting field name, nonce, etc.
  old_value TEXT,                           -- nullable; serialised JSON if non-scalar
  new_value TEXT,                           -- nullable; serialised JSON if non-scalar
  context TEXT,                             -- nullable; free-form JSON for action-specific metadata
  FOREIGN KEY (org_id) REFERENCES orgs(id)
);
CREATE INDEX idx_audit_org_ts ON org_admin_audit(org_id, ts DESC);
CREATE INDEX idx_audit_actor ON org_admin_audit(actor_pub_fp);
CREATE INDEX idx_audit_type ON org_admin_audit(org_id, action_type, ts DESC);
```

Notes on schema choices:

- `actor_role` is a **snapshot at action time**, not a foreign-key lookup. If the actor is later demoted, the audit row still tells you what role they had when they acted. Critical for forensics.
- `old_value` / `new_value` are TEXT — serialise JSON when the value is non-scalar (e.g., a role-vocabulary preset object). Keep them human-readable where possible.
- `context` is for action-specific metadata that doesn't fit cleanly into target / old / new — e.g., for `invite_redeem`, the context can record `{ "invite_nonce": "...", "issuer_pub_fp": "..." }`.
- No `actor_pub_jwk` — the fp is enough to identify a device and join back to `org_memberships` if needed.

## Worker — logging helper + read endpoint

### Logging helper (Worker-internal)

Add a single helper in `irlid-api-org/src/index.js`:

```js
async function auditLog(env, { org_id, actor_pub_fp, actor_role, action_type, target, old_value, new_value, context }) {
  await env.DB.prepare(`
    INSERT INTO org_admin_audit
      (org_id, ts, actor_pub_fp, actor_role, action_type, target, old_value, new_value, context)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    org_id,
    Date.now(),
    actor_pub_fp,
    actor_role,
    action_type,
    target || null,
    old_value != null ? (typeof old_value === 'string' ? old_value : JSON.stringify(old_value)) : null,
    new_value != null ? (typeof new_value === 'string' ? new_value : JSON.stringify(new_value)) : null,
    context != null ? JSON.stringify(context) : null,
  ).run();
}
```

### Retrofit logging hooks

In every endpoint that performs an admin action, add a call to `auditLog(...)` after the action succeeds. Initial set of hooks:

- `POST /org/invites/create` → `action_type: 'invite_create'`, `target: <nonce>`, `context: { role, expiry_ts }`.
- `POST /org/invites/redeem` → `action_type: 'invite_redeem'`, `actor_pub_fp: <new device fp>` (the redeemer), `actor_role: <new role>`, `target: <nonce>`, `context: { issuer_pub_fp, granted_role }`.
- `POST /org/invites/revoke` → `action_type: 'invite_revoke'`, `target: <nonce>`.
- Settings save (whatever endpoint name) → one row **per field changed**, with `action_type: 'settings_save'`, `target: <field_name>`, `old_value` / `new_value` populated.
- Member removal (e.g., `DELETE /org/members/:pub_fp`) → `action_type: 'member_remove'`, `target: <removed pub_fp>`, `context: { removed_role }`.
- Role change endpoint (if one exists, or once one exists) → `action_type: 'role_change'`, `target: <member pub_fp>`, `old_value: <old role>`, `new_value: <new role>`.
- Org Terms update → `action_type: 'org_terms_update'`, `old_value` / `new_value` capture the before/after text.

Defensive: each hook should NOT break the main action if logging fails (try/catch + log to console). Audit log writing is best-effort, not blocking.

### `GET /org/admin-audit`

- **Auth:** `requireDevOrStaffSession` + role check. **Lead Admin or Developer** can read the full audit log; **Manager** can read it too (read-only forensics is a Manager-appropriate capability, IMO — Captain to confirm). Reject Staff / Attendee with `403 insufficient_role`.
- **Query params:**
  - `limit` (default 50, max 200)
  - `offset` (default 0)
  - `actor` (optional, filter by `actor_pub_fp`)
  - `action_type` (optional, exact match or comma-separated list)
  - `since` (optional, unix ms — only return rows where `ts >= since`)
  - `until` (optional, unix ms — only return rows where `ts <= until`)
- **Response:** `{ rows: [...], total: <count matching filter>, has_more: <bool> }`.
- **Sort:** Always `ts DESC` (newest first).

## Dashboard UI — Settings → "Recent admin actions"

New section in Settings panel, gated to **Manager+** via `data-min-role="manager"` (read-only forensics is a Manager-appropriate capability).

Layout:

- Section header: `### Recent admin actions`
- Filter bar (top): "Filter by actor" dropdown (populated from current `org_memberships`), "Filter by action type" dropdown (Settings change / Invite / Member change / etc.), "Last 24 hours / Last 7 days / Last 30 days / All" date filter.
- Table: columns *When* (relative time, "3 min ago" / "2 hours ago" / absolute timestamp on hover), *Who* (actor's display name + role at time, with fp as hover tooltip), *What* (action type, human-readable: "Issued invite for Staff role" / "Changed Background Image" / etc.), *Details* (expandable row showing old/new values, context JSON if relevant).
- "Load more" button at the bottom for pagination.
- Refresh every 30s (or manual refresh button).

UI polish:

- Action type rendering: use a small icon + colour per type (invite = blue, member change = orange, settings = grey, swap = purple).
- Diff display: for `settings_save` rows with old_value/new_value, render a one-line "Changed X from Y to Z" rather than dumping JSON. Fall back to JSON for complex values.
- Empty state: "No admin actions in this filter window."

## Acceptance criteria

1. **Schema deployed:** `org_admin_audit` table exists in D1 with the indices specified.
2. **Logging hook on invite create:** Lead Admin issues an invite via Settings; a row appears in `org_admin_audit` with `action_type: 'invite_create'`, correct `actor_pub_fp` and role, and `context` containing the role + expiry_ts.
3. **Logging hook on invite redeem:** Fresh device redeems the invite; row appears with `action_type: 'invite_redeem'`, `actor_pub_fp` is the new device fp, `context` includes the issuer fp.
4. **Logging hook on settings save:** Manager changes the role vocabulary preset and saves; one or more rows appear with `action_type: 'settings_save'`, one row per changed field, with `old_value` and `new_value` populated.
5. **Read endpoint works:** Lead Admin hits `GET /org/admin-audit` and gets back a JSON list of recent rows, newest first, with pagination working.
6. **Filtering works:** Query `?action_type=invite_create&since=<24h_ago>` returns only invite creations in the last day.
7. **UI renders:** Manager-signed-in (or Lead Admin) sees the "Recent admin actions" section in Settings, with the most recent 50 actions rendered correctly. Filters and "Load more" work.
8. **Forensic accuracy:** The actor's role in each row matches what the actor's role *was at the time of the action*, even if the actor has been demoted or removed since.
9. **Defensive logging:** If the audit insert fails (e.g., D1 hiccup), the main action still succeeds. Console emits a warning.
10. **Pill bump:** `Build v5.9.0.15` → `Build v5.9.0.16`.

## Out of scope (deferred)

- Audit log export to CSV / spreadsheet. (Future.)
- Long-term retention policy / archive. (D1 grows forever — fine for now.)
- Audit of attendance check-in events. Those are already in `org_checkins`; not strictly "admin actions." Separate concern.
- Notification webhooks ("alert me when X type of action happens"). Out of scope.
- Cryptographic chaining of audit log entries (Merkle-tree style). Future hardening — defer until forensic threat model demands it.
- Read access for Staff. Staff don't see this section.

## Style notes

- British spellings.
- Reuse existing `data-min-role` pattern for the UI gate.
- Worker logging is best-effort, never blocking — wrap each `auditLog()` call in try/catch.
- Table-driven action_type list (or const enum) so adding new action types is one-line as Brief B and future briefs land.
- Time formatting in the UI: relative for recent (`3 min ago`), absolute for older (`8 May 14:22 BST`). Use existing helpers if present in `js/orgapi.js` or similar.
- The "Recent admin actions" section in Settings can be collapsed by default (`<details>` open=false) so it doesn't dominate the panel.

## Open questions for Captain (when this brief gets fired)

1. **Should Manager-tier see the audit log?** I've assumed yes — read-only forensics is a Manager-appropriate capability and helps the "blame game" use case work for everyone, not just the Lead Admin. If you'd rather lock it down to Lead Admin only, change the `data-min-role` to `lead_admin` and the read endpoint role check.
2. **Retention.** Audit table grows forever in this design. At what scale would you want a rolling 90-day window with archive? (Probably not for years yet.)
3. **Self-actions visible to actor?** Staff can't see the audit, so they can't see "X kicked me." Is that fine, or should removed members get a final "you were removed at HH:MM by Y" notification? (Probably out of scope.)

Ship as single PR labelled `v5.9.0.16`. Expected ~250-400 lines: D1 schema + Worker logging helper + retrofit hooks + read endpoint + dashboard UI section. Captain verifies via the test plan above. This brief is **deliberately retrofittable** — the goal is for Brief A's invite endpoints and Brief A1's settings-save validation to plug into it cleanly, and for Brief B's swap events to plug in trivially when they land.
