#!/bin/zsh
set -euo pipefail

project_dir="${0:A:h:h}"
extension_dir="$project_dir/extension"
native_host_dir="$project_dir/native-host"
dist_dir="$project_dir/dist"

rm -rf "$dist_dir"
mkdir -p "$dist_dir"

if ! python3 -c 'import json, sys; json.load(open(sys.argv[1]))' "$extension_dir/manifest.json"; then
  print -u2 "manifest.json 无效，已停止打包。"
  exit 1
fi

(
  cd "$extension_dir"
  zip -qr "$dist_dir/local-markdown-search-chrome-extension.zip" . -x '*.DS_Store' '__pycache__/*' '*.pyc'
)
(
  cd "$native_host_dir"
  zip -qr "$dist_dir/local-markdown-search-native-host.zip" . -x '*.DS_Store' '__pycache__/*' '*.pyc'
)

print "已生成发布包："
LC_ALL=C /usr/bin/shasum -a 256 "$dist_dir"/*.zip
