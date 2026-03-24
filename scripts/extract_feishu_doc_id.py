#!/usr/bin/env python3
import re
import sys
from urllib.parse import urlparse


def main() -> None:
    if len(sys.argv) < 2:
        print("用法: extract_feishu_doc_id.py <feishu_url>", file=sys.stderr)
        sys.exit(1)

    url = sys.argv[1]
    path = urlparse(url).path

    patterns = [
        r"/wiki/([A-Za-z0-9]+)",
        r"/docx/([A-Za-z0-9]+)",
        r"/docs/([A-Za-z0-9]+)",
        r"/sheets/([A-Za-z0-9]+)",
        r"/base/([A-Za-z0-9]+)",
    ]

    for pattern in patterns:
        match = re.search(pattern, path)
        if match:
            print(match.group(1))
            return

    print("无法从链接中提取飞书文档 token", file=sys.stderr)
    sys.exit(2)


if __name__ == "__main__":
    main()
