#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const HOST = process.env.FEISHU_OAUTH_HOST || '127.0.0.1';
const PORT = Number(process.env.FEISHU_OAUTH_PORT || 3333);
const CALLBACK_PATH = process.env.FEISHU_OAUTH_CALLBACK_PATH || '/callback';
const REDIRECT_URI =
  process.env.FEISHU_REDIRECT_URI || `http://${HOST}:${PORT}${CALLBACK_PATH}`;
const TOKEN_OUTPUT =
  process.env.FEISHU_TOKEN_OUTPUT ||
  path.resolve(__dirname, '../.feishu-user-token.json');

if (!APP_ID || !APP_SECRET) {
  console.error('缺少 FEISHU_APP_ID 或 FEISHU_APP_SECRET');
  process.exit(1);
}

const state = crypto.randomBytes(16).toString('hex');

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`接口返回了非 JSON 内容: ${text.slice(0, 500)}`);
  }
}

async function getAppAccessToken() {
  const response = await fetch(
    'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: APP_ID,
        app_secret: APP_SECRET,
      }),
    },
  );

  const data = await readJson(response);
  if (!response.ok || data.code !== 0) {
    throw new Error(`获取 app_access_token 失败: ${JSON.stringify(data)}`);
  }

  return data.app_access_token;
}

async function getUserAccessToken(code) {
  const appAccessToken = await getAppAccessToken();
  const response = await fetch('https://open.feishu.cn/open-apis/authen/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${appAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
    }),
  });

  const data = await readJson(response);
  if (!response.ok || data.code !== 0) {
    throw new Error(`获取 user_access_token 失败: ${JSON.stringify(data)}`);
  }

  return data.data;
}

function buildAuthorizeUrl() {
  const url = new URL('https://open.feishu.cn/open-apis/authen/v1/index');
  url.searchParams.set('app_id', APP_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('state', state);
  return url.toString();
}

function writeTokenFile(tokenData) {
  const payload = {
    saved_at: new Date().toISOString(),
    redirect_uri: REDIRECT_URI,
    app_id: APP_ID,
    ...tokenData,
  };
  fs.writeFileSync(TOKEN_OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  if (url.pathname === '/') {
    const authorizeUrl = buildAuthorizeUrl();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><title>飞书 OAuth 调试</title></head>
  <body style="font-family: sans-serif; padding: 24px;">
    <h1>飞书 OAuth 调试</h1>
    <p>回调地址：<code>${REDIRECT_URI}</code></p>
    <p>授权成功后，token 会保存到：<code>${TOKEN_OUTPUT}</code></p>
    <p><a href="${authorizeUrl}">点击这里开始飞书授权</a></p>
  </body>
</html>`);
    return;
  }

  if (url.pathname === CALLBACK_PATH) {
    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`飞书授权失败: ${error}\n`);
      return;
    }

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('缺少 code 参数\n');
      return;
    }

    if (returnedState !== state) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('state 校验失败\n');
      return;
    }

    try {
      const tokenData = await getUserAccessToken(code);
      writeTokenFile(tokenData);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><title>授权成功</title></head>
  <body style="font-family: sans-serif; padding: 24px;">
    <h1>授权成功</h1>
    <p>user_access_token 已保存到：</p>
    <p><code>${TOKEN_OUTPUT}</code></p>
    <p>你现在可以关闭这个页面。</p>
  </body>
</html>`);
      setTimeout(() => server.close(), 500);
    } catch (tokenError) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`${tokenError.message}\n`);
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('not found\n');
});

server.listen(PORT, HOST, () => {
  console.log(`飞书 OAuth 调试服务已启动: http://${HOST}:${PORT}`);
  console.log(`请先在飞书开放平台把回调地址加入安全设置: ${REDIRECT_URI}`);
  console.log(`然后打开: http://${HOST}:${PORT}`);
});
