/**
 * Report Parser - Extract failure info from Playwright JSON reporter or automation_results.json
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { ParsedFailure, AutomationResult } from './types';

/** In-memory result shape (from AutomationExecution) */
export interface ExecutionResultLike {
  testCaseId?: string;
  testCaseName?: string;
  jsonFile: string;
  success: boolean;
  error?: string;
  screenshotFail?: string;
  logEmbed?: AutomationResult['logEmbed'];
}

/** Extract locator/selector from Playwright error message */
function extractSelectorFromError(error: string): string | undefined {
  const cleaned = error.replace(/\u001b\[[0-9;]*m/g, '');
  // waiting for locator('...')
  const locatorMatch = cleaned.match(/waiting for locator\(['"`](.+?)['"`]\)/);
  if (locatorMatch) return locatorMatch[1];
  // getByRole('dialog', { name: '...' }).locator(...)
  const getByRoleMatch = cleaned.match(/waiting for (getByRole\([^)]+\)[^\\n]+)/);
  if (getByRoleMatch) return getByRoleMatch[1].trim();
  // locator('.el-select-dropdown')
  const locatorSimple = cleaned.match(/locator\(['"`]([^'"`]+)['"`]\)/);
  if (locatorSimple) return locatorSimple[1];
  return undefined;
}

/**
 * Parse from in-memory execution results (no file read)
 */
export function parseFromResults(
  results: ExecutionResultLike[],
  autoDir: string
): ParsedFailure[] {
  const failures: ParsedFailure[] = [];
  for (const r of results) {
    if (r.success || !r.error) continue;
    const scriptPath = path.join(autoDir, r.jsonFile);
    const selector = extractSelectorFromError(r.error) ?? r.logEmbed?.selector;
    const step = r.logEmbed?.step ?? r.testCaseName ?? (r.testCaseId ?? '').replace(/^playwright-test-/, '');
    failures.push({
      testName: r.testCaseId ?? r.jsonFile.replace(/\.(js|ts)$/, ''),
      step,
      selector,
      errorMessage: r.error,
      url: r.logEmbed?.url,
      screenshot: r.screenshotFail,
      scriptPath,
      logEmbed: r.logEmbed,
    });
  }
  return failures;
}

/**
 * Parse automation_results.json (current run.js output format)
 */
export async function parseAutomationResults(
  reportPath: string,
  autoDir: string
): Promise<ParsedFailure[]> {
  const failures: ParsedFailure[] = [];
  try {
    const content = await fs.readFile(reportPath, 'utf-8');
    const data = JSON.parse(content) as { results?: AutomationResult[] };
    const results = data.results ?? [];
    for (const r of results) {
      if (r.success || !r.error) continue;
      const scriptPath = path.join(autoDir, r.jsonFile);
      const selector = extractSelectorFromError(r.error) ?? r.logEmbed?.selector;
      const step = r.logEmbed?.step ?? r.testCaseName.replace(/^playwright-test-/, '');
      failures.push({
        testName: r.testCaseId,
        step,
        selector,
        errorMessage: r.error,
        url: r.logEmbed?.url,
        screenshot: r.screenshotFail,
        scriptPath,
        logEmbed: r.logEmbed,
      });
    }
  } catch (e) {
    // ignore parse errors
  }
  return failures;
}

/**
 * Parse Playwright JSON reporter output (npx playwright test --reporter=json)
 */
export async function parsePlaywrightJsonReport(reportPath: string): Promise<ParsedFailure[]> {
  const failures: ParsedFailure[] = [];
  try {
    const content = await fs.readFile(reportPath, 'utf-8');
    const data = JSON.parse(content) as {
      suites?: Array<{
        file?: string;
        specs?: Array<{
          title?: string;
          ok?: boolean;
          tests?: Array<{
            results?: Array<{
              error?: { message?: string };
            }>;
          }>;
        }>;
      }>;
    };
    const walk = (suites: typeof data.suites) => {
      if (!suites) return;
      for (const suite of suites) {
        for (const spec of suite.specs ?? []) {
          if (spec.ok) continue;
          const err = spec.tests?.[0]?.results?.[0]?.error?.message ?? '';
          const selector = extractSelectorFromError(err);
          failures.push({
            testName: spec.title ?? '',
            step: spec.title ?? '',
            selector,
            errorMessage: err,
            scriptPath: suite.file ?? '',
          });
        }
        walk((suite as any).suites);
      }
    };
    walk(data.suites);
  } catch (e) {
    // ignore parse errors
  }
  return failures;
}
