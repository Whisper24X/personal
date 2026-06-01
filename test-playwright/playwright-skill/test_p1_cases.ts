import { chromium, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';

const BASE_URL = 'http://localhost:8000';

interface TestResult {
  id: string;
  name: string;
  priority: string;
  status: 'PASS' | 'FAIL';
  error?: string;
  duration: number;
}

const results: TestResult[] = [];
const TEST_USER = 'test';
const TEST_PASSWORD = 'test123456';

async function runTest(
  id: string,
  name: string,
  priority: string,
  fn: (page: Page, context: BrowserContext) => Promise<void>,
  context: BrowserContext
) {
  const start = Date.now();
  const page = await context.newPage();
  try {
    await fn(page, context);
    results.push({ id, name, priority, status: 'PASS', duration: Date.now() - start });
    console.log(`✅ ${id} ${name}`);
  } catch (e: any) {
    results.push({ id, name, priority, status: 'FAIL', error: e.message, duration: Date.now() - start });
    console.log(`❌ ${id} ${name}`);
    console.log(`   错误: ${e.message}`);
    await page.screenshot({ path: `/tmp/test-p1/screenshots/${id}_fail.png`, fullPage: true }).catch(() => {});
  } finally {
    await page.close();
  }
}

async function ensureLogin(context: BrowserContext) {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login?redirect=/dashboard`);
  await page.waitForLoadState('networkidle');

  const user = page.locator('input[name="username"], input[placeholder*="用户名"], #username, input[type="text"]').first();
  const pwd = page.locator('input[name="password"], input[type="password"]').first();
  const btn = page.locator('button:has-text("登录"), button:has-text("Login"), button[type="submit"]').first();

  await user.fill(TEST_USER);
  await pwd.fill(TEST_PASSWORD);
  await btn.click();
  await page.waitForTimeout(2000);

  const current = page.url();
  await page.screenshot({ path: '/tmp/test-p1/screenshots/login_after_submit.png', fullPage: true }).catch(() => {});
  await page.close();
  return current;
}

async function main() {
  fs.mkdirSync('/tmp/test-p1/screenshots', { recursive: true });
  const browser = await chromium.launch({ headless: true });

  console.log('\n🧪 执行 P1 回归主路径测试\n');

  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await runTest('P1-01', '登录成功跳转到指定页面', 'P1', async (page) => {
      await page.goto(`${BASE_URL}/login?redirect=/dashboard`);
      await page.waitForLoadState('networkidle');

      const user = page.locator('input[name="username"], input[placeholder*="用户名"], #username, input[type="text"]').first();
      const pwd = page.locator('input[name="password"], input[type="password"]').first();
      const btn = page.locator('button:has-text("登录"), button:has-text("Login"), button[type="submit"]').first();

      await user.fill(TEST_USER);
      await pwd.fill(TEST_PASSWORD);
      await btn.click();
      await page.waitForTimeout(2000);

      const url = page.url();
      if (url.includes('/login')) {
        throw new Error(`登录后未跳转，当前URL: ${url}`);
      }
      await page.screenshot({ path: '/tmp/test-p1/screenshots/P1-01_redirect.png', fullPage: true });
    }, context);
    await context.close();
  }

  {
    const context1 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await runTest('P1-02', '保持登录/会话持久化', 'P1', async (_page, ctx) => {
      const afterLoginUrl = await ensureLogin(ctx);
      if (afterLoginUrl.includes('/login')) {
        throw new Error(`预登录失败，当前URL: ${afterLoginUrl}`);
      }

      const state = await ctx.storageState();
      fs.writeFileSync('/tmp/test-p1/storage-state.json', JSON.stringify(state, null, 2));
      await ctx.close();

      const context2 = await browser.newContext({ storageState: '/tmp/test-p1/storage-state.json', viewport: { width: 1280, height: 720 } });
      const page2 = await context2.newPage();
      await page2.goto(`${BASE_URL}/dashboard`);
      await page2.waitForTimeout(1500);
      const url2 = page2.url();
      await page2.screenshot({ path: '/tmp/test-p1/screenshots/P1-02_session_restore.png', fullPage: true });
      await page2.close();
      await context2.close();

      if (url2.includes('/login')) {
        throw new Error(`重开上下文后会话未保持，当前URL: ${url2}`);
      }
    }, context1);
  }

  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await runTest('P1-03', '首页模块冒烟（卡片/搜索/筛选）', 'P1', async (page, ctx) => {
      const afterLoginUrl = await ensureLogin(ctx);
      if (afterLoginUrl.includes('/login')) {
        throw new Error(`预登录失败，当前URL: ${afterLoginUrl}`);
      }

      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForTimeout(2000);

      const bodyText = await page.locator('body').innerText();
      const hasSearch = await page.locator('input[placeholder*="搜索"], input[type="search"]').first().isVisible().catch(() => false);
      const hasFilter = await page.locator('text=/筛选|分类/i').first().isVisible().catch(() => false);
      const hasCards = await page.locator('[class*="card"], [class*="course"], [data-testid*="card"]').first().isVisible().catch(() => false);

      console.log(`   搜索框: ${hasSearch ? '有' : '无'}`);
      console.log(`   筛选项: ${hasFilter ? '有' : '无'}`);
      console.log(`   卡片模块: ${hasCards ? '有' : '无'}`);

      if (bodyText.trim().length < 30) {
        throw new Error('首页内容过少，疑似白屏');
      }

      await page.screenshot({ path: '/tmp/test-p1/screenshots/P1-03_dashboard_modules.png', fullPage: true });
    }, context);
    await context.close();
  }

  await browser.close();

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const report = { summary: { total: results.length, passed, failed }, results, timestamp: new Date().toISOString() };
  fs.writeFileSync('/tmp/test-p1/test-report.json', JSON.stringify(report, null, 2));

  console.log('\n📊 P1 测试结果');
  console.log(`通过: ${passed} 失败: ${failed} 总计: ${results.length}`);
  for (const r of results) {
    console.log(`${r.status === 'PASS' ? '✅' : '❌'} [${r.priority}] ${r.id} ${r.name}${r.error ? ` -> ${r.error}` : ''}`);
  }
  console.log('\n报告: /tmp/test-p1/test-report.json');
  console.log('截图: /tmp/test-p1/screenshots/');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
