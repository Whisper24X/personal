import type { NormalizedEntry, RecordLike } from '../types'
import type { TaskMessage } from '@/types/api/tasks'
import { createEntry, getString, makeId } from '../utils'

function parseGeminiLine(
  line: string,
  fallbackTimestamp: number | undefined,
  idBase: string,
): NormalizedEntry | null {
  try {
    const msg = JSON.parse(line) as RecordLike
    const timestamp = fallbackTimestamp ?? Date.now()
    const role = getString(msg.role)
    const content = getString(msg.text) || getString(msg.content) || ''

    if (role === 'model' || role === 'assistant') {
      return createEntry('assistant_message', content, timestamp, makeId(idBase, 'assistant'))
    }
    if (role === 'user') {
      return createEntry('user_message', content, timestamp, makeId(idBase, 'user'))
    }
    return null
  } catch {
    return createEntry('system_message', line, Date.now(), makeId(idBase, 'raw'))
  }
}

export function parseGeminiMessages(messages: TaskMessage[]): NormalizedEntry[] {
  const entries: NormalizedEntry[] = []

  messages.forEach((msg, index) => {
    const content = msg.content?.trim()
    if (!content) return

    const timestamp = msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now()
    const idBase = `gemini-${index}`

    if (msg.role === 'error') {
      entries.push(createEntry('error', content, timestamp, `${idBase}-stderr`))
      return
    }

    const parsed = parseGeminiLine(content, timestamp, idBase)
    if (parsed) {
      entries.push(parsed)
      return
    }

    entries.push(createEntry('system_message', content, timestamp, `${idBase}-raw`))
  })

  return entries
}
