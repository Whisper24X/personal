import type { ProjectContainerRuntimeConfig } from '@/types/api/projects'

export type ProjectContainerRuntimeFormState = {
  containerEnv: string
  containerRunnerOrchestration: string
}

const buildDefaultFormState = (): ProjectContainerRuntimeFormState => ({
  containerEnv: '',
  containerRunnerOrchestration: '',
})

export const createProjectContainerRuntimeFormState = (): ProjectContainerRuntimeFormState =>
  buildDefaultFormState()

export const useProjectContainerRuntimeForm = (form: ProjectContainerRuntimeFormState) => {
  const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  const serializeContainerEnv = (value: unknown) => {
    if (!isObjectRecord(value)) {
      return ''
    }

    return Object.entries(value)
      .filter(([key, envValue]) => key.trim() && typeof envValue === 'string')
      .map(([key, envValue]) => `${key}=${envValue}`)
      .join('\n')
  }

  const parseContainerEnvInput = (value: string) => {
    const env: Record<string, string> = {}
    const invalidLines: string[] = []

    for (const rawLine of value.split('\n')) {
      const line = rawLine.trim()
      if (!line) {
        continue
      }
      if (line.startsWith('#')) {
        continue
      }

      const separatorIndex = line.indexOf('=')
      if (separatorIndex <= 0) {
        invalidLines.push(line)
        continue
      }

      const key = line.slice(0, separatorIndex).trim()
      if (!key) {
        invalidLines.push(line)
        continue
      }

      env[key] = line.slice(separatorIndex + 1)
    }

    return { env, invalidLines }
  }

  const serializeRunnerOrchestration = (value: unknown) => {
    if (!isObjectRecord(value)) {
      return ''
    }

    return `${JSON.stringify(value, null, 2)}\n`
  }

  const parseRunnerOrchestrationInput = (value: string) => {
    const raw = value.trim()
    if (!raw) {
      return {
        config: undefined,
        error: '',
      }
    }

    try {
      const parsed = JSON.parse(raw) as unknown
      if (!isObjectRecord(parsed)) {
        return {
          config: undefined,
          error: '服务编排配置必须是一个 JSON 对象',
        }
      }

      if (!Array.isArray(parsed.services)) {
        return {
          config: undefined,
          error: '服务编排配置必须包含 services 数组',
        }
      }

      if (parsed.preview != null) {
        if (!isObjectRecord(parsed.preview)) {
          return {
            config: undefined,
            error: '预览入口配置 preview 必须是一个对象',
          }
        }

        const previewService =
          typeof parsed.preview.service === 'string' ? parsed.preview.service.trim() : ''
        if (!previewService) {
          return {
            config: undefined,
            error: '预览入口配置必须包含 preview.service',
          }
        }

        const serviceNames = new Set(
          parsed.services
            .map((service) => (isObjectRecord(service) ? service.name : ''))
            .filter((serviceName): serviceName is string => typeof serviceName === 'string')
            .map((serviceName) => serviceName.trim())
            .filter(Boolean),
        )

        if (!serviceNames.has(previewService)) {
          return {
            config: undefined,
            error: `预览入口服务不存在：${previewService}`,
          }
        }

        if ('path' in parsed.preview && typeof parsed.preview.path !== 'string') {
          return {
            config: undefined,
            error: '预览入口路径 preview.path 必须是字符串',
          }
        }
      }

      return {
        config: parsed as ProjectContainerRuntimeConfig['runnerOrchestration'],
        error: '',
      }
    } catch (error) {
      return {
        config: undefined,
        error:
          error instanceof Error
            ? `服务编排配置 JSON 解析失败：${error.message}`
            : '服务编排配置 JSON 解析失败',
      }
    }
  }

  const syncFromContainerRuntime = (value?: unknown) => {
    const containerRuntime = isObjectRecord(value) ? value : {}
    Object.assign(form, buildDefaultFormState())

    if (isObjectRecord(containerRuntime.env) && Object.keys(containerRuntime.env).length > 0) {
      form.containerEnv = serializeContainerEnv(containerRuntime.env)
    }

    if (isObjectRecord(containerRuntime.runnerOrchestration)) {
      form.containerRunnerOrchestration = serializeRunnerOrchestration(
        containerRuntime.runnerOrchestration,
      )
    }
  }

  const buildContainerRuntimeConfig = (): ProjectContainerRuntimeConfig | undefined => {
    const runtimeConfig: ProjectContainerRuntimeConfig = {}

    const parsedEnv = parseContainerEnvInput(form.containerEnv)
    if (Object.keys(parsedEnv.env).length > 0) {
      runtimeConfig.env = parsedEnv.env
    }

    // Only include runnerOrchestration if user explicitly provided JSON in the form.
    // The field is hidden in normal UI flow, so this preserves existing auto-generated config.
    const rawOrchestration = form.containerRunnerOrchestration.trim()
    if (rawOrchestration) {
      const parsedRunnerOrchestration = parseRunnerOrchestrationInput(rawOrchestration)
      if (parsedRunnerOrchestration.config) {
        runtimeConfig.runnerOrchestration = parsedRunnerOrchestration.config
      }
    }

    return Object.keys(runtimeConfig).length > 0 ? runtimeConfig : undefined
  }

  const validateContainerRuntime = () => {
    const parsedEnv = parseContainerEnvInput(form.containerEnv)
    if (parsedEnv.invalidLines.length > 0) {
      return `容器环境变量格式错误：${parsedEnv.invalidLines.join('，')}`
    }

    const parsedRunnerOrchestration = parseRunnerOrchestrationInput(
      form.containerRunnerOrchestration,
    )
    if (parsedRunnerOrchestration.error) {
      return parsedRunnerOrchestration.error
    }

    return ''
  }

  const buildProjectConfigJson = (currentConfigJson?: Record<string, unknown> | null) => {
    const nextConfigJson = isObjectRecord(currentConfigJson) ? { ...currentConfigJson } : {}
    const formRuntime = buildContainerRuntimeConfig()

    const existingRuntime = isObjectRecord(nextConfigJson.containerRuntime)
      ? (nextConfigJson.containerRuntime as Record<string, unknown>)
      : {}

    // Merge strategy: start with all existing containerRuntime fields (preserves
    // runnerOrchestration, ephemeralMcp, databaseIsolation, etc.), then overlay
    // only the fields this form manages (env, and optionally runnerOrchestration).
    const merged: Record<string, unknown> = { ...existingRuntime }

    if (formRuntime) {
      if (formRuntime.env) {
        merged.env = formRuntime.env
      } else {
        delete merged.env
      }
      if (formRuntime.runnerOrchestration) {
        merged.runnerOrchestration = formRuntime.runnerOrchestration
      }
    } else {
      // Form produced no env and no orchestration — clear env but keep everything else
      delete merged.env
    }

    if (Object.keys(merged).length > 0) {
      nextConfigJson.containerRuntime = merged
    } else {
      delete nextConfigJson.containerRuntime
    }

    return Object.keys(nextConfigJson).length > 0 ? nextConfigJson : undefined
  }

  return {
    syncFromContainerRuntime,
    parseContainerEnvInput,
    parseRunnerOrchestrationInput,
    validateContainerRuntime,
    buildContainerRuntimeConfig,
    buildProjectConfigJson,
  }
}
