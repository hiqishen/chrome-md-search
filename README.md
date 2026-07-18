# Local Markdown Search

在 Chrome 地址栏输入 `md tmux` 或 `md tmux.md`，即可搜索你电脑上的 Markdown 文件。文件索引、搜索目录和使用记录均只保存在本机。

## 最简单的安装方式

不需要安装 Python、打开终端、复制扩展 ID，或开启“允许访问文件网址”。

1. 在 [GitHub Releases](https://github.com/hiqishen/chrome-md-search/releases) 下载并解压最新的两个文件：`local-markdown-search-chrome-extension.zip` 与 `local-markdown-search-native-host.zip`。
2. Chrome 打开 `chrome://extensions`，开启右上角“开发者模式”，点击“加载已解压的扩展程序”，选择解压后的 `local-markdown-search-chrome-extension` 文件夹。
3. 打开解压后的 `local-markdown-search-native-host` 文件夹：
   - macOS：双击 `setup-macos.command`，如系统阻止，右键选择“打开”。
   - Windows：双击 `setup-windows.cmd`。
4. 安装程序会在需要时自动安装 `uv` 和 Python 3.12，并让你选择一个要搜索的目录。完成后点击扩展图标即可使用。

首次安装会下载 Python 3.12，取决于网络速度，可能需要几十秒。以后不再重复下载。

## 从源码安装

```zsh
git clone git@github.com:hiqishen/chrome-md-search.git
cd chrome-md-search
```

按上面的第 2 步加载 `extension` 文件夹，然后双击 `native-host/setup-macos.command`，或在 Windows 双击 `native-host/setup-windows.cmd`。

若你已安装 uv，也可以直接运行：

```zsh
cd native-host
./install.sh --uv
```

Windows PowerShell：

```powershell
cd native-host
.\install.ps1 -UseUv
```

扩展 ID 已固定，正常情况下无需填写。若你自行修改了 `manifest.json` 中的 `key`，才需要把新的扩展 ID 作为 `install.sh` 的第一个参数，或传给 `install.ps1 -ExtensionId`。

## 使用

- 地址栏：输入 `md tmux`，在候选项中选择文件，Chrome 会在当前标签页显示 Markdown 原文。
- 弹窗：输入关键词即实时搜索；搜索期间会显示加载提示。
- 普通模式不区分大小写，按文件名包含匹配；正则模式可匹配文件名或完整路径。
- 默认排除 `.venv`、`.git` 等隐藏目录；可在弹窗勾选“包含隐藏目录”。
- 文件被选择打开的次数保存在本机，并在相同文本相关度下作为排序权重。

## 本机数据与绑定位置

| 内容 | macOS | Windows |
| --- | --- | --- |
| SQLite 索引、搜索目录、选择次数、uv 启动器 | `~/Library/Application Support/LocalMarkdownSearch/` | `%LOCALAPPDATA%\LocalMarkdownSearch\` |
| Chrome Native Messaging 注册 | `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/` | `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.local.md_search` |

SQLite 数据库文件名为 `index.sqlite3`；配置为 `config.json`。这些内容均只保存在本机，不会提交到 Git 或上传。

## 运行时与排障

默认运行时是 [uv](https://docs.astral.sh/uv/)，由一键安装程序自动安装，并固定使用 Python 3.12。uv 负责下载和管理 Python，因此不要求系统预装 Python。

如需使用公司指定的 Python，可改用绝对路径：

```zsh
./install.sh --python /absolute/path/to/python3
# 或：LOCAL_MARKDOWN_SEARCH_PYTHON=/absolute/path/to/python3 ./install.sh
```

Windows：

```powershell
.\install.ps1 -PythonPath C:\Python312\python.exe
```

若扩展显示“找不到本机搜索服务”，请再次双击对应的 `setup` 文件；它会重新注册服务，不会删除现有索引。

## 发布维护

执行以下命令会生成扩展 ZIP 和跨平台本机服务 ZIP：

```zsh
zsh scripts/package.sh
```

推送 `v*` 标签会由 GitHub Actions 自动创建 GitHub Release 并上传这两个包。
