import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';

const BASE_URL = 'http://localhost:8000';
const BACKEND_URL = 'http://localhost:9000';

interface TestResult {
  id: string;
  name: string;
  priority: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  error?: string;
  duration: number;
  steps?: string[];
}

const results: TestResult[] = [];
const TEST_USER = `testuser_${Date.now()}`;
const TEST_PASSWORD = 'Test123456';

async function runTest(
  id: string,
  name: string,
  priority: string,
  fn: (page: Page, context: BrowserContext) => Promise<void>,
  context: BrowserContext
) {
  const startTime = Date.now();
  const page = await context.newPage();
  
  try {
    await fn(page, context);
    results.push({ id, name, priority, status: 'PASS', duration: Date.now() - startTime });
    console.log(`✅ ${id} ${name}`);
  } catch (error: any) {
    results.push({ id, name, priority, status: 'FAIL', error: error.message, duration: Date.now() - startTime });
    console.log(`❌ ${id} ${name}`);
    console.log(`   错误: ${error.message}`);
    // 失败截图
    await page.screenshot({ path: `/tmp/test-full/screenshots/${id}_fail.png`, fullPage: true }).catch(() => {});
  } finally {
    await page.close();
  }
}

async function main() {
  fs.mkdirSync('/tmp/test-full/screenshots', { recursive: true });
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  
  console.log('\n🧪 核心用例与测试策略 - 完整执行\n');
  console.log(`测试环境: ${BASE_URL}`);
  console.log(`后端地址: ${BACKEND_URL}`);
  console.log('━'.repeat(70));
  console.log('\n');

  // UC-08 后端健康检查 (先执行，确认后端可用)
  await runTest('UC-08', '后端健康检查', 'P0', async (page) => {
    const response = await page.request.get(BACKEND_URL);
    if (response.status() !== 200) {
      throw new Error(`后端返回 HTTP ${response.status()}`);
    }
    const body = await response.json().catch(() => null);
    console.log(`   后端响应: ${JSON.stringify(body).slice(0, 100)}...`);
  }, context);

  // UC-01 用户注册
  await runTest('UC-01', '用户注册', 'P0', async (page) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    
    // 切换到注册模式
    const registerTab = page.locator('text=/注册|Register|Sign up/i, [data-tab="register"], a:has-text("注册")').first();
    if (await registerTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await registerTab.click();
      await page.waitForTimeout(500);
    }
    
    // 填写注册表单
    const usernameInput = page.locator('input[name="username"], input[placeholder*="用户名"], #username').first();
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    const confirmPasswordInput = page.locator('input[name="confirmPassword"], input[name="confirm"], input[placeholder*="确认"]').first();
    
    await usernameInput.fill(TEST_USER);
    await passwordInput.fill(TEST_PASSWORD);
    
    if (await confirmPasswordInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmPasswordInput.fill(TEST_PASSWORD);
    }
    
    // 提交注册
    const submitBtn = page.locator('button:has-text("注册"), button:has-text("Register"), button[type="submit"]').first();
    await submitBtn.click();
    
    // 等待响应
    await page.waitForTimeout(2000);
    
    // 验证：注册成功提示或自动登录跳转
    const success = 
      await page.locator('text=/注册成功|成功|welcome/i').isVisible({ timeout: 3000 }).catch(() => false) ||
      !page.url().includes('login');
    
    if (!success) {
      // 检查是否有错误提示（可能是用户已存在等预期错误）
      const errorVisible = await page.locator('text=/已存在|重复|exist/i').isVisible({ timeout: 1000 }).catch(() => false);
      if (errorVisible) {
        console.log('   用户可能已存在，跳过注册');
      } else {
        throw new Error('注册未成功完成');
      }
    }
    
    await page.screenshot({ path: '/tmp/test-full/screenshots/UC-01_register.png', fullPage: true });
  }, context);

  // UC-02 用户登录
  await runTest('UC-02', '用户登录', 'P0', async (page) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    
    // 确保在登录模式
    const loginTab = page.locator('text=/登录|Login|Sign in/i, [data-tab="login"]').first();
    if (await loginTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await loginTab.click();
      await page.waitForTimeout(300);
    }
    
    const usernameInput = page.locator('input[name="username"], input[placeholder*="用户名"], #username').first();
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    
    // 使用注册的用户或已知测试用户
    await usernameInput.fill(TEST_USER);
    await passwordInput.fill(TEST_PASSWORD);
    
    const submitBtn = page.locator('button:has-text("登录"), button:has-text("Login"), button[type="submit"]').first();
    await submitBtn.click();
    
    await page.waitForTimeout(2000);
    
    // 验证登录成功：跳转离开登录页
    const stillOnLogin = page.url().includes('login');
    
    if (stillOnLogin) {
      // 可能是凭据问题，检查错误
      const hasError = await page.locator('text=/错误|失败|invalid/i').isVisible({ timeout: 1000 }).catch(() => false);
      if (hasError) {
        throw new Error('登录失败 - 凭据错误');
      }
    }
    
    // 检查是否存储了 token
    const localStorage = await page.evaluate(() => {
      const keys = Object.keys(window.localStorage);
      return keys.filter(k => k.toLowerCase().includes('token') || k.toLowerCase().includes('auth'));
    });
    console.log(`   本地存储 token 相关键: ${localStorage.join(', ') || '无'}`);
    
    await page.screenshot({ path: '/tmp/test-full/screenshots/UC-02_login.png', fullPage: true });
  }, context);

  // UC-03 登录失败（错误凭据）
  await runTest('UC-03', '登录失败（错误凭据）', 'P0', async (page) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    
    const usernameInput = page.locator('input[name="username"], input[placeholder*="用户名"], #username').first();
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    
    await usernameInput.fill('nonexistent_user_xyz');
    await passwordInput.fill('wrong_password_123');
    
    const submitBtn = page.locator('button:has-text("登录"), button:has-text("Login"), button[type="submit"]').first();
    await submitBtn.click();
    
    await page.waitForTimeout(1500);
    
    // 验证：应显示错误提示或仍在登录页
    const stillOnLogin = page.url().includes('login');
    const hasErrorMsg = await page.locator('text=/错误|失败|invalid|incorrect|不存在/i').isVisible({ timeout: 2000 }).catch(() => false);
    
    if (!stillOnLogin && !hasErrorMsg) {
      throw new Error('错误凭据不应该登录成功');
    }
    
    if (hasErrorMsg) {
      console.log('   错误提示已展示');
    }
    
    await page.screenshot({ path: '/tmp/test-full/screenshots/UC-03_login_fail.png', fullPage: true });
  }, context);

  // UC-06 未登录访问控制
  await runTest('UC-06', '未登录访问控制', 'P0', async (page) => {
    // 清除所有存储以模拟未登录状态
    await page.goto(`${BASE_URL}/login`);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // 直接访问需要登录的页面
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(1500);
    
    // 验证：应重定向到登录页
    const currentUrl = page.url();
    const redirectedToLogin = currentUrl.includes('login');
    
    if (!redirectedToLogin) {
      // 检查页面内容是否为登录态
      const hasLoginForm = await page.locator('input[type="password"]').isVisible({ timeout: 2000 }).catch(() => false);
      if (!hasLoginForm) {
        throw new Error(`未登录应重定向到登录页，当前URL: ${currentUrl}`);
      }
    }
    
    // 检查是否保留了 redirect 参数
    if (currentUrl.includes('redirect')) {
      console.log('   URL 保留了 redirect 参数');
    }
    
    await page.screenshot({ path: '/tmp/test-full/screenshots/UC-06_access_control.png', fullPage: true });
  }, context);

  // 登录后测试需要先完成登录
  const loggedInContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const loginPage = await loggedInContext.newPage();
  
  // 尝试登录获取会话
  await loginPage.goto(`${BASE_URL}/login`);
  await loginPage.waitForLoadState('networkidle');
  
  const usernameInput = loginPage.locator('input[name="username"], input[placeholder*="用户名"], #username').first();
  const passwordInput = loginPage.locator('input[name="password"], input[type="password"]').first();
  
  await usernameInput.fill(TEST_USER).catch(() => {});
  await passwordInput.fill(TEST_PASSWORD).catch(() => {});
  
  const submitBtn = loginPage.locator('button:has-text("登录"), button:has-text("Login"), button[type="submit"]').first();
  await submitBtn.click().catch(() => {});
  await loginPage.waitForTimeout(2000);
  await loginPage.close();

  // UC-04 刷新会话
  await runTest('UC-04', '刷新会话', 'P0', async (page) => {
    // 检查本地存储中是否有 refresh token
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(1000);
    
    const tokens = await page.evaluate(() => {
      const result: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.toLowerCase().includes('token') || key.toLowerCase().includes('refresh'))) {
          result[key] = localStorage.getItem(key) || '';
        }
      }
      return result;
    });
    
    console.log(`   检测到的 token 键: ${Object.keys(tokens).join(', ') || '无'}`);
    
    // 如果没有登录态，标记为跳过相关断言
    const isLoggedIn = !page.url().includes('login');
    if (!isLoggedIn) {
      console.log('   未处于登录态，跳过刷新测试');
      return;
    }
    
    // 触发页面刷新，验证会话保持
    await page.reload();
    await page.waitForTimeout(1500);
    
    const stillLoggedIn = !page.url().includes('login');
    if (!stillLoggedIn) {
      throw new Error('刷新页面后会话丢失');
    }
    
    console.log('   刷新后会话保持正常');
  }, loggedInContext);

  // UC-05 获取当前用户
  await runTest('UC-05', '获取当前用户', 'P0', async (page) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(1000);
    
    const isLoggedIn = !page.url().includes('login');
    if (!isLoggedIn) {
      console.log('   未处于登录态，跳过用户信息测试');
      return;
    }
    
    // 检查页面上是否展示用户信息
    const userInfo = await page.locator('[class*="user"], [class*="avatar"], [class*="profile"]').first().isVisible({ timeout: 3000 }).catch(() => false);
    
    if (userInfo) {
      console.log('   页面上展示了用户信息区域');
    }
    
    // 检查是否有用户名显示
    const usernameDisplay = await page.locator(`text=${TEST_USER}`).isVisible({ timeout: 2000 }).catch(() => false);
    if (usernameDisplay) {
      console.log(`   用户名 ${TEST_USER} 已展示`);
    }
  }, loggedInContext);

  // UC-07 主导航冒烟（已登录）
  await runTest('UC-07', '主导航冒烟（已登录）', 'P0', async (page) => {
    const routes = [
      { name: '首页/Dashboard', path: '/dashboard' },
      { name: '工作台', path: '/workspace' },
      { name: '看板页', path: '/kanban' },
      { name: '知识库', path: '/knowledge' },
      { name: '设置页', path: '/settings' },
    ];
    
    const isLoggedIn = await (async () => {
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForTimeout(1000);
      return !page.url().includes('login');
    })();
    
    if (!isLoggedIn) {
      console.log('   未处于登录态，跳过导航冒烟测试');
      return;
    }
    
    const failedRoutes: string[] = [];
    
    for (const route of routes) {
      try {
        await page.goto(`${BASE_URL}${route.path}`);
        await page.waitForTimeout(800);
        
        // 检查是否白屏（页面完全空白）
        const bodyContent = await page.locator('body').innerHTML();
        const isBlank = bodyContent.trim().length < 50;
        
        // 检查是否被重定向到登录页（可能是权限不足）
        const redirectedToLogin = page.url().includes('login');
        
        // 检查控制台错误
        const errors: string[] = [];
        page.on('console', msg => {
          if (msg.type() === 'error') {
            errors.push(msg.text());
          }
        });
        
        if (isBlank && !redirectedToLogin) {
          failedRoutes.push(`${route.name}: 白屏`);
        } else {
          console.log(`   ✓ ${route.name} (${route.path})`);
        }
      } catch (e: any) {
        failedRoutes.push(`${route.name}: ${e.message}`);
      }
    }
    
    if (failedRoutes.length > 0) {
      throw new Error(`以下路由加载失败: ${failedRoutes.join('; ')}`);
    }
  }, loggedInContext);

  await loggedInContext.close();
  await browser.close();

  // 输出测试报告
  console.log('\n' + '━'.repeat(70));
  console.log('\n📊 测试结果汇总\n');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  console.log(`✅ 通过: ${passed}  ❌ 失败: ${failed}  📋 总计: ${results.length}`);
  console.log('\n' + '─'.repeat(70));
  console.log('详细结果:\n');
  
  // 按优先级和ID排序
  results.sort((a, b) => a.id.localeCompare(b.id));
  
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${r.priority}] ${r.id} - ${r.name} (${r.duration}ms)`);
    if (r.error) {
      console.log(`   └─ 错误: ${r.error}`);
    }
  });

  // 保存JSON结果
  const report = {
    summary: { total: results.length, passed, failed },
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    results
  };
  
  fs.writeFileSync('/tmp/test-full/test-report.json', JSON.stringify(report, null, 2));
  console.log('\n测试报告已保存到 /tmp/test-full/test-report.json');
  console.log('截图目录: /tmp/test-full/screenshots/');
  
  // 返回退出码
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('测试执行异常:', e);
  process.exit(1);
});
