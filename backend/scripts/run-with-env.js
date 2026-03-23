#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function resolveEnvFilePaths(cwd) {
  const nodeEnv = process.env.NODE_ENV?.trim() || 'local';
  const envFile = nodeEnv === 'local' ? '.env.local' : `.env.${nodeEnv}`;

  return fs.existsSync(path.join(cwd, envFile)) ? [envFile] : [];
}

function buildEnv(cwd) {
  const env = {};
  const files = resolveEnvFilePaths(cwd);

  for (const file of [...files].reverse()) {
    const absolutePath = path.join(cwd, file);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }
    Object.assign(env, dotenv.parse(fs.readFileSync(absolutePath)));
  }

  return {
    ...env,
    ...process.env,
  };
}

const args = process.argv.slice(2);
const commandArgs = args[0] === '--' ? args.slice(1) : args;

if (commandArgs.length === 0) {
  console.error('Usage: node scripts/run-with-env.js -- <command> [...args]');
  process.exit(1);
}

const cwd = process.cwd();
const child = spawn(commandArgs[0], commandArgs.slice(1), {
  cwd,
  env: buildEnv(cwd),
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
