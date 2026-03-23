import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { resolveEnvFilePath } from './env-file-path';

describe('resolveEnvFilePath', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ainative-env-path-'));
    process.chdir(tempDir);
    delete process.env.NODE_ENV;
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should prefer env file matching NODE_ENV when it is set', () => {
    process.env.NODE_ENV = 'test';

    expect(resolveEnvFilePath()).toEqual([]);
  });

  it('should treat empty NODE_ENV as local and prefer dot env local', async () => {
    await fs.writeFile(path.join(tempDir, '.env.local'), 'APP_PORT=9001\n');

    expect(resolveEnvFilePath()).toEqual(['.env.local']);
  });

  it('should return empty when matching env file is absent', () => {
    process.env.NODE_ENV = 'production';

    expect(resolveEnvFilePath()).toEqual([]);
  });

  it('should load only env specific file outside local', async () => {
    process.env.NODE_ENV = 'development';
    await fs.writeFile(
      path.join(tempDir, '.env.development'),
      'DATABASE_HOST=127.0.0.1\n',
    );
    await fs.writeFile(path.join(tempDir, '.env.local'), 'APP_PORT=9001\n');

    expect(resolveEnvFilePath()).toEqual(['.env.development']);
  });

  it('should not duplicate dot env local when NODE_ENV is local', async () => {
    process.env.NODE_ENV = 'local';
    await fs.writeFile(path.join(tempDir, '.env.local'), 'APP_PORT=9001\n');

    expect(resolveEnvFilePath()).toEqual(['.env.local']);
  });
});
