import { describe, expect, it } from 'vitest'
import {
  createProjectContainerRuntimeFormState,
  useProjectContainerRuntimeForm,
} from '@/composables/useProjectContainerRuntimeForm'

describe('useProjectContainerRuntimeForm', () => {
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
  })
})
