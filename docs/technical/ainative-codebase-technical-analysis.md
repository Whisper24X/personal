# AINative 代码库技术分析

> 文档定位：本文是基于当前代码仓库的“代码到架构映射”分析，目标不是重复已有方案叙述，而是回答三个问题：
> 1. AINative 在代码层面到底由哪些核心边界组成。
> 2. 一个需求如何从 `Goal` 演化成可执行的 `Task`。
> 3. 前端、后端、Git、Runner、文档与上下文服务是如何被缝成一套工程系统的。

## 一、结论摘要

AINative 的本质不是一个“接了多个 Agent CLI 的聊天壳子”，而是一套面向研发流程的 AI 工程控制系统。它在代码层面的独特性不在模型接入本身，而在以下四个边界被显式建模了：

1. **需求治理边界**：通过 `Goal -> PRD -> Plan -> Task` 的中间态，把大需求和单次执行拆开。
2. **控制面 / 执行面边界**：NestJS 后端保留调度、权限、状态、Git、容器编排；真正的 Agent CLI 执行通过 runner 容器完成。
3. **项目代码 / 项目知识边界**：仓库代码、项目文档、上下文配置不是松散附件，而是可被后端服务统一读取和写回的系统对象。
4. **页面壳 / 业务能力边界**：前端正在向 `app / pages / features / api / shared` 五分区收敛，页面只做入口，复杂交互落到 `features`。

如果用一句话概括当前架构：**AINative 已经把“需求理解、任务拆解、隔离执行、Git 落地、人工审阅、前端承载”串成了同一条代码链路。**

## 二、仓库结构与技术栈

仓库是一个面向 AI 开发工作台的全栈项目，主结构可以概括为：

| 目录 | 作用 |
| --- | --- |
| `backend/` | NestJS 控制面，负责 API、鉴权、数据库、调度、任务状态、Git、项目文档、容器编排 |
| `frontend/` | Vue 3 + Vite 工作台前端，承载项目、目标、任务、技能、MCP、自动化等页面 |
| `runner/` | Runner 镜像与执行环境相关脚本 |
| `docs/technical/` | 架构、状态机、Goal/Task/Runner 等技术文档 |
| 根目录脚本 | 本地开发、lint、type-check、quality-gate、docker 生命周期 |

从根 `package.json` 可以看出，仓库已经不是单一应用，而是有明确工程门禁的全栈工作区：

- `dev` 会同时拉起后端和前端。
- `quality-gate` 会串联 `lint`、`type-check` 和前端循环依赖检查。
- Docker 生命周期脚本已经是常规开发路径的一部分。

技术栈上，前端是 `Vue 3 + Vite + Pinia + Tailwind CSS`，后端是 `NestJS`。前端在 `frontend/vite.config.ts` 中已经定义了 `@app`、`@pages`、`@features`、`@api`、`@shared` 等分区别名，说明五分区架构已经不只是文档方向，而是进入构建配置和真实代码。

## 三、核心架构判断

### 3.1 三层结构已经比较清晰

从代码实现看，AINative 可以拆成三个主要层面：

1. **体验面（Frontend Workspace）**
   由 `frontend/src` 承担，负责把项目、目标、任务、日志、工件、环境和 Git 操作组织成统一工作台。
2. **控制面（Backend Control Plane）**
   由 `backend/src` 承担，负责权限、调度、状态机、任务生命周期、仓库准备、文档与上下文聚合。
3. **执行面（Runner Execution Plane）**
   由任务 runtime、git worktree、容器编排和 Agent CLI 适配器组成，负责把一次任务执行落到可隔离、可复用、可审计的运行环境里。

这种拆法的意义在于：**AINative 并没有把“AI 执行”本身当成唯一中心，而是把 AI 执行视为整个工程控制链中的一个环节。**

### 3.2 中间态是这套系统最关键的产品化设计

