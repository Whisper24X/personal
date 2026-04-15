项目A：AINative
一、项目背景介绍
1. 项目目标
业务价值： 
当前 AI 应用开发赛道正从"AI 回答问题"快速进入"AI 直接产出可运行结果"的阶段。企业内部研发团队面临的核心痛点不是"缺少 AI 能力"，而是缺少一个能将需求承接、任务拆分、AI 执行、产物沉淀串联起来的一体化工作台。现有头部产品（Cursor、Manus、扣子编程等）各自在单点上有明显优势，但普遍缺少企业级的项目管理、协作治理和交付沉淀能力。AINative 的目标就是填补这一市场空白——做一个企业内部 AI 交付工作台，帮助团队实现从需求到交付的全链路闭环。
技术挑战：
- 一人全栈交付：一人全栈（Vue 3 + NestJS），需要在短时间内完成从产品设计到前后端实现、从数据库建模到容器化部署的全链路交付。
- 多 Agent CLI 适配：需要同时支持 Codex、Claude Code、Cursor Agent、Gemini、OpenCode 等多种 AI Agent 的接入和 UI 渲染，且各 Agent 的输出格式、交互模式差异很大。
- 底层引擎复杂度高：任务执行引擎涉及 PTY 终端、WebSocket 实时通信、Git 操作、Docker 沙箱等底层能力，工程复杂度高。
- 企业级治理要求：需要在企业场景下做好权限控制、业务线隔离、多人协作等治理能力。
- 架构级全面重构：从 v1 到 v2 是一次架构级别的全面重构（Express → NestJS，LLM 推理 → Agent CLI，PM2 → Docker），需要在保证产品方向正确的前提下快速完成技术栈切换。
2. 产品核心逻辑
AINative 的产品主线是一条完整的 AI 交付链路：
需求 → 项目上下文 → 任务拆分 → 工作流生成 → AI/人工协同执行 → Git/产物沉淀 → 评测与复用
这条链路在现有竞品中并没有被完整做好：在线产品强在"造应用"，但弱在"真实项目交付"；IDE 产品强在"改代码"，但弱在"企业内部需求到交付的全过程"。我们的切入点正是这条链路的中间地带——不做纯 IDE，不做纯聊天壳，而是做把两端串起来的企业 AI 工作台。
核心模块覆盖：Dashboard、Kanban 看板、Knowledge Base 知识库、Projects 项目管理、Tasks 任务执行、Workflow 工作流编排、Skills 技能管理、MCP 协议接入、Automations 自动化、Git 版本管理、Business Lines 业务线管理。
二、项目结果
1. 项目结果复盘
目标达成情况
核心目标已基本达成：完成了 AINative 平台从 0 到 1 的全栈搭建，实现了"需求 → 任务 → 工作流 → 执行 → 产物"主链路的贯通。具体成果包括：
- 全栈平台搭建完成：前端 Vue 3 + Vite 7 + TypeScript + Tailwind CSS 4，后端 NestJS 11 + TypeORM + PostgreSQL + Redis，通过 Docker Compose 实现一键部署。
- 多 Agent CLI 适配架构落地：成功接入 5+ 种主流 AI Agent（Codex、Claude Code、Cursor Agent、Gemini、OpenCode），建立了清晰的渲染器隔离架构。
- 实时任务执行引擎上线：基于 node-pty + WebSocket 的终端网关，支持任务的实时日志流、异步执行和状态追踪。
- 工作流编排能力落地：支持多节点工作流模板定义，已实现 WriteCode、ImproveCode 等核心节点，支持循环和 marker 配置。
- 企业级治理框架搭建：业务线 → 项目 → 任务的三层权限模型，细粒度的 RBAC 能力矩阵，多角色协作支持。
- 竞品调研与产品定位：完成 7 款主流竞品（扣子编程、飞书妙搭、搭叩、Manus、Atoms、Cursor、Windsurf）的系统调研，明确了"企业内部 AI 工作台"的差异化定位。
- DevOps 基础设施完善：Docker 多阶段构建、Nginx + WebSocket 终端支持、Husky 提交质量门禁、ESLint + oxlint + vue-tsc 全链路质量检查。
对业务产生的价值
- 主链路可行性验证：为团队提供了一个可运行的 AI 工作台原型，验证了"需求到交付"主链路的可行性。
- 产品方向决策依据：通过竞品调研，为产品方向提供了清晰的决策依据：明确了我们不应做纯 IDE 或纯聊天壳，而应聚焦企业内部 AI 交付工作台。
- 多 Agent 标准化接入：建立了可扩展的多 Agent 接入架构，为后续快速接入新 Agent 提供了标准化路径。
- 生态化扩展基础：通过 MCP 协议和 Skills 体系的引入，为平台能力的生态化扩展打下基础。

