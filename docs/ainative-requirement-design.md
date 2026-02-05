# AINative 需求设计文档（结构化版）

## 1. 概述

### 1.1 项目背景
随着 AI Agent 技术的成熟，研发团队需要一个统一平台来管理和执行 Agent 驱动的任务，避免各团队重复建设、能力分散。

### 1.2 目标
建设 AINative 平台，通过 Agent CLI 执行任务，实现"任务-项目-流水线-知识"的统一管理与可观测。

### 1.3 核心价值
| 价值维度 | 描述 | 量化目标 |
|---------|------|---------|
| 效率提升 | 降低任务交付成本 | 任务创建到产出时间减少 50% |
| 质量保障 | 提升执行质量与可追溯性 | 任务成功率 > 90% |
| 能力复用 | 统一多 Agent 能力的复用与治理 | Skills/MCP 复用率 > 60% |

## 2. 目标用户与核心场景

### 2.1 用户角色
| 角色 | 职责 | 核心诉求 |
|------|------|---------|
| 研发人员 | 创建并执行任务，查看日志与产物 | 快速完成任务、清晰的执行反馈 |
| 项目负责人 | 配置项目、管理任务、调优流水线 | 项目进度可控、资源合理分配 |
| 平台管理员 | 配置全局模板、Skills/MCP 市场、权限与审计 | 平台稳定、安全合规 |

### 2.2 用户故事
**US-001 研发人员创建任务**
> 作为研发人员，我希望选择流水线模板并填写验收标准来创建任务，以便 Agent 能明确产出目标。
> - 验收标准：任务创建后状态为 Draft，包含模板快照和验收 Checklist。

**US-002 研发人员查看执行结果**
> 作为研发人员，我希望实时查看任务执行日志和产物，以便及时了解进度和排查问题。
> - 验收标准：日志流式输出延迟 < 3s，产物支持在线预览。

**US-003 项目负责人配置项目**
> 作为项目负责人，我希望配置项目使用的 Agent 和 Skills，以便控制项目的执行能力边界。
> - 验收标准：配置变更即时生效，历史配置可追溯。

### 2.3 典型场景流程
```mermaid
flowchart LR
  A[创建业务线与项目] --> B[配置 Agent/Skills/MCP]
  B --> C[创建任务]
  C --> D[选择流水线模板]
  D --> E[Agent CLI 执行]
  E --> F[产物与预览]
  F --> G[通知完成]
```

## 3. 范围（Scope）

### 3.1 MVP 范围
| 模块 | 功能点 | 优先级 |
|------|--------|--------|
| 全局配置 | 流水线模板、Skills/MCP 市场与管理 | P0 |
| 业务线 | 增删改查与项目归属 | P0 |
| 用户管理 | 增删改查、业务线归属、项目权限 | P0 |
| 项目 | 增删改查、Git 地址、项目配置（Agent/Skills/MCP）、知识库（非 RAG） | P0 |
| 任务 | 详情、通知、文件预览、部署预览 | P0 |
| 流水线 | 节点与依赖、基础可视化编辑 | P0 |
| Agent CLI | 对话展示、统一入口、支持 Codex/Cursor/Claude | P0 |
| 执行与调度 | 触发、队列、并发、重试与超时 | P1 |
| 运行时与资源 | 环境规格、隔离与配额 | P1 |
| 权限与身份 | 登录/认证、RBAC、审计日志 | P0 |
| 可观测性 | 状态、指标、告警、结构化日志 | P1 |
| 产物与版本 | 存储、生命周期、版本回溯 | P1 |
| API 与 UI | 核心 API 列表与关键页面 | P0 |

### 3.2 非范围（明确排除）
| 排除项 | 原因 | 后续规划 |
|--------|------|---------|
| 深度 RAG 知识库 | 技术复杂度高，MVP 先用简单文档管理 | Phase 2 |
| 高复杂度编排 DSL | 用户学习成本高，先用可视化编辑 | Phase 3 |
| 全自动 CI/CD 替代 | 定位不同，AINative 聚焦 Agent 任务 | 不规划 |

## 4. 需求合理性与可实现性评估

### 4.1 评估结论
现有需求整体合理、可实现，建议分阶段落地。

| 模块 | 需求合理性 | 可实现性 | 风险等级 | 备注 |
|------|-----------|---------|---------|------|
| 全局配置（模板/市场） | 高 | 高 | 低 | 常见后台配置能力 |
| 业务线管理 | 高 | 高 | 低 | 业务组织模型基础能力 |
| 用户管理与权限 | 高 | 中 | 中 | 需明确 RBAC 与审计边界 |
| 项目管理与配置 | 高 | 高 | 低 | 与 Git 和 Agent 关联清晰 |
| 任务与流水线 | 高 | 中 | 中 | 需明确状态机与重试策略 |
| Agent CLI 统一入口 | 高 | 中 | 高 | 多 Agent 适配需规范接口 |
| 执行与调度 | 高 | 中 | 中 | 需要队列与并发治理策略 |
| 运行时与资源隔离 | 高 | 中 | 高 | 容器化可落地，需成本评估 |
| 可观测性与监控 | 高 | 中 | 中 | 依赖日志与指标体系建设 |
| 产物与版本追踪 | 中 | 中 | 中 | 需定义产物元数据与存储方案 |
| API 与 UI | 高 | 高 | 低 | 常规平台开发能力 |

### 4.2 分阶段落地计划
```mermaid
gantt
    title AINative MVP 落地计划
    dateFormat  YYYY-MM-DD
    section 第一阶段
    项目/任务/流水线核心闭环    :a1, 2025-01-01, 30d
    Agent CLI 基础集成          :a2, after a1, 20d
    基础权限与认证              :a3, 2025-01-01, 25d
    section 第二阶段
    调度与队列                  :b1, after a2, 20d
    监控与可观测                :b2, after b1, 15d
    产物与版本管理              :b3, after b1, 15d
    通知与审计                  :b4, after b2, 10d
    section 第三阶段
    Skills/MCP 市场             :c1, after b4, 25d
    高级编排能力                :c2, after c1, 20d
```

