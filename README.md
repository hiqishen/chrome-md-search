# Local Markdown Search

在 Chrome 地址栏输入 `md tmux.md` 或 `md tmux`，搜索用户指定目录中的本地 Markdown 文件。扩展和本机搜索服务都在本地运行，不上传文件内容、路径或搜索记录。

## 从 GitHub 安装并绑定本机

每台电脑都需要完成以下步骤。扩展不会自动绑定到任何人的电脑：本机服务注册时会只允许当前 Chrome 扩展 ID 调用，这是必要的安全限制。

1. 克隆仓库或下载 GitHub Release：

   ```zsh
   git clone git@github.com:hiqishen/chrome-md-search.git
   cd chrome-md-search
   ```

2. 在 Chrome 打开 `chrome://extensions`，启用右上角“开发者模式”，点击“加载已解压的扩展程序”，选择本仓库中的 `extension` 目录。

3. 复制扩展卡片显示的 **ID**。这个 ID 用于把本机搜索服务绑定到当前扩展实例。

4. 按操作系统注册本机服务。

### macOS

需要 Python 3：

```zsh
cd native-host
./install.sh <扩展 ID>
```

如果 Chrome 通过 `--user-data-dir` 使用自定义用户数据目录，请使用：

```zsh
CHROME_USER_DATA_DIR=/path/to/chrome-profile ./install.sh <扩展 ID>
```

### Windows

需要安装 Python 3，并在安装时勾选 **Add Python to PATH**。在 PowerShell 中运行：

```powershell
cd native-host
PowerShell -ExecutionPolicy Bypass -File .\install.ps1 -ExtensionId <扩展 ID>
```

脚本会在当前用户的 Windows 注册表中注册 Native Messaging host；不需要管理员权限。

5. 在 `chrome://extensions` 的扩展详情中开启“允许访问文件网址”。

6. 点击扩展图标，在“搜索目录”中每行添加一个绝对路径并保存，例如：

   ```text
   /Users/you/Documents/notes
   C:\Users\you\Documents\notes
   ```

如果重新加载或重新安装扩展后出现“找不到本机服务”，请重新复制该扩展当前显示的 ID，并再次运行对应系统的安装脚本。

## 使用

- 地址栏：输入 `md tmux.md` 或 `md tmux`，在候选项中选择文件。
- 弹窗：输入关键词即可实时搜索，也可点击“搜索”。
- 普通模式不区分大小写，按文件名包含匹配；`tmux.md` 会找到 `003_tmux.md` 和 `003_doc_tmux.md`。
- 开启“使用正则表达式”后，可以选择按文件名或完整路径匹配。示例：`^003_.*tmux\\.md$`。
- 首次保存目录时会建立 SQLite 索引；扩展每分钟自动刷新一次，也可以在弹窗点击“立即刷新”。
- 默认跳过 `.venv`、`.git` 等隐藏目录；如需检索它们，在弹窗勾选“包含隐藏目录”。
- 文件被打开的次数会保存在本机索引中，并作为同等文本相关度下的排序权重。

## 本机数据位置

- macOS：`~/Library/Application Support/LocalMarkdownSearch/`
- Windows：`%LOCALAPPDATA%\LocalMarkdownSearch\`

其中包含配置文件、SQLite 索引和选择次数；它们不会进入 Git 仓库或上传网络。

## 自动发布

执行 `zsh scripts/package.sh` 会生成扩展和 macOS 本机服务安装包。推送 `v*` 标签会由 GitHub Actions 自动创建 GitHub Release 并上传这两个包。

用户可从 GitHub Release 下载扩展包，解压后按照上述步骤加载 `extension` 目录；本机服务包也需下载、解压并执行对应系统的安装脚本。
