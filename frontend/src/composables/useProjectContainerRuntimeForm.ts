import { watch } from 'vue'
import type {
  ProjectContainerRuntimeConfig,
  RunnerOrchestrationConfig,
} from '@/types/api/projects'

type SandboxProfile = NonNullable<ProjectContainerRuntimeConfig['sandboxProfile']>

export type ProjectContainerRuntimeFormState = {
  containerSandboxProfile: string
  containerStartTimeoutMs: string
  containerMemoryMb: string
  containerPidsLimit: string
  containerEnv: string
  containerRunnerOrchestration: string
}

const DEFAULT_SANDBOX_PROFILE: SandboxProfile = 'runner-only'
const DEFAULT_RUNNER_ONLY_START_TIMEOUT_MS = 30_000
const DEFAULT_PREVIEW_WEB_START_TIMEOUT_MS = 300_000
const DEFAULT_PREVIEW_WEB_MEMORY_MB = 2048
const DEFAULT_PREVIEW_WEB_PIDS_LIMIT = 256
const DEFAULT_EMPTY_ENV_COMMENT = '# 无额外环境变量'

const DEFAULT_RUNNER_ONLY_ORCHESTRATION: RunnerOrchestrationConfig = {
  services: [],
  routes: [],
}

const DEFAULT_PREVIEW_WEB_ORCHESTRATION: RunnerOrchestrationConfig = {
  services: [
    {
      name: 'ainative-backend',
      workdir: 'ainative-backend',
      command: "GOFLAGS='-p=1' air -c .air.toml",
      port: 8000,
      env: {
        GO_ENV: 'development',
      },
      priority: 100,
      startsecs: 5,
      startretries: 3,
    },
    {
      name: 'ainative-shadow',
      workdir: 'ainative-shadow',
      command: 'pnpm dev',
      port: 5176,
      env: {
        CI: 'true',
        BROWSER: 'none',
        APP_PROJECT_NAME: 'shadow',
        BASE_API_URL: '/api/yanxue',
        VITE_BASE_URL: '/shadow/',
        VITE_API_URL: '/api',
        SANDBOX: 'true',
      },
      installCommand: 'pnpm install',
      installCheckPath: 'node_modules/.bin/rsbuild',
      priority: 110,
      startsecs: 10,
      startretries: 3,
    },
    {
      name: 'ainative-app',
      workdir: 'ainative-app',
      command: 'npm run dev:h5:local',
      port: 8200,
      env: {
        TARO_APP_API: '/api',
        BROWSER: 'none',
        CI: 'true',
      },
      installCommand: 'npm install',
      installCheckPath: 'node_modules/.bin/taro',
      priority: 120,
      startsecs: 10,
      startretries: 3,
    },
  ],
  routes: [
    {
      path: '/app',
      match: 'exact',
      action: 'redirect',
      redirectTo: '/app/',
      redirectCode: 302,
    },
    {
      path: '/shadow',
      match: 'exact',
      action: 'redirect',
      redirectTo: '/shadow/',
      redirectCode: 302,
    },
    {
      path: '^/api/.*\\.(ts|js|mjs|vue|less|css|scss|map)$',
      match: 'regex',
      service: 'ainative-app',
    },
    {
      path: '/api/',
      match: 'prefix',
      service: 'ainative-backend',
      upstreamPath: '/',
      websocket: true,
    },
    {
      path: '/shadow/',
      match: 'prefix',
      service: 'ainative-shadow',
      upstreamPath: '/',
      websocket: true,
    },
    {
      path: '/static/',
      match: 'prefix',
      service: 'ainative-shadow',
    },
    {
      path: '/rsbuild-hmr',
      match: 'prefix',
      service: 'ainative-shadow',
      websocket: true,
    },
    {
      path: '/app/',
      match: 'prefix',
      service: 'ainative-app',
      upstreamPath: '/',
      websocket: true,
    },
    {
      path: '/',
      match: 'prefix',
      service: 'ainative-app',
      websocket: true,
    },
  ],
  homepage: {
    title: 'AINative Workspace',
    description: '开发环境服务导航',
    links: [
      {
        label: 'App',
        path: '/app/',
      },
      {
        label: 'Shadow',
        path: '/shadow/',
      },
      {
        label: 'Backend',
        path: '/api/',
      },
    ],
  },
  preview: {
    service: 'ainative-app',
    path: '/',
  },
}

