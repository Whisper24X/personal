import { DOMWrapper, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import AgentToolConfigModal from '@/components/business/settings/modals/AgentToolConfigModal.vue'

const mountModal = (
  cliToolId: string,
  cliToolLabel: string,
  initialConfig: Record<string, unknown> = {},
) =>
  mount(AgentToolConfigModal, {
    props: {
      open: true,
      mode: 'create',
      submitting: false,
      cliToolId,
      cliToolLabel,
      initialName: '',
      initialDescription: '',
      initialIsDefault: false,
      initialConfig,
    },
    global: {
      stubs: {
        teleport: true,
      },
    },
  })

const findField = (wrapper: ReturnType<typeof mount>, labelText: string) => {
  const label = wrapper.findAll('label').find((item) => item.text().trim() === labelText)

  if (!label?.element.parentElement) {
    throw new Error(`Field ${labelText} not found`)
  }

  return new DOMWrapper(label.element.parentElement)
}

const hasField = (wrapper: ReturnType<typeof mount>, labelText: string) => {
  return wrapper.findAll('label').some((item) => item.text().trim() === labelText)
}

const selectOption = async (field: DOMWrapper<Element>, label: string) => {
  await field.find('button[aria-haspopup="listbox"]').trigger('click')
  await nextTick()

  const localOption = field.findAll('button[role="option"]').find((button) => {
    return button.text().includes(label)
  })

  if (localOption) {
    await localOption.trigger('click')
    return
  }

  const option = Array.from(document.body.querySelectorAll('button[role="option"]')).find(
    (button) => button.textContent?.includes(label),
  ) as HTMLButtonElement | undefined

  if (!option) {
    throw new Error(`Option ${label} not found`)
  }

  option.click()
}

describe('AgentToolConfigModal', () => {
  it('applies highest-permission Cursor defaults on submit', async () => {
    const wrapper = mountModal('cursor-agent', 'Cursor Agent')

    await wrapper.find('input[name="agent-cli-config-name"]').setValue('default')
    await wrapper.find('form').trigger('submit.prevent')

    const payload = wrapper.emitted('submit')?.[0]?.[0] as {
      config: Record<string, unknown>
    }

    expect(payload.config.trust).toBe(true)
    expect(payload.config.force).toBe(true)
    expect(hasField(wrapper, 'Base Command Override')).toBe(false)
    expect(hasField(wrapper, 'Additional Params')).toBe(false)
    expect(wrapper.text()).toContain('信任工作区并强制放行命令执行')
  })

  it('normalizes Cursor headers into string array on submit', async () => {
    const wrapper = mountModal('cursor-agent', 'Cursor Agent', {
      headers: ['X-Team: ainative'],
      trust: false,
      force: false,
    })

    const headersField = findField(wrapper, 'Headers')
    await headersField.find('textarea').setValue('X-Team: ainative\nX-Trace-Id: 123')

    await wrapper.find('input[name="agent-cli-config-name"]').setValue('default')
    await wrapper.find('form').trigger('submit.prevent')

    const payload = wrapper.emitted('submit')?.[0]?.[0] as {
      config: Record<string, unknown>
    }

    expect(payload.config.headers).toEqual([
      'X-Team: ainative',
      'X-Trace-Id: 123',
    ])
  })

  it('applies highest-permission Codex defaults on submit', async () => {
    const wrapper = mountModal('codex', 'Codex')

    await wrapper.find('input[name="agent-cli-config-name"]').setValue('default')
    await wrapper.find('form').trigger('submit.prevent')

    const payload = wrapper.emitted('submit')?.[0]?.[0] as {
      config: Record<string, unknown>
    }

    expect(payload.config.model).toBe('gpt-5.4')
    expect(payload.config.execution_mode).toBe(
      'dangerously-bypass-approvals-and-sandbox',
    )
    expect(wrapper.text()).toContain('跳过审批并关闭沙箱')
  })

  it('clears Codex sandbox when execution mode is not standard', async () => {
    const wrapper = mountModal('codex', 'Codex', {
      execution_mode: 'standard',
      sandbox: 'danger-full-access',
    })

    const executionModeField = findField(wrapper, 'Execution Mode')
    await selectOption(executionModeField, 'Dangerously Bypass Approvals And Sandbox')

    const sandboxField = findField(wrapper, 'Sandbox')
    expect(sandboxField.find('button[aria-haspopup="listbox"]').attributes('disabled')).toBeDefined()

    await wrapper.find('input[name="agent-cli-config-name"]').setValue('default')
    await wrapper.find('form').trigger('submit.prevent')

    const payload = wrapper.emitted('submit')?.[0]?.[0] as {
      config: Record<string, unknown>
    }

    expect(payload.config.sandbox).toBe('')
  })

  it('applies highest-permission Claude defaults on submit', async () => {
    const wrapper = mountModal('claude-code', 'Claude Code')

    await wrapper.find('input[name="agent-cli-config-name"]').setValue('default')
    await wrapper.find('form').trigger('submit.prevent')

    const payload = wrapper.emitted('submit')?.[0]?.[0] as {
      config: Record<string, unknown>
    }

    expect(payload.config.dangerously_skip_permissions).toBe(true)
    expect(wrapper.text()).toContain('跳过 Claude Code 的权限检查')
  })

  it('clears Claude permission mode when dangerous skip is enabled', async () => {
    const wrapper = mountModal('claude-code', 'Claude Code', {
      dangerously_skip_permissions: false,
      permission_mode: 'plan',
    })

    const dangerField = findField(wrapper, 'Dangerously Skip Permissions')
    await dangerField.find('input[type="checkbox"]').setValue(true)

    expect(hasField(wrapper, 'Permission Mode')).toBe(false)

    await wrapper.find('input[name="agent-cli-config-name"]').setValue('default')
    await wrapper.find('form').trigger('submit.prevent')

    const payload = wrapper.emitted('submit')?.[0]?.[0] as {
      config: Record<string, unknown>
    }

    expect(payload.config.permission_mode).toBe('')
    expect(payload.config.dangerously_skip_permissions).toBe(true)
  })

  it('applies highest-permission Gemini defaults on submit', async () => {
    const wrapper = mountModal('gemini-cli', 'Gemini CLI')

    await wrapper.find('input[name="agent-cli-config-name"]').setValue('default')
    await wrapper.find('form').trigger('submit.prevent')

    const payload = wrapper.emitted('submit')?.[0]?.[0] as {
      config: Record<string, unknown>
    }

    expect(payload.config.yolo).toBe(true)
    expect(hasField(wrapper, 'Approval Mode')).toBe(false)
    expect(hasField(wrapper, 'Resume')).toBe(false)
    expect(hasField(wrapper, 'Additional Params')).toBe(false)
    expect(wrapper.text()).toContain('自动接受 Gemini 的所有操作')
  })

  it('clears Gemini approval mode when yolo is enabled', async () => {
    const wrapper = mountModal('gemini-cli', 'Gemini CLI', {
      yolo: false,
      approval_mode: 'plan',
    })

    const yoloField = findField(wrapper, 'Yolo')
    await yoloField.find('input[type="checkbox"]').setValue(true)

    expect(hasField(wrapper, 'Approval Mode')).toBe(false)

    await wrapper.find('input[name="agent-cli-config-name"]').setValue('default')
    await wrapper.find('form').trigger('submit.prevent')

    const payload = wrapper.emitted('submit')?.[0]?.[0] as {
      config: Record<string, unknown>
    }

    expect(payload.config.approval_mode).toBe('')
    expect(payload.config.yolo).toBe(true)
  })

  it('submits OpenCode structured fields and hides removed legacy fields', async () => {
    const wrapper = mountModal('opencode', 'OpenCode', {
      fork: false,
    })

    expect(hasField(wrapper, 'Session')).toBe(false)
    expect(hasField(wrapper, 'Continue')).toBe(false)
    expect(hasField(wrapper, 'Variant')).toBe(false)
    expect(hasField(wrapper, 'Auto Approve')).toBe(false)

    await findField(wrapper, 'Model').find('input').setValue('openai/gpt-5')
    await findField(wrapper, 'Agent').find('input').setValue('builder')
    await findField(wrapper, 'Fork').find('input[type="checkbox"]').setValue(true)
    await findField(wrapper, 'Prompt').find('textarea').setValue('Follow repository conventions first.')
    await wrapper.find('input[name="agent-cli-config-name"]').setValue('default')
    await wrapper.find('form').trigger('submit.prevent')

    const payload = wrapper.emitted('submit')?.[0]?.[0] as {
      config: Record<string, unknown>
    }

    expect(payload.config.model).toBe('openai/gpt-5')
    expect(payload.config.agent).toBe('builder')
    expect(payload.config.fork).toBe(true)
    expect(payload.config.prompt).toBe('Follow repository conventions first.')
  })
})
