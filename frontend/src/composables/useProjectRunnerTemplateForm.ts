import {
  DEFAULT_PROJECT_RUNNER_DOCKERFILE,
  DEFAULT_PROJECT_RUNNER_NGINX_CONF,
  DEFAULT_PROJECT_RUNNER_SUPERVISORD_CONF,
} from '@/constants/project-runner-template-defaults'
import type { ProjectRunnerTemplateConfig } from '@/types/api/projects'

export type ProjectRunnerTemplateFormState = {
  runnerDockerfile: string
  runnerSandboxNginxConf: string
  runnerSandboxSupervisordConf: string
}

export const createProjectRunnerTemplateFormState = (): ProjectRunnerTemplateFormState => ({
  runnerDockerfile: '',
  runnerSandboxNginxConf: '',
  runnerSandboxSupervisordConf: '',
})

const MAX_TEMPLATE_LENGTH = 200_000

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const normalizeTemplateContent = (value: unknown) => {
  return typeof value === 'string' ? value : ''
}

export const useProjectRunnerTemplateForm = (form: ProjectRunnerTemplateFormState) => {
  const applyDefaultRunnerTemplates = () => {
    form.runnerDockerfile = DEFAULT_PROJECT_RUNNER_DOCKERFILE
    form.runnerSandboxNginxConf = DEFAULT_PROJECT_RUNNER_NGINX_CONF
    form.runnerSandboxSupervisordConf = DEFAULT_PROJECT_RUNNER_SUPERVISORD_CONF
  }

  const clearRunnerTemplateOverrides = () => {
    form.runnerDockerfile = ''
    form.runnerSandboxNginxConf = ''
    form.runnerSandboxSupervisordConf = ''
  }

  const syncFromRunnerTemplate = (
    value?: unknown,
    options?: { whenMissing?: 'empty' | 'defaults' },
  ) => {
    const runnerTemplate = isObjectRecord(value) ? value : null
    const whenMissing = options?.whenMissing ?? 'empty'

    if (!runnerTemplate) {
      if (whenMissing === 'defaults') {
        applyDefaultRunnerTemplates()
      } else {
        clearRunnerTemplateOverrides()
      }
      return
    }

    form.runnerDockerfile = normalizeTemplateContent(runnerTemplate.dockerfileRunner)
    form.runnerSandboxNginxConf = normalizeTemplateContent(
      runnerTemplate.sandboxNginxConf,
    )
    form.runnerSandboxSupervisordConf = normalizeTemplateContent(
      runnerTemplate.sandboxSupervisordConf,
    )
  }

  const buildRunnerTemplateConfig = (): ProjectRunnerTemplateConfig | undefined => {
    const dockerfileRunner = form.runnerDockerfile
    const sandboxNginxConf = form.runnerSandboxNginxConf
    const sandboxSupervisordConf = form.runnerSandboxSupervisordConf

    if (
      !dockerfileRunner.trim() &&
      !sandboxNginxConf.trim() &&
      !sandboxSupervisordConf.trim()
    ) {
      return undefined
    }

    return {
      ...(dockerfileRunner.trim() ? { dockerfileRunner } : {}),
      ...(sandboxNginxConf.trim() ? { sandboxNginxConf } : {}),
      ...(sandboxSupervisordConf.trim() ? { sandboxSupervisordConf } : {}),
    }
  }

  const validateRunnerTemplate = () => {
    const templates = [
      { label: 'Dockerfile.runner', value: form.runnerDockerfile },
      { label: 'sandbox.nginx.conf', value: form.runnerSandboxNginxConf },
      {
        label: 'sandbox.supervisord.conf',
        value: form.runnerSandboxSupervisordConf,
      },
    ]

    for (const item of templates) {
      if (item.value.length > MAX_TEMPLATE_LENGTH) {
        return `${item.label} 不能超过 ${MAX_TEMPLATE_LENGTH} 个字符`
      }
    }

    if (form.runnerDockerfile.trim() && !/^\s*FROM\s+/m.test(form.runnerDockerfile)) {
      return 'Dockerfile.runner 需至少包含一条 FROM 指令'
    }

    return ''
  }

  const buildProjectConfigJson = (currentConfigJson?: Record<string, unknown> | null) => {
    const nextConfigJson = isObjectRecord(currentConfigJson) ? { ...currentConfigJson } : {}
    const runnerTemplate = buildRunnerTemplateConfig()

    if (runnerTemplate) {
      nextConfigJson.runnerTemplate = runnerTemplate
    } else {
      delete nextConfigJson.runnerTemplate
    }

    return Object.keys(nextConfigJson).length > 0 ? nextConfigJson : undefined
  }

  return {
    applyDefaultRunnerTemplates,
    clearRunnerTemplateOverrides,
    syncFromRunnerTemplate,
    validateRunnerTemplate,
    buildRunnerTemplateConfig,
    buildProjectConfigJson,
  }
}
