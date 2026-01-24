# 即思即成（Mind2Build）项目文档导航

**Slogan**: 让所思，即所得

## 文档概述

本文档集为即思即成（Mind2Build）多代理协作框架提供完整的项目文档，涵盖产品需求、技术规格、系统架构、任务拆解、API 参考等内容，帮助开发者理解和实现该框架。

**技术架构**: Node.js + TypeScript + Vue 3 + Vite + PostgreSQL

---

## 📚 文档结构

### 一、需求与规划文档

#### 1. [项目需求文档](./01_项目需求文档.md)
- 项目概述与愿景
- 核心功能需求（多角色代理、SOP、消息系统等）
- 非功能性需求（性能、可扩展性、可靠性等）
- 使用场景与成功标准

#### 2. [产品需求文档 PRD](./02_产品需求文档_PRD.md)
- 详细的用户故事
- 功能优先级
- 验收标准
- 产品路线图

### 二、技术规格文档

#### 3. [技术规格文档 SPEC](./03_技术规格文档_SPEC.md)
- 项目背景与目标
- 功能范围定义
- 核心功能规格
- 数据与状态模型
- 非功能性要求
- 测试与验证策略

#### 4. [系统架构文档](./04_系统架构文档_ARCHITECTURE.md)
- 整体架构设计
- 核心模块划分
- 组件关系图
- 技术选型说明

#### 19. [目录结构设计](./19_目录结构设计_STRUCTURE.md)
- 总体目录结构
- 后端目录详解（Node.js）
- 前端目录详解（Vue + Vite）
- 数据库目录组织
- 配置文件说明
- 目录设计原则与扩展指南

### 三、详细设计文档

#### 5. [核心类设计文档](./05_核心类设计_CLASSES.md)
- BaseRole / Role 设计
- Action 系统设计
- Message 消息系统
- Environment 环境设计
- Memory 记忆系统
- Context 上下文管理

#### 6. [角色系统设计](./06_角色系统设计_ROLES.md)
- Salesperson（销售）- 需求收集与需求说明
- ProductManager（产品经理）
- Architect（架构师）
- Engineer（工程师）
- QA Engineer（QA 工程师）
- Project Manager（项目经理）
- Data Analyst（数据分析师）
- 自定义角色开发指南

#### 7. [行动系统设计](./07_行动系统设计_ACTIONS.md)
- WriteMRD（编写市场研究文档）
- MRDReview（MRD文档审查）
- WritePRD（编写 PRD）
- PRDReview（PRD文档审查）
- ImproveDocument（改进文档）
- WriteDesign（编写设计）
- DesignReview（设计文档审查）
- BreakdownTasks（任务拆分）
- WriteSubProjectDesign（子项目设计）
- SubProjectDesignReview（子项目设计审查）
- GenerateTask（生成任务说明）
- WriteCode（编写代码）
- ExecuteSubtask（执行子任务）
- CodeReview（代码审查）
- WriteTest（编写测试）
- SearchEnhancedQA（增强搜索问答）
- DataAnalysis（数据分析）
- Coordinate（协调任务）
- 自定义 Action 开发指南

#### 8. [LLM 提供商集成](./08_LLM提供商集成_PROVIDERS.md)
- LLM 抽象层设计（统一 OpenAICompatibleLLM 架构）
- ✅ 已实现：OpenAI、智谱AI (ZhipuAI)、火山引擎 Ark (豆包)、DeepSeek、Cursor Agent
- ⚙️ 可配置支持：Anthropic Claude、Google Gemini、百度千帆、阿里云 DashScope、Ollama
- 自定义提供商开发指南

### 四、数据流与工作流

#### 9. [数据流文档](./09_数据流文档_DATAFLOW.md)
- 消息路由机制
- 角色间通信流程
- 内存读写流程
- LLM 调用流程
- 知识库检索流程（RAG）
- 工作流数据流（多角色串联）
- 知识库更新流程

#### 10. [工作流文档](./10_工作流文档_WORKFLOW.md)
- 软件公司标准流程
- Git仓库管理流程
- 增量开发流程
- 数据分析流程
- 多角色串联工作流（输入输出映射）
- 交互模式工作流
- 工作流可视化设计器
- 自定义工作流设计

#### 29. [PRD 生成文档](./29_PRD生成文档_PRD_GENERATION.md)
- PRD 生成输入与模式
- 分步骤生成与审查改进流程
- Workspace 结构与版本管理
- API 接口与配置项

### 五、实现指南

#### 11. [任务拆解文档](./11_任务拆解文档_TASKS.md)
- Phase 1: 环境搭建
- Phase 2: 核心基础设施
- Phase 3: LLM 提供商集成
- Phase 4-7: 角色与行动实现
- Phase 8-10: 测试与文档

