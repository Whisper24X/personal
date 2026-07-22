import { readFile, writeFile, access } from 'fs/promises';
import { constants } from 'fs';

const BLOCK_START = '# >>> snapshot-sync managed';
const BLOCK_END = '# <<< snapshot-sync managed';

/**
 * 移除 .gitignore 中由 snapshot-sync 管理的 block。
 * 保留用户手写的非 block 内容。
 * 文件不存在时跳过。
 *
 * @returns 是否实际执行了移除（文件存在且有 block）
 */
export async function removeManagedBlock(
  gitignorePath: string,
): Promise<boolean> {
  if (!(await fileExists(gitignorePath))) {
    return false;
  }

  const content = await readFile(gitignorePath, 'utf-8');
  const startIdx = content.indexOf(BLOCK_START);
  if (startIdx === -1) {
    return false;
  }

  const endIdx = content.indexOf(BLOCK_END, startIdx);
  if (endIdx === -1) {
    return false;
  }

  const endLineEnd = content.indexOf('\n', endIdx);
  const before = content.slice(0, startIdx);
  const after = endLineEnd === -1 ? '' : content.slice(endLineEnd + 1);

  const result = cleanTrailingNewlines(before) + after;
  await writeFile(gitignorePath, result, 'utf-8');
  return true;
}

/**
 * 写入 snapshot-sync 管理的 .gitignore block。
 * 先删旧 block 再追加新 block（幂等）。
 * 文件不存在时自动创建。
 *
 * @param prefixes - 子仓 prefix 列表，每个会生成一行 `prefix/`
 */
export async function writeManagedBlock(
  gitignorePath: string,
  prefixes: string[],
): Promise<void> {
  if (prefixes.length === 0) return;

  let content = '';
  if (await fileExists(gitignorePath)) {
    content = await readFile(gitignorePath, 'utf-8');
    content = stripExistingBlock(content);
  }

  const block = buildBlock(prefixes);

  const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  const result = content + separator + block;

  await writeFile(gitignorePath, result, 'utf-8');
}

/**
 * 检查 .gitignore 中是否存在 managed block。
 */
export async function hasManagedBlock(gitignorePath: string): Promise<boolean> {
  if (!(await fileExists(gitignorePath))) return false;
  const content = await readFile(gitignorePath, 'utf-8');
  return content.includes(BLOCK_START) && content.includes(BLOCK_END);
}

// ─── Internal ───────────────────────────────────────────────────────────────

function buildBlock(prefixes: string[]): string {
  const entries = prefixes.map((p) => {
    const normalized = p.replace(/\/+$/, '');
    return `${normalized}/`;
  });

  return [BLOCK_START, ...entries, BLOCK_END, ''].join('\n');
}

function stripExistingBlock(content: string): string {
  const startIdx = content.indexOf(BLOCK_START);
  if (startIdx === -1) return content;

  const endIdx = content.indexOf(BLOCK_END, startIdx);
  if (endIdx === -1) return content;

  const endLineEnd = content.indexOf('\n', endIdx);
  const before = content.slice(0, startIdx);
  const after = endLineEnd === -1 ? '' : content.slice(endLineEnd + 1);

  return cleanTrailingNewlines(before) + after;
}

function cleanTrailingNewlines(str: string): string {
  if (str.length === 0) return str;
  while (str.endsWith('\n\n')) {
    str = str.slice(0, -1);
  }
  return str;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
