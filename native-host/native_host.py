#!/usr/bin/env python3
"""Native Messaging host for the Local Markdown Search Chrome extension."""

from __future__ import annotations

import json
import os
from pathlib import Path
import re
import sqlite3
import struct
import sys
import time
from typing import Any

if sys.platform == "darwin":
    APP_DATA_DIR = Path.home() / "Library" / "Application Support" / "LocalMarkdownSearch"
elif sys.platform == "win32":
    APP_DATA_DIR = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "LocalMarkdownSearch"
else:
    APP_DATA_DIR = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / "LocalMarkdownSearch"

CONFIG_PATH = APP_DATA_DIR / "config.json"
INDEX_PATH = CONFIG_PATH.with_name("index.sqlite3")
DEFAULT_MAX_RESULTS = 20
# 防止单次搜索返回海量路径，拖慢 Native Messaging 与 Chrome 候选渲染。
# 这是单次返回数上限，不影响 SQLite 索引中的文件总量。
MAX_RESULTS = 100
MAX_VIEW_FILE_SIZE = 5 * 1024 * 1024


def read_message() -> dict[str, Any] | None:
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) != 4:
        return None
    length = struct.unpack("<I", raw_length)[0]
    if length > 1024 * 1024:
        return None
    raw = sys.stdin.buffer.read(length)
    if len(raw) != length:
        return None
    return json.loads(raw.decode("utf-8"))


def write_message(payload: dict[str, Any]) -> None:
    encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def load_settings() -> dict[str, Any]:
    try:
        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        roots = config.get("roots", [])
        return {
            "roots": [root for root in roots if isinstance(root, str)],
            "includeHidden": config.get("includeHidden", False) is True,
        }
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {"roots": [], "includeHidden": False}


def load_config() -> list[str]:
    return load_settings()["roots"]


