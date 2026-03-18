# playwright-skill 使用指南

本文档说明如何在项目中使用 `playwright-skill` 的能力。

## 概述

`playwright-skill` 提供了两种集成方式：

1. **PlaywrightService**：直接使用 Playwright API，集成 helpers 工具函数
2. **PlaywrightSkillExecutor**：通过 `run.js` 执行器执行复杂脚本

## 配置

### 环境变量

在 `.env` 文件中配置：

```bash
# 启用 Playwright 集成
USE_PLAYWRIGHT=true

# Playwright 浏览器配置
PLAYWRIGHT_HEADLESS=false  # false 表示有头模式（可见浏览器窗口）
PLAYWRIGHT_TIMEOUT=30000   # 默认超时时间（毫秒）

# 浏览器自动化总开关
ENABLE_BROWSER=true
```

## 使用方式

### 方式 1：通过 PlaywrightService（推荐）

`PlaywrightService` 已集成到 `AutomationExecution` 中，会自动根据步骤的 `action` 类型智能路由：

- **简单操作**（`open`, `click`, `type`, `hover`）：自动使用 `PlaywrightService`
- **复杂操作**：使用 `StagehandService`

#### 示例：测试用例 JSON

```json
{
  "testCase": "用户登录",
  "steps": [
    {
      "step": "打开登录页面",
      "action": "open",
      "params": {
        "url": "https://example.com/login"
      },
      "status": "pending"
    },
    {
      "step": "输入用户名",
      "action": "type",
      "params": {
        "selector": "input[name='username']",
        "text": "testuser"
      },
      "status": "pending"
    },
    {
      "step": "点击登录按钮",
      "action": "click",
      "params": {
        "selector": "button[type='submit']"
      },
      "waitFor": {
        "type": "toast",
        "text": "登录成功"
      },
      "expected": {
        "type": "cookie",
        "value": "session_id"
      },
      "status": "pending"
    }
  ]
}
```

### 方式 2：通过 PlaywrightSkillExecutor（复杂场景）

对于需要执行复杂 Playwright 脚本的场景，可以使用 `PlaywrightSkillExecutor`：

```typescript
import { PlaywrightSkillExecutor } from '../services/PlaywrightSkillExecutor';

const executor = new PlaywrightSkillExecutor();

// 检测开发服务器
const servers = await executor.detectDevServers([3000, 8080]);
console.log('Detected servers:', servers);

// 执行脚本文件
const result = await executor.executeScript('/path/to/script.js');

// 执行内联代码
const inlineResult = await executor.executeInline(`
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://example.com');
  console.log('Page title:', await page.title());
  await browser.close();
`);
```

### 方式 3：直接调用 PlaywrightService

在自定义代码中直接使用 `PlaywrightService`：

```typescript
import { PlaywrightService } from '../services/PlaywrightService';

const playwrightService = new PlaywrightService();

// 初始化
await playwrightService.initialize();

// 导航
await playwrightService.navigate('https://example.com');

// 点击
await playwrightService.click('button#submit');

// 输入
await playwrightService.type('input[name="email"]', 'test@example.com');

// 悬停
await playwrightService.hover('[class*="user"]');

// 等待元素
await playwrightService.waitForElement('.loading', 5000);

// 等待 Toast
const toastFound = await playwrightService.waitForToast('操作成功', 5000);

// 清理
await playwrightService.close();
```

## Helpers 工具函数

`PlaywrightService` 已集成 `playwright-skill/lib/helpers.js` 中的工具函数：

- **`detectDevServers()`**：自动检测运行中的开发服务器
- **`safeClick()`**：带重试的安全点击
- **`safeType()`**：带重试的安全输入
- **`createContext()`**：创建带自定义 HTTP headers 的浏览器上下文
- **`handleCookieBanner()`**：自动处理 Cookie 横幅

这些函数会在 `PlaywrightService` 初始化时自动加载，并在相应操作中使用。

## 智能路由机制

`AutomationExecution` 中的 `StepRunner` 会根据以下规则自动选择执行引擎：

1. **如果 `USE_PLAYWRIGHT=true` 且步骤有明确的 `action`**：
   - `action: 'open'` → 使用 `PlaywrightService.navigate()`
   - `action: 'click'` → 使用 `PlaywrightService.click()`
   - `action: 'type'` → 使用 `PlaywrightService.type()`
   - `action: 'hover'` → 使用 `PlaywrightService.hover()`

2. **否则**：
   - 使用 `StagehandService.act()`（依赖 LLM API）

## 优势

### PlaywrightService vs StagehandService

| 特性     | PlaywrightService | StagehandService           |
| -------- | ----------------- | -------------------------- |
| API 调用 | 无（直接操作）    | 频繁（每次操作都调用 LLM） |
| 速率限制 | 不受影响          | 可能遇到 429 错误          |
| 执行速度 | 快                | 较慢（需要等待 LLM 响应）  |
| 复杂操作 | 需要手动编写代码  | 支持自然语言指令           |
| 成本     | 无 API 成本       | 有 API 成本                |

### 推荐使用场景

- **使用 PlaywrightService**：
  - 简单操作（点击、输入、导航）
  - 需要避免 API 速率限制
  - 需要快速执行

- **使用 StagehandService**：
  - 复杂操作（需要 AI 理解页面结构）
  - 动态元素定位
  - 自然语言指令

## 故障排查

### PlaywrightService 未初始化

检查：

1. `ENABLE_BROWSER=true` 是否设置
2. `USE_PLAYWRIGHT=true` 是否设置
3. 查看日志中的初始化错误信息

### Helpers 加载失败

如果 `playwright-skill/lib/helpers.js` 加载失败，`PlaywrightService` 会自动回退到直接使用 Playwright API，不影响基本功能。

### 选择器找不到元素

`PlaywrightService` 支持多种选择器策略：

1. CSS 选择器
2. 文本内容匹配
3. XPath（如果选择器以 `/` 开头）
4. 通过 `parseSelector()` 解析自然语言选择器

如果所有策略都失败，操作会失败并抛出错误。请检查选择器是否正确，或使用 StagehandService 处理复杂场景。

## 相关文件

- `backend/src/services/PlaywrightService.ts`：Playwright 服务实现
- `backend/src/services/PlaywrightSkillExecutor.ts`：playwright-skill 执行器封装
- `backend/src/actions/AutomationExecution.ts`：自动化执行入口
- `backend/src/utils/selectorParser.ts`：选择器解析工具
- `skills/playwright-skill/lib/helpers.js`：工具函数库
- `skills/playwright-skill/run.js`：通用执行器
