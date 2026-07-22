#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(__dirname, '../dist');

const read = async (relativePath) =>
  readFile(path.join(distRoot, relativePath), 'utf8');

const fail = (message) => {
  console.error(`runner-generation dist verify failed: ${message}`);
  process.exit(1);
};

const assertIncludes = (content, needle, message) => {
  if (!content.includes(needle)) {
    fail(message);
  }
};

const assertNotIncludes = (content, needle, message) => {
  if (content.includes(needle)) {
    fail(message);
  }
};

const main = async () => {
  const [projectsService, runnerGenerationService, aiRunnerConfigGenerator] =
    await Promise.all([
      read('projects/projects.service.js'),
      read('business-lines/runner-generation.service.js'),
      read('business-lines/ai-runner-config-generator.js'),
    ]);

  assertIncludes(
    projectsService,
    'generation.written',
    'projects.service.js must consume structured generateForProject() result',
  );
  assertIncludes(
    runnerGenerationService,
    'written: true',
    'runner-generation.service.js must return structured project generation result',
  );
  assertIncludes(
    runnerGenerationService,
    "status: 'written'",
    "runner-generation.service.js must emit project generation status 'written'",
  );

  const usesOldEvidencePrompt = aiRunnerConfigGenerator.includes(
    'Bounded evidence pack:',
  );
  const usesWorkspaceSelfScanPrompt = aiRunnerConfigGenerator.includes(
    'Repositories to scan:',
  );

  if (!usesWorkspaceSelfScanPrompt) {
    fail(
      'ai-runner-config-generator.js must use workspace self-scan prompt',
    );
  }

  assertNotIncludes(
    aiRunnerConfigGenerator,
    'Bounded evidence pack:',
    'ai-runner-config-generator.js must not retain old evidence prompt',
  );
  assertNotIncludes(
    runnerGenerationService,
    'collectRunnerFullScanEvidence',
    'runner-generation.service.js must not collect old full-scan evidence in the main path',
  );
  assertIncludes(
    runnerGenerationService,
    'workspacePath: tmpDir',
    'runner-generation.service.js must pass workspacePath to full scan generation',
  );
  assertIncludes(
    runnerGenerationService,
    'repoPrefixes: clonedPrefixes',
    'runner-generation.service.js must pass repoPrefixes to full scan generation',
  );

  console.log('runner-generation dist verify passed');
};

await main();
