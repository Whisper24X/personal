const DEFAULT_NODE_ENV = 'development';

export function resolveEnvFilePath(): string {
  const nodeEnv = process.env.NODE_ENV?.trim() || DEFAULT_NODE_ENV;
  return `.env.${nodeEnv}`;
}
