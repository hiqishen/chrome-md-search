#!/bin/zsh
set -euo pipefail

usage() {
  print "用法：$0 <Chrome 扩展 ID> [--python <解释器绝对路径> | --uv]"
  print "也可通过 LOCAL_MARKDOWN_SEARCH_PYTHON 指定 Python 路径。"
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

extension_id="$1"
shift
if [[ ${#extension_id} -ne 32 || "$extension_id" == *[^a-p]* ]]; then
  print "Chrome 扩展 ID 格式不正确。"
  exit 1
fi

runtime="uv"
python_path="${LOCAL_MARKDOWN_SEARCH_PYTHON:-}"
if [[ -n "$python_path" ]]; then
  runtime="python"
fi
while [[ $# -gt 0 ]]; do
  case "$1" in
    --python)
      [[ $# -ge 2 ]] || { usage; exit 1; }
      runtime="python"
      python_path="$2"
      shift 2
      ;;
    --uv)
      runtime="uv"
      shift
      ;;
    *)
      usage
      exit 1
      ;;
  esac
done

script_dir="${0:A:h}"
host_path="$script_dir/native_host.py"
app_data_dir="$HOME/Library/Application Support/LocalMarkdownSearch"
launcher_path="$app_data_dir/run_native_host.sh"
manifest_dir="${CHROME_USER_DATA_DIR:-$HOME/Library/Application Support/Google/Chrome}/NativeMessagingHosts"
manifest_path="$manifest_dir/com.local.md_search.json"
mkdir -p "$app_data_dir" "$manifest_dir"

if [[ "$runtime" == "uv" ]]; then
  uv_path="$(command -v uv || true)"
  [[ -n "$uv_path" ]] || { print -u2 "未找到 uv。请先安装 uv，或使用 --python 指定 Python 3。"; exit 1; }
  cat > "$launcher_path" <<EOF
#!/bin/zsh
exec "$uv_path" run --no-project --python 3.12 "$host_path" "\$@"
EOF
  manifest_runner=("$uv_path" run --no-project --python 3.12 python)
else
  if [[ -z "$python_path" ]]; then
    python_path="$(command -v python3 || true)"
  fi
  [[ -n "$python_path" && -x "$python_path" ]] || { print -u2 "未找到可执行的 Python 3。请安装 Python、设置 LOCAL_MARKDOWN_SEARCH_PYTHON，或改用 --uv。"; exit 1; }
  cat > "$launcher_path" <<EOF
#!/bin/zsh
exec "$python_path" "$host_path" "\$@"
EOF
  manifest_runner=("$python_path")
fi
chmod +x "$launcher_path" "$host_path"

HOST_PATH="$launcher_path" EXTENSION_ID="$extension_id" MANIFEST_PATH="$manifest_path" "${manifest_runner[@]}" - <<'PY'
import json
import os
from pathlib import Path

manifest = {
    "name": "com.local.md_search",
    "description": "Local Markdown Search native host",
    "path": os.environ["HOST_PATH"],
    "type": "stdio",
    "allowed_origins": [f"chrome-extension://{os.environ['EXTENSION_ID']}/"],
}
Path(os.environ["MANIFEST_PATH"]).write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
PY

print "已注册本机搜索服务：$manifest_path"
print "运行时启动器：$launcher_path"
