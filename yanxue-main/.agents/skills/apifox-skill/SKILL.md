---
name: apifox-skill
description: Generate and run API automation scripts from TEST.md. Outputs Node.js scripts (axios) to docs/test/auto-api. Use when user wants interface/API automation based on test cases, or to run Apifox-style API tests from TEST.md.
---

# API 接口自动化（apifox-skill）

根据 TEST.md 中的**接口测试**用例，生成可执行的 Node.js 接口自动化脚本，输出到 **docs/test/auto-api**，与 Playwright 的 docs/test/auto 分离。

## 使用场景

- 从 TEST.md / TEST_REVIEW.md 解析接口测试用例（含「接口测试」「验证…API」「调用 GET/POST …/api/…」等）
- 为每个接口用例生成一个独立的 .js 脚本（axios 发请求 + 断言）
- 通过 `node run.js <script>` 或 `node run.js <dir>` 执行脚本并汇总报告

## 约定（与 playwright-skill 对齐）

| 项目         | 约定                                                                            |
| ------------ | ------------------------------------------------------------------------------- |
| 输入         | docs/test 下的 TEST.md 或 TEST_REVIEW.md（优先 TEST_REVIEW.md）                 |
| 输出目录     | **docs/test/auto-api**（严禁写入 docs/test/auto）                               |
| 单用例单文件 | `api-test-TC-XXX-用例简述.js`，例如 `api-test-TC-CSV-001-CSV映射配置接口.js`    |
| 脚本格式     | Node.js，使用 axios 或 Node 原生 http(s)，顶部常量参数化 BASE_URL、ACCESS_TOKEN |

## 脚本规范

1. **顶部常量**
   - `const BASE_URL = process.env.BASE_URL || 'https://example.com';`
   - `const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';`（如需鉴权）

2. **从 TEST.md 的 When/Then 解析**
   - 请求：方法（GET/POST/PUT/DELETE）、路径、query、body
   - 预期：状态码（如 200、201）、响应体关键字段或 JSON 路径

3. **脚本结构**
   - 自执行异步函数 `(async () => { ... })()` 或导出 `async function run() { ... }`
   - 发请求 → 断言 `res.status === 200` 及必要字段 → `console.log('PASS')` 或 `throw new Error(...)`
   - 使用 axios 时：`const axios = require('axios');` 或从技能目录注入

4. **脚本模板示例**

```javascript
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'https://api.example.com';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';

(async () => {
  try {
    const res = await axios.get(`${BASE_URL}/api/config`, {
      headers: ACCESS_TOKEN ? { Authorization: `Bearer ${ACCESS_TOKEN}` } : {},
      validateStatus: () => true,
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.data && !res.data.success) throw new Error('Response success is false');
    console.log('PASS');
  } catch (e) {
    console.error('FAIL:', e.message);
    process.exit(1);
  }
})();
```

## 识别接口用例

- 测试范围/类型中包含「接口测试」或「验证…API」
- 用例步骤中出现：`调用 GET/POST …/api/…`、`验证响应 200/201`、`验证返回字段`、`请求 … 接口` 等
- 前置条件中的登录态 → 脚本中用 BASE_URL、Authorization 占位，由环境变量或 run.js 注入

## 文件命名

- 格式：`api-test-{用例编号}-{简短描述}.js`
- 例如：`api-test-TC-CSV-001-CSV映射配置接口.js`、`api-test-TC-002-保存配置接口.js`

## 执行方式

- 单脚本：`node run.js <path-to-api-test-*.js>`
- 目录：`node run.js <dir>` 会执行该目录下所有 `api-test-*.js`
- 报告：run.js 汇总通过/失败，可写 JSON 到 `docs/test/report-api/api-results.json`（由后端 ApiAutomationExecution 指定）

## 可选：Apifox CLI

- 在线运行：`apifox run --access-token $APIFOX_ACCESS_TOKEN --test-suite <id> -e <envId> -r html,cli`
- 导出后运行：`apifox run [options] <file-source>`
- 环境变量：APIFOX_ACCESS_TOKEN、BASE_URL 等可由后端或 .env 传入

## 禁止

- 禁止将脚本写入 docs/test/auto（该目录仅用于 Playwright）
- 禁止生成 Playwright 或浏览器相关代码
- 仅生成接口测试脚本，不生成 UI 自动化
