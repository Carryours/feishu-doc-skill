# feishu-doc-reader

一个面向 Codex 的飞书文档读写 skill，用来读取飞书 wiki 或 docx 页面、输出结构化 JSON 或 Markdown 摘要，并支持把本地图片插入飞书文档。

## 适用场景

- 读取飞书文档正文
- 总结飞书 wiki 页面
- 比较两个飞书页面内容
- 抽取需求、接口说明、表格信息
- 把读取结果整理成 Markdown
- 将本地图片插入飞书 docx 文档

## 仓库结构

- `SKILL.md`: Codex skill 说明和使用规则
- `scripts/extract_feishu_doc_id.py`: 从飞书链接中提取 token
- `scripts/feishu_oauth_server.js`: 本地 OAuth 回调服务，用于获取 `user_access_token`
- `scripts/read_feishu_doc.py`: 读取飞书文档原始结构
- `scripts/read_feishu_url.py`: 一键读取飞书链接并输出结构化结果
- `scripts/read_feishu_url_md.py`: 一键读取飞书链接并输出 Markdown
- `scripts/insert_feishu_local_image.py`: 向飞书文档插入本地图片

## 依赖要求

- Python 3.10+
- Node.js 18+
- Python 包：`requests`

安装 Python 依赖：

```bash
python3 -m pip install requests
```

## 鉴权规则

优先级如下：

1. 如果环境里已有 `FEISHU_USER_ACCESS_TOKEN`，优先使用用户身份访问飞书。
2. 如果环境变量里没有用户 token，读取和插图脚本都会自动尝试读取仓库根目录的 `.feishu-user-token.json`。
3. 如果没有用户 token，但配置了 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET`，读取脚本会尝试走应用身份；需要用户身份写入时，可先跑本地 OAuth。

常用环境变量：

```bash
export FEISHU_USER_ACCESS_TOKEN="u-xxx"
export FEISHU_APP_ID="cli_xxx"
export FEISHU_APP_SECRET="xxx"
```

## 获取用户 Token

先在飞书开放平台配置 OAuth 回调地址，然后启动本地服务：

```bash
FEISHU_APP_ID="cli_xxx" \
FEISHU_APP_SECRET="xxx" \
node scripts/feishu_oauth_server.js
```

默认回调地址是 `http://127.0.0.1:3333/callback`。授权成功后，token 会保存到仓库根目录的 `.feishu-user-token.json`。

## 常见用法

推荐的最短读取流程：

1. 首次使用时运行 `node scripts/feishu_oauth_server.js` 完成一次授权。
2. 之后直接运行 `python3 scripts/read_feishu_url_md.py "<飞书链接>"`。
3. 如果 `.feishu-user-token.json` 已存在，脚本会自动复用，不需要每次手动导出 `FEISHU_USER_ACCESS_TOKEN`。

提取链接中的文档 token：

```bash
python3 scripts/extract_feishu_doc_id.py "https://xxx.feishu.cn/wiki/xxxxxxxx"
```

读取文档原始结构：

```bash
python3 scripts/read_feishu_doc.py "AtFwwJ3TwifgTpkbATOcYHQYnne"
```

读取飞书链接并输出结构化 JSON：

```bash
python3 scripts/read_feishu_url.py "https://xxx.feishu.cn/wiki/xxxxxxxx"
```

读取飞书链接并输出 Markdown：

```bash
python3 scripts/read_feishu_url_md.py "https://xxx.feishu.cn/wiki/xxxxxxxx"
```

向飞书文档插入本地图片：

```bash
python3 scripts/insert_feishu_local_image.py \
  "https://xxx.feishu.cn/docx/xxxxxxxx" \
  "/absolute/path/to/image.png"
```

插入图片并追加说明文字：

```bash
python3 scripts/insert_feishu_local_image.py \
  "https://xxx.feishu.cn/docx/xxxxxxxx" \
  "/absolute/path/to/image.png" \
  --caption "这里是图片说明"
```

## 使用规则

- 优先使用 API 读取正文，不做网页抓取兜底。
- 面向分析、总结、拆任务时，优先使用 `scripts/read_feishu_url_md.py`。
- 面向调试和结构化处理时，优先使用 `scripts/read_feishu_url.py`。
- 如果输入是 wiki 链接或 wiki token，脚本会先解析成实际 docx `obj_token` 再继续处理。
- 插图仅支持本地图片绝对路径，不直接复用聊天中的图片附件。
- 读取失败或写入失败时，应明确说明是权限、token、路径还是文档类型问题，不要假装成功。

## 输出约定

读取成功后，建议输出至少包含：

- 文档标题
- 来源链接
- 简洁总结
- 用户要求关注的重点信息

写入或插图成功后，建议输出至少包含：

- 目标文档
- 实际写入结果
- 失败时的明确阻塞原因

## 已知限制

- 当前仓库主要覆盖飞书 docx / wiki 场景。
- 应用身份和用户身份的可访问范围由飞书权限配置决定。
- 本地图片上传依赖有效的用户 token。
- `.feishu-user-token.json` 属于本地敏感文件，不应提交到 Git。

## 发布说明

如果你是把这个目录作为独立仓库发布，建议保留：

- `README.md`
- `SKILL.md`
- `scripts/`
- `.gitignore`

这四部分就足够让别人理解 skill 的定位和使用方式。
