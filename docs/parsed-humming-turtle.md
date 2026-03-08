# Agent 工作流系统架构分析与实现方案

## Context

你的需求演进:
1. **最初**: 调用不同的 agent CLI 执行任务
2. **演进**: 一系列 prompt 连续执行("prompt 流")
3. **现在**: agent CLI 作为工具,每个节点可独立选择 agent,可观测

核心诉求:
- 每个节点控制使用哪个 agent CLI
- 节点间独立(不传递上下文)
- 线性执行(无分支)
- 实时监控 + 事后分析

---

## 当前架构评估

### 已有基础 ✅

**数据结构**:
- `WorkflowTemplate.nodesJson`: JSONB 存储节点配置
- `TaskNode.input/output`: JSONB 存储节点数据
- 完整的调度执行系统(租约、心跳、状态管理)
- AgentRunnerService 支持多种 CLI
- SSE 实时日志流

**关键发现**:
- 不需要新建表!现有 JSONB 字段可以直接扩展
- `WorkflowTemplateNode` 类型定义: `{ nodeOrder, name, type, requiresApproval?, input? }`
- `TaskNode` 实体已有 `input/output` JSONB 字段

### 核心差距 ❌

1. **节点 agent 配置缺失**: `WorkflowTemplateNode` 和 `TaskNode.input` 中没有 agent 相关字段
2. **实时输出流缺失**: agent stdout/stderr 只在完成后可见
3. **执行结果记录不足**: 没有记录 exitCode、duration、使用的 agent CLI

---

## 架构设计方案

### 核心理念

**利用现有 JSONB 字段,无需数据库迁移**:
- `WorkflowTemplateNode` 的 `input` 字段存储 agent 配置
- `TaskNode` 的 `input` 字段存储节点执行配置
- `TaskNode` 的 `output` 字段存储执行结果

### 数据结构设计

#### 1. WorkflowTemplateNode 扩展 (无需改表结构)

```typescript
// 在 input 字段中存储 agent 配置
type WorkflowTemplateNode = {
  nodeOrder: number;
  name: string;
  type: 'agent' | 'manual';
  requiresApproval?: boolean;
  input?: {
    // Agent 配置
    agentConfig?: {
      cliToolId: string;              // 'claude' | 'codex' | 'cursor' | 'gemini' | 'opencode'
      agentToolConfigId?: string;     // 引用 AgentToolConfig
      prompt: string;                 // 节点的 prompt
    };
    // 其他配置...
  };
};
```

#### 2. TaskNode 扩展 (无需改表结构)

```typescript
// input: 从模板复制的配置
// output: 执行结果
{
  input: {
    agentConfig?: {
      cliToolId: string;
      agentToolConfigId?: string;
      prompt: string;
    };
  },
  output: {
    agentResult?: {
      exitCode: number;
      duration: number;        // ms
      stdout: string;
      stderr: string;
      startedAt: string;
      finishedAt: string;
    };
  }
}
```

### 优势分析

**为什么使用 JSONB 而不是新增字段**:
1. ✅ 无需数据库迁移
2. ✅ 灵活扩展,未来可添加更多配置
3. ✅ 保持表结构简洁
4. ✅ 符合现有架构设计模式

---

## 实现方案

### Phase 1: 类型定义和验证

**文件**: `backend/src/workflow-templates/domain/workflow-template.ts`

扩展 `WorkflowTemplateNode` 类型定义:

```typescript
export type AgentConfig = {
  cliToolId: string;
  agentToolConfigId?: string;
  prompt: string;
};

export type WorkflowTemplateNode = {
  nodeOrder: number;
  name: string;
  type: string;
  requiresApproval?: boolean;
  input?: {
    agentConfig?: AgentConfig;
    [key: string]: unknown;
  } | null;
};
```

**文件**: `backend/src/workflow-templates/dto/create-workflow-template.dto.ts`

添加验证逻辑,确保 agent 类型节点包含 agentConfig。

### Phase 2: 节点创建逻辑

**文件**: `backend/src/tasks/tasks.service.ts`

修改从模板创建任务的逻辑,复制 agent 配置:

```typescript
// 创建 TaskNode 时
const taskNode = {
  taskId: task.id,
  nodeOrder: templateNode.nodeOrder,
  name: templateNode.name,
  nodeType: templateNode.type,
  requiresApproval: templateNode.requiresApproval,
  input: templateNode.input, // 直接复制,包含 agentConfig
  status: TaskStatus.todo,
};
```

### Phase 3: Agent 执行逻辑改进

**文件**: `backend/src/tasks/tasks.service.ts`

修改 `executeAgentNode()` 方法:

```typescript
async executeAgentNode(task: Task, node: TaskNode, project: Project) {
  // 从 node.input 读取 agent 配置
  const agentConfig = node.input?.agentConfig;

  if (!agentConfig) {
    throw new Error('Agent config not found in node input');
  }

  const startTime = Date.now();

  // 调用 AgentRunnerService (流式版本)
  const result = await this.agentRunnerService.runStreaming({
    cliToolId: agentConfig.cliToolId,
    agentToolConfigId: agentConfig.agentToolConfigId,
    prompt: agentConfig.prompt,
    task,
    node,
    project,
    onStdout: (data) => {
      this.appendLog(task.id, 'info', data, { nodeId: node.id });
    },
    onStderr: (data) => {
      this.appendLog(task.id, 'error', data, { nodeId: node.id });
    },
  });

  // 更新 node.output
  await this.taskNodeRepository.update(node.id, {
    output: {
      ...node.output,
      agentResult: {
        exitCode: result.exitCode,
        duration: Date.now() - startTime,
        stdout: result.stdout,
        stderr: result.stderr,
        startedAt: new Date(startTime).toISOString(),
        finishedAt: new Date().toISOString(),
      },
    },
  });

  return result;
}
```



---

## 架构设计方案

### 核心设计理念

**将 Agent CLI 定位为"节点执行器"**:
- 每个节点 = 一个独立的执行单元
- 节点配置包含: prompt + agent CLI 选择 + agent 配置
- 节点执行 = 将 prompt 发送给指定的 agent CLI,获取结果
- 节点间完全独立,无上下文传递

这个设计符合你的"prompt 流"概念,同时保持了架构的简洁性。

### 数据模型增强

#### 1. WorkflowTemplateNode 增强

```typescript
// 新增字段
{
  // Agent 配置
  agentToolConfigId?: string;  // 使用哪个 agent 工具配置
  cliToolId?: string;          // 使用哪个 CLI (claude/codex/cursor/gemini/opencode)
  prompt?: string;             // 节点的 prompt 模板

  // 现有字段保持不变
  nodeOrder: number;
  name: string;
  type: 'agent' | 'manual';
  requiresApproval: boolean;
  input?: any;
  output?: any;
}
```

#### 2. TaskNode 增强

```typescript
// 新增字段
{
  // Agent 执行信息
  agentToolConfigId?: string;
  cliToolId?: string;
  prompt?: string;

  // 执行结果
  agentExitCode?: number;
  agentDuration?: number;      // 执行时长(ms)
  agentOutput?: string;        // stdout
  agentError?: string;         // stderr

  // 现有字段保持不变
  nodeOrder: number;
  status: 'todo' | 'inProgress' | 'done' | 'inReview';
  startedAt?: Date;
  finishedAt?: Date;
}
```

### 执行流程优化

#### 当前流程
```
Task 创建 → 生成 TaskNodes → 调度器轮询 →
Worker 认领节点 → executeAgentNode() →
AgentRunnerService.run() → 等待完成 → 更新状态
```

#### 优化后流程
```
Task 创建(从模板) → 复制节点配置(包含 agent 信息) →
调度器轮询 → Worker 认领节点 →
从节点读取 agent 配置 → AgentRunnerService.runStreaming() →
实时流式输出到日志 → 完成后记录执行结果 → 更新状态
```

**关键改进点**:
1. 节点创建时从模板复制 agent 配置
2. 执行时从节点读取配置(不是从 Task)
3. 流式输出 agent 的 stdout/stderr
4. 记录详细的执行结果

---

## 实现方案

### Phase 1: 数据模型迁移

**文件**: `backend/src/migrations/`

创建数据库迁移,为 `workflow_template_nodes` 和 `task_nodes` 表添加字段:
- `agent_tool_config_id` (uuid, nullable)
- `cli_tool_id` (varchar, nullable)
- `prompt` (text, nullable)
- `agent_exit_code` (int, nullable) - 仅 task_nodes
- `agent_duration` (int, nullable) - 仅 task_nodes
- `agent_output` (text, nullable) - 仅 task_nodes
- `agent_error` (text, nullable) - 仅 task_nodes

**关键文件**:
- `backend/src/workflow-templates/domain/workflow-template-node.entity.ts`
- `backend/src/tasks/domain/task-node.entity.ts`

### Phase 2: 节点配置传递

**文件**: `backend/src/tasks/tasks.service.ts`

修改 Task 创建逻辑,从 WorkflowTemplate 创建 Task 时:
- 复制每个模板节点的 agent 配置到 TaskNode
- 包括: `agentToolConfigId`, `cliToolId`, `prompt`

