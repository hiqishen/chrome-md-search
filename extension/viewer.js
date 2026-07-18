const path = new URLSearchParams(location.search).get("path");
const pathElement = document.querySelector("#path");
const contentElement = document.querySelector("#content");
const errorElement = document.querySelector("#error");

function sendNativeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage("com.local.md_search", message, (response) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(response);
    });
  });
}

async function openFile() {
  if (!path) throw new Error("缺少文件路径。");
  pathElement.textContent = path;
  document.title = path.replace(/\\/g, "/").split("/").pop();
  const response = await sendNativeMessage({ action: "readFile", path });
  if (!response.ok) throw new Error(response.error);
  contentElement.textContent = response.content;
}

openFile().catch((error) => {
  pathElement.textContent = "无法打开 Markdown 文件";
  errorElement.textContent = error.message;
});
