#!/usr/bin/env node
/**
 * 从 TEST.md 解析 TC-*，在 by-id 目录下为每个 ID 生成最小占位 .js（不替代真实自动化实现）。
 *
 * Usage:
 *   node scripts/generate-tc-stubs.js <TEST.md> <by-id目录> [--force] [--type 管理后台] [--priority P0] [--executable]
 *
 * 文件名：playwright-test-<TC-ID>.js
 * 已存在文件默认跳过；--force 覆盖。
 */
const fs = require('fs');
const path = require('path');
const { extractOrderedCases, filterIdsByOptions } = require('./parse-test-md-meta.js');

const args = process.argv.slice(2);
const typeIdx = args.indexOf('--type');
const typeFilter = typeIdx >= 0 && args[typeIdx + 1] ? args[typeIdx + 1] : null;
const priorityIdx = args.indexOf('--priority');
const priorityFilter = priorityIdx >= 0 && args[priorityIdx + 1] ? args[priorityIdx + 1] : null;
const executableOnly = args.includes('--executable');
const force = args.includes('--force');
const posArgs = args.filter((a, i) => {
  if (a === '--type' || a === '--priority' || a === '--force' || a === '--executable') return false;
  if (i > 0 && (args[i - 1] === '--type' || args[i - 1] === '--priority')) return false;
  return true;
});
const testPath = posArgs[0];
const dirPath = posArgs[1];

if (!testPath || !dirPath) {
  console.error(
    'Usage: node scripts/generate-tc-stubs.js <TEST.md> <by-id目录> [--force] [--type 管理后台] [--priority P0] [--executable]'
  );
  process.exit(1);
}

const stubBody = (id) => `/**
 * TEST.md — ${id}
 * 占位：由 generate-tc-stubs.js 生成；请替换为真实 Playwright 步骤（run.js 从 skill 目录执行）。
 */
(async () => {
  console.log('[SKIP] ${id}: stub — replace with implementation');
})();
`;

const testAbs = path.resolve(testPath);
const dirAbs = path.resolve(dirPath);
let testText;
try {
  testText = fs.readFileSync(testAbs, 'utf8');
} catch (e) {
  console.error('Cannot read TEST.md:', e.message);
  process.exit(1);
}

fs.mkdirSync(dirAbs, { recursive: true });

const cases = extractOrderedCases(testText);
const ids = filterIdsByOptions(cases, {
  type: typeFilter,
  priority: priorityFilter,
  executableOnly,
});

let written = 0;
let skipped = 0;

for (const id of ids) {
  const fileName = `playwright-test-${id}.js`;
  const full = path.join(dirAbs, fileName);
  if (fs.existsSync(full) && !force) {
    skipped++;
    continue;
  }
  fs.writeFileSync(full, stubBody(id), 'utf8');
  written++;
}

console.log(
  `generate-tc-stubs: ${ids.length} IDs${typeFilter ? ` (type=${typeFilter})` : ''}${priorityFilter ? ` (priority=${priorityFilter})` : ''}${executableOnly ? ' (executable=yes)' : ''}; wrote ${written}, skipped ${skipped} (use --force to overwrite)`
);
