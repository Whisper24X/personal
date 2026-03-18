import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WorkflowPromptVariablesHint from '@/components/workflow/WorkflowPromptVariablesHint.vue'
import { WORKFLOW_PROMPT_VARIABLES } from '@/constants/workflow'

describe('WorkflowPromptVariablesHint', () => {
  it('renders the supported workflow prompt variables', () => {
    const wrapper = mount(WorkflowPromptVariablesHint)

    for (const item of WORKFLOW_PROMPT_VARIABLES) {
      expect(wrapper.text()).toContain(`{{${item.key}}}`)
    }

    expect(wrapper.text()).toContain('不会注入环境变量或密钥')
    expect(wrapper.text()).toContain('输入')
    expect(wrapper.text()).toContain('/')
    expect(wrapper.text()).toContain('任务')
    expect(wrapper.text()).toContain('Git')
    expect(wrapper.text()).toContain('项目')
    expect(wrapper.text()).not.toContain('节点与 Agent')
  })

  it('toggles the popover variant', async () => {
    const wrapper = mount(WorkflowPromptVariablesHint, {
      props: {
        variant: 'popover',
      },
    })

    expect(wrapper.text()).not.toContain('Prompt 变量说明')

    await wrapper.get('button[aria-label="查看工作流 Prompt 变量说明"]').trigger('click')

    expect(wrapper.text()).toContain('Prompt 变量说明')
    expect(wrapper.text()).toContain('{{gitBranch}}')
  })
})
