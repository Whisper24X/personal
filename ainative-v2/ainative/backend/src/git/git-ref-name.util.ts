import { BadRequestException } from '@nestjs/common';

const GIT_REF_SEGMENT_MAX_LENGTH = 80;
const GIT_PROJECT_BRANCH_MAX_LENGTH = 255;

const RESERVED_REF_NAMES = new Set([
  'HEAD',
  'FETCH_HEAD',
  'ORIG_HEAD',
  'MERGE_HEAD',
  'CHERRY_PICK_HEAD',
]);

export function assertGitRefSlugSegment(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new BadRequestException(`${label}不能为空`);
  }
  assertSafeGitRefSegment(normalized, label, GIT_REF_SEGMENT_MAX_LENGTH);
  return normalized;
}

export function buildProjectWorkspaceBranch(
  businessLineSlug: string,
  projectSlug: string,
): string {
  const bl = assertGitRefSlugSegment(businessLineSlug, '业务线标识');
  const project = assertGitRefSlugSegment(projectSlug, '项目标识');
  const branch = `${bl}-${project}`;
  if (branch.length > GIT_PROJECT_BRANCH_MAX_LENGTH) {
    throw new BadRequestException('项目 workspace 分支名过长');
  }
  assertSafeGitRefSegment(
    branch,
    '项目 workspace 分支',
    GIT_PROJECT_BRANCH_MAX_LENGTH,
  );
  return branch;
}

function assertSafeGitRefSegment(
  value: string,
  label: string,
  maxLen: number,
): void {
  if (value.length > maxLen) {
    throw new BadRequestException(`${label}过长`);
  }
  if (value.includes('..') || value.includes('/')) {
    throw new BadRequestException(`${label}包含非法序列`);
  }
  if (/[\s\x00-\x1f\x7f]/.test(value)) {
    throw new BadRequestException(`${label}不能包含空白或控制字符`);
  }
  if (value.startsWith('-')) {
    throw new BadRequestException(`${label}不能以 - 开头`);
  }
  if (value.endsWith('.') || value.endsWith('/')) {
    throw new BadRequestException(`${label}不能以 . 或 / 结尾`);
  }
  if (value.includes('\\') || value.includes('~') || value.includes('^')) {
    throw new BadRequestException(`${label}包含非法字符`);
  }
  if (RESERVED_REF_NAMES.has(value)) {
    throw new BadRequestException(`${label}不能使用保留名`);
  }
}
