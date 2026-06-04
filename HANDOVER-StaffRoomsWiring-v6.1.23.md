# HANDOVER — Mr. Data — `v6.1.23` — Wire the Staff list to real members (kill the mockup)

**Branch:** `codex/v6.1.23-staff-rooms-wiring`
**Why:** The **Staff & Rooms** tab is v5.12 design-in. The staff rows are **static mockup HTML**
(hardcoded "Kerry / Spencer / Poppy" with `<select>` role pickers + dead `<button>Remove</button>`,
Org.html ~L6674-6676). None of it reads real data or does anything. The +Invite Staff flow IS
real (creates `org_memberships`); only this LIST + Remove is fake.

## Governance (Captain's rules — bake these in)
- **Re-invite > change-role.** Do **NOT** add an in-place role dropdown / change-role endpoint.
  Role is **display-only**; to change someone's role you remove them and re-invite at the new role.
  So the mockup `<select>` is dropped, replaced by a plain role label.
- **Remove is privileged** — only **lead_admin + developer** can remove a member (a manager can't
  remove staff). Gate it.
- Lead Admin can't be invited (separate appointment flow, v6.3.0) — unaffected here.

## DIAGNOSE FIRST
- Find how members are listed: there's likely an endpoint behind the dashboard for org members /
  `org_memberships`. `grep` the Worker for a memberships list (e.g. used by the org switcher /
  `/user/orgs`) and whether a **member-delete** endpoint already exists. If none, add one (below).

## What to build
### Worker (`irlid-api-org/src/index.js`)
1. **List endpoint** (if not already present): `GET /org/members` → the org's `org_memberships`
   JOIN `portal_users` → `{ user_id, display_name, role }[]`. Auth: lead_admin+ session.
2. **Remove endpoint:** `DELETE /org/members/:user_id` (or `POST /org/members/:user_id/remove`) →
   delete that `org_memberships` row for this org. **Auth: lead_admin+ session** (reuse the v6.2.1
   session-role pattern — NOT api_key-only). **Guards:** cannot remove yourself; cannot remove the
   last `lead_admin`; cannot remove a `developer`. Reject with a clear error. Immutable-DB: this
   deletes a *membership* (an access grant), not attendance/receipts — those stay.

### Frontend (`Org.html`)
3. Replace the static staff rows with a render of `GET /org/members`: each row = **name · role
   label** (use the role-vocabulary label, e.g. Manager → "Studio Manager") · **Remove** button.
4. **Remove** → confirm modal ("Remove {name}? They'll lose access; re-invite to restore.") →
   `DELETE /org/members/:user_id` → re-render. Show the Remove button only to lead_admin+.
5. Drop the role `<select>`. If you want to surface "change role," it's a hint: "To change a role,
   remove and re-invite." (No change-role action.)

## Out of scope
- **Rooms / spaces** section — separate; audit whether it's wired (it backs the calendar's
  `rooms` table) and flag, but don't expand this PR into it unless trivial.
- Role-vocabulary editing wiring (separate design-in item).
- Lead Admin appointment (v6.3.0).

## File touch list
| File | Change |
|---|---|
| `irlid-api-org/src/index.js` | `GET /org/members` (if missing) + member-remove endpoint, lead_admin+ gated, with guards |
| `Org.html` | render real members; wire Remove + confirm modal; drop role select; role label display-only |
| `sw.js` | cache bump |
| Build pill | → `v6.1.23` |

## A/R/D expectations
- **✅ ACCEPT ✅** — Staff list shows the org's real members with role labels; Remove (lead_admin+)
  deletes the membership after confirm and the row disappears; guards block self/last-lead-admin/
  developer removal; managers don't see Remove; attendance/receipts untouched.
- **⚠️ REVIEW ⚠️** — Remove gated by api_key only (not session); missing a guard; in-place
  change-role sneaked in.
- **⛔ DENY ⛔** — Deletes attendance/receipt rows; lets a manager remove members; adds a
  change-role endpoint; api_key-only auth on remove.

## Smoke (with Captain — needs a Manager + a Lead-Admin/Developer)
1. As Developer: Staff & Rooms shows real members (Kerry etc.) with correct role labels
2. Remove a test member → confirm → gone; re-invite restores them
3. Guards: try to remove yourself / the developer → blocked
4. As a Manager: no Remove button visible

— Number One (4 June 2026)
