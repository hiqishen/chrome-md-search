const NATIVE_HOST = "com.local.md_search";
const MAX_RESULTS = 20;
const INDEX_REFRESH_ALARM = "refresh-markdown-index";
const NATIVE_RESPONSE_TIMEOUT_MS = 8000;
const NO_RESULT_CONTENT = "local-markdown-search:no-result";
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

function viewerUrl(path) {
  return chrome.runtime.getURL(`viewer.html?path=${encodeURIComponent(path)}`);
}

function fileName(path) {
  return path.replace(/\\/g, "/").split("/").pop();
}

async function getSearchOptions() {
  const defaults = { regexEnabled: false, regexTarget: "filename" };
  return chrome.storage.sync.get(defaults);
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
      maxResults: MAX_RESULTS
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
      content: viewerUrl(path),
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
  if (content.startsWith(chrome.runtime.getURL("viewer.html"))) {
    const path = new URL(content).searchParams.get("path");
    if (path) sendNativeMessage({ action: "recordSelection", path }).catch(() => {});
    chrome.tabs.update({ url: content });
  }
});
