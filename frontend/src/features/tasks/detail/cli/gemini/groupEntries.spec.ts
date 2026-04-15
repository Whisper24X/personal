import { describe, expect, it } from 'vitest'
import type { NormalizedEntry } from '../types'
import { groupGeminiEntries } from './groupEntries'

function createEntry(partial: Partial<NormalizedEntry> & Pick<NormalizedEntry, 'id' | 'type' | 'timestamp' | 'content'>): NormalizedEntry {
  return {
    metadata: undefined,
    ...partial,
  }
}

describe('groupGeminiEntries', () => {
  it('keeps result events as standalone groups after a task group', () => {
    const groups = groupGeminiEntries([
      createEntry({
        id: 'assistant-1',
        type: 'assistant_message',
        timestamp: 1,
        content: 'Answer',
      }),
      createEntry({
        id: 'tool-1',
        type: 'file_read',
        timestamp: 2,
        content: 'openspec/project.md',
      }),
      createEntry({
        id: 'result-1',
        type: 'system_message',
        timestamp: 3,
        content: 'success',
        metadata: {
          isResult: true,
          resultStatus: 'success',
        },
      }),
    ])

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({
      type: 'task',
      id: 'assistant-1',
    })
    expect(groups[1]).toMatchObject({
      type: 'other',
      id: 'result-1',
      entry: {
        id: 'result-1',
      },
    })
  })
})
