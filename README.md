# Local Markdown Search

一个 macOS Chrome 扩展：在地址栏输入 `md tmux.md`，即可在已配置目录中检索本地 Markdown 文件，并把路径显示为候选项。选中后由 Chrome 在当前标签页打开该文件。

## 安装

1. 在 Chrome 打开 `chrome://extensions`，启用右上角“开发者模式”。
2. 点击“加载已解压的扩展程序”，选择本仓库中的 `extension` 目录。
3. 复制该扩展显示的 **ID**，在终端运行：

   ```zsh
   cd /Users/zyz/d/codes/cx/chrome-md-search/native-host
   ./install.sh <扩展 ID>
   ```

   如果 Chrome 通过 `--user-data-dir` 使用自定义用户数据目录，请在安装时指定同一目录：

   ```zsh
   CHROME_USER_DATA_DIR=/path/to/chrome-profile ./install.sh <扩展 ID>
   ```

4. 在 `chrome://extensions` 的本扩展详情中，开启“允许访问文件网址”。
5. 点击扩展图标，在“搜索目录”中每行添加一个绝对路径并保存，例如：

   ```text
   /Users/zyz/d/codes/stats
   ```

## 使用

- 地址栏：输入 `md tmux.md`（也可以只输入 `md tmux`），在候选项中选择文件。
- 弹窗：输入关键词即可实时搜索，也可点击“搜索”。
- 普通模式不区分大小写，按文件名包含匹配；`tmux.md` 会找到 `003_tmux.md` 和 `003_doc_tmux.md`。
- 开启“使用正则表达式”后，可以选择按文件名或完整路径匹配。示例：`^003_.*tmux\\.md$`。
- 首次保存目录时会建立 SQLite 索引；扩展每分钟自动刷新一次，也可以在弹窗点击“立即刷新”。
- 默认跳过 `.venv`、`.git` 等隐藏目录；如需检索它们，在弹窗勾选“包含隐藏目录”。
- 文件被打开的次数会保存在本机索引中，并作为同等文本相关度下的排序权重；不会上传任何使用记录。

## 卸载本机服务

```zsh
rm "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.local.md_search.json"
```

本机服务配置保存在：

```text
~/Library/Application Support/LocalMarkdownSearch/config.json
```

## 自动发布

执行 `zsh scripts/package.sh` 会生成扩展和 macOS 本机服务安装包。推送 `v*` 标签会由 GitHub Actions 自动创建 GitHub Release 并上传这两个包。

用户可从 GitHub Release 下载扩展包，解压后在 `chrome://extensions` 开启开发者模式并选择“加载已解压的扩展程序”；随后下载、解压本机服务包，再按本说明运行 `install.sh`。