很多 AI Coding 系统的结构会直接把“需求”压缩成一个 task。AINative 的代码不是这样组织的。

`backend/src/goals/goals.service.ts` 中的 `generatePrd`、`generatePlan`、`materializeTasks`、`replaceTaskDependencies` 说明系统已经把中间态明确建模出来：

- `Goal` 负责承载较大的需求对象。
- PRD 是需求整理后的文档化中间产物。
- Plan Items 是可编辑、可校验依赖的结构化计划项。
- Task 是最终进入调度和执行的最小单元。

这意味着 AINative 的系统重心不是“让模型一次做完”，而是“让需求在进入执行前先变成可以被治理的结构”。

## 四、核心业务链路

### 4.1 Goal 到 Task：先治理，再执行

`goals.service.ts` 是理解系统主链路的第一入口。关键方法包括：

- `generatePrd`
- `generatePlan`
- `materializeTasks`
- `replaceTaskDependencies`

从这些方法的职责可以反推出一条非常明确的业务链：

1. 用户先创建或整理一个 `Goal`。
2. 系统结合项目知识与资料生成 PRD。
3. 系统基于 PRD 继续生成结构化计划项。
4. 计划项依赖关系可以被显式替换和调整。
5. 最终再把计划项物化为多个任务进入执行域。

`backend/src/goals/goal-plan-dag.ts` 则补上了关键约束：计划项不是随意列表，而是一个显式 DAG。这里提供了邻接关系构建、环检测和物化拓扑排序能力，说明“任务依赖”不是前端展示概念，而是后端实际维护的执行前提。

这一步很重要。它让系统天然具备如下属性：

- 可以对计划项依赖做校验，而不是靠人脑记顺序。
- 可以在物化任务前做中间态编辑。
- 可以把“规划错误”和“执行错误”放在不同阶段处理。

这也是 AINative 区别于单 prompt 执行器的第一性特征。

### 4.2 Task 生命周期：面向人工介入的任务系统

任务域的入口非常完整。`backend/src/tasks/tasks.controller.ts` 不只是暴露了 CRUD，而是暴露了一套完整的任务交互接口：

- 执行与重试：`execute`、`retry`、`repeat`、`repeatNode`、`resetNode`
- 人工交互：`reply`、`approve`、`complete`
- 环境管理：`environment`、`startEnvironment`、`terminateEnvironment`
- 工作区能力：日志流、文件树、文件读取、Git 状态与 diff、终端会话

但控制器本身没有承载业务复杂度。`backend/src/tasks/tasks.service.ts` 当前更像一个 facade，把职责拆给：

- `TaskCommandService`
- `TaskQueryService`
- `TaskInteractionService`
- `TaskEnvironmentService`
- `TaskSchedulerService`
- `TaskStatusService`

这说明任务域已经开始从“大一统 service”向应用服务分治演化。

真正的任务交互逻辑集中在 `backend/src/tasks/application/task-interaction.service.ts`。这里有几个很关键的信号：

- `reply` 会把人工消息写入任务日志，并回写到待执行节点的 runtime 配置里。
- `execute` 在执行前会检查环境就绪、是否存在运行中节点、是否存在待审节点，再触发调度。
- `approve`、`repeat` 等动作都围绕统一的任务状态和节点状态工作。

这套设计说明 AINative 的任务系统不是“发一次命令，等一个结果”，而是**一个支持人工回复、审批、打断、回滚重跑的长生命周期执行对象**。

### 4.3 Task Node 到 Runner：真正的执行发生在隔离环境里

任务调度之后，核心责任落到 `backend/src/tasks/application/task-node-execution.service.ts`。

从该文件的职责可以看到，一次节点执行至少包含以下步骤：

1. 准备 runtime。
2. 确认或创建任务工作区。
3. 记录日志与状态迁移。
4. 准备容器环境。
5. 调用 runner 执行 Agent CLI。
6. 自动提交工作区变更。
7. 重新计算节点和任务状态。

