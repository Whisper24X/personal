/**
 * 版本审查提示词模块
 * 用于生成5轮审查问题
 *
 * 使用 version-review skill 来指导问题生成
 */

import { StructuredKnowledgeContext, formatStructuredKnowledgeForVersionReview } from './knowledge';
import { loadSkillContent, extractSkillSection } from '../utils/skillLoader';

// 缓存skill内容
let skillContentCache: string | null = null;

/**
 * 获取version-review skill内容（带缓存）
 */
async function getSkillContent(): Promise<string> {
  if (skillContentCache) {
    return skillContentCache;
  }
  skillContentCache = await loadSkillContent('version-review');
  return skillContentCache;
}

/**
 * 问题类型枚举
 */
export enum QuestionType {
  /** 第1轮：业务规则冲突检查 */
  BUSINESS_RULES = 'BUSINESS_RULES',
  /** 第2轮：功能冲突检查 */
  FEATURE_CONFLICT = 'FEATURE_CONFLICT',
  /** 第3轮：术语一致性检查 */
  TERMINOLOGY = 'TERMINOLOGY',
  /** 第4轮：数据模型一致性检查 */
  DATA_MODEL = 'DATA_MODEL',
  /** 第5轮：综合确认 */
  FINAL_CONFIRMATION = 'FINAL_CONFIRMATION',
}

/**
 * 问题类型标签（业务可读）
 */
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  [QuestionType.BUSINESS_RULES]: '业务规则冲突检查',
  [QuestionType.FEATURE_CONFLICT]: '功能冲突检查',
  [QuestionType.TERMINOLOGY]: '术语一致性检查',
  [QuestionType.DATA_MODEL]: '业务数据与系统兼容性检查',
  [QuestionType.FINAL_CONFIRMATION]: '综合确认',
};

/**
 * 业务可读性要求（生成问题与文档时必须遵守）
 */
export const BUSINESS_READABILITY_REQUIREMENT = `
【业务可读性要求】生成内容必须让非技术人员能直接读懂。禁止使用：数据模型、技术约束、技术规范、PRD、MRD 等术语，改用通俗表述（如：业务数据、系统限制、产品需求文档等）。知识库中的技术表述需转述为业务能理解的语言后再呈现。`;

/**
 * 版本审查系统提示词
 * 基于version-review skill生成
 */
export async function getVersionReviewSystemPrompt(): Promise<string> {
  const skillContent = await getSkillContent();

  if (skillContent) {
    // 从skill中提取"Question Generation Guidelines"部分
    const guidelines = extractSkillSection(skillContent, '## Question Generation Guidelines');
    if (guidelines) {
      return `你是一位经验丰富的产品审查专家，负责审查版本想法与系统核心逻辑的一致性。

请遵循以下version-review skill中的指导原则：

${guidelines}

审查原则：
- 以知识库内容为权威来源
- 问题要具体、可操作
- 关注冲突和一致性问题
- 提供明确的修改建议`;
    }
  }

  // 默认提示词（向后兼容）
  return `你是一位经验丰富的产品审查专家，负责审查版本想法与系统核心逻辑的一致性。

你的职责：
1. 基于知识库内容，生成有针对性的审查问题
2. 帮助用户发现版本想法中的潜在冲突和不一致
3. 提供清晰的修改建议

审查原则：
- 以知识库内容为权威来源
- 问题要具体、可操作
- 关注冲突和一致性问题
- 提供明确的修改建议`;
}

/**
 * 同步版本的系统提示词（用于向后兼容）
 */
export const VERSION_REVIEW_SYSTEM_PROMPT = `你是一位经验丰富的产品审查专家，负责审查版本想法与系统核心逻辑的一致性。

你的职责：
1. 基于知识库内容，生成有针对性的审查问题
2. 帮助用户发现版本想法中的潜在冲突和不一致
3. 提供清晰的修改建议

审查原则：
- 以知识库内容为权威来源
- 问题要具体、可操作
- 关注冲突和一致性问题
- 提供明确的修改建议`;

/**
 * 构建业务规则冲突检查问题提示词
 * 基于version-review skill的Round 1指导
 */
