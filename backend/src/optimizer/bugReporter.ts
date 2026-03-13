/**
 * Bug Reporter - Generate Bug JSON for SYSTEM_* failures
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { ClassifiedFailure, BugReport } from './types';
import { isSystemFailure } from './failureClassifier';

export async function generateBugReport(
  classified: ClassifiedFailure[],
  reportDir: string
): Promise<BugReport[]> {
  const systemFailures = classified.filter((c) => isSystemFailure(c.type));
  if (systemFailures.length === 0) return [];

  const bugs: BugReport[] = systemFailures.map((c) => {
    const p = c.parsed;
    const expected = p.logEmbed?.expected ?? '';
    const actual = p.logEmbed?.actual ?? '';
    return {
      testCase: p.testName,
      step: p.step,
      expected: expected || '(见 error)',
      actual: actual || p.errorMessage,
      screenshot: p.screenshot ?? '',
      error: p.errorMessage,
    };
  });

  const bugsPath = path.join(reportDir, 'bugs.json');
  await fs.mkdir(path.dirname(bugsPath), { recursive: true });
  await fs.writeFile(bugsPath, JSON.stringify(bugs, null, 2), 'utf-8');
  return bugs;
}
