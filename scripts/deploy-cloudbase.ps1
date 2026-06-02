param(
  [Parameter(Mandatory = $true)]
  [string]$ConfigPath
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$config = Get-Content -Raw -LiteralPath $ConfigPath | ConvertFrom-Json
Push-Location $projectRoot
try {
  & "$PSScriptRoot\configure-cloudbase.ps1" -ConfigPath $ConfigPath
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot\package-green.ps1"
  if ($LASTEXITCODE -ne 0) { throw "Application package build failed." }
  npm.cmd --prefix cloudfunctions\api install --omit=dev
  npx.cmd -y -p @cloudbase/cli cloudbase fn deploy api --force --config-file cloudbaserc.generated.json -e $config.envId
  if ($LASTEXITCODE -ne 0) { throw "Cloud function deploy failed." }
  $serviceList = npx.cmd -y -p @cloudbase/cli cloudbase service list -e $config.envId --json | Out-String
  if ($LASTEXITCODE -ne 0) { throw "CloudBase HTTP service lookup failed." }
  if ($serviceList -notmatch '"Path"\s*:\s*"/?api"') {
    npx.cmd -y -p @cloudbase/cli cloudbase service create -e $config.envId --service-path api --function api
    if ($LASTEXITCODE -ne 0) { throw "CloudBase HTTP service setup failed." }
  }
  npx.cmd -y -p @cloudbase/cli cloudbase env login set -e $config.envId --email-login true
  if ($LASTEXITCODE -ne 0) { throw "CloudBase email login setup failed." }
  $loginPolicy = npx.cmd -y -p @cloudbase/cli cloudbase env login get -e $config.envId --json | Out-String
  if ($loginPolicy -notmatch '"EmailLogin"\s*:\s*true') {
    Write-Warning "Email verification still needs to be enabled in CloudBase console: Identity Authentication > Login Methods > Email Verification."
  }
  npx.cmd -y -p @cloudbase/cli cloudbase hosting deploy docs -e $config.envId
  if ($LASTEXITCODE -ne 0) { throw "Website deploy failed." }
  npx.cmd -y -p @cloudbase/cli cloudbase hosting deploy release\floating-profit-app-green-latest.zip downloads/floating-profit-app-green-latest.zip -e $config.envId
  if ($LASTEXITCODE -ne 0) { throw "Download package deploy failed." }
} finally {
  Pop-Location
}
