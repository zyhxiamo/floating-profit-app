param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$releaseRoot = Join-Path $projectRoot "release"
$unpackedPath = Join-Path $releaseRoot "win-unpacked"
$version = (Get-Content -Raw (Join-Path $projectRoot "package.json") | ConvertFrom-Json).version
$zipPath = Join-Path $releaseRoot "floating-profit-app-green-$version.zip"
$latestZipPath = Join-Path $releaseRoot "floating-profit-app-green-latest.zip"

function Assert-InRelease([string]$Path) {
  $resolvedRelease = [System.IO.Path]::GetFullPath($releaseRoot)
  $resolvedPath = [System.IO.Path]::GetFullPath($Path)
  if (-not $resolvedPath.StartsWith($resolvedRelease, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to modify path outside release folder: $resolvedPath"
  }
}

Assert-InRelease $unpackedPath
Assert-InRelease $zipPath
Assert-InRelease $latestZipPath

if (-not $SkipBuild) {
  if (Test-Path -LiteralPath $unpackedPath) {
    Remove-Item -LiteralPath $unpackedPath -Recurse -Force
  }
  Push-Location $projectRoot
  try {
    npm.cmd run pack
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path -LiteralPath $unpackedPath)) {
  throw "Package folder not found: $unpackedPath"
}

$launcher = @'
@echo off
for %%F in ("%~dp0*.exe") do start "" "%%~fF"
'@
Set-Content -LiteralPath (Join-Path $unpackedPath "launch-app.bat") -Value $launcher -Encoding ascii

$readme = @'
Floating Profit App - Windows green package

1. Double-click the exe file or launch-app.bat to start.
2. The window stays on top by default.
3. Press Alt+Q to hide or show the window.
4. Expand the window to add A-share stock codes.
5. Click the feedback button in the title bar to submit feedback online.
'@
Set-Content -LiteralPath (Join-Path $unpackedPath "README.txt") -Value $readme -Encoding ascii

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}
Compress-Archive -Path (Join-Path $unpackedPath "*") -DestinationPath $zipPath -CompressionLevel Optimal
Copy-Item -LiteralPath $zipPath -Destination $latestZipPath -Force
Write-Output "PACKAGE=$zipPath"
Write-Output "LATEST_PACKAGE=$latestZipPath"
