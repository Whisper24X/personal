#!/usr/bin/env node
/**
 * Universal Playwright Executor for Claude Code
 *
 * Executes Playwright automation code from:
 * - File path: node run.js script.js
 * - Inline code: node run.js 'await page.goto("...")'
 * - Stdin: cat script.js | node run.js
 *
 * Ensures proper module resolution by running from skill directory.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Change to skill directory for proper module resolution
process.chdir(__dirname);

/**
 * Check if Playwright is installed
 */
function checkPlaywrightInstalled() {
  try {
    require.resolve('playwright');
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Install Playwright if missing
 */
function installPlaywright() {
  console.log('📦 Playwright not found. Installing...');
  try {
    execSync('npm install', { stdio: 'inherit', cwd: __dirname });
    execSync('npx playwright install chromium', { stdio: 'inherit', cwd: __dirname });
    console.log('✅ Playwright installed successfully');
    return true;
  } catch (e) {
    console.error('❌ Failed to install Playwright:', e.message);
    console.error('Please run manually: cd', __dirname, '&& npm run setup');
    return false;
  }
}

/**
 * Get code to execute from various sources
 */
function getCodeToExecute() {
  const args = process.argv.slice(2);

  // Case 1: File path provided
  if (args.length > 0 && fs.existsSync(args[0])) {
    const filePath = path.resolve(args[0]);
    console.log(`📄 Executing file: ${filePath}`);
    return fs.readFileSync(filePath, 'utf8');
  }

  // Case 2: Inline code provided as argument
  if (args.length > 0) {
    console.log('⚡ Executing inline code');
    return args.join(' ');
  }

  // Case 3: Code from stdin
  if (!process.stdin.isTTY) {
    console.log('📥 Reading from stdin');
    return fs.readFileSync(0, 'utf8');
  }

  // No input
  console.error('❌ No code to execute');
  console.error('Usage:');
  console.error('  node run.js script.js          # Execute file');
  console.error('  node run.js "code here"        # Execute inline');
  console.error('  cat script.js | node run.js    # Execute from stdin');
  process.exit(1);
}

/**
 * Clean up old temporary execution files from previous runs
 */
function cleanupOldTempFiles() {
  try {
    const files = fs.readdirSync(__dirname);
    const tempFiles = files.filter(f => f.startsWith('.temp-execution-') && f.endsWith('.js'));

    if (tempFiles.length > 0) {
      tempFiles.forEach(file => {
        const filePath = path.join(__dirname, file);
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          // Ignore errors - file might be in use or already deleted
        }
      });
    }
  } catch (e) {
    // Ignore directory read errors
  }
}

/**
 * Wrap code in async IIFE if not already wrapped
 */
function wrapCodeIfNeeded(code) {
  // Check if code already has require() and async structure
  const hasRequire = code.includes('require(');
  const hasAsyncIIFE = code.includes('(async () => {') || code.includes('(async()=>{');

  // If it's already a complete script, return as-is
  if (hasRequire && hasAsyncIIFE) {
    return code;
  }

  // If it's just Playwright commands, wrap in full template
  if (!hasRequire) {
    return `
const { chromium, firefox, webkit, devices } = require('playwright');
const helpers = require('./lib/helpers');

// Extra headers from environment variables (if configured)
const __extraHeaders = helpers.getExtraHeadersFromEnv();

/**
 * Utility to merge environment headers into context options.
 * Use when creating contexts with raw Playwright API instead of helpers.createContext().
 * @param {Object} options - Context options
 * @returns {Object} Options with extraHTTPHeaders merged in
 */
function getContextOptionsWithHeaders(options = {}) {
  if (!__extraHeaders) return options;
  return {
    ...options,
    extraHTTPHeaders: {
      ...__extraHeaders,
      ...(options.extraHTTPHeaders || {})
    }
  };
}

(async () => {
  try {
    ${code}
  } catch (error) {
    console.error('❌ Automation error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
})();
`;
  }

  // If has require but no async wrapper
  if (!hasAsyncIIFE) {
    return `
(async () => {
  try {
    ${code}
  } catch (error) {
    console.error('❌ Automation error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
})();
`;
  }

  return code;
}

/**
 * When AUTOMATION_REPORT_DIR and AUTOMATION_TEST_CASE_ID are set (by AutomationExecution),
 * inject page capture hook and assign main async IIFE to global.__automationPromise so we can await and take screenshot.
 */
function wrapWithScreenshotCapture(code) {
  const reportDir = process.env.AUTOMATION_REPORT_DIR;
  const testCaseId = process.env.AUTOMATION_TEST_CASE_ID;
  if (!reportDir || !testCaseId) return code;

  const hook = `
(function() {
  var __screenshotPath = require('path');
  var playwright = require('playwright');
  var origLaunch = playwright.chromium.launch.bind(playwright.chromium);
  playwright.chromium.launch = function() {
    var args = arguments;
    return origLaunch.apply(this, args).then(function(browser) {
      var origNewPage = browser.newPage.bind(browser);
      var origNewContext = browser.newContext.bind(browser);
      var origClose = browser.close.bind(browser);
      function capturePage(page) {
        global.__automationPage = page;
        return page;
      }
      browser.newPage = function() {
        return origNewPage.apply(this, arguments).then(capturePage);
      };
      browser.newContext = function() {
        var opts = arguments[0] && typeof arguments[0] === 'object' ? arguments[0] : {};
        if (!opts.viewport) {
          opts = { ...opts, viewport: { width: 1920, height: 1080 } };
        }
        return origNewContext.call(this, opts).then(function(context) {
          var origCtxNewPage = context.newPage.bind(context);
          context.newPage = function() {
            return origCtxNewPage.apply(this, arguments).then(capturePage);
          };
          return context;
        });
      };
      browser.close = function() {
        var reportDir = process.env.AUTOMATION_REPORT_DIR;
        var testCaseId = process.env.AUTOMATION_TEST_CASE_ID;
        if (reportDir && testCaseId && global.__automationPage) {
          return global.__automationPage.screenshot({ path: __screenshotPath.join(reportDir, testCaseId + '-success.png') }).catch(function() {}).then(function() {
            return origClose();
          });
        }
        return origClose();
      };
      return browser;
    });
  };
})();
`;
  // Assign main async IIFE to global.__automationPromise (replace first occurrence of "(async () => {")
  const firstAsyncIife = code.indexOf('(async () => {');
  const alt = code.indexOf('(async()=>{');
  const pos = firstAsyncIife >= 0 ? firstAsyncIife : alt;
  const pattern = firstAsyncIife >= 0 ? '(async () => {' : '(async()=>{';
  if (pos < 0) return code;
  const suffix = `
if (global.__automationPromise && process.env.AUTOMATION_REPORT_DIR && process.env.AUTOMATION_TEST_CASE_ID) {
  var __screenshotPath = require('path');
  var reportDir = process.env.AUTOMATION_REPORT_DIR;
  var testCaseId = process.env.AUTOMATION_TEST_CASE_ID;
  global.__automationPromise = global.__automationPromise
    .then(async function() {
      /* success screenshot is taken in browser.close() wrapper */
    })
    .catch(async function(e) {
      if (global.__automationPage) {
        await global.__automationPage.screenshot({ path: __screenshotPath.join(reportDir, testCaseId + '-fail.png') }).catch(function() {});
      }
      throw e;
    });
  module.exports = global.__automationPromise;
}
`;
  return hook + '\n' + code.slice(0, pos) + 'global.__automationPromise = ' + pattern + code.slice(pos + pattern.length) + suffix;
}

/**
 * Main execution
 */
async function main() {
  console.log('🎭 Playwright Skill - Universal Executor\n');

  // Clean up old temp files from previous runs
  cleanupOldTempFiles();

  // Check Playwright installation
  if (!checkPlaywrightInstalled()) {
    const installed = installPlaywright();
    if (!installed) {
      process.exit(1);
    }
  }

  // Get code to execute
  const rawCode = getCodeToExecute();
  let code = wrapCodeIfNeeded(rawCode);
  code = wrapWithScreenshotCapture(code);

  // Create temporary file for execution
  const tempFile = path.join(__dirname, `.temp-execution-${Date.now()}.js`);

  try {
    // Write code to temp file
    fs.writeFileSync(tempFile, code, 'utf8');

    // Execute the code
    console.log('🚀 Starting automation...\n');
    const exported = require(tempFile);

    if (process.env.AUTOMATION_REPORT_DIR && process.env.AUTOMATION_TEST_CASE_ID && exported && typeof exported.then === 'function') {
      await exported;
    }
  } catch (error) {
    console.error('❌ Execution failed:', error.message);
    if (error.stack) {
      console.error('\n📋 Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
