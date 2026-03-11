import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Header from '@/components/core/layouts/Header.vue'
import { notificationsApi } from '@/api/notifications'

vi.mock('@/api/notifications', () => {
  return {
    notificationsApi: {
      events: vi.fn(),
      markRead: vi.fn(),
      markAllRead: vi.fn(),
      deleteRead: vi.fn(),
      unreadCount: vi.fn().mockResolvedValue({ count: 0 }),
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
        currentProjectName: 'Project 1',
        showCurrentProjectName: true,
        breadcrumbs: ['项目菜单', '仪表盘'],
        toggleMobileNav: () => undefined,
      },
    })

    await wrapper.get('button[aria-label="消息中心"]').trigger('click')
    await flushPromises()

    expect(notificationsApi.events).toHaveBeenCalledWith({ limit: 50 })
    expect(wrapper.text()).toContain('消息中心')
    expect(wrapper.text()).toContain('构建任务已成功完成')

    const markReadButton = wrapper.findAll('button').find((button) => button.text().includes('标记已读'))
    expect(markReadButton).toBeDefined()
    await markReadButton!.trigger('click')
    await flushPromises()

    expect(notificationsApi.markRead).toHaveBeenCalledWith('evt-1')
  })

  it('shows unread badge on mount based on unreadCount API', async () => {
    vi.mocked(notificationsApi.unreadCount).mockResolvedValue({ count: 5 })

    const wrapper = mount(Header, {
      props: {
        mobileNavOpen: false,
        pageTitle: '仪表盘',
        currentProjectName: 'Project 1',
        showCurrentProjectName: true,
        breadcrumbs: [],
        toggleMobileNav: () => undefined,
      },
    })

    await flushPromises()

    const badge = wrapper.find('.bg-destructive')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('5')
  })

  it('marks all events as read when clicking 全部已读', async () => {
    vi.mocked(notificationsApi.events).mockResolvedValue([
      {
        id: 'evt-1',
        userId: 'user-1',
        eventType: 'task.done',
        title: '任务完成',
        content: '内容1',
        createdAt: '2026-03-01T10:00:00.000Z',
      },
      {
        id: 'evt-2',
        userId: 'user-1',
        eventType: 'task.done',
        title: '任务完成2',
        content: '内容2',
        createdAt: '2026-03-01T11:00:00.000Z',
      },
    ])
    vi.mocked(notificationsApi.markAllRead).mockResolvedValue({ affected: 2 })

    const wrapper = mount(Header, {
      props: {
        mobileNavOpen: false,
        pageTitle: '仪表盘',
        currentProjectName: 'Project 1',
        showCurrentProjectName: true,
        breadcrumbs: [],
        toggleMobileNav: () => undefined,
      },
    })

    await wrapper.get('button[aria-label="消息中心"]').trigger('click')
    await flushPromises()

    const markAllButton = wrapper.findAll('button').find((b) => b.text() === '全部已读')
    expect(markAllButton).toBeDefined()
    await markAllButton!.trigger('click')
    await flushPromises()

    expect(notificationsApi.markAllRead).toHaveBeenCalled()
  })

  it('deletes read events when clicking 清除已读', async () => {
    vi.mocked(notificationsApi.events).mockResolvedValue([
      {
        id: 'evt-1',
        userId: 'user-1',
        eventType: 'task.done',
        title: '任务完成',
        content: '内容1',
        createdAt: '2026-03-01T10:00:00.000Z',
        readAt: '2026-03-01T10:05:00.000Z',
      },
      {
        id: 'evt-2',
        userId: 'user-1',
        eventType: 'task.done',
        title: '任务完成2',
        content: '内容2',
        createdAt: '2026-03-01T11:00:00.000Z',
      },
    ])
    vi.mocked(notificationsApi.deleteRead).mockResolvedValue({ affected: 1 })

    const wrapper = mount(Header, {
      props: {
        mobileNavOpen: false,
        pageTitle: '仪表盘',
        currentProjectName: 'Project 1',
        showCurrentProjectName: true,
        breadcrumbs: [],
        toggleMobileNav: () => undefined,
      },
    })

    await wrapper.get('button[aria-label="消息中心"]').trigger('click')
    await flushPromises()

    const deleteButton = wrapper.findAll('button').find((b) => b.text() === '清除已读')
    expect(deleteButton).toBeDefined()
    await deleteButton!.trigger('click')
    await flushPromises()

    expect(notificationsApi.deleteRead).toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('内容1')
    expect(wrapper.text()).toContain('内容2')
  })
})
