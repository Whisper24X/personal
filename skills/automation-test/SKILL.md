---

name: automation-test
description: 当用户或工作流需要自动化测试规划、自动化脚本生成或自动化执行时使用此 skill。指导 Agent 何时触发、如何配合后端 AutomationEngineer 两步流程，并内置 Act 执行正确性验证与断言生成规范。
------------------------------------------------------------------------------------------------------------------------------------------

# 自动化测试流程与规范（增强版）

基于 TEST.md（或 TEST_REVIEW.md）执行自动化测试规划与执行，由后端 AutomationEngineer 角色按固定两步顺序执行。

在两步流程基础上，**Stagehand Act 执行验证 + Assertion 生成 Skills 体系**确保自动化脚本具备可执行性与结果可信度。

---

# 执行前必读（强制）

**前置条件**：

1. **TEST.md 已存在**
   自动化测试以测试用例文档为输入，必须先有 `docs/test/TEST.md`。
   若存在 `TEST_REVIEW.md`，优先使用评审版本。

2. **执行主体**
   自动化测试由后端 **AutomationEngineer 两步流程**执行。
   本 skill 指导 Agent：

   * 何时触发自动化
   * 如何生成脚本
   * 如何验证 act 正确性
   * 如何生成断言

3. **触发方式**

   * TestReview 后自动触发
   * 或 API 调用 AutomationEngineer
   * Agent 对话触发需确认 TEST.md 已就绪

---

# 自动化测试两步流程（不可变）

| Step | 动作                 | 输入                       | 输出       |
| ---- | -------------------- | ------------------------ | ---------- |
| 1    | AutomationPlanning   | TEST.md / TEST_REVIEW.md | `auto/*.ts` |
| 2    | AutomationExecution  | auto/*.ts                | 执行报告   |

---

# 🔧 Step 1 增强：AutomationPlanning Skills 体系

脚本生成不再直接从 TEST.md → 代码，而必须经过 Skills Pipeline。

---

## Skills Pipeline（强制执行）

```
1️⃣ Test Intent Parsing
2️⃣ Page Observation
3️⃣ Action Generation
4️⃣ Action Validation
5️⃣ Assertion Generation
6️⃣ Network Assertion
7️⃣ DOM Change Detection
8️⃣ Script Assembly
```

---

## Skill 1：Test Intent Parsing

解析测试目标：

**输入**

```
用户登录成功
```

**输出**

```
Actions:
- 输入账号
- 输入密码
- 点击登录

Expected:
- 跳转首页
- 显示用户信息
```

---

## Skill 2：Page Observation

通过 Stagehand：

```ts
stagehand.observe("Describe login page structure")
```

输出：

* 输入框
* 按钮
* 可交互元素

用于避免 act 定位错误。

---

## Skill 3：Action Generation（Act 生成）

生成标准 act：

```ts
await stagehand.act("Type username 'testuser'");
await stagehand.act("Type password '******'");
await stagehand.act("Click Login button");
```

---

### Act 生成规则（强制）

1. 一步一 act
2. 必须包含 UI 语义定位
3. 禁止模糊描述：

❌ Click button
✅ Click "Login" button in form footer

---

## Skill 4：Action Validation（Act 正确性验证）

用于判断 act 是否执行成功。

---

### 验证维度

| 类型           | 验证方式          |
| ------------ | ------------- |
| Selector 唯一性 | matched count |
| 点击成功         | 按钮状态变化        |
| 输入成功         | value 校验      |
| 请求触发         | network 监听    |
| 页面变化         | DOM diff      |

---

### 自动生成验证代码

```ts
await expect(button).toBeDisabled();
await expect(input).toHaveValue('testuser');
```

---

## Skill 5：Assertion Generation（断言生成）

每个 act 必须配断言。

---

### 断言五分类

| 类型    | 示例        |
| ----- | --------- |
| UI 文案 | 登录成功      |
| URL   | /home     |
| 元素状态  | avatar 显示 |
| 接口    | login 200 |
| 业务    | 用户态存在     |

---

### 示例代码

```ts
await expect(page).toHaveURL(/home/);
await expect(page.locator('.avatar')).toBeVisible();
```

---

## Skill 6：Network Assertion

监听关键接口：

```ts
page.on('response', res => {
  if (res.url().includes('/login')) {
    expect(res.status()).toBe(200);
  }
});
```

---

## Skill 7：DOM Change Detection

判断 act 是否引发页面变化：

```ts
const before = await page.content();
await stagehand.act("Click Submit");
const after = await page.content();
```

---

## Skill 8：Script Assembly

组装完整脚本：

```
Navigation
Actions
Assertions
Network checks
```

---

# 生成脚本强制规范（新增）

---

## 规则 1：Act 必须配 Assert

```
Each act must have at least one assertion.
```

---

## 规则 2：关键流程双断言

```
UI + API assertions required.
```

---

## 规则 3：禁止连续 act

```
act → assert → act → assert
```

---

# Step 2：AutomationExecution（不变）

执行：

```
auto/*.ts
```

输出：

* pass / fail
* 日志
* trace / video（若启用）

---

# 输出与位置（不变）

```
docs/test/
 ├── TEST.md
 ├── auto/
 │    ├── login.spec.ts
 │    ├── order.spec.ts
```

---

# 脚本规范（强化）

必须满足：

1. 仅使用 Stagehand
2. 必含 act + assert
3. 必含关键接口监听
4. 必含流程结果验证

---

# 环境要求（不变）

```
ENABLE_BROWSER=true
```

需具备：

* 浏览器
* Stagehand
* Playwright 依赖

---

# 与其它 Skills 边界

| Skill           | 关系           |
| --------------- | ------------ |
| test            | 上游生成 TEST.md |
| test-review     | 评审用例         |
| automation-test | 自动化执行        |
| engineer        | 不参与          |

---

# 参考

详见：

```
references/automation-flow.md
```

---
