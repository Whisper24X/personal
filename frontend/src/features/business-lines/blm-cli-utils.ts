import { SUPPORTED_CLI_TOOLS } from './blm-agent-cli.constants'
import type { SupportedCliToolId } from './blm-workflow-template.types'

export const isSupportedCliToolId = (toolId: string): toolId is SupportedCliToolId => {
  return SUPPORTED_CLI_TOOLS.some((tool) => tool.id === toolId)
}
