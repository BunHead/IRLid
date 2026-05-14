# HANDOVER — Outcome audio (wav) per Active Outcome (`v5.9.0.17` candidate, Brief A3)

**Repo:** IRLid-repo (LIVE — irlid.co.uk)
**Files:** `OrgCheckin.html` (Settings UI + audio playback hooks + upload UI), `irlid-api-org/src/index.js` (Worker — extend settings save/load + new upload endpoint), `irlid-api-org/schema.sql` (D1 column additions to `orgs` table), `irlid-api-org/wrangler.toml` (R2 bucket binding).
**Depends on:** Brief A merged (`v5.9.0.14`). No protocol changes.
**Scope:** Audio feedback at the doorman station — one configurable wav per Active Outcome (`accept` / `review` / `deny`), played the moment the outcome flashes on screen. Files are **uploaded by the Lead Admin via the dashboard** (stored in Cloudflare R2 under the org's namespace), not URL-references. Captain has a small library of wavs he wants to try and prefers not to host them externally.

---

## Background

Captain's intent: the Active Outcomes panel currently shows a coloured flash + QR change when a check-in lands. Add audio per outcome so the doorman (or anyone within earshot) gets a non-visual confirmation that's harder to miss in a busy room. Three slots, one per outcome class, all optional — if no URL is set for an outcome, that outcome stays silent.

## Settings UI — `OrgCheckin.html`, Settings panel

Add a new section **"Outcome audio"** in the Settings panel. Section gating: `data-min-role="lead_admin"` for v5.9.0.17 (will relax to Manager+ once A1 lands per-item gating). Recommended placement: directly after the Celebration effects card and before Theme Import — the audio sits naturally with the celebration vocabulary.

The section contains three rows, one per outcome:

| Outcome | Hidden field | Visible controls |
|---|---|---|
| Accept | `acceptWavKey` | filename label · ▶ Preview · ⤴ Upload · 🗑 Clear |
| Review | `reviewWavKey` | filename label · ▶ Preview · ⤴ Upload · 🗑 Clear |
| Deny | `denyWavKey` | filename label · ▶ Preview · ⤴ Upload · 🗑 Clear |

The hidden field holds the **R2 object key** (e.g. `audio/{org_id}/accept-1715692800.wav`) — not a user-facing URL. The visible filename label shows the original filename + duration + size (e.g. `chime-soft.wav · 0:08 · 124 KB`). Empty state shows "No file uploaded — outcome will be silent."

**Upload control behaviour:**

- ⤴ Upload opens a native file picker constrained to `.wav, .mp3, audio/wav, audio/mpeg`.
- Client-side validation before POSTing:
  - MIME type must match the accept list.
  - File size ≤ **512 KB** (these are short cue sounds, not music — hard cap on the Worker side as well).
  - Filename sanitised — strip path components, normalise to `[a-zA-Z0-9._-]`, max 64 chars.
- POSTs `multipart/form-data` to `POST /org/audio/upload?outcome={accept|review|deny}`.
- Worker streams the file body into R2 at key `audio/{org_id}/{outcome}-{ms_timestamp}.{ext}`, persists `{outcome}_wav_key` + `{outcome}_wav_filename` + `{outcome}_wav_size_bytes` to the orgs row, returns `{ ok: true, key, filename, size, duration_ms }`.
- Client updates the row UI inline (no full page reload).
- ▶ Preview plays the audio via a signed-URL GET (see Worker section below) through a transient `Audio` element.
- 🗑 Clear DELETEs the R2 object via `DELETE /org/audio/{outcome}` and NULLs the columns on the orgs row.

Show a brief inline error if upload fails (size, MIME, or network).

## D1 schema — three columns × three fields = nine, on `orgs`

```sql
ALTER TABLE orgs ADD COLUMN accept_wav_key TEXT;
ALTER TABLE orgs ADD COLUMN accept_wav_filename TEXT;
ALTER TABLE orgs ADD COLUMN accept_wav_size_bytes INTEGER;
ALTER TABLE orgs ADD COLUMN review_wav_key TEXT;
ALTER TABLE orgs ADD COLUMN review_wav_filename TEXT;
ALTER TABLE orgs ADD COLUMN review_wav_size_bytes INTEGER;
ALTER TABLE orgs ADD COLUMN deny_wav_key TEXT;
ALTER TABLE orgs ADD COLUMN deny_wav_filename TEXT;
ALTER TABLE orgs ADD COLUMN deny_wav_size_bytes INTEGER;
```

Default NULL (silent). Migration is additive.

## R2 bucket — `wrangler.toml`

Add an R2 bucket binding to `irlid-api-org/wrangler.toml`:

```toml
[[r2_buckets]]
binding = "ORG_AUDIO"
bucket_name = "irlid-org-audio"
preview_bucket_name = "irlid-org-audio-preview"  # for `wrangler dev`
```

Create the bucket via `wrangler r2 bucket create irlid-org-audio` (Mr. Data documents the prerequisite in the PR description so Captain can run it once on the production account before merge).

## Worker — three new endpoints

### `POST /org/audio/upload?outcome={accept|review|deny}`

- **Auth:** `requireDevOrStaffSession` + role check (Lead Admin or Developer, matching the Settings section gating).
- **Body:** `multipart/form-data` with a single `file` field.
- **Validation:**
  - `outcome` query param must match `^(accept|review|deny)$`.
  - File MIME must be `audio/wav` or `audio/mpeg`.
  - File size ≤ 524288 bytes (512 KB). Reject with `413 file_too_large`.
  - Filename sanitised server-side as well — never trust the client's sanitisation.
- **Behaviour:**
  1. Generate R2 key: `audio/{org_id}/{outcome}-{ms_timestamp}.{ext}` (ext from validated MIME).
  2. If existing `{outcome}_wav_key` is non-null, DELETE the old R2 object first (don't leak storage).
  3. `env.ORG_AUDIO.put(key, fileBody, { httpMetadata: { contentType } })`.
  4. UPDATE orgs SET `{outcome}_wav_key`, `{outcome}_wav_filename`, `{outcome}_wav_size_bytes` for this org.
- **Response:** `{ ok: true, key, filename, size, outcome }`.

### `GET /org/audio/url?outcome={accept|review|deny}`

- **Auth:** any signed-in session for the org (Staff+, because the doorman station needs this) OR a short-lived attendee session if we eventually want attendee-side audio (out of scope here — Staff+ only for this PR).
- **Behaviour:** Look up `{outcome}_wav_key` on the orgs row. If null, return `204 No Content`. Otherwise, generate a signed R2 URL with a short TTL (10 min) and return `{ url, expires_at }`. Use the Cloudflare R2 presigned-URL helper.
- **Response:** `{ url: "https://...", expires_at: <unix ms> }` or `204`.

### `DELETE /org/audio/{outcome}`

- **Auth:** Lead Admin or Developer.
- **Behaviour:** Look up `{outcome}_wav_key`, DELETE the R2 object (idempotent), NULL the three orgs columns.
- **Response:** `{ ok: true }`.

## Playback wiring — `OrgCheckin.html`

On dashboard load, for each outcome that has a saved key, fetch a signed URL once via `GET /org/audio/url?outcome=X` and construct the `Audio` object:

```js
const outcomeAudio = { accept: null, review: null, deny: null };
async function prefetchOutcomeAudio() {
  for (const outcome of ['accept', 'review', 'deny']) {
    const resp = await fetch(`/org/audio/url?outcome=${outcome}`);
    if (resp.status === 204) continue; // no audio for this outcome
    const { url } = await resp.json();
    const audio = new Audio(url);
    audio.preload = 'auto';
    outcomeAudio[outcome] = audio;
  }
}
```

Signed URLs expire (10 min TTL). The dashboard re-fetches on a 9-minute interval so the cached `Audio` element always has a fresh URL — same lazy-refresh pattern used elsewhere for short-lived tokens.

Hook into `flashDoormanPanel(kind)` (currently at ~line 7784). Map the existing flash kinds to outcome audio:

| `flashDoormanPanel(kind)` | Plays |
|---|---|
| `'success'` | `outcomeAudio.accept` |
| `'walkin'` | `outcomeAudio.accept` (same celebration class) |
| `'error'` | `outcomeAudio.deny` |

Add the review trigger anywhere the doorman flags a check-in as requiring review (search for "review" in the existing manual-check-in / outcome flow — if no explicit review flash exists yet, wire it where the existing review-state code lives; failing that, leave the `review` slot saved but only wired through the **Preview** button until a follow-up brief adds the review trigger).

Playback specifics:

- `audio.currentTime = 0` before `audio.play()` so rapid repeat fires re-play from the start instead of dropping the call.
- Wrap `play()` in `.catch(() => {})` — autoplay-blocked errors must be silent (some browsers block until user gesture; the first manual click on the page satisfies this in practice for doorman stations, but don't let the promise rejection bubble).
- No volume control in this PR — system volume governs (deferred to a future A3a if needed).
- No fade-in / fade-out — wav files are expected to be short (≤2s typical). If the Lead Admin wants a fade, that's in the file they upload.

## Acceptance criteria

1. **Three upload rows visible** in Settings panel "Outcome audio" section (Lead Admin only). Empty state reads "No file uploaded — outcome will be silent."
2. **Upload happy path** — picking a 50KB `.wav` file uploads cleanly, R2 object exists at the expected key, orgs row updates, filename/duration/size shows in the UI.
3. **MP3 also works** — same path with a `.mp3` file.
4. **Size cap enforced** — uploading a 600KB file is rejected client-side AND server-side with `413 file_too_large`.
5. **MIME check** — uploading a `.txt` file with a fake `audio/wav` MIME is rejected (server validates content-type independently).
6. **Replace deletes old** — uploading a new file to a slot that already has one leaves exactly one R2 object for that slot (old one deleted).
7. **Clear deletes** — 🗑 Clear removes the R2 object and NULLs the columns; orgs row reflects this; subsequent check-ins fire silently for that outcome.
8. **Preview plays without saving the orgs row** — wait, scratch that — in this design every upload is saved immediately; Preview just plays the file that's already in R2. Confirm: ▶ Preview on an unsaved slot is disabled.
9. **Signed URL refresh** — after 10+ minutes idle, a check-in still plays audio (the dashboard refreshed the URL lazily).
10. **Accept plays on success flash** — a successful doorman check-in triggers the accept wav within ~100ms of the visual flash.
11. **Deny plays on error flash** — a failed check-in triggers the deny wav.
12. **Rapid-fire OK** — three check-ins in 2 seconds each play their wav from the start (no dropped plays — second/third play `currentTime = 0` and restart).
13. **Autoplay-blocked is silent** — if the browser blocks the very first play before any user gesture, no console error spills out, no UI breakage. After the next click anywhere on the page, audio works normally.
14. **No audio without upload** — orgs with all three slots empty (default state for existing orgs after migration) flash visually but make no sound. No console errors.
15. **Cross-org isolation** — Lead Admin of Org A cannot fetch the signed URL for Org B's audio (signed-URL endpoint reads `org_id` from the session, not from a query param).
16. **Pill bump:** `Build v5.9.0.16` → `Build v5.9.0.17`.

## Out of scope (deferred)

- Per-outcome volume controls.
- Crossfade / overlap behaviour for back-to-back triggers.
- Per-event audio (this is org-level — all events under the org share the wavs).
- Audio on the attendee-facing success/deny pages (this PR is doorman-station only; attendee-side audio is a follow-up).
- Audio library / preset wavs (Mr. Data may bundle one royalty-free preset per slot as a nice-to-have, but it's not required).
- Format conversion / transcoding (the file is stored as-is; whatever the browser can decode plays).

## Style notes

- British spellings.
- Reuse existing settings-card visual styling.
- Audio objects are module-scoped, not per-call constructed — reduces network thrash on rapid-fire check-ins.
- The Preview button is purely client-side — it plays the URL the user is currently typing, not the saved value. Tab focus moving off the field invalidates the pending preview audio object (so editing the URL after preview doesn't leave a dangling reference).

Ship as single PR labelled `v5.9.0.17`. Small surface — expect ~150-250 lines across Worker + Settings UI + playback hooks + schema migration.
