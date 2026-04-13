import type {
  Task,
  TaskEnvironmentStatus,
  TaskNode,
} from '@/types/api/tasks'

export const TASK_DETAIL_REFRESH_LOG_MESSAGES = [
  'Node execution started',
  'Agent node completed; pending approval',
  'Agent node completed; pending artifact review',
  'Agent node completed successfully',
  'Task completed; worktree preserved',
  'Agent node execution failed',
  'Node approved and marked as done',
  'Task title generated',
] as const

export const NODE_STATUS_CHANGE_LOG_MESSAGES = [
  'Node execution started',
  'Agent node completed; pending approval',
  'Agent node completed; pending artifact review',
  'Agent node completed successfully',
  'Agent node execution failed',
  'Node approved and marked as done',
] as const

export const statusLabelMap: Record<Task['status'], string> = {
  todo: '待执行',
  in_progress: '处理中',
  in_review: '待完成',
  done: '已完成',
}

export const nodeStatusLabelMap: Record<TaskNode['status'], string> = {
  todo: '待执行',
  in_progress: '执行中',
  in_review: '待处理',
  done: '已完成',
}

export const modeLabelMap: Record<Task['mode'], string> = {
  conversation: '对话',
  workflow: '工作流',
}

export const statusClassMap: Record<Task['status'], string> = {
  todo: 'bg-muted text-muted-foreground',
  in_progress: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  in_review: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  done: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
}

export const environmentStatusLabelMap: Record<TaskEnvironmentStatus, string> = {
  not_started: '未启动',
  starting: '启动中',
  ready: '已就绪',
  failed: '启动失败',
  stopping: '释放中',
  stopped: '已释放',
}

export const environmentStatusClassMap: Record<TaskEnvironmentStatus, string> = {
  not_started: 'bg-muted text-muted-foreground',
  starting: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  ready: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  failed: 'bg-destructive/10 text-destructive',
  stopping: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  stopped: 'bg-muted text-muted-foreground',
}

export const cliLabelMap: Record<string, string> = {
  cursor: 'Cursor Agent',
  'cursor-agent': 'Cursor Agent',
  'claude-code': 'Claude Code',
  codex: 'Codex',
  gemini: 'Gemini CLI',
  'gemini-cli': 'Gemini CLI',
  opencode: 'Opencode',
}