技术方面如何促成结果达成

- 模块化架构设计：前后端均采用高内聚低耦合的模块化设计。后端以 NestJS Module 为单元组织业务能力（tasks、workflow-templates、projects、skills、mcps、automations、git  等），前端以 API 层 + Store 层 + 组件层三层分离，保证了并行开发效率。
- 多 Agent 渲染器隔离架构：制定了明确的 CLI Renderer Boundaries 规范——每个 Agent 拥有独立的 UI 组件目录，禁止跨 Agent 导入，共享代码仅限于无 UI 的纯工具函数。这套规范有效避免了多 Agent 适配过程中的 UI 耦合和回归风险。
- 任务执行引擎分层：Runtime 层（PTY + Terminal Gateway）负责执行，Adapter Registry 负责 Agent 适配，GitService 负责代码操作，SchedulingService 负责调度，形成了清晰的职责分层。
- 基础设施即代码：Docker Compose 统一编排 PostgreSQL、Redis、前后端服务，docker-compose 配置经历了多次重构优化，最终形成了稳定的本地开发 + 部署方案。

配套项目：AINative Workspace 开发套件
除了 AINative 平台本身，我还设计并搭建了配套的开发套件项目 ainative-workspace，作为组内全栈产品的集成开发工作区和 AINative 平台的标准参考项目。
项目定位： ainative-workspace 是一个基于 Git Subtree 的 Monorepo 式工作区，将组内三个核心子项目——移动端（ainative-app）、管理后台（ainative-shadow）、后端服务（ainative-backend）——聚合到一个仓库中，提供统一的开发、调试和协作体验。
核心能力：
- Git Subtree 集成管理：通过 Makefile 自动化 subtree pull/push，将三个独立 GitLab 仓库的代码同步到统一工作区。各子项目保持独立仓库的所有权，同时支持 Monorepo 式的跨项目联调。
- 一键沙箱环境（Sandbox）：基于 Docker Compose + Nginx + Supervisor 构建全栈开发沙箱，一条命令即可启动 Go 后端、Vue 管理后台、Taro H5 移动端，并配置好 Redis、PostgreSQL 等依赖服务。支持 HMR WebSocket 代理、共享依赖缓存（Go modules / pnpm store），大幅减少"在我机器上能跑"的问题。
- 结构化开发文档体系：建立了 `docs/dev-spec/` 分层文档（按 app / shadow / backend 分区）、OpenSpec 变更提案流程（`openspec/`），为人类开发者和 AI Agent 提供一致的项目上下文。
- AI 辅助开发技能集：配套设计了一整套 Cursor Skills（涵盖 app 开发、shadow 开发、后端 proto/GORM/质量检查、原型设计、自动化测试等），使 AI 辅助编码能遵循项目约定和分层规范。

技术栈覆盖：
子项目
技术栈
ainative-app（移动端）
Taro 3.6 + Vue 3 + Pinia + TypeScript
ainative-shadow（管理后台）
Vite 7 + Vue 3 + Element Plus + Tailwind 4 + Pinia
ainative-backend（后端）
Go 1.23 + Kratos + GORM + gRPC/HTTP + PostgreSQL + Redis + RabbitMQ
与 AINative 平台的关系：ainative - workspace 不只是组内产品的开发环境，还是 AINative 平台的“标准参考项目”。AINative 的项目检测、任务执行、工作流自动化等功能，默认都是按照 ainative - workspace 的仓库结构和路径布局来适配的。这表明 ainative - workspace 的结构设计会直接影响 AINative 平台的项目接入体验以及工作流模板的实际使用情况。
产出价值： 通过这个开发套件，实现了团队跨项目联调效率的提升，新成员环境搭建从"半天到一天"缩短到"一条命令"，同时为 AINative 平台提供了真实的全栈项目作为功能验证和 Demo 展示的基础。

