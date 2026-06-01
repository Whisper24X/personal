/**
 * 知识库模块
 * 整合知识映射和结构化知识功能
 */

// ====== Part 1: Types & Enums (原 knowledgeMapping.ts) ======

/**
 * 知识类型枚举
 */
export enum KnowledgeType {
  /** 业务规则 - 业务逻辑、计算公式、合规要求 */
  BUSINESS_RULES = 'BUSINESS_RULES',
  /** 历史PRD - 已有功能、保持一致性 */
  HISTORY_PRD = 'HISTORY_PRD',
  /** 历史MRD - 已分析的需求、市场研究 */
  HISTORY_MRD = 'HISTORY_MRD',
  /** 技术约束 - 性能限制、架构边界、接口规范 */
  TECH_CONSTRAINTS = 'TECH_CONSTRAINTS',
  /** 竞品分析 - 竞品功能、行业趋势 */
  COMPETITOR_ANALYSIS = 'COMPETITOR_ANALYSIS',
  /** 术语词典 - 统一术语定义 */
  TERMINOLOGY = 'TERMINOLOGY',
  /** 功能清单 - 现有功能列表 */
  FEATURE_LIST = 'FEATURE_LIST',
  /** 开发规范 - 各子项目的开发规范和架构说明 */
  DEV_SPEC = 'DEV_SPEC',
}

/**
 * 知识类型对应的目录路径
 */
export const KNOWLEDGE_TYPE_PATHS: Record<KnowledgeType, string[]> = {
  [KnowledgeType.BUSINESS_RULES]: ['docs/business-knowledge/'],
  [KnowledgeType.HISTORY_PRD]: ['docs-archive/prd/'],
  [KnowledgeType.HISTORY_MRD]: ['docs-archive/mrd/'],
  [KnowledgeType.TECH_CONSTRAINTS]: ['docs/dev-spec/'],
  [KnowledgeType.COMPETITOR_ANALYSIS]: ['docs-archive/mrd/'],
  [KnowledgeType.TERMINOLOGY]: ['docs/business-knowledge/', 'docs-archive/'],
  [KnowledgeType.FEATURE_LIST]: ['docs-archive/prd/', 'docs/business-knowledge/'],
  [KnowledgeType.DEV_SPEC]: ['docs/dev-spec/'],
};

/**
 * 知识类型的中文标签
 */
export const KNOWLEDGE_TYPE_LABELS: Record<KnowledgeType, string> = {
  [KnowledgeType.BUSINESS_RULES]: '业务规则',
  [KnowledgeType.HISTORY_PRD]: '历史PRD',
  [KnowledgeType.HISTORY_MRD]: '历史MRD',
  [KnowledgeType.TECH_CONSTRAINTS]: '技术约束',
  [KnowledgeType.COMPETITOR_ANALYSIS]: '竞品分析',
  [KnowledgeType.TERMINOLOGY]: '术语定义',
  [KnowledgeType.FEATURE_LIST]: '功能清单',
  [KnowledgeType.DEV_SPEC]: '开发规范',
};

/**
 * 知识类型业务可读标签（用于 version-review 等面向业务人员的场景）
 */
export const KNOWLEDGE_TYPE_LABELS_FOR_BUSINESS: Record<KnowledgeType, string> = {
  [KnowledgeType.BUSINESS_RULES]: '业务规则',
  [KnowledgeType.HISTORY_PRD]: '历史需求文档',
  [KnowledgeType.HISTORY_MRD]: '市场调研',
  [KnowledgeType.TECH_CONSTRAINTS]: '系统限制',
  [KnowledgeType.COMPETITOR_ANALYSIS]: '竞品分析',
  [KnowledgeType.TERMINOLOGY]: '术语词典',
  [KnowledgeType.FEATURE_LIST]: '现有功能',
  [KnowledgeType.DEV_SPEC]: '开发规范',
};

/**
 * 章节-知识映射配置
 */
export interface SectionKnowledgeMapping {
  /** 章节编号 */
  sectionNumber: number;
  /** 章节标题 */
  sectionTitle: string;
  /** 适用的知识类型 */
  knowledgeTypes: KnowledgeType[];
  /** 推荐的检索查询模板 */
  searchQueries: string[];
  /** 验证规则（用于审核时校验） */
  validationRules: string[];
}

