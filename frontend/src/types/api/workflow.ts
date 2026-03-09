export type WorkflowTemplateScope = 'business_line' | 'project'

export type WorkflowNodeType = 'agent' | 'skill' | 'mcp' | 'manual'

export type WorkflowTemplateNodeInput = Record<string, unknown> & {
  prompt?: string
  agentCliId?: string
  agentCliConfigId?: string
  loopEnabled?: boolean
  maxLoops?: number
}

export type WorkflowTemplateNode = {
  nodeOrder: number
  name: string
  type: WorkflowNodeType
  requiresApproval?: boolean
  input?: WorkflowTemplateNodeInput
}

export type WorkflowTemplate = {
  id: string
  name: string
  description?: string | null
  scope: WorkflowTemplateScope
  businessLineId?: string | null
  projectId?: string | null
  isActive: boolean
  nodesJson: WorkflowTemplateNode[]
  createdAt?: string
  updatedAt?: string
}

export type CreateWorkflowTemplatePayload = {
  name: string
  description?: string
  scope?: WorkflowTemplateScope
  businessLineId?: string
  projectId?: string
  nodes: WorkflowTemplateNode[]
  isActive?: boolean
}

export type UpdateWorkflowTemplatePayload = Partial<CreateWorkflowTemplatePayload>

export type ReorderWorkflowTemplateNodesPayload = {
  nodes: WorkflowTemplateNode[]
}
