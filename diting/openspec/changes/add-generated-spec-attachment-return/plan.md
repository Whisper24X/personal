# Generated OpenSpec Local Path Return 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 当 product agent 因缺少 `spec文档` 附件而生成 OpenSpec 时，在 OpenSpec review 子任务中返回 `openspec/changes/<changeId>` 的本地绝对路径供用户审核。

**Architecture:** Core 负责计算 `openspecPath`、持久化 review/handoff 元数据并移除上传链路。task-integration 的 OpenSpec review request 携带该路径，Meegle adapter 在子任务描述中展示路径和审核提示。review gate 继续使用现有前缀状态机。

**Tech Stack:** TypeScript / Node.js monorepo；重点模块为 `packages/plugin-api`、`packages/core`、`apps/server`，测试优先使用现有 Vitest/TypeScript 脚本。

---

### Task 1: 调整 task-integration OpenSpec review 契约

**Files:**
- Modify: `packages/plugin-api/src/diting/plugins.ts`
- Test: `packages/plugin-api` 类型检查或现有编译测试

- [ ] **Step 1: Write the failing type usage**

新增类型用例，声明 `OpenSpecReviewIssueRequest` 可携带 `openspecPath`。同时确保 `TaskIntegrationPlugin` 不再暴露 `uploadGeneratedSpecAttachment`。

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run type-check -w packages/plugin-api`
Expected: FAIL，因为 `openspecPath` 尚未定义或旧上传接口仍存在。

- [ ] **Step 3: Write minimal implementation**

在 `OpenSpecReviewIssueRequest` 增加 `openspecPath?: string`；删除 generated spec attachment upload request/response 类型和 optional method。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run type-check -w packages/plugin-api`
Expected: PASS.

### Task 2: Core 计算 OpenSpec 本地路径并执行 handoff 门禁

**Files:**
- Modify: `packages/core/src/diting/**`
- Test: `packages/core/src/diting/**/*.spec.ts`

- [ ] **Step 1: Write failing tests**

覆盖三类行为：`openspecSourceState=none` 时 review request 携带 `openspecPath`；legacy attachment 路径仍可打开 review 且不触发 upload；approval handoff 缺 `openspecPath` 时 fail closed。

- [ ] **Step 2: Run focused tests**

Run: `npm run test -w apps/server -- services.spec.ts -t "generated OpenSpec|OpenSpec handoff"`
Expected: FAIL，因为 Core 尚未计算和传递 `openspecPath`。

- [ ] **Step 3: Implement archive and metadata flow**

实现 `join(workspaceId, "openspec", "changes", changeId)` 路径计算；写入 `openSpecReview.openspecPath`、HumanReview reason 和 execution log；删除 zip 打包函数、上传幂等 key 和附件摘要 helper。

- [ ] **Step 4: Run focused tests**

Run: `npm run test -w apps/server -- services.spec.ts -t "generated OpenSpec|OpenSpec handoff"`
Expected: PASS.

### Task 3: Meegle adapter 展示 OpenSpec 本地路径

**Files:**
- Modify: `apps/server/src/diting/plugins/meegle.ts`
- Test: `apps/server/src/diting/plugins.spec.ts`

- [ ] **Step 1: Write failing adapter tests**

测试 OpenSpec review 子任务描述包含 `OpenSpec 文档绝对路径：<openspecPath>`，且保留门禁前缀说明。

- [ ] **Step 2: Run focused tests**

Run: `npm run test -w apps/server -- plugins.spec.ts -t "OpenSpec review"`
Expected: FAIL，因为 adapter 尚未展示 `openspecPath`。

- [ ] **Step 3: Implement Meegle description update**

创建 OpenSpec review 子任务时，在描述中追加本地绝对路径和审核文件提示；删除 `uploadGeneratedSpecAttachment` 实现和仅用于上传的 helper。

- [ ] **Step 4: Run focused tests**

Run: `npm run test -w apps/server -- plugins.spec.ts -t "OpenSpec review"`
Expected: PASS.

### Task 4: Review 和诊断可见性

**Files:**
- Modify: `apps/server/src/diting/plugins/execution.ts`
- Modify: `apps/server/src/diting/**/*.ts` diagnostics/observability 相关文件
- Modify: `docs/architecture/diting-product-agent-usage.md`

- [ ] **Step 1: Write failing tests**

测试 HumanReview payload 或任务诊断输出包含 `openspecPath`。

- [ ] **Step 2: Run focused tests**

Run: `npm run test -w apps/server -- diagnose-task.spec.ts -t "OpenSpec local path"`
Expected: FAIL，因为诊断尚未展示 `openspecPath`。

- [ ] **Step 3: Implement visibility updates**

把 `openspecPath` 写入 HumanReview reason/payload 和诊断输出；更新产品 Agent 使用文档说明产物查看入口是 Meegle review 子任务描述。

- [ ] **Step 4: Run focused tests**

Run: `npm run test -w apps/server -- diagnose-task.spec.ts -t "OpenSpec local path"`
Expected: PASS.

### Task 5: 验证

**Files:**
- No new source files; run repository checks.

- [ ] **Step 1: Run type checks**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 2: Run focused test suites**

Run: `npm run test -w apps/server -- services.spec.ts -t "generated OpenSpec|OpenSpec handoff"`
Run: `npm run test -w apps/server -- plugins.spec.ts -t "OpenSpec review"`
Run: `npm run test -w apps/server -- diagnose-task.spec.ts -t "OpenSpec local path"`
Expected: PASS.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS.
