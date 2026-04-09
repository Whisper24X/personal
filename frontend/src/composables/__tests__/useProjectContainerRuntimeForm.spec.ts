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

    expect(form.containerEnv).toBe('')
    expect(form.containerRunnerOrchestration).toBe('')

    const configJson = containerRuntimeForm.buildProjectConfigJson({
      existing: true,
    })

    expect(configJson).toEqual({
      existing: true,
    })
  })

  it('removes legacy project runtime fields when there are no supported overrides left', () => {
    const form = createProjectContainerRuntimeFormState()
    const containerRuntimeForm = useProjectContainerRuntimeForm(form)

    containerRuntimeForm.syncFromContainerRuntime({
      sandboxProfile: 'preview-web',
    })

    const configJson = containerRuntimeForm.buildProjectConfigJson({
      existing: true,
      containerRuntime: {
        sandboxProfile: 'preview-web',
      },
    })

    expect(configJson).toEqual({
      existing: true,
    })
  })

  it('hydrates runner orchestration JSON from containerRuntime and writes it back into configJson', () => {
    const form = createProjectContainerRuntimeFormState()
    const containerRuntimeForm = useProjectContainerRuntimeForm(form)

    containerRuntimeForm.syncFromContainerRuntime({
      env: {
        PORT: '4173',
      },
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

    expect(form.containerEnv).toBe('PORT=4173')
    expect(form.containerRunnerOrchestration).toContain('"services"')

    const configJson = containerRuntimeForm.buildProjectConfigJson({
      existing: true,
    })

    expect(configJson).toEqual({
      existing: true,
      containerRuntime: {
        env: {
          PORT: '4173',
        },
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
