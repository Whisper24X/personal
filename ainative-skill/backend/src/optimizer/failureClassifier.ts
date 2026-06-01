/**
 * Failure Classifier - Classify failures as SCRIPT_* (optimizable) or SYSTEM_* (bug report)
 */

import { ParsedFailure, ClassifiedFailure, FailureType } from './types';

function classifyOne(parsed: ParsedFailure): FailureType {
  const msg = (parsed.errorMessage || '').toLowerCase();
  const network = parsed.logEmbed?.network ?? [];

  // SCRIPT_* - script stability issues
  if (/element not found|locator.*not found|waiting for locator|waiting for getByRole/i.test(msg)) {
    return 'SCRIPT_SELECTOR';
  }
  if (/timeout.*exceeded|exceeded.*timeout|Timeout \d+ms/i.test(msg)) {
    return 'SCRIPT_TIMEOUT';
  }
  if (/not visible|element is not visible|element is hidden/i.test(msg)) {
    return 'SCRIPT_NOT_VISIBLE';
  }
  if (/intercepts pointer events|subtree intercepts/i.test(msg)) {
    return 'SCRIPT_NOT_VISIBLE';
  }

  // SYSTEM_* - product bugs
  if (/expect\(.*\)\.(toBe|toEqual|toContain)|assertion|expected.*actual/i.test(msg)) {
    return 'SYSTEM_ASSERTION';
  }
  if (Array.isArray(network) && network.some((n) => (n.status ?? 0) >= 500)) {
    return 'SYSTEM_API_ERROR';
  }
  if (/TypeError|ReferenceError|SyntaxError|console\.(error|warn)/i.test(msg)) {
    return 'SYSTEM_CONSOLE_ERROR';
  }

  // Default: treat locator/timeout-like as script issue
  if (/locator|click|waitFor|scrollIntoView/i.test(msg)) {
    return 'SCRIPT_TIMEOUT';
  }
  return 'SYSTEM_ASSERTION';
}

export function classifyFailures(parsed: ParsedFailure[]): ClassifiedFailure[] {
  return parsed.map((p) => ({
    parsed: p,
    type: classifyOne(p),
  }));
}

export function isScriptFailure(type: FailureType): boolean {
  return type.startsWith('SCRIPT_');
}

export function isSystemFailure(type: FailureType): boolean {
  return type.startsWith('SYSTEM_');
}