这意味着“执行”不是一次简单的 CLI 调用，而是一条完整的编排链。

`backend/src/agent-execution/runner-agent-execution.service.ts` 则揭示了执行面的关键边界：后端不会直接在宿主机里把 Agent CLI 跑起来，而是要求通过 runner 容器进行 handoff。代码里甚至直接体现了 “requires docker exec handoff” 的约束语义，并内建恢复/降级 fallback 逻辑。

这说明 AINative 在架构上的核心判断是：

- **控制面** 应留在业务语义更强的 NestJS 进程里。
- **执行面** 应隔离到 runner 容器里，避免 CLI、依赖和工作区相互污染。

### 4.4 Git Worktree、项目仓库、文档与上下文不是附属品

AINative 的另一个强信号是：Git 与上下文服务不是“补充能力”，而是主路径的一部分。

### 仓库准备

`backend/src/projects/project-repository-workspace.service.ts` 提供了 `ensureProjectRepositoryReady`、`ensureProjectRepository`、仓库同步锁和 `git clone/fetch` 相关能力。这说明系统不是默认假设“代码已经在某个目录里”，而是显式负责项目仓库的拉取、同步和并发保护。

### 任务工作区

`backend/src/tasks/task-runtime.service.ts` 与 `backend/src/tasks/application/task-runtime-orchestrator.service.ts` 负责 runtime 创建、git worktree 准备、路径安全检查和清理逻辑。这里大量出现对 allowed root、realpath、cleanup、worktree add/remove 的处理，说明任务执行目录被当成受管基础设施，而不是普通临时目录。

### 项目文档与上下文

结合 `ProjectDocsService` 与 `ProjectContextService` 的职责可以看出，PRD、上下文文档、项目资料并不是上传后就丢在某个目录里，而是被后端作为“项目知识来源”统一读取、组织和回写。

这让系统具备了一个非常关键的能力：**AI 执行前可以读取项目知识，AI 输出后可以沉淀为项目文档。**

## 五、前端架构分析

### 5.1 五分区方向已经进入真实代码

现有前端不是停留在“准备重构”的阶段，而是已经在真实代码里看到五分区架构痕迹：

- `app/` 负责应用装配、路由、store 与全局能力。
- `pages/` 负责路由级薄壳。
- `features/` 承接业务域主实现。
- `api/` 负责请求与类型契约。
- `shared/` 承担通用常量、工具与共享类型。

`frontend/src/pages/tasks/detail.vue` 就是一个标准例子：页面本身极薄，只是把任务详情页的真实实现交给 `@features/tasks`。

这类组织方式非常适合复杂工作台，因为它能把“路由入口”和“业务实现”稳定分开。

### 5.2 任务详情页是前端复杂度最集中的控制台之一

如果要看前端最能体现产品复杂度的地方，首选 `frontend/src/features/tasks/TaskDetailPage.vue` 和 `frontend/src/features/tasks/use-task-detail-page.ts`。

这里几乎把任务执行的所有关键元素收到了同一个页面能力中：

- 环境门禁 `TaskEnvironmentGate`
- 执行上下文栏 `TaskExecutionContextBar`
- 工作流节点卡片 `WorkflowCard`
- 审阅卡片 `ReviewCard`
- 执行消息流 `ExecutionPanel`
- 回复区 `ReplyCard`
- 日志 / 工件 / 预览右栏 `RightPanelSection`

而 `use-task-detail-page.ts` 则统一管理：

- 路由参数和任务选择
- 权限门禁
- 任务详情加载
- 环境状态
- SSE 实时日志流
- 右栏刷新
- 审批、回复、执行、终止环境等动作

这说明前端不是“展示后端结果”，而是承担了整个任务执行控制台的交互编排职责。

### 5.3 前端迁移仍处于“新旧并存”阶段

虽然五分区已经落地，但迁移未完成，仓库里仍保留明显的新旧结构并存痕迹：

