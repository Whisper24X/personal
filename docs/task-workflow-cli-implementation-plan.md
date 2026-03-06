# 任务工作流 + 多 CLI Provider 改造实施方案（具体落地版）

## 1. 目标与范围

### 1.1 目标
在不推翻现有任务调度体系的前提下，实现以下能力：

1. **统一 CLI Provider 执行层**：编排层不关心 claude/codex/cursor/gemini/opencode 差异。
2. **节点调用级可观测**：可查看每个节点每次调用的开始/结束/失败、耗时、退出码、输出摘要。
3. **任务创建支持 prompt 流（workflowDraft）**：支持多节点、每节点独立 CLI + prompt。
4. **详情页可视化调用时间线**：按节点查看 invocation 记录，支持 SSE 实时更新。

### 1.2 非目标（本阶段不做）

- 不重构现有任务状态机与调度机制。
- 不引入复杂 DAG 编排器，仅支持顺序草稿节点。
- 不落库 stdout/stderr 全量原文，仅保存 preview 截断摘要。
- 不做 provider 模块大拆分（先在 `AgentRunnerService` 内收敛）。

---

## 2. 现状复用点

- 后端调度/状态流转：`TasksService` 已具备 `scheduleQueuedNodes`、租约、恢复逻辑。
- 多 CLI 雏形：`AgentRunnerService` 已有 adapter + config 解析能力。
- 日志流与前端实时：`TaskLogEventsService` + SSE 链路已存在。
- 前端任务创建与详情：`TaskCreatePanel.vue`、`detail.vue`、`WorkflowCard.vue` 已可复用扩展。

---

## 3. 分阶段实施（建议按 PR 拆分）

## Phase 1（MVP）— 后端统一执行 + invocation 落库 + 详情页展示

### 3.1 数据模型：新增 `task_node_invocation`

#### 3.1.1 表结构（建议字段）

- `id` (uuid)
- `task_id` (uuid, index)
- `task_node_id` (uuid, index)
- `cli_tool_id` (varchar, nullable)
- `agent_tool_config_id` (uuid, nullable)
- `attempt` (int, default 1)
- `status` (enum: `running | succeeded | failed | timed_out`)
- `started_at` (timestamp)
- `finished_at` (timestamp, nullable)
- `duration_ms` (int, nullable)
- `exit_code` (int, nullable)
- `timed_out` (boolean, default false)
- `stdout_preview` (text, nullable)
- `stderr_preview` (text, nullable)
- `error_message` (text, nullable)
- `created_at` / `updated_at`

#### 3.1.2 索引建议

- `(task_id, started_at desc)`
- `(task_node_id, started_at desc)`
- `(task_node_id, attempt desc)`

#### 3.1.3 文件落点

- `backend/src/tasks/infrastructure/persistence/relational/entities/task-node-invocation.entity.ts`
- `backend/src/tasks/infrastructure/persistence/task-node-invocation.repository.ts`（领域接口）
- `backend/src/tasks/infrastructure/persistence/relational/repositories/task-node-invocation.repository.ts`（实现）

> 注意：不破坏现有 Task/TaskNode 表，纯增量。

---

### 3.2 统一 CLI Provider 执行收敛（`AgentRunnerService`）

#### 3.2.1 目标行为

- 输入：节点上下文 + `cliToolId` + `agentToolConfigId` + prompt/input。
- 输出：统一 `AgentRunnerResult`（继续沿用现有结构）。
- 行为：所有 provider 都返回统一 exitCode/stderr/stdout/durationMs/timedOut。

#### 3.2.2 改造要点

- 保留现有 `AgentAdapter` 与 `resolveRunnerConfig` 链路。
- 增加 provider 层规范：
  - adapter 负责命令拼装、环境变量注入。
  - runner 负责执行与结果归一。
- `executeAgentNode` 内部输出结构严格一致，避免上层做 provider 分支。

#### 3.2.3 关键规则

- 默认超时行为统一（以现有配置为准）。
- 错误信息统一落在 `stderr` + `errorMessage`（由上层组装）。
- 所有 provider 的 `durationMs` 计算口径一致。

---

### 3.3 `TasksService` 注入 invocation 生命周期

#### 3.3.1 节点执行流程（新增步骤）

