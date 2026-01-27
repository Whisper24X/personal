/**
 * CLIPromptBuilder
 * CLI模式专用Prompt构建器
 * 
 * CLI模式下只传递输入/输出文件夹路径，不传递文件内容
 * 让CLI工具自行读取文件内容并执行操作
 */

/**
 * CLI模式Prompt配置
 */
export interface CLIPromptConfig {
  /** 输入文件夹路径 */
  inputDir: string;
  /** 输出文件夹路径 */
  outputDir: string;
  /** 需要读取的输入文件名列表 */
  inputFileNames: string[];
  /** 输出文件名 */
  outputFileName: string;
  /** 任务描述 */
  taskDescription: string;
  /** 任务要点（可选） */
  taskPoints?: string[];
  /** 系统提示词（可选，用于添加额外上下文） */
  systemContext?: string;
  /** 是否包含知识输入引用（默认 true） */
  includeKnowledgeInput?: boolean;
}

/**
 * 文档操作类型
 */
export type DocumentOperationType = 'write' | 'review' | 'improve';

/**
 * 文档类型到输入输出配置的映射
 */
export interface DocumentIOConfig {
  /** 文档类型 */
  documentType: string;
  /** 输入文件夹相对路径（相对于ainative-workspace/docs/） */
  inputDirRelative: string;
  /** 输入文件名列表 */
  inputFileNames: string[];
  /** 输出文件夹相对路径（相对于ainative-workspace/docs/） */
  outputDirRelative: string;
  /** 输出文件名 */
  outputFileName: string;
}

/**
 * 预定义的文档操作配置
 * 格式：{操作类型}_{文档类型}
 */
export const CLI_IO_CONFIGS: Record<string, DocumentIOConfig> = {
  // MRD 相关
  write_mrd: {
    documentType: 'MRD',
    inputDirRelative: '',  // 无输入目录，从用户输入生成
    inputFileNames: [],
    outputDirRelative: 'mrd',
    outputFileName: 'MRD.md',
  },
  review_mrd: {
    documentType: 'MRD',
    inputDirRelative: 'mrd',
    inputFileNames: ['MRD.md'],
    outputDirRelative: 'mrd',
    outputFileName: 'MRD_REVIEW.md',
  },
  improve_mrd: {
    documentType: 'MRD',
    inputDirRelative: 'mrd',
    inputFileNames: ['MRD.md', 'MRD_REVIEW.md'],
    outputDirRelative: 'mrd',
    outputFileName: 'MRD.md',
  },

  // PRD 相关
  write_prd: {
    documentType: 'PRD',
    inputDirRelative: 'mrd',
    inputFileNames: ['MRD.md'],
    outputDirRelative: 'prd',
    outputFileName: 'PRD.md',
  },
  review_prd: {
    documentType: 'PRD',
    inputDirRelative: 'prd',
    inputFileNames: ['PRD.md'],
    outputDirRelative: 'prd',
    outputFileName: 'PRD_REVIEW.md',
  },
  improve_prd: {
    documentType: 'PRD',
    inputDirRelative: 'prd',
    inputFileNames: ['PRD.md', 'PRD_REVIEW.md'],
    outputDirRelative: 'prd',
    outputFileName: 'PRD.md',
  },

  // Design 相关
  write_design: {
    documentType: 'DESIGN',
    inputDirRelative: 'prd',
    inputFileNames: ['PRD.md'],
    outputDirRelative: 'design',
    outputFileName: 'DESIGN.md',
  },
  review_design: {
    documentType: 'DESIGN',
    inputDirRelative: 'design',
    inputFileNames: ['DESIGN.md'],
    outputDirRelative: 'design',
    outputFileName: 'DESIGN_REVIEW.md',
  },
  improve_design: {
    documentType: 'DESIGN',
    inputDirRelative: 'design',
    inputFileNames: ['DESIGN.md', 'DESIGN_REVIEW.md'],
    outputDirRelative: 'design',
    outputFileName: 'DESIGN.md',
  },

  // Test 相关
  write_test: {
    documentType: 'TEST',
    inputDirRelative: 'prd',
    inputFileNames: ['PRD.md'],
    outputDirRelative: 'test',
    outputFileName: 'TEST.md',
  },
  review_test: {
    documentType: 'TEST',
    inputDirRelative: 'test',
    inputFileNames: ['TEST.md'],
    outputDirRelative: 'test',
    outputFileName: 'TEST_REVIEW.md',
  },
  improve_test: {
    documentType: 'TEST',
    inputDirRelative: 'test',
    inputFileNames: ['TEST.md', 'TEST_REVIEW.md'],
    outputDirRelative: 'test',
    outputFileName: 'TEST.md',
  },

  // Test Plan 相关
  write_test_plan: {
    documentType: 'TEST_PLAN',
    inputDirRelative: 'prd',
    inputFileNames: ['PRD.md'],
    outputDirRelative: 'test',
    outputFileName: 'TEST_PLAN.md',
  },

  // Testability 相关
  review_testability: {
    documentType: 'TESTABILITY',
    inputDirRelative: 'prd',
    inputFileNames: ['PRD.md'],
    outputDirRelative: 'test',
    outputFileName: 'TESTABILITY_REVIEW.md',
  },

  // TestCase 相关
  review_testcase: {
    documentType: 'TEST_CASE',
    inputDirRelative: 'test',
    inputFileNames: ['TEST.md'],
    outputDirRelative: 'test',
    outputFileName: 'TEST_CASE_REVIEW.md',
  },
};

