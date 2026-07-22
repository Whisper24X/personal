import { registerAs } from '@nestjs/config';
import { AppConfig } from './app-config.type';
import validateConfig from '.././utils/validate-config';
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

enum Environment {
  Local = 'local',
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariablesValidator {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  APP_PORT: number;

  @IsUrl({ require_tld: false })
  @IsOptional()
  FRONTEND_DOMAIN: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  BACKEND_DOMAIN: string;

  @IsString()
  @IsOptional()
  API_PREFIX: string;

  @IsString()
  @IsOptional()
  APP_FALLBACK_LANGUAGE: string;

  @IsString()
  @IsOptional()
  APP_HEADER_LANGUAGE: string;

  @IsBooleanString()
  @IsOptional()
  HTTP_ACCESS_LOGGING_ENABLED?: string;

  @IsOptional()
  AINATIVE_GOALS_ENABLED?: string;

  @IsString()
  @IsOptional()
  AINATIVE_WORKSPACE_GIT_URL?: string;

  @IsString()
  @IsOptional()
  AINATIVE_WORKSPACE_BASE_BRANCH?: string;
}

export default registerAs<AppConfig>('app', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    nodeEnv: process.env.NODE_ENV?.trim() || 'local',
    name: process.env.APP_NAME || 'app',
    workingDirectory: process.env.PWD || process.cwd(),
    frontendDomain: process.env.FRONTEND_DOMAIN,
    backendDomain: process.env.BACKEND_DOMAIN ?? 'http://localhost',
    port: process.env.APP_PORT
      ? parseInt(process.env.APP_PORT, 10)
      : process.env.PORT
        ? parseInt(process.env.PORT, 10)
        : 3000,
    apiPrefix: process.env.API_PREFIX || 'api',
    fallbackLanguage: process.env.APP_FALLBACK_LANGUAGE || 'zh',
    headerLanguage: process.env.APP_HEADER_LANGUAGE || 'x-custom-lang',
    httpAccessLoggingEnabled:
      process.env.HTTP_ACCESS_LOGGING_ENABLED === '1' ||
      process.env.HTTP_ACCESS_LOGGING_ENABLED === 'true',
    goalsEnabled:
      process.env.AINATIVE_GOALS_ENABLED === undefined ||
      process.env.AINATIVE_GOALS_ENABLED === '1' ||
      process.env.AINATIVE_GOALS_ENABLED === 'true',
    workspaceGitUrl:
      process.env.AINATIVE_WORKSPACE_GIT_URL ||
      'git@gitlab.yc345.tv:frontend/ainative-workspace.git',
    workspaceBaseBranch: process.env.AINATIVE_WORKSPACE_BASE_BRANCH || 'master',
  };
});
