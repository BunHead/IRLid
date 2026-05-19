# PROTOCOL.md §X — Records-Broker chapter (DRAFT)

**Status:** Draft proposal — Tuesday 19 May 2026 morning watch.
**Authoring crew:** Number One.
**Promotion target:** `PROTOCOL.md` next free section number (likely §15 or §16 depending on §14 / §15.5 numbering settlement).
**Cross-references:** `SETTINGS-REVAMP-SPEC.md §8`, `THREAT-MODEL.md §III` (privacy of identity documents).

---

## X.1 — Statement of intent

**IRLid brokers identity documents and receipts. IRLid does not store them.**

This is an architectural commitment, not a configuration setting. It is true on day one of any org's deployment, true for every attendee, and not toggleable by org policy.

The Worker (`irlid-api-org`) and its D1 database (`irlid-db-org`) hold no document bytes from any attendee at any time. Documents flow through the IRLid surface only as transient streams; the destination is always a storage account controlled by the org or attendee, never controlled by Anthropic or the IRLid infrastructure.

What IRLid retains is:
1. The **SHA-256 hash** of each document at the moment of brokerage.
2. The **reference** to where the document was placed (provider, path, ID).
3. The **timestamp** of brokerage.
4. The **attendee user id** the document attests to.

Nothing else. No copy. No cache. No backup.

---

## X.2 — Why broker-not-store

### X.2.1 Threat surface reduction
A breach of IRLid Worker / D1 reveals: hashes, references, timestamps, attendee IDs. It does NOT reveal: passport scans, driver's licences, NI cards, signed consent forms, medical disclosures, or any other identity document an org may need to retain.

### X.2.2 Legal posture
Many jurisdictions treat identity documents as Special Category Personal Data (GDPR Art. 9 equivalent). Storing them creates compliance obligations (retention limits, data-subject-access response timelines, breach notification deadlines, cross-border transfer assessments). IRLid avoids these obligations entirely by not being the controller of the documents.

The org IS the controller. The org's chosen destination (Google Drive, OneDrive, SFTP, etc.) is the processor. IRLid is only the route.

### X.2.3 Survivability
If IRLid the company is wound up tomorrow, the org's documents are unaffected — they live in the org's own storage, accessed directly by the org. IRLid's hash + reference is auxiliary verification data; useful for tamper-detection, not load-bearing for document recovery.

The 100-year roadmap framing depends on this. Documents that need to survive a century cannot depend on a single 21st-century company's continuity.

---

## X.3 — Brokerage flow

### X.3.1 First-time enrolment

1. Attendee scans venue QR for the first time at an org expecting ID verification.
2. Worker recognises new device fingerprint, returns `enrolment_required: true` + the org's configured destination connector.
3. Attendee's client (phone) initiates a direct upload to the org's destination:
   - For OAuth providers (Google Drive, OneDrive, Dropbox, Box): Worker mints a one-shot signed token for the attendee. Attendee browser uses the token to POST directly to the provider's resumable upload endpoint.
   - For S3 / R2: Worker mints a pre-signed PUT URL valid for 5 minutes.
   - For SFTP: Worker issues short-lived credentials, attendee client uses WebSocket-to-SFTP tunnel.
   - For Webhook: attendee POSTs to the org's webhook URL with a Worker-signed envelope.
4. While the upload is in flight, attendee's client also computes SHA-256 of the file (Web Crypto API).
5. On upload-success: client calls `POST /org/records/upload-complete` with `{ hash, destination_ref, timestamp, device_pub_fp }`. Worker writes a `records_references` row.

The document NEVER touches IRLid infrastructure. The Worker only sees the hash + destination reference.

### X.3.2 Subsequent check-ins

Attendee scans venue QR. Worker recognises device_pub_fp, looks up the `records_references` row for that attendee + org. Returns to the org: "this attendee was enrolled on 2026-03-14 with hash `abc...` at `gdrive://orgname/identity-docs/spencer-austin.pdf`."

The org's staff can verify the document is still intact by:
1. Fetching the file from their own storage.
2. Re-hashing it client-side.
3. Comparing to IRLid's stored hash.

Match = tamper-free, identity confirmed. Mismatch = file modified or substituted; org investigates via its own provenance.

### X.3.3 Verification by third parties

When a receipt is verified at `irlid.co.uk/check.html`, the receipt's `records_hash_ref` (if present) confirms that an identity document existed at brokerage time. The third party does not get the document — they get the existence claim. To inspect the document itself, the third party must contact the org through ordinary channels (the org IS the controller).

---

## X.4 — Schema

### X.4.1 `org_storage_connectors`
| Column        | Type    | Notes                                                     |
|---------------|---------|-----------------------------------------------------------|
| `id`          | TEXT PK | `conn_` prefix                                            |
| `org_id`      | TEXT    | FK → organisations.id                                     |
| `type`        | TEXT    | `gdrive` / `onedrive` / `dropbox` / `box` / `s3` / `r2` / `sftp` / `webhook` |
| `config_json` | TEXT    | Provider-specific config (encrypted at rest via D1 KMS)   |
| `is_default`  | INTEGER | 1 = use as default for new attendee uploads               |
| `created_at`  | INTEGER |                                                           |
| `disabled_at` | INTEGER | NULL = active; soft-disable preserves history             |

