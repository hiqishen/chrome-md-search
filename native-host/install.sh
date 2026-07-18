#!/bin/zsh
set -euo pipefail

if [[ $# -ne 1 ]]; then
  print "用法：$0 <Chrome 扩展 ID>"
  exit 1
fi

extension_id="$1"
if [[ ${#extension_id} -ne 32 || "$extension_id" == *[^a-p]* ]]; then
  print "Chrome 扩展 ID 格式不正确。"
  exit 1
fi

script_dir="${0:A:h}"
host_path="$script_dir/native_host.py"
manifest_dir="${CHROME_USER_DATA_DIR:-$HOME/Library/Application Support/Google/Chrome}/NativeMessagingHosts"
manifest_path="$manifest_dir/com.local.md_search.json"

chmod +x "$host_path"
mkdir -p "$manifest_dir"

HOST_PATH="$host_path" EXTENSION_ID="$extension_id" MANIFEST_PATH="$manifest_path" python3 - <<'PY'
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
