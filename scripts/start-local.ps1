$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$dataDir = Join-Path $repoRoot ".local\postgres-data"
if (-not (Test-Path (Join-Path $pgBin "pg_ctl.exe"))) {
  throw "PostgreSQL 18 tools were not found at $pgBin. Install PostgreSQL or update pgBin in this launcher."
}
if (-not (Test-Path $dataDir)) {
  throw "The private development database is missing. Restore .local\postgres-data before starting."
}
$envFile = Join-Path $repoRoot ".env.local"
if (-not (Test-Path $envFile)) {
  throw "The local environment file is missing. Restore the private .env.local setup before starting."
}

# Process environment overrides dotenv values, including credentials inherited from the operator shell.
foreach ($line in Get-Content $envFile) {
  if ($line -match '^\s*([^#=\s]+)\s*=\s*(.*)\s*$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
  }
}
$expectedDatabaseUrl = (Get-Content -Raw (Join-Path $repoRoot ".local\database-url.secret")).Trim()
if ($env:DATABASE_URL -ne $expectedDatabaseUrl) {
  throw "The private local PostgreSQL URL was not loaded. Restore the ignored local setup files."
}
if (-not $env:SESSION_SECRET) { throw "The local session secret is missing from .env.local." }

& (Join-Path $pgBin "pg_isready.exe") -h 127.0.0.1 -p 5433 *> $null
if ($LASTEXITCODE -ne 0) {
  & (Join-Path $pgBin "pg_ctl.exe") -D $dataDir -o "-h 127.0.0.1 -p 5433" -l (Join-Path $repoRoot ".local\postgres.log") start
  if ($LASTEXITCODE -ne 0) { throw "The private PostgreSQL server did not start. Check .local\postgres.log." }
}

Write-Host "Newsroom lokal: http://localhost:3000"
Write-Host "Tekan Ctrl+C untuk menghentikan aplikasi. Database lokal berjalan terpisah di port 5433."
& npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
exit $LASTEXITCODE