/**
 * MRD 章节-知识映射关系
 */
export const MRD_SECTION_KNOWLEDGE_MAP: SectionKnowledgeMapping[] = [
  {
    sectionNumber: 1, // 背景与问题定义
    sectionTitle: '背景与问题定义',
    knowledgeTypes: [KnowledgeType.HISTORY_MRD, KnowledgeType.COMPETITOR_ANALYSIS, KnowledgeType.BUSINESS_RULES],
    searchQueries: ['类似问题的历史分析', '竞品功能对比', '行业背景和趋势'],
    validationRules: ['问题定义不得与历史MRD冲突', '行业背景信息需有来源支撑'],
  },
  {
    sectionNumber: 2, // 目标用户和使用场景
    sectionTitle: '目标用户和使用场景',
    knowledgeTypes: [KnowledgeType.HISTORY_PRD, KnowledgeType.HISTORY_MRD, KnowledgeType.TERMINOLOGY],
    searchQueries: ['现有用户画像', '历史使用场景', '用户诉求分析'],
    validationRules: ['用户角色定义需与历史文档一致', '使用场景不得与现有功能冲突'],
  },
  {
    sectionNumber: 3, // 需求目标与成功标准
    sectionTitle: '需求目标与成功标准',
    knowledgeTypes: [KnowledgeType.BUSINESS_RULES, KnowledgeType.HISTORY_MRD],
    searchQueries: ['业务目标定义', '成功标准参考', '量化指标基线'],
    validationRules: ['成功标准需可量化', '目标不得与业务规则冲突'],
  },
  {
    sectionNumber: 4, // 核心需求范围
    sectionTitle: '核心需求范围',
    knowledgeTypes: [KnowledgeType.HISTORY_PRD, KnowledgeType.BUSINESS_RULES, KnowledgeType.FEATURE_LIST, KnowledgeType.TERMINOLOGY],
    searchQueries: ['现有功能列表', '业务规则约束', '功能优先级参考'],
    validationRules: ['新功能不得与现有功能重复', '必须符合业务规则', '不做范围需明确说明原因'],
  },
  {
    sectionNumber: 5, // 关键约束
    sectionTitle: '关键约束',
    knowledgeTypes: [KnowledgeType.TECH_CONSTRAINTS, KnowledgeType.BUSINESS_RULES, KnowledgeType.DEV_SPEC],
    searchQueries: ['技术架构约束', '性能要求基线', '合规要求'],
    validationRules: ['技术约束需与开发规范一致', '超出约束的需求需标记为「待确认」'],
  },
  {
    sectionNumber: 6, // 不确定的点和风险
    sectionTitle: '不确定的点和风险',
    knowledgeTypes: [KnowledgeType.HISTORY_MRD, KnowledgeType.TECH_CONSTRAINTS],
    searchQueries: ['历史风险案例', '技术风险点'],
    validationRules: ['风险需有应对措施', '不确定点需指定确认时间'],
  },
  {
    sectionNumber: 7, // 备注
    sectionTitle: '备注',
    knowledgeTypes: [KnowledgeType.COMPETITOR_ANALYSIS, KnowledgeType.TECH_CONSTRAINTS, KnowledgeType.HISTORY_MRD],
    searchQueries: ['竞品功能分析', '技术方案参考', '工程评估参考'],
    validationRules: ['竞品信息需有来源', '技术参考需与约束一致'],
  },
];

/**
 * PRD 章节-知识映射关系（对应新模板 0-16 章）
 */
