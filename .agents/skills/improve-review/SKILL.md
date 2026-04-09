---
name: improve-review
description: 基于 git diff 与 checklist 做 Code Review，结果写入 improveReviewResult.md（Markdown 结构化文档）。
---

# ImproveReview - 代码审查扫描

对 workspace 中的代码执行结构化 Code Review，发现潜在问题并输出结构化结果，供 improve-analyze 合并排序。

## 输出规范（强制）

> **重要**：结果必须写入文件，不是输出到终端。
> **禁止**输出裸 JSON。必须使用下方 Markdown 结构化格式。

**文档路径**：输出路径**必须**从节点 Prompt 获取（工作流 v2 ImproveCode）；示例：`docs/{{gitBranch}}/improveReviewResult.md`。

| 项目         | 规范                                                     |
| ------------ | -------------------------------------------------------- |
| **结果文件** | prompt 指定（如 `docs/{{gitBranch}}/improveReviewResult.md`） |
| **文件格式** | **Markdown 结构化文档**（`# 标题` + `## Summary` + `## Issues` + 分条 `### Issue N`） |
| **优先级**   | P0/P1→high, P2→medium, P3→low（与 improve-analyze 兼容） |

**Issue 必填字段**（在每条 `### Issue N` 下用 `- **字段名**: 值` 列出）：

| 字段 | 必填 | 说明 |
| ---- | ---- | ---- |
| `id`、`title`、`priority`、`status`、`type`、`location` | 是 | `type` 含 `bug`、`security`、`performance`、`quality`、`solid` 等 |
| `requires_deep_debug` | 否 | `true` 表示现象可能跨多层/多组件，improve-execute 必须完整走 systematic-debugging；不填视为 `false` |
| `root_cause_summary`、`evidence`、`resolution_note` | 否 | 由 **improve-execute** 在解决后回写；review 阶段**不填** |

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

将结果以 **Markdown 结构化格式** 写入 prompt 指定路径（如 `docs/{{gitBranch}}/improveReviewResult.md`）。

**确保 prompt 指定路径的父目录存在**（如 `docs/{{gitBranch}}/`），不存在则先创建。

**优先级映射**：P0/P1 → `high`，P2 → `medium`，P3 → `low`

### 示例 - 发现问题

```markdown
# Improve Review Result

## Summary

- **result**: 发现 3 个问题
- **reason**: Code Review 扫描：1 个 security(high)，1 个 solid(high)，1 个 quality(medium)

## Issues

### Issue 1

- **id**: 1
- **title**: SQL 注入风险：用户输入直接拼接
- **priority**: high
- **status**: pending
- **type**: security
- **location**: src/api/user.ts:42
- **requires_deep_debug**: false

### Issue 2

- **id**: 2
- **title**: OrderService 违反 SRP，职责过多
- **priority**: high
- **status**: pending
- **type**: solid
- **location**: src/services/OrderService.ts

### Issue 3

- **id**: 3
- **title**: 空 catch 块吞掉异常
- **priority**: medium
- **status**: pending
- **type**: quality
- **location**: src/utils/parser.ts:18
```

### 示例 - 无问题

```markdown
# Improve Review Result

## Summary

- **result**: 无问题
- **reason**: Code Review 扫描完成，未发现需改进项

## Issues

（无）
```

## 重要提醒

1. **工作目录**：git diff 基于 `ainative-workspace` 目录，不超出该范围
2. **必须写入文件**：结果必须写入 prompt 指定路径（如 `docs/{{gitBranch}}/improveReviewResult.md`）
3. **Markdown 结构严格**：必须包含 `# 标题`、`## Summary`、`## Issues`；每条 issue 必须有 `### Issue N` 三级标题与必填字段
4. **禁止输出 JSON**：整文件不是 JSON；使用 `- **key**: value` 格式
5. **不修改源代码**：此 Skill 仅扫描和输出，不执行修复
6. **不询问用户**：完全自动执行，无需用户确认
7. **每次覆盖写入**：每次执行覆盖 `improveReviewResult.md`
8. **location 格式**：`path/to/file.ts` 或 `path/to/file.ts:line`（相对于 ainative-workspace），便于 improve-execute 定位
9. **可选元数据**：跨 CI/多服务的缺陷可设 `requires_deep_debug: true`；`root_cause_summary` / `evidence` / `resolution_note` 由 improve-execute 在修复后补全，review 无需填写
