#!/usr/bin/env python3
import json
import os
from pathlib import Path
from typing import Optional


SCRIPT_DIR = Path(__file__).resolve().parent
TOKEN_FILE = SCRIPT_DIR.parent / ".feishu-user-token.json"


def load_saved_user_access_token(token_file: Path = TOKEN_FILE) -> Optional[str]:
    if not token_file.exists():
        return None

    try:
        data = json.loads(token_file.read_text())
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"已保存的 user token 文件不是合法 JSON: {token_file}") from exc

    token = data.get("access_token")
    if not token:
        raise RuntimeError(f"已保存的 user token 文件缺少 access_token 字段: {token_file}")
    return token


def get_user_access_token() -> Optional[str]:
    token = os.getenv("FEISHU_USER_ACCESS_TOKEN")
    if token:
        return token
    return load_saved_user_access_token()


def get_auth_hint() -> str:
    return (
        "缺少 FEISHU_USER_ACCESS_TOKEN，且未在 skill 目录中找到 .feishu-user-token.json。"
        "可先设置 FEISHU_USER_ACCESS_TOKEN，或运行 node scripts/feishu_oauth_server.js 完成授权。"
    )
