import type { WorkflowTemplateNode } from '@/types/api/workflow'

/** 节点表单输入（编辑器态） */
export type WorkflowTemplateNodeInputForm = {
  prompt: string
  agentCliId: string
  agentCliConfigId: string
  earlyExitMarkerEnabled: boolean
  earlyExitMarkerFileName: string
}

/** 与项目详情 / 业务线工作流编辑器共用的节点表单类型 */
export type WorkflowTemplateNodeForm = Omit<WorkflowTemplateNode, 'input'> & {
  input: WorkflowTemplateNodeInputForm
  maxLoops?: number
}

export type WorkflowCreateFormState = {
  name: string
  description: string
  nodes: WorkflowTemplateNodeForm[]
}
