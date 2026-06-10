# HANDOVER — Mr. Data — `v6.1.11` — Pending Invitees in Staff List

**Branch:** `codex/v6.1.11-pending-invitees`
**Size:** ~60 lines (1 Worker endpoint + 1 frontend render block). Independent of all other open work.

---

## The Bug

When +Invite Staff creates an invite, the invitee (e.g. "Becky Wetherill") appears
immediately in the Staff & Rooms list. On hard refresh, she disappears.

**Root cause:** The invite flow creates an `org_invites` row (status='pending'). It does NOT
create an `org_memberships` row — that only happens when Becky redeems the invite on her
own phone. The frontend shows her optimistically from the invite response, but on refresh
the Staff list re-fetches from `org_memberships` where she doesn't exist yet.

**Correct behaviour:** Show Becky as a greyed "Pending — awaiting scan" row that persists
across refreshes, until she redeems or the invite expires.

---

## What you're building

### Change 1 — Worker: new `GET /org/invites/pending` endpoint

Returns all `org_invites` rows for this org with `status='pending'` and `expiry_ts > now`.

```js
async function orgPendingInvites(request, env) {
  const org = await orgAuth(request, env); if (org.error) return org;
  const tMs = Date.now();
  const rows = await env.DB.prepare(
    "SELECT nonce, role, label, expiry_ts, created_ts FROM org_invites WHERE org_id=? AND status='pending' AND expiry_ts>? ORDER BY created_ts DESC"
  ).bind(org.id, tMs).all();
  return json({ ok: true, invites: rows.results || [] });
}
```

Wire to `GET /org/invites/pending` in the router. Auth: `orgAuth` (X-Org-Key or Bearer).

### Change 2 — Frontend: fetch pending invites and render greyed rows

In the Staff & Rooms tab render function (where it renders the staff member rows), after
rendering active members, fetch `/org/invites/pending` and append greyed rows for each.

**Row shape:**
```html
<div class="staff-member-row staff-member-pending">
  <span class="staff-name">{label} <span class="pending-badge">Pending invite</span></span>
  <span class="staff-role">{role}</span>
  <span class="staff-expiry">Expires {relative time}</span>
  <button class="revoke-invite-btn" data-nonce="{nonce}">Revoke</button>
</div>
```

Style `.staff-member-pending` with `opacity: 0.55` and `font-style: italic` so it's
visually distinct from active members.

**Revoke button:** calls `POST /org/invites/{nonce}/revoke` (endpoint already exists —
check the Worker for `orgInviteRevoke` or similar; if it doesn't exist, a simple
`UPDATE org_invites SET status='revoked' WHERE nonce=? AND org_id=?` is ~5 lines to add).

### Change 3 — Remove optimistic append

Find where the invite flow appends the invitee to the local staff array after cross-device
auth succeeds (around Org.html line 17820 in `v511InviteStaffRenderQr` success path).
Remove the optimistic append — the pending row will appear on the next Staff tab render
via the real Worker data.

---

## File touch list

| File | Change |
|---|---|
| `irlid-api-org/src/index.js` | ADD `orgPendingInvites` handler + route (~20 lines). ADD `orgInviteRevoke` if missing (~10 lines). |
| `Org.html` | ADD pending invite fetch + render in Staff & Rooms tab (~30 lines). REMOVE optimistic append after invite creation. |
| `sw.js` | Cache bump only |
| Build pill | `v6.1.10` → `v6.1.11` (or `v6.1.10` → `v6.1.11` if running after ModalAutoClose) |

---

## What NOT to touch

- The invite creation flow itself — unchanged
- The invite redemption flow (`org-login.html`, `accept-on-this-device`) — unchanged
- Calendar event flows — unchanged
- Receipt bridge — unchanged

---

## A/R/D expectations

- **✅ ACCEPT ✅** — After inviting Becky, hard refresh shows her as a greyed "Pending invite" row. After invite expires or is revoked, she disappears. Active members (with `org_memberships` rows) show normally.
- **⚠️ REVIEW ⚠️** — Optimistic append kept alongside new pending rows (double-display); revoke button wired to wrong endpoint.
- **⛔ DENY ⛔** — Modifies invite redemption flow; modifies receipt bridge; adds D1 schema changes.

## Smoke

1. Settings → Staff & Rooms → + Invite staff → invite "Test Person" as Staff → authorize on phone
2. Hard refresh
3. "Test Person" appears as greyed "Pending invite" row ✅
4. Click Revoke → row disappears ✅
5. Existing active members (Kerry/Spencer/Poppy) unaffected ✅

Ship clean.
— Number One (2 June 2026)
