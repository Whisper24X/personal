# Login Patterns for Test Script Generation

When generating scripts from test case documents (e.g. TEST.md), if the **precondition** includes "已登录", "登录管理后台", "用户已登录", etc., the generated script must follow these rules.

## Core Rules

- Declare `const LOGIN_USER = process.env.LOGIN_USER || ''` and `const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || ''` at the top.
- **TARGET_URL must be parameterized**: use `process.env.TARGET_URL` or inject from deploy docs. **Never hardcode** project-specific domains, ports, or paths (e.g. `localhost:8070`, `/shadow/`).
- **`page.waitForURL((url) => ...)`**: the callback parameter `url` is a **URL object**. Use `url.href.includes(...)`, NOT `url.includes(...)` (which throws `url.includes is not a function`).
- If LOGIN_USER/LOGIN_PASSWORD are not configured and login is required, throw a clear error: `throw new Error('需要登录。请设置环境变量 LOGIN_USER 和 LOGIN_PASSWORD。')`.

## Navigating to Target Page

Two approaches (choose one):

1. **Text-based navigation (recommended when no specific URL path is given)**: Open TARGET_URL (entry point only), log in, then click menus/links using text from the test case or PRD to navigate to the target page. Use `page.getByRole('link', { name: /文案/ }).first().click()`. **Click text must come from the test case or PRD**, not hardcoded project-specific terms.

2. **Path-based navigation (only when a specific path is known)**: If deploy docs or PRD explicitly provide a path, use `BUSINESS_PATH` + `page.goto(TARGET_URL + BUSINESS_PATH)`. Otherwise, do not guess paths.

## Admin / Sidebar Navigation (管理后台)

For **management console** tests (e.g. ainative-shadow, Element Plus sidebar), use the following so the sidebar is visible and menu clicks are stable:

- **Viewport**: Use **1920×1080** so the sidebar is not collapsed. Either:
  - Call `await page.setViewportSize({ width: 1920, height: 1080 });` right after `browser.newPage()`, or
  - Rely on run.js report mode (when `AUTOMATION_REPORT_DIR` and `AUTOMATION_TEST_CASE_ID` are set), which injects this viewport for `newPage()`.
- **Wait before click**: After login, do **not** click the sidebar menu immediately. Wait for the menu item to be visible first (e.g. 15s timeout), then click. Example:
  - `await page.getByRole('link', { name: '订单管理' }).waitFor({ state: 'visible', timeout: 15000 });` then `.click();`
- **Locator fallback**: Sidebar items may be `role="link"` or custom components (e.g. `el-menu-item`) without link role. Prefer a **combined locator** so either matches:
  - `page.getByRole('link', { name: '菜单文案' }).or(page.locator('a:has-text("菜单文案"), [role="menuitem"]:has-text("菜单文案"), .el-menu-item:has-text("菜单文案")').first())`
  - Then `waitFor({ state: 'visible', timeout: 15000 })` and `.click()`.

Example (login → click sidebar "订单管理" → then "渠道订单管理"):

```javascript
const page = await browser.newPage();
await page.setViewportSize({ width: 1920, height: 1080 });
// ... goto, login ...
// 订单管理：多策略定位（兼容 link / menuitem / el-menu-item）
const orderMgmtLocator = page.getByRole('link', { name: '订单管理' })
  .or(page.locator('a:has-text("订单管理"), [role="menuitem"]:has-text("订单管理"), .el-menu-item:has-text("订单管理")').first());
await orderMgmtLocator.waitFor({ state: 'visible', timeout: 15000 });
await orderMgmtLocator.click();
// 渠道订单管理：同样使用多策略，子菜单项通常非 link
const channelOrderLocator = page.getByRole('link', { name: '渠道订单管理' })
  .or(page.locator('a:has-text("渠道订单管理"), [role="menuitem"]:has-text("渠道订单管理"), .el-menu-item:has-text("渠道订单管理")').first());
await channelOrderLocator.waitFor({ state: 'visible', timeout: 15000 });
await channelOrderLocator.click();
```

