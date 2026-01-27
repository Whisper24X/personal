/**
 * Shared types for Mind2Build
 */

// ==================== Message Types ====================

export const MESSAGE_ROUTE_TO_ALL = '<all>';
export const MESSAGE_ROUTE_TO_SELF = '<self>';

export interface IMessage {
  id: string;
  content: string;
  instructContent?: Record<string, any>;
  role: string;
  causeBy: string;
  sentFrom: string;
  sendTo: Set<string>;
  metadata: Record<string, any>;
}

// ==================== Role Types ====================

export enum RoleReactMode {
  REACT = 'react',
  BY_ORDER = 'by_order',
  PLAN_AND_ACT = 'plan_and_act',
}

export interface IRoleConfig {
  name: string;
  profile: string;
  goal: string;
  constraints?: string;
  description?: string;
  llm?: ILLMConfig; // Optional role-specific LLM configuration
}

// ==================== LLM Types ====================

export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'zhipuai' | 'qianfan' | 'dashscope' | 'ollama' | 'ark' | 'cursor' | 'deepseek';

export interface ILLMConfig {
  provider: LLMProvider;
  apiKey: string;
  baseURL?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  // Cursor-specific configuration
  repository?: string; // GitHub repository URL for Cursor Agent
  branchName?: string; // Branch name for Cursor Agent
  autoCreatePr?: boolean; // Auto-create PR for Cursor Agent
}

export interface ILLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ILLMResponse {
  content: string;
  usage: ILLMUsage;
  model: string;
}

// ==================== Project Types ====================

export enum ProjectStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface IProject {
  id: string;
  userId: string;
  name: string;
  idea: string;
  description?: string;
  projectPath?: string;
  status: ProjectStatus;
  progress: number;
  nRound: number;
  currentRound: number;
  investment: number;
  totalCost: number;
  metadata: Record<string, any>;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Document Types ====================

export enum DocumentType {
  MRD = 'mrd',
  PRD = 'prd',
  DESIGN = 'design',
  CODE = 'code',
  TEST = 'test',
  README = 'readme',
  OTHER = 'other',
}

export interface IDocument {
  id: string;
  projectId: string;
  filename: string;
  docType: DocumentType;
  content: string;
  storagePath?: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

// ==================== Action Types ====================

export enum ActionStatus {
  PENDING = 'pending',      // 待执行
  RUNNING = 'running',       // 执行中
  COMPLETED = 'completed',  // 已完成
  FAILED = 'failed',         // 失败
}

// ==================== Role Types (Status) ====================

export enum RoleStatus {
  PENDING = 'pending',      // 待执行
  RUNNING = 'running',       // 执行中
  COMPLETED = 'completed',  // 已完成
  IDLE = 'idle',            // 空闲
}

export interface IActionOutput {
  content: string;
  data?: Record<string, any>;
}

// ==================== Cost Types ====================

export interface ICostRecord {
  id: string;
  projectId: string;
  roleId?: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  createdAt: Date;
}

// ==================== Configuration Types ====================

export interface IAppConfig {
  llm: ILLMConfig;
  database: {
    url: string;
  };
  server: {
    port: number;
    cors: {
      origin: string[];
    };
  };
  // workspace 配置已移除，统一使用 WorkspaceManager.getWorkspaceRoot() 获取路径
  limits: {
    maxBudget: number;
    maxRetry: number;
    requestTimeout: number;
    maxTokens: number;
  };
  features: {
    enableBrowser: boolean;
    enableTerminal: boolean;
    enableCodeExecution: boolean;
  };
  workflow?: {
    mode: 'interactive' | 'auto';
    autoSave: boolean;
  };
}

// ==================== Interactive Mode Types ====================

export enum InteractiveMode {
  AUTO = 'auto',
  INTERACTIVE = 'interactive',
}

export interface IGenerateOptions {
  output?: string;
  budget?: number;
  rounds?: number;
  interactive?: boolean;
}

// ==================== Error Types ====================

export class NoMoneyException extends Error {
  constructor(message = 'Budget exhausted') {
    super(message);
    this.name = 'NoMoneyException';
  }
}

export class LLMAPIError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'LLMAPIError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

