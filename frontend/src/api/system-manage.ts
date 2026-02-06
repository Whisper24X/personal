export type SystemMenuItem = {
  key: string
  title: string
  path: string
}

export const systemManageApi = {
  async fetchMenuList(): Promise<SystemMenuItem[]> {
    return [
      { key: 'dashboard', title: '仪表盘', path: '/dashboard' },
      { key: 'tasks', title: '任务', path: '/tasks' },
      { key: 'projects', title: '项目', path: '/projects' },
    ]
  },
}