Alternatively, use the helper when available: `const helpers = require('./lib/helpers'); await helpers.clickSidebarMenu(page, '订单管理'); await helpers.clickSidebarMenu(page, '渠道订单管理');`

## Login Page Detection

Login page detection and selectors vary by project. Use compatible patterns:
- Detection: `page.url().includes('/login')` or check for password field existence
- Inputs: `input[type="text"]`, `input[placeholder*="账号"]`, `input[type="password"]`
- Submit: `button[type="submit"]`, `button:has-text("登录")`
- **Do not hardcode** project-specific class names or IDs.

**SPA async redirect**: SPA frameworks (Vue Router, React Router) may redirect to `/login` asynchronously via client-side JavaScript after `domcontentloaded`. Checking `page.url()` immediately after `page.goto()` may miss the redirect. Always wait for the redirect before checking:

```javascript
await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
// Wait for possible SPA async redirect to /login
try {
  await page.waitForURL((url) => url.href.includes('/login'), { timeout: 5000 });
} catch (e) {
  // No redirect within 5s — already authenticated or no login required
}
if (page.url().includes('/login')) {
  // ... login logic
}
```

## Example: Text-based Navigation (No Hardcoded URL)

```javascript
const { chromium } = require('playwright');
const TARGET_URL = process.env.TARGET_URL;
const LOGIN_USER = process.env.LOGIN_USER || '';
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || '';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  if (!TARGET_URL) throw new Error('请设置环境变量 TARGET_URL（或由执行环境/部署文档注入）');
  await page.goto(TARGET_URL.replace(/\/$/, ''), { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Wait for possible SPA async redirect to /login
  try { await page.waitForURL((url) => url.href.includes('/login'), { timeout: 5000 }); } catch (e) {}
  if (page.url().includes('/login')) {
    if (!LOGIN_USER || !LOGIN_PASSWORD) throw new Error('需要登录。请设置环境变量 LOGIN_USER 和 LOGIN_PASSWORD。');
    await page.fill('input[type="text"], input[placeholder*="账号"]', LOGIN_USER);
    await page.fill('input[type="password"]', LOGIN_PASSWORD);
    await page.click('button[type="submit"], button:has-text("登录")');
    await page.waitForURL((url) => !url.href.includes('/login'), { timeout: 10000 });
  }
  // Navigate by clicking menu text from test case / PRD
  await page.getByRole('link', { name: /目标页文案/ }).first().click();
  await page.waitForSelector('table', { timeout: 15000 });
  // Execute business steps and assertions...
  await browser.close();
})();
```

## Example: Path-based Navigation (Known Path)

```javascript
const { chromium } = require('playwright');
const TARGET_URL = process.env.TARGET_URL;
const BUSINESS_PATH = process.env.BUSINESS_PATH || '';
const LOGIN_USER = process.env.LOGIN_USER || '';
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || '';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  if (!TARGET_URL) throw new Error('请设置环境变量 TARGET_URL（或由执行环境/部署文档注入）');
  const base = TARGET_URL.replace(/\/$/, '');
  const entryUrl = BUSINESS_PATH ? base + BUSINESS_PATH : base;
  await page.goto(entryUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Wait for possible SPA async redirect to /login
  try { await page.waitForURL((url) => url.href.includes('/login'), { timeout: 5000 }); } catch (e) {}
  if (page.url().includes('/login')) {
    if (!LOGIN_USER || !LOGIN_PASSWORD) throw new Error('需要登录。请设置环境变量 LOGIN_USER 和 LOGIN_PASSWORD。');
    await page.fill('input[type="text"], input[placeholder*="账号"]', LOGIN_USER);
    await page.fill('input[type="password"]', LOGIN_PASSWORD);
    await page.click('button[type="submit"], button:has-text("登录")');
    await page.waitForURL((url) => !url.href.includes('/login'), { timeout: 10000 });
    await page.goto(entryUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  }
  // Execute business steps and assertions...
  await browser.close();
})();
```
