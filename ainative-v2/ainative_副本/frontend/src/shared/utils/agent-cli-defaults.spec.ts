import { describe, expect, it } from 'vitest'
import {
  resolvePreferredAgentCliConfigId,
  resolvePreferredAgentCliToolId,
} from './agent-cli-defaults'

describe('agent-cli-defaults', () => {
  it('prefers an explicit selected tool over the business line default tool', () => {
    const result = resolvePreferredAgentCliToolId({
      currentToolId: 'cursor-agent',
      defaultToolId: 'codex',
      configuredTools: [
        { id: 'cursor-agent', label: 'Cursor Agent' },
        { id: 'codex', label: 'Codex' },
      ],
    })

    expect(result).toBe('cursor-agent')
  })

  it('falls back to the business line default tool before the first configured tool', () => {
    const result = resolvePreferredAgentCliToolId({
      currentToolId: '',
      defaultToolId: 'codex',
      configuredTools: [
        { id: 'cursor-agent', label: 'Cursor Agent' },
        { id: 'codex', label: 'Codex' },
      ],
    })

    expect(result).toBe('codex')
  })

  it('prefers the default config when the current config id is unavailable', () => {
    const result = resolvePreferredAgentCliConfigId(
      [
        {
          id: 'cfg-cursor',
          businessLineId: 'line-1',
          toolId: 'cursor-agent',
          name: 'Cursor Default',
          description: '',
          configJson: {},
          isDefault: false,
          createdAt: '2026-03-08T00:00:00.000Z',
          updatedAt: '2026-03-08T00:00:00.000Z',
        },
        {
          id: 'cfg-codex',
          businessLineId: 'line-1',
          toolId: 'cursor-agent',
          name: 'Cursor Preferred',
          description: '',
          configJson: {},
          isDefault: true,
          createdAt: '2026-03-08T00:00:00.000Z',
          updatedAt: '2026-03-08T00:00:00.000Z',
        },
      ],
      'cfg-missing',
    )

    expect(result).toBe('cfg-codex')
  })
})
