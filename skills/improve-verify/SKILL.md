---
name: improve-verify
description: 验证代码改进效果。检查问题解决状态、验证代码质量、判定是否完成所有改进。全部完成时删除 ImproveCode.md。无状态验证工具，由 ImproveCode Action 循环调用。触发场景：(1) 改进效果验证 (2) 代码质量检查 (3) 改进完成判定
---

# VerifyImprovement - 验证改进效果

在代码改进执行后，验证所有问题的解决状态和代码质量，判定改进是否全部完成。

## 输出规范（强制）

> **重要**：验证结果必须写入文件，不是输出到终端。

| 项目         | 规范                                               |
| ------------ | -------------------------------------------------- |
| **输入文件** | `docs/code/ImproveCode.md`（改进需求，含 ✅ 标记） |
| **输入文件** | `docs/code/improveExecuteResult.md`（执行结果）    |
| **结果文件** | `docs/code/improveVerifyResult.md`                 |
| **文件格式** | JSON 格式，包含 result、reason、details 字段       |
| **状态值**   | `已完成` / `未完成` / `验证失败`（三选一）         |

## 执行步骤

### 1. 检查问题解决状态

**读取 `docs/code/ImproveCode.md`**：

- 逐条检查每个问题是否带有 `✅ 已解决` 标记
- 统计已解决和未解决的问题数量
- 如果文件不存在，说明可能已被意外删除，输出 `验证失败`

**读取 `docs/code/improveExecuteResult.md`**：

- 获取执行阶段的状态和说明
- 如果执行失败，记录失败原因

**状态汇总**：

| 情况                     | 判定         |
| ------------------------ | ------------ |
| 所有问题都标记 ✅ 已解决 | 进入质量检查 |
| 存在未标记的问题         | 未完成       |
| ImproveCode.md 不存在    | 验证失败     |

### 2. 验证代码质量

对修复涉及的代码执行质量检查（参照 `code-evaluate-completion` 的检查标准）：

**AI 检查**：

| 检查项          | 检测方式                                   | 严重程度 |
| --------------- | ------------------------------------------ | -------- |
| TODO/FIXME 标记 | 搜索 `TODO`、`FIXME`、`XXX`、`HACK` 关键字 | 高       |
| 占位符          | 搜索 `...`、`// ...`、`/* ... */`          | 高       |
| 空函数体        | 检测 `function xxx() {}`                   | 高       |
| 逻辑错误        | 检查修复代码的逻辑正确性                   | 高       |

**工具检查**（根据项目类型）：

| 项目类型     | 检查命令                         | 说明              |
| ------------ | -------------------------------- | ----------------- |
| 前端（pnpm） | `pnpm lint` / `pnpm build`       | ESLint/TypeScript |
| 前端（npm）  | `npm run lint` / `npm run build` | ESLint/TypeScript |
| Go 项目      | `make lint` / `go build ./...`   | 代码规范/编译检查 |
| 有 Makefile  | `make build`                     | 项目构建检查      |

**Sandbox 环境规则**：

- 有 Sandbox → 所有构建命令在 sandbox 内执行
- 无 Sandbox → 直接执行

### 3. 判定是否完成

**"已完成"必须同时满足以下所有条件**：

1. `ImproveCode.md` 中所有问题都标记为 `✅ 已解决`
2. 代码中无 TODO/FIXME/占位符/空实现
3. 代码构建/lint 检查通过（或项目无相关配置）

**以下任一情况判定为"未完成"**：

1. 存在未标记 `✅ 已解决` 的问题
2. 修复的代码引入了新的 TODO/占位符
3. 代码构建失败或 lint 检查不通过

### 4. 删除改进文件（仅在全部完成时执行）

**当且仅当判定为"已完成"时**，必须执行以下操作：

```bash
rm docs/code/ImproveCode.md
```

**删除规则**：

- **必须执行删除**：不要写"由于权限限制无法删除"之类的借口，直接删除文件
- **删除文件是标记任务完成的唯一方式**：ImproveCode Action 通过检查文件是否存在来判断是否完成
- 你有完整的文件读写和删除权限，请直接执行删除操作
- 如果判定为"未完成"，**不要删除**文件，系统会再次执行改进循环

### 5. 输出验证结果

将结果以 JSON 格式写入 `docs/code/improveVerifyResult.md`。

**确保 `docs/code/` 目录存在**，不存在则先创建。

### 示例 - 已完成

```json
{
  "result": "已完成",
  "reason": "所有 5 个问题已解决，代码质量检查通过，ImproveCode.md 已删除",
  "details": {
    "total_issues": 5,
    "resolved_issues": 5,
    "pending_issues": 0,
    "code_quality": "通过",
    "build_check": "通过",
    "lint_check": "通过"
  }
}
```

### 示例 - 未完成（仍有未解决问题）

```json
{
  "result": "未完成",
  "reason": "仍有 2 个问题未解决",
  "details": {
    "total_issues": 5,
    "resolved_issues": 3,
    "pending_issues": 2,
    "pending_list": [
      { "id": 2, "title": "列表加载超过 3 秒", "priority": "medium" },
      { "id": 3, "title": "变量命名不规范", "priority": "low" }
    ],
    "code_quality": "通过"
  }
}
```

### 示例 - 未完成（代码质量不通过）

```json
{
  "result": "未完成",
  "reason": "所有问题已标记解决，但代码构建失败",
  "details": {
    "total_issues": 3,
    "resolved_issues": 3,
    "pending_issues": 0,
    "code_quality": "未通过",
    "build_check": "失败：TypeScript 编译错误 2 处",
    "lint_check": "通过"
  }
}
```

### 示例 - 验证失败

```json
{
  "result": "验证失败",
  "reason": "docs/code/ImproveCode.md 文件不存在，无法验证"
}
```

## 重要提醒

1. **必须写入文件**：结果必须写入 `docs/code/improveVerifyResult.md`，不是输出到终端
2. **JSON 格式严格**：确保输出的是合法 JSON，可被程序解析
3. **确保目录存在**：如果 `docs/code/` 目录不存在，需要先创建
4. **已完成时必须删除 ImproveCode.md**：这是完成信号，ImproveCode Action 依赖此判断
5. **未完成时不要删除 ImproveCode.md**：保留文件，系统会再次执行改进循环
6. **每次覆盖写入**：每次执行都覆盖 `improveVerifyResult.md`（不是追加）
7. **代码质量标准**：参照 `code-evaluate-completion` 的检查规范，保持团队标准一致
