$pidFile = Join-Path $PSScriptRoot ".sut.pid"
if (-not (Test-Path $pidFile)) { Write-Host "No SUT pid file; nothing to stop."; exit 0 }
$sutPid = Get-Content $pidFile
try {
  Stop-Process -Id $sutPid -Force -ErrorAction Stop
  Write-Host "SUT stopped (pid $sutPid)."
} catch {
  Write-Host "SUT pid $sutPid was not running."
}
Remove-Item $pidFile -Force
