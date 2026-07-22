#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  getSkillEnvLocalPath,
  getWorkspaceRoot,
  loadEnvFileMap,
  loadRuntimeConfig,
  parseDotEnvLines,
} from './runtime-config.mjs';

const RUNNER_KEYS = [
  'SKILL_WORKSPACE_ROOT',
  'RUNNER_DIRECT_MODE',
  'RUNNER_BASE_URL',
  'RUNNER_GATEWAY_PREFIX',
  'RUNNER_CONTAINER_NAME',
  'RUNNER_ADMIN_AUTH_HEADER',
  'RUNNER_CLIENT_AUTH_HEADER',
  'RUNNER_SHADOW_AUTH_HEADER',
  'RUNNER_WECHAT_AUTH_HEADER',
  'RUNNER_TEST_STRICT',
  'RUNNER_ALLOW_UNAUTH',
  'RUNNER_REQUEST_TIMEOUT_MS',
  'APIFOX_SMOKE_MAX_ENDPOINTS',
  'APIFOX_SMOKE_KEYWORDS',
];

function formatExportLine(key, value) {
  const escaped = String(value).replace(/"/g, '\\"');
  return `export ${key}="${escaped}"`;
}

function mergeEnvLines(existingText, updates) {
  const lines = String(existingText || '').split(/\r?\n/);
  const keyIndex = new Map();
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const idx = normalized.indexOf('=');
    if (idx <= 0) continue;
    keyIndex.set(normalized.slice(0, idx).trim(), i);
  }

  for (const [key, value] of Object.entries(updates)) {
    if (!value) continue;
    const line = formatExportLine(key, value);
    if (keyIndex.has(key)) {
      lines[keyIndex.get(key)] = line;
    } else {
      lines.push(line);
    }
  }

  return `${lines.filter((line, index, arr) => index < arr.length).join('\n').replace(/\n*$/, '\n')}`;
}

async function main() {
  const workspaceRoot = getWorkspaceRoot();
  const runtime = await loadRuntimeConfig(workspaceRoot);
  const envFromFiles = await loadEnvFileMap(workspaceRoot);
  const targetPath = getSkillEnvLocalPath(workspaceRoot);

  const updates = {
    SKILL_WORKSPACE_ROOT: workspaceRoot,
    RUNNER_DIRECT_MODE: process.env.RUNNER_DIRECT_MODE || envFromFiles.RUNNER_DIRECT_MODE || 'true',
    RUNNER_BASE_URL:
      process.env.RUNNER_BASE_URL
      || envFromFiles.RUNNER_BASE_URL
      || runtime.backend?.baseUrl
      || 'http://127.0.0.1:8000',
  };

  if (process.env.RUNNER_GATEWAY_PREFIX || envFromFiles.RUNNER_GATEWAY_PREFIX) {
    updates.RUNNER_GATEWAY_PREFIX = process.env.RUNNER_GATEWAY_PREFIX || envFromFiles.RUNNER_GATEWAY_PREFIX;
  }

  for (const key of RUNNER_KEYS) {
    if (key in updates) continue;
    const fromProcess = String(process.env[key] || '').trim();
    const fromFile = String(envFromFiles[key] || '').trim();
    if (fromProcess) updates[key] = fromProcess;
    else if (fromFile) updates[key] = fromFile;
  }

  let existingText = '';
  try {
    existingText = await fs.readFile(targetPath, 'utf-8');
  } catch {
    // new file
  }

  const merged = mergeEnvLines(existingText, updates);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, merged, 'utf-8');

  process.stdout.write(`${JSON.stringify({
    written: targetPath,
    keys: Object.keys(updates),
    baseUrl: updates.RUNNER_BASE_URL,
    directMode: updates.RUNNER_DIRECT_MODE,
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
