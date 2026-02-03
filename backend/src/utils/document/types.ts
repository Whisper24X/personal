/**
 * Document Module Types
 * 文档处理模块类型定义
 */

import { WorkspaceOptions } from '../index';

/**
 * CLI模式配置
 */
export interface CLIModeConfig {
  /** 文档类型，如 'PRD' | 'MRD' | 'DESIGN' | 'TEST' */
  documentType: string;
  /** 主文件名，如 'PRD.md' | 'MRD.md' 等 */
  mainFileName: string;
  /** 审核报告文件名，如 'PRD_REVIEW.md' 等 */
  reviewFileName: string;
  /** 文件描述，如 '产品需求文档' 等 */
  fileDescription: string;
  /** 审核报告描述，如 '审核报告' 等 */
  reviewDescription: string;
}

/**
 * Review配置，扩展自CLIModeConfig
 */
export interface ReviewConfig extends CLIModeConfig {
  /** 构建审核提示词的函数 */
  buildReviewPrompt: (content: string, outline: string) => string;
  /** 系统提示词 */
  systemPrompt: string;
  /** 提取目录的函数（可选） */
  extractOutline?: (content: string) => string;
}

/**
 * Review选项，扩展自WorkspaceOptions
 */
export interface ReviewOptions extends WorkspaceOptions {
  /** 文档目录（可选） */
  outline?: string;
  /** CLI模式下使用文件路径输入（可选） */
  useFilePath?: boolean;
}

/**
 * Review执行结果
 */
export interface ReviewResult {
  /** 审核结果内容 */
  reviewResult: string;
  /** 是否通过 */
  passed: boolean;
}

/**
 * Improve配置，扩展自CLIModeConfig
 */
export interface ImproveConfig extends CLIModeConfig {
  /** 构建改进提示词的函数 */
  buildImprovePrompt: (document: string, reviewReport: string) => string;
  /** 构建分章节改进提示词的函数（LLM模式，可选） */
  buildSectionImprovePrompt?: (sectionContent: string, sectionNumber: number, sectionTitle: string, sectionReview: string) => string;
  /** 系统提示词 */
  systemPrompt: string;
  /** 审查报告匹配模式 */
  reviewReportPattern: RegExp;
}

/**
 * Improve选项，扩展自WorkspaceOptions
 */
export interface ImproveOptions extends WorkspaceOptions {
  /** 审查报告内容（可选） */
  reviewReport?: string;
  /** CLI模式下使用文件路径输入（可选） */
  useFilePath?: boolean;
  /** 从消息队列获取的文档内容（作为workspace文件读取失败时的回退） */
  documentContent?: string;
}

/**
 * Improve执行结果
 */
export interface ImproveResult {
  /** 改进后的内容 */
  content: string;
  /** 改进的章节数量 */
  improvedSectionCount: number;
  /** 总章节数量 */
  totalSectionCount: number;
  /** 是否需要重新审核 */
  needsReReview: boolean;
}

/**
 * CLI输出处理类型
 */
export type CLIOutputType = 'document' | 'review';

/**
 * ProcessOutput处理结果
 * 用于标记内容是否从workspace读取，以避免重复保存
 */
export interface ProcessOutputResult {
  /** 处理后的内容 */
  content: string;
  /** 是否从workspace读取（CLI工具已保存文件，后续无需再次保存） */
  isReadFromWorkspace: boolean;
}

/**
 * Write配置，扩展自CLIModeConfig
 */
export interface WriteConfig extends CLIModeConfig {
  /** 构建生成提示词的函数 */
  buildWritePrompt: (input: string) => string;
  /** 系统提示词 */
  systemPrompt: string;
  /** CLI模式下是否使用 buildWritePrompt 而不是默认的 CLI prompt builder（可选，默认 false） */
  useCustomCLIPrompt?: boolean;
}

/**
 * Write选项，扩展自WorkspaceOptions
 */
export interface WriteOptions extends WorkspaceOptions {
  /** CLI模式下使用文件路径输入（可选） */
  useFilePath?: boolean;
}

/**
 * Write执行结果
 */
export interface WriteResult {
  /** 生成的内容 */
  content: string;
  /** 文件名 */
  filename: string;
  /** workspace目录 */
  workspaceDir: string;
}