2. 技术方案的挑战与经验分享

挑战一：多 Agent CLI 的输出差异巨大
不同 AI Agent（Codex、Claude Code、Cursor Agent、Gemini、OpenCode）的 CLI 输出格式、流式数据结构、工具调用方式差异极大。最初尝试用统一组件渲染所有 Agent 的输出，但很快发现这条路走不通——一个 Agent 的 UI 需求变更会影响其他 Agent 的渲染。
解决方案：转向"渲染器隔离"架构，每个 Agent 独立维护自己的渲染组件，并制定了书面规范（`frontend-cli-renderer-boundaries.md`）。这个决策短期增加了一些代码重复，但大幅降低了维护风险，使得新 Agent 的接入变得安全可控。
经验：在多方适配场景下，"先独立、后抽象"比"先统一、再特化"更安全。只有当 UI 契约在多个 Agent 之间被证明稳定后，才值得提取共享抽象。

挑战二：工作流节点的循环控制
工作流中 WriteCode/ImproveCode 等节点需要支持循环执行和提前退出（marker），初始实现中 marker 路径解析存在 Bug，导致循环无法正确退出。
解决方案：修复了 marker 路径匹配逻辑，增加了循环配置的文档说明，并补充了相应的测试用例。
经验：工作流引擎类的功能需要在设计阶段就把边界情况（循环上限、退出条件、异常处理）纳入考量，而不是在调试阶段才发现。

三、项目复盘

1. 项目推动过程中的收获/个人成长

- 架构判断力的提升：从 v1 到 v2 最大的收获是学会了识别"什么该自己做，什么该交给更专业的工具"。v1 阶段尝试自建 LLM 推理和 Prompt 编排能力，投入大但效果追不上专业 Agent 产品的迭代速度；v2 果断转向 Agent CLI 模式，把执行能力交给成熟的 Agent，平台聚焦编排和治理。这个决策本质上是对"竞争力边界"的重新认知——我们的护城河不是 Agent 能力，而是企业级的工作流和协作治理。
- 全栈架构能力提升：从 0 到 1 搭建了涵盖前端、后端、数据库、缓存、容器化部署的完整系统，对全栈工程化有了更深的理解。特别是在 NestJS 模块化架构、TypeORM 迁移管理、Docker 多阶段构建等方面积累了实战经验。
- 产品思维锻炼：通过系统地调研竞品和分析产品定位，我从“按照需求做功能”提升到“了解赛道格局、找准产品切入点”。这次调研让我清楚地认识了 AI 应用开发赛道的四层结构，分别是应用生成、异步 Agent、Agentic IDE 和 AgentOps。
- Skills 体系化思维：从 v1 阶段开始推进 Skills 体系化，让我明白了把隐性知识变成显性知识、将流程标准化的意义。设计并落地 35 个以上的 Skill，本质上是在进行“研发流程的知识工程”，这个思路在 v2 中进一步升级，成为平台的核心能力。
- 工程质量意识增强：引入了 Husky 提交门禁、ESLint + oxlint 双重检查、vue-tsc 类型检查、Vitest + Playwright 测试框架，建立了从代码提交到质量验证的完整链路。

从 v1 到 v2 的架构演进
v1 版本的实现方案

AINative 的前身是 Mind2Build（即思即成）——一个基于多 Agent 协作的软件生成框架。v1 版本采用 pnpm Monorepo 架构（Express + Vue 3 + Element Plus），后端通过 LLM API 推理模式驱动 9 个 AI 角色（Salesperson、ProductManager、Architect、Engineer、QAEngineer 等）协作完成从需求到代码的全流程，内置 28+ 个 Action（WriteMRD、WritePRD、WriteDesign、WriteCode、ImproveCode、Deploy 等）。

