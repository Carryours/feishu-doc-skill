#!/usr/bin/env python3
import json
import os
import subprocess
import sys
from typing import Any, Dict, List, Tuple


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
READ_URL_SCRIPT = os.path.join(SCRIPT_DIR, "read_feishu_url.py")


def run_reader(url: str) -> Dict[str, Any]:
    result = subprocess.run(
        [sys.executable, READ_URL_SCRIPT, url],
        check=True,
        capture_output=True,
        text=True,
        env=os.environ.copy(),
    )
    return json.loads(result.stdout)


def render_line(kind: str, text: str) -> str:
    if kind == "heading1":
        return f"## {text}"
    if kind == "heading2":
        return f"### {text}"
    if kind == "heading3":
        return f"#### {text}"
    if kind == "bullet":
        return f"- {text}"
    if kind == "ordered":
        return f"1. {text}"
    if kind == "quote":
        return f"> {text}"
    if kind == "code":
        return f"```text\n{text}\n```"
    return text


def compact_preview(lines: List[Tuple[str, str]]) -> List[str]:
    rendered = []
    for kind, text in lines:
        if not text:
            continue
        rendered.append(render_line(kind, text))
    return rendered


def main() -> None:
    if len(sys.argv) < 2:
        print("用法: read_feishu_url_md.py <feishu_url>", file=sys.stderr)
        sys.exit(1)

    url = sys.argv[1]

    try:
        data = run_reader(url)
    except subprocess.CalledProcessError as exc:
        print(exc.stderr or exc.stdout, file=sys.stderr)
        sys.exit(exc.returncode or 2)
    except Exception as exc:
        print(f"生成 Markdown 失败: {exc}", file=sys.stderr)
        sys.exit(3)

    summary = data.get("summary", {})
    content_preview = data.get("content_preview", [])
    lines = compact_preview(content_preview)

    parts = [
        f"# {data.get('title') or '飞书文档'}",
        "",
        "## 文档信息",
        f"- 来源链接：{data.get('url', '')}",
        f"- Wiki Token：{data.get('wiki_token', '')}",
        f"- Doc Token：{data.get('doc_token', '')}",
        f"- Token 来源：{data.get('token_source', '')}",
        "",
        "## 快速摘要",
    ]

    for item in summary.get("preview", []):
        parts.append(f"- {item}")

    headings = summary.get("headings", [])
    if headings:
        parts.extend(["", "## 主要章节"])
        for heading in headings:
            parts.append(f"- {heading}")

    stats = summary.get("stats", {})
    if stats:
        parts.extend(["", "## 结构统计"])
        for key, value in stats.items():
            parts.append(f"- {key}: {value}")

    parts.extend(["", "## 内容预览"])
    parts.extend(lines)
    parts.append("")

    print("\n".join(parts))


if __name__ == "__main__":
    main()
