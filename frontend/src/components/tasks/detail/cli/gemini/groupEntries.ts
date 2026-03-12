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
      flushTaskGroup()
      currentTaskGroup = {
        id: entry.id,
        type: 'task',
        title: entry.content.length > 80 ? `${entry.content.slice(0, 80)}...` : entry.content,
        description: entry.content,
        tools: [],
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