export async function buildBusinessRulesQuestionPrompt(userIdea: string, knowledgeContext: StructuredKnowledgeContext): Promise<string> {
  const formattedKnowledge = formatStructuredKnowledgeForVersionReview(knowledgeContext);
  const skillContent = await getSkillContent();

  // 从skill中提取Round 1的指导
  let roundGuidance = '';
  if (skillContent) {
    const round1Section = extractSkillSection(skillContent, '#### Step 2: 第 1 轮 - 业务规则冲突检查');
    if (round1Section) {
      roundGuidance = round1Section;
    }
  }

  // 如果没有skill内容，使用默认指导
  if (!roundGuidance) {
    roundGuidance = `**Focus**:
- Check if version idea conflicts with existing business rules
- Identify specific conflicting rules
- Ask if adjustments are needed to comply with rules

**Question generation**:
1. Points out potentially conflicting business rules
2. Asks if the user needs to adjust their idea to comply
3. Provides specific conflict examples (if any)`;
  }

  return `请基于以下版本想法和知识库，按照version-review skill的指导生成一个业务规则冲突检查问题：

【版本想法】
${userIdea}

${formattedKnowledge}

## Skill指导

${roundGuidance}

## 要求

请生成一个问题，帮助用户检查版本想法是否与现有业务规则冲突。问题应该：
1. 明确指出可能冲突的业务规则
2. 询问用户是否需要调整想法以符合业务规则
3. 提供具体的冲突示例（如果有）

${BUSINESS_READABILITY_REQUIREMENT}

请直接输出问题内容，不要包含其他说明。`;
}

/**
 * 构建功能冲突检查问题提示词
 * 基于version-review skill的Round 2指导
 */
export async function buildFeatureConflictQuestionPrompt(
  userIdea: string,
  knowledgeContext: StructuredKnowledgeContext,
  previousAnswers: Array<{ question: string; answer: string }>
): Promise<string> {
  const formattedKnowledge = formatStructuredKnowledgeForVersionReview(knowledgeContext);
  const previousContext =
    previousAnswers.length > 0
      ? `\n【之前的问答记录】\n${previousAnswers.map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`).join('\n\n')}`
      : '';

  const skillContent = await getSkillContent();
  let roundGuidance = '';
  if (skillContent) {
    const round2Section = extractSkillSection(skillContent, '#### Step 3: 第 2 轮 - 功能冲突检查');
    if (round2Section) {
      roundGuidance = round2Section;
    }
  }
  if (!roundGuidance) {
    roundGuidance = `**Focus**:
- Check if version idea duplicates or conflicts with existing features
- Identify overlapping functionality
- Ask if feature scope needs adjustment`;
  }

  return `请基于以下版本想法、知识库和之前的问答，按照version-review skill的指导生成一个功能冲突检查问题：

【版本想法】
${userIdea}
${previousContext}

${formattedKnowledge}

## 要求

请生成一个问题，帮助用户检查版本想法是否与现有功能重复或冲突。问题应该：
1. 指出可能重复或冲突的功能
2. 询问用户是否需要调整功能范围
3. 提供具体的功能对比（如果有）

${BUSINESS_READABILITY_REQUIREMENT}

请直接输出问题内容，不要包含其他说明。`;
}

/**
 * 构建术语一致性检查问题提示词
 * 基于version-review skill的Round 3指导
 */
export async function buildTerminologyQuestionPrompt(
  userIdea: string,
  knowledgeContext: StructuredKnowledgeContext,
  previousAnswers: Array<{ question: string; answer: string }>
): Promise<string> {
  const formattedKnowledge = formatStructuredKnowledgeForVersionReview(knowledgeContext);
  const previousContext =
    previousAnswers.length > 0
      ? `\n【之前的问答记录】\n${previousAnswers.map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`).join('\n\n')}`
      : '';

  const skillContent = await getSkillContent();
  let roundGuidance = '';
  if (skillContent) {
    const round3Section = extractSkillSection(skillContent, '#### Step 4: 第 3 轮 - 术语一致性检查');
    if (round3Section) {
      roundGuidance = round3Section;
    }
  }
  if (!roundGuidance) {
    roundGuidance = `**Focus**:
- Check if terms used in version idea match system definitions
- List potentially inconsistent terms
- Ask if terminology needs to be unified`;
  }

  return `请基于以下版本想法、知识库和之前的问答，按照version-review skill的指导生成一个术语一致性检查问题：

【版本想法】
${userIdea}
${previousContext}

${formattedKnowledge}

## Skill指导

${roundGuidance}

## 要求

请生成一个问题，帮助用户检查版本想法中使用的术语是否与系统定义一致。问题应该：
1. 列出可能不一致的术语
2. 询问用户是否需要统一术语使用
3. 提供术语词典中的标准定义（如果有）

${BUSINESS_READABILITY_REQUIREMENT}

请直接输出问题内容，不要包含其他说明。`;
}

/**
 * 构建数据模型一致性检查问题提示词
 * 基于version-review skill的Round 4指导
 */
export async function buildDataModelQuestionPrompt(
  userIdea: string,
  knowledgeContext: StructuredKnowledgeContext,
  previousAnswers: Array<{ question: string; answer: string }>
): Promise<string> {
  const formattedKnowledge = formatStructuredKnowledgeForVersionReview(knowledgeContext);
  const previousContext =
    previousAnswers.length > 0
      ? `\n【之前的问答记录】\n${previousAnswers.map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`).join('\n\n')}`
      : '';

  const skillContent = await getSkillContent();
  let roundGuidance = '';
  if (skillContent) {
    const round4Section = extractSkillSection(skillContent, '#### Step 5: 第 4 轮 - 业务数据与系统兼容性检查');
    if (round4Section) {
      roundGuidance = round4Section;
    }
  }
  if (!roundGuidance) {
    roundGuidance = `**Focus**:
