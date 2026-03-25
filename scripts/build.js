#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_ROOT = path.join(ROOT_DIR, 'dist');
const OUTPUT_DIR = path.join(DIST_ROOT, 'feishu-doc-skill');
const COPY_TARGETS = ['SKILL.md', 'README.md', 'scripts'];

function ensureCleanDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyTarget(relativePath, outputDir = OUTPUT_DIR) {
  const sourcePath = path.join(ROOT_DIR, relativePath);
  const targetPath = path.join(outputDir, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.cpSync(sourcePath, targetPath, {
    recursive: true,
    filter: (currentSourcePath) => path.basename(currentSourcePath) !== 'build.js',
  });
}

function createDistPackageJson(outputDir = OUTPUT_DIR) {
  const packageJsonPath = path.join(ROOT_DIR, 'package.json');
  const sourcePackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const distPackageJson = {
    name: sourcePackageJson.name,
    version: sourcePackageJson.version,
    private: true,
    description: sourcePackageJson.description,
    engines: sourcePackageJson.engines,
    scripts: {
      dev: sourcePackageJson.scripts.dev,
      check:
        'node --check scripts/dev.js && node --check scripts/feishu_oauth_server.js && ' +
        'node --check scripts/extract_feishu_doc_id.js && node --check scripts/read_feishu_doc.js && ' +
        'node --check scripts/read_feishu_url.js && node --check scripts/read_feishu_url_md.js && ' +
        'node --check scripts/insert_feishu_local_image.js',
    },
  };

  fs.writeFileSync(
    path.join(outputDir, 'package.json'),
    `${JSON.stringify(distPackageJson, null, 2)}\n`,
    'utf8',
  );
}

function createDistGitignore(outputDir = OUTPUT_DIR) {
  const lines = [
    '.feishu-user-token.json',
    '.feishu-oauth-config.json',
    'node_modules/',
    '.DS_Store',
  ];
  fs.writeFileSync(path.join(outputDir, '.gitignore'), `${lines.join('\n')}\n`, 'utf8');
}

function buildSkill(outputDir = OUTPUT_DIR) {
  ensureCleanDir(outputDir);
  for (const target of COPY_TARGETS) {
    copyTarget(target, outputDir);
  }
  createDistPackageJson(outputDir);
  createDistGitignore(outputDir);
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
  createDistPackageJson,
  createDistGitignore,
  buildSkill,
};
