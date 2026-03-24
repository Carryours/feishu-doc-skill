#!/usr/bin/env python3
import json
import os
import re
import subprocess
import sys
from collections import Counter
from typing import Any, Dict, List, Tuple


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
EXTRACT_SCRIPT = os.path.join(SCRIPT_DIR, "extract_feishu_doc_id.py")
READ_SCRIPT = os.path.join(SCRIPT_DIR, "read_feishu_doc.py")
MAX_SECTIONS = 12
MAX_LINES = 80


def run_script(script_path: str, args: List[str]) -> str:
    result = subprocess.run(
        [sys.executable, script_path, *args],
        check=True,
        capture_output=True,
        text=True,
        env=os.environ.copy(),
    )
    return result.stdout


def get_text_from_element(element: Dict[str, Any]) -> str:
    for key in ("text_run", "mention_user", "mention_doc", "equation", "reminder"):
        value = element.get(key)
        if not value:
            continue
        if isinstance(value, dict):
            if "content" in value:
                return value.get("content", "")
            if "text" in value:
                return value.get("text", "")
    return ""


def block_to_text(block: Dict[str, Any]) -> Tuple[str, str]:
    block_type = block.get("block_type")
    type_name = {
        2: "text",
        3: "heading1",
        4: "heading2",
        5: "heading3",
        12: "bullet",
        13: "ordered",
        14: "code",
        19: "quote",
        31: "table",
        32: "callout",
        43: "board",
    }.get(block_type, f"block_{block_type}")

    payload = None
    for key in (
        "text",
        "heading1",
        "heading2",
        "heading3",
        "bullet",
        "ordered",
        "code",
        "quote",
        "callout",
        "page",
    ):
        if key in block:
            payload = block[key]
            break

    if not payload:
        return type_name, ""

    elements = payload.get("elements", [])
    text = "".join(get_text_from_element(element) for element in elements).strip()
    return type_name, re.sub(r"\s+", " ", text)


def summarize_lines(lines: List[Tuple[str, str]]) -> Dict[str, Any]:
    headings = []
    content_lines = []
    type_counter = Counter()

    for kind, text in lines:
        if not text:
            continue
        type_counter[kind] += 1
        if kind.startswith("heading"):
            headings.append(text)
        elif kind in {"text", "bullet", "ordered", "quote", "callout"}:
            content_lines.append(text)

    preview = content_lines[: min(8, len(content_lines))]
    keywords = []
    for heading in headings:
        if len(heading) >= 2 and heading not in keywords:
            keywords.append(heading)
        if len(keywords) >= 8:
            break

    return {
        "headings": headings[:MAX_SECTIONS],
        "preview": preview,
        "keywords": keywords,
        "stats": dict(type_counter),
    }


def main() -> None:
    if len(sys.argv) < 2:
        print("用法: read_feishu_url.py <feishu_url>", file=sys.stderr)
        sys.exit(1)

    url = sys.argv[1]

    try:
        token = run_script(EXTRACT_SCRIPT, [url]).strip()
        raw = run_script(READ_SCRIPT, [token])
        data = json.loads(raw)
    except subprocess.CalledProcessError as exc:
        print(exc.stderr or exc.stdout, file=sys.stderr)
        sys.exit(exc.returncode or 2)
    except Exception as exc:
        print(f"读取飞书链接失败: {exc}", file=sys.stderr)
        sys.exit(3)

    metadata = data.get("metadata", {}).get("data", {}).get("document", {})
    node = data.get("resolved_wiki_node", {}).get("data", {}).get("node", {})
    blocks = data.get("blocks", {}).get("data", {}).get("items", [])

    normalized_lines = [block_to_text(block) for block in blocks]
    normalized_lines = [(kind, text) for kind, text in normalized_lines if text]
    summary = summarize_lines(normalized_lines)

    output = {
        "url": url,
        "title": metadata.get("title") or node.get("title"),
        "wiki_token": node.get("node_token") or data.get("input_token"),
        "doc_token": metadata.get("document_id") or node.get("obj_token"),
        "token_source": data.get("token_source"),
        "summary": summary,
        "content_preview": normalized_lines[:MAX_LINES],
    }

    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
