---
name: automation-test
description: 当用户或工作流需要自动化测试规划、自动化脚本生成或自动化执行时使用此 skill。指导 Agent 何时触发、如何配合后端 AutomationEngineer 两步流程，并内置 Act 执行正确性验证与断言生成规范。
---

# 自动化测试流程与规范

基于 TEST.md（或 TEST_REVIEW.md）执行自动化测试规划与执行，由后端 AutomationEngineer 角色按固定两步顺序执行。

## ⚠️ 执行前必读（强制）

**在生成任何 JSON 文件之前，必须先执行以下步骤：**

1. **读取模板文件**：使用 Read 工具读取 [automation-json-template.json](references/automation-json-template.json)
2. **理解模板结构**：模板包含完整的 JSON 格式规范，输出必须严格遵循此结构
3. **按模板格式输出**：每个测试用例必须使用模板中的 JSON 格式

## 输出规范（强制）

> **重要**：以下规范必须严格遵守，不可违反。

| 项目           | 规范                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------- |
| **输出文件名** | `TC-XXX-用例名称.json`（必须使用此命名格式，如 TC-001-用户登录-正确账号密码登录成功.json）    |
| **文件数量**   | 每个测试用例生成一个独立的 JSON 文件                                                          |
| **JSON 格式**  | 必须严格按照 [automation-json-template.json](references/automation-json-template.json) 的格式 |
| **字段完整性** | 所有必需字段必须存在，不得省略或使用占位符                                                    |

## JSON 文件结构（必须严格遵循）

输出的 JSON 文件必须包含以下字段，格式必须与模板一致：

```json
{
  "testCase": "TC-XXX：用例名称 - 场景描述",
  "status": "pending",
  "precondition": ["前置条件1"],
  "steps": [
    {
      "step": "步骤描述",
      "action": "open|click|type|verify|hover",
      "params": { "url" 或 "selector" },
      "expected": { "type": "url|text|element|api|cookie|url_match", "value": "值" } 或 null,
      "status": "pending",
      "error": null
    }
  ],
  "duration": 0
}
```

## 断言类型规范（重要）

### 支持的断言类型

| 类型        | 说明             | 使用场景                            | 示例                                             |
| ----------- | ---------------- | ----------------------------------- | ------------------------------------------------ |
| `cookie`    | 验证 Cookie 存在 | **登录态校验（推荐）**              | `{ "type": "cookie", "value": "token" }`         |
| `element`   | 验证元素可见性   | **登录态校验（备选）**、UI 元素验证 | `{ "type": "element", "value": "用户头像" }`     |
| `url_match` | URL 模糊匹配     | 登录后页面跳转校验                  | `{ "type": "url_match", "value": "/dashboard" }` |
| `url`       | URL 精确匹配     | 页面跳转验证（不推荐用于登录）      | `{ "type": "url", "value": "/home" }`            |
| `text`      | 文本内容验证     | 页面文本、提示信息验证              | `{ "type": "text", "value": "登录成功" }`        |
| `api`       | API 响应验证     | 接口调用结果验证                    | `{ "type": "api", "value": "200" }`              |

### ⚠️ 登录成功断言规则（强制）

**禁止使用固定 URL 断言**（如 `/home`、`/dashboard`），因为：

- 不同环境 URL 可能不同
- 登录后可能跳转到不同页面
- URL 可能包含动态参数

**必须使用登录态特征校验**，优先级顺序：

1. **优先使用 `cookie` 断言**（最可靠）

   ```json
   {
     "expected": {
       "type": "cookie",
       "value": "token"
     }
   }
   ```

2. **备选使用 `element` 断言**（验证登录态 UI 元素）

   ```json
   {
     "expected": {
       "type": "element",
       "value": "用户头像"
     }
   }
   ```

   或

   ```json
   {
     "expected": {
       "type": "element",
       "value": "用户名"
     }
   }
   ```

3. **最后使用 `url_match` 断言**（模糊匹配 URL）
   ```json
   {
     "expected": {
       "type": "url_match",
       "value": "/dashboard"
     }
   }
   ```

### Element 断言增强功能

`element` 类型支持多种查找方式：

- **文本内容查找**：`{ "type": "element", "value": "用户头像" }`
- **CSS 选择器**：`{ "type": "element", "value": ".user-avatar" }`
- **角色定位**：`{ "type": "element", "value": "role=button" }`
- **登录态特征元素**：自动识别用户头像、用户名等元素

### Toast 断言规则（强制）

**Toast 消息断言必须遵循以下规则：**

1. **Toast 不作为唯一成功断言**
   - Toast 消息可能短暂显示，不能作为唯一的成功判断依据
   - 必须搭配登录态校验（cookie 或 element）

2. **必须搭配登录态校验**
   - 登录成功场景：Toast + Cookie 断言
   - 示例：
     ```json
     {
       "step": "用户点击登录按钮",
       "action": "click",
       "params": {
         "selector": "登录按钮"
       },
       "expected": {
         "type": "cookie",
         "value": "token"
       },
       "waitFor": {
         "type": "toast",
         "text": "登录成功",
         "timeout": 5000
       },
       "status": "pending",
       "error": null
     }
     ```

3. **文本断言使用 contains**
   - 文本匹配使用包含匹配（contains），不使用精确匹配（equals）
   - 已自动实现：使用 `includes()` 方法进行文本匹配

4. **必须增加 waitForElement**
   - Toast 消息需要等待元素出现后再断言
   - 在断言前自动添加等待逻辑
   - `waitFor` 字段支持：
     - `type`: `"toast"` 或 `"element"`
     - `text`: Toast 消息文本（用于 contains 匹配）
     - `selector`: 元素选择器（用于 element 类型）
     - `timeout`: 超时时间（毫秒，默认 5000）

## 自动化测试两步流程（不可变）

| Step | 动作                | 输入                     | 输出          |
| ---- | ------------------- | ------------------------ | ------------- |
| 1    | AutomationPlanning  | TEST.md / TEST_REVIEW.md | `auto/*.json` |
| 2    | AutomationExecution | auto/\*.json             | 执行报告      |

**说明**：当前仅对 TEST.md 中**标题包含「正向场景」**的用例生成自动化脚本（Step 1）；异常场景、边界条件等不生成脚本。

## 使用场景

当用户有以下需求时启用：

- 自动化测试规划
- 自动化脚本生成
- 自动化执行
- 端到端业务流程测试
- 登录后多业务操作
- 跨模块流程验证

## E2E 标准流程模型

```text
启动浏览器
   ↓
登录系统
   ↓
执行业务场景
   ↓
数据校验
   ↓
退出登录
   ↓
关闭浏览器
```

## 禁止事项

以下行为是禁止的，违反将导致输出无效：

1. ❌ 不读取模板文件就直接生成 JSON
2. ❌ 使用与模板不一致的 JSON 格式
3. ❌ 省略必需字段（testCase、status、steps）
4. ❌ 使用非标准的 action 值（必须是 open/click/type/verify/hover）
5. ❌ 文件名不符合 TC-XXX-用例名称.json 格式
6. ❌ 多个测试用例合并到一个 JSON 文件
7. ❌ **登录成功断言使用固定 URL**（如 `/home`、`/dashboard`），必须使用 `cookie` 或 `element` 断言
8. ❌ 使用不支持的断言类型（必须是 url、text、element、api、cookie、url_match 之一）