export const PRD_SECTION_KNOWLEDGE_MAP: SectionKnowledgeMapping[] = [
  {
    sectionNumber: 0, // 生成说明
    sectionTitle: '生成说明（给 PRD Agent）',
    knowledgeTypes: [KnowledgeType.HISTORY_MRD],
    searchQueries: ['MRD摘要', 'PRD生成要求'],
    validationRules: ['MRD来源需明确'],
  },
  {
    sectionNumber: 1, // 文档信息
    sectionTitle: '文档信息',
    knowledgeTypes: [KnowledgeType.HISTORY_PRD],
    searchQueries: ['PRD编号规范', '负责人分配'],
    validationRules: ['PRD编号需唯一'],
  },
  {
    sectionNumber: 2, // MRD 摘要与需求背景
    sectionTitle: 'MRD 摘要与需求背景',
    knowledgeTypes: [KnowledgeType.HISTORY_MRD, KnowledgeType.BUSINESS_RULES],
    searchQueries: ['业务背景', '问题定义参考'],
    validationRules: ['背景需与MRD一致', '关键假设需可验证'],
  },
  {
    sectionNumber: 3, // 目标与成功标准
    sectionTitle: '目标与成功标准（KPI）',
    knowledgeTypes: [KnowledgeType.HISTORY_PRD, KnowledgeType.BUSINESS_RULES],
    searchQueries: ['目标定义参考', 'KPI基线'],
    validationRules: ['目标需可量化', '成功指标需可观测'],
  },
  {
    sectionNumber: 4, // 用户体验与交互设计要求
    sectionTitle: '用户体验与交互设计要求（Experience Spec）',
    knowledgeTypes: [KnowledgeType.HISTORY_PRD, KnowledgeType.DEV_SPEC],
    searchQueries: ['体验规范', 'UX指标参考'],
    validationRules: ['体验目标需明确', '强制原则需可验证'],
  },
  {
    sectionNumber: 5, // 需求范围与优先级
    sectionTitle: '需求范围与优先级',
    knowledgeTypes: [KnowledgeType.HISTORY_PRD, KnowledgeType.FEATURE_LIST, KnowledgeType.BUSINESS_RULES],
    searchQueries: ['现有功能范围', '业务约束'],
    validationRules: ['需求范围不得与现有功能冲突', 'Out of Scope需明确'],
  },
  {
    sectionNumber: 6, // 用户、角色与使用场景
    sectionTitle: '用户、角色与使用场景',
    knowledgeTypes: [KnowledgeType.HISTORY_PRD, KnowledgeType.TERMINOLOGY],
    searchQueries: ['用户角色定义', '使用场景参考'],
    validationRules: ['用户角色需与历史定义一致', '场景需可验收'],
  },
  {
    sectionNumber: 7, // 端到端关键流程
    sectionTitle: '端到端关键流程（Key Flow）',
    knowledgeTypes: [KnowledgeType.HISTORY_PRD, KnowledgeType.BUSINESS_RULES, KnowledgeType.TECH_CONSTRAINTS],
    searchQueries: ['现有流程定义', '业务流程规则'],
    validationRules: ['主路径需完整', '结果定义需明确'],
  },
  {
    sectionNumber: 8, // 功能需求
    sectionTitle: '功能需求（AI-friendly 强结构）',
    knowledgeTypes: [KnowledgeType.HISTORY_PRD, KnowledgeType.FEATURE_LIST, KnowledgeType.DEV_SPEC],
    searchQueries: ['现有功能列表', '功能规格参考'],
    validationRules: ['功能不得与现有功能重复', 'P0功能需满足A-E五项要求'],
  },
  {
    sectionNumber: 9, // 数据与埋点
    sectionTitle: '数据与埋点（可观测）',
    knowledgeTypes: [KnowledgeType.DEV_SPEC, KnowledgeType.HISTORY_PRD],
    searchQueries: ['埋点规范', '指标定义'],
    validationRules: ['埋点需覆盖主链路', 'KPI与事件需映射'],
  },
  {
    sectionNumber: 10, // 非功能性需求
    sectionTitle: '非功能性需求（体验相关）',
    knowledgeTypes: [KnowledgeType.TECH_CONSTRAINTS, KnowledgeType.DEV_SPEC],
    searchQueries: ['性能指标基线', '稳定性要求'],
    validationRules: ['性能要求需量化', '可恢复性需明确'],
  },
  {
    sectionNumber: 11, // 依赖与影响范围
    sectionTitle: '依赖与影响范围',
    knowledgeTypes: [KnowledgeType.TECH_CONSTRAINTS, KnowledgeType.HISTORY_PRD],
    searchQueries: ['外部依赖', '影响评估'],
    validationRules: ['依赖方需明确', '影响评估需完整'],
  },
  {
    sectionNumber: 12, // 风险与应对
    sectionTitle: '风险与应对',
    knowledgeTypes: [KnowledgeType.HISTORY_PRD, KnowledgeType.BUSINESS_RULES],
    searchQueries: ['风险评估', '应对策略'],
    validationRules: ['风险需评估概率和影响', '应对策略需可执行'],
  },
  {
    sectionNumber: 13, // 发布、灰度与回滚
    sectionTitle: '发布、灰度与回滚',
    knowledgeTypes: [KnowledgeType.DEV_SPEC, KnowledgeType.TECH_CONSTRAINTS],
    searchQueries: ['发布规范', '灰度策略'],
    validationRules: ['灰度节奏需明确', '回滚阈值需可执行'],
  },
  {
    sectionNumber: 14, // 验收与 Go / No-Go
    sectionTitle: '验收与 Go / No-Go',
    knowledgeTypes: [KnowledgeType.HISTORY_PRD, KnowledgeType.TECH_CONSTRAINTS, KnowledgeType.BUSINESS_RULES],
    searchQueries: ['验收标准参考', 'Go/No-Go条件'],
    validationRules: ['验收标准需可测试', 'Go/No-Go条件需可执行'],
  },
  {
    sectionNumber: 15, // 开放问题
    sectionTitle: '开放问题（唯一允许 TBD 的位置）',
    knowledgeTypes: [KnowledgeType.HISTORY_PRD],
    searchQueries: ['待确认问题', '决策记录'],
    validationRules: ['问题需明确Owner和截止时间', '影响需评估'],
  },
  {
    sectionNumber: 16, // 附录
    sectionTitle: '附录',
    knowledgeTypes: [KnowledgeType.HISTORY_MRD, KnowledgeType.HISTORY_PRD],
    searchQueries: ['MRD链接', '原型设计稿'],
    validationRules: ['相关链接需有效'],
  },
];

