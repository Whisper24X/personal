---
name: playwright-skill
description: Complete browser automation with Playwright. Auto-detects dev servers, writes test scripts to /tmp. When driven by TEST.md, default layout is by-id (one playwright-test-<TC-ID>.js per case under artifacts/playwright/by-id). Enforces AUTOMATED_TEST.md coverage and validate-tc-by-id-dir. Use for web E2E and test generation from Given/When/Then docs.
---

**Path Resolution:** Use `$SKILL_DIR` as the directory where this SKILL.md is located. All commands below use this path.

# Playwright Browser Automation

Write and execute custom Playwright automation for any browser task via the universal executor.

## 从 TEST.md 生成自动化（全量对账）

当任务要求根据 `docs/.../TEST.md`（或路径由工作流给定的 `TEST.md`）生成 Playwright 脚本时，**「完整」的定义**是：TEST.md 中每个 `#### TC-[FEB]-…` 用例在产出中**有且仅有一条终态**，不得在覆盖率表中漏行、不得在表中留空。

### 执行前必做（顺序不可省略）

1. **抽取 ID 列表** — 匹配标题行：`#### TC-F-001`…、`#### TC-E-001`…、`#### TC-B-001`…（正则：`/^####\s+(TC-[FEB]-\d+)/m`）。去重后得到有序列表。属性表 **「类型」** 为 **管理后台** 的用例为 Shadow 自动化主集；**小程序** 等不生成 `by-id` 脚本（与 `extract-tc-ids.js --type 管理后台` 对齐）。可用本技能辅助脚本核对：
   ```bash
   node "$SKILL_DIR/scripts/extract-tc-ids.js" /path/to/TEST.md
   node "$SKILL_DIR/scripts/extract-tc-ids.js" /path/to/TEST.md --json --type 管理后台
   ```
2. **分类**（写入 `AUTOMATED_TEST.md` 总表前，先标注每 ID）：
   - **可自动化（Shadow Web）**：管理后台、单浏览器、`page.route` 可模拟的失败场景。
   - **需第二账号**（如越权）：需要 `LOGIN_USER_B` / `LOGIN_PASSWORD_B`（或文档约定的 env）；未配置则总表状态 **`skipped`**，备注「缺角色 B 凭据」。
   - **需双浏览器 / 双上下文**（如并发编辑）：当前默认标 **`out_of_scope`** 或 **`skipped`**「需双 context」，除非按 [references/SUITE_TEMPLATE.md](references/SUITE_TEMPLATE.md) 扩展为双 `browser.newContext()`。
   - **小程序 / 非 Shadow Web**：标 **`out_of_scope`**（真机、开发者工具链），不要用桌面浏览器冒充覆盖。
3. **生成脚本** — **默认仅「类型 | 管理后台」**（与 TEST.md 属性表一致）；不对「小程序」等生成 `by-id` 文件。条目数与 `extract-tc-ids.js --type 管理后台` 一致。**默认采用备选 B**：在 `docs/.../artifacts/playwright/by-id/` 下为每个 ID 生成 `playwright-test-<TC-ID>.js`，先写 `/tmp` 再同步留档；可 **`scripts/generate-tc-stubs.js ... --type 管理后台`**。**「重新执行」若只调 `run.js`，不会自动生成或补全 `by-id`**。若项目显式要求单文件 suite，再用推荐 A。
4. **校验** — **备选 B**：`node "$SKILL_DIR/scripts/validate-tc-by-id-dir.js" /path/to/TEST.md /path/to/artifacts/playwright/by-id --type 管理后台`（与生成范围一致）。**推荐 A**：`validate-tc-coverage.js --check-functions`。通过后再写入 `AUTOMATED_TEST.md` 总表。
5. **更新总表** — 见下文「产出物契约」。

### 脚本代码与数量对账（避免「只生成一两个用例」）

**默认：备选 B（每用例一文件）**

- **与 `extract-tc-ids.js --type 管理后台` 输出个数相同**（若仅生成管理后台脚本）：`by-id/` 下 N 个 `playwright-test-<TC-ID>.js`，见 [references/BY_ID_LAYOUT.md](references/BY_ID_LAYOUT.md)。
- 使用 **`scripts/validate-tc-by-id-dir.js`**，建议加 **`--type 管理后台`** 与生成范围一致。

**可选：推荐 A（单文件 suite）**

- suite 内声明 `// PLAYWRIGHT_TC_IDS: ...` 或 `const PLAYWRIGHT_TC_IDS = [...]`，且每个 ID 有 `async function tc_*`；使用 **`scripts/validate-tc-coverage.js`**（可加 `--check-functions`）。

### 脚本组织（二选一勿混用；**默认备选 B**）

