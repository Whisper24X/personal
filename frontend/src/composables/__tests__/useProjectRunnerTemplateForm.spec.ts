import { describe, expect, it } from 'vitest'
import {
  createProjectRunnerTemplateFormState,
  useProjectRunnerTemplateForm,
} from '@/composables/useProjectRunnerTemplateForm'

describe('useProjectRunnerTemplateForm', () => {
  it('hydrates default templates on create and writes runnerTemplate back into configJson', () => {
    const form = createProjectRunnerTemplateFormState()
    const runnerTemplateForm = useProjectRunnerTemplateForm(form)

    runnerTemplateForm.syncFromRunnerTemplate(null, {
      whenMissing: 'defaults',
    })

    const configJson = runnerTemplateForm.buildProjectConfigJson({
      existing: true,
    })

    expect(form.runnerDockerfile).toContain('FROM golang:1.23-bookworm')
    expect(configJson).toMatchObject({
      existing: true,
      runnerTemplate: {
        dockerfileRunner: expect.stringContaining('FROM golang:1.23-bookworm'),
        sandboxNginxConf: expect.stringContaining('server {'),
        sandboxSupervisordConf: expect.stringContaining('[supervisord]'),
      },
    })
  })

  it('allows partial overrides and still validates dockerfile syntax when provided', () => {
    const form = createProjectRunnerTemplateFormState()
    const runnerTemplateForm = useProjectRunnerTemplateForm(form)

    form.runnerDockerfile = 'RUN echo hello'
    form.runnerSandboxNginxConf = ''
    form.runnerSandboxSupervisordConf = ''

    expect(runnerTemplateForm.validateRunnerTemplate()).toContain('FROM')

    form.runnerDockerfile = ''
    form.runnerSandboxNginxConf = 'events {}'

    expect(runnerTemplateForm.validateRunnerTemplate()).toBe('')
  })

  it('clears runnerTemplate overrides when all template fields are blank', () => {
    const form = createProjectRunnerTemplateFormState()
    const runnerTemplateForm = useProjectRunnerTemplateForm(form)

    form.runnerDockerfile = ''
    form.runnerSandboxNginxConf = ''
    form.runnerSandboxSupervisordConf = ''

    expect(
      runnerTemplateForm.buildProjectConfigJson({
        runnerTemplate: {
          dockerfileRunner: 'FROM node:20',
        },
        keep: true,
      }),
    ).toEqual({
      keep: true,
    })
  })
})
