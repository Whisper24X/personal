/** 与后端 tasks/utils/task-title-placeholder 及 DB title 长度一致 */
export const MAX_TASK_TITLE_DB = 160

export function initialTitleFromPrompt(rawPrompt: string): string {
  const t = rawPrompt.replace(/\s+/g, ' ').trim()
  if (!t) {
    return '新建任务'
  }
  if (t.length <= MAX_TASK_TITLE_DB) {
    return t
  }
  return `${t.slice(0, MAX_TASK_TITLE_DB - 1)}…`
}
