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

    expect(resolveEnvFilePath()).toBe('.env.test');
  });

  it('should prefer dot env when NODE_ENV is not set', async () => {
    await fs.writeFile(path.join(tempDir, '.env'), 'DATABASE_HOST=localhost\n');
    await fs.writeFile(
      path.join(tempDir, '.env.development'),
      'DATABASE_HOST=127.0.0.1\n',
    );

    expect(resolveEnvFilePath()).toBe('.env');
  });

  it('should fall back to dot env development when dot env is absent', async () => {
    await fs.writeFile(
      path.join(tempDir, '.env.development'),
      'DATABASE_HOST=127.0.0.1\n',
    );

    expect(resolveEnvFilePath()).toBe('.env.development');
  });
});