- Check if version idea involves business data or information structure changes
- Identify potential system constraints
- Ask if requirements need adjustment to comply with development standards`;
  }

  return `请基于以下版本想法、知识库和之前的问答，按照version-review skill的指导生成一个业务数据与系统兼容性检查问题：

【版本想法】
${userIdea}
${previousContext}

${formattedKnowledge}

## Skill指导

${roundGuidance}

## 要求

请生成一个问题，帮助用户检查版本想法是否涉及业务数据或信息结构的改动，以及是否符合系统限制。问题应该：
1. 指出可能的业务数据或信息结构改动
2. 指出可能的系统限制
3. 询问用户是否需要调整需求以符合开发标准

${BUSINESS_READABILITY_REQUIREMENT}

请直接输出问题内容，不要包含其他说明。`;
}

/**
 * 构建综合确认问题提示词
 * 基于version-review skill的Round 5指导
 */
export async function buildFinalConfirmationQuestionPrompt(
  userIdea: string,
  knowledgeContext: StructuredKnowledgeContext,
  previousAnswers: Array<{ question: string; answer: string }>
): Promise<string> {
  const formattedKnowledge = formatStructuredKnowledgeForVersionReview(knowledgeContext);
  const previousContext =
    previousAnswers.length > 0
      ? `\n【之前的问答记录】\n${previousAnswers.map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`).join('\n\n')}`
      : '';

  const skillContent = await getSkillContent();
  let roundGuidance = '';
  if (skillContent) {
    const round5Section = extractSkillSection(skillContent, '#### Step 6: 第 5 轮 - 最终确认');
    if (round5Section) {
      roundGuidance = round5Section;
    }
  }
  if (!roundGuidance) {
    roundGuidance = `**Focus**:
- Summarize key points from previous discussions
- Ask if version idea needs adjustment based on review
- If adjustment needed, ask for specific direction`;
  }

  return `请基于以下版本想法、知识库和之前的问答，按照version-review skill的指导生成一个综合确认问题：

【版本想法】
${userIdea}
${previousContext}

${formattedKnowledge}

## Skill指导

${roundGuidance}

## 要求

请生成一个问题，总结前面讨论的关键点，并询问用户是否需要基于讨论结果调整版本想法。问题应该：
1. 总结前面讨论的关键点
2. 询问是否需要基于讨论结果调整版本想法
3. 如果用户需要调整，询问具体的调整方向

${BUSINESS_READABILITY_REQUIREMENT}

请直接输出问题内容，不要包含其他说明。`;
}

/**
 * 构建审查文档生成提示词
 * 基于version-review skill的文档格式要求
 */