### 4.3 阶段交付目标
| 阶段 | 核心交付 | 验收标准 |
|------|---------|---------|
| 第一阶段 | 项目/任务/流水线/Agent CLI 核心闭环 + 基础权限 | 能完成一个完整任务的创建→执行→产出流程 |
| 第二阶段 | 调度、监控、产物与版本、通知与审计 | 支持并发任务调度，执行过程可观测 |
| 第三阶段 | 市场生态（Skills/MCP）与更高级编排 | Skills/MCP 可安装复用，流水线支持复杂 DAG |

## 5. 模块关联关系
### 5.1 关系说明（文本版）
- 业务线包含多个项目，用户归属业务线。
- 项目绑定 Git 地址、配置 Agent CLI、Skills/MCP 与知识库。
- 任务归属项目，选择流水线模板并由 Agent CLI 执行。
- 流水线由多个节点组成，节点调用 Skills/MCP 或 Agent。
- 执行产生产物与日志，进入可观测与通知模块。
- 权限体系贯穿业务线、项目与任务的访问与执行。

### 5.2 关系示意图（Mermaid）
```mermaid
flowchart LR
  BL["业务线"] --> P["项目"]
  U["用户"] --> BL
  P --> T["任务"]
  T --> PL["流水线"]
  PL --> N["节点"]
  N --> A["Agent CLI"]
  N --> S["Skills"]
  N --> M["MCP"]
  T --> ART["产物/日志"]
  ART --> OBS["可观测/通知"]
  U --> R["权限/RBAC"]
  R --> P
  R --> T
```

## 6. 逻辑架构设计图（Mermaid）
```mermaid
flowchart TB
  subgraph UI["UI层"]
    UI1["任务/项目/权限管理"]
    UI2["日志与产物预览"]
  end

  subgraph API["API层"]
    API1["用户/业务线/项目/任务 API"]
    API2["流水线/Skills/MCP API"]
    API3["监控/审计/通知 API"]
  end

  subgraph CORE["核心服务层"]
    CORE1["任务与流水线编排"]
    CORE2["Agent 适配层"]
    CORE3["调度与队列"]
    CORE4["权限与审计"]
    CORE5["产物与版本管理"]
  end

  subgraph RUNTIME["执行与运行时"]
    RT1["Agent CLI 执行器"]
    RT2["Sandbox/容器"]
  end

  subgraph DATA["数据层"]
    DB["元数据存储"]
    OBJ["产物存储"]
    LOG["日志/指标"]
  end

  UI1 --> API1
  UI2 --> API3
  API1 --> CORE1
  API2 --> CORE1
  API3 --> CORE4
  CORE1 --> CORE2
  CORE1 --> CORE3
  CORE2 --> RT1
  RT1 --> RT2
  CORE5 --> OBJ
  CORE1 --> DB
  CORE3 --> LOG
  CORE4 --> DB
```

## 7. 功能需求（更清晰拆解）
本节把平台能力按“域/模块”拆解，并用统一结构描述：目标 / 核心对象 / MVP 功能 / 关键规则与边界 / 依赖 / 产出。

### 7.1 身份与权限域（Auth/RBAC/Audit）
- 目标：保证平台访问安全、权限可控、操作可追溯。
- 核心对象
  - 用户（User）：账号、状态、归属业务线
  - 角色（Role）：平台/业务线/项目/任务四个范围
  - 授权（Membership）：用户-项目-角色绑定
  - 审计日志（AuditLog）
- MVP 功能
  1. 登录/认证：账号登录（可扩展 SSO/LDAP），发放 Token/Session。
  2. 用户管理：新增/编辑/禁用/删除（删除建议软删除）。
  3. 用户归属业务线：绑定/变更业务线归属（需要权限控制）。
  4. 项目权限：项目成员管理（添加/移除/变更角色）；成员权限影响任务查看/执行/配置。
  5. 审计日志：记录关键资源（项目、任务、配置、密钥、执行、产物）的操作与访问。
- 关键规则与边界
  - 业务线归属建议 MVP 先做“单业务线归属”，否则权限模型复杂度显著上升。
  - 默认最小权限：未授权用户不可见/不可执行；权限变更可追踪。
- 依赖：无（基础域，其他模块全部依赖）。
- 产出：用户/角色/授权数据；审计事件流。

### 7.2 组织与项目域（BusinessLine/Project）
- 目标：为任务执行提供组织结构、代码入口与项目级配置。
- 核心对象：业务线（BusinessLine）、项目（Project）、项目成员（ProjectMember）、项目配置（ProjectConfig）、Git 仓库信息。
- MVP 功能
  1. 业务线管理：CRUD；配置业务线负责人。
  2. 项目管理：CRUD（项目名称、Git 地址、默认分支）；项目归属业务线。
  3. 项目成员与权限：项目级成员管理（依赖 7.1 的 RBAC）。
  4. 项目配置（建议按“配置项组”呈现，降低理解成本）
     - Agent CLI 配置：使用哪种 Agent（Codex/Cursor/Claude）、运行模式（本地/远程）、权限开关（网络/文件系统）。
     - Skills/MCP 白名单：项目允许使用哪些 Skills/MCP（绑定版本）。
     - 资源与并发策略：并发上限、优先级（默认继承全局）。
  5. 知识库（非 RAG）：文档上传/分类/版本；可绑定到项目或任务（用于执行上下文）。
- 关键规则与边界
  - Git 地址与认证方式必须明确（HTTP(S)/SSH、Token/Key 存储策略）；建议 MVP 先支持一种稳定方案。
- 依赖：身份与权限域（7.1）。
- 产出：项目配置快照（用于任务执行时可复现）；知识库文档元数据。

### 7.3 资产与市场域（Template/Skills/MCP）
- 目标：沉淀可复用能力（模板、技能、外部工具连接），降低重复劳动并实现治理。
- 核心对象：流水线模板（PipelineTemplate）、Skill、MCP Connector、版本（Version）。
- MVP 功能
  1. 流水线模板：全局模板 CRUD、启用/禁用、版本；项目选择可用模板集合。
  2. Skills 市场：浏览/搜索/详情；安装到项目（绑定版本）；项目内启用/禁用。
  3. MCP 市场：浏览/搜索/详情；安装到项目并配置参数（含密钥）。
