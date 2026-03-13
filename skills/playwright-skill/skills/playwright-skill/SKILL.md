---
name: playwright-skill
description: Complete browser automation with Playwright. Auto-detects dev servers, writes clean test scripts to /tmp. Test pages, fill forms, take screenshots, check responsive design, validate UX, test login flows, check links, automate any browser task. Use when user wants to test websites, automate browser interactions, validate web functionality, or perform any browser-based testing.
---

**Path Resolution:** Use `$SKILL_DIR` as the directory where this SKILL.md is located. All commands below use this path.

# Playwright Browser Automation

Write and execute custom Playwright automation for any browser task via the universal executor.

**CRITICAL WORKFLOW - Follow these steps in order:**

1. **Auto-detect dev servers** - For localhost testing, ALWAYS run detection FIRST:

   ```bash
   cd $SKILL_DIR && node -e "require('./lib/helpers').detectDevServers().then(s => console.log(JSON.stringify(s)))"
   ```

   - 1 server found: use it automatically
   - Multiple: ask user which one
   - None: ask for URL or help start dev server

2. **Write scripts to /tmp** - NEVER write to skill directory; always use `/tmp/playwright-test-*.js`

3. **Visible browser by default** - Always `headless: false` unless user requests headless

4. **Parameterize URLs** - `TARGET_URL` constant at top of every script; never hardcode project-specific addresses

## How It Works

1. User describes what to test/automate
2. Auto-detect running dev servers (or ask for URL)
3. Write custom Playwright code to `/tmp/playwright-test-*.js`
4. Execute via: `cd $SKILL_DIR && node run.js /tmp/playwright-test-*.js`
5. Results displayed in real-time with visible browser
6. Test files auto-cleaned from /tmp

## Setup (First Time)

```bash
cd $SKILL_DIR && npm run setup
```

## Execution Pattern

**Step 1:** Detect dev servers

```bash
cd $SKILL_DIR && node -e "require('./lib/helpers').detectDevServers().then(s => console.log(JSON.stringify(s)))"
```

**Step 2:** Write script to `/tmp/playwright-test-*.js` with `TARGET_URL` parameterized at top

**Step 3:** Execute from skill directory

```bash
cd $SKILL_DIR && node run.js /tmp/playwright-test-*.js
```

## Common Patterns

| Pattern | Description |
|---------|-------------|
| Responsive testing | Test page across Desktop/Tablet/Mobile viewports |
| Login flow | Fill credentials and verify redirect |
| Form submission | Fill and submit forms, verify success |
| Broken links check | Crawl page links and report broken ones |
| Screenshot | Full-page screenshot with error handling |
| Inline execution | Quick one-off tasks via `node run.js "code"` |

For complete code examples, see [references/COMMON_PATTERNS.md](references/COMMON_PATTERNS.md).

## Login & Preconditions (Test Case Generation)

When generating scripts from test case documents where preconditions include "已登录":

- Use `process.env.LOGIN_USER` / `process.env.LOGIN_PASSWORD` — never hardcode credentials
- `TARGET_URL` must come from env or deploy docs — **never hardcode** project domains/ports/paths
- Navigate to target page by clicking menu text from test case/PRD, or via `BUSINESS_PATH` if explicitly provided
- **管理后台侧栏菜单用多策略定位** — Element Plus 等框架的菜单项可能非 `role="link"`，需用 `getByRole('link').or(locator)` 组合 getByText / menuitem / `.el-menu-item` 作为回退，见 [LOGIN_PATTERNS](references/LOGIN_PATTERNS.md)
- `page.waitForURL((url) => ...)` — parameter `url` is a **URL object**, use `url.href.includes(...)` not `url.includes(...)`
- Throw clear error if credentials missing

For detailed rules and full examples, see [references/LOGIN_PATTERNS.md](references/LOGIN_PATTERNS.md).

## Available Helpers

Optional utilities in `lib/helpers.js`:

```javascript
const helpers = require('./lib/helpers');
const servers = await helpers.detectDevServers();  // CRITICAL - use first!
await helpers.safeClick(page, 'button.submit', { retries: 3 });
await helpers.safeType(page, '#username', 'testuser');
await helpers.takeScreenshot(page, 'test-result');
await helpers.handleCookieBanner(page);
const data = await helpers.extractTableData(page, 'table.results');
```

## Custom HTTP Headers

Set `PW_HEADER_NAME`/`PW_HEADER_VALUE` env vars for automated traffic identification. See [references/HTTP_HEADERS.md](references/HTTP_HEADERS.md) for details.

## Advanced Usage

For comprehensive Playwright API docs (selectors, network interception, auth, visual testing, mobile emulation, debugging, CI/CD), see [API_REFERENCE.md](API_REFERENCE.md).

## Tips

- **Detect servers FIRST** - Always run `detectDevServers()` before writing test code
- **Use /tmp for test files** - Write to `/tmp/playwright-test-*.js`, never to skill directory or user's project
- **Parameterize URLs** - `TARGET_URL` at top of every script; never hardcode project addresses. **Never strip trailing slash** (no `.replace(/\/$/, '')`) — Docker/nginx 301 redirects use internal ports, causing `ERR_CONNECTION_REFUSED`. Always `page.goto(TARGET_URL, ...)` as-is
- **Visible browser** - Always `headless: false` unless user requests headless
- **slowMo** - Use `slowMo: 100` to make actions visible
- **Wait strategies** - Use `waitForURL`, `waitForSelector`, `waitForLoadState` instead of fixed timeouts
- **After click, wait for content** - After clicking a menu/dropdown, wait for expanded content to be visible before next action (e.g. `locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 10000 })`)
- **Error handling** - Always use try-catch; throw on assertion failure (never just console.log)
- **Idempotent select** - For auto-save dropdowns, read current value first. If already equals target, select a different option (wait for save), then select target again to guarantee change event fires. See [references/COMMON_PATTERNS.md](references/COMMON_PATTERNS.md) for full example.
- **Async data tables** - Element UI tables render an empty container before data arrives. After clicking a navigation item, directly `waitForSelector` on data rows (e.g. `.el-table__body tr`) instead of the table container. Do NOT use `waitForLoadState('networkidle')` on pages with polling/auto-refresh — it waits up to 30s and DOM may be in a refresh mid-state when it times out. After clicking "返回" in a loop, also wait for rows (not just the table container) before re-accessing them.
- **Sidebar menu locator** - 管理后台侧栏菜单用多策略定位，见 [LOGIN_PATTERNS](references/LOGIN_PATTERNS.md)

## Troubleshooting

**Playwright not installed:** `cd $SKILL_DIR && npm run setup`

**Module not found:** Ensure running from skill directory via `run.js` wrapper

**Browser doesn't open:** Check `headless: false` and ensure display available

**Element not found:** Add wait: `await page.waitForSelector('.element', { timeout: 10000 })`
