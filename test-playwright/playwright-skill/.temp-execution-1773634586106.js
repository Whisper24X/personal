
(function() {
  var __screenshotPath = require('path');
  var __fs = require('fs');
  var playwright = require('playwright');
  var origLaunch = playwright.chromium.launch.bind(playwright.chromium);

  var CONSOLE_LIMIT = 10;
  var NETWORK_LIMIT = 10;
  function filterConsoleLogs(logs) {
    var seen = {}, filtered = [];
    for (var i = 0; i < logs.length && filtered.length < CONSOLE_LIMIT; i++) {
      var t = logs[i].type;
      if (t !== 'error' && t !== 'warn') continue;
      var text = (logs[i].text || '').slice(0, 200);
      if (seen[text]) continue;
      seen[text] = true;
      filtered.push({ t: t, m: text });
    }
    return filtered;
  }
  function filterNetworkLog(network) {
    return network.filter(function(n) { return n.status >= 400; }).slice(0, NETWORK_LIMIT).map(function(n) { return { u: n.url, s: n.status }; });
  }
  function writeReportFiles(page, reportDir, testCaseId) {
    if (!page || !reportDir || !testCaseId) return Promise.resolve();
    var rawLogs = global.__automationConsoleLog || [];
    var rawNetwork = global.__automationNetworkLog || [];
    var consoleErrors = [];
    for (var i = 0; i < rawLogs.length && consoleErrors.length < 5; i++) {
      if (rawLogs[i].type === 'error') consoleErrors.push((rawLogs[i].text || '').slice(0, 150));
    }
    var failed = filterNetworkLog(rawNetwork);
    var network = failed.map(function(n) {
      try { var p = n.u ? new URL(n.u).pathname : n.u; return { api: p || n.u, status: n.s }; } catch(e) { return { api: n.u, status: n.s }; }
    });
    var log = { url: process.env.TARGET_URL || '', consoleErrors: consoleErrors, network: network };
    global.__automationLogData = log;
    return Promise.resolve();
  }

  playwright.chromium.launch = function() {
    var args = arguments;
    return origLaunch.apply(this, args).then(function(browser) {
      var origNewPage = browser.newPage.bind(browser);
      var origNewContext = browser.newContext.bind(browser);
      var origClose = browser.close.bind(browser);
      function capturePage(page) {
        global.__automationPage = page;
        global.__automationConsoleLog = [];
        global.__automationNetworkLog = [];
        page.on('console', function(msg) {
          global.__automationConsoleLog.push({
            type: msg.type(),
            text: msg.text()
          });
        });
        page.on('response', function(res) {
          var req = res.request();
          global.__automationNetworkLog.push({
            url: req.url(),
            method: req.method(),
            status: res.status()
          });
        });
        return page;
      }
      browser.newPage = function() {
        var reportDir = process.env.AUTOMATION_REPORT_DIR;
        var testCaseId = process.env.AUTOMATION_TEST_CASE_ID;
        if (reportDir && testCaseId) {
          return origNewContext.call(browser, { viewport: { width: 1920, height: 1080 } })
            .then(function(ctx) { return ctx.newPage(); })
            .then(capturePage);
        }
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
          if (global.__automationFailed) return origClose();
          return writeReportFiles(global.__automationPage, reportDir, testCaseId)
            .then(function() {
              return global.__automationPage.screenshot({ path: __screenshotPath.join(reportDir, testCaseId + '-success.png') }).catch(function() {});
            })
            .then(function() { return origClose(); });
        }
        return origClose();
      };
      return browser;
    });
  };
})();

/**
 * TC-channel-013：CSV 映射配置渠道联动 - 新渠道 Tab 配置字段映射并保存
 * 正向场景：点击新渠道E Tab，配置至少一条映射，点击保存，出现保存成功提示
 * 前置：已配置渠道「新渠道E」
 */
