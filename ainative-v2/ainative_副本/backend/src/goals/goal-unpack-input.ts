import { BadRequestException } from '@nestjs/common';
import path from 'path';
import { GoalSourceDocType } from './dto/goal-source-doc-type.enum';

/** 与 ProjectsService.listDocs 中 maxProjectDocDepth 同量级 */
export const GOAL_UNPACK_MAX_DEPTH = 8;

/** 与 ProjectsService.maxProjectDocFiles 对齐 */
export const GOAL_UNPACK_MAX_FILES = 500;

/** extract-zip / yauzl 条目最小字段 */
export type ZipEntryLike = { fileName: string };

export function assertSafeZipEntry(
  targetDir: string,
  entry: ZipEntryLike,
): void {
  const name = entry.fileName.replace(/\\/g, '/');
  if (!name || name.endsWith('/')) {
    return;
  }
  const segments = name.split('/').filter(Boolean);
  if (segments.some((s) => s === '..')) {
    throw new BadRequestException('压缩包包含非法路径');
  }
  const resolved = path.resolve(targetDir, ...segments);
  const rel = path.relative(targetDir, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new BadRequestException('压缩包包含非法路径');
  }
}

export function docTypeForUnpackedFile(
  relativePath: string,
): GoalSourceDocType {
  const lower = relativePath.toLowerCase();
  if (
    lower.endsWith('.html') ||
    lower.endsWith('.htm') ||
    lower.endsWith('.tsx') ||
    lower.endsWith('.jsx')
  ) {
    return GoalSourceDocType.prototype;
  }
  return GoalSourceDocType.requirement;
}

export function shouldSkipUnpackedRelativePath(relPath: string): boolean {
  const norm = relPath.replace(/\\/g, '/').toLowerCase();
  if (norm.includes('/__macosx/') || norm.startsWith('__macosx/')) {
    return true;
  }
  if (path.basename(norm) === '.ds_store') {
    return true;
  }
  return false;
}

export function isProbablyTextBuffer(buf: Buffer): boolean {
  const inspectLength = Math.min(buf.length, 8_192);
  for (let i = 0; i < inspectLength; i += 1) {
    if (buf[i] === 0) {
      return false;
    }
  }
  return true;
}

export function assertUnpackedPathDepth(
  extractRoot: string,
  absoluteFilePath: string,
): void {
  const rel = path.relative(extractRoot, absoluteFilePath);
  const parts = rel.split(path.sep).filter(Boolean);
  if (parts.length > GOAL_UNPACK_MAX_DEPTH + 1) {
    throw new BadRequestException(
      `解压后路径过深（超过 ${GOAL_UNPACK_MAX_DEPTH} 层目录）`,
    );
  }
}
