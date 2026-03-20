import { existsSync } from 'fs';
import path from 'path';

/**
 * 未设置 NODE_ENV 时优先加载 `.env.development`（本地 `nest start --watch` 常见），
 * 与 `env-example.development` 命名一致。
 */
export function resolveEnvFilePath(): string {
  const nodeEnv = process.env.NODE_ENV?.trim();
  if (nodeEnv) {
    return `.env.${nodeEnv}`;
  }
  const devFile = path.join(process.cwd(), '.env.development');
  if (existsSync(devFile)) {
    return '.env.development';
  }
  return '.env';
}