/**
 * 获取MRD章节的知识映射
 * @param sectionNumber 章节编号
 * @returns 章节知识映射配置
 */
export function getMRDSectionMapping(sectionNumber: number): SectionKnowledgeMapping | undefined {
  return MRD_SECTION_KNOWLEDGE_MAP.find((m) => m.sectionNumber === sectionNumber);
}

/**
 * 获取PRD章节的知识映射
 * @param sectionNumber 章节编号
 * @returns 章节知识映射配置
 */
export function getPRDSectionMapping(sectionNumber: number): SectionKnowledgeMapping | undefined {
  return PRD_SECTION_KNOWLEDGE_MAP.find((m) => m.sectionNumber === sectionNumber);
}

/**
 * 获取知识类型的检索路径
 * @param types 知识类型数组
 * @returns 去重后的路径数组
 */
export function getKnowledgePaths(types: KnowledgeType[]): string[] {
  const paths = new Set<string>();
  for (const type of types) {
    const typePaths = KNOWLEDGE_TYPE_PATHS[type];
    if (typePaths) {
      typePaths.forEach((p) => paths.add(p));
    }
  }
  return Array.from(paths);
}

/**
 * 生成章节的知识检索查询
 * @param mapping 章节知识映射
 * @param userQuery 用户需求描述
 * @returns 检索查询数组
 */
export function generateSearchQueries(mapping: SectionKnowledgeMapping, userQuery: string): string[] {
  const queries: string[] = [];

  // 添加模板查询（结合用户需求）
  for (const template of mapping.searchQueries) {
    queries.push(`${template} ${userQuery}`);
  }

  // 添加知识类型相关查询
  for (const type of mapping.knowledgeTypes) {
    const label = KNOWLEDGE_TYPE_LABELS[type];
    queries.push(`${label} ${userQuery}`);
  }

  return queries;
}

// ====== Part 2: Knowledge Context (原 structuredKnowledge.ts) ======

/**
 * 知识片段接口
 */
