#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires, no-console */
/**
 * 手动执行 Stagehand 自动化测试脚本
 * 用法: node scripts/run-stagehand-test.js <测试脚本路径>
 * 或: pnpm run run-auto-test <测试脚本路径>
 *
 * 会加载项目根目录 .env、设置 NODE_PATH=backend/src、并传递 LLM/Stagehand 相关环境变量，
 * 与 AutomationExecution 执行脚本时的环境一致。
 */

const path = require('path');
const { spawn } = require('child_process');

// 加载项目根目录 .env
const dotenv = require('dotenv');
const projectRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(projectRoot, '.env') });

const scriptPath = process.argv[2];
if (!scriptPath) {
  console.error('用法: pnpm run run-auto-test <测试脚本路径>');
  console.error('示例: pnpm run run-auto-test /path/to/TC-001-用户登录-正确账号密码登录成功.ts');
  process.exit(1);
}

const backendDir = path.resolve(__dirname, '..');
const backendSrcPath = path.join(backendDir, 'src');
const tsxPath = path.join(backendDir, 'node_modules', '.bin', 'tsx');
const resolvedScript = path.isAbsolute(scriptPath) ? scriptPath : path.resolve(process.cwd(), scriptPath);
const cwd = path.dirname(resolvedScript);

const env = {
  ...process.env,
  NODE_PATH: process.env.NODE_PATH ? `${process.env.NODE_PATH}:${backendSrcPath}` : backendSrcPath,
};

// Stagehand 内部只认 OPENAI_*，使用智谱时需映射（与 AutomationExecution 一致）
if (!env.OPENAI_API_KEY && env.ZHIPUAI_API_KEY) {
  env.OPENAI_API_KEY = env.ZHIPUAI_API_KEY;
  const rawBase = env.ZHIPUAI_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
  env.OPENAI_BASE_URL = (typeof rawBase === 'string' ? rawBase : '').replace(/\/+$/, '');
  env.OPENAI_MODEL = env.STAGEHAND_MODEL || env.ZHIPUAI_MODEL || 'glm-4-flash';
}

console.log('执行测试脚本:', resolvedScript);
console.log('工作目录:', cwd);
console.log('NODE_PATH:', env.NODE_PATH);
console.log('---');

const child = spawn(tsxPath, [resolvedScript], {
  env,
  cwd,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  process.exit(code !== null ? code : signal ? 1 : 0);
});
