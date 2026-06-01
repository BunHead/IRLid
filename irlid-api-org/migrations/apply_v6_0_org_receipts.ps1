$ErrorActionPreference = "Stop"

$dbName = "irlid-db-org"
$sql = @"
CREATE TABLE IF NOT EXISTS org_receipts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organisations(id),
  checkin_id TEXT NOT NULL REFERENCES org_checkins(id),
  attendee_pub_fp TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  signature TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  privacy_mode INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_org_receipts_org ON org_receipts(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_receipts_attendee ON org_receipts(attendee_pub_fp, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_receipts_checkin ON org_receipts(checkin_id);
"@

$tmp = New-TemporaryFile
try {
  Set-Content -LiteralPath $tmp.FullName -Value $sql -Encoding UTF8
  wrangler d1 execute $dbName --file $tmp.FullName
} finally {
  Remove-Item -LiteralPath $tmp.FullName -Force -ErrorAction SilentlyContinue
}
