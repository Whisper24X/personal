import type { NormalizedEntry, NormalizedEntryType } from '../types'

export interface GeminiTaskGroup {
  id: string
  type: 'task'
  title: string
  description: string
  tools: NormalizedEntry[]
}

export interface GeminiOtherGroup {
  id: string
  type: 'other'
  entry: NormalizedEntry
}

export type GeminiMessageGroup = GeminiTaskGroup | GeminiOtherGroup

const TOOL_TYPES: Set<NormalizedEntryType> = new Set([
  'tool_use',
  'tool_result',
  'command_run',
  'file_edit',
  'file_read',
  'thinking',
])

function isStandaloneOtherEntry(entry: NormalizedEntry): boolean {
  return (
    entry.type === 'user_message' ||
    entry.type === 'error' ||
    entry.metadata?.isResult === true
  )
}

function isThinkingOnlyTaskGroup(group: GeminiTaskGroup | null): boolean {
  if (!group || group.tools.length === 0) return false
  return group.tools.every((e) => e.type === 'thinking')
}

export function groupGeminiEntries(entries: NormalizedEntry[]): GeminiMessageGroup[] {
  const groups: GeminiMessageGroup[] = []
  let currentTaskGroup: GeminiTaskGroup | null = null

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
        id: entry.id,
        type: 'task',
        title: entry.content.length > 80 ? `${entry.content.slice(0, 80)}...` : entry.content,
        description: entry.content,
        tools: leadingThinking ?? [],
      }
    } else if (TOOL_TYPES.has(entry.type)) {
      if (!currentTaskGroup) {
        currentTaskGroup = {
          id: entry.id,
          type: 'task',
          title: '',
          description: '',
          tools: [],
        }
      }
      currentTaskGroup.tools.push(entry)
    } else if (isStandaloneOtherEntry(entry)) {
      flushTaskGroup()
      groups.push({ id: entry.id, type: 'other', entry })
    } else {
      if (currentTaskGroup && currentTaskGroup.tools.length > 0) {
        currentTaskGroup.tools.push(entry)
      } else {
        flushTaskGroup()
        groups.push({ id: entry.id, type: 'other', entry })
      }
    }
  }

  flushTaskGroup()
  return groups
}
