import { createRouter, createWebHistory } from 'vue-router'
import { toRaw } from 'vue'

import routes from './modules'
import { useUserStore } from '@/store/modules/userStore'
import { getToken } from '@/utils/token'

const router = createRouter({
  history: createWebHistory(process.env.APP_PROJECT_NAME),
  routes,
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()
  const token = getToken()
  console.log('token', token, to.fullPath, from.fullPath)
  console.log(
    'userStore.menus',
    toRaw(userStore),
    toRaw(userStore.menus),
    userStore.authInited,
  )

  // 处理登录页面
  if (to.path === '/login') {
    if (token) {
      next('/')
    } else {
      next()
    }
    return
  }

  // 处理无需权限的页面
  if (to.meta.ignoreAuth) {
    next()
    return
  }
  // 处理需要权限的页面
  if (token) {
    if (!userStore.authInited) {
      try {
        await userStore.getUserPermissions(router)
        // 路由不在菜单中，返回403页面
        if (userStore.getRouteByPath(to.path)) {
          return next('/403')
        }

        // 如果是访问根路径，重定向到第一个有权限的页面
        if (to.path === '/') {
          const firstRoute = userStore.getFirstAvailableRoute()
          next(firstRoute)
        } else {
          // 重新触发路由解析
          next({ ...to, replace: true })
        }
      } catch (error) {
        next(`/login?redirect=${to.path}`)
      }
    } else {
      // 路由不在菜单中，返回403页面
      if (userStore.getRouteByPath(to.path)) {
        return next('/403')
      }
      // 已经初始化过权限
      if (to.path === '/') {
        const firstRoute = userStore.getFirstAvailableRoute()
        next(firstRoute)
      } else {
        next()
      }
    }
  } else {
    next(`/login?redirect=${to.path}`)
  }
})

export default router
