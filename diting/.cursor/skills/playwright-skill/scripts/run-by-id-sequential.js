#!/usr/bin/env node
/**
 * 按 TEST.md 中出现顺序，依次对 by-id 下脚本执行 run.js（同一进程顺序执行，不并行）。
 *
 * Usage:
 *   node scripts/run-by-id-sequential.js <TEST.md> <by-id目录> [--type 管理后台] [--priority P0] [--executable] [--continue-on-fail] [--headed]
 *
 * `--headed`：有界面跑 Chromium（设置 PLAYWRIGHT_FORCE_HEADED=1，并取消 PLAYWRIGHT_HEADLESS）；便于本地逐条看浏览器。
 *
 * 须在 playwright-skill 目录外调用时设置 cwd 或通过环境变量仍能解析 run.js：
 * 本脚本固定使用 $SKILL_DIR = 本文件 ../.. 的父目录（scripts 的父目录即 playwright-skill）。
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { extractOrderedCases, filterIdsByOptions } = require('./parse-test-md-meta.js');

const args = process.argv.slice(2);
const typeIdx = args.indexOf('--type');
const typeFilter = typeIdx >= 0 && args[typeIdx + 1] ? args[typeIdx + 1] : null;
const priorityIdx = args.indexOf('--priority');
const priorityFilter = priorityIdx >= 0 && args[priorityIdx + 1] ? args[priorityIdx + 1] : null;
const executableOnly = args.includes('--executable');
const continueOnFail = args.includes('--continue-on-fail');
const headed = args.includes('--headed');
const posArgs = args.filter((a, i) => {
  if (
    a === '--type' ||
    a === '--priority' ||
    a === '--executable' ||
    a === '--continue-on-fail' ||
    a === '--headed'
  )
    return false;
  if (i > 0 && (args[i - 1] === '--type' || args[i - 1] === '--priority')) return false;
  return true;
});
const testPath = posArgs[0];
const dirPath = posArgs[1];

if (!testPath || !dirPath) {
  console.error(
    'Usage: node scripts/run-by-id-sequential.js <TEST.md> <by-id目录> [--type 管理后台] [--priority P0] [--executable] [--continue-on-fail] [--headed]'
  );
  process.exit(1);
}

const SKILL_DIR = path.join(__dirname, '..');
const runJs = path.join(SKILL_DIR, 'run.js');
if (!fs.existsSync(runJs)) {
  console.error('run.js not found:', runJs);
  process.exit(1);
}

const testAbs = path.resolve(testPath);
const dirAbs = path.resolve(dirPath);
const testText = fs.readFileSync(testAbs, 'utf8');
const cases = extractOrderedCases(testText);
const ordered = filterIdsByOptions(cases, {
  type: typeFilter,
  priority: priorityFilter,
  executableOnly,
});

let failed = 0;
for (const id of ordered) {
  const scriptFile = path.join(dirAbs, `playwright-test-${id}.js`);
  if (!fs.existsSync(scriptFile)) {
    console.error(`[run-by-id-sequential] missing ${scriptFile}, skip`);
    failed++;
    if (!continueOnFail) process.exit(1);
    continue;
  }
  console.log(`\n--- run.js ${id} ---\n`);
  const childEnv = { ...process.env };
  if (headed) {
    childEnv.PLAYWRIGHT_FORCE_HEADED = '1';
    delete childEnv.PLAYWRIGHT_HEADLESS;
  }
  const r = spawnSync(process.execPath, [runJs, scriptFile], {
    cwd: SKILL_DIR,
    stdio: 'inherit',
    env: childEnv,
  });
  const code = r.status != null ? r.status : 1;
  if (code !== 0) {
    failed++;
    console.error(`[run-by-id-sequential] ${id} exit ${code}`);
    if (!continueOnFail) process.exit(code);
  }
}

if (failed > 0) {
  console.error(`\nrun-by-id-sequential: done with ${failed} failure(s)`);
  process.exit(1);
}
console.log('\nrun-by-id-sequential: all OK,', ordered.length, 'scripts');
