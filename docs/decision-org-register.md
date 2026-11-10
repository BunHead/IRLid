# Decision: what to do with the open `/org/register` endpoint

**Status:** options for Spencer's decision. Nothing is changed yet. This is break-glass question 9 (`reviews/break-glass-options.md`), raised by Mr Worf. Written 10 Nov 2026 against main `af52f7a` (v6.8.13).

## What it does today

`POST /org/register { name }` on the org Worker (`irlid-api-org/src/index.js`, `orgRegister`):

- needs **no sign-in at all**;
- creates a new organisation with that name, a venue signing key pair and an org API key, and **returns the API key** in the reply;
- creates **no Lead Admin** and no members. The org exists with only its API key;
- is limited to 5 new orgs per IP per hour (added in v6.4.24).

Nothing on the site calls it any more. Org.html's old "register" screen was removed in v6.8.4 (PR A). `js/orgapi.js` still has an unused `registerOrganisation()` helper. The real way to make an org is `POST /user/create-org`, which needs a signed-in session from the bootstrap Developer or an existing Lead Admin, and makes the creator Lead Admin.

## Why it matters

1. **Orphan orgs (rule A1).** An org made here has no Lead Admin, so nobody can sign in to run it. Only the API key reaches it.
2. **Name squatting.** Names are unique by slug. Anyone can register "Imbue Ventures" or a future customer's name first, and the real `/user/create-org` then fails with "name already taken". 5 per hour per IP, from many IPs, is plenty for that.
3. **Junk and cost.** Each call writes a row and makes a key pair. The rate limit fails open (if the limiter errors, it allows the call).
4. **A second way in.** It's a service-account path that skips S4 and S5 (admin needs a hardware key, big admin steps need an in-person scan). An API key it hands out only reaches its own org, so it can't touch other orgs' data.

What it doesn't do: it can't read or change any existing org.

## Options

| | Option | What happens | Trade-off |
|---|---|---|---|
| A | **Remove it** | The route returns 410 Gone. The unused helper in `orgapi.js` is deleted. | Simplest and safest (E2: remove anything unused). If you ever need a service-account org with no person behind it, that needs a new, signed-in path. |
| B | **Developer only** | Keep the route, but require a signed-in bootstrap Developer session (like `/user/create-org`). | Keeps a scriptable service-account path for you only. Still makes orphan orgs (A1), so the Developer would have to appoint a Lead Admin afterwards. |
| C | **Off unless switched on (break glass)** | Return 410 unless a Worker setting `ORG_REGISTER_ENABLED=1` is set in Cloudflare. When it's on, it also needs the Developer session (B). | A deliberate emergency switch you flip in the Cloudflare dashboard, not in code. More moving parts than A for a path nobody uses. |
| D | **Leave it** | As today. | Keeps the squatting and orphan-org risks above. |

## Recommendation

**A (remove it)**, because nothing uses it, it breaks A1 by design, and `/user/create-org` already covers making an org properly with the hardware-key sign-in. If the Briefing Room's break-glass outcome needs a way to make an org when the portal is down, choose **C** instead, so the path is off by default and needs both the Cloudflare switch and your Developer sign-in.

Either way, before the change, it's worth one read-only check of whether any org was ever made this way. An org with no members is the sign:

    SELECT o.id, o.name, o.created_at FROM organisations o
    LEFT JOIN org_memberships m ON m.org_id = o.id
    WHERE m.org_id IS NULL;

It can be run in the Cloudflare dashboard's D1 console for `irlid-db-org`. It only reads. (I can't reach the live database from here.)

## What I need from you

Pick A, B, C or D. The follow-up is a small Worker PR with tests (a call with no sign-in is refused, and `/user/create-org` still works). It doesn't touch the front end.