const resolveSandboxProfile = (value: unknown): SandboxProfile => {
  return value === 'preview-web' ? 'preview-web' : DEFAULT_SANDBOX_PROFILE
}

const resolveDefaultRunnerOrchestration = (
  profile: SandboxProfile,
): RunnerOrchestrationConfig => {
  return profile === 'preview-web'
    ? DEFAULT_PREVIEW_WEB_ORCHESTRATION
    : DEFAULT_RUNNER_ONLY_ORCHESTRATION
}

const resolveDefaultStartTimeoutMs = (profile: SandboxProfile) => {
  return profile === 'preview-web'
    ? DEFAULT_PREVIEW_WEB_START_TIMEOUT_MS
    : DEFAULT_RUNNER_ONLY_START_TIMEOUT_MS
}

const buildDefaultFormState = (
  profile: SandboxProfile = DEFAULT_SANDBOX_PROFILE,
): ProjectContainerRuntimeFormState => ({
  containerSandboxProfile: profile,
  containerStartTimeoutMs: String(resolveDefaultStartTimeoutMs(profile)),
  containerMemoryMb:
    profile === 'preview-web' ? String(DEFAULT_PREVIEW_WEB_MEMORY_MB) : '0',
  containerPidsLimit:
    profile === 'preview-web' ? String(DEFAULT_PREVIEW_WEB_PIDS_LIMIT) : '0',
  containerEnv: DEFAULT_EMPTY_ENV_COMMENT,
  containerRunnerOrchestration: `${JSON.stringify(
    resolveDefaultRunnerOrchestration(profile),
    null,
    2,
  )}\n`,
})

const normalizeComparableJson = (value: unknown) => JSON.stringify(value)

export const createProjectContainerRuntimeFormState = (): ProjectContainerRuntimeFormState =>
  buildDefaultFormState()

