/**
 * Stepwise Document Generator Module
 * 分步骤文档生成器模块
 * 
 * 导出：
 * - Types: StepState, Section, StepwiseGenerationConfig, LogContext
 * - Utils: getWorkspaceDir, buildCLISaveInstruction
 * - CLI Utils: isCLISummaryOutput, tryReadActualDocumentFromWorkspace, tryReadActualReviewFromWorkspace
 * - Generators: BaseGenerator, LLMStepwiseGenerator, CLIFullGenerator
 * - Main: StepwiseDocumentGenerator (Facade)
 */

// Types
export * from './types';

// Workspace utilities
export { getWorkspaceDir, buildCLISaveInstruction } from './workspaceUtils';

// CLI mode utilities
export {
  isCLISummaryOutput,
  tryReadActualDocumentFromWorkspace,
  tryReadActualReviewFromWorkspace,
  type TryReadDocumentOptions,
  type TryReadReviewOptions,
} from './cliModeUtils';

// Generators
export { BaseGenerator } from './BaseGenerator';
export { LLMStepwiseGenerator } from './LLMStepwiseGenerator';
export { CLIFullGenerator } from './CLIFullGenerator';

// Main facade class
export { StepwiseDocumentGenerator } from './StepwiseDocumentGenerator';
