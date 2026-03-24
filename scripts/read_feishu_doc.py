#!/usr/bin/env python3
import json
import os
import sys
from typing import Any, Dict

import requests
from feishu_auth import get_auth_hint, get_user_access_token


BASE_URL = "https://open.feishu.cn/open-apis"


def get_tenant_access_token(app_id: str, app_secret: str) -> str:
    response = requests.post(
        f"{BASE_URL}/auth/v3/tenant_access_token/internal",
        json={
            "app_id": app_id,
            "app_secret": app_secret,
        },
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    if data.get("code") != 0:
        raise RuntimeError(f"获取 tenant_access_token 失败: {data}")
    return data["tenant_access_token"]


def parse_response(response: requests.Response, action: str) -> Dict[str, Any]:
    response.raise_for_status()
    data = response.json()
    if data.get("code") != 0:
        raise RuntimeError(f"{action}失败: {data}")
    return data


def resolve_wiki_node(access_token: str, wiki_token: str) -> dict:
    response = requests.get(
        f"{BASE_URL}/wiki/v2/spaces/get_node",
        headers={"Authorization": f"Bearer {access_token}"},
        params={"token": wiki_token},
        timeout=30,
    )
    return parse_response(response, "解析 wiki 节点")


def get_document_metadata(access_token: str, doc_token: str) -> dict:
    response = requests.get(
        f"{BASE_URL}/docx/v1/documents/{doc_token}",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )
    return parse_response(response, "获取文档元信息")


def get_document_blocks(access_token: str, doc_token: str, page_size: int = 500) -> dict:
    response = requests.get(
        f"{BASE_URL}/docx/v1/documents/{doc_token}/blocks",
        headers={"Authorization": f"Bearer {access_token}"},
        params={"page_size": page_size},
        timeout=30,
    )
    return parse_response(response, "获取文档块")


def main() -> None:
    if len(sys.argv) < 2:
        print("用法: read_feishu_doc.py <doc_or_wiki_token>", file=sys.stderr)
        sys.exit(1)

    source_token = sys.argv[1]
    user_access_token = get_user_access_token()
    app_id = os.getenv("FEISHU_APP_ID")
    app_secret = os.getenv("FEISHU_APP_SECRET")

    if user_access_token:
        access_token = user_access_token
        token_source = "user_access_token"
    else:
        if not app_id or not app_secret:
            print(get_auth_hint(), file=sys.stderr)
            sys.exit(2)
        access_token = get_tenant_access_token(app_id, app_secret)
        token_source = "tenant_access_token"

    try:
        wiki_node = None
        doc_token = source_token
        if source_token.startswith(("wiki_", "wik")) or len(source_token) >= 20:
            try:
                wiki_node = resolve_wiki_node(access_token, source_token)
                doc_token = wiki_node["data"]["node"]["obj_token"]
            except Exception:
                doc_token = source_token

        metadata = get_document_metadata(access_token, doc_token)
        blocks = get_document_blocks(access_token, doc_token)
    except requests.HTTPError as exc:
        print(f"HTTP 请求失败: {exc}", file=sys.stderr)
        sys.exit(3)
    except Exception as exc:
        print(f"读取飞书文档失败: {exc}", file=sys.stderr)
        sys.exit(4)

    print(
        json.dumps(
            {
                "token_source": token_source,
                "input_token": source_token,
                "resolved_wiki_node": wiki_node,
                "metadata": metadata,
                "blocks": blocks,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
