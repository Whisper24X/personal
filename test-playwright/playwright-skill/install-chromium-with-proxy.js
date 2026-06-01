#!/usr/bin/env node
/**
 * 通过代理安装 Playwright Chromium，便于在另一台设备或网络受限环境下使用。
 *
 * 用法（在 skills/playwright-skill/skills/playwright-skill 目录下）：
 *   # 方式一：命令行传入代理
 *   node install-chromium-with-proxy.js http://127.0.0.1:7890
 *
 *   # 方式二：使用环境变量后执行
 *   export HTTPS_PROXY=http://127.0.0.1:7890
 *   node install-chromium-with-proxy.js
 *   或
 *   HTTPS_PROXY=http://127.0.0.1:7890 npm run setup:proxy
 *
 * 新设备上建议：先开启代理，再执行 npm run setup:proxy 或上述命令。
 */

const { execSync } = require('child_process');
const path = require('path');

process.chdir(__dirname);

const proxyFromArg = process.argv[2];
const proxy = proxyFromArg || process.env.HTTPS_PROXY || process.env.PLAYWRIGHT_INSTALL_PROXY;

if (proxy) {
  console.log('Using proxy for download:', proxy);
} else {
  console.log('No proxy set. Set HTTPS_PROXY or pass proxy as first arg if download fails.');
}

const env = {
  ...process.env,
  PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT: process.env.PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT || '600000',
};
if (proxy) {
  env.HTTPS_PROXY = proxy;
  env.HTTP_PROXY = proxy;
}

try {
  execSync('npx playwright install chromium', {
    stdio: 'inherit',
    cwd: __dirname,
    env,
  });
  console.log('Chromium installed successfully.');
} catch (e) {
  console.error('Install failed. On another device, try: HTTPS_PROXY=http://YOUR_PROXY node install-chromium-with-proxy.js');
  process.exit(1);
}
