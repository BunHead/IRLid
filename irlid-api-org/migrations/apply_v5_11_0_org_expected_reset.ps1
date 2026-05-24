# One-time v5.11.0 org_expected reset for the remote org D1 database.
# Destructive by design: Captain ratified discarding legacy org_expected rows
# on 24 May 2026 so the calendar port can use the v5.11 table shape.

$ErrorActionPreference = "Stop"

function Invoke-D1Command {
  param([Parameter(Mandatory=$true)][string]$Sql)
  wrangler d1 execute irlid-db-org --remote --command $Sql
}

Write-Host ("Resetting org_expected {0} destructive op. Legacy rows discarded per Captain 24 May ratification." -f [char]0x2014) -ForegroundColor Yellow

Invoke-D1Command "DROP TABLE IF EXISTS org_expected;"

Invoke-D1Command @"
CREATE TABLE org_expected (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  initials TEXT,
  role_key TEXT DEFAULT 'attendee',
  device_pub_fp TEXT,
  email_hint TEXT,
  phone_hint TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  archived_at INTEGER
);
"@

Invoke-D1Command "CREATE INDEX IF NOT EXISTS idx_org_expected_org ON org_expected (org_id, archived_at);"
Invoke-D1Command "CREATE INDEX IF NOT EXISTS idx_org_expected_fp ON org_expected (device_pub_fp) WHERE device_pub_fp IS NOT NULL;"
Invoke-D1Command "CREATE UNIQUE INDEX IF NOT EXISTS uq_org_expected_name ON org_expected (org_id, LOWER(display_name)) WHERE archived_at IS NULL;"

Write-Host ""
Write-Host "v5.11.0 org_expected reset complete." -ForegroundColor Green
