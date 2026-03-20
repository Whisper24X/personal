import { existsSync } from 'fs';
import path from 'path';

/**
 * 未设置 NODE_ENV 时优先加载 `.env`，若不存在再回退到 `.env.development`。
 */
export function resolveEnvFilePath(): string {
  const nodeEnv = process.env.NODE_ENV?.trim();
  if (nodeEnv) {
    return `.env.${nodeEnv}`;
  }
  const envFile = path.join(process.cwd(), '.env');
  if (existsSync(envFile)) {
    return '.env';
  }
  const devFile = path.join(process.cwd(), '.env.development');
  if (existsSync(devFile)) {
    return '.env.development';
  }
  return '.env';
}
