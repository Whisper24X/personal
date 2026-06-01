/**
 * Types and interfaces for StepwiseDocumentGenerator
 * 分步骤文档生成器的类型定义
 */

/**
 * Step state enum for logging purposes
 */
export enum StepState {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface Section {
  number: number;
  title: string;
}

export interface StepwiseGenerationConfig {
  // Prompt 构建函数
  buildOutlinePrompt: (input: string) => string;
  buildSectionPrompt: (input: string, outline: string, sectionNumber: number, sectionTitle: string) => string;
  buildSectionReviewPrompt?: (
    sectionContent: string,
    sectionNumber: number,
    sectionTitle: string,
    outline: string
  ) => string;
  // CLI模式下用于生成完整文档的提示词构建函数（可选）
  buildFullDocumentPrompt?: (input: string) => string;
  systemPrompt: string;
  reviewSystemPrompt?: string;

  // 文档元信息
  documentTitle: string; // 如 "产品需求文档（PRD）"
  documentType: string; // 如 "PRD"
  mainFileName: string; // 如 "PRD.md"
  reviewTitle?: string;

  // 默认章节（当无法解析目录时使用）
  defaultSections: Section[];

  // 章节过滤器（可选，用于跳过可选章节等）
  sectionFilter?: (sections: Section[]) => Section[];

  // Workspace 配置
  workspaceDir: string;
  applicationId?: string;
  projectId?: string;
  versionId?: string;  // 版本ID，用于定位版本工作空间

  // 角色名称（可选，用于日志）
  role?: string;

  // 步骤控制（可选，用于跳过特定步骤）
  skipReview?: boolean; // 是否跳过章节审核步骤
  skipMerge?: boolean; // 是否跳过合并步骤

  // 执行模式配置（CLI模式优化）
  executorMode?: 'llm' | 'cli'; // 执行模式：llm（默认）或 cli
  skipStepwiseInCLI?: boolean; // CLI模式下是否跳过分章节生成，直接生成完整文档（默认true）
}

/**
 * Log context interface for generator logging
 */
export interface LogContext {
  role?: string;
  actionName?: string;
}
