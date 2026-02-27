import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Header from '@/components/core/layouts/Header.vue'
import { notificationsApi } from '@/api/notifications'

vi.mock('@/api/notifications', () => {
  return {
    notificationsApi: {
      events: vi.fn(),
      markRead: vi.fn(),
    },
  }
})

describe('Header notifications dropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads notifications when opened and supports marking an item as read', async () => {
    vi.mocked(notificationsApi.events).mockResolvedValue([
      {
        id: 'evt-1',
        userId: 'user-1',
        eventType: 'task.completed',
        title: '任务完成',
        content: '构建任务已成功完成',
        createdAt: '2026-02-27T10:00:00.000Z',
      },
    ])
    vi.mocked(notificationsApi.markRead).mockResolvedValue({
      id: 'evt-1',
      userId: 'user-1',
      eventType: 'task.completed',
      title: '任务完成',
      content: '构建任务已成功完成',
      createdAt: '2026-02-27T10:00:00.000Z',
      readAt: '2026-02-27T10:01:00.000Z',
    })

    const wrapper = mount(Header, {
      props: {
        mobileNavOpen: false,
        pageTitle: '仪表盘',
        breadcrumbs: ['项目菜单', '仪表盘'],
        toggleMobileNav: () => undefined,
      },
    })

    await wrapper.get('button[aria-label="消息中心"]').trigger('click')
    await flushPromises()

    expect(notificationsApi.events).toHaveBeenCalledWith({ limit: 12 })
    expect(wrapper.text()).toContain('消息中心')
    expect(wrapper.text()).toContain('构建任务已成功完成')

    const markReadButton = wrapper.findAll('button').find((button) => button.text().includes('标记已读'))
    expect(markReadButton).toBeDefined()
    await markReadButton!.trigger('click')
    await flushPromises()

    expect(notificationsApi.markRead).toHaveBeenCalledWith('evt-1')
  })
})
