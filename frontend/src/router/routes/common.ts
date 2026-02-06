import type { AppRouteRecord } from '@/types/router/route'

export const commonRoutes: AppRouteRecord[] = [
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/not-found/index.vue'),
    meta: {
      layout: 'auth',
      title: '页面不存在',
      requiresAuth: false,
    },
  },
]
