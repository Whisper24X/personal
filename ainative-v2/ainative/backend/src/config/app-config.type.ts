export type AppConfig = {
  nodeEnv: string;
  name: string;
  workingDirectory: string;
  frontendDomain?: string;
  backendDomain: string;
  port: number;
  apiPrefix: string;
  fallbackLanguage: string;
  headerLanguage: string;
  /** Whether to emit HTTP access logs for incoming API requests. */
  httpAccessLoggingEnabled: boolean;
  /** Goal 目标层功能总开关（关闭时 Goal API 返回 404） */
  goalsEnabled: boolean;
  /** ainative-workspace Git 仓库 SSH 地址 */
  workspaceGitUrl: string;
  /** ainative-workspace 模板基线分支 */
  workspaceBaseBranch: string;
};
