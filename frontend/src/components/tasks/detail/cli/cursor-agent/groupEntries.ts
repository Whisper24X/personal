import type { NormalizedEntry, NormalizedEntryType } from '../types'

export interface CursorTaskGroup {
  type: 'task'
  title: string
  description: string
  tools: NormalizedEntry[]
}

export interface CursorOtherGroup {
  type: 'other'
  entry: NormalizedEntry
}

export type CursorMessageGroup = CursorTaskGroup | CursorOtherGroup

const TOOL_TYPES: Set<NormalizedEntryType> = new Set([
  'tool_use',
  'tool_result',
  'command_run',
  'file_edit',
  'file_read',
  'thinking',
])

function isThinkingOnlyTaskGroup(group: CursorTaskGroup | null): boolean {
  if (!group || group.tools.length === 0) return false
  return group.tools.every((e) => e.type === 'thinking')
}

export function groupCursorEntries(entries: NormalizedEntry[]): CursorMessageGroup[] {
  const groups: CursorMessageGroup[] = []
  let currentTaskGroup: CursorTaskGroup | null = null

  const flushTaskGroup = () => {
    if (currentTaskGroup && (currentTaskGroup.tools.length > 0 || currentTaskGroup.description)) {
      groups.push(currentTaskGroup)
      currentTaskGroup = null
    }
  }

  for (const entry of entries) {
    if (entry.type === 'assistant_message') {
      const leadingThinking =
        currentTaskGroup && isThinkingOnlyTaskGroup(currentTaskGroup)
          ? [...currentTaskGroup.tools]
          : null
      if (leadingThinking) {
        currentTaskGroup = null
      }
      flushTaskGroup()
      currentTaskGroup = {
        type: 'task',
        title: entry.content.length > 80 ? `${entry.content.slice(0, 80)}...` : entry.content,
        description: entry.content,
        tools: leadingThinking ?? [],
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
