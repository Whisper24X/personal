import type { AppRouteRecord } from '@/types/router/route'
import { appSettings } from '@/config/setting'
import { SETTINGS_QUERY_KEY } from '@/types/common/settings'

const toDashboardSettings = (section: string) => ({
  path: '/dashboard',
  query: {
    [SETTINGS_QUERY_KEY]: section,
  },
})

const resolveProjectId = (value: unknown) => {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return value[0] ?? ''
  }

  return ''
}

export const systemRoutes: AppRouteRecord[] = [
  {
    path: '/',
    redirect: appSettings.defaultRoute,
    meta: {
      title: '仪表盘',
      requiresAuth: true,
      permissions: ['dashboard:view'],
    },
  },
  {
    path: '/home',
    name: 'home',
    component: () => import('@/views/home/index.vue'),
    meta: {
      title: '首页',
      requiresAuth: true,
    },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/dashboard/index.vue'),
    meta: {
      title: '仪表盘',
      requiresAuth: true,
      permissions: ['dashboard:view'],
    },
  },
  {
    path: '/kanban',
    name: 'kanban',
    component: () => import('@/views/kanban/index.vue'),
    meta: {
      title: '看板',
      requiresAuth: true,
      permissions: ['kanban:view'],
    },
  },
  {
    path: '/skills',
    name: 'skills',
    component: () => import('@/views/skills/index.vue'),
    meta: {
      title: 'Skills',
      requiresAuth: true,
      permissions: ['skills:view'],
    },
  },
  {
    path: '/mcp',
    name: 'mcp',
    component: () => import('@/views/mcp/index.vue'),
    meta: {
      title: 'MCP',
      requiresAuth: true,
      permissions: ['mcp:view'],
    },
  },
  {
    path: '/automations',
    name: 'automations',
    component: () => import('@/views/automations/index.vue'),
    meta: {
      title: '自动化',
      requiresAuth: true,
      permissions: ['automations:view'],
    },
  },
  {
    path: '/git',
    name: 'git',
    component: () => import('@/views/git/index.vue'),
    meta: {
      title: 'Git',
      requiresAuth: true,
    },
  },
  {
    path: '/business-lines/invite',
    name: 'business-line-invite',
    component: () => import('@/views/business-lines/invite.vue'),
    meta: {
      title: '业务线邀请',
      requiresAuth: true,
    },
  },
  {
    path: '/business-lines',
    redirect: toDashboardSettings('business-lines'),
    meta: {
      title: '业务线',
      requiresAuth: true,
    },
  },
  {
    path: '/projects',
    redirect: toDashboardSettings('projects'),
    meta: {
      title: '项目列表',
      requiresAuth: true,
    },
  },
  {
    path: '/projects/workflows',
    name: 'project-workflows',
    component: () => import('@/views/projects/detail.vue'),
    meta: {
      title: '项目工作流',
      requiresAuth: true,
      permissions: ['projects:view'],
    },
  },
  {
    path: '/projects/:id',
    redirect: (to) => ({
      path: '/dashboard',
      query: {
        projectId: resolveProjectId(to.params.id),
      },
    }),
    meta: {
      title: '项目',
      requiresAuth: true,
      permissions: ['projects:view'],
    },
  },
  {
    path: '/projects/:id/workflows',
    name: 'project-workflows-by-id',
    redirect: (to) => ({
      path: '/projects/workflows',
      query: {
        projectId: resolveProjectId(to.params.id),
      },
    }),
    meta: {
      title: '项目工作流',
      requiresAuth: true,
      permissions: ['projects:view'],
    },
  },
  {
    path: '/tasks',
    name: 'tasks',
    component: () => import('@/views/tasks/index.vue'),
    meta: {
      title: '任务',
      requiresAuth: true,
      permissions: ['tasks:view'],
    },
  },
  {
    path: '/task-detail/:id',
    name: 'task-detail',
    component: () => import('@/views/tasks/detail.vue'),
    meta: {
      title: '任务详情',
      contentMode: 'full',
      requiresAuth: true,
      permissions: ['tasks:view'],
    },
  },
  {
    path: '/users',
    redirect: toDashboardSettings('users'),
    meta: {
      title: '用户管理',
      requiresAuth: true,
    },
  },
  {
    path: '/settings',
    redirect: toDashboardSettings('account'),
    meta: {
      title: '设置',
      requiresAuth: true,
    },
  },
]
