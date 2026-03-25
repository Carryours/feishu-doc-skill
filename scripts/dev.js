#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const COMMANDS = {
  oauth: 'feishu_oauth_server.js',
  extract: 'extract_feishu_doc_id.js',
  'read-doc': 'read_feishu_doc.js',
  'read-json': 'read_feishu_url.js',
  'read-md': 'read_feishu_url_md.js',
  'insert-image': 'insert_feishu_local_image.js',
};

function parseDevArgs(argv) {
  const args = argv.slice(2);
  const nodeArgs = [];
  let watch = true;

  while (args.length > 0) {
    const arg = args[0];
    if (arg === '--once') {
      watch = false;
      args.shift();
      continue;
    }
    if (arg === '--inspect' || arg === '--inspect-brk') {
      nodeArgs.push(arg);
      args.shift();
      continue;
    }
    break;
  }

  const command = args.shift() || 'oauth';
  const script = COMMANDS[command];

  if (!script) {
    throw new Error(
      `未知 dev 子命令: ${command}\n` +
        '可用子命令: oauth, extract, read-doc, read-json, read-md, insert-image',
    );
  }

  return {
    command,
    script: path.resolve(__dirname, script),
    scriptArgs: args,
    nodeArgs,
    watch,
  };
}

function printHelp() {
  console.log(`feishu-doc-skill dev

用法:
  npm run dev
  npm run dev -- <command> [...args]
  npm run dev -- --inspect <command> [...args]
  npm run dev -- --once <command> [...args]

默认命令:
  oauth         启动本地 OAuth 调试服务（默认）

可用命令:
  extract       提取飞书链接 token
  read-doc      读取原始文档结构 JSON
  read-json     读取链接并输出结构化 JSON
  read-md       读取链接并输出 Markdown
  insert-image  向文档插入本地图片

示例:
  npm run dev
  npm run dev -- read-md "https://xxx.feishu.cn/wiki/xxxxxxxx"
  npm run dev -- --inspect read-doc "AtFwwJ3TwifgTpkbATOcYHQYnne"
  npm run dev -- --once insert-image "https://xxx.feishu.cn/docx/xxxx" "/tmp/a.png" --caption "说明"
`);
}

function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }

  let config;
  try {
    config = parseDevArgs(process.argv);
  } catch (error) {
    console.error(error.message || String(error));
    process.exit(1);
  }

  const child = spawn(
    process.execPath,
    [...config.nodeArgs, ...(config.watch ? ['--watch'] : []), config.script, ...config.scriptArgs],
    {
      stdio: 'inherit',
      env: process.env,
    },
  );

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  COMMANDS,
  parseDevArgs,
};
