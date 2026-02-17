export type WorkflowTemplateMode = 'conversation' | 'workflow'

export type WorkflowNodeType = 'agent' | 'skill' | 'mcp' | 'manual'

export type WorkflowTemplateNode = {
  nodeOrder: number
  name: string
  type: WorkflowNodeType
  requiresApproval?: boolean
  input?: Record<string, unknown>
}

export type WorkflowTemplate = {
  id: string
  name: string
  description?: string | null
  mode: WorkflowTemplateMode
  isActive: boolean
  latestVersion: number
  nodesJson: WorkflowTemplateNode[]
  createdAt?: string
  updatedAt?: string
}

export type WorkflowTemplateVersion = {
  id: string
  templateId: string
  version: number
  name: string
  description?: string | null
  mode: WorkflowTemplateMode
  nodesJson: WorkflowTemplateNode[]
  createdAt?: string
}

export type CreateWorkflowTemplatePayload = {
  name: string
  description?: string
  mode: WorkflowTemplateMode
  nodes: WorkflowTemplateNode[]
  isActive?: boolean
}

export type UpdateWorkflowTemplatePayload = Partial<CreateWorkflowTemplatePayload>

export type ReorderWorkflowTemplateNodesPayload = {
  nodes: WorkflowTemplateNode[]
}