- 仍有 legacy `@/` 引用。
- `pages/` 与更早期的页面组织方式同时存在。
- 某些大体量业务 composable 仍然承担过多状态编排。

这不是简单的风格问题，而是一个真实的演进状态：**架构方向已经明确，但复杂页面的拆分还没有完成到可以彻底去历史包袱的阶段。**

## 六、后端架构分析

### 6.1 模块边界已经具备明显的领域分区

后端总体是 NestJS 的模块化单体，但不是简单按 controller/service/repository 平铺。几个核心域已经比较清楚：

- `goals`
- `tasks`
- `projects`
- `agent-execution`
- `containers`
- `git`
- `project-context`

其中部分模块已经出现 `domain / infrastructure / application` 分层痕迹，说明项目正在向“领域对象 + 应用服务 + 基础设施”演进，而不是继续把所有逻辑堆进单层 service。

### 6.2 优点：任务域开始从“大 service”解耦

`TasksService` 目前更像一个总入口，真正的写操作、读操作、状态聚合和环境控制已经拆给不同应用服务。这是一个很好的信号，说明团队已经意识到任务域过于复杂，开始用应用服务切开职责。

### 6.3 风险：编排逻辑集中在少数巨型文件

虽然方向是好的，但当前代码库仍存在明显的复杂度集中问题。

后端的大文件包括：

- `backend/src/goals/goals.service.ts`：1429 行
- `backend/src/projects/projects.service.ts`：1415 行
- `backend/src/tasks/task-git.service.ts`：1194 行
- `backend/src/tasks/application/task-node-execution.service.ts`：1074 行
- `backend/src/agent-execution/runner-agent-execution.service.ts`：822 行

这些文件有一个共同特点：它们不是单纯“代码多”，而是承担了跨域编排责任。也就是说，随着功能继续增长，风险不只是维护成本上升，更可能出现：

- 领域边界继续模糊
- 单点文件成为改动热点
- 测试粒度越来越粗
- AI 或人工局部修改时更容易误伤旁支逻辑

## 七、工程质量现状

从仓库脚本和测试分布看，AINative 并不是一个“先跑起来再说”的原型仓库，已经具备一定工程门禁：

- 根目录有 `lint`、`type-check`、`quality-gate`
- 前端质量门禁包含循环依赖检查
- 前端测试文件约 `74` 个
- 后端 `*.spec.ts` 约 `50` 个

这说明团队已经把“工程稳定性”纳入常规开发路径，而不是只依赖人工回归。

但质量现状也存在几个明确问题：

### 7.1 巨型文件仍然很多

前端典型大文件：

- `frontend/src/features/business-lines/use-business-line-management-panel.ts`：1875 行
- `frontend/src/features/projects/use-projects-detail-page.ts`：1592 行
- `frontend/src/features/tasks/use-task-detail-page.ts`：1465 行

后端典型大文件见上一节。

这种规模在 AI 辅助修改场景下尤其危险，因为上下文过大时，局部改动更容易跨越多个隐含责任。

### 7.2 包管理痕迹不一致

根目录、`frontend/`、`backend/` 当前都同时存在 `pnpm-lock.yaml` 和 `package-lock.json`。这通常意味着历史上存在 `npm` / `pnpm` 混用，带来的风险包括：

- 依赖解析结果不稳定
- CI / 本地环境行为不一致
- 团队对唯一包管理器缺少统一约束

### 7.3 架构真相分散在代码、文档和迁移状态之间

当前 `docs/technical/` 已经有多篇高质量文档，但也带来一个副作用：系统认知容易分散在不同叙述文档、dev-spec 和实际代码之间。对新加入的开发者来说，若没有一篇代码导向索引文档，就会出现“知道理念，但不知道从哪几个文件落地看”的问题。

本文本身就是为了解决这个问题。

## 八、综合评估

