/**
 * Script Transformer - Apply stability rules to Playwright scripts
 * Rules: waitFor before click, timeout 15000, scrollIntoViewIfNeeded, no waitForTimeout
 */

import { ClassifiedFailure } from './types';

/** Add waitFor + scrollIntoView before .click(), ensure waitFor has timeout */
export function transformScript(
  source: string,
  _classified?: ClassifiedFailure
): string {
  let out = source;

  // Rule3: ensure waitFor has timeout 15000
  out = out.replace(
    /\.waitFor\(\s*\{\s*state:\s*['"]visible['"]\s*\}\s*\)/g,
    '.waitFor({ state: \'visible\', timeout: 15000 })'
  );

  // Rule1+2+4: before .click() add waitFor and scrollIntoViewIfNeeded
  // Match: <indent>await <expr>.click() - expr can be multiline (locator chains)
  out = out.replace(
    /^(\s*)(await\s+)([\s\S]*?)(\.click\(\))/gm,
    (_, indent, awaitKw, expr, clickPart) => {
      const trimmed = expr.trimEnd();
      return `${indent}${awaitKw}${trimmed}.waitFor({ state: 'visible', timeout: 15000 });\n${indent}await ${trimmed}.scrollIntoViewIfNeeded();\n${indent}${awaitKw}${trimmed}${clickPart}`;
    }
  );

  // Remove any waitForTimeout (forbidden)
  out = out.replace(/await\s+page\.waitForTimeout\s*\([^)]+\)\s*;?\s*/g, '');
  out = out.replace(/await\s+[\w]+\.waitForTimeout\s*\([^)]+\)\s*;?\s*/g, '');

  return out;
}
