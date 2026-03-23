import { existsSync } from 'fs';
import path from 'path';

/**
 * 只加载当前环境对应的单个 env 文件。
 * 未设置 `NODE_ENV` 时，等同于 `local`。
 */
export function resolveEnvFilePath(): string[] {
  const nodeEnv = process.env.NODE_ENV?.trim() || 'local';

  const envFile = nodeEnv === 'local' ? '.env.local' : `.env.${nodeEnv}`;
  const absolutePath = path.join(process.cwd(), envFile);

  return existsSync(absolutePath) ? [envFile] : [];
}
