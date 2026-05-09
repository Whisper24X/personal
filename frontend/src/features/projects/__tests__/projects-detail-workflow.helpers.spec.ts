import { describe, expect, it } from 'vitest'
import type { AgentToolConfig } from '@/api/business-lines'
import type { WorkflowTemplateNode } from '@/types/api/workflow'
import type { ProjectDetailSupportedCliToolId, WorkflowTemplateNodeForm } from '../projects-detail-workflow.types'
import {
  buildWorkflowNodesForSubmit,
  validateBusinessLineWorkflowTemplateForProjectCopy,
  validateWorkflowNodesPlain,
} from '../projects-detail-workflow.helpers'

describe('validateBusinessLineWorkflowTemplateForProjectCopy', () => {
  const codexToolId = 'codex' as ProjectDetailSupportedCliToolId
  const configuredSet = new Set<ProjectDetailSupportedCliToolId>([codexToolId])
  const configsByTool: Partial<Record<ProjectDetailSupportedCliToolId, AgentToolConfig[]>> = {
    [codexToolId]: [
      {
        id: 'cfg-1',
        businessLineId: 'bl-1',
        toolId: codexToolId,
        name: 'Default',
        configJson: {},
        isDefault: true,
        createdAt: '',
        updatedAt: '',
      },
    ],
  }

  it('rejects skeleton templates without Agent CLI', () => {
    const nodes: WorkflowTemplateNode[] = [
      {
        nodeOrder: 1,
        name: 'step-1',
        type: 'agent',
        requiresApproval: true,
        requiresArtifact: false,
        input: {},
      },
    ]

    const msg = validateBusinessLineWorkflowTemplateForProjectCopy(nodes, {
      configuredCliToolIdSet: configuredSet,
      configsByTool,
      hasConfiguredCliTools: true,
    })

    expect(msg).toContain('业务线工作流管理')
  })

  it('rejects when business line has no configured CLI tools', () => {
    const nodes: WorkflowTemplateNode[] = [
      {
        nodeOrder: 1,
        name: 'step-1',
        type: 'agent',
        input: { agentCliId: codexToolId, agentCliConfigId: 'cfg-1' },
      },
    ]

    const plain = validateWorkflowNodesPlain(nodes, {
      configuredCliToolIdSet: new Set(),
      hasConfiguredCliTools: false,
    })
    expect(plain).toBeTruthy()

    const msg = validateBusinessLineWorkflowTemplateForProjectCopy(nodes, {
      configuredCliToolIdSet: new Set(),
      configsByTool: {},
      hasConfiguredCliTools: false,
    })
    expect(msg).toContain('业务线')
  })

  it('accepts fully configured agent nodes', () => {
    const nodes: WorkflowTemplateNode[] = [
      {
        nodeOrder: 1,
        name: 'step-1',
        type: 'agent',
        input: { agentCliId: codexToolId, agentCliConfigId: 'cfg-1' },
      },
    ]

    const msg = validateBusinessLineWorkflowTemplateForProjectCopy(nodes, {
      configuredCliToolIdSet: configuredSet,
      configsByTool,
      hasConfiguredCliTools: true,
    })

    expect(msg).toBe('')
  })

  it('rejects when agentCliConfigId is missing for a selected CLI', () => {
    const nodes: WorkflowTemplateNode[] = [
      {
        nodeOrder: 1,
        name: 'step-1',
        type: 'agent',
        input: { agentCliId: codexToolId },
      },
    ]

    const msg = validateBusinessLineWorkflowTemplateForProjectCopy(nodes, {
      configuredCliToolIdSet: configuredSet,
      configsByTool,
      hasConfiguredCliTools: true,
    })

    expect(msg).toContain('Agent CLI 配置')
  })
})

describe('buildWorkflowNodesForSubmit / loop + marker validation', () => {
  const codexToolId = 'codex' as ProjectDetailSupportedCliToolId
  const configuredSet = new Set<ProjectDetailSupportedCliToolId>([codexToolId])

  it('does not put stale maxLoops into input when loop is disabled (avoids false marker validation)', () => {
    const formNodes: WorkflowTemplateNodeForm[] = [
      {
        nodeOrder: 1,
        name: 'step-1',
        type: 'agent',
        requiresApproval: true,
        requiresArtifact: false,
        maxLoops: 3,
        input: {
          prompt: '',
          agentCliId: codexToolId,
          agentCliConfigId: 'cfg-1',
          loopEnabled: false,
          earlyExitMarkerEnabled: true,
          earlyExitMarkerFileName: '',
        },
      },
    ]

    const built = buildWorkflowNodesForSubmit(formNodes)
    expect(built[0]?.input?.maxLoops).toBeUndefined()

    const msg = validateWorkflowNodesPlain(built, {
      configuredCliToolIdSet: configuredSet,
      hasConfiguredCliTools: true,
    })
    expect(msg).not.toContain('Marker')
    expect(msg).toBe('')
  })
})
