/**
 * Document Module
 * 文档处理通用模块
 * 
 * 提供统一的文档处理能力，支持CLI模式和LLM模式的双模式处理：
 * - CLIModeHandler: CLI模式处理器
 * - DocumentReviewHandler: 文档审核处理器
 * - DocumentImproveHandler: 文档改进处理器
 * - DocumentWriteHandler: 文档生成处理器
 * - DocumentContentUtils: 文档内容工具函数
 * - DocumentConfigs: 文档类型配置
 */

// Types
export * from './types';

// Configurations
export { DOCUMENT_CONFIGS, getDocumentConfig, registerDocumentConfig } from './DocumentConfigs';

// Handlers
export { CLIModeHandler } from './CLIModeHandler';
export { DocumentReviewHandler } from './DocumentReviewHandler';
export { DocumentImproveHandler } from './DocumentImproveHandler';
export { DocumentWriteHandler } from './DocumentWriteHandler';

// Utils
export {
  removeReviewReport,
  isReviewPassed,
  sectionNeedsImprovement,
  looksLikeReviewReport,
  cleanCodeBlockMarkers,
  extractOutline,
} from './DocumentContentUtils';

// CLI Prompt Builder
export {
  buildCLIModePrompt,
  buildCLIReviewPrompt,
  buildCLIImprovePrompt,
  buildCLIWritePrompt,
  getCLIIOConfig,
  getBaseWorkspaceDir,
  CLI_IO_CONFIGS,
} from './CLIPromptBuilder';
export type {
  CLIPromptConfig,
  DocumentOperationType,
  DocumentIOConfig,
} from './CLIPromptBuilder';
