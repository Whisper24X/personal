import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * 校验 Git 工作树是否干净。
 * 用于所有 Git 写操作前的安全检查，防止 git add 意外提交脏文件。
 *
 * @param repositoryRoot - Git 仓库根目录
 * @param allowedDirtyPaths - 允许脏的路径前缀（如 sync 时允许子仓 prefix 脏）
 * @throws 工作树不干净且有非允许路径的脏文件时抛出
 */
export async function assertCleanWorkingTree(
  repositoryRoot: string,
  allowedDirtyPaths?: string[],
): Promise<void> {
  const { stdout } = await execFileAsync('git', ['status', '--porcelain'], {
    cwd: repositoryRoot,
    maxBuffer: 10 * 1024 * 1024,
  });

  const status = stdout.trim();
  if (!status) return;

  if (!allowedDirtyPaths || allowedDirtyPaths.length === 0) {
    throw new Error(
      `Repository working tree is dirty (${repositoryRoot}):\n${status.slice(0, 500)}`,
    );
  }

  const lines = status.split('\n');
  const unexpectedDirty = lines.filter((line) => {
    const filePath = line.slice(3);
    return !allowedDirtyPaths.some(
      (allowed) =>
        filePath === allowed ||
        filePath.startsWith(allowed + '/') ||
        filePath.startsWith(allowed),
    );
  });

  if (unexpectedDirty.length > 0) {
    throw new Error(
      `Repository working tree has unexpected dirty files (${repositoryRoot}):\n${unexpectedDirty.join('\n').slice(0, 500)}`,
    );
  }
}

const ILLEGAL_PREFIX_CHARS = /[<>:"|?*\x00-\x1f]/;

/**
 * 校验子仓 prefix 的安全性。
 * 防止路径逃逸和非法字符导致 archive/rsync 出现安全问题。
 *
 * @throws prefix 不合法时抛出
 */
export function assertSafePrefix(prefix: string): void {
  if (!prefix || typeof prefix !== 'string') {
    throw new Error('Prefix must be a non-empty string');
  }

  const trimmed = prefix.trim().replace(/\/+$/, '');

  if (trimmed.length === 0) {
    throw new Error('Prefix cannot be empty after trimming');
  }

  if (trimmed.startsWith('/')) {
    throw new Error(`Prefix must not be an absolute path: "${prefix}"`);
  }

  if (trimmed.includes('..')) {
    throw new Error(`Prefix must not contain '..': "${prefix}"`);
  }

  if (trimmed.includes('\\')) {
    throw new Error(`Prefix must not contain backslash: "${prefix}"`);
  }

  if (ILLEGAL_PREFIX_CHARS.test(trimmed)) {
    throw new Error(`Prefix contains illegal characters: "${prefix}"`);
  }

  if (trimmed === '.git' || trimmed.startsWith('.git/')) {
    throw new Error(`Prefix must not target .git directory: "${prefix}"`);
  }
}