### X.4.2 `records_references`
| Column            | Type    | Notes                                                  |
|-------------------|---------|--------------------------------------------------------|
| `id`              | TEXT PK | `rec_` prefix                                          |
| `org_id`          | TEXT    | FK → organisations.id                                  |
| `attendee_user_id`| TEXT    | FK → portal_users.id (the IRLid identity)              |
| `connector_id`    | TEXT    | FK → org_storage_connectors.id (which destination)     |
| `hash_sha256`     | TEXT    | 64-char lowercase hex                                  |
| `destination_ref` | TEXT    | Provider-specific reference (file_id, S3 URL, etc.)    |
| `enrolled_at`     | INTEGER | Unix seconds; this is the "first scan" timestamp       |
| `replaced_by`     | TEXT    | NULL = current; else FK to a newer records_references row (for re-enrolment) |

Indexes: `(org_id, attendee_user_id) WHERE replaced_by IS NULL`, `(hash_sha256)` for cross-org de-duplication queries (admin only).

---

## X.5 — Worker endpoints

| Method | Path                                  | Auth        | Purpose                                                                |
|--------|---------------------------------------|-------------|------------------------------------------------------------------------|
| POST   | `/org/records/connector`              | lead_admin+ | Register / update a destination connector                              |
| GET    | `/org/records/connector`              | manager+    | List destinations                                                       |
| DELETE | `/org/records/connector/:id`          | lead_admin+ | Soft-disable a connector (sets `disabled_at`)                          |
| POST   | `/org/records/upload-init`            | (attendee)  | Mint upload credentials for the attendee's session                     |
| POST   | `/org/records/upload-complete`        | (attendee)  | Record the hash + reference; finalize brokerage                        |
| GET    | `/org/records/verify/:attendee_id`    | staff+      | Return hash + ref for verification at the door                         |
| POST   | `/org/records/rehash-challenge/:id`   | staff+      | Issue a server-signed challenge for org-to-attendee verification       |

`/org/records/upload-init` returns the appropriate provider's upload mechanism based on the org's default connector:
- OAuth providers: a one-shot upload URL + token bundle.
- S3/R2: a pre-signed PUT URL.
- SFTP: WebSocket tunnel credentials.
- Webhook: a Worker-signed envelope template the client POSTs to the org's webhook.

The Worker NEVER proxies the upload itself. It only signs / mints credentials.

---

## X.6 — Trust model

### X.6.1 What the org trusts
The org trusts:
1. **The destination provider** — Google, Microsoft, AWS, etc. — to hold their documents.
2. **IRLid Worker** — only to mint correct upload credentials and record correct hashes.
3. **The attendee's client device** — to compute the hash honestly during upload.

### X.6.2 What the attendee trusts
The attendee trusts:
1. **The destination provider** — same as the org.
2. **IRLid Worker** — to not retain the document (which it can't anyway).
3. **The org** — to handle their document according to the org's published policy (which the attendee accepted at first scan).

### X.6.3 What IRLid trusts
IRLid trusts:
1. **Attendee's device hash** — IRLid does NOT verify this against the actual file (which it can't see). If the device lies about the hash, the lie surfaces later when org staff re-hash and find a mismatch — that's the org's domain.
2. **Provider's webhook signatures** — for OAuth provider acknowledgments.

IRLid does NOT trust the destination to be available, performant, or recoverable. That's the org's risk to manage.

---

## X.7 — Re-enrolment

When an attendee replaces their identity document (lost ID, name change, photo update), the flow is:
1. New upload via the standard pipeline.
2. New `records_references` row created.
3. Old row's `replaced_by` field updated to the new row's id.
4. Receipts referencing the OLD row still verify correctly — the old hash still corresponds to the document the org had at receipt-issue time. The org's storage may have replaced the file, but historical receipts validate against the historical hash.

This is the IRLid "immutable receipts, mutable underlying records" pattern. Aligns with the existing "DB: immutable, warts-and-all" design principle in `CLAUDE.md`.

---

## X.8 — Cross-references

- `SETTINGS-REVAMP-SPEC.md §8` — UI for org-level connector configuration (Records & ID tab).
- `THREAT-MODEL.md §III.2` — covers WHY IRLid avoids storing biometric / identity data (localStorage extraction historical context); this chapter extends to documents.
- `PROTOCOL.md §10.4` — multi-party custody receipts may eventually flow through the same broker pattern (prison transfer, drop-off, etc.).

---

## X.9 — Out of scope (banked for future chapters)

- **End-to-end encryption between attendee and destination** — destination provider holds plaintext today. Future chapter: client-side encryption with key sharded between attendee + org.
- **Cross-org records portability** — when an attendee moves from Org A to Org B, can their existing identity document brokerage be re-used? Likely YES, requires explicit attendee consent + a `records_cross_org_grant` table. Future.
- **Retention timelines** — IRLid stores hashes indefinitely by default; orgs can configure auto-expiry. Out of scope here; auto-expiry mechanism specified in a separate chapter.
- **Geographic data-residency** — Cloudflare WEUR region only today. EU / US / APAC variants of `irlid-db-*` for orgs with regional requirements.

---

## X.10 — Sign-off checklist

Before promoting to `PROTOCOL.md` as a numbered chapter:
1. Captain reviews the broker-not-store framing for fit with the 100-year roadmap.
2. Number One + Counsellor Troi review the legal-posture paragraph (X.2.2) for GDPR accuracy.
3. Reg (red-team) audit: what attack does this enable that the old "store nothing" stance didn't already cover?
4. Mr. Data sanity-checks the schema + endpoint contracts against existing v5.5 patterns.

— Number One, drafting from the bath-watch, Tuesday 19 May 2026.
