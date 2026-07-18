#!/bin/zsh
# 双击此文件即可安装 macOS 本机搜索服务。
set -euo pipefail

script_dir="${0:A:h}"
cd "$script_dir"

if ! command -v uv >/dev/null 2>&1; then
  if ! /usr/bin/osascript -e 'display dialog "本机搜索服务需要 uv；它会自动管理 Python 3.12。现在安装吗？" buttons {"取消", "安装"} default button "安装" with icon note'; then
    print "已取消安装。"
    exit 0
  fi
  /bin/sh -c "$(/usr/bin/curl -LsSf https://astral.sh/uv/install.sh)"
  export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
fi

uv_path="$(command -v uv || true)"
if [[ -z "$uv_path" ]]; then
  print -u2 "uv 安装后未在 PATH 中找到。请重新打开终端后再双击本文件。"
  exit 1
fi

"$script_dir/install.sh" --uv

folder="$(/usr/bin/osascript -e 'POSIX path of (choose folder with prompt "选择要搜索 Markdown 文件的目录（可稍后在扩展弹窗中更改）")' 2>/dev/null || true)"
if [[ -n "$folder" ]]; then
  "$uv_path" run --no-project --python 3.12 python - "$folder" <<'PY'
import sys
import native_host

result = native_host.configure({"roots": [sys.argv[1].rstrip("/")], "includeHidden": False})
if not result["ok"]:
    raise SystemExit(result["error"])
print(f"已建立索引：{result['fileCount']} 个 Markdown 文件")
PY
fi

/usr/bin/open -a "Google Chrome" "chrome://extensions" 2>/dev/null || true
/usr/bin/osascript -e 'display dialog "安装完成。请确认扩展已在 Chrome 的扩展程序页加载；然后点击浏览器工具栏中的 Local Markdown Search 图标即可搜索。" buttons {"完成"} default button "完成" with icon note'
