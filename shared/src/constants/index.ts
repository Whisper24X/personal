/**
 * Shared constants for Mind2Build
 */

// ==================== Message Constants ====================

export const MESSAGE_ROUTE_TO_ALL = '<all>';
export const MESSAGE_ROUTE_TO_SELF = '<self>';

// ==================== Action Names ====================

export const ACTION_WRITE_MRD = 'WriteMRD';
export const ACTION_WRITE_PRD = 'WritePRD';
export const ACTION_IMPROVE_PRD = 'ImprovePRD';
export const ACTION_WRITE_DESIGN = 'WriteDesign';
export const ACTION_WRITE_CODE = 'WriteCode';
export const ACTION_WRITE_TEST = 'WriteTest';
export const ACTION_WRITE_CODE_REVIEW = 'WriteCodeReview';
export const ACTION_FIX_BUG = 'FixBug';
export const ACTION_SEARCH_ENHANCED_QA = 'SearchEnhancedQA';
export const ACTION_DATA_ANALYSIS = 'DataAnalysis';
export const ACTION_COORDINATE = 'Coordinate';
export const ACTION_RUN_CODE = 'RunCode';
export const ACTION_BREAKDOWN_TASKS = 'BreakdownTasks';
export const ACTION_WRITE_SUB_PROJECT_DESIGN = 'WriteSubProjectDesign';
export const ACTION_GENERATE_TASK = 'GenerateTask';
export const ACTION_CODE_REVIEW = 'CodeReview';
export const ACTION_TESTABILITY_REVIEW = 'TestabilityReview';
export const ACTION_WRITE_TEST_PLAN = 'WriteTestPlan';
export const ACTION_TEST_CASE_REVIEW = 'TestCaseReview';
export const ACTION_TEST_REVIEW = 'TestReview';
export const ACTION_IMPROVE_TEST = 'ImproveTest';
export const ACTION_AUTOMATION_PLANNING = 'AutomationPlanning';
export const ACTION_AUTOMATION_EXECUTION = 'AutomationExecution';
export const ACTION_COVERAGE_QUALITY_CHECK = 'CoverageQualityCheck';
export const ACTION_QA_CONCLUSION = 'QAConclusion';

// ==================== Role Profiles ====================

export const ROLE_PRODUCT_MANAGER = 'ProductManager';
export const ROLE_ARCHITECT = 'Architect';
export const ROLE_ENGINEER = 'Engineer';
export const ROLE_QA_ENGINEER = 'QAEngineer';
export const ROLE_AUTOMATION_ENGINEER = 'AutomationEngineer';
export const ROLE_TEAM_LEADER = 'TeamLeader';
export const ROLE_DATA_ANALYST = 'DataAnalyst';
export const ROLE_PROJECT_MANAGER = 'ProjectManager';

// ==================== Default Values ====================

export const DEFAULT_MAX_BUDGET = 10.0; // USD
export const DEFAULT_MAX_RETRY = 3;
export const DEFAULT_REQUEST_TIMEOUT = 60000; // ms
export const DEFAULT_MAX_TOKENS = 4000;
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_N_ROUND = 5;

// ==================== LLM Model Names ====================

export const MODEL_GPT_4_TURBO = 'gpt-4-turbo';
export const MODEL_GPT_4 = 'gpt-4';
export const MODEL_GPT_35_TURBO = 'gpt-3.5-turbo';
export const MODEL_CLAUDE_3_OPUS = 'claude-3-opus-20240229';
export const MODEL_CLAUDE_3_SONNET = 'claude-3-sonnet-20240229';
export const MODEL_GLM_4_FLASH = 'glm-4-flash';
export const MODEL_GLM_4 = 'glm-4';

// ==================== Cost per 1K tokens (USD) ====================

export const COST_PER_1K_TOKENS: Record<string, { prompt: number; completion: number }> = {
  [MODEL_GPT_4_TURBO]: { prompt: 0.01, completion: 0.03 },
  [MODEL_GPT_4]: { prompt: 0.03, completion: 0.06 },
  [MODEL_GPT_35_TURBO]: { prompt: 0.0005, completion: 0.0015 },
  [MODEL_CLAUDE_3_OPUS]: { prompt: 0.015, completion: 0.075 },
  [MODEL_CLAUDE_3_SONNET]: { prompt: 0.003, completion: 0.015 },
  [MODEL_GLM_4_FLASH]: { prompt: 0.0001, completion: 0.0001 }, // Estimated
  [MODEL_GLM_4]: { prompt: 0.001, completion: 0.001 }, // Estimated
};

// ==================== File Extensions ====================

export const FILE_EXTENSIONS: Record<string, string> = {
  typescript: '.ts',
  javascript: '.js',
  python: '.py',
  java: '.java',
  cpp: '.cpp',
  csharp: '.cs',
  go: '.go',
  rust: '.rs',
  markdown: '.md',
  json: '.json',
  yaml: '.yaml',
  html: '.html',
  css: '.css',
  sql: '.sql',
};

// ==================== Document Templates ====================

export const DEFAULT_PRD_TEMPLATE = 'default';
export const DEFAULT_DESIGN_TEMPLATE = 'default';
export const DEFAULT_CODE_TEMPLATE = 'default';

