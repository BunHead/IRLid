# Idempotent v5.11.0 calendar schema migration for the remote org D1 database.
# Tables: rooms, org_expected, weekly_events, event_expected.
# Safe to re-run because schema creation uses IF NOT EXISTS.

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

function Test-HasColumns {
  param(
    [Parameter(Mandatory=$true)][object[]]$Rows,
    [Parameter(Mandatory=$true)][string[]]$RequiredColumns
  )
  $names = @($Rows | ForEach-Object { $_.name })
  foreach ($column in $RequiredColumns) {
    if ($names -notcontains $column) {
      return $false
    }
  }
  return $true
}

Invoke-D1Command @"
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  label TEXT NOT NULL,
  subname TEXT DEFAULT '',
  capacity INTEGER DEFAULT 0,
  display_ix INTEGER DEFAULT 0,
  venue_qr_payload_hash TEXT,
  created_at INTEGER NOT NULL,
  archived_at INTEGER
);
"@
Invoke-D1Command "CREATE INDEX IF NOT EXISTS idx_rooms_org ON rooms (org_id, archived_at);"
Invoke-D1Command "CREATE UNIQUE INDEX IF NOT EXISTS uq_rooms_org_label ON rooms (org_id, label) WHERE archived_at IS NULL;"

$orgExpectedColumns = Get-D1Rows "PRAGMA table_info(org_expected);"
if ($orgExpectedColumns.Count -eq 0) {
  Invoke-D1Command @"
CREATE TABLE IF NOT EXISTS org_expected (
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
} elseif (Test-HasColumns $orgExpectedColumns @("org_id", "display_name", "archived_at", "device_pub_fp")) {
  Invoke-D1Command "CREATE INDEX IF NOT EXISTS idx_org_expected_org ON org_expected (org_id, archived_at);"
  Invoke-D1Command "CREATE INDEX IF NOT EXISTS idx_org_expected_fp ON org_expected (device_pub_fp) WHERE device_pub_fp IS NOT NULL;"
  Invoke-D1Command "CREATE UNIQUE INDEX IF NOT EXISTS uq_org_expected_name ON org_expected (org_id, LOWER(display_name)) WHERE archived_at IS NULL;"
} else {
  Write-Host ""
  Write-Host "org_expected already exists with a legacy shape; leaving it untouched per PR-A no-mutations scope." -ForegroundColor Yellow
  Write-Host "PR-B must resolve the legacy/new org_expected mapping before using calendar Expected endpoints." -ForegroundColor Yellow
}

Invoke-D1Command @"
CREATE TABLE IF NOT EXISTS weekly_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  room_id TEXT,
  name TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,
  start_time_local TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  capacity INTEGER,
  color_hex TEXT,
  notes TEXT,
  require_proof INTEGER DEFAULT 0,
  late_grace_min INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  archived_at INTEGER
);
"@
Invoke-D1Command "CREATE INDEX IF NOT EXISTS idx_weekly_events_org_dow ON weekly_events (org_id, day_of_week, start_time_local);"
Invoke-D1Command "CREATE INDEX IF NOT EXISTS idx_weekly_events_room ON weekly_events (room_id);"

Invoke-D1Command @"
CREATE TABLE IF NOT EXISTS event_expected (
  event_id TEXT NOT NULL,
  expected_id TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  added_by TEXT,
  PRIMARY KEY (event_id, expected_id)
);
"@
Invoke-D1Command "CREATE INDEX IF NOT EXISTS idx_event_expected_event ON event_expected (event_id);"
Invoke-D1Command "CREATE INDEX IF NOT EXISTS idx_event_expected_person ON event_expected (expected_id);"

Write-Host ""
Write-Host "v5.11.0 calendar schema migration complete." -ForegroundColor Green
Write-Host "Safe to re-run; no existing tables are mutated." -ForegroundColor Yellow
