const NATIVE_HOST = "com.local.md_search";
const MAX_RESULTS = 20;
const INDEX_REFRESH_ALARM = "refresh-markdown-index";
let latestOmniboxRequest = 0;

function sendNativeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(NATIVE_HOST, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function escapeOmniboxText(value) {
  return value.replace(/[&<>]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;"
  })[character]);
}

function toFileUrl(path) {
  return `file://${encodeURI(path).replace(/#/g, "%23")}`;
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
    chrome.omnibox.setDefaultSuggestion({ description: `正在搜索 <match>${escapeOmniboxText(query)}</match>…` });

    const result = await sendNativeMessage({
      action: "search",
      query,
      regexEnabled: options.regexEnabled,
      regexTarget: options.regexTarget,
      maxResults: MAX_RESULTS
    });
    if (requestId !== latestOmniboxRequest) return;

    if (!result.ok) {
      chrome.omnibox.setDefaultSuggestion({ description: escapeOmniboxText(result.error) });
      suggest([]);
      return;
    }

    suggest(result.paths.map((path) => ({
      content: toFileUrl(path),
      description: `<match>${escapeOmniboxText(path.split("/").pop())}</match><dim> — ${escapeOmniboxText(path)}</dim>`
    })));
  } catch (error) {
    if (requestId !== latestOmniboxRequest) return;
    chrome.omnibox.setDefaultSuggestion({
      description: `无法连接本机搜索服务：${escapeOmniboxText(error.message)}`
    });
    suggest([]);
  }
});

chrome.omnibox.onInputEntered.addListener((content) => {
  if (content.startsWith("file://")) {
    chrome.tabs.update({ url: content });
  }
});