- **备选 B：每用例一文件（默认）** — 目录 `docs/<branch>/artifacts/playwright/by-id/`，文件名 **`playwright-test-TC-F-001.js`**。**默认只含「类型 | 管理后台」用例**；文件数 = `extract-tc-ids.js --type 管理后台` 的 count。按 TEST.md 顺序**批量执行**时用 **`scripts/run-by-id-sequential.js`**（勿只跑单条除非调试）。详见 [references/BY_ID_LAYOUT.md](references/BY_ID_LAYOUT.md)。
- **推荐 A：单文件 suite** — 一个 `/tmp/playwright-test-<feature>-suite.js`，内含 `PLAYWRIGHT_TC_IDS` + 等量 `async function tc_*`。留档可到 `artifacts/playwright/` 根下。模板见 [references/SUITE_TEMPLATE.md](references/SUITE_TEMPLATE.md)。

### 数据与执行顺序

- 使用 TEST.md「测试数据」节的命名规则，并加**时间戳/随机后缀**，避免删除用例删掉筛选用例依赖的数据。
- 推荐顺序：**列表/筛选** → **新建** → **编辑 / 上下架 / 排序** → **删除**；**取消删除、表单校验、接口失败**等放在已有稳定数据之后。
- 角色 B 用例：单独一段登录与断言，勿与角色 A 混用同一 session 除非用例明确要求。

### 产出物契约（`AUTOMATED_TEST.md`）

在 `docs/<gitBranch>/AUTOMATED_TEST.md`（或工作流约定的同目录）中必须包含：

| 列 | 说明 |
| --- | --- |
| 用例ID | 与 TEST.md 完全一致，如 TC-F-001 |
| 优先级/类型 | 来自用例属性表或标题 |
| 状态 | `implemented` / `skipped` / `out_of_scope` |
| 脚本或 § | suite 内函数名、留档路径，或「见 TEST.md 假设 A-x」 |
| 备注 | 失败原因、依赖 env、截图文件名等 |

**总行数必须等于** `extract-tc-ids.js` 输出的用例个数；若 **by-id 仅含管理后台**，对账时用 `extract-tc-ids.js … --type 管理后台`（与 TEST.md 增删同步时可重跑脚本对账）。

---

## 固定顺序：先生成脚本，再执行（基于 TEST.md 时强制）

`run.js` **只负责执行**已存在的 `.js`，**不会**根据 TEST.md 生成代码。任务来自 **TEST.md** 时，**禁止**在未完成「生成」前执行 `run.js`（例如禁止先 `detectDevServers` 再直接 `run.js` 而跳过写脚本）。

推荐顺序：

1. **生成** — 按上文「从 TEST.md 生成自动化」：抽取 ID → 分类 → **默认**为每个 ID 编写 `/tmp/playwright-test-<TC-ID>.js` 并同步到 `docs/.../artifacts/playwright/by-id/` → `validate-tc-by-id-dir.js`（单文件 suite 时用 `validate-tc-coverage.js`）→ 更新 `AUTOMATED_TEST.md`。
2. **再探测 URL（按需）** — 若 `TARGET_URL` 已由 `LOGIN_ACCOUNT.md` / 环境变量确定，可跳过；否则运行 `detectDevServers` 或询问用户，**不得**用探测结果覆盖已配置的 Shadow 入口（见 Tips）。
3. **执行** — 单条调试：`cd $SKILL_DIR && node run.js /path/to/playwright-test-TC-xxx.js`。按 **TEST.md 顺序跑满管理后台 by-id**（非只跑一条）：`node "$SKILL_DIR/scripts/run-by-id-sequential.js" /path/to/TEST.md /path/to/by-id --type 管理后台`；需**逐条弹出 Chromium 窗口**时追加 **`--headed`**（会取消 `PLAYWRIGHT_HEADLESS`）。`run.js` 会 **await** 脚本 `module.exports` 的 Promise，保证单条跑完再退出。

---

**CRITICAL WORKFLOW - Follow these steps in order:**

若任务来自 **TEST.md**，必须先完成上文 **「固定顺序：先生成脚本，再执行」** 中的第 1 步，再执行第 3 步。

**通用步骤（生成与执行分离）：**

1. **Write scripts to /tmp FIRST** — NEVER write to skill directory; always use `/tmp/playwright-test-*.js`。基于 TEST.md 时，须先写完脚本并通过校验后再进入执行。

2. **Auto-detect dev servers（执行前、按需）** — For localhost testing, when URL is not fixed by `LOGIN_ACCOUNT.md`:

   ```bash
   cd $SKILL_DIR && node -e "require('./lib/helpers').detectDevServers().then(s => console.log(JSON.stringify(s)))"
   ```

   - 1 server found: use it automatically
   - Multiple: ask user which one
   - None: ask for URL or help start dev server