### 8.1 当前架构的主要优势

1. **中间态清晰**：`Goal -> PRD -> Plan -> Task` 让需求治理和执行编排分离。
2. **执行面隔离明确**：Runner 容器与 `docker exec` handoff 让 CLI 执行不污染控制面。
3. **Git 与项目知识是主路径能力**：仓库准备、worktree、项目文档、上下文读取都已经系统化。
4. **前端控制台能力完整**：任务详情页已经具备环境、日志、工件、执行、审批的一体化承载。

### 8.2 当前架构的主要风险

1. **复杂度集中在少数 orchestration 文件**，后续扩展时容易继续膨胀。
2. **前端迁移未完成**，五分区与 legacy 结构并存会持续增加认知成本。
3. **工具链不统一**，锁文件混杂说明工程规范还有收口空间。
4. **文档与代码之间的索引关系不够强**，容易形成“架构说法很多，但入口不清晰”。

### 8.3 建议的下一步优化方向

1. 把 `Goal`、`Task Execution`、`Task Git` 三条主链继续拆成更小的应用服务或策略对象，优先处理千行以上 orchestrator。
2. 以前端任务详情页和项目详情页为重点，继续把“状态编排”从超大 composable 中下沉到更清晰的子模块。
3. 明确唯一包管理器，并清理多余 lockfile，避免后续环境漂移。
4. 在 `docs/technical/` 中维持“叙事文档 + 代码入口索引文档”的双层结构，减少架构知识分散。

## 九、关键代码索引

如果要继续深入 AINative，建议优先从以下文件开始：

| 路径 | 作用 |
| --- | --- |
| `backend/src/goals/goals.service.ts` | 需求治理主链，包含 PRD 生成、计划生成、任务物化 |
| `backend/src/goals/goal-plan-dag.ts` | 计划项依赖、环检测、拓扑物化顺序 |
| `backend/src/tasks/tasks.controller.ts` | 任务域接口总入口 |
| `backend/src/tasks/tasks.service.ts` | 任务域 facade，连接 command/query/interaction/environment |
| `backend/src/tasks/application/task-interaction.service.ts` | 回复、执行、审批、重试等任务交互编排 |
| `backend/src/tasks/application/task-node-execution.service.ts` | 节点执行编排主链 |
| `backend/src/agent-execution/runner-agent-execution.service.ts` | Runner 容器内 Agent CLI 执行与 fallback |
| `backend/src/tasks/task-runtime.service.ts` | worktree、runtime 安全与清理 |
| `backend/src/projects/project-repository-workspace.service.ts` | 项目仓库 clone/fetch/sync 与并发锁 |
| `frontend/src/app/router/` | 前端路由和页面承载入口 |
| `frontend/src/pages/tasks/detail.vue` | 任务详情页薄壳 |
| `frontend/src/features/tasks/TaskDetailPage.vue` | 任务控制台页面主视图 |
| `frontend/src/features/tasks/use-task-detail-page.ts` | 任务详情的状态编排与实时流控制 |
| `frontend/vite.config.ts` | 前端分区别名与本地代理配置 |

## 十、最终判断

从当前代码来看，AINative 已经越过了“AI 能不能执行一次任务”的阶段，进入了“如何把 AI 执行稳定纳入研发流程”的阶段。

这套系统最有价值的不是某个模型接入点，而是它已经把以下几个过去经常分散的能力，压进同一套工程控制链：

- 大需求治理
- 结构化任务拆解
- 任务级执行与人工介入
- Git worktree 隔离
- Runner 容器执行
- 项目文档与上下文读取
- 前端统一工作台承载

如果后续继续演进，AINative 最值得守住的不是“功能继续堆多快”，而是当前这些边界不要重新塌回几个超大 service 或超大页面里。只要边界能继续保持显式，这个项目就有条件继续从“可运行的 AI 开发平台”进化成“可治理的 AI 研发基础设施”。
