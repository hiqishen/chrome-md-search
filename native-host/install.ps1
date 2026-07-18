param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-p]{32}$')]
  [string]$ExtensionId
)

$ErrorActionPreference = 'Stop'
$hostName = 'com.local.md_search'
$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$hostCommand = Join-Path $scriptDirectory 'native_host.cmd'
$manifestDirectory = Join-Path $env:LOCALAPPDATA 'LocalMarkdownSearch\NativeMessagingHosts'
$manifestPath = Join-Path $manifestDirectory "$hostName.json"
$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName"

if (-not (Test-Path $hostCommand)) {
  throw "未找到本机服务启动文件：$hostCommand"
}
if (-not (Get-Command py -ErrorAction SilentlyContinue) -and -not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw '未找到 Python 3。请先从 https://www.python.org/downloads/windows/ 安装 Python，并勾选 Add Python to PATH。'
}

New-Item -ItemType Directory -Force -Path $manifestDirectory | Out-Null
$manifest = @{
  name = $hostName
  description = 'Local Markdown Search native host'
  path = $hostCommand
  type = 'stdio'
  allowed_origins = @("chrome-extension://$ExtensionId/")
}
$manifest | ConvertTo-Json -Depth 3 | Set-Content -Encoding UTF8 $manifestPath
New-Item -Path $registryPath -Force | Out-Null
Set-ItemProperty -Path $registryPath -Name '(Default)' -Value $manifestPath

Write-Host "已注册本机搜索服务：$manifestPath"