- 关键规则与边界
  - 版本锁定：任务运行时必须记录使用的模板/Skill/MCP 版本，保证可复现与可回滚。
  - 使用授权：成员是否能执行某个 Skill/MCP 需要与项目权限联动（避免越权使用高风险工具）。
- 依赖：项目域（7.2）、权限域（7.1）、密钥管理（见第 10 节安全要求）。
- 产出：可复用资产目录；项目安装清单（含版本）。

### 7.4 任务与流水线域（Task/Pipeline）
- 目标：把“需求”变成可执行的流水线实例，并能追踪每一步结果与责任边界。
- 核心对象：任务（Task）、流水线实例（PipelineRun）、节点实例（NodeRun）、输入输出（IO）、执行记录（RunLog）。
- MVP 功能
  1. 任务管理
     - 创建任务：标题、描述、验收标准、关联项目、选择模板、可选分支/环境
     - 查询与详情：状态、节点拓扑、日志、产物、执行历史
  2. 流水线实例化
     - 从模板生成一次运行实例（PipelineRun）
     - 节点依赖与执行顺序（DAG）
     - 节点级输入输出传递（至少支持“产物链接/变量”两类）
  3. 节点类型（建议 MVP 最少落地 2 类，便于形成闭环）
     - Agent 执行节点：基于对话/指令执行
     - Skill 执行节点：复用脚本/流程片段
     - MCP 调用节点：调用外部工具/服务（可选）
     - 人工确认节点：发布/合并前拦截（可选）
  4. 任务操作：执行、取消、重试（更细状态见第 8 节）。
  5. 流水线模板编辑（基础）：节点增删改、依赖关系编辑、模板版本发布。
- 关键规则与边界
  - 节点输入输出必须规范化（字段名、类型、是否敏感），否则编排与复用会失控。
  - 任务“验收标准”建议作为结构化字段（可选：Checklist），便于 Agent 更稳定地产出结果。
- 依赖：项目域（7.2）、资产域（7.3）、执行与调度（7.5）、可观测与产物（7.6）。
- 产出：可追踪的执行链路（任务→流水线→节点→日志/产物）。

### 7.5 执行与调度域（Scheduler/Runtime/Git/Sandbox）
- 目标：可靠、可控地运行流水线节点，解决并发、隔离、成本与安全问题。
- 核心对象：执行请求（ExecutionRequest）、队列（Queue）、执行器（Executor）、运行环境（Runtime）、worktree、资源配额（Quota）。
- MVP 功能
  1. 触发方式：手动触发（必须）；定时/事件触发（可选）。
  2. 队列与并发
     - 全局并发上限
     - 项目级并发上限
     - 优先级（紧急/普通/低）与排队策略
     - 取消与超时
  3. 运行时与隔离
     - 任务级 sandbox（容器/隔离目录）
     - 资源配额：CPU/内存/磁盘/运行超时
     - 网络访问策略：默认最小化，按项目白名单放开
  4. Git worktree（建议 MVP 默认开启）
     - 每次任务创建独立 worktree
     - 记录 branch/commit 信息
     - 清理策略：成功自动清理；失败保留一段时间用于排障
  5. 失败处理：按错误类型重试；超时标记；回滚（MVP 可先做“停止并保留现场”）。
- 关键规则与边界
  - sandbox 安全边界必须明确：若不能完全隔离网络/文件系统，需要明确限制并在 UI 提示风险。
- 依赖：项目配置（7.2）、权限（7.1）、Agent 适配（与第 6 节架构一致）。
- 产出：可复现的运行记录（环境、版本、输入输出）；可治理的调度数据。

### 7.6 产物、可观测与通知域（Artifacts/Observability/Notification）
- 目标：让任务结果“看得见、拿得到、追得回”，并及时通知相关人。
- 核心对象：日志流（LogStream）、指标（Metrics）、产物（Artifact）、预览链接（PreviewLink）、通知事件（NotificationEvent）。
- MVP 功能
  1. 日志：流式输出、按节点聚合、支持检索与下载。
  2. 产物
     - 文件产物：压缩包/目录/关键文件
     - 代码变更：diff、提交信息
     - 报告类产物：摘要、测试结果、发布说明
  3. 预览
     - 文件预览：diff、文件树
     - 部署预览：产出预览链接/环境地址（可选）
  4. 指标：成功率、耗时、队列长度、资源使用（MVP 可先做基础指标）。
  5. 通知：成功/失败/超时/需人工介入；支持邮件/IM/Webhook；支持去重与频率限制。
- 关键规则与边界
  - 产物生命周期（保留期/清理策略/访问控制/是否加密）需要在项目或全局可配置。
- 依赖：执行与调度（7.5）、权限（7.1）、数据层（日志/产物存储）。
- 产出：可观测数据（日志/指标）与可交付产物。

### 7.7 MVP 功能清单（带优先级与依赖）

| 编号 | 功能 | 优先级 | 依赖 | 阶段 |
|------|------|--------|------|------|
| FR-001 | 登录/认证（账号体系） | P0 | - | 1 |
| FR-002 | 用户 CRUD + 禁用/启用 | P0 | FR-001 | 1 |
| FR-003 | 业务线 CRUD + 负责人 | P0 | FR-001 | 1 |
| FR-004 | 项目 CRUD（含 Git 地址/默认分支/归属业务线） | P0 | FR-003 | 1 |
| FR-005 | 项目成员与角色授权 | P1 | FR-002, FR-004 | 1 |
| FR-006 | 项目配置（Agent/Skills/MCP/资源与并发策略） | P0 | FR-004 | 1 |
| FR-007 | 流水线模板 CRUD + 版本 + 项目选择 | P0 | FR-004 | 1 |
| FR-008 | 任务创建（选择模板，填写验收标准） | P0 | FR-004, FR-007 | 1 |
| FR-009 | 任务触发执行（手动）+ 取消/重试 | P0 | FR-008 | 1 |
| FR-010 | 节点执行（至少支持 Agent 节点与日志流式展示） | P0 | FR-009 | 1 |
| FR-011 | 产物列表 + 文件预览（diff/文件树） | P1 | FR-010 | 2 |
| FR-012 | 通知（成功/失败/超时） | P1 | FR-010 | 2 |
| FR-013 | 队列与并发（基础：全局+项目上限） | P1 | FR-009 | 2 |
| FR-014 | sandbox/worktree（基础隔离 + 清理策略） | P1 | FR-010 | 2 |
| FR-015 | 审计日志（关键操作/访问/执行） | P2 | FR-001 | 2 |

