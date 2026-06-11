-- v6.4.10 (QR-SLIMMING-SPEC PR-4) - staff invite token-by-reference.
-- Stores the exact encoded "I:" signed-envelope string at issue time so the
-- slim invite QR (nonce-only, ~60 chars vs ~1,560) can be resolved back to the
-- full envelope via GET /org/invites/:nonce/envelope. The accept-time
-- byte-for-byte binding (acceptPayload.invite_token === inviteToken) is
-- unchanged because the fetched string is identical to the issued one.
-- Worker checks this column defensively (orgInvitesHasEnvelopeColumn) so
-- deploy order is safe in both directions.

ALTER TABLE org_invites ADD COLUMN envelope TEXT;
