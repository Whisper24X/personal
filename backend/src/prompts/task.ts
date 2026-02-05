/**
 * 任务拆分提示词
 *
 * 本文件包含任务拆分相关的提示词模板和函数。
 * ProjectManager 角色使用这些提示词来：
 * 1. 基于 PRD 文档进行任务拆分（BreakdownTasks）
 */

/**
 * 任务拆分系统提示词
 *
 * 用于指导 AI 如何将 PRD 文档拆分为最小颗粒度的任务。
 * 每个任务应该：
 * - 可在 1-3 天内完成
 * - 可独立完成、可测试、可交付
 * - 明确标注任务类型（前端/后端）
 *
 * @usedBy BreakdownTasks Action
 */
export const TASK_BREAKDOWN_SYSTEM_PROMPT = `
你是一位资深项目管理专家（Project Manager），
拥有丰富的软件项目管理和任务拆分经验。

你的职责包括：
- 基于PRD文档，将项目拆分为最小颗粒度的任务
- 确保每个任务都是可独立完成、可测试、可交付的
- 识别任务之间的依赖关系
- 评估任务优先级和复杂度
- 为工程师提供清晰的任务描述和验收标准
- 明确标注每个任务的角色（前端/后端）

你必须遵循以下原则：
- 任务拆分要符合最小颗粒度原则（每个任务应该在1-3天内完成）
- 每个任务必须有明确的输入、输出和验收标准
- 任务描述要清晰、具体、可执行
- 必须明确标注任务类型（前端/后端），这是任务角色的关键信息
- 考虑前后端分离、模块化开发的最佳实践
`;

/**
 * 任务拆分文档模板
 *
 * 定义了任务拆分文档的标准格式，包括：
 * - 项目概述
 * - 任务列表（每个任务包含类型、优先级、工时、依赖、描述、输入输出、验收标准等）
 *
 * @usedBy BreakdownTasks Action
 */
export const TASK_BREAKDOWN_TEMPLATE = `
# 任务拆分文档

## 1. 项目概述
- 项目名称：
- 项目描述：
- 拆分依据：PRD + 系统设计文档

## 2. 任务列表

### 任务 {task_id}: {task_name}
- **任务类型**：{task_type} (前端/后端)
- **优先级**：{priority} (P0/P1/P2/P3)
- **预估工时**：{estimated_hours} 小时
- **依赖任务**：{dependencies}
- **任务描述**：
  {task_description}

- **输入**：
  {inputs}

- **输出**：
  {outputs}

- **验收标准**：
  {acceptance_criteria}

- **技术要点**：
  {technical_points}

---

`;

/**
 * 构建任务拆分提示词
 *
 * 基于 PRD 文档生成任务拆分的用户提示词。
 *
 * @param prd - 产品需求文档（PRD）内容
 * @returns 任务拆分的用户提示词
 * @usedBy BreakdownTasks Action
 */
export function buildTaskBreakdownPrompt(prd: string): string {
  return `
你将基于以下【产品需求文档（PRD）】进行任务拆分。

【PRD 内容】
${prd}

【强制要求】
1. 任务拆分必须符合最小颗粒度原则：
   - 每个任务应该在1-3天内完成
   - 每个任务必须是可独立完成、可测试、可交付的
   - 避免任务过大或过小

2. 任务分类（必须明确标注任务角色）：
   - 前端任务：UI组件、页面、状态管理、API集成等（任务类型标注为"前端"）
   - 后端任务：API接口、业务逻辑、数据模型、服务层等（任务类型标注为"后端"）

3. 每个任务必须包含：
   - 任务ID和名称
   - 任务类型（前端/后端）- 必须明确标注任务角色，只能是"前端"或"后端"
   - 优先级（P0最高，P3最低）
   - 预估工时
   - 依赖任务列表
   - 详细的任务描述
   - 明确的输入和输出
   - 清晰的验收标准
   - 技术要点和注意事项

4. 识别任务依赖关系：
   - 明确标注哪些任务必须先完成
   - 识别可以并行开发的任务
   - 考虑前后端接口约定的依赖

5. 输出格式：
   - 使用Markdown格式
   - 按照任务拆分模板结构输出
   - 任务按优先级和依赖关系排序
   - 使用格式：### 任务 {task_id}: {task_name}

现在开始进行任务拆分。
`;
}