**依赖关系图：**
```mermaid
flowchart LR
    FR001[FR-001 认证] --> FR002[FR-002 用户]
    FR001 --> FR003[FR-003 业务线]
    FR003 --> FR004[FR-004 项目]
    FR002 --> FR005[FR-005 成员授权]
    FR004 --> FR005
    FR004 --> FR006[FR-006 项目配置]
    FR004 --> FR007[FR-007 流水线模板]
    FR004 --> FR008[FR-008 任务创建]
    FR007 --> FR008
    FR008 --> FR009[FR-009 任务执行]
    FR009 --> FR010[FR-010 节点执行]
    FR010 --> FR011[FR-011 产物预览]
    FR010 --> FR012[FR-012 通知]
    FR009 --> FR013[FR-013 队列并发]
    FR010 --> FR014[FR-014 sandbox]
    FR001 --> FR015[FR-015 审计日志]
```

## 8. 状态机与错误分类

### 8.1 任务状态机
```mermaid
stateDiagram-v2
    [*] --> Draft: 创建任务
    Draft --> Ready: 提交任务
    Ready --> Queued: 进入队列
    Queued --> Running: 调度执行
    Running --> Succeeded: 执行成功
    Running --> Failed: 执行失败
    Running --> Timeout: 执行超时
    Running --> Paused: 暂停
    Running --> WaitingInput: 等待输入
    Paused --> Running: 恢复
    WaitingInput --> Running: 输入完成
    Draft --> Canceled: 取消
    Ready --> Canceled: 取消
    Queued --> Canceled: 取消
    Running --> Canceled: 取消
    Paused --> Canceled: 取消
```

| 状态 | 触发事件 | 守卫条件 | 副作用 |
|------|---------|---------|--------|
| Draft → Ready | 用户提交 | 必填字段完整、模板有效 | 生成流水线实例 |
| Ready → Queued | 系统调度 | 无阻塞依赖 | 加入执行队列 |
| Queued → Running | 调度器分配 | 资源可用、并发未满 | 创建 sandbox/worktree |
| Running → Succeeded | 所有节点成功 | 无 | 发送成功通知、归档产物 |
| Running → Failed | 任一节点失败 | 重试次数耗尽 | 发送失败通知、保留现场 |
| Running → Timeout | 超时触发 | 超过配置时限 | 强制终止、发送通知 |

### 8.2 流水线/节点状态机
```mermaid
stateDiagram-v2
    direction LR
    [*] --> NotStarted
    NotStarted --> Running: 开始执行
    Running --> Succeeded: 全部节点成功
    Running --> Failed: 存在节点失败
    Running --> Canceled: 用户取消
```

**节点状态：**
| 状态 | 说明 |
|------|------|
| Pending | 等待前置节点完成 |
| Running | 正在执行 |
| Succeeded | 执行成功 |
| Failed | 执行失败 |
| Skipped | 条件不满足跳过 |
| Blocked | 被依赖阻塞 |

### 8.3 错误分类与处理策略
| 错误类型 | 错误码前缀 | 是否可重试 | 处理策略 |
|---------|-----------|-----------|---------|
| 配置错误 | CFG_ | 否 | 提示用户修正配置 |
| 权限错误 | AUTH_ | 否 | 提示权限不足 |
| 环境错误 | ENV_ | 是（延迟） | 等待环境恢复后重试 |
| 资源不足 | RES_ | 是（延迟） | 排队等待资源释放 |
| 网络错误 | NET_ | 是（立即） | 指数退避重试 |
| Agent 错误 | AGENT_ | 是（有限） | 最多重试 3 次 |
| 执行错误 | EXEC_ | 否 | 记录日志、人工介入 |
| 用户输入错误 | INPUT_ | 否 | 提示用户修正输入 |
| 超时 | TIMEOUT_ | 是（有限） | 可配置是否自动重试 |
| 未知错误 | UNKNOWN_ | 否 | 记录详细日志、告警 |

## 9. 数据模型

### 9.1 ER 图
```mermaid
erDiagram
    User ||--o{ Membership : has
    User }o--|| BusinessLine : belongs_to
    BusinessLine ||--o{ Project : contains
    Project ||--o{ Membership : has
    Project ||--o{ Task : contains
    Project ||--o{ ProjectConfig : has
    Project ||--o{ KnowledgeDoc : has
    Task ||--|| PipelineRun : creates
    Task }o--|| PipelineTemplate : uses
    PipelineRun ||--o{ NodeRun : contains
    NodeRun ||--o{ Artifact : produces
    NodeRun ||--o{ LogStream : generates
    Skill ||--o{ ProjectSkill : installed_in
    Project ||--o{ ProjectSkill : has
    MCP ||--o{ ProjectMCP : installed_in
    Project ||--o{ ProjectMCP : has

    User {
        uuid id PK
        string username UK
        string email UK
        string password_hash
        enum status
        uuid business_line_id FK
        timestamp created_at
        timestamp updated_at
    }

    BusinessLine {
        uuid id PK
        string name
        uuid owner_id FK
        timestamp created_at
        timestamp updated_at
    }

    Project {
        uuid id PK
        string name
        uuid business_line_id FK
        string git_url
        string default_branch
        timestamp created_at
        timestamp updated_at
    }

    Task {
        uuid id PK
        uuid project_id FK
        string title
        text description
        jsonb acceptance_criteria
        uuid template_id FK
        enum status
        string branch
        timestamp created_at
        timestamp updated_at
    }

    PipelineRun {
        uuid id PK
        uuid task_id FK
        jsonb template_snapshot
        enum status
        timestamp started_at
        timestamp finished_at
    }

    NodeRun {
        uuid id PK
        uuid pipeline_run_id FK
        string node_type
        enum status
        jsonb input
        jsonb output
        timestamp started_at
        timestamp finished_at
    }

    Artifact {
        uuid id PK
        uuid node_run_id FK
        string type
        string s3_key
        int size
        timestamp created_at
        timestamp expires_at
    }
```