#### 12. [API 参考文档](./12_API参考文档_API.md)
- REST API（项目管理、应用管理、交互式会话、Git仓库管理）
- WebSocket API（实时通信）
- 工作流 API（创建、执行、调整顺序、更新映射）
- 知识库 API（关联、检索、更新）
- 角色调试 API（独立调试、日志、性能监控）
- CLI 命令
- 配置 API
- 扩展 API

#### 13. [配置管理文档](./13_配置管理_CONFIG.md)
- 配置文件结构（TypeScript配置）
- 环境变量配置
- LLM 配置（系统默认、角色特定）
- 知识库配置（文档库、代码仓库、API文档库）
- 工作流配置（多角色串联、输入输出映射）
- 工具配置

### 六、开发与部署

#### 14. [开发指南](./14_开发指南_DEVELOPMENT.md)
- 开发环境搭建
- 代码规范
- 测试规范
- 调试技巧

#### 15. [部署指南](./15_部署指南_DEPLOYMENT.md)
- 安装部署
- 容器化部署
- 性能优化
- 故障排查

#### 16. [实现示例](./16_实现示例_EXAMPLES.md)
- 创建简单游戏
- 数据分析任务
- 增量开发示例
- 自定义角色示例
- 自定义行动示例

### 七、AI 协作规范

#### 17. [AI 协作指南](./17_AI协作指南_AGENT.md)
- AI 角色定义
- 行为准则
- 代码生成约束
- 交互约定
- 失败处理策略

### 八、数据持久化

#### 18. [数据库设计](./18_数据库设计_DATABASE.md)
- 数据库表结构设计（PostgreSQL）
- ER 图与关系设计
- 索引与性能优化
- 数据迁移策略
- 原生 SQL 实现（pg 驱动）

### 九、配置指南

#### 20. [智谱AI配置指南](./20_智谱AI配置指南_GLM.md)
- 智谱AI简介与优势
- 获取和配置API密钥
- 模型选择与对比（GLM-4系列）
- 使用示例与最佳实践
- 常见问题与解决方案
- 成本优化建议

#### 21. [数据库配置指南](./21_数据库配置指南_DBSETUP.md)
- PostgreSQL安装与配置
- 数据库创建与用户管理
- 连接字符串配置
- Prisma ORM设置
- 数据迁移与种子数据
- 备份恢复与性能优化

### 十、交互模式指南

#### 22. [交互模式使用指南](./22_交互模式使用指南_INTERACTIVE.md)
- CLI交互模式使用
- 用户操作选项说明
- 编辑器集成
- 状态保存和恢复

#### 23. [前端交互模式实现指南](./23_前端交互模式实现指南_FRONTEND_INTERACTIVE.md)
- Web交互模式实现
- WebSocket通信机制
- 前端组件设计
- 实时更新处理

#### 26. [SOP流程对比与优势分析](./26_SOP流程对比与优势分析.md)
- 原有流程（自动模式）说明
- 新流程（交互模式）说明
- 流程对比分析
- 优势分析
- 新SOP详细说明
- 使用场景建议

### 十一、设计与实施

#### 24. [设计方案文档](./24_设计方案_DESIGN.md) ✨
- 系统概述与架构设计
- 核心模块详细设计
- 技术选型说明
- 数据模型设计
- 接口设计（REST API、WebSocket）
- 安全设计与性能优化
- 扩展性设计

#### 25. [项目介绍与使用指南](./25_项目介绍与使用指南.md) ✨
- 项目简介与特点
- 核心能力说明
- 快速开始指南
- 使用方式（CLI、Web、API、编程）
- 使用场景与最佳实践
- 常见问题解答
- 进阶使用技巧

---

## 📖 文档阅读指南

### 快速入门路径
1. 先阅读 `25_项目介绍与使用指南.md` 了解项目和使用方式 ⭐
2. 阅读 `01_项目需求文档.md` 了解项目整体
3. 阅读 `04_系统架构文档_ARCHITECTURE.md` 理解架构
4. 查看 `16_实现示例_EXAMPLES.md` 快速上手
5. 参考 `15_部署指南_DEPLOYMENT.md` 进行安装

### 深入学习路径
1. `03_技术规格文档_SPEC.md` → 理解技术决策
2. `05_核心类设计_CLASSES.md` → 理解核心抽象
3. `06_角色系统设计_ROLES.md` + `07_行动系统设计_ACTIONS.md` → 理解业务实现
4. `09_数据流文档_DATAFLOW.md` → 理解运行机制
5. `11_任务拆解文档_TASKS.md` → 按步骤实现

