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
$hostingUrl = $config.hostingUrl.TrimEnd("/")
$websiteConfig = @"
window.FLOATING_PROFIT_CONFIG = {
  apiBaseUrl: "$apiBase",
  authGatewayUrl: "$authGateway",
  fallbackDownloadUrl: "https://github.com/zyhxiamo/floating-profit-app/releases/latest/download/floating-profit-app-green-latest.zip",
  baiduDownloadUrl: "$($config.baiduDownloadUrl)"
};
"@
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $projectRoot "docs\config.js"), $websiteConfig, $utf8NoBom)

$appConfig = @"
module.exports = {
  API_BASE_URL: "$apiBase"
};
"@
[System.IO.File]::WriteAllText((Join-Path $projectRoot "src\runtime-config.js"), $appConfig, $utf8NoBom)

$robots = @"
User-agent: *
Allow: /

Sitemap: $hostingUrl/sitemap.xml
"@
[System.IO.File]::WriteAllText((Join-Path $projectRoot "docs\robots.txt"), $robots, $utf8NoBom)

$sitemap = @"
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>$hostingUrl/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
"@
[System.IO.File]::WriteAllText((Join-Path $projectRoot "docs\sitemap.xml"), $sitemap, $utf8NoBom)

$cloudbaseConfig = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "cloudbaserc.json")
$cloudbaseConfig = $cloudbaseConfig.Replace("{{CLOUDBASE_ENV_ID}}", $config.envId)
$cloudbaseConfig = $cloudbaseConfig.Replace("{{ADMIN_EMAIL}}", $config.adminEmail)
$cloudbaseConfig = $cloudbaseConfig.Replace("{{AUTH_GATEWAY_URL}}", $authGateway)
$cloudbaseConfig = $cloudbaseConfig.Replace("{{DOWNLOAD_URL}}", $config.downloadUrl)
[System.IO.File]::WriteAllText((Join-Path $projectRoot "cloudbaserc.generated.json"), $cloudbaseConfig, $utf8NoBom)

Write-Output "Configured CloudBase env: $($config.envId)"