### 9.2 TypeORM 实体定义示例

**用户实体：**
```typescript
// src/modules/user/entities/user.entity.ts

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @ManyToOne(() => BusinessLine)
  @JoinColumn({ name: 'business_line_id' })
  businessLine: BusinessLine;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

**任务实体：**
```typescript
// src/modules/task/entities/task.entity.ts

export enum TaskStatus {
  DRAFT = 'draft',
  READY = 'ready',
  QUEUED = 'queued',
  RUNNING = 'running',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  CANCELED = 'canceled',
}

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('jsonb', { name: 'acceptance_criteria', default: [] })
  acceptanceCriteria: string[];

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.DRAFT })
  status: TaskStatus;

  @Column({ nullable: true })
  branch: string;

  @ManyToOne(() => Project, (project) => project.tasks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => PipelineTemplate)
  @JoinColumn({ name: 'template_id' })
  template: PipelineTemplate;

  @OneToOne(() => PipelineRun, (run) => run.task, { cascade: true })
  pipelineRun: PipelineRun;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### 9.3 核心实体字段说明
| 实体 | 核心字段 | PostgreSQL 索引 |
|------|---------|----------------|
| User | id, username, email, status, business_line_id | `UNIQUE(username)`, `UNIQUE(email)` |
| Project | id, name, business_line_id, git_url | `INDEX(business_line_id)`, `INDEX(name)` |
| Task | id, project_id, status, created_at | `INDEX(project_id, status)`, `INDEX(created_at DESC)` |
| PipelineRun | id, task_id, status | `UNIQUE(task_id)`, `INDEX(status)` |
| NodeRun | id, pipeline_run_id, status | `INDEX(pipeline_run_id)`, `INDEX(status)` |
| Artifact | id, node_run_id, type, expires_at | `INDEX(node_run_id)`, `INDEX(expires_at)` |

### 9.4 数据库迁移

使用 TypeORM 迁移管理数据库变更：

```bash
# 生成迁移
pnpm --filter backend typeorm migration:generate -n CreateTaskTable

# 运行迁移
pnpm --filter backend typeorm migration:run

# 回滚迁移
pnpm --filter backend typeorm migration:revert
```

### 9.3 权限矩阵
| 权限范围 | 平台管理员 | 业务线负责人 | 项目负责人 | 成员 | 访客 |
|---------|-----------|-------------|-----------|------|------|
| 全局配置/市场 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 业务线管理 | ✅ | ✅(所属) | ❌ | ❌ | ❌ |
| 项目配置 | ✅ | ✅(所属) | ✅(所属) | ❌ | ❌ |
| 任务创建 | ✅ | ✅(所属) | ✅(所属) | ✅(授权) | ❌ |
| 任务执行 | ✅ | ✅(所属) | ✅(所属) | ✅(授权) | ❌ |
| 产物查看 | ✅ | ✅(所属) | ✅(所属) | ✅(授权) | ✅(公开) |
| 产物下载 | ✅ | ✅(所属) | ✅(所属) | ✅(授权) | ❌ |
| 用户管理 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 审计日志查看 | ✅ | ✅(所属) | ❌ | ❌ | ❌ |

## 10. 技术架构与选型

### 10.1 技术选型（基于当前项目）

本项目采用 **Monorepo** 架构，前后端分离，技术栈如下：

#### 前端技术栈
| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 核心框架 | Vue 3 | 3.5.x | Composition API + `<script setup>` |
| 类型系统 | TypeScript | 5.9.x | 完整类型支持 |
| 构建工具 | Vite | 7.x | 快速热更新、ESM 原生支持 |
| 路由 | Vue Router | 5.x | 官方路由，支持代码分割 |
| 状态管理 | Pinia | 3.x | Vue 3 官方推荐 |
| CSS 方案 | Tailwind CSS | 4.x | 原子化 CSS + 自定义主题系统 |
| 单元测试 | Vitest | 4.x | Vite 原生支持 |
| E2E 测试 | Playwright | 1.58.x | 跨浏览器自动化测试 |
| 代码规范 | ESLint + Prettier | - | 代码质量与格式化 |

#### 后端技术栈
| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 核心框架 | NestJS | 11.x | 企业级 Node.js 框架，模块化架构 |
| 类型系统 | TypeScript | 5.9.x | 与前端统一 |
| ORM | TypeORM | 0.3.x | 支持迁移、关系映射 |
| 数据库 | PostgreSQL | - | 关系型数据库，JSON 支持好 |
| 认证 | Passport + JWT | - | 无状态认证，支持多策略 |
| API 文档 | Swagger | - | OpenAPI 3.0 自动生成 |
| 文件存储 | AWS S3 | - | 产物存储，支持预签名 URL |
| 数据验证 | class-validator | - | 装饰器风格的 DTO 验证 |
| 邮件 | Nodemailer | - | 通知邮件发送 |
| 国际化 | nestjs-i18n | - | 多语言支持 |

#### 基础设施
| 类别 | 技术 | 说明 |
|------|------|------|
| 容器化 | Docker + Docker Compose | 开发与部署环境一致 |
| 包管理 | pnpm | Monorepo 工作空间支持 |
| Git Hooks | Husky + Commitlint | 提交规范与自动检查 |
| 代码生成 | Hygen | 模块/组件脚手架 |

