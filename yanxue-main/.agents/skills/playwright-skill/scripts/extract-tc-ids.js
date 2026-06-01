#!/usr/bin/env node
/**
 * Extract TC-* case IDs from TEST.md-style documents (#### TC-F-001 ... headings).
 * Usage: node scripts/extract-tc-ids.js <path/to/TEST.md> [--json] [--type 管理后台]
 */
const fs = require('fs');
const path = require('path');
const { extractOrderedCases, filterIdsByType } = require('./parse-test-md-meta.js');

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const typeIdx = argv.indexOf('--type');
const typeFilter = typeIdx >= 0 && argv[typeIdx + 1] ? argv[typeIdx + 1] : null;
const posArgs = argv.filter((a, i) => {
  if (a === '--json' || a === '--type') return false;
  if (i > 0 && argv[i - 1] === '--type') return false;
  return true;
});
const filePath = posArgs[0];

if (!filePath) {
  console.error('Usage: node scripts/extract-tc-ids.js <path/to/TEST.md> [--json] [--type 管理后台]');
  process.exit(1);
}

const abs = path.resolve(process.cwd(), filePath);
let text;
try {
  text = fs.readFileSync(abs, 'utf8');
} catch (e) {
  console.error('Cannot read file:', abs, e.message);
  process.exit(1);
}

const cases = extractOrderedCases(text);
let ordered = cases.map((c) => c.id);
if (typeFilter) {
  ordered = filterIdsByType(cases, typeFilter);
}

if (asJson) {
  console.log(
    JSON.stringify(
      {
        file: abs,
        count: ordered.length,
        ids: ordered,
        typeFilter: typeFilter || null,
      },
      null,
      2
    )
  );
  process.exit(0);
}

console.log(`File: ${abs}`);
if (typeFilter) console.log(`Type filter: ${typeFilter}`);
console.log(`Count: ${ordered.length}`);
ordered.forEach((id, i) => console.log(`${String(i + 1).padStart(3, ' ')}  ${id}`));
