import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ReplyCard from '../ReplyCard.vue'

describe('ReplyCard', () => {
  it('renders only textarea and integrated send button', () => {
    const wrapper = mount(ReplyCard)

    expect(wrapper.find('textarea').attributes('placeholder')).toBe('补充指令或继续提问...')
    expect(wrapper.find('button').attributes('aria-label')).toBe('请输入回复后发送')
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('emits trimmed content on submit', async () => {
    const wrapper = mount(ReplyCard)
    const textarea = wrapper.find('textarea')

    await textarea.setValue('  跟进这个任务  ')

    expect(wrapper.find('button').attributes('aria-label')).toBe('发送回复')

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('submit')).toEqual([['跟进这个任务']])
    expect((textarea.element as HTMLTextAreaElement).value).toBe('')
  })

  it('submits on enter', async () => {
    const wrapper = mount(ReplyCard)
    const textarea = wrapper.find('textarea')

    await textarea.setValue('继续执行')
    await textarea.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('submit')).toEqual([['继续执行']])
    expect((textarea.element as HTMLTextAreaElement).value).toBe('')
  })

  it('keeps newline behavior on shift enter', async () => {
    const wrapper = mount(ReplyCard)
    const textarea = wrapper.find('textarea')

    await textarea.setValue('第一行')
    await textarea.trigger('keydown', { key: 'Enter', shiftKey: true })

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect((textarea.element as HTMLTextAreaElement).value).toBe('第一行')
  })

  it('switches to interrupt action while cli is running', async () => {
    const wrapper = mount(ReplyCard, {
      props: {
        disabled: true,
        running: true,
        canInterrupt: true,
      },
    })

    expect(wrapper.find('button').attributes('aria-label')).toBe('停止当前执行')
    expect(wrapper.find('button').attributes('disabled')).toBeUndefined()

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('interrupt')).toEqual([[]])
  })

  it('shows disabled state when replies are unavailable', () => {
    const wrapper = mount(ReplyCard, {
      props: {
        disabled: true,
      },
    })

    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })
})
