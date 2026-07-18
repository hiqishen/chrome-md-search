$ErrorActionPreference = 'Stop'
$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDirectory

$uv = Get-Command uv -ErrorAction SilentlyContinue
if (-not $uv) {
  $answer = Read-Host '需要安装 uv（会自动管理 Python 3.12）。现在安装吗？[Y/n]'
  if ($answer -match '^[Nn]') { exit 0 }
  irm https://astral.sh/uv/install.ps1 | iex
  $env:Path = "$HOME\.local\bin;$env:Path"
  $uv = Get-Command uv -ErrorAction SilentlyContinue
  if (-not $uv) { throw '找不到刚安装的 uv。请重新打开此文件。' }
}

& "$scriptDirectory\install.ps1" -UseUv

Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '选择要搜索 Markdown 文件的目录（可稍后在扩展弹窗中更改）'
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  $configureScript = 'import sys, native_host; result = native_host.configure({"roots": [sys.argv[1]], "includeHidden": False}); print(result); raise SystemExit(0 if result["ok"] else 1)'
  & $uv.Source run --no-project --python 3.12 python -c $configureScript $dialog.SelectedPath
  if ($LASTEXITCODE -ne 0) { throw '目录索引创建失败。' }
}

Start-Process 'chrome://extensions' 2>$null
Write-Host '安装完成。请确认扩展已在 Chrome 扩展程序页加载，然后点击工具栏中的 Local Markdown Search 图标即可搜索。'
