# Local Markdown Search

一个本地运行的 Chrome Markdown 搜索工具。地址栏输入 `md tmux` 或 `md tmux.md`，即可从用户指定目录检索 Markdown 文件；扩展、本机索引和使用记录均不上传网络。

## 推荐运行时：uv + Python 3.12

本机搜索服务默认由 [uv](https://docs.astral.sh/uv/) 启动，并固定使用 Python 3.12。uv 会在本机管理所需 Python，因此无需预装 Python，也避免不同电脑 Python 版本不一致。

先安装 uv：

| 系统 | 安装命令 |
| --- | --- |
| macOS | `brew install uv` |
| Windows（PowerShell） | `winget install --id=astral-sh.uv -e` |

安装后重新打开终端，执行 `uv --version` 确认可用。首次启动搜索服务时，uv 可能下载 Python 3.12；之后会使用本地缓存。

## 从 GitHub 安装

### 1. 下载源码

```zsh
git clone git@github.com:hiqishen/chrome-md-search.git
cd chrome-md-search
```

也可以从 GitHub Release 下载并解压两个 ZIP：扩展包和本机服务包。

### 2. 加载 Chrome 扩展

1. 打开 `chrome://extensions`。
2. 开启右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择仓库中的 `extension` 目录。
4. 复制扩展卡片上显示的 **ID**。
5. 进入扩展“详情”，开启“允许访问文件网址”。

### 3. 注册本机搜索服务

扩展不会自动绑定到某台电脑。本机安装脚本会将 Native Messaging 服务只授权给上一步复制的 Extension ID；这是为了防止其他扩展调用本地文件搜索能力。

#### macOS

```zsh
cd native-host
./install.sh <扩展 ID>
```

#### Windows（PowerShell）

```powershell
cd native-host
PowerShell -ExecutionPolicy Bypass -File .\install.ps1 -ExtensionId <扩展 ID>
```

如果扩展被重新加载、重新安装，或 Chrome 显示的 ID 发生变化，请再次运行对应系统的安装命令。

### 使用指定 Python（可选）

默认推荐 uv。若需使用公司环境或指定解释器，可在安装时固定其绝对路径；该路径会写入本机启动器，不依赖 Chrome 是否继承终端环境变量。

macOS：

```zsh
./install.sh <扩展 ID> --python /absolute/path/to/python3
# 或：LOCAL_MARKDOWN_SEARCH_PYTHON=/absolute/path/to/python3 ./install.sh <扩展 ID>
```

Windows：

```powershell
.\install.ps1 -ExtensionId <扩展 ID> -PythonPath C:\Python312\python.exe
```

若想显式指定使用 uv，可添加 `--uv`（macOS）或 `-UseUv`（Windows）。

### 4. 配置搜索目录

点击扩展图标，在“搜索目录”中每行添加一个绝对路径并保存，例如：

```text
/Users/you/Documents/notes
C:\Users\you\Documents\notes
```

首次保存会建立本地 SQLite 索引；弹窗会显示索引状态。之后扩展每分钟自动刷新，也可以点击“立即刷新”。

## 使用

- 地址栏：输入 `md tmux`，在候选项中选择文件，Chrome 会在当前标签页打开它。
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

## 发布维护

执行以下命令会生成扩展 ZIP 和跨平台本机服务 ZIP：

```zsh
zsh scripts/package.sh
```

推送 `v*` 标签会由 GitHub Actions 自动创建 GitHub Release 并上传这两个包。
