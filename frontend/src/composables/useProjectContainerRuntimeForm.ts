import type { ProjectContainerRuntimeConfig } from '@/types/api/projects'

export type ContainerExposeMode = 'inherit' | 'enabled' | 'disabled'

export type ProjectContainerRuntimeFormState = {
  containerSandboxProfile: string
  containerNetworkMode: string
  containerExposeMode: ContainerExposeMode
  containerExposeHostIp: string
  containerExposeContainerPort: string
  containerStartTimeoutMs: string
  containerMemoryMb: string
  containerPidsLimit: string
  containerEnv: string
}

export const createProjectContainerRuntimeFormState = (): ProjectContainerRuntimeFormState => ({
  containerSandboxProfile: '',
  containerNetworkMode: '',
  containerExposeMode: 'inherit',
  containerExposeHostIp: '',
  containerExposeContainerPort: '',
  containerStartTimeoutMs: '',
  containerMemoryMb: '',
  containerPidsLimit: '',
  containerEnv: '',
})

export const useProjectContainerRuntimeForm = (form: ProjectContainerRuntimeFormState) => {
  const containerSandboxProfileOptions = [
    { label: '跟随全局默认', value: '' },
    { label: 'runner-only', value: 'runner-only' },
    { label: 'preview-web', value: 'preview-web' },
    { label: 'full-dev-sandbox', value: 'full-dev-sandbox' },
  ]

  const containerNetworkModeOptions = [
    { label: '跟随全局默认', value: '' },
    { label: 'host', value: 'host' },
    { label: 'bridge', value: 'bridge' },
  ]

  const containerExposeModeOptions = [
    { label: '跟随全局默认', value: 'inherit' },
    { label: '开启端口映射', value: 'enabled' },
    { label: '关闭端口映射', value: 'disabled' },
  ]

  const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  const toPositiveNumberText = (value: unknown) => {
    return typeof value === 'number' && value > 0 ? String(value) : ''
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

  const syncFromContainerRuntime = (value?: unknown) => {
    const containerRuntime = isObjectRecord(value) ? value : {}
    const resourceLimits = isObjectRecord(containerRuntime.resourceLimits)
      ? containerRuntime.resourceLimits
      : {}

    form.containerSandboxProfile =
      containerRuntime.sandboxProfile === 'runner-only' ||
      containerRuntime.sandboxProfile === 'preview-web' ||
      containerRuntime.sandboxProfile === 'full-dev-sandbox'
        ? containerRuntime.sandboxProfile
        : ''
    form.containerNetworkMode =
      containerRuntime.networkMode === 'host' || containerRuntime.networkMode === 'bridge'
        ? containerRuntime.networkMode
        : ''
    form.containerExposeMode =
      containerRuntime.exposeLocal === true
        ? 'enabled'
        : containerRuntime.exposeLocal === false
          ? 'disabled'
          : 'inherit'
    form.containerExposeHostIp =
      typeof containerRuntime.exposeHostIp === 'string' ? containerRuntime.exposeHostIp : ''
    form.containerExposeContainerPort = toPositiveNumberText(containerRuntime.exposeContainerPort)
    form.containerStartTimeoutMs = toPositiveNumberText(containerRuntime.startTimeoutMs)
    form.containerMemoryMb = toPositiveNumberText(resourceLimits.memoryMb)
    form.containerPidsLimit = toPositiveNumberText(resourceLimits.pidsLimit)
    form.containerEnv = serializeContainerEnv(containerRuntime.env)
  }

  const buildContainerRuntimeConfig = (): ProjectContainerRuntimeConfig | undefined => {
    const runtimeConfig: ProjectContainerRuntimeConfig = {}

    if (
      form.containerSandboxProfile === 'runner-only' ||
      form.containerSandboxProfile === 'preview-web' ||
      form.containerSandboxProfile === 'full-dev-sandbox'
    ) {
      runtimeConfig.sandboxProfile = form.containerSandboxProfile
    }

    if (form.containerNetworkMode === 'host' || form.containerNetworkMode === 'bridge') {
      runtimeConfig.networkMode = form.containerNetworkMode
    }

    if (form.containerExposeMode === 'enabled') {
      runtimeConfig.exposeLocal = true
    } else if (form.containerExposeMode === 'disabled') {
      runtimeConfig.exposeLocal = false
    }

    if (form.containerExposeHostIp.trim()) {
      runtimeConfig.exposeHostIp = form.containerExposeHostIp.trim()
    }

    const exposeContainerPort = Math.floor(Number(form.containerExposeContainerPort) || 0)
    if (exposeContainerPort > 0) {
      runtimeConfig.exposeContainerPort = exposeContainerPort
    }

    const startTimeoutMs = Math.floor(Number(form.containerStartTimeoutMs) || 0)
    if (startTimeoutMs > 0) {
      runtimeConfig.startTimeoutMs = startTimeoutMs
    }

    const memoryMb = Math.floor(Number(form.containerMemoryMb) || 0)
    const pidsLimit = Math.floor(Number(form.containerPidsLimit) || 0)
    if (memoryMb > 0 || pidsLimit > 0) {
      runtimeConfig.resourceLimits = {
        ...(memoryMb > 0 ? { memoryMb } : {}),
        ...(pidsLimit > 0 ? { pidsLimit } : {}),
      }
    }

    const parsedEnv = parseContainerEnvInput(form.containerEnv)
    if (Object.keys(parsedEnv.env).length > 0) {
      runtimeConfig.env = parsedEnv.env
    }

    return Object.keys(runtimeConfig).length > 0 ? runtimeConfig : undefined
  }

  const validateContainerRuntime = () => {
    const parsedEnv = parseContainerEnvInput(form.containerEnv)
    if (parsedEnv.invalidLines.length > 0) {
      return `容器环境变量格式错误：${parsedEnv.invalidLines.join('，')}`
    }

    return ''
  }

  const buildProjectConfigJson = (currentConfigJson?: Record<string, unknown> | null) => {
    const nextConfigJson = isObjectRecord(currentConfigJson) ? { ...currentConfigJson } : {}
    const containerRuntime = buildContainerRuntimeConfig()

    if (containerRuntime) {
      nextConfigJson.containerRuntime = containerRuntime
    } else {
      delete nextConfigJson.containerRuntime
    }

    return Object.keys(nextConfigJson).length > 0 ? nextConfigJson : undefined
  }

  return {
    containerSandboxProfileOptions,
    containerNetworkModeOptions,
    containerExposeModeOptions,
    syncFromContainerRuntime,
    parseContainerEnvInput,
    validateContainerRuntime,
    buildContainerRuntimeConfig,
    buildProjectConfigJson,
  }
}
