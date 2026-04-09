#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const runnerRoot = __dirname;
const repoRoot = path.resolve(runnerRoot, '..');
const envFilePath = path.join(runnerRoot, '.env.build');

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

function loadRunnerBuildEnv() {
  if (!fs.existsSync(envFilePath)) {
    return {};
  }

  return parseDotEnv(fs.readFileSync(envFilePath, 'utf8'));
}

function readTrimmedEnv(env, keys) {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

const fileEnv = loadRunnerBuildEnv();
const mergedEnv = {
  ...fileEnv,
  ...process.env,
};
const gitlabUsername =
  readTrimmedEnv(mergedEnv, ['GITLAB_USERNAME']) || 'oauth2';
const gitlabToken = readTrimmedEnv(mergedEnv, ['GITLAB_TOKEN']);
const imageName =
  readTrimmedEnv(mergedEnv, ['AINATIVE_RUNNER_IMAGE']) ||
  'ainative/runner:latest';
const buildPlatform =
  readTrimmedEnv(mergedEnv, [
    'AINATIVE_RUNNER_BUILD_PLATFORM',
    'AINATIVE_RUNNER_PLATFORM',
  ]) || 'linux/amd64';

const placeholderValues = new Set([
  'replace_with_your_gitlab_token',
  'your_gitlab_token',
]);
const missingKeys =
  placeholderValues.has(gitlabToken) || !gitlabToken ? ['GITLAB_TOKEN'] : [];

if (missingKeys.length > 0) {
  console.error(
    [
      `Missing required env: ${missingKeys.join(', ')}`,
      'Provide it either in the current shell or in runner/.env.build.',
      'Example:',
      '  GITLAB_TOKEN=your_gitlab_token',
      'Optional:',
      '  GITLAB_USERNAME=oauth2',
      '  AINATIVE_RUNNER_BUILD_PLATFORM=linux/amd64',
    ].join('\n'),
  );
  process.exit(1);
}

if (
  !readTrimmedEnv(mergedEnv, ['AINATIVE_RUNNER_BUILD_PLATFORM']) &&
  readTrimmedEnv(mergedEnv, ['AINATIVE_RUNNER_PLATFORM'])
) {
  console.warn(
    'WARN: AINATIVE_RUNNER_PLATFORM is deprecated for image build. Use AINATIVE_RUNNER_BUILD_PLATFORM instead.',
  );
}

const argv = process.argv.slice(2);
const extraArgs = argv[0] === '--' ? argv.slice(1) : argv;
const dockerArgs = [
  'buildx',
  'build',
  '--load',
  '--platform',
  buildPlatform,
  ...extraArgs,
  '--build-arg',
  `GITLAB_USERNAME=${gitlabUsername}`,
  '--build-arg',
  `GITLAB_TOKEN=${gitlabToken}`,
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
