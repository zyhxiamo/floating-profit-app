param(
  [Parameter(Mandatory = $true)]
  [string]$ConfigPath
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$config = Get-Content -Raw -LiteralPath $ConfigPath | ConvertFrom-Json
$required = @("envId", "adminEmail", "apiBaseUrl", "authGatewayUrl", "downloadUrl")
foreach ($key in $required) {
  if (-not $config.$key) { throw "Missing CloudBase config value: $key" }
}

$apiBase = $config.apiBaseUrl.TrimEnd("/")
$authGateway = $config.authGatewayUrl.TrimEnd("/")
$websiteConfig = @"
window.FLOATING_PROFIT_CONFIG = {
  apiBaseUrl: "$apiBase",
  authGatewayUrl: "$authGateway",
  fallbackDownloadUrl: "https://github.com/zyhxiamo/floating-profit-app/releases/latest/download/floating-profit-app-green-latest.zip",
  baiduDownloadUrl: "$($config.baiduDownloadUrl)"
};
"@
Set-Content -LiteralPath (Join-Path $projectRoot "docs\config.js") -Value $websiteConfig -Encoding utf8

$appConfig = @"
module.exports = {
  API_BASE_URL: "$apiBase"
};
"@
Set-Content -LiteralPath (Join-Path $projectRoot "src\runtime-config.js") -Value $appConfig -Encoding utf8

$cloudbaseConfig = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "cloudbaserc.json")
$cloudbaseConfig = $cloudbaseConfig.Replace("{{CLOUDBASE_ENV_ID}}", $config.envId)
$cloudbaseConfig = $cloudbaseConfig.Replace("{{ADMIN_EMAIL}}", $config.adminEmail)
$cloudbaseConfig = $cloudbaseConfig.Replace("{{AUTH_GATEWAY_URL}}", $authGateway)
$cloudbaseConfig = $cloudbaseConfig.Replace("{{DOWNLOAD_URL}}", $config.downloadUrl)
Set-Content -LiteralPath (Join-Path $projectRoot "cloudbaserc.generated.json") -Value $cloudbaseConfig -Encoding utf8

Write-Output "Configured CloudBase env: $($config.envId)"
