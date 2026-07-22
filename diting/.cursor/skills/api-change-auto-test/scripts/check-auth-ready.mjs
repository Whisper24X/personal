#!/usr/bin/env node

import path from 'node:path';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import {
  aggregateAuthProfiles,
  checkAuthForProfiles,
  classifyEndpoint,
  getWorkspaceRoot,
  loadEnvFileMap,
  loadRuntimeConfig,
  resolveApiChangesPath,
} from './runtime-config.mjs';

const SKILL_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

async function main() {
  const [, , specPathArg, outputPathArg] = process.argv;
  const workspaceRoot = getWorkspaceRoot();
  const runtime = await loadRuntimeConfig(workspaceRoot);
  const envFromFiles = await loadEnvFileMap(workspaceRoot);
  const envMap = { ...envFromFiles, ...process.env };

  const specPath = await resolveApiChangesPath(specPathArg || '', workspaceRoot);
  const tmpParsed = path.join(workspaceRoot, 'tmp', 'api-test-auth-check-parsed.json');
  await fs.mkdir(path.dirname(tmpParsed), { recursive: true });

  const parseRun = spawnSync('node', [path.join(SKILL_ROOT, 'scripts/parse-api-changes.mjs'), specPath, tmpParsed], {
    encoding: 'utf-8',
  });
  if (parseRun.status !== 0) {
    throw new Error(parseRun.stderr || parseRun.stdout || 'parse-api-changes failed');
  }

  const parsed = JSON.parse(await fs.readFile(tmpParsed, 'utf-8'));
  const endpoints = (parsed.endpoints || []).map((ep) => ({
    ...ep,
    authChannel: classifyEndpoint(ep, runtime),
  }));
  const profiles = aggregateAuthProfiles(endpoints, runtime);
  const mergedCheck = checkAuthForProfiles(profiles, runtime, envMap);
  const processOnlyCheck = checkAuthForProfiles(profiles, runtime, process.env);
  const fileOnlyCheck = checkAuthForProfiles(profiles, runtime, envFromFiles);

  const result = {
    specPath,
    featureId: parsed.featureId || 'unknown-feature',
    authReady: profiles.length === 0 ? true : mergedCheck.authReady,
    authProfiles: profiles,
    missing: mergedCheck.missing,
    tokenSources: {
      processEnv: processOnlyCheck.authReady,
      dotEnvLocal: fileOnlyCheck.authReady,
    },
    endpoints: endpoints.map((ep) => ({
      method: ep.method,
      path: ep.path,
      authChannel: ep.authChannel,
    })),
    runtimePath: 'skills/api-change-auto-test/api-test/runtime.json',
    checkedAt: new Date().toISOString(),
  };

  const text = `${JSON.stringify(result, null, 2)}\n`;
  if (outputPathArg) {
    await fs.writeFile(path.resolve(outputPathArg), text, 'utf-8');
  }
  process.stdout.write(text);
  process.exit(result.authReady ? 0 : 2);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
