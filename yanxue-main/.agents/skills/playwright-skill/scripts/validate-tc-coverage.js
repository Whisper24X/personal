#!/usr/bin/env node
/**
 * Compare TC-* IDs from TEST.md with a generated Playwright suite file.
 * The suite MUST declare the full ID list so generation cannot silently omit cases.
 *
 * Supported declarations in the suite .js file (first match wins):
 *   // PLAYWRIGHT_TC_IDS: TC-F-001,TC-F-002,...
 *   const PLAYWRIGHT_TC_IDS = ['TC-F-001', 'TC-F-002', ...];
 *
 * Optional: verify each ID has a matching async function tc_F_001 / tc_E_001 / tc_B_003
 *   (pass --check-functions)
 *
 * Usage:
 *   node scripts/validate-tc-coverage.js <TEST.md> <suite.js> [--check-functions]
 * Exit 0 if lists match (same length & same set), else 1.
 */
const fs = require('fs');
const path = require('path');

const testPath = process.argv[2];
const suitePath = process.argv[3];
const checkFunctions = process.argv.includes('--check-functions');

if (!testPath || !suitePath) {
  console.error(
    'Usage: node scripts/validate-tc-coverage.js <TEST.md> <suite.js> [--check-functions]'
  );
  process.exit(1);
}

function extractIdsFromTestMd(text) {
  const re = /^####\s+(TC-[FEB]-\d+)/gm;
  const seen = new Set();
  const ordered = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      ordered.push(m[1]);
    }
  }
  return ordered;
}

function extractIdsFromSuite(text) {
  const line = text.match(/\/\/\s*PLAYWRIGHT_TC_IDS:\s*([^\n\r]+)/);
  if (line) {
    return line[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const block = text.match(/const\s+PLAYWRIGHT_TC_IDS\s*=\s*\[([\s\S]*?)\]\s*;?/);
  if (block) {
    const inner = block[1];
    const ids = [];
    const strRe = /['"](TC-[FEB]-\d+)['"]/g;
    let sm;
    while ((sm = strRe.exec(inner)) !== null) ids.push(sm[1]);
    return ids;
  }
  return null;
}

function idToFunctionName(id) {
  const m = id.match(/^TC-([FEB])-(\d+)$/);
  if (!m) return null;
  return `tc_${m[1]}_${m[2]}`;
}

const testAbs = path.resolve(testPath);
const suiteAbs = path.resolve(suitePath);
let testText;
let suiteText;
try {
  testText = fs.readFileSync(testAbs, 'utf8');
  suiteText = fs.readFileSync(suiteAbs, 'utf8');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const fromTest = extractIdsFromTestMd(testText);
const fromSuite = extractIdsFromSuite(suiteText);

if (!fromSuite || fromSuite.length === 0) {
  console.error(
    'validate-tc-coverage: suite 中未找到 PLAYWRIGHT_TC_IDS（需 // PLAYWRIGHT_TC_IDS: ... 或 const PLAYWRIGHT_TC_IDS = [...]）'
  );
  console.error('file:', suiteAbs);
  process.exit(1);
}

const setTest = new Set(fromTest);
const setSuite = new Set(fromSuite);

let ok = fromTest.length === fromSuite.length && fromTest.every((id, i) => id === fromSuite[i]);

if (fromTest.length !== fromSuite.length || !ok) {
  ok =
    setTest.size === setSuite.size &&
    [...setTest].every((id) => setSuite.has(id));
}

if (!ok) {
  console.error('validate-tc-coverage: TEST.md 与 suite 中 PLAYWRIGHT_TC_IDS 不一致');
  console.error('TEST.md count:', fromTest.length, 'suite count:', fromSuite.length);
  const onlyTest = fromTest.filter((id) => !setSuite.has(id));
  const onlySuite = fromSuite.filter((id) => !setTest.has(id));
  if (onlyTest.length) console.error('only in TEST.md:', onlyTest.join(', '));
  if (onlySuite.length) console.error('only in suite:', onlySuite.join(', '));
  process.exit(1);
}

if (checkFunctions) {
  const missing = [];
  for (const id of fromTest) {
    const fn = idToFunctionName(id);
    const re = new RegExp(`async\\s+function\\s+${fn}\\s*\\(`);
    if (!re.test(suiteText)) missing.push(`${id} -> ${fn}`);
  }
  if (missing.length) {
    console.error('validate-tc-coverage: 缺少 async function:', missing.join('; '));
    process.exit(1);
  }
}

console.log('OK validate-tc-coverage:', fromTest.length, 'TC-* IDs match');