export interface KnowledgeChunk {
  /** 片段内容 */
  content: string;
  /** 知识类型 */
  type: KnowledgeType;
  /** 来源文档ID */
  sourceDocumentId?: string;
  /** 来源文档标题 */
  sourceTitle?: string;
  /** 相似度分数 */
  similarity?: number;
}

/**
 * 结构化知识上下文
 */
export interface StructuredKnowledgeContext {
  /** 术语词典 */
  terminology: KnowledgeChunk[];
  /** 业务规则 */
  businessRules: KnowledgeChunk[];
  /** 现有功能 */
  existingFeatures: KnowledgeChunk[];
  /** 技术约束 */
  techConstraints: KnowledgeChunk[];
  /** 竞品分析 */
  competitors: KnowledgeChunk[];
  /** 历史PRD */
  historyPRD: KnowledgeChunk[];
  /** 历史MRD */
  historyMRD: KnowledgeChunk[];
  /** 开发规范 */
  devSpec: KnowledgeChunk[];
}

/**
 * 创建空的结构化知识上下文
 */
export function createEmptyKnowledgeContext(): StructuredKnowledgeContext {
  return {
    terminology: [],
    businessRules: [],
    existingFeatures: [],
    techConstraints: [],
    competitors: [],
    historyPRD: [],
    historyMRD: [],
    devSpec: [],
  };
}

/**
 * 结构化知识调用指令
 * 用于指导模型如何使用不同类型的知识
 */
export const STRUCTURED_KNOWLEDGE_INSTRUCTION = `
【知识库调用指令】

请按以下规则精准使用知识库内容：

## 1. 业务规则知识（用于确保业务逻辑一致）
- 来源标签：[业务规则]
- 使用方式：直接引用规则定义，不得自行推断
- 冲突处理：如新需求与现有规则冲突，在「约束与假设」中明确说明

## 2. 历史功能知识（用于保持系统一致性）
- 来源标签：[历史PRD] / [历史MRD]
- 使用方式：复用术语、流程命名、状态定义
- 冲突处理：新功能需说明与现有功能的关系（扩展/替代/并行）

## 3. 技术约束知识（用于确保可实现性）
- 来源标签：[技术约束]
- 使用方式：影响「关键约束」「非功能指标」「异常处理」
- 冲突处理：超出约束的需求标记为「待确认」

## 4. 术语词典（用于统一表达）
- 来源标签：[术语定义]
- 使用方式：必须使用词典中的标准术语，不得自创同义词

## 5. 竞品分析（用于参考借鉴）
- 来源标签：[竞品分析]
- 使用方式：参考竞品功能设计，标注参考来源

## 6. 知识引用格式
在文档中引用知识库内容时，使用以下格式标注来源：
> 📚 来源：[知识类型] - 文档名称
`;

/**
 * MRD 知识使用要求
 */
export const MRD_KNOWLEDGE_REQUIREMENTS = `
## 知识使用要求

1. **必须使用【术语定义】中的标准术语**
   - 核心概念需与术语词典保持一致
   - 如需新增术语，在备注中定义

2. **必须检查【历史功能】避免重复定义**
   - 对照现有功能列表
   - 明确新功能与现有功能的关系

3. **必须遵守【业务规则】和【技术约束】**
   - 业务规则直接引用，不得自行推断
   - 技术约束影响可行性评估

4. **如有冲突，在「不确定的点和风险」中说明**
   - 记录冲突点和影响范围
   - 提供建议的解决方案
`;

/**
 * PRD 知识使用要求
 */
export const PRD_KNOWLEDGE_REQUIREMENTS = `
## 知识使用要求

1. **必须使用【术语定义】中的标准术语**
   - 所有业务术语需与词典一致
   - 数据口径需明确定义

2. **必须检查【历史PRD】保持功能一致性**
   - 复用现有的流程命名和状态定义
   - 新增功能需说明与现有功能的关系

3. **必须遵守【业务规则】确保可实现**
   - 规则需可编码、可测试
   - 状态机需与业务规则一致

4. **必须遵守【技术约束】确保可落地**
   - 性能指标需在技术边界内
   - 异常处理需符合架构规范

5. **如有冲突，在「约束与假设」中说明**
   - 记录假设及其影响
   - 提供兜底方案
`;

/**
 * 格式化单个知识片段
 */
