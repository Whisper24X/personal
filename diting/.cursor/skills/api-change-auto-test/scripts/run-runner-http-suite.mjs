#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  classifyEndpoint,
  defaultPostBody,
  getWorkspaceRoot,
  headersForEndpoint,
  loadEnvFileMap,
  loadRuntimeConfig,
} from './runtime-config.mjs';

const SKILL_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const WORKSPACE_ROOT = getWorkspaceRoot();

function runCommand(command, args) {
  const r = spawnSync(command, args, { encoding: 'utf-8' });
  return { code: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function requestTimeoutSeconds() {
  const timeoutMs = Number(process.env.RUNNER_REQUEST_TIMEOUT_MS || 30000);
  const normalized = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000;
  return Math.max(normalized / 1000, 0.001);
}

function hasDocker() {
  const r = runCommand('docker', ['version']);
  return r.code === 0;
}

function getRunnerContainerName() {
  if (process.env.RUNNER_CONTAINER_NAME?.trim()) return process.env.RUNNER_CONTAINER_NAME.trim();
  return null;
}

function resolveExecutionTarget() {
  const forceDirect = String(process.env.RUNNER_DIRECT_MODE ?? 'true').toLowerCase() === 'true';
  const containerName = getRunnerContainerName();
  if (!forceDirect && containerName && hasDocker()) {
    return { mode: 'docker', containerName };
  }
  const baseURL = (process.env.RUNNER_BASE_URL || 'http://127.0.0.1:8000').trim().replace(/\/+$/, '');
  return { mode: 'direct', baseURL };
}

function toFeatureId(inputPath) {
  const p = inputPath.replace(/\\/g, '/').split('/');
  const changesIdx = p.indexOf('changes');
  if (changesIdx >= 0 && p[changesIdx + 1] && p[changesIdx + 1] !== 'archive') {
    return p[changesIdx + 1];
  }
  const openspecIdx = p.indexOf('openspec');
  const specsIdx = openspecIdx >= 0 ? p.indexOf('specs', openspecIdx) : -1;
  if (specsIdx >= 0 && p[specsIdx - 1] === 'openspec' && p[specsIdx + 1]) {
    return p[specsIdx + 1];
  }
  const i = p.lastIndexOf('feature');
  if (i >= 0 && p[i + 1]) return p[i + 1];
  return path.basename(path.dirname(inputPath)) || 'unknown-feature';
}

function normalizeApiPath(apiPath) {
  const input = String(apiPath || '').trim();
  if (!input) return '/';

  if (/^https?:\/\//i.test(input)) {
    try {
      const u = new URL(input);
      return `${u.pathname || '/'}${u.search || ''}`;
    } catch {
      // fallback
    }
  }

  return input.startsWith('/') ? input : `/${input}`;
}

function buildGatewayPath(apiPath) {
  const prefixRaw = process.env.RUNNER_GATEWAY_PREFIX;
  const prefix = (prefixRaw === undefined ? '/api' : prefixRaw).trim();
  const raw = normalizeApiPath(apiPath);

  if (!prefix || prefix === '/') return raw;
  const normalizedPrefix = prefix.startsWith('/') ? prefix.replace(/\/+$/, '') : `/${prefix.replace(/\/+$/, '')}`;

  if (raw === normalizedPrefix || raw.startsWith(`${normalizedPrefix}/`)) {
    return raw;
  }
  return `${normalizedPrefix}${raw}`;
}

function passStatus(status) {
  const strict = String(process.env.RUNNER_TEST_STRICT || 'false').toLowerCase() === 'true';
  const allowUnauth = String(process.env.RUNNER_ALLOW_UNAUTH || 'false').toLowerCase() === 'true';
  if (!Number.isFinite(status) || status <= 0) return false;
  if (!allowUnauth && (status === 401 || status === 403)) return false;
  if (strict) return status >= 200 && status < 300;
  return status !== 404 && status !== 405 && status < 500;
}

async function annotateParsedApis(parsedJson, runtime) {
  const parsed = JSON.parse(await fs.readFile(parsedJson, 'utf-8'));
  parsed.endpoints = (parsed.endpoints || []).map((ep) => ({
    ...ep,
    authChannel: classifyEndpoint(ep, runtime),
  }));
  await fs.writeFile(parsedJson, `${JSON.stringify(parsed, null, 2)}\n`, 'utf-8');
  return parsed;
}

async function applyEnvFiles(workspaceRoot) {
  const envFromFiles = await loadEnvFileMap(workspaceRoot);
  for (const [key, value] of Object.entries(envFromFiles)) {
    if (value && (process.env[key] === undefined || process.env[key] === '')) {
      process.env[key] = value;
    }
  }
  return envFromFiles;
}

async function main() {
  const [, , mode, apiChangesPathArg] = process.argv;
  if (!mode || !apiChangesPathArg) throw new Error('Usage: node run-runner-http-suite.mjs <smoke|full> <apiChanges.md>');

  const envFromFiles = await applyEnvFiles(WORKSPACE_ROOT);
  const runtime = await loadRuntimeConfig(WORKSPACE_ROOT);
  const envMap = { ...envFromFiles, ...process.env };

  const apiChangesPath = path.resolve(apiChangesPathArg);
  const featureId = toFeatureId(apiChangesPath);
  const reportDir = path.join(WORKSPACE_ROOT, 'tmp', 'api-test-reports', featureId);
  await fs.mkdir(reportDir, { recursive: true });

  const parsedJson = path.join(reportDir, 'parsed-apis.json');
  const planJson = path.join(reportDir, `${mode}-plan.json`);
  const resultJson = path.join(reportDir, `${mode}-result.json`);
  const logFile = path.join(reportDir, `${mode}.raw.log`);

  runCommand('node', [path.join(SKILL_ROOT, 'scripts/parse-api-changes.mjs'), apiChangesPath, parsedJson]);
  await annotateParsedApis(parsedJson, runtime);
  runCommand('node', [path.join(SKILL_ROOT, 'scripts/generate-report.mjs'), 'plan', parsedJson, mode, planJson]);

  const plan = JSON.parse(await fs.readFile(planJson, 'utf-8'));
  const targets = plan.planned || [];

  const target = resolveExecutionTarget();
  const suiteStartedAt = new Date();
  const suiteStartedMs = Date.now();
  const cases = [];
  const logs = [];

  for (const ep of targets) {
    const method = String(ep.method || '').toUpperCase();
    const apiPath = String(ep.path || '');
    const gatewayPath = buildGatewayPath(apiPath);
    const authChannel = ep.authChannel || classifyEndpoint(ep, runtime);
    const body = defaultPostBody(method);

    let run;
    const headers = headersForEndpoint(ep, runtime, envMap);
    const caseStartedAt = new Date();
    const caseStartedMs = Date.now();
    const maxTime = String(requestTimeoutSeconds());
    if (target.mode === 'docker') {
      const args = ['exec', target.containerName, 'curl', '-sS', '-X', method, `http://127.0.0.1:8080${gatewayPath}`];
      for (const h of headers) args.push('-H', h);
      if (body && method !== 'GET') args.push('--data', JSON.stringify(body));
      args.push('--max-time', maxTime);
      args.push('-w', '\n__STATUS__:%{http_code}');
      run = runCommand('docker', args);
    } else {
      const args = ['-sS', '-X', method, `${target.baseURL}${gatewayPath}`];
      for (const h of headers) args.push('-H', h);
      if (body && method !== 'GET') args.push('--data', JSON.stringify(body));
      args.push('--max-time', maxTime);
      args.push('-w', '\n__STATUS__:%{http_code}');
      run = runCommand('curl', args);
    }
    const caseCompletedAt = new Date();
    const durationMs = Date.now() - caseStartedMs;
    const merged = `${run.stdout}${run.stderr ? `\n${run.stderr}` : ''}`;
    const marker = merged.lastIndexOf('__STATUS__:');
    const rawBody = marker >= 0 ? merged.slice(0, marker).trim() : merged.trim();
    const status = Number(marker >= 0 ? merged.slice(marker + '__STATUS__:'.length).trim() : '0') || 0;
    const timedOut = run.code === 28 || /Operation timed out|timed out/i.test(run.stderr || run.stdout || '');

    const passed = run.code === 0 && passStatus(status);
    logs.push(`[${passed ? 'PASS' : 'FAIL'}] ${method} ${gatewayPath} (${authChannel}) -> ${status} (${durationMs}ms${timedOut ? ', timeout' : ''})`);
    cases.push({
      method,
      path: apiPath,
      gatewayPath,
      authChannel,
      status,
      passed,
      timedOut,
      durationMs,
      startedAt: caseStartedAt.toISOString(),
      completedAt: caseCompletedAt.toISOString(),
      requestBody: body,
      responseBody: rawBody,
      error: run.code === 0 ? '' : (run.stderr || run.stdout || `command exited ${run.code}`),
    });
  }

  const suiteCompletedAt = new Date();
  await fs.writeFile(logFile, `${logs.join('\n')}\n`, 'utf-8');
  const result = {
    mode,
    status: cases.every((c) => c.passed) ? 'passed' : 'failed',
    featureId,
    reportDir,
    executionTarget: target,
    plannedCount: targets.length,
    passedCount: cases.filter((c) => c.passed).length,
    failedCount: cases.filter((c) => !c.passed).length,
    startedAt: suiteStartedAt.toISOString(),
    completedAt: suiteCompletedAt.toISOString(),
    durationMs: Date.now() - suiteStartedMs,
    logFile,
    cases,
  };
  await fs.writeFile(resultJson, `${JSON.stringify(result, null, 2)}\n`, 'utf-8');
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.status === 'passed' ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
