import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';

const BASE_URL = 'http://localhost:8000';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: (page: Page) => Promise<void>, page: Page) {
  const startTime = Date.now();
  try {
    await fn(page);
    results.push({ name, status: 'PASS', duration: Date.now() - startTime });
    console.log(`✅ ${name}`);
  } catch (error: any) {
    results.push({ name, status: 'FAIL', error: error.message, duration: Date.now() - startTime });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  
  console.log('\n🧪 开始执行登录模块测试\n');
  console.log('━'.repeat(60));
  
  // TC001 - 页面元素完整性检查
  let page = await context.newPage();
  await runTest('TC001 - 页面元素完整性检查', async (page) => {
    await page.goto(`${BASE_URL}/login?redirect=/dashboard`);
    
    // 检查用户名输入框
    const usernameInput = page.locator('input[name="username"], input[type="text"], input[placeholder*="用户名"], input[placeholder*="账号"], #username').first();
    if (!await usernameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      throw new Error('用户名输入框不可见');
    }
    
    // 检查密码输入框
    const passwordInput = page.locator('input[name="password"], input[type="password"], #password').first();
    if (!await passwordInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      throw new Error('密码输入框不可见');
    }
    
    // 检查登录按钮
    const loginButton = page.locator('button:has-text("登录"), button:has-text("Login"), input[type="submit"], button[type="submit"]').first();
    if (!await loginButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      throw new Error('登录按钮不可见');
    }
  }, page);
  await page.close();

  // TC002 - 页面响应速度检查
  page = await context.newPage();
  await runTest('TC002 - 页面响应速度检查', async (page) => {
    const startTime = Date.now();
    await page.goto(`${BASE_URL}/login?redirect=/dashboard`);
    const loadTime = Date.now() - startTime;
    
    console.log(`  页面加载时间: ${loadTime}ms`);
    if (loadTime > 5000) {
      throw new Error(`页面加载时间 ${loadTime}ms 超过 5000ms`);
    }
  }, page);
  await page.close();

  // TC003 - 空用户名提交
  page = await context.newPage();
  await runTest('TC003 - 空用户名提交', async (page) => {
    await page.goto(`${BASE_URL}/login?redirect=/dashboard`);
    
    const passwordInput = page.locator('input[name="password"], input[type="password"], #password').first();
    await passwordInput.fill('testpassword');
    
    const loginButton = page.locator('button:has-text("登录"), button:has-text("Login"), input[type="submit"], button[type="submit"]').first();
    await loginButton.click();
    
    await page.waitForTimeout(500);
    // 应该仍在登录页面或显示错误
    if (!page.url().includes('login')) {
      throw new Error('空用户名应该无法登录');
    }
  }, page);
  await page.close();

  // TC004 - 空密码提交
  page = await context.newPage();
  await runTest('TC004 - 空密码提交', async (page) => {
    await page.goto(`${BASE_URL}/login?redirect=/dashboard`);
    
    const usernameInput = page.locator('input[name="username"], input[type="text"]:not([type="password"]), #username').first();
    await usernameInput.fill('testuser');
    
    const loginButton = page.locator('button:has-text("登录"), button:has-text("Login"), input[type="submit"], button[type="submit"]').first();
    await loginButton.click();
    
    await page.waitForTimeout(500);
    if (!page.url().includes('login')) {
      throw new Error('空密码应该无法登录');
    }
  }, page);
  await page.close();

  // TC005 - 无效凭证登录
  page = await context.newPage();
  await runTest('TC005 - 无效凭证登录', async (page) => {
    await page.goto(`${BASE_URL}/login?redirect=/dashboard`);
    
    const usernameInput = page.locator('input[name="username"], input[type="text"]:not([type="password"]), #username').first();
    const passwordInput = page.locator('input[name="password"], input[type="password"], #password').first();
    
    await usernameInput.fill('invalid_user_12345');
    await passwordInput.fill('wrong_password_67890');
    
    const loginButton = page.locator('button:has-text("登录"), button:has-text("Login"), input[type="submit"], button[type="submit"]').first();
    await loginButton.click();
    
    await page.waitForTimeout(1000);
    
    // 应该显示错误或仍在登录页
    const stillOnLogin = page.url().includes('login');
    if (!stillOnLogin) {
      throw new Error('无效凭证不应该登录成功');
    }
  }, page);
  await page.close();

  // TC006 - 密码显示/隐藏切换
  page = await context.newPage();
  await runTest('TC006 - 密码显示/隐藏切换', async (page) => {
    await page.goto(`${BASE_URL}/login?redirect=/dashboard`);
    
    const passwordInput = page.locator('input[name="password"], input[type="password"], #password').first();
    await passwordInput.fill('testpassword');
    
    // 检查密码默认是隐藏的
    const inputType = await passwordInput.getAttribute('type');
    if (inputType !== 'password') {
      throw new Error('密码输入框默认应该是 password 类型');
    }
    
    // 尝试点击显示密码按钮（如果存在）
    const showPasswordBtn = page.locator('[class*="eye"], [class*="show"], [class*="toggle"], [aria-label*="show"], [aria-label*="显示"]');
    if (await showPasswordBtn.count() > 0) {
      await showPasswordBtn.first().click();
      console.log('  找到密码显示切换按钮');
    } else {
      console.log('  未找到密码显示切换按钮(可选功能)');
    }
  }, page);
  await page.close();

  // TC007 - redirect参数保留检查
  page = await context.newPage();
  await runTest('TC007 - redirect参数保留检查', async (page) => {
    await page.goto(`${BASE_URL}/login?redirect=/dashboard`);
    
    const currentUrl = page.url();
    if (!currentUrl.includes('redirect')) {
      throw new Error(`URL 中没有保留 redirect 参数: ${currentUrl}`);
    }
    console.log(`  当前URL: ${currentUrl}`);
  }, page);
  await page.close();

  // TC008 - 登录页面截图
  page = await context.newPage();
  await runTest('TC008 - 登录页面截图', async (page) => {
    await page.goto(`${BASE_URL}/login?redirect=/dashboard`);
    await page.waitForLoadState('networkidle');
    
    fs.mkdirSync('/tmp/test-login/screenshots', { recursive: true });
    await page.screenshot({ 
      path: '/tmp/test-login/screenshots/login-page.png',
      fullPage: true 
    });
    console.log('  截图已保存到 /tmp/test-login/screenshots/login-page.png');
  }, page);
  await page.close();

  await browser.close();

  // 输出测试报告
  console.log('\n' + '━'.repeat(60));
  console.log('\n📊 测试结果汇总\n');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  console.log(`通过: ${passed}  失败: ${failed}  总计: ${results.length}`);
  console.log('\n详细结果:');
  
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${r.name} (${r.duration}ms)`);
    if (r.error) {
      console.log(`   错误: ${r.error}`);
    }
  });

  // 保存JSON结果
  fs.writeFileSync('/tmp/test-login/test-results.json', JSON.stringify(results, null, 2));
  console.log('\n测试结果已保存到 /tmp/test-login/test-results.json');
}

main().catch(console.error);
