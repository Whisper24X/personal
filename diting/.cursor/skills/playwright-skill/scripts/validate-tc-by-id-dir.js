#!/usr/bin/env node
/**
 * 备选 B：校验 `by-id` 目录下是否为每个 TEST.md 中的 TC-* 各有一文件。
 *
 * Usage:
 *   node scripts/validate-tc-by-id-dir.js <TEST.md> <by-id目录路径> [--type 管理后台] [--priority P0] [--executable]
 *
 * `--type 管理后台`：只校验属性表中「类型」为该值的用例。
 * `--priority P0`：只校验指定优先级。
 * `--executable`：只校验属性表中「本轮是否执行」为「是」的用例。
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
const posArgs = args.filter((a, i) => {
  if (a === '--type' || a === '--priority' || a === '--executable') return false;
  if (i > 0 && (args[i - 1] === '--type' || args[i - 1] === '--priority')) return false;
  return true;
});
const testPath = posArgs[0];
const dirPath = posArgs[1];

if (!testPath || !dirPath) {
  console.error(
    'Usage: node scripts/validate-tc-by-id-dir.js <TEST.md> <by-id目录路径> [--type 管理后台] [--priority P0] [--executable]'
  );
  process.exit(1);
}

const testAbs = path.resolve(testPath);
const dirAbs = path.resolve(dirPath);
let testText;
try {
  testText = fs.readFileSync(testAbs, 'utf8');
} catch (e) {
  console.error('Cannot read TEST.md:', e.message);
  process.exit(1);
}

if (!fs.existsSync(dirAbs) || !fs.statSync(dirAbs).isDirectory()) {
  console.error('Not a directory:', dirAbs);
  process.exit(1);
}

const cases = extractOrderedCases(testText);
const ids = filterIdsByOptions(cases, {
  type: typeFilter,
  priority: priorityFilter,
  executableOnly,
});

const missing = [];
const extra = [];

for (const id of ids) {
  const fileName = `playwright-test-${id}.js`;
  const full = path.join(dirAbs, fileName);
  if (!fs.existsSync(full)) {
    missing.push(fileName);
  }
}

const expectedPrefix = 'playwright-test-TC-';
const allJs = fs.readdirSync(dirAbs).filter((f) => f.endsWith('.js') && f.startsWith(expectedPrefix));
const idSet = new Set(ids);
for (const f of allJs) {
  const inner = f.replace(/^playwright-test-/, '').replace(/\.js$/, '');
  if (!idSet.has(inner)) {
    extra.push(f);
  }
}

if (missing.length) {
  console.error('validate-tc-by-id-dir: 缺少文件（相对 by-id 目录）:', missing.join(', '));
  process.exit(1);
}

if (extra.length) {
  console.error(
    'validate-tc-by-id-dir: 目录中存在预期集合外的脚本（请删除或调整 --type/TEST.md）:',
    extra.join(', ')
  );
  process.exit(1);
}

console.log(
  'OK validate-tc-by-id-dir:',
  ids.length,
  'files',
  typeFilter ? `(type=${typeFilter})` : '',
  priorityFilter ? `(priority=${priorityFilter})` : '',
  executableOnly ? '(executable=yes)' : '',
  'under',
  dirAbs
);
