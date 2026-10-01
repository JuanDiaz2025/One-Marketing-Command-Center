# Keeps One Marketing Command Center up to date: start.bat runs this first. It checks GitHub for a
# newer version and, if there is one, downloads it and copies it over the app. Your settings
# (.env.local) and data (.data) are never touched. Exit code 10 means "updated, restart start.bat".
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repo = 'JuanDiaz2025/One-Marketing-Command-Center'
$branch = 'claude/peaceful-einstein-53zbjx'
$root = Split-Path -Parent $PSScriptRoot
$versionFile = Join-Path $root '.data\app-version'

try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $headers = @{ 'User-Agent' = 'OneMarketingCommandCenter-updater'; 'Accept' = 'application/vnd.github+json' }
  $latest = (Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/commits/$branch" -Headers $headers -TimeoutSec 20).sha
} catch {
  Write-Host "Couldn't check for updates (no internet?). Starting the version you have."
  exit 0
}
$current = ''
if (Test-Path $versionFile) { $current = (Get-Content $versionFile -Raw).Trim() }
if ($current -eq $latest) {
  Write-Host 'The app is up to date.'
  exit 0
}

Write-Host 'A new version of the app is out. Downloading it...'
$tmp = Join-Path $env:TEMP ('omcc-update-' + [guid]::NewGuid())
$code = 0
try {
  New-Item -ItemType Directory $tmp | Out-Null
  $zip = Join-Path $tmp 'app.zip'
  Invoke-WebRequest -Uri "https://codeload.github.com/$repo/zip/$latest" -OutFile $zip -UseBasicParsing -TimeoutSec 300
  Expand-Archive $zip -DestinationPath (Join-Path $tmp 'x') -Force
  $src = (Get-ChildItem (Join-Path $tmp 'x') -Directory | Select-Object -First 1).FullName
  if (-not (Test-Path (Join-Path $src 'package.json'))) { throw 'the download looks incomplete' }
  # Everything except your settings, data and installed packages...
  robocopy $src $root /E /XD node_modules .data .next .git src /XF .env.local /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "copying failed ($LASTEXITCODE)" }
  # ...and the app's code exactly as released, so files removed in the update are removed here too.
  robocopy (Join-Path $src 'src') (Join-Path $root 'src') /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "copying failed ($LASTEXITCODE)" }
  New-Item -ItemType Directory -Force (Join-Path $root '.data') | Out-Null
  Set-Content -Path $versionFile -Value $latest -NoNewline
  Write-Host 'Updated to the latest version.'
  $code = 10
} catch {
  Write-Host "The update didn't work ($($_.Exception.Message)). Starting the version you have."
}
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
exit $code