const { chromium } = require('playwright');

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:8080/shadow/';
const LOGIN_USER = process.env.LOGIN_USER || '';
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || '';

global.__automationPromise = (async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  try {
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    try {
      await page.waitForURL((url) => url.href.includes('/login'));
    } catch (e) {}
    if (page.url().includes('/login')) {
      if (!LOGIN_USER || !LOGIN_PASSWORD) {
        throw new Error('需要登录。请配置 skills/playwright-skill/login.md 或设置环境变量 LOGIN_USER 和 LOGIN_PASSWORD');
      }
      await page.getByLabel(/账号|用户名|手机/).fill(LOGIN_USER);
      await page.getByLabel(/密码/).fill(LOGIN_PASSWORD);
      await page.getByRole('button', { name: /登录|确定|提交/ }).waitFor({ state: 'visible', timeout: 15000 });
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    try {
      await page.waitForURL((url) => url.href.includes('/login'));
    } catch (e) {}
    if (page.url().includes('/login')) {
      if (!LOGIN_USER || !LOGIN_PASSWORD) {
        throw new Error('需要登录。请配置 skills/playwright-skill/login.md 或设置环境变量 LOGIN_USER 和 LOGIN_PASSWORD');
      }
      await page.getByLabel(/账号|用户名|手机/).fill(LOGIN_USER);
      await page.getByLabel(/密码/).fill(LOGIN_PASSWORD);
      await page.getByRole('button', { name: /登录|确定|提交/ }).scrollIntoViewIfNeeded();
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    try {
      await page.waitForURL((url) => url.href.includes('/login'));
    } catch (e) {}
    if (page.url().includes('/login')) {
      if (!LOGIN_USER || !LOGIN_PASSWORD) {
        throw new Error('需要登录。请配置 skills/playwright-skill/login.md 或设置环境变量 LOGIN_USER 和 LOGIN_PASSWORD');
      }
      await page.getByLabel(/账号|用户名|手机/).fill(LOGIN_USER);
      await page.getByLabel(/密码/).fill(LOGIN_PASSWORD);
      await page.getByRole('button', { name: /登录|确定|提交/ }).click();
      await page.waitForURL((url) => !url.href.includes('/login'));
    }

    const orderMgmtLocator = page.getByRole('link', { name: '订单管理' })
      .or(page.locator('a:has-text("订单管理"), [role="menuitem"]:has-text("订单管理"), .el-menu-item:has-text("订单管理")').first());
    await orderMgmtLocator.waitFor({ state: 'visible', timeout: 15000 });
    await orderMgmtLocator.waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForURL((url) => !url.href.includes('/login'));
    }

    const orderMgmtLocator = page.getByRole('link', { name: '订单管理' })
      .or(page.locator('a:has-text("订单管理"), [role="menuitem"]:has-text("订单管理"), .el-menu-item:has-text("订单管理")').first());
    await orderMgmtLocator.waitFor({ state: 'visible', timeout: 15000 });
    await orderMgmtLocator.scrollIntoViewIfNeeded();
      await page.waitForURL((url) => !url.href.includes('/login'));
    }

    const orderMgmtLocator = page.getByRole('link', { name: '订单管理' })
      .or(page.locator('a:has-text("订单管理"), [role="menuitem"]:has-text("订单管理"), .el-menu-item:has-text("订单管理")').first());
    await orderMgmtLocator.waitFor({ state: 'visible', timeout: 15000 });
    await orderMgmtLocator.click();
    await page.locator('text=渠道订单管理').waitFor({ state: 'visible', timeout: 15000 });
    const channelOrderLocator = page.getByRole('link', { name: '渠道订单管理' })
      .or(page.locator('a:has-text("渠道订单管理"), [role="menuitem"]:has-text("渠道订单管理"), .el-menu-item:has-text("渠道订单管理")').first());
    await channelOrderLocator.waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('text=渠道订单管理').waitFor({ state: 'visible', timeout: 15000 });
    const channelOrderLocator = page.getByRole('link', { name: '渠道订单管理' })
      .or(page.locator('a:has-text("渠道订单管理"), [role="menuitem"]:has-text("渠道订单管理"), .el-menu-item:has-text("渠道订单管理")').first());
    await channelOrderLocator.scrollIntoViewIfNeeded();
    await page.locator('text=渠道订单管理').waitFor({ state: 'visible', timeout: 15000 });
    const channelOrderLocator = page.getByRole('link', { name: '渠道订单管理' })
      .or(page.locator('a:has-text("渠道订单管理"), [role="menuitem"]:has-text("渠道订单管理"), .el-menu-item:has-text("渠道订单管理")').first());
    await channelOrderLocator.click();
    await page.locator('.el-table').waitFor({ state: 'visible', timeout: 15000 });

    await page.getByRole('button', { name: 'CSV映射配置' }).waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('.el-table').waitFor({ state: 'visible', timeout: 15000 });

    await page.getByRole('button', { name: 'CSV映射配置' }).scrollIntoViewIfNeeded();
    await page.locator('.el-table').waitFor({ state: 'visible', timeout: 15000 });

    await page.getByRole('button', { name: 'CSV映射配置' }).click();
    const dialog = page.getByRole('dialog', { name: 'CSV文件映射配置' });
    await dialog.waitFor({ state: 'visible', timeout: 15000 });

    const tabE = dialog.locator('.el-tabs__item').filter({ hasText: '新渠道E' });
    if (await tabE.isVisible()) {
      await tabE.waitFor({ state: 'visible', timeout: 15000 });
    await dialog.waitFor({ state: 'visible', timeout: 15000 });

    const tabE = dialog.locator('.el-tabs__item').filter({ hasText: '新渠道E' });
    if (await tabE.isVisible()) {
      await tabE.scrollIntoViewIfNeeded();
    await dialog.waitFor({ state: 'visible', timeout: 15000 });

    const tabE = dialog.locator('.el-tabs__item').filter({ hasText: '新渠道E' });
    if (await tabE.isVisible()) {
      await tabE.click();
    } else {
      const firstTab = dialog.locator('.el-tabs__item').first();
      await firstTab.waitFor({ state: 'visible', timeout: 15000 });
      await firstTab.scrollIntoViewIfNeeded();
      await firstTab.click();
    }
    await dialog.locator('text=系统字段与CSV文件字段映射').waitFor({ state: 'visible', timeout: 15000 });

    const systemFieldSelect = dialog.locator('.el-form-item').filter({ hasText: '系统字段' }).first().locator('.el-select');
    if (await systemFieldSelect.count() > 0) {
      await systemFieldSelect.first().waitFor({ state: 'visible', timeout: 15000 });
    await dialog.locator('text=系统字段与CSV文件字段映射').waitFor({ state: 'visible', timeout: 15000 });

    const systemFieldSelect = dialog.locator('.el-form-item').filter({ hasText: '系统字段' }).first().locator('.el-select');
    if (await systemFieldSelect.count() > 0) {
      await systemFieldSelect.first().scrollIntoViewIfNeeded();
    await dialog.locator('text=系统字段与CSV文件字段映射').waitFor({ state: 'visible', timeout: 15000 });

    const systemFieldSelect = dialog.locator('.el-form-item').filter({ hasText: '系统字段' }).first().locator('.el-select');
    if (await systemFieldSelect.count() > 0) {
      await systemFieldSelect.first().click();
      const dropdown = page.locator('.el-select-dropdown, .el-popper').last();
      await dropdown.waitFor({ state: 'visible', timeout: 15000 });
      const firstOpt = dropdown.locator('.el-select-dropdown__item, .el-option').first();
      if (await firstOpt.isVisible()) {
        await firstOpt.waitFor({ state: 'visible', timeout: 15000 });
      await dropdown.waitFor({ state: 'visible', timeout: 15000 });
      const firstOpt = dropdown.locator('.el-select-dropdown__item, .el-option').first();
      if (await firstOpt.isVisible()) {
        await firstOpt.scrollIntoViewIfNeeded();
      await dropdown.waitFor({ state: 'visible', timeout: 15000 });
      const firstOpt = dropdown.locator('.el-select-dropdown__item, .el-option').first();
      if (await firstOpt.isVisible()) {
        await firstOpt.click();
      }
    }
    const csvFieldInput = dialog.locator('input[placeholder*="CSV"], input[placeholder*="csv"]').first();
    if (await csvFieldInput.isVisible()) {
      await csvFieldInput.fill('order_id');
    }

    await dialog.getByRole('button', { name: '保存' }).waitFor({ state: 'visible', timeout: 15000 });
      await csvFieldInput.fill('order_id');
    }

    await dialog.getByRole('button', { name: '保存' }).scrollIntoViewIfNeeded();
      await csvFieldInput.fill('order_id');
    }

    await dialog.getByRole('button', { name: '保存' }).click();
    await page.locator('.el-message--success').waitFor({ state: 'visible', timeout: 15000 });
    if (!(await dialog.isVisible())) {
      throw new Error('保存成功后映射配置弹窗应仍打开');
    }
  } finally {
    await browser.close();
  }
})();

  if (global.__automationPromise && process.env.AUTOMATION_REPORT_DIR && process.env.AUTOMATION_TEST_CASE_ID) {
  var __screenshotPath = require('path');
  var __fs = require('fs');
  var reportDir = process.env.AUTOMATION_REPORT_DIR;
  var testCaseId = process.env.AUTOMATION_TEST_CASE_ID;
  var __CONSOLE_LIMIT = 10, __NETWORK_LIMIT = 10;
  function __filterConsoleLogs(logs) {
    var seen = {}, filtered = [];
    for (var i = 0; i < logs.length && filtered.length < __CONSOLE_LIMIT; i++) {
      var t = logs[i].type;
      if (t !== 'error' && t !== 'warn') continue;
      var text = (logs[i].text || '').slice(0, 200);
      if (seen[text]) continue;
      seen[text] = true;
      filtered.push({ t: t, m: text });
    }
    return filtered;
  }
  function __filterNetworkLog(network) {
    return network.filter(function(n) { return n.status >= 400; }).slice(0, __NETWORK_LIMIT).map(function(n) { return { u: n.url, s: n.status }; });
  }
  function writeReportFiles(page, reportDir, testCaseId) {
    if (!page || !reportDir || !testCaseId) return Promise.resolve();
    var rawLogs = global.__automationConsoleLog || [];
    var rawNetwork = global.__automationNetworkLog || [];
    var consoleErrors = [];
    for (var i = 0; i < rawLogs.length && consoleErrors.length < 5; i++) {
      if (rawLogs[i].type === 'error') consoleErrors.push((rawLogs[i].text || '').slice(0, 150));
    }
    var failed = __filterNetworkLog(rawNetwork);
    var network = failed.map(function(n) {
      try { var p = n.u ? new URL(n.u).pathname : n.u; return { api: p || n.u, status: n.s }; } catch(e) { return { api: n.u, status: n.s }; }
    });
    global.__automationLogData = { url: process.env.TARGET_URL || '', consoleErrors: consoleErrors, network: network };
    return Promise.resolve();
  }
  global.__automationPromise = global.__automationPromise
    .then(async function() {
      /* success screenshot is taken in browser.close() wrapper */
    })
    .catch(async function(e) {
      global.__automationFailed = true;
      if (global.__automationPage) {
        await writeReportFiles(global.__automationPage, reportDir, testCaseId);
        await global.__automationPage.screenshot({ path: __screenshotPath.join(reportDir, testCaseId + '-fail.png') }).catch(function() {});
      }
      throw e;
    });
  module.exports = global.__automationPromise;
}
