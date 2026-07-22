# Proposal: unify-dependency-checks

## Summary

将插件、外部 CLI 和任务依赖校验收束到统一入口，在服务启动后展示整体依赖状态，并在任务开始时按任务必需依赖执行 preflight 阻塞。控制台新增依赖检查弹窗，集中展示 Meegle CLI、GitLab CLI、Codex/Cursor CLI 等依赖的可用性、授权和修复动作；OpenSpec tooling 不纳入本轮依赖检查。

## Goals

- 新增统一 dependency check 后端模型，聚合 Meegle、GitLab、coding runtime 等依赖状态。
- 在控制台提供弹窗式依赖检查中心，展示 `n/m ready` 进度、分组卡片、Required / Optional、子状态、重检和授权入口。
- 服务启动后允许可选依赖 degraded，但不改变现有 `/api/readiness` 的 HTTP 可用性语义。
- 任务开始时复用现有 `runPreflight` 链路，只阻塞该任务必需依赖。
- 复用现有 Meegle/GitLab device-code 授权流程，避免真实凭据进入 dependency check 聚合结果、日志或 OpenSpec 制品。

## Non-Goals

- 不将所有 Meegle/GitLab/Codex 依赖纳入严格 readiness 并阻塞整个服务。
- 不引入新的前端 UI 组件库。
- 不在 Agent 非交互 Shell 中静默执行 `openspec validate` 或 `openspec archive`。
- 不为外置插件立即设计公共 dependency check 插件契约；第一版优先覆盖内置依赖。

## Proposed Approach

新增 `apps/server/src/diting/dependency-checks/` 模块，包含 types、registry、providers 和 service。HTTP 层提供 `GET /api/dependency-checks` 与 `POST /api/dependency-checks/recheck`，前端通过新增 `DependencyCheckModal` 渲染依赖状态。

任务门禁接入 `runPreflight`：

- `TitingServices.submitTask()` 入队前写入 `metadata.preflight`。
- `ServiceExecution.ensurePreflightBeforeEnvironment()` 执行前复跑 preflight。
- `ServiceScheduler.runProgrammingHandoffPreflight()` 覆盖 product 到 programming handoff 场景。

前端新增依赖检查弹窗，参考用户提供的 Drydock 图：顶部 ready 进度，正文按 `Coding Agents`、`Task Integrations`、`Platform / Repository` 分组，底部提供 `Re-check` 与 `Skip for now`。

## Impact

- Server：新增 dependency check 聚合 API，修改 preflight hook 注入方式和 task preflight。
- Core：保持现有 preflight blocked 行为，必要时补充测试覆盖 dependency check failure。
- Web：新增弹窗组件、API helper、i18n 文案和样式，复用已有 Meegle/GitLab 授权方法。
- Tests：新增 server Jest 与 web Vitest 覆盖，执行 `npm run type-check`。

## Risks

- Codex/Cursor 本轮只检测 CLI 是否可用，OpenSpec 安装与校验后续单独处理。
- CLI health/recheck 可能拖慢启动或 UI，需设置超时、缓存 TTL、并发限制和失败隔离。
- Dependency check 聚合结果必须严格脱敏，短期 `userCode` / `deviceCode` 只允许出现在现有授权 start/poll 流程中。
