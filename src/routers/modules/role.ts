import { RouteRecordRaw } from 'vue-router'

const roleRoutes: RouteRecordRaw[] = [
  {
    path: '/permission',
    name: 'Permission',
    meta: {
      title: '权限管理',
      icon: 'role',
    },
    children: [
      {
        path: 'account',
        name: 'Account',
        component: () => import('@/pages/authority/account/index.vue'),
        meta: {
          title: '账号管理',
          icon: 'account',
        },
      },
      {
        path: 'role',
        name: 'Role',
        component: () => import('@/pages/authority/role/index.vue'),
        meta: {
          title: '角色管理',
          icon: 'role',
        },
      },
      {
        path: 'department',
        name: 'Department',
        component: () => import('@/pages/authority/department/index.vue'),
        meta: {
          title: '部门管理',
          icon: 'Department',
        },
      },
      {
        path: 'list',
        name: 'PermissionList',
        component: () => import('@/pages/authority/permission/index.vue'),
        meta: {
          title: '权限列表',
        },
      },
    ],
  },
]

export default roleRoutes
