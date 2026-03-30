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
  /** Goal 目标层功能总开关（关闭时 Goal API 返回 404） */
  goalsEnabled: boolean;
};