function formatKnowledgeChunk(chunk: KnowledgeChunk): string {
  const label = KNOWLEDGE_TYPE_LABELS[chunk.type] || chunk.type;
  const source = chunk.sourceTitle ? ` - ${chunk.sourceTitle}` : '';
  const similarity = chunk.similarity ? ` (相关度: ${(chunk.similarity * 100).toFixed(1)}%)` : '';

  return `> 📚 [${label}]${source}${similarity}
${chunk.content}`;
}

/**
 * 格式化知识片段数组
 */
function formatKnowledgeChunks(chunks: KnowledgeChunk[], title: string): string {
  if (!chunks || chunks.length === 0) {
    return '';
  }

  const formattedChunks = chunks.map(formatKnowledgeChunk).join('\n\n');
  return `### ${title}\n\n${formattedChunks}`;
}

/**
 * 格式化结构化知识上下文为提示词
 * @param context 结构化知识上下文
 * @returns 格式化后的知识内容字符串
 */
export function formatStructuredKnowledge(context: StructuredKnowledgeContext): string {
  const sections: string[] = [];

  // 按优先级排列知识类型
  const knowledgeSections = [
    { chunks: context.terminology, title: '术语词典' },
    { chunks: context.businessRules, title: '业务规则' },
    { chunks: context.existingFeatures, title: '现有功能' },
    { chunks: context.historyPRD, title: '历史PRD参考' },
    { chunks: context.historyMRD, title: '历史MRD参考' },
    { chunks: context.techConstraints, title: '技术约束' },
    { chunks: context.competitors, title: '竞品分析' },
    { chunks: context.devSpec, title: '开发规范' },
  ];

  for (const { chunks, title } of knowledgeSections) {
    const formatted = formatKnowledgeChunks(chunks, title);
    if (formatted) {
      sections.push(formatted);
    }
  }

  if (sections.length === 0) {
    return '';
  }

  return `## 知识库上下文（由系统自动提供）

${sections.join('\n\n---\n\n')}`;
}

/**
 * 格式化单个知识片段（业务可读标签，用于 version-review）
 */
function formatKnowledgeChunkForBusiness(chunk: KnowledgeChunk): string {
  const label = KNOWLEDGE_TYPE_LABELS_FOR_BUSINESS[chunk.type] || KNOWLEDGE_TYPE_LABELS[chunk.type] || chunk.type;
  const source = chunk.sourceTitle ? ` - ${chunk.sourceTitle}` : '';
  const similarity = chunk.similarity ? ` (相关度: ${(chunk.similarity * 100).toFixed(1)}%)` : '';

  return `> 📚 来源：${label}${source}${similarity}
${chunk.content}`;
}

/**
 * 格式化知识片段数组（业务可读）
 */
function formatKnowledgeChunksForBusiness(chunks: KnowledgeChunk[], title: string): string {
  if (!chunks || chunks.length === 0) {
    return '';
  }

  const formattedChunks = chunks.map(formatKnowledgeChunkForBusiness).join('\n\n');
  return `### ${title}\n\n${formattedChunks}`;
}

/**
 * 格式化结构化知识上下文为提示词（version-review 专用，业务友好标签）
 * @param context 结构化知识上下文
 * @returns 格式化后的知识内容字符串
 */
export function formatStructuredKnowledgeForVersionReview(context: StructuredKnowledgeContext): string {
  const sections: string[] = [];

  const knowledgeSections = [
    { chunks: context.terminology, title: '术语词典' },
    { chunks: context.businessRules, title: '业务规则' },
    { chunks: context.existingFeatures, title: '现有功能' },
    { chunks: context.historyPRD, title: '历史需求文档' },
    { chunks: context.historyMRD, title: '市场调研' },
    { chunks: context.techConstraints, title: '系统限制' },
    { chunks: context.competitors, title: '竞品分析' },
    { chunks: context.devSpec, title: '开发规范' },
  ];

  for (const { chunks, title } of knowledgeSections) {
    const formatted = formatKnowledgeChunksForBusiness(chunks, title);
    if (formatted) {
      sections.push(formatted);
    }
  }

  if (sections.length === 0) {
    return '';
  }

  return `## 知识库上下文（由系统自动提供）

${sections.join('\n\n---\n\n')}`;
}