1. 节点开始执行时：创建 invocation 记录（`status=running`）。
2. 调用 `AgentRunnerService.executeAgentNode`。
3. 成功：更新 invocation（`succeeded` + 结束字段）。
4. 失败/超时：更新 invocation（`failed/timed_out` + error + 结束字段）。
5. 同步写入 task log（兼容旧日志视图）。
6. 发布 invocation 事件（用于 SSE 实时展示）。

#### 3.3.2 preview 截断策略

- `stdout_preview`、`stderr_preview` 分别截断到固定长度（建议 2000~4000 字符）。
- 截断函数统一封装，避免散落逻辑。

---

### 3.4 事件系统扩展（`TaskLogEventsService`）

#### 3.4.1 新增事件类型

- `node.invocation.started`
- `node.invocation.finished`
- `node.invocation.failed`

#### 3.4.2 事件 payload（建议）

```json
{
  "type": "node.invocation.finished",
  "taskId": "...",
  "taskNodeId": "...",
  "invocationId": "...",
  "attempt": 1,
  "status": "succeeded",
  "cliToolId": "claude",
  "agentToolConfigId": "...",
  "startedAt": "...",
  "finishedAt": "...",
  "durationMs": 12345,
  "exitCode": 0,
  "timedOut": false,
  "stdoutPreview": "...",
  "stderrPreview": "...",
  "errorMessage": null
}
```

#### 3.4.3 兼容策略

- 保留原有日志事件，不改原事件含义。
- 前端可逐步升级：老 UI 仅消费 log，新 UI 额外消费 invocation。

---

### 3.5 前端详情页接入 invocation 时间线

#### 3.5.1 `detail.vue`

- 扩展 SSE handler：识别 invocation 三类事件。
- 本地状态新增：`invocationsByNodeId: Record<string, Invocation[]>`。
- 与 `selectedWorkflowNodeId` 联动过滤显示。

#### 3.5.2 `WorkflowCard.vue`

- 每个节点新增“最近一次调用”信息：
  - 状态（running/succeeded/failed/timed_out）
  - 耗时（durationMs）
  - 退出码（exitCode）

#### 3.5.3 新组件（建议）`InvocationTimeline.vue`

展示字段：

- startedAt
- cliToolId / config 名称
- status / exitCode / durationMs
- stdoutPreview / stderrPreview
- errorMessage

---

## Phase 2（增强）— 任务创建支持 workflowDraft

### 4.1 DTO 扩展（`create-task.dto.ts`）

新增可选字段：

```ts
workflowDraft?: Array<{
  name: string;
  nodeType: 'agent' | 'system';
  prompt?: string;
  cliToolId?: string;
  agentToolConfigId?: string;
  requiresApproval?: boolean;
  input?: Record<string, unknown>;
}>;
```

约束建议：

- `workflowDraft.length > 0` 时，`name/nodeType` 必填。
- `agent` 节点至少应有 `prompt` 或 `input`。

### 4.2 `TasksService.create` 分支

- 若有 `workflowDraft`：按草稿顺序建节点。
- 若无：走现有 conversation/template 分支（完全兼容）。
- 节点级 `cliToolId/agentToolConfigId` 可覆盖任务级默认配置。

### 4.3 `TaskCreatePanel.vue`

在现有能力上加“轻量多节点编辑”：

- 顺序列表（增/删/排序）
- 每节点可选 CLI / 配置 / prompt
- 提交时组装 `workflowDraft`
- 保留原单轮模式入口，不影响旧用户习惯

---

## Phase 3（完整）— 连续会话与重试可视化

### 5.1 连续上下文传递

- 在节点间传递 `conversationId` / `resumeToken`（按 provider 能力可选）。
- invocation 增加关联字段（可后补迁移）。

### 5.2 重试策略

- 增加节点级 retry policy（max attempts/backoff）。
- 前端展示重试链路（attempt 1/2/3）。

---

## 6. 详细改动清单（首批）

## 后端

1. `backend/src/tasks/agent-runner.service.ts`
   - 统一 provider 执行输出口径。
2. `backend/src/tasks/tasks.service.ts`
   - 节点执行接入 invocation create/update + 事件发布。
3. `backend/src/tasks/task-log-events.service.ts`
   - 新增 invocation 事件类型与发布方法。
4. `backend/src/tasks/dto/create-task.dto.ts`
   - 新增 `workflowDraft` 字段定义与校验。