v1 默认采用 LLM 推理模式——每个 Action 通过 `LLMExecutor` 直接调用大模型 API（OpenAI、Zhipu、Ark/豆包、DeepSeek 等），由平台自身编排 Prompt、解析输出、管理上下文。虽然后期也引入了 CLI 执行器（`CLIExecutor`）作为可选模式，但 LLM 推理仍是默认路径。这种模式存在明显的瓶颈：
- 开发难度大：每个 Action 都需要手动设计 Prompt、处理流式响应、解析结构化输出，28 个 Action 的 Prompt 工程和输出解析工作量巨大。
- 效果不稳定：纯 LLM 推理在复杂代码生成、多文件修改等场景下的输出质量波动大，缺少 Agent 工具调用（文件读写、终端执行、搜索等）的能力加持。
- 知识库 RAG 实现困难：v1 的知识库本质上是 PostgreSQL + 关键词搜索，尝试过通过 CLI 执行器做 LLM 辅助检索，但缺少真正的向量检索和 embedding 能力，在复杂项目上下文的利用上效果有限。

为什么要做 v2：

v1 的 LLM 推理模式在实践中暴露了根本性的架构瓶颈——平台自身承担了太多本应由 Agent 完成的工作（Prompt 编排、工具调用、上下文管理、代码修改），而 AI Agent 产品（Cursor、Claude Code、Codex 等）在这些能力上已经远超自研水平。继续在 v1 架构上迭代，意味着要持续投入大量精力追赶 Agent 能力，而这并不是我们的核心竞争力所在。

核心判断是：我们不应该自己做 Agent，而应该做 Agent 的调度和管理平台。让专业的 Agent 做执行，让平台做编排、治理和沉淀。

v2 相对于 v1 的核心优势：
维度
v1（Mind2Build）
v2（AINative）
执行模式
LLM API 推理为主，平台自建 Prompt + 输出解析
Agent CLI 执行为主，利用成熟 Agent 的工具调用能力
Agent 支持
仅 Cursor Agent（可选），大部分靠自研 LLM 调用
同时支持 5+ 种 Agent（Codex、Claude Code、Cursor、Gemini、OpenCode）
后端架构
Express 单体应用，Action + Role + Team 耦合
NestJS 模块化架构，12+ 独立业务模块，职责清晰
任务执行
同步 LLM 调用，流式输出有限
PTY 终端 + WebSocket 实时日志流，支持异步执行和状态追踪
知识库
PostgreSQL 关键词搜索 + CLI 辅助检索
项目上下文系统（知识库 + Git + Skills + MCP 统一组织）
工作流
固定 SOP 流程，灵活性有限
可视化工作流模板，支持节点循环、条件退出、自由编排
企业治理
基础项目管理
业务线 → 项目 → 任务三层权限模型，RBAC 能力矩阵
前端体验
Element Plus 基础 UI
Tailwind CSS 4 + Reka UI，多 Agent CLI 渲染器隔离架构
部署方式
PM2 进程管理
Docker Compose 容器化，Nginx 反向代理，一键部署
产品定位
多 Agent 软件生成框架
企业内部 AI 交付工作台

简而言之，v2 的核心转变是从"自建 Agent 能力"到"管理和编排外部 Agent"——把执行交给专业的 Agent CLI，把平台精力聚焦在需求承接、任务编排、协作治理和产物沉淀上。这个架构转变使得平台不再需要追赶 Agent 的推理和工具调用能力，而是可以即时受益于任何新 Agent 的接入。

为什么后端选择 Node.js（NestJS）而非 Go：
组内后端主力语言是 Go（Kratos + gRPC），但 AINative 平台的后端选择了 Node.js（NestJS），这是一个经过权衡的技术决策，核心原因如下：