**关键方法**:
- `createTaskFromTemplate()` - 需要增强节点复制逻辑

### Phase 3: Agent 流式执行

**文件**: `backend/src/tasks/agent-runner.service.ts`

增强 AgentRunnerService,支持流式输出:

```typescript
async runStreaming(config: {
  task: Task;
  node: TaskNode;
  project: Project;
  onStdout: (data: string) => void;
  onStderr: (data: string) => void;
}): Promise<AgentRunnerResult>
```

实现要点:
- 使用 `spawn()` 而不是 `exec()`
- 监听 `stdout.on('data')` 和 `stderr.on('data')`
- 每次收到数据立即调用回调函数
- 回调函数将数据写入日志系统

**文件**: `backend/src/tasks/tasks.service.ts`

修改 `executeAgentNode()`:
- 从 TaskNode 读取 agent 配置(不是从 Task)
- 调用 `runStreaming()` 而不是 `run()`
- 在回调中实时写入日志
- 执行完成后记录 exitCode, duration, output, error 到 TaskNode

### Phase 4: 前端工作流视图

**文件**: `frontend/src/views/tasks/TaskDetailView.vue`

增强任务详情页,添加工作流节点视图:
- 显示所有节点的列表(按 nodeOrder 排序)
- 每个节点显示: 名称、状态、使用的 agent CLI、执行时长
- 节点可展开查看详细日志和输出
- 实时更新节点状态(通过 SSE)

**新增组件**: `frontend/src/components/WorkflowNodeList.vue`
- 节点状态图标(待执行/执行中/完成/失败)
- 节点执行时间线
- 点击节点展开详情

**文件**: `frontend/src/api/tasks.ts`
- 添加获取任务节点列表的 API 调用

### Phase 5: 工作流模板编辑器

**文件**: `frontend/src/views/workflow-templates/WorkflowTemplateEditor.vue`

增强模板编辑器,支持配置节点的 agent:
- 为每个节点添加 agent 配置表单
- 选择 agent CLI 类型(下拉框)
- 选择 agent 工具配置(下拉框,从业务线配置加载)
- 输入 prompt 模板(文本框)

---

## 架构权衡分析

### 方案对比

| 维度 | 当前方案(节点级配置) | 替代方案(任务级配置) |
|------|---------------------|---------------------|
| **灵活性** | ✅ 每个节点可用不同 agent | ❌ 所有节点用同一个 agent |
| **复杂度** | ⚠️ 需要迁移数据模型 | ✅ 无需改动数据模型 |
| **可维护性** | ✅ 配置清晰,易于理解 | ⚠️ 限制了使用场景 |
| **性能** | ✅ 无额外开销 | ✅ 无额外开销 |
| **扩展性** | ✅ 支持未来的复杂场景 | ❌ 难以支持混合 agent 工作流 |

**推荐**: 节点级配置方案,因为:
1. 符合"agent CLI 作为工具"的理念
2. 支持未来可能的复杂场景(如:用 claude 分析代码 → 用 cursor 修改代码)
3. 数据模型改动不大,风险可控

### 关于"上下文传递"的设计决策

你明确表示"不需要知道上一个节点 agent CLI 的上下文",这个决策有重要影响:

**优点**:
- 架构简单,节点完全独立
- 易于并行执行(未来扩展)
- 易于调试和重试单个节点

**局限**:
- 无法实现"分析 → 修改"这样的协作流程
- 每个节点必须自包含所有信息

**建议**:
- 当前保持节点独立
- 未来如需上下文传递,可通过以下方式扩展:
  - 在 prompt 中使用变量引用: `${node1.output}`
  - 添加 `contextStrategy` 字段: `none` | `previous` | `all`
  - 在执行时动态解析变量

---

## 实现优先级

### MVP (最小可行产品)

**目标**: 实现基本的节点级 agent 配置和执行

1. ✅ 数据模型迁移(Phase 1)
2. ✅ 节点配置传递(Phase 2)
3. ✅ 从节点读取 agent 配置执行(Phase 3 部分)
4. ✅ 基础前端展示(Phase 4 简化版)

**预计工作量**: 2-3 天

**验证标准**:
- 可以在模板中为每个节点配置不同的 agent CLI
- 创建任务时节点配置正确复制
- 节点执行时使用正确的 agent CLI
- 前端可以看到每个节点的状态和使用的 agent

### V2 (增强版)

**目标**: 实时观测和更好的用户体验

1. ✅ Agent 流式输出(Phase 3 完整)
2. ✅ 增强的前端工作流视图(Phase 4 完整)
3. ✅ 工作流模板编辑器(Phase 5)

