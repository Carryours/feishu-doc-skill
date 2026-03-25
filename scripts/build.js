#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_ROOT = path.join(ROOT_DIR, 'dist');
const OUTPUT_DIR = path.join(DIST_ROOT, 'feishu-doc-skill');
const COPY_TARGETS = [
  'SKILL.md',
  'scripts/extract_feishu_doc_id.js',
  'scripts/feishu_oauth_server.js',
  'scripts/insert_feishu_local_image.js',
  'scripts/lib',
  'scripts/read_feishu_doc.js',
  'scripts/read_feishu_url.js',
  'scripts/read_feishu_url_md.js',
];

function ensureCleanDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyTarget(relativePath, outputDir = OUTPUT_DIR) {
  const sourcePath = path.join(ROOT_DIR, relativePath);
  const targetPath = path.join(outputDir, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.cpSync(sourcePath, targetPath, { recursive: true });
}

function buildSkill(outputDir = OUTPUT_DIR) {
  ensureCleanDir(outputDir);
  for (const target of COPY_TARGETS) {
    copyTarget(target, outputDir);
  }
  return outputDir;
}

function main() {
  const outputDir = buildSkill();
  console.log(`已生成 skill 产物: ${outputDir}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  ROOT_DIR,
  DIST_ROOT,
  OUTPUT_DIR,
  COPY_TARGETS,
  ensureCleanDir,
  copyTarget,
  buildSkill,
};
