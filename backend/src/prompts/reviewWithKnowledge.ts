/**
 * 知识驱动的审核提示词模块
 * 基于知识库内容进行文档一致性校验
 */

import { StructuredKnowledgeContext, formatStructuredKnowledge } from './knowledge';
import { buildMRDReviewPrompt, MRD_REVIEW_SYSTEM_PROMPT } from './mrd';
import { buildPRDReviewPrompt, PRD_REVIEW_SYSTEM_PROMPT } from './prd';

/**
 * 知识库一致性校验指令
 */
export const REVIEW_KNOWLEDGE_VALIDATION = `
## 知识库一致性校验（必须执行）

### 1. 术语一致性
- 对照术语词典，检查文档中的术语是否与标准定义一致
- 标记不一致的术语并建议修正
- 检查是否存在未定义的新术语

### 2. 业务规则一致性
- 对照业务规则库，检查文档中的规则描述是否准确
- 标记与现有规则冲突的内容
- 验证规则的完整性（触发条件、结果、例外）

### 3. 功能重复检查
- 对照历史 PRD/MRD，检查是否存在重复定义的功能
- 标记已有功能并建议引用而非重写
- 检查新功能与现有功能的关系是否明确

### 4. 技术约束校验
- 对照技术约束库，检查需求是否超出系统边界
- 标记不可行的需求并建议调整
- 验证性能指标是否在技术限制范围内

### 5. 竞品参考校验
- 检查竞品信息是否有来源标注
- 验证竞品功能描述的准确性
`;

/**
 * 知识一致性校验结果格式
 */
export const KNOWLEDGE_VALIDATION_OUTPUT_FORMAT = `
## 知识库一致性校验结果

### 1. 术语一致性
- [ ] 所有术语与词典一致：✅ 是 / ❌ 否
- 不一致的术语：
  - [术语名称]：文档中使用「XXX」，词典定义「YYY」，建议修改为「YYY」

### 2. 业务规则一致性
- [ ] 所有规则与业务规则库一致：✅ 是 / ❌ 否
- 冲突的规则：
  - [规则编号]：文档描述与规则库冲突，影响：[描述]

### 3. 功能重复检查
- [ ] 无重复功能定义：✅ 是 / ❌ 否
- 重复的功能：
  - [功能名称]：已在 [历史文档] 中定义，建议引用而非重写

### 4. 技术约束校验
- [ ] 所有需求在技术边界内：✅ 是 / ❌ 否
- 超出约束的需求：
  - [需求描述]：超出 [约束类型]，建议调整为 [建议]

### 5. 竞品参考校验
- [ ] 竞品信息有来源：✅ 是 / ❌ 否
- 缺少来源的竞品：
  - [竞品名称]：缺少来源链接
`;

/**
 * 构建带知识库校验的 MRD 审核提示词
 * @param mrdContent MRD 文档内容
 * @param outline MRD 目录结构
 * @param knowledgeContext 结构化知识上下文
 * @returns 审核提示词
 */
export function buildMRDReviewWithKnowledgePrompt(
  mrdContent: string,
  outline: string,
  knowledgeContext: StructuredKnowledgeContext
): string {
  const formattedKnowledge = formatStructuredKnowledge(knowledgeContext);
  
  return `请审查以下 MRD 文档，并基于知识库进行一致性校验：

【MRD 文档】
${mrdContent}

【预期目录结构】
${outline}

${formattedKnowledge}

${REVIEW_KNOWLEDGE_VALIDATION}

---

${buildMRDReviewPrompt(mrdContent, outline).replace('请审查以下 MRD（市场需求文档）的质量：', '').replace(`【MRD 文档】\n${mrdContent}`, '').replace(`【预期目录结构】\n${outline}`, '')}

---

## 输出要求

在标准审查报告基础上，增加以下内容：

${KNOWLEDGE_VALIDATION_OUTPUT_FORMAT}

请将知识库一致性校验结果作为独立章节输出，放在「改进建议」之前。
`;
}

/**
 * 构建带知识库校验的 PRD 审核提示词
 * @param prdContent PRD 文档内容
 * @param outline PRD 目录结构
 * @param knowledgeContext 结构化知识上下文
 * @returns 审核提示词
 */
export function buildPRDReviewWithKnowledgePrompt(
  prdContent: string,
  outline: string,
  knowledgeContext: StructuredKnowledgeContext
): string {
  const formattedKnowledge = formatStructuredKnowledge(knowledgeContext);
  
  return `请审查以下 PRD 文档，并基于知识库进行一致性校验：

【PRD 文档】
${prdContent}

【预期目录结构】
${outline}

${formattedKnowledge}

${REVIEW_KNOWLEDGE_VALIDATION}

---

${buildPRDReviewPrompt(prdContent, outline).replace('请审查以下 PRD 文档的质量：', '').replace(`【PRD 文档】\n${prdContent}`, '').replace(`【预期目录结构】\n${outline}`, '')}

---

## 输出要求

在标准审查报告基础上，增加以下内容：

${KNOWLEDGE_VALIDATION_OUTPUT_FORMAT}

请将知识库一致性校验结果作为独立章节输出，放在「改进建议」之前。
`;
}

/**
 * MRD 知识驱动审核系统提示词
 */
export const MRD_REVIEW_WITH_KNOWLEDGE_SYSTEM_PROMPT = `${MRD_REVIEW_SYSTEM_PROMPT}

## 知识库校验职责

除了标准审查职责外，你还需要：

### 知识库一致性校验
- 对照术语词典，检查术语使用是否一致
- 对照业务规则库，检查规则描述是否准确
- 对照历史 PRD/MRD，检查是否存在重复定义
- 对照技术约束库，检查需求是否可实现

### 校验原则
- 以知识库内容为权威来源
- 发现不一致时，标记具体位置和建议修正
- 对于新增内容，标记为「待确认」或「建议加入知识库」
- 校验结果需与改进建议关联
`;

