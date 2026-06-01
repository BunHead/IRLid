# Idempotent v6.2 calendar attendance migration.
# Adds per-event attendance assignment without recreating existing calendar tables.

$ErrorActionPreference = "Stop"

function Invoke-D1Command {
  param([Parameter(Mandatory=$true)][string]$Sql)
  wrangler d1 execute irlid-db-org --remote --command $Sql
}

function Get-D1Rows {
  param([Parameter(Mandatory=$true)][string]$Sql)
  $json = wrangler d1 execute irlid-db-org --remote --json --command $Sql
  $result = $json | ConvertFrom-Json
  if (-not $result -or -not $result[0].success) {
    throw "D1 query failed: $Sql"
  }
  return @($result[0].results)
}

$checkinColumns = Get-D1Rows "PRAGMA table_info(org_checkins);"
$columnNames = @($checkinColumns | ForEach-Object { $_.name })

if ($columnNames -notcontains "event_id") {
  Invoke-D1Command "ALTER TABLE org_checkins ADD COLUMN event_id TEXT;"
  Write-Host "Added org_checkins.event_id." -ForegroundColor Green
} else {
  Write-Host "org_checkins.event_id already exists; skipping column add." -ForegroundColor Yellow
}

Invoke-D1Command "CREATE INDEX IF NOT EXISTS idx_checkins_event ON org_checkins (org_id, event_id, checkin_at);"

Write-Host "v6.2 calendar attendance migration complete. Safe to re-run." -ForegroundColor Green
