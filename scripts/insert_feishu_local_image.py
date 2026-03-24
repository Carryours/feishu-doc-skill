#!/usr/bin/env python3
import argparse
import json
import mimetypes
import os
import sys
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import requests

BASE_URL = 'https://open.feishu.cn/open-apis'
SCRIPT_DIR = Path(__file__).resolve().parent
TOKEN_FILE = SCRIPT_DIR.parent / '.feishu-user-token.json'


def get_access_token() -> str:
    token = os.getenv('FEISHU_USER_ACCESS_TOKEN')
    if token:
        return token
    if TOKEN_FILE.exists():
        data = json.loads(TOKEN_FILE.read_text())
        token = data.get('access_token')
        if token:
            return token
    raise RuntimeError('缺少 FEISHU_USER_ACCESS_TOKEN，且未在 skill 目录中找到已保存的 user token')


def extract_token(source: str) -> str:
    if source.startswith('http://') or source.startswith('https://'):
        path = urlparse(source).path
        for prefix in ('/wiki/', '/docx/', '/docs/', '/sheets/', '/base/'):
            if prefix in path:
                token = path.split(prefix, 1)[1].split('/')[0]
                if token:
                    return token
        raise RuntimeError('无法从飞书链接中提取 token')
    return source


def parse_response(response: requests.Response, action: str) -> dict:
    response.raise_for_status()
    data = response.json()
    if data.get('code') != 0:
        raise RuntimeError(f'{action}失败: {data}')
    return data


def resolve_doc_token(access_token: str, source: str) -> str:
    token = extract_token(source)
    response = requests.get(
        f'{BASE_URL}/wiki/v2/spaces/get_node',
        headers={'Authorization': f'Bearer {access_token}'},
        params={'token': token},
        timeout=30,
    )
    if response.ok:
        data = response.json()
        if data.get('code') == 0:
            return data['data']['node']['obj_token']
    return token


def upload_image(access_token: str, doc_token: str, image_path: Path) -> str:
    if not image_path.exists():
        raise RuntimeError(f'图片不存在: {image_path}')
    mime_type = mimetypes.guess_type(str(image_path))[0] or 'application/octet-stream'
    with image_path.open('rb') as fh:
        response = requests.post(
            f'{BASE_URL}/drive/v1/medias/upload_all',
            headers={'Authorization': f'Bearer {access_token}'},
            data={
                'file_name': image_path.name,
                'parent_type': 'docx_image',
                'parent_node': doc_token,
                'size': str(image_path.stat().st_size),
            },
            files={'file': (image_path.name, fh, mime_type)},
            timeout=60,
        )
    data = parse_response(response, '上传图片')
    return data['data']['file_token']


def append_image_block(access_token: str, doc_token: str, file_token: str) -> dict:
    response = requests.post(
        f'{BASE_URL}/docx/v1/documents/{doc_token}/blocks/{doc_token}/children',
        headers={
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
        },
        json={
            'children': [
                {
                    'block_type': 27,
                    'image': {
                        'file_token': file_token,
                    },
                }
            ]
        },
        timeout=30,
    )
    return parse_response(response, '插入图片块')


def append_caption(access_token: str, doc_token: str, caption: str) -> Optional[dict]:
    if not caption:
        return None
    response = requests.post(
        f'{BASE_URL}/docx/v1/documents/{doc_token}/blocks/{doc_token}/children',
        headers={
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
        },
        json={
            'children': [
                {
                    'block_type': 2,
                    'text': {
                        'elements': [
                            {
                                'text_run': {
                                    'content': caption,
                                }
                            }
                        ]
                    },
                }
            ]
        },
        timeout=30,
    )
    return parse_response(response, '插入图片说明')


def main() -> None:
    parser = argparse.ArgumentParser(description='把本地图片上传并插入到飞书 docx 文档末尾')
    parser.add_argument('doc', help='飞书文档链接、wiki/docx token，或 docx token')
    parser.add_argument('image_path', help='本地图片绝对路径')
    parser.add_argument('--caption', help='可选：图片下方追加一行说明文字')
    args = parser.parse_args()

    access_token = get_access_token()
    doc_token = resolve_doc_token(access_token, args.doc)
    image_path = Path(args.image_path).expanduser().resolve()

    try:
        file_token = upload_image(access_token, doc_token, image_path)
        image_result = append_image_block(access_token, doc_token, file_token)
        caption_result = append_caption(access_token, doc_token, args.caption) if args.caption else None
    except requests.HTTPError as exc:
        print(f'HTTP 请求失败: {exc}', file=sys.stderr)
        sys.exit(2)
    except Exception as exc:
        print(f'插入图片失败: {exc}', file=sys.stderr)
        sys.exit(3)

    print(json.dumps({
        'doc_token': doc_token,
        'image_path': str(image_path),
        'file_token': file_token,
        'image_result': image_result,
        'caption_result': caption_result,
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
