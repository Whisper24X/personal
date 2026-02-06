import type { AppRouteRecord } from '@/types/router/route'

export const systemRoutes: AppRouteRecord[] = [
  {
    path: '/',
    redirect: '/dashboard',
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
    },
  },
  {
    path: '/kanban',
    name: 'kanban',
    component: () => import('@/views/kanban/index.vue'),
    meta: {
      title: '看板',
      requiresAuth: true,
    },
  },
  {
    path: '/workflow',
    name: 'workflow',
    component: () => import('@/views/workflow/index.vue'),
    meta: {
      title: '工作流',
      requiresAuth: true,
    },
  },
  {
    path: '/skills',
    name: 'skills',
    component: () => import('@/views/skills/index.vue'),
    meta: {
      title: 'Skill',
      requiresAuth: true,
    },
  },
  {
    path: '/mcp',
    name: 'mcp',
    component: () => import('@/views/mcp/index.vue'),
    meta: {
      title: 'MCP',
      requiresAuth: true,
    },
  },
  {
    path: '/automations',
    name: 'automations',
    component: () => import('@/views/automations/index.vue'),
    meta: {
      title: '自动化',
      requiresAuth: true,
    },
  },
  {
    path: '/projects',
    name: 'projects',
    component: () => import('@/views/projects/index.vue'),
    meta: {
      title: '项目列表',
      requiresAuth: true,
    },
  },
  {
    path: '/projects/:id',
    name: 'project-detail',
    component: () => import('@/views/projects/detail.vue'),
    meta: {
      title: '项目详情',
      requiresAuth: true,
    },
  },
  {
    path: '/tasks',
    name: 'tasks',
    component: () => import('@/views/tasks/index.vue'),
    meta: {
      title: '任务',
      requiresAuth: true,
    },
  },
  {
    path: '/tasks/:id',
    name: 'task-detail',
    component: () => import('@/views/tasks/detail.vue'),
    meta: {
      title: '任务详情',
      requiresAuth: true,
    },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/settings/index.vue'),
    meta: {
      title: '设置',
      requiresAuth: true,
    },
  },
]