### 10.2 系统架构图
```mermaid
flowchart TB
    subgraph Client["客户端"]
        Web["Web App (Vue 3)"]
        CLI["Agent CLI"]
    end

    subgraph Gateway["API 网关层"]
        API["NestJS API Server"]
        WS["WebSocket (日志流)"]
    end

    subgraph Services["核心服务"]
        Auth["认证服务 (Passport/JWT)"]
        Task["任务服务"]
        Pipeline["流水线服务"]
        Agent["Agent 适配服务"]
        Artifact["产物服务"]
    end

    subgraph Runtime["执行运行时"]
        Executor["任务执行器"]
        Sandbox["Sandbox/容器"]
        Worktree["Git Worktree"]
    end

    subgraph Storage["存储层"]
        PG["PostgreSQL"]
        S3["S3/MinIO (产物)"]
        Redis["Redis (队列/缓存)"]
    end

    Web --> API
    CLI --> API
    Web --> WS
    API --> Auth
    API --> Task
    API --> Pipeline
    API --> Agent
    API --> Artifact
    Task --> Executor
    Executor --> Sandbox
    Executor --> Worktree
    Agent --> Sandbox
    Task --> PG
    Pipeline --> PG
    Artifact --> S3
    Executor --> Redis
```

### 10.3 Agent 适配层设计

基于 NestJS 的模块化架构，Agent 适配层采用**策略模式**实现：

```mermaid
flowchart TB
    subgraph AgentModule["Agent 模块"]
        Service["AgentService"]
        Factory["AgentExecutorFactory"]
    end

    subgraph Executors["执行器实现"]
        Claude["ClaudeExecutor"]
        Codex["CodexExecutor"]
        Cursor["CursorExecutor"]
    end

    subgraph Interface["统一接口"]
        IExecutor["IAgentExecutor"]
    end

    Service --> Factory
    Factory --> Claude
    Factory --> Codex
    Factory --> Cursor
    Claude -.-> IExecutor
    Codex -.-> IExecutor
    Cursor -.-> IExecutor
```

**统一接口定义（TypeScript）：**
```typescript
// src/modules/agent/interfaces/agent-executor.interface.ts

export interface ExecuteRequest {
  prompt: string;                    // 执行指令
  context: Record<string, any>;      // 上下文变量
  workDir: string;                   // 工作目录
  timeout: number;                   // 超时时间（ms）
  permissions: AgentPermissions;     // 权限配置
}

export interface ExecuteResult {
  status: 'succeeded' | 'failed' | 'timeout';
  output: string;                    // 执行输出
  artifacts: ArtifactRef[];          // 产物引用
  metrics: ExecutionMetrics;         // 执行指标
}

export interface IAgentExecutor {
  execute(request: ExecuteRequest): Promise<ExecuteResult>;
  streamOutput(callback: (chunk: string) => void): void;
  cancel(): Promise<void>;
  getStatus(): Promise<AgentStatus>;
}

export interface AgentPermissions {
  allowNetwork: boolean;             // 允许网络访问
  allowFileSystem: boolean;          // 允许文件系统访问
  allowShell: boolean;               // 允许执行 Shell 命令
  networkWhitelist?: string[];       // 网络白名单
}
```

**NestJS 模块结构：**
```typescript
// src/modules/agent/agent.module.ts

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [
    AgentService,
    AgentExecutorFactory,
    ClaudeExecutor,
    CodexExecutor,
    CursorExecutor,
  ],
  exports: [AgentService],
})
export class AgentModule {}
```

### 10.4 数据库设计

基于 TypeORM 的实体定义示例：

```typescript
// src/modules/task/entities/task.entity.ts

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('jsonb', { default: [] })
  acceptanceCriteria: string[];

  @Column({
    type: 'enum',
    enum: TaskStatus,
    default: TaskStatus.DRAFT,
  })
  status: TaskStatus;

  @Column({ nullable: true })
  branch: string;

  @ManyToOne(() => Project, (project) => project.tasks)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => PipelineTemplate)
  @JoinColumn({ name: 'template_id' })
  template: PipelineTemplate;

  @OneToOne(() => PipelineRun, (run) => run.task)
  pipelineRun: PipelineRun;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### 10.5 前端架构

基于 Vue 3 的模块化目录结构：

```
frontend/src/
├── App.vue                      # 根组件
├── main.ts                      # 应用入口
├── assets/                      # 静态资源
│   ├── main.css                # Tailwind 入口
│   └── theme.css               # 主题变量
├── components/                  # 通用组件
│   ├── ui/                     # 基础 UI 组件
│   └── business/               # 业务组件
├── composables/                 # 组合式函数
│   ├── useAuth.ts
│   ├── useTask.ts
│   └── useWebSocket.ts
├── layouts/                     # 布局组件
│   └── AppShell.vue
├── modules/                     # 功能模块
│   ├── auth/                   # 认证模块
│   ├── project/                # 项目管理
│   ├── task/                   # 任务管理
│   ├── pipeline/               # 流水线
│   └── settings/               # 设置
├── router/                      # 路由配置
├── stores/                      # Pinia 状态
│   ├── auth.ts
│   ├── project.ts
│   └── task.ts
├── services/                    # API 服务
│   └── api.ts
└── types/                       # 类型定义
```

### 10.6 实时日志流方案

使用 **Server-Sent Events (SSE)** 实现任务执行日志的实时推送：

**后端实现（NestJS）：**
```typescript
// src/modules/task/task.controller.ts

@Controller('tasks')
export class TaskController {
  @Get(':id/stream')
  @Sse()
  streamLogs(@Param('id') id: string): Observable<MessageEvent> {
    return this.taskService.getLogStream(id).pipe(
      map((log) => ({
        data: JSON.stringify(log),
        type: log.type, // 'status' | 'log' | 'artifact' | 'done'
      })),
    );
  }
}
```

**前端实现（Vue 3）：**
```typescript
// src/composables/useTaskStream.ts

