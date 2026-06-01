import { chromium, Browser, Page } from 'playwright';

const BASE_URL = 'http://localhost:8000';

test.describe('登录模块测试', () => {
  
  test.describe('登录页面展示', () => {
    test('TC001 - 页面元素完整性检查', async ({ page }) => {
      await page.goto(`${BASE_URL}/login?redirect=/dashboard`);
      
      // 检查页面标题
      await expect(page).toHaveTitle(/登录|Login/i);
      
      // 检查用户名输入框
      const usernameInput = page.locator('input[name="username"], input[type="text"], input[placeholder*="用户名"], input[placeholder*="账号"]').first();
      await expect(usernameInput).toBeVisible();
      
      // 检查密码输入框
      const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
      await expect(passwordInput).toBeVisible();
      
      // 检查登录按钮
      const loginButton = page.locator('button:has-text("登录"), button:has-text("Login"), input[type="submit"]').first();
      await expect(loginButton).toBeVisible();
    });

    test('TC002 - 页面响应速度检查', async ({ page }) => {
      const startTime = Date.now();
      await page.goto(`${BASE_URL}/login?redirect=/dashboard`);
      const loadTime = Date.now() - startTime;
      
      console.log(`页面加载时间: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(5000); // 5秒内加载完成
    });
  });

  test.describe('登录功能验证', () => {
    test('TC003 - 空用户名提交', async ({ page }) => {
      await page.goto(`${BASE_URL}/login?redirect=/dashboard`);
      
      const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
      await passwordInput.fill('testpassword');
      
      const loginButton = page.locator('button:has-text("登录"), button:has-text("Login"), input[type="submit"]').first();
      await loginButton.click();
      
      // 应该有错误提示
      await page.waitForTimeout(500);
      const errorMsg = page.locator('text=/用户名|请输入|required|不能为空/i');
      const hasError = await errorMsg.count() > 0 || await page.locator('.error, .alert, [class*="error"]').count() > 0;
      expect(hasError || await page.url().includes('login')).toBeTruthy();
    });

    test('TC004 - 空密码提交', async ({ page }) => {
      await page.goto(`${BASE_URL}/login?redirect=/dashboard`);
      
      const usernameInput = page.locator('input[name="username"], input[type="text"], input[placeholder*="用户名"]').first();
      await usernameInput.fill('testuser');
      
      const loginButton = page.locator('button:has-text("登录"), button:has-text("Login"), input[type="submit"]').first();
      await loginButton.click();
      
      await page.waitForTimeout(500);
      // 应该仍在登录页面或显示错误
      expect(await page.url()).toContain('login');
    });

    test('TC005 - 无效凭证登录', async ({ page }) => {
      await page.goto(`${BASE_URL}/login?redirect=/dashboard`);
      
      const usernameInput = page.locator('input[name="username"], input[type="text"], input[placeholder*="用户名"]').first();
      const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
      
      await usernameInput.fill('invalid_user_12345');
      await passwordInput.fill('wrong_password_67890');
      
      const loginButton = page.locator('button:has-text("登录"), button:has-text("Login"), input[type="submit"]').first();
      await loginButton.click();
      
      await page.waitForTimeout(1000);
      
      // 应该显示错误或仍在登录页
      const stillOnLogin = await page.url().includes('login');
      const hasErrorMsg = await page.locator('text=/错误|失败|invalid|incorrect|用户名或密码/i').count() > 0;
      expect(stillOnLogin || hasErrorMsg).toBeTruthy();
    });

    test('TC006 - 密码显示/隐藏切换', async ({ page }) => {
      await page.goto(`${BASE_URL}/login?redirect=/dashboard`);
      
      const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
      await passwordInput.fill('testpassword');
      
      // 检查密码默认是隐藏的
      await expect(passwordInput).toHaveAttribute('type', 'password');
      
      // 尝试点击显示密码按钮（如果存在）
      const showPasswordBtn = page.locator('[class*="eye"], [class*="show"], [class*="toggle"], button:near(input[type="password"])');
      if (await showPasswordBtn.count() > 0) {
        await showPasswordBtn.first().click();
        await page.waitForTimeout(300);
        // 可能变成 text 类型
        const inputType = await passwordInput.getAttribute('type');
        console.log(`密码输入框类型变为: ${inputType}`);
      }
    });
  });

  test.describe('URL重定向验证', () => {
    test('TC007 - redirect参数保留检查', async ({ page }) => {
      await page.goto(`${BASE_URL}/login?redirect=/dashboard`);
      
      const currentUrl = page.url();
      expect(currentUrl).toContain('redirect');
      console.log(`当前URL: ${currentUrl}`);
    });
  });

  test.describe('页面截图记录', () => {
    test('TC008 - 登录页面截图', async ({ page }) => {
      await page.goto(`${BASE_URL}/login?redirect=/dashboard`);
      await page.waitForLoadState('networkidle');
      
      await page.screenshot({ 
        path: '/tmp/test-login/screenshots/login-page.png',
        fullPage: true 
      });
      console.log('截图已保存到 /tmp/test-login/screenshots/login-page.png');
    });
  });
});
