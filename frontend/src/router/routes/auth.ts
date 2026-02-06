import type { AppRouteRecord } from '@/types/router/route'

export const authRoutes: AppRouteRecord[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login/index.vue'),
    meta: {
      layout: 'auth',
      title: '登录',
      requiresAuth: false,
    },
  },
]