/**
 * 检查知识上下文是否为空
 */
export function isKnowledgeContextEmpty(context: StructuredKnowledgeContext): boolean {
  return (
    context.terminology.length === 0 &&
    context.businessRules.length === 0 &&
    context.existingFeatures.length === 0 &&
    context.techConstraints.length === 0 &&
    context.competitors.length === 0 &&
    context.historyPRD.length === 0 &&
    context.historyMRD.length === 0 &&
    context.devSpec.length === 0
  );
}

/**
 * 合并多个知识上下文
 */
export function mergeKnowledgeContexts(contexts: StructuredKnowledgeContext[]): StructuredKnowledgeContext {
  const merged = createEmptyKnowledgeContext();

  for (const ctx of contexts) {
    merged.terminology.push(...ctx.terminology);
    merged.businessRules.push(...ctx.businessRules);
    merged.existingFeatures.push(...ctx.existingFeatures);
    merged.techConstraints.push(...ctx.techConstraints);
    merged.competitors.push(...ctx.competitors);
    merged.historyPRD.push(...ctx.historyPRD);
    merged.historyMRD.push(...ctx.historyMRD);
    merged.devSpec.push(...ctx.devSpec);
  }

  // 去重（基于内容）
  const dedupeChunks = (chunks: KnowledgeChunk[]): KnowledgeChunk[] => {
    const seen = new Set<string>();
    return chunks.filter((chunk) => {
      const key = `${chunk.type}:${chunk.content}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  };

  merged.terminology = dedupeChunks(merged.terminology);
  merged.businessRules = dedupeChunks(merged.businessRules);
  merged.existingFeatures = dedupeChunks(merged.existingFeatures);
  merged.techConstraints = dedupeChunks(merged.techConstraints);
  merged.competitors = dedupeChunks(merged.competitors);
  merged.historyPRD = dedupeChunks(merged.historyPRD);
  merged.historyMRD = dedupeChunks(merged.historyMRD);
  merged.devSpec = dedupeChunks(merged.devSpec);

  return merged;
}

/**
 * 将知识片段分类到结构化上下文
 */
export function categorizeKnowledgeChunks(chunks: KnowledgeChunk[]): StructuredKnowledgeContext {
  const context = createEmptyKnowledgeContext();

  for (const chunk of chunks) {
    switch (chunk.type) {
      case KnowledgeType.TERMINOLOGY:
        context.terminology.push(chunk);
        break;
      case KnowledgeType.BUSINESS_RULES:
        context.businessRules.push(chunk);
        break;
      case KnowledgeType.FEATURE_LIST:
        context.existingFeatures.push(chunk);
        break;
      case KnowledgeType.TECH_CONSTRAINTS:
        context.techConstraints.push(chunk);
        break;
      case KnowledgeType.COMPETITOR_ANALYSIS:
        context.competitors.push(chunk);
        break;
      case KnowledgeType.HISTORY_PRD:
        context.historyPRD.push(chunk);
        break;
      case KnowledgeType.HISTORY_MRD:
        context.historyMRD.push(chunk);
        break;
      case KnowledgeType.DEV_SPEC:
        context.devSpec.push(chunk);
        break;
      default:
        // 默认归类到业务规则
        context.businessRules.push(chunk);
    }
  }

  return context;
}

/**
 * 获取知识上下文的统计信息
 */
export function getKnowledgeContextStats(context: StructuredKnowledgeContext): {
  totalChunks: number;
  chunksByType: Record<string, number>;
} {
  const chunksByType: Record<string, number> = {
    terminology: context.terminology.length,
    businessRules: context.businessRules.length,
    existingFeatures: context.existingFeatures.length,
    techConstraints: context.techConstraints.length,
    competitors: context.competitors.length,
    historyPRD: context.historyPRD.length,
    historyMRD: context.historyMRD.length,
    devSpec: context.devSpec.length,
  };

  const totalChunks = Object.values(chunksByType).reduce((sum, count) => sum + count, 0);

  return { totalChunks, chunksByType };
}
