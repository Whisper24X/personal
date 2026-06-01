---
name: ainative-architecture-testing
description: >-
  Covers AINative monorepo documentation workflows: functional architecture
  scanning (Mermaid module maps, route-to-backend tables), core test cases
  without PRD (Markdown + XMind Zen export), and XMind content.json bundling
  rules. Use when working in ainative or similar Vue+Nest repos, when the user
  asks for 功能模块图, 扫项目, core use cases, XMind 脑图, export .xmind,
  docs/architecture, docs/testing, or aligning testing strategy with
  functional-modules.md.
---

# AINative 架构与测试文档（合并技能）

本技能合并 **功能模块图扫描**、**无 PRD 核心用例与 XMind 导出** 三条工作流，并锚定本仓库 **canonical 文档路径**（见 `reference.md`）。适用于在本仓库或结构相近的 **frontend + backend** 单体/ monorepo 中协作。

## When to Apply

在以下任一需求时启用：

- 需要**功能视角**架构说明（用户可见能力 ↔ 后端域），产出 Mermaid + 映射表；
- 需要维护或讲解 **无 PRD 核心用例**（P0/P1）、**脑图**、**测试策略**；
- 需要**生成或修改** XMind Zen（`content.json` ZIP）或理解链式用例层级；
- 用户提及 `docs/architecture`、`docs/testing`、`.agents/skills/project-functional-map`、`.agents/skills/xmind-zen-export` 等路径。

## Part A — 功能模块图（Functional Map）

### Hard Rules

1. **只读发现**：先读文件与搜索，不对无关代码做重构。
2. **证据驱动**：图中主要节点须能在 **Sources** 文件列表中追溯。
3. **框架自适应**：以实际仓库为准（NestJS `AppModule`、Vue `router/routes` 等）。
4. **Mermaid 安全**：节点 ID 无空格；`subgraph id [Label]`；含特殊字符的边标签用 `|"..."|`。
5. **不编造**：缺层则写明 **未检出**，不猜测。

### 输出顺序（必须）

1. 项目形态简述（根 `package.json`、workspace、脚本）。
2. **图 1** `flowchart TB`：用户 → 前端功能面 → 后端域 → 基础设施。
3. **图 2** `flowchart LR` 或 `TB`：后端域分组与 DB、跨模块依赖。
4. **表 3**：用户可见功能（路由/页名）→ 主要后端域。
5. **Sources**：证据文件路径列表。

本仓库**已维护**总览时，优先 **对齐或引用** `docs/architecture/functional-modules.md`，避免与现网文档矛盾。

### Out of Scope（Part A）

- 登录时序图等除非用户明确要求；
- 部署拓扑（K8s 等）除非用户要求部署视图。

---

## Part B — 核心用例与测试策略（Core Use Cases）

### 文档角色

- **`docs/testing/core-use-cases.md`**：P0/P1 用例正文（前置条件、执行步骤、预期结果）；可含「接口或说明」「当前验收说明」。
- **可选** `docs/testing/core-use-cases-test-report.md`：自动化执行摘要（Playwright / Jest 等），与用例编号**概念对齐**，非逐条一一自动化（文件可后续补充）。

### 与架构文档的关系

- `docs/architecture/functional-modules.md` **图 1 / 图 3** 可与 P1「系统分层补充用例」交叉引用；用例 ID 以 `core-use-cases.md` 为准。

### E2E 衔接（本仓库）

- 冒烟：`frontend/e2e/smoke.spec.ts`，环境变量见文件头注释（`E2E_TEST_*`、`E2E_API_URL`）。

---

## Part C — XMind Zen 导出

### 格式（必须）

- **`.xmind`** = ZIP，含 `content.json`、`manifest.json`、`metadata.json`；**不要**仅依赖旧版单文件 `content.xml` 作为唯一载体。

### 用例脑图语义（与 AINative 约定一致）

- **链式四级**：用例标题 → 前置条件 → 执行步骤 → 预期结果（**非**三节并列）。
- 用例根标题带 **`[P0]` / `[P1]`**（与分组节点互补）。
- 多行内容合并进**节标题**内，换行后 `1. …` 编号。

### 生成方式（本仓库）

- **单一数据源**：`docs/testing/core-use-cases.md`，由 `docs/testing/build-core-use-cases-xmind.py` 解析并生成 `.xmind`；**勿**在脚本中重复维护整份用例列表。
- 脑图节点经 **`xmind_plain_text`** 做纯文字化（去 Markdown 链接/加粗/反引号、前端路由白话、`/v1` 接口概括为「调用后端接口」等）；**不修改** Markdown 源文。
- 命令（仓库根）：`python3 docs/testing/build-core-use-cases-xmind.py`

### Out of Scope（Part C）

- XMind 云协作与账号；
- Freemind / MindManager 等格式需另述规则。

---

## Unified Example Triggers

- 「按功能模块扫一遍前后端」
- 「核心用例和脑图怎么同步」
- 「导出 xmind / 无 PRD 用例」
- 「functional-modules 和 core-use-cases 什么关系」

## See Also

- 细节与路径索引：同目录 [`reference.md`](reference.md)。
