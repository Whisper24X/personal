#!/usr/bin/env node
/**
 * Prototype Runtime Verification Script
 *
 * Loads index.html in a headless browser and captures console/page errors.
 * Use this instead of manual checklist - fix based on actual error output.
 *
 * Usage:
 *   node verify.js <path-to-index.html>
 *
 * Examples:
 *   node verify.js docs/prototype/index.html
 *   node verify.js /absolute/path/to/index.html
 *
 * Exit: 0 = pass, 1 = errors found
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const SCRIPT_DIR = __dirname;
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '../../..');
const PLAYWRIGHT_SKILL_PATH = path.join(PROJECT_ROOT, 'skills/playwright-skill/skills/playwright-skill');

function resolvePlaywright() {
  const { createRequire } = require('module');
  const skillRequire = createRequire(path.join(PLAYWRIGHT_SKILL_PATH, 'package.json'));
  try {
    return skillRequire('playwright');
  } catch {
    try {
      return require('playwright');
    } catch {
      console.error('Playwright not found. Run: cd skills/playwright-skill/skills/playwright-skill && npm run setup');
      process.exit(2);
    }
  }
}

function showHelp() {
  console.log(`
原型运行时验证脚本

用法:
  node verify.js <index.html 路径>

示例:
  node verify.js docs/prototype/index.html

成功: exit 0，输出 ✅ 原型验证通过
失败: exit 1，输出错误列表，按错误信息修复后重新运行
`);
}

async function runVerification(htmlPath) {
  const { chromium } = resolvePlaywright();

  const absolutePath = path.isAbsolute(htmlPath) ? htmlPath : path.resolve(process.cwd(), htmlPath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ 文件不存在: ${absolutePath}`);
    process.exit(1);
  }

  const stats = fs.statSync(absolutePath);
  if (stats.size < 2048) {
    console.error(`❌ 文件过小 (${stats.size} bytes)，可能被截断，需 > 2KB`);
    process.exit(1);
  }

  const errors = [];
  const fileUrl = pathToFileURL(absolutePath).href;

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();

    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        const text = msg.text();
        if (text && !text.includes('Download the Vue Devtools')) {
          errors.push(`[${type}] ${text}`);
        }
      }
    });

    page.on('pageerror', (err) => {
      errors.push(`[pageerror] ${err.message}`);
    });

    await page.goto(fileUrl, { waitUntil: 'load', timeout: 15000 }).catch((e) => {
      errors.push(`[load] ${e.message}`);
    });

    await page.waitForTimeout(2000);

    const hasApp = await page.evaluate(() => {
      const app = document.getElementById('app');
      return app && app.innerHTML.trim().length > 0;
    }).catch(() => false);

    if (!hasApp && errors.length === 0) {
      errors.push('[mount] #app 未正确挂载或为空');
    }
  } finally {
    await browser.close();
  }

  if (errors.length > 0) {
    console.error('❌ 原型验证失败，发现以下错误：\n');
    errors.forEach((e, i) => console.error(`  ${i + 1}. ${e}`));
    console.error('\n请根据错误信息修复后重新运行验证。');
    process.exit(1);
  }

  console.log('✅ 原型验证通过');
  console.log(`   路径：${path.relative(process.cwd(), absolutePath) || absolutePath}`);
  console.log(`   文件大小：${stats.size} bytes`);
  process.exit(0);
}

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  showHelp();
  process.exit(0);
}

runVerification(args[0]).catch((err) => {
  console.error('❌ 验证脚本异常:', err.message);
  process.exit(1);
});
