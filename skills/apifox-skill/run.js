#!/usr/bin/env node
/**
 * API Test Executor (apifox-skill)
 *
 * Runs API test scripts (api-test-*.js) from a file or directory.
 * Usage:
 *   node run.js <script-path>       Run single script
 *   node run.js <directory>         Run all api-test-*.js in directory
 *
 * Scripts are run with NODE_PATH including this skill's node_modules so require('axios') works.
 * Output: CLI summary; optional JSON report to REPORT_DIR (e.g. docs/test/report-api).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SKILL_DIR = __dirname;
const NODE_MODULES = path.join(SKILL_DIR, 'node_modules');

function ensureAxios() {
  try {
    require.resolve('axios');
    return true;
  } catch (e) {
    console.error('❌ axios not found. Run in skill dir: npm install');
    return false;
  }
}

function runOneScript(scriptPath) {
  const start = Date.now();
  const nodePath = process.env.NODE_PATH || '';
  const sep = path.delimiter;
  const newPath = NODE_MODULES + sep + nodePath;

  const result = spawnSync(
    process.execPath,
    [scriptPath],
    {
      cwd: path.dirname(scriptPath),
      env: { ...process.env, NODE_PATH: newPath },
      encoding: 'utf8',
      timeout: 60000,
    }
  );

  const duration = Date.now() - start;
  const success = result.status === 0;
  return {
    scriptPath,
    filename: path.basename(scriptPath),
    success,
    duration,
    exitCode: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function findApiTestScripts(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return [];
  }
  const names = fs.readdirSync(dir);
  return names
    .filter((n) => n.startsWith('api-test-') && n.endsWith('.js'))
    .map((n) => path.join(dir, n))
    .sort();
}

function writeReportJson(results, reportDir) {
  if (!reportDir) return;
  try {
    fs.mkdirSync(reportDir, { recursive: true });
    const summary = {
      total: results.length,
      passed: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      successRate: results.length ? ((results.filter((r) => r.success).length / results.length) * 100).toFixed(2) + '%' : '0%',
      totalDuration: results.reduce((s, r) => s + r.duration, 0),
    };
    const payload = {
      summary,
      results: results.map((r) => ({
        testCaseId: r.filename.replace(/\.js$/, ''),
        filename: r.filename,
        success: r.success,
        duration: r.duration,
        exitCode: r.exitCode,
        error: r.success ? undefined : (r.stderr || r.stdout || `exit code ${r.exitCode}`),
      })),
      timestamp: new Date().toISOString(),
    };
    const outPath = path.join(reportDir, 'api-results.json');
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`\n📄 Report written: ${outPath}`);
  } catch (e) {
    console.error('Failed to write report:', e.message);
  }
}

function main() {
  process.chdir(SKILL_DIR);

  if (!ensureAxios()) {
    process.exit(1);
  }

  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
API Test Executor (apifox-skill)

Usage:
  node run.js <script-path>              Run single api-test-*.js
  node run.js <directory>                Run all api-test-*.js in directory
  node run.js <directory> [report-dir]    Run scripts and write JSON report to report-dir

Examples:
  node run.js ./docs/test/auto-api/api-test-TC-001.js
  node run.js ./docs/test/auto-api
  node run.js ./docs/test/auto-api ./docs/test/report-api

Environment:
  BASE_URL       Base URL for API (scripts may use process.env.BASE_URL)
  ACCESS_TOKEN   Optional auth token (scripts may use process.env.ACCESS_TOKEN)
  REPORT_DIR     Optional report output directory (if not passed as argument)
`);
    process.exit(0);
  }

  const target = path.resolve(args[0]);
  const reportDir = args[1] ? path.resolve(args[1]) : process.env.REPORT_DIR ? path.resolve(process.env.REPORT_DIR) : null;

  let scripts = [];
  if (fs.existsSync(target)) {
    if (fs.statSync(target).isDirectory()) {
      scripts = findApiTestScripts(target);
    } else if (target.endsWith('.js')) {
      scripts = [target];
    }
  }

  if (scripts.length === 0) {
    console.log('No api-test-*.js scripts found.');
    if (reportDir) {
      writeReportJson([], reportDir);
    }
    process.exit(0);
  }

  console.log(`\n🚀 Running ${scripts.length} API test script(s)\n`);

  const results = scripts.map(runOneScript);

  const passed = results.filter((r) => r.success).length;
  const failed = results.length - passed;

  results.forEach((r) => {
    const icon = r.success ? '✅' : '❌';
    console.log(`${icon} ${r.filename} (${(r.duration / 1000).toFixed(2)}s)`);
    if (!r.success && r.stderr) {
      console.log(`   ${r.stderr.split('\n')[0]}`);
    }
  });

  console.log(`\n--- Total: ${passed} passed, ${failed} failed ---\n`);

  if (reportDir) {
    writeReportJson(results, reportDir);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
