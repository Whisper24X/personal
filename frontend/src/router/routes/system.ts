import type { AppRouteRecord } from '@/types/router/route'
import { appSettings } from '@/config/setting'
import { SETTINGS_QUERY_KEY } from '@/types/common/settings'
import { buildRouteAccessMeta } from '@/constants/access-control'

const resolveProjectId = (id: string | string[] | undefined) => (Array.isArray(id) ? id[0] : id)

const toDashboardSettings = (section: string) => ({
  path: '/dashboard',
  query: {
    [SETTINGS_QUERY_KEY]: section,
  },
})

export const systemRoutes: AppRouteRecord[] = [
  {
    path: '/',
    redirect: appSettings.defaultRoute,
    meta: buildRouteAccessMeta('rootRedirect'),
  },
  {
    path: '/home',
    name: 'home',
    component: () => import('@/views/home/index.vue'),
    meta: buildRouteAccessMeta('home'),
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/dashboard/index.vue'),
    meta: buildRouteAccessMeta('dashboard'),
  },
  {
    path: '/kanban',
    name: 'kanban',
    component: () => import('@/views/kanban/index.vue'),
    meta: buildRouteAccessMeta('kanban'),
  },
  {
    path: '/knowledge-base',
    name: 'knowledge-base',
    component: () => import('@/views/knowledge-base/index.vue'),
    meta: buildRouteAccessMeta('knowledgeBase', {
      contentMode: 'full',
    }),
  },
  {
    path: '/skills',
    name: 'skills',
    component: () => import('@/views/skills/index.vue'),
    meta: buildRouteAccessMeta('skills'),
  },
  {
    path: '/mcp',
    name: 'mcp',
    component: () => import('@/views/mcp/index.vue'),
    meta: buildRouteAccessMeta('mcp'),
  },
  {
    path: '/automations',
    name: 'automations',
    component: () => import('@/views/automations/index.vue'),
    meta: buildRouteAccessMeta('automations'),
  },
  {
    path: '/git',
    name: 'git',
    component: () => import('@/views/git/index.vue'),
    meta: buildRouteAccessMeta('git'),
  },
  {
    path: '/business-lines/invite',
    name: 'business-line-invite',
    component: () => import('@/views/business-lines/invite.vue'),
    meta: buildRouteAccessMeta('businessLineInvite'),
  },
  {
    path: '/business-lines',
    redirect: toDashboardSettings('business-lines'),
    meta: buildRouteAccessMeta('businessLines'),
  },
  {
    path: '/projects',
    redirect: toDashboardSettings('projects'),
    meta: buildRouteAccessMeta('projects'),
  },
  {
    path: '/projects/workflows',
    name: 'project-workflows',
    component: () => import('@/views/projects/detail.vue'),
    meta: buildRouteAccessMeta('projectWorkflows'),
  },
  {
    path: '/projects/:id',
    name: 'project-detail',
    component: () => import('@/views/projects/detail.vue'),
    meta: buildRouteAccessMeta('projectDetail'),
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
    meta: buildRouteAccessMeta('projectWorkflowsById'),
  },
  {
    path: '/tasks',
    name: 'tasks',
    component: () => import('@/views/tasks/index.vue'),
    meta: buildRouteAccessMeta('tasks'),
  },
  {
    path: '/task-detail/:id',
    name: 'task-detail',
    component: () => import('@/views/tasks/detail.vue'),
    meta: buildRouteAccessMeta('taskDetail', {
      contentMode: 'full',
    }),
  },
  {
    path: '/users',
    redirect: toDashboardSettings('users'),
    meta: buildRouteAccessMeta('users'),
  },
  {
    path: '/settings',
    redirect: toDashboardSettings('account'),
    meta: buildRouteAccessMeta('settings'),
  },
]