5. `backend/src/tasks/domain/task.ts`
   - 如需补领域快照/类型，最小增量修改。
6. `backend/src/tasks/infrastructure/persistence/relational/entities/*`
   - 新增 invocation entity。
7. `backend/src/tasks/infrastructure/persistence/*`
   - 新增 invocation repository 接口与实现。
8. migration 文件
   - 创建 `task_node_invocation` 表与索引。

## 前端

1. `frontend/src/types/api/tasks.ts`
   - 新增 invocation 类型、SSE 事件类型。
2. `frontend/src/views/tasks/detail.vue`
   - 增加 invocation SSE 消费与状态管理。
3. `frontend/src/components/tasks/detail/WorkflowCard.vue`
   - 增加节点最近调用状态展示。
4. `frontend/src/components/tasks/detail/InvocationTimeline.vue`（新建）
   - 节点调用时间线组件。
5. `frontend/src/components/tasks/TaskCreatePanel.vue`
   - 新增 workflowDraft 编辑与提交。

---

## 7. 接口与协议建议

### 7.1 创建任务请求（新增片段）

```json
{
  "title": "multi-cli demo",
  "cliToolId": "claude",
  "agentToolConfigId": "default",
  "workflowDraft": [
    {
      "name": "需求分析",
      "nodeType": "agent",
      "cliToolId": "claude",
      "prompt": "分析需求并输出开发计划"
    },
    {
      "name": "代码实现",
      "nodeType": "agent",
      "cliToolId": "codex",
      "prompt": "根据计划完成代码改造"
    }
  ]
}
```

### 7.2 查询 invocation 列表（建议新增）

- `GET /tasks/:taskId/invocations`
- `GET /tasks/:taskId/nodes/:nodeId/invocations`

> 若已有 task detail 聚合接口，也可先通过 detail 返回，后续再拆独立查询。

---

## 8. 测试计划（可执行）

## 8.1 后端单测

1. `AgentRunnerService`
   - 不同 adapter 配置解析正确。
   - 返回结果统一字段完整。
2. `TasksService`
   - 节点成功时 invocation `running -> succeeded`。
   - 非零退出时 `running -> failed`。
   - 超时时 `running -> timed_out`。
3. `TaskLogEventsService`
   - 三类 invocation 事件 payload 正确。

## 8.2 后端集成

1. 多节点不同 CLI 顺序执行，节点状态推进正确。
2. invocation 记录可按 task/node 查询。
3. SSE 推送 invocation 事件，断连重连后可恢复（基于持久化回放）。

## 8.3 前端单测

1. `TaskCreatePanel` 提交 `workflowDraft` payload 正确。
2. `detail.vue` 接收 invocation 事件后，状态映射正确。
3. `WorkflowCard` 展示最近调用状态/耗时/退出码。

## 8.4 端到端验收

1. 创建 2~3 节点任务（不同 CLI + prompt）。
2. 执行并观察顺序推进。
3. 详情页可见每节点 invocation timeline。
4. 触发失败（超时/exitCode!=0），可见失败事件与摘要。

---

## 9. 风险与控制

1. **兼容性**：老任务缺少节点级 CLI 配置。
   - 方案：节点字段可选，回退任务级默认。
2. **数据体积**：输出日志过大。
   - 方案：只存 preview 截断；原文后续对象存储归档。
3. **改造复杂度**：一次性抽象过深。
   - 方案：先在 `AgentRunnerService` 内统一，不做大规模拆包。

---

## 10. 里程碑与交付物

### M1（后端可观测打通）

- invocation 表 + 仓储 + 事件 + 节点执行接入。
- 可通过 API/SSE 获得调用记录。

### M2（前端可视化）

- detail 页面可按节点查看 invocation timeline。
- WorkflowCard 展示最近调用状态。

### M3（创建体验增强）

- TaskCreatePanel 支持 workflowDraft 多节点提交。
- 多节点多 CLI 创建->执行->观测全链路可用。

---

## 11. 实施顺序（建议）

1. 先做 migration + entity/repository。
2. 再改 `TasksService` 执行流程接入 invocation。
3. 再扩展 `TaskLogEventsService` + SSE 消费。
4. 再改 `detail.vue`/`WorkflowCard` 展示。
5. 最后加 `TaskCreatePanel` 的 workflowDraft 编辑。

> 这样能保证每一步都可验证、可回滚，且尽早看到可观测收益。
