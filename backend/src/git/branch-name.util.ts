import { randomInt } from 'crypto';
import path from 'path';

const GIT_BRANCH_NAME_MAX_LENGTH = 255;
const GENERATED_BRANCH_TOKEN_PATTERN = '\\d{10}-[a-z0-9]{4}';

function formatGeneratedBranchToken(date: Date): string {
  const year = date.getFullYear().toString().slice(-2);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const suffix = randomInt(0, 36 ** 4)
    .toString(36)
    .padStart(4, '0');

  return `${year}${month}${day}${hours}${minutes}-${suffix}`;
}

export function buildGeneratedBranchToken(date = new Date()): string {
  return formatGeneratedBranchToken(date);
}

export function buildTaskGitBranchName(taskNameId: string): string {
  return `feature/${taskNameId}`;
}

export function buildTaskGitWorktreeName(taskNameId: string): string {
  return `wk-${taskNameId}`;
}

export function buildGoalGitBranchName(
  token = buildGeneratedBranchToken(),
): string {
  return `feature/goal-${token}`.slice(0, GIT_BRANCH_NAME_MAX_LENGTH);
}

export function buildPlanItemGitBranchName(
  goalGitBranch: string,
  itemOrder: number,
): string {
  const tail = `-g${itemOrder + 1}`;
  const base = goalGitBranch.trim();

  if (base.length + tail.length <= GIT_BRANCH_NAME_MAX_LENGTH) {
    return `${base}${tail}`;
  }

  return `${base.slice(
    0,
    Math.max(0, GIT_BRANCH_NAME_MAX_LENGTH - tail.length),
  )}${tail}`;
}

export function extractTaskNameIdFromGitBranch(
  gitBranch: string,
): string | null {
  const match = new RegExp(
    `^feature\\/(${GENERATED_BRANCH_TOKEN_PATTERN})$`,
    'i',
  ).exec(gitBranch.trim());

  return match?.[1] ?? null;
}

export function extractTaskNameIdFromGitWorktree(
  gitWorktree: string,
): string | null {
  const worktreeName = path.basename(gitWorktree.trim());
  const match = new RegExp(
    `^wk-(${GENERATED_BRANCH_TOKEN_PATTERN})$`,
    'i',
  ).exec(worktreeName);

  return match?.[1] ?? null;
}
