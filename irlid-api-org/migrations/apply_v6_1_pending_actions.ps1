$ErrorActionPreference = "Stop"

$dbName = "irlid-db-org"
$sql = @"
CREATE TABLE IF NOT EXISTS pending_action_authorizations (
  nonce TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organisations(id),
  requestor_user_id TEXT REFERENCES portal_users(id),
  action_type TEXT NOT NULL,
  action_payload_json TEXT NOT NULL,
  action_summary TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  claimed_at INTEGER,
  signed_envelope_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  action_result_json TEXT,
  fail_count INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_pending_actions_org ON pending_action_authorizations(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_actions_expires ON pending_action_authorizations(expires_at);
CREATE INDEX IF NOT EXISTS idx_pending_actions_status ON pending_action_authorizations(status);
"@

$tmp = New-TemporaryFile
try {
  Set-Content -LiteralPath $tmp.FullName -Value $sql -Encoding UTF8
  wrangler d1 execute $dbName --file $tmp.FullName
} finally {
  Remove-Item -LiteralPath $tmp.FullName -Force -ErrorAction SilentlyContinue
}
