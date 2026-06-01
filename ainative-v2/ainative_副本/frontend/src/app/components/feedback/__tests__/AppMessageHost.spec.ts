import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import AppMessageHost from '../AppMessageHost.vue'
import { useMessageStore } from '@app/stores/modules/message'

describe('AppMessageHost', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders queued messages in stack order', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(AppMessageHost, {
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    const store = useMessageStore()
    store.info('第一条')
    store.error('第二条')

    await nextTick()

    const texts = wrapper.findAll('.app-message-text').map((item) => item.text())
    expect(texts).toEqual(['第二条', '第一条'])
  })

  it('removes message when close button is clicked', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(AppMessageHost, {
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    const store = useMessageStore()
    store.success('可关闭消息')

    await nextTick()
    expect(wrapper.text()).toContain('可关闭消息')

    const closeButton = wrapper.find('button[aria-label="关闭消息"]')
    await closeButton.trigger('click')

    expect(store.items).toHaveLength(0)
  })
})
