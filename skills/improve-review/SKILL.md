---
name: improve-review
description: 对代码库执行 Code Review 扫描。基于 git diff 和 checklist 发现 SOLID 违规、安全风险、代码质量问题、移除候选。输出供 improve-analyze 合并。无状态工具，由 ImproveCode Action 调用。
---

# ImproveReview - 代码审查扫描

对 workspace 中的代码执行结构化 Code Review，发现潜在问题并输出结构化结果，供 improve-analyze 与 ImproveCode.md 合并排序。

## 输出规范（强制）

> **重要**：结果必须写入文件，不是输出到终端。

| 项目         | 规范                                                     |
| ------------ | -------------------------------------------------------- |
| **结果文件** | `docs/code/improveReviewResult.md`                       |
| **文件格式** | JSON 格式，包含 result、reason、issues 字段              |
| **优先级**   | P0/P1→high, P2→medium, P3→low（与 improve-analyze 兼容） |

## 执行步骤

### 1. Preflight 限定变更范围

**工作目录**：当前执行目录即为项目 workspace 根目录（`ainative-workspace`），即 `workspace/{applicationId}/{projectId}/versions/{versionId}/ainative-workspace`。

**git diff 范围**：基于 `ainative-workspace` 目录执行，仅审查该目录内的变更：

```bash
# 在 ainative-workspace 根目录下执行
git status -sb
git diff --stat
git diff
```

- 若需限定源码目录，可指定路径：`git diff -- frontend/ backend/ ainative-pc/ ainative-app/ ainative-shadow/ src/`（根据项目实际结构选择存在目录）
- 若无 git 或 diff 为空：扫描 ainative-workspace 内主要源码目录（如 `src/`、`ainative-pc/src/`、`ainative-app/src/`、`ainative-shadow/src/`）
- 大 diff（>500 行）：按文件/模块分批审查
- 识别入口点、关键路径（auth、支付、数据写入、网络）

### 2. SOLID + 架构检查

- 读取 `references/solid-checklist.md`
- 检查：SRP、OCP、LSP、ISP、DIP 违规，God 对象，职责混杂
- 发现问题时记录：标题、文件:行号、类型 `solid`、建议修复方向

### 3. 安全与可靠性检查

- 读取 `references/security-checklist.md`
- 检查：XSS、注入、AuthZ/AuthN、密钥泄露、CORS、ReDoS、竞态条件
- 发现问题时记录：标题、文件:行号、类型 `security`、严重度 P0/P1/P2

### 4. 代码质量检查

- 读取 `references/code-quality-checklist.md`
- 检查：异常吞掉、N+1、边界条件、异步错误、性能热点
- 发现问题时记录：标题、文件:行号、类型 `quality` 或 `performance`

### 5. 移除候选检查

- 读取 `references/removal-plan.md`
- 识别：死代码、冗余、feature-flag 关闭代码
- 区分「可立即删」与「需计划」，仅将可立即删的纳入 issues

### 6. 输出结果

将结果以 JSON 格式写入 `docs/code/improveReviewResult.md`。

**确保 `docs/code/` 目录存在**，不存在则先创建。

**优先级映射**：P0/P1 → `high`，P2 → `medium`，P3 → `low`

### 示例 - 发现问题

```json
{
  "result": "发现 3 个问题",
  "reason": "Code Review 扫描：1 个 security(high)，1 个 solid(high)，1 个 quality(medium)",
  "issues": [
    {
      "id": 1,
      "title": "SQL 注入风险：用户输入直接拼接",
      "priority": "high",
      "status": "pending",
      "type": "security",
      "location": "src/api/user.ts:42"
    },
    {
      "id": 2,
      "title": "OrderService 违反 SRP，职责过多",
      "priority": "high",
      "status": "pending",
      "type": "solid",
      "location": "src/services/OrderService.ts"
    },
    { "id": 3, "title": "空 catch 块吞掉异常", "priority": "medium", "status": "pending", "type": "quality", "location": "src/utils/parser.ts:18" }
  ]
}
```

### 示例 - 无问题

```json
{
  "result": "无问题",
  "reason": "Code Review 扫描完成，未发现需改进项",
  "issues": []
}
```

## 重要提醒

1. **工作目录**：git diff 基于 `ainative-workspace` 目录，不超出该范围
2. **必须写入文件**：结果必须写入 `docs/code/improveReviewResult.md`
3. **JSON 格式严格**：确保输出合法 JSON，可被程序解析
4. **不修改源代码**：此 Skill 仅扫描和输出，不执行修复
5. **不询问用户**：完全自动执行，无需用户确认
6. **每次覆盖写入**：每次执行覆盖 `improveReviewResult.md`
7. **location 格式**：`path/to/file.ts` 或 `path/to/file.ts:line`（相对于 ainative-workspace），便于 improve-execute 定位