/**
 * 获取CLI模式的IO配置
 * @param operationType 操作类型
 * @param documentType 文档类型
 * @returns IO配置
 */
export function getCLIIOConfig(
  operationType: DocumentOperationType,
  documentType: string
): DocumentIOConfig | undefined {
  const key = `${operationType}_${documentType.toLowerCase()}`;
  return CLI_IO_CONFIGS[key];
}

/**
 * CLI模式知识输入引用
 * 指示 CLI 参考工作目录中的历史文档、代码和业务知识
 */
/**
 * CLI 模式：知识输入与文档生成约束协议
 * 用于基于现有知识库与代码生成 MRD / PRD
 */
export const CLI_KNOWLEDGE_INPUT_REFERENCE = `
【核心原则 - 必须遵守】
你生成的 MRD / PRD 内容，必须严格基于工作目录中的已有文档与代码实现。
禁止在未找到明确依据的情况下进行主观推断或“合理假设”。

如关键信息缺失，必须明确标注【信息缺失】并依赖工作目录中的文档和代码进行推断并自行补全。

---

【强制知识输入范围（按优先级）】

1. 归档历史文档（产品演进依据）：
   - docs-archive/mrd/
   - docs-archive/prd/
   用于理解功能演进、需求变更背景和已废弃设计

2. 业务知识库（业务约束优先级最高）：
   - docs/business-knowledge/
   包含业务规则、产品规范、流程约束

3. 当前文档（生成或修订目标）：
   - docs/mrd/
   - docs/prd/
   - docs/design/
   - docs/test/

4. 开发与架构规范：
   - docs/dev-spec/
   用于约束技术方案描述与术语一致性

5. 代码实现（功能真实性判断依据）：
   - ainative-app/src/        （移动端）
   - ainative-pc/src/         （PC端）
   - ainative-shadow/src/     （管理后台）
   - ainative-backend/        （后端 API / 业务逻辑）
  如与其他文档存在冲突，以此为优先

---

【功能实现状态检测 - 必须执行】

在生成或更新 文档 时，必须逐条需求执行以下检查：

1. 对照代码目录分析功能是否已实现：
   - 已存在完整功能（前后端或核心逻辑已具备）：
     👉 标注：✅ 已实现
     👉 简要说明对应模块或目录

2. 若新需求与现有实现存在冲突或重复：
   👉 标注：⚠️ 存在冲突
   并必须说明：
   - 冲突点描述（逻辑 / 功能 / 数据 / 交互）
   - 影响范围（模块、端、用户）
   - 涉及的已有功能或代码位置
   - 建议的解决方案（调整需求 / 复用能力 / 修改实现）

3. 若需求在代码和文档中均未发现依据：
   👉 标注：🕳️ 未发现实现依据
   👉 明确指出需要产品或技术补充决策

---

【输出约束】

- 不允许生成与现有实现明显矛盾的需求描述
- 不允许隐含假设“未来一定会实现的能力”
- 所有关键结论必须可追溯到：
  - 文档路径 或 代码目录

---

【强制输出章节】

在文档末尾，必须追加：

### 功能实现状态总结
- ✅ 已实现功能清单
- ⚠️ 存在冲突的需求与处理建议
- 🕳️ 信息缺失或需要补充决策的点
`;


