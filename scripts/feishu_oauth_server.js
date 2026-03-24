#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const querystring = require('querystring');

const HOST = process.env.FEISHU_OAUTH_HOST || '127.0.0.1';
const PORT = Number(process.env.FEISHU_OAUTH_PORT || 3333);
const CALLBACK_PATH = process.env.FEISHU_OAUTH_CALLBACK_PATH || '/callback';
const REDIRECT_URI =
  process.env.FEISHU_REDIRECT_URI || `http://${HOST}:${PORT}${CALLBACK_PATH}`;
const TOKEN_OUTPUT =
  process.env.FEISHU_TOKEN_OUTPUT ||
  path.resolve(__dirname, '../.feishu-user-token.json');
const CONFIG_OUTPUT =
  process.env.FEISHU_OAUTH_CONFIG_OUTPUT ||
  path.resolve(__dirname, '../.feishu-oauth-config.json');

const defaultCredentials = {
  appId: process.env.FEISHU_APP_ID || '',
  appSecret: process.env.FEISHU_APP_SECRET || '',
};
const stateStore = new Map();

function loadSavedCredentials() {
  if (!fs.existsSync(CONFIG_OUTPUT)) {
    return { appId: '', appSecret: '' };
  }
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_OUTPUT, 'utf8'));
    return {
      appId: data.app_id || '',
      appSecret: data.app_secret || '',
    };
  } catch (error) {
    return { appId: '', appSecret: '' };
  }
}

function saveCredentials(appId, appSecret) {
  const payload = {
    saved_at: new Date().toISOString(),
    app_id: appId,
    app_secret: appSecret,
  };
  fs.writeFileSync(CONFIG_OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function deleteSavedCredentials() {
  if (fs.existsSync(CONFIG_OUTPUT)) {
    fs.unlinkSync(CONFIG_OUTPUT);
  }
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`接口返回了非 JSON 内容: ${text.slice(0, 500)}`);
  }
}

async function getAppAccessToken(appId, appSecret) {
  const response = await fetch(
    'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      }),
    },
  );

  const data = await readJson(response);
  if (!response.ok || data.code !== 0) {
    throw new Error(`获取 app_access_token 失败: ${JSON.stringify(data)}`);
  }

  return data.app_access_token;
}

async function getUserAccessToken(appId, appSecret, code) {
  const appAccessToken = await getAppAccessToken(appId, appSecret);
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

function buildAuthorizeUrl(appId, state) {
  const url = new URL('https://open.feishu.cn/open-apis/authen/v1/index');
  url.searchParams.set('app_id', appId);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('state', state);
  return url.toString();
}

function writeTokenFile(appId, tokenData) {
  const payload = {
    saved_at: new Date().toISOString(),
    redirect_uri: REDIRECT_URI,
    app_id: appId,
    ...tokenData,
  };
  fs.writeFileSync(TOKEN_OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderHomePage(message = '') {
  const saved = loadSavedCredentials();
  const appId = defaultCredentials.appId || saved.appId;
  const appSecret = defaultCredentials.appSecret || saved.appSecret;
  const checked = appId && appSecret && appId === saved.appId && appSecret === saved.appSecret;

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>飞书 OAuth 调试</title>
  </head>
  <body style="font-family: sans-serif; padding: 24px; max-width: 720px;">
    <h1>飞书 OAuth 调试</h1>
    <p>回调地址：<code>${escapeHtml(REDIRECT_URI)}</code></p>
    <p>授权成功后，token 会保存到：<code>${escapeHtml(TOKEN_OUTPUT)}</code></p>
    ${
      message
        ? `<p style="padding: 12px; background: #fff7e6; border: 1px solid #ffd591; border-radius: 8px;">${escapeHtml(message)}</p>`
        : ''
    }
    <form method="post" action="/start" style="display: grid; gap: 12px; margin-top: 20px;">
      <label>
        <div style="margin-bottom: 6px;">App ID</div>
        <input name="app_id" value="${escapeHtml(appId)}" placeholder="请输入 App ID" style="width: 100%; padding: 10px;" />
      </label>
      <label>
        <div style="margin-bottom: 6px;">App Secret</div>
        <input name="app_secret" value="${escapeHtml(appSecret)}" placeholder="请输入 App Secret" style="width: 100%; padding: 10px;" />
      </label>
      <label style="display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" name="remember_credentials" value="1" ${checked ? 'checked' : ''} />
        <span>记住凭证到本地配置文件</span>
      </label>
      <button type="submit" style="width: fit-content; padding: 10px 18px;">开始飞书授权</button>
    </form>
    <p style="margin-top: 24px; color: #666;">如果你不勾选“记住凭证”，本次填写的 App ID / App Secret 只会保留在当前服务进程内。</p>
  </body>
</html>`;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderHomePage());
    return;
  }

  if (req.method === 'POST' && url.pathname === '/start') {
    try {
      const body = await readRequestBody(req);
      const form = querystring.parse(body);
      const appId = String(form.app_id || '').trim();
      const appSecret = String(form.app_secret || '').trim();
      const rememberCredentials = form.remember_credentials === '1';

      if (!appId || !appSecret) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderHomePage('请先填写 App ID 和 App Secret'));
        return;
      }

      const state = crypto.randomBytes(16).toString('hex');
      stateStore.set(state, {
        appId,
        appSecret,
        createdAt: Date.now(),
      });

      if (rememberCredentials) {
        saveCredentials(appId, appSecret);
      } else if (!defaultCredentials.appId && !defaultCredentials.appSecret) {
        deleteSavedCredentials();
      }

      res.writeHead(302, {
        Location: buildAuthorizeUrl(appId, state),
      });
      res.end();
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`启动授权失败: ${error.message}\n`);
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === CALLBACK_PATH) {
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

    const stateData = returnedState ? stateStore.get(returnedState) : null;
    if (!stateData) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('state 校验失败\n');
      return;
    }

    try {
      const tokenData = await getUserAccessToken(stateData.appId, stateData.appSecret, code);
      writeTokenFile(stateData.appId, tokenData);
      stateStore.delete(returnedState);
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
