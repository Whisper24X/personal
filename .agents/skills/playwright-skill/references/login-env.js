/**
 * Default login credentials for Playwright scripts (skill-maintained LOGIN_ACCOUNT.md).
 *
 * Usage (run.js is always started with cwd = skill root, so relative requires work):
 *
 *   const { applyLoginEnvIfUnset } = require('./references/login-env');
 *   applyLoginEnvIfUnset();
 *   const LOGIN_USER = process.env.LOGIN_USER;
 *   const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD;
 *   const TARGET_URL = process.env.TARGET_URL;
 *
 * Precedence: existing `LOGIN_USER` / `LOGIN_PASSWORD` / `TARGET_URL` in the environment are kept;
 * only missing vars are filled from LOGIN_ACCOUNT.md (`项目地址` → `TARGET_URL`).
 *
 * @module references/login-env
 */

const fs = require('fs');
const path = require('path');

const ACCOUNT_FILE = path.join(__dirname, 'LOGIN_ACCOUNT.md');

/**
 * @param {string} text
 * @returns {{ user: string, password: string, targetUrl: string }}
 */
function parseLoginAccountMd(text) {
  const urlMatch = text.match(/项目地址[：:]\s*(\S+)/);
  const userMatch = text.match(/账号[：:]\s*(\S+)/);
  const passMatch = text.match(/密码[：:]\s*(\S+)/);
  return {
    targetUrl: (urlMatch && urlMatch[1]) || '',
    user: (userMatch && userMatch[1]) || '',
    password: (passMatch && passMatch[1]) || '',
  };
}

/**
 * Read and parse `references/LOGIN_ACCOUNT.md` next to this file.
 * @returns {{ user: string, password: string, targetUrl: string }}
 */
function getLoginCredentials() {
  const text = fs.readFileSync(ACCOUNT_FILE, 'utf8');
  return parseLoginAccountMd(text);
}

/**
 * If `LOGIN_USER`, `LOGIN_PASSWORD`, or `TARGET_URL` is unset, set from LOGIN_ACCOUNT.md
 * (`项目地址` → `TARGET_URL`). Does not override existing env vars.
 */
function applyLoginEnvIfUnset() {
  const { user, password, targetUrl } = getLoginCredentials();
  if (!process.env.TARGET_URL && targetUrl) {
    process.env.TARGET_URL = targetUrl;
  }
  if (!process.env.LOGIN_USER && user) {
    process.env.LOGIN_USER = user;
  }
  if (!process.env.LOGIN_PASSWORD && password) {
    process.env.LOGIN_PASSWORD = password;
  }
}

module.exports = {
  getLoginCredentials,
  applyLoginEnvIfUnset,
  parseLoginAccountMd,
};