/**
 * 任务生成系统提示词
 *
 * @deprecated GenerateTask Action 已移除，此提示词不再使用
 * 用于指导 AI 如何基于任务拆分文档生成详细的开发任务说明。
 * 为每个任务提供：
 * - 任务背景和目标
 * - 技术实现方案
 * - 代码结构建议
 * - 关键代码示例
 * - 测试要点
 * - 注意事项和最佳实践
 */
export const TASK_GENERATION_SYSTEM_PROMPT = `
你是一位资深技术专家，
擅长为工程师生成详细、可执行的任务说明。

你的职责包括：
- 基于任务拆分，生成具体的开发任务
- 为每个任务提供详细的技术实现指导
- 明确任务的输入、输出和验收标准
- 提供代码示例和最佳实践建议
`;

/**
 * 构建任务生成提示词
 *
 * @deprecated GenerateTask Action 已移除，此函数不再使用
 *
 * @param taskBreakdown - 任务拆分文档内容
 * @returns 任务生成的用户提示词
 */
export function buildTaskGenerationPrompt(taskBreakdown: string): string {
  return `
你将基于以下【任务拆分文档】生成详细的开发任务说明。

【任务拆分文档】
${taskBreakdown}

【要求】
1. 为每个任务生成详细的开发指南，包括：
   - 任务背景和目标
   - 技术实现方案
   - 代码结构建议
   - 关键代码示例
   - 测试要点
   - 注意事项和最佳实践

2. 确保任务说明：
   - 清晰、具体、可执行
   - 包含足够的技术细节
   - 便于工程师理解和实施

现在开始生成任务说明。
`;
}

// ==================== OpenSpec 提示词 ====================

/**
 * 项目上下文填充路径配置
 */
export interface FillProjectContextPaths {
  projectMdPath: string; // openspec/project.md 路径
  designPath: string; // DESIGN.md 路径
  prdPath: string; // PRD.md 路径
  agentsPath: string; // AGENTS.md 路径
}

/**
 * 构建项目上下文填充提示词
 * @param paths 文档路径配置
 * @returns 项目上下文填充提示词
 * @usedBy FillProjectContext Action
 */
export function buildFillProjectContextPrompt(paths: FillProjectContextPaths): string {
  return `请阅读 ${paths.projectMdPath}，帮我补充完善关于当前项目、技术栈和开发规范等内容，参考 ${paths.designPath}、${paths.prdPath}、${paths.agentsPath} 这三个文档，用中文完善`;
}

/**
 * OpenSpec 变更提案路径配置
 */
export interface OpenSpecProposalPaths {
  prdPath: string; // PRD.md 路径
  designPath: string; // DESIGN.md 路径
  agentsPath: string; // AGENTS.md 路径
  devSpecPath: string; // dev-spec 目录路径（开发规范文档）
  // 模板代码路径
  appTemplatePath: string; // ainative-app 模板代码
  backendTemplatePath: string; // ainative-backend 模板代码
  shadowTemplatePath: string; // ainative-shadow 模板代码
  // Docker 沙箱环境路径
  sandboxPath: string; // Docker 沙箱环境配置路径
  makefilePath: string; // Makefile 路径（包含沙箱命令）
}

/**
 * 构建 OpenSpec 变更提案创建提示词
 * @param paths 文档路径配置
 * @returns OpenSpec 变更提案创建提示词
 * @usedBy CreateOpenSpecProposal Action
 */
