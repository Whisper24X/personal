import type { WorkflowTemplateNodeInputForm } from './workflow-template-editor.types'

export function createEmptyWorkflowNodeInput(): WorkflowTemplateNodeInputForm {
  return {
    prompt: '',
    agentCliId: '',
    agentCliConfigId: '',
    loopEnabled: false,
    earlyExitMarkerEnabled: false,
    earlyExitMarkerFileName: '',
  }
}

export function formatWorkflowNodeTabLabel(
  node: { name: string },
  index: number,
): string {
  const normalizedName = node.name.trim()
  return normalizedName || `节点 ${index + 1}`
}
