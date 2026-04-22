import type { AgentToolConfig } from '@/api/business-lines'

type CliToolOption<T extends string> = {
  id: T
  label: string
}

export const groupAgentToolConfigsBySupportedTool = <T extends string>(
  configs: AgentToolConfig[],
  isSupportedToolId: (toolId: string) => toolId is T,
): Partial<Record<T, AgentToolConfig[]>> => {
  const groupedConfigs: Partial<Record<T, AgentToolConfig[]>> = {}

  for (const config of configs) {
    if (!isSupportedToolId(config.toolId)) {
      continue
    }

    groupedConfigs[config.toolId] = [...(groupedConfigs[config.toolId] ?? []), config]
  }

  return groupedConfigs
}

export const buildConfiguredCliTools = <T extends string>(
  supportedCliTools: Array<CliToolOption<T>>,
  configsByTool: Partial<Record<T, AgentToolConfig[]>>,
): Array<CliToolOption<T>> => {
  return supportedCliTools.filter((tool) => (configsByTool[tool.id]?.length ?? 0) > 0)
}

export const resolvePreferredAgentCliToolId = <T extends string>(options: {
  currentToolId: T | ''
  defaultToolId?: string | null
  configuredTools: Array<CliToolOption<T>>
}): T | '' => {
  const configuredToolIds = new Set(options.configuredTools.map((tool) => tool.id))

  if (options.currentToolId && configuredToolIds.has(options.currentToolId)) {
    return options.currentToolId
  }

  const normalizedDefaultToolId =
    typeof options.defaultToolId === 'string' ? options.defaultToolId.trim() : ''

  if (normalizedDefaultToolId && configuredToolIds.has(normalizedDefaultToolId as T)) {
    return normalizedDefaultToolId as T
  }

  return options.configuredTools[0]?.id ?? ''
}

export const resolvePreferredAgentCliConfigId = (
  configs: AgentToolConfig[],
  currentConfigId: string,
) => {
  if (configs.some((config) => config.id === currentConfigId)) {
    return currentConfigId
  }

  return configs.find((config) => config.isDefault)?.id ?? configs[0]?.id ?? ''
}
