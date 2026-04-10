import type { NormalizedEntry } from '../types'
import type { TaskMessage } from '@/types/api/tasks'
import { createEntry } from '../utils'

export function parseFallbackMessages(messages: TaskMessage[]): NormalizedEntry[] {
  const entries: NormalizedEntry[] = []

  messages.forEach((msg, index) => {
    const content = msg.content?.trim()
    if (!content) return

    const timestamp = msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now()
    const idBase = `fallback-${index}`

    if (msg.role === 'error') {
      entries.push(createEntry('error', content, timestamp, `${idBase}-stderr`))
      return
    }

    entries.push(createEntry('system_message', content, timestamp, `${idBase}-stdout`))
  })

  return entries
}