export function buildCreateOpenSpecProposalPrompt(paths: OpenSpecProposalPaths): string {
  return `创建openSpec变更提案 
1. 读取并分析以下文档：
   - ${paths.prdPath}（产品需求文档）
   - ${paths.designPath}（系统设计文档）
   - ${paths.agentsPath}（项目代理和开发指南）
   - ${paths.devSpecPath}（开发规范文档，必须参考）

2. 参考以下模板代码（了解项目代码结构和实现方式）：
   - ${paths.appTemplatePath}（移动端应用模板代码）
   - ${paths.backendTemplatePath}（后端服务模板代码）
   - ${paths.shadowTemplatePath}（前端管理后台模板代码）

3. 了解 Docker 沙箱开发环境：
   - ${paths.makefilePath}（沙箱管理命令，使用 make sandbox 启动沙箱）
   - ${paths.sandboxPath}（Docker 配置和启动脚本）

用中文完善

重要要求：
- 任务清单只包含开发实现相关的任务（数据库设计、后端实现、前端实现等）
- 不要生成"测试与验证"章节
- 不要生成"文档与部署"章节
- 任务清单应该以开发实现为核心，聚焦于代码开发任务
- 必须参考开发规范文档（dev-spec），确保生成的代码符合项目技术规范
- 必须参考模板代码，了解项目现有的代码结构和实现模式

Docker 沙箱环境要求：
- 数据库表创建、数据库迁移等操作必须在 Docker 沙箱环境中运行
- 使用 make sandbox 启动沙箱容器，使用 make sandbox-shell 进入沙箱执行命令
- 沙箱环境已预装 PostgreSQL、Redis、Go、Node.js、Nginx 等开发工具
- 数据库连接信息参考 sandbox/Dockerfile 中的环境变量配置（DB_HOST=localhost, DB_PORT=5432, DB_USER=postgres, DB_PASSWORD=123456）
- 沙箱首次启动会自动初始化 PostgreSQL 数据库并运行 init.sql 脚本
- 所有数据库操作都应在容器内执行，不要在宿主机直接操作数据库`;
}

/**
 * OpenSpec 变更提案验证提示词（不涉及路径，保持常量）
 * @usedBy ValidateOpenSpecProposal Action
 */
export const VALIDATE_OPENSPEC_PROPOSAL_PROMPT = `执行指令openspec-validate 检查变更提案的格式、结构是否符合 OpenSpec 规范（避免格式错误）,符合规范返回：SUCCESS，不符合返回: FAIL`;

/**
 * 构建 OpenSpec 内容审查提示词
 * @param skillPath openspec-validator skill 文件路径
 * @returns OpenSpec 内容审查提示词
 * @usedBy ValidateOpenSpecContent Action
 */
export function buildValidateOpenSpecContentPrompt(skillPath: string): string {
  return `请阅读并执行技能文件 ${skillPath} 中定义的审查流程：

1. 定位当前工作的 openspec 变更目录
2. 收集 PRD 和 design.md 作为基准文档
3. 遍历审查所有 openspec 规范文件：
   - 冲突检查：与 PRD/design 不一致的内容
   - 缺失检查：PRD/design 中有但规范中缺失的内容
   - 错误检查：规范内部的逻辑错误
4. 自动修正发现的问题
5. 生成详细的审查报告

按照技能文件中的【修改原则】和【输出格式】执行。`;
}

/**
 * 故事点评估路径配置
 */
export interface EstimateStoryPointsPaths {
  tasksFile: string; // 任务文件路径（如 openspec/changes/xxx/tasks.md）
  estimationBasePath: string; // 故事点评估基准文档路径
}

/**
 * 构建故事点评估提示词
 * @param paths 文件路径配置
 * @returns 故事点评估提示词
 * @usedBy EstimateStoryPoints Action
 */
export function buildEstimateStoryPointsPrompt(paths: EstimateStoryPointsPaths): string {
  const outputFile = paths.tasksFile.replace('tasks.md', 'tasks-with-estimates.md');

  return `请执行以下任务：

1. 读取文件 ${paths.tasksFile}（任务列表）
2. 读取文件 ${paths.estimationBasePath}（故事点评估基准）
3. 在同一目录下创建 ${paths.tasksFile} 的副本，命名为 ${outputFile}
4. 分析副本文档中每个任务的复杂度（参考评估基准）：
   - 接口数量
   - UI页面数
   - 业务逻辑复杂度
   - 数据表数量
   - 状态管理复杂度
5. 对比评估基准中的示例（3个故事点的应用更新功能作为基准点）
6. 为副本文档中的每个任务添加故事点评估（只能使用：1、2、3、5、8）
7. 在每个任务描述后添加故事点标记，格式：**故事点: X**
8. 确保所有任务都有故事点评估，不要遗漏任何任务

注意：
- 严格按照评估基准文档中的标准进行评估
- 如果任务超过8个故事点，标注并建议拆分
- 用中文完成所有内容`;
}

/**
 * 构建故事点评估验证提示词
 * @param estimatesFile 带故事点评估的任务文件路径
 * @returns 故事点评估验证提示词
 * @usedBy ValidateStoryPointEstimates Action
 */