- 与 Agent CLI 及 AI 生态天然契合：AINative 的核心能力是调度和管理 AI Agent CLI（Codex、Claude Code、Cursor 等），这些 Agent 的 CLI 工具、SDK 和生态库几乎全部基于 Node.js/TypeScript。同时，AI 应用开发领域的主流框架如 LangChain.js、LangGraph.js、Vercel AI SDK 等均以 TypeScript 作为一等公民，而 Go 在这些框架的支持上明显滞后或缺失。使用 Node.js 可以直接复用 Agent 的 npm 包和 AI 框架能力，避免了在 Go 中重新实现或通过间接调用的额外成本。
- PTY 终端与实时通信的成熟支持：任务执行引擎依赖 node-pty 创建伪终端、通过 WebSocket 推送实时日志流。Node.js 在 PTY 管理、流式 I/O、WebSocket（Socket.IO / ws）方面有成熟且活跃的生态，而 Go 在 PTY 交互和流式终端输出的处理上生态相对薄弱。
- 前后端技术栈统一：前端使用 Vue 3 + TypeScript，后端同样使用 TypeScript 可以实现类型定义共享（DTO、枚举、接口）、工具函数复用，降低全栈开发的上下文切换成本。对于一人全栈开发的场景，这一点尤为关键。
- 快速原型迭代的效率优势：AINative 处于从 0 到 1 的探索阶段，需要频繁调整 API 设计和业务逻辑。NestJS 的装饰器驱动开发模式、模块化架构和丰富的内置能力（Guards、Pipes、Interceptors、TypeORM 集成等），使得功能迭代速度显著快于 Go 的手动编写模式。
- 不选 Go 的核心考量：Go 的优势在于高并发、低延迟的微服务场景，但 AINative 后端的核心瓶颈不在计算密度或并发量，而在于 Agent 调度编排、终端管理和复杂业务流的快速实现。在这个阶段用 Go 开发，工程量会显著增加，但性能收益极为有限。

2. 自己在项目推进过程中发挥的作用

我在 v1 中的核心推动：Skills 体系化

- Skills 体系架构师：主导设计并推动团队落地了 35+ 个研发流程 Skill，覆盖需求分析、设计、编码、测试、部署、改进全链路，将团队的隐性研发知识转化为可复用的标准化流程。
- 核心架构参与者：参与 v1 多 Agent 协作框架的开发，推动了 CLI 执行器的引入和 Skills 与 Agent 的集成。

v2 阶段（一人承担产品设计与全栈开发）

v2 版本由我一人完成产品设计与全栈开发，从产品重新定位、竞品调研、架构全面重构到前后端实现、DevOps 搭建均独立推进。

- 产品设计者：我独立完成了 7 款竞品的系统调研，确定了“企业内部 AI 工作台”的产品定位，还给出了产品路线图以及优先级建议（P0/P1/P2）。从分析竞品、规划功能到设计页面，整个过程都是我推动完成的。
- 全栈架构师与开发者：我一个人完成了前端（Vue 3 + Vite + TypeScript）和后端（NestJS + TypeORM + PostgreSQL）的架构设计和所有编码工作，其中包括 12 个以上的后端业务模块以及对应的前端页面、API 层和 Store 层。
- 架构转型推动者：我推动并实现了从 v1 LLM 推理模式到 v2 Agent CLI 模式的架构转型，还把技术栈从 Express 升级到 NestJS，从 PM2 升级到 Docker。
- 多 Agent 适配架构设计者：我设计并实现了能支持 5 种以上 AI Agent 的 CLI 渲染器隔离架构和后端 Adapter Registry，还制定了书面技术规范。
- 配套工具链建设者：我额外设计并搭建了 ainative - workspace 开发套件项目，为组内全栈产品提供了 Monorepo 式集成开发环境、Docker 沙箱、结构化文档和 AI 辅助开发技能集。
- DevOps 基础建设者：我搭建了 Docker Compose 开发/部署环境、Nginx 反向代理配置、Husky 提交质量门禁，还做了全链路代码质量检查（ESLint + oxlint + vue - tsc）等工程基础设施。

3. 之前没有考虑到，没有做好，可以对于后续有指导性的思考

配套项目 AINative Workspace 的选型复盘
为什么要做大仓：
组内的全栈产品由三个独立仓库组成——移动端（ainative-app）、管理后台（ainative-shadow）、Go 后端（ainative-backend），分别由不同角色的开发维护。日常开发中，跨项目联调是高频场景：后端改了接口，前端要同步适配；管理后台改了配置，移动端要对齐逻辑。三个仓库分散管理时，联调需要频繁切换仓库、手动对齐分支、各自搭建开发环境，效率低且容易出错。大仓的核心目标就是让一个开发者在一个工作区里同时看到和修改所有层的代码，一条命令启动全栈环境。

从 Submodule 到 Subtree 的演进：
最初选择 Git Submodule 管理子项目，原因很直接：Submodule 是 Git 原生方案，概念清晰——主仓库记录子仓库的 commit 引用，各子仓库保持完全独立。但在实际使用中暴露了明显的痛点：

