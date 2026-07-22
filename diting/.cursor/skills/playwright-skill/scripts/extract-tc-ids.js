#!/usr/bin/env node
/**
 * Extract TC-* case IDs from TEST.md-style documents (#### TC-F-001 ... headings).
 * Usage: node scripts/extract-tc-ids.js <path/to/TEST.md> [--json] [--type 管理后台] [--priority P0] [--executable]
 */
const fs = require('fs');
const path = require('path');
const { extractOrderedCases, filterIdsByOptions } = require('./parse-test-md-meta.js');

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const typeIdx = argv.indexOf('--type');
const typeFilter = typeIdx >= 0 && argv[typeIdx + 1] ? argv[typeIdx + 1] : null;
const priorityIdx = argv.indexOf('--priority');
const priorityFilter = priorityIdx >= 0 && argv[priorityIdx + 1] ? argv[priorityIdx + 1] : null;
const executableOnly = argv.includes('--executable');
const posArgs = argv.filter((a, i) => {
  if (a === '--json' || a === '--type' || a === '--priority' || a === '--executable') return false;
  if (i > 0 && argv[i - 1] === '--type') return false;
  if (i > 0 && argv[i - 1] === '--priority') return false;
  return true;
});
const filePath = posArgs[0];

if (!filePath) {
  console.error(
    'Usage: node scripts/extract-tc-ids.js <path/to/TEST.md> [--json] [--type 管理后台] [--priority P0] [--executable]'
  );
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
const ordered = filterIdsByOptions(cases, {
  type: typeFilter,
  priority: priorityFilter,
  executableOnly,
});

if (asJson) {
  console.log(
    JSON.stringify(
      {
        file: abs,
        count: ordered.length,
        ids: ordered,
        typeFilter: typeFilter || null,
        priorityFilter: priorityFilter || null,
        executableOnly,
      },
      null,
      2
    )
  );
  process.exit(0);
}

console.log(`File: ${abs}`);
if (typeFilter) console.log(`Type filter: ${typeFilter}`);
if (priorityFilter) console.log(`Priority filter: ${priorityFilter}`);
if (executableOnly) console.log('Executable only: yes');
console.log(`Count: ${ordered.length}`);
ordered.forEach((id, i) => console.log(`${String(i + 1).padStart(3, ' ')}  ${id}`));