export function buildValidateStoryPointEstimatesPrompt(estimatesFile: string): string {
  return `检查文件 ${estimatesFile}：

1. 统计文档中的任务总数
2. 统计包含"**故事点: X**"标记的任务数量（X必须是1、2、3、5、8中的一个）
3. 检查是否所有任务都有故事点评估

请以JSON格式返回，只返回JSON，不要返回其他内容：
{
  "result": "SUCCESS" 或 "INCOMPLETE",
  "totalTasks": N,
  "estimatedTasks": M,
  "reason": "说明具体原因"
}

如果所有任务都有评估，返回 SUCCESS
如果有任务未评估，返回 INCOMPLETE`;
}

// ==================== 子项目设计提示词 ====================

/**
 * 子项目设计系统提示词
 *
 * 用于指导 AI 如何生成子项目设计文档。
 *
 * @usedBy WriteSubProjectDesign Action
 */
export const SUB_PROJECT_DESIGN_SYSTEM_PROMPT = `
你是一位资深系统架构师，
拥有丰富的软件系统设计和技术架构经验。

你的职责包括：
- 基于任务拆分和系统设计，生成详细的子项目设计文档
- 定义清晰的技术架构和模块划分
- 设计合理的API接口和数据模型
- 考虑系统的可扩展性、可维护性和安全性

你必须遵循以下原则：
- 设计文档要清晰、完整、可执行
- 技术选型要有据可依
- 接口设计要符合RESTful规范
- 数据模型要考虑扩展性
`;

/**
 * 构建子项目设计提示词
 *
 * @param taskBreakdown - 任务拆分文档内容
 * @param design - 系统设计文档内容
 * @returns 子项目设计的用户提示词
 * @usedBy WriteSubProjectDesign Action
 */
export function buildSubProjectDesignPrompt(taskBreakdown: string, design: string): string {
  return `
你将基于以下【任务拆分文档】和【系统设计文档】生成子项目设计文档。

【任务拆分文档】
${taskBreakdown}

【系统设计文档】
${design}

【输出要求】
请生成完整的子项目设计文档，包括：
1. 子项目概述 - 项目背景、目标、范围
2. 技术架构设计 - 整体架构、技术栈选型
3. API接口设计 - 接口列表、请求/响应格式
4. 数据模型设计 - 数据库表结构、字段说明
5. 前端组件设计 - 页面结构、组件划分
6. 依赖关系说明 - 模块依赖、外部服务依赖
7. 开发指南 - 开发环境配置、代码规范

请使用Markdown格式输出，确保内容详细、具体、可执行。
`;
}

/**
 * 子项目设计审查系统提示词
 *
 * 用于指导 AI 如何审查子项目设计文档。
 *
 * @usedBy SubProjectDesignReview Action
 */
export const SUB_PROJECT_DESIGN_REVIEW_SYSTEM_PROMPT = `
你是一位资深技术评审专家，
拥有丰富的代码审查和设计审查经验。

你的职责包括：
- 审查子项目设计文档的完整性和质量
- 识别设计中的问题和风险
- 提出改进建议和优化方案
- 确保设计符合最佳实践

审查要点：
- 架构设计是否合理
- 接口设计是否清晰完整
- 数据模型是否规范
- 是否考虑了扩展性和安全性
`;

/**
 * 构建子项目设计审查提示词
 *
 * @param designContent - 子项目设计文档内容
 * @param outline - 文档大纲
 * @returns 子项目设计审查的用户提示词
 * @usedBy SubProjectDesignReview Action
 */
export function buildSubProjectDesignReviewPrompt(designContent: string, outline: string): string {
  return `
请审查以下【子项目设计文档】，评估其完整性和质量。

【文档大纲】
${outline}

【子项目设计文档】
${designContent}

【审查要求】
请从以下方面进行审查：

1. 完整性检查：
   - 是否包含所有必需章节
   - 每个章节内容是否完整

2. 技术设计审查：
   - 架构设计是否合理
   - 技术选型是否恰当
   - 是否考虑了扩展性

3. 接口设计审查：
   - API设计是否符合RESTful规范
   - 请求/响应格式是否清晰
   - 错误处理是否完善

4. 数据模型审查：
   - 表结构设计是否合理
   - 字段定义是否完整
   - 是否考虑了数据一致性

5. 问题与建议：
   - 列出发现的问题（按严重程度分类）
   - 提出具体的改进建议

请使用Markdown格式输出审查报告。
`;
}
