import type { WorkflowTemplateNodeInputForm } from '@features/workflow'

export type SupportedCliToolId = 'claude-code' | 'codex' | 'gemini-cli' | 'cursor-agent' | 'opencode'

export type {
  WorkflowCreateFormState,
  WorkflowTemplateNodeForm,
  WorkflowTemplateNodeInputForm,
} from '@features/workflow'

export const createEmptyWorkflowNodeInput = (): WorkflowTemplateNodeInputForm => ({
  prompt: '',
  agentCliId: '',
  agentCliConfigId: '',
  earlyExitMarkerEnabled: false,
  earlyExitMarkerFileName: '',
})
