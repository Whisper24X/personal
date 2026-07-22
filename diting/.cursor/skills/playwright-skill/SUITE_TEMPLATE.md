# Suite 脚本模板（单文件，推荐）

与 `SKILL.md` 中「脚本组织 · 推荐 A」一致：一个 `playwright-test-<feature>-suite.js` 放在 `/tmp`，跑通后复制到 `docs/<branch>/artifacts/playwright/`。

## 结构约定

1. 顶部：`require('playwright')`、`applyLoginEnvIfUnset`（若需）、`TARGET_URL`、`LOGIN_*`。
2. **必写**：与 TEST.md 用例 **等长** 的 ID 声明（与 `extract-tc-ids.js` 输出一致），例如：
   ```javascript
   // PLAYWRIGHT_TC_IDS: TC-F-001,TC-F-002,TC-F-003
   // 或使用：
   const PLAYWRIGHT_TC_IDS = ['TC-F-001', 'TC-F-002', 'TC-F-003'];
   ```
   生成后执行：`node "$SKILL_DIR/scripts/validate-tc-coverage.js" TEST.md /tmp/your-suite.js --check-functions`
3. `async function ensureLoggedIn(page)` — 与现有单用例脚本相同逻辑。
4. `async function navigateToNewsList(page)` — 或业务统一的「侧栏进页」辅助函数。
5. **每个 TC 一个函数**：`async function tc_F_001(page) { ... }`（`TC-E-001` → `tc_E_001`，`TC-B-003` → `tc_B_003`）。未实现的用例：`console.log('[SKIP] TC-F-002: …'); return;`。**禁止**只写 TC-F-001 而缺少其余 `tc_*`。
6. `async function main()` — 按数据依赖顺序 `await` 各 `tc_*`（或对 `PLAYWRIGHT_TC_IDS` 遍历调用）；默认**遇错即退出**。
7. `main().catch((e) => { console.error(e); process.exit(1); });`

## 最小骨架（伪代码）

```javascript
const { chromium } = require('playwright');
const { applyLoginEnvIfUnset } = require('./references/login-env');
applyLoginEnvIfUnset();
const TARGET_URL = process.env.TARGET_URL;

async function main() {
  const browser = await chromium.launch({ headless: process.env.HEADLESS === 'true', slowMo: 100 });
  const page = await browser.newPage();
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // ... login if needed ...

  await tc_F_001(page);
  await tc_F_002(page);
  // ...

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

## 双上下文（可选，TC-B-005 类）

需两个独立登录会话时：

```javascript
const context1 = await browser.newContext();
const context2 = await browser.newContext();
const page1 = await context1.newPage();
const page2 = await context2.newPage();
// 分别登录、分别操作同一资源 ID
```

未在技能默认流程中要求；总表中可标 `out_of_scope` 直至实现此模式。
