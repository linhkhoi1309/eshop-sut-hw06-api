<#
  Starts the EShop backend and waits until it answers, then seeds the fixtures.

  Order matters: sut/backend/database.js DROPs and re-seeds every table at module
  load, so seeding before the server is up is silently discarded.
#>
param(
  [int]$Port = 3000,
  [switch]$NoSeed
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $PSScriptRoot ".sut.pid"
$logFile = Join-Path $PSScriptRoot "sut.log"

# Kill a previous instance so the DB is genuinely fresh.
if (Test-Path $pidFile) {
  $old = Get-Content $pidFile
  try { Stop-Process -Id $old -Force -ErrorAction Stop; Write-Host "Stopped previous SUT (pid $old)." } catch {}
  Remove-Item $pidFile -Force
}

# Deliberately NOT -NoNewWindow: that makes the child inherit this console's stdout
# handle, and a Git Bash caller then blocks until the SUT exits - the script looks
# like it hung. Its own window keeps it fully detached; output still goes to the log.
$proc = Start-Process -FilePath "node" `
  -ArgumentList (Join-Path $root "sut\backend\server.js") `
  -WorkingDirectory $root -PassThru -WindowStyle Hidden `
  -RedirectStandardOutput $logFile -RedirectStandardError "$logFile.err"
$proc.Id | Out-File -FilePath $pidFile -Encoding ascii

Write-Host "SUT starting (pid $($proc.Id)) on port $Port ..."

$deadline = (Get-Date).AddSeconds(30)
$ready = $false
while ((Get-Date) -lt $deadline) {
  try {
    Invoke-WebRequest -Uri "http://localhost:$Port/api/products" -UseBasicParsing -TimeoutSec 2 | Out-Null
    $ready = $true
    break
  } catch { Start-Sleep -Milliseconds 500 }
}

if (-not $ready) {
  Write-Error "SUT did not become ready within 30s. See $logFile"
  exit 1
}
Write-Host "SUT ready at http://localhost:$Port"

if (-not $NoSeed) {
  Push-Location $root
  node scripts/seed-api-data.js
  Pop-Location
}