3. **Visible browser by default** - Scripts and `helpers.launchBrowser` use `headless: process.env.HEADLESS === 'true'` (headed unless `HEADLESS=true`)

4. **Parameterize URLs** - `TARGET_URL` constant at top of every script; never hardcode project-specific addresses

5. **Execute LAST** — `cd $SKILL_DIR && node run.js /tmp/playwright-test-*.js`

## How It Works

1. User describes what to test/automate (or points to TEST.md)
2. **Generate** custom Playwright code to `/tmp/playwright-test-*.js` (and archive to project `artifacts/` when using TEST.md)
3. **Then** optionally auto-detect running dev servers if URL not already set
4. **Then** execute via: `cd $SKILL_DIR && node run.js /tmp/playwright-test-*.js`
5. Results displayed in real-time with visible browser
6. Test files auto-cleaned from /tmp

## Setup (First Time)

```bash
cd $SKILL_DIR && npm run setup
```

## Execution Pattern

**Step 1:** Write script to `/tmp/playwright-test-*.js` with `TARGET_URL` parameterized at top（基于 TEST.md 时：先生成、校验、留档后再继续）

**Step 2:** Detect dev servers（仅当 URL 未由 `LOGIN_ACCOUNT` / 环境变量确定时）

```bash
cd $SKILL_DIR && node -e "require('./lib/helpers').detectDevServers().then(s => console.log(JSON.stringify(s)))"
```

**Step 3:** Execute from skill directory（**最后一步**）

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
- `TARGET_URL` must come from env, deploy docs, or **`references/LOGIN_ACCOUNT.md`** (`项目地址`, via `applyLoginEnvIfUnset`) — **never hardcode** ad-hoc URLs in scripts
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
- **Visible browser** - Use `headless: process.env.HEADLESS === 'true'`; only headless when `HEADLESS=true`
- **slowMo** - Use `slowMo: 100` to make actions visible
- **Wait strategies** - Use `waitForURL`, `waitForSelector`, `waitForLoadState` instead of fixed timeouts
- **After click, wait for content** - After clicking a menu/dropdown, wait for expanded content to be visible before next action (e.g. `locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 10000 })`)
- **Error handling** - Always use try-catch; throw on assertion failure (never just console.log)
- **Idempotent select** - For auto-save dropdowns, read current value first. If already equals target, select a different option (wait for save), then select target again to guarantee change event fires. See [references/COMMON_PATTERNS.md](references/COMMON_PATTERNS.md) for full example.
- **Async data tables** - Element UI tables render an empty container before data arrives. After clicking a navigation item, directly `waitForSelector` on data rows (e.g. `.el-table__body tr`) instead of the table container. Do NOT use `waitForLoadState('networkidle')` on pages with polling/auto-refresh — it waits up to 30s and DOM may be in a refresh mid-state when it times out. After clicking "返回" in a loop, also wait for rows (not just the table container) before re-accessing them.
- **Sidebar menu locator** - 管理后台侧栏菜单用多策略定位，见 [LOGIN_PATTERNS](references/LOGIN_PATTERNS.md)
- **Element Plus 表单元素** - 当 TEST.md 的 When 使用「在[区域]中 label 为「X」的[类型]」格式时，优先用 `page.locator('.el-form-item').filter({ hasText: 'X' }).locator('.el-select').first()` 定位；el-select-dropdown 选项**禁止** `.last()`，改用 `page.getByRole('listbox').getByRole('option', { name: '选项名' })` 或 `page.locator('.el-select-dropdown:visible, .el-popper:visible').getByText('选项名')`

## Troubleshooting

**Playwright not installed:** `cd $SKILL_DIR && npm run setup`

**Module not found:** Ensure running from skill directory via `run.js` wrapper

**Browser doesn't open:** `run.js` **默认有界面**（会忽略 shell 里误设的 `HEADLESS=true`）。**无头**仅当 **`CI=true`** 或 **`PLAYWRIGHT_HEADLESS=1`**。本地若需强制无头：`export PLAYWRIGHT_HEADLESS=1`。若 CI 里需看窗口：`export PLAYWRIGHT_FORCE_HEADED=1`。

**Element not found:** Add wait: `await page.waitForSelector('.element', { timeout: 10000 })`

## 需登录时的默认资源

当前端需要登录时，在生成/执行脚本前按需使用下列资源（并列；账号不写入本文件）：

- [references/LOGIN_ACCOUNT.md](references/LOGIN_ACCOUNT.md) — 默认 **`项目地址`** / 账号（见文件内字段说明）
- [references/login-env.js](references/login-env.js) — 将 **`项目地址`** → `TARGET_URL`，账号 → `LOGIN_USER` / `LOGIN_PASSWORD`（对应环境变量未设置时）
- [references/LOGIN_PATTERNS.md](references/LOGIN_PATTERNS.md) — 登录与脚本生成规则