- 操作繁琐：`git clone` 后需要额外执行 `git submodule init && git submodule update --recursive`，新成员经常忘记或出错。
- 状态脆弱：Submodule 指针和实际代码容易脱节，`detached HEAD` 状态导致开发者困惑，不小心在 submodule 里直接提交后同步回主仓库容易出问题。
- CI/CD 复杂：需要在流水线中显式处理 submodule 初始化，增加了构建配置的复杂度。

后来切换到 Git Subtree，核心优势是对使用者更透明——子项目的代码直接嵌入主仓库的目录树，`git clone` 就能拿到全部代码，不需要额外初始化步骤。通过 Makefile 封装了 `subtree-pull` / `subtree-push` 等命令，用 `--squash` 合并策略保持提交历史简洁。

当前 Subtree 方案的问题：

Subtree 解决了 Submodule 的易用性问题，但引入了新的复杂度：

- 增加了中间项目层：ainative-workspace 本身成为了一个"中间仓库"，三个子项目的代码在这里聚合。这意味着开发者在 workspace 里修改了子项目代码后，需要先提交到 workspace 仓库，再通过 `make subtree-push-xxx feature/xxx` 推送回子项目的独立仓库。这个两步提交的流程增加了认知负担和出错风险。
- 历史膨胀：尽管使用了 `--squash`，每次 subtree pull/push 仍会在 workspace 仓库中产生合并提交，长期积累后仓库历史变得冗长。已经不得不通过 `make git-clean`（orphan branch 重置）来定期清理历史。
- 推送约束：为了防止误操作，Makefile 限制了只能推送到 `feature/*` 分支，禁止直接推送 master。这个约束是必要的安全措施，但也增加了操作步骤。
- 冲突处理困难：Subtree 的合并冲突比普通 Git 冲突更难处理，特别是在子项目和 workspace 两端都有修改时。

未来优化方向：考虑回归 Submodule

经过 Subtree 的实践，我对这个问题有了更成熟的认识。未来可能考虑回归 Submodule 方案，但用更好的工具链来解决 Submodule 原有的痛点：

- 脚本封装初始化：通过 Makefile 或脚本封装 `git submodule update --init --recursive`，解决初始化遗忘问题。
- 沙箱透明处理：在沙箱环境（Docker Compose）中自动处理 submodule 初始化，对开发者透明。
- 独立边界更清晰：Submodule 的核心优势——各子仓库保持完全独立的提交历史和分支管理——在多团队协作场景下是更自然的模型，不需要一个"中间仓库"来承载聚合逻辑。
- AI Agent 兼容性提升：AI Agent（如 Cursor、Claude Code）对 Submodule 的支持也在改善，worktree 路径解析方面的兼容性在提升。

本质上，Submodule 和 Subtree 的选择是**"使用简单性"和"管理复杂度"之间的权衡**。Subtree 让日常使用更透明，但把复杂度推到了推送和历史管理上；Submodule 让初始化稍繁琐，但项目边界更清晰、不引入中间层。随着工具链的完善和团队对 Git 操作的熟练度提升，Submodule 的简洁模型可能是更优的长期选择。

4. 发现的问题，后续需要持续完善的部分

- 需求入口体验：当前的任务创建入口还比较基础，缺少需求补全助手、智能任务拆分等 P0 能力。下一步应优先补齐"需求 → 结构化输入 → AI 补全"这段体验。
- 执行产物中心：目前任务执行的产物（代码 diff、日志、测试结果等）还比较分散，需要建立统一的产物聚合视图。
- 评测与可观测性：可观测性模块 功能偏薄，需要补充 Trace 追踪、执行结果评估、成本观察等能力。
- 异步执行与通知闭环：长任务的异步执行、排队、通知、接管能力还需要进一步完善，特别是在 Agent 执行超时、失败恢复等场景下的处理。
- 工作流架构演进：当前工作流采用串行 Pipeline 模式，节点只能依次执行，无法表达并行分支、条件汇聚等复杂编排需求。后续需要向 DAG（有向无环图）模式演进，同时实现工作流的自动化创建能力，让平台根据任务描述和项目上下文智能生成工作流。
- 项目上下文系统：知识库、历史任务、Git 记录、Skills 和 MCP 目前是相对独立的模块，还没有真正形成组织化的上下文系统来服务任务执行。

