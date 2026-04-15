import { describe, expect, it, vi } from 'vitest'
import {
  refreshSidebarRecentTasks,
  registerSidebarRecentTasksRefresh,
  unregisterSidebarRecentTasksRefresh,
} from '@shared/utils/sidebar-recent-tasks-refresh'

describe('sidebar-recent-tasks-refresh', () => {
  it('no-ops when nothing registered', async () => {
    unregisterSidebarRecentTasksRefresh()
    await expect(refreshSidebarRecentTasks()).resolves.toBeUndefined()
  })

  it('calls registered refresh', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    registerSidebarRecentTasksRefresh(fn)
    await refreshSidebarRecentTasks()
    expect(fn).toHaveBeenCalledTimes(1)
    unregisterSidebarRecentTasksRefresh()
  })
})
