import type { TaskGitChangedFile } from '@/types/api/tasks'

export function taskGitChangedFileKey(file: TaskGitChangedFile) {
  return `${file.staged ? 'staged' : 'unstaged'}:${file.path}`
}