**预计工作量**: 3-4 天

**验证标准**:
- 可以实时看到 agent 的输出
- 前端有完整的工作流执行时间线
- 可以在 UI 中创建和编辑工作流模板

### V3 (未来扩展)

**可选功能**:
- 节点间上下文传递(变量引用)
- 条件分支支持
- 节点并行执行
- 节点取消和重试
- 工作流可视化编辑器(拖拽式)

---

## 关键技术细节

### 1. Agent 流式输出实现

```typescript
// agent-runner.service.ts
async runStreaming(config: RunStreamingConfig): Promise<AgentRunnerResult> {
  const startTime = Date.now();
  const process = spawn(command, args, { cwd, env });

  let stdout = '';
  let stderr = '';

  process.stdout.on('data', (data) => {
    const text = data.toString();
    stdout += text;
    config.onStdout(text); // 实时回调
  });

  process.stderr.on('data', (data) => {
    const text = data.toString();
    stderr += text;
    config.onStderr(text); // 实时回调
  });

  return new Promise((resolve) => {
    process.on('close', (code) => {
      resolve({
        success: code === 0,
        exitCode: code,
        stdout,
        stderr,
        duration: Date.now() - startTime,
      });
    });
  });
}
```

### 2. 节点执行改进

```typescript
// tasks.service.ts
async executeAgentNode(task: Task, node: TaskNode, project: Project) {
  // 从节点读取 agent 配置
  const agentConfig = {
    agentToolConfigId: node.agentToolConfigId,
    cliToolId: node.cliToolId,
    prompt: node.prompt,
  };

  const startTime = Date.now();

  // 流式执行
  const result = await this.agentRunnerService.runStreaming({
    task,
    node,
    project,
    config: agentConfig,
    onStdout: (data) => {
      this.appendLog(task.id, 'info', data, { nodeId: node.id });
    },
    onStderr: (data) => {
      this.appendLog(task.id, 'error', data, { nodeId: node.id });
    },
  });

  // 更新节点执行结果
  await this.taskNodeRepository.update(node.id, {
    agentExitCode: result.exitCode,
    agentDuration: result.duration,
    agentOutput: result.stdout,
    agentError: result.stderr,
  });

  return result;
}
```

### 3. 前端实时更新

```typescript
// frontend/src/composables/useTaskStream.ts
export function useTaskStream(taskId: string) {
  const logs = ref<TaskLog[]>([]);
  const nodes = ref<TaskNode[]>([]);

  const eventSource = new EventSource(`/api/tasks/${taskId}/stream`);

  eventSource.addEventListener('task-log', (event) => {
    const log = JSON.parse(event.data);
    logs.value.push(log);

    // 更新对应节点的状态
    if (log.payload?.nodeId) {
      updateNodeStatus(log.payload.nodeId);
    }
  });

  return { logs, nodes };
}
```

---

## 验证计划

### 端到端测试场景

**场景**: 创建一个包含 3 个节点的工作流

1. **节点 1**: 使用 Claude 分析代码质量
   - Agent: claude
   - Prompt: "分析 src/main.ts 的代码质量"

2. **节点 2**: 使用 Cursor 生成测试
   - Agent: cursor
   - Prompt: "为 src/main.ts 生成单元测试"

3. **节点 3**: 使用 Codex 生成文档
   - Agent: codex
   - Prompt: "为 src/main.ts 生成 API 文档"

**验证步骤**:
1. 在模板编辑器中创建上述工作流模板
2. 从模板创建任务
3. 观察任务执行:
   - 节点按顺序执行
   - 每个节点使用正确的 agent CLI
   - 可以实时看到每个节点的输出
   - 节点状态正确更新
4. 执行完成后:
   - 查看每个节点的执行结果
   - 验证 exitCode, duration 等字段正确记录
   - 可以回放执行过程

---

## 总结与建议

### 你的需求本质

你想要的不是"重新设计工作流系统",而是**增强现有系统的灵活性和可观测性**:

1. **已有**: 完整的工作流基础设施(模板、任务、节点、调度、执行)
2. **缺少**: 节点级别的 agent 配置 + 实时输出流
3. **目标**: 让每个节点可以独立选择 agent CLI,并实时观察执行过程

### 推荐实现路径

**阶段 1 (MVP)**: 节点级 Agent 配置
- 数据模型迁移(添加字段)
- 修改节点创建逻辑(复制配置)
- 修改节点执行逻辑(读取配置)
- 基础前端展示

**阶段 2 (增强)**: 实时观测
- Agent 流式输出
- 增强的前端工作流视图
- 模板编辑器改进

