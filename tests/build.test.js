const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { buildSkill } = require('../scripts/build');

test('buildSkill outputs only runtime skill files', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feishu-doc-skill-build-'));

  try {
    buildSkill(outputDir);

    const files = [];
    const walk = (dirPath) => {
      for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else {
          files.push(path.relative(outputDir, fullPath));
        }
      }
    };

    walk(outputDir);
    files.sort();

    assert.deepEqual(files, [
      'SKILL.md',
      'scripts/extract_feishu_doc_id.js',
      'scripts/feishu_oauth_server.js',
      'scripts/insert_feishu_local_image.js',
      'scripts/lib/auth.js',
      'scripts/lib/doc-summary.js',
      'scripts/lib/feishu-api.js',
      'scripts/lib/token.js',
      'scripts/read_feishu_doc.js',
      'scripts/read_feishu_url.js',
      'scripts/read_feishu_url_md.js',
    ]);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});