/**
 * PRD 知识驱动审核系统提示词
 */
export const PRD_REVIEW_WITH_KNOWLEDGE_SYSTEM_PROMPT = `${PRD_REVIEW_SYSTEM_PROMPT}

## 知识库校验职责

除了标准审查职责外，你还需要：

### 知识库一致性校验
- 对照术语词典，检查术语和数据口径是否一致
- 对照业务规则库，检查规则是否可实现、可测试
- 对照历史 PRD，检查功能定义是否一致
- 对照技术约束库，检查需求是否在技术边界内

### 校验原则
- 以知识库内容为权威来源
- 发现不一致时，标记具体位置和建议修正
- 规则需可编码、可测试
- 校验结果需与改进建议关联
`;

/**
 * 构建章节级知识校验提示词
 * @param sectionContent 章节内容
 * @param sectionNumber 章节编号
 * @param sectionTitle 章节标题
 * @param knowledgeContext 章节相关的知识上下文
 * @param documentType 文档类型（MRD 或 PRD）
 * @returns 章节校验提示词
 */
export function buildSectionKnowledgeValidationPrompt(
  sectionContent: string,
  sectionNumber: number,
  sectionTitle: string,
  knowledgeContext: StructuredKnowledgeContext,
  documentType: 'MRD' | 'PRD'
): string {
  const formattedKnowledge = formatStructuredKnowledge(knowledgeContext);
  
  return `请校验以下 ${documentType} 章节与知识库的一致性：

【章节内容】
## ${sectionNumber}. ${sectionTitle}

${sectionContent}

${formattedKnowledge}

## 校验要求

请针对该章节执行以下校验：

### 1. 术语校验
- 检查章节中使用的术语是否与术语词典一致
- 标记不一致或未定义的术语

### 2. 规则校验
- 检查章节中涉及的业务规则是否与规则库一致
- 标记冲突或新增的规则

### 3. 功能校验
- 检查章节中定义的功能是否与历史文档一致
- 标记重复或冲突的功能定义

### 4. 约束校验
- 检查章节中的需求是否符合技术约束
- 标记超出约束的需求

## 输出格式

\`\`\`markdown
## 章节 ${sectionNumber}. ${sectionTitle} 知识校验结果

### 术语校验
- ✅ 一致 / ❌ 发现问题
- 问题列表：[具体问题]

### 规则校验
- ✅ 一致 / ❌ 发现问题
- 问题列表：[具体问题]

### 功能校验
- ✅ 一致 / ❌ 发现问题
- 问题列表：[具体问题]

### 约束校验
- ✅ 一致 / ❌ 发现问题
- 问题列表：[具体问题]

### 校验结论
- 通过 / 需要修正
- 修正建议：[具体建议]
\`\`\`
`;
}

/**
 * 构建知识冲突检测提示词
 * @param documentContent 文档内容
 * @param knowledgeContext 知识上下文
 * @returns 冲突检测提示词
 */
export function buildKnowledgeConflictDetectionPrompt(
  documentContent: string,
  knowledgeContext: StructuredKnowledgeContext
): string {
  const formattedKnowledge = formatStructuredKnowledge(knowledgeContext);
  
  return `请检测以下文档与知识库之间的潜在冲突：

【文档内容】
${documentContent}

${formattedKnowledge}

## 冲突检测要求

请识别以下类型的冲突：

### 1. 术语冲突
- 文档中使用的术语与词典定义不一致
- 文档中创建了与现有术语含义重叠的新术语

### 2. 业务规则冲突
- 文档描述的规则与规则库中的规则矛盾
- 文档隐含的业务逻辑与现有规则不一致

### 3. 功能冲突
- 文档定义的功能与现有功能重复
- 文档定义的功能与现有功能的行为不一致

### 4. 技术冲突
- 文档的需求超出技术约束
- 文档的性能要求与技术限制矛盾

## 输出格式

\`\`\`markdown
# 知识冲突检测报告

## 1. 术语冲突
- [ ] 发现冲突：是/否
- 冲突详情：
  - [术语1]：[冲突描述] -> 建议：[修正方案]

## 2. 业务规则冲突
- [ ] 发现冲突：是/否
- 冲突详情：
  - [规则描述]：[冲突描述] -> 建议：[修正方案]

## 3. 功能冲突
- [ ] 发现冲突：是/否
- 冲突详情：
  - [功能名称]：[冲突描述] -> 建议：[修正方案]

## 4. 技术冲突
- [ ] 发现冲突：是/否
- 冲突详情：
  - [需求描述]：[冲突描述] -> 建议：[修正方案]

## 冲突摘要
- 总冲突数：[数量]
- 严重程度：高/中/低
- 建议处理优先级：[列表]
\`\`\`
`;
}

export default {
  REVIEW_KNOWLEDGE_VALIDATION,
  KNOWLEDGE_VALIDATION_OUTPUT_FORMAT,
  MRD_REVIEW_WITH_KNOWLEDGE_SYSTEM_PROMPT,
  PRD_REVIEW_WITH_KNOWLEDGE_SYSTEM_PROMPT,
  buildMRDReviewWithKnowledgePrompt,
  buildPRDReviewWithKnowledgePrompt,
  buildSectionKnowledgeValidationPrompt,
  buildKnowledgeConflictDetectionPrompt,
};
