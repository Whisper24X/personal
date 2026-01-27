import { RouteRecordRaw } from 'vue-router'
import loginRoute from './login'
import role from './role'
import permissionRoutes from './permission'
import contractRoutes from './contract'
import courseRoutes from './course'
import goodRoutes from './good'
import orderRoutes from './order'
import userRoutes from './user'
import evaluationRoutes from './evaluation'
import miniProgramRoutes from './miniProgram'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    hidden?: boolean
    ignoreAuth?: boolean
    permissions?: string[]
    /** 当前激活的菜单 */
    activeMenu?: string
  }
}

/** 异步路由 */
export const asyncRoutes: RouteRecordRaw[] = [
  ...orderRoutes,
  ...contractRoutes,
  ...goodRoutes,
  ...courseRoutes,
  // 用户管理
  ...userRoutes,
  // 角色管理
  ...role,
  // 评价管理
  ...evaluationRoutes,
  // 小程序管理
  ...miniProgramRoutes,
]

// 定义一个主布局路由
export const mainRoute: RouteRecordRaw = {
  path: '/',
  name: 'Layout',
  component: () => import('@/pages/layouts/main.vue'),
  children: [],
}

const routes: RouteRecordRaw[] = [
  mainRoute,
  ...loginRoute,
  {
    path: '/404',
    name: 'PageNotExist',
    component: () => import('@/pages/exception/404.vue'),
    meta: {
      // ignoreAuth: true,
    },
  },
  {
    path: '/403',
    name: 'NoPermission',
    component: () => import('@/pages/exception/403.vue'),
    meta: {
      // ignoreAuth: true,
    },
  },
]

export default routes
