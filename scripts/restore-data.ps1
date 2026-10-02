# Brings your data back when the app was unzipped into a new folder: start.bat runs this before
# starting. If this copy has no connections yet (no Google Ads sign-in, no WordPress site), it looks
# for an earlier copy of the app on this computer (Desktop, Downloads, Documents, OneDrive) and
# copies its data over: leads, statuses, chats, the WordPress connection and its key, the Google
# Ads sign-in. The earlier copy is left as it is. Whatever this copy had is kept in .data-before-restore.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$data = Join-Path $root '.data'

function Has-Connections($dir) {
  (Test-Path (Join-Path $dir 'google-ads.json')) -or (Test-Path (Join-Path $dir 'wordpress.json'))
}

try {
  if (Has-Connections $data) { exit 0 }

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
          (Test-Path (Join-Path $app 'start.bat')) -and (Has-Connections $_.FullName)
      }
  }
  if (-not $found) { exit 0 }

  # The copy used most recently.
  $best = $found | Sort-Object -Unique FullName | Sort-Object {
    (Get-ChildItem $_.FullName -File -ErrorAction SilentlyContinue | Measure-Object LastWriteTime -Maximum).Maximum
  } -Descending | Select-Object -First 1

  Write-Host "Found your data in an earlier copy of the app: $(Split-Path -Parent $best.FullName)"
  if (Test-Path $data) {
    $keep = Join-Path $root '.data-before-restore'
    if (Test-Path $keep) { Remove-Item $keep -Recurse -Force }
    Move-Item $data $keep
  }
  New-Item -ItemType Directory -Force $data | Out-Null
  Get-ChildItem $best.FullName -Force | Where-Object { $_.Name -ne 'app-version' } | Copy-Item -Destination $data -Recurse -Force
  # Keep this copy's version, so the updater doesn't download it again.
  $version = Join-Path $root '.data-before-restore\app-version'
  if (Test-Path $version) { Copy-Item $version (Join-Path $data 'app-version') -Force }
  Write-Host 'Brought it over: your leads and connections (twinhomebuyer.com, Google Ads) are back.'
} catch {
  Write-Host "Couldn't bring over data from an earlier copy ($($_.Exception.Message)). Starting anyway."
}
exit 0