AI相关探索
- 随着AI的能力越来越强，使用也越来越普及，为紧跟技术发展趋势，提升技术团队创新能力和效率，探索AI在代码生成、审查、验收、测试、运维、数据分析等场景的应用，减少日常重复性工作，我们鼓励全员学习AI工具、探索业务场景落地及研发过程提效，包括AI工具使用、AI 流程辅助提效方面做过的尝试、希望各位在下次述职时也能把成果和经验做个总结。
- 因为AI现在发展特别快，具体的方向包括不限于：
  - 产品PRD生成、产品原型搭建
  - 代码生成与辅助
  - 代码审查与质量保证
  - 测试用例与功能调试
  - 文档撰写与知识管理
  - 迭代流程管理与优化
成果/经验：
经验 :AI Agent 编排与多工具协同
1. 遇到的问题
  市面上的 AI Agent 产品各有所长——Codex 擅长异步任务执行、Claude Code 擅长复杂推理、Cursor 擅长 IDE 内交互、Gemini 擅长多模态理解——但没有一个 Agent 能覆盖所有场景。团队需要根据任务特点选择最合适的 Agent，但各 Agent 的使用方式、输出格式、上下文管理差异极大。
1. 使用 AI 的过程
  - 多 Agent 实践对比：在实际开发 AINative v2 的过程中，针对不同场景使用不同 Agent，积累了实践对比经验：
    - Cursor Agent：适合日常的模块开发和代码修改，优势在于 IDE 集成度高，可以直接看到文件上下文。
    - Claude Code：适合复杂的架构设计讨论和大范围重构，推理能力强，能处理较长的上下文。
    - Codex：适合明确的独立任务（如"给这个模块补充单元测试"），异步执行模式适合批量任务。
  - 从使用者到平台构建者：基于自身使用多 Agent 的经验，抽象出了 AINative 平台的 Agent 适配架构。每个 Agent 的接入不仅是技术层面的 CLI 适配，更是对其擅长场景、最佳实践和局限性的理解沉淀。
  - Skill + Agent 的协同模式：探索了让不同 Agent 在执行时加载项目的 Skill 文档作为上下文约束。例如让 Codex 在异步执行编码任务时加载 `vue-best-practices` Skill，确保生成的代码符合项目的 Vue 编码规范。
2. 成果与经验
  - 多 Agent 选型方法论：形成了"任务特征 → Agent 选择"的决策框架——交互式开发选 Cursor、深度推理选 Claude、批量任务选 Codex、多模态场景选 Gemini。
  - 关键经验：AI Agent 的价值不在于"用最强的模型"，而在于"在合适的场景用合适的工具"。平台化的 Agent 管理能力（统一接入、任务分发、结果收集）比单一 Agent 的能力上限更重要。未来的趋势是 Agent 之间的协同——让不同 Agent 在同一个工作流中各司其职，而不是让一个 Agent 做所有事。
经验 :Skills 适配——将研发流程编码为 AI 可执行的知识：
1. 遇到的问题
  团队的后端开发流程涉及 Proto 定义、GORM 模型、数据库迁移、API 生成、编码实现、质量检查、审计等多个环节，每个环节都有具体的规范和约束。直接让 AI Agent（Cursor、Claude Code 等）"帮我开发一个后端功能"，AI 会按自己的理解去写代码，忽略项目的分层约定、命名规范、错误处理标准等细节。期望解决的核心问题是：如何让 AI 在执行研发任务时，严格遵循团队已有的研发流程和编码规范。
