param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-p]{32}$')]
  [string]$ExtensionId,
  [string]$PythonPath,
  [switch]$UseUv
)

$ErrorActionPreference = 'Stop'
if ($UseUv -and $PythonPath) {
  throw '请在 -UseUv 与 -PythonPath 中二选一。'
}

$hostName = 'com.local.md_search'
$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$hostScript = Join-Path $scriptDirectory 'native_host.py'
$appDataDirectory = Join-Path $env:LOCALAPPDATA 'LocalMarkdownSearch'
$launcherPath = Join-Path $appDataDirectory 'run_native_host.cmd'
$manifestDirectory = Join-Path $appDataDirectory 'NativeMessagingHosts'
$manifestPath = Join-Path $manifestDirectory "$hostName.json"
$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName"

if (-not (Test-Path $hostScript)) {
  throw "未找到本机服务脚本：$hostScript"
}

if ($UseUv -or -not $PythonPath) {
  $uv = Get-Command uv -ErrorAction SilentlyContinue
  if (-not $uv) { throw '未找到 uv。请先安装 uv，或使用 -PythonPath 指定 Python 3。' }
  $launcherCommand = "`"$($uv.Source)`" run --no-project --python 3.12 `"$hostScript`" %*"
} else {
  if ($PythonPath) {
    if (-not (Test-Path $PythonPath)) { throw "Python 路径不存在：$PythonPath" }
    $pythonCommand = (Resolve-Path $PythonPath).Path
    $pythonArguments = ''
  } else {
    $python = Get-Command python -ErrorAction SilentlyContinue
    $py = Get-Command py -ErrorAction SilentlyContinue
    if ($python) {
      $pythonCommand = $python.Source
      $pythonArguments = ''
    } elseif ($py) {
      $pythonCommand = $py.Source
      $pythonArguments = '-3 '
    } else {
      throw '未找到 Python 3。请安装 Python、使用 -PythonPath 指定解释器，或安装 uv 后使用 -UseUv。'
    }
  }
  $launcherCommand = "`"$pythonCommand`" $pythonArguments`"$hostScript`" %*"
}

New-Item -ItemType Directory -Force -Path $appDataDirectory, $manifestDirectory | Out-Null
$launcherContent = "@echo off`r`n$launcherCommand`r`n"
[System.IO.File]::WriteAllText($launcherPath, $launcherContent, [System.Text.UTF8Encoding]::new($false))

$manifest = @{
  name = $hostName
  description = 'Local Markdown Search native host'
  path = $launcherPath
  type = 'stdio'
  allowed_origins = @("chrome-extension://$ExtensionId/")
}
$manifest | ConvertTo-Json -Depth 3 | Set-Content -Encoding UTF8 $manifestPath
New-Item -Path $registryPath -Force | Out-Null
Set-ItemProperty -Path $registryPath -Name '(Default)' -Value $manifestPath

Write-Host "已注册本机搜索服务：$manifestPath"
Write-Host "运行时启动器：$launcherPath"
