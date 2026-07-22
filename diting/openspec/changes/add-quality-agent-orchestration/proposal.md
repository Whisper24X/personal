## Goal

将编码完成后的质量检查从 `programming` Agent 执行管线中抽离为独立的 `quality` Agent 阶段。编码 Agent 完成实现后写入 implementation handoff，并将当前 task 切换给质检 Agent；质检 Agent 负责编排 OpenSpec completion gate、`QualityPlugin.evaluate`、API/UI 自动化证据 gate、code review、quality report、PR/MR 放行和 repair handoff。

## Why

当前 `ServiceExecution` 在编码执行后内联运行 completion gate、quality 和 repair loop，导致编码 Agent 既实现代码又自判质量是否通过。产品 Agent 已经通过 `agentKind=product` 与 `driverId=openspec-product` 把需求生成阶段从编码阶段中拆出；质量阶段也需要同样的 Agent 能力边界，以便：

- 让 `programming` 专注实现和修复。
- 让 `quality` 专注检查、审查、归因与报告。
- 保留 `QualityPlugin` 作为底层检查执行器，避免破坏插件契约。
- 将 repair loop 演进为跨 Agent handoff：quality 生成修复目标，programming 修复，再回到 quality 复检。

## What Changes

- 新增 `agentKind=quality` 与 `driverId=quality-orchestrator` 的调度与 runtime selection 支持。
- 编码成功后写入 `artifacts/implementation-handoff.json`，记录 workspace、OpenSpec、repo sha anchors、diff、execution/session 与 artifact path，并将当前 task 切换为 `ready(quality)`。
- 质检阶段恢复 workspace 后先校验 handoff 与 workspace repo anchors；缺失或不一致时 fail closed 到 `waiting`。
- 质检阶段统一执行 completion gate、`QualityPlugin.evaluate`、API/UI evidence gate、code review runtime 和 `quality-report.json` 持久化。
- code review 必须产生 `artifacts/code-review-report.json`；缺失、解析失败或存在 CRITICAL/IMPORTANT 阻断时不得放行。
- 质检失败时通过现有 FailureRepairService / `repair_goals` 写统一修复信息，并额外写入 `artifacts/quality-repair-handoff.json`，然后将当前 task 切回 `ready(programming)`。
- PR/MR 创建迁移到 quality pass 分支；PR/MR 创建失败按现有重试或 `waiting` 人工介入处理。
- 更新 observability、diagnose 与架构文档，展示 quality handoff、quality report 和 repair handoff。

## Impact

- Core orchestration: `ServiceExecution` 会新增 quality orchestration 分支，并拆分原先编程内联 quality 流程。
- Scheduler: worker pool 支持 `quality` agent claim。
- Plugin runtime: 支持选择 `quality-orchestrator` agent plugin。
- Server plugins: 注册 Codex/Cursor quality orchestrator runtime provider。
- Tests: 新增 handoff schema、artifact persistence、evidence gate、orchestration pass/fail、repair loop compatibility、observability 与 diagnose 覆盖。
- Docs: 更新架构文档中 Agent kind、Quality Evaluation 和质量闭环叙事。

## Non-Goals

- 不让 quality Agent 直接修改业务代码。
- 不替换 `QualityPlugin` 契约；它仍负责 lint/typecheck/test/build/diff risk 等底层评估。
- 首版不创建 quality 子 task，采用与 product handoff 一致的当前 task 切换模型。
- 首版不引入独立 release/merge Agent；PR/MR 创建仍在 quality pass 分支触发。