export function useTaskStream(taskId: string) {
  const logs = ref<LogEntry[]>([]);
  const status = ref<TaskStatus>('pending');

  const connect = () => {
    const eventSource = new EventSource(`/api/v1/tasks/${taskId}/stream`);

    eventSource.addEventListener('log', (e) => {
      logs.value.push(JSON.parse(e.data));
    });

    eventSource.addEventListener('status', (e) => {
      status.value = JSON.parse(e.data).status;
    });

    eventSource.addEventListener('done', () => {
      eventSource.close();
    });

    return eventSource;
  };

  return { logs, status, connect };
}
```

## 11. API 设计

### 11.1 RESTful 资源路径

基于 NestJS 控制器的 API 设计：

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| **认证** | POST | /api/v1/auth/login | 用户登录 |
| | POST | /api/v1/auth/logout | 用户登出 |
| | GET | /api/v1/auth/me | 获取当前用户 |
| **用户** | GET | /api/v1/users | 用户列表 |
| | POST | /api/v1/users | 创建用户 |
| | GET | /api/v1/users/:id | 用户详情 |
| | PATCH | /api/v1/users/:id | 更新用户 |
| | DELETE | /api/v1/users/:id | 删除用户 |
| **业务线** | GET | /api/v1/business-lines | 业务线列表 |
| | POST | /api/v1/business-lines | 创建业务线 |
| | GET | /api/v1/business-lines/:id | 业务线详情 |
| | PATCH | /api/v1/business-lines/:id | 更新业务线 |
| **项目** | GET | /api/v1/projects | 项目列表 |
| | POST | /api/v1/projects | 创建项目 |
| | GET | /api/v1/projects/:id | 项目详情 |
| | PATCH | /api/v1/projects/:id | 更新项目 |
| | DELETE | /api/v1/projects/:id | 删除项目 |
| | GET | /api/v1/projects/:id/config | 获取项目配置 |
| | PUT | /api/v1/projects/:id/config | 更新项目配置 |
| | GET | /api/v1/projects/:id/members | 项目成员列表 |
| | POST | /api/v1/projects/:id/members | 添加成员 |
| **任务** | GET | /api/v1/projects/:projectId/tasks | 任务列表 |
| | POST | /api/v1/projects/:projectId/tasks | 创建任务 |
| | GET | /api/v1/tasks/:id | 任务详情 |
| | PATCH | /api/v1/tasks/:id | 更新任务 |
| | POST | /api/v1/tasks/:id/execute | 触发执行 |
| | POST | /api/v1/tasks/:id/cancel | 取消执行 |
| | POST | /api/v1/tasks/:id/retry | 重试执行 |
| | GET | /api/v1/tasks/:id/stream | 日志流（SSE） |
| **流水线** | GET | /api/v1/tasks/:id/pipeline | 流水线详情 |
| | GET | /api/v1/pipeline-runs/:id/nodes | 节点列表 |
| | GET | /api/v1/nodes/:id/logs | 节点日志 |
| **产物** | GET | /api/v1/tasks/:id/artifacts | 产物列表 |
| | GET | /api/v1/artifacts/:id | 产物详情 |
| | GET | /api/v1/artifacts/:id/download | 产物下载（预签名 URL） |
| **模板** | GET | /api/v1/pipeline-templates | 模板列表 |
| | POST | /api/v1/pipeline-templates | 创建模板 |
| | GET | /api/v1/pipeline-templates/:id | 模板详情 |
| | PATCH | /api/v1/pipeline-templates/:id | 更新模板 |

### 11.2 认证方式

基于 Passport + JWT 的认证方案：

| 场景 | 认证方式 | 说明 |
|------|---------|------|
| Web UI | Cookie Session + JWT | HttpOnly Cookie 存储 Token |
| API 调用 | Bearer Token | Authorization: Bearer {token} |
| CLI/自动化 | API Key | X-API-Key: {key} |

**JWT Payload 结构：**
```typescript
interface JwtPayload {
  sub: string;           // 用户 ID
  username: string;
  roles: string[];       // 角色列表
  businessLineId: string;
  iat: number;           // 签发时间
  exp: number;           // 过期时间
}
```

### 11.3 关键接口示例

**创建任务 DTO：**
```typescript
// src/modules/task/dto/create-task.dto.ts

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  acceptanceCriteria?: string[];

  @IsUUID()
  templateId: string;

  @IsString()
  @IsOptional()
  branch?: string;
}
```

**请求示例：**
```json
POST /api/v1/projects/proj_001/tasks
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "title": "实现用户登录功能",
  "description": "基于 JWT 实现用户登录",
  "acceptanceCriteria": [
    "支持用户名密码登录",
    "返回 JWT Token",
    "Token 有效期 24 小时"
  ],
  "templateId": "tpl_001",
  "branch": "feature/login"
}
```

**响应示例：**
```json
{
  "id": "task_001",
  "title": "实现用户登录功能",
  "status": "draft",
  "project": {
    "id": "proj_001",
    "name": "AINative"
  },
  "template": {
    "id": "tpl_001",
    "name": "标准开发流程"
  },
  "createdAt": "2025-01-15T10:30:00Z"
}
```

**任务执行日志流（SSE）：**
```
GET /api/v1/tasks/task_001/stream
Accept: text/event-stream
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

event: status
data: {"status": "running", "nodeId": "node_001", "nodeName": "代码分析"}

event: log
data: {"nodeId": "node_001", "level": "info", "message": "Analyzing requirements...", "timestamp": "2025-01-15T10:31:00Z"}

event: log
data: {"nodeId": "node_001", "level": "info", "message": "Generating code...", "timestamp": "2025-01-15T10:31:05Z"}

event: artifact
data: {"type": "file", "path": "src/auth/login.ts", "action": "created"}

event: status
data: {"status": "succeeded", "nodeId": "node_001"}

event: done
data: {"status": "succeeded", "duration": 120, "artifactCount": 3}
```

### 11.4 错误响应格式

统一的错误响应结构：

```typescript
// src/common/filters/http-exception.filter.ts

interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  code: string;          // 业务错误码，如 AUTH_001
  timestamp: string;
  path: string;
}
```

**示例：**
```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "您没有权限执行此任务",
  "code": "AUTH_003",
  "timestamp": "2025-01-15T10:30:00Z",
  "path": "/api/v1/tasks/task_001/execute"
}
```

### 11.5 Swagger 文档

API 文档通过 `@nestjs/swagger` 自动生成，访问地址：`/api/docs`

```typescript
// src/main.ts

