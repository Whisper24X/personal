#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const envFilePath = path.join(repoRoot, '.env');

function parseDotEnv(contents) {
  const env = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalized = line.startsWith('export ')
      ? line.slice('export '.length).trim()
      : line;
    const separatorIndex = normalized.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    let value = normalized.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function loadRootEnv() {
  if (!fs.existsSync(envFilePath)) {
    return {};
  }

  return parseDotEnv(fs.readFileSync(envFilePath, 'utf8'));
}

const fileEnv = loadRootEnv();
const mergedEnv = {
  ...fileEnv,
  ...process.env,
};

const placeholderValues = new Set(['replace_with_your_gitlab_token']);
const requiredKeys = ['GITLAB_USERNAME', 'GITLAB_TOKEN'];
const missingKeys = requiredKeys.filter((key) => {
  const value = (mergedEnv[key] || '').trim();
  return !value || placeholderValues.has(value);
});

if (missingKeys.length > 0) {
  console.error(
    [
      `Missing required env: ${missingKeys.join(', ')}`,
      'Provide them either in the current shell or in repo root .env.',
      'Example:',
      '  GITLAB_USERNAME=oauth2',
      '  GITLAB_TOKEN=your_gitlab_token',
    ].join('\n'),
  );
  process.exit(1);
}

const imageName =
  mergedEnv.AINATIVE_RUNNER_IMAGE?.trim() || 'ainative/runner:latest';
const buildPlatform =
  mergedEnv.AINATIVE_RUNNER_BUILD_PLATFORM?.trim() ||
  mergedEnv.AINATIVE_RUNNER_PLATFORM?.trim() ||
  'linux/amd64';
const extraArgs = process.argv.slice(2);
const dockerArgs = [
  'buildx',
  'build',
  '--load',
  '--platform',
  buildPlatform,
  ...extraArgs,
  '--build-arg',
  `GITLAB_USERNAME=${mergedEnv.GITLAB_USERNAME}`,
  '--build-arg',
  `GITLAB_TOKEN=${mergedEnv.GITLAB_TOKEN}`,
  '-f',
  'runner/Dockerfile.runner',
  '-t',
  imageName,
  '.',
];

const child = spawn('docker', dockerArgs, {
  cwd: repoRoot,
  env: mergedEnv,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
