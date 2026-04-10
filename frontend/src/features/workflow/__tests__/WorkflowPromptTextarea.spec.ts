import { defineComponent, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WorkflowPromptTextarea from '@features/workflow/WorkflowPromptTextarea.vue'

const TestHarness = defineComponent({
  components: {
    WorkflowPromptTextarea,
  },
  setup() {
    const value = ref('')

    return {
      value,
    }
  },
  template: `
    <WorkflowPromptTextarea v-model="value" data-testid="workflow-prompt-textarea" />
  `,
})

describe('WorkflowPromptTextarea', () => {
  it('shows workflow variables after typing slash', async () => {
    const wrapper = mount(TestHarness)
    const textarea = wrapper.get('[data-testid="workflow-prompt-textarea"]')

    await textarea.setValue('/')

    expect(wrapper.text()).toContain('{{gitBranch}}')
    expect(wrapper.text()).toContain('任务标题')
  })

  it('inserts a selected workflow variable into the prompt', async () => {
    const wrapper = mount(TestHarness)
    const textarea = wrapper.get('[data-testid="workflow-prompt-textarea"]')

    await textarea.setValue('/taskP')
    const variableButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('{{taskPrompt}}'))

    expect(variableButton).toBeDefined()
    await variableButton!.trigger('click')

    expect((textarea.element as HTMLTextAreaElement).value).toBe('{{taskPrompt}}')
  })
})
