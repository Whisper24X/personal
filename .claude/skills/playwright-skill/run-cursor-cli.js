#!/usr/bin/env node
/**
 * 在 playwright-skill 目录下使用 Cursor CLI，配置从项目根 .env 加载
 * 用法: node run-cursor-cli.js "你的 prompt"
 *   或: npm run cursor -- "你的 prompt"
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// 项目根 .env 路径：skills/playwright-skill -> 上两级 -> ainative 根
const rootEnvPath = path.resolve(__dirname, '..', '..', '.env');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[run-cursor-cli] .env not found: ${filePath}`);
    return;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    process.env[key] = val;
  }
}

loadEnv(rootEnvPath);

const model = process.env.CURSOR_CLI_MODEL || process.env.CURSOR_MODEL || 'composer-1';
const apiKey = process.env.CURSOR_API_KEY;
const command = process.env.CURSOR_CLI_COMMAND || 'cursor-agent';

// 取脚本后的参数作为 prompt（支持 -- 分隔）
const argv = process.argv.slice(2);
const dashIndex = argv.indexOf('--');
const promptArgs = dashIndex >= 0 ? argv.slice(dashIndex + 1) : argv;
const prompt = promptArgs.length ? promptArgs.join(' ') : '请根据当前项目（Playwright 技能）执行浏览器自动化或测试任务。';

if (!apiKey) {
  console.error('[run-cursor-cli] 未设置 CURSOR_API_KEY，请在项目根 .env 中配置');
  process.exit(1);
}

const args = [
  '--model', model,
  '--api-key', apiKey,
  '--print',
  prompt,
];

// 在内层 skill 目录执行，便于 Cursor 发现 SKILL.md 与 run.js
const skillCwd = path.join(__dirname, 'skills', 'playwright-skill');
const cwd = fs.existsSync(skillCwd) ? skillCwd : __dirname;

const child = spawn(command, args, {
  stdio: 'inherit',
  env: process.env,
  cwd,
});

child.on('exit', (code) => process.exit(code != null ? code : 0));
