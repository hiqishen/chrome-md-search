const NATIVE_HOST = "com.local.md_search";
const roots = document.querySelector("#roots");
const includeHidden = document.querySelector("#include-hidden");
const query = document.querySelector("#query");
const regexEnabled = document.querySelector("#regex-enabled");
const regexTarget = document.querySelector("#regex-target");
const maxResults = document.querySelector("#max-results");
const status = document.querySelector("#status");
const results = document.querySelector("#results");
const indexStatus = document.querySelector("#index-status");
const NATIVE_RESPONSE_TIMEOUT_MS = 8000;
let searchTimer;
let latestSearchRequest = 0;
const DEFAULT_MAX_RESULTS = 20;
const MAX_RESULTS = 100;

function sendNativeMessage(message) {
  const response = new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(NATIVE_HOST, message, (response) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(response);
    });
  });
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("本机服务超过 8 秒未响应，请确认已运行安装脚本。")), NATIVE_RESPONSE_TIMEOUT_MS);
  });
  return Promise.race([response, timeout]);
}

function renderResults(paths) {
  results.replaceChildren(...paths.map((path) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = chrome.runtime.getURL(`viewer.html?path=${encodeURIComponent(path)}`);
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      sendNativeMessage({ action: "recordSelection", path }).catch(() => {});
      await chrome.tabs.update(activeTab.id, { url: link.href });
      window.close();
    });
    const name = document.createElement("span");
    name.className = "filename";
    name.textContent = path.replace(/\\/g, "/").split("/").pop();
    const fullPath = document.createElement("span");
    fullPath.className = "path";
    fullPath.textContent = path;
    link.append(name, fullPath);
    item.append(link);
    return item;
  }));
}

function normalizeMaxResults(value) {
  const number = Number(value);
  if (!Number.isInteger(number)) return DEFAULT_MAX_RESULTS;
  return Math.max(1, Math.min(number, MAX_RESULTS));
}

function renderIndexStatus(config) {
  if (!config.lastRefreshed) {
    indexStatus.textContent = "索引尚未建立";
    return;
  }
  const refreshedAt = new Date(config.lastRefreshed * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  indexStatus.textContent = `已索引 ${config.fileCount} 个文件 · ${refreshedAt} 更新`;
}

async function load() {
  const [config, preferences] = await Promise.all([
    sendNativeMessage({ action: "getConfig" }),
    chrome.storage.sync.get({ regexEnabled: false, regexTarget: "filename", maxResults: DEFAULT_MAX_RESULTS })
  ]);
  if (!config.ok) throw new Error(config.error);
  roots.value = config.roots.join("\n");
  includeHidden.checked = config.includeHidden;
  renderIndexStatus(config);
  regexEnabled.checked = preferences.regexEnabled;
  regexTarget.value = preferences.regexTarget;
  regexTarget.disabled = !regexEnabled.checked;
  maxResults.value = normalizeMaxResults(preferences.maxResults);
}

async function savePreferences() {
  regexTarget.disabled = !regexEnabled.checked;
  maxResults.value = normalizeMaxResults(maxResults.value);
  await chrome.storage.sync.set({
    regexEnabled: regexEnabled.checked,
    regexTarget: regexTarget.value,
    maxResults: Number(maxResults.value)
  });
}

async function saveRoots() {
  status.textContent = "";
  const selectedRoots = roots.value.split("\n").map((value) => value.trim()).filter(Boolean);
  const response = await sendNativeMessage({ action: "configure", roots: selectedRoots, includeHidden: includeHidden.checked });
  if (!response.ok) throw new Error(response.error);
  roots.value = response.roots.join("\n");
  renderIndexStatus(response);
  status.textContent = "目录已保存。";
}

async function refreshIndex() {
  indexStatus.textContent = "正在刷新索引…";
  const response = await sendNativeMessage({ action: "refreshIndex" });
  if (!response.ok) throw new Error(response.error);
  renderIndexStatus(response);
}

async function search() {
  const requestId = ++latestSearchRequest;
  status.textContent = "";
  status.className = "";
  renderResults([]);
  const value = query.value.trim();
  if (!value) return;
  status.textContent = "正在搜索…";
  status.className = "searching";
  const response = await sendNativeMessage({
    action: "search", query: value, regexEnabled: regexEnabled.checked,
    regexTarget: regexTarget.value, maxResults: normalizeMaxResults(maxResults.value)
  });
  if (requestId !== latestSearchRequest) return;
  if (!response.ok) throw new Error(response.error);
  renderResults(response.paths);
  status.className = "";
  status.textContent = response.paths.length ? `找到 ${response.paths.length} 个文件。` : "未找到匹配文件。";
}

function showError(error) {
  status.className = "";
  status.textContent = error.message;
}

document.querySelector("#save-roots").addEventListener("click", () => saveRoots().catch(showError));
document.querySelector("#refresh-index").addEventListener("click", () => refreshIndex().catch(showError));
document.querySelector("#search").addEventListener("click", () => search().catch(showError));
query.addEventListener("keydown", (event) => { if (event.key === "Enter") search().catch(showError); });
query.addEventListener("input", () => {
  clearTimeout(searchTimer);
  if (!query.value.trim()) {
    latestSearchRequest += 1;
    renderResults([]);
    status.className = "";
    status.textContent = "";
    return;
  }
  searchTimer = setTimeout(() => search().catch(showError), 220);
});
regexEnabled.addEventListener("change", () => savePreferences());
regexTarget.addEventListener("change", () => savePreferences());
maxResults.addEventListener("change", () => savePreferences());
load().catch((error) => { showError(new Error(`初始化失败：${error.message}`)); });
