import { describe, expect, it } from 'vitest'
import {
  createProjectContainerRuntimeFormState,
  useProjectContainerRuntimeForm,
} from '@/composables/useProjectContainerRuntimeForm'

describe('useProjectContainerRuntimeForm', () => {
  it('fills the form with concrete defaults without persisting unchanged defaults', () => {
    const form = createProjectContainerRuntimeFormState()
    const containerRuntimeForm = useProjectContainerRuntimeForm(form)

    containerRuntimeForm.syncFromContainerRuntime()

    expect(form.containerSandboxProfile).toBe('runner-only')
    expect(form.containerStartTimeoutMs).toBe('30000')
    expect(form.containerMemoryMb).toBe('0')
    expect(form.containerPidsLimit).toBe('0')
    expect(form.containerEnv).toBe('# 无额外环境变量')
    expect(form.containerRunnerOrchestration).toContain('"services"')

    const configJson = containerRuntimeForm.buildProjectConfigJson({
      existing: true,
    })

    expect(configJson).toEqual({
      existing: true,
    })
  })

  it('applies preview-web defaults when only the sandbox profile is overridden', () => {
    const form = createProjectContainerRuntimeFormState()
    const containerRuntimeForm = useProjectContainerRuntimeForm(form)

    containerRuntimeForm.syncFromContainerRuntime({
      sandboxProfile: 'preview-web',
    })

    expect(form.containerSandboxProfile).toBe('preview-web')
    expect(form.containerStartTimeoutMs).toBe('300000')
    expect(form.containerMemoryMb).toBe('2048')
    expect(form.containerPidsLimit).toBe('256')
    expect(form.containerRunnerOrchestration).toContain('"ainative-backend"')
    expect(form.containerRunnerOrchestration).toContain('"ainative-shadow"')
    expect(form.containerRunnerOrchestration).toContain('"ainative-app"')
    expect(form.containerRunnerOrchestration).toContain('"preview"')

    const configJson = containerRuntimeForm.buildProjectConfigJson({
      existing: true,
    })

    expect(configJson).toEqual({
      existing: true,
      containerRuntime: {
        sandboxProfile: 'preview-web',
      },
    })
  })

  it('hydrates runner orchestration JSON from containerRuntime and writes it back into configJson', () => {
    const form = createProjectContainerRuntimeFormState()
    const containerRuntimeForm = useProjectContainerRuntimeForm(form)

    containerRuntimeForm.syncFromContainerRuntime({
      sandboxProfile: 'preview-web',
      runnerOrchestration: {
        services: [
          {
            name: 'backend',
            workdir: 'backend',
            command: 'npm run start:dev',
          },
        ],
      },
    })

    expect(form.containerRunnerOrchestration).toContain('"services"')

    const configJson = containerRuntimeForm.buildProjectConfigJson({
      existing: true,
    })

    expect(configJson).toEqual({
      existing: true,
      containerRuntime: {
        sandboxProfile: 'preview-web',
        runnerOrchestration: {
          services: [
            {
              name: 'backend',
              workdir: 'backend',
              command: 'npm run start:dev',
            },
          ],
        },
      },
    })
  })

  it('rejects invalid orchestration JSON and missing services arrays', () => {
    const form = createProjectContainerRuntimeFormState()
    const containerRuntimeForm = useProjectContainerRuntimeForm(form)

    form.containerRunnerOrchestration = '{ invalid'
    expect(containerRuntimeForm.validateContainerRuntime()).toContain('JSON 解析失败')

    form.containerRunnerOrchestration = JSON.stringify({
      routes: [],
    })
    expect(containerRuntimeForm.validateContainerRuntime()).toContain('services 数组')

    form.containerRunnerOrchestration = JSON.stringify({
      services: [
        {
          name: 'web',
          workdir: 'web',
          command: 'pnpm dev',
        },
      ],
      preview: {
        service: 'api',
      },
    })
    expect(containerRuntimeForm.validateContainerRuntime()).toContain('预览入口服务不存在')
  })
})