const config = new DocumentBuilder()
  .setTitle('AINative API')
  .setDescription('AINative 平台 API 文档')
  .setVersion('1.0')
  .addBearerAuth()
  .addTag('auth', '认证相关')
  .addTag('users', '用户管理')
  .addTag('projects', '项目管理')
  .addTag('tasks', '任务管理')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

## 12. 非功能需求

### 12.1 安全要求
| 要求 | 描述 | 实现方案 |
|------|------|---------|
| 身份认证 | 所有 API 需认证 | Passport + JWT，NestJS Guards |
| 权限控制 | 基于 RBAC 的细粒度控制 | 自定义装饰器 + Guards |
| 数据隔离 | 项目间数据隔离 | TypeORM 全局 Scope + 行级过滤 |
| 密钥管理 | Git Token、API Key 等敏感信息 | bcryptjs 加密 + 环境变量 |
| 执行隔离 | 任务执行环境隔离 | Docker 容器 + 网络策略 |
| 日志脱敏 | 敏感信息不落日志 | NestJS Interceptor + 正则过滤 |
| 审计追踪 | 关键操作可追溯 | TypeORM Subscriber + 审计表 |
| 输入验证 | 防止注入攻击 | class-validator + ValidationPipe |

**权限守卫示例：**
```typescript
// src/common/guards/roles.guard.ts

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}

// 使用方式
@Roles(Role.ProjectOwner, Role.Admin)
@UseGuards(JwtAuthGuard, RolesGuard)
@Post(':id/execute')
async executeTask(@Param('id') id: string) { ... }
```

### 12.2 性能指标
| 指标 | 目标值 | 测量方式 |
|------|--------|---------|
| API 响应时间 | P99 < 500ms | NestJS Interceptor + Prometheus |
| 任务调度延迟 | < 5s | Redis 队列监控 |
| 日志流延迟 | < 3s | SSE 端到端测量 |
| 并发任务数 | > 100 | 压测（k6/Artillery） |
| 系统可用性 | 99.9%（MVP 可放宽至 99%） | 健康检查 + 告警 |
| 数据库连接池 | 最大 20 连接 | TypeORM 配置 |

### 12.3 可扩展性
- **Skills/MCP 插件化**：基于 NestJS 动态模块，支持运行时加载
- **Agent 适配层**：策略模式，新增 Agent 只需实现 `IAgentExecutor` 接口
- **流水线节点类型**：工厂模式，支持自定义节点处理器
- **存储后端**：S3 兼容接口，可切换 MinIO/阿里云 OSS 等

### 12.4 可观测性

基于 NestJS 生态的监控方案：

```typescript
// src/common/interceptors/logging.interceptor.ts

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        this.logger.log(
          `${method} ${url} ${response.statusCode} - ${Date.now() - now}ms`,
        );
      }),
    );
  }
}
```

**健康检查端点：**
```typescript
// src/health/health.controller.ts

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
    ]);
  }
}
```

## 13. 风险管理

### 13.1 风险评估与应对
| 风险 | 影响 | 概率 | 风险等级 | 应对方案 | 负责人 |
|------|------|------|---------|---------|--------|
| Git worktree 多任务冲突 | 高 | 中 | 高 | 任务级锁 + 分支隔离 + worktree 池化 | TBD |
| 容器隔离成本过高 | 中 | 高 | 高 | 按需扩缩 + 资源池化 + 轻量级隔离方案 | TBD |
| 多 Agent 接口不统一 | 高 | 中 | 高 | 定义标准接口 + 适配层抽象 + 版本兼容 | TBD |
| 产物存储成本增长 | 中 | 高 | 中 | 生命周期管理 + 自动清理 + 分级存储 | TBD |
| Agent 执行不稳定 | 高 | 中 | 高 | 重试机制 + 超时控制 + 降级策略 | TBD |
| 权限模型复杂度 | 中 | 中 | 中 | MVP 简化模型 + 渐进增强 | TBD |

### 13.2 待定项（需进一步讨论）
| 待定项 | 影响范围 | 决策时间点 | 备选方案 |
|--------|---------|-----------|---------|
| Git 认证方式 | 项目配置 | 第一阶段启动前 | SSH Key / HTTP Token / OAuth |
| 容器 vs 进程隔离 | 执行运行时 | 第一阶段启动前 | K8s Pod / Docker / gVisor / 进程 |
| 日志存储方案 | 可观测性 | 第二阶段启动前 | Loki / ES / ClickHouse |
| 多业务线归属 | 权限模型 | 第三阶段启动前 | 单归属 / 多归属 |

## 14. 交付物与里程碑

### 14.1 交付物清单
| 交付物 | 描述 | 交付阶段 |
|--------|------|---------|
| 需求设计文档 | 本文档 | 启动前 |
| 数据模型设计 | ER 图 + DDL | 第一阶段 |
| API 接口文档 | OpenAPI 3.0 规范 | 第一阶段 |
| 技术架构文档 | 详细设计 + 部署架构 | 第一阶段 |
| 测试用例 | 单元测试 + 集成测试 + E2E | 各阶段 |
| 用户手册 | 操作指南 + FAQ | 上线前 |
| 运维手册 | 部署 + 监控 + 故障处理 | 上线前 |

### 14.2 里程碑
| 里程碑 | 目标 | 验收标准 |
|--------|------|---------|
| M1: 技术方案评审 | 完成技术选型与架构设计 | 评审通过 |
| M2: 核心闭环 Demo | 完成任务创建→执行→产出流程 | 可演示 |
| M3: Alpha 版本 | 第一阶段功能完成 | 内部试用 |
| M4: Beta 版本 | 第二阶段功能完成 | 小范围试用 |
| M5: GA 版本 | 全部 MVP 功能完成 | 正式上线 |

### 14.3 验收标准
**功能验收：**
- 所有 FR-xxx 功能点通过测试
- 用户故事 US-xxx 验收通过
- 无 P0/P1 级别 Bug

**性能验收：**
- API P99 响应时间 < 500ms
- 支持 100+ 并发任务
- 系统可用性 > 99%

**安全验收：**
- 通过安全扫描（SAST/DAST）
- 权限控制测试通过
- 敏感信息无泄露