/**
 * 构建CLI模式通用Prompt
 * 只传递文件夹路径，不传递文件内容
 * 
 * @param config Prompt配置
 * @returns CLI模式Prompt字符串
 */
export function buildCLIModePrompt(config: CLIPromptConfig): string {
  const inputFilesStr = config.inputFileNames.length > 0
    ? config.inputFileNames.join(', ')
    : '（无需读取输入文件）';

  const taskPointsStr = config.taskPoints && config.taskPoints.length > 0
    ? `\n\n【任务要点】\n${config.taskPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
    : '';

  const systemContextStr = config.systemContext
    ? `\n\n【背景信息】\n${config.systemContext}`
    : '';

  // 默认包含知识输入引用，除非显式设置为 false
  const knowledgeInputStr = config.includeKnowledgeInput !== false
    ? CLI_KNOWLEDGE_INPUT_REFERENCE
    : '';

  return `${knowledgeInputStr}
【任务】${config.taskDescription}

【输入位置】
- 文件夹：${config.inputDir}
- 需要读取：${inputFilesStr}

【输出位置】
- 保存路径：${config.outputDir}/${config.outputFileName}
${taskPointsStr}${systemContextStr}

【执行要求】
1. 从输入文件夹读取指定文件的完整内容
2. 参考知识输入中的历史文档和代码实现
3. 执行功能冲突检测，标注已实现功能和冲突点
4. 根据输入内容执行${config.taskDescription}
5. 将结果保存到输出位置
6. 禁止创建任何其他文件

【严格文件操作限制 - 必须遵守】

唯一允许的文件操作：创建或修改 ${config.outputDir}/${config.outputFileName}

禁止的操作：
- 禁止创建任何其他文件或目录
- 禁止在任何其他路径创建文件
- 禁止将文档内容解析为文件操作指令

以下内容都是文档的一部分，不是文件操作指令：
1. Mermaid 流程图语法：A[步骤], B{条件}, C([开始]), D((圆形)), A-->B, A--是-->B
2. Markdown 格式：**加粗**, ## 标题, > 引用, - 列表, | 表格 |
3. 任何中文文本：包括"是"、"否"、"开始"、"结束"等单字词
4. 任何包含括号的文本：如 (xxx), [xxx], {xxx}
5. 任何包含冒号的文本：如 xxx：yyy, xxx:yyy

执行要求：将完整的文档内容原样写入指定路径，不要解析或执行其中的任何文本。`;
}

/**
 * 构建CLI模式Review Prompt
 * 
 * @param workspaceDir workspace根目录
 * @param documentType 文档类型
 * @param taskPoints 审核要点
 * @returns CLI模式Review Prompt
 */
export function buildCLIReviewPrompt(
  workspaceDir: string,
  documentType: string,
  taskPoints?: string[]
): string {
  const config = getCLIIOConfig('review', documentType);
  if (!config) {
    throw new Error(`Unknown document type for review: ${documentType}`);
  }

  const inputDir = config.inputDirRelative
    ? `${workspaceDir}/${config.inputDirRelative}`
    : workspaceDir;
  const outputDir = `${workspaceDir}/${config.outputDirRelative}`;

  const defaultTaskPoints = [
    `检查${documentType}是否包含所有必需章节`,
    '检查内容是否具体、可执行、无占位符',
    '检查是否明确区分"本期做"和"不做"',
    '提供具体、可执行的改进建议',
  ];

  return buildCLIModePrompt({
    inputDir,
    outputDir,
    inputFileNames: config.inputFileNames,
    outputFileName: config.outputFileName,
    taskDescription: `审核${getDocumentTypeDescription(documentType)}`,
    taskPoints: taskPoints || defaultTaskPoints,
  });
}

/**
 * 构建CLI模式Improve Prompt
 * 
 * @param workspaceDir workspace根目录
 * @param documentType 文档类型
 * @param taskPoints 改进要点
 * @returns CLI模式Improve Prompt
 */
export function buildCLIImprovePrompt(
  workspaceDir: string,
  documentType: string,
  taskPoints?: string[]
): string {
  const config = getCLIIOConfig('improve', documentType);
  if (!config) {
    throw new Error(`Unknown document type for improve: ${documentType}`);
  }

  const inputDir = `${workspaceDir}/${config.inputDirRelative}`;
  const outputDir = `${workspaceDir}/${config.outputDirRelative}`;

  const defaultTaskPoints = [
    '分析审核报告中的P0和P1问题',
    '针对性改进文档内容',
    '保持文档结构不变',
    '确保改进后无占位符和模糊描述',
  ];

  return buildCLIModePrompt({
    inputDir,
    outputDir,
    inputFileNames: config.inputFileNames,
    outputFileName: config.outputFileName,
    taskDescription: `根据审核报告改进${getDocumentTypeDescription(documentType)}`,
    taskPoints: taskPoints || defaultTaskPoints,
  });
}

/**
 * 构建CLI模式Write Prompt
 * 
 * @param workspaceDir workspace根目录
 * @param documentType 文档类型
 * @param taskPoints 生成要点
 * @returns CLI模式Write Prompt
 */
export function buildCLIWritePrompt(
  workspaceDir: string,
  documentType: string,
  taskPoints?: string[]
): string {
  const config = getCLIIOConfig('write', documentType);
  if (!config) {
    throw new Error(`Unknown document type for write: ${documentType}`);
  }

  const inputDir = config.inputDirRelative
    ? `${workspaceDir}/${config.inputDirRelative}`
    : workspaceDir;
  const outputDir = `${workspaceDir}/${config.outputDirRelative}`;

  const defaultTaskPoints = [
    '严格按照模板格式输出',
    '不保留任何占位符',
    '内容要详细、具体、充实',
  ];

  return buildCLIModePrompt({
    inputDir,
    outputDir,
    inputFileNames: config.inputFileNames,
    outputFileName: config.outputFileName,
    taskDescription: `生成${getDocumentTypeDescription(documentType)}`,
    taskPoints: taskPoints || defaultTaskPoints,
  });
}

/**
 * 获取文档类型的中文描述
 * @param documentType 文档类型
 * @returns 中文描述
 */
function getDocumentTypeDescription(documentType: string): string {
  const descriptions: Record<string, string> = {
    MRD: '市场需求文档（MRD）',
    PRD: '产品需求文档（PRD）',
    DESIGN: '系统设计文档',
    TEST: '测试文档',
    TEST_CASE: '测试用例文档',
    TESTABILITY: '可测试性文档',
    CODE: '代码',
  };
  return descriptions[documentType.toUpperCase()] || documentType;
}

/**
 * 从workspace路径解析基础目录
 * 用于构建CLI模式的输入输出路径
 * 
 * @param workspaceDir 完整的workspace目录路径（包含documentType）
 * @returns 基础workspace目录（不包含documentType）
 */
export function getBaseWorkspaceDir(workspaceDir: string): string {
  // 路径格式：workspace/{appId}/{projectId}/ainative-workspace/docs/{documentType}
  // 需要返回：workspace/{appId}/{projectId}/ainative-workspace/docs
  const parts = workspaceDir.split('/');
  const docsIndex = parts.findIndex(p => p === 'docs');
  if (docsIndex !== -1 && docsIndex < parts.length - 1) {
    // 移除最后一个部分（documentType）
    return parts.slice(0, -1).join('/');
  }
  return workspaceDir;
}