1. 使用 AI 的过程
  Skills 的使用经历了一个从粗到细、从单点到编排的完整演进过程：
  阶段一：大技能尝试
  Skills 概念刚出来时，使用 Claude Code 的 skill-creator 工具创建了一个覆盖后端开发全流程的大型 Skill。这个 Skill 试图在一份文档中描述从 Proto 定义到质量检查的所有步骤和约束，包含了接口设计规范、数据库建模规则、代码风格要求、测试标准等内容。
  阶段二：发现大技能的局限
  实际使用中发现，大技能的效果远不如预期：
  - 约束丢失严重：AI 在执行时不会按照文档中详细的约束逐条执行，面对一份冗长的 Skill 文档，AI 倾向于抓住大方向而忽略细节规则。比如 Skill 中明确要求"GORM 模型必须使用 gorm:"column:xxx" 标签"，但 AI 经常跳过这条约束。
  - 上下文窗口压力：大 Skill 文档占用大量 Token，挤压了实际任务描述和代码上下文的空间，反而降低了 AI 对当前任务的理解质量。
  - 调试困难：当 AI 输出不符合预期时，很难定位是哪条约束没有被遵循，因为所有规则混在一起。
  阶段三：按开发流程拆分为细粒度 Skill
  核心思路转变为：不是按"知识领域"组织 Skill，而是按"开发者实际的工作步骤"拆分 Skill。将后端开发流程拆分为 8 个独立的 Skill，每个 Skill 对应开发者执行的一个具体步骤：
Skill
职责
backend-proto-gen
根据需求生成 Proto 文件定义（message + service）
backend-proto-edit
编辑和调整已有的 Proto 接口定义
backend-gorm
根据 Proto message 生成 GORM 模型和数据库迁移
backend-database
数据库 Schema 设计、索引优化、迁移脚本管理
backend-api-gen
从 Proto 定义生成 API Handler / Service 骨架代码
backend-coding
业务逻辑编码实现，填充 Handler/Service 中的具体逻辑
backend-quality
代码质量检查，包括 lint、类型检查、规范校验
backend-audit
代码审计，检查安全问题、性能隐患、规范合规性
  拆分后每个 Skill 文档简短聚焦（通常 50-150 行），约束清晰明确，AI 的遵循率显著提升。例如 backend-gorm Skill 只关注 GORM 模型生成的规则，不掺杂 API 设计或 Proto 定义的内容，AI 在执行时能更准确地遵循每一条约束。
  阶段四：Skill 流程编排
  拆分为细粒度 Skill 后，新的问题是：开发者需要手动按顺序调用各个 Skill。于是探索了使用 cc-wf-studio 进行 Skill 的工作流编排。通过可视化方式定义 Skill 之间的执行顺序和依赖关系，例如：
backend-proto-gen → backend-gorm → backend-database → backend-api-gen → backend-coding → backend-quality → backend-audit
  编排后，开发者只需描述业务需求，工作流自动按序调用各 Skill，每个步骤的输出作为下一个步骤的输入，形成完整的开发流水线。
  阶段五：利用 skill-creator 的测试能力完善 Skill
  Claude Code 的 skill-creator 后续更新了 Skill 测试功能（eval），利用这个能力对已有的 Skill 进行系统化完善：
  1. 评估系统，跑完直接告诉你这个skill到底行不行。
  2. 基准测试，把通过率、耗时、token用量，全都量化。
  3. 多代理并行测试，每个测试在干净的环境里独立跑，支持A/B盲评，结果不互相污染。
  4. 描述调优，可以自动帮你改skill描述，该触发的触发，不该触发的就别乱触发。
1. 成果与经验
  成果：
  - 建立了覆盖后端开发全流程的 8 个细粒度 Skill，每个 Skill 聚焦一个具体步骤，约束清晰可测试
  - 通过工作流编排实现了 Skill 的自动化串联执行，从"人工逐个调用"升级为"描述需求 → 自动走完流程"
  - 通过 skill-creator 的测试功能建立了 Skill 的质量验证机制，使 Skill 可以像代码一样被测试和迭代
  经验：
  - 大 Skill 不如小 Skill：AI 对短而明确的约束遵循度远高于长而全面的文档。一个 100 行的聚焦 Skill 比一个 500 行的全面 Skill 效果好得多。
  - 按工作步骤拆分而非按知识域拆分：Skills 的粒度应该对应"开发者执行的一个动作"而非"一个技术领域"。前者 AI 能明确知道"这次我要做什么"，后者 AI 容易在多个目标间迷失。
  - Skill 需要测试：和代码一样，Skill 也会有"Bug"（表述模糊、约束冲突、遗漏边界）。引入测试机制后，Skill 的质量和稳定性有了质的提升。
  - 编排是 Skill 价值放大器：单个 Skill 解决单步效率，编排后解决全流程效率。工作流编排让 Skills 从"工具"变成了"流程"。