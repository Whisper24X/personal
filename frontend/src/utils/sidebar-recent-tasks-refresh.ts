let refreshImpl: (() => Promise<void>) | null = null

export function registerSidebarRecentTasksRefresh(fn: () => Promise<void>): void {
  refreshImpl = fn
}

export function unregisterSidebarRecentTasksRefresh(): void {
  refreshImpl = null
}

export async function refreshSidebarRecentTasks(): Promise<void> {
  if (!refreshImpl) {
    return
  }
  await refreshImpl()
}
