export function resolveEnvFilePath(): string {
  const nodeEnv = process.env.NODE_ENV?.trim();
  return nodeEnv ? `.env.${nodeEnv}` : '.env';
}
