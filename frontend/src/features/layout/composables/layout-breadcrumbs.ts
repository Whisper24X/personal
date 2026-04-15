import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { SETTINGS_SECTION_LABELS, type SettingsSection } from '@shared/types/common/settings'

/**
 * 顶栏/布局面包屑文案（与 useLayout 内原 computed 一致）。
 */
export function computeLayoutBreadcrumbs(
  route: RouteLocationNormalizedLoaded,
  settingsSection: SettingsSection | null,
  hasSettingsQuery: boolean,
): string[] {
  if (hasSettingsQuery && settingsSection) {
    return ['工作区', '设置', SETTINGS_SECTION_LABELS[settingsSection]]
  }

  if (route.name === 'home') return ['工作区', '首页']
  if (route.name === 'business-lines-manage') return ['工作区', '业务线管理']
  if (route.name === 'dashboard') return ['项目菜单', '仪表盘']
  if (route.name === 'project-workflows') return ['项目菜单', '工作流']
  if (route.name === 'project-workflows-by-id') return ['项目菜单', '工作流']
  if (route.name === 'kanban') return ['项目菜单', '看板']
  if (route.name === 'knowledge-base') return ['项目菜单', '知识库']
  if (route.name === 'skills') return ['项目菜单', 'Skills']
  if (route.name === 'mcp') return ['项目菜单', 'MCP']
  if (route.name === 'automations') return ['项目菜单', '自动化']
  if (route.name === 'tasks') return ['项目菜单', '新建任务']
  if (route.name === 'task-detail') return ['项目菜单', '新建任务', '任务详情']
  if (route.name === 'project-goals') return ['项目菜单', '需求']
  if (route.name === 'goal-create') return ['项目菜单', '需求', '新建需求']
  if (route.name === 'goal-detail') return ['项目菜单', '需求', '需求详情']
  return ['项目菜单']
}
