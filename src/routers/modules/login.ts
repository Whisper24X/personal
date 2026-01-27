import { RouteRecordRaw } from 'vue-router'

export const loginRoute: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/authority/login/index.vue'),
  },
]

export default loginRoute
