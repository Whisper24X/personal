/** 与数据库 tasks.title 长度一致，需与前端截断规则保持同步 */
export const MAX_TASK_TITLE_DB = 160;

/**
 * 用提示词作为创建任务时的占位标题：空白折叠、截断至 DB 上限。
 */
export function initialTitleFromPrompt(rawPrompt: string): string {
  const t = rawPrompt.replace(/\s+/g, ' ').trim();
  if (!t) {
    return '新建任务';
  }
  if (t.length <= MAX_TASK_TITLE_DB) {
    return t;
  }
  return `${t.slice(0, MAX_TASK_TITLE_DB - 1)}…`;
}
