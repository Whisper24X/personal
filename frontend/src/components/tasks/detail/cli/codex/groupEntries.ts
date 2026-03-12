import type { NormalizedEntry, NormalizedEntryType } from '../types'

export interface CodexTaskGroup {
  type: 'task'
  title: string
  description: string
  tools: NormalizedEntry[]
}

export interface CodexOtherGroup {
  type: 'other'
  entry: NormalizedEntry
}

export type CodexMessageGroup = CodexTaskGroup | CodexOtherGroup

const TOOL_TYPES: Set<NormalizedEntryType> = new Set([
  'tool_use',
  'tool_result',
  'command_run',
  'file_edit',
  'file_read',
  'thinking',
])

export function groupCodexEntries(entries: NormalizedEntry[]): CodexMessageGroup[] {
  const groups: CodexMessageGroup[] = []
  let currentTaskGroup: CodexTaskGroup | null = null

  const flushTaskGroup = () => {
    if (currentTaskGroup && (currentTaskGroup.tools.length > 0 || currentTaskGroup.description)) {
      groups.push(currentTaskGroup)
      currentTaskGroup = null
    }
  }

  for (const entry of entries) {
    if (entry.type === 'assistant_message') {
      flushTaskGroup()
      currentTaskGroup = {
        type: 'task',
        title: entry.content.length > 80 ? `${entry.content.slice(0, 80)}...` : entry.content,
        description: entry.content,
        tools: [],
      }
    } else if (TOOL_TYPES.has(entry.type)) {
      if (!currentTaskGroup) {
        currentTaskGroup = {
          type: 'task',
          title: '',
          description: '',
          tools: [],
        }
      }
      currentTaskGroup.tools.push(entry)
    } else if (entry.type === 'user_message' || entry.type === 'error') {
      flushTaskGroup()
      groups.push({ type: 'other', entry })
    } else {
      if (currentTaskGroup && currentTaskGroup.tools.length > 0) {
        currentTaskGroup.tools.push(entry)
      } else {
        flushTaskGroup()
        groups.push({ type: 'other', entry })
      }
    }
  }

  flushTaskGroup()
  return groups
}
