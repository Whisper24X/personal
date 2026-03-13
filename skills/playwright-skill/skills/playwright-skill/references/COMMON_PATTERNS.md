# Common Playwright Patterns

## Contents

- [Test a Page (Multiple Viewports)](#test-a-page-multiple-viewports)
- [Test Login Flow](#test-login-flow)
- [Fill and Submit Form](#fill-and-submit-form)
- [Check for Broken Links](#check-for-broken-links)
- [Take Screenshot with Error Handling](#take-screenshot-with-error-handling)
- [Test Responsive Design](#test-responsive-design)
- [Inline Execution](#inline-execution)

## Test a Page (Multiple Viewports)

```javascript
// /tmp/playwright-test-responsive.js
const { chromium } = require('playwright');
const TARGET_URL = 'http://localhost:3001';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(TARGET_URL);
  console.log('Desktop - Title:', await page.title());
  await page.screenshot({ path: '/tmp/desktop.png', fullPage: true });

  await page.setViewportSize({ width: 375, height: 667 });
  await page.screenshot({ path: '/tmp/mobile.png', fullPage: true });

  await browser.close();
})();
```

## Test Login Flow

```javascript
// /tmp/playwright-test-login.js
const { chromium } = require('playwright');
const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(TARGET_URL);

  await page.fill('input[name="email"], input[type="text"]', process.env.LOGIN_USER || '');
  await page.fill('input[name="password"], input[type="password"]', process.env.LOGIN_PASSWORD || '');
  await page.click('button[type="submit"], button:has-text("登录"), button:has-text("Sign in")');

  await page.waitForURL((url) => !url.href.includes('/login'), { timeout: 10000 }).catch(() => {});
  console.log('Login attempted');

  await browser.close();
})();
```

## Fill and Submit Form

```javascript
// /tmp/playwright-test-form.js
const { chromium } = require('playwright');
const TARGET_URL = 'http://localhost:3001';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const page = await browser.newPage();
  await page.goto(`${TARGET_URL}/contact`);

  await page.fill('input[name="name"]', 'John Doe');
  await page.fill('input[name="email"]', 'john@example.com');
  await page.fill('textarea[name="message"]', 'Test message');
  await page.click('button[type="submit"]');

  await page.waitForSelector('.success-message');
  console.log('Form submitted successfully');

  await browser.close();
})();
```

## Check for Broken Links

```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');

  const links = await page.locator('a[href^="http"]').all();
  const results = { working: 0, broken: [] };

  for (const link of links) {
    const href = await link.getAttribute('href');
    try {
      const response = await page.request.head(href);
      if (response.ok()) {
        results.working++;
      } else {
        results.broken.push({ url: href, status: response.status() });
      }
    } catch (e) {
      results.broken.push({ url: href, error: e.message });
    }
  }

  console.log(`Working links: ${results.working}`);
  console.log(`Broken links:`, results.broken);
  await browser.close();
})();
```

## Take Screenshot with Error Handling

```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 10000 });
    await page.screenshot({ path: '/tmp/screenshot.png', fullPage: true });
    console.log('Screenshot saved to /tmp/screenshot.png');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
```

## Test Responsive Design

```javascript
// /tmp/playwright-test-responsive-full.js
const { chromium } = require('playwright');
const TARGET_URL = 'http://localhost:3001';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  const viewports = [
    { name: 'Desktop', width: 1920, height: 1080 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Mobile', width: 375, height: 667 },
  ];

  for (const viewport of viewports) {
    console.log(`Testing ${viewport.name} (${viewport.width}x${viewport.height})`);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(TARGET_URL);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `/tmp/${viewport.name.toLowerCase()}.png`, fullPage: true });
  }

  console.log('All viewports tested');
  await browser.close();
})();
```

## Inline Execution

For quick one-off tasks, execute code inline without creating files:

```bash
cd $SKILL_DIR && node run.js "
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto('http://localhost:3001');
await page.screenshot({ path: '/tmp/quick-screenshot.png', fullPage: true });
console.log('Screenshot saved');
await browser.close();
"
```

**When to use inline vs files:**
- **Inline**: Quick one-off tasks (screenshot, check element, get page title)
- **Files**: Complex tests, responsive checks, anything to re-run

## Idempotent Dropdown Selection

For auto-save dropdowns (selecting a value triggers save automatically without a submit button), the script must handle the case where the current value already equals the target. Selecting the same value won't fire a `change` event, so no save happens and the success prompt never appears.

```javascript
// Adapt selectors to your UI framework:
//   Element UI:  '.el-select', '.el-select-dropdown__item', '.el-message--success'
//   Ant Design:  '.ant-select', '.ant-select-item-option', '.ant-message-success'
//   Native:      'select', 'option', '.toast-success'
const SELECT_SELECTOR = '.el-select';                // <-- replace per framework
const OPTION_SELECTOR = '.el-select-dropdown__item'; // <-- replace per framework
const SUCCESS_MSG     = '.el-message--success';      // <-- replace per framework

const TARGET_OPTION = 'Option A'; // the value you want to select
const ALT_OPTION    = 'Option B'; // any other option to trigger change

const selectEl = row.locator(SELECT_SELECTOR).first();
const currentText = await selectEl.textContent();

if (currentText && currentText.includes(TARGET_OPTION)) {
  // Already target value — switch to alt first to guarantee change event
  await selectEl.click();
  await page.locator(`${OPTION_SELECTOR}:has-text("${ALT_OPTION}")`).first().click();
  const altMsg = page.locator(SUCCESS_MSG);
  await altMsg.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  await altMsg.waitFor({ state: 'hidden',  timeout: 10000 }).catch(() => {});
}

// Now select target value — change event will fire
await selectEl.click();
await page.locator(`${OPTION_SELECTOR}:has-text("${TARGET_OPTION}")`).first().click();
const successMsg = page.locator(SUCCESS_MSG);
await successMsg.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
  throw new Error('Save confirmation not shown');
});
```

**Key points:**
- Read current value via `textContent()` before clicking
- If current === target, select an alternative option first and wait for save to complete
- Then select the target — `change` event is guaranteed to fire
- Replace `SELECT_SELECTOR`, `OPTION_SELECTOR`, `SUCCESS_MSG` to match your UI framework
