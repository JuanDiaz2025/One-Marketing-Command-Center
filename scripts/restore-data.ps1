# Brings your data back when the app was unzipped into a new folder: start.bat runs this before
# starting. If this copy has no data yet (no Google Ads sign-in, no WordPress site, no leads), it
# looks for an earlier copy of the app on this computer (Desktop, Downloads, Documents, OneDrive)
# and copies its data over: leads, statuses, chats, the WordPress connection and its key, the Google
# Ads sign-in (and its settings file, .env.local, if this copy has none). The earlier copy is left
# as it is. Whatever this copy had is kept in .data-before-restore.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$data = Join-Path $root '.data'

function Read-Json($file) {
  if (-not (Test-Path $file)) { return $null }
  try { return (Get-Content $file -Raw | ConvertFrom-Json) } catch { return $null }
}

# Real data, not just the empty files the app makes the first time it opens.
function Has-Data($dir) {
  $ads = Read-Json (Join-Path $dir 'google-ads.json')
  if ($ads -and @($ads.PSObject.Properties).Count -gt 0) { return $true }
  $wp = Read-Json (Join-Path $dir 'wordpress.json')
  if ($wp -and $wp.site) { return $true }
  $leads = Read-Json (Join-Path $dir 'leads.json')
  if ($leads -and $leads.leads -and @($leads.leads).Count -gt 0) { return $true }
  return $false
}

# When the copy was last used (app-version is rewritten by every update, so it doesn't count).
function Last-Used($dir) {
  $newest = Get-ChildItem $dir -File -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ne 'app-version' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($newest) { return $newest.LastWriteTime } else { return [datetime]::MinValue }
}

try {
  if (Has-Data $data) { exit 0 }

  $places = @('Desktop', 'Downloads', 'Documents') | ForEach-Object { Join-Path $env:USERPROFILE $_ }
  $places += Get-ChildItem $env:USERPROFILE -Directory -Filter 'OneDrive*' -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }
  $places += $env:USERPROFILE
  $here = (Resolve-Path $root).Path.TrimEnd('\')

  $found = @()
  foreach ($place in ($places | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique)) {
    $depth = if ($place -eq $env:USERPROFILE) { 2 } else { 4 }
    $found += Get-ChildItem $place -Directory -Filter '.data' -Recurse -Depth $depth -Force -ErrorAction SilentlyContinue |
      Where-Object {
        $app = Split-Path -Parent $_.FullName
        $app.TrimEnd('\') -ne $here -and $_.FullName -notmatch '\\node_modules\\' -and
          (Test-Path (Join-Path $app 'start.bat')) -and (Has-Data $_.FullName)
      }
  }
  if (-not $found) { exit 0 }

  $best = $found | Sort-Object -Unique FullName | Sort-Object { Last-Used $_.FullName } -Descending | Select-Object -First 1
  $from = Split-Path -Parent $best.FullName
  Write-Host "Found your data in an earlier copy of the app: $from"

  # Copy into a new folder first, and only then put it in place, so a failed copy changes nothing.
  $incoming = Join-Path $root '.data-incoming'
  if (Test-Path $incoming) { Remove-Item $incoming -Recurse -Force }
  New-Item -ItemType Directory $incoming | Out-Null
  Get-ChildItem $best.FullName -Force | Where-Object { $_.Name -ne 'app-version' } | Copy-Item -Destination $incoming -Recurse -Force
  # Keep this copy's version, so the updater doesn't download it again.
  $version = Join-Path $data 'app-version'
  if (Test-Path $version) { Copy-Item $version (Join-Path $incoming 'app-version') -Force }

  $keep = Join-Path $root '.data-before-restore'
  if (Test-Path $keep) { Remove-Item $keep -Recurse -Force }
  if (Test-Path $data) { Move-Item $data $keep }
  try {
    Move-Item $incoming $data
  } catch {
    if (Test-Path $keep) { Move-Item $keep $data }
    throw
  }

  # The Google Ads sign-in only works with the settings it was made with.
  $envHere = Join-Path $root '.env.local'
  $envThere = Join-Path $from '.env.local'
  if (-not (Test-Path $envHere) -and (Test-Path $envThere)) { Copy-Item $envThere $envHere }

  Write-Host 'Brought it over: your leads and connections (twinhomebuyer.com, Google Ads) are back.'
} catch {
  Write-Host "Couldn't bring over data from an earlier copy ($($_.Exception.Message)). Starting anyway."
  $incoming = Join-Path $root '.data-incoming'
  if (Test-Path $incoming) { Remove-Item $incoming -Recurse -Force -ErrorAction SilentlyContinue }
}
exit 0
