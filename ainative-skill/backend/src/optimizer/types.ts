/**
 * Playwright Script Optimizer - Shared types
 */

/** Parsed failure from report (reportParser output) */
export interface ParsedFailure {
  testName: string;
  step: string;
  selector?: string;
  errorMessage: string;
  url?: string;
  screenshot?: string;
  scriptPath: string;
  /** Pass-through for classifier (network status, etc.) */
  logEmbed?: AutomationResult['logEmbed'];
}

/** Failure classification result */
export type FailureType =
  | 'SCRIPT_SELECTOR'
  | 'SCRIPT_TIMEOUT'
  | 'SCRIPT_NOT_VISIBLE'
  | 'SYSTEM_ASSERTION'
  | 'SYSTEM_API_ERROR'
  | 'SYSTEM_CONSOLE_ERROR';

export interface ClassifiedFailure {
  parsed: ParsedFailure;
  type: FailureType;
}

/** Bug report for SYSTEM_* failures */
export interface BugReport {
  testCase: string;
  step: string;
  expected: string;
  actual: string;
  screenshot: string;
  error: string;
}

/** Automation result (from automation_results.json) */
export interface AutomationResult {
  testCaseId: string;
  testCaseName: string;
  jsonFile: string;
  success: boolean;
  error?: string;
  screenshotFail?: string;
  screenshotSuccess?: string;
  logEmbed?: {
    step?: string;
    selector?: string;
    expected?: string;
    actual?: string;
    url?: string;
    consoleErrors?: string[];
    network?: { api: string; status: number }[];
  };
}