### 扩展开发路径
1. `12_API参考文档_API.md` → 了解扩展接口
2. `06_角色系统设计_ROLES.md` → 自定义角色开发
3. `07_行动系统设计_ACTIONS.md` → 自定义行动开发
4. `14_开发指南_DEVELOPMENT.md` → 遵循开发规范

---

## 🎯 文档使用场景

| 场景 | 推荐文档 |
|------|---------|
| **首次使用** | **26** ⭐ |
| 了解项目概况 | 01, 02, 04, 26 |
| 快速上手 | 26, 16 |
| 技术选型评估 | 03, 04, 08 |
| 系统设计参考 | 03, 04, 05, 09, 10, 24 |
| 项目结构设计 | 19, 04, 11 |
| 开发实现 | 05, 06, 07, 11, 14, 19 |
| 数据库设计与配置 | 18, 21 |
| LLM配置（智谱AI） | 20, 08, 13 |
| API 集成 | 12, 13, 16 |
| 部署运维 | 13, 15, 25 |
| 问题排查 | 09, 15, 20, 21, 25, 26 |
| AI 辅助开发 | 11, 17 |
| 系统设计参考 | 24 |
| 开发实施 | 25 |
| 交互模式使用 | 22, 23 |

---

## 📝 文档维护

- **当前版本**: v1.6
- **最后更新**: 2026-01-25
- **维护状态**: 活跃维护中

### 更新日志
- 2026-01-25: 新增CLI知识库设计方案文档（31），提供基于CLI模式的知识库实现方案，支持通过CLI工具读取和分析历史代码和文档，为MRD/PRD生成提供上下文，无需依赖RAG向量数据库
- 2026-01-21: 全面更新文档与代码同步：
  - 更新行动系统设计文档（07），添加 12 个新 Actions（WriteTestPlan、TestabilityReview、TestCaseReview、TestReview、ImproveTest、AutomationPlanning、AutomationExecution、CoverageQualityCheck、QAConclusion、RunCode、FixBug、ImproveDesign），移除不存在的 GenerateTask，更新 ImproveDocument 为独立的 ImprovePRD/ImproveMRD/ImproveDesign
  - 更新角色系统设计文档（06），完善 QAEngineer 角色的 9 步 QA 工作流说明
  - 更新 LLM 提供商文档（08），说明统一的 OpenAICompatibleLLM 架构，添加 DeepSeek 提供商
  - 更新 API 参考文档（12），移除 Python API 内容，添加 TypeScript API 参考，完善 Role Action Execution API
  - 更新架构文档（04）、核心类设计文档（05）、数据流文档（09）、工作流文档（10）
- 2026-01-07: 根据PRD、架构文档、技术规格文档更新所有相关文档，添加知识库系统（RAG检索、代码仓库关联）、多角色串联工作流（输入输出映射）、角色独立调试能力等新功能说明
- 2026-01-06: 根据实际代码实现全面更新文档导航、项目需求文档、产品需求文档和技术规格文档，修正技术栈（Node.js + TypeScript + Vue 3），更新角色和Actions列表，添加交互模式和Web UI说明，更新LLM提供商状态
- 2025-12-25: 根据代码实现更新角色系统设计文档，详细说明每个角色的监听机制、Actions 和工作流程，移除不存在的 CodeReview action，添加各角色的实际监听目标和约束条件
- 2025-12-25: 根据代码实现全面更新文档，修正技术栈描述（Node.js + TypeScript，而非 Python），更新 Actions 列表（WriteMRD, MRDReview, DesignReview, SubProjectDesignReview, ExecuteSubtask），添加 WebSocket API 文档，更新 LLM 提供商状态（OpenAI, ZhipuAI, Ark, Cursor）
- 2025-12-25: 根据代码实现更新文档，添加 ProjectManager 角色和新增 Actions（BreakdownTasks, WriteSubProjectDesign, CodeReview）的完整描述
- 2025-12-25: 新增项目介绍与使用指南(25)、设计方案文档(24)
- 2025-12-24: 初始版本创建，完整文档结构建立

---

## 🔗 技术架构

- **后端**: Node.js + TypeScript + Express
- **前端**: Vue 3 + Vite + TypeScript
- **数据库**: PostgreSQL
- **包管理**: pnpm (monorepo)
- **核心理念**: Code = SOP(Team)
- **特色**: 让所思，即所得

---

## 💡 使用建议

1. **首次阅读**: 按照"快速入门路径"顺序阅读
2. **实现开发**: 结合"深入学习路径"和"任务拆解文档"
3. **遇到问题**: 参考相关章节的"故障排查"部分
4. **扩展功能**: 遵循"扩展开发路径"和开发规范

---

*本文档集采用渐进式学习方法组织，既适合快速上手，也支持深入研究。建议根据自己的需求选择合适的阅读路径。*
