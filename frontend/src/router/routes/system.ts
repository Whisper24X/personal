import type { AppRouteRecord } from '@/types/router/route'

export const systemRoutes: AppRouteRecord[] = [
  {
    path: '/',
    redirect: '/home',
    meta: {
      title: '首页',
      requiresAuth: true,
      permissions: ['home:view'],
    },
  },
  {
    path: '/home',
    name: 'home',
    component: () => import('@/views/home/index.vue'),
    meta: {
      title: '首页',
      requiresAuth: true,
      permissions: ['home:view'],
    },
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/views/about/index.vue'),
    meta: {
      title: '关于',
      requiresAuth: true,
      permissions: ['about:view'],
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
    path: '/workflow',
    name: 'workflow',
    component: () => import('@/views/workflow/index.vue'),
    meta: {
      title: '工作流',
      requiresAuth: true,
      permissions: ['workflow:view'],
    },
  },
  {
    path: '/skills',
    name: 'skills',
    component: () => import('@/views/skills/index.vue'),
    meta: {
      title: 'Skill',
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
    path: '/business-lines',
    name: 'business-lines',
    component: () => import('@/views/business-lines/index.vue'),
    meta: {
      title: '业务线',
      requiresAuth: true,
      permissions: ['business-lines:view'],
    },
  },
  {
    path: '/projects',
    name: 'projects',
    component: () => import('@/views/projects/index.vue'),
    meta: {
      title: '项目列表',
      requiresAuth: true,
      permissions: ['projects:view'],
    },
  },
  {
    path: '/projects/:id',
    name: 'project-detail',
    component: () => import('@/views/projects/detail.vue'),
    meta: {
      title: '项目详情',
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
    path: '/tasks/:id',
    name: 'task-detail',
    component: () => import('@/views/tasks/detail.vue'),
    meta: {
      title: '任务详情',
      requiresAuth: true,
      permissions: ['tasks:view'],
    },
  },
  {
    path: '/users',
    name: 'users',
    component: () => import('@/views/users/index.vue'),
    meta: {
      title: '用户管理',
      requiresAuth: true,
      permissions: ['users:view'],
    },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/settings/index.vue'),
    meta: {
      title: '设置',
      requiresAuth: true,
      permissions: ['settings:view'],
    },
  },
]
