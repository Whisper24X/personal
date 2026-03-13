/**
 * Optimizer Runner - Orchestrate parse → classify → transform → rerun pipeline
 * Max 2 retry rounds for SCRIPT_* failures; SYSTEM_* → bug report
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { logger } from '../utils';
import { parseFromResults } from './reportParser';
import { classifyFailures, isScriptFailure } from './failureClassifier';
import { transformScript } from './scriptTransformer';
import { generateBugReport } from './bugReporter';
const MAX_RETRY_ROUNDS = 2;

export interface RunScriptFn {
  (scriptPath: string): Promise<{ success: boolean; error?: string; logEmbed?: any; screenshotFail?: string }>;
}

export interface OptimizerRunnerOptions<T = Record<string, unknown>> {
  scriptFiles: string[];
  reportDir: string;
  autoDir: string;
  results: T[];
  runScript: RunScriptFn;
}

/**
 * Run optimizer pipeline: parse → classify → transform (SCRIPT_*) → rerun up to 2 rounds
 * SYSTEM_* failures → generate bugs.json
 */
export async function runOptimizer<T extends { jsonFile: string; success: boolean; testCaseId?: string }>(
  options: OptimizerRunnerOptions<T>
): Promise<{
  results: T[];
  optimized: string[];
  bugsGenerated: boolean;
}> {
  const { reportDir, autoDir, results, runScript } = options;
  const failed = results.filter((r) => !r.success);
  if (failed.length === 0) {
    return { results, optimized: [], bugsGenerated: false };
  }

  let currentResults = [...results];
  const optimized: string[] = [];

  for (let round = 0; round < MAX_RETRY_ROUNDS; round++) {
    const parsed = parseFromResults(currentResults, autoDir);
    const classified = classifyFailures(parsed);
    const scriptFailures = classified.filter((c) => isScriptFailure(c.type));
    const systemFailures = classified.filter((c) => !isScriptFailure(c.type));

    if (round === 0 && systemFailures.length > 0) {
      const bugs = await generateBugReport(systemFailures, reportDir);
      if (bugs.length > 0) {
        logger.info('Optimizer: Generated bug report for SYSTEM_* failures', {
          count: bugs.length,
          path: path.join(reportDir, 'bugs.json'),
        });
      }
    }

    if (scriptFailures.length === 0) break;

    const scriptPaths = [...new Set(scriptFailures.map((c) => c.parsed.scriptPath))];
    for (const scriptPath of scriptPaths) {
      const cf = scriptFailures.find((c) => c.parsed.scriptPath === scriptPath);
      if (!cf) continue;
      try {
        const source = await fs.readFile(scriptPath, 'utf-8');
        const transformed = transformScript(source, cf);
        if (transformed === source) continue;
        await fs.writeFile(scriptPath, transformed, 'utf-8');
        optimized.push(scriptPath);
        logger.info('Optimizer: Transformed script', {
          file: path.basename(scriptPath),
          type: cf.type,
        });
      } catch (e: any) {
        logger.warn('Optimizer: Failed to transform script', {
          scriptPath,
          error: e?.message ?? String(e),
        });
      }
    }

    if (optimized.length === 0) break;

    const toRerun = scriptPaths.filter((p) => optimized.includes(p));
    for (const scriptPath of toRerun) {
      const res = await runScript(scriptPath);
      const jsonFile = path.basename(scriptPath);
      const idx = currentResults.findIndex((r) => r.jsonFile === jsonFile);
      if (idx >= 0) {
        currentResults[idx] = {
          ...currentResults[idx],
          success: res.success,
          error: res.error,
          screenshotFail: res.screenshotFail,
          logEmbed: res.logEmbed,
        };
      }
    }
  }

  return {
    results: currentResults,
    optimized,
    bugsGenerated: failed.some((r) => {
      const parsed = parseFromResults(currentResults, autoDir);
      const classified = classifyFailures(parsed);
      const rId = (r as { testCaseId?: string }).testCaseId ?? r.jsonFile.replace(/\.(js|ts)$/, '');
      return classified.some((c) => !isScriptFailure(c.type) && c.parsed.testName === rId);
    }),
  };
}