def save_config(roots: list[str], include_hidden: bool) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = CONFIG_PATH.with_suffix(".tmp")
    temporary_path.write_text(json.dumps({"roots": roots, "includeHidden": include_hidden}, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary_path.replace(CONFIG_PATH)


def open_index() -> sqlite3.Connection:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(INDEX_PATH, timeout=10)
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA busy_timeout=10000")
    connection.execute("CREATE TABLE IF NOT EXISTS files (path TEXT PRIMARY KEY, filename TEXT NOT NULL, root TEXT NOT NULL, modified_ns INTEGER NOT NULL, size INTEGER NOT NULL)")
    connection.execute("CREATE INDEX IF NOT EXISTS files_filename ON files(filename)")
    connection.execute("CREATE TABLE IF NOT EXISTS selections (path TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, last_selected REAL NOT NULL)")
    connection.execute("CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
    return connection


def index_status() -> dict[str, Any]:
    try:
        with open_index() as connection:
            count = connection.execute("SELECT COUNT(*) FROM files").fetchone()[0]
            row = connection.execute("SELECT value FROM metadata WHERE key = 'last_refreshed'").fetchone()
            return {"fileCount": count, "lastRefreshed": float(row[0]) if row else None}
    except sqlite3.Error:
        return {"fileCount": 0, "lastRefreshed": None}


def refresh_index() -> dict[str, Any]:
    settings = load_settings()
    roots = settings["roots"]
    include_hidden = settings["includeHidden"]
    if not roots:
        return {"ok": False, "error": "尚未配置搜索目录，请先在扩展弹窗中添加。"}

    indexed: list[tuple[str, str, str, int, int]] = []
    for root in roots:
        try:
            for directory, directory_names, filenames in os.walk(root, onerror=lambda _: None):
                if not include_hidden:
                    directory_names[:] = [name for name in directory_names if not name.startswith(".")]
                for filename in filenames:
                    if not filename.lower().endswith(".md"):
                        continue
                    path = os.path.join(directory, filename)
                    try:
                        stat = os.stat(path)
                    except OSError:
                        continue
                    indexed.append((path, filename, root, stat.st_mtime_ns, stat.st_size))
        except OSError:
            continue

    refreshed_at = time.time()
    with open_index() as connection:
        connection.execute("DELETE FROM files")
        connection.executemany("INSERT INTO files(path, filename, root, modified_ns, size) VALUES (?, ?, ?, ?, ?)", indexed)
        connection.execute("DELETE FROM selections WHERE path NOT IN (SELECT path FROM files)")
        connection.execute("INSERT OR REPLACE INTO metadata(key, value) VALUES ('last_refreshed', ?)", (str(refreshed_at),))
        connection.execute("INSERT OR REPLACE INTO metadata(key, value) VALUES ('roots', ?)", (json.dumps(roots),))
    return {"ok": True, "fileCount": len(indexed), "lastRefreshed": refreshed_at}


def record_selection(message: dict[str, Any]) -> dict[str, Any]:
    path = message.get("path")
    if not isinstance(path, str):
        return {"ok": False, "error": "文件路径不正确。"}
    path = os.path.realpath(os.path.expanduser(path))
    if not os.path.isabs(path):
        return {"ok": False, "error": "文件路径不正确。"}
    try:
        with open_index() as connection:
            exists = connection.execute("SELECT 1 FROM files WHERE path = ?", (path,)).fetchone()
            if not exists:
                return {"ok": False, "error": "文件不在当前搜索索引中。"}
            connection.execute(
                "INSERT INTO selections(path, count, last_selected) VALUES (?, 1, ?) "
                "ON CONFLICT(path) DO UPDATE SET count = count + 1, last_selected = excluded.last_selected",
                (path, time.time()),
            )
            count = connection.execute("SELECT count FROM selections WHERE path = ?", (path,)).fetchone()[0]
        return {"ok": True, "count": count}
    except sqlite3.Error as error:
        return {"ok": False, "error": f"无法保存选择记录：{error}"}


def read_file(message: dict[str, Any]) -> dict[str, Any]:
    path = message.get("path")
    if not isinstance(path, str):
        return {"ok": False, "error": "文件路径不正确。"}
    path = os.path.realpath(os.path.expanduser(path))
    if not os.path.isabs(path):
        return {"ok": False, "error": "文件路径不正确。"}
    try:
        with open_index() as connection:
            exists = connection.execute("SELECT 1 FROM files WHERE path = ?", (path,)).fetchone()
        if not exists:
            return {"ok": False, "error": "文件不在当前搜索索引中。"}
        if os.path.getsize(path) > MAX_VIEW_FILE_SIZE:
            return {"ok": False, "error": "文件超过 5 MB，无法在扩展内打开。"}
        return {"ok": True, "path": path, "content": Path(path).read_text(encoding="utf-8", errors="replace")}
    except OSError as error:
        return {"ok": False, "error": f"无法读取文件：{error}"}


def relevance_rank(filename: str, query: str) -> int:
    normalized_filename = filename.casefold()
    normalized_query = query.casefold()
    filename_stem = Path(filename).stem.casefold()
    query_stem = Path(query).stem.casefold() if normalized_query.endswith(".md") else normalized_query
    if normalized_filename == normalized_query:
        return 0
    if filename_stem == query_stem:
        return 1
    if filename_stem.startswith(query_stem):
        return 2
    if query_stem in re.split(r"[_\-\s.]+", filename_stem):
        return 3
    return 4


def configure(message: dict[str, Any]) -> dict[str, Any]:
    received_roots = message.get("roots")
    include_hidden = message.get("includeHidden", False)
    if not isinstance(received_roots, list) or not isinstance(include_hidden, bool):
        return {"ok": False, "error": "目录配置格式不正确。"}

    roots: list[str] = []
    invalid: list[str] = []
    for raw_root in received_roots:
        if not isinstance(raw_root, str) or not raw_root.strip():
            continue
        root = os.path.realpath(os.path.expanduser(raw_root.strip()))
        if not os.path.isdir(root):
            invalid.append(raw_root)
        elif root not in roots:
            roots.append(root)
    if invalid:
        return {"ok": False, "error": f"以下目录不存在或不可用：{', '.join(invalid)}"}
    save_config(roots, include_hidden)
    return {"ok": True, "roots": roots, "includeHidden": include_hidden, **refresh_index()}


def search(message: dict[str, Any]) -> dict[str, Any]:
    query = message.get("query")
    regex_enabled = message.get("regexEnabled", False)
    regex_target = message.get("regexTarget", "filename")
    if not isinstance(query, str) or not query:
        return {"ok": False, "error": "请输入搜索内容。"}
    if not isinstance(regex_enabled, bool) or regex_target not in {"filename", "path"}:
        return {"ok": False, "error": "搜索参数不正确。"}
    try:
        matcher = re.compile(query, re.IGNORECASE) if regex_enabled else None
    except re.error as error:
        return {"ok": False, "error": f"无效的正则表达式：{error}"}

    requested_max = message.get("maxResults", DEFAULT_MAX_RESULTS)
    limit = requested_max if isinstance(requested_max, int) else DEFAULT_MAX_RESULTS
    limit = max(1, min(limit, MAX_RESULTS))
    status = index_status()
    if not status["lastRefreshed"]:
        refreshed = refresh_index()
        if not refreshed["ok"]:
            return refreshed
    try:
        with open_index() as connection:
            records = connection.execute(
                "SELECT files.path, files.filename, COALESCE(selections.count, 0) "
                "FROM files LEFT JOIN selections ON selections.path = files.path"
            ).fetchall()
    except sqlite3.Error as error:
        return {"ok": False, "error": f"无法读取搜索索引：{error}"}

    found: list[tuple[str, str, int]] = []
    normalized_query = query.casefold()
    for path, filename, selection_count in records:
        target = path if regex_target == "path" else filename
        matched = bool(matcher.search(target)) if matcher else normalized_query in filename.casefold()
        if matched:
            found.append((path, filename, selection_count))

    if regex_enabled:
        found.sort(key=lambda item: (-item[2], item[0].casefold()))
    else:
        found.sort(key=lambda item: (relevance_rank(item[1], query), -item[2], len(item[1]), item[0].casefold()))
    return {"ok": True, "paths": [path for path, _, _ in found[:limit]]}


def handle(message: dict[str, Any]) -> dict[str, Any]:
    action = message.get("action")
    if action == "getConfig":
        return {"ok": True, **load_settings(), **index_status()}
    if action == "configure":
        return configure(message)
    if action == "search":
        return search(message)
    if action == "refreshIndex":
        return refresh_index()
    if action == "recordSelection":
        return record_selection(message)
    if action == "readFile":
        return read_file(message)
    return {"ok": False, "error": "不支持的操作。"}


def main() -> None:
    try:
        message = read_message()
        if message is not None:
            write_message(handle(message))
    except Exception as error:  # Never write logs to stdout: it is the protocol channel.
        write_message({"ok": False, "error": f"本机搜索服务发生错误：{error}"})


if __name__ == "__main__":
    main()
