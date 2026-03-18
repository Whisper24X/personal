import { DOMWrapper, mount } from '@vue/test-utils'
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

describe('AgentToolConfigModal', () => {
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
    await executionModeField.find('select').setValue(
      'dangerously-bypass-approvals-and-sandbox',
    )

    const sandboxField = findField(wrapper, 'Sandbox')
    expect(sandboxField.find('select').attributes('disabled')).toBeDefined()

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

    const permissionModeField = findField(wrapper, 'Permission Mode')
    expect(permissionModeField.find('select').attributes('disabled')).toBeDefined()

    await wrapper.find('input[name="agent-cli-config-name"]').setValue('default')
    await wrapper.find('form').trigger('submit.prevent')

    const payload = wrapper.emitted('submit')?.[0]?.[0] as {
      config: Record<string, unknown>
    }

    expect(payload.config.permission_mode).toBe('')
    expect(payload.config.dangerously_skip_permissions).toBe(true)
  })
})