export const useProjectContainerRuntimeForm = (form: ProjectContainerRuntimeFormState) => {
  let syncingFromContainerRuntime = false

  const containerSandboxProfileOptions = [
    { label: '跟随全局默认', value: '' },
    { label: 'runner-only', value: 'runner-only' },
    { label: 'preview-web', value: 'preview-web' },
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
    const profile = resolveSandboxProfile(containerRuntime.sandboxProfile)
    const resourceLimits = isObjectRecord(containerRuntime.resourceLimits)
      ? containerRuntime.resourceLimits
      : {}

    syncingFromContainerRuntime = true
    try {
      Object.assign(form, buildDefaultFormState(profile))

      if (
        containerRuntime.sandboxProfile === 'runner-only' ||
        containerRuntime.sandboxProfile === 'preview-web'
      ) {
        form.containerSandboxProfile = containerRuntime.sandboxProfile
      }

      if (typeof containerRuntime.startTimeoutMs === 'number') {
        form.containerStartTimeoutMs = toPositiveNumberText(containerRuntime.startTimeoutMs)
      }

      if (typeof resourceLimits.memoryMb === 'number') {
        form.containerMemoryMb = toPositiveNumberText(resourceLimits.memoryMb)
      }

      if (typeof resourceLimits.pidsLimit === 'number') {
        form.containerPidsLimit = toPositiveNumberText(resourceLimits.pidsLimit)
      }

      if (isObjectRecord(containerRuntime.env) && Object.keys(containerRuntime.env).length > 0) {
        form.containerEnv = serializeContainerEnv(containerRuntime.env)
      }

      if (isObjectRecord(containerRuntime.runnerOrchestration)) {
        form.containerRunnerOrchestration = serializeRunnerOrchestration(
          containerRuntime.runnerOrchestration,
        )
      }
    } finally {
      syncingFromContainerRuntime = false
    }
  }

  watch(
    () => form.containerSandboxProfile,
    (nextValue, previousValue) => {
      if (syncingFromContainerRuntime) {
        return
      }

      const previousProfile = resolveSandboxProfile(previousValue)
      const nextProfile = resolveSandboxProfile(nextValue)

      if (previousProfile === nextProfile) {
        return
      }

      const previousDefaults = buildDefaultFormState(previousProfile)
      const nextDefaults = buildDefaultFormState(nextProfile)

      if (form.containerStartTimeoutMs === previousDefaults.containerStartTimeoutMs) {
        form.containerStartTimeoutMs = nextDefaults.containerStartTimeoutMs
      }

      if (form.containerMemoryMb === previousDefaults.containerMemoryMb) {
        form.containerMemoryMb = nextDefaults.containerMemoryMb
      }

      if (form.containerPidsLimit === previousDefaults.containerPidsLimit) {
        form.containerPidsLimit = nextDefaults.containerPidsLimit
      }

      if (
        form.containerRunnerOrchestration.trim() ===
        previousDefaults.containerRunnerOrchestration.trim()
      ) {
        form.containerRunnerOrchestration = nextDefaults.containerRunnerOrchestration
      }
    },
  )

  const buildContainerRuntimeConfig = (): ProjectContainerRuntimeConfig | undefined => {
    const selectedProfile =
      form.containerSandboxProfile === 'preview-web'
        ? 'preview-web'
        : DEFAULT_SANDBOX_PROFILE
    const defaultFormState = buildDefaultFormState(selectedProfile)
    const defaultRunnerOrchestration =
      resolveDefaultRunnerOrchestration(selectedProfile)
    const runtimeConfig: ProjectContainerRuntimeConfig = {}

    if (
      (form.containerSandboxProfile === 'runner-only' ||
        form.containerSandboxProfile === 'preview-web') &&
      form.containerSandboxProfile !== DEFAULT_SANDBOX_PROFILE
    ) {
      runtimeConfig.sandboxProfile = form.containerSandboxProfile
    }

    const startTimeoutMs = Math.floor(Number(form.containerStartTimeoutMs) || 0)
    if (
      startTimeoutMs > 0 &&
      startTimeoutMs !== Number(defaultFormState.containerStartTimeoutMs)
    ) {
      runtimeConfig.startTimeoutMs = startTimeoutMs
    }

    const memoryMb = Math.floor(Number(form.containerMemoryMb) || 0)
    const pidsLimit = Math.floor(Number(form.containerPidsLimit) || 0)
    const defaultMemoryMb = Math.floor(Number(defaultFormState.containerMemoryMb) || 0)
    const defaultPidsLimit = Math.floor(Number(defaultFormState.containerPidsLimit) || 0)

    if (memoryMb !== defaultMemoryMb || pidsLimit !== defaultPidsLimit) {
      runtimeConfig.resourceLimits = {
        ...(memoryMb > 0 ? { memoryMb } : {}),
        ...(pidsLimit > 0 ? { pidsLimit } : {}),
      }
    }

    const parsedEnv = parseContainerEnvInput(form.containerEnv)
    if (Object.keys(parsedEnv.env).length > 0) {
      runtimeConfig.env = parsedEnv.env
    }

    const parsedRunnerOrchestration = parseRunnerOrchestrationInput(
      form.containerRunnerOrchestration,
    )
    if (
      parsedRunnerOrchestration.config &&
      normalizeComparableJson(parsedRunnerOrchestration.config) !==
        normalizeComparableJson(defaultRunnerOrchestration)
    ) {
      runtimeConfig.runnerOrchestration = parsedRunnerOrchestration.config
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
    delete nextConfigJson.runnerTemplate
    delete nextConfigJson.runnerImageBuild
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
    syncFromContainerRuntime,
    parseContainerEnvInput,
    parseRunnerOrchestrationInput,
    validateContainerRuntime,
    buildContainerRuntimeConfig,
    buildProjectConfigJson,
  }
}
