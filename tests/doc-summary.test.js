const test = require('node:test');
const assert = require('node:assert/strict');

const { extractTokenFromUrl } = require('../scripts/lib/token');
const { createReadUrlOutput, renderMarkdownDocument } = require('../scripts/lib/doc-summary');

test('extractTokenFromUrl supports multiple feishu path types', () => {
  assert.equal(extractTokenFromUrl('https://foo.feishu.cn/wiki/AtFwwJ3TwifgTpkbATOcYHQYnne'), 'AtFwwJ3TwifgTpkbATOcYHQYnne');
  assert.equal(extractTokenFromUrl('https://foo.feishu.cn/docx/AbCdEf123456'), 'AbCdEf123456');
  assert.equal(extractTokenFromUrl('https://foo.feishu.cn/docs/AbCdEf123456'), 'AbCdEf123456');
  assert.equal(extractTokenFromUrl('https://foo.feishu.cn/sheets/AbCdEf123456'), 'AbCdEf123456');
  assert.equal(extractTokenFromUrl('https://foo.feishu.cn/base/AbCdEf123456'), 'AbCdEf123456');
});

test('createReadUrlOutput normalizes blocks and produces summary', () => {
  const output = createReadUrlOutput('https://foo.feishu.cn/wiki/token', {
    token_source: 'user_access_token',
    input_token: 'wik123',
    resolved_wiki_node: {
      data: {
        node: {
          node_token: 'wik123',
          obj_token: 'doc456',
          title: '文档标题',
        },
      },
    },
    metadata: {
      data: {
        document: {
          title: '文档标题',
          document_id: 'doc456',
        },
      },
    },
    blocks: {
      data: {
        items: [
          {
            block_type: 3,
            heading1: {
              elements: [{ text_run: { content: '概述' } }],
            },
          },
          {
            block_type: 2,
            text: {
              elements: [{ text_run: { content: '第一段内容' } }],
            },
          },
          {
            block_type: 12,
            bullet: {
              elements: [{ text_run: { content: '要点一' } }],
            },
          },
        ],
      },
    },
  });

  assert.equal(output.title, '文档标题');
  assert.equal(output.doc_token, 'doc456');
  assert.deepEqual(output.summary.headings, ['概述']);
  assert.deepEqual(output.summary.preview, ['第一段内容', '要点一']);
  assert.equal(output.content_preview[0][0], 'heading1');
});

test('renderMarkdownDocument keeps expected sections', () => {
  const markdown = renderMarkdownDocument({
    title: '文档标题',
    url: 'https://foo.feishu.cn/wiki/token',
    wiki_token: 'wik123',
    doc_token: 'doc456',
    token_source: 'user_access_token',
    summary: {
      preview: ['第一段内容'],
      headings: ['概述'],
      stats: { text: 1, heading1: 1 },
    },
    content_preview: [
      ['heading1', '概述'],
      ['text', '第一段内容'],
    ],
  });

  assert.match(markdown, /## 文档信息/);
  assert.match(markdown, /## 快速摘要/);
  assert.match(markdown, /## 主要章节/);
  assert.match(markdown, /## 内容预览/);
  assert.match(markdown, /# 文档标题/);
});
