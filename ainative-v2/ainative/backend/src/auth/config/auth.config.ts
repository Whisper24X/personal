import { registerAs } from '@nestjs/config';

import { IsOptional, IsString } from 'class-validator';
import validateConfig from '../../utils/validate-config';
import { AuthConfig } from './auth-config.type';
import ms from 'ms';

class EnvironmentVariablesValidator {
  @IsString()
  AUTH_JWT_SECRET: string;

  @IsString()
  AUTH_JWT_TOKEN_EXPIRES_IN: string;

  @IsString()
  AUTH_REFRESH_SECRET: string;

  @IsString()
  AUTH_REFRESH_TOKEN_EXPIRES_IN: string;

  @IsOptional()
  @IsString()
  AUTH_ADMIN_USERNAMES?: string;
}

const parseAdminUsernames = (value?: string): string[] => {
  return Array.from(
    new Set(
      (value ?? '')
        .split(',')
        .map((username) => username.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
};

export default registerAs<AuthConfig>('auth', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    secret: process.env.AUTH_JWT_SECRET,
    expires: process.env.AUTH_JWT_TOKEN_EXPIRES_IN as ms.StringValue,
    refreshSecret: process.env.AUTH_REFRESH_SECRET,
    refreshExpires: process.env.AUTH_REFRESH_TOKEN_EXPIRES_IN as ms.StringValue,
    adminUsernames: parseAdminUsernames(process.env.AUTH_ADMIN_USERNAMES),
  };
});
