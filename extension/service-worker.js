const NATIVE_HOST = "com.local.md_search";
const INDEX_REFRESH_ALARM = "refresh-markdown-index";
const NATIVE_RESPONSE_TIMEOUT_MS = 8000;
const NO_RESULT_CONTENT = "local-markdown-search:no-result";
const DEFAULT_MAX_RESULTS = 20;
// 与本机服务的保护上限一致，避免一次向地址栏传入过多完整文件路径。
const MAX_CONFIGURABLE_RESULTS = 100;
let latestOmniboxRequest = 0;

function sendNativeMessage(message) {
  const response = new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(NATIVE_HOST, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("本机服务超过 8 秒未响应，请确认已运行安装脚本。")), NATIVE_RESPONSE_TIMEOUT_MS);
  });
  return Promise.race([response, timeout]);
}

function escapeOmniboxText(value) {
  return value.replace(/[&<>]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;"
  })[character]);
}

function fileUrl(path) {
  // URL 会正确转义空格、#、? 等文件名中的特殊字符。
  const normalizedPath = path.replace(/\\/g, "/");
  const url = new URL("file://");
  url.pathname = /^[A-Za-z]:\//.test(normalizedPath) ? `/${normalizedPath}` : normalizedPath;
  return url.href;
}

function filePathFromUrl(value) {
  const path = decodeURIComponent(new URL(value).pathname);
  // Windows 的 file URL 路径以 /C:/ 开头，恢复为本机服务使用的路径格式。
  return /^\/[A-Za-z]:\//.test(path) ? path.slice(1).replace(/\//g, "\\") : path;
}

function fileName(path) {
  return path.replace(/\\/g, "/").split("/").pop();
}

async function getSearchOptions() {
  const defaults = { regexEnabled: false, regexTarget: "filename", maxResults: DEFAULT_MAX_RESULTS };
  const options = await chrome.storage.sync.get(defaults);
  return { ...options, maxResults: normalizeMaxResults(options.maxResults) };
}

function normalizeMaxResults(value) {
  const number = Number(value);
  if (!Number.isInteger(number)) return DEFAULT_MAX_RESULTS;
  return Math.max(1, Math.min(number, MAX_CONFIGURABLE_RESULTS));
}

function scheduleIndexRefresh() {
  chrome.alarms.create(INDEX_REFRESH_ALARM, { periodInMinutes: 1 });
}

chrome.runtime.onInstalled.addListener(scheduleIndexRefresh);
chrome.runtime.onStartup.addListener(scheduleIndexRefresh);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === INDEX_REFRESH_ALARM) {
    sendNativeMessage({ action: "refreshIndex" }).catch(() => {});
  }
});

scheduleIndexRefresh();

chrome.omnibox.setDefaultSuggestion({
  description: "输入关键词搜索本地 Markdown 文件"
});

chrome.omnibox.onInputChanged.addListener(async (input, suggest) => {
  const query = input.trim();
  const requestId = ++latestOmniboxRequest;
  if (!query) {
    suggest([]);
    return;
  }

  try {
    const options = await getSearchOptions();
    await chrome.omnibox.setDefaultSuggestion({ description: `正在搜索 <match>${escapeOmniboxText(query)}</match>…` });

    const result = await sendNativeMessage({
      action: "search",
      query,
      regexEnabled: options.regexEnabled,
      regexTarget: options.regexTarget,
      maxResults: options.maxResults
    });
    if (requestId !== latestOmniboxRequest) return;

    if (!result.ok) {
      await chrome.omnibox.setDefaultSuggestion({ description: escapeOmniboxText(result.error) });
      suggest([]);
      return;
    }

    const countText = result.paths.length ? `搜索完成：找到 ${result.paths.length} 个文件` : "搜索完成：未找到匹配文件";
    await chrome.omnibox.setDefaultSuggestion({ description: countText });
    if (!result.paths.length) {
      suggest([{ content: NO_RESULT_CONTENT, description: "<dim>没有匹配的 Markdown 文件</dim>" }]);
      return;
    }
    suggest(result.paths.map((path) => ({
      content: fileUrl(path),
      description: `<match>${escapeOmniboxText(fileName(path))}</match><dim> — ${escapeOmniboxText(path)}</dim>`
    })));
  } catch (error) {
    if (requestId !== latestOmniboxRequest) return;
    await chrome.omnibox.setDefaultSuggestion({
      description: `无法完成搜索：${escapeOmniboxText(error.message)}`
    });
    suggest([]);
  }
});

chrome.omnibox.onInputEntered.addListener((content) => {
  if (content === NO_RESULT_CONTENT) return;
  if (content.startsWith("file:")) {
    const path = filePathFromUrl(content);
    if (path) sendNativeMessage({ action: "recordSelection", path }).catch(() => {});
    chrome.tabs.update({ url: content });
  }
});