**阶段 3 (可选)**: 高级功能
- 上下文传递(变量引用)
- 条件分支
- 并行执行

### 关键决策点

1. **节点独立性**: 你选择了节点间不传递上下文,这简化了架构,但限制了某些场景。建议保留扩展空间。

2. **Agent 定位**: 将 agent CLI 定位为"节点执行器"而非"工具",这符合当前架构,实现成本低。

3. **实时性**: 流式输出是关键体验改进,建议优先实现。

### 风险与注意事项

1. **数据迁移**: 需要仔细测试,确保现有数据不受影响
2. **向后兼容**: 新字段都是可选的,不影响现有功能
3. **性能**: 流式输出会增加日志量,需要考虑日志清理策略
4. **并发**: 当前架构已支持分布式执行,无需额外改动

---

## 关键文件清单

### 后端
- `backend/src/workflow-templates/domain/workflow-template-node.entity.ts`
- `backend/src/tasks/domain/task-node.entity.ts`
- `backend/src/tasks/tasks.service.ts`
- `backend/src/tasks/agent-runner.service.ts`
- `backend/src/migrations/` (新增迁移文件)

### 前端
- `frontend/src/views/tasks/TaskDetailView.vue`
- `frontend/src/views/workflow-templates/WorkflowTemplateEditor.vue`
- `frontend/src/components/WorkflowNodeList.vue` (新增)
- `frontend/src/composables/useTaskStream.ts` (新增或增强)
- `frontend/src/api/tasks.ts`

### 优势分析

**为什么使用 JSONB**:
1. ✅ 无需数据库迁移
2. ✅ 灵活扩展
3. ✅ 保持表结构简洁
4. ✅ 符合现有设计模式

---

## 实现方案

### Phase 1: 类型定义

**文件**: `backend/src/workflow-templates/domain/workflow-template.ts`

```typescript
export type AgentConfig = {
  cliToolId: string;
  agentToolConfigId?: string;
  prompt: string;
};

export type WorkflowTemplateNode = {
  nodeOrder: number;
  name: string;
  type: string;
  requiresApproval?: boolean;
  input?: {
    agentConfig?: AgentConfig;
    [key: string]: unknown;
  } | null;
};
```

### Phase 2: 节点创建

**文件**: `backend/src/tasks/tasks.service.ts`

从模板创建任务时,直接复制 `input` 字段(包含 agentConfig)。

### Phase 3: 执行逻辑改进

**文件**: `backend/src/tasks/tasks.service.ts`

修改 `executeAgentNode()`:
- 从 `node.input.agentConfig` 读取配置
- 调用 `AgentRunnerService.runStreaming()`
- 将结果写入 `node.output.agentResult`

### Phase 4: 流式输出

**文件**: `backend/src/tasks/agent-runner.service.ts`

添加 `runStreaming()` 方法:
- 使用 `spawn()` 启动进程
- 监听 `stdout/stderr` 的 `data` 事件
- 实时调用回调函数写入日志

### Phase 5: 前端展示

**文件**: `frontend/src/views/tasks/TaskDetailView.vue`

添加节点列表视图:
- 显示所有节点及状态
- 显示使用的 agent CLI
- 显示执行时长
- 可展开查看日志

**新增**: `frontend/src/components/WorkflowNodeList.vue`

---

## 验证计划

### 测试场景

创建 3 节点工作流:
1. Claude 分析代码
2. Cursor 生成测试
3. Codex 生成文档

### 验证步骤

1. 创建模板,每个节点配置不同 agent
2. 从模板创建任务
3. 观察执行:
   - 节点按顺序执行
   - 使用正确的 agent CLI
   - 实时看到输出
4. 检查结果:
   - `node.output.agentResult` 包含完整信息
   - exitCode, duration 正确记录

---

## 总结

### 核心改进

1. **利用 JSONB**: 无需迁移,直接扩展
2. **节点级配置**: 每个节点独立选择 agent
3. **流式输出**: 实时观察执行过程
4. **完整记录**: output 存储详细结果

### 实现路径

**MVP (2-3天)**:
- 类型定义
- 节点配置传递
- 基础执行逻辑
- 简单前端展示

**V2 (3-4天)**:
- 流式输出
- 增强前端视图
- 模板编辑器

### 关键文件

**后端**:
- `backend/src/workflow-templates/domain/workflow-template.ts`
- `backend/src/tasks/tasks.service.ts`
- `backend/src/tasks/agent-runner.service.ts`

**前端**:
- `frontend/src/views/tasks/TaskDetailView.vue`
- `frontend/src/components/WorkflowNodeList.vue` (新增)
