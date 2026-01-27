import { RouteRecordRaw } from 'vue-router'

const permissionRoutes: RouteRecordRaw[] = [
  {
    path: 'test',
    name: 'permissionTest',
    component: () => import('@/pages/authority/permission/index.vue'),
    meta: {
      title: '权限列表--测试',
      ignoreAuth: true,
    },
  },
]

export default permissionRoutes