export async function buildReviewDocumentPrompt(
  versionName: string,
  userIdea: string,
  questionsAndAnswers: Array<{ question: string; answer: string; questionType?: QuestionType }>,
  knowledgeContext: StructuredKnowledgeContext
): Promise<string> {
  const formattedKnowledge = formatStructuredKnowledgeForVersionReview(knowledgeContext);
  const qaSection = questionsAndAnswers
    .map((qa, i) => {
      const questionTypeLabel = qa.questionType ? QUESTION_TYPE_LABELS[qa.questionType] : `第${i + 1}轮审查`;
      return `### 第${i + 1}轮：${questionTypeLabel}\n\n**问题：**\n${qa.question}\n\n**回答：**\n${qa.answer || '（未回答）'}\n`;
    })
    .join('\n');

  const skillContent = await getSkillContent();
  let documentGuidance = '';
  if (skillContent) {
    const docSection = extractSkillSection(skillContent, '## Review Document Generation');
    if (docSection) {
      documentGuidance = docSection;
    }
  }

  return `请基于以下信息和version-review skill的指导生成版本审查文档：

【版本信息】
- 版本名称：${versionName}
- 版本想法：${userIdea}
- 生成时间：${new Date().toLocaleString('zh-CN')}

【问答记录】
${qaSection}

${formattedKnowledge}

${documentGuidance ? `## Skill指导\n\n${documentGuidance}\n\n` : ''}## 文档格式要求

请生成一个完整的Markdown格式审查文档，包含以下章节：

1. **版本信息**
   - 版本名称
   - 版本想法
   - 生成时间

2. **问答记录**
   - 5轮问题和用户回答的完整记录

3. **修改建议**
   - 冲突分析（基于问答记录和知识库）
   - 修改建议（针对每个冲突）
   - 行动项清单

${BUSINESS_READABILITY_REQUIREMENT}

请直接输出完整的Markdown文档内容。`;
}

// ============================================
// CLI模式专用函数（仅支持CLI模式）
// ============================================

/**
 * 构建CLI模式的问题生成提示词
 * 用于通过CLI工具生成问题
 */
export async function buildCLIQuestionPrompt(
  questionType: QuestionType,
  userIdea: string,
  previousAnswers: Array<{ question: string; answer: string; questionType: QuestionType }>,
  knowledgeContext?: StructuredKnowledgeContext
): Promise<string> {
  const formattedKnowledge = knowledgeContext ? formatStructuredKnowledgeForVersionReview(knowledgeContext) : '';
  const skillContent = await getSkillContent();

  // 从skill中提取对应轮次的指导
  let roundGuidance = '';
  const roundSections = {
    [QuestionType.BUSINESS_RULES]: '#### Step 2: 第 1 轮 - 业务规则冲突检查',
    [QuestionType.FEATURE_CONFLICT]: '#### Step 3: 第 2 轮 - 功能冲突检查',
    [QuestionType.TERMINOLOGY]: '#### Step 4: 第 3 轮 - 术语一致性检查',
    [QuestionType.DATA_MODEL]: '#### Step 5: 第 4 轮 - 业务数据与系统兼容性检查',
    [QuestionType.FINAL_CONFIRMATION]: '#### Step 6: 第 5 轮 - 最终确认',
  };

  if (skillContent) {
    const section = extractSkillSection(skillContent, roundSections[questionType]);
    if (section) {
      roundGuidance = section;
    }
  }

  const previousContext =
    previousAnswers.length > 0
      ? `\n【之前的问答记录】\n${previousAnswers.map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`).join('\n\n')}`
      : '';

  return `请基于以下版本想法${formattedKnowledge ? '和知识库' : ''}，按照version-review skill的指导生成一个${QUESTION_TYPE_LABELS[questionType]}问题：

【版本想法】
${userIdea}
${previousContext}

${formattedKnowledge ? `${formattedKnowledge}\n\n` : ''}${roundGuidance ? `## Skill指导\n\n${roundGuidance}\n\n` : ''}## 要求

请生成一个问题，帮助用户检查版本想法。问题应该：
${formattedKnowledge ? '1. 基于知识库内容，具体、可操作\n' : '1. 具体、可操作\n'}2. 关注冲突和一致性问题
3. 提供明确的修改建议

${BUSINESS_READABILITY_REQUIREMENT}

请直接输出问题内容，不要包含其他说明。`;
}

/**
 * 构建CLI模式的审查文档生成提示词
 * 用于通过CLI工具生成审查文档
 */
export async function buildCLIReviewDocumentPrompt(
  versionName: string,
  userIdea: string,
  questionsAndAnswers: Array<{ question: string; answer: string; questionType?: QuestionType }>,
  documentPath: string,
  knowledgeContext?: StructuredKnowledgeContext
): Promise<string> {
  const formattedKnowledge = knowledgeContext ? formatStructuredKnowledgeForVersionReview(knowledgeContext) : '';
  const qaSection = questionsAndAnswers
    .map((qa, i) => {
      const questionTypeLabel = qa.questionType ? QUESTION_TYPE_LABELS[qa.questionType] : `第${i + 1}轮审查`;
      return `### 第${i + 1}轮：${questionTypeLabel}\n\n**问题：**\n${qa.question}\n\n**回答：**\n${qa.answer || '（未回答）'}\n`;
    })
    .join('\n');

  const skillContent = await getSkillContent();
  let documentGuidance = '';
  if (skillContent) {
    const docSection = extractSkillSection(skillContent, '## Review Document Generation');
    if (docSection) {
      documentGuidance = docSection;
    }
  }

  return `请基于以下信息和version-review skill的指导生成版本审查文档：

【版本信息】
- 版本名称：${versionName}
- 版本想法：${userIdea}
- 生成时间：${new Date().toLocaleString('zh-CN')}

【问答记录】
${qaSection}

${formattedKnowledge ? `${formattedKnowledge}\n\n` : ''}${documentGuidance ? `## Skill指导\n\n${documentGuidance}\n\n` : ''}## 文档格式要求

请生成一个完整的Markdown格式审查文档，包含以下章节：

1. **版本信息**
   - 版本名称
   - 版本想法
   - 生成时间

2. **问答记录**
   - 5轮问题和用户回答的完整记录

3. **修改建议**
   - 冲突分析（基于问答记录${formattedKnowledge ? '和知识库' : ''}）
   - 修改建议（针对每个冲突）
   - 行动项清单

${BUSINESS_READABILITY_REQUIREMENT}

请将文档保存到：${documentPath}`;
}
